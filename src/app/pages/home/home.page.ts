import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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
  IonCardTitle,
  IonCardSubtitle,
  IonChip,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonFab,
  IonFabButton
} from '@ionic/angular/standalone';
import { ProductService } from '../../services/product.service';
import { Product, ProductUI, Category, PaginatedResponse } from '../../interfaces/product.interfaces';
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
    IonCardTitle,
    IonCardSubtitle,
    IonChip,
    IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonFab,
  IonFabButton
  ],
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss']
})
export class HomePage implements OnInit {
  showScrollTop = false;
  onContentScroll(event: any) {
    // Mostrar el botón si el scroll vertical es mayor a 300px
    this.showScrollTop = event && event.detail && event.detail.scrollTop > 300;
    this.cdr.detectChanges();
  }

  scrollToTop() {
    const content = document.querySelector('ion-content');
    if (content) {
      (content as any).scrollToTop(400);
    }
  }
  products: ProductUI[] = [];
  categories: Category[] = [];
  loading = true;
  loadingCategories = true;
  error = false;
  errorMessage = '';
  searchQuery = '';

  // Infinite Scroll properties - Solo para cargar más contenido
  currentPage = 1;
  itemsPerPage = 12;
  hasMoreProducts = true;
  isLoadingMore = false;

  constructor(
    private router: Router,
    private productService: ProductService,
    private cdr: ChangeDetectorRef
  ) {
  }

  ngOnInit() {

  }

  ionViewWillEnter() {
    console.log('🔄 HomePage ionViewWillEnter ejecutado');
    this.resetState();
    console.log('📊 Estado después de reset - loading:', this.loading, 'error:', this.error, 'products:', this.products.length);

    this.loadProducts();
    this.loadCategories();

    // Probar que el método funciona inmediatamente
  // Removed automatic testClick call to avoid blocking UI with alert during navigation
  }

  resetState() {
    console.log('🔄 Reseteando estado...');
    this.loading = true;
    this.loadingCategories = true;
    this.error = false;
    this.errorMessage = '';
    this.products = [];
    this.categories = [];

  }

  loadProducts() {
    console.log('🔄 Iniciando carga de productos...');
    this.loading = true;
    this.error = false;

    // Forzar detección de cambios para mostrar skeleton
    this.cdr.detectChanges();

    // Resetear paginación al cargar productos iniciales
    this.currentPage = 1;
    this.hasMoreProducts = true;

    this.productService.getProductsPaginated(this.currentPage, this.itemsPerPage).subscribe({
      next: (response: PaginatedResponse<Product>) => {
        console.log('✅ Respuesta exitosa del API:', response);

        this.products = ProductUtils.mapProductsToUI(response.data);
        this.hasMoreProducts = response.current_page < response.last_page;

        console.log('📦 Productos mapeados:', this.products.length);
        console.log('🔄 Cambiando loading a false...');

        this.loading = false;
        this.error = false;

        // Forzar detección de cambios para ocultar skeleton
        this.cdr.detectChanges();

        console.log('✅ Estado después de actualizar:', {
          loading: this.loading,
          error: this.error,
          productsCount: this.products.length
        });

        this.logImageDebugInfo(); // Log image info after loading

        console.log('📦 Productos iniciales cargados:', {
          totalProducts: this.products.length,
          currentPage: this.currentPage,
          lastPage: response.last_page,
          hasMoreProducts: this.hasMoreProducts
        });
      },
      error: (error: any) => {
        console.error('❌ Error cargando productos:', error);
        this.error = true;
        this.errorMessage = 'Error al cargar productos. Por favor, intenta de nuevo.';
        this.loading = false;

        // Forzar detección de cambios en caso de error también
        this.cdr.detectChanges();
      }
    });
  }

