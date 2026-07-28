export type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category_id: string | null;
  image_url: string | null;
  available: boolean;
  estimated_time_category: string | null;
  recommended?: boolean;
};

export type Category = { id: string; name: string; sort_order: number };
export type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
