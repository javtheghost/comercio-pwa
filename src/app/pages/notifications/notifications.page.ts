import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule, NgIf, NgFor } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonIcon, IonBadge, IonButton, IonButtons, IonSpinner, IonRefresher, IonRefresherContent, IonItemSliding, IonItemOptions, IonItemOption, IonAlert, IonToast } from '@ionic/angular/standalone';
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
  type: 'order' | 'promotion' | 'system' | 'test' | 'cart_abandoned' | 'order_created' | 'order_confirmed' | 'order_shipped' | 'order_delivered' | 'order_cancelled' | 'cart_reminder' | 'cart_expiring' | 'product_available' | 'product_on_sale' | 'favorite_on_sale' | 'coupon' | 'flash_sale' | 'payment_success' | 'payment_failed' | 'review_request' | 'new_login' | 'birthday' | 'anniversary' | 'price_drop';
  timestamp: Date | string; // Puede ser Date o string ISO
  read: boolean;
  data?: any;
  icon?: string; // ✅ Icono de la notificación (URL o path)
  url?: string; // ✅ URL de destino al hacer click
}

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonIcon,
    IonBadge,
    IonButton,
    IonButtons,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
    IonAlert,
    IonToast
  ],
  templateUrl: './notifications.page.html',
  styleUrls: ['./notifications.page.scss']
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
  // ✅ Flag para controlar si se debe actualizar la UI automáticamente
  private shouldAutoUpdate = true;

  constructor(
    private notificationService: NotificationService, 
    private authService: AuthService, 
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
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
    
    // ✅ Listener automático para notificaciones en tiempo real
    // Solo actualiza la UI si hay cambios REALES detectados
    this.globalNotifListener = () => {
      this.ngZone.runOutsideAngular(() => {
        if (this.shouldAutoUpdate) {
          this.checkAndUpdateIfChanged();
        }
      });
    };
    window.addEventListener('notifications:updated', this.globalNotifListener);
    
    console.log('👁️ [NOTIFICATIONS PAGE] Notificaciones automáticas activadas');
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
    // Limpiar referencia global
    (window as any).notificationsPage = null;
    if (this.authSub) this.authSub.unsubscribe();
    if (this.globalNotifListener) {
      window.removeEventListener('notifications:updated', this.globalNotifListener);
    }

    // ✅ Reactivar auto-actualización para otros componentes
    this.shouldAutoUpdate = true;
    console.log('👋 [NOTIFICATIONS PAGE] Página cerrada');
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
    try {
      console.log('🔄 Forzando resincronización desde backend...');
      
      // ✅ Reactivar auto-actualización temporalmente para este refresh manual
      this.shouldAutoUpdate = true;
      
      // ✅ Forzar sincronización desde el backend para actualizar iconos
      await this.notificationService.forceBackendSync();
      
      // Esperar un momento para que se actualice localStorage
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Recargar notificaciones desde localStorage (ahora con iconos actualizados)
      await this.loadNotifications();
      
      console.log('✅ Resincronización completada');
    } catch (error) {
      console.error('❌ Error en resincronización:', error);
    } finally {
      event.target.complete();
    }
  }

  /**
   * ✅ Verificar si hay cambios en las notificaciones antes de actualizar la UI
   * Esto evita renders innecesarios cuando no hay cambios
   */
  private checkAndUpdateIfChanged(): void {
    try {
      // ✅ Obtener datos RAW de localStorage sin modificaciones
      const key = this.getNotificationsKey();
      const rawData = localStorage.getItem(key);
      
      if (!rawData) {
        console.log('⏭️ [NOTIFICATIONS PAGE] No hay datos en localStorage');
        return;
      }

      const savedNotifications = JSON.parse(rawData);
      
      // 🔍 DEBUG: Ver qué estamos comparando
      console.log('🔍 [DEBUG CHANGE DETECTION]', {
        enPantalla: this.notifications.length,
        enLocalStorage: savedNotifications.length,
        idsEnPantalla: this.notifications.map(n => n.id).slice(0, 3),
        idsEnStorage: savedNotifications.map((n: any) => n.id).slice(0, 3)
      });
      
      // ✅ Comparar con las que ya están en pantalla
      if (this.hasNotificationsChanged(savedNotifications)) {
        console.log('🔄 [NOTIFICATIONS PAGE] Cambios detectados, actualizando UI...');
        
        // ✅ Volver a entrar a la zona de Angular para actualizar UI
        this.ngZone.run(() => {
          this.loadNotifications();
        });
      } else {
        console.log('⏭️ [NOTIFICATIONS PAGE] Sin cambios, saltando actualización');
        // ✅ NO detectar cambios si no hay modificaciones
        // Al estar fuera de la zona de Angular, no se triggerea re-render
      }
    } catch (error) {
      console.error('❌ [NOTIFICATIONS PAGE] Error verificando cambios:', error);
    }
  }

  /**
   * ✅ Comparar si las notificaciones han cambiado
   * Compara cantidad y IDs para detectar cambios
   */
  private hasNotificationsChanged(newNotifications: NotificationItem[]): boolean {
    console.log('🔎 [CHANGE DETECTION] Iniciando comparación...');
    
    // Si la cantidad es diferente, definitivamente hay cambios
    if (newNotifications.length !== this.notifications.length) {
      console.log('📊 [CHANGE DETECTION] ❌ Cantidad diferente:', {
        anterior: this.notifications.length,
        nueva: newNotifications.length
      });
      return true;
    }

    // Si no hay notificaciones en pantalla, no hay cambios
    if (this.notifications.length === 0 && newNotifications.length === 0) {
      console.log('📊 [CHANGE DETECTION] ✅ Ambas listas vacías, sin cambios');
      return false;
    }

    // Si la cantidad es igual, comparar IDs
    const currentIds = new Set(this.notifications.map(n => n.id));
    const newIds = new Set(newNotifications.map(n => n.id));

    // Verificar si hay IDs nuevos
    for (const id of newIds) {
      if (!currentIds.has(id)) {
        console.log('🆕 [CHANGE DETECTION] Notificación nueva detectada:', id);
        return true;
      }
    }

    // Verificar si hay IDs eliminados
    for (const id of currentIds) {
      if (!newIds.has(id)) {
        console.log('🗑️ [CHANGE DETECTION] Notificación eliminada detectada:', id);
        return true;
      }
    }

    // Verificar cambios en el estado de lectura (solo backendId)
    for (const newNotif of newNotifications) {
      const currentNotif = this.notifications.find(n => n.id === newNotif.id);
      if (currentNotif && currentNotif.read !== newNotif.read) {
        console.log('👁️ [CHANGE DETECTION] Estado de lectura cambió:', newNotif.id);
        return true;
      }
    }

    // ✅ IMPORTANTE: Comparar usando backendId si está disponible
    const currentBackendIds = new Set(
      this.notifications.map(n => (n as any).backendId).filter(id => id)
    );
    const newBackendIds = new Set(
      newNotifications.map(n => (n as any).backendId).filter(id => id)
    );

    if (currentBackendIds.size !== newBackendIds.size) {
      console.log('📊 [CHANGE DETECTION] Cantidad de backendIds diferente');
      return true;
    }

    // No hay cambios detectados
    console.log('✅ [CHANGE DETECTION] Sin cambios reales detectados');
    return false;
  }

  /**
   * ✅ Detectar cuando el usuario está interactuando con las notificaciones
   * Pausa la auto-actualización de la UI para evitar interrupciones
   */
  onUserInteracting(): void {
    console.log('👆 [NOTIFICATIONS PAGE] Usuario interactuando, pausando auto-actualización UI');
    this.shouldAutoUpdate = false;
    
    // Reactivar después de 3 segundos de inactividad
    setTimeout(() => {
      if (!this.shouldAutoUpdate) {
        console.log('⏱️ [NOTIFICATIONS PAGE] 3s sin interacción, reactivando auto-actualización');
        this.shouldAutoUpdate = true;
      }
    }, 3000);
  }

  async markAsRead(notification: NotificationItem) {
    if (!notification.read) {
      notification.read = true;
      this.saveNotifications(); // Guardar cambios localmente
      console.log('✅ Notificación marcada como leída:', notification.id);
      
      // Si es una notificación del backend, sincronizar
      const backendId = (notification as any).backendId;
      if (backendId) {
        await this.notificationService.markBackendNotificationAsRead(backendId);
      }
    }
  }

  openNotification(notification: NotificationItem) {
    this.markAsRead(notification);
    const data = notification.data || {};
    const orderId = data.orderId ?? data.order_id;
    const url: string | undefined = data.url;
    
    // ✅ Si es notificación de carrito abandonado, guardar cart_id
    if (notification.type === 'cart_abandoned') {
      const cartId = data.cart_id;
      if (cartId) {
        localStorage.setItem('abandoned_cart_id', cartId.toString());
        console.log('🛒 Cart ID guardado para recuperación:', cartId);
      }
      
      // Navegar al carrito (ruta completa con /tabs/)
      this.router.navigate(['/tabs/cart']);
      return;
    }
    
    if (orderId) {
      // Navegar al detalle de la orden dentro de las tabs para mostrar la vista completa de la orden
      try {
        this.router.navigate([`/tabs/orders/${orderId}`]);
      } catch (e) {
        // Fallback: si falla, usar la ruta antigua
        console.warn('⚠️ Navegación a order detail falló, usando fallback:', e);
        this.router.navigate(['/order-confirmation'], { queryParams: { orderId } });
      }
      return;
    }
    if (url) {
      this.router.navigateByUrl(url.startsWith('/') ? url : `/${url}`);
      return;
    }
  }

  async markAllAsRead() {
    try {
      // Marcar localmente
      this.notifications.forEach(notification => {
        notification.read = true;
      });
      this.saveNotifications();
      console.log('✅ Todas las notificaciones marcadas como leídas');
      
      // Sincronizar con backend
      try {
        await this.notificationService.markAllBackendNotificationsAsRead();
      } catch (backendError) {
        console.warn('⚠️ No se pudo sincronizar con backend:', backendError);
      }
    } catch (error) {
      console.error('❌ Error marcando notificaciones:', error);
    }
  }

  hasUnreadNotifications(): boolean {
    return this.notifications.some(notification => !notification.read);
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      // Órdenes
      case 'new_order':
      case 'order_created':
      case 'order_confirmed':
      case 'order':
        return 'cart';
      case 'order_status':
      case 'order_updated':
        return 'sync-circle';
      case 'order_shipped':
        return 'airplane';
      case 'order_delivered':
        return 'checkmark-done-circle';
      case 'order_cancelled':
        return 'close-circle';
      
      // Carrito
      case 'cart_abandoned':
        return 'cart-outline';
      case 'cart_expiring':
        return 'time-outline';
      case 'price_drop':
        return 'trending-down';
      
      // Productos
      case 'product_on_sale':
      case 'favorite_on_sale':
        return 'pricetag';
      case 'product_available':
        return 'notifications-circle';
      case 'low_stock':
        return 'warning';
      
      // Promociones
      case 'promotion':
        return 'gift';
      case 'coupon':
        return 'ticket';
      case 'flash_sale':
        return 'flash';
      
      // Pagos
      case 'payment_success':
        return 'checkmark-circle';
      case 'payment_failed':
        return 'alert-circle';
      
      // Sistema
      case 'system':
        return 'notifications';
      case 'test':
        return 'checkmark-circle';
      
      default:
        console.warn('⚠️ Tipo de notificación desconocido:', type);
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

  formatTimestamp(timestamp: Date | string): string {
    try {
      const now = new Date();
      // ✅ Asegurar que timestamp sea un objeto Date válido
      const timestampDate = timestamp instanceof Date ? timestamp : new Date(timestamp);
      
      // ✅ Validar que la fecha es válida
      if (isNaN(timestampDate.getTime())) {
        console.warn('⚠️ Timestamp inválido:', timestamp);
        return 'Fecha inválida';
      }
      
      const diff = now.getTime() - timestampDate.getTime();
      const minutes = Math.floor(diff / (1000 * 60));
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      if (minutes < 1) {
        return 'Ahora';
      } else if (minutes < 60) {
        return `Hace ${minutes} min`;
      } else if (hours < 24) {
        return `Hace ${hours} h`;
      } else if (days === 1) {
        return 'Ayer';
      } else if (days < 7) {
        return `Hace ${days} días`;
      } else {
        // Para fechas más antiguas, mostrar formato completo
        return timestampDate.toLocaleDateString('es-ES', { 
          day: 'numeric', 
          month: 'short' 
        });
      }
    } catch (error) {
      console.error('❌ Error formateando timestamp:', error, timestamp);
      return 'Fecha inválida';
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

  async deleteNotification(notification: NotificationItem) {
    const index = this.notifications.findIndex(n => n.id === notification.id);
    if (index > -1) {
      this.notifications.splice(index, 1);
      this.saveNotifications(); // Guardar cambios localmente
      this.addToDeletedList(notification.id); // Marcar como eliminada permanentemente
      this.showToastMessage('Notificación eliminada');
      console.log('✅ Notificación eliminada:', notification.id);
      
      // Si es una notificación del backend, eliminarla también allí
      const backendId = (notification as any).backendId;
      if (backendId) {
        await this.notificationService.deleteBackendNotification(backendId);
      }
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

  async deleteAllNotifications() {
    // Marcar todas las notificaciones como eliminadas
    this.notifications.forEach(notification => {
      this.addToDeletedList(notification.id);
    });

    this.notifications = [];
    this.saveNotifications(); // Guardar cambios localmente
    this.showToastMessage('Todas las notificaciones han sido eliminadas');
    console.log('✅ Todas las notificaciones eliminadas');
    
    // Eliminar todas del backend
    await this.notificationService.deleteAllBackendNotifications();
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
        let notifications = JSON.parse(saved);
        
        // ✅ LIMPIAR DUPLICADOS por backendId
        const seen = new Map<number, boolean>();
        const uniqueNotifications: any[] = [];
        
        for (const notif of notifications) {
          const backendId = notif.backendId;
          if (backendId && seen.has(backendId)) {
            console.log('🗑️ [DEBUG] Duplicado encontrado y eliminado:', {
              id: notif.id,
              backendId: backendId,
              title: notif.title
            });
            continue; // Saltar duplicado
          }
          
          if (backendId) {
            seen.set(backendId, true);
          }
          uniqueNotifications.push(notif);
        }
        
        // Si se eliminaron duplicados, guardar la versión limpia
        if (notifications.length !== uniqueNotifications.length) {
          console.log(`🧹 [DEBUG] Limpiados ${notifications.length - uniqueNotifications.length} duplicados`);
          localStorage.setItem(key, JSON.stringify(uniqueNotifications));
          notifications = uniqueNotifications;
        }
        
        console.log('📋 [DEBUG] Notificaciones cargadas de localStorage:', JSON.stringify(notifications.slice(0, 2), null, 2));
        
        // ✅ MANTENER timestamps como strings ISO, NO convertir a Date objects
        return notifications.map((n: any) => {
          let timestamp = n.timestamp;
          
          console.log('🔍 [DEBUG] Procesando timestamp:', {
            id: n.id,
            timestamp: timestamp,
            tipo: typeof timestamp
          });
          
          // Si timestamp es un objeto Date serializado, extraer el valor
          if (timestamp && typeof timestamp === 'object' && timestamp.$date) {
            timestamp = timestamp.$date;
          }
          
          // Si no hay timestamp válido, usar fecha actual como ISO string
          if (!timestamp || timestamp === 'undefined' || timestamp === undefined) {
            console.error('❌ [DEBUG] Timestamp missing:', n.id);
            return { ...n, timestamp: new Date().toISOString() };
          }
          
          // Validar que sea una fecha válida
          const dateObj = new Date(timestamp);
          if (isNaN(dateObj.getTime())) {
            console.error('❌ [DEBUG] Timestamp inválido:', {
              id: n.id,
              timestamp: timestamp,
              tipo: typeof timestamp
            });
            return { ...n, timestamp: new Date().toISOString() };
          }
          
          // ✅ Mantener como string ISO (NO convertir a Date object)
          // Esto evita que JSON.stringify lo serialice incorrectamente después
          const validTimestamp = typeof timestamp === 'string' 
            ? timestamp 
            : dateObj.toISOString();
          
          return { ...n, timestamp: validTimestamp };
        });
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

  // Helper para obtener contador de no leídas
  getUnreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  // TrackBy para mejor rendimiento en la lista
  trackByNotificationId(index: number, notification: NotificationItem): string {
    return notification.id;
  }
}
