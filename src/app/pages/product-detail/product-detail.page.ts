import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NavController, ToastController } from '@ionic/angular';
import { Location } from '@angular/common';
import { CommonModule } from '@angular/common';
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
import { CartService, AddToCartRequest } from '../../services/cart.service';
import { Product, ProductUI, ProductVariant, VariantInfo } from '../../interfaces/product.interfaces';
import { ProductVariantSelectorComponent, VariantSelection } from '../../components/product-variant-selector/product-variant-selector.component';
import { AddToCartToastComponent } from '../../components/add-to-cart-toast/add-to-cart-toast.component';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonIcon,
    IonBadge,
    IonSpinner,
    ProductVariantSelectorComponent,
    AddToCartToastComponent
  ],
  templateUrl: './product-detail.page.html',
  styleUrls: ['./product-detail.page.scss']
})
export class ProductDetailPage implements OnInit {
  showOverlay = false;
  showContent = true;
  selectedSize: string | null = null;
  selectedColor: string | null = null;
  product: ProductUI | null = null;
  productId: string | null = null;
  loading = true;
  error: string | null = null;
  currentVariant: ProductVariant | null = null;
  currentPrice: string = '';
  currentStock: number = 0;
  variantInfo: VariantInfo | null = null;
  loadingVariants = false;
  // Stock base a nivel producto (cuando NO hay variantes)
  productBaseStock: number = 0;

  // Toast properties
  showToast = false;
  toastProductName = '';
  toastProductImage = '';
  toastSelectedSize = '';
  toastSelectedColor = '';
  toastPrice = 0;

  // Loading state
  addingToCart = false;

  // Offline handling
  private offlineToastActive = false;
  private hasHandledOfflineEntry = false;

  // Control de requisitos de selección (basado en variantes reales, no solo en needs_variants)
  private variantSizes: Set<string> = new Set();
  private variantColors: Set<string> = new Set();

  get requiresSize(): boolean {
    // Requiere seleccionar talla cuando hay variantes y más de una talla distinta
    return this.hasRealVariants && this.variantSizes.size > 1;
  }
  get requiresColor(): boolean {
    // Requiere seleccionar color cuando hay variantes y más de un color distinto
    return this.hasRealVariants && this.variantColors.size > 1;
  }
  get selectionMissing(): boolean {
    return (this.requiresSize && !this.selectedSize) || (this.requiresColor && !this.selectedColor);
  }
  get canAddToCart(): boolean {
    return !this.addingToCart && this.currentStock > 0 && !this.selectionMissing;
  }

