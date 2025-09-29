import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from './auth.service';

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

  constructor(private auth: AuthService) {
    // Load on init and react to auth changes
    try {
      const current = this.auth.getCurrentUserValue();
      this.userId = current?.id ?? 'guest';
      this.loadFromStorage();
    } catch { this.loadFromStorage(); }

    this.auth.authState$.subscribe(state => {
      const newId = state.isAuthenticated && state.user && typeof (state.user as any).id === 'number'
        ? (state.user as any).id as number
        : 'guest';
      if (newId !== this.userId) {
        this.userId = newId;
        this.loadFromStorage();
      }
    });
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
      arr.splice(idx, 1);
    } else {
      arr.unshift({ id: product.id, name: product.name, price: product.price, image: product.image, updatedAt: Date.now() });
    }
    this.items$.next(arr);
    this.saveToStorage();
    try { window.dispatchEvent(new CustomEvent('favorites:updated')); } catch {}
  }
}
