import { Injectable, Inject, forwardRef } from '@angular/core';
import { AuthService } from './auth.service';
import { FavoritesService } from './favorites.service';
import { NotificationService } from './notification.service';

/**
 * Servicio para sincronizar sesiones entre múltiples tabs/navegadores
 * 
 * Funcionalidades:
 * 1. Detecta cuando otra tab/navegador cierra sesión
 * 2. Detecta cuando otra tab/navegador inicia sesión
 * 3. Sincroniza favoritos y notificaciones entre tabs
 * 4. Refresca datos cuando la app vuelve al foreground
 */
@Injectable({
  providedIn: 'root'
})
export class SessionSyncService {
  
  private readonly STORAGE_KEY = 'session_sync_event';
  private readonly LAST_ACTIVITY_KEY = 'last_session_activity';
  private isListening = false;

  constructor(
    private authService: AuthService,
    private favoritesService: FavoritesService,
    @Inject(forwardRef(() => NotificationService)) private notificationService: NotificationService
  ) {}

  /**
   * Inicializar sincronización de sesión
   * Se llama automáticamente desde app.config.ts
   */
  init(): void {
    if (this.isListening) return;
    
    console.log('🔄 [SESSION SYNC] Inicializando sincronización entre tabs...');
    
    // 1. Escuchar cambios en localStorage (otras tabs)
    this.listenToStorageChanges();
    
    // 2. Escuchar cuando la app vuelve al foreground
    this.listenToVisibilityChanges();
    
    // 3. Escuchar eventos de auth
    this.listenToAuthEvents();
    
    this.isListening = true;
  }

  /**
   * Escuchar cambios en localStorage desde otras tabs
   */
  private listenToStorageChanges(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('storage', (event: StorageEvent) => {
      // Solo procesar cambios del evento de sincronización
      if (event.key !== this.STORAGE_KEY) return;
      
      if (!event.newValue) return;
      
      try {
        const syncEvent = JSON.parse(event.newValue);
        this.handleSyncEvent(syncEvent);
      } catch (error) {
        console.error('❌ [SESSION SYNC] Error procesando evento:', error);
      }
    });

    console.log('✅ [SESSION SYNC] Escuchando cambios en otras tabs');
  }

  /**
   * Escuchar cuando el usuario cambia de tab y vuelve
   */
  private listenToVisibilityChanges(): void {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.handleAppBecameVisible();
      }
    });

    console.log('✅ [SESSION SYNC] Escuchando cambios de visibilidad');
  }

  /**
   * Escuchar eventos de autenticación
   */
  private listenToAuthEvents(): void {
    if (typeof window === 'undefined') return;

    // Cuando el usuario inicia sesión
    window.addEventListener('userLoggedIn', () => {
      this.broadcastEvent({ type: 'login', timestamp: Date.now() });
    });

    // Cuando el usuario cierra sesión
    window.addEventListener('userLoggedOut', () => {
      this.broadcastEvent({ type: 'logout', timestamp: Date.now() });
    });

    console.log('✅ [SESSION SYNC] Escuchando eventos de auth');
  }

  /**
   * Manejar eventos de sincronización de otras tabs
   */
  private handleSyncEvent(event: any): void {
    console.log('📨 [SESSION SYNC] Evento recibido de otra tab:', event.type);

    switch (event.type) {
      case 'logout':
        this.handleRemoteLogout();
        break;
      
      case 'login':
        this.handleRemoteLogin();
        break;
      
      case 'favorites_updated':
        this.handleFavoritesUpdated();
        break;
      
      case 'notifications_updated':
        this.handleNotificationsUpdated();
        break;
    }
  }

  /**
   * Otra tab cerró sesión - cerrar aquí también
   */
  private handleRemoteLogout(): void {
    console.log('🔴 [SESSION SYNC] Otra tab cerró sesión, cerrando aquí también...');
    
    if (this.authService.isAuthenticated()) {
      // Cerrar sesión SIN llamar a la API (ya lo hizo la otra tab)
      this.authService.clearLocalSession();
      
      // Notificar al usuario
      this.showNotification('Sesión cerrada', 'Se cerró la sesión en otra pestaña');
    }
  }

  /**
   * Otra tab inició sesión - recargar datos
   */
  private handleRemoteLogin(): void {
    console.log('🟢 [SESSION SYNC] Otra tab inició sesión, recargando datos...');
    
    // Verificar si el token cambió
    const currentToken = localStorage.getItem('auth_token');
    
    if (currentToken) {
      // Recargar estado de autenticación
      this.authService.checkAuthStatus();
      
      // Sincronizar favoritos y notificaciones
      this.syncAllData();
      
      this.showNotification('Sesión actualizada', 'Se inició sesión en otra pestaña');
    }
  }

  /**
   * Favoritos actualizados en otra tab
   */
  private handleFavoritesUpdated(): void {
    console.log('⭐ [SESSION SYNC] Favoritos actualizados en otra tab');
    this.favoritesService.forceSync();
  }

  /**
   * Notificaciones actualizadas en otra tab
   */
  private handleNotificationsUpdated(): void {
    console.log('🔔 [SESSION SYNC] Notificaciones actualizadas en otra tab');
    this.notificationService.forceBackendSync();
  }

  /**
   * La app volvió a estar visible (usuario volvió a esta tab)
   */
  private handleAppBecameVisible(): void {
    console.log('👁️ [SESSION SYNC] App visible de nuevo, verificando cambios...');
    
    // Verificar si hubo actividad reciente en otras tabs
    const lastActivity = localStorage.getItem(this.LAST_ACTIVITY_KEY);
    const now = Date.now();
    
    if (lastActivity) {
      const timeSinceLastActivity = now - parseInt(lastActivity, 10);
      
      // Si hubo actividad en los últimos 30 segundos, sincronizar
      if (timeSinceLastActivity < 30000) {
        console.log('🔄 [SESSION SYNC] Actividad reciente detectada, sincronizando...');
        this.syncAllData();
      }
    }
  }

  /**
   * Sincronizar todos los datos desde el backend
   */
  private syncAllData(): void {
    if (!this.authService.isAuthenticated()) return;

    console.log('🔄 [SESSION SYNC] Sincronizando todos los datos...');
    
    // Forzar sincronización de favoritos
    this.favoritesService.forceSync();
    
    // Forzar sincronización de notificaciones
    this.notificationService.forceBackendSync();
  }

  /**
   * Enviar evento a otras tabs
   */
  private broadcastEvent(event: any): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(event));
      
      // Actualizar timestamp de última actividad
      localStorage.setItem(this.LAST_ACTIVITY_KEY, Date.now().toString());
      
      // Limpiar el evento inmediatamente para que pueda ser reutilizado
      setTimeout(() => {
        localStorage.removeItem(this.STORAGE_KEY);
      }, 100);
    } catch (error) {
      console.error('❌ [SESSION SYNC] Error enviando evento:', error);
    }
  }

  /**
   * Mostrar notificación al usuario
   */
  private showNotification(title: string, message: string): void {
    // Aquí podrías usar un ToastController de Ionic o similar
    console.log(`📢 [SESSION SYNC] ${title}: ${message}`);
    
    // Opcional: Mostrar notificación del sistema
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body: message, icon: '/icons/icon-192x192.png' });
    }
  }

  /**
   * Registrar actividad del usuario (para detectar tabs inactivas)
   */
  registerActivity(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.LAST_ACTIVITY_KEY, Date.now().toString());
  }
}
