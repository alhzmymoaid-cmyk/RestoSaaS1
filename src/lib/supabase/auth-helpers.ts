import { createServerSupabase } from './server';

export interface TenantAuthResult {
  authorized: boolean;
  status: 200 | 401 | 403 | 404;
  reason?: string;
  userId?: string;
  userEmail?: string;
  role?: 'super_admin' | 'restaurant_owner';
  restaurantId?: string;
  isDemoMode: boolean;
}

/**
 * يتحقق بشكل صارم من جلسة المستخدم وملكيته للمطعم عبر UUID الموثق (owner_id / profiles.restaurant_id).
 * لا يمنح صلاحيات حساسة بالبريد النصي وحده؛ بل يقوم أولاً بتثبيت ربط الـ UUID في قاعدة البيانات
 * عبر دالة claim_pending_restaurant_ownership إذا كان المطعم بانتظار المالك الأول (owner_id IS NULL)
 * وكان البريد الإلكتروني للمستخدم مؤكداً في Supabase Auth.
 */
export async function verifyTenantAccess(targetSlugOrId: string): Promise<TenantAuthResult> {
  const supabase = createServerSupabase();

  if (!supabase) {
    return {
      authorized: true,
      status: 200,
      role: 'restaurant_owner',
      isDemoMode: true,
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      authorized: false,
      status: 401,
      reason: 'يجب تسجيل الدخول للوصول إلى لوحة التحكم.',
      isDemoMode: false,
    };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, role, restaurant_id')
    .eq('id', user.id)
    .maybeSingle();

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetSlugOrId);
  const query = supabase.from('restaurants').select('id, slug, owner_id, owner_email');
  const { data: restaurant } = isUuid
    ? await query.eq('id', targetSlugOrId).maybeSingle()
    : await query.eq('slug', targetSlugOrId).maybeSingle();

  if (!restaurant) {
    return {
      authorized: false,
      status: 404,
      reason: 'المطعم المطلوب غير موجود.',
      userId: user.id,
      userEmail: user.email,
      isDemoMode: false,
    };
  }

  // 1. مدير النظام العام (Super Admin)
  if (profile?.role === 'super_admin') {
    return {
      authorized: true,
      status: 200,
      userId: user.id,
      userEmail: user.email,
      role: 'super_admin',
      restaurantId: restaurant.id,
      isDemoMode: false,
    };
  }

  // 2. التحقق الصارم عبر UUID المالك المسجل في قاعدة البيانات
  const isOwnerById = restaurant.owner_id === user.id;
  const isOwnerByProfile = profile?.restaurant_id === restaurant.id;

  if (isOwnerById || isOwnerByProfile) {
    return {
      authorized: true,
      status: 200,
      userId: user.id,
      userEmail: user.email,
      role: 'restaurant_owner',
      restaurantId: restaurant.id,
      isDemoMode: false,
    };
  }

  // 3. إذا كان المطعم جديداً (owner_id IS NULL) وبريد المستخدم مؤكداً ومطابقاً لـ owner_email،
  // نستدعي دالة قاعدة البيانات لتثبيت ربط الـ UUID في restaurants.owner_id وprofiles قبل السماح بالدخول
  const isEmailVerified = Boolean(user.email_confirmed_at);
  const isPendingEmailMatch =
    !restaurant.owner_id &&
    isEmailVerified &&
    Boolean(user.email) &&
    Boolean(restaurant.owner_email) &&
    restaurant.owner_email.toLowerCase().trim() === user.email!.toLowerCase().trim();

  if (isPendingEmailMatch) {
    const { data: claimed, error: claimError } = await supabase.rpc(
      'claim_pending_restaurant_ownership',
      { p_restaurant_id: restaurant.id }
    );

    if (!claimError && claimed === true) {
      return {
        authorized: true,
        status: 200,
        userId: user.id,
        userEmail: user.email,
        role: 'restaurant_owner',
        restaurantId: restaurant.id,
        isDemoMode: false,
      };
    }
  }

  return {
    authorized: false,
    status: 403,
    reason: 'غير مصرح لك بالوصول إلى بيانات أو لوحة تحكم هذا المطعم (عزل بيانات المستأجرين RLS مفعل).',
    userId: user.id,
    userEmail: user.email,
    isDemoMode: false,
  };
}

/**
 * يتحقق من أن المستخدم الحالي يمتلك صلاحية مدير النظام العام (Super Admin)
 */
export async function verifySuperAdminAccess(): Promise<TenantAuthResult> {
  const supabase = createServerSupabase();

  if (!supabase) {
    return {
      authorized: true,
      status: 200,
      role: 'super_admin',
      isDemoMode: true,
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      authorized: false,
      status: 401,
      reason: 'يجب تسجيل الدخول بحساب مدير النظام العام.',
      isDemoMode: false,
    };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'super_admin') {
    return {
      authorized: false,
      status: 403,
      reason: 'هذه اللوحة مخصصة لمدير النظام العام (Super Admin) فقط ولا يُسمح لأصحاب المطاعم الفرعية بالوصول إليها.',
      userId: user.id,
      userEmail: user.email,
      isDemoMode: false,
    };
  }

  return {
    authorized: true,
    status: 200,
    userId: user.id,
    userEmail: user.email,
    role: 'super_admin',
    isDemoMode: false,
  };
}
