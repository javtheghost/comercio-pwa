import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController, LoadingController, AlertController } from '@ionic/angular';
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

  // Datos de confirmación de orden
  orderConfirmation: {
    orderNumber?: string;
    orderId?: string;
    total?: number;
  } | null = null;

  // Modal de confirmación
  showOrderSuccessModal = false;

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
    private alertController: AlertController,
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

  /**
   * Debug helper: enviar la orden directamente via fetch para aislar HttpClient/interceptor/SW
   */
  async debugCreateOrder(): Promise<void> {
    console.log('🐞 [DEBUG] debugCreateOrder triggered');

    if (!this.cart || this.isCartEmpty()) {
      console.warn('[DEBUG] No hay items en el carrito');
      const toast = await this.toastController.create({
        message: 'Carrito vacío (debug)',
        duration: 3000,
        color: 'warning'
      });
      await toast.present();
      return;
    }

    if (!this.user) {
      console.warn('[DEBUG] No hay usuario autenticado');
      const toast = await this.toastController.create({
        message: 'Usuario no autenticado (debug)',
        duration: 3000,
        color: 'warning'
      });
      await toast.present();
      return;
    }

    let loading: HTMLIonLoadingElement | null = null;

    try {
      console.log('🐞 [DEBUG] debugCreateOrder triggered');

      if (!this.cart || this.isCartEmpty()) {
        console.warn('[DEBUG] No hay items en el carrito');
        if (loading) await (loading as HTMLIonLoadingElement).dismiss();
        const toast = await this.toastController.create({ message: 'Carrito vacío (debug)', duration: 3000, color: 'warning' });
        await toast.present();
        return;
      }

      if (!this.user) {
        console.warn('[DEBUG] No hay usuario autenticado');
        if (loading) await (loading as HTMLIonLoadingElement).dismiss();
        const toast = await this.toastController.create({ message: 'Usuario no autenticado (debug)', duration: 3000, color: 'warning' });
        await toast.present();
        return;
      }

      const customer_id = this.user.id;
      const items = this.cart.items.map(item => ({
        product_id: item.product_id,
        product_variant_id: item.product_variant_id,
        quantity: item.quantity
      }));

      const shipping_address = {
        street: this.shippingAddress.address,
        city: this.shippingAddress.city,
        state: this.shippingAddress.state,
        postal_code: this.shippingAddress.zipCode,
        country: this.shippingAddress.country,
        phone: this.shippingAddress.phone
      };

      const billing_address = { ...shipping_address };
      const notes = `Orden debug desde PWA - ${new Date().toLocaleString()}`;
      const payment_method = this.paymentMethod;

      const orderData: CreateOrderRequest = {
        customer_id,
        items,
        shipping_address,
        billing_address,
        notes,
        payment_method
      };

      const token = this.authService.getToken();
      const url = `${environment.apiUrl.replace(/\/+$/, '')}/orders`;

      console.log('🐞 [DEBUG] Enviando orden:', orderData);

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(orderData)
      });

      const text = await resp.text();
      console.log('🐞 [DEBUG] Respuesta del servidor:', text);

      let response;
      try {
        response = JSON.parse(text);
      } catch (e) {
        console.error('🐞 [DEBUG] Error parsing response:', e);
        const toast = await this.toastController.create({
          message: 'Error parsing response del servidor',
          duration: 4000,
          color: 'danger'
        });
        await toast.present();
        return;
      }

      // Verificar si la orden se creó exitosamente
      const success = (response && (response.success === true || response.success === 'true'))
        || (!!response && (response.id || response.order_number || response.data));

      if (success) {
        console.log('✅ [DEBUG] Orden creada exitosamente');

        // Cerrar loading
        if (loading) await (loading as HTMLIonLoadingElement).dismiss();

        // Limpiar el carrito
        await firstValueFrom(this.cartService.clearCart());

        // Navegar a página de confirmación
        const orderId = response.data?.id || response.id;
        const orderNumber = response.data?.order_number || response.order_number;
        const total = response.data?.total_amount || response.total_amount;

        console.log('🎉 [DEBUG] Navegando a confirmación:', {
          orderId,
          orderNumber,
          total
        });

        this.router.navigate(['/order-confirmation'], {
          queryParams: {
            orderNumber: orderNumber,
            orderId: orderId,
            total: total || this.getTotal(),
            mode: 'debug'
          }
        });

      } else {
        console.log('❌ [DEBUG] Error creando orden');
        if (loading) await (loading as HTMLIonLoadingElement).dismiss();
        const toast = await this.toastController.create({
          message: `Error: ${response?.message || 'Error desconocido del servidor'}`,
          duration: 4000,
          color: 'danger'
        });
        await toast.present();
      }

    } catch (err: any) {
      console.error('🐞 [DEBUG] Error en debugCreateOrder:', err);
      if (loading) await (loading as HTMLIonLoadingElement).dismiss();
      const toast = await this.toastController.create({ message: 'Error debug fetch', duration: 4000, color: 'danger' });
      try { await toast.present(); } catch {}
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
    console.log('🔍 [DEBUG] isFormValid - addressMode:', this.addressMode);
    console.log('🔍 [DEBUG] isFormValid - selectedAddressId:', this.selectedAddressId);
    console.log('🔍 [DEBUG] isFormValid - paymentMethod:', this.paymentMethod);
    console.log('🔍 [DEBUG] isFormValid - loading:', this.loading);

    // Si se usa dirección existente, sólo necesitamos selección y método de pago
    if (this.addressMode === 'existing') {
      const result = !!(this.selectedAddressId && this.paymentMethod);
      console.log('🔍 [DEBUG] isFormValid (existing) - result:', result);
      console.log('🔍 [DEBUG] isFormValid (existing) - selectedAddressId truthy:', !!this.selectedAddressId);
      console.log('🔍 [DEBUG] isFormValid (existing) - paymentMethod truthy:', !!this.paymentMethod);
      return result;
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
    console.log('🔍 [DEBUG] isFormValid (new) - validBasic:', validBasic);
    console.log('🔍 [DEBUG] isFormValid (new) - shippingAddress:', this.shippingAddress);
    if (!validBasic) return false;
    const addressValid = this.validateNewAddress(true); // validación silenciosa (no fuerza mostrar errores)
    console.log('🔍 [DEBUG] isFormValid (new) - addressValid:', addressValid);
    return addressValid;
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

  // Método para verificar el estado del botón (se llama desde el template)
  getButtonDisabled(): boolean {
    const disabled = !this.isFormValid() || this.loading;
    console.log('🔘 [DEBUG] getButtonDisabled - isFormValid():', this.isFormValid());
    console.log('🔘 [DEBUG] getButtonDisabled - loading:', this.loading);
    console.log('🔘 [DEBUG] getButtonDisabled - disabled:', disabled);
    return disabled;
  }

  // Método de debug para verificar si el click funciona
  onCheckoutButtonClick(): void {
    console.log('🖱️ [DEBUG] Botón de checkout clickeado');
    console.log('🖱️ [DEBUG] loading:', this.loading);
    console.log('🖱️ [DEBUG] isFormValid():', this.isFormValid());
    console.log('🖱️ [DEBUG] addressMode:', this.addressMode);
    console.log('🖱️ [DEBUG] selectedAddressId:', this.selectedAddressId);
    console.log('🖱️ [DEBUG] paymentMethod:', this.paymentMethod);

    if (this.loading) {
      console.log('⚠️ [DEBUG] Botón deshabilitado por loading');
      return;
    }

    if (!this.isFormValid()) {
      console.log('⚠️ [DEBUG] Botón deshabilitado por validación');
      return;
    }

    console.log('✅ [DEBUG] Ejecutando processOrder...');
    this.processOrder();
  }

  // Método directo sin service worker ni notificaciones
  async processOrderDirect(): Promise<void> {
    console.log('🚀 [DIRECT] Procesando orden directamente (sin SW ni notificaciones)');
    console.log('🚀 [DIRECT] user:', !!this.user, this.user?.id);
    console.log('🚀 [DIRECT] cart:', !!this.cart, this.cart?.items?.length);
    console.log('🚀 [DIRECT] isCartEmpty():', this.isCartEmpty());

    if (!this.user) {
      console.log('❌ [DIRECT] Usuario faltante');
      return;
    }

    if (!this.cart) {
      console.log('❌ [DIRECT] Carrito faltante');
      return;
    }

    if (this.isCartEmpty()) {
      console.log('❌ [DIRECT] Carrito vacío');
      return;
    }

    console.log('✅ [DIRECT] Datos básicos OK, continuando...');

    let loading: HTMLIonLoadingElement | null = null;
    try {
      console.log('🔄 [DIRECT] Creando loading...');
      loading = await this.loadingController.create({
        message: 'Procesando orden directa...',
        spinner: 'crescent'
      });
      console.log('🔄 [DIRECT] Presentando loading...');
      await loading.present();
      console.log('✅ [DIRECT] Loading presentado');
    } catch (loadingError) {
      console.error('❌ [DIRECT] Error con loading:', loadingError);
      // Continuar sin loading si hay error
    }

    try {
      console.log('🔨 [DIRECT] Construyendo datos de la orden...');

      // Construir datos de la orden
      const customer_id = this.user.id;
      console.log('🔨 [DIRECT] customer_id:', customer_id);

      const items = this.cart.items.map(item => ({
        product_id: item.product_id,
        product_variant_id: item.product_variant_id,
        quantity: item.quantity
      }));
      console.log('🔨 [DIRECT] items:', items);

      const shipping_address = {
        street: this.shippingAddress.address,
        city: this.shippingAddress.city,
        state: this.shippingAddress.state,
        postal_code: this.shippingAddress.zipCode,
        country: this.shippingAddress.country,
        phone: this.shippingAddress.phone
      };
      console.log('🔨 [DIRECT] shipping_address:', shipping_address);

      const billing_address = { ...shipping_address };
      const notes = `Orden directa desde PWA - ${new Date().toLocaleString()}`;
      const payment_method = this.paymentMethod;

      const orderData = {
        customer_id,
        items,
        shipping_address,
        billing_address,
        notes,
        payment_method
      };

      console.log('📤 [DIRECT] Enviando orden:', orderData);

      const token = this.authService.getToken();
      const url = `${environment.apiUrl.replace(/\/+$/, '')}/orders`;

      console.log('🌐 [DIRECT] URL:', url);
      console.log('🔑 [DIRECT] Token:', token ? 'Presente' : 'Faltante');

      console.log('📡 [DIRECT] Iniciando fetch...');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(orderData)
      });
      console.log('📡 [DIRECT] Fetch completado, status:', response.status);

      const result = await response.json();
      console.log('📥 [DIRECT] Respuesta recibida:', result);

      if (response.ok && (result.success || result.id || result.data)) {
        console.log('✅ [DIRECT] Orden creada exitosamente');

  if (loading) await loading.dismiss();

        // Limpiar carrito
        await firstValueFrom(this.cartService.clearCart());

        // Mostrar mensaje de éxito
        const toast = await this.toastController.create({
          message: '¡Orden creada exitosamente! (Directa)',
          duration: 3000,
          color: 'success',
          position: 'top'
        });
        await toast.present();

        // Redirigir
        this.router.navigate(['/order-confirmation'], {
          queryParams: {
            orderId: result.data?.id || result.id,
            orderNumber: result.data?.order_number || result.order_number,
            mode: 'thanks'
          }
        });
      } else {
        throw new Error(result.message || 'Error creando la orden');
      }

    } catch (error: any) {
      console.error('❌ [DIRECT] Error:', error);
  if (loading) await loading.dismiss();

      const toast = await this.toastController.create({
        message: `Error: ${error.message || 'Error desconocido'}`,
        duration: 4000,
        color: 'danger',
        position: 'top'
      });
      await toast.present();
    }
  }

  async processOrder(): Promise<void> {
    console.log('🔍 [DEBUG] processOrder iniciado');
    console.log('🔍 [DEBUG] isFormValid():', this.isFormValid());
    console.log('🔍 [DEBUG] addressMode:', this.addressMode);
    console.log('🔍 [DEBUG] selectedAddressId:', this.selectedAddressId);
    console.log('🔍 [DEBUG] paymentMethod:', this.paymentMethod);
    console.log('🔍 [DEBUG] shippingAddress:', this.shippingAddress);

    console.log('💳 [CHECKOUT] Método de pago seleccionado:', this.paymentMethod);

    // Marcar loading de UI para evitar que el botón quede habilitado
    try {
      this.loading = true;
    } catch {}


    if (!this.isFormValid()) {
      this.error = 'Por favor completa todos los campos requeridos';
      if (this.addressMode === 'new') {
        this.validateNewAddress(false);
      }
      this.loading = false;
      return;
    }

    if (this.isCartEmpty()) {
      this.error = 'El carrito está vacío';
      this.loading = false;
      return;
    }

    if (!this.user) {
      this.error = 'Usuario no autenticado';
      this.loading = false;
      return;
    }

    if (!this.paymentMethod) {
      this.error = 'Por favor selecciona un método de pago';
      this.loading = false;
      return;
    }

    // Validar nueva dirección (en caso de modo 'new') antes de crear la orden
    if (this.addressMode === 'new') {
      const isAddressValid = this.validateNewAddress(false);
      if (!isAddressValid) {
        this.error = 'Corrige los errores de la dirección antes de continuar';
        this.loading = false;
        return;
      }
    }

    let loading: HTMLIonLoadingElement | null = null;
    try {
      loading = await this.loadingController.create({
        message: 'Procesando orden...',
        spinner: 'crescent'
      });

      // Present con timeout para evitar bloqueo indefinido en algunos entornos
      const presentPromise = loading.present();
      try {
        await Promise.race([presentPromise, new Promise((res) => setTimeout(res, 2500))]);
        console.log('🔄 [CHECKOUT] Loading presentado (o timeout alcanzado)');
      } catch (innerErr) {
        console.warn('⚠️ [CHECKOUT] loading.present() fallo o timeout:', innerErr);
      }
    } catch (loadErr) {
      // En producción algunos errores pueden ocurrir presentando el loading; no debe detener el flujo
      console.warn('⚠️ [CHECKOUT] No se pudo presentar el loading (create failed):', loadErr);
    }

    this.error = null;

    try {
      console.log('💳 [CHECKOUT] Procesando orden...');

      // Construir datos de la orden
      const customer_id = this.user.id;
      const items = this.cart!.items.map(item => ({
        product_id: item.product_id,
        product_variant_id: item.product_variant_id,
        quantity: item.quantity
      }));
      const shipping_address = {
        street: this.shippingAddress.address,
        city: this.shippingAddress.city,
        state: this.shippingAddress.state,
        postal_code: this.shippingAddress.zipCode,
        country: this.shippingAddress.country,
        phone: this.shippingAddress.phone
      };
      const billing_address = { ...shipping_address };
      const notes = `Orden creada desde PWA - ${new Date().toLocaleString()}`;
      const payment_method = this.paymentMethod;
      const orderData: CreateOrderRequest = {
        customer_id,
        items,
        shipping_address,
        billing_address,
        notes,
        payment_method
      };
      // Validar datos antes de enviar
      const validation = this.orderService.validateOrderData(orderData);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      // Crear la orden usando fetch directamente (como debug) para evitar problemas con interceptor
      // NOTA: HttpClient con interceptor no funciona, por eso usamos fetch() directamente
      console.log('⬆️ [CHECKOUT] Enviando orden...');

      const token = this.authService.getToken();
      const url = `${environment.apiUrl.replace(/\/+$/, '')}/orders`;

      const TIMEOUT_MS = 15000; // 15s
      let response: any;
      try {
        const fetchPromise = fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify(orderData)
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)
        );

        const resp = await Promise.race([fetchPromise, timeoutPromise]) as Response;
        const text = await resp.text();

        try {
          response = JSON.parse(text);
        } catch (parseError) {
          console.error('❌ [CHECKOUT] Error parsing response:', parseError);
          throw new Error('Error parsing server response');
        }

        console.log('↪️ [CHECKOUT] Respuesta recibida');
      } catch (err: any) {
        console.error('❌ [CHECKOUT] Error al crear orden:', err);
        // Mostrar mensaje más claro al usuario
        const msg = (err && err.message === 'timeout') ? 'La petición tardó demasiado. Intenta nuevamente.' : (err?.message || 'Error enviando la orden');
        this.error = msg;
        try {
          const toast = await this.toastController.create({ message: msg, duration: 4000, color: 'danger', position: 'top' });
          await toast.present();
        } catch (tErr) { console.warn('⚠️ [CHECKOUT] No se pudo mostrar toast de error:', tErr); }

        // Asegurar que el loading se limpia y se intenta dismiss del spinner
        try { this.loading = false; } catch {}
        try { if (loading) await loading.dismiss(); } catch {}

        // Re-lanzar para que el bloque externo lo maneje también (ya mostramos toast)
        throw err;
      }

      // Verificar si la orden se creó exitosamente
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

        // Mostrar modal de confirmación sin navegar
        this.orderConfirmation = {
          orderNumber: response.data.order_number,
          orderId: response.data.id,
          total: parseFloat(response.data.total_amount)
        };
        this.showOrderSuccessModal = true;

      } else {
        console.log('❌ [CHECKOUT] Error en respuesta:', response);
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
        if (loading) await (loading as HTMLIonLoadingElement).dismiss();
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

  /**
   * Mostrar alert de confirmación de orden exitosa
   */
  async showOrderSuccessAlert(): Promise<void> {
    console.log('🎉 [ALERT] Mostrando alert de confirmación...');

    const orderNumber = this.orderConfirmation?.orderNumber || 'N/A';
    const total = this.orderConfirmation?.total?.toFixed(2) || '0.00';

    const alert = await this.alertController.create({
      header: '¡Orden Confirmada!',
      subHeader: 'Tu pedido ha sido procesado exitosamente',
      message: `
        <div class="order-confirmation-alert">
          <div class="success-icon">✓</div>
          <h3>¡Tu pedido ha sido confirmado!</h3>

          <div class="order-details">
            <div class="detail-row">
              <span class="label">Número de Orden:</span>
              <span class="value">${orderNumber}</span>
            </div>
            <div class="detail-row">
              <span class="label">Total:</span>
              <span class="value">$${total}</span>
            </div>
            <div class="detail-row">
              <span class="label">Método de Pago:</span>
              <span class="value">Efectivo (Contra Entrega)</span>
            </div>
          </div>

          <div class="email-notification">
            <span class="email-icon">📧</span>
            <p>Te enviaremos actualizaciones del estado de tu pedido a tu correo electrónico.</p>
          </div>
        </div>
      `,
      buttons: [
        {
          text: 'Ver Mis Órdenes',
          cssClass: 'alert-button-primary',
          handler: () => {
            console.log('🔍 [ALERT] Navegando a órdenes...');
            this.router.navigate(['/tabs/account']);
          }
        },
        {
          text: 'Ir al Inicio',
          cssClass: 'alert-button-secondary',
          handler: () => {
            console.log('🔍 [ALERT] Navegando al inicio...');
            this.router.navigate(['/tabs/home']);
          }
        }
      ],
      cssClass: 'order-success-alert'
    });

    await alert.present();
  }

  /**
   * Método de debug para ir a la página de confirmación
   */
  goToConfirmation(): void {
    console.log('🔧 [DEBUG] Navegando a confirmación...');
    this.router.navigate(['/order-confirmation'], {
      queryParams: {
        orderNumber: 'DEBUG-12345',
        orderId: 'debug-123',
        total: this.getTotal(),
        mode: 'debug'
      }
    });
  }

  /**
   * Método de debug para mostrar el alert mejorado
   */
  async showDebugAlert(): Promise<void> {
    console.log('🔧 [DEBUG] Mostrando alert mejorado...');
    this.orderConfirmation = {
      orderNumber: 'DEBUG-12345',
      orderId: 'debug-123',
      total: this.getTotal()
    };
    await this.showOrderSuccessAlert();
  }

  /**
   * Cerrar el modal de confirmación de orden
   */
  closeOrderModal(): void {
    this.showOrderSuccessModal = false;
    this.orderConfirmation = null;
  }

  /**
   * Navegar a la página de órdenes del usuario
   */
  goToOrders(): void {
    console.log('🔍 [MODAL] Navegando a órdenes...');
    this.closeOrderModal();
    this.router.navigate(['/tabs/account']);
  }

  /**
   * Navegar al inicio
   */
  goToHome(): void {
    console.log('🔍 [MODAL] Navegando al inicio...');
    this.closeOrderModal();
    this.router.navigate(['/tabs/home']);
  }

  /**
   * Método de debug para mostrar el modal de confirmación
   */
  showDebugModal(): void {
    console.log('🔧 [DEBUG] Mostrando modal de confirmación...');
    this.orderConfirmation = {
      orderNumber: 'DEBUG-12345',
      orderId: 'debug-123',
      total: this.getTotal()
    };
    this.showOrderSuccessModal = true;
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
