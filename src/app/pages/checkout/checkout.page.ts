import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController, LoadingController } from '@ionic/angular';
import { CartService, Cart, CartItem } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { OrderService, CreateOrderRequest, Address } from '../../services/order.service';
import { AddressService } from '../../services/address.service';
import { NotificationService } from '../../services/notification.service';
import { TabsPage } from '../../tabs/tabs.page';
import { User } from '../../interfaces/auth.interfaces';
import { Address as UserAddress } from '../../interfaces/address.interfaces';
import { Subscription, firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.page.html',
  styleUrls: ['./checkout.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, TabsPage]
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

  // Direcciones del usuario
  userAddresses: UserAddress[] = [];
  selectedAddressId: number | null = null;
  useExistingAddress = false;
  addressesLoading = false;

  private cartSubscription: Subscription = new Subscription();
  private authSubscription: Subscription = new Subscription();

  constructor(
    private cartService: CartService,
    private authService: AuthService,
    private orderService: OrderService,
    private addressService: AddressService,
    private notificationService: NotificationService,
    private router: Router,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    console.log('🛒 [CHECKOUT] Inicializando página de checkout...');

    // Verificar autenticación
    if (!this.authService.isAuthenticated()) {
      console.log('❌ [CHECKOUT] Usuario no autenticado, redirigiendo al login...');
      this.router.navigate(['/tabs/login'], {
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

          // Cargar direcciones del usuario
          this.loadUserAddresses();
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

  // Calcula el porcentaje de IVA basado en los montos actuales
  getVatRatePercent(): number {
    const subtotal = this.getSubtotal();
    const tax = this.getTax();
    if (subtotal > 0) {
      return Math.round((tax / subtotal) * 100);
    }
    // Fallback a 16 si no hay datos suficientes
    return 16;
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

  onPaymentMethodChange(): void {
    this.paymentMethod = 'cash'; // ✅ seleccionado por defecto

  }

  // Método de debug temporal
  debugPaymentMethod(): void {
    console.log('🐛 [DEBUG] Estado actual del método de pago:');
    console.log('- paymentMethod:', this.paymentMethod);
    console.log('- Tipo:', typeof this.paymentMethod);
    console.log('- Es igual a "cash":', this.paymentMethod === 'cash');
    console.log('- Es igual a "card":', this.paymentMethod === 'card');
  }

  async processOrder(): Promise<void> {
    console.log('💳 [CHECKOUT] Método de pago seleccionado:', this.paymentMethod);

    if (!this.isFormValid()) {
      this.error = 'Por favor completa todos los campos requeridos';
      return;
    }

    if (this.isCartEmpty()) {
      this.error = 'El carrito está vacío';
      return;
    }

    if (!this.user) {
      this.error = 'Usuario no autenticado';
      return;
    }

    // Validar método de pago
    if (!this.paymentMethod) {
      this.error = 'Por favor selecciona un método de pago';
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Procesando orden...',
      spinner: 'crescent'
    });
    await loading.present();

    this.error = null;

    try {
      console.log('💳 [CHECKOUT] Procesando orden...');

      // Preparar datos de la orden
      const orderData: CreateOrderRequest = {
        customer_id: this.user.id,
        items: this.cart!.items.map(item => ({
          product_id: item.product_id,
          product_variant_id: item.product_variant_id,
          quantity: item.quantity
        })),
        shipping_address: {
          street: this.shippingAddress.address,
          city: this.shippingAddress.city,
          state: this.shippingAddress.state,
          postal_code: this.shippingAddress.zipCode,
          country: this.shippingAddress.country,
          phone: this.shippingAddress.phone
        },
        billing_address: {
          street: this.shippingAddress.address,
          city: this.shippingAddress.city,
          state: this.shippingAddress.state,
          postal_code: this.shippingAddress.zipCode,
          country: this.shippingAddress.country,
          phone: this.shippingAddress.phone
        },
        notes: `Orden creada desde PWA - ${new Date().toLocaleString()}`,
        payment_method: this.paymentMethod
      };

      // Validar datos antes de enviar
      const validation = this.orderService.validateOrderData(orderData);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      // Crear la orden
      const response = await firstValueFrom(this.orderService.createOrder(orderData));

      if (response && response.success) {
        console.log('✅ [CHECKOUT] Orden creada exitosamente:', response.data);

        // Limpiar el carrito
        await firstValueFrom(this.cartService.clearCart());

        // Enviar notificación de nueva orden
        try {
          await this.notificationService.sendOrderNotification({
            orderId: response.data.id,
            orderNumber: response.data.order_number,
            total: response.data.total_amount,
            customerName: this.user?.first_name || 'Cliente'
          });
          console.log('✅ [CHECKOUT] Notificación de orden enviada');
        } catch (notificationError) {
          console.warn('⚠️ [CHECKOUT] Error enviando notificación de orden:', notificationError);
        }

        // Mostrar mensaje de éxito
        const toast = await this.toastController.create({
          message: '¡Orden creada exitosamente!',
          duration: 3000,
          color: 'success',
          position: 'top'
        });
        await toast.present();

        // Redirigir a página de confirmación (modo "gracias")
        this.router.navigate(['/order-confirmation'], {
          queryParams: {
            orderId: response.data.id,
            orderNumber: response.data.order_number,
            mode: 'thanks' // indica que venimos de la compra recién hecha
          }
        });

      } else {
        throw new Error(response?.message || 'Error desconocido al crear la orden');
      }

    } catch (error: any) {
      console.error('❌ [CHECKOUT] Error procesando orden:', error);

      let errorMessage = 'Error procesando la orden. Por favor intenta nuevamente.';

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
      await loading.dismiss();
    }
  }


  goBack(): void {
    this.router.navigate(['/tabs/cart']);
  }

  // Métodos para manejar direcciones
  async loadUserAddresses(): Promise<void> {
    if (!this.user) return;

    this.addressesLoading = true;
    this.cdr.detectChanges(); // Forzar detección de cambios

    try {
      const response = await firstValueFrom(this.addressService.getUserAddresses());
      if (response && response.success) {
        this.userAddresses = response.data as UserAddress[];

        // Si hay direcciones, seleccionar la predeterminada
        const defaultAddress = this.addressService.getDefaultAddress(this.userAddresses);
        if (defaultAddress) {
          this.selectedAddressId = defaultAddress.id || null;
          this.useExistingAddress = true;
          this.fillAddressFromSelected(defaultAddress);
        }
      }
    } catch (error: any) {
      console.error('Error cargando direcciones:', error);
    } finally {
      this.addressesLoading = false;
      this.cdr.detectChanges(); // Forzar detección de cambios al finalizar
    }
  }

  onAddressSelectionChange(): void {
    if (this.useExistingAddress && this.selectedAddressId) {
      const selectedAddress = this.userAddresses.find(addr => addr.id === this.selectedAddressId);
      if (selectedAddress) {
        this.fillAddressFromSelected(selectedAddress);
      }
    }
    this.cdr.detectChanges(); // Forzar detección de cambios
  }

  private fillAddressFromSelected(address: UserAddress): void {
    this.shippingAddress.firstName = address.first_name;
    this.shippingAddress.lastName = address.last_name;
    this.shippingAddress.address = address.address_line_1;
    this.shippingAddress.city = address.city;
    this.shippingAddress.state = address.state;
    this.shippingAddress.zipCode = address.postal_code;
    this.shippingAddress.country = address.country;
    this.shippingAddress.phone = address.phone;
    this.cdr.detectChanges(); // Forzar detección de cambios
  }

  formatAddress(address: UserAddress): string {
    return this.addressService.formatAddress(address);
  }

  getAddressTypeText(type: string): string {
    const typeMap: { [key: string]: string } = {
      'shipping': 'Envío',
      'billing': 'Facturación',
      'both': 'Envío y Facturación'
    };
    return typeMap[type] || type;
  }

  getAddressTypeColor(type: string): string {
    const colorMap: { [key: string]: string } = {
      'shipping': 'primary',
      'billing': 'secondary',
      'both': 'tertiary'
    };
    return colorMap[type] || 'medium';
  }

  getSelectedAddressText(): string {
    if (!this.selectedAddressId) return '';
    const selectedAddress = this.userAddresses.find(addr => addr.id === this.selectedAddressId);
    return selectedAddress ? this.formatAddress(selectedAddress) : '';
  }
}
