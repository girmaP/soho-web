import fs from 'node:fs';
import path from 'node:path';
import tls from 'node:tls';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const file = path.resolve('.env.local');
const results = [];
let failures = 0;

function result(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  console.log(`${ok ? '[OK]' : '[FAIL]'} ${name}${detail ? ` - ${detail}` : ''}`);
}

function loadEnv() {
  if (!fs.existsSync(file)) throw new Error('No existe .env.local en la raiz del proyecto.');
  return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/)
    .filter((line) => line && !line.trim().startsWith('#') && line.includes('='))
    .map((line) => {
      const i = line.indexOf('=');
      let value = line.slice(i + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      return [line.slice(0, i).trim(), value];
    }));
}

function jwtPayload(key) {
  try {
    const part = key.split('.')[1];
    return part ? JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) : null;
  } catch { return null; }
}

async function smtpAuth(user, password) {
  await new Promise((resolve, reject) => {
    const socket = tls.connect({ host: 'smtp.gmail.com', port: 465, servername: 'smtp.gmail.com', rejectUnauthorized: true });
    let buffer = '';
    let settled = false;
    const timeout = setTimeout(() => finish(new Error('timeout SMTP')), 15000);
    function finish(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try { socket.end(); } catch {}
      if (error) reject(error);
      else resolve();
    }
    function read() {
      return new Promise((res, rej) => {
        const onData = (chunk) => {
          buffer += chunk.toString('utf8');
          const lines = buffer.split('\r\n');
          for (let i = 0; i < lines.length - 1; i += 1) {
            if (/^\d{3} /.test(lines[i])) {
              const response = lines.slice(0, i + 1).join('\r\n');
              buffer = lines.slice(i + 1).join('\r\n');
              socket.off('data', onData);
              return res(response);
            }
          }
        };
        socket.on('data', onData);
        socket.once('error', rej);
      });
    }
    async function command(value, expected) {
      socket.write(`${value}\r\n`);
      const response = await read();
      if (!expected.includes(Number(response.slice(0, 3)))) throw new Error(`SMTP ${response.slice(0, 80)}`);
    }
    socket.once('error', finish);
    socket.once('secureConnect', async () => {
      try {
        const greeting = await read();
        if (Number(greeting.slice(0, 3)) !== 220) throw new Error('saludo SMTP invalido');
        await command('EHLO soho-preflight.local', [250]);
        await command('AUTH LOGIN', [334]);
        await command(Buffer.from(user).toString('base64'), [334]);
        await command(Buffer.from(password.replace(/\s+/g, '')).toString('base64'), [235]);
        await command('QUIT', [221]);
        finish();
      } catch (error) { finish(error); }
    });
  });
}

