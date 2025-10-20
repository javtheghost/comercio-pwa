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
import { environment } from '../../../environments/environment';

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

  // Método de pago (por ahora sólo efectivo)
  paymentMethod: 'cash' = 'cash';

  // Direcciones del usuario
  userAddresses: UserAddress[] = [];
  selectedAddressId: number | null = null;
  useExistingAddress = false; // mantenido por compatibilidad interna
  addressMode: 'existing' | 'new' = 'new';
  addressesLoading = false;
  // Errores de validación para nueva dirección
  addressErrors: string[] = [];
  showAddressErrors = false;
  savingAddress = false;
  addressSavedToastShown = false;

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

    // DEBUG: exponer un trigger global para forzar processOrder() desde la Console
    try {
      // @ts-ignore - debugging helper
      window.triggerCheckoutProcess = async () => {
        console.log('🔬 [DEBUG] triggerCheckoutProcess called from window');
        try {
          await this.processOrder();
        } catch (e) {
          console.error('🔬 [DEBUG] Error invoking processOrder via trigger:', e);
        }
      };

      // también escuchar un evento custom para forzar checkout
      window.addEventListener('force-checkout', async () => {
        console.log('🔬 [DEBUG] force-checkout event received');
        try { await this.processOrder(); } catch (e) { console.error(e); }
      });
    } catch (e) {
      console.warn('⚠️ [CHECKOUT] No se pudo exponer triggerCheckoutProcess:', e);
    }
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
    // Si se usa dirección existente, sólo necesitamos selección y método de pago
    if (this.addressMode === 'existing') {
      return !!(this.selectedAddressId && this.paymentMethod);
    }
    // Nueva dirección: validar campos usando servicio (modo silencioso para no mostrar aún errores)
    const validBasic = !!(
      this.shippingAddress.firstName &&
      this.shippingAddress.lastName &&
      this.shippingAddress.address &&
      this.shippingAddress.city &&
      this.shippingAddress.state &&
      this.shippingAddress.zipCode &&
      this.shippingAddress.phone &&
      this.paymentMethod
    );
    if (!validBasic) return false;
    return this.validateNewAddress(true); // validación silenciosa (no fuerza mostrar errores)
  }

  // Chequeo ligero sólo para habilitar botón "Guardar dirección" (sin validar formato de CP/teléfono)
  isNewAddressBasicFilled(): boolean {
    if (this.addressMode !== 'new') return false;
    return !!(
      this.shippingAddress.firstName?.trim() &&
      this.shippingAddress.lastName?.trim() &&
      this.shippingAddress.address?.trim() &&
      this.shippingAddress.city?.trim() &&
      this.shippingAddress.state?.trim() &&
      this.shippingAddress.zipCode?.trim() &&
      this.shippingAddress.phone?.trim()
    );
  }

  onAddressModeChange(): void {
    this.useExistingAddress = this.addressMode === 'existing';
    if (this.useExistingAddress) {
      if (!this.selectedAddressId && this.userAddresses.length) {
        const defaultAddress = this.addressService.getDefaultAddress(this.userAddresses);
        if (defaultAddress) {
          this.selectedAddressId = defaultAddress.id || null;
        } else {
          this.selectedAddressId = this.userAddresses[0].id || null;
        }
      }
      if (this.selectedAddressId) {
        const addr = this.userAddresses.find(a => a.id === this.selectedAddressId);
        if (addr) this.fillAddressFromSelected(addr);
      }
    } else {
      // Modo nueva: limpiar todos los campos para evitar duplicados accidentales
      this.resetNewAddressForm();
    }
    this.cdr.detectChanges();
  }

  onExistingAddressSelected(): void {
    if (!this.selectedAddressId) return;
    const selectedAddress = this.userAddresses.find(a => a.id === this.selectedAddressId);
    if (selectedAddress) {
      this.fillAddressFromSelected(selectedAddress);
    }
    this.cdr.detectChanges();
  }

  async processOrder(): Promise<void> {
    console.log('💳 [CHECKOUT] Método de pago seleccionado:', this.paymentMethod);

    // Marcar loading de UI para evitar que el botón quede habilitado
    try {
      this.loading = true;
    } catch {}

    // DEBUG: dump estado inicial para diagnosticar porque no se hace la petición
    try {
      console.log('🧪 [DEBUG] isFormValid ->', this.isFormValid());
      console.log('🧪 [DEBUG] isCartEmpty ->', this.isCartEmpty());
      console.log('🧪 [DEBUG] cart ->', this.cart);
      console.log('🧪 [DEBUG] user ->', this.user);
      console.log('🧪 [DEBUG] addressMode ->', this.addressMode);
      console.log('🧪 [DEBUG] selectedAddressId ->', this.selectedAddressId);
    } catch (dbgErr) {
      console.warn('⚠️ [DEBUG] Error dumping initial state:', dbgErr);
    }

    if (!this.isFormValid()) {
      console.log('⛔ [CHECKOUT] isFormValid -> FAILED');
      this.error = 'Por favor completa todos los campos requeridos';
      // Si estamos en modo nueva dirección, forzar mostrar errores detallados
      if (this.addressMode === 'new') {
        this.validateNewAddress(false);
      }
      this.loading = false;
      return;
    }
    console.log('✅ [CHECKOUT] isFormValid -> PASSED');

    if (this.isCartEmpty()) {
      console.log('⛔ [CHECKOUT] isCartEmpty -> true');
      this.error = 'El carrito está vacío';
      this.loading = false;
      return;
    }
    console.log('✅ [CHECKOUT] isCartEmpty -> false');

    if (!this.user) {
      console.log('⛔ [CHECKOUT] user -> null/undefined');
      this.error = 'Usuario no autenticado';
      this.loading = false;
      return;
    }
    console.log('✅ [CHECKOUT] user -> present (id=' + (this.user?.id || 'n/a') + ')');

    // Validar método de pago
    if (!this.paymentMethod) {
      console.log('⛔ [CHECKOUT] paymentMethod -> falsy');
      this.error = 'Por favor selecciona un método de pago';
      this.loading = false;
      return;
    }
    console.log('✅ [CHECKOUT] paymentMethod ->', this.paymentMethod);

    // Validar nueva dirección (en caso de modo 'new') antes de crear la orden
    if (this.addressMode === 'new') {
      const isAddressValid = this.validateNewAddress(false);
      if (!isAddressValid) {
        console.log('⛔ [CHECKOUT] New address validation failed');
        this.error = 'Corrige los errores de la dirección antes de continuar';
        this.loading = false;
        return;
      }
      console.log('✅ [CHECKOUT] New address valid');
    }

    let loading: HTMLIonLoadingElement | null = null;
    try {
      loading = await this.loadingController.create({
        message: 'Procesando orden...',
        spinner: 'crescent'
      });
      await loading.present();
      console.log('🔄 [CHECKOUT] Loading presentado');
    } catch (loadErr) {
      // En producción algunos errores pueden ocurrir presentando el loading; no debe detener el flujo
      console.warn('⚠️ [CHECKOUT] No se pudo presentar el loading:', loadErr);
    }

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

      console.log('🧾 [DEBUG] orderData prepared (post-construction):', orderData);
      console.log('[CHECKOUT] Antes de llamar a createOrder');
      let result;
      try {
        result = await this.orderService.createOrder(orderData).toPromise();
        console.log('[CHECKOUT] createOrder completado, resultado:', result);
      } catch (err) {
        console.error('[CHECKOUT] Error en createOrder:', err);
      }

      // Validar datos antes de enviar
      const validation = this.orderService.validateOrderData(orderData);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      // Crear la orden
  console.log('⬆️ [DEBUG] Enviando POST a createOrder...');
  const response = await firstValueFrom(this.orderService.createOrder(orderData));
  console.log('↪️ [DEBUG] createOrder response ->', response);

      // Aceptar respuestas alternativas (backend puede devolver la orden directamente)
      const success = (response && (response.success === true || response.success === 'true'))
        || (!!response && (response.id || response.order_number || response.data));
      const responseData = response?.data || response;

      if (success) {
        console.log('✅ [CHECKOUT] Orden creada (aceptado):', responseData);

        // ✅ Verificar si viene de carrito abandonado y marcarlo como recuperado
        await this.handleAbandonedCartRecovery();

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
      try {
        if (loading) await loading.dismiss();
      } catch (dismissErr) {
        console.warn('⚠️ [CHECKOUT] Error dismissing loading:', dismissErr);
      }
      // Reset UI loading flag
      try { this.loading = false; } catch {}
    }
  }

  // Guardar la nueva dirección opcionalmente
  async saveNewAddress(): Promise<void> {
    if (this.addressMode !== 'new') return;
    const isValid = this.validateNewAddress(false);
    if (!isValid) {
      this.error = 'Corrige los errores antes de guardar la dirección';
      return;
    }
    if (this.savingAddress) return;
    this.savingAddress = true;
    this.error = null;
    const payload: any = {
      first_name: this.shippingAddress.firstName.trim(),
      last_name: this.shippingAddress.lastName.trim(),
      address_line_1: this.shippingAddress.address.trim(),
      city: this.shippingAddress.city.trim(),
      state: this.shippingAddress.state.trim(),
      postal_code: this.shippingAddress.zipCode.trim(),
      country: this.shippingAddress.country.trim(),
      phone: this.shippingAddress.phone.trim(),
      type: 'shipping',
      is_default: false
    };
    try {
      const resp = await firstValueFrom(this.addressService.createAddress(payload));
      if (resp && resp.success && resp.data && !Array.isArray(resp.data)) {
        // Actualizar lista local
        await this.loadUserAddresses();
        // Seleccionar la nueva
        const created: any = resp.data;
        if (created.id) {
          this.selectedAddressId = created.id;
          this.addressMode = 'existing';
          this.useExistingAddress = true;
        }
        if (!this.addressSavedToastShown) {
          const toast = await this.toastController.create({
            message: 'Dirección guardada',
            duration: 2500,
            color: 'success',
            position: 'top'
          });
            await toast.present();
          this.addressSavedToastShown = true;
        }
      } else {
        throw new Error(resp?.message || 'No se pudo guardar la dirección');
      }
    } catch (e: any) {
      console.error('[CHECKOUT] Error guardando dirección:', e);
      this.error = e?.message || 'Error guardando la dirección';
      const toast = await this.toastController.create({
        message: this.error || 'Error guardando la dirección',
        duration: 4000,
        color: 'danger',
        position: 'top'
      });
      await toast.present();
    } finally {
      this.savingAddress = false;
      this.cdr.detectChanges();
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

        // Si hay direcciones, intentar seleccionar la predeterminada
        if (this.userAddresses.length) {
          const defaultAddress = this.addressService.getDefaultAddress(this.userAddresses);
          if (defaultAddress) {
            this.selectedAddressId = defaultAddress.id || null;
            this.addressMode = 'existing';
            this.useExistingAddress = true;
            this.fillAddressFromSelected(defaultAddress);
          } else {
            this.addressMode = 'new';
          }
        } else {
          this.addressMode = 'new';
        }
      }
    } catch (error: any) {
      console.error('Error cargando direcciones:', error);
    } finally {
      this.addressesLoading = false;
      this.cdr.detectChanges(); // Forzar detección de cambios al finalizar
    }
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

  private resetNewAddressForm(): void {
    this.shippingAddress.firstName = '';
    this.shippingAddress.lastName = '';
    this.shippingAddress.address = '';
    this.shippingAddress.city = '';
    this.shippingAddress.state = '';
    this.shippingAddress.zipCode = '';
    this.shippingAddress.country = 'México';
    this.shippingAddress.phone = '';
    this.addressErrors = [];
    this.showAddressErrors = false;
  }

  // Validación avanzada de nueva dirección usando AddressService
  private buildPartialAddressForValidation(): Partial<UserAddress> {
    return {
      first_name: this.shippingAddress.firstName,
      last_name: this.shippingAddress.lastName,
      address_line_1: this.shippingAddress.address,
      city: this.shippingAddress.city,
      state: this.shippingAddress.state,
      postal_code: this.shippingAddress.zipCode,
      country: this.shippingAddress.country,
      phone: this.shippingAddress.phone
    } as Partial<UserAddress>;
  }

  validateNewAddress(silent: boolean): boolean {
    const partial = this.buildPartialAddressForValidation() as any; // reutiliza interfaz del servicio
    const result = this.addressService.validateAddressData(partial);
    this.addressErrors = result.errors;
    if (!silent) {
      this.showAddressErrors = true;
    }
    return result.isValid;
  }

  onAddressFieldChange(): void {
    if (this.addressMode === 'new' && this.showAddressErrors) {
      // Revalidar en vivo sólo si ya se mostraron
      this.validateNewAddress(true);
    }
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

  /**
   * 🛒 Marcar carrito como recuperado si viene de notificación de carrito abandonado
   */
  private async handleAbandonedCartRecovery(): Promise<void> {
    try {
      // Obtener cart_id de localStorage (guardado al hacer clic en la notificación)
      const cartId = localStorage.getItem('abandoned_cart_id');
      
      if (!cartId) {
        return; // No viene de carrito abandonado
      }

      console.log('🛒 [CHECKOUT] Marcando carrito como recuperado:', cartId);

      // Obtener token de autenticación
      const token = this.authService.getToken();
      
      if (!token) {
        console.warn('⚠️ [CHECKOUT] No hay token para marcar carrito como recuperado');
        return;
      }

      // Llamar al endpoint de recuperación
      const response = await fetch(
        `${environment.apiUrl}/cart/recovered/${cartId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ [CHECKOUT] Carrito marcado como recuperado:', data);
        
        // Limpiar el cart_id guardado
        localStorage.removeItem('abandoned_cart_id');
      } else {
        console.warn('⚠️ [CHECKOUT] Error al marcar carrito como recuperado:', response.status);
      }
      
    } catch (error) {
      console.error('❌ [CHECKOUT] Error en handleAbandonedCartRecovery:', error);
      // No lanzar error - esto no debe bloquear el checkout
    }
  }
}
