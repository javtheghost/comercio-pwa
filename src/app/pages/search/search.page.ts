// ...importaciones...
import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { IonicModule, ToastController } from '@ionic/angular';
import { CommonModule, NgIf, NgFor } from '@angular/common';
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { BarcodeFormat } from '@zxing/library';
import { Router } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { FavoritesService } from '../../services/favorites.service';
import { Product, ProductUI } from '../../interfaces/product.interfaces';
import { ProductUtils } from '../../utils/product.utils';

// Manejo de estado offline
function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [IonicModule, ZXingScannerModule, CommonModule, NgIf, NgFor],
  templateUrl: './search.page.html',
  styleUrls: ['./search.page.scss']
})
export class SearchPage {
  private isToastActive = false;
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
  offline = !isOnline();

  showQr = false;
  products: ProductUI[] = [];
  productsFiltered: ProductUI[] = [];
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
  hasMoreProducts = false;
  showScrollTop = false;
  allowedFormats = [BarcodeFormat.QR_CODE];
  compareDiscount = (o1: any, o2: any) => String(o1) === String(o2);

  private router = inject(Router);
  private productService = inject(ProductService);
  private cdr = inject(ChangeDetectorRef);
  private toastController = inject(ToastController);
  private favorites = inject(FavoritesService);

  constructor() {
    window.addEventListener('online', () => {
      this.offline = false;
      this.cdr.detectChanges();
    });
    window.addEventListener('offline', () => {
      this.offline = true;
      this.cdr.detectChanges();
    });
    this.loadRecommended();
  }

  showQrInfo() {
    this.showQrInfoAlert = true;
  }

  onSearchbarEnter(event: any) {
    if (!this.offline && this.searchQuery && this.searchQuery.trim()) {
      this.searchProducts();
    }
  }

  onSearchbarKeydown(event: KeyboardEvent) {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key === 'Enter') {
      if (!this.offline && this.searchQuery && this.searchQuery.trim()) {
        this.searchProducts();
      }
      keyboardEvent.preventDefault();
    }
  }

  onSearchChange(event: any) {
    this.searchQuery = event.detail.value;
    if (!this.offline && this.searchQuery.trim()) {
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
    if (!this.offerOnly) {
      this.minDiscount = 0;
    }
    this.applyFiltersAndSort();
  }

  applyFiltersAndSort() {
    let filtered = [...this.products];
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
      default:
        break;
    }
    if (this.offerOnly) {
      filtered = filtered.filter(p => {
        const price = Number(p.price);
        const compare = Number(p.compare_price);
        return (compare > price) && price > 0;
      });
    }
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
    if (this.colorFilter) {
      filtered = filtered.filter(p => p.variants && p.variants.some((v: any) => v.color === this.colorFilter));
    }
    if (this.sizeFilter) {
      filtered = filtered.filter(p => p.variants && p.variants.some((v: any) => v.size === this.sizeFilter));
    }
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
        break;
    }
    this.productsFiltered = filtered;
    this.cdr.detectChanges();
  }

  searchProducts() {
    if (!this.searchQuery.trim()) return;
    this.loading = true;
    this.error = false;
    this.cdr.detectChanges();
    this.productService.searchProducts(this.searchQuery).subscribe({
      next: (products: Product[]) => {
        this.products = ProductUtils.mapProductsToUI(products);
        // Aplicar estado de favoritos a resultados
        this.applyFavoritesToCurrentLists();
        this.hasMoreProducts = false;
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
        this.cdr.detectChanges();
      }
    });
  }

  loadRecommended() {
    this.productService.getFeaturedProducts().subscribe({
      next: (products: Product[]) => {
        this.recommended = ProductUtils.mapProductsToUI(products);
        // Sincronizar favoritos en recomendados
        this.applyFavoritesToCurrentLists();
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
      this.router.navigate(['/tabs/product', product.id], { queryParams: { from: origin } });
    } else {
      this.router.navigate(['/tabs/product', product.id]);
    }
  }

  onCodeResult(result: string) {
    if (result) {
      this.showQr = false;
      let productId: string | null = null;
      // Si es solo un número, úsalo directo
      if (/^\d+$/.test(result)) {
        productId = result;
      } else {
        // Si es una URL, intenta extraer el ID al final
        const match = result.match(/product\/(\d+)/);
        if (match) {
          productId = match[1];
        }
      }
      setTimeout(() => {
        if (productId) {
          this.router.navigate(['/tabs/product', productId]);
        } else {
          this.toastController.create({
            message: 'QR inválido: no se pudo extraer el ID de producto',
            duration: 2000,
            color: 'danger',
            position: 'bottom',
            icon: 'alert-circle-outline'
          }).then(toast => toast.present());
        }
      }, 200);
    }
  }

  onContentScroll(event: any) {
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
    try {
      this.favorites.toggle({
        id: product.id,
        name: product.name,
        price: Number(product.price || 0),
        image: this.getProductImageUrl(product)
      });
    } catch {}
  }

  async doRefresh(event: any): Promise<void> {
    try {
      if (this.searchQuery && this.searchQuery.trim()) {
        await this.searchProducts();
      }
      event.target.complete();
    } catch (error) {
      event.target.complete();
    }
  }

  async reloadPage() {
    if (navigator.onLine) {
      window.location.reload();
    } else {
      if (this.isToastActive) return;
      this.isToastActive = true;
      const toast = await this.toastController.create({
        message: 'Sigue sin conexión a internet',
        duration: 2000,
        color: 'danger',
        position: 'bottom',
        icon: 'cloud-offline-outline',
      });
      toast.onDidDismiss().then(() => {
        this.isToastActive = false;
      });
      toast.present();
    }
  }

  // ==== Favoritos helpers ====
  private applyFavoritesToList(list: ProductUI[]) {
    try {
      const ids = new Set(this.favorites.getAll().map(f => f.id));
      list.forEach(p => p.isFavorite = ids.has(p.id));
    } catch {}
  }
  private applyFavoritesToCurrentLists() {
    if (this.products && this.products.length) this.applyFavoritesToList(this.products);
    if (this.productsFiltered && this.productsFiltered.length) this.applyFavoritesToList(this.productsFiltered);
    if (this.recommended && this.recommended.length) this.applyFavoritesToList(this.recommended);
  }
}
