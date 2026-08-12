'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, CheckCircle2, Volume2, VolumeX } from 'lucide-react';
import { formatPrice } from '@/utils/formatPrice';
import { supabase } from '@/lib/supabaseClient';

type Props = { orders: any[]; onAcknowledged: () => Promise<void> | void };
const ACTIVE_STATUSES = new Set(['pending', 'accepted', 'preparing', 'ready']);
const DURATIONS = [5, 10, 15, 30, 60];

export function NewOrderAlert({ orders, onAcknowledged }: Props) {
  const [activated, setActivated] = useState(false);
  const [soundDisabled, setSoundDisabled] = useState(false);
  const [mutedUntil, setMutedUntil] = useState(0);
  const [muteMinutes, setMuteMinutes] = useState('5');
  const [customMinutes, setCustomMinutes] = useState(20);
  const [now, setNow] = useState(Date.now());
  const [volume, setVolume] = useState(0.85);
  const [busyId, setBusyId] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const savedVolume = Number(localStorage.getItem('soho-order-alert-volume'));
    const savedMutedUntil = Number(localStorage.getItem('soho-order-alert-muted-until'));
    if (Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 1) setVolume(savedVolume);
    if (Number.isFinite(savedMutedUntil) && savedMutedUntil > Date.now()) setMutedUntil(savedMutedUntil);
    setActivated(localStorage.getItem('soho-order-alert-enabled') === '1');
    setSoundDisabled(localStorage.getItem('soho-order-alert-sound-disabled') === '1');
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (mutedUntil && mutedUntil <= now) {
      setMutedUntil(0);
      localStorage.removeItem('soho-order-alert-muted-until');
    }
  }, [mutedUntil, now]);

  const pending = useMemo(
    () => orders.filter((order) => !order.received_acknowledged_at && ACTIVE_STATUSES.has(order.status) && ['authorized', 'paid', 'refund_pending', 'refunded'].includes(order.payment_status)),
    [orders]
  );
  const isTemporarilyMuted = mutedUntil > now;
  const canSound = activated && !soundDisabled && !isTemporarilyMuted;

  function getAudioContext() {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!audioContextRef.current) audioContextRef.current = new AudioContextClass();
    return audioContextRef.current;
  }

  function playTripleAlarm(force = false) {
    if ((!force && (!canSound || !pending.length)) || (force && soundDisabled)) return;
    try {
      const audio = getAudioContext();
      if (audio.state === 'suspended') void audio.resume();
      [0, 0.42, 0.84].forEach((offset, index) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = index === 1 ? 'square' : 'sine';
        oscillator.frequency.setValueAtTime(index === 1 ? 1050 : 880, audio.currentTime + offset);
        gain.gain.setValueAtTime(0.0001, audio.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume * 0.32), audio.currentTime + offset + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + offset + 0.28);
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.start(audio.currentTime + offset);
        oscillator.stop(audio.currentTime + offset + 0.3);
      });
    } catch (error) {
      console.warn('No se pudo reproducir la alarma:', error);
    }
  }

  async function enableAlerts() {
    setActivated(true);
    setSoundDisabled(false);
    localStorage.setItem('soho-order-alert-enabled', '1');
    localStorage.removeItem('soho-order-alert-sound-disabled');
    try {
      const audio = getAudioContext();
      await audio.resume();
      if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
    } catch {}
    window.setTimeout(() => playTripleAlarm(true), 50);
  }

  function muteForSelectedTime() {
    const minutes = muteMinutes === 'custom' ? customMinutes : Number(muteMinutes);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 720) return;
    const until = Date.now() + minutes * 60_000;
    setMutedUntil(until);
    localStorage.setItem('soho-order-alert-muted-until', String(until));
  }

  function reactivateSound() {
    setSoundDisabled(false);
    setMutedUntil(0);
    localStorage.removeItem('soho-order-alert-sound-disabled');
    localStorage.removeItem('soho-order-alert-muted-until');
    window.setTimeout(() => playTripleAlarm(true), 50);
  }

  function disableSound() {
    setSoundDisabled(true);
    setMutedUntil(0);
    localStorage.setItem('soho-order-alert-sound-disabled', '1');
    localStorage.removeItem('soho-order-alert-muted-until');
  }

  useEffect(() => {
    if (!canSound || !pending.length) return;
    playTripleAlarm();
    const interval = window.setInterval(() => playTripleAlarm(), 7000);
    return () => window.clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSound, pending.length, volume]);

  useEffect(() => {
    if (!activated || !pending.length || !('Notification' in window) || Notification.permission !== 'granted') return;
    pending.forEach((order) => {
      if (notifiedRef.current.has(order.id)) return;
      notifiedRef.current.add(order.id);
      const reference = order.reference || `WEB-${String(order.id).slice(0, 8).toUpperCase()}`;
      new Notification('Nuevo pedido en SOHO', {
        body: `${reference} · ${order.customer_name || 'Cliente'} · ${formatPrice(Number(order.total_price || 0))}`,
        tag: `soho-order-${order.id}`,
        requireInteraction: true
      });
    });
  }, [activated, pending]);

  async function acknowledge(orderId: string) {
    setBusyId(orderId);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('La sesión ha caducado.');
      const response = await fetch(`/api/admin/orders/${orderId}/acknowledge`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || 'No se pudo confirmar el pedido.');
      await onAcknowledged();
    } catch (error: any) {
      alert(error?.message || 'No se pudo confirmar el pedido.');
    } finally {
      setBusyId(null);
    }
  }

  const remainingMinutes = Math.max(1, Math.ceil((mutedUntil - now) / 60_000));

  if (!activated) return (
    <div className="fixed bottom-5 right-5 z-[80] max-w-sm rounded-3xl border border-amber-300 bg-white p-4 shadow-2xl">
      <div className="flex items-start gap-3"><BellRing className="mt-1 text-amber-600" /><div><strong className="block text-sm font-black">Activa los avisos de pedidos</strong><p className="mt-1 text-xs font-semibold text-neutral-600">Necesario para que el navegador pueda reproducir la alarma.</p></div></div>
      <button type="button" onClick={enableAlerts} className="mt-3 w-full rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-black text-white">Activar sonido y notificaciones</button>
    </div>
  );

  if (!pending.length) return (
    <div className="fixed bottom-5 right-5 z-[70] flex items-center gap-3 rounded-full bg-white px-4 py-3 text-xs font-black shadow-lg ring-1 ring-black/10">
      <CheckCircle2 size={18} className="text-emerald-600" />
      {soundDisabled ? 'Avisos visuales activos · sonido desactivado' : isTemporarilyMuted ? `Sonido silenciado ${remainingMinutes} min` : 'Avisos activos'}
      {(soundDisabled || isTemporarilyMuted) && <button type="button" onClick={reactivateSound} className="underline">Activar sonido</button>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/55 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-label="Pedidos nuevos pendientes de confirmar">
      <div className="max-h-[92vh] w-full max-w-xl overflow-auto rounded-[32px] bg-white p-6 shadow-2xl ring-4 ring-amber-400/80">
        <div className="flex items-start justify-between gap-4"><div className="flex gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700"><BellRing className="animate-pulse" /></span><div><h2 className="text-2xl font-black">{pending.length === 1 ? '¡Nuevo pedido!' : `${pending.length} pedidos sin confirmar`}</h2><p className="mt-1 text-sm font-semibold text-neutral-600">El aviso seguirá visible hasta confirmar cada pedido.</p></div></div><span className="rounded-full bg-red-600 px-3 py-1 text-sm font-black text-white">{pending.length}</span></div>

        {(soundDisabled || isTemporarilyMuted) && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-100 p-3 text-sm font-black text-amber-900"><span>{soundDisabled ? 'Alertas sonoras desactivadas' : `Sonido silenciado durante ${remainingMinutes} min más`}</span><button type="button" onClick={reactivateSound} className="rounded-xl bg-white px-3 py-2 text-xs ring-1 ring-black/10">Activar sonido</button></div>}

        <div className="mt-5 grid gap-3">{pending.map((order) => <article key={order.id} className="rounded-3xl border border-black/10 bg-amber-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><strong className="text-lg font-black">{order.reference || `WEB-${String(order.id).slice(0, 8).toUpperCase()}`}</strong><p className="mt-1 text-sm font-semibold text-neutral-700">{order.customer_name} · {new Date(order.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p></div><strong className="text-lg font-black">{formatPrice(Number(order.total_price || 0))}</strong></div><button type="button" disabled={busyId === order.id} onClick={() => acknowledge(order.id)} className="mt-4 w-full rounded-2xl bg-emerald-600 px-4 py-3 font-black text-white disabled:opacity-50">{busyId === order.id ? 'Confirmando…' : 'Pedido recibido'}</button></article>)}</div>

        <div className="mt-5 grid gap-3 rounded-3xl bg-neutral-100 p-4">
          <label className="flex items-center gap-3 text-xs font-black"><Volume2 size={18} /><input aria-label="Volumen de la alarma" type="range" min="0.15" max="1" step="0.05" value={volume} onChange={(event) => { const next = Number(event.target.value); setVolume(next); localStorage.setItem('soho-order-alert-volume', String(next)); }} className="w-full" /><span>{Math.round(volume * 100)}%</span></label>
          <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto]">
            <button type="button" onClick={() => playTripleAlarm(true)} className="rounded-xl bg-white px-4 py-2 text-xs font-black ring-1 ring-black/10">Probar</button>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <select aria-label="Tiempo de silencio" value={muteMinutes} onChange={(event) => setMuteMinutes(event.target.value)} className="rounded-xl bg-white px-3 py-2 text-xs font-black ring-1 ring-black/10">
                {DURATIONS.map((minutes) => <option key={minutes} value={minutes}>{minutes} minutos</option>)}
                <option value="custom">Tiempo personalizado</option>
              </select>
              {muteMinutes === 'custom' && <input aria-label="Minutos personalizados" type="number" min="1" max="720" value={customMinutes} onChange={(event) => setCustomMinutes(Math.max(1, Math.min(720, Number(event.target.value) || 1)))} className="w-24 rounded-xl bg-white px-3 py-2 text-xs font-black ring-1 ring-black/10" />}
            </div>
            <button type="button" onClick={muteForSelectedTime} className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-black ring-1 ring-black/10"><VolumeX size={16} /> Silenciar</button>
          </div>
          <button type="button" onClick={disableSound} className="w-full rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-black text-red-700">Desactivar sonido</button>
        </div>
      </div>
    </div>
  );
}
