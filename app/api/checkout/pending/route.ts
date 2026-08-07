import { NextResponse } from 'next/server';
import { z } from 'zod';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { appendOrderEvent } from '@/lib/server/orderEvents';

const schema = z.object({
  orderId: z.string().uuid(),
  token: z.string().min(20),
  action: z.enum(['resume', 'cancel'])
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Solicitud no válida.' }, { status: 400 });

  const { orderId, token, action } = parsed.data;
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('id,order_token,stripe_session_id,payment_status,status')
    .eq('id', orderId)
    .eq('order_token', token)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: 'No se pudo consultar el intento de pago.' }, { status: 500 });
  if (!order) return NextResponse.json({ ok: false, error: 'Intento de pago no encontrado.' }, { status: 404 });
  if (['authorized', 'paid', 'refund_pending', 'refunded'].includes(order.payment_status)) {
    return NextResponse.json({ ok: false, code: 'ALREADY_CONFIRMED', error: 'El pedido ya está confirmado.' }, { status: 409 });
  }

  if (action === 'resume') {
    if (!order.stripe_session_id) return NextResponse.json({ ok: false, error: 'La sesión de pago ya no está disponible.' }, { status: 409 });
    const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
    if (session.status !== 'open' || !session.url) {
      return NextResponse.json({ ok: false, code: 'SESSION_CLOSED', error: 'La sesión de pago ha caducado. Vuelve al checkout para iniciar otra.' }, { status: 409 });
    }
    return NextResponse.json({ ok: true, url: session.url });
  }

  if (order.stripe_session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
      if (session.status === 'open') await stripe.checkout.sessions.expire(order.stripe_session_id);
    } catch (stripeError: any) {
      console.warn('checkout_cancel_expire_failed', { orderId, error: stripeError?.message });
    }
  }

  await supabaseAdmin.from('orders').update({
    status: 'cancelled',
    payment_status: 'cancelled',
    cancellation_reason: 'El cliente canceló el proceso antes de confirmar el pago.',
    updated_at: new Date().toISOString()
  }).eq('id', orderId).in('payment_status', ['pending', 'failed']);
  await appendOrderEvent({ orderId, eventType: 'checkout.cancelled_by_customer', actorType: 'customer' });

  return NextResponse.json({ ok: true });
}
