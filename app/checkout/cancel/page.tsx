'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function CheckoutCancelContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order');
  const token = searchParams.get('token');
  const orderUrl = orderId && token ? `/pedido/${orderId}?token=${token}` : '/checkout';

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <section className="rounded-[2rem] bg-white p-8 text-center shadow-xl shadow-cyan-200/30">
        <p className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-cyan-100 text-3xl">!</p>
        <h1 className="mt-5 text-4xl font-black">Pago cancelado</h1>
        <p className="mt-3 text-neutral-600">No se ha confirmado el pago. Puedes volver al checkout para intentarlo de nuevo.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/checkout" className="rounded-2xl bg-[#049ca5] px-5 py-4 font-black text-white">Intentar de nuevo</Link>
          <Link href={orderUrl} className="rounded-2xl border bg-white px-5 py-4 font-bold">Ver pedido pendiente</Link>
        </div>
      </section>
    </main>
  );
}

export default function CheckoutCancelPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-3xl px-4 py-12" />}>
      <CheckoutCancelContent />
    </Suspense>
  );
}
