import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon, IonItem, IonLabel, IonToggle } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { notifications, notificationsOff } from 'ionicons/icons';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-notification-toggle',
  standalone: true,
  imports: [CommonModule, IonIcon, IonItem, IonLabel, IonToggle],
  template: `
    <ion-item *ngIf="isAuthenticated">
      <ion-icon name="notifications" slot="start" [color]="notificationsEnabled ? 'primary' : 'medium'"></ion-icon>
      <ion-label>
        <h3>Notificaciones Push</h3>
        <p>{{ notificationsEnabled ? 'Activadas' : 'Desactivadas' }}</p>
      </ion-label>
      <ion-toggle
        slot="end"
        [checked]="notificationsEnabled"
        (ionChange)="toggleNotifications($event)"
        [disabled]="loading">
      </ion-toggle>
    </ion-item>

    <ion-item *ngIf="!isAuthenticated">
      <ion-icon name="notifications-off" slot="start" color="medium"></ion-icon>
      <ion-label>
        <h3>Notificaciones Push</h3>
        <p>Inicia sesión para activar notificaciones</p>
      </ion-label>
    </ion-item>
  `,
  styles: [`
    ion-item {
      --padding-start: 16px;
      --padding-end: 16px;
    }

    ion-label h3 {
      font-weight: 500;
      margin-bottom: 4px;
    }

    ion-label p {
      font-size: 14px;
      color: var(--ion-color-medium);
    }
  `]
})
export class NotificationToggleComponent implements OnInit {
  private notificationService = inject(NotificationService);
  private authService = inject(AuthService);

  isAuthenticated = false;
  notificationsEnabled = false;
  loading = false;

  constructor() {
    addIcons({ notifications, notificationsOff });
  }

  async ngOnInit() {
    // Suscribirse al estado de autenticación
    this.authService.authState$.subscribe(state => {
      this.isAuthenticated = state.isAuthenticated;
      if (this.isAuthenticated) {
        this.checkNotificationStatus();
      } else {
        this.notificationsEnabled = false;
      }
    });
  }

  async checkNotificationStatus() {
    try {
      // Verificar permisos y suscripción existente
      const hasPermissions = await this.notificationService.checkPermissions();
      const hasSubscription = await this.checkExistingSubscription();
      
      this.notificationsEnabled = hasPermissions && hasSubscription;
      
      if (this.notificationsEnabled) {
        console.log('✅ Notificaciones ya están activas');
      } else {
        console.log('ℹ️ Notificaciones no activas - permisos:', hasPermissions, 'suscripción:', hasSubscription);
      }
    } catch (error) {
      console.error('Error verificando estado de notificaciones:', error);
      this.notificationsEnabled = false;
    }
  }

  private async checkExistingSubscription(): Promise<boolean> {
    try {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        return subscription !== null;
      }
      return false;
    } catch (error) {
      console.error('Error verificando suscripción existente:', error);
      return false;
    }
  }

  async toggleNotifications(event: any) {
    this.loading = true;

    try {
      if (event.detail.checked) {
        console.log('🔄 Activando notificaciones...');
        
        // Verificar si ya están activas
        const alreadyActive = await this.checkExistingSubscription();
        if (alreadyActive) {
          console.log('✅ Las notificaciones ya están activas');
          this.notificationsEnabled = true;
          return;
        }

        // Activar notificaciones - solicitar permisos manualmente
        const success = await this.notificationService.requestPermissionsManually();
        
        if (success) {
          console.log('✅ Notificaciones activadas exitosamente');
          this.notificationsEnabled = true;
          
          // Verificar si estamos en modo desarrollo
          if (this.notificationService.isInDevelopmentMode()) {
            console.log('ℹ️ Modo desarrollo: Solo notificaciones locales disponibles');
            console.log('💡 Para notificaciones push reales, despliega en HTTPS');
          }
          
          // También activar en el servicio de autenticación si es necesario
          try {
            await this.authService.enableNotifications();
          } catch (authError) {
            console.warn('⚠️ Error en auth service, pero notificaciones funcionan:', authError);
          }
        } else {
          console.log('❌ No se pudieron activar las notificaciones');
          // Revertir el toggle si no se concedieron los permisos
          this.notificationsEnabled = false;
          
          // Mostrar mensaje al usuario
          console.log('💡 Sugerencias:');
          console.log('  1. Verifica que el navegador soporte notificaciones');
          console.log('  2. Asegúrate de aceptar los permisos cuando aparezcan');
          console.log('  3. Intenta recargar la página y volver a intentar');
          console.log('  4. En desarrollo local, solo funcionan notificaciones locales');
        }
      } else {
        // Desactivar notificaciones
        console.log('🔄 Desactivando notificaciones...');
        
        try {
          // Desuscribirse del push manager
          if ('serviceWorker' in navigator && 'PushManager' in window) {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            
            if (subscription) {
              await subscription.unsubscribe();
              console.log('✅ Suscripción push eliminada');
            }
          }
          
          this.notificationsEnabled = false;
          console.log('✅ Notificaciones desactivadas');
        } catch (error) {
          console.error('❌ Error desactivando notificaciones:', error);
          // Mantener el estado anterior si hay error
          this.notificationsEnabled = true;
        }
      }
    } catch (error) {
      console.error('Error cambiando estado de notificaciones:', error);
      this.notificationsEnabled = false;
    } finally {
      this.loading = false;
    }
  }
}
