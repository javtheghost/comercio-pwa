import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { ProductUI } from '../interfaces/product.interfaces';

export interface OfflineCartItem {
  id: string; // ID único generado localmente
  product_id: number;
  product_name: string;
  product_image?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  selected_attributes?: any;
  custom_options?: any;
  notes?: string;
  is_available: boolean;
  available_stock: number;
  added_at: string; // Timestamp cuando se agregó
  is_offline: boolean; // Flag para identificar items offline
}

export interface OfflineCart {
  id: string;
  items: OfflineCartItem[];
  subtotal: number;
  total: number;
  items_count: number;
  last_updated: string;
}

@Injectable({
  providedIn: 'root'
})
export class OfflineCartService {
  private dbName = 'EcommercePWA';
  private dbVersion = 1;
  private storeName = 'offline_cart';
  private db: IDBDatabase | null = null;

  // BehaviorSubject para manejar el estado del carrito offline
  private offlineCartSubject = new BehaviorSubject<OfflineCart | null>(null);
  public offlineCart$ = this.offlineCartSubject.asObservable();

  // BehaviorSubject para el contador de items del carrito offline
  private offlineCartItemsCountSubject = new BehaviorSubject<number>(0);
  public offlineCartItemsCount$ = this.offlineCartItemsCountSubject.asObservable();

  constructor() {
    this.initDB();
  }

