'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import {
  BusinessSettings,
  KitchenDaySchedule,
  defaultBusinessSettings,
  getBusinessSettings,
  kitchenHoursLabelFromSettings,
  orderedDays
} from '@/lib/businessConfig';

export const dynamic = 'force-dynamic';

export default function KitchenScheduleAdminPage() {
  const [settings, setSettings] = useState<BusinessSettings>(defaultBusinessSettings);
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;
      if (!userId) {
        setReady(true);
        return;
      }
      const { data: admin } = await supabase.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle();
      if (!admin?.user_id) {
        setReady(true);
        return;
      }
      setAllowed(true);
      setSettings(await getBusinessSettings());
      setReady(true);
    })();
  }, []);

  function patchDay(dayKey: string, patch: Partial<KitchenDaySchedule>) {
    setSettings((current) => ({
      ...current,
      kitchen_hours: {
        ...current.kitchen_hours,
        [dayKey]: { ...current.kitchen_hours[dayKey as keyof typeof current.kitchen_hours], ...patch }
      }
    }));
  }

  function patchShift(dayKey: string, shift: 'lunch' | 'dinner', patch: Record<string, any>) {
    setSettings((current) => {
      const day = current.kitchen_hours[dayKey as keyof typeof current.kitchen_hours];
      return {
        ...current,
        kitchen_hours: {
          ...current.kitchen_hours,
          [dayKey]: {
            ...day,
            [shift]: { ...day[shift], ...patch }
          }
        }
      };
    });
  }

  async function save() {
    setSaving(true);
    setMessage('');
    const { error } = await supabase
      .from('business_settings')
      .update({ kitchen_hours: settings.kitchen_hours, updated_at: new Date().toISOString() })
      .eq('id', 'main');
    if (error) setMessage(error.message);
    else {
      setSettings(await getBusinessSettings());
      setMessage('Horario de cocina guardado correctamente.');
    }
    setSaving(false);
  }

  if (!ready) return <main className="mx-auto max-w-5xl p-6"><p className="font-bold">Comprobando acceso…</p></main>;

  if (!allowed) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-black">Horario de cocina</h1>
          <p className="mt-2 text-sm font-semibold text-neutral-600">Primero inicia sesión en el panel de administración.</p>
          <Link href="/admin" className="mt-5 inline-flex rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-black text-white">Ir al panel</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fff7ed] p-4 text-neutral-950 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#047f86]">SOHO Cambados</p>
            <h1 className="mt-2 text-4xl font-black">Horario de cocina</h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-neutral-700">Configura por separado el servicio de mediodía y el de noche. La web puede aceptar pedidos antes de que abra la cocina y programará la recogida para la primera hora disponible más el tiempo de preparación.</p>
          </div>
          <Link href="/admin" className="rounded-2xl border border-black/10 bg-white px-5 py-3 text-sm font-black">Volver al panel</Link>
        </div>

        <div className="mt-6 rounded-3xl bg-cyan-50 p-5 text-sm font-bold text-[#02565b]">
          {kitchenHoursLabelFromSettings(settings)} Tiempo de preparación actual: {settings.default_wait_minutes} min.
        </div>

        <div className="mt-6 grid gap-4">
          {orderedDays.map((item) => {
            const day = settings.kitchen_hours[item.key];
            return (
              <section key={item.key} className="rounded-[28px] border border-black/10 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black">{item.label}</h2>
                    <p className={`text-sm font-bold ${day.closed ? 'text-red-600' : 'text-emerald-700'}`}>{day.closed ? 'Cocina cerrada' : 'Cocina activa'}</p>
                  </div>
                  <label className="flex items-center gap-3 rounded-2xl bg-neutral-50 px-4 py-3 text-sm font-black">
                    Cerrado todo el día
                    <input type="checkbox" checked={day.closed} onChange={(e) => patchDay(item.key, { closed: e.target.checked })} className="h-5 w-5" />
                  </label>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {(['lunch', 'dinner'] as const).map((shift) => {
                    const value = day[shift];
                    const title = shift === 'lunch' ? 'Servicio de mediodía' : 'Servicio de noche';
                    return (
                      <div key={shift} className="rounded-3xl bg-neutral-50 p-5">
                        <div className="flex items-center justify-between gap-3">
                          <strong>{title}</strong>
                          <label className="flex items-center gap-2 text-sm font-bold">Activo<input type="checkbox" checked={value.enabled} onChange={(e) => patchShift(item.key, shift, { enabled: e.target.checked })} className="h-5 w-5" /></label>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <label className="grid gap-1 text-xs font-black uppercase text-neutral-600">Abre<input type="time" value={value.open} onChange={(e) => patchShift(item.key, shift, { open: e.target.value })} disabled={!value.enabled || day.closed} className="rounded-2xl border border-black/10 bg-white p-3 text-sm font-bold normal-case disabled:opacity-50" /></label>
                          <label className="grid gap-1 text-xs font-black uppercase text-neutral-600">Cierra<input type="time" value={value.close} onChange={(e) => patchShift(item.key, shift, { close: e.target.value })} disabled={!value.enabled || day.closed} className="rounded-2xl border border-black/10 bg-white p-3 text-sm font-bold normal-case disabled:opacity-50" /></label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <div className="sticky bottom-4 mt-6 flex flex-wrap items-center gap-3 rounded-3xl border border-black/10 bg-white/95 p-4 shadow-xl backdrop-blur">
          <button onClick={save} disabled={saving} className="rounded-2xl bg-neutral-950 px-6 py-3 text-sm font-black text-white disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar horario de cocina'}</button>
          {message && <p className={`text-sm font-bold ${message.includes('correctamente') ? 'text-emerald-700' : 'text-red-700'}`}>{message}</p>}
        </div>
      </div>
    </main>
  );
}
