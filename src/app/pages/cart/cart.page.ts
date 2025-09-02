import { Component } from '@angular/core';
import { CurrencyPipe, NgFor, NgIf } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardContent, IonItem, IonLabel, IonButton, IonIcon, IonBadge, IonList, IonThumbnail } from '@ionic/angular/standalone';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CurrencyPipe, NgFor, NgIf, IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardContent, IonItem, IonLabel, IonButton, IonIcon, IonBadge, IonList, IonThumbnail],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Mi Carrito</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <!-- Empty Cart State -->
      <div *ngIf="cartItems.length === 0" class="ion-text-center ion-padding empty-cart">
        <ion-icon name="cart-outline" class="empty-cart-icon"></ion-icon>
        <h2>¡Tu Carrito Está Vacío!</h2>
        <p>Cuando agregues productos, aparecerán aquí.</p>
        <ion-button routerLink="/tabs/products" expand="block" fill="outline" class="ion-margin-top">
          Ver Productos
        </ion-button>
      </div>

      <!-- Cart with Items -->
      <div *ngIf="cartItems.length > 0">
        <!-- Product List -->
        <ion-list>
          <ion-item *ngFor="let item of cartItems" class="cart-item">
            <ion-thumbnail slot="start" class="product-image">
              <img [src]="item.image" [alt]="item.name" />
            </ion-thumbnail>

            <ion-label class="product-info">
              <h3>{{ item.name }}</h3>
              <p class="size">Talla {{ item.size }}</p>
              <p class="price">{{ item.price | currency:'USD' }}</p>
            </ion-label>

            <!-- Quantity Selector -->
            <div slot="end" class="quantity-controls">
              <div class="quantity-selector">
                <ion-button fill="clear" size="small" (click)="decreaseQuantity(item)" class="quantity-btn">
                  <ion-icon name="remove-outline"></ion-icon>
                </ion-button>

                <div class="quantity-input-container">
                  <input
                    type="number"
                    [value]="item.quantity"
                    (input)="updateQuantity(item, $event)"
                    (click)="selectInput($event)"
                    class="quantity-input"
                    min="1"
                    max="99">
                </div>

                <ion-button fill="clear" size="small" (click)="increaseQuantity(item)" class="quantity-btn">
                  <ion-icon name="add-outline"></ion-icon>
                </ion-button>
              </div>

              <!-- Remove Button -->
              <ion-button fill="clear" color="danger" size="small" (click)="removeFromCart(item)" class="remove-btn">
                <ion-icon name="trash-outline"></ion-icon>
              </ion-button>
            </div>
          </ion-item>
        </ion-list>

        <!-- Order Summary -->
        <ion-card class="order-summary">
          <ion-card-content>
            <h3>Resumen de Orden</h3>

            <div class="summary-row">
              <span>Sub-total</span>
              <span>{{ getSubtotal() | currency:'USD' }}</span>
            </div>

            <div class="summary-row">
              <span>IVA (16%)</span>
              <span>{{ getVAT() | currency:'USD' }}</span>
            </div>

            <div class="summary-row">
              <span>Costo de envío</span>
              <span>{{ shippingFee | currency:'USD' }}</span>
            </div>

            <div class="summary-row total">
              <span><strong>Total</strong></span>
              <span><strong>{{ getTotal() | currency:'USD' }}</strong></span>
            </div>
          </ion-card-content>
        </ion-card>

        <!-- Checkout Button -->
        <div class="checkout-section">
          <ion-button expand="block" class="checkout-btn" (click)="goToCheckout()">
            Ir al Checkout
            <ion-icon name="arrow-forward" slot="end"></ion-icon>
          </ion-button>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .empty-cart {
      padding: 60px 20px;
    }

    .empty-cart-icon {
      font-size: 80px;
      color: #ccc;
      margin-bottom: 20px;
    }

    .empty-cart h2 {
      color: #333;
      margin-bottom: 10px;
    }

    .empty-cart p {
      color: #666;
      margin-bottom: 30px;
    }

    .cart-item {
      --padding-start: 16px;
      --padding-end: 16px;
      margin-bottom: 8px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .product-image {
      width: 80px;
      height: 80px;
      border-radius: 8px;
      overflow: hidden;
    }

    .product-info h3 {
      font-weight: 600;
      color: #333;
      margin-bottom: 4px;
    }

    .size {
      color: #666;
      font-size: 14px;
      margin-bottom: 4px;
    }

    .price {
      color: #333;
      font-weight: 600;
      font-size: 16px;
    }

    .quantity-controls {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .quantity-selector {
      display: flex;
      align-items: center;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      background: #fff;
      padding: 4px;
      min-width: 120px;
    }

    .quantity-btn {
      --color: #666;
      --padding-start: 8px;
      --padding-end: 8px;
      margin: 0;
      min-width: 32px;
    }

    .quantity-input-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 50px;
      height: 32px;
      background: #f8f9fa;
      border-radius: 4px;
      margin: 0 4px;
    }

    .quantity-input {
      width: 100%;
      height: 100%;
      text-align: center;
      border: none;
      background: transparent;
      font-size: 16px;
      font-weight: 600;
      color: #333;
      outline: none;
      padding: 0;
      cursor: text;
      user-select: text;
    }

    .quantity-input:focus {
      background: #fff;
      box-shadow: 0 0 0 2px #007bff;
    }

    .quantity-input:hover {
      background: #e9ecef;
    }

    .remove-btn {
      margin-top: 8px;
    }

    .order-summary {
      margin: 20px 16px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    .order-summary h3 {
      color: #333;
      margin-bottom: 16px;
      font-weight: 600;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #f0f0f0;
    }

    .summary-row:last-child {
      border-bottom: none;
    }

    .summary-row.total {
      font-size: 18px;
      padding-top: 16px;
      border-top: 2px solid #f0f0f0;
    }

    .checkout-section {
      padding: 20px 16px;
    }

    .checkout-btn {
      --background: #000;
      --color: #fff;
      --border-radius: 12px;
      --padding-top: 16px;
      --padding-bottom: 16px;
      font-weight: 600;
      font-size: 16px;
    }
  `]
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
