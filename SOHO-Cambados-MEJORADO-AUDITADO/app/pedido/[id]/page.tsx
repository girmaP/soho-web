'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { formatPrice } from '@/utils/formatPrice';
import { siteConfig } from '@/lib/siteConfig';

const SOHO_PHONE_DISPLAY = siteConfig.phoneDisplay;
const SOHO_PHONE_LINK = `tel:${siteConfig.phoneHref}`;

const paymentLabels: Record<string, string> = {
  pending: 'Pago pendiente',
  authorized: 'Pago autorizado',
  paid: 'Pagado online',
  failed: 'Pago fallido',
  cancelled: 'Autorización liberada',
  refund_pending: 'Reembolso en proceso',
  refunded: 'Reembolsado'
};

const stateLabels: Record<string, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptado',
  preparing: 'Preparando',
  ready: 'Listo para recoger',
  delivered: 'Entregado',
  cancelled: 'Cancelado'
};

const steps = [
  { key: 'pending', label: 'Enviado', text: 'SOHO ha recibido tu pedido.' },
  { key: 'accepted', label: 'Aceptado', text: 'El equipo confirmó el pedido.' },
  { key: 'preparing', label: 'Preparando', text: 'Tu pedido está en cocina.' },
  { key: 'ready', label: 'Listo', text: 'Puedes pasar a recogerlo.' },
  { key: 'delivered', label: 'Entregado', text: 'Pedido finalizado.' }
];

function statusMessage(order: any) {
  if (order.payment_status === 'refunded') return `Hemos tramitado la devolución de ${formatPrice(Number(order.total_price || 0))}. Según tu banco, puede tardar varios días laborables en aparecer.`;
  if (order.payment_status === 'refund_pending') return `La devolución de ${formatPrice(Number(order.total_price || 0))} está en proceso. Te mostraremos aquí la confirmación cuando Stripe la complete.`;
  if (order.status === 'cancelled') return 'SOHO ha cancelado este pedido.';
  if (order.status === 'ready') return 'Tu pedido está listo para recoger.';
  if (order.status === 'preparing') return `Tu pedido se está preparando${order.estimated_time ? `. Tiempo estimado: ${order.estimated_time} min` : ''}.`;
  if (order.status === 'accepted') return `Pedido aceptado${order.estimated_time ? `. Tiempo estimado: ${order.estimated_time} min` : ''}.`;
  if (order.status === 'delivered') return 'Pedido entregado. Gracias por pedir en SOHO Cambados.';
  return 'Pedido enviado. SOHO lo revisará y confirmará el tiempo estimado.';
}

