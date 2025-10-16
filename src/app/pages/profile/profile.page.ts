import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardContent, IonItem, IonLabel, IonInput, IonButton, IonAvatar, IonSpinner, IonIcon, IonList, IonChip, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { AddressService } from '../../services/address.service';
import { OrderService, Order } from '../../services/order.service';
import { User } from '../../interfaces/auth.interfaces';
import { Address } from '../../interfaces/address.interfaces';
import { Subscription, firstValueFrom } from 'rxjs';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardContent, IonItem, IonLabel, IonInput, IonButton, IonAvatar, IonSpinner, IonIcon, IonList, IonChip, IonRefresher, IonRefresherContent],
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss']
})
export class ProfilePage implements OnInit, OnDestroy {
  user: User | null = null;
  isAuthenticated = false;
  authLoading = false;
  private wasAuthenticated = false; // track transition to avoid reloads while logging out

  // Direcciones
  addresses: Address[] = [];
  addressesLoading = false;
  addressesError: string | null = null;

  // Órdenes
  orders: Order[] = [];
  ordersLoading = false;
  ordersError: string | null = null;
  // Estado UI para evitar spam de envío de notificación de prueba
  isSendingTest = false;


  private authSubscription: Subscription = new Subscription();
  private addressesStreamSub?: Subscription;
  private ordersStreamSub?: Subscription;

  constructor(
    private authService: AuthService,
    private addressService: AddressService,
    private orderService: OrderService,
    private notificationService: NotificationService,
    public router: Router,
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.checkAuthState();

    // Suscribirse a cambios en el estado de autenticación
    this.authSubscription = this.authService.authState$.subscribe(authState => {
      this.isAuthenticated = authState.isAuthenticated;
      this.user = authState.user;
      this.authLoading = authState.loading;

      // Cargar direcciones y órdenes SOLO cuando se pasa de no autenticado -> autenticado
      if (authState.isAuthenticated && authState.user) {
        if (!this.wasAuthenticated) {
          this.loadAddresses();
          this.loadOrders();
        }
        this.wasAuthenticated = true;
        // Stream de direcciones: refleja cambios en tiempo real (crear/editar/eliminar)
        if (!this.addressesStreamSub || this.addressesStreamSub.closed) {
          this.addressesStreamSub = this.addressService.addresses$.subscribe(list => {
            // Ejecutar dentro de la zona de Angular para refrescar UI sin interacción
            (this as any).zone?.run?.(() => {
              this.addresses = Array.isArray(list) ? list : [];
              (this as any).cdr?.detectChanges?.();
            }) ?? (this.addresses = Array.isArray(list) ? list : []);
          });
        }
        if (!this.ordersStreamSub || this.ordersStreamSub.closed) {
          this.ordersStreamSub = this.orderService.orders$.subscribe(list => {
            this.zone.run(() => {
              this.orders = Array.isArray(list) ? list : [];
              this.cdr.detectChanges();
            });
          });
        }
      } else {
        this.wasAuthenticated = false;
        // Si NO está autenticado, limpiar y evitar cargas/errores ruidosos
        this.zone.run(() => {
          this.addresses = [];
          this.orders = [];
          this.addressesError = null;
          this.ordersError = null;
          this.addressesLoading = false;
          this.ordersLoading = false;
          this.cdr.detectChanges();
        });
        // Cancelar streams para no intentar actualizar mientras no hay sesión
        if (this.addressesStreamSub) { this.addressesStreamSub.unsubscribe(); this.addressesStreamSub = undefined; }
        if (this.ordersStreamSub) { this.ordersStreamSub.unsubscribe(); this.ordersStreamSub = undefined; }
      }
    });
  }

  // Nombre mostrado: usa first_name + last_name, si no, name, y como último recurso el email
  get displayName(): string {
    const u: any = this.user || {};
    const parts = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
    if (parts) return parts;
    if (u.name && typeof u.name === 'string' && u.name.trim()) return u.name.trim();
    return u.email || 'Usuario';
  }

  // Fecha "Miembro desde": creada con preferencia por created_at; alternativas por compatibilidad
  getMemberSince(): string {
    const u: any = this.user || {};
    const raw = u.created_at ?? u.createdAt ?? u.registered_at ?? u.registrationDate ?? u.joined_at ?? u.updated_at ?? u.updatedAt ?? null;
    const parsed = this.parseDateFlexible(raw);
    return parsed ? this.formatDate(parsed) : 'N/A';
  }

