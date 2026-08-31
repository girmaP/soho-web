import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { appendOrderEvent } from '@/lib/server/orderEvents';
import { sendOrderEmail } from '@/lib/server/orderEmails';
import { activatePaidOrder } from '@/lib/server/automaticOrders';

async function findOrderIdByPaymentIntent(paymentIntentId?: string | null) {
  if (!paymentIntentId) return null;
  const { data, error } = await supabaseAdmin.from('orders').select('id').eq('stripe_payment_intent_id', paymentIntentId).maybeSingle();
  if (error) throw error;
  return data?.id || null;
}

async function registerAuthorization(orderId: string, paymentIntent: Stripe.PaymentIntent, eventId: string, sessionId?: string) {
  if (paymentIntent.status !== 'requires_capture') {
    throw new Error(`PaymentIntent ${paymentIntent.id} no esta autorizado.`);
  }
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders').select('id,total_price,stripe_session_id,stripe_payment_intent_id,payment_status').eq('id', orderId).maybeSingle();
  if (orderError) throw orderError;
  if (!order) throw new Error('El pedido asociado al pago no existe.');
  if (sessionId && order.stripe_session_id && order.stripe_session_id !== sessionId) {
    throw new Error('La sesion de Stripe no corresponde al pedido.');
  }
  if (paymentIntent.currency !== 'eur' || paymentIntent.amount !== Math.round(Number(order.total_price) * 100)) {
    throw new Error('El importe autorizado no coincide con el pedido.');
  }
  const now = new Date().toISOString();
  const { data: activated, error } = await supabaseAdmin.from('orders').update({
    status: 'pending',
    payment_status: 'authorized',
    stripe_payment_intent_id: paymentIntent.id,
    stripe_session_id: sessionId || order.stripe_session_id,
    paid_at: null,
    updated_at: now
  }).eq('id', orderId).in('payment_status', ['pending', 'failed']).select('id').maybeSingle();
  if (error) throw error;
  if (!activated) {
    if (order.stripe_payment_intent_id === paymentIntent.id && ['authorized', 'paid'].includes(order.payment_status)) {
      const email = await sendOrderEmail(orderId, 'received');
      if (!email.ok && !email.skipped) throw new Error('No se pudo enviar el correo de confirmacion.');
    }
    return;
  }

  await appendOrderEvent({
    orderId,
    eventType: 'payment.authorized',
    actorType: 'stripe',
    stripeEventId: eventId,
    metadata: { paymentIntentId: paymentIntent.id, stripeSessionId: sessionId || null }
  }).catch((eventError) => console.error('order_event_append_failed', { orderId, eventId, error: eventError?.message }));
  const email = await sendOrderEmail(orderId, 'received');
  if (!email.ok && !email.skipped) throw new Error('No se pudo enviar el correo de confirmacion.');
}

async function registerPaymentSucceeded(paymentIntent: Stripe.PaymentIntent, eventId: string, knownOrderId?: string, sessionId?: string) {
  const orderId = knownOrderId || paymentIntent.metadata?.order_id || await findOrderIdByPaymentIntent(paymentIntent.id);
  if (!orderId) return;
  await activatePaidOrder({ orderId, paymentIntent, sessionId, eventId, source: 'stripe_webhook' });
}

async function registerPaymentFailed(paymentIntent: Stripe.PaymentIntent, eventId: string) {
  const orderId = paymentIntent.metadata?.order_id || await findOrderIdByPaymentIntent(paymentIntent.id);
  if (!orderId) return;
  const { error } = await supabaseAdmin.from('orders').update({
    payment_status: 'failed',
    updated_at: new Date().toISOString()
  }).eq('id', orderId).in('payment_status', ['pending', 'failed']);
  if (error) throw error;
  await appendOrderEvent({ orderId, eventType: 'payment.failed', actorType: 'stripe', stripeEventId: eventId, metadata: { paymentIntentId: paymentIntent.id } });
}

async function registerPaymentCancelled(paymentIntent: Stripe.PaymentIntent, eventId: string) {
  const orderId = paymentIntent.metadata?.order_id || await findOrderIdByPaymentIntent(paymentIntent.id);
  if (!orderId) return;
  const { data: order, error } = await supabaseAdmin.from('orders').select('id,status,payment_status').eq('id', orderId).maybeSingle();
  if (error) throw error;
  if (!order || ['paid', 'refund_pending', 'refunded'].includes(order.payment_status)) return;
  const update: Record<string, unknown> = { payment_status: 'cancelled', updated_at: new Date().toISOString() };
  if (order.status === 'pending') {
    update.status = 'cancelled';
    update.cancelled_at = new Date().toISOString();
    update.cancellation_reason = 'La autorización de pago fue cancelada.';
  }
  const { error: updateError } = await supabaseAdmin.from('orders').update(update).eq('id', orderId);
  if (updateError) throw updateError;
  await appendOrderEvent({ orderId, eventType: 'payment.cancelled', actorType: 'stripe', stripeEventId: eventId, metadata: { paymentIntentId: paymentIntent.id } });
}

