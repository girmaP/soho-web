'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { formatPrice } from '@/utils/formatPrice';

const times = [10, 15, 20, 30, 45];
const states = ['pending', 'accepted', 'preparing', 'ready', 'delivered', 'cancelled'];
const cancelReasonOptions = [
  {
    label: 'Producto no disponible',
    message: 'Ahora mismo no tenemos disponible uno de los productos del pedido. Puedes contactar con SOHO para cambiarlo por otra opción.'
  },
  {
    label: 'Cocina cerrada',
    message: 'La cocina ya no está aceptando pedidos en este momento. Puedes volver a intentarlo dentro del horario de pedidos.'
  },
  {
    label: 'Alta demanda',
    message: 'Ahora mismo tenemos mucha carga de trabajo y no podemos garantizar el pedido en buen estado. Contacta con SOHO si quieres buscar otra alternativa.'
  },
  {
    label: 'Necesitamos contactar con el cliente',
    message: 'Necesitamos confirmar algunos datos del pedido antes de prepararlo. Por favor, contacta con SOHO para revisarlo.'
  },
  {
    label: 'Fuera de zona/no disponible',
    message: 'No podemos gestionar este pedido con los datos indicados. Contacta con SOHO para revisarlo o modificarlo.'
  },
  {
    label: 'Otro motivo',
    message: ''
  }
];

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
  ready: 'Listo',
  delivered: 'Entregado',
  cancelled: 'Cancelado'
};

const stateStyles: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  accepted: 'bg-blue-100 text-blue-800 border-blue-200',
  preparing: 'bg-cyan-100 text-[#036b71] border-cyan-200',
  ready: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  delivered: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  cancelled: 'bg-rose-100 text-rose-800 border-rose-200'
};

function cleanPhone(phone: string) {
  const cleaned = String(phone || '').replace(/\D/g, '');
  if (cleaned.startsWith('34')) return cleaned;
  if (cleaned.length === 9) return `34${cleaned}`;
  return cleaned;
}

