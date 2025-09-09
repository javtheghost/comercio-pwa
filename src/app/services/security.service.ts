import { Injectable } from '@angular/core';
import { EncryptionService } from './encryption.service';
import { BehaviorSubject, Observable } from 'rxjs';

export interface SecurityConfig {
  tokenExpiryBuffer: number; // minutos antes de expirar para renovar
  maxLoginAttempts: number;
  enableTokenEncryption: boolean; // Encriptación específica para tokens
  enableUserEncryption: boolean; // Encriptación específica para datos de usuario
}

@Injectable({
  providedIn: 'root'
})
export class SecurityService {
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'auth_user';
  private readonly LOGIN_ATTEMPTS_KEY = 'login_attempts';

  private securityConfig: SecurityConfig = {
    tokenExpiryBuffer: 5, // 5 minutos antes de expirar
    maxLoginAttempts: 5,
    enableTokenEncryption: false, // Deshabilitar encriptación para tokens - SIMPLIFICADO
    enableUserEncryption: false // Deshabilitar encriptación para datos de usuario - SIMPLIFICADO
  };

  constructor(private encryptionService: EncryptionService) {
    this.initializeSecurity();
  }

  private initializeSecurity(): void {
    if (typeof window !== 'undefined') {
      this.trackUserActivity();
    }
  }

  /**
   * Guarda el token de forma segura
   */
  async setSecureToken(token: string): Promise<void> {
    if (!this.isBrowser()) return;

    console.log('🔍 [SECURITY SERVICE] Guardando token (sin encriptación)');
    localStorage.setItem(this.TOKEN_KEY, token);
    console.log('✅ [SECURITY SERVICE] Token guardado correctamente');
  }

  /**
   * Obtiene el token de forma segura
   */
  async getSecureToken(): Promise<string | null> {
    if (!this.isBrowser()) return null;

    const token = localStorage.getItem(this.TOKEN_KEY);
    if (!token) {
      console.log('🔍 [SECURITY SERVICE] No hay token en localStorage');
      return null;
    }

    console.log('🔍 [SECURITY SERVICE] Token encontrado en localStorage');
    console.log('  - Token (primeros 50 chars):', token.substring(0, 50) + '...');
    console.log('  - Longitud del token:', token.length);

    return token;
  }

