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
import { ApiService } from '../../services/api.service';
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
    private apiService: ApiService,
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

    this.apiService.getProduct(Number(this.productId)).subscribe({
      next: (product) => {
        if (!product || !product.id) {
          this.error = 'Producto no encontrado.';
          this.loading = false;
          return;
        }
        console.log('🔍 Producto encontrado en API:', product);
        this.product = {
          ...product,
          isFavorite: false, // Por defecto no favorito
          // Mapear propiedades para compatibilidad con la UI
          originalPrice: product.compare_price,
          discount: this.calculateDiscount(product.price, product.compare_price),
          image: product.images && product.images.length > 0 ? product.images[0].image_url : 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop&crop=center'
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

  loadFallbackProduct() {
    // Crear un producto de fallback con la estructura completa
    const fallbackProduct = {
      id: Number(this.productId),
      category_id: 1,
      name: 'Producto de Ejemplo',
      slug: 'producto-ejemplo',
      sku: 'PROD-EJEMPLO',
      description: 'Este es un producto de ejemplo',
      long_description: 'Descripción larga del producto de ejemplo',
      price: '999.00',
      compare_price: '999.00',
      cost_price: '500.00',
      stock_quantity: 50,
      min_stock_level: 5,
      track_stock: true,
      is_active: true,
      is_featured: false,
      is_virtual: false,
      weight: '200',
      status: 'published',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      category: {
        id: 1,
        parent_id: null,
        name: 'Categoría Ejemplo',
        slug: 'categoria-ejemplo',
        description: 'Categoría de ejemplo',
        image: '',
        is_active: true,
        sort_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      variants: [],
      images: [],
      discounts: [],
      isFavorite: false,
      image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop&crop=center'
    } as ProductUI;

    this.product = fallbackProduct;
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

