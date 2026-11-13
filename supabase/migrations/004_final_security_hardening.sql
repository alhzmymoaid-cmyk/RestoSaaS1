-- ============================================================================
-- Migration 004: التحصين الأمني النهائي لتوليد أرقام الطلبات الذري،
--                حماية الحقول السيادية والإحصائية للمطاعم والمنتجات،
--                وضبط صلاحيات EXECUTE للدوال الحساسة
-- Compatible with Migrations 001, 002, and 003 (Zero Data Loss)
-- ============================================================================

-- ============================================================================
-- أولاً: حماية دالة توليد أرقام الطلبات (next_daily_order_number)
--        ومنع استدعائها المباشر من المتصفح أو عبر RPC العام
-- ============================================================================

CREATE OR REPLACE FUNCTION public.next_daily_order_number(p_tz TEXT DEFAULT 'Asia/Riyadh')
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE;
  v_date_str TEXT;
  v_seq INTEGER;
BEGIN
  -- 1. التحقق الصارم من أن الاستدعاء قادم حصرياً من المسار الداخلي الموثوق (create_customer_order)
  --    يمنع أي مستخدم (anon أو authenticated أو حتى استدعاء خارجي مباشر) من حرق أو استهلاك أرقام الطلبات
  IF COALESCE(current_setting('app.internal_order_flow', true), '') <> 'true' THEN
    RAISE EXCEPTION 'Forbidden: Direct invocation of next_daily_order_number is prohibited. Order numbers are generated exclusively during verified order creation.';
  END IF;

  -- 2. حساب تاريخ اليوم بتوقيت الرياض (Asia/Riyadh)
  v_today := (NOW() AT TIME ZONE COALESCE(NULLIF(trim(p_tz), ''), 'Asia/Riyadh'))::date;
  v_date_str := to_char(v_today, 'YYYYMMDD');

  -- 3. عملية UPSERT ذرية (Atomic Row-Level Lock) تضمن عدم تكرار الرقم حتى مع وصول طلبات في نفس اللحظة
  --    وتبدأ تلقائياً من 1 (001) مع بداية كل يوم جديد
  INSERT INTO public.daily_order_counters (order_date, last_seq, updated_at)
  VALUES (v_today, 1, NOW())
  ON CONFLICT (order_date) DO UPDATE
    SET last_seq = public.daily_order_counters.last_seq + 1,
        updated_at = NOW()
  RETURNING last_seq INTO v_seq;

  RETURN 'ORD-' || v_date_str || '-' || lpad(v_seq::text, 3, '0');
END;
$$;

