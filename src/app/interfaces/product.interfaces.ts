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
  variants: ProductVariant[];
  images: ProductImage[];
  attributes: ProductAttribute[];
  discounts: any[];
  branch_products?: BranchProduct[]; // Inventario por sucursal (opcional)
  attribute_assignments?: AttributeAssignment[]; // Valores posibles por atributo
}

export interface ProductVariant {
  id: number;
  product_id: number;
  sku: string;
  name: string;
  price: string;
  compare_price: string;
  stock_quantity: number;
  weight: string;
  attributes: any; // JSON con talla, color, etc.
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Inventario por sucursal para producto/variantes
export interface BranchProduct {
  id: number;
  branch_id: number;
  product_id: number;
  product_variant_id: number | null; // null cuando es inventario a nivel producto
  stock: number; // unidades disponibles en esa sucursal
  min_stock: number;
  max_stock: number;
  reorder_point: number;
  cost_price: string | null;
  selling_price: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  branch?: any;
}

export interface ProductAttribute {
  id: number;
  product_id: number;
  name: string; // "Talla", "Color", "Material"
  value: string; // "S", "Rojo", "Algodón"
  type: 'color' | 'size' | 'material' | 'weight' | 'dimensions' | 'brand' | 'model' | 'warranty' | 'origin' | 'custom';
  is_required: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProductUI extends Product {
  isFavorite: boolean;
  image: string;
  originalPrice?: string;
  discount?: number;
  availableSizes?: string[];
  availableColors?: string[];
  selectedVariant?: ProductVariant;
}

export interface AttributeAssignmentValue {
  id: number;
  attribute_id: number;
  value: string;
  slug?: string;
  color_code?: string | null;
  image_url?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface AttributeWithValues {
  id: number;
  name: string; // "Color", "Talla"
  slug: string; // "color", "talla"
  type: string; // e.g., 'select'
  active_values: AttributeAssignmentValue[];
}

export interface AttributeAssignment {
  id: number;
  product_id: number;
  attribute_id: number;
  selected_values?: number[];
  is_required?: boolean;
  sort_order?: number;
  is_active?: boolean;
  attribute: AttributeWithValues;
}

// Interfaz para información de variantes del sistema inteligente
export interface VariantInfo {
  size_type: string;
  needs_variants: boolean;
  display_name: string;
  size_guide: string;
  available_sizes: string[];
  available_colors: string[];
  available_materials: string[];
  product: {
    id: number;
    name: string;
    slug: string;
    category: {
      id: number;
      name: string;
      slug: string;
    } | null;
  };
  existing_variants: ProductVariant[];
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

