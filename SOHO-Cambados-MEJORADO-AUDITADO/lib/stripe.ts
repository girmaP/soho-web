import Stripe from 'stripe';

let stripeClient: Stripe | null = null;
let stripeValidation: Promise<void> | null = null;

function stripeSecretKey() {
  const value = process.env.STRIPE_SECRET_KEY?.trim();
  if (!value) throw new Error('Falta STRIPE_SECRET_KEY en variables de entorno.');
  if (!value.startsWith('sk_test_') && !value.startsWith('sk_live_')) {
    throw new Error('STRIPE_SECRET_KEY no tiene un formato válido.');
  }
  return value;
}

function getStripeClient(): Stripe {
  if (stripeClient) return stripeClient;
  stripeClient = new Stripe(stripeSecretKey());
  return stripeClient;
}

/**
 * Evita publicar o probar accidentalmente con la cuenta/modo equivocados.
 * La validación remota se ejecuta una sola vez por proceso de servidor.
 */
export async function assertStripeConfiguration() {
  if (stripeValidation) return stripeValidation;

  stripeValidation = (async () => {
    const key = stripeSecretKey();
    const requireLive = process.env.STRIPE_REQUIRE_LIVE === 'true' || process.env.VERCEL_ENV === 'production';
    if (requireLive && !key.startsWith('sk_live_')) {
      throw new Error('Stripe debe estar en modo LIVE para esta entrega. Revisa STRIPE_SECRET_KEY.');
    }

    const publicKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
    if (!publicKey) throw new Error('Falta NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.');
    if (requireLive && !publicKey.startsWith('pk_live_')) {
      throw new Error('La clave publicable de Stripe debe ser LIVE. Revisa NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.');
    }

    const expectedAccountId = process.env.STRIPE_EXPECTED_ACCOUNT_ID?.trim();
    if (expectedAccountId) {
      try {
        const response = await fetch('https://api.stripe.com/v1/account', {
          headers: { Authorization: `Bearer ${key}` },
          cache: 'no-store'
        });
        const account = await response.json() as { id?: string; error?: { message?: string } };
        if (!response.ok || !account.id) {
          throw new Error(account.error?.message || `Stripe respondió HTTP ${response.status}`);
        }
        if (account.id !== expectedAccountId) {
          throw new Error(`La clave de Stripe pertenece a otra cuenta (${account.id}). Se esperaba ${expectedAccountId}.`);
        }
      } catch (error: any) {
        if (String(error?.message || '').includes('pertenece a otra cuenta')) throw error;
        throw new Error(`No se pudo validar la cuenta LIVE de Stripe: ${error?.message || 'error desconocido'}`);
      }
    }
  })();

  try {
    await stripeValidation;
  } catch (error) {
    stripeValidation = null;
    throw error;
  }
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    if (prop === 'then' || prop === 'toJSON' || prop === Symbol.toStringTag || prop === Symbol.for('nodejs.util.inspect.custom')) return undefined;
    const client = getStripeClient() as any;
    const value = Reflect.get(client, prop, client);
    return typeof value === 'function' ? value.bind(client) : value;
  }
});
