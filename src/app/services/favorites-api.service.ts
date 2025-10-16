import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

interface Favorite {
  id: number;
  user_id: number;
  product_id: number;
  created_at: string;
  updated_at: string;
  product: {
    id: number;
    name: string;
    slug: string;
    price: number;
    image_url: string;
  };
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  errors?: any;
}

interface SyncResponse {
  added: number;
  removed: number;
  total: number;
  favorites: Favorite[];
}

@Injectable({
  providedIn: 'root'
})
export class FavoritesApiService {

  private apiUrl = `${environment.apiUrl}/favorites`;

  constructor(private http: HttpClient) { }

  /**
   * Obtener todos los favoritos del usuario desde el backend
   */
  getFavorites(): Observable<ApiResponse<Favorite[]>> {
    return this.http.get<ApiResponse<Favorite[]>>(this.apiUrl).pipe(
      tap(response => {
        console.log('✅ [FAVORITES API] Favoritos obtenidos del backend:', response.data.length);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Agregar producto a favoritos en el backend
   */
  addFavorite(productId: number): Observable<ApiResponse<Favorite>> {
    return this.http.post<ApiResponse<Favorite>>(
      this.apiUrl,
      { product_id: productId }
    ).pipe(
      tap(response => {
        console.log('✅ [FAVORITES API] Favorito agregado:', productId);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Eliminar favorito del backend
   */
  removeFavorite(favoriteId: number, productId: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.apiUrl}/${favoriteId}`).pipe(
      tap(() => {
        console.log('✅ [FAVORITES API] Favorito eliminado:', productId);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Sincronizar favoritos (bulk sync)
   * Envía array de product IDs y el backend sincroniza
   */
  syncFavorites(productIds: number[]): Observable<ApiResponse<SyncResponse>> {
    return this.http.post<ApiResponse<SyncResponse>>(
      `${this.apiUrl}/sync`,
      { product_ids: productIds }
    ).pipe(
      tap(response => {
        console.log(`✅ [FAVORITES API] Sincronización: +${response.data.added}, -${response.data.removed}, total: ${response.data.total}`);
      }),
      catchError(this.handleError)
    );
  }

  private handleError(error: any): Observable<never> {
    let errorMessage = 'Error desconocido';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      if (error.status === 401) {
        errorMessage = 'No autenticado. Por favor inicia sesión.';
      } else if (error.status === 404) {
        errorMessage = error.error?.message || 'Recurso no encontrado';
      } else if (error.status === 422) {
        errorMessage = 'Error de validación: ' + JSON.stringify(error.error?.errors);
      } else {
        errorMessage = error.error?.message || `Error del servidor: ${error.status}`;
      }
    }
    console.error('❌ [FAVORITES API] Error:', errorMessage, error);
    return throwError(() => new Error(errorMessage));
  }
}
