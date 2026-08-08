export type RangePreset = '15d' | '30d' | '3m' | '6m' | '1y' | 'custom';
export type DateRange = { preset: RangePreset; from: string; to: string };
export type DashboardAnalysis = 'orders-hour' | 'orders-weekday' | 'orders-date' | 'revenue-hour' | 'revenue-date' | 'products' | 'categories' | 'ticket' | 'refunds' | 'cancellations' | 'preparation' | 'comparison';

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
    const captured = ['paid', 'refund_pending', 'refunded'].includes(order.payment_status);
    if (order.status === 'cancelled' || order.payment_status === 'cancelled') row.cancelled += 1;
    else if (captured) {
      const refund = order.payment_status === 'refunded' ? Math.min(Number(order.total_price || 0), Number(order.refunded_amount ?? order.total_price ?? 0)) : 0;
      const net = Math.max(0, Number(order.total_price || 0) - refund);
      if (net > 0) row.validOrders += 1;
      row.revenue += net;
    }
    map.set(key, row);
  }

  const rows = Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key)).map((r) => ({ ...r, averageTicket: r.validOrders ? r.revenue / r.validOrders : 0 }));
  return { rows, filtered, group };
}


const CAPTURED_PAYMENT_STATUSES = new Set(['paid', 'refund_pending', 'refunded']);
const WEEKDAY_LABELS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function netOrderRevenue(order: any) {
  if (!CAPTURED_PAYMENT_STATUSES.has(order.payment_status)) return 0;
  const total = Number(order.total_price || 0);
  const refunded = order.payment_status === 'refunded'
    ? Math.min(total, Number(order.refunded_amount ?? total))
    : 0;
  return Math.max(0, total - refunded);
}

function previousEquivalentRange(range: DateRange): DateRange {
  const { from, to } = rangeBounds(range);
  const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000) + 1);
  const previousTo = new Date(from); previousTo.setDate(previousTo.getDate() - 1);
  const previousFrom = new Date(previousTo); previousFrom.setDate(previousFrom.getDate() - days + 1);
  return { preset: 'custom', from: dateInput(previousFrom), to: dateInput(previousTo) };
}

