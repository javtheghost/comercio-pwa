# 🐛 ANÁLISIS: Duplicación de Direcciones

## 📋 PROBLEMA REPORTADO

**Síntoma**: Al crear una dirección nueva, aparece **duplicada** en la lista

**Contexto**: 
- Usuario crea dirección
- La dirección aparece 2 veces (exactamente igual)
- El problema persiste después de recargar

---

## 🔍 ANÁLISIS DEL CÓDIGO ACTUAL

### **1. Sistema de Deduplicación (Ya existe)**

El código **YA TIENE** un sistema completo de deduplicación:

#### **En `address.service.ts`:**

```typescript
// Línea 115-131: Debounce de creación rápida
private recentCreateSignatures = new Map<string, number>();
private static CREATE_DUP_WINDOW_MS = 4000; // ventana de 4s

createAddress(addressData: CreateAddressRequest): Observable<AddressResponse> {
  const signature = this.buildAddressSignature(addressData as any);
  const now = Date.now();
  const last = this.recentCreateSignatures.get(signature) || 0;
  
  // ✅ PROTECCIÓN 1: Ignorar doble-click en menos de 4 segundos
  if (now - last < AddressService.CREATE_DUP_WINDOW_MS) {
    console.warn('[AddressService] Ignorando creación duplicada rápida (debounce)');
    return of({ success: true, message: 'Duplicado ignorado', ... });
  }
  
  this.recentCreateSignatures.set(signature, now);
  // ... envía petición al backend
}
```

#### **Línea 360-461: Deduplicación por contenido**

```typescript
private dedupeAndNormalize(list: Address[]): Address[] {
  // Agrupa direcciones por "firma" de contenido
  // Si 2 direcciones tienen mismo nombre, dirección, ciudad, etc.
  // Las considera duplicadas AUNQUE tengan ID diferente
  
  const makeSig = (a: Address) => [
    normStr(a.first_name),
    normStr(a.last_name),
    simplifyLine(a.address_line_1),
    simplifyLine(a.address_line_2),
    normStr(a.city),
    normStr(a.state),
    normStr(a.postal_code),
    normStr(a.country),
    normStr(a.type),
    normPhone(a.phone)
  ].join('|');
  
  // Agrupa por firma y resuelve duplicados
  // Prioridad: is_default > updated_at > id mayor
}
```

#### **En `profile.page.ts`:**

```typescript
// Línea 246-282: Deduplicación adicional en el componente
private mergeAndDedupeClient(existing: Address[], incoming: Address[]): Address[] {
  // Mismo sistema de firmas que el servicio
  // Deduplica nuevamente para evitar "parpadeo" visual
}
```

---

## 🎯 DIAGNÓSTICO: ¿POR QUÉ SE DUPLICA?

### **Hipótesis 1: El Backend está devolviendo duplicados** ⭐ **MÁS PROBABLE**

**Evidencia:**
```typescript
// address.service.ts - Línea 130-146
req$.subscribe({
  next: (res) => {
    if (res && res.success && res.data && !Array.isArray(res.data)) {
      const created = this.normalizeAddress(res.data as Address);
      
      // ✅ Verifica si ya existe por firma
      const existingIdxBySig = current.findIndex(a => 
        this.buildAddressSignature(a) === sigCreated
      );
      
      if (existingIdxBySig !== -1) {
        // ✅ Si existe, solo actualiza
        const merged = { ...current[existingIdxBySig], ...created };
        current[existingIdxBySig] = merged;
        this.addressesSubject.next(this.dedupeAndNormalize(current));
        return; // ← NO agrega duplicado
      }
      
      // ✅ Si no existe, agrega al inicio
      current.unshift(created);
    }
  }
});
```

**Problema potencial:**
1. Backend crea la dirección → ID 123
2. Frontend recibe respuesta con ID 123
3. Frontend **TAMBIÉN** llama `getUserAddresses()` en otro momento
4. Backend devuelve **LA MISMA dirección DOS VECES en el array**
5. Sistema de deduplicación **intenta limpiar** pero puede fallar si:
   - Los IDs son diferentes (backend devuelve 2 registros distintos)
   - El timing hace que se procesen en paralelo

---

### **Hipótesis 2: Múltiples llamadas a `getUserAddresses()`**

**Posibles triggers:**
```typescript
// 1. Al cargar perfil
ngOnInit() {
  this.loadAddresses();
}

// 2. Después de crear dirección
saveAddress() {
  await this.addressService.createAddress(...);
  // El servicio actualiza el BehaviorSubject internamente
}

// 3. Después de eliminar dirección
deleteAddress() {
  await this.addressService.deleteAddress(...);
  await this.loadAddresses(); // ← Recarga manual
}

// 4. Al volver visible la página (si hay listener)
```

---

### **Hipótesis 3: Race Condition en el servicio**

