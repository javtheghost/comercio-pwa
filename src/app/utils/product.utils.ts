import { Product, ProductUI, ProductImage } from '../interfaces/product.interfaces';

export class ProductUtils {
  static mapProductsToUI(products: Product[]): ProductUI[] {
    return products.map(product => ({
      ...product,
      isFavorite: false,
      image: product.images && product.images.length > 0 
        ? this.getImageUrl(product.images[0])
        : 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop&crop=center'
    }));
  }

  private static getImageUrl(image: ProductImage): string {
    // Priorizar full_image_url si está disponible, sino usar image_url
    return image.full_image_url || image.image_url || '';
  }
}

