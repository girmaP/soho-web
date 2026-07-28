import { supabase } from './supabaseClient';

export type DayKey = '0' | '1' | '2' | '3' | '4' | '5' | '6';
export type DaySchedule = { open: string; close: string; closed: boolean };
export type WeeklyHours = Record<DayKey, DaySchedule>;
export type BusinessSettings = {
  id: string;
  opening_time: string;
  closing_time: string;
  manual_pause: boolean;
  closed_days: number[];
  weekly_hours: WeeklyHours;
  minimum_order: number;
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
export const defaultBusinessSettings: BusinessSettings = {
  id: 'main', opening_time: '09:00', closing_time: '01:00', manual_pause: false, closed_days: [],
  weekly_hours: defaultWeeklyHours, minimum_order: 0, service_start_date: null, printer_price_per_ticket: 0,
  monthly_management_fee: 0, monthly_hosting_fee: 0, annual_domain_fee: 0,
  fiscal_name: 'SOHO Cambados', fiscal_nif: '', fiscal_address: 'Calle A Mariña, 3, 36630 Cambados, Pontevedra', admin_email: 'cambadossoho@gmail.com'
};

function validTime(value: unknown, fallback: string) {
  const text = typeof value === 'string' ? value.trim() : '';
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : fallback;
}
function minutesFromTime(value: unknown) {
  const [hours, minutes] = validTime(value, '00:00').split(':').map(Number);
  return hours * 60 + minutes;
}
function normalize(raw: unknown, fallback: BusinessSettings = defaultBusinessSettings): WeeklyHours {
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
function madridParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date);
  const weekday = parts.find((part) => part.type === 'weekday')?.value || 'Sun';
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);
  const map: Record<string, DayKey> = { Sun: '0', Mon: '1', Tue: '2', Wed: '3', Thu: '4', Fri: '5', Sat: '6' };
  return { key: map[weekday] || '0', hour, minute };
}

export async function getBusinessSettings(): Promise<BusinessSettings> {
  const { data, error } = await supabase.from('business_settings').select('*').eq('id', 'main').maybeSingle();
  if (error || !data) return defaultBusinessSettings;
  const merged = {
    ...defaultBusinessSettings, ...data,
    opening_time: validTime(data.opening_time, defaultBusinessSettings.opening_time),
    closing_time: validTime(data.closing_time, defaultBusinessSettings.closing_time),
    manual_pause: Boolean(data.manual_pause), closed_days: Array.isArray(data.closed_days) ? data.closed_days : [],
    minimum_order: Number(data.minimum_order || 0), printer_price_per_ticket: Number(data.printer_price_per_ticket || 0),
    monthly_management_fee: Number(data.monthly_management_fee || 0), monthly_hosting_fee: Number(data.monthly_hosting_fee || 0),
    annual_domain_fee: Number(data.annual_domain_fee || 0)
  } as BusinessSettings;
  merged.weekly_hours = normalize(data.weekly_hours, merged);
  return merged;
}
export function isBusinessOpenFromSettings(rawSettings: BusinessSettings, date = new Date()) {
  const settings = { ...defaultBusinessSettings, ...rawSettings } as BusinessSettings;
  settings.weekly_hours = normalize(rawSettings?.weekly_hours, settings);
  if (settings.manual_pause) return false;
  const { key, hour, minute } = madridParts(date);
  const schedule = settings.weekly_hours[key] || defaultWeeklyHours[key];
  if (schedule.closed) return false;
  const now = hour * 60 + minute;
  const open = minutesFromTime(schedule.open);
  const close = minutesFromTime(schedule.close);
  return close < open ? now >= open || now <= close : now >= open && now <= close;
}
export function businessHoursLabelFromSettings(rawSettings: BusinessSettings, date = new Date()) {
  const settings = { ...defaultBusinessSettings, ...rawSettings } as BusinessSettings;
  settings.weekly_hours = normalize(rawSettings?.weekly_hours, settings);
  if (settings.manual_pause) return 'Los pedidos online están pausados temporalmente.';
  const { key } = madridParts(date);
  const schedule = settings.weekly_hours[key] || defaultWeeklyHours[key];
  if (schedule.closed) return 'Hoy no se aceptan pedidos online.';
  return `Hoy aceptamos pedidos de ${schedule.open} a ${schedule.close}.`;
}
export function isBusinessOpen(date = new Date()) { return isBusinessOpenFromSettings(defaultBusinessSettings, date); }
export function businessHoursLabel(date = new Date()) { return businessHoursLabelFromSettings(defaultBusinessSettings, date); }