    loadCategories() {
    console.log('📂 Iniciando carga de categorías...');
    this.loadingCategories = true;
    this.cdr.detectChanges(); // Forzar detección de cambios para mostrar skeleton

    this.productService.getRootCategories().subscribe({
      next: (categories: Category[]) => {
        console.log('✅ Categorías cargadas exitosamente:', categories);
        this.categories = categories;
        this.loadingCategories = false;
        this.cdr.detectChanges(); // Forzar detección de cambios para ocultar skeleton
        console.log('📂 Total de categorías:', this.categories.length);
      },
      error: (error: any) => {
        console.error('❌ Error cargando categorías:', error);
        this.categories = [];
        this.loadingCategories = false;
        this.cdr.detectChanges(); // Forzar detección de cambios en caso de error
        console.log('📂 Categorías establecidas como array vacío');
      }
    });
  }





  toggleFavorite(product: ProductUI) {
    product.isFavorite = !product.isFavorite;
  }



  // Método para forzar carga de más productos
  forceLoadMoreProducts() {
    console.log('🚀 Forzando carga de más productos...');

    if (this.hasMoreProducts && !this.isLoadingMore) {
      // Simular evento de infinite scroll
      const mockEvent = {
        target: {
          complete: () => {
            console.log('✅ Evento de infinite scroll completado manualmente');
          }
        }
      };

      this.loadMoreProducts(mockEvent);
    } else {
      console.log('⚠️ No se pueden cargar más productos:', {
        hasMoreProducts: this.hasMoreProducts,
        isLoadingMore: this.isLoadingMore
      });
    }
  }

  goToProductDetail(product: ProductUI) {
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

    console.log('🔍 Iniciando búsqueda:', this.searchQuery);
    this.loading = true;
    this.cdr.detectChanges(); // Forzar detección de cambios

    this.productService.searchProducts(this.searchQuery).subscribe({
      next: (products: Product[]) => {
        console.log('🔍 Resultados de búsqueda:', products);
        this.products = ProductUtils.mapProductsToUI(products);
        this.loading = false;
        this.cdr.detectChanges(); // Forzar detección de cambios
        this.logImageDebugInfo(); // Log image info after search
      },
      error: (error: any) => {
        console.error('❌ Error en búsqueda:', error);
        this.loading = false;
        this.cdr.detectChanges(); // Forzar detección de cambios
      }
    });
  }

  filterByCategory(categoryId: number | null) {
    if (categoryId === null) {
      console.log('📂 Mostrando todos los productos');
      this.loadProducts(); // Mostrar todos los productos
      return;
    }

    console.log(`📂 Filtrando por categoría: ${categoryId}`);
    this.loading = true;
    this.cdr.detectChanges(); // Forzar detección de cambios

    this.productService.getCategoryProducts(categoryId).subscribe({
      next: (products: Product[]) => {
        console.log(`📂 Productos de categoría ${categoryId}:`, products);
        this.products = ProductUtils.mapProductsToUI(products);
        this.loading = false;
        this.cdr.detectChanges(); // Forzar detección de cambios
        this.logImageDebugInfo(); // Log image info after loading
      },
      error: (error: any) => {
        console.error('❌ Error cargando productos de categoría:', error);
        this.loading = false;
        this.cdr.detectChanges(); // Forzar detección de cambios
      }
    });
  }

  // Método para debuggear información de imágenes
  logImageDebugInfo() {


    this.products.forEach((product, index) => {
      // Verificar el tipo de imagen y manejarlo de forma segura
      const imageValue = product.image;
      const imageType = typeof imageValue;

      // Extraer la URL de la imagen si es un objeto
      let imageUrl = '';
      if (imageValue && typeof imageValue === 'object') {
        // Intentar diferentes propiedades comunes para la URL de imagen
        const imageObj = imageValue as any; // Type assertion para evitar errores de TypeScript
        imageUrl = imageObj.url || imageObj.src || imageObj.path || imageObj.image_url ||
                   imageObj.thumbnail || imageObj.medium || imageObj.large || '';


      } else if (typeof imageValue === 'string') {
        imageUrl = imageValue;
      }

      const hasImage = !!imageUrl && imageUrl !== '';
      const imageLength = hasImage ? imageUrl.length : 0;
      const imageStartsWith = hasImage ?
        (imageUrl.length > 50 ? imageUrl.substring(0, 50) + '...' : imageUrl) : 'NO IMAGE';

      console.log(`📦 Producto ${index + 1}:`, {
        id: product.id,
        name: product.name,
        originalImage: imageValue,
        imageType: imageType,
        extractedImageUrl: imageUrl,
        hasImage: hasImage,
        imageLength: imageLength,
        imageStartsWith: imageStartsWith,
        isString: typeof imageValue === 'string',
        isObject: typeof imageValue === 'object',
        isNull: imageValue === null,
        isUndefined: imageValue === undefined
      });

      // Verificar si la imagen es válida y es una string
      if (hasImage && typeof imageUrl === 'string') {
        this.testImageLoad(imageUrl, product.name);
      } else {
        console.warn(`⚠️ Producto ${product.name} no tiene imagen válida:`, {
          originalValue: imageValue,
          extractedUrl: imageUrl,
          type: imageType
        });
      }
    });

    console.log('🖼️ === FIN DEBUG DE IMÁGENES ===');
  }

