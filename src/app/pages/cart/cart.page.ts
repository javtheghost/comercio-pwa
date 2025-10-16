import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, CurrencyPipe, NgForOf, NgIf } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription, Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardContent, IonItem, IonLabel, IonButton, IonIcon, IonList, IonThumbnail, IonSpinner, IonText, ToastController, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { CartService, Cart, CartItem } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { OfflineCartService, OfflineCart, OfflineCartItem } from '../../services/offline-cart.service';
import { NavController } from '@ionic/angular';
import { TabNavigationService } from '../../services/tab-navigation.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, NgIf, NgForOf, CurrencyPipe, IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardContent, IonItem, IonLabel, IonButton, IonIcon, IonList, IonThumbnail, IonSpinner, IonText, IonRefresher, IonRefresherContent],
  templateUrl: './cart.page.html',
  styleUrls: ['./cart.page.scss']
})
export class CartPage implements OnInit, OnDestroy {
  cart: Cart | null = null;
  offlineCart: OfflineCart | null = null;
  loading = false;
  error: string | null = null;
  isReallyOnline = false; // Estado real de conexión
  private cartSubscription: Subscription = new Subscription();
  private offlineCartSubscription: Subscription = new Subscription();

  // ✅ CACHE de totales para respuesta instantánea
  private cachedTotals = {
    subtotal: 0,
    tax: 0,
    total: 0
  };

  // ✅ DEBOUNCE para evitar múltiples peticiones
  private quantityUpdateSubject = new Subject<{item: CartItem, quantity: number}>();
  private quantityUpdateSubscription: Subscription = new Subscription();

  // ✅ DEBOUNCE específico para input (más tiempo)
  private inputUpdateSubject = new Subject<{item: CartItem, quantity: number}>();
  private inputUpdateSubscription: Subscription = new Subscription();

  // Configuración - Los valores se obtienen del servidor

  constructor(
    private cartService: CartService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private offlineCartService: OfflineCartService,
    private toastController: ToastController,
    private tabNavService: TabNavigationService
  ) {}

  ngOnInit() {
    this.checkConnectionStatus();
    this.loadCart();
    this.subscribeToCart();
    this.subscribeToOfflineCart();
    this.setupQuantityDebounce();
    this.setupInputDebounce();
  }

  /**
   * trackBy function for ngFor to improve rendering performance
   */
  trackByItemId(index: number, item: any): number {
    return item?.id ?? index;
  }

  ngOnDestroy() {
    this.cartSubscription.unsubscribe();
    this.offlineCartSubscription.unsubscribe();
    this.quantityUpdateSubscription.unsubscribe();
    this.inputUpdateSubscription.unsubscribe();
  }

  /**
   * Configura el debounce para actualizaciones de cantidad (botones + y -)
   */
  private setupQuantityDebounce(): void {
    this.quantityUpdateSubscription = this.quantityUpdateSubject
      .pipe(
        debounceTime(300), // Esperar 300ms después del último cambio
        distinctUntilChanged((prev, curr) =>
          prev.item.id === curr.item.id && prev.quantity === curr.quantity
        )
      )
      .subscribe(({item, quantity}) => {
        this.syncQuantityWithServer(item, quantity);
      });
  }

  /**
   * Configura el debounce para actualizaciones desde input (más tiempo)
   */
  private setupInputDebounce(): void {
    this.inputUpdateSubscription = this.inputUpdateSubject
      .pipe(
        debounceTime(800), // Esperar 800ms después de escribir (más tiempo)
        distinctUntilChanged((prev, curr) =>
          prev.item.id === curr.item.id && prev.quantity === curr.quantity
        )
      )
      .subscribe(({item, quantity}) => {
        this.syncQuantityWithServer(item, quantity);
      });
  }

