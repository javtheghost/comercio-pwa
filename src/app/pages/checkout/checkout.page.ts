import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { CartService, Cart, CartItem } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { User } from '../../interfaces/auth.interfaces';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.page.html',
  styleUrls: ['./checkout.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class CheckoutPage implements OnInit, OnDestroy {
  cart: Cart | null = null;
  user: User | null = null;
  loading = false;
  error: string | null = null;

  // Datos del formulario
  shippingAddress = {
    firstName: '',
    lastName: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'México',
    phone: ''
  };

  paymentMethod = 'card';
  cardDetails = {
    number: '',
    expiry: '',
    cvv: '',
    name: ''
  };

  private cartSubscription: Subscription = new Subscription();
  private authSubscription: Subscription = new Subscription();

  constructor(
    private cartService: CartService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    console.log('🛒 [CHECKOUT] Inicializando página de checkout...');

    // Verificar autenticación
    if (!this.authService.isAuthenticated()) {
      console.log('❌ [CHECKOUT] Usuario no autenticado, redirigiendo al login...');
      this.router.navigate(['/login'], {
        queryParams: { returnUrl: '/checkout' }
      });
      return;
    }

    // Cargar datos del carrito
    this.loadCartData();

    // Cargar datos del usuario
    this.loadUserData();
  }

  ngOnDestroy() {
    this.cartSubscription.unsubscribe();
    this.authSubscription.unsubscribe();
  }

  private loadCartData(): void {
    console.log('🛒 [CHECKOUT] Cargando datos del carrito...');

    this.cartSubscription = this.cartService.cart$.subscribe({
      next: (cart) => {
        console.log('🛒 [CHECKOUT] Carrito recibido:', cart);
        this.cart = cart;

        if (!cart || this.isCartEmpty()) {
          console.log('❌ [CHECKOUT] Carrito vacío, redirigiendo al carrito...');
          this.router.navigate(['/tabs/cart']);
          return;
        }
      },
      error: (error) => {
        console.error('❌ [CHECKOUT] Error cargando carrito:', error);
        this.error = 'Error cargando el carrito';
      }
    });
  }

  private loadUserData(): void {
    console.log('👤 [CHECKOUT] Cargando datos del usuario...');

    this.authSubscription = this.authService.authState$.subscribe({
      next: (authState) => {
        if (authState.isAuthenticated && authState.user) {
          console.log('👤 [CHECKOUT] Usuario cargado:', authState.user);
          this.user = authState.user;

          // Pre-llenar datos del usuario
          this.shippingAddress.firstName = authState.user.first_name || '';
          this.shippingAddress.lastName = authState.user.last_name || '';
        }
      },
      error: (error) => {
        console.error('❌ [CHECKOUT] Error cargando usuario:', error);
        this.error = 'Error cargando datos del usuario';
      }
    });
  }

  isCartEmpty(): boolean {
    return !this.cart || !this.cart.items || this.cart.items.length === 0;
  }

  getTotalItems(): number {
    if (!this.cart || !this.cart.items) return 0;
    return this.cart.items.reduce((total, item) => total + item.quantity, 0);
  }

  getSubtotal(): number {
    return this.cart ? parseFloat(this.cart.subtotal) : 0;
  }

  getTax(): number {
    return this.cart ? parseFloat(this.cart.tax_amount) : 0;
  }

  getShipping(): number {
    return this.cart ? parseFloat(this.cart.shipping_amount) : 0;
  }

  getTotal(): number {
    return this.cart ? parseFloat(this.cart.total) : 0;
  }

  isFormValid(): boolean {
    return !!(
      this.shippingAddress.firstName &&
      this.shippingAddress.lastName &&
      this.shippingAddress.address &&
      this.shippingAddress.city &&
      this.shippingAddress.state &&
      this.shippingAddress.zipCode &&
      this.shippingAddress.phone
    );
  }

  async processOrder(): Promise<void> {
    if (!this.isFormValid()) {
      this.error = 'Por favor completa todos los campos requeridos';
      return;
    }

    if (this.isCartEmpty()) {
      this.error = 'El carrito está vacío';
      return;
    }

    this.loading = true;
    this.error = null;

    try {
      console.log('💳 [CHECKOUT] Procesando orden...');

      // TODO: Implementar lógica de procesamiento de orden
      // Por ahora, simular procesamiento exitoso
      await this.simulateOrderProcessing();

      console.log('✅ [CHECKOUT] Orden procesada exitosamente');

      // Redirigir a página de confirmación
      this.router.navigate(['/order-confirmation'], {
        queryParams: { orderId: '12345' } // TODO: Usar ID real de la orden
      });

    } catch (error) {
      console.error('❌ [CHECKOUT] Error procesando orden:', error);
      this.error = 'Error procesando la orden. Por favor intenta nuevamente.';
    } finally {
      this.loading = false;
    }
  }

  private async simulateOrderProcessing(): Promise<void> {
    // Simular tiempo de procesamiento
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 2000);
    });
  }

  goBack(): void {
    this.router.navigate(['/tabs/cart']);
  }
}
