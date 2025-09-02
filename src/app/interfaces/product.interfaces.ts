export interface Product {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  sku: string;
  description: string;
  long_description: string;
  price: string;
  compare_price: string;
  cost_price: string;
  stock_quantity: number;
  min_stock_level: number;
  track_stock: boolean;
  is_active: boolean;
  is_featured: boolean;
  is_virtual: boolean;
  weight: string;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  category: Category;
  variants: any[];
  images: any[];
  discounts: any[];
}

export interface ProductUI extends Product {
  isFavorite: boolean;
  image: string;
}

export interface Category {
  id: number;
  parent_id: number | null;
  name: string;
  slug: string;
  description: string;
  image: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

