'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Clock3, ListOrdered, MapPin, Navigation, Phone, Send, UserRound } from 'lucide-react';
import { siteConfig } from '@/lib/siteConfig';
const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=A%20Mari%C3%B1a%203%2C%20Cambados';

export default function HomePage() {
  const [contact, setContact] = useState({ name: '', email: '', phone: '', message: '' });
  const [contactStatus, setContactStatus] = useState('');
  const [sending, setSending] = useState(false);

  async function submitContact(e: React.FormEvent) {
    e.preventDefault();
    setContactStatus('');
    if (!contact.name.trim() || !contact.email.trim() || !contact.phone.trim() || !contact.message.trim()) {
      setContactStatus('Completa nombre, correo, teléfono y mensaje.');
      return;
    }
    setSending(true);
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contact.name.trim(),
          email: contact.email.trim(),
          phone: contact.phone.trim(),
          message: contact.message.trim()
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'No se pudo enviar el mensaje.');
      setContact({ name: '', email: '', phone: '', message: '' });
      setContactStatus('Mensaje enviado. Te responderemos lo antes posible.');
    } catch (error: any) {
      setContactStatus(error.message || 'No se pudo enviar el mensaje. Inténtalo de nuevo.');
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="bg-[#f8f4ee]">
      <section className="relative min-h-[calc(100vh-68px)] overflow-hidden bg-neutral-950">
        <Image
          src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=1800&auto=format&fit=crop"
          alt="Hamburguesa SOHO Cambados"
          fill
          priority
          className="object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/25" />
        <div className="relative mx-auto flex min-h-[calc(100vh-68px)] max-w-7xl items-center px-4 py-16">
          <div className="max-w-4xl">
            <h1 className="max-w-4xl text-5xl font-black leading-[0.95] tracking-tight text-white md:text-7xl lg:text-8xl">
              Pide en SOHO en un clic.
            </h1>
            <p className="mt-7 max-w-2xl text-lg font-semibold leading-8 text-white/90 md:text-xl">
              Consulta la carta, prepara tu pedido para recoger y sigue el estado en tiempo real. Para domicilio, accede directamente al perfil de SOHO en Caylu.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/menu" className="rounded-2xl bg-white px-7 py-4 font-black text-neutral-950 shadow-xl transition hover:-translate-y-0.5 hover:bg-cyan-50">
                Pedir para recoger
              </Link>
              <a
                href={siteConfig.cayluUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl bg-[#049ca5] px-7 py-4 font-black text-white shadow-xl shadow-cyan-950/25 transition hover:-translate-y-0.5 hover:bg-[#037f86]"
              >
                Pedir a domicilio con Caylu
              </a>
            </div>

            <div className="mt-8 grid max-w-4xl gap-0 overflow-hidden rounded-[2rem] border border-white/20 bg-black/20 p-4 shadow-2xl backdrop-blur md:grid-cols-2">
              <div className="rounded-[1.5rem] p-5 text-white">
                <strong className="text-lg">Recogida en local</strong>
                <p className="mt-2 text-sm font-medium leading-6 text-white/80">
                  Envía tu pedido, espera la confirmación y recoge cuando SOHO marque el tiempo estimado.
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-[#049ca5]/35 p-5 text-white shadow-inner ring-1 ring-cyan-200/10">
                <strong className="text-lg">Delivery con Caylu</strong>
                <p className="mt-2 text-sm font-medium leading-6 text-white/85">
                  Si quieres reparto a domicilio, te llevamos al canal de delivery que usa el establecimiento.
                </p>
              </div>
            </div>

            <p className="mt-5 text-sm font-semibold text-white/75">
              Recogida en Calle A Mariña, 3, Cambados. Pago online seguro con tarjeta.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-[1.5rem] border border-black/10 bg-white p-7 shadow-sm">
            <div className="flex gap-5">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-orange-500">
                <ListOrdered size={28} />
              </span>
              <div>
                <h2 className="text-xl font-black text-neutral-950">1. Elige</h2>
                <p className="mt-2 text-sm font-medium leading-6 text-neutral-600">
                  Consulta la carta desde el móvil y añade productos al carrito.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-black/10 bg-white p-7 shadow-sm">
            <div className="flex gap-5">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-orange-500">
                <UserRound size={28} />
              </span>
              <div>
                <h2 className="text-xl font-black text-neutral-950">2. Envía</h2>
                <p className="mt-2 text-sm font-medium leading-6 text-neutral-600">
                  Deja nombre, teléfono y notas para recogida en local.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-black/10 bg-white p-7 shadow-sm">
            <div className="flex gap-5">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-orange-500">
                <Clock3 size={28} />
              </span>
              <div>
                <h2 className="text-xl font-black text-neutral-950">3. SOHO confirma</h2>
                <p className="mt-2 text-sm font-medium leading-6 text-neutral-600">
                  El negocio acepta y marca 10, 15, 20, 30 o 45 min.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="contacto" className="mx-auto max-w-7xl px-4 pb-16">
        <div className="grid overflow-hidden rounded-[2rem] border border-black/10 bg-white shadow-sm lg:grid-cols-2">
          <div className="p-6 md:p-10">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[#049ca5]">Contacto</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight text-neutral-950">¿Tienes alguna duda?</h2>
            <p className="mt-3 max-w-xl text-base font-medium leading-7 text-neutral-600">
              Escríbenos para cualquier consulta sobre pedidos, horarios o recogida en local. También puedes venir directamente a Calle A Mariña, 3, Cambados.
            </p>

            <form onSubmit={submitContact} className="mt-8 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} className="rounded-2xl border border-black/10 bg-neutral-50 px-4 py-4 text-sm font-semibold outline-none transition focus:border-[#049ca5] focus:bg-white" placeholder="Nombre" />
                <input value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} className="rounded-2xl border border-black/10 bg-neutral-50 px-4 py-4 text-sm font-semibold outline-none transition focus:border-[#049ca5] focus:bg-white" placeholder="Teléfono" />
              </div>
              <input value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} type="email" className="rounded-2xl border border-black/10 bg-neutral-50 px-4 py-4 text-sm font-semibold outline-none transition focus:border-[#049ca5] focus:bg-white" placeholder="Correo electrónico" />
              <textarea value={contact.message} onChange={(e) => setContact({ ...contact, message: e.target.value })} className="min-h-36 rounded-2xl border border-black/10 bg-neutral-50 px-4 py-4 text-sm font-semibold outline-none transition focus:border-[#049ca5] focus:bg-white" placeholder="Mensaje" />
              {contactStatus && <p className="rounded-2xl bg-cyan-50 px-4 py-3 text-sm font-bold text-[#036b71]">{contactStatus}</p>}
              <button type="submit" disabled={sending} className="inline-flex w-fit items-center gap-2 rounded-2xl bg-neutral-950 px-6 py-4 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#037f86] disabled:opacity-60">
                <Send size={18} /> {sending ? 'Enviando...' : 'Enviar mensaje'}
              </button>
            </form>
          </div>

          <div className="border-t border-black/10 bg-neutral-100 p-4 lg:border-l lg:border-t-0">
            <div className="h-full overflow-hidden rounded-[1.5rem] bg-white shadow-sm">
              <iframe
                title="Mapa SOHO Cambados"
                className="h-80 w-full border-0 lg:h-[420px]"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src="https://www.google.com/maps?q=A%20Mari%C3%B1a%203%2C%20Cambados&output=embed"
              />
              <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-black text-neutral-950"><MapPin size={20} /> Calle A Mariña, 3, Cambados</h3>
                  <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-neutral-600"><Phone size={16} /> +34 644 53 57 78</p>
                </div>
                <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#049ca5] px-5 py-3 text-sm font-black text-white transition hover:bg-[#037f86]">
                  <Navigation size={17} /> Cómo llegar
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
