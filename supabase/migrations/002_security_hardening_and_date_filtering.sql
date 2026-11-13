-- ============================================================================
-- Migration 002 (v2.1): عزل Storage، فلترة تواريخ العروض، الربط الآمن التلقائي
-- لحسابات الملاك (auth.users -> profiles & restaurants.owner_id)، وإرسال الطلبات
-- ============================================================================

-- 1. التأكد من وجود عمود owner_email في جدول المطاعم (للترقية السلسة من v1)
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS owner_email TEXT NOT NULL DEFAULT '';

-- 2. دالة التحقق من ملكية مجلد التخزين في Supabase Storage (عزل صارم لكل مطعم)
CREATE OR REPLACE FUNCTION public.can_manage_storage_object(object_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_folder TEXT;
  v_rest_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  IF public.is_super_admin() THEN
    RETURN TRUE;
  END IF;

  v_folder := split_part(object_name, '/', 1);
  IF v_folder IS NULL OR v_folder = '' THEN
    RETURN FALSE;
  END IF;

  SELECT r.id INTO v_rest_id
  FROM public.restaurants r
  WHERE r.slug = v_folder OR r.id::text = v_folder
  LIMIT 1;

  IF v_rest_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN public.owns_restaurant(v_rest_id);
END;
$$;

-- 3. استبدال سياسات Supabase Storage بسياسات معزولة لكل مطعم (بدون أي تعارض)
DROP POLICY IF EXISTS "Authenticated owners can upload to their restaurant folder" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated owners can update or delete their media" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated storage insert" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated storage update" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated storage delete" ON storage.objects;

CREATE POLICY "Tenant isolated storage insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'restaurant-media'
    AND public.can_manage_storage_object(name)
  );

CREATE POLICY "Tenant isolated storage update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'restaurant-media'
    AND public.can_manage_storage_object(name)
  )
  WITH CHECK (
    bucket_id = 'restaurant-media'
    AND public.can_manage_storage_object(name)
  );

CREATE POLICY "Tenant isolated storage delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'restaurant-media'
    AND public.can_manage_storage_object(name)
  );

-- 4. تحديث سياسات القراءة لجدولي البانرات والعروض لتطبيق فلترة تاريخ البداية والنهاية
DROP POLICY IF EXISTS "Public can view active banners" ON public.banners;
DROP POLICY IF EXISTS "Public can view active banners within date window" ON public.banners;
CREATE POLICY "Public can view active banners within date window"
  ON public.banners FOR SELECT
  USING (
    (
      is_active = true
      AND (starts_at IS NULL OR starts_at <= NOW())
      AND (ends_at IS NULL OR ends_at >= NOW())
    )
    OR public.owns_restaurant(restaurant_id)
  );

DROP POLICY IF EXISTS "Public can view active offers" ON public.offers;
DROP POLICY IF EXISTS "Public can view active offers within date window" ON public.offers;
CREATE POLICY "Public can view active offers within date window"
  ON public.offers FOR SELECT
  USING (
    (
      is_active = true
      AND (starts_at IS NULL OR starts_at <= NOW())
      AND (ends_at IS NULL OR ends_at >= NOW())
    )
    OR public.owns_restaurant(restaurant_id)
  );

-- ============================================================================
-- 5. الربط التلقائي الآمن لحساب المالك عبر UUID عند التسجيل/تأكيد البريد في auth.users
--    (لا يمنح صلاحيات بالبريد وحده، بل يربط owner_id = NEW.id وprofiles.id = NEW.id
--     فقط للمطعم الذي لم يُربط بمالك بعد owner_id IS NULL وعند تأكيد البريد)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_matched_rest_id UUID;
  v_rest_name TEXT;