  private parseDateFlexible(val: any): string | undefined {
    if (!val && val !== 0) return undefined;
    // Si ya es string tipo ISO o fecha legible
    if (typeof val === 'string') {
      const s = val.trim();
      // Formato común de Laravel: 'YYYY-MM-DD HH:mm:ss' (sin 'T')
      const match = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?$/);
      if (match) {
        const iso = `${match[1]}T${match[2]}${match[3] || ''}Z`;
        const d1 = new Date(iso);
        if (!isNaN(d1.getTime())) return d1.toISOString();
      }
      // Intentar reemplazar espacio por 'T'
      const s2 = s.replace(' ', 'T');
      const d2 = new Date(s2);
      if (!isNaN(d2.getTime())) return d2.toISOString();
      // Intentar con 'Z' al final
      const s3 = /Z$/.test(s2) ? s2 : `${s2}Z`;
      const d3 = new Date(s3);
      if (!isNaN(d3.getTime())) return d3.toISOString();
      // Último intento directo
      const d = new Date(s);
      return isNaN(d.getTime()) ? undefined : d.toISOString();
    }
    // Si es número (timestamp en segundos o milisegundos)
    if (typeof val === 'number') {
      const ts = val > 1e12 ? val : val * 1000; // normalizar a ms
      const d = new Date(ts);
      return isNaN(d.getTime()) ? undefined : d.toISOString();
    }
    // Si es Date
    if (val instanceof Date) {
      return isNaN(val.getTime()) ? undefined : val.toISOString();
    }
    // Si viene anidado
    if (typeof val === 'object') {
      const maybe = val?.date || val?.$date || val?.iso || undefined;
      return this.parseDateFlexible(maybe);
    }
    return undefined;
  }

  ngOnDestroy() {
    this.authSubscription.unsubscribe();
    if (this.addressesStreamSub) this.addressesStreamSub.unsubscribe();
    if (this.ordersStreamSub) this.ordersStreamSub.unsubscribe();
  }

  private checkAuthState() {
    this.isAuthenticated = this.authService.isAuthenticated();
    this.user = this.authService.getCurrentUserValue();
  }

  onLogin() {
    this.router.navigate(['/tabs/login']);
  }

  onRegister() {
    this.router.navigate(['/tabs/register']);
  }

  onLogout() {
    this.authService.logout().subscribe({
      next: () => {
        // El estado se actualiza automáticamente a través de authState$
        // No necesitamos redirigir, el componente se actualiza automáticamente
      },
      error: (error) => {
        // Even if logout fails on server, local state is cleared
        // El usuario ya no está autenticado localmente
      }
    });
  }

  formatDate(dateString?: string): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  // Métodos para manejar direcciones
  async loadAddresses(): Promise<void> {
    if (!this.isAuthenticated) return;

    this.zone.run(() => {
      this.addressesLoading = true;
      this.addressesError = null;
      this.cdr.detectChanges();
    });

    try {
      const response = await firstValueFrom(this.addressService.getUserAddresses());
      this.zone.run(() => {
        if (response && response.success) {
          // NO sobrescribir directamente: la lógica de servicio ya deduplica.
          // Pero si la respuesta trae array, aplicamos una dedupe defensiva final.
          const incoming = Array.isArray(response.data) ? (response.data as Address[]) : [];
          this.addresses = this.mergeAndDedupeClient(this.addresses, incoming);
        } else {
          this.addressesError = response?.message || 'Error cargando direcciones';
          this.addresses = [];
        }
        this.cdr.detectChanges();
      });
    } catch (error: any) {
      // Silenciar cualquier error en consola: dejar datos vacíos
      this.zone.run(() => {
        this.addressesError = null;
        this.addresses = [];
        this.cdr.detectChanges();
      });
    } finally {
      this.zone.run(() => {
        this.addressesLoading = false;
        this.cdr.detectChanges();
      });
    }
  }

  // Dedupe final en el componente para evitar parpadeo si el backend trae duplicados
  private mergeAndDedupeClient(existing: Address[], incoming: Address[]): Address[] {
    const norm = (v: any) => (v||'').toString().normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
    const simplifyLine = (s: any) => norm(s).replace(/\b(num|numero|número|no)\.?\b/g,'').replace(/\s+/g,' ').trim();
    const sig = (a: Address) => [
      norm(a.first_name), norm(a.last_name), simplifyLine(a.address_line_1), simplifyLine(a.address_line_2),
      norm(a.city), norm(a.state), norm(a.postal_code), norm(a.country), norm(a.type), norm(a.phone)
    ].join('|');
    const map = new Map<string, Address>();
    const push = (a: Address) => {
      if (!a) return;
      const s = sig(a);
      if (!map.has(s)) { map.set(s, a); return; }
      const prev = map.get(s)!;
      // Resolver: preferir is_default y updated_at más reciente
      const updatedPrev = prev.updated_at || ''; const updatedCur = a.updated_at || '';
      const choose = () => {
        if (a.is_default && !prev.is_default) return a;
        if (a.is_default === prev.is_default) {
          if (updatedCur && updatedPrev && updatedCur !== updatedPrev) return updatedCur > updatedPrev ? a : prev;
          if (updatedCur && !updatedPrev) return a;
          if (!updatedCur && updatedPrev) return prev;
          if ((a.id||0) !== (prev.id||0)) return (a.id||0) > (prev.id||0) ? a : prev;
        }
        return prev;
      };
      map.set(s, choose());
    };
    [...existing, ...incoming].forEach(push);
    // Sólo una default final
    let defaultFound = false;
    const arr = Array.from(map.values()).map(a => {
      if (a.is_default) {
        if (!defaultFound) { defaultFound = true; return a; }
        return { ...a, is_default: false };
      }
      return a;
    });
    return arr;
  }

  async deleteAddress(address: Address): Promise<void> {
    if (!address.id) return;

    try {
      const response = await firstValueFrom(this.addressService.deleteAddress(address.id));
      if (response && response.success) {
        // Recargar la lista de direcciones
        await this.loadAddresses();
      }
    } catch (error: any) {
      // Silenciar errores de eliminación en consola
    }
  }

  async setDefaultAddress(address: Address): Promise<void> {
    if (!address.id) return;

    try {
      const response = await firstValueFrom(this.addressService.setDefaultAddress(address.id));
      if (response && response.success) {
        // Recargar la lista de direcciones
        await this.loadAddresses();
      }
    } catch (error: any) {
      // Silenciar errores en consola
    }
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

  formatAddress(address: Address): string {
    return this.addressService.formatAddress(address);
  }

  addNewAddress(): void {
    this.router.navigate(['/tabs/address']);
  }

  editAddress(address: Address): void {
    this.router.navigate(['/tabs/address', address.id]);
  }

  // Métodos para manejar órdenes
  async loadOrders(): Promise<void> {
    if (!this.isAuthenticated || !this.user) return;

    this.zone.run(() => {
      this.ordersLoading = true;
      this.ordersError = null;
      this.cdr.detectChanges();
    });

    try {
      const response = await firstValueFrom(this.orderService.getUserOrders(this.user.id, {
        per_page: 10,
        sort_by: 'created_at',
        sort_order: 'desc'
      }));

      this.zone.run(() => {
        if (response && response.success) {
          // La API devuelve { data: { customer: {...}, orders: {...} } }
          const ordersData = response.data?.orders;
          if (ordersData && ordersData.data) {
            // Si es paginado, tomar los datos
            this.orders = ordersData.data || [];
          } else if (Array.isArray(ordersData)) {
            // Si es un array directo
            this.orders = ordersData || [];
          } else {
            this.orders = [];
          }
        } else {
          this.ordersError = response?.message || 'Error cargando órdenes';
          this.orders = [];
        }
        this.cdr.detectChanges();
      });
    } catch (error: any) {
      // Silenciar cualquier error en consola: dejar datos vacíos
      this.zone.run(() => {
        this.ordersError = null;
        this.orders = [];
        this.cdr.detectChanges();
      });
    } finally {
      this.zone.run(() => {
        this.ordersLoading = false;
        this.cdr.detectChanges();
      });
    }
  }

  viewAllOrders(): void {
    this.router.navigate(['/tabs/orders']);
  }

  viewOrderDetails(order: Order): void {
    this.router.navigate(['/tabs/orders', order.id]);
  }

  getOrderStatusText(status: string): string {
    return this.orderService.getOrderStatusText(status);
  }

  getOrderStatusColor(status: string): string {
    const colorMap: { [key: string]: string } = {
      'pending': 'warning',
      'processing': 'primary',
      'shipped': 'secondary',
      'delivered': 'success',
      'cancelled': 'danger'
    };
    return colorMap[status] || 'medium';
  }

  formatOrderDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  formatCurrency(amount: number | undefined | null): string {
    if (amount === undefined || amount === null || isNaN(amount)) {
      return '$0.00';
    }
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  }

  // Método para probar notificaciones
  async testNotification(): Promise<void> {
    if (this.isSendingTest) return;
    this.isSendingTest = true;
    try {
      await this.notificationService.sendTestNotification();
    } catch (error) {
      // Silenciar errores de notificación en consola
    } finally {
      this.isSendingTest = false;
    }
  }

  /**
   * Maneja el pull-to-refresh nativo
   */
  async doRefresh(event: any): Promise<void> {
    try {
      // Recargar direcciones y órdenes
      await Promise.all([
        this.loadAddresses(),
        this.loadOrders()
      ]);
    } catch (error) {
      // Silenciar errores de refresh en consola
    } finally {
      // Completar el refresh
      event.target.complete();
    }
  }

}
