import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon, IonText, IonImg } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkCircle, close } from 'ionicons/icons';

@Component({
  selector: 'app-add-to-cart-toast',
  standalone: true,
  imports: [CommonModule, IonIcon, IonText, IonImg],
  template: `
    @if (show) {
      <div class="toast-overlay" (click)="closeToast()">
        <div class="toast-container" (click)="$event.stopPropagation()">
          <div class="toast-content">
            <div class="toast-header">
              <ion-icon name="checkmark-circle" color="success" class="success-icon"></ion-icon>
              <ion-text color="success" class="success-text">
                <h3>¡Producto agregado!</h3>
              </ion-text>
              <ion-icon name="close" class="close-icon" (click)="closeToast()"></ion-icon>
            </div>

            <div class="product-info">
              <ion-img [src]="productImage" [alt]="productName" class="product-thumbnail"></ion-img>
              <div class="product-details">
                <ion-text>
                  <h4>{{ productName }}</h4>
                </ion-text>
                @if (selectedSize) {
                  <ion-text color="medium">
                    <p>Talla: {{ selectedSize }}</p>
                  </ion-text>
                }
                @if (selectedColor) {
                  <ion-text color="medium">
                    <p>Color: {{ selectedColor }}</p>
                  </ion-text>
                }
                <ion-text color="primary">
                  <p class="price">{{ price | currency:'MXN' }}</p>
                </ion-text>
              </div>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .toast-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: flex-end;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.3s ease-in-out;
      padding-bottom: 120px; // Espacio para las tabs y action bar
    }

    .toast-container {
      width: 100%;
      max-width: 400px;
      margin: 0 16px 0 16px;
      animation: slideUp 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }

    .toast-content {
      background: white;
      border-radius: 16px;
      padding: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
      border: 1px solid rgba(0, 0, 0, 0.05);
    }

    .toast-header {
      display: flex;
      align-items: center;
      margin-bottom: 12px;
    }

    .success-icon {
      font-size: 24px;
      margin-right: 12px;
    }

    .success-text {
      flex: 1;
    }

    .success-text h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }

    .close-icon {
      font-size: 20px;
      color: var(--ion-color-medium);
      cursor: pointer;
      padding: 4px;
    }

    .product-info {
      display: flex;
      align-items: center;
      padding: 12px;
      background-color: var(--ion-color-light);
      border-radius: 12px;
    }

    .product-thumbnail {
      width: 50px;
      height: 50px;
      border-radius: 8px;
      object-fit: cover;
      margin-right: 12px;
    }

    .product-details {
      flex: 1;
    }

    .product-details h4 {
      margin: 0 0 4px 0;
      font-size: 14px;
      font-weight: 500;
      line-height: 1.3;
    }

    .product-details p {
      margin: 2px 0;
      font-size: 12px;
    }

    .price {
      font-weight: 600;
      font-size: 14px;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes slideUp {
      from {
        transform: translateY(100px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    /* Responsive */
    @media (max-width: 480px) {
      .toast-overlay {
        padding-bottom: 140px; // Más espacio en móviles
      }

      .toast-container {
        margin: 0 12px 0 12px;
      }

      .toast-content {
        padding: 14px;
      }

      .product-thumbnail {
        width: 45px;
        height: 45px;
      }

      .product-details h4 {
        font-size: 13px;
      }

      .product-details p {
        font-size: 11px;
      }
    }
  `]
})
export class AddToCartToastComponent implements OnInit, OnDestroy, OnChanges {
  @Input() show = false;
  @Input() productName = '';
  @Input() productImage = '';
  @Input() selectedSize = '';
  @Input() selectedColor = '';
  @Input() price = 0;
  @Output() close = new EventEmitter<void>();

  private autoCloseTimer?: number;

  constructor() {
    addIcons({ checkmarkCircle, close });
  }

  ngOnInit() {
    if (this.show) {
      this.startAutoClose();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['show']) {
      console.log('🔔 [TOAST] Cambio detectado:', {
        previousValue: changes['show'].previousValue,
        currentValue: changes['show'].currentValue
      });

      if (changes['show'].currentValue === true) {
        // Limpiar timer anterior si existe
        if (this.autoCloseTimer) {
          clearTimeout(this.autoCloseTimer);
          this.autoCloseTimer = undefined;
        }

        // Iniciar nuevo timer
        this.startAutoClose();
        console.log('🔔 [TOAST] Toast mostrado, timer iniciado');
      } else if (changes['show'].currentValue === false) {
        // Limpiar timer si se oculta manualmente
        if (this.autoCloseTimer) {
          clearTimeout(this.autoCloseTimer);
          this.autoCloseTimer = undefined;
        }
        console.log('🔔 [TOAST] Toast ocultado, timer limpiado');
      }
    }
  }

  ngOnDestroy() {
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
    }
  }

  private startAutoClose() {
    // Limpiar timer anterior si existe
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = undefined;
    }

    // Crear nuevo timer solo si el toast está visible
    if (this.show) {
      this.autoCloseTimer = window.setTimeout(() => {
        console.log('🔔 [TOAST] Auto-cierre después de 5 segundos');
        this.closeToast();
      }, 5000); // Se cierra automáticamente después de 5 segundos

    }
  }

  closeToast() {
    this.show = false;
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = undefined;
    }
    this.close.emit();
  }
}
