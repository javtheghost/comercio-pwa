import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
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
