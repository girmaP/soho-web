import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { printableOrderReference } from '@/lib/server/printJobs';

export const dynamic = 'force-dynamic';

const workerSchema = z.string().trim().min(2).max(100);
const resultSchema = z.object({
  jobId: z.string().uuid(),
  workerId: workerSchema,
  status: z.enum(['printed', 'failed']),
  error: z.string().trim().max(500).optional()
});

function authorized(request: Request) {
  const expected = process.env.PRINT_BRIDGE_TOKEN?.trim() || '';
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
  if (expected.length < 32 || supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'No autorizado.' }, { status: 401 });
}

export async function GET(request: Request) {
  if (!authorized(request)) return unauthorized();
  const url = new URL(request.url);
  const parsedWorker = workerSchema.safeParse(url.searchParams.get('worker'));
  if (!parsedWorker.success) return NextResponse.json({ ok: false, error: 'Identificador de impresora no válido.' }, { status: 400 });

  const { data: claimed, error: claimError } = await supabaseAdmin.rpc('claim_print_jobs', {
    p_worker_id: parsedWorker.data,
    p_limit: 3
  });
  if (claimError) {
    console.error('print_jobs_claim_failed', { error: claimError.message });
    return NextResponse.json({ ok: false, error: 'No se pudo consultar la cola de impresión.' }, { status: 500 });
  }

  const jobs = claimed || [];
  if (!jobs.length) return NextResponse.json({ ok: true, jobs: [] }, { headers: { 'Cache-Control': 'no-store' } });
  const orderIds = jobs.map((job: any) => job.order_id);
  const { data: orders, error: ordersError } = await supabaseAdmin
    .from('orders')
    .select('id,customer_name,customer_phone,notes,total_price,paid_at,created_at,order_items(id,product_name,quantity,unit_price,total_price,customizations)')
    .in('id', orderIds);
  if (ordersError) {
    console.error('print_jobs_orders_failed', { error: ordersError.message });
    return NextResponse.json({ ok: false, error: 'No se pudieron preparar los tickets.' }, { status: 500 });
  }
  const orderMap = new Map((orders || []).map((order: any) => [order.id, order]));
  const payload = jobs.flatMap((job: any) => {
    const order: any = orderMap.get(job.order_id);
    if (!order) return [];
    return [{
      id: job.id,
      attempt: job.attempts,
      order: {
        id: order.id,
        reference: printableOrderReference(order),
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        notes: order.notes,
        total: Number(order.total_price),
        placedAt: order.paid_at || order.created_at,
        items: (order.order_items || []).map((item: any) => ({
          name: item.product_name,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unit_price),
          total: Number(item.total_price),
          customizations: item.customizations || {}
        }))
      }
    }];
  });
  return NextResponse.json({ ok: true, jobs: payload }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  if (!authorized(request)) return unauthorized();
  const parsed = resultSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Resultado de impresión no válido.' }, { status: 400 });
  const body = parsed.data;
  const now = new Date().toISOString();
  const update = body.status === 'printed'
    ? { status: 'printed', printed_at: now, last_error: null, updated_at: now }
    : { status: 'failed', printed_at: null, last_error: body.error || 'La impresora no confirmó el ticket.', updated_at: now };
  const { data, error } = await supabaseAdmin.from('print_jobs').update(update)
    .eq('id', body.jobId).eq('worker_id', body.workerId).eq('status', 'claimed').select('id').maybeSingle();
  if (error) {
    console.error('print_job_update_failed', { jobId: body.jobId, error: error.message });
    return NextResponse.json({ ok: false, error: 'No se pudo registrar el resultado.' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ ok: false, error: 'El trabajo ya no pertenece a este conector.' }, { status: 409 });
  return NextResponse.json({ ok: true });
}
