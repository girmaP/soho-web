import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(request.url).searchParams.get('token')?.trim();
  if (!token || token.length < 20) {
    return NextResponse.json({ ok: false, error: 'Enlace de seguimiento no válido.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id,stripe_payment_intent_id,customer_name,customer_phone,customer_email,order_type,delivery_address,notes,status,payment_status,cancellation_reason,refund_reason,accepted_at,estimated_time,total_price,created_at,updated_at,order_items(id,product_name,quantity,unit_price,total_price)')
    .eq('id', id)
    .eq('order_token', token)
    .maybeSingle();

  if (error) {
    console.error('order_tracking_lookup_failed', { orderId: id, error: error.message });
    return NextResponse.json({ ok: false, error: 'No se pudo consultar el pedido.' }, { status: 500 });
  }
  if (!data || (!['authorized', 'paid', 'refund_pending', 'refunded'].includes(data.payment_status) && !data.stripe_payment_intent_id)) {
    return NextResponse.json({ ok: false, error: 'El pedido todavía no está confirmado.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, order: data }, { headers: { 'Cache-Control': 'no-store' } });
}
