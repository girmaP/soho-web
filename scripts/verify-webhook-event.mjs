import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

function loadEnv() {
  const file = path.resolve('.env.local');
  if (!fs.existsSync(file)) throw new Error('No existe .env.local.');
  return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/)
    .filter((line) => line && !line.trim().startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      let value = line.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      return [line.slice(0, index).trim(), value];
    }));
}

function check(name, ok, detail = '') {
  console.log(`${ok ? '[OK]' : '[FAIL]'} ${name}${detail ? ` - ${detail}` : ''}`);
  return ok;
}

async function main() {
  const eventId = process.argv[2];
  if (!/^evt_[A-Za-z0-9]+$/.test(eventId || '')) {
    throw new Error('Uso: npm run verify:webhook -- evt_xxx');
  }
  const env = loadEnv();
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const event = await stripe.events.retrieve(eventId);
  const object = event.data.object;
  const orderId = object.metadata?.order_id;
  if (!orderId) throw new Error('El evento no contiene metadata.order_id.');

  const [{ data: eventLog, error: eventError }, { data: order, error: orderError }, { data: email, error: emailError }] = await Promise.all([
    admin.from('stripe_webhook_events').select('status,processed_at').eq('event_id', eventId).maybeSingle(),
    admin.from('orders').select('id,status,payment_status,stripe_payment_intent_id,order_token,order_items(id)').eq('id', orderId).maybeSingle(),
    admin.from('order_email_deliveries').select('status,sent_at').eq('order_id', orderId).eq('email_kind', 'received').maybeSingle()
  ]);
  if (eventError) throw eventError;
  if (orderError) throw orderError;
  if (emailError) throw emailError;

  const confirmedPayments = ['authorized','paid','refund_pending','refunded'];
  const baseUrl = (env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
  let trackingOk = false;
  let trackingDetail = 'pedido/token no disponibles';
  if (order?.order_token && baseUrl) {
    const response = await fetch(`${baseUrl}/api/orders/${encodeURIComponent(order.id)}?token=${encodeURIComponent(order.order_token)}`, {
      cache: 'no-store', signal: AbortSignal.timeout(15000)
    });
    trackingOk = response.ok;
    trackingDetail = `HTTP ${response.status}`;
  }

  const checks = [
    check('Evento Stripe LIVE', event.livemode === true, `${event.id} ${event.type}`),
    check('Webhook procesado', eventLog?.status === 'processed', eventLog?.status || 'sin registro'),
    check('Pedido persistido', Boolean(order), orderId),
    check('Pago autorizado/cobrado', confirmedPayments.includes(order?.payment_status), order?.payment_status || 'sin pedido'),
    check('Visible segun filtro Admin', Boolean(order && (confirmedPayments.includes(order.payment_status) || order.stripe_payment_intent_id)), `${order?.status || '-'}/${order?.payment_status || '-'}`),
    check('Lineas de pedido persistidas', (order?.order_items?.length || 0) > 0, `${order?.order_items?.length || 0} lineas`),
    check('Seguimiento privado operativo', trackingOk, trackingDetail),
    check('Correo de confirmacion enviado', email?.status === 'sent', email?.status || 'sin registro')
  ];
  const passed = checks.filter(Boolean).length;
  console.log(`\nResultado: ${passed}/${checks.length} comprobaciones correctas para el pedido ${orderId}.`);
  if (passed !== checks.length) process.exit(1);
}

main().catch((error) => { console.error(`[FAIL] ${error.message}`); process.exit(1); });
