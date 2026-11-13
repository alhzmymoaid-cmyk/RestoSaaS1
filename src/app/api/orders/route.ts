import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { z } from 'zod';

const OrderPayloadSchema = z.object({
  restaurant_id: z.string().min(1),
  customer_name: z.string().min(2, 'الرجاء إدخال الاسم الكامل'),
  customer_phone: z.string().min(9, 'الرجاء إدخال رقم جوال صحيح'),
  fulfillment_type: z.enum(['pickup', 'dine_in', 'delivery']),
  customer_address: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  items: z
    .array(
      z.object({
        product_id: z.string(),
        product_name: z.string(),
        size_name: z.string().optional(),
        addons: z.array(z.string()),
        quantity: z.number().int().positive(),
        unit_price: z.number().nonnegative(),
        notes: z.string().optional(),
      })
    )
    .min(1, 'السلة فارغة'),
  subtotal: z.number().nonnegative(),
  delivery_fee: z.number().nonnegative(),
  total: z.number().nonnegative(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = OrderPayloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'بيانات الطلب غير مكتملة' },
        { status: 400 }
      );
    }

    const orderId = crypto.randomUUID();
    const orderNumber = `BH-${Math.floor(1000 + Math.random() * 9000)}`;
    const createdAt = new Date().toISOString();
    const supabase = createServerSupabase();

    if (supabase) {
      // 1. المحاولة الأولى عبر دالة RPC الآمنة create_customer_order (تحدث عداد الطلبات وتدرج الطلب دون كشف جدول orders للزوار)
      const { data: rpcOrder, error: rpcError } = await supabase.rpc('create_customer_order', {
        p_restaurant_id: parsed.data.restaurant_id,
        p_order_number: orderNumber,
        p_customer_name: parsed.data.customer_name,
        p_customer_phone: parsed.data.customer_phone,
        p_fulfillment_type: parsed.data.fulfillment_type,
        p_customer_address: parsed.data.customer_address,
        p_notes: parsed.data.notes,
        p_items: parsed.data.items,
        p_subtotal: parsed.data.subtotal,
        p_delivery_fee: parsed.data.delivery_fee,
        p_total: parsed.data.total,
      });

      if (!rpcError && rpcOrder) {
        return NextResponse.json({ order: rpcOrder }, { status: 201 });
      }

      // 2. البديل المباشر: INSERT بدون .select() حتى لا يصطدم الزائر بسياسة SELECT الخاصة بمالك المطعم في RLS
      const { error: insertError } = await supabase.from('orders').insert({
        id: orderId,
        ...parsed.data,
        order_number: orderNumber,
        status: 'new',
        sent_via_whatsapp: true,
      });

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json(
      {
        order: {
          id: orderId,
          order_number: orderNumber,
          ...parsed.data,
          status: 'new',
          sent_via_whatsapp: true,
          created_at: createdAt,
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع أثناء حفظ الطلب' },
      { status: 500 }
    );
  }
}
