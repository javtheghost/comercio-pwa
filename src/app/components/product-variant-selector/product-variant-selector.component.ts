import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonButton, IonIcon, IonChip, IonLabel, IonGrid, IonRow, IonCol } from '@ionic/angular/standalone';
import { ProductVariant, ProductAttribute } from '../../interfaces/product.interfaces';

export interface VariantSelection {
  size?: string;
  color?: string;
  variant?: ProductVariant;
  price?: string;
  stock?: number;
  image?: string;
}

@Component({
  selector: 'app-product-variant-selector',
  standalone: true,
  imports: [
    CommonModule,
    IonButton,
    IonIcon,
    IonChip,
    IonLabel,
    IonGrid,
    IonRow,
    IonCol
  ],
  templateUrl: './product-variant-selector.component.html',
  styleUrls: ['./product-variant-selector.component.scss']
})
export class ProductVariantSelectorComponent implements OnInit, OnChanges {
  @Input() variants: ProductVariant[] = [];
  @Input() attributes: ProductAttribute[] = [];
  @Input() basePrice: string = '0';
  @Input() baseImage: string = '';
  @Input() selectedSize: string | null = null;
  @Input() selectedColor: string | null = null;

  @Output() selectionChange = new EventEmitter<VariantSelection>();
  @Output() variantChange = new EventEmitter<ProductVariant | null>();

  availableSizes: string[] = [];
  availableColors: string[] = [];
  filteredVariants: ProductVariant[] = [];
  currentVariant: ProductVariant | null = null;
  currentPrice: string = '';
  currentStock: number = 0;
  currentImage: string = '';

  // Mapeo de colores a códigos hex
  colorMap: { [key: string]: string } = {
    'Negro': '#000000',
    'Blanco': '#FFFFFF',
    'Rojo': '#FF0000',
    'Azul': '#0000FF',
    'Verde': '#008000',
    'Rosa': '#FFC0CB',
    'Amarillo': '#FFFF00',
    'Gris': '#808080',
    'Marrón': '#8B4513',
    'Naranja': '#FFA500',
    'Morado': '#800080',
    'Celeste': '#87CEEB'
  };