export function buildDashboardAnalytics(orders: any[], range: DateRange, products: any[] = [], categories: any[] = []) {
  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));
  const productCategoryById = new Map(products.map((product) => [product.id, categoryNameById.get(product.category_id) || 'Sin categoría']));
  const selected = filterOrdersByRange(orders, range);
  const captured = selected.filter((order) => CAPTURED_PAYMENT_STATUSES.has(order.payment_status) && order.status !== 'cancelled');
  const cancelled = selected.filter((order) => order.status === 'cancelled' || order.payment_status === 'cancelled');
  const refunded = captured.filter((order) => order.payment_status === 'refunded');
  const authorized = selected.filter((order) => order.payment_status === 'authorized');
  const netCaptured = captured.filter((order) => netOrderRevenue(order) > 0);
  const netRevenue = captured.reduce((sum, order) => sum + netOrderRevenue(order), 0);
  const grossRevenue = captured.reduce((sum, order) => sum + Number(order.total_price || 0), 0);
  const refundAmount = refunded.reduce((sum, order) => sum + Math.min(Number(order.total_price || 0), Number(order.refunded_amount ?? order.total_price ?? 0)), 0);

  const hourMap = new Map<number, { orders: number; revenue: number }>();
  const weekdayMap = new Map<number, { orders: number; revenue: number }>();
  const dateMap = new Map<string, { orders: number; revenue: number }>();
  const productMap = new Map<string, { quantity: number; revenue: number }>();
  const categoryMap = new Map<string, { quantity: number; revenue: number }>();
  const preparationMinutes: number[] = [];

  captured.forEach((order) => {
    const date = new Date(order.created_at);
    const hour = date.getHours();
    const weekday = date.getDay();
    const day = dateInput(date);
    const revenue = netOrderRevenue(order);
    const hourValue = hourMap.get(hour) || { orders: 0, revenue: 0 }; hourValue.orders += 1; hourValue.revenue += revenue; hourMap.set(hour, hourValue);
    const weekdayValue = weekdayMap.get(weekday) || { orders: 0, revenue: 0 }; weekdayValue.orders += 1; weekdayValue.revenue += revenue; weekdayMap.set(weekday, weekdayValue);
    const dateValue = dateMap.get(day) || { orders: 0, revenue: 0 }; dateValue.orders += 1; dateValue.revenue += revenue; dateMap.set(day, dateValue);
    if (revenue > 0) order.order_items?.forEach((item: any) => {
      const name = item.product_name || 'Sin nombre';
      const product = productMap.get(name) || { quantity: 0, revenue: 0 };
      product.quantity += Number(item.quantity || 0); product.revenue += Number(item.total_price || 0); productMap.set(name, product);
      const category = item.category_name || item.category || productCategoryById.get(item.product_id) || 'Sin categoría';
      const categoryValue = categoryMap.get(category) || { quantity: 0, revenue: 0 };
      categoryValue.quantity += Number(item.quantity || 0); categoryValue.revenue += Number(item.total_price || 0); categoryMap.set(category, categoryValue);
    });
    const start = order.accepted_at || order.created_at;
    const end = order.ready_at || order.updated_at;
    if (start && end && ['ready', 'delivered'].includes(order.status)) {
      const minutes = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
      if (minutes >= 0 && minutes <= 360) preparationMinutes.push(minutes);
    }
  });

  const byHour = Array.from({ length: 24 }, (_, hour) => ({ key: String(hour), label: `${String(hour).padStart(2, '0')}:00`, ...(hourMap.get(hour) || { orders: 0, revenue: 0 }) }));
  const byWeekday = [1,2,3,4,5,6,0].map((day) => ({ key: String(day), label: WEEKDAY_LABELS[day], ...(weekdayMap.get(day) || { orders: 0, revenue: 0 }) }));
  const byDate = Array.from(dateMap.entries()).map(([key, value]) => ({ key, label: new Date(`${key}T12:00:00`).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }), ...value })).sort((a,b) => a.key.localeCompare(b.key));
  const productStats = Array.from(productMap.entries()).map(([name, value]) => ({ key: name, label: name, ...value })).sort((a,b) => b.quantity-a.quantity).slice(0,10);
  const categoryStats = Array.from(categoryMap.entries()).map(([name, value]) => ({ key: name, label: name, ...value })).sort((a,b) => b.quantity-a.quantity).slice(0,10);

  const previousRange = previousEquivalentRange(range);
  const previousOrders = filterOrdersByRange(orders, previousRange).filter((order) => CAPTURED_PAYMENT_STATUSES.has(order.payment_status) && order.status !== 'cancelled' && netOrderRevenue(order) > 0);
  const previousRevenue = previousOrders.reduce((sum, order) => sum + netOrderRevenue(order), 0);
  const percentChange = (current: number, previous: number) => previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
  const peak = <T extends { orders: number; revenue: number }>(rows: T[], key: 'orders'|'revenue') => rows.reduce((best, row) => row[key] > best[key] ? row : best, rows[0] || ({ orders: 0, revenue: 0 } as T));

  return {
    selected, captured, cancelled, refunded, authorized,
    grossRevenue, refundAmount, netRevenue,
    averageTicket: netCaptured.length ? netRevenue / netCaptured.length : 0,
    refundRate: captured.length ? (refunded.length / captured.length) * 100 : 0,
    cancellationRate: selected.length ? (cancelled.length / selected.length) * 100 : 0,
    byHour, byWeekday, byDate, products: productStats, categories: categoryStats,
    peakHourOrders: peak(byHour, 'orders'), peakHourRevenue: peak(byHour, 'revenue'),
    peakWeekday: peak(byWeekday, 'orders'), peakDateOrders: peak(byDate, 'orders'), peakDateRevenue: peak(byDate, 'revenue'),
    preparation: {
      average: preparationMinutes.length ? preparationMinutes.reduce((a,b)=>a+b,0)/preparationMinutes.length : null,
      minimum: preparationMinutes.length ? Math.min(...preparationMinutes) : null,
      maximum: preparationMinutes.length ? Math.max(...preparationMinutes) : null,
      sample: preparationMinutes.length
    },
    comparison: {
      previousRange,
      orders: netCaptured.length,
      previousOrders: previousOrders.length,
      ordersChange: percentChange(netCaptured.length, previousOrders.length),
      revenue: netRevenue,
      previousRevenue,
      revenueChange: percentChange(netRevenue, previousRevenue)
    }
  };
}
