import { createClient } from '@supabase/supabase-js';

/**
 * عميل خاص بالخادم فقط (Server-only) يستخدم SUPABASE_SERVICE_ROLE_KEY عند توفره
 * لتنفيذ مهام إدارة حسابات الملاك من لوحة Super Admin بعد التحقق من صلاحية المدير العام.
 * لا يُستدعى أبداً في مكونات المتصفح (Client Components).
 */
export function createServiceRoleSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
