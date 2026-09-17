import { supabase } from './supabaseClient';

export type DayKey = '0' | '1' | '2' | '3' | '4' | '5' | '6';
export type DaySchedule = { open: string; close: string; closed: boolean };
export type WeeklyHours = Record<DayKey, DaySchedule>;
export type KitchenShift = { open: string; close: string; enabled: boolean };
export type KitchenDaySchedule = { closed: boolean; lunch: KitchenShift; dinner: KitchenShift };
export type KitchenHours = Record<DayKey, KitchenDaySchedule>;

export type BusinessSettings = {
  id: string;
  opening_time: string;
  closing_time: string;
  manual_pause: boolean;
  closed_days: number[];
  weekly_hours: WeeklyHours;
  kitchen_hours: KitchenHours;
  minimum_order: number;
  default_wait_minutes: number;
  service_start_date: string | null;
  printer_price_per_ticket: number;
  monthly_management_fee: number;
  monthly_hosting_fee: number;
  annual_domain_fee: number;
  fiscal_name: string;
  fiscal_nif: string;
  fiscal_address: string;
  admin_email: string;
};

export const dayLabels: Record<number, string> = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 0: 'Domingo' };
export const orderedDays = [
  { day: 1, label: 'Lunes', key: '1' as DayKey }, { day: 2, label: 'Martes', key: '2' as DayKey },
  { day: 3, label: 'Miércoles', key: '3' as DayKey }, { day: 4, label: 'Jueves', key: '4' as DayKey },
  { day: 5, label: 'Viernes', key: '5' as DayKey }, { day: 6, label: 'Sábado', key: '6' as DayKey },
  { day: 0, label: 'Domingo', key: '0' as DayKey }
];

export const defaultWeeklyHours: WeeklyHours = {
  '1': { open: '09:00', close: '01:00', closed: false }, '2': { open: '09:00', close: '01:00', closed: false },
  '3': { open: '09:00', close: '01:00', closed: false }, '4': { open: '09:00', close: '01:00', closed: false },
  '5': { open: '09:00', close: '01:00', closed: false }, '6': { open: '10:00', close: '01:00', closed: false },
  '0': { open: '10:00', close: '01:00', closed: false }
};

// Hasta que Martín configure los turnos reales, se conserva el horario actual como un único turno.
// Así la actualización no cambia de golpe las horas disponibles en producción.
export const defaultKitchenHours: KitchenHours = {
  '1': { closed: false, lunch: { open: '09:00', close: '01:00', enabled: true }, dinner: { open: '20:00', close: '23:30', enabled: false } },
  '2': { closed: false, lunch: { open: '09:00', close: '01:00', enabled: true }, dinner: { open: '20:00', close: '23:30', enabled: false } },
  '3': { closed: false, lunch: { open: '09:00', close: '01:00', enabled: true }, dinner: { open: '20:00', close: '23:30', enabled: false } },
  '4': { closed: false, lunch: { open: '09:00', close: '01:00', enabled: true }, dinner: { open: '20:00', close: '23:30', enabled: false } },
  '5': { closed: false, lunch: { open: '09:00', close: '01:00', enabled: true }, dinner: { open: '20:00', close: '23:30', enabled: false } },
  '6': { closed: false, lunch: { open: '10:00', close: '01:00', enabled: true }, dinner: { open: '20:00', close: '23:30', enabled: false } },
  '0': { closed: false, lunch: { open: '10:00', close: '01:00', enabled: true }, dinner: { open: '20:00', close: '23:30', enabled: false } }
};

export const defaultBusinessSettings: BusinessSettings = {
  id: 'main', opening_time: '09:00', closing_time: '01:00', manual_pause: false, closed_days: [],
  weekly_hours: defaultWeeklyHours, kitchen_hours: defaultKitchenHours, minimum_order: 0, default_wait_minutes: 30,
  service_start_date: '2026-09-17', printer_price_per_ticket: 0,
  monthly_management_fee: 0, monthly_hosting_fee: 0, annual_domain_fee: 0,
  fiscal_name: 'SOHO Cambados', fiscal_nif: '', fiscal_address: 'Calle A Mariña, 3, 36630 Cambados, Pontevedra', admin_email: 'sohocambados@gmail.com'
};

function validTime(value: unknown, fallback: string) {
  const text = typeof value === 'string' ? value.trim() : '';
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : fallback;
}