BEGIN
  -- البحث عن مطعم بانتظار ربط المالك (owner_id IS NULL) يطابق البريد المؤكد
  IF NEW.email IS NOT NULL AND (NEW.email_confirmed_at IS NOT NULL OR NEW.confirmed_at IS NOT NULL) THEN
    SELECT r.id, r.name INTO v_matched_rest_id, v_rest_name
    FROM public.restaurants r
    WHERE r.owner_id IS NULL
      AND r.owner_email <> ''
      AND lower(trim(r.owner_email)) = lower(trim(NEW.email))
    ORDER BY r.created_at ASC
    LIMIT 1;

    IF v_matched_rest_id IS NOT NULL THEN
      UPDATE public.restaurants
      SET owner_id = NEW.id,
          updated_at = NOW()
      WHERE id = v_matched_rest_id AND owner_id IS NULL;
    END IF;
  END IF;

  -- إنشاء أو تحديث سجل الصلاحيات في جدول profiles بمعرف UUID الحقيقي
  INSERT INTO public.profiles (id, email, full_name, role, restaurant_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', CASE WHEN v_rest_name IS NOT NULL THEN 'مالك ' || v_rest_name ELSE '' END),
    'restaurant_owner',
    v_matched_rest_id
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        restaurant_id = COALESCE(public.profiles.restaurant_id, EXCLUDED.restaurant_id),
        updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE OF email_confirmed_at, email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- 6. دالة RPC آمنة لتثبيت ملكية المطعم للمستخدم المسجل حالياً إذا كان owner_id فارغاً وبريده مؤكداً
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

  -- إذا كان يملك المطعم بالفعل عبر UUID
  IF public.owns_restaurant(p_restaurant_id) THEN
    RETURN TRUE;
  END IF;

  -- التحقق من جدول auth.users مباشرة للتأكد من أن البريد مؤكد
  SELECT u.email, u.email_confirmed_at INTO v_user_email, v_confirmed
  FROM auth.users u
  WHERE u.id = v_uid;

  IF v_user_email IS NULL OR v_confirmed IS NULL THEN
    RETURN FALSE;
  END IF;

  -- ربط المطعم بـ UUID المستخدم فقط إذا كان owner_id IS NULL والبريد المحدد من Super Admin مطابقاً
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

-- 7. دالة RPC لمدير النظام (Super Admin) لتعيين أو تغيير مالك مطعم وربط UUID فوراً إن وجد
CREATE OR REPLACE FUNCTION public.assign_restaurant_owner(
  p_restaurant_id UUID,
  p_owner_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_email TEXT := lower(trim(COALESCE(p_owner_email, '')));
  v_existing_uid UUID;
  v_rest_name TEXT;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin can assign restaurant owners';
  END IF;

  SELECT name INTO v_rest_name FROM public.restaurants WHERE id = p_restaurant_id;
  IF v_rest_name IS NULL THEN
    RAISE EXCEPTION 'Restaurant not found';
  END IF;

  -- البحث في auth.users عن مستخدم مؤكد يحمل هذا البريد
  SELECT u.id INTO v_existing_uid
  FROM auth.users u
  WHERE lower(trim(u.email)) = v_clean_email
    AND u.email_confirmed_at IS NOT NULL
  LIMIT 1;

  UPDATE public.restaurants
  SET owner_email = v_clean_email,
      owner_id = v_existing_uid,
      updated_at = NOW()
  WHERE id = p_restaurant_id;

  IF v_existing_uid IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, full_name, role, restaurant_id)
    VALUES (v_existing_uid, v_clean_email, 'مالك ' || v_rest_name, 'restaurant_owner', p_restaurant_id)
    ON CONFLICT (id) DO UPDATE
      SET restaurant_id = p_restaurant_id,
          email = v_clean_email,
          updated_at = NOW();
  END IF;

  RETURN jsonb_build_object(
    'restaurant_id', p_restaurant_id,
    'owner_email', v_clean_email,
    'owner_id', v_existing_uid,
    'linked_immediately', (v_existing_uid IS NOT NULL)
  );
END;
$$;

-- 8. دالة RPC لمدير النظام (Super Admin) لإنشاء مطعم جديد مع أقسام افتراضية وربط المالك
CREATE OR REPLACE FUNCTION public.provision_new_restaurant(
  p_slug TEXT,
  p_name TEXT,
  p_tagline TEXT,
  p_primary_color TEXT,
  p_whatsapp TEXT,
  p_city TEXT,
  p_owner_email TEXT,
  p_owner_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_rest_id UUID;
  v_cat_id UUID;
  v_resolved_owner_id UUID := p_owner_id;
  v_clean_email TEXT := lower(trim(COALESCE(p_owner_email, '')));
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin can provision new restaurants';
  END IF;

  -- إذا لم يُمرر UUID المالك مباشرة، نبحث عنه في auth.users بشرط تأكيد البريد
  IF v_resolved_owner_id IS NULL AND v_clean_email <> '' THEN
    SELECT u.id INTO v_resolved_owner_id
    FROM auth.users u
    WHERE lower(trim(u.email)) = v_clean_email
      AND u.email_confirmed_at IS NOT NULL
    LIMIT 1;
  END IF;

  INSERT INTO public.restaurants (
    slug, name, tagline, primary_color, whatsapp_number, phone, city, owner_email, owner_id, is_active
  ) VALUES (
    lower(trim(p_slug)),
    trim(p_name),
    COALESCE(NULLIF(trim(p_tagline), ''), 'قائمة طعام رقمية فاخرة'),
    COALESCE(NULLIF(trim(p_primary_color), ''), '#D97706'),
    COALESCE(NULLIF(trim(p_whatsapp), ''), '966535717670'),
    COALESCE(NULLIF(trim(p_whatsapp), ''), '0535717670'),
    COALESCE(NULLIF(trim(p_city), ''), 'جدة'),
    v_clean_email,
    v_resolved_owner_id,
    true
  )
  RETURNING id INTO v_new_rest_id;

  INSERT INTO public.categories (restaurant_id, name, slug, description, image_url, sort_order, is_visible)
  VALUES (
    v_new_rest_id,
    'الأصناف الرئيسية',
    'main-dishes',
    'تشكيلة مختارة من أطباقنا المميزة المحضرة يومياً',
    '/images/burger-house/hero-wagyu-smash.jpg',
    1,
    true
  )
  RETURNING id INTO v_cat_id;

  INSERT INTO public.products (
    restaurant_id, category_id, name, description, price, image_url,
    is_available, is_visible, is_bestseller, is_featured, is_new, sizes, addons, sort_order
  ) VALUES (
    v_new_rest_id,
    v_cat_id,
    'وجبة الشيف الخاصة — ' || trim(p_name),
    'صنف تجريبي أولي تم إنشاؤه تلقائياً، يمكنك تعديله أو حذفه من لوحة تحكم المطعم.',
    45.00,
    '/images/burger-house/hero-wagyu-smash.jpg',
    true, true, true, true, true,
    '[{"id":"s1","name":"حجم عادي","price_delta":0},{"id":"s2","name":"حجم كبير","price_delta":12}]'::jsonb,
    '[{"id":"a1","name":"إضافة خاصة","price":5}]'::jsonb,
    1
  );

  IF v_resolved_owner_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, full_name, role, restaurant_id)
    VALUES (v_resolved_owner_id, v_clean_email, 'مالك ' || trim(p_name), 'restaurant_owner', v_new_rest_id)
    ON CONFLICT (id) DO UPDATE
      SET restaurant_id = v_new_rest_id,
          role = 'restaurant_owner',
          updated_at = NOW();
  END IF;

  RETURN v_new_rest_id;
END;
$$;

-- 9. دالة RPC لإنشاء طلب عميل بأمان دون منح الزائر صلاحية قراءة جدول الطلبات (SELECT)
CREATE OR REPLACE FUNCTION public.create_customer_order(
  p_restaurant_id UUID,
  p_order_number TEXT,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_fulfillment_type public.fulfillment_type,
  p_customer_address TEXT,
  p_notes TEXT,
  p_items JSONB,
  p_subtotal NUMERIC,
  p_delivery_fee NUMERIC,
  p_total NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_created_at TIMESTAMPTZ;
  v_item JSONB;
  v_prod_id TEXT;
  v_qty INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = p_restaurant_id AND r.is_active = true
  ) THEN
    RAISE EXCEPTION 'Restaurant is not active or does not exist';
  END IF;

  INSERT INTO public.orders (
    restaurant_id, order_number, customer_name, customer_phone,
    fulfillment_type, customer_address, notes, items,
    subtotal, delivery_fee, total, status, sent_via_whatsapp
  ) VALUES (
    p_restaurant_id,
    p_order_number,
    trim(p_customer_name),
    trim(p_customer_phone),
    p_fulfillment_type,
    COALESCE(trim(p_customer_address), ''),
    COALESCE(trim(p_notes), ''),
    COALESCE(p_items, '[]'::jsonb),
    COALESCE(p_subtotal, 0),
    COALESCE(p_delivery_fee, 0),
    COALESCE(p_total, 0),
    'new',
    true
  )
  RETURNING id, created_at INTO v_order_id, v_created_at;

  -- تحديث عداد الطلبات للمنتجات المطلوبة
  IF jsonb_typeof(p_items) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_prod_id := v_item ->> 'product_id';
      v_qty := COALESCE((v_item ->> 'quantity')::integer, 1);
      IF v_prod_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
        UPDATE public.products
        SET orders_count = orders_count + GREATEST(1, v_qty)
        WHERE id = v_prod_id::uuid AND restaurant_id = p_restaurant_id;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.analytics_events (restaurant_id, event_type)
  VALUES (p_restaurant_id, 'whatsapp_order');

  RETURN jsonb_build_object(
    'id', v_order_id,
    'order_number', p_order_number,
    'status', 'new',
    'created_at', v_created_at
  );
END;
$$;
