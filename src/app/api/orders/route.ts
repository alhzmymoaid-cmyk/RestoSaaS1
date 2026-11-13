import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { z } from 'zod';

// هيكل المدخلات المسموح بها من المتصفح (لا يثق الخادم بأي سعر أو إجمالي أو رقم طلب قادم من العميل)
const OrderRequestSchema = z.object({
  restaurant_id: z.string().uuid('معرف المطعم غير صالح'),
  customer_name: z
    .string()
    .trim()
    .min(2, 'اسم العميل حقل إجباري ويجب أن يتكون من حرفين على الأقل'),
  customer_phone: z
    .string()
    .trim()
    .min(9, 'يرجى إدخال رقم جوال صحيح مكون من 9 أرقام على الأقل'),
  fulfillment_type: z.enum(['pickup', 'dine_in', 'delivery']),
  customer_address: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid('معرف المنتج غير صالح'),
        size_name: z.string().optional(),
        addons: z.array(z.string()).optional().default([]),
        quantity: z
          .number()
          .int('الكمية يجب أن تكون رقماً صحيحاً')
          .min(1, 'الكمية يجب ألا تقل عن 1')
          .max(99, 'الكمية تتجاوز الحد المسموح به للصنف الواحد (99)'),
        notes: z.string().optional(),
      })
    )
    .min(1, 'سلة الطلبات فارغة')
    .max(50, 'عدد الأصناف في الطلب يتجاوز الحد الأقصى المسموح به'),
});

const OFFICIAL_ORDER_NUMBER_REGEX = /^ORD-\d{8}-\d{3,}$/;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = OrderRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'بيانات الطلب غير مكتملة' },
        { status: 400 }
      );
    }

    if (
      parsed.data.fulfillment_type === 'delivery' &&
      parsed.data.customer_address.trim().length < 5
    ) {
      return NextResponse.json(
        { error: 'الرجاء إدخال عنوان التوصيل بالتفصيل لإتمام طلب التوصيل.' },
        { status: 400 }
      );
    }

    // قاعدة البيانات هي المصدر الوحيد لتوليد أرقام الطلبات وحساب الأسعار وحفظ الطلبات.
    // إذا تعذر الاتصال بقاعدة البيانات، يتوقف إنشاء الطلب فوراً ولا يُسمح بأي ترقيم محلي في الذاكرة.
    const supabase = createServerSupabase();
    if (!supabase) {
      return NextResponse.json(
        {
          error:
            'تعذر الاتصال بقاعدة البيانات لحفظ الطلب وتوليد رقم الطلب الرسمي. يرجى التحقق من إعدادات الاتصال والمحاولة مرة أخرى.',
        },
        { status: 503 }
      );
    }

    const { data: verifiedOrder, error: rpcError } = await supabase.rpc(
      'create_customer_order',
      {
        p_restaurant_id: parsed.data.restaurant_id,
        p_customer_name: parsed.data.customer_name,
        p_customer_phone: parsed.data.customer_phone,
        p_fulfillment_type: parsed.data.fulfillment_type,
        p_customer_address: parsed.data.customer_address,
        p_notes: parsed.data.notes,
        p_items: parsed.data.items,
      }
    );

    if (rpcError || !verifiedOrder) {
      return NextResponse.json(
        {
          error:
            rpcError?.message ||
            'تعذر إنشاء الطلب وحفظه في قاعدة البيانات. يرجى المحاولة مرة أخرى.',
        },
        { status: 400 }
      );
    }

    if (
      typeof verifiedOrder.order_number !== 'string' ||
      !OFFICIAL_ORDER_NUMBER_REGEX.test(verifiedOrder.order_number)
    ) {
      return NextResponse.json(
        { error: 'فشل التحقق من رقم الطلب الرسمي الصادر من قاعدة البيانات.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        order: {
          ...verifiedOrder,
          whatsapp_number: verifiedOrder.whatsapp_number || '966535717670',
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: 'تعذر الاتصال بقاعدة البيانات لحفظ الطلب. لم يتم تأكيد الطلب.' },
      { status: 500 }
    );
  }
}
