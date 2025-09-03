import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Product, Category, ApiResponse, PaginatedResponse } from '../interfaces/product.interfaces';

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

  // Nuevo método para obtener productos paginados
  getProductsPaginated(page: number = 1, perPage: number = 15): Observable<PaginatedResponse<Product>> {
    return this.http.get<ApiResponse<PaginatedResponse<Product>>>(`${this.baseUrl}/products?page=${page}&per_page=${perPage}`)
      .pipe(
        map(response => response.data)
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
