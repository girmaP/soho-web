'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, ShieldCheck, X } from 'lucide-react';

type Props = {
  serviceStartDate: string | null;
  subscriptionActive?: boolean;
};

const SUBSCRIPTION_URL = 'https://suscripciones.girma.es/mantenimiento-web#planes';
const DISMISS_KEY = 'soho-maintenance-expiry-dismissed-until';
const REMIND_AFTER_MS = 24 * 60 * 60 * 1000;

function addMonthsClamped(date: Date, months: number) {
  const source = new Date(date);
  const day = source.getDate();
  const target = new Date(source.getFullYear(), source.getMonth() + months, 1, 12, 0, 0, 0);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return target;
}

function parseServiceDate(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function MaintenanceExpiryAlert({ serviceStartDate, subscriptionActive = false }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [dismissedUntil, setDismissedUntil] = useState(0);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
    if (Number.isFinite(stored)) setDismissedUntil(stored);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const expiryDate = useMemo(() => {
    const start = parseServiceDate(serviceStartDate);
    return start ? addMonthsClamped(start, 3) : null;
  }, [serviceStartDate]);

  const expired = Boolean(expiryDate && now >= expiryDate.getTime());
  const hiddenForNow = dismissedUntil > now;

  if (subscriptionActive || !expired || hiddenForNow || !expiryDate) return null;

  const expiryLabel = expiryDate.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  function remindTomorrow() {
    const until = Date.now() + REMIND_AFTER_MS;
    setDismissedUntil(until);
    window.localStorage.setItem(DISMISS_KEY, String(until));
  }

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="maintenance-expiry-title"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-[32px] bg-white shadow-2xl ring-1 ring-black/10">
        <div className="relative bg-neutral-950 px-6 pb-6 pt-7 text-white">
          <button
            type="button"
            onClick={remindTomorrow}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20"
            aria-label="Cerrar aviso"
          >
            <X size={19} />
          </button>

          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/20">
            <ShieldCheck size={25} />
          </div>

          <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Mantenimiento web</p>
          <h2 id="maintenance-expiry-title" className="mt-2 text-3xl font-black tracking-tight">
            Ha finalizado el periodo gratuito
          </h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-white/75">
            El periodo de mantenimiento gratuito de SOHO finalizó el {expiryLabel}.
          </p>
        </div>

        <div className="p-6">
          <p className="text-sm font-semibold leading-6 text-neutral-700">
            Puedes elegir el plan de mantenimiento que mejor se adapte al negocio y contratarlo directamente desde la página de suscripciones.
          </p>

          <a
            href={SUBSCRIPTION_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#049ca5] px-5 py-4 text-sm font-black text-white shadow-lg shadow-cyan-900/10 transition hover:-translate-y-0.5 hover:bg-[#037f86]"
          >
            Ver planes de mantenimiento
            <ExternalLink size={17} />
          </a>

          <button
            type="button"
            onClick={remindTomorrow}
            className="mt-3 w-full rounded-2xl px-5 py-3 text-sm font-black text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
          >
            Recordármelo mañana
          </button>

          <p className="mt-4 text-center text-[11px] font-semibold leading-5 text-neutral-400">
            Este aviso volverá a mostrarse mientras el periodo gratuito haya finalizado.
          </p>
        </div>
      </div>
    </div>
  );
}
