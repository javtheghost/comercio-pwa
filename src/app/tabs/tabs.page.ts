import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy, Input } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { NavController } from '@ionic/angular';
import { IonIcon, IonRouterOutlet, IonBadge } from '@ionic/angular/standalone';
import { CommonModule, NgIf } from '@angular/common';
import { Subscription } from 'rxjs';
import { CartService, Cart } from '../services/cart.service';
import { NotificationService } from '../services/notification.service';
import { AuthService } from '../services/auth.service';
import { TabNavigationService } from '../services/tab-navigation.service';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [IonIcon, IonRouterOutlet, IonBadge, CommonModule, NgIf],
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
          <ion-badge *ngIf="unreadNotificationsCount > 0" color="danger" class="notifications-badge">{{ unreadNotificationsCount }}</ion-badge>
        </div>
        <span>Notificaciones</span>
      </button>
      <button (click)="navigate('/tabs/cart')" [class.active]="isActive('/tabs/cart')" class="cart-button">
        <div class="cart-icon-container">
          <ion-icon name="cart-outline"></ion-icon>
          <ion-badge *ngIf="cartItemsCount > 0" color="danger" class="cart-badge">{{ cartItemsCount }}</ion-badge>
        </div>
        <span>Carrito</span>
      </button>
      <button (click)="navigate('/tabs/profile')" [class.active]="isActive('/tabs/profile')">
        <ion-icon name="person-outline"></ion-icon>
        <span>Cuenta</span>
      </button>
    </div>
  <ion-router-outlet *ngIf="!inline"></ion-router-outlet>
  `,
  styleUrls: ['./tabs.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TabsPage implements OnInit, OnDestroy {
  @Input() inline = false; // Cuando se usa embebido como barra, ocultar el router-outlet interno
  tabOrder = ['/tabs/home', '/tabs/search', '/tabs/notifications', '/tabs/cart', '/tabs/profile'];
  currentTabIndex = 0;
  cartItemsCount = 0;
  unreadNotificationsCount = 0;
  private cartSubscription: Subscription = new Subscription();
  private notificationsSubscription: Subscription = new Subscription();
  private tabNavSubscription: Subscription = new Subscription();
  private routerEventsSubscription: Subscription = new Subscription();
  private notificationsUpdateHandler?: () => void;
  private readonly NOTIF_PREFIX = 'notifications_';
  private currentUserId: number | 'guest' = 'guest';

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
      Promise.resolve().then(() => {
        this.cartItemsCount = count;
        this.cdr.markForCheck();
      });
      console.log('🛒 [TABS] Contador total actualizado (online + offline):', count);
    });
  }

  private subscribeToNotifications(): void {
    const computeUnread = () => {
      try {
        const key = `${this.NOTIF_PREFIX}${this.currentUserId}`;
        const raw = localStorage.getItem(key);
        const list = raw ? JSON.parse(raw) : [];
        const unread = Array.isArray(list) ? list.filter((n: any) => !n.read).length : 0;
        Promise.resolve().then(() => {
          this.unreadNotificationsCount = unread;
          this.cdr.markForCheck();
        });
      } catch {
        Promise.resolve().then(() => {
          this.unreadNotificationsCount = 0;
          this.cdr.markForCheck();
        });
      }
      console.log('🔔 [TABS] Contador de notificaciones no leídas:', this.unreadNotificationsCount);
    };

    // Recalcular en login/logout y forzar 0 si no autenticado
    this.notificationsSubscription = this.authService.authState$.subscribe(authState => {
      const newId = authState.isAuthenticated && authState.user && typeof (authState.user as any).id === 'number'
        ? (authState.user as any).id as number
        : 'guest';
      const changed = newId !== this.currentUserId;
      this.currentUserId = newId;

      if (!authState.isAuthenticated) {
        // Mantenemos notificaciones per-user; solo mostramos 0 si está desloguado
        Promise.resolve().then(() => {
          this.unreadNotificationsCount = 0;
          this.cdr.markForCheck();
        });
        console.log('🔔 [TABS] Usuario no logueado - Sin notificaciones');
      } else {
        // Si cambió de usuario, recomputar desde su clave correspondiente
        if (changed) {
          computeUnread();
        } else {
          computeUnread();
        }
      }
    });

    // Recalcular cuando las notificaciones cambien en cualquier parte de la app
    this.notificationsUpdateHandler = computeUnread;
    window.addEventListener('notifications:updated', this.notificationsUpdateHandler);

    // Calcular al iniciar
    computeUnread();
  }

  private scheduleCD() {
    // Evita ExpressionChanged... posponiendo el marcado a la microtarea siguiente
    Promise.resolve().then(() => this.cdr.markForCheck());
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
    // Corrección específica: si estamos en una ruta "profunda" (detalle de producto u orden) y el usuario pulsa Home,
    // queremos que la animación sea como regresar (back) aunque el índice de la pestaña siga la lógica normal.
    try {
      const currentUrl = this.router.url || '';
      const isDeepDetail = /\/tabs\/(product|orders)\//.test(currentUrl); // product/:id o orders/:id
      if (path === '/tabs/home' && isDeepDetail) {
        direction = 'back';
      }
    } catch {}
    // Aria/focus: si hay un elemento enfocado dentro de una vista que va a ocultarse, hacer blur
    try {
      (document.activeElement as HTMLElement)?.blur?.();
    } catch {}
    this.navCtrl.navigateRoot(path, { animationDirection: direction });
  }

  isActive(path: string): boolean {
    return this.router.url === path;
  }
}