Si 2 peticiones se procesan en paralelo:
```
T0: createAddress() envía POST /addresses
T1: Backend crea dirección (ID 123)
T2: Frontend recibe respuesta y actualiza lista local
T3: getUserAddresses() envía GET /addresses (otra tab/componente)
T4: Backend devuelve lista con ID 123
T5: Frontend actualiza lista nuevamente
    ↓ Si la deduplicación falla, ahora hay 2 copias
```

---

## 🧪 PRUEBAS DE DIAGNÓSTICO

### **Test 1: Verificar respuesta del backend**

Agregar logs temporales en `address.service.ts`:

```typescript
// En createAddress() - Línea 126
req$.subscribe({
  next: (res) => {
    console.log('🔍 [DEBUG] Respuesta de createAddress:', {
      success: res.success,
      dataType: Array.isArray(res.data) ? 'ARRAY' : 'OBJECT',
      data: res.data
    });
    
    if (res && res.success && res.data && !Array.isArray(res.data)) {
      console.log('🔍 [DEBUG] Dirección creada:', {
        id: res.data.id,
        nombre: res.data.first_name + ' ' + res.data.last_name,
        direccion: res.data.address_line_1
      });
      
      const current = this.addressesSubject.value.slice();
      console.log('🔍 [DEBUG] Lista actual ANTES de agregar:', {
        count: current.length,
        ids: current.map(a => a.id)
      });
      
      // ... resto del código
      
      console.log('🔍 [DEBUG] Lista DESPUÉS de agregar:', {
        count: this.addressesSubject.value.length,
        ids: this.addressesSubject.value.map(a => a.id)
      });
    }
  }
});
```

---

### **Test 2: Verificar GET /addresses**

Agregar log en `getUserAddresses()`:

```typescript
// En getUserAddresses() - Línea 90-95
enhanced$.subscribe({
  next: (res) => {
    if (res && (res as any).success) {
      const list = Array.isArray((res as any).data) 
        ? ((res as any).data as Address[]) 
        : [];
      
      console.log('🔍 [DEBUG] getUserAddresses respuesta:', {
        count: list.length,
        addresses: list.map(a => ({
          id: a.id,
          nombre: a.first_name + ' ' + a.last_name,
          direccion: a.address_line_1
        }))
      });
      
      // Verificar si hay IDs duplicados
      const ids = list.map(a => a.id).filter(id => id);
      const uniqueIds = new Set(ids);
      
      if (ids.length !== uniqueIds.size) {
        console.error('❌ [DEBUG] BACKEND DEVOLVIÓ DUPLICADOS POR ID:', {
          total: ids.length,
          unicos: uniqueIds.size,
          duplicados: ids.filter((id, i) => ids.indexOf(id) !== i)
        });
      }
      
      const cleaned = this.dedupeAndNormalize(list);
      
      console.log('🔍 [DEBUG] Después de dedupe:', {
        antes: list.length,
        despues: cleaned.length,
        eliminados: list.length - cleaned.length
      });
      
      this.addressesSubject.next(cleaned);
    }
  }
});
```

---

### **Test 3: Verificar desde la consola del navegador**

El servicio ya expone un método de debug:

```javascript
// En la consola del navegador
debugAddresses()

// Output esperado:
// ┌─────────┬────┬──────────────┬─────────────────┬───────┬─────┬───────────┐
// │ (index) │ id │     name     │     line1       │  cp   │ def │  updated  │
// ├─────────┼────┼──────────────┼─────────────────┼───────┼─────┼───────────┤
// │    0    │ 5  │ 'Juan Pérez' │ 'Calle 123'     │ 12345 │true │'2025-...' │
// │    1    │ 5  │ 'Juan Pérez' │ 'Calle 123'     │ 12345 │false│'2025-...' │ ← DUPLICADO
// └─────────┴────┴──────────────┴─────────────────┴───────┴─────┴───────────┘
```

Si ves el mismo ID repetido → **El backend está devolviendo duplicados**

---

## 📝 MENSAJE PARA EL BACKEND AI

### **Escenario: Duplicación de direcciones**

