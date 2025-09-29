import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { Subscription, firstValueFrom, timeout } from 'rxjs';
import { OrderService, Order } from '../../services/order.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [IonicModule, CommonModule],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Orden #{{ order?.order_number || orderId }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ng-container *ngIf="loading">
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
          <p>Cargando orden...</p>
        </div>
      </ng-container>

      <ng-container *ngIf="!loading && order">
        <ion-list>
          <ion-item>
            <ion-label>
              <h2>Estado</h2>
              <p>{{ orderService.getOrderStatusText(order.status) }} • {{ orderService.getPaymentStatusText(order.payment_status) }}</p>
            </ion-label>
          </ion-item>
          <ion-item>
            <ion-label>
              <h2>Total</h2>
              <p>{{ order.total_amount | currency:'MXN':'symbol' }}</p>
            </ion-label>
          </ion-item>
        </ion-list>

        <ion-list>
          <ion-item *ngFor="let item of order.items">
            <ion-label>
              <h3>{{ item.product?.name || 'Producto' }}</h3>
              <p>Cantidad: {{ item.quantity }} • {{ item.total_price | currency:'MXN':'symbol' }}</p>
            </ion-label>
          </ion-item>
        </ion-list>
      </ng-container>

      <ng-container *ngIf="!loading && !order">
        <div class="loading-container">
          <ion-icon name="alert-circle-outline" color="medium"></ion-icon>
          <p>No se encontró la orden.</p>
        </div>
      </ng-container>
    </ion-content>
  `,
  styles: [`
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
  `]
})
export class OrderDetailPage implements OnInit, OnDestroy {
  orderId!: number;
  order: Order | null = null;
  loading = false;
  private routeSub?: Subscription;

  constructor(
    public orderService: OrderService,
    private route: ActivatedRoute,
    private router: Router,
    private toastController: ToastController,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe(params => {
      const idParam = params.get('id');
      const idNum = Number(idParam);
      if (!Number.isFinite(idNum)) {
        this.router.navigate(['/tabs/orders']);
        return;
      }
      this.orderId = idNum;
      this.loadOrder();
      // Marcar como leídas notificaciones relacionadas a esta orden
      this.notificationService.markNotificationsReadByOrderId(this.orderId);
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  private async loadOrder(): Promise<void> {
    this.loading = true;
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
      this.loading = false;
    }
  }
}
