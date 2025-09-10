import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { NavController } from '@ionic/angular';
import { IonIcon, IonRouterOutlet, IonBadge } from '@ionic/angular/standalone';
import { Subscription } from 'rxjs';
import { CartService, Cart } from '../services/cart.service';
import { NotificationService } from '../services/notification.service';

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
      <button (click)="navigate('/tabs/notifications')" [class.active]="isActive('/tabs/notifications')" class="notifications-button">
        <div class="notifications-icon-container">
          <ion-icon name="notifications-outline"></ion-icon>
          @if (unreadNotificationsCount > 0) {
            <ion-badge color="danger" class="notifications-badge">{{ unreadNotificationsCount }}</ion-badge>
          }
        </div>
        <span>Notificaciones</span>
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
  tabOrder = ['/tabs/home', '/tabs/search', '/tabs/notifications', '/tabs/cart', '/tabs/profile'];
  currentTabIndex = 0;
  cartItemsCount = 0;
  unreadNotificationsCount = 0;
  private cartSubscription: Subscription = new Subscription();
  private notificationsSubscription: Subscription = new Subscription();

  constructor(
    private router: Router,
    private navCtrl: NavController,
    private cartService: CartService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {
    this.currentTabIndex = this.tabOrder.indexOf(this.router.url);
  }

  ngOnInit() {
    this.subscribeToCart();
    this.subscribeToNotifications();
  }

  ngOnDestroy() {
    this.cartSubscription.unsubscribe();
    this.notificationsSubscription.unsubscribe();
  }

  private subscribeToCart(): void {
    this.cartSubscription = this.cartService.cartItemsCount$.subscribe(count => {
      this.cartItemsCount = count;
      this.cdr.detectChanges(); // Forzar detección de cambios
      console.log('🛒 [TABS] Contador actualizado:', count);
    });
  }

  private subscribeToNotifications(): void {
    // Por ahora, simular notificaciones no leídas
    // En el futuro, esto vendrá del servicio de notificaciones
    this.notificationsSubscription = this.notificationService.token$.subscribe(token => {
      // Simular contador de notificaciones no leídas
      // En producción, esto vendría de una API
      this.unreadNotificationsCount = Math.floor(Math.random() * 5); // Simular 0-4 notificaciones
      this.cdr.detectChanges();
      console.log('🔔 [TABS] Contador de notificaciones actualizado:', this.unreadNotificationsCount);
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
