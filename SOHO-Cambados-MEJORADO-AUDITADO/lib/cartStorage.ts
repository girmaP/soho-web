import { CartItem } from '@/types/cart';

const KEY = 'soho_cart_v1';

function normalizeCartItem(item: any): CartItem | null {
  if (!item?.product_id || !item?.name) return null;
  const price = Number(item.price || 0);
  return {
    line_id: String(item.line_id || item.product_id),
    product_id: String(item.product_id),
    name: String(item.name),
    base_price: Number(item.base_price ?? price),
    price,
    quantity: Math.max(1, Number(item.quantity || 1)),
    image_url: item.image_url || null,
    required_choice: item.required_choice || null,
    selected_extras: Array.isArray(item.selected_extras) ? item.selected_extras : []
  };
}

export function getCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeCartItem).filter(Boolean) as CartItem[];
  } catch {
    return [];
  }
}

export function saveCart(cart: CartItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event('soho-cart-updated'));
}

export function clearCart() { saveCart([]); }
