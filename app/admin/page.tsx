'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutDashboard, ClipboardList, Mail, CalendarDays, History, Package, Clock3, Pencil, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { AdminOrderCard } from '@/components/AdminOrderCard';
import { NewOrderAlert } from '@/components/NewOrderAlert';
import { formatPrice } from '@/utils/formatPrice';
import { BusinessSettings, businessHoursLabelFromSettings, defaultBusinessSettings, getBusinessSettings, isBusinessOpenFromSettings, orderedDays } from '@/lib/businessConfig';
import { RangeSelector } from '@/components/RangeSelector';
import { DashboardAnalysis, DateRange, aggregateOrders, buildDashboardAnalytics, filterOrdersByRange, presetRange } from '@/lib/reporting';
import { isHiddenCatalogCategory, resolvedProductImage } from '@/lib/catalogPresentation';
import { withEffectiveOrderStatus } from '@/lib/orderAutomation';

type AdminSection = 'dashboard' | 'orders' | 'messages' | 'day' | 'history' | 'products' | 'settings';
type StatusFilter = 'all' | 'pending' | 'accepted' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'accepted', label: 'Aceptados' },
  { value: 'preparing', label: 'Preparando' },
  { value: 'ready', label: 'Listos' },
  { value: 'delivered', label: 'Entregados' },
  { value: 'cancelled', label: 'Cancelados' }
];

const stateLabels: Record<string, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptado',
  preparing: 'Preparando',
  ready: 'Listo',
  delivered: 'Entregado',
  cancelled: 'Cancelado'
};

function todayInputValue() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function inputValueFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function last90Days() {
  return Array.from({ length: 90 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - index);
    return inputValueFromDate(date);
  });
}

function dayLabel(inputDate: string) {
  const [year, month, day] = inputDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: '2-digit',
    month: 'long'
  });
}

function sameLocalDay(dateString: string, inputDate: string) {
  if (!dateString || !inputDate) return false;
  const date = new Date(dateString);
  const [year, month, day] = inputDate.split('-').map(Number);
  return date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day;
}

function csvEscape(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function isNetSaleOrder(order: any) {
  if (order.status === 'cancelled' || !['paid', 'refund_pending', 'refunded'].includes(order.payment_status)) return false;
  const total = Number(order.total_price || 0);
  const refunded = order.payment_status === 'refunded' ? Math.min(total, Number(order.refunded_amount ?? total)) : 0;
  return total - refunded > 0;
}

function revenue(list: any[]) {
  return list.reduce((sum, order) => {
    if (order.status === 'cancelled' || !['paid', 'refund_pending', 'refunded'].includes(order.payment_status)) return sum;
    const total = Number(order.total_price || 0);
    const refunded = order.payment_status === 'refunded' ? Math.min(total, Number(order.refunded_amount ?? total)) : 0;
    return sum + Math.max(0, total - refunded);
  }, 0);
}

function productStats(list: any[]) {
  const productMap = new Map<string, { name: string; quantity: number; total: number }>();

  list.forEach((order) => {
    if (!isNetSaleOrder(order)) return;

    order.order_items?.forEach((item: any) => {
      const current = productMap.get(item.product_name) || { name: item.product_name, quantity: 0, total: 0 };
      current.quantity += Number(item.quantity || 0);
      current.total += Number(item.total_price || 0);
      productMap.set(item.product_name, current);
    });
  });

  return Array.from(productMap.values()).sort((a, b) => b.quantity - a.quantity);
}


function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}

