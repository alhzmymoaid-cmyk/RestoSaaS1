# دليل الإعداد والتشغيل والترقية لنظام مواقع ومنيوهات المطاعم الرقمية (RestoSaaS v2.4)
**التقنيات المستخدمة:** Next.js 14 (App Router) • TypeScript • Tailwind CSS • Supabase (PostgreSQL + Auth + Storage + RLS) • Vercel

---

## 1. طريقة تطبيق التحديث الجديد (`Migration 005`) دون حذف أي بيانات

إذا كانت قاعدة بياناتك تحتوي على النسخة السابقة (`001` إلى `004`):
1. افتح لوحة تحكم مشروعك في [Supabase Dashboard](https://supabase.com/dashboard) وانتقل إلى قسم **SQL Editor**.
2. انسخ محتوى الملف الجديد `supabase/migrations/005_analytics_security_hardening.sql` بالكامل واضغط **Run**.
3. **لا يحذف هذا التحديث أي بيانات حالية**، ويقوم بالآتي:
   - إنشاء جدول التحكم الذري في معدل الإحصائيات `public.analytics_rate_limits` وإغلاق الوصول المباشر إليه (`REVOKE ALL FROM PUBLIC, anon, authenticated`).
   - إنشاء دالة القفل الذري `public.acquire_analytics_rate_limit_slot` المعتمدة على `INSERT ... ON CONFLICT (scope_key) DO UPDATE RETURNING hit_count` لمنع سباق التزامن (`Race Condition`) الذي كان يحدث مع `SELECT COUNT(*)`.
   - ترقية دالتي `public.increment_restaurant_visit` و`public.increment_product_view` بحماية ذرية مزدوجة:
     1. **قفل ذري لكل زائر (`actor_key`)**: يسمح بزيارة واحدة فقط لكل 60 ثانية لنفس المطعم، ومشاهدة واحدة فقط لكل 30 ثانية لنفس المنتج من نفس الزائر/الجلسة.
     2. **قفل ذري عام للمطعم/المنتج (`burst_key`)**: يمنع الهجمات الموزعة المتزامنة عبر حصر الحد الأقصى عند 15 زيارة مطعم أو 10 مشاهدات منتج كل 5 ثوانٍ.
   - ضبط صلاحيات `EXECUTE` بدقة (`REVOKE ALL FROM PUBLIC` على جميع الدوال، وحصر الدوال الداخلية بـ `postgres` و`service_role`).

---

## 2. ترتيب تشغيل ملفات SQL عند التثبيت الجديد من الصفر (Fresh Installation)

عند إعداد مشروع Supabase جديد لأول مرة، شغّل الملفات التالية بالترتيب داخل **SQL Editor**:
1. `supabase/migrations/001_multi_tenant_schema_and_rls.sql`
2. `supabase/migrations/002_security_hardening_and_date_filtering.sql`
3. `supabase/migrations/003_strict_tenant_integrity_and_atomic_orders.sql`
4. `supabase/migrations/004_final_security_hardening.sql`
5. `supabase/migrations/005_analytics_security_hardening.sql`
6. `supabase/seed.sql`

---

## 3. متغيرات البيئة المطلوبة (`.env.local` & Vercel)

| اسم المتغير | نوعه | الوصف |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | عام | رابط مشروعك في Supabase (`https://xyz.supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | عام (خاضع لـ RLS) | المفتاح العام `anon public`. |
| `SUPABASE_SERVICE_ROLE_KEY` | **سري للخادم فقط** | مفتاح `service_role` السري (لعمليات الإدارة الخلفية في `src/lib/supabase/admin.ts`). |
| `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET` | عام | اسم حاوية تخزين الصور (`restaurant-media`). |
| `NEXT_PUBLIC_SITE_URL` | عام | رابط المنصة الأساسي (`http://localhost:3000` أو نطاق Vercel). |
