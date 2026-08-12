import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function appendOrderEvent(params: {
  orderId: string;
  eventType: string;
  actorType?: 'system' | 'admin' | 'customer' | 'stripe';
  actorId?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  stripeEventId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin.from('order_events').insert({
    order_id: params.orderId,
    event_type: params.eventType,
    actor_type: params.actorType || 'system',
    actor_id: params.actorId || null,
    from_status: params.fromStatus || null,
    to_status: params.toStatus || null,
    stripe_event_id: params.stripeEventId || null,
    metadata: params.metadata || {}
  });
  if (error) throw error;
}
