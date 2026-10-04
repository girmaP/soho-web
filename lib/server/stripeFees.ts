import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';

export async function getStripeFeeAmount(paymentIntentId: string): Promise<number | null> {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge.balance_transaction']
    });

    const charge = paymentIntent.latest_charge;
    if (!charge || typeof charge === 'string') return null;

    const balanceTransaction = (charge as Stripe.Charge).balance_transaction;
    if (!balanceTransaction || typeof balanceTransaction === 'string') return null;

    const transaction = balanceTransaction as Stripe.BalanceTransaction;
    if (transaction.currency !== 'eur') return null;

    return Number((transaction.fee / 100).toFixed(2));
  } catch (error: any) {
    console.error('stripe_fee_lookup_failed', {
      paymentIntentId,
      error: error?.message || 'Unknown error'
    });
    return null;
  }
}
