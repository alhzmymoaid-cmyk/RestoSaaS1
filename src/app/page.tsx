import Link from 'next/link';
import { INITIAL_TENANTS } from '@/lib/data/demo-tenants';

export default function SaaSLandingPage() {
  const bh = INITIAL_TENANTS['burger-house'].restaurant;

  return (
    <main className="min-h-screen bg-stone-950 text-stone-100 flex flex-col justify-between p-6 md:p-12">
      <div className="max-w-6xl mx-auto w-full space-y-12 py-12">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-medium">
          <span>نظام SaaS متعدد المطاعم والمنيوهات الرقمية</span>
        </div>

        <div className="space-y-4 max-w-3xl">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">
            منصة إنشاء المواقع والمنيوهات الإلكترونية الفاخرة للمطاعم والكافيهات
          </h1>
          <p className="text-stone-400 text-lg md:text-xl leading-relaxed">
            نظام متكامل مبني بـ Next.js وTypeScript وTailwind CSS وSupabase مع عزل كامل لبيانات كل مطعم عبر سياسات RLS، ولوحة تحكم مستقلة لكل مالك مطعم.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            href="/burger-house"
            className="group p-8 rounded-2xl bg-stone-900/90 border border-stone-800 hover:border-amber-500/60 transition-all flex flex-col justify-between"
          >
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">النموذج التجريبي الكامل</span>
              <h2 className="text-2xl font-bold text-white group-hover:text-amber-400 transition-colors">
                موقع ومنيو «{bh.name}»
              </h2>
              <p className="text-sm text-stone-400 leading-relaxed">
                استعرض الواجهة الرئيسية الفاخرة، البانرات والعروض، المنيو التفاعلي، السلة، والطلب الفوري عبر واتساب.
              </p>
            </div>
            <div className="mt-6 text-amber-400 font-bold text-sm flex items-center gap-2">
              <span>فتح واجهة العميل</span>
              <span>←</span>
            </div>
          </Link>

          <Link
            href="/burger-house/admin"
            className="group p-8 rounded-2xl bg-stone-900/90 border border-stone-800 hover:border-emerald-500/60 transition-all flex flex-col justify-between"
          >
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">لوحة تحكم المالك</span>
              <h2 className="text-2xl font-bold text-white group-hover:text-emerald-400 transition-colors">
                لوحة إدارة «برجر هاوس»
              </h2>
              <p className="text-sm text-stone-400 leading-relaxed">
                تحكم كامل بالواجهة الرئيسية، ترتيب الأقسام، المنتجات، رفع الصور من الجوال، الألوان والخطوط، الطلبات والإحصائيات.
              </p>
            </div>
            <div className="mt-6 text-emerald-400 font-bold text-sm flex items-center gap-2">
              <span>فتح لوحة تحكم المطعم</span>
              <span>←</span>
            </div>
          </Link>

          <Link
            href="/super-admin"
            className="group p-8 rounded-2xl bg-stone-900/90 border border-stone-800 hover:border-sky-500/60 transition-all flex flex-col justify-between"
          >
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400">إدارة المنصة (SaaS)</span>
              <h2 className="text-2xl font-bold text-white group-hover:text-sky-400 transition-colors">
                لوحة مدير النظام وتعدد المطاعم
              </h2>
              <p className="text-sm text-stone-400 leading-relaxed">
                إنشاء مواقع لمطاعم جديدة خلال ثوانٍ، تخصيص الروابط المستقلة، إدارة حسابات الملاك، وعزل البيانات.
              </p>
            </div>
            <div className="mt-6 text-sky-400 font-bold text-sm flex items-center gap-2">
              <span>فتح لوحة مدير النظام</span>
              <span>←</span>
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
