import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, catchError, of, switchMap, map, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface OrderItem {
  product_id: number;
  product_variant_id?: number;
  quantity: number;
  unit_price?: number;
  total_price?: number;
  name?: string;
  image?: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone?: string;
}

export interface CreateOrderRequest {
  customer_id: number;
  items: OrderItem[];
  shipping_address: Address;
  billing_address?: Address;
  notes?: string;
  coupon_code?: string;
  payment_method?: string;
}

export interface Order {
  id: number;
  order_number: string;
  customer_id: number;
  customer?: {
    id: number;
    name: string;
    email: string;
    phone?: string;
  };
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  shipping_address: Address;
  billing_address: Address;
  items: Array<{
    id: number;
    product_id: number;
    product_variant_id?: number;
    quantity: number;
    unit_price: number;
    total_price: number;
    product?: {
      id: number;
      name: string;
      image?: string;
      slug?: string;
    };
    product_variant?: {
      id: number;
      name: string;
      price: number;
    };
  }>;
  subtotal: number;
  tax_amount: number;
  shipping_amount: number;
  discount_amount: number;
  total_amount: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderFilters {
  customer_id?: number;
  status?: string;
  payment_status?: string;
  date_from?: string;
  date_to?: string;
  total_min?: number;
  total_max?: number;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface OrderStats {
  total_orders: number;
  pending_orders: number;
  processing_orders: number;
  shipped_orders: number;
  delivered_orders: number;
  cancelled_orders: number;
  total_revenue: number;
  average_order_value: number;
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private readonly API_URL = environment.apiUrl;
  private ordersSubject = new BehaviorSubject<Order[]>([]);
  public orders$ = this.ordersSubject.asObservable();

  constructor(private http: HttpClient, private authService: AuthService) {}

  /**
   * Crear una nueva orden
   */
  createOrder(orderData: CreateOrderRequest): Observable<any> {
    return this.http.post(`${this.API_URL}/orders`, orderData);
    console.log('[ORDER SERVICE] Intentando enviar orden:', orderData);
    return this.http.post(`${this.API_URL}/orders`, orderData).pipe(
      tap((response) => {
        console.log('[ORDER SERVICE] Respuesta recibida:', response);
      }),
      catchError((error) => {
        console.error('[ORDER SERVICE] Error al enviar orden:', error);
        throw error;
      })
    );
  }

  /**
   * Obtener todas las órdenes con filtros opcionales
   */
  getOrders(filters?: OrderFilters): Observable<any> {
    let params = new HttpParams();

    if (filters) {
      Object.keys(filters).forEach(key => {
        const value = filters[key as keyof OrderFilters];
        if (value !== undefined && value !== null) {
          params = params.set(key, value.toString());
        }
      });
    }

    return this.http.get(`${this.API_URL}/orders`, { params });
  }

  /**
   * Obtener una orden específica por ID
   */
  getOrder(orderId: number): Observable<any> {
    const base = (this.API_URL || '').replace(/\/+$/, '');
    const primaryUrl = `${base}/orders/${orderId}`;
    const hasApiSuffix = /\/api$/i.test(base);
    const altBase = hasApiSuffix ? base.replace(/\/api$/i, '') : `${base}/api`;
    const altUrl = `${altBase}/orders/${orderId}`;

    const currentUser: any = this.authService.getCurrentUserValue();
    const userId: number | null = (currentUser?.id ?? null);
    const customerId: number | null = (currentUser?.customer_id
      || currentUser?.customer?.id
      || currentUser?.profile?.customer_id
      || null);

    // Intento principal: /orders/:id
    return this.http.get(primaryUrl).pipe(
      catchError(() => {
        // Fallback 1: alt base /api/orders/:id (o viceversa)
        return this.http.get(altUrl).pipe(
          catchError(() => {
            // Fallback 2: si hay customerId, intentar /customers/{id}/orders/{orderId}
            if (customerId) {
              const custPrimary = `${base}/customers/${customerId}/orders/${orderId}`;
              const custAlt = `${altBase}/customers/${customerId}/orders/${orderId}`;
              return this.http.get(custPrimary).pipe(
                catchError(() => this.http.get(custAlt))
              );
            }
            // Fallback 3: si hay userId, intentar /users/{id}/orders/{orderId}
            if (userId) {
              const userPrimary = `${base}/users/${userId}/orders/${orderId}`;
              const userAlt = `${altBase}/users/${userId}/orders/${orderId}`;
              return this.http.get(userPrimary).pipe(
                catchError(() => this.http.get(userAlt))
              );
            }
            // Fallback final: listar últimas órdenes del usuario y buscar la id
            if (userId) {
              // Silenciar logs en fallback
              return this.getUserOrders(userId, { per_page: 50, sort_by: 'created_at', sort_order: 'desc' }).pipe(
                map((resp: any) => {
                  try {
                    const ordersData = resp?.data?.orders || resp?.data || resp;
                    const list = Array.isArray(ordersData?.data) ? ordersData.data : Array.isArray(ordersData) ? ordersData : [];
                    const found = list.find((o: any) => (o?.id === orderId));
                    return found ? { success: true, data: found } : { success: false, data: null };
                  } catch {
                    return { success: false, data: null };
                  }
                }),
                catchError(() => of({ success: false, data: null }))
              );
            }
            // Si no hay más opciones, devolver fallo controlado
            return of({ success: false, message: 'No se pudo obtener la orden', data: null });
          })
        );
      })
    );
  }

  /**
   * Actualizar una orden
   */
  updateOrder(orderId: number, orderData: Partial<Order>): Observable<any> {
    return this.http.put(`${this.API_URL}/orders/${orderId}`, orderData);
  }

  /**
   * Cancelar una orden
   */
  cancelOrder(orderId: number): Observable<any> {
    return this.http.post(`${this.API_URL}/orders/${orderId}/cancel`, {});
  }

  /**
   * Marcar orden como entregada
   */
  markAsDelivered(orderId: number): Observable<any> {
    return this.http.post(`${this.API_URL}/orders/${orderId}/deliver`, {});
  }

  /**
   * Cambiar estado de una orden
   */
  changeOrderStatus(orderId: number, status: string): Observable<any> {
    return this.http.post(`${this.API_URL}/orders/${orderId}/status`, { status });
  }

  /**
   * Obtener órdenes de un cliente específico
   */
  getCustomerOrders(customerId: number, filters?: OrderFilters): Observable<any> {
    let params = new HttpParams();

    if (filters) {
      Object.keys(filters).forEach(key => {
        const value = filters[key as keyof OrderFilters];
        if (value !== undefined && value !== null) {
          params = params.set(key, value.toString());
        }
      });
    }

    return this.http.get(`${this.API_URL}/customers/${customerId}/orders`, { params });
  }

  /**
   * Obtener órdenes por user_id (para el frontend)
   */
  getUserOrders(userId: number, filters?: OrderFilters): Observable<any> {
    // Evitar llamadas si no hay sesión
    if (!this.authService.isAuthenticated()) {
      return of({ success: true, data: { orders: { data: [], total: 0, per_page: filters?.per_page || 10, current_page: 1 } } });
    }
    let params = new HttpParams();

    if (filters) {
      Object.keys(filters).forEach(key => {
        const value = filters[key as keyof OrderFilters];
        if (value !== undefined && value !== null) {
          params = params.set(key, value.toString());
        }
      });
    }

    // Si el usuario autenticado tiene un customer_id asociado, preferir el endpoint de customers
    const currentUser: any = this.authService.getCurrentUserValue();
    const customerId: number | null = (currentUser?.customer_id
      || currentUser?.customer?.id
      || currentUser?.profile?.customer_id
      || null);

    if (customerId) {
      return this.http.get(`${this.API_URL}/customers/${customerId}/orders`, { params }).pipe(
        catchError(err => {
          if (err?.status === 401) {
            return of({ success: true, data: { orders: { data: [], total: 0, per_page: Number(params.get('per_page')) || 10, current_page: Number(params.get('page')) || 1 } } });
          }
          // Fallback al endpoint por usuario si el de customer falla por compatibilidad
          return this.http.get(`${this.API_URL}/users/${userId}/orders`, { params }).pipe(
            catchError(innerErr => {
              if (innerErr?.status === 401) {
                return of({ success: true, data: { orders: { data: [], total: 0, per_page: Number(params.get('per_page')) || 10, current_page: Number(params.get('page')) || 1 } } });
              }
              return of({ success: false, data: { orders: { data: [] } } });
            })
          );
        })
      );
    }

    // Fallback por defecto: endpoint por usuario
    return this.http.get(`${this.API_URL}/users/${userId}/orders`, { params }).pipe(
      catchError(err => {
        if (err?.status === 401) {
          return of({ success: true, data: { orders: { data: [], total: 0, per_page: Number(params.get('per_page')) || 10, current_page: Number(params.get('page')) || 1 } } });
        }
        return of({ success: false, data: { orders: { data: [] } } });
      })
    );
  }

  /**
   * Obtener estadísticas de órdenes
   */
  getOrderStats(): Observable<{ success: boolean; data: OrderStats }> {
    return this.http.get<{ success: boolean; data: OrderStats }>(`${this.API_URL}/orders/stats`);
  }

  /**
   * Eliminar una orden
   */
  deleteOrder(orderId: number): Observable<any> {
    return this.http.delete(`${this.API_URL}/orders/${orderId}`);
  }

  /**
   * Crear orden desde el carrito
   */
  createOrderFromCart(cartItems: any[], customerId: number, addresses: { shipping: Address; billing?: Address }, notes?: string): Observable<any> {
    const orderData: CreateOrderRequest = {
      customer_id: customerId,
      items: cartItems.map(item => ({
        product_id: item.product_id,
        product_variant_id: item.product_variant_id,
        quantity: item.quantity
      })),
      shipping_address: addresses.shipping,
      billing_address: addresses.billing,
      notes: notes
    };

    return this.createOrder(orderData);
  }

  /**
   * Calcular totales de la orden
   */
  calculateOrderTotals(items: OrderItem[], shippingAmount: number = 0, taxRate: number = 0.16, discountAmount: number = 0): {
    subtotal: number;
    tax_amount: number;
    shipping_amount: number;
    discount_amount: number;
    total: number;
  } {
    const subtotal = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
    const tax_amount = subtotal * taxRate;
    const shipping_amount = shippingAmount;
    const discount_amount = discountAmount;
    const total = subtotal + tax_amount + shipping_amount - discount_amount;

    return {
      subtotal,
      tax_amount,
      shipping_amount,
      discount_amount,
      total
    };
  }

  /**
   * Validar datos de la orden antes de enviar
   */
  validateOrderData(orderData: CreateOrderRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!orderData.customer_id) {
      errors.push('ID del cliente es requerido');
    }

    if (!orderData.items || orderData.items.length === 0) {
      errors.push('La orden debe tener al menos un producto');
    }

    if (!orderData.shipping_address) {
      errors.push('Dirección de envío es requerida');
    } else {
      const shipping = orderData.shipping_address;
      if (!shipping.street) errors.push('Calle de envío es requerida');
      if (!shipping.city) errors.push('Ciudad de envío es requerida');
      if (!shipping.state) errors.push('Estado de envío es requerido');
      if (!shipping.postal_code) errors.push('Código postal de envío es requerido');
      if (!shipping.country) errors.push('País de envío es requerido');
    }

    orderData.items.forEach((item, index) => {
      if (!item.product_id) {
        errors.push(`Producto ${index + 1}: ID del producto es requerido`);
      }
      if (!item.quantity || item.quantity <= 0) {
        errors.push(`Producto ${index + 1}: Cantidad debe ser mayor a 0`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Obtener estado de la orden en español
   */
  getOrderStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      'pending': 'Pendiente',
      'processing': 'Procesando',
      'shipped': 'Enviado',
      'delivered': 'Entregado',
      'cancelled': 'Cancelado'
    };
    return statusMap[status] || status;
  }

  /**
   * Obtener estado de pago en español
   */
  getPaymentStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      'pending': 'Pendiente',
      'paid': 'Pagado',
      'failed': 'Fallido',
      'refunded': 'Reembolsado'
    };
    return statusMap[status] || status;
  }

  /**
   * Actualizar lista local de órdenes
   */
  updateOrdersList(orders: Order[]): void {
    this.ordersSubject.next(orders);
  }

  /**
   * Agregar orden a la lista local
   */
  addOrderToList(order: Order): void {
    const currentOrders = this.ordersSubject.value;
    this.ordersSubject.next([order, ...currentOrders]);
  }

  /**
   * Actualizar orden en la lista local
   */
  updateOrderInList(updatedOrder: Order): void {
    const currentOrders = this.ordersSubject.value;
    const index = currentOrders.findIndex(order => order.id === updatedOrder.id);
    if (index !== -1) {
      currentOrders[index] = updatedOrder;
      this.ordersSubject.next([...currentOrders]);
    }
  }

  /**
   * Remover orden de la lista local
   */
  removeOrderFromList(orderId: number): void {
    const currentOrders = this.ordersSubject.value;
    const filteredOrders = currentOrders.filter(order => order.id !== orderId);
    this.ordersSubject.next(filteredOrders);
  }
}
