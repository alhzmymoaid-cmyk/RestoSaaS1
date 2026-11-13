-- ============================================================================
-- Migration 003: العزل الصارم لعلاقات المطاعم، تسعير الطلبات من الخادم،
--                توليد أرقام الطلبات الذري اليومي (ORD-YYYYMMDD-001)،
--                وحماية دوال الإحصائيات والـ RLS
-- Database: PostgreSQL (Supabase)
-- ============================================================================

-- ============================================================================
-- أولاً: ضمان عدم إمكانية ربط منتجات أو بيانات مطعم بعناصر تابعة لمطعم آخر
-- ============================================================================

-- 1. دالة Trigger تمنع ربط أي منتج بقسم (category_id) يخص مطعماً آخر
CREATE OR REPLACE FUNCTION public.enforce_product_category_tenant_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cat_restaurant_id UUID;
BEGIN
  SELECT c.restaurant_id INTO v_cat_restaurant_id
  FROM public.categories c
  WHERE c.id = NEW.category_id;

  IF v_cat_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Invalid category_id: Category does not exist';
  END IF;

  IF v_cat_restaurant_id <> NEW.restaurant_id THEN
    RAISE EXCEPTION 'Cross-tenant violation: Product restaurant_id (%) does not match Category restaurant_id (%)',
      NEW.restaurant_id, v_cat_restaurant_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_product_category_tenant ON public.products;
CREATE TRIGGER trg_enforce_product_category_tenant
  BEFORE INSERT OR UPDATE OF restaurant_id, category_id ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_product_category_tenant_match();

-- 2. دالة Trigger تمنع ربط أي حدث إحصائي (analytics_events) بمنتج يخص مطعماً آخر
CREATE OR REPLACE FUNCTION public.enforce_analytics_product_tenant_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prod_restaurant_id UUID;
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    SELECT p.restaurant_id INTO v_prod_restaurant_id
    FROM public.products p
    WHERE p.id = NEW.product_id;

    IF v_prod_restaurant_id IS NULL OR v_prod_restaurant_id <> NEW.restaurant_id THEN
      RAISE EXCEPTION 'Cross-tenant violation: Analytics event restaurant_id does not match Product restaurant_id';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_analytics_product_tenant ON public.analytics_events;
CREATE TRIGGER trg_enforce_analytics_product_tenant
  BEFORE INSERT OR UPDATE ON public.analytics_events
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_analytics_product_tenant_match();

-- 3. دالة Trigger تمنع مالك المطعم من تعديل الحقول السيادية (id, slug, owner_id, owner_email, visits_count)
CREATE OR REPLACE FUNCTION public.protect_restaurant_immutable_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- إذا كان التحديث قادماً من مستخدم عادي (مالك مطعم وليس Super Admin وليس عملية نظام داخلية)
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin() THEN
    IF NEW.id <> OLD.id OR NEW.slug <> OLD.slug THEN
      RAISE EXCEPTION 'Unauthorized: Restaurant ID and Slug cannot be modified by restaurant owner';
    END IF;

    -- السماح بتثبيت owner_id فقط إذا كان فارغاً (claim_pending_restaurant_ownership)، ومنع تغييره لمالك آخر
    IF OLD.owner_id IS NOT NULL AND NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
      RAISE EXCEPTION 'Unauthorized: Restaurant owner_id cannot be reassigned by restaurant owner';
    END IF;

    IF NEW.owner_email IS DISTINCT FROM OLD.owner_email THEN
      RAISE EXCEPTION 'Unauthorized: Restaurant owner_email can only be modified by Super Admin';
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

-- 4. تشديد سياسات RLS على المنتجات والأقسام والبانرات والعروض والمعرض لمنع نقل عنصر بين مطعمين
DROP POLICY IF EXISTS "Restaurant owner manages own products" ON public.products;
CREATE POLICY "Restaurant owner manages own products"
  ON public.products FOR ALL
  USING (public.owns_restaurant(restaurant_id))
  WITH CHECK (
    public.owns_restaurant(restaurant_id)
    AND EXISTS (
      SELECT 1 FROM public.categories c
      WHERE c.id = category_id AND c.restaurant_id = products.restaurant_id
    )
  );

-- ============================================================================
-- ثانياً: منع تجاوز دالة إنشاء الطلب ودوال الإحصائيات عبر سياسات INSERT المباشرة
-- ============================================================================

-- 1. إلغاء سياسة INSERT المباشرة للزوار على جدول الطلبات (orders)
--    بحيث لا يمكن إنشاء طلب إلا عبر الدالة الآمنة public.create_customer_order
DROP POLICY IF EXISTS "Public customers can create orders for active restaurants" ON public.orders;
DROP POLICY IF EXISTS "Only Super Admin can directly insert orders" ON public.orders;
CREATE POLICY "Only Super Admin can directly insert orders"
  ON public.orders FOR INSERT
  WITH CHECK (public.is_super_admin());

-- 2. إلغاء سياسة INSERT المباشرة للزوار على جدول الإحصائيات (analytics_events)
DROP POLICY IF EXISTS "Public can insert analytics events" ON public.analytics_events;
DROP POLICY IF EXISTS "No direct public insert on analytics_events" ON public.analytics_events;
CREATE POLICY "No direct public insert on analytics_events"
  ON public.analytics_events FOR INSERT
  WITH CHECK (public.is_super_admin());

