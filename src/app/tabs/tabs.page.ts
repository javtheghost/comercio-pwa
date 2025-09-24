import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { NavController } from '@ionic/angular';
import { IonIcon, IonRouterOutlet, IonBadge } from '@ionic/angular/standalone';
import { Subscription } from 'rxjs';
import { CartService, Cart } from '../services/cart.service';
import { NotificationService } from '../services/notification.service';
import { AuthService } from '../services/auth.service';
import { TabNavigationService } from '../services/tab-navigation.service';

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
  private tabNavSubscription: Subscription = new Subscription();
  private routerEventsSubscription: Subscription = new Subscription();
  private notificationsUpdateHandler?: () => void;

  constructor(
    private router: Router,
    private navCtrl: NavController,
    private cartService: CartService,
    private notificationService: NotificationService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private tabNavService: TabNavigationService
  ) {
    // Inicializar índice actual de forma robusta usando prefijo del URL
    const url = this.router.url || '';
    const foundIndex = this.tabOrder.findIndex(p => url.startsWith(p));
    this.currentTabIndex = foundIndex >= 0 ? foundIndex : 0;
  }

  ngOnInit() {
    this.subscribeToCart();
    this.subscribeToNotifications();
    this.tabNavSubscription = this.tabNavService.tabChange$.subscribe(path => {
      this.navigate(path);
    });

    // Sincronizar índice inicial y cambios de URL (por ejemplo, al venir desde Login)
    const setIndexFromUrl = (url: string) => {
      const foundIndex = this.tabOrder.findIndex(p => url.startsWith(p));
      if (foundIndex >= 0) {
        this.currentTabIndex = foundIndex;
      }
    };
    setIndexFromUrl(this.router.url || '');
    this.routerEventsSubscription = this.router.events.subscribe(ev => {
      if (ev instanceof NavigationEnd) {
        setIndexFromUrl(ev.urlAfterRedirects || ev.url);
      }
    });
  }

  ngOnDestroy() {
    this.cartSubscription.unsubscribe();
    this.notificationsSubscription.unsubscribe();
    this.tabNavSubscription.unsubscribe();
    this.routerEventsSubscription.unsubscribe();
    if (this.notificationsUpdateHandler) {
      window.removeEventListener('notifications:updated', this.notificationsUpdateHandler);
    }
  }

  private subscribeToCart(): void {
    // Suscribirse al contador total que incluye online + offline
    this.cartSubscription = this.cartService.totalCartItemsCount$.subscribe(count => {
      this.cartItemsCount = count;
      this.cdr.detectChanges(); // Forzar detección de cambios
      console.log('🛒 [TABS] Contador total actualizado (online + offline):', count);
    });
  }

  private subscribeToNotifications(): void {
    const computeUnread = () => {
      try {
        const raw = localStorage.getItem('user_notifications');
        const list = raw ? JSON.parse(raw) : [];
        const unread = Array.isArray(list) ? list.filter((n: any) => !n.read).length : 0;
        this.unreadNotificationsCount = unread;
      } catch {
        this.unreadNotificationsCount = 0;
      }
      this.cdr.detectChanges();
      console.log('🔔 [TABS] Contador de notificaciones no leídas:', this.unreadNotificationsCount);
    };

    // Recalcular en login/logout y forzar 0 si no autenticado
    this.notificationsSubscription = this.authService.authState$.subscribe(authState => {
      if (!authState.isAuthenticated) {
        this.unreadNotificationsCount = 0;
        this.cdr.detectChanges();
        console.log('🔔 [TABS] Usuario no logueado - Sin notificaciones');
      } else {
        computeUnread();
      }
    });

    // Recalcular cuando las notificaciones cambien en cualquier parte de la app
    this.notificationsUpdateHandler = computeUnread;
    window.addEventListener('notifications:updated', this.notificationsUpdateHandler);

    // Calcular al iniciar
    computeUnread();
  }

  navigate(path: string) {
    const newIndex = this.tabOrder.indexOf(path);
    let direction: 'forward' | 'back' = 'forward';
    if (newIndex > -1) {
      // Evitar inversión en el primer cambio post-login estableciendo una comparación segura
      if (newIndex === this.currentTabIndex) {
        direction = 'forward';
      } else {
        direction = newIndex > this.currentTabIndex ? 'forward' : 'back';
      }
      this.currentTabIndex = newIndex;
    }
    this.navCtrl.navigateRoot(path, { animationDirection: direction });
  }

  isActive(path: string): boolean {
    return this.router.url === path;
  }
}
