export type RangePreset = '15d' | '30d' | '3m' | '6m' | '1y' | 'custom';
export type DateRange = { preset: RangePreset; from: string; to: string };

export const RANGE_OPTIONS: { value: RangePreset; label: string }[] = [
  { value: '15d', label: 'Últimos 15 días' },
  { value: '30d', label: 'Últimos 30 días' },
  { value: '3m', label: 'Últimos 3 meses' },
  { value: '6m', label: 'Últimos 6 meses' },
  { value: '1y', label: 'Último año' },
  { value: 'custom', label: 'Rango personalizado' }
];

export function dateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function presetRange(preset: RangePreset, now = new Date()): DateRange {
  const to = new Date(now); to.setHours(23, 59, 59, 999);
  const from = new Date(to); from.setHours(0, 0, 0, 0);
  if (preset === '15d') from.setDate(from.getDate() - 14);
  if (preset === '30d') from.setDate(from.getDate() - 29);
  if (preset === '3m') from.setMonth(from.getMonth() - 3);
  if (preset === '6m') from.setMonth(from.getMonth() - 6);
  if (preset === '1y') from.setFullYear(from.getFullYear() - 1);
  return { preset, from: dateInput(from), to: dateInput(to) };
}

export function rangeBounds(range: DateRange) {
  const from = new Date(`${range.from}T00:00:00`);
  const to = new Date(`${range.to}T23:59:59.999`);
  return { from, to };
}

export function filterOrdersByRange(orders: any[], range: DateRange) {
  const { from, to } = rangeBounds(range);
  return orders.filter((order) => {
    const date = new Date(order.created_at);
    return date >= from && date <= to;
  });
}

export function aggregateOrders(orders: any[], range: DateRange) {
  const filtered = filterOrdersByRange(orders, range);
  const { from, to } = rangeBounds(range);
  const spanDays = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000) + 1);
  const group: 'day' | 'week' | 'month' = spanDays <= 45 ? 'day' : spanDays <= 190 ? 'week' : 'month';
  const map = new Map<string, any>();

  for (const order of filtered) {
    const d = new Date(order.created_at);
    let key: string;
    let label: string;
    if (group === 'month') {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      label = d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
    } else if (group === 'week') {
      const monday = new Date(d); const day = (monday.getDay() + 6) % 7; monday.setDate(monday.getDate() - day);
      key = dateInput(monday); label = `Sem. ${monday.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}`;
    } else {
      key = dateInput(d); label = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    }
    const row = map.get(key) || { key, label, orders: 0, validOrders: 0, revenue: 0, cancelled: 0 };
    row.orders += 1;
    if (order.status === 'cancelled') row.cancelled += 1;
    else { row.validOrders += 1; row.revenue += Number(order.total_price || 0); }
    map.set(key, row);
  }

  const rows = Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key)).map((r) => ({ ...r, averageTicket: r.validOrders ? r.revenue / r.validOrders : 0 }));
  return { rows, filtered, group };
}
