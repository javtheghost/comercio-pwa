import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardContent, IonItem, IonLabel, IonInput, IonButton, IonAvatar, IonSpinner, IonIcon, IonList, IonChip } from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { AddressService } from '../../services/address.service';
import { OrderService, Order } from '../../services/order.service';
import { User } from '../../interfaces/auth.interfaces';
import { Address } from '../../interfaces/address.interfaces';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardContent, IonItem, IonLabel, IonInput, IonButton, IonAvatar, IonSpinner, IonIcon, IonList, IonChip],
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss']
})
export class ProfilePage implements OnInit, OnDestroy {
  user: User | null = null;
  isAuthenticated = false;
  authLoading = false;

  // Direcciones
  addresses: Address[] = [];
  addressesLoading = false;
  addressesError: string | null = null;

  // Órdenes
  orders: Order[] = [];
  ordersLoading = false;
  ordersError: string | null = null;


  private authSubscription: Subscription = new Subscription();

  constructor(
    private authService: AuthService,
    private addressService: AddressService,
    private orderService: OrderService,
    public router: Router
  ) {}

  ngOnInit() {
    this.checkAuthState();

    // Suscribirse a cambios en el estado de autenticación
    this.authSubscription = this.authService.authState$.subscribe(authState => {
      this.isAuthenticated = authState.isAuthenticated;
      this.user = authState.user;
      this.authLoading = authState.loading;

      // Cargar direcciones y órdenes si el usuario está autenticado
      if (authState.isAuthenticated && authState.user) {
        this.loadAddresses();
        this.loadOrders();
      }
    });
  }

  ngOnDestroy() {
    this.authSubscription.unsubscribe();
  }

  private checkAuthState() {
    this.isAuthenticated = this.authService.isAuthenticated();
    this.user = this.authService.getCurrentUserValue();

    console.log('🔍 Estado de autenticación:', {
      isAuthenticated: this.isAuthenticated,
      user: this.user
    });
  }

  onLogin() {
    this.router.navigate(['/tabs/login']);
  }

  onRegister() {
    this.router.navigate(['/tabs/register']);
  }

  onLogout() {
    console.log('🚪 Iniciando proceso de logout...');

    this.authService.logout().subscribe({
      next: () => {
        console.log('✅ Logout exitoso');
        // El estado se actualiza automáticamente a través de authState$
        // No necesitamos redirigir, el componente se actualiza automáticamente
      },
      error: (error) => {
        console.error('❌ Error en logout:', error);
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

    this.addressesLoading = true;
    this.addressesError = null;

    try {
      const response = await this.addressService.getUserAddresses().toPromise();
      if (response && response.success) {
        this.addresses = response.data as Address[];
      } else {
        this.addressesError = response?.message || 'Error cargando direcciones';
      }
    } catch (error: any) {
      console.error('Error cargando direcciones:', error);
      this.addressesError = 'Error cargando las direcciones';
    } finally {
      this.addressesLoading = false;
    }
  }

  async deleteAddress(address: Address): Promise<void> {
    if (!address.id) return;

    try {
      const response = await this.addressService.deleteAddress(address.id).toPromise();
      if (response && response.success) {
        // Recargar la lista de direcciones
        await this.loadAddresses();
      }
    } catch (error: any) {
      console.error('Error eliminando dirección:', error);
    }
  }

  async setDefaultAddress(address: Address): Promise<void> {
    if (!address.id) return;

    try {
      const response = await this.addressService.setDefaultAddress(address.id).toPromise();
      if (response && response.success) {
        // Recargar la lista de direcciones
        await this.loadAddresses();
      }
    } catch (error: any) {
      console.error('Error estableciendo dirección predeterminada:', error);
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

    this.ordersLoading = true;
    this.ordersError = null;

    try {
      const response = await this.orderService.getUserOrders(this.user.id, {
        per_page: 10,
        sort_by: 'created_at',
        sort_order: 'desc'
      }).toPromise();

      if (response && response.success) {
        // La API devuelve { data: { customer: {...}, orders: {...} } }
        const ordersData = response.data?.orders;
        if (ordersData && ordersData.data) {
          // Si es paginado, tomar los datos
          this.orders = ordersData.data;
        } else if (Array.isArray(ordersData)) {
          // Si es un array directo
          this.orders = ordersData;
        } else {
          this.orders = [];
        }
      } else {
        this.ordersError = response?.message || 'Error cargando órdenes';
      }
    } catch (error: any) {
      console.error('Error cargando órdenes:', error);
      this.ordersError = 'Error cargando las órdenes';
    } finally {
      this.ordersLoading = false;
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

}
