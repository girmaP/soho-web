import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function enqueueOrderForPrinting(orderId: string) {
  const { error } = await supabaseAdmin
    .from('print_jobs')
    .upsert({ order_id: orderId, status: 'pending' }, { onConflict: 'order_id', ignoreDuplicates: true });
  if (error) throw error;
}

export function printableOrderReference(order: { reference?: string | null; id: string }) {
  return order.reference || `WEB-${String(order.id).slice(0, 8).toUpperCase()}`;
}
