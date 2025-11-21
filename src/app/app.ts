import { Component, signal, inject, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { AuthService } from './services/auth.service';
import { NotificationService } from './services/notification.service';
import { SessionSyncService } from './services/session-sync.service';
import { TokenRefreshService } from './services/token-refresh.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('Book Smart Store');
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private sessionSync = inject(SessionSyncService);
  private tokenRefresh = inject(TokenRefreshService); // Inyectar para que se inicialice

  constructor() {
    // Hacer el método de debug disponible globalmente para desarrollo
    if (typeof window !== 'undefined') {
      (window as any).debugAuth = () => this.authService.debugAuthState();
      console.log('🔧 [DEBUG] Método debugAuth() disponible globalmente. Ejecuta: debugAuth()');
    }
  }

  async ngOnInit() {
    try {
      // 1. Inicializar sincronización de sesión entre tabs
      this.sessionSync.init();
      
      // 2. Solicitar permisos de notificación con un diálogo amigable
      await this.requestNotificationPermission();
      
      // 3. Inicializar el servicio de notificaciones Web Push
      await this.notificationService.initializePushNotifications();

      // 4. Escuchar mensajes del Service Worker (para cart_abandoned clicks)
      this.listenToServiceWorkerMessages();
      
      // 5. El TokenRefreshService se inicializa automáticamente al ser inyectado
      console.log('✅ [APP] Sistema de renovación automática de tokens inicializado');
    } catch (error) {
      console.error('❌ Error inicializando servicios:', error);
    }
  }

  /**
   * Solicita permisos de notificación al usuario de forma amigable
   */
  private async requestNotificationPermission(): Promise<void> {
    try {
      // Verificar si las notificaciones están disponibles
      if (typeof Notification === 'undefined') {
        console.log('ℹ️ Notificaciones no disponibles en este navegador');
        return;
      }

      // Si ya se concedieron permisos, no hacer nada
      if (Notification.permission === 'granted') {
        console.log('✅ Permisos de notificación ya concedidos');
        return;
      }

      // Si ya se denegaron permisos, no molestar al usuario
      if (Notification.permission === 'denied') {
        console.log('⚠️ Permisos de notificación denegados previamente');
        return;
      }

      // Esperar un poco para que la app se cargue completamente
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verificar si es la primera vez que se solicitan permisos
      const hasRequestedBefore = localStorage.getItem('notification_permission_requested');
      
      if (!hasRequestedBefore) {
        console.log('📲 Primera visita, solicitando permisos de notificación...');
        
        // Solicitar permisos
        const permission = await Notification.requestPermission();
        
        // Marcar que ya se solicitaron permisos
        localStorage.setItem('notification_permission_requested', 'true');
        
        console.log(`📲 Permisos de notificación: ${permission}`);
        
        if (permission === 'granted') {
          console.log('✅ Usuario concedió permisos de notificación');
        } else if (permission === 'denied') {
          console.warn('⚠️ Usuario denegó permisos de notificación');
        }
      }
    } catch (error) {
      console.error('❌ Error solicitando permisos de notificación:', error);
    }
  }

  /**
   * Escuchar mensajes del Service Worker
   * Especialmente para manejar clicks en notificaciones de carrito abandonado
   */
  private listenToServiceWorkerMessages(): void {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('📨 Mensaje del Service Worker:', event.data);

        if (event.data && event.data.type === 'CART_ABANDONED_CLICK') {
          // Guardar cart_id cuando se hace clic en notificación de carrito abandonado
          const cartId = event.data.cartId;
          if (cartId) {
            localStorage.setItem('abandoned_cart_id', cartId.toString());
            console.log('💾 Cart ID guardado desde push notification:', cartId);
            
            // Opcional: Mostrar un toast indicando que se cargó el carrito
            console.log('🛒 Carrito abandonado restaurado. ID:', cartId);
          }
        } else if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
          // Manejar otros tipos de notificaciones
          console.log('🔔 Notificación clickeada:', event.data);
        } else if (event.data && event.data.type === 'PUSH_RECEIVED') {
          // Actualizar contador de notificaciones o badge
          console.log('📬 Push recibido:', event.data.payload);
        }
      });

      console.log('✅ Service Worker message listener registrado');
    }
  }
}
