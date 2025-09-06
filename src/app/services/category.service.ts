import { environment } from '../../environments/environment';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Product, Category, ApiResponse, PaginatedResponse } from '../interfaces/product.interfaces';

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  // =====================================================
  // MÉTODOS DE CATEGORÍAS
  // =====================================================

  /**
   * Obtiene todas las categorías
   */
  getCategories(): Observable<Category[]> {
    return this.http.get<ApiResponse<Category[]>>(`${this.baseUrl}/categories`)
      .pipe(
        map(response => response.data)
      );
  }

  /**
   * Obtiene el árbol de categorías
   */
  getCategoryTree(): Observable<Category[]> {
    return this.http.get<ApiResponse<Category[]>>(`${this.baseUrl}/categories/tree`)
      .pipe(
        map(response => response.data)
      );
  }

  /**
   * Obtiene categorías raíz
   */
  getRootCategories(): Observable<Category[]> {
    return this.http.get<ApiResponse<Category[]>>(`${this.baseUrl}/categories/root`)
      .pipe(
        map(response => response.data)
      );
  }

  /**
   * Obtiene una categoría específica por ID
   * @param id ID de la categoría
   */
  getCategory(id: number): Observable<Category> {
    return this.http.get<ApiResponse<Category>>(`${this.baseUrl}/categories/${id}`)
      .pipe(
        map(response => response.data)
      );
  }

  /**
   * Obtiene productos de una categoría específica
   * @param id ID de la categoría
   */
  getCategoryProducts(id: number): Observable<Product[]> {
    return this.http.get<ApiResponse<PaginatedResponse<Product>>>(`${this.baseUrl}/categories/${id}/products`)
      .pipe(
        map(response => response.data.data)
      );
  }
}
