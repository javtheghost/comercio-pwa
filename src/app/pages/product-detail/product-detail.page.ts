import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIf, JsonPipe } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonIcon,
  IonBadge,
  IonSpinner
} from '@ionic/angular/standalone';
import { ProductService } from '../../services/product.service';
import { Product, ProductUI } from '../../interfaces/product.interfaces';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [
    NgIf,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonIcon,
    IonBadge,
  IonSpinner,
  JsonPipe
  ],
  templateUrl: './product-detail.page.html',
  styleUrls: ['./product-detail.page.scss']
})
export class ProductDetailPage implements OnInit {
  selectedSize = 'S';
  product: ProductUI | null = null;
  productId: string | null = null;
  loading = true;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService,
    private cdr: ChangeDetectorRef
  ) {
    console.log('🏗️ ProductDetailPage constructor ejecutado');
  }

  ngOnInit() {
    console.log('🚀 ProductDetailPage ngOnInit iniciado');
    this.productId = this.route.snapshot.paramMap.get('id');
    console.log('🆔 ID del producto recibido:', this.productId);
    this.loadProduct();
  }

  loadProduct() {
    if (!this.productId) {
      console.error('❌ No se recibió ID del producto');
      this.router.navigate(['/tabs/home']);
      return;
    }

    console.log('📦 Iniciando carga de producto con ID:', this.productId);
    this.loading = true;

    this.productService.getProduct(Number(this.productId)).subscribe({
      next: (product) => {
        if (!product || !product.id) {
          this.error = 'Producto no encontrado.';
          this.loading = false;
          this.cdr.detectChanges();
          return;
        }
        console.log('🔍 Producto encontrado en API:', product);
        this.product = {
          ...product,
          isFavorite: false, // Por defecto no favorito
          originalPrice: product.compare_price,
          discount: this.calculateDiscount(product.price, product.compare_price),
          image: product.images && product.images.length > 0
            ? (product.images[0].full_image_url || product.images[0].image_url)
            : 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop&crop=center'
        } as ProductUI;
        this.loading = false;
        this.cdr.detectChanges();
        console.log('✅ Producto cargado exitosamente:', this.product.name);
      },
      error: (error) => {
        console.error('❌ Error cargando producto desde API:', error);
        this.error = 'No se pudo cargar el producto. Intenta más tarde.';
        this.loading = false;
        this.cdr.detectChanges();
        this.router.navigate(['/tabs/home']);
      }
    });
  }

// ...existing code...

// ...existing code...

    calculateDiscount(price: string, comparePrice: string): number | undefined {
    if (!comparePrice || parseFloat(comparePrice) <= parseFloat(price)) {
      return undefined;
    }
    const discount = ((parseFloat(comparePrice) - parseFloat(price)) / parseFloat(comparePrice)) * 100;
    return Math.round(discount);
  }


  selectSize(size: string) {
    this.selectedSize = size;
  }

  toggleFavorite() {
    if (this.product) {
      this.product.isFavorite = !this.product.isFavorite;
      console.log('❤️ Favorito cambiado:', this.product.isFavorite);
    }
  }

  addToCart() {
    console.log('🛒 Agregando al carrito:', {
      name: this.product?.name,
      size: this.selectedSize,
      price: this.product?.price
    });
    // Aquí implementarías la lógica para agregar al carrito
  }

  goBack() {
    this.router.navigate(['/tabs/home']);
  }
}

