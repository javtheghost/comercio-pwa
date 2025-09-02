import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Product, Category } from '../interfaces/product.interfaces';

@Injectable({
  providedIn: 'root'
})
export class ProductService {

  constructor() { }

  getProducts(): Observable<Product[]> {
    // TODO: Implement actual API call
    // For now, return empty array
    return of([]);
  }

  getRootCategories(): Observable<Category[]> {
    // TODO: Implement actual API call
    // For now, return empty array
    return of([]);
  }

  searchProducts(query: string): Observable<Product[]> {
    // TODO: Implement actual API call
    // For now, return empty array
    return of([]);
  }

  getCategoryProducts(categoryId: number): Observable<Product[]> {
    // TODO: Implement actual API call
    // For now, return empty array
    return of([]);
  }
}

