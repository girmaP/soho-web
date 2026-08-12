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
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-xl rounded-3xl bg-neutral-950 p-3 text-white shadow-xl shadow-black/25 transition duration-200">
      <Link href="/checkout" className="flex items-center justify-between gap-4 rounded-2xl outline-none transition active:scale-[0.99] focus-visible:ring-4 focus-visible:ring-cyan-300">
        <span><b>{count}</b> productos</span>
        <span className="rounded-2xl bg-white px-4 py-2 font-bold text-neutral-950">Finalizar · {formatPrice(total)}</span>
      </Link>
    </div>
  );
}