  /**
   * Inicializa la base de datos IndexedDB
   */
  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('❌ [OFFLINE CART] Error abriendo IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ [OFFLINE CART] IndexedDB inicializada correctamente');
        this.loadOfflineCart();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Crear store para el carrito offline
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('product_id', 'product_id', { unique: false });
          store.createIndex('added_at', 'added_at', { unique: false });
          console.log('✅ [OFFLINE CART] Store creado:', this.storeName);
        }
      };
    });
  }

  /**
   * Carga el carrito offline desde IndexedDB
   */
  private async loadOfflineCart(): Promise<void> {
    if (!this.db) {
      console.warn('⚠️ [OFFLINE CART] Base de datos no inicializada');
      return;
    }

    try {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const items: OfflineCartItem[] = request.result || [];
        const cart = this.calculateCartTotals(items);

        this.offlineCartSubject.next(cart);
        this.updateOfflineCartItemsCount(cart);

        console.log('✅ [OFFLINE CART] Carrito offline cargado:', cart);
      };

      request.onerror = () => {
        console.error('❌ [OFFLINE CART] Error cargando carrito offline:', request.error);
      };
    } catch (error) {
      console.error('❌ [OFFLINE CART] Error en loadOfflineCart:', error);
    }
  }

  /**
   * Calcula los totales del carrito offline
   */
  private calculateCartTotals(items: OfflineCartItem[]): OfflineCart {
    const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
    const items_count = items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      id: 'offline_cart',
      items: items,
      subtotal: subtotal,
      total: subtotal, // Sin impuestos ni envío en modo offline
      items_count: items_count,
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Actualiza el contador de items del carrito offline
   */
  private updateOfflineCartItemsCount(cart: OfflineCart | null): void {
    if (cart && cart.items) {
      const count = cart.items.reduce((total, item) => total + item.quantity, 0);
      this.offlineCartItemsCountSubject.next(count);
      console.log('🛒 [OFFLINE CART] Contador actualizado:', count);
    } else {
      this.offlineCartItemsCountSubject.next(0);
      console.log('🛒 [OFFLINE CART] Contador reseteado a 0');
    }
  }

  /**
   * Agrega un producto al carrito offline
   */
  async addToOfflineCart(product: ProductUI, quantity: number = 1): Promise<OfflineCart> {
    if (!this.db) {
      throw new Error('Base de datos no inicializada');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      // Verificar si el producto ya existe en el carrito
      const index = store.index('product_id');
      const request = index.get(product.id);

      request.onsuccess = () => {
        const existingItem = request.result;

        if (existingItem) {
          // Actualizar cantidad del producto existente
          existingItem.quantity += quantity;
          existingItem.total_price = existingItem.quantity * existingItem.unit_price;
          existingItem.last_updated = new Date().toISOString();

          const updateRequest = store.put(existingItem);
          updateRequest.onsuccess = () => {
            console.log('✅ [OFFLINE CART] Producto actualizado en carrito offline:', existingItem);
            this.loadOfflineCart().then(() => {
              const currentCart = this.offlineCartSubject.value;
              if (currentCart) resolve(currentCart);
            });
          };
          updateRequest.onerror = () => {
            console.error('❌ [OFFLINE CART] Error actualizando producto:', updateRequest.error);
            reject(updateRequest.error);
          };
        } else {
          // Crear nuevo item en el carrito
          const unitPrice = parseFloat(product.price) || 0;
          const newItem: OfflineCartItem = {
            id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            product_id: product.id,
            product_name: product.name,
            product_image: product.image,
            quantity: quantity,
            unit_price: unitPrice,
            total_price: unitPrice * quantity,
            selected_attributes: {},
            custom_options: {},
            notes: '',
            is_available: true,
            available_stock: 999, // Stock ilimitado en modo offline
            added_at: new Date().toISOString(),
            is_offline: true
          };

          const addRequest = store.add(newItem);
          addRequest.onsuccess = () => {
            console.log('✅ [OFFLINE CART] Producto agregado al carrito offline:', newItem);
            this.loadOfflineCart().then(() => {
              const currentCart = this.offlineCartSubject.value;
              if (currentCart) resolve(currentCart);
            });
          };
          addRequest.onerror = () => {
            console.error('❌ [OFFLINE CART] Error agregando producto:', addRequest.error);
            reject(addRequest.error);
          };
        }
      };

      request.onerror = () => {
        console.error('❌ [OFFLINE CART] Error verificando producto existente:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Actualiza la cantidad de un item en el carrito offline
   */
  async updateOfflineCartItemQuantity(itemId: string, quantity: number): Promise<OfflineCart> {
    if (!this.db) {
      throw new Error('Base de datos no inicializada');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const getRequest = store.get(itemId);
      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (item) {
          item.quantity = quantity;
          item.total_price = item.quantity * item.unit_price;
          item.last_updated = new Date().toISOString();

          const updateRequest = store.put(item);
          updateRequest.onsuccess = () => {
            console.log('✅ [OFFLINE CART] Cantidad actualizada:', item);
            this.loadOfflineCart().then(() => {
              const currentCart = this.offlineCartSubject.value;
              if (currentCart) resolve(currentCart);
            });
          };
          updateRequest.onerror = () => {
            console.error('❌ [OFFLINE CART] Error actualizando cantidad:', updateRequest.error);
            reject(updateRequest.error);
          };
        } else {
          reject(new Error('Item no encontrado'));
        }
      };

      getRequest.onerror = () => {
        console.error('❌ [OFFLINE CART] Error obteniendo item:', getRequest.error);
        reject(getRequest.error);
      };
    });
  }

  /**
   * Elimina un item del carrito offline
   */
  async removeFromOfflineCart(itemId: string): Promise<OfflineCart> {
    if (!this.db) {
      throw new Error('Base de datos no inicializada');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const deleteRequest = store.delete(itemId);
      deleteRequest.onsuccess = () => {
        console.log('✅ [OFFLINE CART] Item eliminado del carrito offline:', itemId);
        this.loadOfflineCart().then(() => {
          const currentCart = this.offlineCartSubject.value;
          if (currentCart) resolve(currentCart);
        });
      };
      deleteRequest.onerror = () => {
        console.error('❌ [OFFLINE CART] Error eliminando item:', deleteRequest.error);
        reject(deleteRequest.error);
      };
    });
  }

  /**
   * Limpia todo el carrito offline
   */
  async clearOfflineCart(): Promise<void> {
    if (!this.db) {
      throw new Error('Base de datos no inicializada');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const clearRequest = store.clear();
      clearRequest.onsuccess = () => {
        console.log('✅ [OFFLINE CART] Carrito offline limpiado');
        this.offlineCartSubject.next(null);
        this.offlineCartItemsCountSubject.next(0);
        resolve();
      };
      clearRequest.onerror = () => {
        console.error('❌ [OFFLINE CART] Error limpiando carrito offline:', clearRequest.error);
        reject(clearRequest.error);
      };
    });
  }

  /**
   * Obtiene el carrito offline actual
   */
  getCurrentOfflineCart(): OfflineCart | null {
    return this.offlineCartSubject.value;
  }

  /**
   * Obtiene el contador actual de items del carrito offline
   */
  getCurrentOfflineCartItemsCount(): number {
    return this.offlineCartItemsCountSubject.value;
  }

  /**
   * Verifica si hay conexión a internet (verificación básica)
   */
  isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Verifica si hay conexión real a internet (verificación robusta)
   */
  async isReallyOnline(): Promise<boolean> {
    // Primero verificar navigator.onLine (rápido)
    if (!navigator.onLine) {
      console.log('🔍 [OFFLINE CART] navigator.onLine = false');
      return false;
    }

    // Luego hacer verificación real (más lenta pero confiable)
    try {
      console.log('🔍 [OFFLINE CART] Verificando conexión real...');
      const response = await fetch('/api/test', {
        method: 'GET',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000) // Timeout de 5 segundos
      });

      const isOnline = response.ok;
      console.log('🔍 [OFFLINE CART] Respuesta de conexión:', {
        status: response.status,
        ok: response.ok,
        isOnline
      });

      return isOnline;
    } catch (error) {
      console.log('🔍 [OFFLINE CART] Sin conexión real:', error);
      return false;
    }
  }

  /**
   * Verifica la conexión real haciendo una petición HTTP
   */
  async checkRealConnection(): Promise<boolean> {
    try {
      const response = await fetch('/api/test', {
        method: 'GET',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch (error) {
      console.log('🔍 [OFFLINE CART] Sin conexión real:', error);
      return false;
    }
  }

  /**
   * Sincroniza el carrito offline con el carrito online
   * Este método se llamará cuando el usuario se conecte y esté autenticado
   */
  async syncOfflineCartWithOnline(): Promise<OfflineCartItem[]> {
    const offlineCart = this.getCurrentOfflineCart();
    if (!offlineCart || offlineCart.items.length === 0) {
      console.log('🔄 [OFFLINE CART] No hay items offline para sincronizar');
      return [];
    }

    console.log('🔄 [OFFLINE CART] Iniciando sincronización con carrito online...');
    console.log('🔄 [OFFLINE CART] Items a sincronizar:', offlineCart.items.length);

    // Retornar los items offline para que el CartService los procese
    return offlineCart.items;
  }

  /**
   * Limpia el carrito offline después de sincronización exitosa
   */
  async clearAfterSync(): Promise<void> {
    console.log('🧹 [OFFLINE CART] Limpiando carrito offline después de sincronización...');
    await this.clearOfflineCart();
  }

  /**
   * Obtiene estadísticas del carrito offline
   */
  getOfflineCartStats(): {
    items_count: number;
    subtotal: number;
    total: number;
    is_empty: boolean;
  } {
    const cart = this.getCurrentOfflineCart();
    if (!cart) {
      return {
        items_count: 0,
        subtotal: 0,
        total: 0,
        is_empty: true
      };
    }

    return {
      items_count: cart.items_count,
      subtotal: cart.subtotal,
      total: cart.total,
      is_empty: cart.items.length === 0
    };
  }
}
