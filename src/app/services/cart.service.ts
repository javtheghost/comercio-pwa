import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { map, catchError, tap, take } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { SecurityService } from './security.service';
import { OfflineCartService, OfflineCartItem } from './offline-cart.service';

export interface CartItem {
  id: number;
  product_id: number;
  product_variant_id?: number;
  product_name: string;
  product_image?: string;
  quantity: number;
  unit_price: string;
  total_price: string;
  selected_attributes?: any;
  custom_options?: any;
  notes?: string;
  is_available: boolean;
  available_stock: number;
}

export interface Cart {
  id: number;
  user_id?: number;
  session_id?: string;
  guest_email?: string;
  subtotal: string;
  tax_amount: string;
  discount_amount: string;
  shipping_amount: string;
  total: string;
  currency: string;
  items_count: number;
  applied_discounts?: any;
  expires_at: string;
  items: CartItem[];
}

export interface CartStats {
  items_count: number;
  subtotal: string;
  discount_amount: string;
  total: string;
  currency: string;
  has_discounts: boolean;
  is_empty: boolean;
  expires_at: string;
}

export interface AddToCartRequest {
  product_id: number;
  quantity: number;
  product_variant_id?: number;
  selected_attributes?: any;
  custom_options?: any;
  notes?: string;
}

export interface UpdateQuantityRequest {
  quantity: number;
}

export interface ApplyDiscountRequest {
  discount_code: string;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private baseUrl = environment.apiUrl;
  private sessionId: string = '';
  private guestEmail: string = '';

  // BehaviorSubject para manejar el estado del carrito
  private cartSubject = new BehaviorSubject<Cart | null>(null);
  public cart$ = this.cartSubject.asObservable();

  // BehaviorSubject para el contador de items del carrito
  private cartItemsCountSubject = new BehaviorSubject<number>(0);
  public cartItemsCount$ = this.cartItemsCountSubject.asObservable();

  constructor(
    private http: HttpClient,
    private securityService: SecurityService,
    private offlineCartService: OfflineCartService
  ) {
    this.initializeSession();
    this.setupEventListeners();

    // Esperar un poco antes de cargar el carrito inicial para asegurar que el token esté disponible
    setTimeout(() => {
      this.loadInitialCart();
    }, 100);
  }

  /**
   * Inicializa la sesión del carrito
   */
  private initializeSession(): void {
    // Generar o recuperar session_id
    this.sessionId = this.getOrCreateSessionId();
    console.log('🛒 [CART SERVICE] Session ID inicializado:', this.sessionId);
  }

  /**
   * Configura los event listeners para eventos de autenticación
   */
  private setupEventListeners(): void {
    console.log('🛒 [CART SERVICE] Configurando event listeners...');

    // Escuchar evento de login exitoso
    window.addEventListener('userLoggedIn', (event: any) => {
      console.log('🛒 [CART SERVICE] Evento de login recibido:', event.detail);
      this.handleUserLogin(event.detail);
    });

    // Escuchar evento de logout
    window.addEventListener('userLoggedOut', () => {
      console.log('🛒 [CART SERVICE] Evento de logout recibido');
      this.handleUserLogout();
    });

    console.log('✅ [CART SERVICE] Event listeners configurados correctamente');
  }

