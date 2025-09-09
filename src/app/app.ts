import { Component, signal, inject, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { AuthService } from './services/auth.service';
import { NotificationService } from './services/notification.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('comercio-pwa');
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);

  constructor() {
    // Hacer el método de debug disponible globalmente para desarrollo
    if (typeof window !== 'undefined') {
      (window as any).debugAuth = () => this.authService.debugAuthState();
      console.log('🔧 [DEBUG] Método debugAuth() disponible globalmente. Ejecuta: debugAuth()');
    }
  }

  async ngOnInit() {
    try {
      // Inicializar el servicio de notificaciones Web Push
      await this.notificationService.initializePushNotifications();
    } catch (error) {
      console.error('❌ Error inicializando servicios:', error);
    }
  }
}
