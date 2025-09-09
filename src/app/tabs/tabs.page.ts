import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { NavController } from '@ionic/angular';
import { IonIcon, IonRouterOutlet, IonBadge } from '@ionic/angular/standalone';
import { Subscription } from 'rxjs';
import { CartService, Cart } from '../services/cart.service';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [IonIcon, IonRouterOutlet, IonBadge],
  template: `
    <div class="custom-tab-bar">
      <button (click)="navigate('/tabs/home')" [class.active]="isActive('/tabs/home')">
        <ion-icon name="home-outline"></ion-icon>
        <span>Inicio</span>
      </button>
      <button (click)="navigate('/tabs/search')" [class.active]="isActive('/tabs/search')">
        <ion-icon name="search-outline"></ion-icon>
        <span>Buscar</span>
      </button>
      <button (click)="navigate('/tabs/orders')" [class.active]="isActive('/tabs/orders')">
        <ion-icon name="heart-outline"></ion-icon>
        <span>Guardados</span>
      </button>
      <button (click)="navigate('/tabs/cart')" [class.active]="isActive('/tabs/cart')" class="cart-button">
        <div class="cart-icon-container">
          <ion-icon name="cart-outline"></ion-icon>
          @if (cartItemsCount > 0) {
            <ion-badge color="danger" class="cart-badge">{{ cartItemsCount }}</ion-badge>
          }
        </div>
        <span>Carrito</span>
      </button>
      <button (click)="navigate('/tabs/profile')" [class.active]="isActive('/tabs/profile')">
        <ion-icon name="person-outline"></ion-icon>
        <span>Cuenta</span>
      </button>
    </div>
    <ion-router-outlet></ion-router-outlet>
  `,
  styleUrls: ['./tabs.page.scss']
})
export class TabsPage implements OnInit, OnDestroy {
  // Unificación de ambas ramas: incluir ambos paths en tabOrder
  tabOrder = ['/tabs/home', '/tabs/search', '/tabs/products', '/tabs/orders', '/tabs/cart', '/tabs/profile'];
  currentTabIndex = 0;
  cartItemsCount = 0;
  private cartSubscription: Subscription = new Subscription();

  constructor(
    private router: Router,
    private navCtrl: NavController,
    private cartService: CartService,
    private cdr: ChangeDetectorRef
  ) {
    this.currentTabIndex = this.tabOrder.indexOf(this.router.url);
  }

  ngOnInit() {
    this.subscribeToCart();
  }

  ngOnDestroy() {
    this.cartSubscription.unsubscribe();
  }

  private subscribeToCart(): void {
    this.cartSubscription = this.cartService.cartItemsCount$.subscribe(count => {
      this.cartItemsCount = count;
      this.cdr.detectChanges();
      console.log('🛒 [TABS] Contador actualizado:', count);
    });
  }

  navigate(path: string) {
    const newIndex = this.tabOrder.indexOf(path);
    let direction: 'forward' | 'back' = 'forward';
    if (newIndex > -1) {
      direction = newIndex > this.currentTabIndex ? 'forward' : 'back';
      this.currentTabIndex = newIndex;
    }
    this.navCtrl.navigateRoot(path, { animationDirection: direction });
  }

  isActive(path: string): boolean {
    return this.router.url === path;
  }
}