-- 3. حماية دوال الإحصائيات من التلاعب والاستدعاء على مطاعم أو منتجات غير مفعلة أو بمعدل متكرر
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

  -- التأكد من أن المطعم موجود ونشط
  IF NOT EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = rest_id AND r.is_active = true
  ) THEN
    RETURN;
  END IF;

  -- حماية ضد الإغراق الآلي (Rate-Limit Guard: حد أقصى للزيادات في الثانية الواحدة لنفس المطعم)
  SELECT COUNT(*) INTO v_recent_count
  FROM public.analytics_events ae
  WHERE ae.restaurant_id = rest_id
    AND ae.event_type = 'page_view'
    AND ae.created_at > (NOW() - INTERVAL '2 seconds');

  IF v_recent_count >= 15 THEN
    RETURN;
  END IF;

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

  UPDATE public.products
  SET views_count = views_count + 1
  WHERE id = prod_id;

  INSERT INTO public.analytics_events (restaurant_id, event_type, product_id)
  VALUES (v_rest_id, 'product_view', prod_id);
END;
$$;

-- ============================================================================
-- ثالثاً: نظام التسلسل الذري اليومي لأرقام الطلبات (ORD-YYYYMMDD-001)
--         وحساب الأسعار والكميات والإجماليات داخل قاعدة البيانات
-- ============================================================================

-- 1. جدول عداد الطلبات اليومي الذري (يتجدد تلقائياً كل يوم مع قفل ذري Atomic Row Lock)
CREATE TABLE IF NOT EXISTS public.daily_order_counters (
    order_date DATE PRIMARY KEY,
    last_seq INTEGER NOT NULL DEFAULT 0 CHECK (last_seq >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.daily_order_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super Admin views daily counters" ON public.daily_order_counters;
CREATE POLICY "Super Admin views daily counters"
  ON public.daily_order_counters FOR SELECT
  USING (public.is_super_admin());

-- 2. فرض قيد الفرادة (UNIQUE) على رقم الطلب واسم العميل الإجباري في جدول الطلبات
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_unique_order_number
  ON public.orders(order_number);

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS chk_orders_customer_name_required;
ALTER TABLE public.orders
  ADD CONSTRAINT chk_orders_customer_name_required
  CHECK (length(trim(customer_name)) >= 2);

-- 3. دالة توليد رقم الطلب الذري اليومي (ORD-YYYYMMDD-001) بتوقيت السعودية (Asia/Riyadh)
CREATE OR REPLACE FUNCTION public.next_daily_order_number(p_tz TEXT DEFAULT 'Asia/Riyadh')
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := (NOW() AT TIME ZONE COALESCE(NULLIF(trim(p_tz), ''), 'Asia/Riyadh'))::date;
  v_date_str TEXT := to_char(v_today, 'YYYYMMDD');
  v_seq INTEGER;
BEGIN
  -- عملية UPSERT ذرية تقوم بقفل صف اليوم الحالي وزيادة التسلسل بمقدار 1 حتى مع التزامن العالي
  INSERT INTO public.daily_order_counters (order_date, last_seq, updated_at)
  VALUES (v_today, 1, NOW())
  ON CONFLICT (order_date) DO UPDATE
    SET last_seq = public.daily_order_counters.last_seq + 1,
        updated_at = NOW()
  RETURNING last_seq INTO v_seq;

  RETURN 'ORD-' || v_date_str || '-' || lpad(v_seq::text, 3, '0');
END;
$$;

-- 4. استبدال دالة إنشاء الطلب لتحسب الأسعار والإجماليات من قاعدة البيانات حصرياً
--    وتولد رقم الطلب الذري (ORD-YYYYMMDD-001) وترفض أي تلاعب بالأسعار أو المنتجات
DROP FUNCTION IF EXISTS public.create_customer_order(UUID, TEXT, TEXT, TEXT, public.fulfillment_type, TEXT, TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS public.create_customer_order(UUID, TEXT, TEXT, public.fulfillment_type, TEXT, TEXT, JSONB);

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

    -- البحث أولاً في جدول المنتجات التابعة لنفس المطعم حصرياً
    SELECT id, name, price, sizes, addons, is_available, is_visible
    INTO v_prod
    FROM public.products
    WHERE id = v_item_uuid AND restaurant_id = p_restaurant_id;

    IF v_prod.id IS NOT NULL THEN
      IF v_prod.is_visible IS NOT TRUE OR v_prod.is_available IS NOT TRUE THEN
        RAISE EXCEPTION 'Product "%" is currently unavailable', v_prod.name;
      END IF;

      v_unit_price := v_prod.price;

      -- حساب فرق سعر الحجم من قاعدة البيانات إن وجد
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

      -- حساب أسعار الإضافات من قاعدة البيانات إن وجدت
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

      -- زيادة عداد طلبات المنتج الفعلي
      UPDATE public.products
      SET orders_count = orders_count + v_qty
      WHERE id = v_prod.id AND restaurant_id = p_restaurant_id;

    ELSE
      -- إذا لم يكن في جدول المنتجات، نتحقق مما إذا كان عرضاً مؤقتاً نشطاً وساري الصلاحية لنفس المطعم
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

  -- 6. توليد رقم الطلب الفريد الذري اليومي (ORD-YYYYMMDD-001)
  v_order_number := public.next_daily_order_number('Asia/Riyadh');

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
