import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { verifySuperAdminAccess } from '@/lib/supabase/auth-helpers';
import { INITIAL_TENANTS } from '@/lib/data/demo-tenants';
import SuperAdminConsole from '@/components/admin/SuperAdminConsole';
import { Restaurant, Profile } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function SuperAdminSaaSPage() {
  const authCheck = await verifySuperAdminAccess();

  if (!authCheck.authorized) {
    if (authCheck.status === 401) {
      redirect('/burger-house/admin/login?redirect=/super-admin');
    }
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-slate-900 border border-rose-500/40 rounded-3xl p-8 space-y-5 text-center shadow-2xl">
          <span className="inline-block px-3.5 py-1 rounded-full text-xs font-extrabold bg-rose-500/20 text-rose-300">
            خطأ 403 — صلاحية مدير النظام مطلوبة
          </span>
          <h1 className="text-2xl font-black text-white">غير مصرح لك بالدخول إلى لوحة Super Admin</h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {authCheck.reason}
          </p>
          <div className="pt-2">
            <Link
              href="/burger-house"
              className="inline-block px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-extrabold text-xs"
            >
              العودة إلى الصفحة الرئيسية
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const supabase = createServerSupabase();
  let restaurants: Restaurant[] = [];
  let profiles: Profile[] = [];

  if (supabase) {
    const [restRes, profRes] = await Promise.all([
      supabase.from('restaurants').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    ]);
    restaurants = restRes.data || [];
    profiles = profRes.data || [];
  }

  if (restaurants.length === 0) {
    restaurants = Object.values(INITIAL_TENANTS).map((b) => b.restaurant);
  }

  return <SuperAdminConsole initialRestaurants={restaurants} initialProfiles={profiles} />;
}
