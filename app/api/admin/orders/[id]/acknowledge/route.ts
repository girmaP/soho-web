import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { appendOrderEvent } from '@/lib/server/orderEvents';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const admin = await requireAdmin(request);
    const now = new Date().toISOString();
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .update({ received_acknowledged_at: now, received_acknowledged_by: admin.id, updated_at: now })
      .eq('id', id)
      .is('received_acknowledged_at', null)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (order) {
      await appendOrderEvent({
        orderId: id,
        eventType: 'order.received_acknowledged',
        actorType: 'admin',
        actorId: admin.id,
        fromStatus: order.status,
        toStatus: order.status,
        metadata: { acknowledgedAt: now }
      });
    }
    return NextResponse.json({ ok: true, acknowledgedAt: order?.received_acknowledged_at || now });
  } catch (error: any) {
    const status = error?.message === 'UNAUTHORIZED' ? 401 : error?.message === 'FORBIDDEN' ? 403 : 500;
    console.error('order_acknowledge_failed', { orderId: id, error: error?.message });
    return NextResponse.json({ ok: false, error: status === 500 ? 'No se pudo confirmar la recepción del pedido.' : 'No autorizado.' }, { status });
  }
}
