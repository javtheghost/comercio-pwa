import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

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

// Interfaz extendida para la UI
export interface ProductUI extends Product {
  isFavorite?: boolean;
  originalPrice?: string;
  discount?: number;
  image?: string;
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
  children?: Category[];
  products?: Product[];
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

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

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = 'http://localhost:8000/api'; // Ajusta según tu configuración

  constructor(private http: HttpClient) { }

  // PRODUCTOS
  getProducts(): Observable<Product[]> {
    return this.http.get<ApiResponse<PaginatedResponse<Product>>>(`${this.baseUrl}/products`)
      .pipe(
        map(response => response.data.data)
      );
  }

  getProduct(id: number): Observable<Product> {
    return this.http.get<ApiResponse<Product>>(`${this.baseUrl}/products/${id}`)
      .pipe(
        map(response => response.data)
      );
  }

  getFeaturedProducts(): Observable<Product[]> {
    return this.http.get<ApiResponse<PaginatedResponse<Product>>>(`${this.baseUrl}/products/featured`)
      .pipe(
        map(response => response.data.data)
      );
  }

  getBestsellerProducts(): Observable<Product[]> {
    return this.http.get<ApiResponse<PaginatedResponse<Product>>>(`${this.baseUrl}/products/bestsellers`)
      .pipe(
        map(response => response.data.data)
      );
  }

  searchProducts(query: string): Observable<Product[]> {
    return this.http.get<ApiResponse<PaginatedResponse<Product>>>(`${this.baseUrl}/products/search?q=${query}`)
      .pipe(
        map(response => response.data.data)
      );
  }

  // CATEGORÍAS
  getCategories(): Observable<Category[]> {
    return this.http.get<ApiResponse<Category[]>>(`${this.baseUrl}/categories`)
      .pipe(
        map(response => response.data)
      );
  }

  getCategoryTree(): Observable<Category[]> {
    return this.http.get<ApiResponse<Category[]>>(`${this.baseUrl}/categories/tree`)
      .pipe(
        map(response => response.data)
      );
  }

  getRootCategories(): Observable<Category[]> {
    return this.http.get<ApiResponse<Category[]>>(`${this.baseUrl}/categories/root`)
      .pipe(
        map(response => response.data)
      );
  }

  getCategory(id: number): Observable<Category> {
    return this.http.get<ApiResponse<Category>>(`${this.baseUrl}/categories/${id}`)
      .pipe(
        map(response => response.data)
      );
  }

  getCategoryProducts(id: number): Observable<Product[]> {
    return this.http.get<ApiResponse<PaginatedResponse<Product>>>(`${this.baseUrl}/categories/${id}/products`)
      .pipe(
        map(response => response.data.data)
      );
  }
}
