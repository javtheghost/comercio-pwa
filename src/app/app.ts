import { Component, signal, inject, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { AuthService } from './services/auth.service';
import { NotificationService } from './services/notification.service';
import { SessionSyncService } from './services/session-sync.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('comercio-pwa');
  private authService: AuthService;
  private notificationService: NotificationService;
  private sessionSync: SessionSyncService;

  constructor() {
    // Inyectar servicios de forma más segura
    try {
      this.authService = inject(AuthService);
      this.notificationService = inject(NotificationService);
      this.sessionSync = inject(SessionSyncService);
    } catch (error) {
      console.error('❌ [APP] Error inyectando servicios:', error);
      throw error;
    }
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
      
      // 2. Inicializar el servicio de notificaciones Web Push
      await this.notificationService.initializePushNotifications();

      // 3. Escuchar mensajes del Service Worker (para cart_abandoned clicks)
      this.listenToServiceWorkerMessages();
    } catch (error) {
      console.error('❌ Error inicializando servicios:', error);
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