function minutesFromTime(value: unknown) {
  const [hours, minutes] = validTime(value, '00:00').split(':').map(Number);
  return hours * 60 + minutes;
}

function normalizeWeeklyHours(raw: unknown, fallback: BusinessSettings = defaultBusinessSettings): WeeklyHours {
  const source = raw && typeof raw === 'object' ? raw as Record<string, any> : {};
  const normalized = {} as WeeklyHours;
  orderedDays.forEach(({ day, key }) => {
    const value = source[key] || {};
    normalized[key] = {
      open: validTime(value.open ?? value.opening_time, fallback.opening_time || '09:00'),
      close: validTime(value.close ?? value.closing_time, fallback.closing_time || '23:30'),
      closed: typeof value.closed === 'boolean' ? value.closed : (fallback.closed_days || []).includes(day)
    };
  });
  return normalized;
}

function normalizeKitchenHours(raw: unknown): KitchenHours {
  const source = raw && typeof raw === 'object' ? raw as Record<string, any> : {};
  const normalized = {} as KitchenHours;
  orderedDays.forEach(({ key }) => {
    const fallback = defaultKitchenHours[key];
    const value = source[key] || {};
    const lunch = value.lunch || value.midday || {};
    const dinner = value.dinner || value.night || {};
    normalized[key] = {
      closed: typeof value.closed === 'boolean' ? value.closed : fallback.closed,
      lunch: {
        open: validTime(lunch.open, fallback.lunch.open),
        close: validTime(lunch.close, fallback.lunch.close),
        enabled: typeof lunch.enabled === 'boolean' ? lunch.enabled : fallback.lunch.enabled
      },
      dinner: {
        open: validTime(dinner.open, fallback.dinner.open),
        close: validTime(dinner.close, fallback.dinner.close),
        enabled: typeof dinner.enabled === 'boolean' ? dinner.enabled : fallback.dinner.enabled
      }
    };
  });
  return normalized;
}

function madridParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(date);
  const weekday = parts.find((part) => part.type === 'weekday')?.value || 'Sun';
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);
  const map: Record<string, DayKey> = { Sun: '0', Mon: '1', Tue: '2', Wed: '3', Thu: '4', Fri: '5', Sat: '6' };
  return { key: map[weekday] || '0', hour, minute };
}

function timeInsideWindow(now: number, open: number, close: number) {
  return close < open ? now >= open || now <= close : now >= open && now <= close;
}

export async function getBusinessSettings(): Promise<BusinessSettings> {
  const { data, error } = await supabase.from('business_settings').select('*').eq('id', 'main').maybeSingle();
  if (error || !data) return defaultBusinessSettings;
  const merged = {
    ...defaultBusinessSettings, ...data,
    opening_time: validTime(data.opening_time, defaultBusinessSettings.opening_time),
    closing_time: validTime(data.closing_time, defaultBusinessSettings.closing_time),
    manual_pause: Boolean(data.manual_pause),
    closed_days: Array.isArray(data.closed_days) ? data.closed_days : [],
    minimum_order: Number(data.minimum_order || 0),
    default_wait_minutes: Number(data.default_wait_minutes ?? defaultBusinessSettings.default_wait_minutes),
    service_start_date: data.service_start_date || defaultBusinessSettings.service_start_date,
    printer_price_per_ticket: Number(data.printer_price_per_ticket || 0),
    monthly_management_fee: Number(data.monthly_management_fee || 0),
    monthly_hosting_fee: Number(data.monthly_hosting_fee || 0),
    annual_domain_fee: Number(data.annual_domain_fee || 0)
  } as BusinessSettings;
  merged.weekly_hours = normalizeWeeklyHours(data.weekly_hours, merged);
  merged.kitchen_hours = normalizeKitchenHours(data.kitchen_hours);
  return merged;
}

// Horario en el que la web acepta pedidos. Es independiente del horario de cocina.
export function isBusinessOpenFromSettings(rawSettings: BusinessSettings, date = new Date()) {
  const settings = { ...defaultBusinessSettings, ...rawSettings } as BusinessSettings;
  settings.weekly_hours = normalizeWeeklyHours(rawSettings?.weekly_hours, settings);
  if (settings.manual_pause) return false;
  const { key, hour, minute } = madridParts(date);
  const schedule = settings.weekly_hours[key] || defaultWeeklyHours[key];
  if (schedule.closed) return false;
  const now = hour * 60 + minute;
  return timeInsideWindow(now, minutesFromTime(schedule.open), minutesFromTime(schedule.close));
}

