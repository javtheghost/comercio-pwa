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
  IonLabel,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonFab,
  IonFabButton,
  IonRefresher,
  IonRefresherContent
} from '@ionic/angular/standalone';
import { ProductService } from '../../services/product.service';
import { FavoritesService } from '../../services/favorites.service';
import { Observable, Subscription } from 'rxjs';
import { Product, ProductUI, Category, PaginatedResponse } from '../../interfaces/product.interfaces';
import { ProductUtils } from '../../utils/product.utils';
import { CartService } from '../../services/cart.service';
import { OfflineCartService } from '../../services/offline-cart.service';
import { AuthService } from '../../services/auth.service';
import { ToastController } from '@ionic/angular/standalone';
import { AddToCartToastComponent } from '../../components/add-to-cart-toast/add-to-cart-toast.component';
import { CurrencyPipe } from '../../pipes/currency.pipe';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
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
    IonLabel,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonFab,
    IonFabButton,
    IonRefresher,
    IonRefresherContent,
    AddToCartToastComponent,
    CurrencyPipe
  ],
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss']
})
export class HomePage implements OnInit {
  showContent = true;
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
  activeCategoryId: number | null = null; // null = "Todas" activa

  // Infinite Scroll properties - Solo para cargar más contenido
  currentPage = 1;
  itemsPerPage = 12;
  hasMoreProducts = true;
  isLoadingMore = false;

  // Cache properties - Para mantener productos entre navegaciones
  private static cachedProducts: ProductUI[] = [];
  private static cachedCategories: Category[] = [];
  private static lastLoadTime: number = 0;
  private static cacheExpiryTime = 5 * 60 * 1000; // 5 minutos en milisegundos
  private hasLoadedFromCache = false;

  // Toast properties - Para el toast mejorado
  showToast = false;
  toastProductName = '';
  toastProductImage = '';
  toastSelectedSize = '';
  toastSelectedColor = '';
  toastPrice = 0;

  // Control para evitar spam del toast offline
  private offlineToastActive = false;
  // Favorites
  favoritesCount$!: Observable<number>;
  private favoritesSub?: Subscription;
  favoritesNew = false; // resalta el chip cuando aparece por primera vez
  private lastFavoritesCount = 0;
  private favoritesCountSub?: Subscription;

  constructor(
    private router: Router,
    private productService: ProductService,
    private cdr: ChangeDetectorRef,
    private cartService: CartService,
    private offlineCartService: OfflineCartService,
    private authService: AuthService,
    private toastController: ToastController,
    private favorites: FavoritesService
  ) {
  }

  ngOnInit() {
    this.favoritesCount$ = this.favorites.count$();

    // Sincronizar corazones cuando cambie la lista de favoritos
    this.favoritesSub = this.favorites.getAll$().subscribe(() => {
      this.applyFavoritesToCurrentProducts();
    });

    // Detectar aparición inicial de Favoritos (de 0 a >0) y resaltar el chip
    this.favoritesCountSub = this.favorites.count$().subscribe(count => {
      if (this.lastFavoritesCount === 0 && count > 0) {
        this.favoritesNew = true;
        this.cdr.detectChanges();
        // Quitar resaltado después de 3 segundos
        setTimeout(() => {
          this.favoritesNew = false;
          this.cdr.detectChanges();
        }, 3000);
      }
      this.lastFavoritesCount = count;
    });
  }

  openFavorites() {
    this.router.navigateByUrl('/tabs/favorites');
  }

  ionViewWillEnter() {
    console.log('🔄 HomePage ionViewWillEnter ejecutado');

    // Verificar si tenemos datos en caché válidos
    if (this.isCacheValid()) {
      console.log('📦 Cargando desde caché...');
      this.loadFromCache();
    } else {
      console.log('🔄 Caché expirado o vacío, cargando desde API...');
      this.resetState();
      this.loadProducts();
      this.loadCategories();
    }
  }

