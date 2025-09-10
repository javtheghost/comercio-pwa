import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription, Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardContent, IonItem, IonLabel, IonButton, IonIcon, IonList, IonThumbnail, IonSpinner, IonText } from '@ionic/angular/standalone';
import { CartService, Cart, CartItem } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CurrencyPipe, IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardContent, IonItem, IonLabel, IonButton, IonIcon, IonList, IonThumbnail, IonSpinner, IonText],
  templateUrl: './cart.page.html',
  styleUrls: ['./cart.page.scss']
})
export class CartPage implements OnInit, OnDestroy {
  cart: Cart | null = null;
  loading = false;
  error: string | null = null;
  private cartSubscription: Subscription = new Subscription();
  
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
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadCart();
    this.subscribeToCart();
    this.setupQuantityDebounce();
    this.setupInputDebounce();
  }

  ngOnDestroy() {
    this.cartSubscription.unsubscribe();
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

    const tax = subtotal * 0.16; // IVA 16%
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
    return this.cachedTotals.tax;
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
   * Verifica si el carrito está vacío
   */
  isCartEmpty(): boolean {
    return !this.cart || this.cart.items.length === 0;
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
    this.router.navigate(['/tabs/home']);
  }

  /**
   * Recarga el carrito
   */
  refreshCart(): void {
    this.loadCart();
  }
}