  /**
   * Obtiene el token de forma síncrona (para interceptores)
   */
  getTokenSync(): string | null {
    if (!this.isBrowser()) return null;
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Verifica si hay datos de autenticación válidos
   */
  async hasValidAuthData(): Promise<boolean> {
    try {
      const token = await this.getSecureToken();
      const user = await this.getSecureUser();

      // Verificar que existe token y usuario
      if (!token || !user) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ [SECURITY SERVICE] Error verificando datos de autenticación:', error);
      return false;
    }
  }

  /**
   * Guarda el usuario de forma segura
   */
  async setSecureUser(user: any): Promise<void> {
    if (!this.isBrowser()) return;

    console.log('🔍 [SECURITY SERVICE] Guardando usuario (sin encriptación)');
    const userString = JSON.stringify(user);
    localStorage.setItem(this.USER_KEY, userString);
    console.log('✅ [SECURITY SERVICE] Usuario guardado correctamente');
  }

  /**
   * Obtiene el usuario de forma segura
   */
  async getSecureUser(): Promise<any | null> {
    if (!this.isBrowser()) return null;

    const userString = localStorage.getItem(this.USER_KEY);
    if (!userString) {
      console.log('🔍 [SECURITY SERVICE] No hay usuario en localStorage');
      return null;
    }

    console.log('🔍 [SECURITY SERVICE] Usuario encontrado en localStorage');
    console.log('  - Usuario (primeros 50 chars):', userString.substring(0, 50) + '...');
    console.log('  - Longitud del usuario:', userString.length);

    try {
      const user = JSON.parse(userString);
      console.log('✅ [SECURITY SERVICE] Usuario parseado correctamente');
      return user;
    } catch (error) {
      console.error('❌ [SECURITY SERVICE] Error parseando usuario:', error);
      return null;
    }
  }


  /**
   * Registra un intento de login fallido
   */
  recordFailedLoginAttempt(): number {
    if (!this.isBrowser()) return 0;

    const attempts = this.getFailedLoginAttempts() + 1;
    localStorage.setItem(this.LOGIN_ATTEMPTS_KEY, attempts.toString());

    // Bloquear después de máximo intentos
    if (attempts >= this.securityConfig.maxLoginAttempts) {
      this.blockAccount();
    }

    return attempts;
  }

  /**
   * Obtiene el número de intentos fallidos
   */
  getFailedLoginAttempts(): number {
    if (!this.isBrowser()) return 0;
    const attempts = localStorage.getItem(this.LOGIN_ATTEMPTS_KEY);
    return attempts ? parseInt(attempts) : 0;
  }

  /**
   * Resetea los intentos fallidos
   */
  resetFailedLoginAttempts(): void {
    if (!this.isBrowser()) return;
    localStorage.removeItem(this.LOGIN_ATTEMPTS_KEY);
  }

  /**
   * Bloquea la cuenta temporalmente
   */
  private blockAccount(): void {
    if (!this.isBrowser()) return;
    const blockUntil = new Date();
    blockUntil.setMinutes(blockUntil.getMinutes() + 15); // Bloquear por 15 minutos
    localStorage.setItem('account_blocked_until', blockUntil.toISOString());
  }

  /**
   * Verifica si la cuenta está bloqueada
   */
  isAccountBlocked(): boolean {
    if (!this.isBrowser()) return false;

    const blockedUntil = localStorage.getItem('account_blocked_until');
    if (!blockedUntil) return false;

    const blockTime = new Date(blockedUntil);
    const now = new Date();

    if (now > blockTime) {
      localStorage.removeItem('account_blocked_until');
      return false;
    }

    return true;
  }

  /**
   * Limpia todos los datos de seguridad
   */
  clearSecureData(): void {
    if (!this.isBrowser()) return;

    console.log('🧹 [SECURITY SERVICE] Limpiando todos los datos de seguridad...');

    // Limpiar datos de autenticación
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.LOGIN_ATTEMPTS_KEY);
    localStorage.removeItem('account_blocked_until');

    // Limpiar datos del carrito
    localStorage.removeItem('cart_session_id');
    localStorage.removeItem('guest_email');

    // Limpiar datos de reCAPTCHA
    localStorage.removeItem('_grecaptcha');

    // Limpiar cualquier otro dato relacionado con la sesión
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith('auth_') ||
        key.startsWith('cart_') ||
        key.startsWith('user_') ||
        key.startsWith('session_') ||
        key.includes('recaptcha') ||
        key.includes('grecaptcha')
      )) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log('🧹 [SECURITY SERVICE] Removido:', key);
    });

    console.log('✅ [SECURITY SERVICE] Limpieza completa de datos de seguridad finalizada');
  }

  /**
   * Limpia completamente todo el localStorage (usar con precaución)
   */
  clearAllLocalStorage(): void {
    if (!this.isBrowser()) return;

    console.log('🧹 [SECURITY SERVICE] Limpiando TODO el localStorage...');
    localStorage.clear();
    console.log('✅ [SECURITY SERVICE] Todo el localStorage ha sido limpiado');
  }

  /**
   * Rastrea la actividad del usuario
   */
  private trackUserActivity(): void {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    events.forEach(event => {
      document.addEventListener(event, () => {
        // Usuario activo detectado
      }, { passive: true });
    });
  }

  /**
   * Verifica si estamos en un entorno de navegador
   */
  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }

  /**
   * Configura las opciones de seguridad
   */
  setSecurityConfig(config: Partial<SecurityConfig>): void {
    this.securityConfig = { ...this.securityConfig, ...config };
  }

  /**
   * Obtiene la configuración de seguridad
   */
  getSecurityConfig(): SecurityConfig {
    return { ...this.securityConfig };
  }
}
