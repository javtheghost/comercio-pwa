import { Component } from '@angular/core';
import { CurrencyPipe, NgFor, NgIf } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardContent, IonItem, IonLabel, IonBadge, IonButton } from '@ionic/angular/standalone';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CurrencyPipe, NgFor, NgIf, IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardContent, IonItem, IonLabel, IonBadge, IonButton],
  templateUrl: './orders.page.html'
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
