# دليل الإعداد والتشغيل والترقية لنظام مواقع ومنيوهات المطاعم الرقمية (RestoSaaS v2.1)
**التقنيات المستخدمة:** Next.js 14 (App Router) • TypeScript • Tailwind CSS • Supabase (PostgreSQL + Auth + Storage + RLS) • Vercel

---

## 1. نظرة عامة على معمارية النظام وعزل المطاعم (Multi-Tenant Architecture)

يوفر نظام **RestoSaaS v2.1** بنية متعددة المستأجرين (Multi-Tenant SaaS) تمنح كل مطعم مشترك:
1. **واجهة عميل مستقلة (`/[slug]`)**: تشمل الأقسام الـ 11 كاملة (الشريط العلوي، الواجهة الرئيسية Hero، العروض المؤقتة المفلترة بالتاريخ، البانرات المتحركة، التصنيفات المصورة، الأكثر طلباً، توصيات الشيف والمميزة، المنيو التفاعلي الكامل مع البحث والفلترة، قصة المطعم، معرض الصور، الموقع وساعات العمل، والتذييل الفاخر).
2. **لوحة تحكم مستقلة لمالك المطعم (`/[slug]/admin`)**: إدارة كاملة للواجهة وترتيب الأقسام، إضافة وتعديل وحذف البانرات والعروض المؤقتة، إدارة الأقسام والمنتجات والأحجام والإضافات، رفع الصور مباشرة من الجوال إلى مجلد المطعم المعزول في `Supabase Storage`، تخصيص الألوان والخطوط والروابط وساعات العمل، وإدارة الطلبات والإحصائيات.
3. **لوحة مدير النظام العام (`/super-admin`)**: إنشاء مطاعم جديدة في قاعدة البيانات عبر دالة `public.provision_new_restaurant`، تعيين أو تغيير بريد المالك عبر دالة `public.assign_restaurant_owner`، تفعيل أو إيقاف أي مطعم، وإدارة صلاحيات الحسابات في جدول `public.profiles`.

---

## 2. تعليمات الترقية من النسخ السابقة (Upgrade Guide v1 / v2.0 → v2.1)

إذا كانت لديك قاعدة بيانات سابقة (v1 أو v2.0)، يمكنك ترقيتها بأمان تام دون فقدان أو تكرار أي بيانات:

