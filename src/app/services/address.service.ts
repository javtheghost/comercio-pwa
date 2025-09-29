import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, firstValueFrom, catchError, of, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Address, CreateAddressRequest, UpdateAddressRequest, AddressResponse } from '../interfaces/address.interfaces';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AddressService {
  private readonly API_URL = environment.apiUrl;
  private addressesSubject = new BehaviorSubject<Address[]>([]);
  public addresses$ = this.addressesSubject.asObservable();

  constructor(private http: HttpClient, private authService: AuthService) {}

  /**
   * Obtener todas las direcciones del usuario
   */
  getUserAddresses(): Observable<AddressResponse> {
    // Evitar llamadas si no hay sesión
    if (!this.authService.isAuthenticated()) {
      const empty = { success: true, message: null, data: [] } as any;
      // limpiar stream
      this.addressesSubject.next([]);
      return of(empty);
    }
    // Intento principal: /addresses (autodetecta el usuario autenticado)
    const primary$ = this.http.get<AddressResponse>(`${this.API_URL}/addresses`);

    const enhanced$ = primary$.pipe(
      catchError(err => {
        // Silenciar 401 devolviendo lista vacía
        if (err?.status === 401) {
          const empty = { success: true, message: null, data: [] } as any;
          return of(empty);
        }
        // Fallback: intentar rutas alternativas si existen diferencias en el backend
        const currentUser: any = this.authService.getCurrentUserValue();
        const userId: number | null = currentUser?.id ?? null;
        const customerId: number | null = (currentUser?.customer_id
          || currentUser?.customer?.id
          || currentUser?.profile?.customer_id
          || null);

        if (customerId) {
          return this.http.get<AddressResponse>(`${this.API_URL}/customers/${customerId}/addresses`).pipe(
            catchError(() => {
              return userId
                ? this.http.get<AddressResponse>(`${this.API_URL}/users/${userId}/addresses`)
                : of({ success: false, message: 'No se pudieron cargar las direcciones', data: [] } as any);
            })
          );
        }

        return userId
          ? this.http.get<AddressResponse>(`${this.API_URL}/users/${userId}/addresses`).pipe(
              catchError(innerErr => {
                if (innerErr?.status === 401) {
                  return of({ success: true, message: null, data: [] } as any);
                }
                return of({ success: false, message: 'No se pudieron cargar las direcciones', data: [] } as any);
              })
            )
          : of({ success: true, message: null, data: [] } as any);
      })
    );

    // Actualizar stream cuando cargamos listado
    enhanced$.subscribe({
      next: (res) => {
        if (res && (res as any).success) {
          const list = Array.isArray((res as any).data) ? ((res as any).data as Address[]) : [];
          this.addressesSubject.next(list);
        } else {
          this.addressesSubject.next([]);
        }
      },
      error: () => {
        // Silenciar cualquier error actualizando stream vacío
        this.addressesSubject.next([]);
      }
    });

    return enhanced$;
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
