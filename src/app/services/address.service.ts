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

  // Cache para prevenir duplicados inmediatos (firma -> timestamp)
  private recentCreateSignatures = new Map<string, number>();
  private static CREATE_DUP_WINDOW_MS = 4000; // ventana de 4s para ignorar duplicados

  constructor(private http: HttpClient, private authService: AuthService) {}

  // Exponer debug en desarrollo
  private exposeDebug() {
    if (typeof window !== 'undefined') {
      (window as any).debugAddresses = () => {
        const arr = this.addressesSubject.value;
        console.table(arr.map(a => ({ id: a.id, name: a.first_name + ' ' + a.last_name, line1: a.address_line_1, cp: a.postal_code, def: !!a.is_default, updated: a.updated_at })));
        return arr;
      };
    }
  }

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
          
          // 🔍 DEBUG: Log de respuesta del backend
          console.log('🔍 [ADDRESS DEBUG] getUserAddresses respuesta:', {
            count: list.length,
            addresses: list.map(a => ({
              id: a.id,
              nombre: `${a.first_name} ${a.last_name}`,
              direccion: a.address_line_1,
              cp: a.postal_code
            }))
          });
          
          // Verificar si el backend devolvió IDs duplicados
          const ids = list.map(a => a.id).filter(id => id !== null && id !== undefined);
          const uniqueIds = new Set(ids);
          
          if (ids.length !== uniqueIds.size) {
            console.error('❌ [ADDRESS DEBUG] ¡BACKEND DEVOLVIÓ DUPLICADOS POR ID!', {
              total: ids.length,
              unicos: uniqueIds.size,
              duplicados: ids.filter((id, i) => ids.indexOf(id) !== i)
            });
          }
          
          const cleaned = this.dedupeAndNormalize(list);
          
          console.log('🔍 [ADDRESS DEBUG] Después de dedupe:', {
            antes: list.length,
            despues: cleaned.length,
            eliminados: list.length - cleaned.length,
            ids_finales: cleaned.map(a => a.id)
          });
          
          this.addressesSubject.next(cleaned);
          this.exposeDebug();
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
    const signature = this.buildAddressSignature(addressData as any);
    const now = Date.now();
    const last = this.recentCreateSignatures.get(signature) || 0;
    if (now - last < AddressService.CREATE_DUP_WINDOW_MS) {
      console.warn('[AddressService] Ignorando creación duplicada rápida (debounce)');
      // Retornar observable simulado para no romper flujos
      return of({ success: true, message: 'Duplicado ignorado', data: this.addressesSubject.value.find(a => this.buildAddressSignature(a) === signature) } as any);
    }
    this.recentCreateSignatures.set(signature, now);
    const req$ = this.http.post<AddressResponse>(`${this.API_URL}/addresses`, addressData);
    req$.subscribe({
      next: (res) => {
        // 🔍 DEBUG: Log de respuesta de creación
        console.log('🔍 [ADDRESS DEBUG] createAddress respuesta:', {
          success: res.success,
          dataType: Array.isArray(res.data) ? 'ARRAY' : 'OBJECT',
          data: res.data
        });
        
        if (res && res.success && res.data && !Array.isArray(res.data)) {
          const current = this.addressesSubject.value.slice();
          const created = this.normalizeAddress(res.data as Address);
          const sigCreated = this.buildAddressSignature(created);
          
          console.log('🔍 [ADDRESS DEBUG] Dirección creada:', {
            id: created.id,
            nombre: `${created.first_name} ${created.last_name}`,
            direccion: created.address_line_1,
            firma: sigCreated
          });
          
          console.log('🔍 [ADDRESS DEBUG] Lista actual ANTES de agregar:', {
            count: current.length,
            ids: current.map(a => a.id),
            firmas: current.map(a => this.buildAddressSignature(a))
          });
          
          // Limpiar firmas viejas
          for (const [sig, ts] of Array.from(this.recentCreateSignatures.entries())) {
            if (now - ts > AddressService.CREATE_DUP_WINDOW_MS) this.recentCreateSignatures.delete(sig);
          }
          
          // Si ya existe por firma, sólo actualizar id si falta
          const existingIdxBySig = current.findIndex(a => this.buildAddressSignature(a) === sigCreated);
          if (existingIdxBySig !== -1) {
            console.log('🔍 [ADDRESS DEBUG] Dirección YA EXISTE por firma, actualizando...');
            const merged = { ...current[existingIdxBySig], ...created };
            current[existingIdxBySig] = merged;
            this.addressesSubject.next(this.dedupeAndNormalize(current));
            return;
          }
          
          const idx = current.findIndex(a => this.safeId(a.id) === this.safeId(created.id));
          if (idx !== -1) {
            console.log('🔍 [ADDRESS DEBUG] Dirección YA EXISTE por ID, actualizando...');
            current[idx] = { ...current[idx], ...created };
          } else {
            console.log('🔍 [ADDRESS DEBUG] Dirección NUEVA, agregando al inicio...');
            current.unshift(created);
          }
          
          const final = this.dedupeAndNormalize(current);
          
          console.log('🔍 [ADDRESS DEBUG] Lista DESPUÉS de agregar:', {
            count: final.length,
            ids: final.map(a => a.id)
          });
          
          this.addressesSubject.next(final);
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
          const updated = this.normalizeAddress(res.data as Address);
          const list = this.addressesSubject.value.slice();
          const idx = list.findIndex(a => this.safeId(a.id) === this.safeId(updated.id));
          if (idx !== -1) {
            list[idx] = { ...list[idx], ...updated };
          }
          this.addressesSubject.next(this.dedupeAndNormalize(list));
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
          const current = this.addressesSubject.value.slice();
          // Construir firma del que vamos a eliminar (si existe) para eliminar duplicados gemelos
          const target = current.find(a => this.safeId(a.id) === this.safeId(id));
          const signature = target ? this.buildAddressSignature(target) : null;
          const filtered = current.filter(a => {
            if (this.safeId(a.id) === this.safeId(id)) return false;
            if (signature && this.buildAddressSignature(a) === signature) return false; // eliminar gemelos por contenido
            return true;
          });
          const deduped = this.dedupeAndNormalize(filtered);
          this.addressesSubject.next(deduped);
          console.info('[AddressService] deleteAddress applied. Removed id:', id, 'signature:', signature, 'remaining:', deduped.map(a => a.id));
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
          const updated = this.normalizeAddress(res.data as Address);
          const list = this.addressesSubject.value.map(a => ({
            ...a,
            is_default: this.safeId(a.id) === this.safeId(updated.id)
          }));
          const idx = list.findIndex(a => this.safeId(a.id) === this.safeId(updated.id));
          if (idx !== -1) {
            list[idx] = { ...list[idx], ...updated, is_default: true };
          } else {
            list.unshift({ ...updated, is_default: true });
          }
          // Asegurar sólo una default
          let defaultSet = false;
          const normalized = list.map(a => {
            if (a.is_default) {
              if (!defaultSet) {
                defaultSet = true;
                return a;
              }
              return { ...a, is_default: false };
            }
            return a;
          });
          const deduped = this.dedupeAndNormalize(normalized);
          // Diagnóstico: si antes había N y ahora N+1 con mismo ID
          const ids = deduped.map(a => a.id).filter(v => v !== null && v !== undefined);
          const uniqueIds = new Set(ids);
          if (ids.length !== uniqueIds.size) {
            console.warn('[AddressService] Duplicados detectados tras setDefault, forzando recarga del backend', { ids, deduped });
            // Forzar recarga (sincrónica) para alinearnos al backend si todavía quedan problemas
            this.getUserAddresses();
          } else {
            this.addressesSubject.next(deduped);
          }
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

    // Validar código postal (básico) ahora permite de 3 a 5 dígitos
    if (address.postal_code && !/^\d{3,5}$/.test(address.postal_code)) {
      errors.push('El código postal debe tener entre 3 y 5 dígitos');
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

  // --- Utilidades internas para normalizar y deduplicar ---
  private safeId(id: any): number | null {
    if (id === null || id === undefined) return null;
    const n = +id;
    return Number.isFinite(n) ? n : null;
  }

  private normalizeAddress(addr: Address): Address {
    if (addr && addr.id !== undefined && addr.id !== null) {
      const num = this.safeId(addr.id);
      if (num !== null) (addr as any).id = num;
    }
    return addr;
  }

  private dedupeAndNormalize(list: Address[]): Address[] {
    // 1. Normalizar y agrupar por firma de contenido para detectar duplicados con IDs distintos
    const groups = new Map<string, Address[]>();
    const normStr = (v: any) => (v||'').toString().normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
    const normPhone = (p: any) => normStr(p).replace(/[^0-9]/g,'');
    const simplifyLine = (s: string) => normStr(s).replace(/\b(num|numero|número|no)\.?\b/g,'').replace(/\s+/g,' ').trim();
    const makeSig = (a: Address) => [
      normStr(a.first_name),
      normStr(a.last_name),
      simplifyLine(a.address_line_1||''),
      simplifyLine(a.address_line_2||''),
      normStr(a.city),
      normStr(a.state),
      normStr(a.postal_code),
      normStr(a.country),
      normStr(a.type),
      normPhone(a.phone)
    ].join('|');

    for (const raw of list) {
      const norm = this.normalizeAddress({ ...raw });
      const sig = makeSig(norm);
      if (!groups.has(sig)) groups.set(sig, []);
      groups.get(sig)!.push(norm);
    }

    const merged: Address[] = [];
    for (const [sig, items] of groups.entries()) {
      if (items.length === 1) {
        merged.push(items[0]);
        continue;
      }
      // Resolver duplicados: priorizar is_default, luego updated_at más reciente, luego mayor id (asumiendo incremental)
      const resolved = items.reduce((best, cur) => {
        if (!best) return cur;
        if (cur.is_default && !best.is_default) return cur;
        if (cur.is_default === best.is_default) {
          if (cur.updated_at && best.updated_at) {
            if (cur.updated_at > best.updated_at) return cur;
          } else if (cur.updated_at && !best.updated_at) {
            return cur;
          }
          const idBest = this.safeId(best.id) ?? -Infinity;
          const idCur = this.safeId(cur.id) ?? -Infinity;
          if (idCur > idBest) return cur;
        }
        return best;
      }, items[0] as Address | null)!;
      // Consolidar flags: si cualquiera tenía is_default, asegurar se refleje
      if (items.some(i => i.is_default)) resolved.is_default = true;
      merged.push(resolved);
    }

    // 2. Evitar múltiples defaults: mantener solo el primero que encontremos marcado
    let defaultFound = false;
    const onlyOneDefault = merged.map(a => {
      if (a.is_default) {
        if (!defaultFound) {
          defaultFound = true;
          return a;
        }
        return { ...a, is_default: false };
      }
      return a;
    });

    // 3. Ordenar: default primero, luego más reciente updated_at, luego id descendente
    onlyOneDefault.sort((a, b) => {
      if (a.is_default && !b.is_default) return -1;
      if (!a.is_default && b.is_default) return 1;
      const ua = a.updated_at || '';
      const ub = b.updated_at || '';
      if (ua && ub && ua !== ub) return ua > ub ? -1 : 1;
      const ia = this.safeId(a.id) ?? 0;
      const ib = this.safeId(b.id) ?? 0;
      return ib - ia;
    });

    // 4. Log diagnóstico (solo si había grupos con colisiones)
    const hadCollisions = Array.from(groups.values()).some(g => g.length > 1);
    if (hadCollisions) {
      console.info('[AddressService] Dedupe por contenido aplicado. Grupos fusionados:', Array.from(groups.entries()).filter(e => e[1].length > 1).map(e => ({ signature: e[0], count: e[1].length, ids: e[1].map(i => i.id) })) );
    }

    return onlyOneDefault;
  }

  private buildAddressSignature(a: Partial<Address>): string {
    const norm = (v: any) => (v||'').toString().normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
    const simplifyLine = (s: any) => norm(s).replace(/\b(num|numero|número|no)\.?\b/g,'').replace(/\s+/g,' ').trim();
    const phone = norm((a as any).phone).replace(/[^0-9]/g,'');
    return [
      norm(a.first_name),
      norm(a.last_name),
      simplifyLine(a.address_line_1),
      simplifyLine(a.address_line_2),
      norm(a.city),
      norm(a.state),
      norm(a.postal_code),
      norm(a.country),
      norm(a.type),
      phone
    ].join('|');
  }
}
