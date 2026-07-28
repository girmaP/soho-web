import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { appendOrderEvent } from '@/lib/server/orderEvents';

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return NextResponse.json({ error: 'Webhook no configurado.' }, { status: 400 });

  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(await request.text(), signature, secret); }
  catch { return NextResponse.json({ error: 'Firma inválida.' }, { status: 400 }); }

  const { data: existing } = await supabaseAdmin.from('stripe_webhook_events').select('event_id').eq('event_id', event.id).maybeSingle();
  if (existing) return NextResponse.json({ received: true, duplicate: true });

  const { error: insertError } = await supabaseAdmin.from('stripe_webhook_events').insert({ event_id: event.id, event_type: event.type, status: 'processing' });
  if (insertError) return NextResponse.json({ error: 'No se pudo registrar el evento.' }, { status: 500 });

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.order_id;
      if (orderId) {
        const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
        await supabaseAdmin.from('orders').update({
          payment_status: 'authorized', stripe_payment_intent_id: paymentIntentId || null, updated_at: new Date().toISOString()
        }).eq('id', orderId).eq('payment_status', 'pending');
        await appendOrderEvent({ orderId, eventType: 'payment.authorized', actorType: 'stripe', stripeEventId: event.id, metadata: { paymentIntentId } });
      }
    } else if (event.type === 'checkout.session.expired') {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.order_id;
      if (orderId) {
        await supabaseAdmin.from('orders').update({ payment_status: 'failed', status: 'cancelled', cancellation_reason: 'La sesión de pago caducó.', updated_at: new Date().toISOString() }).eq('id', orderId).eq('payment_status', 'pending');
        await appendOrderEvent({ orderId, eventType: 'checkout.expired', actorType: 'stripe', stripeEventId: event.id });
      }
    } else if (event.type === 'refund.updated' || event.type === 'refund.created') {
      const refund = event.data.object as Stripe.Refund;
      const orderId = refund.metadata?.order_id;
      if (orderId) {
        const succeeded = refund.status === 'succeeded';
        await supabaseAdmin.from('orders').update({
          payment_status: succeeded ? 'refunded' : 'refund_pending',
          stripe_refund_id: refund.id,
          refunded_at: succeeded ? new Date().toISOString() : null,
          refunded_amount: succeeded ? Number((refund.amount / 100).toFixed(2)) : 0,
          updated_at: new Date().toISOString()
        }).eq('id', orderId);
        await appendOrderEvent({ orderId, eventType: succeeded ? 'refund.succeeded' : 'refund.updated', actorType: 'stripe', stripeEventId: event.id, metadata: { refundId: refund.id, status: refund.status, amount: refund.amount / 100 } });
      }
    }

    await supabaseAdmin.from('stripe_webhook_events').update({ status: 'processed', processed_at: new Date().toISOString() }).eq('event_id', event.id);
    return NextResponse.json({ received: true });
  } catch (error: any) {
    await supabaseAdmin.from('stripe_webhook_events').update({ status: 'failed', error_message: error?.message || 'Unknown error', processed_at: new Date().toISOString() }).eq('event_id', event.id);
    console.error('stripe_webhook_failed', { eventId: event.id, type: event.type, error: error?.message });
    return NextResponse.json({ error: 'Error procesando webhook.' }, { status: 500 });
  }
}
