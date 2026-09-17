'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabaseClient';
import {
  BusinessSettings,
  KitchenDaySchedule,
  defaultBusinessSettings,
  getBusinessSettings,
  kitchenHoursLabelFromSettings,
  orderedDays
} from '@/lib/businessConfig';

export function AdminKitchenScheduleInline() {
  const [target, setTarget] = useState<Element | null>(null);
  const [shortcutTarget, setShortcutTarget] = useState<Element | null>(null);
  const [settings, setSettings] = useState<BusinessSettings>(defaultBusinessSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let alive = true;
    let shortcutMount: HTMLDivElement | null = null;

    const locate = () => {
      const heading = Array.from(document.querySelectorAll('h1')).find((node) => node.textContent?.trim() === 'Horario');
      const section = heading?.closest('section') || null;

      if (!section) {
        if (alive) {
          setTarget(null);
          setShortcutTarget(null);
        }
        return;
      }

      if (!shortcutMount || !shortcutMount.isConnected) {
        shortcutMount = document.createElement('div');
        shortcutMount.dataset.kitchenShortcut = 'true';
        section.insertBefore(shortcutMount, section.firstChild);
      }

      if (alive) {
        setTarget(section);
        setShortcutTarget(shortcutMount);
      }
    };

    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });

    getBusinessSettings().then((data) => {
      if (alive) setSettings(data);
    });

    return () => {
      alive = false;
      observer.disconnect();
      shortcutMount?.remove();
    };
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

    if (error) {
      setMessage(error.message);
    } else {
      const refreshed = await getBusinessSettings();
      setSettings(refreshed);
      setMessage('Horario de cocina guardado correctamente.');
    }
    setSaving(false);
  }

  function goToKitchenHours() {
    document.getElementById('horario-cocina')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (!target) return null;

  return (
    <>
      {shortcutTarget && createPortal(
        <div className="mb-5 flex justify-end">
          <button
            type="button"
            onClick={goToKitchenHours}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#049ca5] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#037f86]"
          >
            Ir al horario de cocina ↓
          </button>
        </div>,
        shortcutTarget
      )}

      {createPortal(
        <div id="horario-cocina" className="mt-6 scroll-mt-6 rounded-[28px] border border-cyan-200 bg-cyan-50 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#047f86]">Recogidas de pedidos web</p>
              <h2 className="mt-1 text-2xl font-black text-neutral-950">Horario de cocina</h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-neutral-700">
                Configura por separado el servicio de mediodía y el de noche. Los pedidos pueden aceptarse antes de que abra la cocina; «lo antes posible» se programa para la primera apertura disponible más el tiempo de preparación.
              </p>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-[#02565b] ring-1 ring-cyan-100">
              {kitchenHoursLabelFromSettings(settings)}
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            {orderedDays.map((item) => {
              const day = settings.kitchen_hours[item.key];
              return (
                <section key={item.key} className="rounded-3xl border border-black/10 bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <strong className="text-lg font-black text-neutral-950">{item.label}</strong>
                      <p className={`text-sm font-black ${day.closed ? 'text-red-600' : 'text-emerald-700'}`}>
                        {day.closed ? 'Cocina cerrada' : 'Cocina activa'}
                      </p>
                    </div>
                    <label className="flex items-center gap-3 rounded-2xl bg-neutral-50 px-4 py-3 text-sm font-black text-neutral-950">
                      Cerrado todo el día
                      <input type="checkbox" checked={day.closed} onChange={(e) => patchDay(item.key, { closed: e.target.checked })} className="h-5 w-5" />
                    </label>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    {(['lunch', 'dinner'] as const).map((shift) => {
                      const value = day[shift];
                      const title = shift === 'lunch' ? 'Servicio de mediodía' : 'Servicio de noche';
                      return (
                        <div key={shift} className="rounded-3xl bg-neutral-50 p-5">
                          <div className="flex items-center justify-between gap-3">
                            <strong>{title}</strong>
                            <label className="flex items-center gap-2 text-sm font-bold">
                              Activo
                              <input type="checkbox" checked={value.enabled} onChange={(e) => patchShift(item.key, shift, { enabled: e.target.checked })} className="h-5 w-5" />
                            </label>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-3">
                            <label className="grid gap-1 text-xs font-black uppercase text-neutral-600">
                              Abre
                              <input type="time" value={value.open} onChange={(e) => patchShift(item.key, shift, { open: e.target.value })} disabled={!value.enabled || day.closed} className="rounded-2xl border border-black/10 bg-white p-3 text-sm font-bold normal-case disabled:opacity-50" />
                            </label>
                            <label className="grid gap-1 text-xs font-black uppercase text-neutral-600">
                              Cierra
                              <input type="time" value={value.close} onChange={(e) => patchShift(item.key, shift, { close: e.target.value })} disabled={!value.enabled || day.closed} className="rounded-2xl border border-black/10 bg-white p-3 text-sm font-bold normal-case disabled:opacity-50" />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button onClick={save} disabled={saving} className="rounded-2xl bg-[#049ca5] px-6 py-3 text-sm font-black text-white disabled:opacity-50">
              {saving ? 'Guardando…' : 'Guardar horario de cocina'}
            </button>
            <span className="text-sm font-bold text-neutral-700">Tiempo de preparación actual: {settings.default_wait_minutes} min.</span>
            {message && <p className={`text-sm font-bold ${message.includes('correctamente') ? 'text-emerald-700' : 'text-red-700'}`}>{message}</p>}
          </div>
        </div>,
        target
      )}
    </>
  );
}