  /**
   * Maneja el evento de login del usuario
   */
  private handleUserLogin(loginData: { user: any, token: string }): void {
    console.log('🛒 [CART SERVICE] Procesando login del usuario:', loginData.user?.email);

    // Verificar si hay carrito de sesión
    const hasSessionCart = this.hasSessionCart();
    console.log('🛒 [CART SERVICE] ¿Hay carrito de sesión?', hasSessionCart);

    // Verificar si hay carrito offline
    const hasOfflineCart = this.offlineCartService.getCurrentOfflineCartItemsCount() > 0;
    console.log('🛒 [CART SERVICE] ¿Hay carrito offline?', hasOfflineCart);

    if (hasSessionCart) {
      console.log('🛒 [CART SERVICE] Iniciando fusión del carrito después del login...');
      console.log('🛒 [CART SERVICE] Session ID actual:', this.getSessionId());

      this.mergeSessionCart().subscribe({
        next: async (mergedCart) => {
          console.log('✅ [CART SERVICE] Carrito fusionado exitosamente después del login:', mergedCart);
          console.log('✅ [CART SERVICE] Items en el carrito fusionado:', mergedCart.items?.length || 0);

          // Actualizar el estado local inmediatamente
          this.cartSubject.next(mergedCart);
          this.updateCartItemsCount(mergedCart);

          // Si hay carrito offline, sincronizarlo también
          if (hasOfflineCart) {
            console.log('🔄 [CART SERVICE] Sincronizando carrito offline después de fusión de sesión...');
            try {
              await this.syncOfflineCart();
              console.log('✅ [CART SERVICE] Carrito offline sincronizado exitosamente');
            } catch (error) {
              console.error('❌ [CART SERVICE] Error sincronizando carrito offline:', error);
            }
          }

          // Emitir evento personalizado para notificar a otros componentes
          window.dispatchEvent(new CustomEvent('cartMerged', {
            detail: { cart: mergedCart }
          }));

          // No necesitamos recargar el carrito ya que el estado se actualizó correctamente
          console.log('✅ [CART SERVICE] Carrito fusionado y estado actualizado correctamente');
        },
        error: (error) => {
          console.error('❌ [CART SERVICE] Error fusionando carrito después del login:', error);
          console.error('❌ [CART SERVICE] Detalles del error:', error);

          // En caso de error, intentar cargar el carrito del usuario
          console.log('🛒 [CART SERVICE] Intentando cargar carrito del usuario como fallback...');
          this.getCart().subscribe({
            next: async (cart) => {
              console.log('✅ [CART SERVICE] Carrito del usuario cargado como fallback:', cart);

              // Si hay carrito offline, sincronizarlo también
              if (hasOfflineCart) {
                console.log('🔄 [CART SERVICE] Sincronizando carrito offline en fallback...');
                try {
                  await this.syncOfflineCart();
                  console.log('✅ [CART SERVICE] Carrito offline sincronizado en fallback');
                } catch (error) {
                  console.error('❌ [CART SERVICE] Error sincronizando carrito offline en fallback:', error);
                }
              }
            },
            error: (fallbackError) => {
              console.error('❌ [CART SERVICE] Error en fallback:', fallbackError);
            }
          });
        }
      });
    } else if (hasOfflineCart) {
      console.log('🛒 [CART SERVICE] No hay carrito de sesión, pero hay carrito offline');
      console.log('🛒 [CART SERVICE] Sincronizando carrito offline...');

      // Sincronizar carrito offline y luego cargar el carrito del usuario
      this.syncOfflineCart().then(() => {
        console.log('✅ [CART SERVICE] Carrito offline sincronizado, cargando carrito del usuario...');
        this.getCart().subscribe({
          next: (cart) => {
            console.log('✅ [CART SERVICE] Carrito del usuario cargado después de sincronización offline:', cart);
          },
          error: (error) => {
            console.error('❌ [CART SERVICE] Error cargando carrito del usuario después de sincronización:', error);
          }
        });
      }).catch((error) => {
        console.error('❌ [CART SERVICE] Error sincronizando carrito offline:', error);
        // Intentar cargar el carrito del usuario de todas formas
        this.getCart().subscribe({
          next: (cart) => {
            console.log('✅ [CART SERVICE] Carrito del usuario cargado después de error en sincronización:', cart);
          },
          error: (fallbackError) => {
            console.error('❌ [CART SERVICE] Error en fallback después de error de sincronización:', fallbackError);
          }
        });
      });
    } else {
      console.log('🛒 [CART SERVICE] No hay carrito de sesión ni offline para fusionar');
      console.log('🛒 [CART SERVICE] Cargando carrito del usuario...');

      // Si no hay carrito de sesión ni offline, cargar el carrito del usuario
      this.getCart().subscribe({
        next: (cart) => {
          console.log('✅ [CART SERVICE] Carrito del usuario cargado:', cart);
        },
        error: (error) => {
          console.error('❌ [CART SERVICE] Error cargando carrito del usuario:', error);
        }
      });
    }
  }