  resetState() {
    console.log('🔄 Reseteando estado...');
    this.loading = true;
    this.loadingCategories = true;
    this.error = false;
    this.errorMessage = '';

    // Solo limpiar productos y categorías si no se cargaron desde caché
    if (!this.hasLoadedFromCache) {
      this.products = [];
      this.categories = [];
    }

    this.hasLoadedFromCache = false;
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

    // Evitar llamadas de red si estamos offline
    if (this.isOffline()) {
      console.warn('📴 [HOME] Offline - evitando llamada a getProductsPaginated');
      if (this.isCacheValid()) {
        this.loadFromCache();
        this.applyFavoritesToCurrentProducts();
      } else {
        this.loading = false;
        this.error = false;
        this.cdr.detectChanges();
        this.showOfflineToast('Sin conexión. No se pudo actualizar el catálogo.');
      }
      return;
    }

    this.productService.getProductsPaginated(this.currentPage, this.itemsPerPage).subscribe({
      next: (response: PaginatedResponse<Product>) => {
        console.log('✅ Respuesta exitosa del API:', response);
        console.log('🔍 Productos recibidos:', response.data);

        this.products = ProductUtils.mapProductsToUI(response.data);
        // Aplicar estado de favoritos a los productos cargados
        this.applyFavoritesToCurrentProducts?.();
        this.hasMoreProducts = response.current_page < response.last_page;

        // Debug: verificar categorías de productos
        this.products.forEach((product, index) => {
          console.log(`🔍 Producto ${index + 1}:`, {
            id: product.id,
            name: product.name,
            hasCategory: !!product.category,
            categoryName: product.category?.name || 'SIN CATEGORÍA'
          });
        });

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

        // Guardar en caché solo si no se cargó desde caché
        if (!this.hasLoadedFromCache) {
          this.saveToCache();
        }
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

    // Evitar llamadas de red si estamos offline
    if (this.isOffline()) {
      console.warn('📴 [HOME] Offline - evitando llamada a getRootCategories');
      if (this.isCacheValid()) {
        this.loadFromCache();
      } else {
        this.loadingCategories = false;
        this.cdr.detectChanges();
        this.showOfflineToast('Sin conexión. No se pudieron cargar las categorías.');
      }
      return;
    }

    this.productService.getRootCategories().subscribe({
      next: (categories: Category[]) => {
        console.log('✅ Categorías cargadas exitosamente:', categories);
        this.categories = categories;
        this.loadingCategories = false;
        this.cdr.detectChanges(); // Forzar detección de cambios para ocultar skeleton
        console.log('📂 Total de categorías:', this.categories.length);
        console.log('📂 Categorías mostradas:', this.categories.map(c => c.name));

        // Guardar en caché solo si no se cargó desde caché
        if (!this.hasLoadedFromCache) {
          this.saveToCache();
        }
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
    try {
      this.favorites.toggle({
        id: product.id,
        name: product.name,
        price: Number(product.price || 0),
        image: this.getProductImageUrl(product)
      });
    } catch { }
  }



  // Método para forzar carga de más productos
  forceLoadMoreProducts() {
    console.log('🚀 Forzando carga de más productos...');

    if (this.hasMoreProducts && !this.isLoadingMore) {
      this.loadMoreProducts();
    } else {
      console.log('⚠️ No se pueden cargar más productos:', {
        hasMoreProducts: this.hasMoreProducts,
        isLoadingMore: this.isLoadingMore
      });
    }
  }

  goToProductDetail(product: ProductUI) {
    console.log('🔄 CLICK DETECTADO en producto:', product.name);

    // Evitar navegación cuando no hay conexión
    if (this.isOffline()) {
      console.warn('📴 Sin conexión: bloqueo de navegación al detalle del producto');
      this.showOfflineToast();
      return;
    }

    console.log('🔄 Intentando navegar al producto:', product);
    console.log('📍 Ruta objetivo:', `/tabs/product/${product.id}`);

    this.router
      .navigate(['/tabs/product', product.id])
      .then(() => {
        console.log('✅ Navegación exitosa a producto:', product.id);
      })
      .catch((error) => {
        console.error('❌ Error en navegación:', error);
      });
  }

  onSearchChange(event: any) {
    this.searchQuery = event.detail.value;
    if (this.searchQuery.trim()) {
      // Dejar que searchProducts maneje offline/online
      this.searchProducts();
    } else {
      // Recargar todos los productos si la búsqueda está vacía
      if (this.isOffline()) {
        if (this.isCacheValid()) {
          this.loadFromCache();
          this.applyFavoritesToCurrentProducts();
        } else {
          this.loading = false;
          this.cdr.detectChanges();
        }
        return;
      }
      this.loadProducts();
    }
  }

  searchProducts() {
    if (!this.searchQuery.trim()) return;

    // Si está offline, intentar búsqueda local sobre caché
    if (this.isOffline()) {
      console.warn('📴 [HOME] Offline - evitando búsqueda remota');
      const source = (HomePage as any).cachedProducts as ProductUI[];
      if (source && source.length > 0) {
        const q = this.searchQuery.toLowerCase();
        this.products = source.filter(p =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q)
        );
        this.loading = false;
        this.cdr.detectChanges();
      } else {
        this.showOfflineToast('Sin conexión. No se pudo realizar la búsqueda.');
      }
      return;
    }

    console.log('🔍 Iniciando búsqueda:', this.searchQuery);
    this.loading = true;
    this.cdr.detectChanges(); // Forzar detección de cambios

    this.productService.searchProducts(this.searchQuery).subscribe({
      next: (products: Product[]) => {
        console.log('🔍 Resultados de búsqueda:', products);
        this.products = ProductUtils.mapProductsToUI(products);
        this.applyFavoritesToCurrentProducts();
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
    // Actualizar la categoría activa
    this.activeCategoryId = categoryId;

    if (categoryId === null) {
      console.log('📂 Mostrando todos los productos');
      // Mostrar todos los productos
      if (this.isOffline()) {
        if (this.isCacheValid()) {
          this.loadFromCache();
          this.applyFavoritesToCurrentProducts();
        } else {
          this.showOfflineToast('Sin conexión. No se pudo mostrar todo el catálogo.');
        }
      } else {
        this.loadProducts();
      }
      return;
    }

    console.log(`📂 Filtrando por categoría: ${categoryId}`);
    this.loading = true;
    this.cdr.detectChanges(); // Forzar detección de cambios

    // Si estamos offline, intentar filtrar localmente
    if (this.isOffline()) {
      const source = ((HomePage as any).cachedProducts as ProductUI[])?.length > 0
        ? (HomePage as any).cachedProducts as ProductUI[]
        : this.products;
      if (source && source.length > 0) {
        this.products = source.filter(p => p.category?.id === categoryId);
        this.applyFavoritesToCurrentProducts();
        this.loading = false;
        this.cdr.detectChanges();
      } else {
        this.products = [];
        this.loading = false;
        this.cdr.detectChanges();
        this.showOfflineToast('Sin conexión. No se pudieron cargar productos de la categoría.');
      }
      return;
    }

    this.productService.getCategoryProducts(categoryId).subscribe({
      next: (products: Product[]) => {
        console.log(`📂 Productos de categoría ${categoryId}:`, products);

        // Validar que products sea un array válido
        if (products && Array.isArray(products)) {
          this.products = ProductUtils.mapProductsToUI(products);
          this.applyFavoritesToCurrentProducts();
          console.log(`✅ ${products.length} productos cargados para la categoría ${categoryId}`);

          // Debug: verificar categorías de productos filtrados
          this.products.forEach((product, index) => {
            console.log(`🔍 Producto filtrado ${index + 1}:`, {
              id: product.id,
              name: product.name,
              hasCategory: !!product.category,
              categoryName: product.category?.name || 'SIN CATEGORÍA'
            });
          });
        } else {
          console.warn(`⚠️ No se recibieron productos válidos para la categoría ${categoryId}`);
          this.products = [];
        }

        this.loading = false;
        this.cdr.detectChanges(); // Forzar detección de cambios
        this.logImageDebugInfo(); // Log image info after loading
      },
      error: (error: any) => {
        console.error('❌ Error cargando productos de categoría:', error);
        this.products = [];
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
  loadMoreProducts(event?: any) {
    // Evitar llamadas de red si estamos offline
    if (this.isOffline()) {
      console.warn('📴 [HOME] Offline - evitando infinite scroll');
      if (event?.target?.complete) {
        event.target.complete();
      }
      this.showOfflineToast('Conéctate a internet para cargar más productos.');
      return;
    }
    console.log('📜 Infinite scroll activado:', {
      hasMoreProducts: this.hasMoreProducts,
      isLoadingMore: this.isLoadingMore,
      currentPage: this.currentPage,
      productsCount: this.products.length
    });

    if (!this.hasMoreProducts || this.isLoadingMore) {
      console.log('⚠️ No se pueden cargar más productos');
      if (event?.target?.complete) {
        event.target.complete();
      }
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
        this.applyFavoritesToProducts(newProducts);
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

  /**
   * Agrega un producto al carrito (online u offline según la conexión)
   */
  async addToCart(product: ProductUI): Promise<void> {
    console.log('🛒 [HOME] Agregando producto al carrito:', product.name);

    try {
      // Verificar si hay conexión a internet
      const isOnline = this.offlineCartService.isOnline();
      const isAuthenticated = this.authService.isAuthenticated();

      console.log('🔍 [HOME] Estado de conexión:', { isOnline, isAuthenticated });

      if (isOnline && isAuthenticated) {
        // Usuario online y autenticado - usar carrito online
        console.log('🛒 [HOME] Agregando al carrito online...');

        const addToCartRequest = {
          product_id: product.id,
          quantity: 1,
          product_variant_id: undefined,
          selected_attributes: {},
          custom_options: {},
          notes: ''
        };

        this.cartService.addToCart(addToCartRequest).subscribe({
          next: (cart) => {
            console.log('✅ [HOME] Producto agregado al carrito online:', cart);
            this.showSuccessToast(product);
          },
          error: (error) => {
            console.error('❌ [HOME] Error agregando al carrito online:', error);
            // Si falla el carrito online, agregar al offline como fallback
            this.addToOfflineCartFallback(product);
          }
        });
      } else {
        // Usuario offline o no autenticado - usar carrito offline
        console.log('🛒 [HOME] Agregando al carrito offline...');

        await this.offlineCartService.addToOfflineCart(product, 1);
        console.log('✅ [HOME] Producto agregado al carrito offline');

        this.showSuccessToast(product);
      }
    } catch (error) {
      console.error('❌ [HOME] Error agregando producto al carrito:', error);
      this.showErrorToast('Error agregando al carrito');
    }
  }

  /**
   * Muestra el toast mejorado de éxito al agregar al carrito
   */
  private showSuccessToast(product: ProductUI): void {
    // Primero ocultar el toast si está visible
    this.showToast = false;
    this.cdr.detectChanges();

    // Configurar los datos del toast
    this.toastProductName = product.name;
    this.toastProductImage = this.getProductImageUrl(product);
    this.toastSelectedSize = ''; // No hay selección de talla en home
    this.toastSelectedColor = ''; // No hay selección de color en home
    this.toastPrice = parseFloat(product.price);

    // Usar setTimeout para asegurar que el cambio se detecte
    setTimeout(() => {
      this.showToast = true;
      this.cdr.detectChanges();

      console.log('🎉 [HOME] Toast mejorado mostrado:', {
        show: this.showToast,
        productName: this.toastProductName,
        price: this.toastPrice
      });
    }, 50); // Pequeño delay para asegurar el reset
  }

  /**
   * Cierra el toast mejorado
   */
  closeToast(): void {
    this.showToast = false;
    this.cdr.detectChanges();
  }

  /**
   * Muestra un toast de error
   */
  private async showErrorToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      position: 'bottom',
      color: 'danger'
    });
    await toast.present();
  }

  /**
   * Fallback para agregar al carrito offline si falla el online
   */
  private async addToOfflineCartFallback(product: ProductUI): Promise<void> {
    try {
      await this.offlineCartService.addToOfflineCart(product, 1);
      this.showSuccessToast(product);
    } catch (error) {
      console.error('❌ [HOME] Error en fallback offline:', error);
      this.showErrorToast('Error agregando al carrito');
    }
  }

  /**
   * Verifica si el usuario está offline
   */
  isOffline(): boolean {
    return !this.offlineCartService.isOnline();
  }

  /**
   * Muestra un toast informativo cuando el usuario intenta abrir un detalle sin conexión
   */
  private async showOfflineToast(message?: string): Promise<void> {
    if (this.offlineToastActive) {
      // Ya hay un toast visible o en proceso: evitar duplicados
      return;
    }

    this.offlineToastActive = true;

    const toast = await this.toastController.create({
      message: message || 'Conéctate a internet para ver el detalle del producto.',
      duration: 2500,
      position: 'bottom',
      color: 'warning',
      icon: 'warning-outline'
    });

    await toast.present();
    // Cuando el toast se cierre, permitir mostrarlo de nuevo
    await toast.onDidDismiss();
    this.offlineToastActive = false;
  }

  /**
   * Verifica si una categoría está activa
   */
  isCategoryActive(categoryId: number | null): boolean {
    return this.activeCategoryId === categoryId;
  }

  /**
   * Verifica si el caché es válido (no expirado y tiene datos)
   */
  private isCacheValid(): boolean {
    const now = Date.now();
    const cacheAge = now - HomePage.lastLoadTime;
    const hasValidProducts = HomePage.cachedProducts.length > 0;
    const hasValidCategories = HomePage.cachedCategories.length > 0;
    const isNotExpired = cacheAge < HomePage.cacheExpiryTime;

    console.log('🔍 Verificando caché:', {
      cacheAge: Math.round(cacheAge / 1000) + 's',
      expiryTime: Math.round(HomePage.cacheExpiryTime / 1000) + 's',
      hasProducts: hasValidProducts,
      hasCategories: hasValidCategories,
      isNotExpired,
      isValid: hasValidProducts && hasValidCategories && isNotExpired
    });

    return hasValidProducts && hasValidCategories && isNotExpired;
  }

  /**
   * Carga datos desde el caché
   */
  private loadFromCache(): void {

    this.products = [...HomePage.cachedProducts];
    this.categories = [...HomePage.cachedCategories];
    this.loading = false;
    this.loadingCategories = false;
    this.error = false;
    this.hasLoadedFromCache = true;

    // Actualizar el estado de paginación basado en los productos cacheados
    this.updatePaginationState();

    // Asegurar sincronía de favoritos al restaurar del caché
    this.applyFavoritesToCurrentProducts?.();

    this.cdr.detectChanges();
  }

  /**
   * Guarda datos en el caché
   */
  private saveToCache(): void {
    console.log('💾 Guardando en caché:', {
      products: this.products.length,
      categories: this.categories.length
    });

    HomePage.cachedProducts = [...this.products];
    HomePage.cachedCategories = [...this.categories];
    HomePage.lastLoadTime = Date.now();
  }

  /**
   * Actualiza el estado de paginación basado en los productos actuales
   */
  private updatePaginationState(): void {
    // Si tenemos productos, asumimos que hay más disponibles
    // Esto se puede refinar basándose en la lógica de paginación del backend
    this.hasMoreProducts = this.products.length >= this.itemsPerPage;
    this.currentPage = Math.ceil(this.products.length / this.itemsPerPage);
  }

  /**
   * Limpia el caché (útil para forzar recarga)
   */
  private clearCache(): void {
    console.log('🗑️ Limpiando caché...');
    HomePage.cachedProducts = [];
    HomePage.cachedCategories = [];
    HomePage.lastLoadTime = 0;
  }

  // ==== Favoritos helpers ====
  private applyFavoritesToProducts(list: ProductUI[]): void {
    try {
      const ids = new Set(this.favorites.getAll().map(f => f.id));
      list.forEach(p => p.isFavorite = ids.has(p.id));
    } catch { }
  }

  private applyFavoritesToCurrentProducts(): void {
    if (!this.products || this.products.length === 0) return;
    this.applyFavoritesToProducts(this.products);

    // Mantener el caché sincronizado
    if (HomePage.cachedProducts && HomePage.cachedProducts.length > 0) {
      try {
        const ids = new Set(this.favorites.getAll().map(f => f.id));
        HomePage.cachedProducts = HomePage.cachedProducts.map((p: ProductUI) => ({
          ...p,
          isFavorite: ids.has(p.id)
        }));
      } catch { }
    }
  }

  ngOnDestroy() {
    try { this.favoritesSub?.unsubscribe(); } catch { }
    try { this.favoritesCountSub?.unsubscribe(); } catch { }
  }

  /**
   * Método público para forzar recarga (limpia caché y recarga)
   */
  public forceReload(): void {
    console.log('🔄 Forzando recarga completa...');
    this.clearCache();
    this.hasLoadedFromCache = false;
    this.resetState();
    this.loadProducts();
    this.loadCategories();
  }

  /**
   * Maneja el pull-to-refresh nativo
   */
  async doRefresh(event: any): Promise<void> {
    console.log('🔄 [HOME] Pull-to-refresh activado');

    try {
      // Si está offline, no intentes refrescar
      if (this.isOffline()) {
        this.showOfflineToast('Sin conexión. No se pudo actualizar.');
        event.target.complete();
        return;
      }
      // Limpiar caché y forzar recarga
      this.clearCache();
      this.hasLoadedFromCache = false;

      // Recargar productos y categorías
      await Promise.all([
        new Promise<void>((resolve) => {
          this.loadProducts();
          // Esperar a que termine la carga
          const checkLoading = () => {
            if (!this.loading) {
              resolve();
            } else {
              setTimeout(checkLoading, 100);
            }
          };
          checkLoading();
        }),
        new Promise<void>((resolve) => {
          this.loadCategories();
          // Esperar a que termine la carga
          const checkLoading = () => {
            if (!this.loadingCategories) {
              resolve();
            } else {
              setTimeout(checkLoading, 100);
            }
          };
          checkLoading();
        })
      ]);

      console.log('✅ [HOME] Pull-to-refresh completado');
    } catch (error) {
      console.error('❌ [HOME] Error en pull-to-refresh:', error);
    } finally {
      // Completar el refresh
      event.target.complete();
    }
  }

}
