import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TabsPage } from '../../tabs/tabs.page';

interface OrderData {
  orderNumber?: string;
  orderId?: string;
  total?: number;
  mode?: string;
}

@Component({
  selector: 'app-order-confirmation',
  templateUrl: './order-confirmation.page.html',
  styleUrls: ['./order-confirmation.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, TabsPage]
})
export class OrderConfirmationPage implements OnInit {
  orderData: OrderData | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    console.log('🎉 [CONFIRMATION] Inicializando página de confirmación...');

    // Obtener datos de la orden desde los query params
    this.route.queryParams.subscribe(params => {
      console.log('🎉 [CONFIRMATION] Parámetros recibidos:', params);

      this.orderData = {
        orderNumber: params['orderNumber'] || params['orderId'],
        orderId: params['orderId'],
        total: params['total'] ? parseFloat(params['total']) : undefined,
        mode: params['mode']
      };

      console.log('🎉 [CONFIRMATION] Datos de la orden:', this.orderData);
    });
  }

  /**
   * Navegar a la página de órdenes del usuario
   */
  goToOrders(): void {
    console.log('🔍 [CONFIRMATION] Navegando a órdenes...');
    try {
      this.router.navigate(['/tabs/account']).then(() => {
        console.log('✅ [CONFIRMATION] Navegación a órdenes exitosa');
      }).catch(error => {
        console.error('❌ [CONFIRMATION] Error navegando a órdenes:', error);
        // Fallback: ir al home
        this.router.navigate(['/tabs/home']);
      });
    } catch (error) {
      console.error('❌ [CONFIRMATION] Error en goToOrders:', error);
    }
  }

  /**
   * Navegar al inicio
   */
  goToHome(): void {
    console.log('🔍 [CONFIRMATION] Navegando al inicio...');
    try {
      this.router.navigate(['/tabs/home']).then(() => {
        console.log('✅ [CONFIRMATION] Navegación al inicio exitosa');
      }).catch(error => {
        console.error('❌ [CONFIRMATION] Error navegando al inicio:', error);
        // Fallback: ir a la raíz
        this.router.navigate(['/']);
      });
    } catch (error) {
      console.error('❌ [CONFIRMATION] Error en goToHome:', error);
    }
  }
}
