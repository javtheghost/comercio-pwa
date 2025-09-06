import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIf } from '@angular/common';
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
    IonSpinner
  ],
  templateUrl: './product-detail.page.html',
  styleUrls: ['./product-detail.page.scss']
})
export class ProductDetailPage implements OnInit {
  selectedSize = 'S';
  product: ProductUI | null = null;
  productId: string | null = null;
  loading = true;

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
        console.log('🔍 Producto encontrado en API:', product);
        console.log('🔍 Tipo de producto:', typeof product);
        console.log('🔍 Producto tiene images?', product.images);
        console.log('🔍 Cantidad de imágenes:', product.images?.length);

        this.product = {
          ...product,
          isFavorite: false, // Por defecto no favorito
          // Mapear propiedades para compatibilidad con la UI
          originalPrice: product.compare_price,
          discount: this.calculateDiscount(product.price, product.compare_price),
          image: product.images && product.images.length > 0 ? product.images[0].full_image_url || product.images[0].image_url : ''
        } as ProductUI;

        console.log('🔍 Producto mapeado:', this.product);
        console.log('🔍 Imagen asignada:', this.product.image);

        this.loading = false;
        console.log('✅ Producto cargado exitosamente:', this.product.name);
        console.log('✅ Loading cambiado a false');

        // Forzar detección de cambios
        this.cdr.detectChanges();
        console.log('✅ Detección de cambios forzada');
      },
      error: (error) => {
        console.error('❌ Error cargando producto desde API:', error);
        this.loading = false;
        this.cdr.detectChanges();
        // Redirigir a home si hay error
        this.router.navigate(['/tabs/home']);
      }
    });
  }

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