```
🐛 PROBLEMA: El endpoint GET /api/addresses devuelve direcciones duplicadas

SÍNTOMAS EN EL FRONTEND:
- Al crear una dirección nueva, aparece duplicada en la lista
- Las direcciones tienen el mismo ID (o IDs diferentes pero mismo contenido)
- El problema persiste después de recargar

VERIFICACIÓN REQUERIDA:

1. **Revisar el modelo Address y sus relaciones:**

¿Hay joins o relaciones que puedan causar duplicados?

Ejemplo problemático:
```sql
SELECT addresses.* 
FROM addresses
LEFT JOIN address_user ON addresses.id = address_user.address_id
WHERE address_user.user_id = ?
```

Si hay múltiples registros en la tabla pivot, esto devuelve duplicados.

SOLUCIÓN: Usar DISTINCT o GROUP BY:
```sql
SELECT DISTINCT addresses.* 
FROM addresses
LEFT JOIN address_user ON addresses.id = address_user.address_id
WHERE address_user.user_id = ?
```

---

2. **Verificar AddressController@index:**

```php
public function index(Request $request)
{
    try {
        $user = $request->user();
        
        // ❌ POSIBLE PROBLEMA: Si hay eager loading mal configurado
        $addresses = $user->addresses()
            ->with(['relacion1', 'relacion2']) // ← puede causar duplicados
            ->get();
        
        // ✅ SOLUCIÓN 1: Verificar que NO hay duplicados
        $addresses = $user->addresses()
            ->distinct() // ← Forzar DISTINCT
            ->get();
        
        // ✅ SOLUCIÓN 2: Usar unique() en la colección
        $addresses = $user->addresses()
            ->get()
            ->unique('id'); // ← Eliminar duplicados por ID
        
        return response()->json([
            'success' => true,
            'data' => $addresses->values()->all() // values() para reindexar
        ]);
    } catch (\Exception $e) {
        \Log::error('Error obteniendo direcciones: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Error al obtener direcciones'
        ], 500);
    }
}
```

---

3. **Verificar AddressController@store:**

¿La creación está validando duplicados ANTES de insertar?

```php
public function store(Request $request)
{
    $validated = $request->validate([
        'first_name' => 'required|string',
        'last_name' => 'required|string',
        'address_line_1' => 'required|string',
        'city' => 'required|string',
        'state' => 'required|string',
        'postal_code' => 'required|string',
        'country' => 'required|string',
        'phone' => 'required|string',
        'type' => 'required|in:shipping,billing',
        'is_default' => 'boolean'
    ]);
    
    // ✅ VALIDACIÓN: Verificar si ya existe dirección idéntica
    $existing = Address::where('user_id', $request->user()->id)
        ->where('first_name', $validated['first_name'])
        ->where('last_name', $validated['last_name'])
        ->where('address_line_1', $validated['address_line_1'])
        ->where('postal_code', $validated['postal_code'])
        ->first();
    
    if ($existing) {
        // Si ya existe, devolver la existente en lugar de crear duplicado
        return response()->json([
            'success' => true,
            'message' => 'Dirección ya existe',
            'data' => $existing
        ], 200);
    }
    
    // Crear nueva dirección
    $address = Address::create([
        'user_id' => $request->user()->id,
        ...$validated
    ]);
    
    return response()->json([
        'success' => true,
        'message' => 'Dirección creada exitosamente',
        'data' => $address
    ], 201);
}
```

---

4. **Verificar tabla "addresses" en la base de datos:**

```sql
-- Buscar duplicados reales en la BD
SELECT 
    first_name, 
    last_name, 
    address_line_1, 
    postal_code, 
    COUNT(*) as count
FROM addresses
GROUP BY first_name, last_name, address_line_1, postal_code
HAVING count > 1;
```

Si hay resultados → **Hay duplicados en la base de datos**

SOLUCIÓN: Agregar índice único compuesto:

```php
// En la migración
Schema::table('addresses', function (Blueprint $table) {
    $table->unique(
        ['user_id', 'first_name', 'last_name', 'address_line_1', 'postal_code'],
        'addresses_unique_content'
    );
});
```

---

CHECKLIST:
- [ ] Verificar query de GET /api/addresses (usar DISTINCT o unique())
- [ ] Verificar relaciones del modelo Address (eager loading)
- [ ] Agregar validación en store() para evitar duplicados
- [ ] Verificar si hay duplicados reales en la BD
- [ ] Agregar índice único si es necesario
- [ ] Probar crear dirección y verificar que GET devuelve solo 1 instancia

LOGS REQUERIDOS:
```bash
tail -f storage/logs/laravel.log
```

Ejecutar al crear dirección para ver:
- Query SQL ejecutado
- Cantidad de registros devueltos
- Si hay errores de constraint

---

PRUEBA:
```bash
# Crear dirección
curl -X POST http://localhost:8000/api/addresses \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Juan",
    "last_name": "Pérez",
    "address_line_1": "Calle 123",
    "city": "Ciudad",
    "state": "Estado",
    "postal_code": "12345",
    "country": "México",
    "phone": "1234567890",
    "type": "shipping"
  }'

# Listar direcciones
curl -X GET http://localhost:8000/api/addresses \
  -H "Authorization: Bearer {token}"

# Verificar que solo hay 1 dirección (no duplicada)
```
```

---

## 🛠️ ARREGLO TEMPORAL EN EL FRONTEND

Mientras el backend se arregla, puedo agregar más logging para confirmar el diagnóstico:

