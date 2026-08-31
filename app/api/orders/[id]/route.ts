import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { activatePaidOrder } from '@/lib/server/automaticOrders';
import { withEffectiveOrderStatus } from '@/lib/orderAutomation';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(request.url).searchParams.get('token')?.trim();
  if (!token || token.length < 20) {
    return NextResponse.json({ ok: false, error: 'Enlace de seguimiento no valido.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id,stripe_session_id,stripe_payment_intent_id,customer_name,customer_phone,customer_email,order_type,delivery_address,notes,status,payment_status,cancellation_reason,refund_reason,accepted_at,preparing_at,ready_at,delivered_at,cancelled_at,estimated_time,total_price,created_at,updated_at,order_items(id,product_name,quantity,unit_price,total_price)')
    .eq('id', id)
    .eq('order_token', token)
    .maybeSingle();

  if (error) {
    console.error('order_tracking_lookup_failed', { orderId: id, error: error.message });
    return NextResponse.json({ ok: false, error: 'No se pudo consultar el pedido.' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'Pedido no encontrado.' }, { status: 404 });
  }
  let orderData: any = data;
  if (!['authorized', 'paid', 'refund_pending', 'cancelled', 'refunded'].includes(orderData.payment_status) && orderData.stripe_session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(orderData.stripe_session_id, { expand: ['payment_intent'] });
      const paymentIntent = typeof session.payment_intent === 'string'
        ? await stripe.paymentIntents.retrieve(session.payment_intent)
        : session.payment_intent as Stripe.PaymentIntent | null;
      if (paymentIntent?.status === 'succeeded' && session.metadata?.order_id === orderData.id) {
        const result = await activatePaidOrder({ orderId: orderData.id, paymentIntent, sessionId: session.id, source: 'order_tracking' });
        if (result.order) orderData = { ...orderData, ...result.order };
      }
    } catch (reconcileError: any) {
      console.error('order_tracking_reconciliation_failed', { orderId: id, error: reconcileError?.message });
    }
  }
  if (!['authorized', 'paid', 'refund_pending','cancelled', 'refunded'].includes(orderData.payment_status)) {
    return NextResponse.json({ ok: false, code: 'ORDER_CONFIRMING', error: 'Estamos confirmando el pago del pedido.' }, { status: 409 });
  }

  const publicOrder = { ...orderData };
  delete publicOrder.stripe_session_id;
  return NextResponse.json({ ok: true, order: withEffectiveOrderStatus(publicOrder) }, { headers: { 'Cache-Control': 'no-store' } });
}
