import { SelectedExtra } from '@/lib/productCustomization';

export type CartItem = {
  line_id: string;
  product_id: string;
  name: string;
  base_price: number;
  price: number;
  quantity: number;
  image_url?: string | null;
  required_choice?: string | null;
  selected_extras?: SelectedExtra[];
};

export type OrderType = 'pickup' | 'delivery';
