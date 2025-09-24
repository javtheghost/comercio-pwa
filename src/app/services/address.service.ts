import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { Address, CreateAddressRequest, UpdateAddressRequest, AddressResponse } from '../interfaces/address.interfaces';

@Injectable({
  providedIn: 'root'
})
export class AddressService {
  private readonly API_URL = environment.apiUrl;
  private addressesSubject = new BehaviorSubject<Address[]>([]);
  public addresses$ = this.addressesSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Obtener todas las direcciones del usuario
   */
  getUserAddresses(): Observable<AddressResponse> {
    const req$ = this.http.get<AddressResponse>(`${this.API_URL}/addresses`);
    // Actualizar stream cuando cargamos listado
    req$.subscribe({
      next: (res) => {
        if (res && res.success) {
          const list = Array.isArray(res.data) ? (res.data as Address[]) : [];
          this.addressesSubject.next(list);
        }
      },
      error: () => {
        // No actualizar stream en error
      }
    });
    return req$;
  }

  /**
   * Obtener una dirección específica
   */
  getAddress(id: number): Observable<AddressResponse> {
    return this.http.get<AddressResponse>(`${this.API_URL}/addresses/${id}`);
  }

  /**
   * Crear una nueva dirección
   */
  createAddress(addressData: CreateAddressRequest): Observable<AddressResponse> {
    console.log('AddressService - Enviando datos:', addressData);
    const req$ = this.http.post<AddressResponse>(`${this.API_URL}/addresses`, addressData);
    req$.subscribe({
      next: (res) => {
        if (res && res.success && res.data && !Array.isArray(res.data)) {
          const current = this.addressesSubject.value;
          this.addressesSubject.next([res.data as Address, ...current]);
        }
      }
    });
    return req$;
  }

  /**
   * Actualizar una dirección existente
   */
  updateAddress(addressData: UpdateAddressRequest): Observable<AddressResponse> {
    const req$ = this.http.put<AddressResponse>(`${this.API_URL}/addresses/${addressData.id}`, addressData);
    req$.subscribe({
      next: (res) => {
        if (res && res.success && res.data && !Array.isArray(res.data)) {
          const updated = res.data as Address;
          const list = this.addressesSubject.value.slice();
          const idx = list.findIndex(a => a.id === updated.id);
          if (idx !== -1) {
            list[idx] = updated;
            this.addressesSubject.next(list);
          }
        }
      }
    });
    return req$;
  }

  /**
   * Eliminar una dirección
   */
  deleteAddress(id: number): Observable<AddressResponse> {
    const req$ = this.http.delete<AddressResponse>(`${this.API_URL}/addresses/${id}`);
    req$.subscribe({
      next: (res) => {
        if (res && res.success) {
          const list = this.addressesSubject.value.filter(a => a.id !== id);
          this.addressesSubject.next(list);
        }
      }
    });
    return req$;
  }

  /**
   * Establecer una dirección como predeterminada
   */
  setDefaultAddress(id: number): Observable<AddressResponse> {
    const req$ = this.http.post<AddressResponse>(`${this.API_URL}/addresses/${id}/set-default`, {});
    req$.subscribe({
      next: (res) => {
        if (res && res.success && res.data && !Array.isArray(res.data)) {
          // Suponemos que la API regresa la dirección marcada como predeterminada
          const updated = res.data as Address;
          const list = this.addressesSubject.value.map(a => ({ ...a, is_default: a.id === updated.id }));
          // Si no está en la lista, insertar
          const exists = list.some(a => a.id === updated.id);
          const finalList = exists ? list : [updated, ...list];
          this.addressesSubject.next(finalList);
        }
      }
    });
    return req$;
  }

  /**
   * Obtener direcciones de envío
   */
  getShippingAddresses(): Observable<AddressResponse> {
    return this.http.get<AddressResponse>(`${this.API_URL}/addresses?type=shipping`);
  }

  /**
   * Obtener direcciones de facturación
   */
  getBillingAddresses(): Observable<AddressResponse> {
    return this.http.get<AddressResponse>(`${this.API_URL}/addresses?type=billing`);
  }

  /**
   * Validar datos de dirección
   */
  validateAddressData(address: Partial<Address>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!address.first_name?.trim()) {
      errors.push('El nombre es requerido');
    }

    if (!address.last_name?.trim()) {
      errors.push('El apellido es requerido');
    }

    if (!address.address_line_1?.trim()) {
      errors.push('La dirección es requerida');
    }

    if (!address.city?.trim()) {
      errors.push('La ciudad es requerida');
    }

    if (!address.state?.trim()) {
      errors.push('El estado es requerido');
    }

    if (!address.postal_code?.trim()) {
      errors.push('El código postal es requerido');
    }

    if (!address.country?.trim()) {
      errors.push('El país es requerido');
    }

    if (!address.phone?.trim()) {
      errors.push('El teléfono es requerido');
    }

    // Validar formato de teléfono (básico)
    if (address.phone && !/^[\d\s\-\+\(\)]+$/.test(address.phone)) {
      errors.push('El formato del teléfono no es válido');
    }

    // Validar código postal (básico)
    if (address.postal_code && !/^\d{5}$/.test(address.postal_code)) {
      errors.push('El código postal debe tener 5 dígitos');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Formatear dirección para mostrar
   */
  formatAddress(address: Address): string {
    let fullAddress = address.address_line_1;
    if (address.address_line_2) {
      fullAddress += `, ${address.address_line_2}`;
    }
    fullAddress += `, ${address.city}, ${address.state} ${address.postal_code}, ${address.country}`;
    return fullAddress;
  }

  /**
   * Obtener dirección predeterminada
   */
  getDefaultAddress(addresses: Address[]): Address | null {
    return addresses.find(addr => addr.is_default) || addresses[0] || null;
  }
}
