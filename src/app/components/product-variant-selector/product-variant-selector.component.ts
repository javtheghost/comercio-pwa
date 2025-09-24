import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonButton, IonIcon, IonChip, IonLabel, IonGrid, IonRow, IonCol } from '@ionic/angular/standalone';
import { ProductVariant, ProductAttribute, BranchProduct, AttributeAssignment } from '../../interfaces/product.interfaces';

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
  @Input() attributeAssignments: AttributeAssignment[] | null = null;
  @Input() basePrice: string = '0';
  @Input() baseImage: string = '';
  // Base stock del producto cuando no hay variantes o no aplica stock por variante
  @Input() baseStock: number = 0;
  // Inventario por sucursal para complementar stock por variante
  @Input() branchProducts: BranchProduct[] | null = null;
  @Input() selectedSize: string | null = null;
  @Input() selectedColor: string | null = null;
  // Overrides para mostrar opciones disponibles aunque no existan variantes físicas
  @Input() availableSizesOverride: string[] | null = null;
  @Input() availableColorsOverride: string[] | null = null;

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
    this.ensureValidSelections();
    this.filterVariants();
    this.updateCurrentSelection();
  }

  extractAvailableOptions() {
    const sizes = new Set<string>();
    const colors = new Set<string>();

    const hasVariants = Array.isArray(this.variants) && this.variants.length > 0;

    // 1) Siempre incluir lo que venga de variantes físicas
    if (hasVariants) {
      this.variants.forEach(variant => {
        const attrs = this.parseAttrs(variant);
        if (attrs.size) sizes.add(String(attrs.size).trim());
        if (attrs.color) colors.add(String(attrs.color).trim());
      });
    }

    // 2) Unir overrides de backend (variant-info) si existen
    if (this.availableSizesOverride && this.availableSizesOverride.length > 0) {
      this.availableSizesOverride.forEach(s => sizes.add(String(s).trim()));
    }
    if (this.availableColorsOverride && this.availableColorsOverride.length > 0) {
      this.availableColorsOverride.forEach(c => colors.add(String(c).trim()));
    }

    // 3) También unir atributos declarativos simples (por compatibilidad)
    this.attributes.forEach(attr => {
      if (attr.type === 'size' && attr.value) {
        attr.value.split(',').forEach(size => sizes.add(size.trim()));
      }
      if (attr.type === 'color' && attr.value) {
        attr.value.split(',').forEach(color => colors.add(color.trim()));
      }
    });

    // 4) Unir attribute_assignments (valores activos definidos en el producto)
    (this.attributeAssignments || []).forEach(assign => {
      const slug = (assign.attribute?.slug || '').toLowerCase();
      if (slug.includes('talla') || slug.includes('size')) {
        (assign.attribute.active_values || []).forEach(v => sizes.add(String(v.value).trim()));
      }
      if (slug.includes('color') || slug.includes('colour')) {
        (assign.attribute.active_values || []).forEach(v => colors.add(String(v.value).trim()));
      }
    });

    // Si existen variantes reales con colores/tallas específicas, filtrar placeholders como "Único"/"Talla única"/"Varios"
    const hasRealVariantSizes = hasVariants && this.variants.some(v => {
      const a = this.parseAttrs(v);
      const val = (a.size || '').toString().trim();
      return val && !this.isPlaceholderSize(val);
    });

    const hasRealVariantColors = hasVariants && this.variants.some(v => {
      const a = this.parseAttrs(v);
      const val = (a.color || '').toString().trim();
      return val && !this.isPlaceholderColor(val);
    });

    let sizeList = Array.from(sizes);
    let colorList = Array.from(colors);

    if (hasRealVariantSizes) {
      sizeList = sizeList.filter(s => !this.isPlaceholderSize(s));
    }
    if (hasRealVariantColors) {
      colorList = colorList.filter(c => !this.isPlaceholderColor(c));
    }

    this.availableSizes = this.sortSizes(sizeList);
    this.availableColors = colorList;

    // Seleccionar primera opción por defecto si no hay selección previa
    if (this.availableSizes.length > 0 && !this.selectedSize) {
      this.selectedSize = this.availableSizes[0];
    }
    if (this.availableColors.length > 0 && !this.selectedColor) {
      this.selectedColor = this.availableColors[0];
    }
  }

  private isPlaceholderSize(v: string): boolean {
    const val = (v || '').toString().toLowerCase();
    return val.includes('talla única') || val === 'única' || val === 'unica' || val === 'único' || val === 'unico' || val === 'varios' || val === 'varias';
  }

  private isPlaceholderColor(v: string): boolean {
    const val = (v || '').toString().toLowerCase();
    return val === 'único' || val === 'unico' || val === 'default' || val === 'varios' || val === 'varias';
  }

  private ensureValidSelections() {
    const hasVariants = Array.isArray(this.variants) && this.variants.length > 0;
    if (!hasVariants) return; // sin variantes físicas aceptamos cualquier selección

    // Si hay selección de color pero la talla actual no es compatible, elegir la primera talla compatible
    if (this.selectedColor && (!this.selectedSize || !this.isSizeCompatible(this.selectedSize))) {
      const firstCompatibleSize = this.availableSizes.find(s => this.isSizeSelectable(s));
      if (firstCompatibleSize) this.selectedSize = firstCompatibleSize;
    }

    // Si hay selección de talla pero el color actual no es compatible, elegir el primer color compatible
    if (this.selectedSize && (!this.selectedColor || !this.isColorCompatible(this.selectedColor))) {
      const firstCompatibleColor = this.availableColors.find(c => this.isColorSelectable(c));
      if (firstCompatibleColor) this.selectedColor = firstCompatibleColor;
    }

    // Si no hay ninguna selección, inicializar con la primera variante física
    if (!this.selectedSize && !this.selectedColor && this.variants.length > 0) {
      // buscar primera variante con stock > 0
      const firstInStock = this.variants.find(v => this.getVariantEffectiveStock(v) > 0) || this.variants[0];
      const attrs = this.parseAttrs(firstInStock);
      if (attrs.size) this.selectedSize = String(attrs.size);
      if (attrs.color) this.selectedColor = String(attrs.color);
    }
  }

  filterVariants() {
    this.filteredVariants = this.variants.filter(variant => {
      const attrs = this.parseAttrs(variant);

      const sizeMatch = !this.selectedSize || attrs.size === this.selectedSize;
      const colorMatch = !this.selectedColor || attrs.color === this.selectedColor;

      return sizeMatch && colorMatch;
    });
  }

  updateCurrentSelection() {
    if (this.filteredVariants.length > 0) {
      // Selección válida
      this.currentVariant = this.filteredVariants[0];
      this.currentPrice = this.currentVariant.price || this.basePrice;
      const direct = this.currentVariant.stock_quantity || 0;
      if (direct > 0) {
        this.currentStock = direct;
      } else {
        const sumBranch = (this.branchProducts || [])
          .filter(bp => bp.product_variant_id === this.currentVariant!.id && bp.is_active !== false)
          .reduce((s, bp) => s + (bp.stock || 0), 0);
        this.currentStock = sumBranch;
      }
      this.currentImage = this.getVariantImage(this.currentVariant);
      console.log('[VariantSelector] Stock desde variante válida:', this.currentStock, {
        size: this.selectedSize,
        color: this.selectedColor,
        variantId: this.currentVariant.id
      });
    } else if (this.variants.length > 0) {
      // No existe una variante que coincida con la combinación actual; mantener selección y stock 0
      this.currentVariant = null;
      this.currentPrice = this.basePrice;
      this.currentStock = 0;
      this.currentImage = this.baseImage;
      console.warn('[VariantSelector] Combinación inexistente. Manteniendo selección y stock=0:', {
        selectedSize: this.selectedSize,
        selectedColor: this.selectedColor
      });
    } else {
      // Sin variantes: permitir selección basada en overrides/atributos
      this.currentVariant = null;
      this.currentPrice = this.basePrice;
      // Usar baseStock como referencia de disponibilidad
      this.currentStock = this.baseStock;
      this.currentImage = this.baseImage;
      console.log('[VariantSelector] Sin variantes físicas. Usando baseStock para disponibilidad:', this.baseStock);
    }

    this.emitSelection();
  }

  private parseAttrs(variant: ProductVariant): any {
    if (!variant || !variant.attributes) return {};
    try {
      const raw = typeof variant.attributes === 'string'
        ? JSON.parse(variant.attributes)
        : variant.attributes;

      // Caso: objeto simple con posibles claves variadas
      if (!Array.isArray(raw)) {
        const obj = raw as any;
        const out: any = {};
        // Soportar claves en distintos idiomas/casos
        out.size = obj.size ?? obj.talla ?? obj.Size ?? obj.Talla ?? obj.SIZE ?? undefined;
        out.color = obj.color ?? obj.Color ?? obj.colour ?? obj.COLOUR ?? undefined;
        out.material = obj.material ?? obj.Material ?? undefined;

        // Caso: atributos anidados como array en obj.attributes
        const arr = Array.isArray(obj.attributes) ? obj.attributes : undefined;
        if (arr) {
          for (const item of arr) {
            const type = (item.type || item.name || '').toString().toLowerCase();
            const value = item.value ?? item.val ?? item.label ?? undefined;
            if (type.includes('size') || type.includes('talla')) out.size = value;
            if (type.includes('color') || type.includes('colour')) out.color = value;
            if (type.includes('material')) out.material = value;
          }
        }
        return out;
      }

      // Caso: array de atributos [{type/name, value}]
      const out: any = {};
      (raw as any[]).forEach((item: any) => {
        const type = (item.type || item.name || '').toString().toLowerCase();
        const value = item.value ?? item.val ?? item.label ?? undefined;
        if (type.includes('size') || type.includes('talla')) out.size = value;
        if (type.includes('color') || type.includes('colour')) out.color = value;
        if (type.includes('material')) out.material = value;
      });
      return out;
    } catch (e) {
      console.error('[VariantSelector] Error parseando atributos de variante:', variant.attributes, e);
      return {};
    }
  }

  private findBestFallbackVariant(): ProductVariant {
    // Priorizar una variante que coincida con size o color seleccionado
    const bySize = this.selectedSize
      ? this.variants.find(v => this.parseAttrs(v).size === this.selectedSize)
      : undefined;
    if (bySize) return bySize;

    const byColor = this.selectedColor
      ? this.variants.find(v => this.parseAttrs(v).color === this.selectedColor)
      : undefined;
    if (byColor) return byColor;

    // Si no hay coincidencia parcial, tomar la primera variante
    return this.variants[0];
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
    return this.variants.some(variant => this.parseAttrs(variant).size === size);
  }

  isColorAvailable(color: string): boolean {
    return this.variants.some(variant => this.parseAttrs(variant).color === color);
  }

  // Compatible significa que existe una variante que respete esta opción
  // y la otra selección actual (si existe). Si no hay variantes físicas,
  // permitimos seleccionar para que el usuario configure talla/color.
  isSizeCompatible(size: string): boolean {
    if (!this.variants || this.variants.length === 0) return true;
    return this.variants.some(v => {
      const a = this.parseAttrs(v);
      const sizeOk = a.size === size;
      const colorOk = !this.selectedColor || a.color === this.selectedColor;
      return sizeOk && colorOk;
    });
  }

  isColorCompatible(color: string): boolean {
    if (!this.variants || this.variants.length === 0) return true;
    return this.variants.some(v => {
      const a = this.parseAttrs(v);
      const colorOk = a.color === color;
      const sizeOk = !this.selectedSize || a.size === this.selectedSize;
      return colorOk && sizeOk;
    });
  }

  // Selectable = existe una variante con esa opción y stock > 0 (conservador)
  isSizeSelectable(size: string): boolean {
    if (!this.variants || this.variants.length === 0) return true;
    const matching = this.variants.filter(v => {
      const a = this.parseAttrs(v);
      const sizeOk = a.size === size;
      const colorOk = !this.selectedColor || a.color === this.selectedColor;
      return sizeOk && colorOk;
    });
    if (matching.length === 0) return false;
    return matching.some(v => this.getVariantEffectiveStock(v) > 0);
  }

  isColorSelectable(color: string): boolean {
    if (!this.variants || this.variants.length === 0) return true;
    const matching = this.variants.filter(v => {
      const a = this.parseAttrs(v);
      const colorOk = a.color === color;
      const sizeOk = !this.selectedSize || a.size === this.selectedSize;
      return colorOk && sizeOk;
    });
    if (matching.length === 0) return false;
    return matching.some(v => this.getVariantEffectiveStock(v) > 0);
  }

  private getVariantEffectiveStock(v: ProductVariant): number {
    const direct = v.stock_quantity || 0;
    if (direct > 0) return direct;
    const sumBranch = (this.branchProducts || [])
      .filter(bp => bp.product_variant_id === v.id && bp.is_active !== false)
      .reduce((s, bp) => s + (bp.stock || 0), 0);
    return sumBranch;
  }

  getStockForSize(size: string): number {
    if (!this.variants || this.variants.length === 0) return this.baseStock;
    const matches = this.variants.filter(v => {
      const a = this.parseAttrs(v);
      const sizeOk = a.size === size;
      const colorOk = !this.selectedColor || a.color === this.selectedColor;
      return sizeOk && colorOk;
    });
    if (matches.length === 0) return 0;
    // Calcular stock real sumando branchProducts si stock_quantity es 0
    const calcVariantStock = (v: ProductVariant) => {
      const direct = v.stock_quantity || 0;
      if (direct > 0) return direct;
      const sumBranch = (this.branchProducts || [])
        .filter(bp => bp.product_variant_id === v.id && bp.is_active !== false)
        .reduce((s, bp) => s + (bp.stock || 0), 0);
      return sumBranch;
    };
    if (this.selectedColor) {
      return calcVariantStock(matches[0]);
    }
    return matches.reduce((sum, v) => sum + calcVariantStock(v), 0);
  }

  getStockForColor(color: string): number {
    if (!this.variants || this.variants.length === 0) return this.baseStock;
    const matches = this.variants.filter(v => {
      const a = this.parseAttrs(v);
      const colorOk = a.color === color;
      const sizeOk = !this.selectedSize || a.size === this.selectedSize;
      return colorOk && sizeOk;
    });
    if (matches.length === 0) return 0;
    const calcVariantStock = (v: ProductVariant) => {
      const direct = v.stock_quantity || 0;
      if (direct > 0) return direct;
      const sumBranch = (this.branchProducts || [])
        .filter(bp => bp.product_variant_id === v.id && bp.is_active !== false)
        .reduce((s, bp) => s + (bp.stock || 0), 0);
      return sumBranch;
    };
    if (this.selectedSize) {
      return calcVariantStock(matches[0]);
    }
    return matches.reduce((sum, v) => sum + calcVariantStock(v), 0);
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
