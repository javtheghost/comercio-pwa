import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController, LoadingController, AlertController } from '@ionic/angular';
import { OrderService, Order, OrderFilters } from '../../services/order.service';
import { AuthService } from '../../services/auth.service';
import { User } from '../../interfaces/auth.interfaces';
import { Subscription, firstValueFrom, timeout, catchError, of } from 'rxjs';

@Component({
  selector: 'app-orders',
  templateUrl: './orders.page.html',
  styleUrls: ['./orders.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class OrdersPage implements OnInit, OnDestroy {
  orders: Order[] = [];
  user: User | null = null;
  loading = false;
  error: string | null = null;
  currentPage = 1;
  totalPages = 1;
  totalOrders = 0;

  // Filtros
  filters: OrderFilters = {
    per_page: 10,
    sort_by: 'created_at',
    sort_order: 'desc'
  };

  // Estados de filtro
  selectedStatus = 'all';
  selectedPaymentStatus = 'all';

  private authSubscription: Subscription = new Subscription();
  // Cuando llega un query param de estado antes de que el usuario esté listo
  private pendingFilterApply = false;
  private loadInFlight = false;
  private loadingSafetyTimer: any = null;
  private ordersSubscription: Subscription = new Subscription();
  private debugSeq = 0;

  constructor(
    private orderService: OrderService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private alertController: AlertController,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    console.log('📦 [ORDERS] Inicializando página de órdenes...');

    // Verificar autenticación
    if (!this.authService.isAuthenticated()) {
      console.log('❌ [ORDERS] Usuario no autenticado, redirigiendo al login...');
      this.router.navigate(['/tabs/login'], {
        queryParams: { returnUrl: '/orders' }
      });
      return;
    }

    // Cargar datos del usuario
    this.loadUserData();

    // Suscribirse a cambios en los parámetros de la ruta
    this.route.queryParams.subscribe(params => {
      if (params['status']) {
        this.selectedStatus = params['status'];
        if (this.user) {
          this.applyFilters();
        } else {
          // Aplazar hasta que tengamos usuario
            this.pendingFilterApply = true;
        }
      }
    });

    // Suscribirse al stream de órdenes para reflejar cambios aunque la carga principal falle
    this.ordersSubscription = this.orderService.orders$.subscribe(list => {
      if (Array.isArray(list) && list.length && !this.orders.length) {
        console.log('📥 [ORDERS] Stream service -> adoptando', list.length, 'órdenes');
        this.orders = list;
        this.loading = false;
        this.totalOrders = list.length;
        this.totalPages = 1;
        this.currentPage = 1;
        this.cdr.markForCheck();
      }
    });
  }

  ngOnDestroy() {
    this.authSubscription.unsubscribe();
    this.ordersSubscription.unsubscribe();
  }

  private loadUserData(): void {
    console.log('👤 [ORDERS] Cargando datos del usuario...');

    this.authSubscription = this.authService.authState$.subscribe({
      next: (authState) => {
        if (authState.isAuthenticated && authState.user) {
          console.log('👤 [ORDERS] Usuario cargado:', authState.user);
          this.user = authState.user;
          if (this.pendingFilterApply) {
            console.log('⏩ [ORDERS] Aplicando filtros pendientes tras cargar usuario');
            this.pendingFilterApply = false;
            this.applyFilters();
          } else {
            this.loadOrders();
          }
        }
      },
      error: (error) => {
        console.error('❌ [ORDERS] Error cargando usuario:', error);
        this.error = 'Error cargando datos del usuario';
      }
    });
  }

  async loadOrders(): Promise<void> {
    if (!this.user) {
      // Asegurar que no dejamos loading colgado si se llamó antes de tiempo
      this.loading = false;
      return;
    }
    // Evitar llamadas simultáneas que pueden pisar estados
    if (this.loadInFlight) {
      console.log('⏳ [ORDERS] Carga ya en curso, se ignora nueva llamada.');
      return;
    }

    this.loading = true;
    this.error = null;
    this.loadInFlight = true;

    // Safety timeout para nunca dejar spinner infinito si algo se queda colgado
    clearTimeout(this.loadingSafetyTimer);
    this.loadingSafetyTimer = setTimeout(() => {
      if (this.loading) {
        console.warn('⏱️ [ORDERS] Timeout de seguridad forzó cierre de loading.');
        this.loading = false;
      }
    }, 12000);

    try {

      const queryDesc = JSON.stringify({ ...this.filters, page: this.currentPage });
      console.log(`🚀 [ORDERS] (req ${++this.debugSeq}) Fetch inicial getUserOrders ->`, queryDesc);
      let response: any = await firstValueFrom(
        this.orderService.getUserOrders(this.user.id, { ...this.filters, page: this.currentPage })
          .pipe(timeout({ first: 10000 }))
      ).catch(err => {
        console.warn('⚠️ [ORDERS] Timeout / error en primera llamada, intentando fallback getOrders()', err);
        return null as any;
      });

      if (!response) {
        // Fallback directo usando getOrders general si existe customer_id implícito
        try {
          const fallback: any = await firstValueFrom(
            this.orderService.getOrders({
              customer_id: this.user.id,
              sort_by: this.filters.sort_by,
              sort_order: this.filters.sort_order,
              per_page: this.filters.per_page,
              page: this.currentPage
            } as any).pipe(catchError(() => of(null)))
          );
          if (fallback && (fallback as any).success) {
            console.log('🛟 [ORDERS] Fallback getOrders() exitoso');
            response = fallback; // reutilizar flujo normal
          }
        } catch (fallbackErr) {
          console.error('❌ [ORDERS] Fallback getOrders() también falló', fallbackErr);
        }
      }

      // Normalizar múltiples posibles estructuras
      // Posibles shapes:
      // A) { success, data: { orders: { data: [], current_page, last_page, total } } }
      // B) { success, data: { data: [], current_page, last_page, total } }
      // C) { success, data: { orders: { data: [...] } } } sin meta
      // D) { success, data: { orders: [...] } }
      // E) { success, data: [...] }
      // F) { success, data: { customer: {...}, orders: {...} } }

      if (!response || response.success === false) {
        throw new Error(response?.message || 'Error cargando órdenes');
      }

      const raw = response.data;
      let ordersData: any = null;

      if (raw?.orders?.data) {
        ordersData = raw.orders; // caso A o F (orders con meta)
      } else if (Array.isArray(raw?.orders)) {
        ordersData = { data: raw.orders, current_page: 1, last_page: 1, total: raw.orders.length };
      } else if (Array.isArray(raw?.data)) {
        ordersData = { data: raw.data, current_page: raw.current_page || 1, last_page: raw.last_page || 1, total: raw.total || raw.data.length };
      } else if (raw?.data?.data && Array.isArray(raw.data.data)) {
        // nested data.data pattern
        ordersData = raw.data; // treat as meta container
      } else if (Array.isArray(raw)) {
        ordersData = { data: raw, current_page: 1, last_page: 1, total: raw.length };
      }

      if (!ordersData) {
        console.warn('⚠️ [ORDERS] No se identificó estructura estándar de órdenes. Raw:', raw);
        ordersData = { data: [], current_page: 1, last_page: 1, total: 0 };
      }

      this.orders = Array.isArray(ordersData.data) ? ordersData.data : [];
      this.currentPage = ordersData.current_page || 1;
      this.totalPages = ordersData.last_page || 1;
      this.totalOrders = ordersData.total || this.orders.length;

      console.log('✅ [ORDERS] Normalizado -> items:', this.orders.length, 'page:', this.currentPage, '/', this.totalPages);

      // Si después de normalizar seguimos con cero y no hay error explícito, clarificar en logs
      if (!this.orders.length) {
        console.log('ℹ️ [ORDERS] Lista vacía tras carga. Esto puede ser correcto (sin órdenes) o un problema de backend.');
      }

      // Actualizar lista local en el servicio
      this.orderService.updateOrdersList(this.orders);

    } catch (error: any) {
      console.error('❌ [ORDERS] Error cargando órdenes:', error);

      let errorMessage = 'Error cargando las órdenes. Por favor intenta nuevamente.';

      if (error.error && error.error.message) {
        errorMessage = error.error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      this.error = errorMessage;

      // Mostrar error en toast
      const toast = await this.toastController.create({
        message: errorMessage,
        duration: 5000,
        color: 'danger',
        position: 'top'
      });
      await toast.present();

    } finally {
      this.loading = false;
      this.loadInFlight = false;
      clearTimeout(this.loadingSafetyTimer);
      this.cdr.markForCheck();
    }
  }

  applyFilters(): void {
    console.log('🔍 [ORDERS] Aplicando filtros...');

    if (!this.user) {
      console.log('⏳ [ORDERS] Usuario aún no disponible; filtros se aplicarán luego');
      this.pendingFilterApply = true;
      return;
    }

    // Limpiar filtros
    this.filters = {
      per_page: 10,
      sort_by: 'created_at',
      sort_order: 'desc'
    };

    // Aplicar filtro de estado
    if (this.selectedStatus !== 'all') {
      this.filters.status = this.selectedStatus;
    }

    // Aplicar filtro de estado de pago
    if (this.selectedPaymentStatus !== 'all') {
      this.filters.payment_status = this.selectedPaymentStatus;
    }

    // Resetear página
    this.currentPage = 1;

    // Cargar órdenes con nuevos filtros
    this.loadOrders();
  }

  async refreshOrders(event?: any): Promise<void> {
    console.log('🔄 [ORDERS] Refrescando órdenes...');
    await this.loadOrders();

    if (event) {
      event.target.complete();
    }
  }

  async loadMoreOrders(event: any): Promise<void> {
    if (this.currentPage >= this.totalPages) {
      event.target.complete();
      return;
    }

    this.currentPage++;

    try {
      const response = await firstValueFrom(this.orderService.getUserOrders(this.user!.id, {
        ...this.filters,
        page: this.currentPage
      }));

      if (response && response.success) {
        const newOrders = response.data.data || [];
        this.orders = [...this.orders, ...newOrders];
        this.orderService.updateOrdersList(this.orders);
      }
    } catch (error) {
      console.error('❌ [ORDERS] Error cargando más órdenes:', error);
      this.currentPage--; // Revertir incremento en caso de error
    }

    event.target.complete();
  }

  viewOrder(order: Order): void {
    console.log('👁️ [ORDERS] Viendo orden:', order.id);
    // Pasar la orden actual en el estado de navegación para mostrar detalle inmediato
    this.router.navigate(['/tabs/orders', order.id], { state: { order } });
  }

  async cancelOrder(order: Order): Promise<void> {
    if (order.status !== 'pending') {
      const toast = await this.toastController.create({
        message: 'Solo se pueden cancelar órdenes pendientes',
        duration: 3000,
        color: 'warning',
        position: 'top'
      });
      await toast.present();
      return;
    }

    const alert = await this.alertController.create({
      header: 'Cancelar Orden',
      message: `¿Estás seguro de que quieres cancelar la orden #${order.order_number}?`,
      buttons: [
        {
          text: 'No',
          role: 'cancel'
        },
        {
          text: 'Sí, Cancelar',
          handler: async () => {
            await this.performCancelOrder(order);
          }
        }
      ]
    });

    await alert.present();
  }

  private async performCancelOrder(order: Order): Promise<void> {
    const loading = await this.loadingController.create({
      message: 'Cancelando orden...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const response = await firstValueFrom(this.orderService.cancelOrder(order.id));

      if (response && response.success) {
        // Actualizar orden en la lista local
        const updatedOrder = { ...order, status: 'cancelled' as const };
        this.orderService.updateOrderInList(updatedOrder);

        // Actualizar lista local
        const index = this.orders.findIndex(o => o.id === order.id);
        if (index !== -1) {
          this.orders[index] = updatedOrder;
        }

        const toast = await this.toastController.create({
          message: 'Orden cancelada exitosamente',
          duration: 3000,
          color: 'success',
          position: 'top'
        });
        await toast.present();

      } else {
        throw new Error(response?.message || 'Error cancelando la orden');
      }

    } catch (error: any) {
      console.error('❌ [ORDERS] Error cancelando orden:', error);

      const toast = await this.toastController.create({
        message: 'Error cancelando la orden',
        duration: 3000,
        color: 'danger',
        position: 'top'
      });
      await toast.present();
    } finally {
      await loading.dismiss();
    }
  }

  getOrderStatusText(status: string): string {
    return this.orderService.getOrderStatusText(status);
  }

  getPaymentStatusText(status: string): string {
    return this.orderService.getPaymentStatusText(status);
  }

  getOrderStatusColor(status: string): string {
    const colorMap: { [key: string]: string } = {
      'pending': 'warning',
      'processing': 'primary',
      'shipped': 'secondary',
      'delivered': 'success',
      'cancelled': 'danger'
    };
    return colorMap[status] || 'medium';
  }

  getPaymentStatusColor(status: string): string {
    const colorMap: { [key: string]: string } = {
      'pending': 'warning',
      'paid': 'success',
      'failed': 'danger',
      'refunded': 'medium'
    };
    return colorMap[status] || 'medium';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatCurrency(amount: number | undefined | null): string {
    if (amount === undefined || amount === null || isNaN(amount)) {
      return '$0.00';
    }
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  }

  canCancelOrder(order: Order): boolean {
    return order.status === 'pending';
  }

  hasMoreOrders(): boolean {
    return this.currentPage < this.totalPages;
  }

  getTotalItems(): number {
    return this.orders.reduce((total, order) => {
      return total + order.items.reduce((itemTotal, item) => itemTotal + item.quantity, 0);
    }, 0);
  }

  getTotalValue(): number {
    return this.orders.reduce((total, order) => total + (order.total_amount || 0), 0);
  }

  navigateToHome(): void {
    this.router.navigate(['/tabs/home']);
  }

  /**
   * Maneja el pull-to-refresh nativo
   */
  async doRefresh(event: any): Promise<void> {
    console.log('🔄 [ORDERS] Pull-to-refresh activado');

    try {
      // Recargar datos del usuario y órdenes
      await Promise.all([
        this.loadUserData(),
        this.loadOrders()
      ]);

      console.log('✅ [ORDERS] Pull-to-refresh completado');
    } catch (error) {
      console.error('❌ [ORDERS] Error en pull-to-refresh:', error);
    } finally {
      // Completar el refresh
      event.target.complete();
    }
  }
}
