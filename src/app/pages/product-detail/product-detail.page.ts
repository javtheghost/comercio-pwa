import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NavController } from '@ionic/angular';
import { Location } from '@angular/common';
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
import { CartService, AddToCartRequest } from '../../services/cart.service';
import { Product, ProductUI, ProductVariant, VariantInfo } from '../../interfaces/product.interfaces';
import { ProductVariantSelectorComponent, VariantSelection } from '../../components/product-variant-selector/product-variant-selector.component';
import { AddToCartToastComponent } from '../../components/add-to-cart-toast/add-to-cart-toast.component';

import { ChangeDetectionStrategy } from '@angular/core';
@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonIcon,
    ProductVariantSelectorComponent,
    AddToCartToastComponent,
    IonSpinner,
    NgIf
  ],
  templateUrl: './product-detail.page.html',
  styleUrls: ['./product-detail.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductDetailPage implements OnInit {
  selectedSize: string | null = null;
  selectedColor: string | null = null;
  product: ProductUI = {
    id: 0,
    category_id: 0,
    name: '',
    slug: '',
    sku: '',
    description: '',
    long_description: '',
    price: '',
    compare_price: '',
    cost_price: '',
    stock_quantity: 0,
    min_stock_level: 0,
    track_stock: false,
    is_active: false,
    is_featured: false,
    is_virtual: false,
    weight: '',
    status: '',
    created_at: '',
    updated_at: '',
    deleted_at: null,
    category: { id: 0, parent_id: null, name: '', slug: '', description: '', image: '', is_active: false, sort_order: 0, created_at: '', updated_at: '' },
    variants: [],
    images: [],
    attributes: [],
    discounts: [],
    isFavorite: false,
    image: '',
    originalPrice: '',
    discount: 0,
    availableSizes: [],
    availableColors: []
  };
  productId: string | null = null;
  loading = true;
  error: string | null = null;
  currentVariant: ProductVariant | null = null;
  currentPrice: string = '';
  currentStock: number = 0;
  variantInfo: VariantInfo | null = null;
  loadingVariants = false;
  // Toast properties
  showToast = false;
  toastProductName = '';
  toastProductImage = '';
  toastSelectedSize = '';
  toastSelectedColor = '';
  toastPrice = 0;
  // Loading state
  addingToCart = false;


  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService,
  private cartService: CartService,
  private cdr: ChangeDetectorRef,
  private location: Location,
  private navCtrl: NavController
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
        // Unificación de ambas ramas:
        const imageUrl = product.images && product.images.length > 0
          ? product.images[0].full_image_url || product.images[0].image_url
          : 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop&crop=center';

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

        // Seleccionar primera talla disponible por defecto si no hay selección
        if (variantInfo.available_sizes.length > 0 && !this.selectedSize) {
          this.selectedSize = variantInfo.available_sizes[0];
        }

        // Seleccionar primer color disponible por defecto si no hay selección
        if (variantInfo.available_colors.length > 0 && !this.selectedColor) {
          this.selectedColor = variantInfo.available_colors[0];
        }

        console.log('🎯 Tallas disponibles:', variantInfo.available_sizes);
        console.log('🎯 Colores disponibles:', variantInfo.available_colors);
        console.log('🎯 Talla seleccionada:', this.selectedSize);
        console.log('🎯 Color seleccionado:', this.selectedColor);
        console.log('🎯 Necesita variantes:', variantInfo.needs_variants);
        console.log('🎯 Tipo de tallas:', variantInfo.size_type);

        this.loadingVariants = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
  console.error('❌ Error al cargar información de variantes:', error);
  this.loadingVariants = false;
  this.cdr.markForCheck();
        // No es crítico, continuar sin información de variantes
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

    // Verificar si el producto requiere talla y no se ha seleccionado
    if (this.hasSizes() && !this.selectedSize) {
      console.warn('⚠️ Debe seleccionar una talla');
      // Aquí podrías mostrar un toast o alert
      return;
    }

    // Prevenir múltiples clics
    if (this.addingToCart) {
      return;
    }

    const request: AddToCartRequest = {
      product_id: this.product.id,
      quantity: 1,
      product_variant_id: this.getSelectedVariantId(),
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

    const variant = this.product.variants.find(v => {
      const hasMatchingSize = !this.selectedSize ||
        (v.attributes && v.attributes.size === this.selectedSize);
      const hasMatchingColor = !this.selectedColor ||
        (v.attributes && v.attributes.color === this.selectedColor);

      return hasMatchingSize && hasMatchingColor;
    });

    return variant?.id || undefined;
  }

  fromSearch = false;

  ngOnInit() {
    this.productId = this.route.snapshot.paramMap.get('id');
    this.route.queryParams.subscribe(params => {
      this.fromSearch = params['from'] === 'search';
    });
    this.loadProduct();
  }

  goBack() {
    if (this.fromSearch) {
      // Forzar animación de regreso (izquierda a derecha)
      this.navCtrl.navigateBack(['/tabs/search'], { animated: true, animationDirection: 'back' });
    } else {
      // También usar animación de regreso para Home
      this.navCtrl.navigateBack(['/tabs/home'], { animated: true, animationDirection: 'back' });
    }
  }

  /**
   * Muestra el toast de éxito al agregar al carrito
   */
  showSuccessToast() {
    if (this.product) {
      this.toastProductName = this.product.name;
      this.toastProductImage = this.product.image || '/assets/images/no-image.png';
      this.toastSelectedSize = this.selectedSize || '';
      this.toastSelectedColor = this.selectedColor || '';
      this.toastPrice = parseFloat(this.currentPrice);
      this.showToast = true;

      // Forzar detección de cambios inmediatamente
      this.cdr.detectChanges();

      console.log('🎉 Toast mostrado:', {
        show: this.showToast,
        productName: this.toastProductName,
        price: this.toastPrice
      });
    }
  }

  /**
   * Cierra el toast
   */
  closeToast() {
    this.showToast = false;
  }


  onVariantSelectionChange(selection: VariantSelection) {
    console.log('🔄 Variante seleccionada:', selection);
    this.currentVariant = selection.variant || null;
    this.currentPrice = selection.price || this.product?.price || '0';
    this.currentStock = selection.stock || 0;
    this.selectedSize = selection.size || null;
    this.selectedColor = selection.color || null;
  }

  onVariantChange(variant: ProductVariant | null) {
    console.log('🔄 Variante cambiada:', variant);
    this.currentVariant = variant;
  }
}

