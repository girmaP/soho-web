import { supabase } from './supabaseClient';
import { CartItem, OrderType } from '@/types/cart';

export async function createOrder(params: {
  customerName: string;
  customerPhone: string;
  orderType: OrderType;
  deliveryAddress?: string;
  notes?: string;
  privacyAccepted: boolean;
  honeypot?: string;
  items: CartItem[];
}) {
  if (params.honeypot) throw new Error('Pedido bloqueado por seguridad.');
  if (!params.privacyAccepted) throw new Error('Debes aceptar la política de privacidad.');
  if (!params.customerName.trim()) throw new Error('Introduce tu nombre.');
  if (!params.customerPhone.trim()) throw new Error('Introduce tu teléfono.');
  if (params.orderType === 'delivery' && !params.deliveryAddress?.trim()) throw new Error('Introduce la dirección de entrega.');
  if (!params.items.length) throw new Error('El carrito está vacío.');

  const total = params.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const orderToken = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      customer_name: params.customerName.trim(),
      customer_phone: params.customerPhone.trim(),
      order_type: params.orderType,
      delivery_address: params.deliveryAddress?.trim() || null,
      notes: params.notes?.trim() || null,
      total_price: total,
      order_token: orderToken,
      status: 'pending'
    })
    .select()
    .single();

  if (orderError) throw orderError;

  const items = params.items.map((item) => ({
    order_id: order.id,
    product_id: item.product_id,
    product_name: item.name,
    quantity: item.quantity,
    unit_price: item.price,
    total_price: item.price * item.quantity
  }));

  const { error: itemsError } = await supabase.from('order_items').insert(items);
  if (itemsError) throw itemsError;
  return order;
}
