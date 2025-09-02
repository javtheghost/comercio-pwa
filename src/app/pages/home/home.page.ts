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
  error = false;
  errorMessage = '';
  searchQuery = '';

  constructor(
    private router: Router,
    private productService: ProductService
  ) {
    console.log('🏠 HomePage constructor ejecutado');
  }

  ngOnInit() {
    console.log('🚀 HomePage ngOnInit ejecutado');
    // No cargar datos aquí, esperar a ionViewWillEnter
  }

  ionViewWillEnter() {
    console.log('🔄 HomePage ionViewWillEnter ejecutado');
    this.resetState();
    console.log('📊 Estado después de reset - loading:', this.loading, 'error:', this.error, 'products:', this.products.length);
    this.loadProducts();
    this.loadCategories();
  }

  resetState() {
    console.log('🔄 Reseteando estado...');
    this.loading = true;
    this.error = false;
    this.errorMessage = '';
    this.products = [];
    this.categories = [];
    console.log('✅ Estado reseteado - loading:', this.loading, 'error:', this.error, 'products:', this.products.length);
  }

  loadProducts() {
    this.loading = true;
    this.error = false;

    // Timeout de seguridad para evitar que se quede cargando indefinidamente
    const timeout = setTimeout(() => {
      if (this.loading) {
        console.log('⏰ Timeout alcanzado, cargando productos de fallback');
        this.loadFallbackProducts();
        this.loading = false;
        this.error = false; // No mostrar error, solo productos de fallback
        this.errorMessage = '';
      }
    }, 8000); // 8 segundos de timeout

    this.productService.getProducts().subscribe({
      next: (products: Product[]) => {
        clearTimeout(timeout);
        console.log('📦 Productos cargados desde API:', products);
        this.products = ProductUtils.mapProductsToUI(products);
        this.loading = false;
        this.error = false;
      },
      error: (error: any) => {
        clearTimeout(timeout);
        console.error('❌ Error cargando productos:', error);
        this.error = false; // No mostrar error, solo productos de fallback
        this.errorMessage = '';
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
    console.log('🔄 Cargando productos de fallback...');
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
      } as ProductUI,
      {
        id: 2,
        category_id: 2,
        name: 'Jeans Slim Fit',
        slug: 'jeans-slim-fit',
        sku: 'JEANS-SLIM',
        description: 'Jeans modernos de corte slim',
        long_description: 'Jeans de alta calidad con corte moderno',
        price: '2,490',
        compare_price: '2,490',
        cost_price: '1,200',
        stock_quantity: 50,
        min_stock_level: 5,
        track_stock: true,
        is_active: true,
        is_featured: true,
        is_virtual: false,
        weight: '300',
        status: 'published',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        category: {
          id: 2,
          parent_id: null,
          name: 'Jeans',
          slug: 'jeans',
          description: 'Jeans y pantalones',
          image: '',
          is_active: true,
          sort_order: 2,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        variants: [],
        images: [],
        discounts: [],
        isFavorite: false,
        image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=400&fit=crop&crop=center'
      } as ProductUI,
      {
        id: 3,
        category_id: 3,
        name: 'Sneakers Urban',
        slug: 'sneakers-urban',
        sku: 'SNEAKERS-URBAN',
        description: 'Zapatillas urbanas cómodas',
        long_description: 'Zapatillas ideales para el día a día',
        price: '3,290',
        compare_price: '3,290',
        cost_price: '1,800',
        stock_quantity: 75,
        min_stock_level: 8,
        track_stock: true,
        is_active: true,
        is_featured: false,
        is_virtual: false,
        weight: '250',
        status: 'published',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        category: {
          id: 3,
          parent_id: null,
          name: 'Zapatillas',
          slug: 'zapatillas',
          description: 'Zapatillas deportivas y urbanas',
          image: '',
          is_active: true,
          sort_order: 3,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        variants: [],
        images: [],
        discounts: [],
        isFavorite: false,
        image: 'https://images.unsplash.com/photo-1549298916-b41d5d2f7b5d?w=400&h=400&fit=crop&crop=center'
      } as ProductUI
    ];
    console.log('✅ Productos de fallback cargados:', this.products.length);
    console.log('📊 Estado final - loading:', this.loading, 'error:', this.error, 'products:', this.products.length);
  }

  loadFallbackCategories() {
    console.log('🔄 Cargando categorías de fallback...');
    this.categories = [
      {
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
      {
        id: 2,
        parent_id: null,
        name: 'Jeans',
        slug: 'jeans',
        description: 'Jeans y pantalones',
        image: '',
        is_active: true,
        sort_order: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 3,
        parent_id: null,
        name: 'Zapatillas',
        slug: 'zapatillas',
        description: 'Zapatillas deportivas y urbanas',
        image: '',
        is_active: true,
        sort_order: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
    console.log('✅ Categorías de fallback cargadas:', this.categories.length);
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