1. افتح **SQL Editor** في لوحة تحكم [Supabase Dashboard](https://supabase.com/dashboard).
2. انسخ محتوى الملف `supabase/migrations/002_security_hardening_and_date_filtering.sql` بالكامل واضغط **Run**:
   - جميع الأوامر في `002` مكتوبة بصيغة آمنة قابلة لإعادة التشغيل (`DROP POLICY IF EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS`, `ADD COLUMN IF NOT EXISTS`) دون أي تعارض مع `001`.
3. (اختياري) إذا رغبت في تحديث البيانات التجريبية للمطاعم الثلاثة («برجر هاوس»، «كنافة سكره»، «أوساكا واغيو»)، شغّل الملف `supabase/seed.sql`؛ حيث تمت إضافة معرفات `UUID` ثابتة وشرط `ON CONFLICT DO UPDATE` لجميع الجداول لمنع تكرار أي منتج أو عرض أو بانر أو صورة معرض.
4. استبدل ملفات الكود المصدري (`src/`) بالنسخة الجديدة v2.1.

---

## 3. التثبيت الجديد من الصفر في Supabase (Fresh Installation)

1. أنشئ مشروعاً جديداً في [Supabase](https://supabase.com/dashboard).
2. من قسم **SQL Editor**، شغّل الملفات بالترتيب التالي:
   - **أولاً**: شغّل `supabase/migrations/001_multi_tenant_schema_and_rls.sql` لإنشاء الجداول الـ 9، الفهارس، الدوال الأساسية، وحاوية التخزين `restaurant-media`.
   - **ثانياً**: شغّل `supabase/migrations/002_security_hardening_and_date_filtering.sql` لتفعيل سياسات عزل Storage، فلترة تواريخ العروض، دالة إنشاء طلبات الزوار `create_customer_order`، والربط التلقائي لحسابات الملاك `on_auth_user_created`.
   - **ثالثاً**: شغّل `supabase/seed.sql` لإدراج بيانات المطاعم التجريبية الثلاثة.

---

## 4. كيف يعمل نظام الصلاحيات والربط التلقائي الآمن للملاك (`UUID` + `profiles`)؟

لا يعتمد النظام على البريد النصي وحده لمنح صلاحيات الكتابة أو التعديل، بل يعتمد حصرياً على `auth.uid()` الموثق عبر ثلاث آليات متكاملة:
1. **تعيين مدير النظام العام (`Super Admin`)**:
   - أنشئ حساب المدير في **Authentication > Users** (مثلاً `admin@restosaas.sa`)، ثم نفّذ الاستعلام التالي مرة واحدة في **SQL Editor** لترقيته إلى `super_admin`:
     ```sql
     INSERT INTO public.profiles (id, email, full_name, role)
     SELECT id, email, 'مدير المنصة العام', 'super_admin'
     FROM auth.users
     WHERE lower(email) = 'admin@restosaas.sa'
     ON CONFLICT (id) DO UPDATE SET role = 'super_admin';
     ```
2. **الربط التلقائي لمالك المطعم عند التسجيل (`on_auth_user_created` Trigger)**:
   - عندما ينشئ `Super Admin` مطعماً جديداً ويحدد بريد المالك (مثلاً `owner@burgerhouse.sa`)، فإن قاعدة البيانات تبحث أولاً في `auth.users`:
     - إذا كان حساب المالك موجوداً ومؤكداً بالفعل، يتم فوراً ربط `restaurants.owner_id = user.id` وإنشاء سجل في `public.profiles` مرتبط بـ `restaurant_id`.
     - إذا لم يكن المالك قد سجل حسابه بعد، يُحفظ بريده في `owner_email` مع بقاء `owner_id = NULL`. وبمجرد أن يسجل المالك حسابه في Supabase Auth ويؤكد بريده، يعمل الـ Trigger `on_auth_user_created` (أو دالة `claim_pending_restaurant_ownership` عند أول دخول) تلقائياً لربط `owner_id` وسجل `profiles` بمعرف الـ `UUID` الخاص به بشكل دائم.

---

## 5. شرح متغيرات البيئة المطلوبة (`.env.local` & Vercel)

انسخ ملف `.env.example` إلى `.env.local` واضبط المتغيرات الخمسة التالية من قسم **Project Settings > API** في Supabase:

| اسم المتغير | نوعه | الوصف والاستخدام |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | عام (Client & Server) | رابط مشروعك في Supabase (مثال: `https://xyzcompany.supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | عام (خاضع لـ RLS) | المفتاح العام `anon public` للاتصال الآمن الخاضع لسياسات Row Level Security. |
| `SUPABASE_SERVICE_ROLE_KEY` | **سري للخادم فقط** | مفتاح `service_role` السري (يُستخدم حصرياً في الخادم داخل `src/lib/supabase/admin.ts` ولا يظهر أبداً في المتصفح). |
| `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET` | عام | اسم حاوية تخزين الصور في Supabase Storage (القيمة الافتراضية: `restaurant-media`). |
| `NEXT_PUBLIC_SITE_URL` | عام | الرابط الأساسي للموقع على بيئة التطوير أو الإنتاج (مثال: `http://localhost:3000`). |

---

## 6. التشغيل المحلي والنشر السحابي على Vercel

### أ. التشغيل والفحص محلياً:
```bash
npm install
npm run typecheck
npm run build
npm run dev
```

### ب. خطوات النشر على Vercel:
1. ارفع مجلد المشروع إلى مستودع GitHub أو GitLab خاص بك.
2. افتح [Vercel Dashboard](https://vercel.com/dashboard) واضغط **Add New > Project** واختر المستودع.
3. في قسم **Environment Variables** داخل إعدادات Vercel، أضف المتغيرات الخمسة الموضحة في الجدول أعلاه (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET`, `NEXT_PUBLIC_SITE_URL`).
4. اضغط **Deploy**؛ سيقوم Vercel بتثبيت الحزم وتشغيل `next build` ونشر المنصة على نطاقك.