export function AdminOrderCard({
  order,
  onUpdate
}: {
  order: any;
  onUpdate: (id: string, status: string, estimatedTime?: number | null, cancellationReason?: string | null) => void;
}) {
  const [showCancelOptions, setShowCancelOptions] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [cancelReason, setCancelReason] = useState(cancelReasonOptions[0].label);
  const selectedCancelReason = cancelReasonOptions.find((reason) => reason.label === cancelReason) || cancelReasonOptions[0];
  const [customCancelReason, setCustomCancelReason] = useState(selectedCancelReason.message);

  const whatsappMessage = encodeURIComponent(
    `Hola ${order.customer_name}, tu pedido en SOHO Cambados ha sido aceptado. Tiempo estimado: ${
      order.estimated_time || '20'
    } minutos. Gracias.`
  );
  const whatsappUrl = `https://wa.me/${cleanPhone(order.customer_phone || '')}?text=${whatsappMessage}`;
  const finalCancelReason = cancelReason === 'Otro motivo' ? customCancelReason.trim() : selectedCancelReason.message;


  async function refundOrder() {
    const reason = window.prompt('Motivo del reembolso (mínimo 5 caracteres):');
    if (!reason || reason.trim().length < 5) return;
    const confirmation = window.prompt(`Vas a devolver ${formatPrice(Number(order.total_price || 0))}. Escribe REEMBOLSAR para confirmar:`);
    if (confirmation !== 'REEMBOLSAR') return alert('Reembolso cancelado.');
    if (!window.confirm('Última confirmación: Stripe devolverá el importe al cliente. Esta acción no se puede deshacer. ¿Continuar?')) return;
    setRefunding(true);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) { setRefunding(false); return alert('La sesión ha caducado.'); }
    const response = await fetch(`/api/admin/orders/${order.id}/refund`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reason: reason.trim(), confirmation: 'REEMBOLSAR' })
    });
    const result = await response.json().catch(() => null);
    setRefunding(false);
    if (!response.ok) return alert(result?.error || 'No se pudo tramitar el reembolso.');
    alert('Reembolso solicitado correctamente.');
    window.location.reload();
  }

  return (
    <article className="rounded-[28px] border border-black/10 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-2xl font-black tracking-tight text-neutral-950">{order.customer_name}</h3>
            <span className={`rounded-full border px-3 py-1 text-xs font-black ${stateStyles[order.status] || stateStyles.pending}`}>
              {stateLabels[order.status] || order.status}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold text-neutral-600">
            <span>{order.customer_phone}</span>
            <span>{order.order_type === 'pickup' ? 'Recogida en local' : 'Delivery local'}</span>
            <span>{new Date(order.created_at).toLocaleString('es-ES')}</span>
          </div>
          <p className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-black ${order.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-yellow-50 text-yellow-800'}`}>
            {paymentLabels[order.payment_status] || 'Pago online'}
          </p>
          {order.delivery_address && <p className="mt-2 text-sm font-semibold text-neutral-700">Dirección: {order.delivery_address}</p>}
          {order.status === 'cancelled' && order.cancellation_reason && (
            <p className="mt-3 rounded-3xl bg-rose-50 p-4 text-sm font-bold text-rose-800">Motivo de cancelación: {order.cancellation_reason}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Total</p>
          <strong className="block text-3xl font-black text-neutral-950">{formatPrice(Number(order.total_price))}</strong>
        </div>
      </div>

      <ul className="mt-5 divide-y divide-black/10 rounded-3xl bg-neutral-50 px-5">
        {order.order_items?.map((item: any) => (
          <li key={item.id} className="flex justify-between gap-4 py-3 text-sm font-semibold text-neutral-700">
            <span>{item.quantity}x {item.product_name}</span>
            <span>{formatPrice(Number(item.total_price))}</span>
          </li>
        ))}
      </ul>

      {order.notes && <p className="mt-4 rounded-3xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">Nota: {order.notes}</p>}

      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
        <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-neutral-600">
          Estado
          <select
            value={showCancelOptions ? 'cancelled' : (order.status || 'pending')}
            onChange={(e) => {
              if (e.target.value === 'cancelled') {
                setShowCancelOptions(true);
                return;
              }
              setShowCancelOptions(false);
              onUpdate(order.id, e.target.value, order.estimated_time, null);
            }}
            className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal text-neutral-950 outline-none focus:border-cyan-400"
          >
            {states.map((state) => <option key={state} value={state}>{stateLabels[state]}</option>)}
          </select>
        </label>

        <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-neutral-600">
          Tiempo estimado
          <select
            value={order.estimated_time || ''}
            onChange={(e) => onUpdate(order.id, order.status === 'pending' ? 'accepted' : order.status, e.target.value ? Number(e.target.value) : null, order.cancellation_reason || null)}
            className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal text-neutral-950 outline-none focus:border-cyan-400"
          >
            <option value="">Sin tiempo</option>
            {times.map((time) => <option key={time} value={time}>{time} min</option>)}
          </select>
        </label>

        <a href={whatsappUrl} target="_blank" rel="noreferrer" className="rounded-2xl bg-emerald-600 px-5 py-3 text-center text-sm font-black text-white hover:bg-emerald-700">
          WhatsApp
        </a>

        {order.payment_status === 'paid' && !order.stripe_refund_id && (
          <button type="button" onClick={refundOrder} disabled={refunding} className="rounded-2xl border border-rose-300 bg-rose-50 px-5 py-3 text-sm font-black text-rose-700 hover:bg-rose-100 disabled:opacity-60">
            {refunding ? 'Procesando...' : 'Reembolsar'}
          </button>
        )}

      </div>

      {showCancelOptions && order.status !== 'cancelled' && (
        <div className="mt-5 rounded-[28px] border border-red-200 bg-red-50 p-5">
          <h4 className="text-lg font-black text-red-800">Motivo de cancelación</h4>
          <p className="mt-2 text-sm font-semibold text-red-700">
            Elige una opción para generar un mensaje claro al cliente. Si ninguna encaja, selecciona “Otro motivo” y escríbelo a mano.
          </p>

          <label className="mt-5 grid gap-2 text-sm font-black text-red-900">
            Motivo
            <select
              value={cancelReason}
              onChange={(e) => {
                const nextReason = cancelReasonOptions.find((reason) => reason.label === e.target.value) || cancelReasonOptions[0];
                setCancelReason(nextReason.label);
                setCustomCancelReason(nextReason.message);
              }}
              className="rounded-2xl border border-red-200 bg-white px-4 py-4 text-base font-semibold text-red-900 outline-none focus:border-red-500"
            >
              {cancelReasonOptions.map((reason) => <option key={reason.label} value={reason.label}>{reason.label}</option>)}
            </select>
          </label>

          <textarea
            value={customCancelReason}
            onChange={(e) => setCustomCancelReason(e.target.value)}
            readOnly={cancelReason !== 'Otro motivo'}
            placeholder="Escribe el motivo personalizado de cancelación..."
            className="mt-4 min-h-[120px] w-full rounded-2xl border border-red-200 bg-white px-4 py-4 text-base font-medium text-neutral-800 outline-none focus:border-red-500 read-only:bg-white"
          />

          <div className="mt-5 rounded-2xl bg-white/80 px-4 py-4 text-sm font-semibold text-red-700">
            <strong>Mensaje al cliente:</strong> se enviará el motivo junto con una indicación para contactar con SOHO si quiere solucionarlo o modificar el pedido.
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => finalCancelReason ? onUpdate(order.id, 'cancelled', null, finalCancelReason) : alert('Escribe el motivo de cancelación.')}
              className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white hover:bg-red-700"
            >
              Enviar cancelación
            </button>
            <button type="button" onClick={() => setShowCancelOptions(false)} className="rounded-2xl border border-black/10 bg-white px-5 py-3 text-sm font-black text-neutral-950 hover:bg-neutral-50">
              Volver
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