  /**
   * Maneja el evento de logout del usuario
   */
  private handleUserLogout(): void {
    console.log('🛒 [CART SERVICE] Limpiando sesión del carrito después del logout...');
    this.clearSession();
  }

  /**
   * Carga el carrito inicial al inicializar el servicio
   */
  private loadInitialCart(): void {
    console.log('🛒 [CART SERVICE] Cargando carrito inicial...');

    // Verificar si hay un token disponible antes de intentar cargar
    const token = this.securityService.getTokenSync();
    if (token) {
      console.log('🛒 [CART SERVICE] Token disponible, cargando carrito...');
    } else {
      console.log('🛒 [CART SERVICE] No hay token disponible, cargando como invitado...');
    }

    this.initializeSession();
    this.getCart().subscribe({
      next: (cart) => {
        console.log('🛒 [CART SERVICE] Carrito inicial cargado:', cart);
        this.updateCartItemsCount(cart);
      },
      error: (error) => {
        console.log('🛒 [CART SERVICE] No hay carrito inicial o error:', error);
        // No es crítico si no hay carrito inicial
      }
    });
  }

  /**
   * Actualiza el contador de items del carrito
   */
  private updateCartItemsCount(cart: Cart | null): void {
    if (cart && cart.items) {
      const count = cart.items.reduce((total, item) => total + item.quantity, 0);
      this.cartItemsCountSubject.next(count);
      console.log('🛒 [CART SERVICE] Contador actualizado:', count);
    } else {
      this.cartItemsCountSubject.next(0);
      console.log('🛒 [CART SERVICE] Contador reseteado a 0');
    }
  }

  /**
   * Obtiene o crea un session_id único
   */
  private getOrCreateSessionId(): string {
    let sessionId = localStorage.getItem('cart_session_id');
    if (!sessionId) {
      sessionId = 'cart_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('cart_session_id', sessionId);
    }
    return sessionId;
  }

  /**
   * Establece el email del invitado
   */
  setGuestEmail(email: string): void {
    this.guestEmail = email;
    localStorage.setItem('guest_email', email);
  }

  /**
   * Obtiene el email del invitado
   */
  getGuestEmail(): string {
    if (!this.guestEmail) {
      this.guestEmail = localStorage.getItem('guest_email') || '';
    }
    return this.guestEmail;
  }