function OrderStatusContent() {
  const params = useParams();
  const orderId = params.id as string;
  const searchParams = useSearchParams();
  const orderToken = searchParams.get('token') || '';
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [now, setNow] = useState(Date.now());

  async function loadOrder() {
    try {
      const response = await fetch(`/api/orders/${orderId}?token=${encodeURIComponent(orderToken)}`, { cache: 'no-store' });
      const result = await response.json().catch(() => null);
      if (response.ok && result?.order) {
        setOrder(result.order);
        setConfirming(false);
        setUpdatedAt(new Date());
      } else {
        setOrder(null);
        setConfirming(response.status === 409 && result?.code === 'ORDER_CONFIRMING');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!orderToken) { setLoading(false); return; }
    loadOrder();
    const polling = window.setInterval(loadOrder, 10000);
    return () => window.clearInterval(polling);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, orderToken]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);


  const isRefunded = order?.payment_status === 'refunded';
  const isRefundPending = order?.payment_status === 'refund_pending';
  const refundFlow = isRefunded || isRefundPending;

  const step = useMemo(() => {
    const map: Record<string, number> = { pending: 1, accepted: 2, preparing: 3, ready: 4, delivered: 5, cancelled: 0 };
    return map[order?.status] || 1;
  }, [order?.status]);

  const countdown = useMemo(() => {
    if (!order?.estimated_time || !['accepted', 'preparing'].includes(order.status)) return null;
    const baseDate = order.accepted_at || order.updated_at || order.created_at;
    const start = new Date(baseDate).getTime();
    const totalSeconds = Number(order.estimated_time) * 60;
    const elapsedSeconds = Math.max(0, Math.floor((now - start) / 1000));
    const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    return {
      totalSeconds,
      remainingSeconds,
      label: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    };
  }, [order?.estimated_time, order?.status, order?.accepted_at, order?.updated_at, order?.created_at, now]);


  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-[2rem] bg-white p-8 shadow-xl shadow-cyan-200/30">
          <h1 className="text-3xl font-black">Cargando pedido...</h1>
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-[2rem] bg-white p-8 shadow-xl shadow-cyan-200/30">
          <h1 className="text-3xl font-black">{confirming ? 'Confirmando tu pedido' : 'Pedido no encontrado'}</h1>
          {confirming && <p className="mt-2 text-neutral-600">Stripe esta terminando de confirmar la autorizacion. Esta pagina se actualizara automaticamente en unos segundos.</p>}
          <div className={confirming ? 'hidden' : ''}>
          <p className="mt-2 text-neutral-600">Revisa que estás usando el enlace privado completo del pedido o contacta con SOHO.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <section className="overflow-hidden rounded-[2rem] bg-neutral-950 text-white shadow-2xl shadow-cyan-300/25">
        <div className="relative p-6 md:p-8">
          <div className="absolute right-[-120px] top-[-140px] h-80 w-80 rounded-full bg-[#049ca5]/30 blur-3xl" />
          <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.25em] text-cyan-100">Pedido SOHO</p>
              <h1 className="mt-4 text-4xl font-black md:text-5xl">{isRefunded ? 'Pedido reembolsado' : isRefundPending ? 'Reembolso en proceso' : (stateLabels[order.status] || order.status)}</h1>
              <p className="mt-3 max-w-2xl text-lg text-white/80">{statusMessage(order)}</p>
              {countdown && (
                <div className="mt-5 inline-flex flex-wrap items-center gap-3 rounded-3xl bg-white/10 p-3 ring-1 ring-white/15">
                  <span className="rounded-2xl bg-[#049ca5] px-4 py-3 text-sm font-black text-white">{stateLabels[order.status]} · {order.estimated_time} min</span>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-100">Tiempo restante estimado</p>
                    <strong className="text-4xl font-black tabular-nums">{countdown.label}</strong>
                  </div>
                </div>
              )}
            </div>
            <div className="rounded-3xl bg-white p-4 text-neutral-950">
              <p className="text-xs font-black uppercase text-neutral-500">Total</p>
              <strong className="text-3xl">{formatPrice(Number(order.total_price))}</strong>
              <p className="mt-2 rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-700">{paymentLabels[order.payment_status] || 'Pago online'}</p>
            </div>
          </div>

          {refundFlow ? (
            <div className="relative z-10 mt-8 grid gap-3 md:grid-cols-4">
              {[
                { label: 'Pedido recibido', text: 'SOHO recibió tu pedido.' },
                { label: 'Pago realizado', text: 'El pago se procesó online.' },
                { label: 'Reembolso solicitado', text: order.refund_reason || 'SOHO inició la devolución.' },
                { label: isRefunded ? 'Reembolsado' : 'En proceso', text: isRefunded ? 'Stripe confirmó la devolución.' : 'Pendiente de confirmación bancaria.' }
              ].map((item, index) => <div key={item.label} className={`rounded-3xl p-4 ${index < (isRefunded ? 4 : 3) ? 'bg-[#049ca5] text-white' : 'bg-white/10 text-white/55'}`}><div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-black">{index + 1}</div><strong>{item.label}</strong><p className="mt-1 text-xs opacity-80">{item.text}</p></div>)}
            </div>
          ) : (
            <div className="relative z-10 mt-8 grid gap-3 md:grid-cols-5">
              {steps.map((item, index) => {
                const active = order.status !== 'cancelled' && step >= index + 1;
                return <div key={item.key} className={`rounded-3xl p-4 ${active ? 'bg-[#049ca5] text-white' : 'bg-white/10 text-white/55'}`}><div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-black">{index + 1}</div><strong>{item.label}</strong><p className="mt-1 text-xs opacity-80">{item.text}</p></div>;
              })}
            </div>
          )}
        </div>
      </section>

      {refundFlow && (
        <section className={`mt-6 rounded-[2rem] border p-6 shadow-sm ${isRefunded ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          <p className={`text-sm font-black uppercase tracking-[0.2em] ${isRefunded ? 'text-emerald-700' : 'text-amber-700'}`}>{isRefunded ? 'Devolución completada' : 'Devolución en curso'}</p>
          <h2 className="mt-1 text-3xl font-black">{formatPrice(Number(order.total_price || 0))} {isRefunded ? 'reembolsados' : 'pendientes de reembolso'}</h2>
          <p className="mt-2 max-w-3xl text-neutral-700">{isRefunded ? 'La devolución ya ha sido confirmada. El plazo para verla en tu cuenta depende de tu banco y puede ser de varios días laborables.' : 'Stripe está procesando la devolución. Esta página se actualizará automáticamente cuando quede confirmada.'}</p>
          {order.refund_reason && <p className="mt-3 text-sm font-bold text-neutral-700"><strong>Motivo:</strong> {order.refund_reason}</p>}
          {order.updated_at && <p className="mt-2 text-xs text-neutral-500">Última actualización: {new Date(order.updated_at).toLocaleString('es-ES')}</p>}
        </section>
      )}


      {order.status === 'cancelled' && (
        <section className="mt-6 rounded-[2rem] border border-rose-200 bg-rose-50 p-6 shadow-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-rose-700">Pedido cancelado</p>
              <h2 className="mt-1 text-3xl font-black text-rose-950">Motivo de cancelación</h2>
              <p className="mt-2 max-w-2xl text-rose-900/80">{order.cancellation_reason || 'SOHO no puede preparar este pedido ahora mismo.'}</p>
              <p className="mt-3 text-sm font-bold text-rose-900/70">Puedes llamarnos a {SOHO_PHONE_DISPLAY} para revisarlo o continuar con otro pedido.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
              <a href={SOHO_PHONE_LINK} className="rounded-2xl bg-rose-700 px-5 py-4 text-center font-black text-white transition hover:bg-rose-800">Llamar a SOHO</a>
              <a href="/menu" className="rounded-2xl bg-white px-5 py-4 text-center font-black text-rose-800 ring-1 ring-rose-200 transition hover:bg-rose-100">Hacer otro pedido</a>
            </div>
          </div>
        </section>
      )}

      {order.status === 'delivered' && !refundFlow && (
        <section className="mt-6 rounded-[2rem] border border-green-200 bg-green-50 p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-green-700">Pedido finalizado</p>
              <h2 className="mt-1 text-3xl font-black text-green-950">Gracias por pedir en SOHO</h2>
              <p className="mt-2 max-w-2xl text-green-900/70">Esperamos que disfrutes tu pedido. Cuando quieras, puedes volver a la carta y preparar otro pedido para recoger.</p>
            </div>
            <a href="/menu" className="rounded-2xl bg-green-700 px-5 py-4 text-center font-black text-white">Seguir comprando</a>
          </div>
        </section>
      )}

      <section className="mt-6 grid gap-6 md:grid-cols-[1fr_340px]">
        <div className="rounded-[2rem] border bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-black">Resumen del pedido</h2>
          <div className="mt-4 grid gap-3">
            {order.order_items?.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between rounded-3xl bg-neutral-50 p-4">
                <div>
                  <strong>{item.quantity}x {item.product_name}</strong>
                  <p className="text-sm text-neutral-500">{formatPrice(Number(item.unit_price))} / unidad</p>
                </div>
                <strong>{formatPrice(Number(item.total_price))}</strong>
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-between border-t pt-4 text-xl">
            <b>Total</b>
            <b>{formatPrice(Number(order.total_price))}</b>
          </div>
        </div>

        <aside className="grid gap-4">
          <div className="rounded-[2rem] border bg-white p-5 shadow-sm">
            <h3 className="text-xl font-black">Datos</h3>
            <div className="mt-3 grid gap-2 text-sm text-neutral-700">
              <p><strong>Cliente:</strong> {order.customer_name}</p>
              <p><strong>Teléfono:</strong> {order.customer_phone}</p>
              <p><strong>Método:</strong> {order.order_type === 'pickup' ? 'Recogida en local' : 'Delivery'}</p>
              <p><strong>Pago:</strong> {paymentLabels[order.payment_status] || 'Stripe'}</p>
              {order.estimated_time && <p><strong>Tiempo marcado:</strong> {order.estimated_time} min</p>}
              {countdown && <p><strong>Cuenta atrás:</strong> {countdown.label}</p>}
              {order.notes && <p><strong>Notas:</strong> {order.notes}</p>}
            </div>
          </div>

          <div className="rounded-[2rem] border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-3 w-3 rounded-full bg-green-500" />
              <strong>Actualización automática</strong>
            </div>
            <p className="mt-2 text-sm text-neutral-600">Puedes dejar esta página abierta. Cuando SOHO cambie el estado o el tiempo, esta página se actualizará automáticamente cada pocos segundos.</p>
            {updatedAt && <p className="mt-3 text-xs text-neutral-500">Última actualización: {updatedAt.toLocaleTimeString('es-ES')}</p>}
          </div>
        </aside>
      </section>
    </main>
  );
}


export default function OrderStatusPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-4xl px-4 py-10" />}>
      <OrderStatusContent />
    </Suspense>
  );
}
