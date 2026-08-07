import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('.env.local');
if (!fs.existsSync(file)) {
  console.error('❌ No existe .env.local en la raíz del proyecto.');
  process.exit(1);
}

const env = Object.fromEntries(
  fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.trim().startsWith('#') && line.includes('='))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    })
);

const checks = [
  ['Supabase URL', /^https:\/\/.+\.supabase\.co$/.test(env.NEXT_PUBLIC_SUPABASE_URL || '')],
  ['Supabase anon key', Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY)],
  ['Supabase service role', Boolean(env.SUPABASE_SERVICE_ROLE_KEY)],
  ['Site URL production', env.NEXT_PUBLIC_SITE_URL === 'https://www.sohocambados.es'],
  ['Stripe secret LIVE', env.STRIPE_SECRET_KEY?.startsWith('sk_live_')],
  ['Stripe public LIVE', env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith('pk_live_')],
  ['Stripe LIVE obligatorio', env.STRIPE_REQUIRE_LIVE === 'true'],
  ['Stripe expected account', /^acct_/.test(env.STRIPE_EXPECTED_ACCOUNT_ID || '')],
  ['Stripe webhook LIVE', env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')],
  ['Gmail user', /@gmail\.com$/i.test(env.GMAIL_USER || '')],
  ['Gmail app password', (env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '').length === 16],
  ['Email remitente', Boolean(env.ORDER_EMAIL_FROM)],
  ['Email respuesta', Boolean(env.ORDER_EMAIL_REPLY_TO)],
];

for (const [name, ok] of checks) console.log(`${ok ? '✅' : '❌'} ${name}`);
if (!checks.every(([, ok]) => ok)) {
  console.error('\n❌ La configuración de producción no está completa. Corrige los puntos marcados antes de desplegar.');
  process.exit(1);
}
console.log('\n✅ Configuración de producción completa.');