-- سحب صلاحيات EXECUTE المباشرة من الأدوار العامة والمستخدمين حتى لا تظهر الدالة في واجهة PostgREST RPC العامة
REVOKE ALL ON FUNCTION public.next_daily_order_number(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_daily_order_number(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.next_daily_order_number(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.next_daily_order_number(TEXT) TO postgres, service_role;

-- ============================================================================
-- ثانياً: تحديث دالة create_customer_order لتمرير سياق الاستدعاء الداخلي الموثوق
--         لدالة next_daily_order_number وتحديث عداد طلبات المنتجات بأمان
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_customer_order(
  p_restaurant_id UUID,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_fulfillment_type public.fulfillment_type,
  p_customer_address TEXT,
  p_notes TEXT,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rest RECORD;
  v_clean_name TEXT := trim(COALESCE(p_customer_name, ''));
  v_clean_phone TEXT := regexp_replace(COALESCE(p_customer_phone, ''), '[^0-9+]', '', 'g');
  v_clean_address TEXT := trim(COALESCE(p_customer_address, ''));
  v_clean_notes TEXT := trim(COALESCE(p_notes, ''));
  v_item JSONB;
  v_item_id_str TEXT;
  v_item_uuid UUID;
  v_qty INTEGER;
  v_size_name TEXT;
  v_req_addon TEXT;
  v_prod RECORD;
  v_offer RECORD;
  v_unit_price NUMERIC(10, 2);
  v_size_delta NUMERIC(10, 2);
  v_addon_price NUMERIC(10, 2);
  v_verified_addons JSONB;
  v_verified_items JSONB := '[]'::jsonb;
  v_subtotal NUMERIC(10, 2) := 0;
  v_delivery_fee NUMERIC(10, 2) := 0;
  v_total NUMERIC(10, 2) := 0;
  v_order_number TEXT;
  v_order_id UUID;
  v_created_at TIMESTAMPTZ;
BEGIN
  -- 1. التحقق الإلزامي من اسم العميل ورقم الجوال والعنوان
  IF length(v_clean_name) < 2 THEN
    RAISE EXCEPTION 'Customer name is required (at least 2 characters)';
  END IF;

  IF length(v_clean_phone) < 9 THEN
    RAISE EXCEPTION 'Valid customer phone number is required (at least 9 digits)';
  END IF;

  IF p_fulfillment_type = 'delivery' AND length(v_clean_address) < 5 THEN
    RAISE EXCEPTION 'Delivery address is required for delivery orders';
  END IF;

  -- 2. التحقق من وجود المطعم وتفعيله وجلب رسوم التوصيل المعتمدة من قاعدة البيانات
  SELECT id, name, whatsapp_number, delivery_fee, is_active
  INTO v_rest
  FROM public.restaurants
  WHERE id = p_restaurant_id;

  IF v_rest.id IS NULL OR v_rest.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Restaurant is not active or does not exist';
  END IF;

  -- 3. التحقق من قائمة الأصناف المطلوبة وعدم كونها فارغة
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order items array cannot be empty';
  END IF;

  IF jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Order exceeds maximum allowed line items (50)';
  END IF;

  -- تفعيل راية السياق الموثوق لتحديث عداد طلبات المنتجات وتوليد رقم الطلب الذري
  PERFORM set_config('app.internal_trusted_rpc', 'create_order', true);

  -- 4. فحص كل صنف وحساب سعره الفعلي من قاعدة البيانات (تجاهل أي سعر مرسل من العميل)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id_str := trim(COALESCE(v_item ->> 'product_id', ''));
    v_qty := COALESCE((v_item ->> 'quantity')::integer, 0);
    v_size_name := trim(COALESCE(v_item ->> 'size_name', ''));

    IF v_qty < 1 OR v_qty > 99 THEN
      RAISE EXCEPTION 'Invalid item quantity: must be between 1 and 99';
    END IF;

    IF v_item_id_str !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
      RAISE EXCEPTION 'Invalid product_id UUID format: %', v_item_id_str;
    END IF;

    v_item_uuid := v_item_id_str::uuid;
    v_verified_addons := '[]'::jsonb;

    SELECT id, name, price, sizes, addons, is_available, is_visible
    INTO v_prod
    FROM public.products
    WHERE id = v_item_uuid AND restaurant_id = p_restaurant_id;

    IF v_prod.id IS NOT NULL THEN
      IF v_prod.is_visible IS NOT TRUE OR v_prod.is_available IS NOT TRUE THEN
        RAISE EXCEPTION 'Product "%" is currently unavailable', v_prod.name;
      END IF;

      v_unit_price := v_prod.price;

      IF v_size_name <> '' AND jsonb_typeof(v_prod.sizes) = 'array' AND jsonb_array_length(v_prod.sizes) > 0 THEN
        SELECT COALESCE((sz ->> 'price_delta')::numeric, 0)
        INTO v_size_delta
        FROM jsonb_array_elements(v_prod.sizes) AS sz
        WHERE trim(COALESCE(sz ->> 'name', '')) = v_size_name
           OR trim(COALESCE(sz ->> 'id', '')) = v_size_name
        LIMIT 1;

        IF v_size_delta IS NULL THEN
          RAISE EXCEPTION 'Invalid size "%" for product "%"', v_size_name, v_prod.name;
        END IF;

        v_unit_price := GREATEST(0, v_unit_price + v_size_delta);
      END IF;

      IF v_item ? 'addons' AND jsonb_typeof(v_item -> 'addons') = 'array' THEN
        FOR v_req_addon IN SELECT jsonb_array_elements_text(v_item -> 'addons')
        LOOP
          SELECT COALESCE((ad ->> 'price')::numeric, 0)
          INTO v_addon_price
          FROM jsonb_array_elements(v_prod.addons) AS ad
          WHERE trim(COALESCE(ad ->> 'name', '')) = trim(v_req_addon)
             OR trim(COALESCE(ad ->> 'id', '')) = trim(v_req_addon)
          LIMIT 1;

          IF v_addon_price IS NULL THEN
            RAISE EXCEPTION 'Invalid addon "%" for product "%"', v_req_addon, v_prod.name;
          END IF;

          v_unit_price := v_unit_price + GREATEST(0, v_addon_price);
          v_verified_addons := v_verified_addons || to_jsonb(trim(v_req_addon));
        END LOOP;
      END IF;

      v_subtotal := v_subtotal + (v_unit_price * v_qty);

      v_verified_items := v_verified_items || jsonb_build_object(
        'product_id', v_prod.id,
        'product_name', v_prod.name,
        'size_name', NULLIF(v_size_name, ''),
        'addons', v_verified_addons,
        'quantity', v_qty,
        'unit_price', v_unit_price,
        'line_total', (v_unit_price * v_qty),
        'notes', NULLIF(trim(COALESCE(v_item ->> 'notes', '')), '')
      );

      UPDATE public.products
      SET orders_count = orders_count + v_qty
      WHERE id = v_prod.id AND restaurant_id = p_restaurant_id;

    ELSE
      SELECT id, title, offer_price, is_active, starts_at, ends_at
      INTO v_offer
      FROM public.offers
      WHERE id = v_item_uuid AND restaurant_id = p_restaurant_id;

      IF v_offer.id IS NULL THEN
        RAISE EXCEPTION 'Cross-tenant or non-existent item ID: % does not belong to this restaurant', v_item_uuid;
      END IF;

      IF v_offer.is_active IS NOT TRUE
         OR (v_offer.starts_at IS NOT NULL AND v_offer.starts_at > NOW())
         OR (v_offer.ends_at IS NOT NULL AND v_offer.ends_at < NOW()) THEN
        RAISE EXCEPTION 'Offer "%" is expired or inactive', v_offer.title;
      END IF;

      v_unit_price := GREATEST(0, v_offer.offer_price);
      v_subtotal := v_subtotal + (v_unit_price * v_qty);

      v_verified_items := v_verified_items || jsonb_build_object(
        'product_id', v_offer.id,
        'product_name', 'عرض: ' || v_offer.title,
        'size_name', 'باقة العرض الكاملة',
        'addons', '[]'::jsonb,
        'quantity', v_qty,
        'unit_price', v_unit_price,
        'line_total', (v_unit_price * v_qty),
        'notes', NULLIF(trim(COALESCE(v_item ->> 'notes', '')), '')
      );
    END IF;
  END LOOP;

  -- 5. حساب رسوم التوصيل والإجمالي النهائي في الخادم
  IF p_fulfillment_type = 'delivery' THEN
    v_delivery_fee := GREATEST(0, COALESCE(v_rest.delivery_fee, 15.00));
  ELSE
    v_delivery_fee := 0.00;
  END IF;

  v_total := v_subtotal + v_delivery_fee;

  -- 6. تفعيل راية المسار الداخلي الموثوق وتوليد رقم الطلب الذري (ORD-YYYYMMDD-001)
  PERFORM set_config('app.internal_order_flow', 'true', true);
  v_order_number := public.next_daily_order_number('Asia/Riyadh');
  PERFORM set_config('app.internal_order_flow', 'false', true);

  -- 7. حفظ الطلب الموثق في جدول orders
  INSERT INTO public.orders (
    restaurant_id,
    order_number,
    customer_name,
    customer_phone,
    fulfillment_type,
    customer_address,
    notes,
    items,
    subtotal,
    delivery_fee,
    total,
    status,
    sent_via_whatsapp
  ) VALUES (
    p_restaurant_id,
    v_order_number,
    v_clean_name,
    v_clean_phone,
    p_fulfillment_type,
    v_clean_address,
    v_clean_notes,
    v_verified_items,
    v_subtotal,
    v_delivery_fee,
    v_total,
    'new',
    true
  )
  RETURNING id, created_at INTO v_order_id, v_created_at;

  INSERT INTO public.analytics_events (restaurant_id, event_type)
  VALUES (p_restaurant_id, 'whatsapp_order');

  RETURN jsonb_build_object(
    'id', v_order_id,
    'restaurant_id', p_restaurant_id,
    'order_number', v_order_number,
    'customer_name', v_clean_name,
    'customer_phone', v_clean_phone,
    'fulfillment_type', p_fulfillment_type,
    'customer_address', v_clean_address,
    'notes', v_clean_notes,
    'items', v_verified_items,
    'subtotal', v_subtotal,
    'delivery_fee', v_delivery_fee,
    'total', v_total,
    'whatsapp_number', COALESCE(NULLIF(v_rest.whatsapp_number, ''), '966535717670'),
    'status', 'new',
    'created_at', v_created_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_customer_order(UUID, TEXT, TEXT, public.fulfillment_type, TEXT, TEXT, JSONB)
  TO anon, authenticated, service_role;

-- ============================================================================
-- ثالثاً: حماية بيانات المطاعم والحقول الحساسة (protect_restaurant_immutable_fields)
--         ومنع مالك المطعم من التلاعب بـ:
--         owner_id, owner_email, visits_count, created_at, is_active, id, slug
-- ============================================================================

-- تحديث الدوال الموثوقة لتمرير سياق التصريح الداخلي عند تحديث الحقول المحمية
CREATE OR REPLACE FUNCTION public.increment_restaurant_visit(rest_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent_count INTEGER;
BEGIN
  IF rest_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = rest_id AND r.is_active = true
  ) THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_recent_count
  FROM public.analytics_events ae
  WHERE ae.restaurant_id = rest_id
    AND ae.event_type = 'page_view'
    AND ae.created_at > (NOW() - INTERVAL '2 seconds');

  IF v_recent_count >= 15 THEN
    RETURN;
  END IF;

  PERFORM set_config('app.internal_trusted_rpc', 'increment_visit', true);

  UPDATE public.restaurants
  SET visits_count = visits_count + 1
  WHERE id = rest_id AND is_active = true;

  INSERT INTO public.analytics_events (restaurant_id, event_type)
  VALUES (rest_id, 'page_view');
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_product_view(prod_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rest_id UUID;
  v_recent_count INTEGER;
BEGIN
  IF prod_id IS NULL THEN
    RETURN;
  END IF;

  SELECT p.restaurant_id INTO v_rest_id
  FROM public.products p
  JOIN public.restaurants r ON r.id = p.restaurant_id
  WHERE p.id = prod_id
    AND p.is_visible = true
    AND r.is_active = true;

  IF v_rest_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_recent_count
  FROM public.analytics_events ae
  WHERE ae.product_id = prod_id
    AND ae.event_type = 'product_view'
    AND ae.created_at > (NOW() - INTERVAL '2 seconds');

  IF v_recent_count >= 10 THEN
    RETURN;
  END IF;

  PERFORM set_config('app.internal_trusted_rpc', 'increment_product_view', true);

  UPDATE public.products
  SET views_count = views_count + 1
  WHERE id = prod_id;

  INSERT INTO public.analytics_events (restaurant_id, event_type, product_id)
  VALUES (v_rest_id, 'product_view', prod_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_pending_restaurant_ownership(p_restaurant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_user_email TEXT;
  v_confirmed TIMESTAMPTZ;
  v_rest_name TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  IF public.owns_restaurant(p_restaurant_id) THEN
    RETURN TRUE;
  END IF;

  SELECT u.email, u.email_confirmed_at INTO v_user_email, v_confirmed
  FROM auth.users u
  WHERE u.id = v_uid;

  IF v_user_email IS NULL OR v_confirmed IS NULL THEN
    RETURN FALSE;
  END IF;

  PERFORM set_config('app.internal_trusted_rpc', 'claim_owner', true);

  UPDATE public.restaurants r
  SET owner_id = v_uid,
      updated_at = NOW()
  WHERE r.id = p_restaurant_id
    AND r.owner_id IS NULL
    AND r.owner_email <> ''
    AND lower(trim(r.owner_email)) = lower(trim(v_user_email))
  RETURNING r.name INTO v_rest_name;

  IF v_rest_name IS NULL THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, restaurant_id)
  VALUES (v_uid, v_user_email, 'مالك ' || v_rest_name, 'restaurant_owner', p_restaurant_id)
  ON CONFLICT (id) DO UPDATE
    SET restaurant_id = p_restaurant_id,
        updated_at = NOW();

  RETURN TRUE;
END;
$$;

-- Trigger حماية الحقول الحساسة لجدول المطاعم (protect_restaurant_immutable_fields)
CREATE OR REPLACE FUNCTION public.protect_restaurant_immutable_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trusted_rpc TEXT := COALESCE(current_setting('app.internal_trusted_rpc', true), '');
  v_jwt_role TEXT := COALESCE(current_setting('request.jwt.claim.role', true), '');
  v_is_super BOOLEAN := public.is_super_admin() OR (auth.uid() IS NULL AND v_jwt_role IN ('', 'service_role'));
BEGIN
  -- 1. الحقول الثابتة مطلقاً (لا يجوز تغيير معرف المطعم UUID أو تاريخ الإنشاء created_at لأي سبب)
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Security violation: Restaurant primary key (id) is immutable';
  END IF;

  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Security violation: Restaurant created_at timestamp is immutable';
  END IF;

  -- 2. حماية عداد الزيارات (visits_count): لا يتغير إلا عبر الدالة الموثوقة increment_restaurant_visit أو Super Admin
  IF NEW.visits_count IS DISTINCT FROM OLD.visits_count THEN
    IF v_trusted_rpc <> 'increment_visit' AND NOT v_is_super THEN
      RAISE EXCEPTION 'Security violation: visits_count cannot be modified directly by restaurant owner';
    END IF;
  END IF;

  -- 3. القيود المفروضة على مالك المطعم (غير Super Admin)
  IF NOT v_is_super THEN
    -- منع تغيير الرابط الفريد للمطعم (slug)
    IF NEW.slug IS DISTINCT FROM OLD.slug THEN
      RAISE EXCEPTION 'Security violation: Restaurant slug cannot be modified by restaurant owner';
    END IF;

    -- منع تغيير حالة تفعيل/إيقاف المطعم (is_active)
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Security violation: Restaurant active status (is_active) can only be modified by Super Admin';
    END IF;

    -- منع تغيير البريد المعتمد للمالك (owner_email)
    IF NEW.owner_email IS DISTINCT FROM OLD.owner_email THEN
      RAISE EXCEPTION 'Security violation: Restaurant owner_email can only be modified by Super Admin';
    END IF;

    -- منع تغيير ملكية المطعم (owner_id) إلا عبر التدفق الآمن الموثوق لتثبيت الملكية الأولى (claim_owner)
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
      IF NOT (OLD.owner_id IS NULL AND v_trusted_rpc = 'claim_owner' AND NEW.owner_id = auth.uid()) THEN
        RAISE EXCEPTION 'Security violation: Restaurant owner_id cannot be modified or reassigned by restaurant owner';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_restaurant_immutable_fields ON public.restaurants;
CREATE TRIGGER trg_protect_restaurant_immutable_fields
  BEFORE UPDATE ON public.restaurants
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_restaurant_immutable_fields();

-- Trigger إضافي لحماية الحقول الإحصائية والسيادية لجدول المنتجات (products)
CREATE OR REPLACE FUNCTION public.protect_product_immutable_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trusted_rpc TEXT := COALESCE(current_setting('app.internal_trusted_rpc', true), '');
  v_jwt_role TEXT := COALESCE(current_setting('request.jwt.claim.role', true), '');
  v_is_super BOOLEAN := public.is_super_admin() OR (auth.uid() IS NULL AND v_jwt_role IN ('', 'service_role'));
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.restaurant_id IS DISTINCT FROM OLD.restaurant_id THEN
    RAISE EXCEPTION 'Security violation: Product id and restaurant_id are immutable';
  END IF;

  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Security violation: Product created_at timestamp is immutable';
  END IF;

  IF NEW.views_count IS DISTINCT FROM OLD.views_count THEN
    IF v_trusted_rpc <> 'increment_product_view' AND NOT v_is_super THEN
      RAISE EXCEPTION 'Security violation: Product views_count cannot be modified directly';
    END IF;
  END IF;

  IF NEW.orders_count IS DISTINCT FROM OLD.orders_count THEN
    IF v_trusted_rpc <> 'create_order' AND NOT v_is_super THEN
      RAISE EXCEPTION 'Security violation: Product orders_count cannot be modified directly';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_product_immutable_fields ON public.products;
CREATE TRIGGER trg_protect_product_immutable_fields
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_product_immutable_fields();

-- ضبط صلاحيات EXECUTE لدوال Super Admin بحيث لا يمكن استدعاؤها من الزوار غير المسجلين
REVOKE ALL ON FUNCTION public.provision_new_restaurant(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provision_new_restaurant(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.assign_restaurant_owner(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_restaurant_owner(UUID, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.claim_pending_restaurant_ownership(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_pending_restaurant_ownership(UUID) TO authenticated, service_role;
