import { Component } from '@angular/core';
import { CurrencyPipe, NgFor, NgIf } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardContent, IonItem, IonLabel, IonBadge, IonButton } from '@ionic/angular/standalone';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CurrencyPipe, NgFor, NgIf, IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardContent, IonItem, IonLabel, IonBadge, IonButton],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Mis Pedidos</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-card *ngFor="let order of orders">
        <ion-card-content>
          <ion-item>
            <ion-label>
              <h2>Pedido #{{ order.id }}</h2>
              <ion-badge [color]="getStatusColor(order.status)" class="ion-margin-start">
                {{ order.status }}
              </ion-badge>
              <p>Fecha: {{ order.date }}</p>
              <p>Total: {{ order.total | currency:'USD' }}</p>
              <p>Items: {{ order.items.length }}</p>
            </ion-label>
          </ion-item>

          <ion-button expand="block" fill="outline" class="ion-margin-top">
            Ver Detalles
          </ion-button>
        </ion-card-content>
      </ion-card>

      <div *ngIf="orders.length === 0" class="ion-text-center ion-padding">
        <p>No tienes pedidos aún</p>
        <ion-button routerLink="/tabs/products">
          Comprar Productos
        </ion-button>
      </div>
    </ion-content>
  `
})
export class OrdersPage {
  orders = [
    {
      id: '001',
      date: '2024-01-15',
      status: 'Entregado',
      total: 89.97,
      items: ['Producto 1', 'Producto 2', 'Producto 3']
    },
    {
      id: '002',
      date: '2024-01-10',
      status: 'En Camino',
      total: 49.99,
      items: ['Producto 2']
    }
  ];

  getStatusColor(status: string): string {
    switch (status) {
      case 'Entregado': return 'success';
      case 'En Camino': return 'warning';
      case 'Pendiente': return 'secondary';
      default: return 'primary';
    }
  }
}
