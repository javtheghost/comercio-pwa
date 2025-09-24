import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TabsPage } from '../../tabs/tabs.page';
import { OrderService, Order } from '../../services/order.service';

@Component({
  selector: 'app-order-confirmation',
  templateUrl: './order-confirmation.page.html',
  styleUrls: ['./order-confirmation.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, TabsPage]
})
export class OrderConfirmationPage implements OnInit {
  orderId: string | null = null;
  order: Order | null = null;
  loading = false;
  error: string | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private orderService: OrderService
  ) {}

  ngOnInit() {
    this.orderId = this.route.snapshot.queryParams['orderId'] || null;
    if (this.orderId) {
      const idNum = Number(this.orderId);
      if (!Number.isNaN(idNum)) {
        this.fetchOrder(idNum);
      }
    }
  }

  private fetchOrder(id: number): void {
    this.loading = true;
    this.error = null;
    this.orderService.getOrder(id).subscribe({
      next: (resp) => {
        // Backend suele devolver { success, data }
        this.order = resp?.data ? resp.data as Order : (resp as Order);
        this.loading = false;
      },
      error: (err) => {
        console.error('Error cargando orden:', err);
        this.error = 'No se pudo cargar la orden.';
        this.loading = false;
      }
    });
  }

  goToHome(): void {
    this.router.navigate(['/tabs/home']);
  }

  goToOrders(): void {
    this.router.navigate(['/tabs/orders']);
  }
}




