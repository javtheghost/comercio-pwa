import { Injectable, OnDestroy } from '@angular/core';
import { AuthService } from './auth.service';
import { SecurityService } from './security.service';
import { interval, Subscription } from 'rxjs';

interface TokenPayload {
  exp?: number; // Timestamp de expiración
  iat?: number; // Timestamp de emisión
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class TokenRefreshService implements OnDestroy {
  private refreshTimer?: Subscription;
  private readonly CHECK_INTERVAL = 5 * 60 * 1000; // Verificar cada 5 minutos
  private readonly REFRESH_BEFORE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // Renovar 7 días antes (en milisegundos)
  private readonly TOKEN_LIFETIME = 30 * 24 * 60 * 60 * 1000; // 30 días de vida del token (en milisegundos)
  private tokenIssuedAt?: number | null; // Timestamp cuando se emitió el token

  constructor(
    private authService: AuthService,
    private securityService: SecurityService
  ) {
    this.initializeTokenRefresh();
  }

  /**
   * Inicializa el sistema de renovación automática
   */
  private initializeTokenRefresh(): void {
    console.log('🔄 [TOKEN REFRESH] Inicializando sistema de renovación automática');

    // Suscribirse a cambios en el estado de autenticación
    this.authService.authState$.subscribe(state => {
      if (state.isAuthenticated && state.token) {
        this.startRefreshTimer();
      } else {
        this.stopRefreshTimer();
      }
    });
  }

  /**
   * Inicia el timer de verificación
   */
  private startRefreshTimer(): void {
    // Detener timer existente si hay
    this.stopRefreshTimer();

    console.log('⏰ [TOKEN REFRESH] Iniciando timer de verificación');

    // Verificar inmediatamente
    this.checkAndRefreshToken();

    // Configurar verificación periódica
    this.refreshTimer = interval(this.CHECK_INTERVAL).subscribe(() => {
      this.checkAndRefreshToken();
    });
  }

  /**
   * Detiene el timer de verificación
   */
  private stopRefreshTimer(): void {
    if (this.refreshTimer) {
      console.log('⏹️ [TOKEN REFRESH] Deteniendo timer de verificación');
      this.refreshTimer.unsubscribe();
      this.refreshTimer = undefined;
    }
  }

  /**
   * Verifica si el token necesita renovarse y lo renueva si es necesario
   */
  private async checkAndRefreshToken(): Promise<void> {
    try {
      const token = this.securityService.getTokenSync();

      if (!token) {
        console.log('⚠️ [TOKEN REFRESH] No hay token para verificar');
        return;
      }

      // Intentar obtener expiración del token (JWT o Sanctum)
      const expiryDate = this.getTokenExpiryDate(token);

      if (!expiryDate) {
        console.log('ℹ️ [TOKEN REFRESH] Token tipo Sanctum detectado (sin expiración en payload)');

        // Para tokens Sanctum, usar el timestamp guardado en localStorage
        if (!this.tokenIssuedAt) {
          this.tokenIssuedAt = this.getTokenIssuedTimestamp();
        }

        const now = new Date().getTime();

        // Validar timestamp
        if (!this.tokenIssuedAt || isNaN(this.tokenIssuedAt)) {
          console.warn('⚠️ [TOKEN REFRESH] Timestamp inválido, intentando renovar token...');
          try {
            await this.refreshToken();
          } catch (error) {
            console.error('❌ [TOKEN REFRESH] Error renovando token con timestamp inválido, cerrando sesión');
            this.authService.logout().subscribe();
          }
          return;
        }

        // Validar que no esté en el futuro (con margen de 1 hora por diferencias de zona horaria)
        if (this.tokenIssuedAt > now + (60 * 60 * 1000)) {
          console.warn('⚠️ [TOKEN REFRESH] Timestamp en el futuro, corrigiendo...');
          this.tokenIssuedAt = now;
          this.saveTokenIssuedTimestamp(this.tokenIssuedAt);
        }

        const tokenAge = now - this.tokenIssuedAt;
        const timeUntilExpiry = this.TOKEN_LIFETIME - tokenAge;
        const daysUntilExpiry = Math.floor(timeUntilExpiry / (24 * 60 * 60 * 1000));

        console.log(`🕐 [TOKEN REFRESH] Token Sanctum tiene ${daysUntilExpiry} días hasta expirar (edad: ${Math.floor(tokenAge / (24 * 60 * 60 * 1000))} días)`);

        // Si el token está próximo a expirar O ya expiró, intentar renovar
        if (timeUntilExpiry <= this.REFRESH_BEFORE_EXPIRY) {
          if (timeUntilExpiry > 0) {
            console.log(`🔄 [TOKEN REFRESH] Token próximo a expirar, renovando automáticamente...`);
          } else {
            console.warn('⚠️ [TOKEN REFRESH] Token expirado, intentando renovar...');
          }

          try {
            await this.refreshToken();
          } catch (error) {
            console.error('❌ [TOKEN REFRESH] Error renovando token expirado, cerrando sesión');
            this.authService.logout().subscribe();
          }
        }
        return;
      }

      // Para tokens JWT
      const now = new Date().getTime();
      const timeUntilExpiry = expiryDate.getTime() - now;
      const daysUntilExpiry = Math.floor(timeUntilExpiry / (24 * 60 * 60 * 1000));

      console.log(`🕐 [TOKEN REFRESH] Token JWT expira en ${daysUntilExpiry} días (${new Date(expiryDate).toLocaleString()})`);

      // Si el token expira en menos de 7 días, renovarlo
      if (timeUntilExpiry <= this.REFRESH_BEFORE_EXPIRY && timeUntilExpiry > 0) {
        console.log(`🔄 [TOKEN REFRESH] Token próximo a expirar, renovando automáticamente...`);
        await this.refreshToken();
      } else if (timeUntilExpiry <= 0) {
        console.warn('⚠️ [TOKEN REFRESH] Token ya expirado, cerrando sesión');
        this.authService.logout().subscribe();
      }
    } catch (error) {
      console.error('❌ [TOKEN REFRESH] Error verificando token:', error);
    }
  }

  /**
   * Renueva el token
   */
  private async refreshToken(): Promise<void> {
    try {
      console.log('🔑 [TOKEN REFRESH] Renovando token...');

      await new Promise<void>((resolve, reject) => {
        this.authService.refreshToken().subscribe({
          next: (response) => {
            console.log('✅ [TOKEN REFRESH] Token renovado exitosamente');
            // Actualizar timestamp de emisión
            this.tokenIssuedAt = new Date().getTime();
            this.saveTokenIssuedTimestamp(this.tokenIssuedAt);
            resolve();
          },
          error: (error) => {
            console.error('❌ [TOKEN REFRESH] Error renovando token:', error);
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error('❌ [TOKEN REFRESH] Error en refreshToken:', error);
      throw error;
    }
  }

  /**
   * Obtiene el timestamp de emisión del token desde localStorage
   */
  private getTokenIssuedTimestamp(): number | null {
    try {
      const stored = localStorage.getItem('token_issued_at');
      if (stored) {
        const timestamp = parseInt(stored, 10);

        // Validar que sea un número válido
        if (isNaN(timestamp)) {
          console.warn('⚠️ [TOKEN REFRESH] Timestamp corrupto en localStorage');
          return null;
        }

        // Validar que no esté en el futuro (con margen de 1 hora)
        const now = new Date().getTime();
        if (timestamp > now + (60 * 60 * 1000)) {
          console.warn('⚠️ [TOKEN REFRESH] Timestamp en el futuro, ignorando');
          return null;
        }

        // Validar que no sea demasiado antiguo (>35 días)
        const maxAge = 35 * 24 * 60 * 60 * 1000;
        if (now - timestamp > maxAge) {
          console.warn('⚠️ [TOKEN REFRESH] Timestamp demasiado antiguo (>35 días)');
          return null;
        }

        return timestamp;
      }

      // Si no existe, NO asumir nada - retornar null
      console.warn('⚠️ [TOKEN REFRESH] No existe token_issued_at en localStorage');
      return null;
    } catch (error) {
      console.error('❌ [TOKEN REFRESH] Error obteniendo timestamp de emisión:', error);
      return null;
    }
  }

  /**
   * Guarda el timestamp de emisión del token en localStorage
   */
  private saveTokenIssuedTimestamp(timestamp: number): void {
    try {
      localStorage.setItem('token_issued_at', timestamp.toString());
    } catch (error) {
      console.error('❌ [TOKEN REFRESH] Error guardando timestamp de emisión:', error);
    }
  }

  /**
   * Decodifica un JWT sin verificar la firma (solo para leer exp)
   */
  private decodeToken(token: string): TokenPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        // Token no es JWT (probablemente Sanctum), esto es normal
        return null;
      }

      const payload = parts[1];
      const decoded = JSON.parse(atob(payload));
      return decoded;
    } catch (error) {
      console.error('❌ [TOKEN REFRESH] Error decodificando token:', error);
      return null;
    }
  }

  /**
   * Obtiene la fecha de expiración del token
   */
  private getTokenExpiryDate(token: string): Date | null {
    const payload = this.decodeToken(token);

    if (!payload || !payload.exp) {
      return null;
    }

    // exp viene en segundos, convertir a milisegundos
    return new Date(payload.exp * 1000);
  }

  /**
   * Verifica si el token está próximo a expirar
   */
  public isTokenNearExpiry(): boolean {
    const token = this.securityService.getTokenSync();

    if (!token) {
      return false;
    }

    const expiryDate = this.getTokenExpiryDate(token);

    if (!expiryDate) {
      return false;
    }

    const now = new Date().getTime();
    const timeUntilExpiry = expiryDate.getTime() - now;

    return timeUntilExpiry <= this.REFRESH_BEFORE_EXPIRY && timeUntilExpiry > 0;
  }

  /**
   * Fuerza la renovación del token (para uso manual)
   */
  public async forceRefresh(): Promise<void> {
    console.log('🔄 [TOKEN REFRESH] Renovación manual solicitada');
    await this.refreshToken();
  }

  /**
   * Método de diagnóstico para verificar el estado del sistema de refresh
   */
  public diagnoseTokenRefresh(): void {
    console.log('🔍 [TOKEN REFRESH DIAGNOSTIC] ===== DIAGNÓSTICO =====');

    const token = this.securityService.getTokenSync();
    console.log('🔍 Token presente:', token ? 'SÍ' : 'NO');

    const storedTimestamp = localStorage.getItem('token_issued_at');
    console.log('🔍 token_issued_at en localStorage:', storedTimestamp || 'NO EXISTE');

    if (storedTimestamp) {
      const timestamp = parseInt(storedTimestamp, 10);
      if (!isNaN(timestamp)) {
        const now = new Date().getTime();
        const age = now - timestamp;
        const days = Math.floor(age / (24 * 60 * 60 * 1000));
        const hours = Math.floor((age % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

        console.log(`🔍 Edad del token: ${days} días, ${hours} horas`);
        console.log(`🔍 Fecha de emisión: ${new Date(timestamp).toLocaleString()}`);

        const timeUntilExpiry = this.TOKEN_LIFETIME - age;
        const daysUntilExpiry = Math.floor(timeUntilExpiry / (24 * 60 * 60 * 1000));
        console.log(`🔍 Días hasta expiración: ${daysUntilExpiry}`);

        if (timeUntilExpiry <= this.REFRESH_BEFORE_EXPIRY) {
          console.log('⚠️ Token debería renovarse AHORA');
        } else {
          console.log('✅ Token NO necesita renovación todavía');
        }
      } else {
        console.log('❌ Timestamp corrupto (no es un número)');
      }
    }

    console.log('🔍 Timer activo:', this.refreshTimer ? 'SÍ' : 'NO');
    console.log('🔍 [TOKEN REFRESH DIAGNOSTIC] ===== FIN =====');
  }

  ngOnDestroy(): void {
    this.stopRefreshTimer();
  }
}
