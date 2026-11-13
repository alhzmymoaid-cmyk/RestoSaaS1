-- ============================================================================
-- Migration 001: المخطط الأساسي لنظام SaaS متعدد المطاعم والمنيوهات الرقمية
-- Database: PostgreSQL (Supabase) — Idempotent Base Schema
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. الأنواع المخصصة (ENUMS)
DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('super_admin', 'restaurant_owner');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.order_status AS ENUM ('new', 'preparing', 'ready', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.fulfillment_type AS ENUM ('pickup', 'dine_in', 'delivery');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. جدول المطاعم (RESTAURANTS - Tenants)
CREATE TABLE IF NOT EXISTS public.restaurants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9-]+$'),
    name TEXT NOT NULL,
    tagline TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    owner_email TEXT NOT NULL DEFAULT '',
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    logo_url TEXT DEFAULT '/images/burger-house/hero-wagyu-smash.jpg',
    hero_image_url TEXT NOT NULL DEFAULT '/images/burger-house/hero-wagyu-smash.jpg',
    hero_badge TEXT NOT NULL DEFAULT 'لحم واغيو طازج يُحضر يومياً على اللهب',
    hero_title TEXT NOT NULL DEFAULT 'فن البرجر الفاخر على أصوله الحقيقية',
    hero_subtitle TEXT NOT NULL DEFAULT 'نجمع بين أجود قطع لحم الواغيو الأسترالي الفاخر وخبز البريوش المخبوز طازجاً كل صباح مع صوصاتنا السرية الخاصة.',
    hero_primary_cta TEXT NOT NULL DEFAULT 'تصفح المنيو واطلب الآن',
    hero_secondary_cta TEXT NOT NULL DEFAULT 'اكتشف عروض اليوم',
    story_badge TEXT NOT NULL DEFAULT 'قصتنا وهويتنا',
    story_title TEXT NOT NULL DEFAULT 'شغف الجودة من المزرعة إلى الشواية',
    story_content TEXT NOT NULL DEFAULT 'تأسس برجر هاوس ليقدم تجربة برجر استثنائية تبتعد عن الوجبات السريعة التقليدية. نختار لحوم الواغيو والبريسكت المدخن بعناية فائقة، ونحضر كافة الصوصات والمخللات داخل مطبخنا يومياً لنضمن لك طعماً لا يُنسى في كل قضمة.',
    story_image_url TEXT NOT NULL DEFAULT '/images/burger-house/interior-lounge.jpg',
    story_highlights JSONB NOT NULL DEFAULT '[
      {"title": "لحم واغيو 100%", "subtitle": "طازج يومياً غير مجمد ومشوي على طريقة السماش الاحترافية"},
      {"title": "خبز بريوش حرفي", "subtitle": "يُخبز فجراً بالزبدة الطبيعية ليمنحك قواماً ذهبياً هَشّاً"},
      {"title": "تدخين بطيء 12 ساعة", "subtitle": "قطع البريسكت تُدخن بخشب البلوط الطبيعي لنكهة عميقة"}
    ]'::jsonb,
    primary_color TEXT NOT NULL DEFAULT '#D97706',
    secondary_color TEXT NOT NULL DEFAULT '#F59E0B',
    accent_color TEXT NOT NULL DEFAULT '#FBBF24',
    bg_color TEXT NOT NULL DEFAULT '#0C0A09',
    surface_color TEXT NOT NULL DEFAULT '#1C1917',
    heading_font TEXT NOT NULL DEFAULT 'Cairo',
    body_font TEXT NOT NULL DEFAULT 'Tajawal',
    theme_mode TEXT NOT NULL DEFAULT 'dark' CHECK (theme_mode IN ('dark', 'light')),
    whatsapp_number TEXT NOT NULL DEFAULT '966535717670',
    phone TEXT NOT NULL DEFAULT '0535717670',
    address TEXT NOT NULL DEFAULT 'طريق الملك عبدالعزيز، حي الشاطئ، جدة',
    city TEXT NOT NULL DEFAULT 'جدة',
    google_maps_url TEXT NOT NULL DEFAULT 'https://maps.google.com/?q=Jeddah+Corniche',
    opening_hours JSONB NOT NULL DEFAULT '[
      {"days": "السبت - الأربعاء", "hours": "1:00 مساءً - 2:00 صباحاً", "is_open": true},
      {"days": "الخميس - الجمعة", "hours": "1:00 مساءً - 4:00 صباحاً", "is_open": true}
    ]'::jsonb,
    social_links JSONB NOT NULL DEFAULT '{
      "instagram": "https://instagram.com/burgerhouse.sa",
      "tiktok": "https://tiktok.com/@burgerhouse.sa",
      "snapchat": "https://snapchat.com/add/burgerhouse.sa",
      "x": "https://x.com/burgerhouse_sa"
    }'::jsonb,
    homepage_sections JSONB NOT NULL DEFAULT '[
      {"key": "hero", "label": "الواجهة الرئيسية (Hero)", "visible": true, "sort_order": 1},
      {"key": "offers", "label": "العروض والإعلانات المؤقتة", "visible": true, "sort_order": 2},
      {"key": "banners", "label": "البانرات الإعلانية المتحركة", "visible": true, "sort_order": 3},
      {"key": "categories", "label": "التصنيفات الرئيسية المصورة", "visible": true, "sort_order": 4},
      {"key": "bestsellers", "label": "المنتجات الأكثر طلباً", "visible": true, "sort_order": 5},
      {"key": "featured", "label": "الأصناف المميزة وتوصيات الشيف", "visible": true, "sort_order": 6},
      {"key": "menu", "label": "المنيو الإلكتروني الكامل", "visible": true, "sort_order": 7},
      {"key": "story", "label": "عن المطعم وقصته وهويته", "visible": true, "sort_order": 8},
      {"key": "gallery", "label": "معرض صور المطعم والوجبات", "visible": true, "sort_order": 9},
      {"key": "contact", "label": "الموقع وساعات العمل والتواصل", "visible": true, "sort_order": 10}
    ]'::jsonb,
    internal_orders_enabled BOOLEAN NOT NULL DEFAULT true,
    delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 15.00,
    visits_count INTEGER NOT NULL DEFAULT 14820,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. جدول الحسابات والصلاحيات (PROFILES)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL DEFAULT '',
    role public.user_role NOT NULL DEFAULT 'restaurant_owner',
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. جدول البانرات الإعلانية القابلة للجدولة (BANNERS)
CREATE TABLE IF NOT EXISTS public.banners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL DEFAULT '',
    badge_text TEXT NOT NULL DEFAULT 'عرض حصري',
    button_text TEXT NOT NULL DEFAULT 'اطلب العرض الآن',
    button_link TEXT NOT NULL DEFAULT '#menu',
    image_url TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 1,
    starts_at TIMESTAMPTZ DEFAULT NOW(),
    ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. جدول العروض المؤقتة (OFFERS)
