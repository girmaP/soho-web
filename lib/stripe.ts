import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (stripeClient) return stripeClient;
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!stripeSecretKey) throw new Error('Falta STRIPE_SECRET_KEY en variables de entorno.');
  if (!stripeSecretKey.startsWith('sk_test_') && !stripeSecretKey.startsWith('sk_live_')) throw new Error('STRIPE_SECRET_KEY no tiene un formato válido.');
  stripeClient = new Stripe(stripeSecretKey);
  return stripeClient;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    if (prop === 'then' || prop === 'toJSON' || prop === Symbol.toStringTag || prop === Symbol.for('nodejs.util.inspect.custom')) return undefined;
    const client = getStripeClient() as any;
    const value = Reflect.get(client, prop, client);
    return typeof value === 'function' ? value.bind(client) : value;
  }
});