  // Verdadero cuando existen variantes físicas para el producto
  get hasRealVariants(): boolean {
    return !!(this.product?.variants && this.product.variants.length > 0);
  }


  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private navCtrl: NavController,
    private productService: ProductService,
    private cartService: CartService,
    private cdr: ChangeDetectorRef,
    private toastController: ToastController
  ) {
    console.log('🏗️ ProductDetailPage constructor ejecutado');
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
        console.log('🔍 Tipo de producto:', typeof product);
        console.log('🔍 Producto tiene images?', product.images);
        console.log('🔍 Cantidad de imágenes:', product.images?.length);
        console.log('🔍 Producto tiene variants?', product.variants);
        console.log('🔍 Producto tiene attributes?', product.attributes);

        // Debug: verificar imágenes del producto
        console.log('🔍 Imágenes del producto:', {
          hasImages: !!(product.images && product.images.length > 0),
          imageCount: product.images?.length || 0,
          firstImage: product.images?.[0],
          fullImageUrl: product.images?.[0]?.full_image_url,
          imageUrl: product.images?.[0]?.image_url
        });

        const imageUrl = product.images && product.images.length > 0
          ? product.images[0].full_image_url || product.images[0].image_url
          : 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop&crop=center';

        console.log('🔍 URL de imagen final:', imageUrl);

        this.product = {
          ...product,
          isFavorite: false, // Por defecto no favorito
          originalPrice: product.compare_price,
          discount: this.calculateDiscount(product.price, product.compare_price),
          image: imageUrl,
          availableSizes: [],
          availableColors: []
        } as ProductUI;

        console.log('🔍 Producto mapeado:', this.product);

        // Inicializar precio siempre; el stock depende si hay variantes
        this.currentPrice = this.product.price || '0';
        if (Array.isArray(this.product.variants) && this.product.variants.length > 0) {
          // Hay variantes: esperar a selección para calcular stock y evitar parpadeos
          this.currentStock = 0;
          console.log('🧮 Stock pendiente de variantes. No usar stock del producto para evitar flicker.');
        } else {
          // Sin variantes: usar stock del producto
          // Calcular stock base preferentemente desde branch_products (producto_variant_id=null)
          this.productBaseStock = this.computeProductBaseStock(this.product as any);
          this.currentStock = this.product.track_stock ? this.productBaseStock : 999;
          console.log('🧮 Stock inicial (producto, sin variantes):', {
            track_stock: this.product.track_stock,
            stock_quantity: this.product.stock_quantity,
            currentStock: this.currentStock,
            productBaseStock: this.productBaseStock
          });
        }

  // Cargar información de variantes usando la nueva API
        this.loadVariantInfo();

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

  loadVariantInfo() {
    if (!this.productId) return;

    console.log('🔍 Cargando información de variantes...');
    this.loadingVariants = true;

    this.productService.getProductVariantInfo(Number(this.productId)).subscribe({
      next: (variantInfo) => {
        console.log('🎯 Información de variantes recibida:', variantInfo);

        this.variantInfo = variantInfo;

        // Actualizar el producto con la información de variantes
        if (this.product) {
          this.product.availableSizes = variantInfo.available_sizes;
          this.product.availableColors = variantInfo.available_colors;
        }

        // Si el backend devuelve variantes existentes, úsalas como fuente de verdad
        if (this.product && Array.isArray(variantInfo.existing_variants) && variantInfo.existing_variants.length > 0) {
          // Mapear existing_variants a ProductVariant (ya coincide con la interfaz usada por el selector)
          (this.product as any).variants = variantInfo.existing_variants as unknown as ProductVariant[];
          console.log('🔁 Variants sincronizadas desde variant-info.existing_variants:', this.product.variants);
          // Actualizar sets de opciones disponibles según variantes reales
          this.updateVariantOptionSets();
        }

        // Si hay variantes reales, preferir autoselección en el selector.
        // Si NO hay variantes reales, podemos usar overrides del backend como referencia visual.
        if (!this.hasRealVariants) {
          // Seleccionar primera talla/color si vienen de variant-info
          if (variantInfo.available_sizes.length > 0 && !this.selectedSize) {
            this.selectedSize = variantInfo.available_sizes[0];
          }
          if (variantInfo.available_colors.length > 0 && !this.selectedColor) {
            this.selectedColor = variantInfo.available_colors[0];
          }
        }

        console.log('🎯 Tallas disponibles:', variantInfo.available_sizes);
        console.log('🎯 Colores disponibles:', variantInfo.available_colors);
        console.log('🎯 Talla seleccionada:', this.selectedSize);
        console.log('🎯 Color seleccionado:', this.selectedColor);
        console.log('🎯 Necesita variantes:', variantInfo.needs_variants);
        console.log('🎯 Tipo de tallas:', variantInfo.size_type);

        // Stock a nivel producto solo cuando NO hay variantes reales
        if (!this.hasRealVariants && this.product) {
          this.currentPrice = this.product.price || '0';
          // Recalcular base stock por si llegó branch_products en esta llamada
          this.productBaseStock = this.computeProductBaseStock(this.product as any);
          this.currentStock = this.product.track_stock ? this.productBaseStock : 999;
          console.log('🧮 Stock determinado por producto (sin variantes):', {
            needs_variants: variantInfo.needs_variants,
            track_stock: this.product.track_stock,
            stock_quantity: this.product.stock_quantity,
            productBaseStock: this.productBaseStock,
            currentStock: this.currentStock
          });
        }

        this.loadingVariants = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('❌ Error al cargar información de variantes:', error);
        this.loadingVariants = false;
        // No es crítico, continuar sin información de variantes
      }
    });
  }

  // Recolecta las opciones reales de talla y color a partir de las variantes físicas
  private updateVariantOptionSets(): void {
    this.variantSizes.clear();
    this.variantColors.clear();
    try {
      const variants = this.product?.variants || [];
      variants.forEach(v => {
        const attrs = this.parseVariantAttributes(v);
        const size = attrs.size ? String(attrs.size).trim() : '';
        const color = attrs.color ? String(attrs.color).trim() : '';
        if (size) this.variantSizes.add(size);
        if (color) this.variantColors.add(color);
      });
      console.log('🧭 Opciones de variantes detectadas:', {
        sizes: Array.from(this.variantSizes),
        colors: Array.from(this.variantColors)
      });
    } catch (e) {
      console.warn('No se pudieron actualizar las opciones de variantes:', e);
    }
  }

  private parseVariantAttributes(v: any): { size?: string; color?: string } {
    const raw = v?.attributes;
    if (!raw) return {};
    try {
      const val = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!Array.isArray(val)) {
        const obj: any = val;
        const out: any = {};
        out.size = obj.size ?? obj.talla ?? obj.Size ?? obj.Talla ?? obj.SIZE ?? undefined;
        out.color = obj.color ?? obj.Color ?? obj.colour ?? obj.COLOUR ?? undefined;
        if (Array.isArray(obj.attributes)) {
          for (const item of obj.attributes) {
            const type = (item.type || item.name || '').toString().toLowerCase();
            const value = item.value ?? item.val ?? item.label ?? undefined;
            if (type.includes('size') || type.includes('talla')) out.size = value;
            if (type.includes('color') || type.includes('colour')) out.color = value;
          }
        }
        return out;
      }
      const out: any = {};
      (val as any[]).forEach((item: any) => {
        const type = (item.type || item.name || '').toString().toLowerCase();
        const value = item.value ?? item.val ?? item.label ?? undefined;
        if (type.includes('size') || type.includes('talla')) out.size = value;
        if (type.includes('color') || type.includes('colour')) out.color = value;
      });
      return out;
    } catch {
      return {};
    }
  }

  // Calcula stock base del producto sumando branch_products a nivel producto (sin variante)
  private computeProductBaseStock(product: Product): number {
    try {
      const branches = (product as any).branch_products as any[] | undefined;
      if (Array.isArray(branches) && branches.length > 0) {
        const sum = branches
          .filter(bp => (bp.product_variant_id === null || bp.product_variant_id === undefined) && bp.is_active !== false)
          .reduce((acc, bp) => acc + (Number(bp.stock) || 0), 0);
        if (sum > 0) return sum;
      }
    } catch {}
    // Fallback al stock_quantity del producto si no hay branch_products
    return Number(product.stock_quantity || 0);
  }

  // ===== Manejo de estado offline (defensa en profundidad) =====
  private isOnline(): boolean {
    try {
      return typeof navigator !== 'undefined' ? navigator.onLine : true;
    } catch {
      return true;
    }
  }

  private async showOfflineToast(): Promise<void> {
    if (this.offlineToastActive) return;
    this.offlineToastActive = true;

    const toast = await this.toastController.create({
      message: 'Sin conexión. No se puede cargar el detalle del producto.',
      duration: 2500,
      color: 'warning',
      position: 'top'
    });
    toast.onDidDismiss().then(() => {
      this.offlineToastActive = false;
    });
    await toast.present();
  }

  private async handleOfflineEntry(): Promise<void> {
    if (this.hasHandledOfflineEntry) return;
    this.hasHandledOfflineEntry = true;
    await this.showOfflineToast();
    this.navCtrl.navigateRoot(['/tabs/home'], {
      animated: true,
      animationDirection: 'back'
    });
  }

    calculateDiscount(price: string, comparePrice: string): number | undefined {
    if (!comparePrice || parseFloat(comparePrice) <= parseFloat(price)) {
      return undefined;
    }
    const discount = ((parseFloat(comparePrice) - parseFloat(price)) / parseFloat(comparePrice)) * 100;
    return Math.round(discount);
  }


  /**
   * Extrae las tallas disponibles del producto
   */
  extractAvailableSizes(product: any): string[] {
    const sizes: string[] = [];

    // Buscar en attributes
    if (product.attributes) {
      product.attributes.forEach((attr: any) => {
        if (attr.type === 'size' && !sizes.includes(attr.value)) {
          sizes.push(attr.value);
        }
      });
    }

    // Buscar en variants
    if (product.variants) {
      product.variants.forEach((variant: any) => {
        if (variant.attributes && variant.attributes.size && !sizes.includes(variant.attributes.size)) {
          sizes.push(variant.attributes.size);
        }
      });
    }

    // Ordenar tallas de manera lógica
    return this.sortSizes(sizes);
  }

  /**
   * Extrae los colores disponibles del producto
   */
  extractAvailableColors(product: any): string[] {
    const colors: string[] = [];

    // Buscar en attributes
    if (product.attributes) {
      product.attributes.forEach((attr: any) => {
        if (attr.type === 'color' && !colors.includes(attr.value)) {
          colors.push(attr.value);
        }
      });
    }

    // Buscar en variants
    if (product.variants) {
      product.variants.forEach((variant: any) => {
        if (variant.attributes && variant.attributes.color && !colors.includes(variant.attributes.color)) {
          colors.push(variant.attributes.color);
        }
      });
    }

    return colors;
  }

  /**
   * Ordena las tallas de manera lógica (XS, S, M, L, XL, XXL, etc.)
   */
  sortSizes(sizes: string[]): string[] {
    const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
    const numericSizes: string[] = [];
    const otherSizes: string[] = [];

    sizes.forEach(size => {
      if (sizeOrder.includes(size.toUpperCase())) {
        otherSizes.push(size);
      } else if (!isNaN(Number(size))) {
        numericSizes.push(size);
      } else {
        otherSizes.push(size);
      }
    });

    // Ordenar numéricos
    numericSizes.sort((a, b) => Number(a) - Number(b));

    // Ordenar por orden predefinido
    otherSizes.sort((a, b) => {
      const indexA = sizeOrder.indexOf(a.toUpperCase());
      const indexB = sizeOrder.indexOf(b.toUpperCase());
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    return [...numericSizes, ...otherSizes];
  }

  /**
   * Verifica si el producto tiene tallas
   */
  hasSizes(): boolean {
    return !!(this.product?.availableSizes && this.product.availableSizes.length > 0);
  }

  /**
   * Verifica si el producto tiene colores
   */
  hasColors(): boolean {
    return !!(this.product?.availableColors && this.product.availableColors.length > 0);
  }

  selectSize(size: string) {
    this.selectedSize = size;
    console.log('📏 Talla seleccionada:', size);
  }

  selectColor(color: string) {
    this.selectedColor = color;
    console.log('🎨 Color seleccionado:', color);
  }

  toggleFavorite() {
    if (this.product) {
      this.product.isFavorite = !this.product.isFavorite;
      console.log('❤️ Favorito cambiado:', this.product.isFavorite);
    }
  }

  addToCart() {
    if (!this.product) {
      console.error('❌ No hay producto para agregar al carrito');
      return;
    }

    // Verificar si faltan selecciones requeridas
    if (this.selectionMissing) {
      console.warn('⚠️ Debe seleccionar las opciones requeridas');
      this.showSelectionMissingToast();
      return;
    }

    // Prevenir múltiples clics
    if (this.addingToCart) {
      return;
    }

    // Determinar variantId de forma robusta
    const variantId = this.currentVariant?.id ?? this.getSelectedVariantId();

    // Si hay variantes físicas, exigir variantId válido SIEMPRE (aunque needs_variants venga en false)
    if (Array.isArray(this.product.variants) && this.product.variants.length > 0 && !variantId) {
      console.warn('⚠️ No hay una variante válida para la selección actual');
      this.showSelectionMissingToast();
      return;
    }

    const request: AddToCartRequest = {
      product_id: this.product.id,
      quantity: 1,
      product_variant_id: variantId,
      selected_attributes: {
        size: this.selectedSize,
        color: this.selectedColor
      }
    };

    console.log('🛒 Agregando al carrito:', request);

    // Activar estado de carga
    this.addingToCart = true;
    this.cdr.detectChanges();

    this.cartService.addToCart(request).subscribe({
      next: (cart) => {
        console.log('✅ Producto agregado al carrito exitosamente:', cart);

        // Desactivar estado de carga
        this.addingToCart = false;

        // Mostrar toast inmediatamente
        this.showSuccessToast();

        // Forzar detección de cambios
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('❌ Error agregando al carrito:', error);

        // Desactivar estado de carga en caso de error
        this.addingToCart = false;
        this.cdr.detectChanges();

        // Aquí podrías mostrar un toast de error
      }
    });
  }

  /**
   * Obtiene el ID de la variante seleccionada
   */
  getSelectedVariantId(): number | undefined {
    if (!this.product?.variants) return undefined;

    const parseAttrs = (v: any) => {
      const raw = v?.attributes;
      if (!raw) return {} as any;
      try {
        const val = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!Array.isArray(val)) {
          const obj: any = val;
          const out: any = {};
          out.size = obj.size ?? obj.talla ?? obj.Size ?? obj.Talla ?? obj.SIZE ?? undefined;
          out.color = obj.color ?? obj.Color ?? obj.colour ?? obj.COLOUR ?? undefined;
          if (Array.isArray(obj.attributes)) {
            for (const item of obj.attributes) {
              const type = (item.type || item.name || '').toString().toLowerCase();
              const value = item.value ?? item.val ?? item.label ?? undefined;
              if (type.includes('size') || type.includes('talla')) out.size = value;
              if (type.includes('color') || type.includes('colour')) out.color = value;
            }
          }
          return out;
        }
        const out: any = {};
        (val as any[]).forEach((item: any) => {
          const type = (item.type || item.name || '').toString().toLowerCase();
          const value = item.value ?? item.val ?? item.label ?? undefined;
          if (type.includes('size') || type.includes('talla')) out.size = value;
          if (type.includes('color') || type.includes('colour')) out.color = value;
        });
        return out;
      } catch {
        return {} as any;
      }
    };

    const variant = this.product.variants.find(v => {
      const attrs = parseAttrs(v);
      const hasMatchingSize = !this.selectedSize || attrs.size === this.selectedSize;
      const hasMatchingColor = !this.selectedColor || attrs.color === this.selectedColor;
      return hasMatchingSize && hasMatchingColor;
    });

    return variant?.id || undefined;
  }

  fromSearch = false;

  ngOnInit() {
    // Si entran directo al detalle sin conexión, salir con feedback
    if (!this.isOnline()) {
      this.handleOfflineEntry();
      return;
    }

    this.productId = this.route.snapshot.paramMap.get('id');
    this.route.queryParams.subscribe(params => {
      this.fromSearch = params['from'] === 'search';
    });
    this.loadProduct();
  }

  goBack() {
    // Oculta la action bar y otros elementos fijos antes de navegar
    this.showContent = false;
    this.cdr.detectChanges();
    setTimeout(() => {
      if (window.history.length > 2) {
        this.navCtrl.back();
      } else if (this.fromSearch) {
        this.navCtrl.navigateRoot(['/tabs/search'], {
          animated: true,
          animationDirection: 'back'
        });
      } else {
        this.navCtrl.navigateRoot(['/tabs/home'], {
          animated: true,
          animationDirection: 'back'
        });
      }
    }, 10);
  }

  /**
   * Muestra el toast de éxito al agregar al carrito
   */
  showSuccessToast() {
    if (this.product) {
      // Primero ocultar el toast si está visible
      this.showToast = false;
      this.cdr.detectChanges();

      // Luego configurar los datos del toast
      this.toastProductName = this.product.name;
      this.toastProductImage = this.product.image || '/assets/images/no-image.png';
      this.toastSelectedSize = this.selectedSize || '';
      this.toastSelectedColor = this.selectedColor || '';
      this.toastPrice = parseFloat(this.currentPrice);

      // Usar setTimeout para asegurar que el cambio se detecte
      setTimeout(() => {
        this.showToast = true;
        this.cdr.detectChanges();

        console.log('🎉 Toast mostrado:', {
          show: this.showToast,
          productName: this.toastProductName,
          price: this.toastPrice
        });
      }, 50); // Pequeño delay para asegurar el reset
    }
  }

  /**
   * Cierra el toast
   */
  closeToast() {
    this.showToast = false;
  }

  private async showSelectionMissingToast(): Promise<void> {
    const needs: string[] = [];
    if (this.requiresSize && !this.selectedSize) needs.push('talla');
    if (this.requiresColor && !this.selectedColor) needs.push('color');
    const message = needs.length > 1
      ? `Selecciona ${needs.join(' y ')}`
      : `Selecciona ${needs[0]}`;

    const toast = await this.toastController.create({
      message,
      duration: 2200,
      color: 'medium',
      position: 'top'
    });
    await toast.present();
  }


  onVariantSelectionChange(selection: VariantSelection) {
    console.log('🔄 Variante seleccionada:', selection);
    this.currentVariant = selection.variant || null;
    this.currentPrice = selection.price || this.product?.price || '0';
    this.currentStock = selection.stock || 0;
    this.selectedSize = selection.size || null;
    this.selectedColor = selection.color || null;
    console.log('🧮 Stock actualizado desde variante:', {
      from: 'variant',
      variantId: this.currentVariant?.id,
      size: this.selectedSize,
      color: this.selectedColor,
      currentStock: this.currentStock
    });
  }

  onVariantChange(variant: ProductVariant | null) {
    console.log('🔄 Variante cambiada:', variant);
    this.currentVariant = variant;
  }
}

