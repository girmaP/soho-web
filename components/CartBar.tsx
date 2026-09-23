'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getCart } from '@/lib/cartStorage';
import { formatPrice } from '@/utils/formatPrice';

export function CartBar() {
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);

  function refresh() {
    const cart = getCart();
    setCount(cart.reduce((s, i) => s + i.quantity, 0));
    setTotal(cart.reduce((s, i) => s + i.quantity * i.price, 0));
  }

  useEffect(() => {
    refresh();
    window.addEventListener('soho-cart-updated', refresh);
    return () => window.removeEventListener('soho-cart-updated', refresh);
  }, []);

  if (!count) return null;
  return (
    <>
    <style jsx global>{`
      @keyframes soho-cart-pop { from { opacity:0; transform: translateY(18px) scale(.96); } to { opacity:1; transform: translateY(0) scale(1); } }
    `}</style>
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-xl animate-[soho-cart-pop_380ms_cubic-bezier(.2,.8,.2,1)_both] rounded-3xl bg-neutral-950/95 p-3 text-white shadow-2xl shadow-black/30 ring-1 ring-white/10 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(0,0,0,.32)]">
      <Link href="/checkout" className="flex items-center justify-between gap-4 rounded-2xl outline-none transition active:scale-[0.99] focus-visible:ring-4 focus-visible:ring-cyan-300">
        <span><b>{count}</b> productos</span>
        <span className="soho-shimmer rounded-2xl bg-white px-4 py-2 font-bold text-neutral-950">Finalizar · {formatPrice(total)}</span>
      </Link>
    </div>
    </>
  );
}
