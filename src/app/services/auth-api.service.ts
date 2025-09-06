import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { LoginRequest, LoginResponse, RegisterRequest, ForgotPasswordRequest, ResetPasswordRequest, User } from '../interfaces/auth.interfaces';
import { ApiResponse } from '../interfaces/product.interfaces';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthApiService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  // =====================================================
  // MÉTODOS DE AUTENTICACIÓN
  // =====================================================

  /**
   * Inicia sesión de usuario
   * @param credentials Credenciales de login
   */
  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/auth/login`, credentials);
  }

  /**
   * Registra un nuevo usuario
   * @param userData Datos del usuario
   */
  register(userData: RegisterRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/auth/register`, userData);
  }

  /**
   * Cierra sesión del usuario
   */
  logout(): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/logout`, {});
  }

  /**
   * Obtiene información del usuario actual
   */
  getCurrentUser(): Observable<User> {
    console.log('🌐 AuthApiService.getCurrentUser() - Haciendo petición a:', `${this.baseUrl}/auth/me`);

    return this.http.get<ApiResponse<User>>(`${this.baseUrl}/auth/me`)
      .pipe(
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
    return this.http.post<LoginResponse>(`${this.baseUrl}/auth/refresh`, {});
  }
}
