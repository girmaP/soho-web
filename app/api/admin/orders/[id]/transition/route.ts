import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/server/adminAuth';
import { appendOrderEvent } from '@/lib/server/orderEvents';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { assertStripeConfiguration, stripe } from '@/lib/stripe';
import { sendOrderEmail } from '@/lib/server/orderEmails';

const schema = z.object({
  status: z.enum(['pending', 'accepted', 'preparing', 'ready', 'delivered', 'cancelled']),
  estimatedTime: z.number().int().min(5).max(180).nullable().optional(),
  cancellationReason: z.string().trim().max(500).nullable().optional()
});

const allowedTransitions: Record<string, string[]> = {
  pending: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: []
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const admin = await requireAdmin(request);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, error: 'Transición no válida.' }, { status: 400 });

    const { data: order, error } = await supabaseAdmin.from('orders').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!order) return NextResponse.json({ ok: false, error: 'Pedido no encontrado.' }, { status: 404 });

    const next = parsed.data.status;
    if (next !== order.status && !allowedTransitions[order.status]?.includes(next)) {
      return NextResponse.json({ ok: false, error: 'Ese cambio de estado no esta permitido.' }, { status: 409 });
    }
    if (!['authorized', 'paid', 'refund_pending', 'refunded'].includes(order.payment_status)) {
      return NextResponse.json({ ok: false, error: 'El pedido todavia no tiene un pago confirmado.' }, { status: 409 });
    }
    const update: Record<string, unknown> = {
      status: next,
      estimated_time: parsed.data.estimatedTime ?? order.estimated_time,
      updated_at: new Date().toISOString()
    };

    if (next === 'accepted' && !order.accepted_at) update.accepted_at = new Date().toISOString();
    if (next === 'preparing' && !order.preparing_at) update.preparing_at = new Date().toISOString();
    if (next === 'ready' && !order.ready_at) update.ready_at = new Date().toISOString();
    if (next === 'delivered' && !order.delivered_at) update.delivered_at = new Date().toISOString();

    if (next === 'preparing') {
      if (!order.stripe_payment_intent_id) throw new Error('El pedido no tiene una autorización de Stripe asociada.');
      if (order.payment_status === 'authorized') {
        await assertStripeConfiguration();
        const intent = await stripe.paymentIntents.capture(order.stripe_payment_intent_id, {}, {
          idempotencyKey: `capture-order-${order.id}`
        });
        if (intent.status !== 'succeeded') throw new Error(`Stripe no confirmó el cobro (${intent.status}).`);
        let stripeFeeAmount = 0;
        try {
          const expanded = await stripe.paymentIntents.retrieve(intent.id, { expand: ['latest_charge.balance_transaction'] });
          const charge: any = expanded.latest_charge;
          const balanceTransaction: any = charge && typeof charge !== 'string' ? charge.balance_transaction : null;
          stripeFeeAmount = balanceTransaction && typeof balanceTransaction !== 'string' ? Number(balanceTransaction.fee || 0) / 100 : 0;
        } catch (feeError) {
          console.warn('No se pudo obtener la comisión exacta de Stripe en la captura:', feeError);
        }
        update.payment_status = 'paid';
        update.paid_at = new Date().toISOString();
        update.stripe_fee_amount = Number(stripeFeeAmount.toFixed(2));
      } else if (order.payment_status !== 'paid') {
        throw new Error('El pago no está autorizado. No se debe iniciar la preparación.');
      }
    }

    if (next === 'cancelled') {
      const reason = parsed.data.cancellationReason?.trim() || 'Pedido cancelado por SOHO Cambados.';
      update.cancellation_reason = reason;
      update.cancelled_at = new Date().toISOString();

      if (order.payment_status === 'authorized' && order.stripe_payment_intent_id) {
        await assertStripeConfiguration();
        await stripe.paymentIntents.cancel(order.stripe_payment_intent_id, { cancellation_reason: 'requested_by_customer' });
        update.payment_status = 'cancelled';
      } else if (order.payment_status === 'paid') {
        return NextResponse.json({ ok: false, error: 'El pedido ya está cobrado. Para devolver el dinero usa el botón Reembolsar, que requiere confirmación expresa.' }, { status: 409 });
      }
    } else {
      update.cancellation_reason = null;
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('orders').update(update).eq('id', order.id).select('*,order_items(*)').single();
    if (updateError) throw updateError;

    await appendOrderEvent({
      orderId: order.id,
      eventType: `status.${next}`,
      actorType: 'admin',
      actorId: admin.id,
      fromStatus: order.status,
      toStatus: next,
      metadata: { estimatedTime: parsed.data.estimatedTime ?? null, paymentStatus: updated.payment_status }
    });

    if (order.status !== next) {
      const emailKind = ({ accepted: 'accepted', preparing: 'preparing', ready: 'ready', cancelled: 'cancelled' } as const)[next as 'accepted' | 'preparing' | 'ready' | 'cancelled'];
      if (emailKind) await sendOrderEmail(order.id, emailKind).catch((emailError) => console.error('order_email_dispatch_failed', { orderId: order.id, kind: emailKind, error: emailError?.message }));
    }

    return NextResponse.json({ ok: true, order: updated });
  } catch (error: any) {
    const status = error?.message === 'UNAUTHORIZED' ? 401 : error?.message === 'FORBIDDEN' ? 403 : 500;
    console.error('admin_order_transition_failed', { orderId: id, error: error?.message });
    return NextResponse.json({ ok: false, error: status === 500 ? 'No se pudo actualizar el pedido. Intentalo de nuevo.' : 'No autorizado.' }, { status });
  }
}
