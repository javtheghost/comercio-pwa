import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Address, CreateAddressRequest, UpdateAddressRequest, AddressResponse } from '../interfaces/address.interfaces';

@Injectable({
  providedIn: 'root'
})
export class AddressService {
  private readonly API_URL = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Obtener todas las direcciones del usuario
   */
  getUserAddresses(): Observable<AddressResponse> {
    return this.http.get<AddressResponse>(`${this.API_URL}/addresses`);
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
    return this.http.post<AddressResponse>(`${this.API_URL}/addresses`, addressData);
  }

  /**
   * Actualizar una dirección existente
   */
  updateAddress(addressData: UpdateAddressRequest): Observable<AddressResponse> {
    return this.http.put<AddressResponse>(`${this.API_URL}/addresses/${addressData.id}`, addressData);
  }

  /**
   * Eliminar una dirección
   */
  deleteAddress(id: number): Observable<AddressResponse> {
    return this.http.delete<AddressResponse>(`${this.API_URL}/addresses/${id}`);
  }

  /**
   * Establecer una dirección como predeterminada
   */
  setDefaultAddress(id: number): Observable<AddressResponse> {
    return this.http.post<AddressResponse>(`${this.API_URL}/addresses/${id}/set-default`, {});
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
