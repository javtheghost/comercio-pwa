import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IonicModule, ToastController, NavController } from '@ionic/angular';
import { Subscription, firstValueFrom, timeout } from 'rxjs';
import { OrderService, Order } from '../../services/order.service';
import { NotificationService } from '../../services/notification.service';
import { firstValueFrom as rxFirst } from 'rxjs';
import { ImageUrlPipe } from '../../pipes/image-url.pipe';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [IonicModule, CommonModule, ImageUrlPipe],
  templateUrl: './order-detail.page.html',
  // Nota: styleUrls estándar; si el builder mostró error transitorio 'no se encontró', se debe a caché.
  styleUrls: ['./order-detail.page.scss']
})
export class OrderDetailPage implements OnInit, OnDestroy {
  orderId!: number;
  order: Order | null = null;
  loading = false;
  private routeSub?: Subscription;
  private returnUrl: string = '/tabs/orders'; // URL por defecto

  constructor(
    public orderService: OrderService,
    private route: ActivatedRoute,
    private router: Router,
    private navCtrl: NavController,
    private toastController: ToastController,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    // Detectar de dónde viene el usuario
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras?.state;
    if (state && state['returnUrl']) {
      this.returnUrl = state['returnUrl'];
    }

    this.routeSub = this.route.paramMap.subscribe(params => {
      const idParam = params.get('id');
      const idNum = Number(idParam);
      if (!Number.isFinite(idNum)) {
        this.router.navigate(['/tabs/orders']);
        return;
      }
      this.orderId = idNum;
      // 1) Intentar obtener la orden desde el estado de navegación
      const nav = this.router.getCurrentNavigation();
      const passedOrder: any = nav?.extras?.state?.['order'];
      if (passedOrder && passedOrder.id === this.orderId) {
        this.order = passedOrder;
      } else {
        // 2) Intentar desde el BehaviorSubject (lista ya cargada)
        try {
          const cached = (this.orderService as any).ordersSubject?.value || [];
          if (Array.isArray(cached)) {
            const match = cached.find((o: any) => o?.id === this.orderId);
            if (match) this.order = match;
          }
        } catch {}
      }
      // 3) Hacer fetch (si ya tenemos la orden, será un refresh silencioso)
      this.loadOrder(!this.order); // si ya hay order, no mostrar loading visible
      // Marcar como leídas notificaciones relacionadas a esta orden
      this.notificationService.markNotificationsReadByOrderId(this.orderId);
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  private async loadOrder(showLoader: boolean = true): Promise<void> {
    if (showLoader) this.loading = true;
    try {
      const resp = await firstValueFrom(
        this.orderService.getOrder(this.orderId).pipe(timeout({ first: 12000 }))
      );
      try { console.debug('[ORDER-DETAIL] Respuesta getOrder:', resp); } catch {}
      let found: any = null;
      if (resp) {
        if (resp.success) {
          const d = resp.data;
          // Formatos posibles: {data: {order}}, {data: {data}}, {data: order}
          if (d?.order) {
            found = d.order;
          } else if (d?.data) {
            found = d.data;
          } else if (d?.id) {
            found = d;
          }
        } else if (resp.data && resp.data.order) {
          found = resp.data.order;
        } else if (resp.id) {
          found = resp;
        }
      }
      if (!found || !found.id) {
        throw new Error('Orden no encontrada');
      }
      this.order = found as Order;
    } catch (e: any) {
      try { console.warn('[ORDER-DETAIL] Error cargando orden:', e); } catch {}
      const toast = await this.toastController.create({
        message: e?.message || 'Error cargando la orden',
        duration: 3000,
        color: 'danger',
        position: 'top'
      });
      await toast.present();
      // Mantener en la pantalla y mostrar estado vacío; no forzar navegación
    } finally {
      if (showLoader) this.loading = false; else this.loading = false; // aseguramos apagado
    }
  }

  async onCancelOrder(): Promise<void> {
    if (!this.order || this.order.status !== 'pending') return;
    // Evitar doble click
    const prevStatus = this.order.status;
    this.order = { ...this.order, status: 'processing' } as any; // estado temporal
    try {
      const resp = await firstValueFrom(
        this.orderService.cancelOrder(this.orderId).pipe(timeout({ first: 10000 }))
      );
      if (resp?.success) {
        this.order = { ...this.order!, status: 'cancelled' } as any;
        this.orderService.updateOrderInList(this.order as any);
        const toast = await this.toastController.create({
          message: 'Orden cancelada',
          duration: 2500,
          color: 'success',
          position: 'top'
        });
        await toast.present();
      } else {
        throw new Error(resp?.message || 'Error cancelando');
      }
    } catch (e: any) {
      // Revertir si falló
      if (this.order) (this.order as any).status = prevStatus;
      const toast = await this.toastController.create({
        message: e?.message || 'Error cancelando orden',
        duration: 3000,
        color: 'danger',
        position: 'top'
      });
      await toast.present();
    }
  }

  goToOrders(): void {
    this.navCtrl.navigateBack('/tabs/orders');
  }

  goBack(): void {
    this.navCtrl.navigateBack(this.returnUrl);
  }

  getItemImageUrl(item: any): string {
    // Usar product_image primero (igual que en cart.page.html)
    // Luego intentar otras propiedades como fallback
    return item.product_image || 
           item.image || 
           item.product?.image || 
           this.getPlaceholderImage();
  }

  getPlaceholderImage(): string {
    return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="14"%3ESin imagen%3C/text%3E%3C/svg%3E';
  }

  onImageError(event: any): void {
    event.target.src = this.getPlaceholderImage();
  }
}
