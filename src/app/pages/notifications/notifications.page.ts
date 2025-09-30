import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, NgIf, NgFor } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonIcon, IonBadge, IonButton, IonSpinner, IonRefresher, IonRefresherContent, IonItemSliding, IonItemOptions, IonItemOption, IonAlert, IonToast } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { notifications, checkmarkCircle, time, cart, gift, alertCircle, trash, close } from 'ionicons/icons';
import { NotificationService } from '../../services/notification.service';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'order' | 'promotion' | 'system' | 'test';
  timestamp: Date;
  read: boolean;
  data?: any;
}

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, NgIf, NgFor, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonIcon, IonBadge, IonButton, IonSpinner, IonRefresher, IonRefresherContent, IonItemSliding, IonItemOptions, IonItemOption, IonAlert, IonToast],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Notificaciones</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <!-- Pull to refresh -->
      <ion-refresher slot="fixed" (ionRefresh)="handleRefresh($event)">
        <ion-refresher-content
          pullingIcon="chevron-down-circle-outline"
          refreshingSpinner="circles"
          style="--color: var(--ion-color-primary); --refresher-icon-color: var(--ion-color-primary);">
        </ion-refresher-content>
      </ion-refresher>

      <!-- Loading state -->
      <div *ngIf="loading" class="loading-container">
        <ion-spinner name="crescent"></ion-spinner>
        <p>Cargando notificaciones...</p>
      </div>

      <!-- Empty state -->
      <div *ngIf="!loading && notifications.length === 0" class="empty-state">
        <ion-icon name="notifications-outline" size="large" color="medium"></ion-icon>
        <h3>No hay notificaciones</h3>
        <p>Te notificaremos cuando tengas nuevas actualizaciones sobre tus órdenes, promociones y más</p>
        <ion-button fill="outline" (click)="sendTestNotification()" [disabled]="isSendingTest">
          <ion-icon name="notifications" slot="start" *ngIf="!isSendingTest"></ion-icon>
          <ion-spinner name="crescent" *ngIf="isSendingTest"></ion-spinner>
          <span *ngIf="!isSendingTest">Probar Notificación</span>
          <span *ngIf="isSendingTest">Enviando…</span>
        </ion-button>
      </div>

      <!-- Notifications list -->
      <ion-list *ngIf="!loading && notifications.length > 0">
        <ion-item-sliding *ngFor="let notification of notifications">
          <ion-item
            [class.unread]="!notification.read"
            (click)="openNotification(notification)"
            button>

            <ion-icon
              [name]="getNotificationIcon(notification.type)"
              [color]="getNotificationColor(notification.type)"
              slot="start">
            </ion-icon>

            <ion-label>
              <h3>{{ notification.title }}</h3>
              <p>{{ notification.message }}</p>
              <p class="timestamp">{{ formatTimestamp(notification.timestamp) }}</p>
            </ion-label>

            <ion-badge
              *ngIf="!notification.read"
              color="primary"
              slot="end">
              Nuevo
            </ion-badge>
          </ion-item>

          <ion-item-options side="end">
            <ion-item-option color="danger" (click)="deleteNotification(notification)">
              <ion-icon name="trash" slot="icon-only"></ion-icon>
            </ion-item-option>
          </ion-item-options>
        </ion-item-sliding>
      </ion-list>

      <!-- Action buttons -->
      <div *ngIf="!loading && notifications.length > 0" class="action-buttons-container">
        <ion-button
          *ngIf="hasUnreadNotifications()"
          fill="clear"
          (click)="markAllAsRead()">
          <ion-icon name="checkmark-circle" slot="start"></ion-icon>
          Marcar todas como leídas
        </ion-button>

        <ion-button
          fill="clear"
          color="danger"
          (click)="confirmDeleteAll()">
          <ion-icon name="trash" slot="start"></ion-icon>
          Eliminar todas
        </ion-button>
      </div>

      <!-- Toast for feedback -->
      <ion-toast
        [isOpen]="showToast"
        [message]="toastMessage"
        [duration]="2000"
        (didDismiss)="showToast = false">
      </ion-toast>

      <!-- Alert for confirmation -->
      <ion-alert
        [isOpen]="showDeleteAlert"
        header="Eliminar notificaciones"
        [message]="deleteAlertMessage"
        [buttons]="deleteAlertButtons"
        (didDismiss)="showDeleteAlert = false">
      </ion-alert>
    </ion-content>
  `,
  styles: [`
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      text-align: center;
    }

    .loading-container ion-spinner {
      margin-bottom: 1rem;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem 2rem;
      text-align: center;
      height: 60vh;
    }

    .empty-state ion-icon {
      margin-bottom: 1rem;
      font-size: 4rem;
    }

    .empty-state h3 {
      margin: 1rem 0 0.5rem 0;
      color: var(--ion-color-medium);
    }

    .empty-state p {
      color: var(--ion-color-medium);
      margin-bottom: 2rem;
    }

    .unread {
      --background: var(--ion-color-light);
      border-left: 4px solid var(--ion-color-primary);
    }

    .timestamp {
      font-size: 0.8rem;
      color: var(--ion-color-medium);
      margin-top: 0.25rem;
    }

    .action-buttons-container {
      padding: 1rem;
      text-align: center;
      display: flex;
      justify-content: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

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
export class NotificationsPage implements OnInit, OnDestroy {
  notifications: NotificationItem[] = [];
  loading = false;
  showToast = false;
  toastMessage = '';
  isSendingTest = false;
  showDeleteAlert = false;
  deleteAlertMessage = '';
  deleteAlertButtons: any[] = [];
  private subscription: Subscription = new Subscription();
  // Claves por usuario
  private readonly NOTIF_PREFIX = 'notifications_';
  private readonly DELETED_PREFIX = 'notifications_deleted_';
  // Estado auth actual (para determinar clave)
  private currentUserId: number | 'guest' = 'guest';
  private authSub?: Subscription;
  private globalNotifListener?: any;

  constructor(private notificationService: NotificationService, private authService: AuthService, private router: Router) {
    addIcons({ notifications, checkmarkCircle, time, cart, gift, alertCircle, trash, close });
  }

  ngOnInit() {
    // Suscribirse al estado de auth para actualizar clave de almacenamiento
    this.authSub = this.authService.authState$.subscribe(state => {
      const newId = state.isAuthenticated && state.user && typeof (state.user as any).id === 'number'
        ? (state.user as any).id as number
        : 'guest';
      const changed = newId !== this.currentUserId;
      this.currentUserId = newId;
      if (changed) {
        this.loadNotifications();
      }
    });

    this.loadNotifications();
    // Exponer el método públicamente para el servicio de notificaciones
    (window as any).notificationsPage = this;

    // Escuchar eventos globales de actualizaciones
    this.globalNotifListener = () => this.loadNotifications();
    window.addEventListener('notifications:updated', this.globalNotifListener);
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
    // Limpiar referencia global
    (window as any).notificationsPage = null;
    if (this.authSub) this.authSub.unsubscribe();
    if (this.globalNotifListener) {
      window.removeEventListener('notifications:updated', this.globalNotifListener);
    }
  }

  async loadNotifications() {
    this.loading = true;

    try {
      // Cargar notificaciones reales desde localStorage
      // En producción, esto vendría de una API
  const savedNotifications = this.getSavedNotifications();
      this.notifications = savedNotifications;

      // Filtrar notificaciones eliminadas
      this.filterDeletedNotifications();

      console.log('✅ Notificaciones reales cargadas:', this.notifications.length);
    } catch (error) {
      console.error('❌ Error cargando notificaciones:', error);
      this.notifications = [];
    } finally {
      this.loading = false;
    }
  }

  async handleRefresh(event: any) {
    await this.loadNotifications();
    event.target.complete();
  }

  markAsRead(notification: NotificationItem) {
    if (!notification.read) {
      notification.read = true;
      this.saveNotifications(); // Guardar cambios
      console.log('✅ Notificación marcada como leída:', notification.id);
    }
  }

  openNotification(notification: NotificationItem) {
    this.markAsRead(notification);
    const data = notification.data || {};
    const orderId = data.orderId ?? data.order_id;
    const url: string | undefined = data.url;
    if (orderId) {
      this.router.navigate(['/order-confirmation'], { queryParams: { orderId } });
      return;
    }
    if (url) {
      this.router.navigateByUrl(url.startsWith('/') ? url : `/${url}`);
      return;
    }
  }

  markAllAsRead() {
    this.notifications.forEach(notification => {
      notification.read = true;
    });
    this.saveNotifications(); // Guardar cambios
    console.log('✅ Todas las notificaciones marcadas como leídas');
  }

  hasUnreadNotifications(): boolean {
    return this.notifications.some(notification => !notification.read);
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'new_order':
        return 'cart';
      case 'order_status':
        return 'notifications';
      case 'order':
        return 'cart';
      case 'promotion':
        return 'gift';
      case 'system':
        return 'notifications';
      case 'test':
        return 'checkmark-circle';
      default:
        return 'alert-circle';
    }
  }

  getNotificationColor(type: string): string {
    switch (type) {
      case 'new_order':
        return 'primary';
      case 'order_status':
        return 'medium';
      case 'order':
        return 'primary';
      case 'promotion':
        return 'success';
      case 'system':
        return 'medium';
      case 'test':
        return 'warning';
      default:
        return 'medium';
    }
  }

  formatTimestamp(timestamp: Date): string {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) {
      return `Hace ${minutes} min`;
    } else if (hours < 24) {
      return `Hace ${hours} h`;
    } else {
      return `Hace ${days} días`;
    }
  }

  async sendTestNotification() {
    try {
      if (this.isSendingTest) return;
      this.isSendingTest = true;
      // Asegurar permisos antes de intentar enviar una prueba
      const hasPerms = await this.notificationService.checkPermissions();
      if (!hasPerms) {
        await this.notificationService.requestPermissionsManually();
      }

      await this.notificationService.sendTestNotification();
      console.log('✅ Notificación de prueba enviada');
    } catch (error) {
      console.error('❌ Error enviando notificación de prueba:', error);
    } finally {
      this.isSendingTest = false;
    }
  }

  deleteNotification(notification: NotificationItem) {
    const index = this.notifications.findIndex(n => n.id === notification.id);
    if (index > -1) {
      this.notifications.splice(index, 1);
      this.saveNotifications(); // Guardar cambios
      this.addToDeletedList(notification.id); // Marcar como eliminada permanentemente
      this.showToastMessage('Notificación eliminada');
      console.log('✅ Notificación eliminada:', notification.id);
    }
  }

  confirmDeleteAll() {
    this.deleteAlertMessage = '¿Estás seguro de que quieres eliminar todas las notificaciones? Esta acción no se puede deshacer.';
    this.deleteAlertButtons = [
      {
        text: 'Cancelar',
        role: 'cancel'
      },
      {
        text: 'Eliminar todas',
        role: 'destructive',
        handler: () => {
          this.deleteAllNotifications();
        }
      }
    ];
    this.showDeleteAlert = true;
  }

  deleteAllNotifications() {
    // Marcar todas las notificaciones como eliminadas
    this.notifications.forEach(notification => {
      this.addToDeletedList(notification.id);
    });

    this.notifications = [];
    this.saveNotifications(); // Guardar cambios
    this.showToastMessage('Todas las notificaciones han sido eliminadas');
    console.log('✅ Todas las notificaciones eliminadas');
  }

  private showToastMessage(message: string) {
    this.toastMessage = message;
    this.showToast = true;
  }

  // Métodos de persistencia
  private getSavedNotifications(): NotificationItem[] {
    try {
      const key = this.getNotificationsKey();
      let saved = localStorage.getItem(key);
      // Migración desde clave antigua si aplica
      if (!saved) {
        const legacy = localStorage.getItem('user_notifications');
        if (legacy) {
          try {
            localStorage.setItem(key, legacy);
            localStorage.removeItem('user_notifications');
            saved = legacy;
            console.log('🔁 Migradas notificaciones desde clave legacy a per-user');
          } catch {}
        }
      }
      if (saved) {
        const notifications = JSON.parse(saved);
        // Convertir timestamps de string a Date
        return notifications.map((n: any) => ({
          ...n,
          timestamp: new Date(n.timestamp)
        }));
      }
    } catch (error) {
      console.error('❌ Error cargando notificaciones guardadas:', error);
    }
    return [];
  }

  private saveNotifications(): void {
    try {
      const key = this.getNotificationsKey();
      localStorage.setItem(key, JSON.stringify(this.notifications));
      console.log('✅ Notificaciones guardadas en localStorage');
      // Notificar a otros componentes (Tabs) que hubo cambios
      try {
        window.dispatchEvent(new CustomEvent('notifications:updated'));
      } catch {}
    } catch (error) {
      console.error('❌ Error guardando notificaciones:', error);
    }
  }

  private getDeletedNotifications(): string[] {
    try {
      const deleted = localStorage.getItem(this.getDeletedKey());
      return deleted ? JSON.parse(deleted) : [];
    } catch (error) {
      console.error('❌ Error cargando notificaciones eliminadas:', error);
      return [];
    }
  }

  private addToDeletedList(notificationId: string): void {
    try {
      const deleted = this.getDeletedNotifications();
      if (!deleted.includes(notificationId)) {
        deleted.push(notificationId);
        localStorage.setItem(this.getDeletedKey(), JSON.stringify(deleted));
        console.log('✅ Notificación marcada como eliminada:', notificationId);
      }
    } catch (error) {
      console.error('❌ Error marcando notificación como eliminada:', error);
    }
  }

  private filterDeletedNotifications(): void {
    const deletedIds = this.getDeletedNotifications();
    this.notifications = this.notifications.filter(notification =>
      !deletedIds.includes(notification.id)
    );
    console.log('✅ Notificaciones filtradas, eliminadas:', deletedIds.length);
  }

  // Método público para agregar notificaciones reales
  public addRealNotification(notification: Omit<NotificationItem, 'id' | 'timestamp'>): void {
    const newNotification: NotificationItem = {
      ...notification,
      id: this.generateNotificationId(),
      timestamp: new Date()
    };

    this.notifications.unshift(newNotification); // Agregar al inicio
    this.saveNotifications();
    console.log('✅ Nueva notificación real agregada:', newNotification.id);
  }

  private generateNotificationId(): string {
    return 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Helpers de clave por usuario
  private getNotificationsKey(): string {
    const id = this.currentUserId ?? 'guest';
    return `${this.NOTIF_PREFIX}${id}`;
    }
  private getDeletedKey(): string {
    const id = this.currentUserId ?? 'guest';
    return `${this.DELETED_PREFIX}${id}`;
  }
}