  // Método para probar la carga de una imagen
  testImageLoad(imageUrl: string, productName: string) {
    const img = new Image();

    img.onload = () => {
      console.log(`${productName}:`, {
        url: imageUrl,
        width: img.width,
        height: img.height,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight
      });
    };

    img.onerror = () => {
      console.error(`❌ Error cargando imagen para ${productName}:`, {
        url: imageUrl,
        error: 'Failed to load image'
      });
    };

    // Establecer timeout para detectar imágenes que no cargan
    setTimeout(() => {
      if (!img.complete) {
        console.warn(`⏰ Timeout cargando imagen para ${productName}:`, {
          url: imageUrl,
          complete: img.complete
        });
      }
    }, 5000);

    img.src = imageUrl;
  }

  // Método para obtener la URL de la imagen del producto (para usar en el template)
  getProductImageUrl(product: ProductUI): string {
    const imageValue = product.image;

    if (imageValue && typeof imageValue === 'object') {
      // Extraer URL del objeto de imagen
      const imageObj = imageValue as any;
      return imageObj.url || imageObj.src || imageObj.path || imageObj.image_url ||
             imageObj.thumbnail || imageObj.medium || imageObj.large || '';
    } else if (typeof imageValue === 'string') {
      // Si ya es una string, devolverla directamente
      return imageValue;
    }

    // Fallback a imagen por defecto
    return 'assets/placeholder-product.jpg';
  }



  // Método para cargar más productos - Usando API real
  loadMoreProducts(event: any) {
    console.log('📜 Infinite scroll activado:', {
      hasMoreProducts: this.hasMoreProducts,
      isLoadingMore: this.isLoadingMore,
      currentPage: this.currentPage,
      productsCount: this.products.length
    });

    if (!this.hasMoreProducts || this.isLoadingMore) {
      console.log('⚠️ No se pueden cargar más productos');
      event.target.complete();
      return;
    }

    this.isLoadingMore = true;
    this.currentPage++;

    // Usar el servicio real de paginación
    this.productService.getProductsPaginated(this.currentPage, this.itemsPerPage).subscribe({
      next: (response: PaginatedResponse<Product>) => {
        console.log('📦 Productos de página', this.currentPage, ':', response.data);

        // Convertir productos a UI y agregarlos a la lista existente
        const newProducts = ProductUtils.mapProductsToUI(response.data);
        this.products = [...this.products, ...newProducts];

        // Verificar si hay más páginas disponibles
        this.hasMoreProducts = response.current_page < response.last_page;

        console.log('✅ Infinite scroll completado:', {
          hasMoreProducts: this.hasMoreProducts,
          totalProducts: this.products.length,
          currentPage: this.currentPage,
          lastPage: response.last_page
        });

        // Completar el evento de infinite scroll
        if (event && event.target) {
          event.target.complete();
        }

        this.isLoadingMore = false;
      },
      error: (error: any) => {
        console.error('❌ Error cargando más productos:', error);
        this.isLoadingMore = false;

        // Completar el evento incluso si hay error
        if (event && event.target) {
          event.target.complete();
        }
      }
    });
  }



}
