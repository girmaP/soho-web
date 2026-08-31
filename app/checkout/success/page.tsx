'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { clearCart } from '@/lib/cartStorage';

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [confirmationDelayed, setConfirmationDelayed] = useState(false);
  const orderId = searchParams.get('order');
  const token = searchParams.get('token');
  const orderUrl = orderId && token ? `/pedido/${orderId}?token=${token}` : '/menu';

  useEffect(() => {
    clearCart();
    window.sessionStorage.removeItem('soho_checkout_attempt_id');
    if (!orderId || !token) return;
    let cancelled = false;
    fetch('/api/checkout/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, token })
    }).then(async (response) => {
      const result = await response.json().catch(() => null);
      if (cancelled) return;
      if (response.ok && result?.confirmed) router.replace(orderUrl);
      else setConfirmationDelayed(true);
    }).catch(() => !cancelled && setConfirmationDelayed(true));
    return () => { cancelled = true; };
  }, [orderId, token, orderUrl, router]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <section className="rounded-[2rem] bg-white p-8 text-center shadow-xl shadow-cyan-200/30">
        <p className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-100 text-3xl">✓</p>
        <h1 className="mt-5 text-4xl font-black">Confirmando tu pedido</h1>
        <p className="mt-3 text-neutral-600">Stripe está confirmando el pago. En cuanto termine, el pedido aparecerá como aceptado y sus estados avanzarán automáticamente.</p>
        {confirmationDelayed && <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">La confirmación está tardando más de lo habitual. Pulsa «Ver estado del pedido»: el seguimiento comprobará el pago de nuevo sin volver a cobrarte.</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href={orderUrl} className="rounded-2xl bg-neutral-950 px-5 py-4 font-black text-white">Ver estado del pedido</Link>
          <Link href="/menu" className="rounded-2xl border bg-white px-5 py-4 font-bold">Volver a la carta</Link>
        </div>
      </section>
    </main>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-3xl px-4 py-12" />}>
      <CheckoutSuccessContent />
    </Suspense>
  );
}
