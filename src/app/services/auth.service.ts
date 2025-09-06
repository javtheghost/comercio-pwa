import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { LoginRequest, LoginResponse, User, AuthState, RegisterRequest, ForgotPasswordRequest, ResetPasswordRequest } from '../interfaces/auth.interfaces';
import { AuthApiService } from './auth-api.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private authStateSubject = new BehaviorSubject<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    loading: false,
    error: null
  });

  public authState$ = this.authStateSubject.asObservable();

  constructor(private authApiService: AuthApiService) {
    this.initializeAuth();
  }

  private initializeAuth(): void {
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('auth_user');

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        this.authStateSubject.next({
          isAuthenticated: true,
          user,
          token,
          loading: false,
          error: null
        });
      } catch (error) {
        this.clearAuthData();
      }
    }
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    this.setLoading(true);

    return this.authApiService.login(credentials).pipe(
      tap((response: any) => {
        console.log('🔍 Respuesta completa del login:', response);

        // Manejar diferentes estructuras de respuesta
        if (response.success && response.data) {
          // Estructura esperada: { success: true, data: { user, token } }
          const { user, token } = response.data;
          this.handleSuccessfulLogin(user, token);
        } else if (response.user && response.token) {
          // Estructura alternativa: { user, token }
          this.handleSuccessfulLogin(response.user, response.token);
        } else if (response.access_token && response.user) {
          // Estructura Laravel Sanctum: { access_token, user }
          this.handleSuccessfulLogin(response.user, response.access_token);
        } else {
          console.error('❌ Estructura de respuesta no reconocida:', response);
          this.setError(response.message || 'Login failed - estructura de respuesta no reconocida');
        }
      }),
      catchError((error) => {
        console.error('❌ Error en login:', error);
        this.setError(error.error?.message || 'Login failed');
        return throwError(() => error);
      })
    );
  }

  private handleSuccessfulLogin(user: any, token: string): void {
    console.log('✅ Login exitoso, guardando datos:', { user, token });
    console.log('🔍 Usuario recibido del backend:', {
      id: user?.id,
      email: user?.email,
      role: user?.role,
      roles: user?.roles,
      first_name: user?.first_name,
      last_name: user?.last_name
    });

    // Store auth data
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));

    // Update auth state
    this.authStateSubject.next({
      isAuthenticated: true,
      user,
      token,
      loading: false,
      error: null
    });

    console.log('✅ Estado de autenticación actualizado:', this.authStateSubject.value);
    console.log('🔍 Usuario guardado en localStorage:', JSON.parse(localStorage.getItem('auth_user') || '{}'));

    // Obtener información completa del usuario con roles desde /auth/me
    console.log('🚀 Llamando a getCurrentUser() después del login...');
    this.getCurrentUser().subscribe({
      next: (completeUser) => {
        console.log('🔄 Usuario completo obtenido desde /auth/me:', completeUser);
        localStorage.setItem('auth_user', JSON.stringify(completeUser));
        this.authStateSubject.next({
          isAuthenticated: true,
          user: completeUser,
          token,
          loading: false,
          error: null
        });
        console.log('✅ Usuario actualizado con roles completos:', this.authStateSubject.value);
      },
      error: (error) => {
        console.error('❌ Error obteniendo usuario completo:', error);
        // No fallar el login si no se puede obtener la info completa
      }
    });
  }

  register(userData: RegisterRequest): Observable<LoginResponse> {
    this.setLoading(true);

    return this.authApiService.register(userData).pipe(
      tap((response: LoginResponse) => {
        if (response.success && response.data) {
          const { user, token } = response.data;

          // Store auth data
          localStorage.setItem('auth_token', token);
          localStorage.setItem('auth_user', JSON.stringify(user));

          // Update auth state
          this.authStateSubject.next({
            isAuthenticated: true,
            user,
            token,
            loading: false,
            error: null
          });

          // Obtener información completa del usuario con roles desde /auth/me
          console.log('🚀 Llamando a getCurrentUser() después del registro...');
          this.getCurrentUser().subscribe({
            next: (completeUser) => {
              console.log('🔄 Usuario completo obtenido después del registro:', completeUser);
              localStorage.setItem('auth_user', JSON.stringify(completeUser));
              this.authStateSubject.next({
                isAuthenticated: true,
                user: completeUser,
                token,
                loading: false,
                error: null
              });
            },
            error: (error) => {
              console.error('❌ Error obteniendo usuario completo después del registro:', error);
            }
          });
        } else {
          this.setError(response.message || 'Registration failed');
        }
      }),
      catchError((error) => {
        this.setError(error.error?.message || 'Registration failed');
        return throwError(() => error);
      })
    );
  }

  logout(): Observable<any> {
    this.setLoading(true);

    return this.authApiService.logout().pipe(
      tap(() => {
        this.clearAuthData();
        this.authStateSubject.next({
          isAuthenticated: false,
          user: null,
          token: null,
          loading: false,
          error: null
        });
      }),
      catchError((error) => {
        // Even if logout fails on server, clear local data
        this.clearAuthData();
        this.authStateSubject.next({
          isAuthenticated: false,
          user: null,
          token: null,
          loading: false,
          error: null
        });
        return throwError(() => error);
      })
    );
  }

  forgotPassword(data: ForgotPasswordRequest): Observable<any> {
    return this.authApiService.forgotPassword(data);
  }

  resetPassword(data: ResetPasswordRequest): Observable<any> {
    return this.authApiService.resetPassword(data);
  }

  getCurrentUser(): Observable<User> {
    console.log('🔄 AuthService.getCurrentUser() - Iniciando petición a /auth/me');
    console.log('🔑 Token actual:', this.getToken() ? 'Presente' : 'Ausente');

    return this.authApiService.getCurrentUser().pipe(
      tap((user) => {
        console.log('✅ AuthService.getCurrentUser() - Respuesta recibida:', user);
        console.log('👤 Usuario recibido - role:', user.role, 'roles:', user.roles);

        localStorage.setItem('auth_user', JSON.stringify(user));
        const currentState = this.authStateSubject.value;
        this.authStateSubject.next({
          ...currentState,
          user
        });

        console.log('✅ AuthService.getCurrentUser() - Estado actualizado:', this.authStateSubject.value);
      })
    );
  }

  refreshToken(): Observable<LoginResponse> {
    return this.authApiService.refreshToken().pipe(
      tap((response: LoginResponse) => {
        if (response.success && response.data) {
          const { user, token } = response.data;

          localStorage.setItem('auth_token', token);
          localStorage.setItem('auth_user', JSON.stringify(user));

          this.authStateSubject.next({
            isAuthenticated: true,
            user,
            token,
            loading: false,
            error: null
          });
        }
      })
    );
  }

  isAuthenticated(): boolean {
    return this.authStateSubject.value.isAuthenticated;
  }

  getCurrentUserValue(): User | null {
    return this.authStateSubject.value.user;
  }

  getToken(): string | null {
    // Primero intentar obtener del estado actual
    const stateToken = this.authStateSubject.value.token;
    if (stateToken) {
      return stateToken;
    }

    // Fallback al localStorage
    return localStorage.getItem('auth_token');
  }

  // Método para obtener el rol principal del usuario
  getUserRole(): string | null {
    const user = this.getCurrentUserValue();
    return user?.role || null;
  }

  // Método para obtener todos los roles del usuario
  getUserRoles(): string[] {
    const user = this.getCurrentUserValue();
    if (!user) return [];

    // Si el usuario tiene roles en el array 'roles'
    if (user.roles && Array.isArray(user.roles)) {
      return user.roles.map((role: any) => role.name || role);
    }

    // Fallback al rol principal
    return user.role ? [user.role] : [];
  }

  // Método para verificar si el usuario es admin
  isAdmin(): boolean {
    const roles = this.getUserRoles();
    return roles.includes('admin') || roles.includes('super_admin') || roles.includes('administrator');
  }

  // Método para verificar si el usuario tiene un rol específico
  hasRole(role: string): boolean {
    const userRoles = this.getUserRoles();
    return userRoles.includes(role);
  }

  // Método para verificar si el usuario tiene alguno de los roles especificados
  hasAnyRole(roles: string[]): boolean {
    const userRoles = this.getUserRoles();
    return roles.some(role => userRoles.includes(role));
  }

  // Método para verificar si el usuario tiene todos los roles especificados
  hasAllRoles(roles: string[]): boolean {
    const userRoles = this.getUserRoles();
    return roles.every(role => userRoles.includes(role));
  }

  // Método para obtener información completa del usuario (incluyendo roles)
  getUserInfo(): {
    user: User | null;
    role: string | null;
    roles: string[];
    isAdmin: boolean;
    isManager: boolean;
    isSales: boolean;
    isWarehouse: boolean;
    isCustomer: boolean;
  } {
    const user = this.getCurrentUserValue();
    const role = this.getUserRole();
    const roles = this.getUserRoles();
    const isAdmin = this.isAdmin();

    return {
      user,
      role,
      roles,
      isAdmin,
      isManager: this.hasRole('manager'),
      isSales: this.hasRole('sales'),
      isWarehouse: this.hasRole('warehouse'),
      isCustomer: this.hasRole('customer')
    };
  }

  private setLoading(loading: boolean): void {
    const currentState = this.authStateSubject.value;
    this.authStateSubject.next({
      ...currentState,
      loading
    });
  }

  private setError(error: string): void {
    const currentState = this.authStateSubject.value;
    this.authStateSubject.next({
      ...currentState,
      loading: false,
      error
    });
  }

  private clearAuthData(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  }

  clearError(): void {
    const currentState = this.authStateSubject.value;
    this.authStateSubject.next({
      ...currentState,
      error: null
    });
  }
}
