import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { FavoritesApiService } from './favorites-api.service';

export interface FavoriteItem {
  id: number;
  name?: string;
  price?: number;
  image?: string;
  updatedAt: number;
}

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private items$ = new BehaviorSubject<FavoriteItem[]>([]);
  private userId: number | 'guest' = 'guest';
  private isSyncing = false;
  private backendFavoritesMap = new Map<number, number>(); // productId -> favoriteId (para DELETE)

  constructor(
    private auth: AuthService,
    private favoritesApi: FavoritesApiService
  ) {
    // Load on init and react to auth changes
    try {
      const current = this.auth.getCurrentUserValue();
      this.userId = current?.id ?? 'guest';
      this.loadFromStorage();
      // Si está autenticado, sincronizar con backend
      if (this.userId !== 'guest') {
        this.syncFromBackend();
      }
    } catch { this.loadFromStorage(); }

    this.auth.authState$.subscribe(state => {
      const newId = state.isAuthenticated && state.user && typeof (state.user as any).id === 'number'
        ? (state.user as any).id as number
        : 'guest';
      if (newId !== this.userId) {
        this.userId = newId;
        this.loadFromStorage();
        // Sincronizar con backend cuando el usuario inicia sesión
        if (newId !== 'guest') {
          this.syncFromBackend();
        } else {
          // Limpiar mapa al cerrar sesión
          this.backendFavoritesMap.clear();
        }
      }
    });

    // Escuchar evento de login para sincronizar favoritos locales con backend
    if (typeof window !== 'undefined') {
      window.addEventListener('userLoggedIn', () => {
        console.log('🔄 [FAVORITES] Usuario inició sesión, sincronizando favoritos locales con backend...');
        // Sincronizar favoritos locales hacia el backend (bulk sync)
        this.syncToBackend();
      });

      // Limpiar favoritos al cerrar sesión
      window.addEventListener('userLoggedOut', () => {
        console.log('🧹 [FAVORITES] Usuario cerró sesión, limpiando mapa de favoritos...');
        this.backendFavoritesMap.clear();
      });
    }
  }

  private storageKey(): string {
    return `favorites_${this.userId}`;
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(this.storageKey());
      const parsed: FavoriteItem[] = raw ? JSON.parse(raw) : [];
      this.items$.next(Array.isArray(parsed) ? parsed : []);
    } catch {
      this.items$.next([]);
    }
  }

  private saveToStorage(): void {
    try { localStorage.setItem(this.storageKey(), JSON.stringify(this.items$.value)); } catch {}
  }

  getAll$(): Observable<FavoriteItem[]> { return this.items$.asObservable(); }
  getAll(): FavoriteItem[] { return this.items$.value; }
  count$(): Observable<number> { return new Observable(obs => {
    const sub = this.items$.subscribe(list => { obs.next(list.length); });
    return () => sub.unsubscribe();
  }); }

  isFavorite(productId: number): boolean {
    return this.items$.value.some(i => i.id === productId);
  }

  toggle(product: { id: number; name?: string; price?: number; image?: string }): void {
    const arr = this.items$.value.slice();
    const idx = arr.findIndex(i => i.id === product.id);
    
    if (idx >= 0) {
      // Eliminar
      arr.splice(idx, 1);
      
      // Sincronizar con backend si está autenticado
      if (this.userId !== 'guest') {
        const favoriteId = this.backendFavoritesMap.get(product.id);
        if (favoriteId) {
          this.favoritesApi.removeFavorite(favoriteId, product.id).subscribe({
            next: () => {
              this.backendFavoritesMap.delete(product.id);
              console.log(`✅ [FAVORITES] Favorito ${product.id} eliminado del backend`);
            },
            error: (err) => console.warn('⚠️ [FAVORITES] Error eliminando favorito del backend:', err)
          });
        }
      }
    } else {
      // Agregar
      arr.unshift({ id: product.id, name: product.name, price: product.price, image: product.image, updatedAt: Date.now() });
      
      // Sincronizar con backend si está autenticado
      if (this.userId !== 'guest') {
        this.favoritesApi.addFavorite(product.id).subscribe({
          next: (response) => {
            // Guardar el favoriteId para futuras eliminaciones
            if (response.data && response.data.id) {
              this.backendFavoritesMap.set(product.id, response.data.id);
            }
            console.log(`✅ [FAVORITES] Favorito ${product.id} agregado al backend`);
          },
          error: (err) => console.warn('⚠️ [FAVORITES] Error agregando favorito al backend:', err)
        });
      }
    }
    
    this.items$.next(arr);
    this.saveToStorage();
    try { window.dispatchEvent(new CustomEvent('favorites:updated')); } catch {}
  }

  /**
   * Sincronizar favoritos desde el backend
   * Se llama automáticamente al iniciar sesión
   */
  private syncFromBackend(): void {
    if (this.userId === 'guest' || this.isSyncing) return;
    
    this.isSyncing = true;
    console.log('🔄 [FAVORITES] Sincronizando favoritos desde backend...');

    this.favoritesApi.getFavorites().subscribe({
      next: (response) => {
        if (response.success && Array.isArray(response.data)) {
          // 🔍 DEBUG: Ver qué está devolviendo el backend
          console.log('🔍 [FAVORITES DEBUG] Datos del backend:', JSON.stringify(response.data[0], null, 2));
          
          // ✅ Filtrar favoritos que tengan producto válido
          const backendFavorites = response.data
            .filter(fav => {
              // Verificar que el producto existe y tiene datos válidos
              if (!fav.product || !fav.product_id) {
                console.warn('⚠️ [FAVORITES] Favorito sin producto válido:', fav);
                return false;
              }
              return true;
            })
            .map(fav => ({
              id: fav.product_id,
              name: fav.product?.name || 'Producto',
              price: fav.product?.price || 0,
              image: fav.product?.image_url || undefined,
              updatedAt: new Date(fav.created_at).getTime()
            }));
          
          // Construir mapa de productId -> favoriteId para futuras eliminaciones
          this.backendFavoritesMap.clear();
          response.data.forEach(fav => {
            if (fav.product_id) {
              this.backendFavoritesMap.set(fav.product_id, fav.id);
            }
          });
          
          console.log(`✅ [FAVORITES] ${backendFavorites.length} favoritos recibidos del backend`);
          
          // Actualizar localStorage y BehaviorSubject
          this.items$.next(backendFavorites);
          this.saveToStorage();
          
          // Notificar cambios
          try { window.dispatchEvent(new CustomEvent('favorites:updated')); } catch {}
        }
        this.isSyncing = false;
      },
      error: (error) => {
        console.warn('⚠️ [FAVORITES] No se pudieron sincronizar favoritos desde backend:', error);
        this.isSyncing = false;
        // Continuar con los favoritos locales
      }
    });
  }

  /**
   * Sincronizar favoritos locales hacia el backend (bulk sync)
   * Útil cuando el usuario tenía favoritos offline y luego inicia sesión
   */
  syncToBackend(): void {
    if (this.userId === 'guest') {
      console.warn('⚠️ [FAVORITES] No se puede sincronizar, usuario no autenticado');
      return;
    }

    const productIds = this.items$.value.map(item => item.id);
    
    if (productIds.length === 0) {
      console.log('ℹ️ [FAVORITES] No hay favoritos locales para sincronizar');
      return;
    }

    console.log(`🔄 [FAVORITES] Sincronizando ${productIds.length} favoritos hacia backend...`);
    
    this.favoritesApi.syncFavorites(productIds).subscribe({
      next: (response) => {
        console.log(`✅ [FAVORITES] Sincronización completa: +${response.data.added}, -${response.data.removed}, total: ${response.data.total}`);
        
        // Actualizar mapa con los favoritos del backend
        this.backendFavoritesMap.clear();
        response.data.favorites.forEach(fav => {
          this.backendFavoritesMap.set(fav.product_id, fav.id);
        });
        
        // Actualizar con los datos del backend (fuente de verdad)
        const backendFavorites = response.data.favorites
          .filter(fav => fav.product && fav.product_id) // ✅ Filtrar válidos
          .map(fav => ({
            id: fav.product_id,
            name: fav.product?.name || 'Producto',
            price: fav.product?.price || 0,
            image: fav.product?.image_url || undefined,
            updatedAt: new Date(fav.created_at).getTime()
          }));
        
        this.items$.next(backendFavorites);
        this.saveToStorage();
        
        try { window.dispatchEvent(new CustomEvent('favorites:updated')); } catch {}
      },
      error: (error) => {
        console.error('❌ [FAVORITES] Error sincronizando favoritos:', error);
      }
    });
  }

  /**
   * Forzar sincronización desde backend (útil para debugging o refresh manual)
   */
  forceSync(): void {
    if (this.userId !== 'guest') {
      this.isSyncing = false; // Reset flag
      this.syncFromBackend();
    }
  }
}
