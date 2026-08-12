'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function CheckoutCancelContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get('order');
  const token = searchParams.get('token');
  const [busy, setBusy] = useState<'resume' | 'cancel' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    window.sessionStorage.removeItem('soho_checkout_attempt_id');
  }, []);

  async function act(action: 'resume' | 'cancel') {
    if (!orderId || !token || busy) return;
    setBusy(action);
    setError('');
    try {
      const response = await fetch('/api/checkout/pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, token, action })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'No se pudo completar la acción.');
      if (action === 'resume' && data?.url) window.location.assign(data.url);
      else {
        window.sessionStorage.removeItem('soho_checkout_attempt_id');
        router.replace('/checkout?cancelled=1');
      }
    } catch (caught: any) {
      setError(caught?.message || 'No se pudo completar la acción.');
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <section className="rounded-[2rem] bg-white p-8 text-center shadow-xl shadow-cyan-200/30">
        <p className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-100 text-3xl">!</p>
        <h1 className="mt-5 text-4xl font-black">¿Quieres cancelar el pedido?</h1>
        <p className="mx-auto mt-3 max-w-xl leading-7 text-neutral-600">Los datos de pago todavía no se han confirmado. SOHO no ha recibido el pedido y no se realizará ningún cobro mientras no completes la autorización en Stripe.</p>
        {error && <p role="alert" className="mt-5 rounded-2xl bg-red-50 p-4 font-semibold text-red-700">{error}</p>}
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <button type="button" disabled={!orderId || !token || Boolean(busy)} onClick={() => act('resume')} className="rounded-2xl bg-[#049ca5] px-5 py-4 font-black text-white disabled:opacity-50">{busy === 'resume' ? 'Abriendo pago…' : 'Seguir con el pago'}</button>
          <button type="button" disabled={!orderId || !token || Boolean(busy)} onClick={() => act('cancel')} className="rounded-2xl border border-red-200 bg-white px-5 py-4 font-black text-red-700 disabled:opacity-50">{busy === 'cancel' ? 'Cancelando…' : 'Cancelar pedido'}</button>
        </div>
      </section>
    </main>
  );
}

export default function CheckoutCancelPage() {
  return <Suspense fallback={<main className="mx-auto max-w-3xl px-4 py-12" />}><CheckoutCancelContent /></Suspense>;
}
