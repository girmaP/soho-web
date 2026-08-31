import { NextResponse } from 'next/server';
import { z } from 'zod';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { activatePaidOrder } from '@/lib/server/automaticOrders';

const schema = z.object({
  orderId: z.string().uuid(),
  token: z.string().min(20)
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, error: 'Solicitud no válida.' }, { status: 400 });

    const { orderId, token } = parsed.data;
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('id,order_token,stripe_session_id,status,payment_status')
      .eq('id', orderId)
      .eq('order_token', token)
      .maybeSingle();
    if (error) throw error;
    if (!order) return NextResponse.json({ ok: false, error: 'Pedido no encontrado.' }, { status: 404 });
    if (order.payment_status === 'paid' && ['accepted', 'preparing', 'ready', 'delivered'].includes(order.status)) {
      return NextResponse.json({ ok: true, confirmed: true });
    }
    if (!order.stripe_session_id) return NextResponse.json({ ok: false, error: 'La sesión de pago no está disponible.' }, { status: 409 });

    const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id, { expand: ['payment_intent'] });
    if (session.metadata?.order_id !== order.id) throw new Error('La sesión de Stripe no corresponde al pedido.');
    const paymentIntent = typeof session.payment_intent === 'string'
      ? await stripe.paymentIntents.retrieve(session.payment_intent)
      : session.payment_intent as Stripe.PaymentIntent | null;
    if (!paymentIntent || paymentIntent.status !== 'succeeded') {
      return NextResponse.json({ ok: true, confirmed: false, paymentStatus: paymentIntent?.status || session.payment_status });
    }

    await activatePaidOrder({
      orderId: order.id,
      paymentIntent,
      sessionId: session.id,
      source: 'checkout_return'
    });
    return NextResponse.json({ ok: true, confirmed: true });
  } catch (error: any) {
    console.error('checkout_confirmation_failed', { error: error?.message });
    return NextResponse.json({ ok: false, error: 'No se pudo confirmar el pedido.' }, { status: 500 });
  }
}
