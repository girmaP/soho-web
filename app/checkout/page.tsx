'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { Building2, Check, Truck } from 'lucide-react';
import { getCart, saveCart } from '@/lib/cartStorage';
import { CartItem } from '@/types/cart';
import { formatPrice } from '@/utils/formatPrice';
import { BusinessSettings, businessHoursLabelFromSettings, defaultBusinessSettings, getBusinessSettings, isBusinessOpenFromSettings } from '@/lib/businessConfig';
import { customizationLabel } from '@/lib/productCustomization';
import { siteConfig } from '@/lib/siteConfig';

type OrderMethod = 'pickup' | 'delivery';

const CHECKOUT_ATTEMPT_KEY = 'soho_checkout_attempt_id';

function getCheckoutAttemptId() {
  const key = CHECKOUT_ATTEMPT_KEY;
  const current = window.sessionStorage.getItem(key);
  if (current) return current;
  const next = crypto.randomUUID();
  window.sessionStorage.setItem(key, next);
  return next;
}

function renewCheckoutAttemptId() {
  const next = crypto.randomUUID();
  window.sessionStorage.setItem(CHECKOUT_ATTEMPT_KEY, next);
  return next;
}

export default function CheckoutPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [method, setMethod] = useState<OrderMethod>('pickup');
  const [settings, setSettings] = useState<BusinessSettings>(defaultBusinessSettings);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const openNow = isBusinessOpenFromSettings(settings);

  useEffect(() => {
    setCart(getCart());
    getBusinessSettings().then((data) => {
      setSettings(data);
      setSettingsLoaded(true);
    });
  }, []);

  function updateQuantity(id: string, quantity: number) {
    const next = cart.map((item) => item.line_id === id ? { ...item, quantity } : item).filter((item) => item.quantity > 0);
    setCart(next);
    saveCart(next);
  }

  async function submit(formData: FormData) {
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      if (!openNow) throw new Error('Ahora mismo SOHO no acepta pedidos online. Puedes volver dentro del horario indicado.');
      if (!cart.length) throw new Error('El carrito está vacío.');

      const payload = {
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
      };

      async function createSession(checkoutAttemptId: string, mayRenew: boolean): Promise<any> {
        const response = await fetch('/api/stripe/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, checkoutAttemptId })
        });
        const data = await response.json().catch(() => null);

        if (
          response.status === 409 &&
          mayRenew &&
          (data?.code === 'CHECKOUT_ATTEMPT_RENEWABLE' || data?.code === 'CHECKOUT_ATTEMPT_COMPLETED')
        ) {
          return createSession(renewCheckoutAttemptId(), false);
        }
        if (!response.ok || !data?.url) throw new Error(data?.error || 'No se pudo iniciar el pago online.');
        return data;
      }

      const data = await createSession(getCheckoutAttemptId(), true);
      window.location.assign(data.url);
    } catch (caught: any) {
      setError(caught?.message || 'No se pudo iniciar el pago online.');
      setLoading(false);
    }
  }

  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:py-10">
      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="min-w-0">
          <h1 className="text-4xl font-black tracking-tight text-neutral-950 sm:text-5xl">Finalizar pedido</h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-neutral-600 sm:text-base">
            Elige si quieres recoger tu pedido en SOHO o pedir a domicilio a través de Caylu.
          </p>

          <div className={`mt-5 rounded-3xl p-4 text-sm font-bold ${openNow ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
            {openNow ? 'Pedidos online abiertos. ' : 'Pedidos online cerrados. '}{businessHoursLabelFromSettings(settings)}
          </div>

          <fieldset className="mt-7">
            <legend className="mb-3 text-sm font-black text-neutral-900">Método de pedido</legend>
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Método de pedido">
              <button type="button" role="radio" aria-checked={method === 'pickup'} onClick={() => { setMethod('pickup'); setError(''); }} className={`relative flex min-h-28 items-center gap-4 rounded-3xl border-2 p-5 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200 ${method === 'pickup' ? 'border-neutral-950 bg-neutral-950 text-white shadow-lg' : 'border-black/10 bg-white text-neutral-950 hover:border-[#049ca5]'}`}>
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${method === 'pickup' ? 'bg-white/10' : 'bg-cyan-50 text-[#047f86]'}`}><Building2 aria-hidden="true" /></span>
                <span><strong className="block text-base">Recoger en SOHO</strong><span className={`mt-1 block text-sm ${method === 'pickup' ? 'text-white/70' : 'text-neutral-500'}`}>Recoge tu pedido directamente en SOHO.</span></span>
                <span className={`absolute right-4 top-4 grid h-6 w-6 place-items-center rounded-full border-2 ${method === 'pickup' ? 'border-[#ff4d00] bg-[#ff4d00] text-white' : 'border-neutral-300'}`}>{method === 'pickup' && <Check size={14} strokeWidth={4} />}</span>
              </button>

              <button type="button" role="radio" aria-checked={method === 'delivery'} onClick={() => { setMethod('delivery'); setError(''); }} className={`relative flex min-h-28 items-center gap-4 rounded-3xl border-2 p-5 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 ${method === 'delivery' ? 'border-[#ff4d00] bg-[#ff4d00] text-white shadow-lg' : 'border-black/10 bg-white text-neutral-950 hover:border-[#ff4d00]'}`}>
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${method === 'delivery' ? 'bg-white/15' : 'bg-orange-50 text-[#e84600]'}`}><Truck aria-hidden="true" /></span>
                <span><strong className="block text-base">Delivery con Caylu</strong><span className={`mt-1 block text-sm ${method === 'delivery' ? 'text-white/80' : 'text-neutral-500'}`}>Abre el perfil oficial en Caylu.</span></span>
                <span className={`absolute right-4 top-4 grid h-6 w-6 place-items-center rounded-full border-2 ${method === 'delivery' ? 'border-white bg-white text-[#ff4d00]' : 'border-neutral-300'}`}>{method === 'delivery' && <Check size={14} strokeWidth={4} />}</span>
              </button>
            </div>
          </fieldset>

          {method === 'pickup' ? (
            <form onSubmit={async (event) => { event.preventDefault(); await submit(new FormData(event.currentTarget)); }} className="mt-5 grid gap-4 rounded-[2rem] border border-black/5 bg-white p-5 shadow-sm sm:p-6">
              <input name="website" className="hidden" tabIndex={-1} autoComplete="off" />
              <div className="rounded-3xl bg-cyan-50 p-4 text-sm leading-6 text-[#02565b]">
                <strong className="block text-base">Pago online seguro</strong>
                Al completar el pago, tu pedido aparecerá como aceptado. A los 2 minutos pasará a preparación y estará listo aproximadamente en {settings.default_wait_minutes} minutos desde el pago.
              </div>
              <label className="grid gap-1.5 font-bold">Nombre<input name="customerName" required minLength={2} autoComplete="name" className="min-h-12 rounded-2xl border border-black/15 px-4 font-normal outline-none focus:border-[#049ca5] focus:ring-4 focus:ring-cyan-100" placeholder="Tu nombre" /></label>
              <label className="grid gap-1.5 font-bold">Teléfono<input name="customerPhone" required inputMode="tel" autoComplete="tel" pattern="[0-9+() .-]{6,30}" className="min-h-12 rounded-2xl border border-black/15 px-4 font-normal outline-none focus:border-[#049ca5] focus:ring-4 focus:ring-cyan-100" placeholder="600 000 000" /></label>
              <label className="grid gap-1.5 font-bold">Correo electrónico<input name="customerEmail" type="email" required autoComplete="email" className="min-h-12 rounded-2xl border border-black/15 px-4 font-normal outline-none focus:border-[#049ca5] focus:ring-4 focus:ring-cyan-100" placeholder="tu@email.com" /></label>
              <label className="grid gap-1.5 font-bold">Notas u observaciones<textarea name="notes" maxLength={500} className="min-h-28 rounded-2xl border border-black/15 p-4 font-normal outline-none focus:border-[#049ca5] focus:ring-4 focus:ring-cyan-100" placeholder="Sin cebolla, poco hecho, sin salsa..." /></label>
              <label className="flex items-start gap-3 rounded-2xl p-1 text-sm leading-5"><input name="privacy" type="checkbox" required className="mt-0.5 h-5 w-5 shrink-0 accent-[#049ca5]" /><span>Acepto que SOHO use mis datos únicamente para gestionar este pedido y sus comunicaciones.</span></label>
              {error && <p role="alert" className="rounded-2xl bg-red-50 p-4 font-semibold text-red-700">{error}</p>}
              <button type="submit" disabled={loading || !settingsLoaded || !cart.length || !openNow} className="min-h-14 rounded-2xl bg-[#049ca5] px-5 font-black text-white transition hover:bg-[#03868e] disabled:cursor-not-allowed disabled:opacity-50">
                {loading ? 'Preparando el pago seguro…' : 'Continuar al pago'}
              </button>
            </form>
          ) : (
            <div className="mt-5 grid gap-4">
              <div className="rounded-[2rem] border border-orange-200 bg-orange-50 p-6">
                <h2 className="text-xl font-black text-neutral-950">Entrega a domicilio mediante Caylu</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-neutral-700">Los pedidos a domicilio se gestionan mediante Caylu. Al continuar, serás dirigido al perfil oficial de Soho en Caylu para completar allí el pedido.</p>
                <a href={siteConfig.cayluUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border border-[#ff4d00] bg-white px-5 text-sm font-black text-[#e84600]">Abrir Caylu ahora</a>
              </div>
              <a href={siteConfig.cayluUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-14 items-center justify-center rounded-2xl bg-[#ff4d00] px-5 text-center font-black text-white hover:bg-[#df4300]">Pedir a domicilio con Caylu</a>
            </div>
          )}
        </section>

        <aside className="h-fit min-w-0 rounded-[2rem] border border-black/5 bg-white p-5 shadow-sm lg:sticky lg:top-24">
          <div className="flex items-center gap-2"><h2 className="text-2xl font-black">Tu carrito</h2><span className="grid h-6 min-w-6 place-items-center rounded-full bg-[#ff4d00] px-1 text-xs font-black text-white">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span></div>
          <div className="mt-4 grid gap-3">
            {cart.map((item) => (
              <div key={item.line_id} className="rounded-2xl bg-neutral-50 p-3">
                <div className="flex min-w-0 gap-3">
                  {item.image_url ? <img src={item.image_url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" /> : <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-neutral-200 text-xs font-bold text-neutral-500">SOHO</div>}
                  <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><b className="break-words text-sm leading-5">{item.name}</b><span className="shrink-0 text-sm font-black">{formatPrice(item.price * item.quantity)}</span></div><p className="mt-1 text-xs text-neutral-500">{formatPrice(item.price)} / ud.</p>{customizationLabel(item.required_choice, item.selected_extras || []) && <p className="mt-1 break-words text-xs font-semibold leading-5 text-[#036b71]">{customizationLabel(item.required_choice, item.selected_extras || [])}</p>}</div>
                </div>
                <div className="mt-3 flex items-center gap-2 pl-0 sm:pl-[76px]"><button type="button" aria-label={`Reducir ${item.name}`} onClick={() => updateQuantity(item.line_id, item.quantity - 1)} className="grid h-9 w-9 place-items-center rounded-xl border bg-white">−</button><span className="min-w-6 text-center font-bold">{item.quantity}</span><button type="button" aria-label={`Aumentar ${item.name}`} onClick={() => updateQuantity(item.line_id, item.quantity + 1)} className="grid h-9 w-9 place-items-center rounded-xl border bg-white">+</button></div>
              </div>
            ))}
            {!cart.length && <p className="rounded-2xl bg-neutral-50 p-4 text-sm font-semibold text-neutral-600">El carrito está vacío.</p>}
          </div>
          <div className="mt-5 flex justify-between border-t pt-5 text-xl"><b>Total</b><b>{formatPrice(total)}</b></div>
          <p className="mt-3 text-xs leading-5 text-neutral-500">En recogida, Stripe confirma el pago y los estados avanzan automáticamente hasta «Listo». La entrega se marca manualmente. En delivery, el pedido y el pago se gestionan directamente en Caylu.</p>
        </aside>
      </div>
    </main>
  );
}
