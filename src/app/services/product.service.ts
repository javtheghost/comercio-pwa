import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Product, Category, ApiResponse, PaginatedResponse } from '../interfaces/product.interfaces';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }


  // =====================================================
  // MÉTODOS DE PRODUCTOS
  // =====================================================

  /**
   * Obtiene todos los productos
   */
  getProducts(): Observable<Product[]> {
    return this.http.get<ApiResponse<PaginatedResponse<Product>>>(`${this.baseUrl}/products`)
      .pipe(
        map(response => response.data.data)
      );
  }

  /**
   * Obtiene productos paginados
   * @param page Número de página
   * @param perPage Productos por página
   */
  getProductsPaginated(page: number = 1, perPage: number = 15): Observable<PaginatedResponse<Product>> {
    return this.http.get<ApiResponse<PaginatedResponse<Product>>>(`${this.baseUrl}/products?page=${page}&per_page=${perPage}`)
      .pipe(
        map(response => response.data),
        catchError(error => {
          console.error('❌ [ProductService] Error obteniendo productos paginados:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Obtiene un producto específico por ID
   * @param id ID del producto
   */
  getProduct(id: number): Observable<Product> {
    console.log('🌐 ProductService.getProduct() - Haciendo petición a:', `${this.baseUrl}/products/${id}`);

    return this.http.get<ApiResponse<Product>>(`${this.baseUrl}/products/${id}`)
      .pipe(
        map(response => {
          console.log('🌐 ProductService.getProduct() - Respuesta cruda:', response);
          console.log('🌐 ProductService.getProduct() - Data extraída:', response.data);
          return response.data;
        })
      );
  }

  /**
   * Obtiene productos destacados
   */
  getFeaturedProducts(): Observable<Product[]> {
    return this.http.get<ApiResponse<PaginatedResponse<Product>>>(`${this.baseUrl}/products/featured`)
      .pipe(
        map(response => response.data.data)
      );
  }

  /**
   * Obtiene productos más vendidos
   */
  getBestsellerProducts(): Observable<Product[]> {
    return this.http.get<ApiResponse<PaginatedResponse<Product>>>(`${this.baseUrl}/products/bestsellers`)
      .pipe(
        map(response => response.data.data)
      );
  }

  /**
   * Busca productos por query
   * @param query Término de búsqueda
   */
  searchProducts(query: string): Observable<Product[]> {
    return this.http.get<ApiResponse<PaginatedResponse<Product>>>(`${this.baseUrl}/products/search?q=${query}`)
      .pipe(
        map(response => response.data.data)
      );
  }

  /**
   * Método para cargar más productos (siguiente página)
   * @param page Número de página
   * @param perPage Productos por página
   */
  loadMoreProducts(page: number, perPage: number = 15): Observable<PaginatedResponse<Product>> {
    return this.getProductsPaginated(page, perPage);
  }

  // =====================================================
  // MÉTODOS DE CATEGORÍAS (para compatibilidad)
  // =====================================================

  /**
   * Obtiene categorías raíz
   */
  getRootCategories(): Observable<Category[]> {
    return this.http.get<ApiResponse<Category[]>>(`${this.baseUrl}/categories/root`)
      .pipe(
        map(response => response.data),
        catchError(error => {
          console.error('❌ [ProductService] Error obteniendo categorías raíz:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Obtiene productos de una categoría específica
   * @param categoryId ID de la categoría
   */
  getCategoryProducts(categoryId: number): Observable<Product[]> {
    return this.http.get<ApiResponse<PaginatedResponse<Product>>>(`${this.baseUrl}/categories/${categoryId}/products`)
      .pipe(
        map(response => response.data.data)
      );
  }
}