async function main() {
  let env;
  try { env = loadEnv(); result('.env.local legible', true); }
  catch (error) { result('.env.local legible', false, error.message); process.exit(1); }

  const required = ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','NEXT_PUBLIC_SITE_URL','STRIPE_SECRET_KEY','NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY','STRIPE_REQUIRE_LIVE','STRIPE_EXPECTED_ACCOUNT_ID','STRIPE_WEBHOOK_SECRET','GMAIL_USER','GMAIL_APP_PASSWORD','ORDER_EMAIL_FROM'];
  const missing = required.filter((name) => !env[name]);
  result('Variables obligatorias', missing.length === 0, missing.length ? `faltan: ${missing.join(', ')}` : 'completas');

  const siteUrl = (env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
  result('URL de produccion', siteUrl === 'https://www.sohocambados.es', siteUrl || 'vacia');
  result('Stripe configurado como obligatorio LIVE', env.STRIPE_REQUIRE_LIVE === 'true');
  result('Claves Stripe con prefijo LIVE', env.STRIPE_SECRET_KEY?.startsWith('sk_live_') && env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith('pk_live_'));
  result('Webhook secret configurado', env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_'));

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || '';
  const projectRef = (() => { try { return new URL(supabaseUrl).hostname.split('.')[0]; } catch { return ''; } })();
  result('URL Supabase valida', /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl), projectRef || 'invalida');
  const anonPayload = jwtPayload(env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');
  const servicePayload = jwtPayload(env.SUPABASE_SERVICE_ROLE_KEY || '');
  const jwtRefs = [anonPayload?.ref, servicePayload?.ref].filter(Boolean);
  const jwtIssuers = [anonPayload?.iss, servicePayload?.iss].filter(Boolean);
  result('Anon y service role pertenecen al proyecto', jwtRefs.length
    ? jwtRefs.every((ref) => ref === projectRef) && jwtIssuers.every((iss) => String(iss).includes(projectRef))
    : true, jwtRefs.length ? `project ref ${projectRef}` : 'claves opacas: se validan mediante peticiones reales');

  if (supabaseUrl && env.NEXT_PUBLIC_SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY) {
    const anon = createClient(supabaseUrl, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const admin = createClient(supabaseUrl, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const anonRead = await anon.from('business_settings').select('id').eq('id', 'main').maybeSingle();
    result('Conexion y lectura con anon key', !anonRead.error, anonRead.error?.message || 'business_settings/main accesible');
    const adminRead = await admin.from('orders').select('id').limit(1);
    result('Conexion con service role', !adminRead.error, adminRead.error?.message || 'orders accesible');
    const schema = await admin.rpc('production_preflight');
    result('Esquema, columnas, escritura y RPC Supabase', !schema.error && schema.data?.ok === true,
      schema.error?.message || (schema.data?.missing?.length ? `faltan: ${schema.data.missing.join(', ')}` : 'esquema completo; escritura temporal revertida'));
  }

  if (env.STRIPE_SECRET_KEY) {
    try {
      const stripe = new Stripe(env.STRIPE_SECRET_KEY);
      const [account, balance] = await Promise.all([stripe.accounts.retrieve(), stripe.balance.retrieve()]);
      result('Conexion real con Stripe', Boolean(account.id), account.id);
      result('Cuenta Stripe esperada', account.id === env.STRIPE_EXPECTED_ACCOUNT_ID, `obtenida ${account.id}; esperada ${env.STRIPE_EXPECTED_ACCOUNT_ID || 'vacia'}`);
      result('Stripe realmente LIVE', balance.livemode === true && env.STRIPE_SECRET_KEY.startsWith('sk_live_'), `balance.livemode=${balance.livemode}`);

      const candidates = [];
      for (const type of ['checkout.session.completed', 'payment_intent.amount_capturable_updated']) {
        const events = await stripe.events.list({ type, limit: 25 });
        for (const event of events.data) {
          const object = event.data.object;
          const orderId = object.metadata?.order_id;
          const paymentIntentId = event.type === 'checkout.session.completed'
            ? (typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id)
            : object.id;
          if (orderId) candidates.push({ id: event.id, type: event.type, created: new Date(event.created * 1000).toISOString(), orderId, paymentIntentId, livemode: event.livemode });
        }
      }
      console.log('\nCANDIDATOS DE REENVIO (solo lectura; no se ha reenviado nada):');
      if (!candidates.length) console.log('- Ningun evento reciente con metadata.order_id en los ultimos 25 de cada tipo.');
      let orderMap = new Map();
      let logMap = new Map();
      const intentMap = new Map();
      const intentIds = [...new Set(candidates.map((candidate) => candidate.paymentIntentId).filter(Boolean))];
      const intents = await Promise.all(intentIds.map(async (id) => {
        try { return await stripe.paymentIntents.retrieve(id); }
        catch { return null; }
      }));
      for (const intent of intents) if (intent) intentMap.set(intent.id, intent);
      if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && candidates.length) {
        const diagnosticAdmin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
        const orderIds = [...new Set(candidates.map((candidate) => candidate.orderId))];
        const eventIds = candidates.map((candidate) => candidate.id);
        const [{ data: orders }, { data: eventLogs }] = await Promise.all([
          diagnosticAdmin.from('orders').select('id,status,payment_status,total_price,stripe_payment_intent_id').in('id', orderIds),
          diagnosticAdmin.from('stripe_webhook_events').select('event_id,status').in('event_id', eventIds)
        ]);
        orderMap = new Map((orders || []).map((order) => [order.id, order]));
        logMap = new Map((eventLogs || []).map((eventLog) => [eventLog.event_id, eventLog.status]));
      }
      const sortedCandidates = candidates.sort((a,b) => b.created.localeCompare(a.created));
      for (const candidate of sortedCandidates) {
        const order = orderMap.get(candidate.orderId);
        const intent = intentMap.get(candidate.paymentIntentId);
        const amountMatches = Boolean(intent && order && intent.currency === 'eur' && intent.amount === Math.round(Number(order.total_price) * 100));
        console.log(`- ${candidate.id} | ${candidate.type} | ${candidate.created} | order ${candidate.orderId} | live=${candidate.livemode} | webhook=${logMap.get(candidate.id) || 'sin-registro'} | pedido=${order?.status || 'no-encontrado'}/${order?.payment_status || '-'} | intent=${intent?.status || 'no-encontrado'} | importe=${amountMatches ? 'coincide' : 'NO-COINCIDE'}`);
      }
      const recommended = sortedCandidates.find((candidate) => {
        const order = orderMap.get(candidate.orderId);
        const intent = intentMap.get(candidate.paymentIntentId);
        return candidate.livemode && logMap.get(candidate.id) === 'failed' && order && ['pending','failed'].includes(order.payment_status)
          && intent?.status === 'requires_capture' && intent.currency === 'eur' && intent.amount === Math.round(Number(order.total_price) * 100);
      }) || sortedCandidates.find((candidate) => {
        const order = orderMap.get(candidate.orderId);
        const intent = intentMap.get(candidate.paymentIntentId);
        return candidate.livemode && order && ['pending','failed'].includes(order.payment_status)
          && intent?.status === 'requires_capture' && intent.currency === 'eur' && intent.amount === Math.round(Number(order.total_price) * 100);
      });
      if (recommended) console.log(`\nEVENTO RECOMENDADO PARA REENVIAR DESPUES DE CORREGIR LOS FAIL: ${recommended.id} (${recommended.type}), pedido ${recommended.orderId}`);
      else console.log('\nNo hay un evento fallido pendiente que sea seguro recomendar automaticamente.');
    } catch (error) { result('Conexion real con Stripe', false, error.message); }
  }

  if (env.GMAIL_USER && env.GMAIL_APP_PASSWORD) {
    try { await smtpAuth(env.GMAIL_USER, env.GMAIL_APP_PASSWORD); result('Conexion y autenticacion SMTP Gmail', true, 'AUTH correcto; no se envio correo'); }
    catch (error) { result('Conexion y autenticacion SMTP Gmail', false, error.message); }
  }

  if (siteUrl) {
    try {
      const response = await fetch(siteUrl, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
      result('Sitio de produccion accesible', response.ok && new URL(response.url).hostname === 'www.sohocambados.es', `HTTP ${response.status} ${response.url}`);
      const webhook = await fetch(`${siteUrl}/api/stripe/webhook`, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(15000) });
      result('Ruta webhook desplegada', [400,405].includes(webhook.status), `HTTP ${webhook.status}`);
    } catch (error) { result('Sitio de produccion accesible', false, error.message); }
  }

  console.log(`\nResultado: ${results.length - failures}/${results.length} comprobaciones correctas.`);
  if (failures) process.exit(1);
}

main().catch((error) => { console.error('[FAIL] Preflight inesperado:', error.message); process.exit(1); });
