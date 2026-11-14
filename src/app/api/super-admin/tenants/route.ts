import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createServiceRoleSupabase } from '@/lib/supabase/admin';
import { verifySuperAdminAccess } from '@/lib/supabase/auth-helpers';
import { z } from 'zod';

const CreateTenantSchema = z.object({
  name: z.string().trim().min(2, 'اسم المطعم يجب أن يتكون من حرفين على الأقل'),
  slug: z
    .string()
    .trim()
    .min(2)
    .regex(/^[a-z0-9-]+$/, 'الرابط المختصر يجب أن يحتوي على أحرف إنجليزية صغيرة وأرقام وشرطات فقط'),
  tagline: z.string().optional().default('قائمة طعام رقمية فاخرة'),
  city: z.string().optional().default('جدة'),
  whatsapp_number: z.string().trim().min(9, 'رقم واتساب غير صالح'),
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'كود اللون غير صالح'),
  owner_email: z.string().trim().email('البريد الإلكتروني للمالك غير صالح'),
  owner_id: z.string().uuid().optional().nullable(),
});

const UpdateTenantSchema = z.object({
  id: z.string().uuid('معرف المطعم غير صالح'),
  is_active: z.boolean().optional(),
  owner_email: z.string().trim().email('البريد الإلكتروني للمالك غير صالح').optional(),
  owner_id: z.string().uuid().optional().nullable(),
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'كود اللون غير صالح').optional(),
  name: z.string().trim().min(2).optional(),
});

export async function GET() {
  const auth = await verifySuperAdminAccess();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  const supabase = createServerSupabase();
  if (!supabase) {
    return NextResponse.json({ tenants: [], profiles: [], isDemoMode: true });
  }

  const [restaurantsRes, profilesRes] = await Promise.all([
    supabase.from('restaurants').select('*').order('created_at', { ascending: false }),
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
  ]);

  return NextResponse.json({
    tenants: restaurantsRes.data || [],
    profiles: profilesRes.data || [],
    isDemoMode: false,
  });
}

export async function POST(request: Request) {
  const auth = await verifySuperAdminAccess();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const parsed = CreateTenantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'بيانات المطعم غير صالحة' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();
    if (!supabase) {
      return NextResponse.json(
        {
          tenant: {
            id: crypto.randomUUID(),
            ...parsed.data,
            is_active: true,
            visits_count: 1,
            created_at: new Date().toISOString(),
          },
        },
        { status: 201 }
      );
    }

    const { data: newRestId, error: rpcError } = await supabase.rpc('provision_new_restaurant', {
      p_slug: parsed.data.slug,
      p_name: parsed.data.name,
      p_tagline: parsed.data.tagline,
      p_primary_color: parsed.data.primary_color,
      p_whatsapp: parsed.data.whatsapp_number,
      p_city: parsed.data.city,
      p_owner_email: parsed.data.owner_email.toLowerCase().trim(),
      p_owner_id: parsed.data.owner_id || null,
    });

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    const { data: createdTenant } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', newRestId)
      .maybeSingle();

    return NextResponse.json({ tenant: createdTenant }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'تعذر إنشاء المطعم الجديد' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await verifySuperAdminAccess();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const parsed = UpdateTenantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'بيانات التحديث غير صالحة' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();
    if (!supabase) {
      return NextResponse.json({ updated: parsed.data }, { status: 200 });
    }

    const { id, owner_email, ...otherUpdates } = parsed.data;

    if (owner_email) {
      const { error: assignErr } = await supabase.rpc('assign_restaurant_owner', {
        p_restaurant_id: id,
        p_owner_email: owner_email,
      });
      if (assignErr) {
        return NextResponse.json({ error: assignErr.message }, { status: 500 });
      }
    }

    if (Object.keys(otherUpdates).length > 0) {
      const adminClient = createServiceRoleSupabase() || supabase;
      const { error } = await adminClient
        .from('restaurants')
        .update({ ...otherUpdates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    const { data: updatedTenant } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    return NextResponse.json({ updated: updatedTenant }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'تعذر تحديث بيانات المطعم' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await verifySuperAdminAccess();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const parsedId = z.string().uuid('معرف المطعم غير صالح').safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: 'معرف المطعم مطلوب وبصيغة UUID صحيحة للحذف' }, { status: 400 });
  }

  const supabase = createServerSupabase();
  if (supabase) {
    const adminClient = createServiceRoleSupabase() || supabase;
    const { error } = await adminClient.from('restaurants').delete().eq('id', parsedId.data);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ deleted: true }, { status: 200 });
}
