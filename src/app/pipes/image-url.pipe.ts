import { Pipe, PipeTransform } from '@angular/core';
import { environment } from '../../environments/environment';

@Pipe({
  name: 'imageUrl',
  standalone: true
})
export class ImageUrlPipe implements PipeTransform {
  transform(value: string | null | undefined, fallback: string = '/assets/images/no-image.png'): string {
    if (!value) {
      return fallback;
    }

    // Si ya es una URL completa (http/https), devolverla tal cual
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }

    // Si es una URL de Unsplash u otra CDN, devolverla tal cual
    if (value.includes('unsplash.com') || value.includes('images.')) {
      return value;
    }

    // Obtener la URL base del backend (sin /api)
    const backendBase = environment.apiUrl.replace(/\/api\/?$/, '');

    // Si comienza con /storage/, construir URL completa del backend
    if (value.startsWith('/storage/')) {
      return `${backendBase}${value}`;
    }

    // Si comienza con storage/ (sin barra inicial), agregar barra y construir URL
    if (value.startsWith('storage/')) {
      return `${backendBase}/${value}`;
    }

    // Si comienza con /products/, construir URL con /storage/products/
    if (value.startsWith('/products/')) {
      const fileName = value.substring('/products/'.length);
      return `${backendBase}/storage/products/${fileName}`;
    }

    // Si comienza con products/ (sin barra inicial), construir URL con /storage/products/
    if (value.startsWith('products/')) {
      const fileName = value.substring('products/'.length);
      return `${backendBase}/storage/products/${fileName}`;
    }

    // Si comienza con /, asumir que es storage y construir URL del backend
    if (value.startsWith('/')) {
      return `${backendBase}/storage${value}`;
    }

    // Si es solo el nombre del archivo o ruta relativa, construir URL completa
    return `${backendBase}/storage/products/${value}`;
  }
}
