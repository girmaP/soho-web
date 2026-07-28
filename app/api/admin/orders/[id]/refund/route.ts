import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/server/adminAuth';
import { appendOrderEvent } from '@/lib/server/orderEvents';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe } from '@/lib/stripe';

const schema = z.object({ reason: z.string().trim().min(5).max(500), confirmation: z.literal('REEMBOLSAR') });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const admin = await requireAdmin(request);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, error: 'Confirmación de reembolso no válida.' }, { status: 400 });
    const { data: order, error } = await supabaseAdmin.from('orders').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!order) return NextResponse.json({ ok: false, error: 'Pedido no encontrado.' }, { status: 404 });
    if (order.payment_status !== 'paid' || !order.stripe_payment_intent_id) return NextResponse.json({ ok: false, error: 'El pedido no tiene un pago capturado reembolsable.' }, { status: 409 });
    if (order.stripe_refund_id) return NextResponse.json({ ok: false, error: 'Este pedido ya tiene un reembolso asociado.' }, { status: 409 });

    const refund = await stripe.refunds.create({
      payment_intent: order.stripe_payment_intent_id,
      metadata: { order_id: order.id, reason: parsed.data.reason }
    }, { idempotencyKey: `manual-refund-order-${order.id}` });

    const succeeded = refund.status === 'succeeded';
    const { data: updated, error: updateError } = await supabaseAdmin.from('orders').update({
      payment_status: succeeded ? 'refunded' : 'refund_pending',
      stripe_refund_id: refund.id,
      refund_reason: parsed.data.reason,
      refunded_at: succeeded ? new Date().toISOString() : null,
      refunded_amount: succeeded ? Number((refund.amount / 100).toFixed(2)) : 0,
      updated_at: new Date().toISOString()
    }).eq('id', order.id).select('*,order_items(*)').single();
    if (updateError) throw updateError;

    await appendOrderEvent({ orderId: order.id, eventType: succeeded ? 'refund.succeeded' : 'refund.requested', actorType: 'admin', actorId: admin.id, metadata: { refundId: refund.id, reason: parsed.data.reason, status: refund.status, amount: refund.amount / 100 } });
    return NextResponse.json({ ok: true, order: updated });
  } catch (error: any) {
    const status = error?.message === 'UNAUTHORIZED' ? 401 : error?.message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ ok: false, error: status === 500 ? (error?.message || 'No se pudo tramitar el reembolso.') : 'No autorizado.' }, { status });
  }
}
