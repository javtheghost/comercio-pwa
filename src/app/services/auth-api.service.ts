import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { LoginRequest, LoginResponse, RegisterRequest, ForgotPasswordRequest, ResetPasswordRequest, User } from '../interfaces/auth.interfaces';
import { ApiResponse } from '../interfaces/product.interfaces';
import { environment } from '../../environments/environment';
import { SecurityService } from './security.service';

@Injectable({
  providedIn: 'root'
})
export class AuthApiService {
  private baseUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private securityService: SecurityService
  ) { }

  // =====================================================
  // MÉTODOS DE AUTENTICACIÓN
  // =====================================================

  /**
   * Obtiene los headers con autenticación
   */
  private getAuthHeaders(): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });

    try {
      const token = this.securityService.getTokenSync();
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
        console.log('🔑 [AUTH API] Token agregado a headers');
      } else {
        console.log('⚠️ [AUTH API] No hay token disponible');
      }
    } catch (error) {
      console.error('❌ [AUTH API] Error obteniendo token:', error);
    }

    return headers;
  }

  /**
   * Inicia sesión de usuario
   * @param credentials Credenciales de login
   */
  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/auth/login`, credentials, {
      withCredentials: true
    });
  }

  /**
   * Registra un nuevo usuario
   * @param userData Datos del usuario
   */
  register(userData: RegisterRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/auth/register`, userData, {
      withCredentials: true
    });
  }

  /**
   * Cierra sesión del usuario
   */
  logout(): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.post(`${this.baseUrl}/auth/logout`, {}, {
      headers: headers,
      withCredentials: true
    });
  }

  /**
   * Obtiene información del usuario actual
   */
  getCurrentUser(): Observable<User> {
    console.log('🌐 AuthApiService.getCurrentUser() - Haciendo petición a:', `${this.baseUrl}/auth/me`);

    const headers = this.getAuthHeaders();
    return this.http.get<ApiResponse<User>>(`${this.baseUrl}/auth/me`, {
      headers: headers,
      withCredentials: true
    }).pipe(
      map(response => {
        console.log('🌐 AuthApiService.getCurrentUser() - Respuesta cruda:', response);
        console.log('🌐 AuthApiService.getCurrentUser() - Data extraída:', response.data);
        return response.data;
      })
    );
  }

  /**
   * Solicita restablecimiento de contraseña
   * @param data Datos para restablecer contraseña
   */
  forgotPassword(data: ForgotPasswordRequest): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/forgot-password`, data);
  }

  /**
   * Restablece la contraseña del usuario
   * @param data Datos para restablecer contraseña
   */
  resetPassword(data: ResetPasswordRequest): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/reset-password`, data);
  }

  /**
   * Renueva el token de autenticación
   */
  refreshToken(): Observable<LoginResponse> {
    const headers = this.getAuthHeaders();
    return this.http.post<LoginResponse>(`${this.baseUrl}/auth/refresh`, {}, {
      headers: headers,
      withCredentials: true
    });
  }

  /**
   * Reenvía el correo de verificación
   */
  resendVerificationEmail(): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.post(`${this.baseUrl}/auth/email/resend`, {}, {
      headers: headers,
      withCredentials: true
    });
  }
}
