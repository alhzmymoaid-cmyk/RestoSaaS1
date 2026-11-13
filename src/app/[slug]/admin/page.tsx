import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { verifyTenantAccess } from '@/lib/supabase/auth-helpers';
import { INITIAL_TENANTS } from '@/lib/data/demo-tenants';
import RestaurantAdminDashboard from '@/components/admin/RestaurantAdminDashboard';
import { TenantBundle } from '@/types/database';

interface PageProps {
  params: { slug: string };
}

export const dynamic = 'force-dynamic';

export default async function RestaurantAdminPage({ params }: PageProps) {
  const { slug } = params;

  // 1. التحقق الصارم من الجلسة وملكية المطعم قبل عرض أي بيانات إدارية
  const authCheck = await verifyTenantAccess(slug);

  if (!authCheck.authorized) {
    if (authCheck.status === 401) {
      redirect(`/${slug}/admin/login?redirect=/${slug}/admin`);
    }
    if (authCheck.status === 404) {
      notFound();
    }
    // 403 Forbidden: المستخدم مسجل دخول ولكنه يملك مطعماً آخر ويحاول الوصول لمطعم لا يملكه
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-slate-900 border border-rose-500/40 rounded-3xl p-8 space-y-5 text-center shadow-2xl">
          <span className="inline-block px-3.5 py-1 rounded-full text-xs font-extrabold bg-rose-500/20 text-rose-300">
            خطأ 403 — وصول غير مصرح به (Tenant Isolation Active)
          </span>
          <h1 className="text-2xl font-black text-white">لا تملك صلاحية إدارة هذا المطعم</h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {authCheck.reason || 'حسابك الحالي مرتبط بمطعم آخر. تمنع سياسات العزل (Supabase RLS) عرض أو تعديل بيانات أي مطعم لا تملكه.'}
          </p>
          {authCheck.userEmail && (
            <p className="text-xs text-slate-400 font-mono">
              الحساب المسجل حالياً: {authCheck.userEmail}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href={`/${slug}/admin/login`}
              className="px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-extrabold text-xs"
            >
              تسجيل الدخول بحساب مالك المطعم
            </Link>
            <Link
              href={`/${slug}`}
              className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-bold text-xs"
            >
              العودة لواجهة العميل العامة
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const supabase = createServerSupabase();
  let bundle: TenantBundle | null = null;

  if (supabase) {
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('*')
      .eq('slug', slug)
      .single();

    if (restaurant) {
      const [bannersRes, offersRes, categoriesRes, productsRes, galleryRes, ordersRes] = await Promise.all([
        supabase.from('banners').select('*').eq('restaurant_id', restaurant.id).order('sort_order'),
        supabase.from('offers').select('*').eq('restaurant_id', restaurant.id).order('sort_order'),
        supabase.from('categories').select('*').eq('restaurant_id', restaurant.id).order('sort_order'),
        supabase.from('products').select('*').eq('restaurant_id', restaurant.id).order('sort_order'),
        supabase.from('gallery_images').select('*').eq('restaurant_id', restaurant.id).order('sort_order'),
        supabase.from('orders').select('*').eq('restaurant_id', restaurant.id).order('created_at', { ascending: false }),
      ]);

      bundle = {
        restaurant,
        banners: bannersRes.data || [],
        offers: offersRes.data || [],
        categories: categoriesRes.data || [],
        products: productsRes.data || [],
        gallery: galleryRes.data || [],
        orders: ordersRes.data || [],
      };
    }
  }

  if (!bundle) {
    bundle = INITIAL_TENANTS[slug] || null;
  }

  if (!bundle) {
    notFound();
  }

  return <RestaurantAdminDashboard initialBundle={bundle} />;
}
