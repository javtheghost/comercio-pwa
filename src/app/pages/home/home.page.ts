import { Component, OnInit } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonIcon,
  IonSearchbar,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonBadge,
  IonChip,
  IonSpinner
} from '@ionic/angular/standalone';
import { ProductService } from '../../services/product.service';
import { Product, ProductUI, Category } from '../../interfaces/product.interfaces';
import { ProductUtils } from '../../utils/product.utils';

@Component({
  selector: 'app-home',
  standalone: true,
    imports: [
    NgFor,
    NgIf,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonIcon,
    IonSearchbar,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonBadge,
    IonChip,
    IonSpinner
  ],
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss']
})
export class HomePage implements OnInit {
  products: ProductUI[] = [];
  categories: Category[] = [];
  loading = true;
  searchQuery = '';

  constructor(
    private router: Router,
    private productService: ProductService
  ) {
    console.log('🏠 HomePage constructor ejecutado');
  }

  ngOnInit() {
    console.log('🚀 HomePage ngOnInit ejecutado');
    this.loadProducts();
    this.loadCategories();
  }

  loadProducts() {
    this.loading = true;
    this.productService.getProducts().subscribe({
      next: (products: Product[]) => {
        console.log('📦 Productos cargados desde API:', products);
        this.products = ProductUtils.mapProductsToUI(products);
        this.loading = false;
      },
      error: (error: any) => {
        console.error('❌ Error cargando productos:', error);
        // Fallback a productos de ejemplo si la API falla
        this.loadFallbackProducts();
        this.loading = false;
      }
    });
  }



  loadCategories() {
    this.productService.getRootCategories().subscribe({
      next: (categories: Category[]) => {
        console.log('📂 Categorías cargadas desde API:', categories);
        this.categories = categories;
      },
      error: (error: any) => {
        console.error('❌ Error cargando categorías:', error);
        // Fallback a categorías de ejemplo
        this.loadFallbackCategories();
      }
    });
  }

  loadFallbackProducts() {
    // Crear productos de fallback con la estructura completa
    this.products = [
      {
        id: 1,
        category_id: 1,
        name: 'Regular Fit Slogan',
        slug: 'regular-fit-slogan',
        sku: 'REG-SLOGAN',
        description: 'Camiseta básica de algodón',
        long_description: 'Camiseta básica de algodón 100% premium',
        price: '1,190',
        compare_price: '1,190',
        cost_price: '600',
        stock_quantity: 100,
        min_stock_level: 10,
        track_stock: true,
        is_active: true,
        is_featured: false,
        is_virtual: false,
        weight: '150',
        status: 'published',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        category: {
          id: 1,
          parent_id: null,
          name: 'Camisetas',
          slug: 'camisetas',
          description: 'Camisetas básicas',
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
      } as ProductUI
    ];
  }

  loadFallbackCategories() {
    this.categories = [
      {
        id: 1,
        parent_id: null,
        name: 'Todas',
        slug: 'todas',
        description: 'Todas las categorías',
        image: '',
        is_active: true,
        sort_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
  }

  toggleFavorite(product: ProductUI) {
    product.isFavorite = !product.isFavorite;
  }

  testClick() {
    console.log('🧪 BOTÓN DE PRUEBA CLICKEADO');
    alert('¡El botón de prueba funciona!');
  }

  goToProductDetail(product: ProductUI) {
    alert(`CLICK EN PRODUCTO: ${product.name}`);
    console.log('🔄 CLICK DETECTADO en producto:', product.name);
    console.log('🔄 Intentando navegar al producto:', product);
    console.log('📍 Ruta objetivo:', `/product/${product.id}`);

    this.router.navigate(['/product', product.id]).then(() => {
      console.log('✅ Navegación exitosa a producto:', product.id);
    }).catch((error) => {
      console.error('❌ Error en navegación:', error);
    });
  }

  onSearchChange(event: any) {
    this.searchQuery = event.detail.value;
    if (this.searchQuery.trim()) {
      this.searchProducts();
    } else {
      this.loadProducts(); // Recargar todos los productos si la búsqueda está vacía
    }
  }

    searchProducts() {
    if (!this.searchQuery.trim()) return;

    this.loading = true;
    this.productService.searchProducts(this.searchQuery).subscribe({
      next: (products: Product[]) => {
        console.log('🔍 Resultados de búsqueda:', products);
        this.products = ProductUtils.mapProductsToUI(products);
        this.loading = false;
      },
      error: (error: any) => {
        console.error('❌ Error en búsqueda:', error);
        this.loading = false;
      }
    });
  }

  filterByCategory(categoryId: number | null) {
    if (categoryId === null) {
      this.loadProducts(); // Mostrar todos los productos
      return;
    }

    this.loading = true;
    this.productService.getCategoryProducts(categoryId).subscribe({
      next: (products: Product[]) => {
        console.log(`📂 Productos de categoría ${categoryId}:`, products);
        this.products = ProductUtils.mapProductsToUI(products);
        this.loading = false;
      },
      error: (error: any) => {
        console.error('❌ Error cargando productos de categoría:', error);
        this.loading = false;
      }
    });
  }
}
