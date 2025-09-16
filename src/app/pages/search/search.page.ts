// ...existing code...
// ...existing code...
// ...existing code...
import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule, NgIf, NgFor } from '@angular/common';
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { BarcodeFormat } from '@zxing/library';
import { Router } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { Product, ProductUI } from '../../interfaces/product.interfaces';
import { ProductUtils } from '../../utils/product.utils';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [IonicModule, ZXingScannerModule, CommonModule, NgIf, NgFor],
  templateUrl: './search.page.html',
  styleUrls: ['./search.page.scss']
})

export class SearchPage {
  qrInfoButtons = [
    {
      text: 'Aceptar',
      role: 'confirm',
      handler: () => {
        this.showQrInfoAlert = false;
      }
    }
  ];
  showQrInfoAlert = false;

  showQrInfo() {
    this.showQrInfoAlert = true;
  }
  onSearchbarEnter(event: any) {
    // Ejecuta la búsqueda solo si hay texto
    if (this.searchQuery && this.searchQuery.trim()) {
      this.searchProducts();
    }
  }
  compareDiscount = (o1: any, o2: any) => String(o1) === String(o2);
  hasMoreProducts = false;
  allowedFormats = [BarcodeFormat.QR_CODE];
  showQr = false;
  products: ProductUI[] = [];
  loading = false;
  error = false;
  errorMessage = '';
  searchQuery = '';
  sortOption: 'relevance' | 'name_asc' | 'name_desc' | 'newest' = 'relevance';
  priceFilter: 'all' | 'lt100' | '100to500' | '500to1000' | 'gt1000' = 'all';
  offerOnly = false;
  minDiscount: number = 0;
  colorFilter: string = '';
  sizeFilter: string = '';
  availableColors: string[] = [];
  availableSizes: string[] = [];
  recommended: ProductUI[] = [];
  private router = inject(Router);
  private productService = inject(ProductService);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    this.loadRecommended();
  }

  onSearchbarKeydown(event: KeyboardEvent) {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key === 'Enter') {
      if (this.searchQuery && this.searchQuery.trim()) {
        this.searchProducts();
      }
      keyboardEvent.preventDefault();
    }
  }

  onSearchChange(event: any) {
    this.searchQuery = event.detail.value;
    if (this.searchQuery && this.searchQuery.trim()) {
      this.searchProducts();
    } else {
      this.products = [];
      this.productsFiltered = [];
      this.error = false;
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  onSortChange(event: any) {
    this.sortOption = event.detail.value;
    this.applyFiltersAndSort();
  }


  onMinDiscountChange(event: any) {
    this.minDiscount = Number(event.detail.value);
    this.applyFiltersAndSort();
  }

  onColorChange(event: any) {
    this.colorFilter = event.detail.value;
    this.applyFiltersAndSort();
  }

  onSizeChange(event: any) {
    this.sizeFilter = event.detail.value;
    this.applyFiltersAndSort();
  }

  onPriceFilterChange(event: any) {
    this.priceFilter = event.detail.value;
    this.applyFiltersAndSort();
  }

  onOfferChange(event: any) {
    this.offerOnly = event.detail.checked;
    // Si se desactiva la oferta, también resetea el descuento mínimo
    if (!this.offerOnly) {
      this.minDiscount = 0;
    }
    this.applyFiltersAndSort();
  }

  applyFiltersAndSort() {
    let filtered = [...this.products];
    // Filtro de precio
    switch (this.priceFilter) {
      case 'lt100':
        filtered = filtered.filter(p => Number(p.price) < 100);
        break;
      case '100to500':
        filtered = filtered.filter(p => Number(p.price) >= 100 && Number(p.price) <= 500);
        break;
      case '500to1000':
        filtered = filtered.filter(p => Number(p.price) > 500 && Number(p.price) <= 1000);
        break;
      case 'gt1000':
        filtered = filtered.filter(p => Number(p.price) > 1000);
        break;
  // case 'lt1000' eliminado
      default:
        // No filtrar
        break;
    }
    // Filtro de oferta
    if (this.offerOnly) {
      filtered = filtered.filter(p => {
        // Considera oferta si tiene compare_price mayor a price y es numérico
        const price = Number(p.price);
        const compare = Number(p.compare_price);
        return (compare > price) && price > 0;
      });
    }
    // Filtro de descuento mínimo
    if (this.minDiscount > 0) {
      filtered = filtered.filter(p => {
        const price = Number(p.price);
        const compare = Number(p.compare_price);
        if (compare > price && compare > 0) {
          const discount = Math.round(((compare - price) / compare) * 100);
          return discount >= this.minDiscount;
        }
        return false;
      });
    }
    // Filtro de color
    if (this.colorFilter) {
      filtered = filtered.filter(p => p.variants && p.variants.some((v: any) => v.color === this.colorFilter));
    }
    // Filtro de talla
    if (this.sizeFilter) {
      filtered = filtered.filter(p => p.variants && p.variants.some((v: any) => v.size === this.sizeFilter));
    }
    // Ordenamiento
    switch (this.sortOption) {
      case 'name_asc':
        filtered = filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name_desc':
        filtered = filtered.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'newest':
        filtered = filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'relevance':
      default:
        // No ordenar, mantener el orden original del backend
        break;
    }
    this.productsFiltered = filtered;
    this.cdr.detectChanges();
  }

  productsFiltered: ProductUI[] = [];

  // (Eliminada función duplicada y referencias incorrectas)

  searchProducts() {
    if (!this.searchQuery.trim()) {
      this.products = [];
      this.availableColors = [];
      this.availableSizes = [];
      this.error = false;
      this.loading = false;
      this.cdr.detectChanges();
      return;
    }
    this.loading = true;
    this.error = false;
    this.cdr.detectChanges();
  this.productService.searchProducts(this.searchQuery).subscribe({
      next: (products: Product[]) => {
  this.products = ProductUtils.mapProductsToUI(products);
  // Suponiendo que no hay paginación, si quieres agregarla, ajusta aquí:
  this.hasMoreProducts = false; // Si implementas paginación, cámbialo según la respuesta
        // Extraer colores y tallas disponibles de los resultados
        this.availableColors = Array.from(new Set(
          this.products.flatMap(p => (p.variants || []).map((v: any) => v.color)).filter(Boolean)
        ));
        this.availableSizes = Array.from(new Set(
          this.products.flatMap(p => (p.variants || []).map((v: any) => v.size)).filter(Boolean)
        ));
        this.applyFiltersAndSort();
        this.loading = false;
        this.error = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.loading = false;
        // Solo mostrar error si la query no está vacía y tiene al menos 2 caracteres
        if (this.searchQuery.trim().length > 1) {
          this.error = true;
          this.errorMessage = 'Error al buscar productos. Intenta de nuevo.';
        } else {
          this.error = false;
        }
        this.cdr.detectChanges();
      }
    });
  }

  loadRecommended() {
    // Puedes cambiar a getFeaturedProducts o getBestsellerProducts según prefieras
    this.productService.getFeaturedProducts().subscribe({
      next: (products: Product[]) => {
        this.recommended = ProductUtils.mapProductsToUI(products);
        this.cdr.detectChanges();
      },
      error: () => {
        this.recommended = [];
        this.cdr.detectChanges();
      }
    });
  }

  getProductImageUrl(product: ProductUI): string {
    const imageValue = product.image;
    if (imageValue && typeof imageValue === 'object') {
      // Intentar diferentes propiedades comunes para la URL de imagen
      const imageObj = imageValue as any;
      return imageObj.url || imageObj.src || imageObj.path || imageObj.image_url ||
        imageObj.thumbnail || imageObj.medium || imageObj.large || '';
    } else if (typeof imageValue === 'string') {
      return imageValue;
    }
    return '';
  }

  goToProductDetail(product: ProductUI, origin?: string) {
    if (origin) {
      this.router.navigate(['/product', product.id], { queryParams: { from: origin } });
    } else {
      this.router.navigate(['/product', product.id]);
    }
  }

  onCodeResult(result: string) {
    if (result) {
      this.showQr = false;
      setTimeout(() => {
        this.router.navigate(['/product', result]);
      }, 200);
    }
  }

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

  toggleFavorite(product: ProductUI) {
    product.isFavorite = !product.isFavorite;
  }

  /**
   * Maneja el pull-to-refresh nativo
   */
  async doRefresh(event: any): Promise<void> {
    console.log('🔄 [SEARCH] Pull-to-refresh activado');

    try {
      // Si hay una búsqueda activa, recargar los resultados
      if (this.searchQuery && this.searchQuery.trim()) {
        console.log('🔄 [SEARCH] Recargando resultados de búsqueda...');
        await this.searchProducts();
      } else {
        console.log('ℹ️ [SEARCH] No hay búsqueda activa para recargar');
      }

      console.log('✅ [SEARCH] Pull-to-refresh completado');
    } catch (error) {
      console.error('❌ [SEARCH] Error en pull-to-refresh:', error);
    } finally {
      // Completar el refresh
      event.target.complete();
    }
  }
}
