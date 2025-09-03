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
  images: ProductImage[];
  discounts: any[];
}

export interface ProductUI extends Product {
  isFavorite: boolean;
  image: string;
  originalPrice?: string;
  discount?: number;
}

export interface ProductImage {
  id: number;
  product_id: number;
  image_url: string;
  alt_text: string;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  full_image_url: string;
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

// Interfaz para respuestas de la API
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

// Interfaz para respuestas paginadas
export interface PaginatedResponse<T> {
  current_page: number;
  data: T[];
  first_page_url: string;
  from: number;
  last_page: number;
  last_page_url: string;
  links: any[];
  next_page_url: string | null;
  path: string;
  per_page: number;
  prev_page_url: string | null;
  to: number;
  total: number;
}

