import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { NavController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TabsPage } from '../../tabs/tabs.page';
import { OrderService, Order } from '../../services/order.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-order-confirmation',
  templateUrl: './order-confirmation.page.html',
  styleUrls: ['./order-confirmation.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, TabsPage],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderConfirmationPage implements OnInit {
  orderId: string | null = null;
  order: Order | null = null;
  loading = false;
  error: string | null = null;
  // Flag para mostrar pantalla "¿Qué sigue?"
  showNextSteps = false;
  manyItems = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private orderService: OrderService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef,
    private navCtrl: NavController
  ) {}

  ngOnInit() {
  const qp = this.route.snapshot.queryParams;
  this.orderId = qp['orderId'] || null;
  // Determinar si venimos del checkout (modo gracias) u otra fuente
  // Aceptamos mode=thanks o showNext=1 como indicadores
  const mode = (qp['mode'] || '').toString();
  const showNext = qp['showNext'] === '1' || qp['showNext'] === 1 || qp['showNext'] === true;
  this.showNextSteps = mode === 'thanks' || showNext;
    if (this.orderId) {
      const idNum = Number(this.orderId);
      if (!Number.isNaN(idNum)) {
        this.fetchOrder(idNum);
        // Solo marcar como leídas las notificaciones si NO es la primera vez (no modo "gracias")
        if (!this.showNextSteps) {
          try { this.notificationService.markNotificationsReadByOrderId(idNum); } catch {}
        }
      }
    }
  }

  // Helpers para imágenes de productos
  getProductImage(item: any): string {
    const p = item?.product;
    // Priorizar arreglo de imágenes del producto
    const first = Array.isArray(p?.images) && p.images.length > 0 ? p.images[0] : null;
    const fromArray = first && (first.full_image_url || first.image_url);
    const legacy = p?.image || item?.image;
    return fromArray || legacy || '/icons/icon-192x192.png';
  }

  onImgError(ev: Event) {
    const el = ev?.target as HTMLImageElement;
    if (el) {
      el.src = '/icons/icon-192x192.png';
    }
  }

  // Resumen de variante (color/talla u otros atributos)
  getVariantSummary(item: any): string {
    const variant = item?.product_variant;
    const attrs = variant?.attributes;

    if (attrs && typeof attrs === 'object') {
      // Buscar claves comunes primero
      const colorKey = Object.keys(attrs).find(k => /color|colour|color_name/i.test(k));
      const sizeKey = Object.keys(attrs).find(k => /size|talla|talle/i.test(k));
      const parts: string[] = [];
      if (colorKey && attrs[colorKey]) parts.push(`${attrs[colorKey]}`);
      if (sizeKey && attrs[sizeKey]) parts.push(`${attrs[sizeKey]}`);
      if (parts.length) return parts.join(' · ');

      // Si no hay claves comunes, concatenar primeras 2 entradas
      const entries = Object.entries(attrs).filter(([k,v]) => v != null && v !== '');
      if (entries.length) {
        return entries.slice(0,2).map(([k,v]) => `${v}`).join(' · ');
      }
    }

    // Fallback al nombre de la variante si existe
    if (variant?.name) return variant.name;
    // Último recurso: cantidad/unidad para no dejar vacío
    const qty = item?.quantity != null ? `x${item.quantity}` : '';
    return qty || '';
  }

  fetchOrder(id: number): void {
    this.loading = true;
    this.error = null;
    this.orderService.getOrder(id).subscribe({
      next: (resp) => {
        // Aceptar múltiples formas de respuesta
        let found: any = null;
        try {
          if (resp?.success && resp?.data) {
            found = resp.data;
          } else if (resp?.data?.order) {
            found = resp.data.order;
          } else if (resp?.data) {
            found = resp.data;
          } else if (resp?.id) {
            found = resp;
          }
        } catch {}
        this.order = found as Order;
        const count = Array.isArray((this.order as any)?.items) ? (this.order as any).items.length : 0;
        this.manyItems = count > 1;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error cargando orden:', err);
        this.error = 'No se pudo cargar la orden.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  goToHome(): void {
    this.router.navigate(['/tabs/home']);
  }

  goToOrders(): void {
    this.router.navigate(['/tabs/orders']);
  }

  goBackToNotifications(): void {
    try { (document.activeElement as HTMLElement)?.blur?.(); } catch {}
    // Animación nativa de Ionic en sentido back (izquierda -> derecha)
    this.navCtrl.navigateRoot('/tabs/notifications', { animationDirection: 'back' });
  }
}




