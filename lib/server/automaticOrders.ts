import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { appendOrderEvent } from '@/lib/server/orderEvents';
import { sendOrderEmail } from '@/lib/server/orderEmails';

type ActivationSource = 'stripe_webhook' | 'checkout_return' | 'order_tracking';

export async function activatePaidOrder(params: {
  orderId: string;
  paymentIntent: Stripe.PaymentIntent;
  sessionId?: string | null;
  eventId?: string | null;
  source: ActivationSource;
}) {
  const { orderId, paymentIntent, sessionId, eventId, source } = params;
  if (paymentIntent.status !== 'succeeded') return { activated: false, reason: paymentIntent.status };

  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('id,status,payment_status,total_price,paid_at,accepted_at,preparing_at,estimated_time,stripe_session_id,stripe_payment_intent_id')
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw error;
  if (!order) throw new Error('El pedido asociado al pago no existe.');
  if (['refunded', 'refund_pending'].includes(order.payment_status)) return { activated: false, reason: order.payment_status };
  if (order.status === 'cancelled') return { activated: false, reason: 'cancelled' };
  if (sessionId && order.stripe_session_id && order.stripe_session_id !== sessionId) throw new Error('La sesión de Stripe no corresponde al pedido.');
  if (paymentIntent.metadata?.order_id && paymentIntent.metadata.order_id !== orderId) throw new Error('El PaymentIntent no corresponde al pedido.');
  if (paymentIntent.currency !== 'eur' || paymentIntent.amount !== Math.round(Number(order.total_price) * 100)) {
    throw new Error('El importe cobrado no coincide con el pedido.');
  }

  const { data: rawSettings } = await supabaseAdmin.from('business_settings').select('*').eq('id', 'main').maybeSingle();
  const waitMinutes = Math.min(180, Math.max(5, Number(rawSettings?.default_wait_minutes || 10)));
  const now = new Date().toISOString();
  const alreadyActive = order.payment_status === 'paid' && ['accepted', 'preparing', 'ready', 'delivered'].includes(order.status);

  const { data: updated, error: updateError } = await supabaseAdmin.from('orders').update({
    status: alreadyActive ? order.status : 'accepted',
    payment_status: 'paid',
    stripe_payment_intent_id: paymentIntent.id,
    stripe_session_id: sessionId || order.stripe_session_id,
    paid_at: order.paid_at || now,
    accepted_at: order.accepted_at || now,
    preparing_at: order.preparing_at,
    estimated_time: order.estimated_time || waitMinutes,
    updated_at: now
  }).eq('id', orderId).select('*').single();
  if (updateError) throw updateError;

  if (!alreadyActive) {
    await appendOrderEvent({
      orderId,
      eventType: 'status.auto_accepted',
      actorType: source === 'stripe_webhook' ? 'stripe' : 'system',
      fromStatus: order.status,
      toStatus: 'accepted',
      stripeEventId: eventId || null,
      metadata: { paymentIntentId: paymentIntent.id, estimatedTime: order.estimated_time || waitMinutes, source }
    }).catch((eventError) => console.error('order_event_append_failed', { orderId, source, error: eventError?.message }));

    await sendOrderEmail(orderId, 'accepted').catch((emailError) =>
      console.error('order_email_dispatch_failed', { orderId, kind: 'accepted', error: emailError?.message })
    );
  }

  return { activated: !alreadyActive, order: updated };
}
