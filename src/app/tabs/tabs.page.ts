import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { NavController } from '@ionic/angular';
import { IonTabs, IonIcon, IonRouterOutlet } from '@ionic/angular/standalone';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [IonTabs, IonIcon, IonRouterOutlet],
  template: `
    <div class="custom-tab-bar">
      <button (click)="navigate('/tabs/home')" [class.active]="isActive('/tabs/home')">
        <ion-icon name="home-outline"></ion-icon>
        <span>Inicio</span>
      </button>
      <button (click)="navigate('/tabs/products')" [class.active]="isActive('/tabs/products')">
        <ion-icon name="search-outline"></ion-icon>
        <span>Buscar</span>
      </button>
      <button (click)="navigate('/tabs/orders')" [class.active]="isActive('/tabs/orders')">
        <ion-icon name="heart-outline"></ion-icon>
        <span>Guardados</span>
      </button>
      <button (click)="navigate('/tabs/cart')" [class.active]="isActive('/tabs/cart')">
        <ion-icon name="cart-outline"></ion-icon>
        <span>Carrito</span>
      </button>
      <button (click)="navigate('/tabs/profile')" [class.active]="isActive('/tabs/profile')">
        <ion-icon name="person-outline"></ion-icon>
        <span>Cuenta</span>
      </button>
    </div>
    <ion-router-outlet></ion-router-outlet>
  `,
  styleUrls: ['./tabs.page.scss']
})
export class TabsPage {
  tabOrder = ['/tabs/home', '/tabs/products', '/tabs/orders', '/tabs/cart', '/tabs/profile'];
  currentTabIndex = 0;

  constructor(private router: Router, private navCtrl: NavController) {
    this.currentTabIndex = this.tabOrder.indexOf(this.router.url);
  }

  navigate(path: string) {
    const newIndex = this.tabOrder.indexOf(path);
    let direction: 'forward' | 'back' = 'forward';
    if (newIndex > -1) {
      direction = newIndex > this.currentTabIndex ? 'forward' : 'back';
      this.currentTabIndex = newIndex;
    }
    this.navCtrl.navigateRoot(path, { animationDirection: direction });
  }

  isActive(path: string): boolean {
    return this.router.url === path;
  }
}