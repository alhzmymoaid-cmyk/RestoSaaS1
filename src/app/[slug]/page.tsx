import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { INITIAL_TENANTS } from '@/lib/data/demo-tenants';
import RestaurantStorefront from '@/components/storefront/RestaurantStorefront';
import { TenantBundle } from '@/types/database';

interface PageProps {
  params: { slug: string };
}

export const dynamic = 'force-dynamic';

export default async function RestaurantPublicPage({ params }: PageProps) {
  const { slug } = params;
  const supabase = createServerSupabase();

  let bundle: TenantBundle | null = null;

  if (supabase) {
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (restaurant) {
      await supabase.rpc('increment_restaurant_visit', { rest_id: restaurant.id });

      const [bannersRes, offersRes, categoriesRes, productsRes, galleryRes] = await Promise.all([
        supabase.from('banners').select('*').eq('restaurant_id', restaurant.id).eq('is_active', true).order('sort_order'),
        supabase.from('offers').select('*').eq('restaurant_id', restaurant.id).eq('is_active', true).order('sort_order'),
        supabase.from('categories').select('*').eq('restaurant_id', restaurant.id).eq('is_visible', true).order('sort_order'),
        supabase.from('products').select('*').eq('restaurant_id', restaurant.id).eq('is_visible', true).order('sort_order'),
        supabase.from('gallery_images').select('*').eq('restaurant_id', restaurant.id).eq('is_visible', true).order('sort_order'),
      ]);

      bundle = {
        restaurant,
        banners: bannersRes.data || [],
        offers: offersRes.data || [],
        categories: categoriesRes.data || [],
        products: productsRes.data || [],
        gallery: galleryRes.data || [],
        orders: [],
      };
    }
  }

  if (!bundle) {
    bundle = INITIAL_TENANTS[slug] || null;
  }

  if (!bundle) {
    notFound();
  }

  return <RestaurantStorefront initialBundle={bundle} />;
}