function DashboardBars({ title, data, range, onRange, valueKey, money = false, color }: any) {
  const width = 720;
  const height = 300;
  const margin = { top: 20, right: 20, bottom: 54, left: 66 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const values = data.map((row: any) => Number(row[valueKey] || 0));
  const rawMax = Math.max(0, ...values);
  const max = rawMax > 0 ? rawMax * 1.12 : 1;
  const ticks = 4;
  const slot = data.length ? chartWidth / data.length : chartWidth;
  const barWidth = Math.max(10, Math.min(46, slot * 0.58));
  const axisColor = '#94a3b8';
  const barColor = color?.includes('sky') ? '#0ea5e9' : '#10b981';

  return <div className="rounded-[28px] border border-black/10 bg-white p-6 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-black">{title}</h2>{range && onRange && <RangeSelector compact value={range} onChange={onRange} />}</div>
    <div className="mt-6 rounded-3xl bg-[#f8fafc] p-3">
      {!data.length ? <div className="grid h-72 place-items-center text-sm font-bold text-slate-500">Sin datos en este periodo.</div> :
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={title}>
        <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + chartHeight} stroke={axisColor} strokeWidth="1.5" />
        <line x1={margin.left} y1={margin.top + chartHeight} x2={margin.left + chartWidth} y2={margin.top + chartHeight} stroke={axisColor} strokeWidth="1.5" />
        {Array.from({ length: ticks + 1 }).map((_, index) => {
          const value = (max / ticks) * index;
          const y = margin.top + chartHeight - (value / max) * chartHeight;
          return <g key={index}><line x1={margin.left} y1={y} x2={margin.left + chartWidth} y2={y} stroke="#e2e8f0" strokeWidth="1" /><text x={margin.left - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">{money ? `${value.toFixed(value >= 100 ? 0 : 1)} €` : Math.round(value)}</text></g>;
        })}
        {data.map((row: any, index: number) => {
          const value = Number(row[valueKey] || 0);
          const x = margin.left + slot * index + slot / 2;
          const barHeight = rawMax === 0 ? 0 : (value / max) * chartHeight;
          const y = margin.top + chartHeight - barHeight;
          const showLabel = data.length <= 16 || index % Math.ceil(data.length / 12) === 0 || index === data.length - 1;
          return <g key={row.key}>
            <title>{`${row.label}: ${money ? formatPrice(value) : `${value} pedidos`}`}</title>
            <rect x={x - barWidth / 2} y={y} width={barWidth} height={Math.max(value > 0 ? 3 : 0, barHeight)} rx="7" fill={barColor} />
            {showLabel && <text x={x} y={margin.top + chartHeight + 22} textAnchor="middle" fontSize="10" fill="#64748b">{row.label}</text>}
          </g>;
        })}
        <text x={margin.left + chartWidth / 2} y={height - 5} textAnchor="middle" fontSize="12" fontWeight="700" fill="#475569">Tiempo</text>
        <text x="15" y={margin.top + chartHeight / 2} transform={`rotate(-90 15 ${margin.top + chartHeight / 2})`} textAnchor="middle" fontSize="12" fontWeight="700" fill="#475569">{money ? 'Ingresos (€)' : 'Cantidad de pedidos'}</text>
      </svg>}
    </div>
  </div>;
}

export default function AdminPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageSearch, setMessageSearch] = useState('');
  const [messageView, setMessageView] = useState<'pending' | 'read'>('pending');
  const [dashboardRange, setDashboardRange] = useState<DateRange>(presetRange('3m'));
  const [dashboardAnalysis, setDashboardAnalysis] = useState<DashboardAnalysis>('orders-hour');
  const [revenueRange, setRevenueRange] = useState<DateRange>(presetRange('3m'));
  const [ordersRange, setOrdersRange] = useState<DateRange>(presetRange('3m'));
  const [ticketRange, setTicketRange] = useState<DateRange>(presetRange('3m'));
  const [productsRange, setProductsRange] = useState<DateRange>(presetRange('3m'));
  const [historyRange, setHistoryRange] = useState<DateRange>(presetRange('3m'));
  const [historyTab, setHistoryTab] = useState<'orders' | 'reports'>('orders');
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [section, setSection] = useState<AdminSection>('orders');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [productAvailabilityFilter, setProductAvailabilityFilter] = useState<'all' | 'available' | 'unavailable' | 'recommended'>('all');
  const [savingProductId, setSavingProductId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(todayInputValue());
  const [settings, setSettings] = useState<BusinessSettings>(defaultBusinessSettings);
  const [savingSettings, setSavingSettings] = useState(false);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());

  async function checkAdmin(userId: string) {
    const result = await withTimeout(
      Promise.resolve(
        supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle()
      ),
      6000,
      { data: null, error: new Error('Tiempo de espera agotado comprobando admin') } as any
    );

    if (result.error) {
      console.error('No se pudo comprobar el usuario admin:', result.error.message);
      setError('No se ha podido validar tu acceso. Inténtalo de nuevo o contacta con el responsable de la web.');
      return false;
    }

    return Boolean(result.data?.user_id);
  }

  async function loadSession() {
    try {
      const tabAuthenticated = typeof window !== 'undefined' && window.sessionStorage.getItem('soho_admin_authenticated') === '1';
      if (!tabAuthenticated) {
        await supabase.auth.signOut();
        setSession(null);
        setIsAdmin(false);
        return false;
      }
      const result = await withTimeout(
        supabase.auth.getSession(),
        6000,
        { data: { session: null }, error: new Error('Tiempo de espera agotado cargando sesión') } as any
      );

      if (result.error) {
        console.error('No se pudo cargar sesión:', result.error.message);
        setError('No se pudo validar la sesión. Inicia sesión de nuevo.');
      }

      const currentSession = result.data.session;
      setSession(currentSession);

      if (!currentSession?.user?.id) {
        setIsAdmin(false);
        return false;
      }

      const allowed = await checkAdmin(currentSession.user.id);
      setIsAdmin(allowed);

      if (!allowed) {
        await supabase.auth.signOut();
        setSession(null);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error validando acceso admin:', err);
      setSession(null);
      setIsAdmin(false);
      setError('No se pudo validar el acceso. Vuelve a iniciar sesión.');
      return false;
    } finally {
      setAuthReady(true);
    }
  }


  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) return setError(error.message);

      const userId = data.session?.user?.id;
      if (!userId || !(await checkAdmin(userId))) {
        await supabase.auth.signOut();
        setSession(null);
        setIsAdmin(false);
        return setError('Esta cuenta no tiene permisos para acceder al panel.');
      }

      window.sessionStorage.setItem('soho_admin_authenticated', '1');
      setSession(data.session);
      setIsAdmin(true);
      await Promise.all([loadOrders(), loadMessages(), loadProducts(), loadCategories(), loadSettings()]);
    } catch (err: any) {
      console.error('Error iniciando sesión:', err);
      setError(err?.message || 'No se pudo iniciar sesión en este momento. Inténtalo de nuevo en unos segundos.');
    }
  }

  async function logout() {
    window.sessionStorage.removeItem('soho_admin_authenticated');
    await supabase.auth.signOut();
    setSession(null);
    setIsAdmin(false);
  }

  async function loadOrders() {
    const from = new Date();
    from.setFullYear(from.getFullYear() - 1);
    from.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .gte('created_at', from.toISOString())
      .or('payment_status.in.(authorized,paid,refund_pending,refunded),stripe_payment_intent_id.not.is.null')
      .order('created_at', { ascending: false })
      .limit(10000);

    if (error) console.error(error);
    const list = (data || []).map((order: any) => withEffectiveOrderStatus(order));
    list.forEach((order: any) => knownOrderIdsRef.current.add(order.id));
    setOrders(list);
  }

  async function loadMessages() {
    const { error: cleanupError } = await supabase.rpc('cleanup_read_contact_messages_older_than_15_days');
    if (cleanupError) console.warn('No se pudo limpiar mensajes leídos antiguos:', cleanupError.message);
    const { data, error } = await supabase.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(500);
    if (error) console.error(error);
    setMessages(data || []);
  }

  async function markMessage(id: string, read: boolean) {
    const nowIso = new Date().toISOString();
    const { error } = await supabase.from('contact_messages').update({ read, read_at: read ? nowIso : null, updated_at: nowIso }).eq('id', id);
    if (error) alert(error.message);
    await loadMessages();
  }

  async function deleteMessage(id: string) {
    if (!confirm('¿Eliminar este mensaje?')) return;
    const { error } = await supabase.from('contact_messages').delete().eq('id', id);
    if (error) alert(error.message);
    await loadMessages();
  }

  function cleanPhone(phone: string) {
    const digits = String(phone || '').replace(/\D/g, '');
    return digits.startsWith('34') ? digits : (digits.length === 9 ? `34${digits}` : digits);
  }

  async function loadProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(name)')
      .order('name', { ascending: true });

    if (error) console.error(error);
    setProducts((data || []).filter((product: any) => !isHiddenCatalogCategory(product.categories?.name)));
  }


  async function loadCategories() {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error(error);
      setCategories([]);
      return;
    }

    setCategories((data || []).filter((category: any) => !isHiddenCatalogCategory(category.name)));
  }

  async function loadSettings() {
    const data = await getBusinessSettings();
    setSettings(data);
  }

  async function saveSettings() {
    setSavingSettings(true);
    const { error } = await supabase
      .from('business_settings')
      .upsert({
        id: 'main',
        opening_time: settings.weekly_hours?.['1']?.open || settings.opening_time,
        closing_time: settings.weekly_hours?.['1']?.close || settings.closing_time,
        manual_pause: settings.manual_pause,
        closed_days: orderedDays.filter((d) => settings.weekly_hours?.[d.key]?.closed).map((d) => d.day),
        weekly_hours: settings.weekly_hours,
        minimum_order: settings.minimum_order,
        default_wait_minutes: settings.default_wait_minutes,
        service_start_date: settings.service_start_date || null,
        printer_price_per_ticket: settings.printer_price_per_ticket,
        monthly_management_fee: settings.monthly_management_fee,
        monthly_hosting_fee: settings.monthly_hosting_fee,
        annual_domain_fee: settings.annual_domain_fee,
        fiscal_name: settings.fiscal_name,
        fiscal_nif: settings.fiscal_nif,
        fiscal_address: settings.fiscal_address,
        admin_email: settings.admin_email,
        updated_at: new Date().toISOString()
      });

    if (error) alert(error.message);
    else await loadSettings();
    setSavingSettings(false);
  }


  function patchDay(dayKey: string, patch: Record<string, any>) {
    setSettings({
      ...settings,
      weekly_hours: {
        ...settings.weekly_hours,
        [dayKey]: { ...(settings.weekly_hours as any)[dayKey], ...patch }
      }
    });
  }


  async function updateOrder(id: string, status: string, estimatedTime?: number | null, cancellationReason?: string | null) {
    const { data: authData } = await supabase.auth.getSession();
    const accessToken = authData.session?.access_token;
    if (!accessToken) {
      alert('La sesión ha caducado. Inicia sesión de nuevo.');
      await logout();
      return;
    }

    const response = await fetch(`/api/admin/orders/${id}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        status,
        estimatedTime: estimatedTime ?? null,
        cancellationReason: status === 'cancelled' ? (cancellationReason || 'Pedido cancelado por SOHO Cambados.') : null
      })
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      alert(result?.error || 'No se pudo actualizar el pedido.');
      return;
    }
    await loadOrders();
  }

  async function toggleProduct(id: string, available: boolean) {
    const { error } = await supabase.from('products').update({ available: !available }).eq('id', id);
    if (error) alert('No se pudo cambiar la disponibilidad del producto.');
    await loadProducts();
  }

  async function uploadProductImage(productId: string, file: File) {
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    if (!allowedTypes.includes(file.type)) {
      alert('Formato no compatible. Usa JPG, PNG, WEBP o AVIF.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      alert('La imagen supera los 8 MB. Reduce su tamaño antes de subirla.');
      return;
    }

    setSavingProductId(productId);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase();
      const path = `products/${productId}/${Date.now()}-${safeName.replace(/\.[^.]+$/, '')}.${ext}`;
      const { error } = await supabase.storage.from('product-images').upload(path, file, {
        upsert: false,
        contentType: file.type,
        cacheControl: '31536000'
      });
      if (error) throw error;
      const { data } = supabase.storage.from('product-images').getPublicUrl(path);
      if (!data.publicUrl) throw new Error('No se pudo obtener la URL pública de la imagen.');

      const { error: updateError } = await supabase.from('products').update({ image_url: data.publicUrl }).eq('id', productId);
      if (updateError) throw updateError;
      patchProduct(productId, { image_url: data.publicUrl });
      await loadProducts();
    } catch (uploadError: any) {
      alert(uploadError?.message || 'No se pudo subir la imagen. Inténtalo de nuevo.');
    } finally {
      setSavingProductId(null);
    }
  }

  async function updateProduct(product: any) {
    const imageUrl = String(product.image_url || '').trim();
    if (imageUrl && !/^https?:\/\//i.test(imageUrl) && !imageUrl.startsWith('/')) {
      alert('La imagen debe ser un enlace web válido (https://...) o una imagen subida desde el dispositivo.');
      return;
    }
    setSavingProductId(product.id);
    const { error } = await supabase
      .from('products')
      .update({
        name: product.name,
        description: product.description || '',
        price: Number(product.price || 0),
        image_url: imageUrl || null,
        category_id: product.category_id || null,
        available: Boolean(product.available),
        recommended: Boolean(product.recommended),
        vat_rate: Number(product.vat_rate || 10)
      })
      .eq('id', product.id);

    if (error) alert('No se pudieron guardar los cambios del producto.');
    setSavingProductId(null);
    await loadProducts();
  }


  async function setRecommendedProduct(id: string) {
    const { error: clearError } = await supabase.from('products').update({ recommended: false }).neq('id', id);
    if (clearError) alert('No se pudo actualizar el producto recomendado.');

    const { error } = await supabase.from('products').update({ recommended: true }).eq('id', id);
    if (error) alert('No se pudo actualizar el producto recomendado.');
    await loadProducts();
  }

  // La inicialización se ejecuta una sola vez; las funciones usan el estado actual del cliente Supabase.
  useEffect(() => {
    loadSession()
      .then(async (allowed) => {
        if (!allowed) return;
        await Promise.all([loadOrders(), loadMessages(), loadProducts(), loadCategories(), loadSettings()]);
      })
      .catch((err) => {
        console.error('Error inicializando panel admin:', err);
        setAuthReady(true);
        setError('No se pudo inicializar el panel. Revisa la conexión con Supabase.');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel('admin-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload: any) => {
        if (payload.eventType === 'INSERT' && payload.new?.id) knownOrderIdsRef.current.add(payload.new.id);
        loadOrders();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => loadOrders())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => loadProducts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_messages' }, () => loadMessages())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_settings' }, () => loadSettings())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => {
      setOrders((current) => current.map((order) => withEffectiveOrderStatus(order)));
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [session]);

  const todayOrders = useMemo(() => {
    return orders.filter((order) => sameLocalDay(order.created_at, todayInputValue()));
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return todayOrders.filter((order) => {
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      const matchesSearch =
        !query ||
        order.customer_name?.toLowerCase().includes(query) ||
        order.customer_phone?.toLowerCase().includes(query) ||
        order.notes?.toLowerCase().includes(query) ||
        order.order_items?.some((item: any) => item.product_name?.toLowerCase().includes(query));

      return matchesStatus && matchesSearch;
    });
  }, [todayOrders, search, statusFilter]);

  const statusCounts = useMemo(() => {
    return statusFilters.reduce((acc, filter) => {
      acc[filter.value] = filter.value === 'all'
        ? todayOrders.length
        : todayOrders.filter((order) => order.status === filter.value).length;
      return acc;
    }, {} as Record<StatusFilter, number>);
  }, [todayOrders]);


  const dayOrders = useMemo(() => orders.filter((order) => sameLocalDay(order.created_at, selectedDay)), [orders, selectedDay]);

  const daySummary = useMemo(() => {
    const validOrders = dayOrders.filter(isNetSaleOrder);
    const total = revenue(dayOrders);
    const topProducts = productStats(dayOrders);
    const pickupOrders = dayOrders.filter((order) => order.order_type === 'pickup').length;
    const deliveryOrders = dayOrders.filter((order) => order.order_type === 'delivery').length;

    return {
      orders: dayOrders.length,
      validOrders: validOrders.length,
      cancelled: dayOrders.filter((order) => order.status === 'cancelled').length,
      pending: dayOrders.filter((order) => order.status === 'pending').length,
      completed: dayOrders.filter((order) => ['ready', 'delivered'].includes(order.status)).length,
      revenue: total,
      averageTicket: validOrders.length ? total / validOrders.length : 0,
      topProduct: topProducts[0],
      topProducts,
      pickupOrders,
      deliveryOrders
    };
  }, [dayOrders]);


  const analytics = useMemo(() => {
    const validOrders = orders.filter(isNetSaleOrder);
    const totalRevenue = revenue(orders);
    const topProducts = productStats(orders).slice(0, 8);

    return {
      totalOrders: orders.length,
      cancelledOrders: orders.filter((order) => order.status === 'cancelled').length,
      deliveredOrders: orders.filter((order) => order.status === 'delivered').length,
      activeOrders: orders.filter((order) => !['cancelled', 'delivered'].includes(order.status)).length,
      revenue: totalRevenue,
      averageTicket: validOrders.length ? totalRevenue / validOrders.length : 0,
      topProducts
    };
  }, [orders]);

  const pendingMessages = useMemo(() => messages.filter((message) => !message.read), [messages]);
  const readMessages = useMemo(() => messages.filter((message) => message.read), [messages]);

  const filteredMessages = useMemo(() => {
    const query = messageSearch.trim().toLowerCase();
    const source = messageView === 'pending' ? pendingMessages : readMessages;
    return source.filter((message) => !query || message.name?.toLowerCase().includes(query) || message.email?.toLowerCase().includes(query) || message.phone?.toLowerCase().includes(query) || message.message?.toLowerCase().includes(query));
  }, [pendingMessages, readMessages, messageSearch, messageView]);

  const dashboardData = useMemo(() => aggregateOrders(orders, dashboardRange), [orders, dashboardRange]);
  const dashboardAnalytics = useMemo(() => buildDashboardAnalytics(orders, dashboardRange, products, categories), [orders, dashboardRange, products, categories]);
  const revenueData = useMemo(() => aggregateOrders(orders, revenueRange), [orders, revenueRange]);
  const ordersData = useMemo(() => aggregateOrders(orders, ordersRange), [orders, ordersRange]);
  const ticketData = useMemo(() => aggregateOrders(orders, ticketRange), [orders, ticketRange]);
  const productsData = useMemo(() => productStats(filterOrdersByRange(orders, productsRange)).slice(0, 8), [orders, productsRange]);
  const historyOrders = useMemo(() => filterOrdersByRange(orders, historyRange), [orders, historyRange]);
  const historyDays = useMemo(() => {
    const grouped = new Map<string, any[]>();
    historyOrders.forEach((order) => { const key = inputValueFromDate(new Date(order.created_at)); grouped.set(key, [...(grouped.get(key) || []), order]); });
    return Array.from(grouped.entries()).sort((a,b) => b[0].localeCompare(a[0])).map(([day,list]) => {
      const valid = list.filter(isNetSaleOrder); const total = revenue(list); const top = productStats(list)[0];
      return { day, label: dayLabel(day), orders:list.length, revenue:total, averageTicket:valid.length?total/valid.length:0, topProduct:top?.name||'Sin datos', completed:list.filter((o)=>['ready','delivered'].includes(o.status)).length };
    });
  }, [historyOrders]);


  async function downloadManagementPdf() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return alert('La sesión ha caducado.');
    const query = new URLSearchParams({ from: historyRange.from, to: historyRange.to });
    const response = await fetch(`/api/admin/reports/activity.pdf?${query}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) { const result = await response.json().catch(() => null); return alert(result?.error || 'No se pudo generar el PDF.'); }
    const blob = await response.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `informe-soho-${historyRange.from}-${historyRange.to}.pdf`; a.click(); URL.revokeObjectURL(url);
  }

  function exportRangeCsv() {
    const list = historyOrders;
    const rows = [['Nº pedido','Fecha y hora','Tipo','Estado','Estado pago','Nº artículos','Total IVA incluido','Productos'], ...list.map((order:any)=>[
      order.id, new Date(order.created_at).toLocaleString('es-ES'), order.order_type === 'pickup' ? 'Recogida' : 'Domicilio', stateLabels[order.status] || order.status,
      order.payment_status, order.order_items?.reduce((sum:number,item:any)=>sum+Number(item.quantity||0),0) || 0, Number(order.total_price||0).toFixed(2),
      order.order_items?.map((item:any)=>`${item.quantity}x ${item.product_name}`).join(' | ') || ''
    ])];
    downloadCsv(rows, `historial-soho-${historyRange.from}-${historyRange.to}.csv`);
  }

  const filteredAdminProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch = !query || product.name?.toLowerCase().includes(query) || product.description?.toLowerCase().includes(query);
      const matchesCategory = productCategoryFilter === 'all' || product.category_id === productCategoryFilter;
      const matchesAvailability =
        productAvailabilityFilter === 'all' ||
        (productAvailabilityFilter === 'available' && product.available) ||
        (productAvailabilityFilter === 'unavailable' && !product.available) ||
        (productAvailabilityFilter === 'recommended' && product.recommended);

      return matchesSearch && matchesCategory && matchesAvailability;
    });
  }, [products, productSearch, productCategoryFilter, productAvailabilityFilter]);

  function patchProduct(id: string, patch: Record<string, any>) {
    setProducts(products.map((product) => product.id === id ? { ...product, ...patch } : product));
  }

  function downloadCsv(rows: unknown[][], filename: string) {
    const csv = rows.map((row) => row.map(csvEscape).join(';')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportDailyCsv() {
    const rows = [
      ['RESUMEN DEL DÍA', selectedDay],
      ['Pedidos', daySummary.orders],
      ['Pedidos no cancelados', daySummary.validOrders],
      ['Ingresos', daySummary.revenue.toFixed(2)],
      ['Ticket medio', daySummary.averageTicket.toFixed(2)],
      ['Pedido más frecuente', daySummary.topProduct?.name || 'Sin datos'],
      ['Unidades del producto más frecuente', daySummary.topProduct?.quantity || 0],
      ['Recogida local', daySummary.pickupOrders],
      ['Delivery', daySummary.deliveryOrders],
      [],
      ['Fecha', 'Pedido', 'Cliente', 'Teléfono', 'Tipo', 'Estado', 'Tiempo estimado', 'Total', 'Productos', 'Notas'],
      ...dayOrders.map((order: any) => [
        new Date(order.created_at).toLocaleString('es-ES'),
        order.id,
        order.customer_name,
        order.customer_phone,
        order.order_type === 'pickup' ? 'Recogida' : 'Delivery',
        stateLabels[order.status] || order.status,
        order.estimated_time ? `${order.estimated_time} min` : '',
        Number(order.total_price || 0).toFixed(2),
        order.order_items?.map((item: any) => `${item.quantity}x ${item.product_name}`).join(' | ') || '',
        order.notes || ''
      ])
    ];

    downloadCsv(rows, `resumen-soho-${selectedDay}.csv`);
  }


  if (!authReady) {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <div className="rounded-[2rem] border border-black/5 bg-white p-6 shadow-xl shadow-cyan-200/30">
          <h1 className="text-3xl font-black">Comprobando acceso...</h1>
          <p className="mt-2 text-sm text-neutral-600">Validando sesión de administrador.</p>
        </div>
      </main>
    );
  }

  if (!session || !isAdmin) {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <form onSubmit={login} className="rounded-[2rem] border border-black/5 bg-white p-6 shadow-xl shadow-cyan-200/30">
          <p className="inline-flex rounded-full bg-cyan-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-[#047f86]">Área privada</p>
          <h1 className="mt-4 text-3xl font-black">Acceso administrador</h1>
          <p className="mt-2 text-sm text-neutral-600">Accede con la cuenta autorizada para gestionar pedidos, productos, horarios e informes.</p>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-5 w-full rounded-2xl border p-3" placeholder="Correo electrónico" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="mt-3 w-full rounded-2xl border p-3" placeholder="Contraseña" />
          {error && <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button className="mt-4 w-full rounded-2xl bg-neutral-950 p-4 font-black text-white">Entrar</button>
          <a href="/admin/forgot-password" className="mt-4 block text-center text-sm font-bold text-[#047f86] hover:text-[#036b71]">¿Olvidaste tu contraseña?</a>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fff7ed] text-neutral-950">
      <NewOrderAlert orders={orders} onAcknowledged={loadOrders} />
      <div className="grid min-h-screen lg:grid-cols-[250px_1fr]">
        <aside className="border-r border-white/10 bg-neutral-950 p-5 text-white lg:sticky lg:top-0 lg:h-screen">
          <div className="flex items-center gap-3 px-1">
            <img src="/soho-logo.png" alt="SOHO" className="h-12 w-12 rounded-full object-cover ring-1 ring-white/20" />
            <div>
              <p className="text-3xl font-black leading-none tracking-tight">SOHO</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.38em] text-cyan-200">Cambados</p>
            </div>
          </div>

          <nav className="mt-9 grid gap-1.5">
            {[
              { id: 'dashboard', label: 'Resumen', icon: LayoutDashboard },
              { id: 'orders', label: 'Pedidos', icon: ClipboardList },
              { id: 'messages', label: 'Mensajes', icon: Mail },
              { id: 'day', label: 'Resumen del día', icon: CalendarDays },
              { id: 'history', label: 'Historial', icon: History },
              { id: 'products', label: 'Productos', icon: Package },
              { id: 'settings', label: 'Horario', icon: Clock3 }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setSection(item.id as AdminSection)}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black transition ${section === item.id ? 'bg-white text-neutral-950 shadow-xl shadow-black/10' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
              >
                <span className={`grid h-8 w-8 place-items-center rounded-xl ${section === item.id ? 'bg-cyan-50 text-[#049ca5]' : 'bg-white/10 text-white/70'}`}><item.icon size={17} aria-hidden="true" /></span>
                {item.label}
              </button>
            ))}
          </nav>

          <div className="mt-auto pt-8">
            <div className="rounded-[24px] bg-white/8 p-4 ring-1 ring-white/10">
              <div className="flex items-center gap-2 text-sm font-black">
                <span className={`h-2.5 w-2.5 rounded-full ${isBusinessOpenFromSettings(settings) ? 'bg-emerald-400' : 'bg-red-400'}`} />
                {isBusinessOpenFromSettings(settings) ? 'Tienda abierta' : 'Tienda cerrada'}
              </div>
              <p className="mt-2 text-xs leading-5 text-white/55">{businessHoursLabelFromSettings(settings)}</p>
            </div>
            <button onClick={logout} className="mt-4 w-full rounded-2xl border border-white/15 px-4 py-3 text-sm font-black text-white/80 transition hover:bg-white/10 hover:text-white">Cerrar sesión</button>
          </div>
        </aside>

        <section className="min-w-0 p-5 lg:p-8">
          {section === 'dashboard' && (
            <section>
              <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
                <div><h1 className="text-4xl font-black tracking-tight text-neutral-950">Dashboard</h1><p className="mt-2 text-sm font-semibold text-neutral-700">Datos reales del canal web. Los ingresos excluyen autorizaciones sin capturar y descuentan los reembolsos completados.</p></div>
                <RangeSelector value={dashboardRange} onChange={(range) => { setDashboardRange(range); setRevenueRange(range); setOrdersRange(range); setTicketRange(range); setProductsRange(range); }} />
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[28px] border border-emerald-200/80 bg-emerald-50/70 p-6 shadow-sm"><p className="text-sm font-black text-[#17633c]">Ingresos</p><strong className="mt-2 block text-4xl font-black text-[#123524]">{formatPrice(dashboardData.rows.reduce((s,r)=>s+r.revenue,0))}</strong><p className="mt-2 text-xs font-bold text-[#17633c]">Sin pedidos cancelados</p></div>
                <div className="rounded-[28px] border border-sky-200/80 bg-sky-50/70 p-6 shadow-sm"><p className="text-sm font-black text-[#225a91]">Pedidos</p><strong className="mt-2 block text-4xl font-black text-[#17334f]">{dashboardData.filtered.length}</strong><p className="mt-2 text-xs font-bold text-[#225a91]">Periodo seleccionado</p></div>
                <div className="rounded-[28px] border border-amber-200/80 bg-amber-50/70 p-6 shadow-sm"><p className="text-sm font-black text-[#7a350d]">Ticket medio</p><strong className="mt-2 block text-4xl font-black text-[#52270b]">{formatPrice(dashboardData.rows.reduce((s,r)=>s+r.revenue,0)/Math.max(1,dashboardData.rows.reduce((s,r)=>s+r.validOrders,0)))}</strong><p className="mt-2 text-xs font-bold text-[#7a350d]">Promedio real</p></div>
                <div className="rounded-[28px] border border-[#ffbfd1] bg-[#ffe4ec] p-6 shadow-sm"><p className="text-sm font-black text-[#9f1239]">Cancelados</p><strong className="mt-2 block text-4xl font-black text-[#5f0f2e]">{dashboardData.rows.reduce((s,r)=>s+r.cancelled,0)}</strong><p className="mt-2 text-xs font-bold text-[#9f1239]">No suman en ingresos</p></div>
              </div>
              <div className="mt-6 grid gap-5 xl:grid-cols-2">
                <DashboardBars title="Ingresos por periodo" data={revenueData.rows} range={revenueRange} onRange={setRevenueRange} valueKey="revenue" money color="bg-emerald-500" />
                <DashboardBars title="Pedidos por periodo" data={ordersData.rows} range={ordersRange} onRange={setOrdersRange} valueKey="orders" color="bg-sky-500" />
                <div className="rounded-[28px] border border-black/10 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-black">Ticket medio</h2><RangeSelector compact value={ticketRange} onChange={setTicketRange} /></div><div className="mt-5 grid gap-3">{ticketData.rows.map((row:any)=><div key={row.key} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-sm font-bold"><span className="text-slate-500">{row.label}</span><div className="h-3 rounded-full bg-slate-100"><div className="h-3 rounded-full bg-amber-400" style={{width:`${Math.min(100,(row.averageTicket/Math.max(1,...ticketData.rows.map((r:any)=>r.averageTicket)))*100)}%`}}/></div><strong>{formatPrice(row.averageTicket)}</strong></div>)}</div></div>
                <div className="rounded-[28px] border border-black/10 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-black">Productos top</h2><RangeSelector compact value={productsRange} onChange={setProductsRange} /></div><div className="mt-5 grid gap-3">{productsData.map((product)=><div key={product.name} className="flex justify-between rounded-3xl bg-[#f8fafc] px-5 py-4 text-sm font-bold"><span>{product.name}</span><strong>{product.quantity} uds · {formatPrice(product.total)}</strong></div>)}{!productsData.length&&<p className="rounded-3xl bg-[#f8fafc] p-5 text-sm font-bold text-slate-500">Sin datos en este periodo.</p>}</div></div>
              </div>

              <div className="mt-6 rounded-[28px] border border-black/10 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#047f86]">Análisis detallado</p><h2 className="mt-1 text-2xl font-black">Selecciona qué quieres analizar</h2></div>
                  <label className="grid min-w-[260px] gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-600">Vista
                    <select value={dashboardAnalysis} onChange={(e)=>setDashboardAnalysis(e.target.value as DashboardAnalysis)} className="rounded-2xl border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm font-black normal-case tracking-normal outline-none focus:border-[#049ca5]">
                      <option value="orders-hour">Pedidos por hora</option><option value="orders-weekday">Pedidos por día de la semana</option><option value="orders-date">Pedidos por fecha</option><option value="revenue-hour">Facturación por hora</option><option value="revenue-date">Facturación por fecha</option><option value="products">Productos más vendidos</option><option value="categories">Categorías más vendidas</option><option value="ticket">Ticket medio</option><option value="refunds">Reembolsos</option><option value="cancellations">Cancelaciones</option><option value="preparation">Tiempos de preparación</option><option value="comparison">Comparación con periodo anterior</option>
                    </select>
                  </label>
                </div>

                <div className="mt-6">
                  {dashboardAnalysis === 'orders-hour' && <><div className="mb-4 rounded-2xl bg-sky-50 p-4 text-sm font-bold text-sky-900">Hora con más pedidos: <strong>{dashboardAnalytics.peakHourOrders?.label || 'Sin datos'}</strong> · {dashboardAnalytics.peakHourOrders?.orders || 0} pedidos</div><DashboardBars title="Pedidos por hora" data={dashboardAnalytics.byHour} valueKey="orders" /></>}
                  {dashboardAnalysis === 'orders-weekday' && <><div className="mb-4 rounded-2xl bg-sky-50 p-4 text-sm font-bold text-sky-900">Día con más pedidos: <strong className="capitalize">{dashboardAnalytics.peakWeekday?.label || 'Sin datos'}</strong> · {dashboardAnalytics.peakWeekday?.orders || 0} pedidos</div><DashboardBars title="Pedidos por día de la semana" data={dashboardAnalytics.byWeekday} valueKey="orders" /></>}
                  {dashboardAnalysis === 'orders-date' && <><div className="mb-4 rounded-2xl bg-sky-50 p-4 text-sm font-bold text-sky-900">Fecha con más pedidos: <strong>{dashboardAnalytics.peakDateOrders?.label || 'Sin datos'}</strong> · {dashboardAnalytics.peakDateOrders?.orders || 0} pedidos</div><DashboardBars title="Pedidos por fecha" data={dashboardAnalytics.byDate} valueKey="orders" /></>}
                  {dashboardAnalysis === 'revenue-hour' && <><div className="mb-4 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-900">Franja con mayor facturación: <strong>{dashboardAnalytics.peakHourRevenue?.label || 'Sin datos'}</strong> · {formatPrice(dashboardAnalytics.peakHourRevenue?.revenue || 0)}</div><DashboardBars title="Facturación neta por hora" data={dashboardAnalytics.byHour} valueKey="revenue" money /></>}
                  {dashboardAnalysis === 'revenue-date' && <><div className="mb-4 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-900">Día con mayor facturación: <strong>{dashboardAnalytics.peakDateRevenue?.label || 'Sin datos'}</strong> · {formatPrice(dashboardAnalytics.peakDateRevenue?.revenue || 0)}</div><DashboardBars title="Facturación neta por fecha" data={dashboardAnalytics.byDate} valueKey="revenue" money /></>}
                  {(dashboardAnalysis === 'products' || dashboardAnalysis === 'categories') && <div className="grid gap-3">{(dashboardAnalysis === 'products' ? dashboardAnalytics.products : dashboardAnalytics.categories).map((row:any,index:number)=><div key={row.key} className="grid grid-cols-[36px_1fr_auto] items-center gap-3 rounded-3xl bg-[#f8fafc] px-5 py-4 text-sm font-bold"><span className="grid h-8 w-8 place-items-center rounded-full bg-white">{index+1}</span><span>{row.label}</span><strong>{row.quantity} uds · {formatPrice(row.revenue)}</strong></div>)}{!(dashboardAnalysis === 'products' ? dashboardAnalytics.products : dashboardAnalytics.categories).length && <p className="rounded-3xl bg-[#f8fafc] p-5 text-sm font-bold text-slate-500">Sin datos en este periodo.</p>}</div>}
                  {dashboardAnalysis === 'ticket' && <div className="grid gap-4 md:grid-cols-3"><div className="rounded-3xl bg-amber-50 p-6"><p className="text-sm font-bold text-amber-900">Ticket medio neto</p><strong className="mt-2 block text-4xl font-black">{formatPrice(dashboardAnalytics.averageTicket)}</strong></div><div className="rounded-3xl bg-slate-50 p-6"><p className="text-sm font-bold text-slate-700">Ventas brutas capturadas</p><strong className="mt-2 block text-3xl font-black">{formatPrice(dashboardAnalytics.grossRevenue)}</strong></div><div className="rounded-3xl bg-rose-50 p-6"><p className="text-sm font-bold text-rose-800">Importe reembolsado</p><strong className="mt-2 block text-3xl font-black">{formatPrice(dashboardAnalytics.refundAmount)}</strong></div></div>}
                  {dashboardAnalysis === 'refunds' && <div className="grid gap-4 md:grid-cols-3"><div className="rounded-3xl bg-rose-50 p-6"><p className="text-sm font-bold">Reembolsos completados</p><strong className="mt-2 block text-4xl font-black">{dashboardAnalytics.refunded.length}</strong></div><div className="rounded-3xl bg-rose-50 p-6"><p className="text-sm font-bold">Tasa de reembolso</p><strong className="mt-2 block text-4xl font-black">{dashboardAnalytics.refundRate.toFixed(1)}%</strong></div><div className="rounded-3xl bg-rose-50 p-6"><p className="text-sm font-bold">Importe reembolsado</p><strong className="mt-2 block text-4xl font-black">{formatPrice(dashboardAnalytics.refundAmount)}</strong></div></div>}
                  {dashboardAnalysis === 'cancellations' && <div className="grid gap-4 md:grid-cols-2"><div className="rounded-3xl bg-slate-50 p-6"><p className="text-sm font-bold">Cancelaciones liberadas</p><strong className="mt-2 block text-4xl font-black">{dashboardAnalytics.cancelled.length}</strong></div><div className="rounded-3xl bg-slate-50 p-6"><p className="text-sm font-bold">Tasa sobre operaciones</p><strong className="mt-2 block text-4xl font-black">{dashboardAnalytics.cancellationRate.toFixed(1)}%</strong></div></div>}
                  {dashboardAnalysis === 'preparation' && <div className="grid gap-4 md:grid-cols-3"><div className="rounded-3xl bg-cyan-50 p-6"><p className="text-sm font-bold">Tiempo medio</p><strong className="mt-2 block text-4xl font-black">{dashboardAnalytics.preparation.average == null ? 'Sin datos' : `${Math.round(dashboardAnalytics.preparation.average)} min`}</strong></div><div className="rounded-3xl bg-cyan-50 p-6"><p className="text-sm font-bold">Más rápido</p><strong className="mt-2 block text-4xl font-black">{dashboardAnalytics.preparation.minimum == null ? '—' : `${Math.round(dashboardAnalytics.preparation.minimum)} min`}</strong></div><div className="rounded-3xl bg-cyan-50 p-6"><p className="text-sm font-bold">Más lento</p><strong className="mt-2 block text-4xl font-black">{dashboardAnalytics.preparation.maximum == null ? '—' : `${Math.round(dashboardAnalytics.preparation.maximum)} min`}</strong><p className="mt-2 text-xs font-bold text-slate-500">Muestra: {dashboardAnalytics.preparation.sample} pedidos</p></div></div>}
                  {dashboardAnalysis === 'comparison' && <div className="grid gap-4 md:grid-cols-2"><div className="rounded-3xl bg-violet-50 p-6"><p className="text-sm font-bold">Pagos capturados frente al periodo anterior</p><strong className="mt-2 block text-4xl font-black">{dashboardAnalytics.comparison.ordersChange >= 0 ? '+' : ''}{dashboardAnalytics.comparison.ordersChange.toFixed(1)}%</strong><p className="mt-2 text-sm font-semibold">{dashboardAnalytics.comparison.orders} actuales · {dashboardAnalytics.comparison.previousOrders} anteriores</p></div><div className="rounded-3xl bg-violet-50 p-6"><p className="text-sm font-bold">Ingresos netos frente al periodo anterior</p><strong className="mt-2 block text-4xl font-black">{dashboardAnalytics.comparison.revenueChange >= 0 ? '+' : ''}{dashboardAnalytics.comparison.revenueChange.toFixed(1)}%</strong><p className="mt-2 text-sm font-semibold">{formatPrice(dashboardAnalytics.comparison.revenue)} actuales · {formatPrice(dashboardAnalytics.comparison.previousRevenue)} anteriores</p></div></div>}
                </div>
              </div>
            </section>
          )}

          {section === 'orders' && (
            <section>
              <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-4xl font-black tracking-tight text-neutral-950">Pedidos</h1>
                  <p className="mt-2 text-sm font-semibold text-neutral-700">Gestiona los pedidos de hoy en tiempo real.</p>
                </div>
                <button onClick={() => Promise.all([loadOrders(), loadMessages(), loadProducts(), loadCategories(), loadSettings()])} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-neutral-950 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5">Recargar panel</button>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <button onClick={() => setStatusFilter('all')} className="rounded-[28px] border border-violet-200/70 bg-violet-50/60 p-6 text-left shadow-sm">
                  <p className="text-sm font-black text-neutral-700">Pedidos hoy</p>
                  <strong className="mt-2 block text-4xl font-black text-neutral-950">{todayOrders.length}</strong>
                </button>
                <button onClick={() => setStatusFilter('pending')} className="rounded-[28px] border border-[#ffe08a] bg-[#fff2c7] p-6 text-left shadow-sm">
                  <p className="text-sm font-black text-neutral-700">Pendientes</p>
                  <strong className="mt-2 block text-4xl font-black text-neutral-950">{statusCounts.pending || 0}</strong>
                </button>
                <button onClick={() => setStatusFilter('preparing')} className="rounded-[28px] border border-amber-200/80 bg-amber-50/70 p-6 text-left shadow-sm">
                  <p className="text-sm font-black text-neutral-700">Preparando</p>
                  <strong className="mt-2 block text-4xl font-black text-neutral-950">{statusCounts.preparing || 0}</strong>
                </button>
                <button onClick={() => setStatusFilter('ready')} className="rounded-[28px] border border-emerald-200/80 bg-emerald-50/70 p-6 text-left shadow-sm">
                  <p className="text-sm font-black text-neutral-700">Listos</p>
                  <strong className="mt-2 block text-4xl font-black text-neutral-950">{statusCounts.ready || 0}</strong>
                </button>
              </div>

              <div className="mt-6 rounded-[28px] border border-black/10 bg-white p-5 shadow-sm">
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por cliente, teléfono, nota o producto..." className="w-full rounded-2xl border border-black/10 bg-neutral-50 px-5 py-4 text-sm font-bold outline-none transition focus:border-[#049ca5] focus:bg-white" />
                <div className="mt-4 flex flex-wrap gap-2">
                  {statusFilters.map((filter) => (
                    <button
                      key={filter.value}
                      onClick={() => setStatusFilter(filter.value)}
                      className={`rounded-full px-4 py-2 text-sm font-black transition ${statusFilter === filter.value ? 'bg-neutral-950 text-white' : 'bg-cyan-50 text-neutral-700 hover:bg-cyan-100 hover:text-[#047f86]'}`}
                    >
                      {filter.label} <span className="ml-1 opacity-70">{statusCounts[filter.value] ?? 0}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                {filteredOrders.map((order) => <AdminOrderCard key={order.id} order={order} onUpdate={updateOrder} />)}
                {!filteredOrders.length && <p className="rounded-[28px] bg-white p-7 text-sm font-bold text-neutral-700 shadow-sm">No hay pedidos con esos filtros.</p>}
              </div>
            </section>
          )}

          {section === 'messages' && (
            <section>
              <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-4xl font-black tracking-tight text-neutral-950">Mensajes</h1>
                  <p className="mt-2 text-sm font-semibold text-neutral-700">Consultas recibidas desde el formulario de contacto.</p>
                </div>
                <span className="rounded-2xl bg-[#049ca5] px-5 py-3 text-sm font-black text-white">{pendingMessages.length} pendientes</span>
              </div>

              <div className="rounded-[28px] border border-black/10 bg-white p-5 shadow-sm">
                <input value={messageSearch} onChange={(e) => setMessageSearch(e.target.value)} placeholder="Buscar por nombre, correo, teléfono o mensaje..." className="w-full rounded-2xl border border-black/10 bg-neutral-50 px-5 py-4 text-sm font-bold outline-none transition focus:border-[#049ca5] focus:bg-white" />
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" onClick={() => setMessageView('pending')} className={`rounded-2xl px-5 py-3 text-sm font-black transition ${messageView === 'pending' ? 'bg-[#049ca5] text-white shadow-sm' : 'bg-white text-neutral-800 ring-1 ring-black/10 hover:bg-cyan-50'}`}>Mensajes pendientes <span className="ml-1 opacity-80">{pendingMessages.length}</span></button>
                <button type="button" onClick={() => setMessageView('read')} className={`rounded-2xl px-5 py-3 text-sm font-black transition ${messageView === 'read' ? 'bg-neutral-950 text-white shadow-sm' : 'bg-white text-neutral-800 ring-1 ring-black/10 hover:bg-cyan-50'}`}>Historial de mensajes <span className="ml-1 opacity-80">{readMessages.length}</span></button>
              </div>

              <div className="mt-5 grid gap-4">
                {filteredMessages.map((message) => (
                  <article key={message.id} className="rounded-[28px] border border-black/10 bg-white p-6 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="text-2xl font-black text-neutral-950">{message.name}</h3>
                        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold text-neutral-700">
                          <span>{message.email}</span>
                          <span>{message.phone}</span>
                          <span>{new Date(message.created_at).toLocaleString('es-ES')}</span>
                        </div>
                      </div>
                      <span className={`rounded-full px-4 py-2 text-sm font-black ${message.read ? 'bg-cyan-50 text-neutral-700' : 'bg-[#049ca5] text-white'}`}>{message.read ? 'Leído' : 'Nuevo'}</span>
                    </div>
                    <p className="mt-5 rounded-3xl bg-neutral-50 p-5 text-sm font-semibold leading-7 text-slate-700">{message.message}</p>
                    <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                      <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-neutral-700">
                        Contactar
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === 'email') {
                              const subject = encodeURIComponent('Respuesta a tu consulta · SOHO Cambados');
                              const body = encodeURIComponent(`Hola ${message.name || ''},

Somos el equipo de SOHO Cambados. Te escribimos en respuesta al mensaje que nos enviaste a través de nuestra web:

“${String(message.message || '').slice(0, 240)}”

`);
                              window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(message.email || '')}&su=${subject}&body=${body}`, '_blank', 'noopener,noreferrer');
                            }
                            if (value === 'whatsapp') {
                              const text = encodeURIComponent(`Hola ${message.name || ''}, somos el equipo de SOHO Cambados. Te escribimos en respuesta a la consulta que nos enviaste a través de nuestra web.\n\nTu mensaje: “${String(message.message || '').slice(0, 240)}”\n\n`);
                              window.open(`https://wa.me/${cleanPhone(message.phone)}?text=${text}`, '_blank', 'noopener,noreferrer');
                            }
                            if (value === 'call') window.location.href = `tel:${message.phone}`;
                            e.currentTarget.value = '';
                          }}
                          className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal text-neutral-950 outline-none focus:border-cyan-400"
                        >
                          <option value="">Elegir opción</option>
                          <option value="email">Correo</option>
                          <option value="whatsapp">WhatsApp</option>
                          <option value="call">Llamar</option>
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-neutral-700">
                        Estado
                        <select
                          value={message.read ? 'read' : 'pending'}
                          onChange={(e) => markMessage(message.id, e.target.value === 'read')}
                          className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal text-neutral-950 outline-none focus:border-cyan-400"
                        >
                          <option value="pending">Pendiente</option>
                          <option value="read">Leído</option>
                        </select>
                      </label>
                      <button onClick={() => deleteMessage(message.id)} className="self-end rounded-2xl bg-[#ffe4ec] px-5 py-3 text-sm font-black text-rose-700">Borrar</button>
                    </div>
                  </article>
                ))}
                {!filteredMessages.length && <p className="rounded-[28px] bg-white p-7 text-sm font-bold text-neutral-700 shadow-sm">{messageView === 'pending' ? 'No hay mensajes pendientes.' : 'No hay mensajes leídos.'}</p>}
              </div>
            </section>
          )}

          {section === 'day' && (
            <section>
              <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-4xl font-black tracking-tight text-neutral-950">Resumen del día</h1>
                  <p className="mt-2 text-sm font-semibold text-neutral-700">Selecciona una fecha y revisa productos vendidos y pedidos de ese día.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input type="date" value={selectedDay} min={last90Days()[89]} max={last90Days()[0]} onChange={(e) => setSelectedDay(e.target.value)} className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-black text-neutral-950" />
                  <button onClick={exportDailyCsv} className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white">Exportar día</button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[28px] border border-violet-200/70 bg-violet-50/60 p-6 shadow-sm"><p className="text-sm font-black text-neutral-700">Pedidos del día</p><strong className="mt-2 block text-4xl font-black text-neutral-950">{daySummary.orders}</strong><p className="mt-2 text-xs font-bold capitalize text-neutral-700">{dayLabel(selectedDay)}</p></div>
                <div className="rounded-[28px] border border-emerald-200/80 bg-emerald-50/70 p-6 shadow-sm"><p className="text-sm font-black text-neutral-700">Ingresos del día</p><strong className="mt-2 block text-4xl font-black text-neutral-950">{formatPrice(daySummary.revenue)}</strong><p className="mt-2 text-xs font-bold text-neutral-700">Sin cancelados</p></div>
                <div className="rounded-[28px] border border-amber-200/80 bg-amber-50/70 p-6 shadow-sm"><p className="text-sm font-black text-neutral-700">Ticket medio</p><strong className="mt-2 block text-4xl font-black text-neutral-950">{formatPrice(daySummary.averageTicket)}</strong><p className="mt-2 text-xs font-bold text-neutral-700">Promedio por pedido</p></div>
                <div className="rounded-[28px] border border-sky-200/80 bg-sky-50/70 p-6 shadow-sm"><p className="text-sm font-black text-neutral-700">Más pedido</p><strong className="mt-2 block text-xl font-black text-neutral-950">{daySummary.topProduct?.name || 'Sin datos'}</strong><p className="mt-2 text-xs font-bold text-neutral-700">{daySummary.topProduct ? `${daySummary.topProduct.quantity} uds` : 'Sin ventas'}</p></div>
              </div>

              <div className="mt-6 grid gap-5 xl:grid-cols-[0.9fr_1.35fr]">
                <div className="rounded-[28px] border border-black/10 bg-white p-6 shadow-sm">
                  <h2 className="text-2xl font-black tracking-tight text-neutral-950">Productos del día</h2>
                  <div className="mt-5 grid gap-3">
                    {daySummary.topProducts.slice(0, 10).map((product) => (
                      <div key={product.name} className="flex justify-between gap-4 rounded-3xl bg-neutral-50 px-5 py-4 text-sm font-bold text-slate-700">
                        <span>{product.name}</span>
                        <strong>{product.quantity} uds · {formatPrice(product.total)}</strong>
                      </div>
                    ))}
                    {!daySummary.topProducts.length && <p className="rounded-3xl bg-neutral-50 p-5 text-sm font-bold text-neutral-700">No hay productos vendidos en esta fecha.</p>}
                  </div>
                </div>

                <div className="rounded-[28px] border border-black/10 bg-white p-6 shadow-sm">
                  <h2 className="text-2xl font-black tracking-tight text-neutral-950">Pedidos de la fecha</h2>
                  <div className="mt-5 grid gap-3">
                    {dayOrders.map((order) => (
                      <button key={order.id} onClick={() => setSection('orders')} className="grid gap-3 rounded-3xl bg-neutral-50 p-4 text-left transition hover:bg-cyan-50 md:grid-cols-[1fr_auto]">
                        <div>
                          <strong className="text-neutral-950">{order.customer_name}</strong>
                          <p className="mt-1 text-sm font-semibold text-neutral-700">{new Date(order.created_at).toLocaleTimeString('es-ES')} · {stateLabels[order.status] || order.status}</p>
                          <p className="mt-1 text-sm font-semibold text-neutral-700">{order.order_items?.map((item: any) => `${item.quantity}x ${item.product_name}`).join(' · ')}</p>
                        </div>
                        <strong className="text-xl font-black text-neutral-950">{formatPrice(Number(order.total_price || 0))}</strong>
                      </button>
                    ))}
                    {!dayOrders.length && <p className="rounded-3xl bg-neutral-50 p-5 text-sm font-bold text-neutral-700">No hay pedidos en esta fecha.</p>}
                  </div>
                </div>
              </div>
            </section>
          )}

          {section === 'history' && (
            <section>
              <div className="mb-7 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-4xl font-black tracking-tight">Historial</h1><p className="mt-2 text-sm font-semibold text-neutral-700">Consulta y exporta hasta un año de actividad real de la web.</p></div><RangeSelector value={historyRange} onChange={setHistoryRange} /></div>
              <div className="mb-5 flex flex-wrap gap-3"><button onClick={()=>setHistoryTab('orders')} className={`rounded-2xl px-5 py-3 text-sm font-black ${historyTab==='orders'?'bg-neutral-950 text-white':'bg-white ring-1 ring-black/10'}`}>Pedidos</button><button onClick={()=>setHistoryTab('reports')} className={`rounded-2xl px-5 py-3 text-sm font-black ${historyTab==='reports'?'bg-[#049ca5] text-white':'bg-white ring-1 ring-black/10'}`}>Informes para gestoría</button></div>
              {historyTab === 'orders' ? <div className="rounded-[28px] border border-black/10 bg-white p-5 shadow-sm"><div className="mb-4 flex justify-end"><button onClick={exportRangeCsv} className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white">Exportar CSV</button></div><div className="grid gap-3">{historyDays.map((day)=><button key={day.day} onClick={()=>{setSelectedDay(day.day);setSection('day')}} className="grid gap-3 rounded-3xl bg-neutral-50 p-4 text-left hover:bg-cyan-50 md:grid-cols-[1.4fr_repeat(5,1fr)] md:items-center"><div><strong className="capitalize">{day.label}</strong><p className="text-sm text-neutral-600">{day.day}</p></div><div><p className="text-xs font-black uppercase text-neutral-500">Pedidos</p><strong>{day.orders}</strong></div><div><p className="text-xs font-black uppercase text-neutral-500">Ingresos</p><strong>{formatPrice(day.revenue)}</strong></div><div><p className="text-xs font-black uppercase text-neutral-500">Ticket medio</p><strong>{formatPrice(day.averageTicket)}</strong></div><div><p className="text-xs font-black uppercase text-neutral-500">Más pedido</p><strong className="text-sm">{day.topProduct}</strong></div><div><p className="text-xs font-black uppercase text-neutral-500">Completados</p><strong>{day.completed}</strong></div></button>)}</div></div> : <div className="rounded-[28px] border border-black/10 bg-white p-7 shadow-sm"><h2 className="text-2xl font-black">Informe de actividad web y resumen fiscal</h2><p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-neutral-700">PDF informativo para gestoría con relación de pedidos sin datos personales, ventas online, desglose de IVA, cancelaciones, comisiones reales de Stripe, coste de impresora y costes configurados de gestión, hosting y dominio. No contiene Caylu, efectivo, pagos en local, QR ni datos ajenos a la web.</p><div className="mt-6 grid gap-4 md:grid-cols-3"><div className="rounded-3xl bg-cyan-50 p-5"><p className="text-xs font-black uppercase text-[#047f86]">Pedidos del periodo</p><strong className="mt-2 block text-3xl">{historyOrders.length}</strong></div><div className="rounded-3xl bg-emerald-50 p-5"><p className="text-xs font-black uppercase text-emerald-700">Importe neto cobrado</p><strong className="mt-2 block text-3xl">{formatPrice(revenue(historyOrders))}</strong></div><div className="rounded-3xl bg-slate-50 p-5"><p className="text-xs font-black uppercase text-slate-600">Periodo</p><strong className="mt-2 block text-lg">{historyRange.from} → {historyRange.to}</strong></div></div><button onClick={downloadManagementPdf} className="mt-6 rounded-2xl bg-[#049ca5] px-6 py-4 text-sm font-black text-white shadow-sm hover:bg-[#037f86]">Descargar informe PDF</button></div>}
            </section>
          )}

          {section === 'settings' && (
            <section>
              <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-4xl font-black tracking-tight text-neutral-950">Horario</h1>
                  <p className="mt-2 text-sm font-semibold text-neutral-700">Edita cada día por separado: apertura, cierre y cerrado.</p>
                </div>
                <div className={`rounded-2xl px-5 py-3 text-sm font-black ${isBusinessOpenFromSettings(settings) ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                  {isBusinessOpenFromSettings(settings) ? 'Pedidos abiertos' : 'Pedidos cerrados'}
                </div>
              </div>

              <div className="rounded-[28px] border border-black/10 bg-white p-6 shadow-sm">
                <div className="rounded-3xl bg-neutral-50 p-5">
                  <p className="text-sm font-black text-neutral-950">Estado visible para clientes</p>
                  <p className="mt-1 text-sm font-semibold text-neutral-700">{businessHoursLabelFromSettings(settings)}</p>
                </div>

                <label className="mt-5 flex items-center justify-between rounded-3xl border border-black/10 bg-white p-5 text-sm font-black text-neutral-950">
                  Pausar pedidos online manualmente
                  <input type="checkbox" checked={settings.manual_pause} onChange={(e) => setSettings({ ...settings, manual_pause: e.target.checked })} className="h-6 w-6" />
                </label>

                <div className="mt-5 rounded-[28px] border border-cyan-200 bg-cyan-50 p-6">
                  <h2 className="text-2xl font-black text-neutral-950">Operación automática</h2>
                  <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-neutral-700">Los pedidos pagados aparecen primero como «Aceptado», pasan a «Preparando» al minuto 2 y a «Listo» cuando se cumple el tiempo total indicado. «Entregado», cancelaciones y reembolsos se gestionan manualmente.</p>
                  <label className="mt-5 grid max-w-md gap-2 rounded-3xl bg-white p-5 text-sm font-black text-neutral-950">
                    Minutos totales hasta «Listo»
                    <select value={settings.default_wait_minutes} onChange={(e) => setSettings({ ...settings, default_wait_minutes: Number(e.target.value) })} className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-bold">
                      {[10, 15, 20, 30, 45, 60].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutos</option>)}
                    </select>
                  </label>
                </div>

                <div className="mt-5 grid gap-4">
                  {orderedDays.map((item) => {
                    const daySettings = settings.weekly_hours?.[item.key];
                    return (
                      <div key={item.key} className="grid gap-4 rounded-3xl border border-black/10 bg-neutral-50 p-5 md:grid-cols-[1fr_170px_170px_120px] md:items-center">
                        <div>
                          <strong className="text-lg font-black text-neutral-950">{item.label}</strong>
                          <p className={`text-sm font-black ${daySettings?.closed ? 'text-red-600' : 'text-emerald-600'}`}>{daySettings?.closed ? 'Cerrado' : 'Acepta pedidos'}</p>
                        </div>
                        <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-neutral-700">
                          Apertura
                          <input type="time" value={daySettings?.open || '09:00'} onChange={(e) => patchDay(item.key, { open: e.target.value })} className="rounded-2xl border border-black/10 bg-white p-3 text-sm font-bold normal-case tracking-normal text-neutral-950" />
                        </label>
                        <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-neutral-700">
                          Cierre
                          <input type="time" value={daySettings?.close || '23:30'} onChange={(e) => patchDay(item.key, { close: e.target.value })} className="rounded-2xl border border-black/10 bg-white p-3 text-sm font-bold normal-case tracking-normal text-neutral-950" />
                        </label>
                        <label className="flex items-center gap-3 justify-self-start rounded-2xl bg-white px-4 py-3 text-sm font-black text-neutral-950">
                          Cerrado
                          <input type="checkbox" checked={Boolean(daySettings?.closed)} onChange={(e) => patchDay(item.key, { closed: e.target.checked })} className="h-5 w-5" />
                        </label>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 rounded-[28px] border border-black/10 bg-cyan-50 p-6">
                  <h2 className="text-2xl font-black text-neutral-950">Configuración de informes y costes web</h2>
                  <p className="mt-2 text-sm font-semibold text-neutral-700">Estos valores se usan en el panel y en el informe PDF para gestoría. Mantenimiento/gestión y hosting son gratuitos durante los 3 primeros meses; el dominio es gratuito durante el primer año. Después se contabilizan únicamente las mensualidades o renovaciones cuya fecha de cobro esté dentro del periodo seleccionado.</p>
                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <label className="grid gap-1 text-xs font-black uppercase text-neutral-700">Inicio del servicio<input type="date" value={settings.service_start_date || ''} onChange={(e)=>setSettings({...settings,service_start_date:e.target.value||null})} className="rounded-2xl border border-black/10 bg-white p-3 text-sm font-bold normal-case" /></label>
                    <label className="grid gap-1 text-xs font-black uppercase text-neutral-700">Precio por ticket<input type="number" step="0.001" min="0" value={settings.printer_price_per_ticket} onChange={(e)=>setSettings({...settings,printer_price_per_ticket:Number(e.target.value||0)})} className="rounded-2xl border border-black/10 bg-white p-3 text-sm font-bold normal-case" /></label>
                    <label className="grid gap-1 text-xs font-black uppercase text-neutral-700">Mantenimiento / gestión mensual<input type="number" step="0.01" min="0" value={settings.monthly_management_fee} onChange={(e)=>setSettings({...settings,monthly_management_fee:Number(e.target.value||0)})} className="rounded-2xl border border-black/10 bg-white p-3 text-sm font-bold normal-case" /></label>
                    <label className="grid gap-1 text-xs font-black uppercase text-neutral-700">Hosting mensual<input type="number" step="0.01" min="0" value={settings.monthly_hosting_fee} onChange={(e)=>setSettings({...settings,monthly_hosting_fee:Number(e.target.value||0)})} className="rounded-2xl border border-black/10 bg-white p-3 text-sm font-bold normal-case" /></label>
                    <label className="grid gap-1 text-xs font-black uppercase text-neutral-700">Dominio anual<input type="number" step="0.01" min="0" value={settings.annual_domain_fee} onChange={(e)=>setSettings({...settings,annual_domain_fee:Number(e.target.value||0)})} className="rounded-2xl border border-black/10 bg-white p-3 text-sm font-bold normal-case" /></label>
                    <label className="grid gap-1 text-xs font-black uppercase text-neutral-700">Razón social<input value={settings.fiscal_name} onChange={(e)=>setSettings({...settings,fiscal_name:e.target.value})} className="rounded-2xl border border-black/10 bg-white p-3 text-sm font-bold normal-case" /></label>
                    <label className="grid gap-1 text-xs font-black uppercase text-neutral-700">NIF/CIF<input value={settings.fiscal_nif} onChange={(e)=>setSettings({...settings,fiscal_nif:e.target.value})} className="rounded-2xl border border-black/10 bg-white p-3 text-sm font-bold normal-case" /></label>
                    <label className="grid gap-1 text-xs font-black uppercase text-neutral-700">Correo administrativo<input type="email" value={settings.admin_email} onChange={(e)=>setSettings({...settings,admin_email:e.target.value})} className="rounded-2xl border border-black/10 bg-white p-3 text-sm font-bold normal-case" /></label>
                    <label className="grid gap-1 text-xs font-black uppercase text-neutral-700 md:col-span-2 xl:col-span-4">Dirección fiscal<input value={settings.fiscal_address} onChange={(e)=>setSettings({...settings,fiscal_address:e.target.value})} className="rounded-2xl border border-black/10 bg-white p-3 text-sm font-bold normal-case" /></label>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button onClick={saveSettings} disabled={savingSettings} className="rounded-2xl bg-neutral-950 px-6 py-3 text-sm font-black text-white disabled:opacity-60">{savingSettings ? 'Guardando...' : 'Guardar configuración'}</button>
                  <button onClick={loadSettings} className="rounded-2xl border border-black/10 bg-white px-6 py-3 text-sm font-black text-neutral-950">Descartar cambios</button>
                </div>
              </div>
            </section>
          )}

          {section === 'products' && (
            <section>
              <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-4xl font-black tracking-tight text-neutral-950">Productos</h1>
                  <p className="mt-2 text-sm font-semibold text-neutral-700">Gestiona la carta, los precios, la disponibilidad y las imágenes. Puedes pegar un enlace o subir un archivo desde el dispositivo.</p>
                </div>
                <span className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-neutral-950 shadow-sm ring-1 ring-slate-200">{filteredAdminProducts.length} de {products.length} productos</span>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-[28px] border border-amber-200/80 bg-amber-50/70 p-6 shadow-sm"><p className="text-sm font-black text-neutral-700">Producto más pedido</p><strong className="mt-2 block text-xl font-black text-neutral-950">{analytics.topProducts[0]?.name || 'Sin datos'}</strong><p className="mt-1 text-xs font-bold text-neutral-700">{analytics.topProducts[0]?.quantity || 0} uds</p></div>
                <div className="rounded-[28px] border border-[#ffbfd1] bg-[#ffe4ec] p-6 shadow-sm"><p className="text-sm font-black text-neutral-700">No disponibles</p><strong className="mt-2 block text-4xl font-black text-neutral-950">{products.filter((p) => !p.available).length}</strong></div>
                <div className="rounded-[28px] border border-emerald-200/80 bg-emerald-50/70 p-6 shadow-sm"><p className="text-sm font-black text-neutral-700">Disponibles</p><strong className="mt-2 block text-4xl font-black text-neutral-950">{products.filter((p) => p.available).length}/{products.length}</strong></div>
                <div className="rounded-[28px] border border-sky-200/80 bg-sky-50/70 p-6 shadow-sm"><p className="text-sm font-black text-neutral-700">Precio medio</p><strong className="mt-2 block text-4xl font-black text-neutral-950">{formatPrice(products.length ? products.reduce((sum, product) => sum + Number(product.price || 0), 0) / products.length : 0)}</strong></div>
              </div>

              <div className="mt-6 rounded-[28px] border border-black/10 bg-white p-5 shadow-sm">
                <div className="grid gap-3 md:grid-cols-[1fr_220px_200px]">
                  <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Buscar producto o descripción..." className="rounded-2xl border border-black/10 bg-neutral-50 px-5 py-4 text-sm font-bold outline-none transition focus:border-[#049ca5] focus:bg-white" />
                  <select value={productCategoryFilter} onChange={(e) => setProductCategoryFilter(e.target.value)} className="rounded-2xl border border-black/10 bg-neutral-50 px-4 py-4 text-sm font-bold outline-none transition focus:border-[#049ca5] focus:bg-white">
                    <option value="all">Todas las categorías</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                  <select value={productAvailabilityFilter} onChange={(e) => setProductAvailabilityFilter(e.target.value as any)} className="rounded-2xl border border-black/10 bg-neutral-50 px-4 py-4 text-sm font-bold outline-none transition focus:border-[#049ca5] focus:bg-white">
                    <option value="all">Todos los estados</option>
                    <option value="available">Disponibles</option>
                    <option value="unavailable">No disponibles</option>
                    <option value="recommended">Recomendados</option>
                  </select>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-4 xl:grid-cols-5">
                {filteredAdminProducts.map((product) => {
                  const categoryName = product.categories?.name || categories.find((category) => category.id === product.category_id)?.name || '';
                  const displayImage = resolvedProductImage(product.image_url, categoryName);
                  return (
                    <article key={product.id} className="min-w-0 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
                      <div className="aspect-square bg-neutral-100">
                        {displayImage ? <img src={displayImage} alt={product.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center px-2 text-center text-[10px] font-black text-neutral-400">Sin foto</div>}
                      </div>
                      <div className="grid min-w-0 gap-2 p-2.5 sm:p-3">
                        <div className="min-w-0">
                          <h3 className="line-clamp-2 break-words text-[11px] font-black leading-tight sm:text-sm">{product.name}</h3>
                          <p className="mt-1 text-[10px] font-bold text-[#047f86] sm:text-xs">{formatPrice(Number(product.price || 0))}</p>
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <span className={`rounded-full px-2 py-1 text-[9px] font-black sm:text-[10px] ${product.available ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-600'}`}>{product.available ? 'Disponible' : 'Oculto'}</span>
                          {product.recommended && <span className="rounded-full bg-cyan-100 px-2 py-1 text-[9px] font-black text-[#047f86] sm:text-[10px]">Top</span>}
                        </div>
                        <button type="button" onClick={() => setEditingProductId(product.id)} className="flex min-h-9 items-center justify-center gap-1 rounded-xl bg-neutral-950 px-2 text-[10px] font-black text-white sm:text-xs"><Pencil size={13} /> Editar</button>
                      </div>
                    </article>
                  );
                })}
                {!filteredAdminProducts.length && <p className="col-span-full rounded-[28px] bg-white p-7 text-sm font-bold text-neutral-700 shadow-sm">No hay productos que coincidan con esos filtros.</p>}
              </div>

              {editingProductId && (() => {
                const product = products.find((item) => item.id === editingProductId);
                if (!product) return null;
                const categoryName = product.categories?.name || categories.find((category) => category.id === product.category_id)?.name || '';
                const displayImage = resolvedProductImage(product.image_url, categoryName);
                return (
                  <div className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Editar ${product.name}`}>
                    <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-[30px] bg-white p-5 shadow-2xl sm:p-7">
                      <div className="flex items-start justify-between gap-4">
                        <div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#047f86]">Editar producto</p><h2 className="mt-1 text-2xl font-black">{product.name}</h2></div>
                        <button type="button" onClick={() => setEditingProductId(null)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-neutral-100" aria-label="Cerrar"><X size={20} /></button>
                      </div>

                      <div className="mt-6 grid gap-6 md:grid-cols-[180px_1fr]">
                        <div>
                          <div className="aspect-square overflow-hidden rounded-3xl bg-neutral-100">{displayImage ? <img src={displayImage} alt={product.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xs font-black text-neutral-400">Sin foto</div>}</div>
                          <label className="mt-3 block cursor-pointer rounded-2xl border border-dashed border-black/15 bg-white px-3 py-3 text-center text-xs font-black text-slate-700 transition hover:bg-cyan-50"><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" onChange={(e) => e.target.files?.[0] && uploadProductImage(product.id, e.target.files[0])} />{savingProductId === product.id ? 'Subiendo imagen...' : 'Subir imagen desde el dispositivo'}</label>
                        </div>
                        <div className="grid min-w-0 gap-4">
                          <label className="grid gap-1 text-xs font-black text-neutral-600">Nombre<input value={product.name || ''} onChange={(e) => patchProduct(product.id, { name: e.target.value })} className="w-full rounded-2xl border border-black/10 bg-neutral-50 p-3 text-sm font-bold" /></label>
                          <label className="grid gap-1 text-xs font-black text-neutral-600">Descripción<textarea value={product.description || ''} onChange={(e) => patchProduct(product.id, { description: e.target.value })} className="min-h-28 w-full resize-y rounded-2xl border border-black/10 bg-neutral-50 p-3 text-sm font-semibold" placeholder="Descripción del producto" /></label>
                          <div className="grid grid-cols-2 gap-3">
                            <label className="grid gap-1 text-xs font-black text-neutral-600">Precio<input value={product.price || ''} onChange={(e) => patchProduct(product.id, { price: e.target.value })} className="w-full rounded-2xl border border-black/10 bg-neutral-50 p-3 text-sm font-bold" type="number" step="0.01" /></label>
                            <label className="grid gap-1 text-xs font-black text-neutral-600">IVA<select value={product.vat_rate || 10} onChange={(e)=>patchProduct(product.id,{vat_rate:Number(e.target.value)})} className="w-full rounded-2xl border border-black/10 bg-neutral-50 p-3 text-sm font-bold"><option value={10}>10%</option><option value={21}>21%</option></select></label>
                          </div>
                          <label className="grid gap-1 text-xs font-black text-neutral-600">Categoría<select value={product.category_id || ''} onChange={(e) => patchProduct(product.id, { category_id: e.target.value })} className="w-full rounded-2xl border border-black/10 bg-neutral-50 p-3 text-sm font-bold"><option value="">Sin categoría</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                          <label className="grid min-w-0 gap-1 text-xs font-black text-neutral-600">Enlace de imagen<input value={product.image_url || ''} onChange={(e) => patchProduct(product.id, { image_url: e.target.value })} className="w-full min-w-0 rounded-2xl border border-black/10 bg-neutral-50 p-3 text-sm font-semibold" placeholder="https://..." /></label>
                        </div>
                      </div>

                      <div className="mt-6 grid gap-2 sm:grid-cols-4">
                        <button type="button" onClick={async () => { await updateProduct(product); setEditingProductId(null); }} className="rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-black text-white">{savingProductId === product.id ? 'Guardando...' : 'Guardar cambios'}</button>
                        <button type="button" onClick={() => toggleProduct(product.id, product.available)} className={`rounded-2xl px-4 py-3 text-sm font-black ${product.available ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-700'}`}>{product.available ? 'Disponible' : 'No disponible'}</button>
                        <button type="button" onClick={() => setRecommendedProduct(product.id)} className={`rounded-2xl px-4 py-3 text-sm font-black ${product.recommended ? 'bg-[#037f86] text-white' : 'bg-[#049ca5] text-white'}`}>{product.recommended ? 'Recomendado' : 'Marcar recomendado'}</button>
                        <button type="button" onClick={() => setEditingProductId(null)} className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-black">Cerrar</button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </section>
          )}
        </section>
      </div>
    </main>
  );
}