CREATE TABLE IF NOT EXISTS public.offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    badge_text TEXT NOT NULL DEFAULT 'لفترة محدودة',
    original_price NUMERIC(10, 2) NOT NULL,
    offer_price NUMERIC(10, 2) NOT NULL,
    coupon_code TEXT DEFAULT '',
    image_url TEXT NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. جدول أقسام المنيو (CATEGORIES)
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 1,
    is_visible BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(restaurant_id, slug)
);

-- 7. جدول المنتجات والأصناف (PRODUCTS)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    compare_at_price NUMERIC(10, 2) DEFAULT NULL,
    calories INTEGER DEFAULT 650,
    prep_time_minutes INTEGER DEFAULT 12,
    image_url TEXT NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT true,
    is_visible BOOLEAN NOT NULL DEFAULT true,
    is_bestseller BOOLEAN NOT NULL DEFAULT false,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    is_new BOOLEAN NOT NULL DEFAULT false,
    sizes JSONB NOT NULL DEFAULT '[]'::jsonb,
    addons JSONB NOT NULL DEFAULT '[]'::jsonb,
    views_count INTEGER NOT NULL DEFAULT 0,
    orders_count INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. جدول معرض صور المطعم (GALLERY_IMAGES)
CREATE TABLE IF NOT EXISTS public.gallery_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    caption TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 1,
    is_visible BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. جدول الطلبات الواردة (ORDERS)
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    order_number TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    fulfillment_type public.fulfillment_type NOT NULL DEFAULT 'pickup',
    customer_address TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
    delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total NUMERIC(10, 2) NOT NULL DEFAULT 0,
    status public.order_status NOT NULL DEFAULT 'new',
    sent_via_whatsapp BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. جدول الإحصائيات والزيارات (ANALYTICS_EVENTS)
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('page_view', 'product_view', 'add_to_cart', 'whatsapp_order')),
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- الفهارس لتحسين الأداء (INDEXES)
CREATE INDEX IF NOT EXISTS idx_restaurants_slug ON public.restaurants(slug);
CREATE INDEX IF NOT EXISTS idx_restaurants_owner_id ON public.restaurants(owner_id);
CREATE INDEX IF NOT EXISTS idx_categories_restaurant ON public.categories(restaurant_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_products_restaurant ON public.products(restaurant_id, category_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_banners_restaurant ON public.banners(restaurant_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_offers_restaurant ON public.offers(restaurant_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON public.orders(restaurant_id, created_at DESC);

-- ============================================================================
-- دوال التحقق من الصلاحيات (RLS HELPER FUNCTIONS - SECURITY DEFINER)
-- تعتمد حصرياً على معرف المستخدم الموثق auth.uid() وربط UUID في قاعدة البيانات
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.owns_restaurant(target_restaurant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = target_restaurant_id AND r.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.role = 'super_admin' OR p.restaurant_id = target_restaurant_id)
  );
$$;

-- دوال تحديث الإحصائيات (RPCs)
CREATE OR REPLACE FUNCTION public.increment_restaurant_visit(rest_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.restaurants
  SET visits_count = visits_count + 1
  WHERE id = rest_id;

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
BEGIN
  UPDATE public.products
  SET views_count = views_count + 1
  WHERE id = prod_id
  RETURNING restaurant_id INTO v_rest_id;

  IF v_rest_id IS NOT NULL THEN
    INSERT INTO public.analytics_events (restaurant_id, event_type, product_id)
    VALUES (v_rest_id, 'product_view', prod_id);
  END IF;
END;
$$;

-- ============================================================================
-- تفعيل سياسات أمان مستوى الصفوف (ROW LEVEL SECURITY - RLS)
-- ============================================================================

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- سياسات جدول المطاعم (RESTAURANTS)
DROP POLICY IF EXISTS "Public can view active restaurants" ON public.restaurants;
CREATE POLICY "Public can view active restaurants"
  ON public.restaurants FOR SELECT
  USING (is_active = true OR public.owns_restaurant(id));

DROP POLICY IF EXISTS "Owner or Super Admin can update restaurant" ON public.restaurants;
CREATE POLICY "Owner or Super Admin can update restaurant"
  ON public.restaurants FOR UPDATE
  USING (public.owns_restaurant(id))
  WITH CHECK (public.owns_restaurant(id));

DROP POLICY IF EXISTS "Super Admin can insert or delete restaurants" ON public.restaurants;
CREATE POLICY "Super Admin can insert or delete restaurants"
  ON public.restaurants FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- سياسات جدول الحسابات (PROFILES)
DROP POLICY IF EXISTS "Users can view own profile or super admin views all" ON public.profiles;
CREATE POLICY "Users can view own profile or super admin views all"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "Super Admin manages profiles" ON public.profiles;
CREATE POLICY "Super Admin manages profiles"
  ON public.profiles FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- سياسات البانرات (BANNERS)
DROP POLICY IF EXISTS "Public can view active banners" ON public.banners;
CREATE POLICY "Public can view active banners"
  ON public.banners FOR SELECT
  USING (is_active = true OR public.owns_restaurant(restaurant_id));

DROP POLICY IF EXISTS "Restaurant owner manages own banners" ON public.banners;
CREATE POLICY "Restaurant owner manages own banners"
  ON public.banners FOR ALL
  USING (public.owns_restaurant(restaurant_id))
  WITH CHECK (public.owns_restaurant(restaurant_id));

-- سياسات العروض المؤقتة (OFFERS)
DROP POLICY IF EXISTS "Public can view active offers" ON public.offers;
CREATE POLICY "Public can view active offers"
  ON public.offers FOR SELECT
  USING (is_active = true OR public.owns_restaurant(restaurant_id));

DROP POLICY IF EXISTS "Restaurant owner manages own offers" ON public.offers;
CREATE POLICY "Restaurant owner manages own offers"
  ON public.offers FOR ALL
  USING (public.owns_restaurant(restaurant_id))
  WITH CHECK (public.owns_restaurant(restaurant_id));

-- سياسات الأقسام (CATEGORIES)
DROP POLICY IF EXISTS "Public can view visible categories" ON public.categories;
CREATE POLICY "Public can view visible categories"
  ON public.categories FOR SELECT
  USING (is_visible = true OR public.owns_restaurant(restaurant_id));

DROP POLICY IF EXISTS "Restaurant owner manages own categories" ON public.categories;
CREATE POLICY "Restaurant owner manages own categories"
  ON public.categories FOR ALL
  USING (public.owns_restaurant(restaurant_id))
  WITH CHECK (public.owns_restaurant(restaurant_id));

-- سياسات المنتجات (PRODUCTS)
DROP POLICY IF EXISTS "Public can view visible products" ON public.products;
CREATE POLICY "Public can view visible products"
  ON public.products FOR SELECT
  USING (is_visible = true OR public.owns_restaurant(restaurant_id));

DROP POLICY IF EXISTS "Restaurant owner manages own products" ON public.products;
CREATE POLICY "Restaurant owner manages own products"
  ON public.products FOR ALL
  USING (public.owns_restaurant(restaurant_id))
  WITH CHECK (public.owns_restaurant(restaurant_id));

-- سياسات معرض الصور (GALLERY_IMAGES)
DROP POLICY IF EXISTS "Public can view visible gallery images" ON public.gallery_images;
CREATE POLICY "Public can view visible gallery images"
  ON public.gallery_images FOR SELECT
  USING (is_visible = true OR public.owns_restaurant(restaurant_id));

DROP POLICY IF EXISTS "Restaurant owner manages own gallery" ON public.gallery_images;
CREATE POLICY "Restaurant owner manages own gallery"
  ON public.gallery_images FOR ALL
  USING (public.owns_restaurant(restaurant_id))
  WITH CHECK (public.owns_restaurant(restaurant_id));

-- سياسات الطلبات (ORDERS)
DROP POLICY IF EXISTS "Public customers can create orders for active restaurants" ON public.orders;
CREATE POLICY "Public customers can create orders for active restaurants"
  ON public.orders FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = restaurant_id AND r.is_active = true
    )
  );

DROP POLICY IF EXISTS "Only restaurant owner or super admin can view and update orders" ON public.orders;
CREATE POLICY "Only restaurant owner or super admin can view and update orders"
  ON public.orders FOR SELECT
  USING (public.owns_restaurant(restaurant_id));

DROP POLICY IF EXISTS "Only restaurant owner or super admin can update order status" ON public.orders;
CREATE POLICY "Only restaurant owner or super admin can update order status"
  ON public.orders FOR UPDATE
  USING (public.owns_restaurant(restaurant_id))
  WITH CHECK (public.owns_restaurant(restaurant_id));

-- سياسات الإحصائيات (ANALYTICS_EVENTS)
DROP POLICY IF EXISTS "Public can insert analytics events" ON public.analytics_events;
CREATE POLICY "Public can insert analytics events"
  ON public.analytics_events FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Only restaurant owner or super admin can read analytics" ON public.analytics_events;
CREATE POLICY "Only restaurant owner or super admin can read analytics"
  ON public.analytics_events FOR SELECT
  USING (public.owns_restaurant(restaurant_id));

-- ============================================================================
-- إعداد حاوية تخزين الصور (Supabase Storage: restaurant-media)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('restaurant-media', 'restaurant-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can read restaurant media" ON storage.objects;
CREATE POLICY "Public can read restaurant media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'restaurant-media');
