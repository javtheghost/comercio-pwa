import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyPipe } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardContent, IonItem, IonLabel, IonButton, IonIcon, IonList, IonThumbnail, IonSpinner, IonText } from '@ionic/angular/standalone';
import { CartService, Cart, CartItem } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardContent, IonItem, IonLabel, IonButton, IonIcon, IonList, IonThumbnail, IonSpinner, IonText],
  templateUrl: './cart.page.html',
  styleUrls: ['./cart.page.scss']
})
export class CartPage implements OnInit, OnDestroy {
  get isAnyQuantityLoading(): boolean {
    if (!this.cart || !this.cart.items) return false;
    return this.cart.items.some((i: CartItem) => !!this.quantityLoading[i.id]);
  }
  cart: Cart | null = null;
  loading = false;
  error: string | null = null;
  quantityLoading: { [itemId: number]: boolean } = {};
  private cartSubscription: Subscription = new Subscription();

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
  }


  ngOnDestroy() {
    this.cartSubscription.unsubscribe();
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
        // Forzar la detección de cambios
        this.cdr.detectChanges();
      }
    });
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
    if (this.quantityLoading[item.id]) return;
    const newQuantity = item.quantity + 1;
    this.quantityLoading[item.id] = true;
    this.optimisticUpdateQuantity(item, newQuantity, () => {
      this.quantityLoading[item.id] = false;
      this.cdr.detectChanges();
    });
  }

  /**
   * Disminuye la cantidad de un item
   */
  decreaseQuantity(item: CartItem): void {
    if (item.quantity > 1 && !this.quantityLoading[item.id]) {
      const newQuantity = item.quantity - 1;
      this.quantityLoading[item.id] = true;
      this.optimisticUpdateQuantity(item, newQuantity, () => {
        this.quantityLoading[item.id] = false;
        this.cdr.detectChanges();
      });
    }
  }

  /**
   * Actualización optimista de cantidad: actualiza la UI al instante y revierte si falla
   */
  private optimisticUpdateQuantity(item: CartItem, newQuantity: number, done?: () => void): void {
    if (!this.cart) return;
    const prevQuantity = item.quantity;
    // Actualiza la UI localmente
    item.quantity = newQuantity;
    // Actualiza el total del item y del carrito localmente
    const prevTotal = item.total_price;
    const unitPrice = parseFloat(item.unit_price);
    item.total_price = (unitPrice * newQuantity).toFixed(2);
    // Actualiza el subtotal y total del carrito localmente
    const prevCartSubtotal = this.cart.subtotal;
    const prevCartTotal = this.cart.total;
    const subtotal = this.cart.items.reduce((sum, it) => sum + (it.id === item.id ? unitPrice * newQuantity : unitPrice * it.quantity), 0);
    this.cart.subtotal = subtotal.toFixed(2);
    this.cart.total = subtotal.toFixed(2); // Si tienes descuentos/impuestos, ajusta aquí
    this.cdr.detectChanges();

    this.cartService.updateItemQuantity(item.id, { quantity: newQuantity }).subscribe({
      next: (cart) => {
        // El backend responde, el observable de cart$ actualizará el carrito real
        if (done) done();
      },
      error: (error) => {
        // Si falla, revierte los cambios locales
        item.quantity = prevQuantity;
        item.total_price = prevTotal;
        this.cart!.subtotal = prevCartSubtotal;
        this.cart!.total = prevCartTotal;
        this.error = 'No se pudo actualizar la cantidad. Intenta de nuevo.';
        this.cdr.detectChanges();
        if (done) done();
      }
    });
  // <- aquí estaba la llave extra
  }

  /**
   * Actualiza la cantidad de un item
   */
  updateQuantity(item: CartItem, event: any): void {
    const newQuantity = parseInt(event.target.value);
    if (newQuantity && newQuantity > 0 && newQuantity <= 99) {
      this.updateItemQuantity(item, newQuantity);
    } else if (newQuantity <= 0) {
      this.updateItemQuantity(item, 1);
    }
  }

  /**
   * Actualiza la cantidad de un item en el servidor
   */
  private updateItemQuantity(item: CartItem, quantity: number): void {
    this.cartService.updateItemQuantity(item.id, { quantity }).subscribe({
      next: (cart) => {
        console.log('Cantidad actualizada:', cart);
        this.cdr.detectChanges(); // Forzar detección de cambios
      },
      error: (error) => {
        console.error('Error actualizando cantidad:', error);
        this.error = 'Error al actualizar la cantidad';
        // Recargar el carrito para mantener consistencia
        this.loadCart();
      }
    });
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
   * Obtiene el subtotal del carrito
   */
  getSubtotal(): number {
    return this.cart ? parseFloat(this.cart.subtotal) : 0;
  }

  /**
   * Obtiene el IVA del carrito
   */
  getVAT(): number {
    return this.cart ? parseFloat(this.cart.tax_amount) : 0;
  }

  /**
   * Obtiene el total del carrito
   */
  getTotal(): number {
    return this.cart ? parseFloat(this.cart.total) : 0;
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
      this.router.navigate(['/login'], {
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
