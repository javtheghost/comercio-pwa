import { Component } from '@angular/core';
import { CurrencyPipe, NgFor, NgIf } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardContent, IonItem, IonLabel, IonButton, IonIcon, IonList, IonThumbnail } from '@ionic/angular/standalone';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CurrencyPipe, NgFor, NgIf, IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardContent, IonItem, IonLabel, IonButton, IonIcon, IonList, IonThumbnail],
  templateUrl: './cart.page.html',
  styleUrls: ['./cart.page.scss']
})
export class CartPage {
  shippingFee = 80; // Fixed shipping fee

  cartItems = [
    {
      id: 1,
      name: 'Camiseta Regular Fit Slogan',
      size: 'L',
      price: 1190,
      quantity: 2,
      image: 'https://via.placeholder.com/80x80/4A90E2/FFFFFF?text=Camiseta'
    },
    {
      id: 2,
      name: 'Polo Regular Fit',
      size: 'M',
      price: 1490,
      quantity: 1,
      image: 'https://via.placeholder.com/80x80/50C878/FFFFFF?text=Polo'
    },
    {
      id: 3,
      name: 'Tank Top Regular Fit Negro',
      size: 'S',
      price: 890,
      quantity: 1,
      image: 'https://via.placeholder.com/80x80/333333/FFFFFF?text=Tank'
    }
  ];

  increaseQuantity(item: any) {
    item.quantity++;
  }

  decreaseQuantity(item: any) {
    if (item.quantity > 1) {
      item.quantity--;
    }
  }

  updateQuantity(item: any, event: any) {
    const newQuantity = parseInt(event.target.value);
    if (newQuantity && newQuantity > 0 && newQuantity <= 99) {
      item.quantity = newQuantity;
    } else if (newQuantity <= 0) {
      item.quantity = 1;
    }
  }

  selectInput(event: any) {
    event.target.select();
  }

  removeFromCart(item: any) {
    const index = this.cartItems.findIndex(cartItem => cartItem.id === item.id);
    if (index > -1) {
      this.cartItems.splice(index, 1);
    }
  }

  getSubtotal(): number {
    return this.cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  }

  getVAT(): number {
    return this.getSubtotal() * 0.16; // 16% VAT
  }

  getTotal(): number {
    return this.getSubtotal() + this.getVAT() + this.shippingFee;
  }

  goToCheckout() {
    console.log('Procediendo al checkout...');
    // Aquí implementarías la navegación al checkout
  }
}
