import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface UserNotification {
  id: number;
  user_id: number;
  type: 'order_created' | 'order_status';
  title: string;
  message: string;
  data: {
    order_id: number;
    order_number: string;
    total?: number;
    status?: string;
    old_status?: string;
    new_status?: string;
    tracking_number?: string;
  };
  read: boolean;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  errors?: any;
}

interface DeleteAllResponse {
  deleted_count: number;
}

interface MarkAllReadResponse {
  updated_count: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationsApiService {

  private apiUrl = `${environment.apiUrl}/user-notifications`;

  constructor(private http: HttpClient) { }

  /**
   * Obtener notificaciones del usuario desde el backend
   */
  getNotifications(
    limit: number = 50, 
    unreadOnly: boolean = false
  ): Observable<ApiResponse<UserNotification[]>> {
    let params = new HttpParams()
      .set('limit', limit.toString())
      .set('unread', unreadOnly.toString());

    return this.http.get<ApiResponse<UserNotification[]>>(
      this.apiUrl,
      { params: params }
    ).pipe(
      tap(response => {
        const unreadCount = response.data.filter(n => !n.read).length;
        console.log(`✅ [NOTIFICATIONS API] Notificaciones obtenidas: ${response.data.length}, no leídas: ${unreadCount}`);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Marcar notificación como leída
   */
  markAsRead(notificationId: number): Observable<ApiResponse<UserNotification>> {
    return this.http.put<ApiResponse<UserNotification>>(
      `${this.apiUrl}/${notificationId}/read`,
      {}
    ).pipe(
      tap(response => {
        console.log(`✅ [NOTIFICATIONS API] Notificación ${notificationId} marcada como leída`);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Marcar todas las notificaciones como leídas
   */
  markAllAsRead(): Observable<ApiResponse<MarkAllReadResponse>> {
    return this.http.put<ApiResponse<MarkAllReadResponse>>(
      `${this.apiUrl}/read-all`,
      {}
    ).pipe(
      tap(response => {
        const count = response?.data?.updated_count ?? 0;
        console.log(`✅ [NOTIFICATIONS API] ${count} notificaciones marcadas como leídas`);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Eliminar una notificación
   */
  deleteNotification(notificationId: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(
      `${this.apiUrl}/${notificationId}`
    ).pipe(
      tap(() => {
        console.log(`✅ [NOTIFICATIONS API] Notificación ${notificationId} eliminada`);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Eliminar todas las notificaciones
   */
  deleteAllNotifications(): Observable<ApiResponse<DeleteAllResponse>> {
    return this.http.delete<ApiResponse<DeleteAllResponse>>(this.apiUrl).pipe(
      tap(response => {
        const count = response?.data?.deleted_count ?? 0;
        console.log(`✅ [NOTIFICATIONS API] ${count} notificaciones eliminadas`);
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
    console.error('❌ [NOTIFICATIONS API] Error:', errorMessage, error);
    return throwError(() => new Error(errorMessage));
  }
}
