import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { appendOrderEvent } from '@/lib/server/orderEvents';
import { sendOrderEmail } from '@/lib/server/orderEmails';

function isMissingRelation(error: any) {
  const message = String(error?.message || '');
  return error?.code === '42P01' || error?.code === 'PGRST205' || /relation .* does not exist|schema cache/i.test(message);
}

async function findOrderIdByPaymentIntent(paymentIntentId?: string | null) {
  if (!paymentIntentId) return null;
  const { data, error } = await supabaseAdmin.from('orders').select('id').eq('stripe_payment_intent_id', paymentIntentId).maybeSingle();
  if (error) throw error;
  return data?.id || null;
}

async function registerAuthorization(orderId: string, paymentIntentId: string, eventId: string) {
  const now = new Date().toISOString();
  const { data: activated, error } = await supabaseAdmin.from('orders').update({
    status: 'pending',
    payment_status: 'authorized',
    stripe_payment_intent_id: paymentIntentId,
    updated_at: now
  }).eq('id', orderId).in('payment_status', ['pending', 'failed']).select('id').maybeSingle();
  if (error) throw error;
  if (!activated) return;

  await appendOrderEvent({
    orderId,
    eventType: 'payment.authorized',
    actorType: 'stripe',
    stripeEventId: eventId,
    metadata: { paymentIntentId }
  });
  await sendOrderEmail(orderId, 'received').catch((emailError) =>
    console.error('order_email_dispatch_failed', { orderId, kind: 'received', error: emailError?.message })
  );
}

async function registerPaymentSucceeded(paymentIntent: Stripe.PaymentIntent, eventId: string) {
  const orderId = paymentIntent.metadata?.order_id || await findOrderIdByPaymentIntent(paymentIntent.id);
  if (!orderId) return;
  const { data: order, error } = await supabaseAdmin.from('orders').select('id,payment_status,paid_at').eq('id', orderId).maybeSingle();
  if (error) throw error;
  if (!order || order.payment_status === 'refunded' || order.payment_status === 'refund_pending') return;
  if (order.payment_status !== 'paid') {
    await supabaseAdmin.from('orders').update({
      payment_status: 'paid',
      paid_at: order.paid_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq('id', orderId);
    await appendOrderEvent({ orderId, eventType: 'payment.succeeded', actorType: 'stripe', stripeEventId: eventId, metadata: { paymentIntentId: paymentIntent.id } });
  }
}

async function registerPaymentFailed(paymentIntent: Stripe.PaymentIntent, eventId: string) {
  const orderId = paymentIntent.metadata?.order_id || await findOrderIdByPaymentIntent(paymentIntent.id);
  if (!orderId) return;
  await supabaseAdmin.from('orders').update({
    payment_status: 'failed',
    updated_at: new Date().toISOString()
  }).eq('id', orderId).in('payment_status', ['pending', 'failed']);
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
  await supabaseAdmin.from('orders').update(update).eq('id', orderId);
  await appendOrderEvent({ orderId, eventType: 'payment.cancelled', actorType: 'stripe', stripeEventId: eventId, metadata: { paymentIntentId: paymentIntent.id } });
}

async function updateRefund(refund: Stripe.Refund, eventId: string) {
  const paymentIntentId = typeof refund.payment_intent === 'string' ? refund.payment_intent : refund.payment_intent?.id;
  const orderId = refund.metadata?.order_id || await findOrderIdByPaymentIntent(paymentIntentId);
  if (!orderId) return;
  const succeeded = refund.status === 'succeeded';
  await supabaseAdmin.from('orders').update({
    payment_status: succeeded ? 'refunded' : 'refund_pending',
    stripe_refund_id: refund.id,
    refunded_at: succeeded ? new Date().toISOString() : null,
    refunded_amount: succeeded ? Number((refund.amount / 100).toFixed(2)) : 0,
    updated_at: new Date().toISOString()
  }).eq('id', orderId);
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
  await supabaseAdmin.from('orders').update({
    payment_status: 'refunded',
    refunded_at: new Date().toISOString(),
    refunded_amount: refundedAmount,
    updated_at: new Date().toISOString()
  }).eq('id', orderId);
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

  let eventLogAvailable = true;
  try {
    const { data: existing, error: readError } = await supabaseAdmin.from('stripe_webhook_events').select('event_id').eq('event_id', event.id).maybeSingle();
    if (readError) throw readError;
    if (existing) return NextResponse.json({ received: true, duplicate: true });
    const { error: insertError } = await supabaseAdmin.from('stripe_webhook_events').insert({ event_id: event.id, event_type: event.type, status: 'processing' });
    if (insertError) throw insertError;
  } catch (error: any) {
    if (isMissingRelation(error)) {
      eventLogAvailable = false;
      console.warn('stripe_webhook_event_log_missing', { eventId: event.id, type: event.type });
    } else {
      console.error('stripe_webhook_event_log_failed', { eventId: event.id, type: event.type, error: error?.message });
      return NextResponse.json({ error: 'No se pudo registrar el evento.' }, { status: 500 });
    }
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const eventSession = event.data.object as Stripe.Checkout.Session;
      const session = await stripe.checkout.sessions.retrieve(eventSession.id, { expand: ['payment_intent'] });
      const orderId = session.metadata?.order_id;
      const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
      if (!orderId || !paymentIntentId) throw new Error('La sesión completada no contiene order_id o PaymentIntent.');
      await registerAuthorization(orderId, paymentIntentId, event.id);
    } else if (event.type === 'payment_intent.amount_capturable_updated') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const orderId = paymentIntent.metadata?.order_id;
      if (orderId) await registerAuthorization(orderId, paymentIntent.id, event.id);
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
        await supabaseAdmin.from('orders').update({
          payment_status: 'failed',
          status: 'cancelled',
          cancellation_reason: 'La sesión de pago caducó.',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }).eq('id', orderId).eq('payment_status', 'pending');
        await appendOrderEvent({ orderId, eventType: 'checkout.expired', actorType: 'stripe', stripeEventId: event.id });
      }
    } else if (event.type === 'refund.updated' || event.type === 'refund.created') {
      await updateRefund(event.data.object as Stripe.Refund, event.id);
    } else if (event.type === 'charge.refunded') {
      await updateChargeRefunded(event.data.object as Stripe.Charge, event.id);
    }

    if (eventLogAvailable) {
      await supabaseAdmin.from('stripe_webhook_events').update({ status: 'processed', processed_at: new Date().toISOString(), error_message: null }).eq('event_id', event.id);
    }
    return NextResponse.json({ received: true });
  } catch (error: any) {
    if (eventLogAvailable) {
      await supabaseAdmin.from('stripe_webhook_events').update({ status: 'failed', error_message: error?.message || 'Unknown error', processed_at: new Date().toISOString() }).eq('event_id', event.id);
    }
    console.error('stripe_webhook_failed', { eventId: event.id, type: event.type, error: error?.message });
    return NextResponse.json({ error: 'Error procesando webhook.' }, { status: 500 });
  }
}
