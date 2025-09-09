import { Component, signal, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('comercio-pwa');
  private authService = inject(AuthService);

  constructor() {
    // Hacer el método de debug disponible globalmente para desarrollo
    if (typeof window !== 'undefined') {
      (window as any).debugAuth = () => this.authService.debugAuthState();
      console.log('🔧 [DEBUG] Método debugAuth() disponible globalmente. Ejecuta: debugAuth()');
    }
  }
}