  ngOnInit() {
    this.initializeVariants();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['variants'] || changes['attributes']) {
      this.initializeVariants();
    }
  }

  initializeVariants() {
    this.extractAvailableOptions();
    this.filterVariants();
    this.updateCurrentSelection();
  }

  extractAvailableOptions() {
    const sizes = new Set<string>();
    const colors = new Set<string>();

    // Extraer de variants
    this.variants.forEach(variant => {
      if (variant.attributes) {
        const attrs = typeof variant.attributes === 'string'
          ? JSON.parse(variant.attributes)
          : variant.attributes;

        if (attrs.size) sizes.add(attrs.size);
        if (attrs.color) colors.add(attrs.color);
      }
    });

    // Extraer de attributes
    this.attributes.forEach(attr => {
      if (attr.type === 'size' && attr.value) {
        attr.value.split(',').forEach(size => sizes.add(size.trim()));
      }
      if (attr.type === 'color' && attr.value) {
        colors.add(attr.value);
      }
    });

    this.availableSizes = this.sortSizes(Array.from(sizes));
    this.availableColors = Array.from(colors);

    // Seleccionar primera opción por defecto
    if (this.availableSizes.length > 0 && !this.selectedSize) {
      this.selectedSize = this.availableSizes[0];
    }
    if (this.availableColors.length > 0 && !this.selectedColor) {
      this.selectedColor = this.availableColors[0];
    }
  }

  filterVariants() {
    this.filteredVariants = this.variants.filter(variant => {
      if (!variant.attributes) return false;

      const attrs = typeof variant.attributes === 'string'
        ? JSON.parse(variant.attributes)
        : variant.attributes;

      const sizeMatch = !this.selectedSize || attrs.size === this.selectedSize;
      const colorMatch = !this.selectedColor || attrs.color === this.selectedColor;

      return sizeMatch && colorMatch;
    });
  }

  updateCurrentSelection() {
    if (this.filteredVariants.length > 0) {
      this.currentVariant = this.filteredVariants[0];
      this.currentPrice = this.currentVariant.price || this.basePrice;
      this.currentStock = this.currentVariant.stock_quantity || 0;
      this.currentImage = this.getVariantImage(this.currentVariant);
    } else {
      this.currentVariant = null;
      this.currentPrice = this.basePrice;
      this.currentStock = 0;
      this.currentImage = this.baseImage;
    }

    this.emitSelection();
  }

  getVariantImage(variant: ProductVariant): string {
    // Aquí podrías implementar lógica para obtener imagen específica por variante
    // Por ahora retornamos la imagen base
    return this.baseImage;
  }

  selectSize(size: string) {
    this.selectedSize = size;
    this.filterVariants();
    this.updateCurrentSelection();
  }

  selectColor(color: string) {
    this.selectedColor = color;
    this.filterVariants();
    this.updateCurrentSelection();
  }

  getColorHex(color: string): string {
    return this.colorMap[color] || '#CCCCCC';
  }

  isSizeAvailable(size: string): boolean {
    return this.variants.some(variant => {
      if (!variant.attributes) return false;
      const attrs = typeof variant.attributes === 'string'
        ? JSON.parse(variant.attributes)
        : variant.attributes;
      return attrs.size === size;
    });
  }

  isColorAvailable(color: string): boolean {
    return this.variants.some(variant => {
      if (!variant.attributes) return false;
      const attrs = typeof variant.attributes === 'string'
        ? JSON.parse(variant.attributes)
        : variant.attributes;
      return attrs.color === color;
    });
  }

  getStockForSize(size: string): number {
    const variant = this.variants.find(v => {
      if (!v.attributes) return false;
      const attrs = typeof v.attributes === 'string'
        ? JSON.parse(v.attributes)
        : v.attributes;
      return attrs.size === size;
    });
    return variant?.stock_quantity || 0;
  }

  getStockForColor(color: string): number {
    const variant = this.variants.find(v => {
      if (!v.attributes) return false;
      const attrs = typeof v.attributes === 'string'
        ? JSON.parse(v.attributes)
        : v.attributes;
      return attrs.color === color;
    });
    return variant?.stock_quantity || 0;
  }

  isOutOfStock(): boolean {
    return this.currentStock <= 0;
  }

  isLowStock(): boolean {
    return this.currentStock > 0 && this.currentStock <= 5;
  }

  getStockStatus(): string {
    if (this.isOutOfStock()) return 'Agotado';
    if (this.isLowStock()) return `Solo ${this.currentStock} disponibles`;
    return 'En stock';
  }

  getStockStatusColor(): string {
    if (this.isOutOfStock()) return 'danger';
    if (this.isLowStock()) return 'warning';
    return 'success';
  }

  private sortSizes(sizes: string[]): string[] {
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

    numericSizes.sort((a, b) => Number(a) - Number(b));

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

  private emitSelection() {
    const selection: VariantSelection = {
      size: this.selectedSize || undefined,
      color: this.selectedColor || undefined,
      variant: this.currentVariant || undefined,
      price: this.currentPrice,
      stock: this.currentStock,
      image: this.currentImage
    };

    this.selectionChange.emit(selection);
    this.variantChange.emit(this.currentVariant);
  }

  hasVariants(): boolean {
    return this.variants.length > 0;
  }

  hasSizes(): boolean {
    return this.availableSizes.length > 0;
  }

  hasColors(): boolean {
    return this.availableColors.length > 0;
  }

  getVariantSpecs(variant: ProductVariant): string {
    if (!variant.attributes) return '';

    const attrs = typeof variant.attributes === 'string'
      ? JSON.parse(variant.attributes)
      : variant.attributes;

    const specs = [];
    if (attrs.material) specs.push(attrs.material);
    if (attrs.size) specs.push(`Talla ${attrs.size}`);
    if (attrs.color) specs.push(attrs.color);

    return specs.join(' • ');
  }
}