  /**
   * Suscribe a los cambios del carrito
   */
  private subscribeToCart(): void {
    this.cartSubscription = this.cartService.cart$.subscribe(cart => {
      this.cart = cart;
      // Si recibimos un carrito (incluso vacío), ya no estamos cargando
      if (cart !== null) {
        this.loading = false;
        this.error = null;

        // ✅ INICIALIZAR CACHE de totales
        this.initializeTotalsCache();

        // Forzar la detección de cambios
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Se suscribe a los cambios del carrito offline
   */
  private subscribeToOfflineCart(): void {
    this.offlineCartSubscription = this.offlineCartService.offlineCart$.subscribe(offlineCart => {
      this.offlineCart = offlineCart;
      this.cdr.detectChanges();
    });
  }

  /**
   * Inicializa el cache de totales desde el carrito
   */
  private initializeTotalsCache(): void {
    if (!this.cart) {
      this.cachedTotals = { subtotal: 0, tax: 0, total: 0 };
      return;
    }

    // Usar valores del servidor o calcular si no existen
    this.cachedTotals = {
      subtotal: parseFloat(this.cart.subtotal || '0'),
      tax: parseFloat(this.cart.tax_amount || '0'),
      total: parseFloat(this.cart.total || '0')
    };
  }

  /**
   * Carga el carrito desde el servidor
   */
  loadCart(): void {
    this.loading = true;
    this.error = null;

    // Verificar si hay conexión antes de intentar cargar el carrito online
    const isOnline = this.offlineCartService.isOnline();
    const isAuthenticated = this.authService.isAuthenticated();

    console.log('🔍 [CART PAGE] Estado de conexión básico:', { isOnline, isAuthenticated });

    if (!isOnline || !isAuthenticated) {
      console.log('🔍 [CART PAGE] Sin conexión básica o no autenticado, saltando carga del carrito online');
      this.loading = false;
      this.cdr.detectChanges();
      return;
    }

    this.cartService.getCart().subscribe({
      next: (cart) => {
        this.cart = cart;
        this.loading = false;
        // Forzar la detección de cambios
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error cargando carrito:', error);
        this.error = 'Error al cargar el carrito';
        this.loading = false;
        // Forzar la detección de cambios
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Aumenta la cantidad de un item
   */
  increaseQuantity(item: CartItem): void {
    const newQuantity = item.quantity + 1;
    this.updateItemQuantity(item, newQuantity);
  }

  /**
   * Disminuye la cantidad de un item
   */
  decreaseQuantity(item: CartItem): void {
    if (item.quantity > 1) {
      const newQuantity = item.quantity - 1;
      this.updateItemQuantity(item, newQuantity);
    }
  }

  /**
   * Actualiza la cantidad de un item desde el input
   */
  updateQuantity(item: CartItem, event: any): void {
    const inputValue = event.target.value;

    // Si está vacío, no hacer nada (esperar a que termine de escribir)
    if (!inputValue || inputValue === '') {
      return;
    }

    const newQuantity = parseInt(inputValue);

    // Validar rango
    if (newQuantity && newQuantity > 0 && newQuantity <= 99) {
      this.updateItemQuantityFromInput(item, newQuantity);
    } else if (newQuantity <= 0) {
      // Si es 0 o negativo, corregir a 1
      this.updateItemQuantityFromInput(item, 1);
      event.target.value = 1; // Corregir el input visualmente
    } else if (newQuantity > 99) {
      // Si es mayor a 99, corregir a 99
      this.updateItemQuantityFromInput(item, 99);
      event.target.value = 99; // Corregir el input visualmente
    }
  }

  /**
   * Commit de input (online): en blur o Enter, si quedó vacío, forzar a 1
   */
  commitQuantityInput(item: CartItem, event: any): void {
    const inputValue = event.target.value;
    if (inputValue === '' || inputValue === null || inputValue === undefined) {
      event.target.value = 1;
      this.updateItemQuantityFromInput(item, 1);
      return;
    }
    // Si no está vacío, reutilizar la validación existente
    this.updateQuantity(item, event);
  }

  /**
   * Actualiza la cantidad de un item desde el input (optimista + debounced largo)
   */
  private updateItemQuantityFromInput(item: CartItem, quantity: number): void {
    // ✅ ACTUALIZACIÓN OPTIMISTA: Cambiar inmediatamente en el frontend
    if (this.cart) {
      const cartItem = this.cart.items.find(i => i.id === item.id);
      if (cartItem) {
        cartItem.quantity = quantity;
        cartItem.total_price = (parseFloat(cartItem.unit_price || '0') * quantity).toFixed(2);

        // Recalcular totales del carrito
        this.recalculateCartTotals();
        this.cdr.detectChanges(); // Actualizar UI inmediatamente
      }
    }

    // ✅ DEBOUNCED LARGO: Enviar al servidor después de 800ms de inactividad
    this.inputUpdateSubject.next({item, quantity});
  }

  /**
   * Actualiza la cantidad de un item (optimista + debounced)
   */
  private updateItemQuantity(item: CartItem, quantity: number): void {
    // ✅ ACTUALIZACIÓN OPTIMISTA: Cambiar inmediatamente en el frontend
    if (this.cart) {
      const cartItem = this.cart.items.find(i => i.id === item.id);
      if (cartItem) {
        cartItem.quantity = quantity;
        cartItem.total_price = (parseFloat(cartItem.unit_price || '0') * quantity).toFixed(2);

        // Recalcular totales del carrito
        this.recalculateCartTotals();
        this.cdr.detectChanges(); // Actualizar UI inmediatamente
      }
    }

    // ✅ DEBOUNCED: Enviar al servidor después de 300ms de inactividad
    this.quantityUpdateSubject.next({item, quantity});
  }

  /**
   * Sincroniza la cantidad con el servidor (llamado por debounce)
   */
  private syncQuantityWithServer(item: CartItem, quantity: number): void {
    this.cartService.updateItemQuantity(item.id, { quantity }).subscribe({
      next: (cart) => {
        // Actualizar con datos reales del servidor
        this.cart = cart;
        // ✅ ACTUALIZAR CACHE con datos del servidor
        this.initializeTotalsCache();
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.error = 'Error al actualizar la cantidad';

        // Revertir cambios optimistas
        if (this.cart) {
          const cartItem = this.cart.items.find(i => i.id === item.id);
          if (cartItem) {
            cartItem.quantity = item.quantity; // Volver a cantidad original
            cartItem.total_price = (parseFloat(cartItem.unit_price || '0') * item.quantity).toFixed(2);
            this.recalculateCartTotals();
            this.cdr.detectChanges();
          }
        }

        // Recargar carrito para mantener consistencia
        this.loadCart();
      }
    });
  }

  /**
   * Recalcula los totales del carrito y actualiza el cache
   */
  private recalculateCartTotals(): void {
    if (!this.cart) return;

    // ✅ CÁLCULO INSTANTÁNEO en memoria
    const subtotal = this.cart.items.reduce((sum, item) => {
      return sum + (parseFloat(item.unit_price || '0') * item.quantity);
    }, 0);

  const vatRate = typeof environment.vatRate === 'number' ? environment.vatRate : 0.16;
  const tax = subtotal * vatRate; // IVA configurable
    const shipping = parseFloat(this.cart.shipping_amount || '0');
    const total = subtotal + tax + shipping;

    // ✅ ACTUALIZAR CACHE para respuesta instantánea
    this.cachedTotals = {
      subtotal: subtotal,
      tax: tax,
      total: total
    };

    // ✅ ACTUALIZAR CARRITO (para sincronización con servidor)
    this.cart.subtotal = subtotal.toFixed(2);
    this.cart.tax_amount = tax.toFixed(2);
    this.cart.total = total.toFixed(2);
  }

  /**
   * Selecciona el input para edición
   */
  selectInput(event: any): void {
    event.target.select();
  }

  /**
   * Elimina un item del carrito
   */
  removeFromCart(item: CartItem): void {
    this.cartService.removeItem(item.id).subscribe({
      next: (cart) => {
        console.log('Item eliminado:', cart);
        this.cdr.detectChanges(); // Forzar detección de cambios
      },
      error: (error) => {
        console.error('Error eliminando item:', error);
        this.error = 'Error al eliminar el producto';
        this.loadCart();
      }
    });
  }

  /**
   * Limpia todo el carrito
   */
  clearCart(): void {
    this.cartService.clearCart().subscribe({
      next: (cart) => {
        console.log('Carrito limpiado:', cart);
      },
      error: (error) => {
        console.error('Error limpiando carrito:', error);
        this.error = 'Error al limpiar el carrito';
        this.loadCart();
      }
    });
  }

  /**
   * Obtiene el subtotal del carrito (desde cache para respuesta instantánea)
   */
  getSubtotal(): number {
    return this.cachedTotals.subtotal;
  }

  /**
   * Obtiene el IVA del carrito (desde cache para respuesta instantánea)
   */
  getVAT(): number {
    // Calcular siempre sobre el subtotal combinado (online + offline)
    const vatRate = typeof environment.vatRate === 'number' ? environment.vatRate : 0.16;
    const subtotalCombined = this.getTotalSubtotal();
    return subtotalCombined * vatRate;
  }

  /**
   * Retorna la tasa de IVA como porcentaje entero para mostrar en UI (ej. 16)
   */
  getVatRatePercent(): number {
    const vatRate = typeof environment.vatRate === 'number' ? environment.vatRate : 0.16;
    return Math.round(vatRate * 100);
  }

  /**
   * Obtiene el total del carrito (desde cache para respuesta instantánea)
   */
  getTotal(): number {
    return this.cachedTotals.total;
  }

  /**
   * Obtiene el monto de descuento del carrito
   */
  getDiscountAmount(): number {
    return this.cart?.discount_amount ? parseFloat(this.cart.discount_amount) : 0;
  }

  /**
   * Verifica si hay descuento aplicado
   */
  hasDiscount(): boolean {
    return this.getDiscountAmount() > 0;
  }

  /**
   * Obtiene el costo de envío del carrito
   */
  getShippingFee(): number {
    return this.cart ? parseFloat(this.cart.shipping_amount) : 0;
  }

  /**
   * Verifica si el carrito está vacío (online + offline)
   */
  isCartEmpty(): boolean {
    const onlineEmpty = !this.cart || this.cart.items.length === 0;
    const offlineEmpty = !this.offlineCart || this.offlineCart.items.length === 0;
    return onlineEmpty && offlineEmpty;
  }

  /**
   * Verifica si hay items offline Y el usuario está offline
   */
  hasOfflineItems(): boolean {
    const hasOfflineItems = !!(this.offlineCart && this.offlineCart.items.length > 0);
    const isOffline = this.isOffline();

    console.log('🔍 [CART PAGE] hasOfflineItems check:', {
      hasOfflineItems,
      isOffline,
      isReallyOnline: this.isReallyOnline
    });

    // Solo mostrar como "offline" si realmente está offline (sin conexión real)
    return hasOfflineItems && isOffline;
  }

  /**
   * Verifica si hay items offline pendientes de sincronización (cuando está online)
   */
  hasPendingOfflineItems(): boolean {
    const hasOfflineItems = !!(this.offlineCart && this.offlineCart.items.length > 0);
    const isOnline = !this.isOffline();
    const isAuthenticated = !this.isNotAuthenticated();

    console.log('🔍 [CART PAGE] hasPendingOfflineItems check:', {
      hasOfflineItems,
      isOnline,
      isAuthenticated,
      isReallyOnline: this.isReallyOnline
    });

    // Mostrar como "pendientes" si está online (con o sin autenticación) pero tiene items offline
    return hasOfflineItems && isOnline;
  }

  /**
   * Verifica el estado real de conexión
   */
  async checkConnectionStatus(): Promise<void> {
    try {
      console.log('🔄 [CART PAGE] Verificando conexión...');
      this.isReallyOnline = await this.offlineCartService.isReallyOnline();
      console.log('🔍 [CART PAGE] Estado de conexión real:', this.isReallyOnline);

      // Si ahora estamos online, intentar cargar el carrito
      if (this.isReallyOnline && this.authService.isAuthenticated()) {
        console.log('🔄 [CART PAGE] Conexión detectada, cargando carrito...');
        this.loadCart();
      }

      this.cdr.detectChanges();
    } catch (error) {
      console.error('❌ [CART PAGE] Error verificando conexión:', error);
      this.isReallyOnline = false;
      this.cdr.detectChanges();
    }
  }

  /**
   * Maneja el pull-to-refresh nativo
   */
  async doRefresh(event: any): Promise<void> {
    console.log('🔄 [CART PAGE] Pull-to-refresh activado');

    try {
      // Verificar conexión y recargar carrito
      await this.checkConnectionStatus();

      // Recargar carrito offline también
      this.offlineCart = this.offlineCartService.getCurrentOfflineCart();

      console.log('✅ [CART PAGE] Pull-to-refresh completado');
    } catch (error) {
      console.error('❌ [CART PAGE] Error en pull-to-refresh:', error);
    } finally {
      // Completar el refresh
      event.target.complete();
    }
  }

  /**
   * Verifica si el usuario está offline (usando verificación real)
   */
  isOffline(): boolean {
    return !this.isReallyOnline;
  }

  /**
   * Verifica si el usuario no está autenticado
   */
  isNotAuthenticated(): boolean {
    return !this.authService.isAuthenticated();
  }

  /**
   * Obtiene todos los items del carrito (online + offline)
   */
  getAllCartItems(): (CartItem | OfflineCartItem)[] {
    const onlineItems = this.cart?.items || [];
    const offlineItems = this.offlineCart?.items || [];
    return [...onlineItems, ...offlineItems];
  }

  /**
   * Obtiene el total de items en el carrito (online + offline)
   */
  getTotalItemsCount(): number {
    const onlineCount = this.cart?.items_count || 0;
    const offlineCount = this.offlineCart?.items_count || 0;
    return onlineCount + offlineCount;
  }

  /**
   * Obtiene el subtotal total (online + offline)
   */
  getTotalSubtotal(): number {
    const onlineSubtotal = this.cart ? parseFloat(this.cart.subtotal) : 0;
    const offlineSubtotal = this.offlineCart?.subtotal || 0;
    return onlineSubtotal + offlineSubtotal;
  }

  /**
   * Obtiene el total combinado (online + offline + envío)
   */
  getTotalCombined(): number {
    const subtotal = this.getTotalSubtotal();
    const shipping = this.getShippingFee();
    const tax = this.getVAT();
    const discount = this.getDiscountAmount();

    return subtotal + shipping + tax - discount;
  }

  /**
   * Procede al checkout
   */
  goToCheckout(): void {
    if (this.isCartEmpty()) {
      this.error = 'El carrito está vacío';
      return;
    }

    // Verificar si el usuario está autenticado
    if (this.authService.isAuthenticated()) {
      // Usuario autenticado, proceder al checkout
      console.log('Procediendo al checkout...');
      // TODO: Implementar navegación al checkout
      this.router.navigate(['/checkout']);
    } else {
      // Usuario no autenticado, redirigir al login
      console.log('Usuario no autenticado, redirigiendo al login...');
      this.router.navigate(['/tabs/login'], {
        queryParams: {
          returnUrl: '/checkout'
        }
      });
    }
  }

  /**
   * Continúa comprando
   */
  continueShopping(): void {
    this.tabNavService.navigateToTab('/tabs/home');
  }

  /**
   * Recarga el carrito
   */
  refreshCart(): void {
    this.loadCart();
  }

  /**
   * Actualiza la cantidad de un item offline
   */
  async updateOfflineItemQuantity(item: OfflineCartItem, quantity: number): Promise<void> {
    // Clamp: asegurar mínimo 1 y máximo 99, nunca eliminar aquí
    if (!Number.isFinite(quantity as any)) {
      quantity = 1;
    }
    if (quantity < 1) quantity = 1;
    if (quantity > 99) quantity = 99;

    try {
      await this.offlineCartService.updateOfflineCartItemQuantity(item.id, quantity);
    } catch (error) {
      console.error('Error actualizando cantidad del item offline:', error);
    }
  }

  /**
   * Disminuye la cantidad de un item offline sin permitir bajar de 1
   */
  async decreaseOfflineQuantity(item: OfflineCartItem): Promise<void> {
    if (item.quantity > 1) {
      await this.updateOfflineItemQuantity(item, item.quantity - 1);
    }
  }

  /**
   * Aumenta la cantidad de un item offline respetando el máximo
   */
  async increaseOfflineQuantity(item: OfflineCartItem): Promise<void> {
    await this.updateOfflineItemQuantity(item, item.quantity + 1);
  }

  /**
   * Maneja cambios desde el input para items offline con validación
   */
  async updateOfflineQuantityFromInput(item: OfflineCartItem, event: any): Promise<void> {
    const inputValue = event.target.value;

    // Si está vacío, no hacer nada (esperar a que termine de escribir)
    if (inputValue === '' || inputValue === null || inputValue === undefined) {
      return;
    }

    let newQuantity = parseInt(inputValue, 10);

    if (!Number.isFinite(newQuantity)) {
      newQuantity = 1;
    }

    if (newQuantity <= 0) {
      newQuantity = 1;
      event.target.value = 1;
    } else if (newQuantity > 99) {
      newQuantity = 99;
      event.target.value = 99;
    }

    await this.updateOfflineItemQuantity(item, newQuantity);
  }

  /**
   * Commit de input: en blur o Enter, si quedó vacío, forzar a 1
   */
  async commitOfflineQuantityInput(item: OfflineCartItem, event: any): Promise<void> {
    const inputValue = event.target.value;
    if (inputValue === '' || inputValue === null || inputValue === undefined) {
      event.target.value = 1;
      await this.updateOfflineItemQuantity(item, 1);
      return;
    }
    // Si no está vacío, aplicar mismas reglas de clamping del input
    await this.updateOfflineQuantityFromInput(item, event);
  }

  /**
   * Elimina un item del carrito offline
   */
  async removeOfflineItem(item: OfflineCartItem): Promise<void> {
    try {
      await this.offlineCartService.removeFromOfflineCart(item.id);
    } catch (error) {
      console.error('Error eliminando item offline:', error);
    }
  }

  /**
   * Limpia el carrito offline
   */
  async clearOfflineCart(): Promise<void> {
    try {
      await this.offlineCartService.clearOfflineCart();
    } catch (error) {
      console.error('Error limpiando carrito offline:', error);
    }
  }

  /**
   * Sincroniza el carrito offline con el online
   */
  async syncOfflineCart(): Promise<void> {
    try {
      await this.cartService.syncOfflineCartManually();
      // Mostrar mensaje de éxito
      const toast = await this.toastController.create({
        message: 'Carrito sincronizado exitosamente',
        duration: 2000,
        color: 'success',
        position: 'top'
      });
      await toast.present();
    } catch (error) {
      console.error('Error sincronizando carrito offline:', error);
      // Mostrar mensaje de error
      const toast = await this.toastController.create({
        message: 'Error al sincronizar el carrito',
        duration: 3000,
        color: 'danger',
        position: 'top'
      });
      await toast.present();
    }
  }

  /**
   * Verifica si un item es offline
   */
  isOfflineItem(item: CartItem | OfflineCartItem): item is OfflineCartItem {
    return 'is_offline' in item && item.is_offline === true;
  }
}
