-- ============================================================================
-- Migration 005: التحصين الأمني والذري لدوال الإحصائيات (Rate Limiting ذري
--                ضد الاستدعاءات المتزامنة + ضبط صلاحيات EXECUTE)
-- Compatible with Migrations 001, 002, 003, and 004 (Zero Data Loss)
-- ============================================================================

-- 1. جدول التحكم الذري في معدل استدعاءات الإحصائيات (Atomic Rate Limit Buckets)
CREATE TABLE IF NOT EXISTS public.analytics_rate_limits (
    scope_key TEXT PRIMARY KEY,
    window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    hit_count INTEGER NOT NULL DEFAULT 1 CHECK (hit_count >= 1),
    last_hit_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_rate_limits_window
  ON public.analytics_rate_limits(window_started_at);

ALTER TABLE public.analytics_rate_limits ENABLE ROW LEVEL SECURITY;

-- سحب كافة الصلاحيات المباشرة على جدولي الإحصائيات ومعدلات الاستدعاء من الزوار والمستخدمين
REVOKE ALL ON TABLE public.analytics_rate_limits FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.analytics_events FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Super Admin views analytics rate limits" ON public.analytics_rate_limits;
CREATE POLICY "Super Admin views analytics rate limits"
  ON public.analytics_rate_limits FOR SELECT
  USING (public.is_super_admin());

-- ============================================================================
-- 2. دالة داخلية لحساب بصمة المستدعي (Caller Fingerprint) دون كشف بيانات شخصية
--    محمية ضد الاستدعاء المباشر من المتصفح
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_analytics_caller_fingerprint()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT;
  v_headers_raw TEXT;
  v_headers JSONB := '{}'::jsonb;
  v_ip TEXT := '';
  v_ua TEXT := '';
BEGIN
  IF COALESCE(current_setting('app.internal_analytics_flow', true), '') <> 'true' THEN
    RAISE EXCEPTION 'Forbidden: Direct invocation of get_analytics_caller_fingerprint is prohibited';
  END IF;

  v_uid := COALESCE(auth.uid()::text, 'anon');
  v_headers_raw := COALESCE(current_setting('request.headers', true), '');

  IF v_headers_raw <> '' THEN
    BEGIN
      v_headers := v_headers_raw::jsonb;
    EXCEPTION WHEN OTHERS THEN
      v_headers := '{}'::jsonb;
    END;
  END IF;

  v_ip := trim(split_part(COALESCE(
    v_headers ->> 'x-forwarded-for',
    v_headers ->> 'cf-connecting-ip',
    v_headers ->> 'x-real-ip',
    '0.0.0.0'
  ), ',', 1));

  v_ua := left(COALESCE(v_headers ->> 'user-agent', 'unknown-ua'), 160);

  RETURN encode(digest(v_uid || '|' || v_ip || '|' || v_ua, 'sha256'), 'hex');
END;
$$;

REVOKE ALL ON FUNCTION public.get_analytics_caller_fingerprint() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_analytics_caller_fingerprint() TO postgres, service_role;

-- ============================================================================
-- 3. دالة القفل الذري (Atomic Rate-Limit Slot Acquisition)
--    تعتمد على INSERT ... ON CONFLICT (scope_key) DO UPDATE RETURNING hit_count
--    الذي يقفل صف المفتاح ذرياً (Row-Level Exclusive Lock) ويمنع سباق التزامن
--    (Race Condition) الذي كان يحدث مع SELECT COUNT(*)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.acquire_analytics_rate_limit_slot(
  p_scope_key TEXT,
  p_window_seconds INTEGER,
  p_max_hits INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_hits INTEGER;
BEGIN
  IF COALESCE(current_setting('app.internal_analytics_flow', true), '') <> 'true' THEN
    RAISE EXCEPTION 'Forbidden: Direct invocation of acquire_analytics_rate_limit_slot is prohibited';
  END IF;

  -- عملية UPSERT ذرية تقفل الصف الخاص بـ scope_key وتضمن تسلسلاً حقيقياً حتى مع عشرات الطلبات في نفس الملي ثانية
  INSERT INTO public.analytics_rate_limits (scope_key, window_started_at, hit_count, last_hit_at)
  VALUES (p_scope_key, NOW(), 1, NOW())
  ON CONFLICT (scope_key) DO UPDATE
    SET hit_count = CASE
          WHEN public.analytics_rate_limits.window_started_at <= (NOW() - make_interval(secs => p_window_seconds))
          THEN 1
          ELSE public.analytics_rate_limits.hit_count + 1
        END,
        window_started_at = CASE
          WHEN public.analytics_rate_limits.window_started_at <= (NOW() - make_interval(secs => p_window_seconds))
          THEN NOW()
          ELSE public.analytics_rate_limits.window_started_at
        END,
        last_hit_at = NOW()
  RETURNING hit_count INTO v_current_hits;

  RETURN (v_current_hits <= p_max_hits);
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_analytics_rate_limit_slot(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_analytics_rate_limit_slot(TEXT, INTEGER, INTEGER) TO postgres, service_role;

-- ============================================================================
-- 4. ترقية دالة تسجيل زيارة المطعم (increment_restaurant_visit) بحماية ذرية مزدوجة:
--    أ. قفل ذري لكل زائر/جلسة (زيارة واحدة فقط لكل 60 ثانية لنفس المطعم)
--    ب. قفل ذري عام للمطعم ضد الهجمات الموزعة المتزامنة (حد أقصى 15 زيارة كل 5 ثوانٍ)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.increment_restaurant_visit(rest_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fingerprint TEXT;
  v_actor_allowed BOOLEAN;
  v_burst_allowed BOOLEAN;
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

  PERFORM set_config('app.internal_analytics_flow', 'true', true);

  v_fingerprint := public.get_analytics_caller_fingerprint();

  -- المستوى 1: منع نفس الزائر من تضخيم عداد زيارات نفس المطعم (زيارة واحدة كحد أقصى كل 60 ثانية)
  v_actor_allowed := public.acquire_analytics_rate_limit_slot(
    'actor:visit:' || rest_id::text || ':' || v_fingerprint,
    60,
    1
  );

  IF NOT v_actor_allowed THEN
    PERFORM set_config('app.internal_analytics_flow', 'false', true);
    RETURN;
  END IF;

  -- المستوى 2: قفل ذري عام على مستوى المطعم ضد الطلبات المتزامنة المكثفة (حد أقصى 15 زيارة كل 5 ثوانٍ)
  v_burst_allowed := public.acquire_analytics_rate_limit_slot(
    'burst:visit:' || rest_id::text,
    5,
    15
  );

  PERFORM set_config('app.internal_analytics_flow', 'false', true);

  IF NOT v_burst_allowed THEN
    RETURN;
  END IF;

  -- تفعيل راية التحديث الموثوق ليمر عبر Trigger حماية الحقول الحساسة (protect_restaurant_immutable_fields)
  PERFORM set_config('app.internal_trusted_rpc', 'increment_visit', true);

  UPDATE public.restaurants
  SET visits_count = visits_count + 1
  WHERE id = rest_id AND is_active = true;

  INSERT INTO public.analytics_events (restaurant_id, event_type)
  VALUES (rest_id, 'page_view');

  PERFORM set_config('app.internal_trusted_rpc', '', true);
END;
$$;

-- ضبط صلاحيات EXECUTE لدالة increment_restaurant_visit
REVOKE ALL ON FUNCTION public.increment_restaurant_visit(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_restaurant_visit(UUID) TO anon, authenticated, service_role;

-- ============================================================================
-- 5. ترقية دالة تسجيل مشاهدة المنتج (increment_product_view) بحماية ذرية مزدوجة:
--    أ. قفل ذري لكل زائر/جلسة (مشاهدة واحدة فقط لكل 30 ثانية لنفس المنتج)
--    ب. قفل ذري عام للمنتج ضد الهجمات الموزعة المتزامنة (حد أقصى 10 مشاهدات كل 5 ثوانٍ)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.increment_product_view(prod_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rest_id UUID;
  v_fingerprint TEXT;
  v_actor_allowed BOOLEAN;
  v_burst_allowed BOOLEAN;
BEGIN
  IF prod_id IS NULL THEN
    RETURN;
  END IF;

  -- التأكد من أن المنتج مرئي ويتبع مطعماً نشطاً
  SELECT p.restaurant_id INTO v_rest_id
  FROM public.products p
  JOIN public.restaurants r ON r.id = p.restaurant_id
  WHERE p.id = prod_id
    AND p.is_visible = true
    AND r.is_active = true;

  IF v_rest_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM set_config('app.internal_analytics_flow', 'true', true);

  v_fingerprint := public.get_analytics_caller_fingerprint();

  -- المستوى 1: منع نفس الزائر من تكرار زيادة مشاهدات نفس المنتج (مشاهدة واحدة كحد أقصى كل 30 ثانية)
  v_actor_allowed := public.acquire_analytics_rate_limit_slot(
    'actor:view:' || prod_id::text || ':' || v_fingerprint,
    30,
    1
  );

  IF NOT v_actor_allowed THEN
    PERFORM set_config('app.internal_analytics_flow', 'false', true);
    RETURN;
  END IF;

  -- المستوى 2: قفل ذري عام على مستوى المنتج ضد الطلبات المتزامنة المكثفة (حد أقصى 10 مشاهدات كل 5 ثوانٍ)
  v_burst_allowed := public.acquire_analytics_rate_limit_slot(
    'burst:view:' || prod_id::text,
    5,
    10
  );

  PERFORM set_config('app.internal_analytics_flow', 'false', true);

  IF NOT v_burst_allowed THEN
    RETURN;
  END IF;

  -- تفعيل راية التحديث الموثوق ليمر عبر Trigger حماية حقول المنتجات (protect_product_immutable_fields)
  PERFORM set_config('app.internal_trusted_rpc', 'increment_product_view', true);

  UPDATE public.products
  SET views_count = views_count + 1
  WHERE id = prod_id;

  INSERT INTO public.analytics_events (restaurant_id, event_type, product_id)
  VALUES (v_rest_id, 'product_view', prod_id);

  PERFORM set_config('app.internal_trusted_rpc', '', true);
END;
$$;

-- ضبط صلاحيات EXECUTE لدالة increment_product_view
REVOKE ALL ON FUNCTION public.increment_product_view(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_product_view(UUID) TO anon, authenticated, service_role;
