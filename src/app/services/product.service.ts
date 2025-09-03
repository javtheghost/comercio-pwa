import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Product, Category, PaginatedResponse, ApiResponse } from '../interfaces/product.interfaces';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class ProductService {

  constructor(private apiService: ApiService) { }

  // Método original para compatibilidad
  getProducts(): Observable<Product[]> {
    return this.apiService.getProducts();
  }

  // Nuevo método para obtener productos paginados
  getProductsPaginated(page: number = 1, perPage: number = 15): Observable<PaginatedResponse<Product>> {
    return this.apiService.getProductsPaginated(page, perPage);
  }

  // Método para cargar más productos (siguiente página)
  loadMoreProducts(page: number, perPage: number = 15): Observable<PaginatedResponse<Product>> {
    return this.apiService.getProductsPaginated(page, perPage);
  }

  getRootCategories(): Observable<Category[]> {
    return this.apiService.getRootCategories();
  }

  searchProducts(query: string): Observable<Product[]> {
    return this.apiService.searchProducts(query);
  }

  getCategoryProducts(categoryId: number): Observable<Product[]> {
    return this.apiService.getCategoryProducts(categoryId);
  }
}

