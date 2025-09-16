import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError, firstValueFrom } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { LoginRequest, LoginResponse, User, AuthState, RegisterRequest, ForgotPasswordRequest, ResetPasswordRequest } from '../interfaces/auth.interfaces';
import { AuthApiService } from './auth-api.service';
import { SecurityService } from './security.service';
import { NotificationService } from './notification.service';

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

  constructor(
    private authApiService: AuthApiService,
    private securityService: SecurityService,
    private notificationService: NotificationService
  ) {
    this.initializeAuth();
  }

  private async initializeAuth(): Promise<void> {
    try {
      const token = this.securityService.getTokenSync();
      const user = await this.securityService.getSecureUser();

      if (token && user) {
        this.authStateSubject.next({
          isAuthenticated: true,
          user,
          token,
          loading: false,
          error: null
        });
        console.log('✅ [AUTH SERVICE] Datos de autenticación restaurados desde localStorage');
      }
    } catch (error) {
      console.error('❌ [AUTH SERVICE] Error inicializando autenticación:', error);
      this.clearAuthData();
    }
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    console.log('🚪 [AUTH SERVICE] Iniciando login...');
    this.setLoading(true);

    return this.authApiService.login(credentials).pipe(
      tap((response: any) => {
        console.log('🔍 [AUTH SERVICE] Respuesta completa del login:', response);

        // Manejar diferentes estructuras de respuesta
        if (response.success && response.data) {
          // Estructura esperada: { success: true, data: { user, token } }
          const { user, token } = response.data;
          this.handleSuccessfulLogin(user, token, response.refresh_token);
        } else if (response.user && response.token) {
          // Estructura alternativa: { user, token }
          this.handleSuccessfulLogin(response.user, response.token, response.refresh_token);
        } else if (response.access_token && response.user) {
          // Estructura Laravel Sanctum: { access_token, user }
          this.handleSuccessfulLogin(response.user, response.access_token, response.refresh_token);
        } else {
          console.error('❌ [AUTH SERVICE] Estructura de respuesta no reconocida:', response);
          this.setError(response.message || 'Login failed - estructura de respuesta no reconocida');
        }
      }),
      catchError((error) => {
        console.error('❌ [AUTH SERVICE] Error en login:', error);
        this.setError(error.error?.message || 'Login failed');
        return throwError(() => error);
      }),
      tap(() => {
        // Asegurar que el loading se resetee en cualquier caso
        this.setLoading(false);
        console.log('🔄 [AUTH SERVICE] Loading reseteado después del login');
      })
    );
  }

  private async handleSuccessfulLogin(user: any, token: string, refreshToken?: string): Promise<void> {
    console.log('✅ Login exitoso, guardando datos:', { user, token, refreshToken });
    console.log('🔍 Usuario recibido del backend:', {
      id: user?.id,
      email: user?.email,
      role: user?.role,
      roles: user?.roles,
      first_name: user?.first_name,
      last_name: user?.last_name
    });

    try {
      // Store auth data using security service
      await this.securityService.setSecureToken(token);
      await this.securityService.setSecureUser(user);

      // El refresh token se maneja automáticamente via cookies del backend
      // No necesitamos guardarlo en localStorage

      // Obtener información completa del usuario con roles desde /auth/me ANTES de actualizar el estado
      console.log('🚀 Llamando a getCurrentUser() después del login...');

      // Usar firstValueFrom para esperar la respuesta de getCurrentUser
      const completeUser = await firstValueFrom(this.getCurrentUser());

      if (completeUser) {
        console.log('🔄 Usuario completo obtenido desde /auth/me:', completeUser);
        await this.securityService.setSecureUser(completeUser);

        // Actualizar estado UNA SOLA VEZ con los datos completos
        this.authStateSubject.next({
          isAuthenticated: true,
          user: completeUser,
          token,
          loading: false,
          error: null
        });

        console.log('✅ Estado de autenticación actualizado con datos completos:', this.authStateSubject.value);

        // Emitir evento para que el CartService pueda fusionar el carrito
        console.log('🛒 Emitiendo evento de login exitoso para fusión del carrito...');
        console.log('🛒 Datos del evento:', { user: completeUser, token: token });

        // Emitir evento inmediatamente
        const event = new CustomEvent('userLoggedIn', {
          detail: { user: completeUser, token: token }
        });
        window.dispatchEvent(event);
        console.log('✅ Evento userLoggedIn emitido correctamente');

      } else {
        // Fallback: usar datos básicos si no se puede obtener la info completa
        console.log('⚠️ No se pudo obtener usuario completo, usando datos básicos');
        this.authStateSubject.next({
          isAuthenticated: true,
          user,
          token,
          loading: false,
          error: null
        });

        // Emitir evento con datos básicos
        const event = new CustomEvent('userLoggedIn', {
          detail: { user, token }
        });
        window.dispatchEvent(event);
      }

    } catch (error) {
      console.error('❌ Error en handleSuccessfulLogin:', error);

      // Fallback: usar datos básicos en caso de error
      this.authStateSubject.next({
        isAuthenticated: true,
        user,
        token,
        loading: false,
        error: null
      });

      // Emitir evento con datos básicos
      const event = new CustomEvent('userLoggedIn', {
        detail: { user, token }
      });
      window.dispatchEvent(event);
    }
  }

  register(userData: RegisterRequest): Observable<LoginResponse> {
    this.setLoading(true);

    return this.authApiService.register(userData).pipe(
      tap((response: LoginResponse) => {
        if (response.success && response.data) {
          const { user, token } = response.data;

          // Store auth data using security service
          this.securityService.setSecureToken(token);
          this.securityService.setSecureUser(user);

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
            next: async (completeUser) => {
              console.log('🔄 Usuario completo obtenido después del registro:', completeUser);
              await this.securityService.setSecureUser(completeUser);
              this.authStateSubject.next({
                isAuthenticated: true,
                user: completeUser,
                token,
                loading: false,
                error: null
              });

              // Emitir evento para que el CartService pueda fusionar el carrito
              console.log('🛒 Emitiendo evento de registro exitoso para fusión del carrito...');
              console.log('🛒 Datos del evento:', { user: completeUser, token: token });

              // Emitir evento con un pequeño delay para asegurar que el CartService esté listo
              setTimeout(() => {
                const event = new CustomEvent('userLoggedIn', {
                  detail: { user: completeUser, token: token }
                });
                window.dispatchEvent(event);
                console.log('✅ Evento userLoggedIn emitido correctamente después del registro');
              }, 100);
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
    console.log('🚪 [AUTH SERVICE] Iniciando logout...');
    this.setLoading(true);

    return this.authApiService.logout().pipe(
      tap(() => {
        console.log('✅ [AUTH SERVICE] Logout exitoso en backend');
        this.clearAuthData();
        // Emitir evento para que el CartService pueda limpiar la sesión
        window.dispatchEvent(new CustomEvent('userLoggedOut'));
        console.log('✅ [AUTH SERVICE] Estado de autenticación limpiado');
      }),
      catchError((error) => {
        console.error('❌ [AUTH SERVICE] Error en logout del backend:', error);
        // Even if logout fails on server, clear local data
        this.clearAuthData();
        // Emitir evento para que el CartService pueda limpiar la sesión
        window.dispatchEvent(new CustomEvent('userLoggedOut'));
        console.log('✅ [AUTH SERVICE] Datos locales limpiados a pesar del error');
        return throwError(() => error);
      }),
      tap(() => {
        // Asegurar que el loading se resetee en cualquier caso
        this.setLoading(false);
        console.log('🔄 [AUTH SERVICE] Loading reseteado');
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
    const token = this.getToken();
    console.log('🔑 Token actual:', token ? 'Presente' : 'Ausente');

    return this.authApiService.getCurrentUser().pipe(
      tap(async (user) => {
        console.log('✅ AuthService.getCurrentUser() - Respuesta recibida:', user);
        console.log('👤 Usuario recibido - role:', user.role, 'roles:', user.roles);

        await this.securityService.setSecureUser(user);
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

          this.securityService.setSecureToken(token);
          this.securityService.setSecureUser(user);

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

    // Fallback al security service
    return this.securityService.getTokenSync();
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
    console.log('🧹 [AUTH SERVICE] Limpiando datos de autenticación...');

    // Limpiar datos del localStorage
    this.securityService.clearSecureData();

    // Limpiar estado de autenticación (sin tocar el loading, se maneja en logout)
    this.authStateSubject.next({
      isAuthenticated: false,
      user: null,
      token: null,
      loading: this.authStateSubject.value.loading, // Mantener el estado actual del loading
      error: null
    });

    console.log('✅ [AUTH SERVICE] Datos de autenticación limpiados completamente');
  }

  clearError(): void {
    const currentState = this.authStateSubject.value;
    this.authStateSubject.next({
      ...currentState,
      error: null
    });
  }


  /**
   * Método público para activar notificaciones manualmente
   */
  async enableNotifications(): Promise<boolean> {
    try {
      return await this.notificationService.requestPermissionsManually();
    } catch (error) {
      console.error('❌ Error habilitando notificaciones:', error);
      return false;
    }
  }

  /**
   * Método de debug temporal para verificar el estado de autenticación
   */
  debugAuthState(): void {
    console.log('🔍 [AUTH SERVICE DEBUG] ===== ESTADO DE AUTENTICACIÓN =====');
    console.log('🔍 [AUTH SERVICE DEBUG] Estado actual:', this.authStateSubject.value);
    console.log('🔍 [AUTH SERVICE DEBUG] isAuthenticated():', this.isAuthenticated());

    // Verificar localStorage directamente
    const tokenFromStorage = localStorage.getItem('auth_token');
    const userFromStorage = localStorage.getItem('auth_user');

    console.log('🔍 [AUTH SERVICE DEBUG] Token en localStorage:', tokenFromStorage ? 'SÍ' : 'NO');
    if (tokenFromStorage) {
      console.log('🔍 [AUTH SERVICE DEBUG] Token (primeros 50 chars):', tokenFromStorage.substring(0, 50) + '...');
    }

    console.log('🔍 [AUTH SERVICE DEBUG] Usuario en localStorage:', userFromStorage ? 'SÍ' : 'NO');
    if (userFromStorage) {
      try {
        const user = JSON.parse(userFromStorage);
        console.log('🔍 [AUTH SERVICE DEBUG] Usuario:', user);
      } catch (e) {
        console.log('🔍 [AUTH SERVICE DEBUG] Error parseando usuario:', e);
      }
    }

    // Verificar SecurityService
    const tokenFromSecurity = this.securityService.getTokenSync();
    console.log('🔍 [AUTH SERVICE DEBUG] Token desde SecurityService:', tokenFromSecurity ? 'SÍ' : 'NO');

    console.log('🔍 [AUTH SERVICE DEBUG] ===== FIN DEBUG =====');
  }
}