async function updateRefund(refund: Stripe.Refund, eventId: string) {
  const paymentIntentId = typeof refund.payment_intent === 'string' ? refund.payment_intent : refund.payment_intent?.id;
  const orderId = refund.metadata?.order_id || await findOrderIdByPaymentIntent(paymentIntentId);
  if (!orderId) return;
  const succeeded = refund.status === 'succeeded';
  const { error } = await supabaseAdmin.from('orders').update({
    payment_status: succeeded ? 'refunded' : 'refund_pending',
    stripe_refund_id: refund.id,
    refunded_at: succeeded ? new Date().toISOString() : null,
    refunded_amount: succeeded ? Number((refund.amount / 100).toFixed(2)) : 0,
    updated_at: new Date().toISOString()
  }).eq('id', orderId);
  if (error) throw error;
  await appendOrderEvent({
    orderId,
    eventType: succeeded ? 'refund.succeeded' : 'refund.updated',
    actorType: 'stripe',
    stripeEventId: eventId,
    metadata: { refundId: refund.id, status: refund.status, amount: refund.amount / 100 }
  });
  if (succeeded) await sendOrderEmail(orderId, 'refunded').catch((emailError) =>
    console.error('order_email_dispatch_failed', { orderId, kind: 'refunded', error: emailError?.message })
  );
}

async function updateChargeRefunded(charge: Stripe.Charge, eventId: string) {
  const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
  const orderId = charge.metadata?.order_id || await findOrderIdByPaymentIntent(paymentIntentId);
  if (!orderId || !charge.refunded) return;
  const refundedAmount = Number(((charge.amount_refunded || charge.amount) / 100).toFixed(2));
  const { error } = await supabaseAdmin.from('orders').update({
    payment_status: 'refunded',
    refunded_at: new Date().toISOString(),
    refunded_amount: refundedAmount,
    updated_at: new Date().toISOString()
  }).eq('id', orderId);
  if (error) throw error;
  await appendOrderEvent({ orderId, eventType: 'charge.refunded', actorType: 'stripe', stripeEventId: eventId, metadata: { chargeId: charge.id, amount: refundedAmount } });
  await sendOrderEmail(orderId, 'refunded').catch((emailError) =>
    console.error('order_email_dispatch_failed', { orderId, kind: 'refunded', error: emailError?.message })
  );
}

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!signature || !secret) return NextResponse.json({ error: 'Webhook no configurado.' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch (error: any) {
    console.error('stripe_webhook_signature_invalid', { error: error?.message });
    return NextResponse.json({ error: 'Firma inválida.' }, { status: 400 });
  }

  try {
    const { data: claimed, error: claimError } = await supabaseAdmin.rpc('claim_stripe_webhook_event', {
      p_event_id: event.id,
      p_event_type: event.type
    });
    if (claimError) throw claimError;
    if (!claimed) return NextResponse.json({ received: true, duplicate: true });
  } catch (error: any) {
    console.error('stripe_webhook_event_log_failed', { eventId: event.id, type: event.type, error: error?.message });
    return NextResponse.json({ error: 'No se pudo registrar el evento.' }, { status: 500 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const eventSession = event.data.object as Stripe.Checkout.Session;
      const session = await stripe.checkout.sessions.retrieve(eventSession.id, { expand: ['payment_intent'] });
      const orderId = session.metadata?.order_id;
      const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
      if (!orderId || !paymentIntentId) throw new Error('La sesión completada no contiene order_id o PaymentIntent.');
      const paymentIntent = typeof session.payment_intent === 'string'
        ? await stripe.paymentIntents.retrieve(session.payment_intent)
        : session.payment_intent;
      if (!paymentIntent || paymentIntent.id !== paymentIntentId) throw new Error('PaymentIntent no disponible.');
      if (paymentIntent.status === 'succeeded') {
        await registerPaymentSucceeded(paymentIntent, event.id, orderId, session.id);
      } else if (paymentIntent.status === 'requires_capture') {
        await registerAuthorization(orderId, paymentIntent, event.id, session.id);
      }
    } else if (event.type === 'payment_intent.amount_capturable_updated') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const orderId = paymentIntent.metadata?.order_id;
      if (orderId) await registerAuthorization(orderId, paymentIntent, event.id);
    } else if (event.type === 'payment_intent.succeeded') {
      await registerPaymentSucceeded(event.data.object as Stripe.PaymentIntent, event.id);
    } else if (event.type === 'payment_intent.payment_failed') {
      await registerPaymentFailed(event.data.object as Stripe.PaymentIntent, event.id);
    } else if (event.type === 'payment_intent.canceled') {
      await registerPaymentCancelled(event.data.object as Stripe.PaymentIntent, event.id);
    } else if (event.type === 'checkout.session.expired') {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.order_id;
      if (orderId) {
        const { error: expirationError } = await supabaseAdmin.from('orders').update({
          payment_status: 'failed',
          status: 'cancelled',
          cancellation_reason: 'La sesión de pago caducó.',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }).eq('id', orderId).eq('payment_status', 'pending');
        if (expirationError) throw expirationError;
        await appendOrderEvent({ orderId, eventType: 'checkout.expired', actorType: 'stripe', stripeEventId: event.id });
      }
    } else if (event.type === 'refund.updated' || event.type === 'refund.created') {
      await updateRefund(event.data.object as Stripe.Refund, event.id);
    } else if (event.type === 'charge.refunded') {
      await updateChargeRefunded(event.data.object as Stripe.Charge, event.id);
    }

    const { error: completionError } = await supabaseAdmin.from('stripe_webhook_events').update({ status: 'processed', processed_at: new Date().toISOString(), error_message: null }).eq('event_id', event.id);
    if (completionError) throw completionError;
    return NextResponse.json({ received: true });
  } catch (error: any) {
    await supabaseAdmin.from('stripe_webhook_events').update({ status: 'failed', error_message: error?.message || 'Unknown error', processed_at: new Date().toISOString() }).eq('event_id', event.id);
    console.error('stripe_webhook_failed', { eventId: event.id, type: event.type, error: error?.message });
    return NextResponse.json({ error: 'Error procesando webhook.' }, { status: 500 });
  }
}
