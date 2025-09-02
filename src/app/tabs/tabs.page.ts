import { Component } from '@angular/core';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonRouterOutlet } from '@ionic/angular/standalone';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonRouterOutlet],
  template: `
    <ion-tabs>
      <ion-router-outlet></ion-router-outlet>

      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="home" href="/tabs/home">
          <ion-icon name="home-outline"></ion-icon>
          <ion-label>Inicio</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="search" href="/tabs/products">
          <ion-icon name="search-outline"></ion-icon>
          <ion-label>Buscar</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="saved" href="/tabs/orders">
          <ion-icon name="heart-outline"></ion-icon>
          <ion-label>Guardados</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="cart" href="/tabs/cart">
          <ion-icon name="cart-outline"></ion-icon>
          <ion-label>Carrito</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="account" href="/tabs/profile">
          <ion-icon name="person-outline"></ion-icon>
          <ion-label>Cuenta</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `
})
export class TabsPage {
  constructor() {}
}
