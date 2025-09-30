import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonList, IonItem, IonThumbnail, IonLabel, IonIcon } from '@ionic/angular/standalone';
import { FavoritesService, FavoriteItem } from '../../services/favorites.service';

@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonList, IonItem, IonThumbnail, IonLabel, IonIcon],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/home"></ion-back-button>
        </ion-buttons>
        <ion-title>Favoritos</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true" class="pad-bottom">
      <ion-list *ngIf="favorites.length > 0; else empty">
        <ion-item button detail *ngFor="let f of favorites" (click)="openProduct(f)">
          <ion-thumbnail slot="start">
            <img [src]="f.image || 'assets/icon/icon.png'" alt="Producto" />
          </ion-thumbnail>
          <ion-label>
            <h3>{{ f.name || 'Producto' }}</h3>
            <p *ngIf="f.price">{{ f.price | currency:'MXN':'symbol':'1.2-2' }}</p>
          </ion-label>
        </ion-item>
      </ion-list>
      <ng-template #empty>
        <div class="empty">
          <ion-icon name="heart-outline"></ion-icon>
          <p>No hay favoritos aún</p>
          <p class="hint">Toca el corazón en un producto para guardarlo aquí.</p>
        </div>
      </ng-template>
    </ion-content>
  `,
  styles: [`
    .pad-bottom{ --padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 76px); }
    .empty{display:grid;place-items:center;padding:48px 16px;text-align:center;color:var(--ion-color-medium)}
    .empty ion-icon{font-size:48px;margin-bottom:8px}
  `]
})
export class FavoritesPage {
  favorites: FavoriteItem[] = [];
  constructor(private fav: FavoritesService, private router: Router) {
    this.favorites = this.fav.getAll();
    window.addEventListener('favorites:updated', () => {
      this.favorites = this.fav.getAll();
    });
  }
  openProduct(item: FavoriteItem) {
    this.router.navigateByUrl(`/tabs/product/${item.id}`);
  }
}
