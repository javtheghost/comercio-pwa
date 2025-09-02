import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Product, Category } from '../interfaces/product.interfaces';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class ProductService {

  constructor(private apiService: ApiService) { }

  getProducts(): Observable<Product[]> {
    return this.apiService.getProducts();
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