  /**
   * Obtiene los headers necesarios para las peticiones del carrito
   */
  private async getHeaders(): Promise<HttpHeaders> {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });

    // Verificar si el usuario está autenticado
    const token = this.securityService.getTokenSync();
    if (token) {
      console.log('🛒 [CART SERVICE] Usuario autenticado - el interceptor manejará el token');
      // El interceptor se encarga del token de autenticación
    } else {
      // Solo enviar session_id si no hay token de autenticación (usuario invitado)
      if (this.sessionId) {
        headers = headers.set('X-Session-ID', this.sessionId);
        console.log('🛒 [CART SERVICE] Session ID agregado a headers (usuario invitado)');
      }
      console.log('🛒 [CART SERVICE] No hay token de autenticación disponible');
    }

    const guestEmail = this.getGuestEmail();
    if (guestEmail) {
      headers = headers.set('X-Guest-Email', guestEmail);
    }

    return headers;
  }

  /**
   * Obtiene el carrito actual
   */
  getCart(): Observable<Cart> {
    console.log('🛒 [CART SERVICE] ===== OBTENIENDO CARRITO =====');

    // Debug: Verificar estado de autenticación
    const token = this.securityService.getTokenSync();
    console.log('🛒 [CART SERVICE] Token disponible:', token ? 'SÍ' : 'NO');
    if (token) {
      console.log('🛒 [CART SERVICE] Token (primeros 50 chars):', token.substring(0, 50) + '...');
    }
    console.log('🛒 [CART SERVICE] Session ID:', this.sessionId);

    return new Observable<Cart>(observer => {
      this.getHeaders().then(headers => {
        console.log('🛒 [CART SERVICE] Headers finales:', headers.keys());
        console.log('🛒 [CART SERVICE] Authorization header:', headers.get('Authorization'));
        console.log('🛒 [CART SERVICE] X-Session-ID header:', headers.get('X-Session-ID'));

        this.http.get<{success: boolean, data: Cart}>(`${this.baseUrl}/cart/`, {
          headers: headers,
          withCredentials: true
        }).pipe(
          map(response => {
            console.log('🛒 [CART SERVICE] Carrito obtenido:', response.data);
            this.cartSubject.next(response.data);
            this.updateCartItemsCount(response.data);
            return response.data;
          }),
          catchError(error => {
            console.error('❌ [CART SERVICE] Error obteniendo carrito:', error);
            console.error('❌ [CART SERVICE] Error completo:', error);
            return throwError(() => error);
          })
        ).subscribe(observer);
      }).catch(error => {
        console.error('❌ [CART SERVICE] Error obteniendo headers:', error);
        observer.error(error);
      });
    });
  }

  /**
   * Agrega un producto al carrito
   */
  addToCart(request: AddToCartRequest): Observable<Cart> {
    console.log('🛒 [CART SERVICE] Agregando al carrito:', request);

    return new Observable<Cart>(observer => {
      this.getHeaders().then(headers => {
        this.http.post<{success: boolean, message: string, data: Cart}>(`${this.baseUrl}/cart/add-item`, request, {
          headers: headers,
          withCredentials: true
        }).pipe(
          map(response => {
            console.log('🛒 [CART SERVICE] Producto agregado:', response.data);
            this.cartSubject.next(response.data);
            this.updateCartItemsCount(response.data);
            return response.data;
          }),
          catchError(error => {
            console.error('❌ [CART SERVICE] Error agregando al carrito:', error);
            return throwError(() => error);
          })
        ).subscribe(observer);
      }).catch(error => {
        console.error('❌ [CART SERVICE] Error obteniendo headers:', error);
        observer.error(error);
      });
    });
  }

  /**
   * Actualiza la cantidad de un item en el carrito
   */
  updateItemQuantity(cartItemId: number, request: UpdateQuantityRequest): Observable<Cart> {
    console.log('🛒 [CART SERVICE] Actualizando cantidad:', cartItemId, request);

    return new Observable<Cart>(observer => {
      this.getHeaders().then(headers => {
        this.http.put<{success: boolean, data: Cart}>(`${this.baseUrl}/cart/items/${cartItemId}/quantity`, request, {
          headers: headers,
          withCredentials: true
        }).pipe(
          map(response => {
            console.log('🛒 [CART SERVICE] Cantidad actualizada:', response.data);
            this.cartSubject.next(response.data);
            this.updateCartItemsCount(response.data);
            return response.data;
          }),
          catchError(error => {
            console.error('❌ [CART SERVICE] Error actualizando cantidad:', error);
            return throwError(() => error);
          })
        ).subscribe(observer);
      }).catch(error => {
        console.error('❌ [CART SERVICE] Error obteniendo headers:', error);
        observer.error(error);
      });
    });
  }

  /**
   * Elimina un item del carrito
   */
  removeItem(cartItemId: number): Observable<Cart> {
    console.log('🛒 [CART SERVICE] Eliminando item:', cartItemId);

    return new Observable<Cart>(observer => {
      this.getHeaders().then(headers => {
        this.http.delete<{success: boolean, data: Cart}>(`${this.baseUrl}/cart/items/${cartItemId}`, {
          headers: headers,
          withCredentials: true
        }).pipe(
          map(response => {
            console.log('🛒 [CART SERVICE] Item eliminado:', response.data);
            this.cartSubject.next(response.data);
            this.updateCartItemsCount(response.data);
            return response.data;
          }),
          catchError(error => {
            console.error('❌ [CART SERVICE] Error eliminando item:', error);
            return throwError(() => error);
          })
        ).subscribe(observer);
      }).catch(error => {
        console.error('❌ [CART SERVICE] Error obteniendo headers:', error);
        observer.error(error);
      });
    });
  }

  /**
   * Limpia todo el carrito
   */
  clearCart(): Observable<Cart> {
    console.log('🛒 [CART SERVICE] Limpiando carrito...');

    return new Observable<Cart>(observer => {
      this.getHeaders().then(headers => {
        this.http.post<{success: boolean, message: string, data: Cart}>(`${this.baseUrl}/cart/clear`, {}, {
          headers: headers,
          withCredentials: true
        }).pipe(
          map(response => {
            console.log('🛒 [CART SERVICE] Carrito limpiado:', response.data);
            this.cartSubject.next(response.data);
            this.updateCartItemsCount(response.data);
            return response.data;
          }),
          catchError(error => {
            console.error('❌ [CART SERVICE] Error limpiando carrito:', error);
            return throwError(() => error);
          })
        ).subscribe(observer);
      }).catch(error => {
        console.error('❌ [CART SERVICE] Error obteniendo headers:', error);
        observer.error(error);
      });
    });
  }

  /**
   * Aplica un descuento al carrito
   */
  applyDiscount(request: ApplyDiscountRequest): Observable<Cart> {
    console.log('🛒 [CART SERVICE] Aplicando descuento:', request);

    return new Observable<Cart>(observer => {
      this.getHeaders().then(headers => {
        this.http.post<{success: boolean, data: Cart}>(`${this.baseUrl}/cart/apply-discount`, request, {
          headers: headers,
          withCredentials: true
        }).pipe(
          map(response => {
            console.log('🛒 [CART SERVICE] Descuento aplicado:', response.data);
            this.cartSubject.next(response.data);
            return response.data;
          }),
          catchError(error => {
            console.error('❌ [CART SERVICE] Error aplicando descuento:', error);
            return throwError(() => error);
          })
        ).subscribe(observer);
      }).catch(error => {
        console.error('❌ [CART SERVICE] Error obteniendo headers:', error);
        observer.error(error);
      });
    });
  }

  /**
   * Obtiene estadísticas del carrito
   */
  getCartStats(): Observable<CartStats> {
    console.log('🛒 [CART SERVICE] Obteniendo estadísticas...');

    return new Observable<CartStats>(observer => {
      this.getHeaders().then(headers => {
        this.http.get<{success: boolean, data: CartStats}>(`${this.baseUrl}/cart/stats`, {
          headers: headers,
          withCredentials: true
        }).pipe(
          map(response => {
            console.log('🛒 [CART SERVICE] Estadísticas obtenidas:', response.data);
            return response.data;
          }),
          catchError(error => {
            console.error('❌ [CART SERVICE] Error obteniendo estadísticas:', error);
            return throwError(() => error);
          })
        ).subscribe(observer);
      }).catch(error => {
        console.error('❌ [CART SERVICE] Error obteniendo headers:', error);
        observer.error(error);
      });
    });
  }

  /**
   * Obtiene el carrito actual del BehaviorSubject
   */
  getCurrentCart(): Cart | null {
    return this.cartSubject.value;
  }

  /**
   * Refresca el carrito desde el servidor
   */
  refreshCart(): Observable<Cart> {
    return this.getCart();
  }

  /**
   * Refresca el carrito después de una fusión exitosa
   */
  refreshCartAfterMerge(): void {
    console.log('🛒 [CART SERVICE] Refrescando carrito después de fusión...');
    this.getCart().subscribe({
      next: (cart) => {
        console.log('🛒 [CART SERVICE] Carrito refrescado después de fusión:', cart);
        console.log('🛒 [CART SERVICE] Items en carrito refrescado:', cart.items?.length || 0);

        // Actualizar el estado local
        this.cartSubject.next(cart);
        this.updateCartItemsCount(cart);

        // Emitir evento de actualización
        window.dispatchEvent(new CustomEvent('cartRefreshed', {
          detail: { cart: cart }
        }));
      },
      error: (error) => {
        console.error('❌ [CART SERVICE] Error refrescando carrito después de fusión:', error);

        // En caso de error, intentar nuevamente después de un delay
        setTimeout(() => {
          console.log('🛒 [CART SERVICE] Reintentando refrescar carrito...');
          this.getCart().subscribe({
            next: (retryCart) => {
              console.log('✅ [CART SERVICE] Carrito refrescado en reintento:', retryCart);
              this.cartSubject.next(retryCart);
              this.updateCartItemsCount(retryCart);
            },
            error: (retryError) => {
              console.error('❌ [CART SERVICE] Error en reintento de refrescar carrito:', retryError);
            }
          });
        }, 2000);
      }
    });
  }

  /**
   * Obtiene el contador actual de items del carrito
   */
  getCurrentCartItemsCount(): number {
    return this.cartItemsCountSubject.value;
  }

  /**
   * Fusiona el carrito de sesión con el carrito del usuario autenticado
   */
  mergeSessionCart(): Observable<Cart> {
    console.log('🛒 [CART SERVICE] Fusionando carrito de sesión...');

    const sessionId = this.getOrCreateSessionId();
    console.log('🛒 [CART SERVICE] Session ID para fusión:', sessionId);

    return new Observable<Cart>(observer => {
      this.getHeaders().then(headers => {
        console.log('🛒 [CART SERVICE] Headers obtenidos, enviando petición de fusión...');

        this.http.post<{success: boolean, message: string, data: Cart}>(`${this.baseUrl}/cart/merge-session`, {
          session_id: sessionId
        }, {
          headers: headers,
          withCredentials: true
        }).pipe(
          map(response => {
            console.log('🛒 [CART SERVICE] Respuesta de fusión recibida:', response);

            if (response.success && response.data) {
              console.log('✅ [CART SERVICE] Carrito fusionado exitosamente:', response.data);
              console.log('✅ [CART SERVICE] Items en carrito fusionado:', response.data.items?.length || 0);

              // Actualizar el estado local inmediatamente
              this.cartSubject.next(response.data);
              this.updateCartItemsCount(response.data);

              // Limpiar la sesión local después de fusión exitosa
              this.clearSessionAfterMerge();

              return response.data;
            } else {
              console.error('❌ [CART SERVICE] Respuesta de fusión inválida:', response);
              throw new Error('Respuesta de fusión inválida del servidor');
            }
          }),
          catchError(error => {
            console.error('❌ [CART SERVICE] Error fusionando carrito:', error);
            console.error('❌ [CART SERVICE] Detalles del error:', {
              status: error.status,
              message: error.message,
              error: error.error
            });
            return throwError(() => error);
          })
        ).subscribe({
          next: (cart) => observer.next(cart),
          error: (error) => observer.error(error)
        });
      }).catch(error => {
        console.error('❌ [CART SERVICE] Error obteniendo headers para fusión:', error);
        observer.error(error);
      });
    });
  }

  /**
   * Verifica si hay un carrito de sesión pendiente de fusionar
   */
  hasSessionCart(): boolean {
    const sessionId = localStorage.getItem('cart_session_id');
    return !!sessionId;
  }

  /**
   * Obtiene el ID de sesión actual
   */
  getSessionId(): string {
    return this.getOrCreateSessionId();
  }

  /**
   * Verifica el estado actual del carrito y la sesión
   */
  getCartStatus(): {
    hasSessionCart: boolean;
    sessionId: string;
    currentCart: Cart | null;
    itemsCount: number;
  } {
    return {
      hasSessionCart: this.hasSessionCart(),
      sessionId: this.getSessionId(),
      currentCart: this.getCurrentCart(),
      itemsCount: this.getCurrentCartItemsCount()
    };
  }

  /**
   * Fuerza la fusión del carrito de sesión (método público para debugging)
   */
  forceMergeSessionCart(): Observable<Cart> {
    console.log('🛒 [CART SERVICE] Forzando fusión del carrito de sesión...');
    return this.mergeSessionCart();
  }

  /**
   * Limpia la sesión del carrito (útil para logout)
   */
  clearSession(): void {
    console.log('🧹 [CART SERVICE] Limpiando sesión del carrito...');

    // Limpiar datos del localStorage
    localStorage.removeItem('cart_session_id');
    localStorage.removeItem('guest_email');

    // Limpiar cualquier dato relacionado con el carrito
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith('cart_') ||
        key.includes('session') ||
        key.includes('guest')
      )) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log('🧹 [CART SERVICE] Removido:', key);
    });

    // Resetear variables internas
    this.sessionId = this.getOrCreateSessionId();
    this.guestEmail = '';

    // Limpiar estado del carrito
    this.cartSubject.next(null);
    this.cartItemsCountSubject.next(0);

    console.log('✅ [CART SERVICE] Sesión del carrito limpiada completamente');
  }

  /**
   * Limpia la sesión después de una fusión exitosa
   */
  private clearSessionAfterMerge(): void {
    console.log('🛒 [CART SERVICE] Limpiando sesión después de fusión exitosa...');
    localStorage.removeItem('cart_session_id');
    // No limpiar guest_email ya que puede ser útil mantenerlo

    // Después de la fusión, el usuario está autenticado, no necesitamos session_id
    // El backend manejará el carrito basado en el token de autenticación
    this.sessionId = '';
    console.log('✅ [CART SERVICE] Sesión limpiada después de fusión, sessionId reseteado');
  }

  /**
   * Sincroniza el carrito offline con el carrito online
   */
  async syncOfflineCart(): Promise<Cart> {
    console.log('🔄 [CART SERVICE] Iniciando sincronización del carrito offline...');

    try {
      // Obtener items del carrito offline
      const offlineItems = await this.offlineCartService.syncOfflineCartWithOnline();

      if (offlineItems.length === 0) {
        console.log('🔄 [CART SERVICE] No hay items offline para sincronizar');
        return this.getCurrentCart() || {} as Cart;
      }

      console.log('🔄 [CART SERVICE] Sincronizando', offlineItems.length, 'items offline...');

      // Agregar cada item offline al carrito online
      for (const offlineItem of offlineItems) {
        const addToCartRequest: AddToCartRequest = {
          product_id: offlineItem.product_id,
          quantity: offlineItem.quantity,
          product_variant_id: offlineItem.selected_attributes?.variant_id,
          selected_attributes: offlineItem.selected_attributes,
          custom_options: offlineItem.custom_options,
          notes: offlineItem.notes
        };

        try {
          await this.addToCart(addToCartRequest).pipe(take(1)).toPromise();
          console.log('✅ [CART SERVICE] Item sincronizado:', offlineItem.product_name);
        } catch (error) {
          console.error('❌ [CART SERVICE] Error sincronizando item:', offlineItem.product_name, error);
          // Continuar con el siguiente item aunque uno falle
        }
      }

      // Limpiar el carrito offline después de sincronización exitosa
      await this.offlineCartService.clearAfterSync();
      console.log('✅ [CART SERVICE] Carrito offline limpiado después de sincronización');

      // Obtener el carrito actualizado
      const updatedCart = this.getCurrentCart();
      if (updatedCart) {
        console.log('✅ [CART SERVICE] Sincronización completada exitosamente');
        return updatedCart;
      } else {
        throw new Error('No se pudo obtener el carrito actualizado');
      }

    } catch (error) {
      console.error('❌ [CART SERVICE] Error en sincronización del carrito offline:', error);
      throw error;
    }
  }

  /**
   * Obtiene el contador total de items (online + offline)
   */
  getTotalCartItemsCount(): number {
    const onlineCount = this.getCurrentCartItemsCount();
    const offlineCount = this.offlineCartService.getCurrentOfflineCartItemsCount();
    return onlineCount + offlineCount;
  }

  /**
   * Observable para el contador total de items (online + offline)
   */
  get totalCartItemsCount$(): Observable<number> {
    return new Observable(observer => {
      // Combinar ambos observables
      const onlineSubscription = this.cartItemsCount$.subscribe(onlineCount => {
        const offlineCount = this.offlineCartService.getCurrentOfflineCartItemsCount();
        observer.next(onlineCount + offlineCount);
      });

      const offlineSubscription = this.offlineCartService.offlineCartItemsCount$.subscribe(offlineCount => {
        const onlineCount = this.getCurrentCartItemsCount();
        observer.next(onlineCount + offlineCount);
      });

      return () => {
        onlineSubscription.unsubscribe();
        offlineSubscription.unsubscribe();
      };
    });
  }

  /**
   * Sincroniza manualmente el carrito offline (llamado desde la UI)
   */
  async syncOfflineCartManually(): Promise<void> {
    console.log('🔄 [CART SERVICE] Sincronización manual iniciada...');
    try {
      await this.syncOfflineCart();
      console.log('✅ [CART SERVICE] Sincronización manual completada');
    } catch (error) {
      console.error('❌ [CART SERVICE] Error en sincronización manual:', error);
      throw error;
    }
  }
}
