import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { verifyTenantAccess } from '@/lib/supabase/auth-helpers';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
]);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const restaurantSlug = ((formData.get('restaurantSlug') as string) || '').trim().toLowerCase();

    if (!file) {
      return NextResponse.json({ error: 'لم يتم اختيار ملف صورة للرفع.' }, { status: 400 });
    }

    if (!restaurantSlug || !/^[a-z0-9-]+$/.test(restaurantSlug)) {
      return NextResponse.json({ error: 'معرف المطعم (restaurantSlug) غير صالح.' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'نوع الملف غير مدعوم. يرجى رفع صورة بصيغة JPG أو PNG أو WEBP فقط.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'حجم الصورة يتجاوز الحد الأقصى المسموح به (5 ميجابايت).' },
        { status: 400 }
      );
    }

    // التحقق الصارم من جلسة المستخدم وملكيته للمطعم المستهدف قبل السماح بالرفع
    const authCheck = await verifyTenantAccess(restaurantSlug);
    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: authCheck.reason || 'غير مصرح لك برفع ملفات لهذا المطعم.' },
        { status: authCheck.status }
      );
    }

    const supabase = createServerSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: 'يرجى ضبط متغيرات Supabase Storage لرفع الملفات السحابية.' },
        { status: 503 }
      );
    }

    const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'restaurant-media';
    const safeExt = (file.name.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
    // مسار الملف معزول داخل مجلد المطعم نفسه ليتطابق مع سياسة can_manage_storage_object(name)
    const filePath = `${restaurantSlug}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return NextResponse.json(
      {
        url: publicUrlData.publicUrl,
        path: filePath,
        restaurantId: authCheck.restaurantId,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: 'تعذر رفع الصورة بسبب خطأ في الخادم.' }, { status: 500 });
  }
}