export function isKitchenOpenFromSettings(rawSettings: BusinessSettings, date = new Date()) {
  const settings = { ...defaultBusinessSettings, ...rawSettings } as BusinessSettings;
  settings.kitchen_hours = normalizeKitchenHours(rawSettings?.kitchen_hours);
  const { key, hour, minute } = madridParts(date);
  const day = settings.kitchen_hours[key] || defaultKitchenHours[key];
  if (day.closed) return false;
  const now = hour * 60 + minute;
  return [day.lunch, day.dinner].some((shift) => {
    if (!shift.enabled) return false;
    return timeInsideWindow(now, minutesFromTime(shift.open), minutesFromTime(shift.close));
  });
}

function roundUpToFiveMinutes(date: Date) {
  const next = new Date(date);
  next.setSeconds(0, 0);
  const remainder = next.getMinutes() % 5;
  if (remainder) next.setMinutes(next.getMinutes() + (5 - remainder));
  return next;
}

// Devuelve la primera hora real de recogida posible respetando cocina + preparación.
export function nextKitchenPickupAt(rawSettings: BusinessSettings, from = new Date(), preparationMinutes?: number) {
  const settings = { ...defaultBusinessSettings, ...rawSettings } as BusinessSettings;
  settings.kitchen_hours = normalizeKitchenHours(rawSettings?.kitchen_hours);
  const prep = Math.min(180, Math.max(5, Number(preparationMinutes ?? settings.default_wait_minutes ?? 30)));

  const directCandidate = roundUpToFiveMinutes(new Date(from.getTime() + prep * 60_000));
  if (isKitchenOpenFromSettings(settings, from) && isKitchenOpenFromSettings(settings, directCandidate)) {
    return directCandidate;
  }

  let cursor = roundUpToFiveMinutes(new Date(from));
  const maxSteps = 7 * 24 * 12;
  for (let index = 0; index < maxSteps; index += 1) {
    if (isKitchenOpenFromSettings(settings, cursor)) {
      const candidate = roundUpToFiveMinutes(new Date(cursor.getTime() + prep * 60_000));
      if (isKitchenOpenFromSettings(settings, candidate)) return candidate;
    }
    cursor = new Date(cursor.getTime() + 5 * 60_000);
  }
  return null;
}

export function kitchenHoursLabelFromSettings(rawSettings: BusinessSettings, date = new Date()) {
  const settings = { ...defaultBusinessSettings, ...rawSettings } as BusinessSettings;
  settings.kitchen_hours = normalizeKitchenHours(rawSettings?.kitchen_hours);
  const { key } = madridParts(date);
  const day = settings.kitchen_hours[key] || defaultKitchenHours[key];
  if (day.closed) return 'Cocina cerrada hoy.';
  const shifts = [day.lunch, day.dinner]
    .filter((shift) => shift.enabled)
    .map((shift) => `${shift.open}–${shift.close}`);
  return shifts.length ? `Cocina hoy: ${shifts.join(' y ')}.` : 'Cocina cerrada hoy.';
}

export function businessHoursLabelFromSettings(rawSettings: BusinessSettings, date = new Date()) {
  const settings = { ...defaultBusinessSettings, ...rawSettings } as BusinessSettings;
  settings.weekly_hours = normalizeWeeklyHours(rawSettings?.weekly_hours, settings);
  if (settings.manual_pause) return 'Los pedidos online están pausados temporalmente.';
  const { key } = madridParts(date);
  const schedule = settings.weekly_hours[key] || defaultWeeklyHours[key];
  if (schedule.closed) return `Hoy no se aceptan pedidos online. ${kitchenHoursLabelFromSettings(settings, date)}`;
  return `Aceptamos pedidos online de ${schedule.open} a ${schedule.close}. ${kitchenHoursLabelFromSettings(settings, date)}`;
}

export function isBusinessOpen(date = new Date()) { return isBusinessOpenFromSettings(defaultBusinessSettings, date); }
export function businessHoursLabel(date = new Date()) { return businessHoursLabelFromSettings(defaultBusinessSettings, date); }
