'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { getCart, saveCart } from '@/lib/cartStorage';
import { CartItem } from '@/types/cart';
import { formatPrice } from '@/utils/formatPrice';
import { BusinessSettings, businessHoursLabelFromSettings, defaultBusinessSettings, getBusinessSettings, isBusinessOpenFromSettings } from '@/lib/businessConfig';
import { customizationLabel } from '@/lib/productCustomization';

export default function CheckoutPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [settings, setSettings] = useState<BusinessSettings>(defaultBusinessSettings);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const openNow = isBusinessOpenFromSettings(settings);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setCart(getCart());
    getBusinessSettings().then((data) => {
      setSettings(data);
      setSettingsLoaded(true);
    });
  }, []);

  function updateQuantity(id: string, quantity: number) {
    const next = cart
      .map((i) => (i.line_id === id ? { ...i, quantity } : i))
      .filter((i) => i.quantity > 0);
    setCart(next);
    saveCart(next);
  }

  async function submit(formData: FormData) {
    setError('');
    setLoading(true);

    try {
      if (!openNow) throw new Error('Ahora mismo SOHO no acepta pedidos online. Puedes volver dentro del horario indicado.');

      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: String(formData.get('customerName') || ''),
          customerPhone: String(formData.get('customerPhone') || ''),
          customerEmail: String(formData.get('customerEmail') || ''),
          notes: String(formData.get('notes') || ''),
          privacyAccepted: formData.get('privacy') === 'on',
          honeypot: String(formData.get('website') || ''),
          items: cart.map((item) => ({
            line_id: item.line_id,
            product_id: item.product_id,
            quantity: item.quantity,
            required_choice: item.required_choice || null,
            selected_extras: item.selected_extras || []
          }))
        })
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.url) {
        throw new Error(data?.error || 'No se pudo iniciar el pago online.');
      }

      window.location.href = data.url;
    } catch (e: any) {
      setError(e.message || 'No se pudo iniciar el pago online.');
      setLoading(false);
    }
  }

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-[1fr_420px]">
      <section>
        <h1 className="text-4xl font-black">Finalizar pedido</h1>
        <p className="mt-2 text-neutral-600">
          Completa tus datos y autoriza el pago de forma segura. SOHO solo realizará el cobro cuando empiece a preparar tu pedido.
        </p>
        <div className={`mt-4 rounded-3xl p-4 text-sm font-bold ${openNow ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {openNow ? 'Pedidos online abiertos. ' : 'Pedidos online cerrados. '}
          {businessHoursLabelFromSettings(settings)}
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await submit(new FormData(e.currentTarget));
          }}
          className="mt-6 grid gap-4 rounded-3xl bg-white p-5 shadow-sm"
        >
          <input name="website" className="hidden" tabIndex={-1} autoComplete="off" />

          <div className="rounded-3xl bg-cyan-50 p-4 text-sm text-[#02565b]">
            <strong className="block text-base">Pago online seguro</strong>
            <p className="mt-1">Stripe realizará una autorización temporal. Si SOHO rechaza el pedido antes de prepararlo, la autorización se liberará sin cobrarte.</p>
          </div>

          <label className="grid gap-1 font-bold">
            Nombre
            <input name="customerName" className="rounded-2xl border p-3 font-normal" placeholder="Tu nombre" />
          </label>
          <label className="grid gap-1 font-bold">
            Teléfono
            <input name="customerPhone" className="rounded-2xl border p-3 font-normal" placeholder="600 000 000" />
          </label>
          <label className="grid gap-1 font-bold">
            Correo electrónico
            <input name="customerEmail" type="email" required className="rounded-2xl border p-3 font-normal" placeholder="tu@email.com" />
          </label>
          <label className="grid gap-1 font-bold">
            Notas
            <textarea name="notes" className="min-h-24 rounded-2xl border p-3 font-normal" placeholder="Sin cebolla, poco hecho, sin salsa..." />
          </label>
          <label className="flex gap-3 text-sm">
            <input name="privacy" type="checkbox" />
            Acepto que SOHO use mis datos solo para gestionar este pedido.
          </label>

          {error && <p className="rounded-2xl bg-red-50 p-3 text-red-700">{error}</p>}

          <button disabled={loading || !settingsLoaded || !cart.length || !openNow} className="rounded-2xl bg-[#049ca5] p-4 font-black text-white disabled:opacity-50">
            {loading ? 'Abriendo autorización segura...' : 'Confirmar pedido y autorizar pago'}
          </button>
        </form>
      </section>

      <aside className="h-fit rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-black">Tu carrito</h2>
        <div className="mt-4 grid gap-3">
          {cart.map((item) => (
            <div key={item.line_id} className="rounded-2xl bg-neutral-50 p-3">
              <div className="flex gap-3">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="h-16 w-16 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-neutral-200 text-xs font-bold text-neutral-500">SOHO</div>
                )}
                <div className="flex flex-1 justify-between gap-4">
                  <div>
                    <b>{item.name}</b>
                    <p className="text-sm text-neutral-500">{formatPrice(item.price)} / ud.</p>
                    {customizationLabel(item.required_choice, item.selected_extras || []) && (
                      <p className="mt-1 text-xs font-semibold leading-5 text-[#036b71]">{customizationLabel(item.required_choice, item.selected_extras || [])}</p>
                    )}
                  </div>
                  <span className="font-bold">{formatPrice(item.price * item.quantity)}</span>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 pl-[76px]">
                <button type="button" onClick={() => updateQuantity(item.line_id, item.quantity - 1)} className="rounded-lg border px-3">-</button>
                <span>{item.quantity}</span>
                <button type="button" onClick={() => updateQuantity(item.line_id, item.quantity + 1)} className="rounded-lg border px-3">+</button>
              </div>
            </div>
          ))}
          {!cart.length && <p>El carrito está vacío.</p>}
        </div>
        <div className="mt-5 flex justify-between text-xl">
          <b>Total</b>
          <b>{formatPrice(total)}</b>
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          Stripe autorizará el importe. El cobro se realizará únicamente cuando SOHO marque el pedido como “En preparación”.
        </p>
      </aside>
    </main>
  );
}
