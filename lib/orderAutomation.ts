export type AutomaticOrder = {
  status?: string | null;
  payment_status?: string | null;
  estimated_time?: number | null;
  accepted_at?: string | null;
  preparing_at?: string | null;
  paid_at?: string | null;
  created_at?: string | null;
  ready_at?: string | null;
};

export const ACCEPTED_STAGE_MINUTES = 2;

export function automaticPreparingAt(order: AutomaticOrder) {
  if (order.payment_status !== 'paid') return null;
  const startedAt = order.accepted_at || order.paid_at || order.created_at;
  if (!startedAt) return null;
  const timestamp = new Date(startedAt).getTime() + ACCEPTED_STAGE_MINUTES * 60_000;
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export function automaticReadyAt(order: AutomaticOrder) {
  if (order.payment_status !== 'paid') return null;
  const minutes = Number(order.estimated_time || 0);
  const startedAt = order.accepted_at || order.paid_at || order.created_at;
  if (!startedAt || !Number.isFinite(minutes) || minutes < 1) return null;
  const timestamp = new Date(startedAt).getTime() + minutes * 60_000;
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export function effectiveOrderStatus(order: AutomaticOrder, now = Date.now()) {
  const status = order.status || 'pending';
  if (!['accepted', 'preparing'].includes(status) || order.payment_status !== 'paid') return status;
  const readyAt = automaticReadyAt(order);
  if (readyAt && now >= new Date(readyAt).getTime()) return 'ready';
  const preparingAt = automaticPreparingAt(order);
  if (preparingAt && now >= new Date(preparingAt).getTime()) return 'preparing';
  return 'accepted';
}

export function withEffectiveOrderStatus<T extends AutomaticOrder>(order: T, now = Date.now()): T & { automatic_status: boolean } {
  const originalStatus = order.status || 'pending';
  const status = effectiveOrderStatus(order, now);
  const automaticallyReady = status === 'ready' && originalStatus !== 'ready';
  const automaticallyAdvanced = status !== originalStatus && ['preparing', 'ready'].includes(status);
  return {
    ...order,
    status,
    preparing_at: ['preparing', 'ready'].includes(status) && !order.preparing_at ? automaticPreparingAt(order) : order.preparing_at,
    ready_at: automaticallyReady ? automaticReadyAt(order) : order.ready_at,
    automatic_status: automaticallyAdvanced || Boolean((order as T & { automatic_status?: boolean }).automatic_status)
  };
}
