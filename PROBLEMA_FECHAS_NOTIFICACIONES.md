# 🐛 PROBLEMA URGENTE: Fechas de Notificaciones Undefined

## 📋 SÍNTOMA

El endpoint **GET /api/user-notifications** está devolviendo:

```json
{
  "id": 1,
  "created_at": undefined,  // ❌ PROBLEMA: undefined en lugar de fecha ISO
  "type": "undefined",       // ❌ También el tipo viene como string "undefined"
  "title": "...",
  "message": "...",
  "read": false,
  "data": {...}
}
```

**Consecuencia en el frontend:**
- Todas las notificaciones muestran "Fecha inválida, usando fecha actual"
- No se puede distinguir cuándo fue creada cada notificación
- El sistema debe usar `new Date()` como fallback, perdiendo información

---

## 🔍 VERIFICACIÓN REQUERIDA

### **1. Modelo Notification**

Revisar que el campo `created_at` esté en `$casts` y `$dates`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    protected $table = 'user_notifications'; // O el nombre correcto
    
    // ✅ IMPORTANTE: Definir casts para fechas
    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'read_at' => 'datetime',      // Si existe
        'read' => 'boolean',
        'data' => 'array'             // Si data es JSON
    ];
    
    // ✅ Asegurar que Laravel serialice fechas correctamente
    protected $dates = [
        'created_at',
        'updated_at',
        'read_at'  // Si existe
    ];
    
    // ✅ CRÍTICO: Incluir created_at en la serialización
    protected $visible = [
        'id',
        'user_id',
        'type',
        'title',
        'message',
        'data',
        'read',
        'read_at',
        'created_at',  // ← Asegurar que esté visible
        'updated_at'
    ];
    
    // O usar $hidden para excluir solo campos sensibles:
    protected $hidden = ['user_id']; // En lugar de $visible
}
```

---

### **2. NotificationController@index**

Verificar que el controlador devuelve las fechas correctamente:

```php
public function index(Request $request)
{
    try {
        $user = $request->user();
        $limit = $request->input('limit', 50);
        $unreadOnly = $request->input('unread_only', false);
        
        $query = Notification::where('user_id', $user->id)
            ->orderBy('created_at', 'desc');
        
        if ($unreadOnly) {
            $query->where('read', false);
        }
        
        $notifications = $query->limit($limit)->get();
        
        // ✅ VERIFICAR: ¿Las notificaciones tienen created_at?
        \Log::info('Notificaciones devueltas:', [
            'count' => $notifications->count(),
            'sample' => $notifications->first() ? [
                'id' => $notifications->first()->id,
                'created_at' => $notifications->first()->created_at,
                'created_at_type' => gettype($notifications->first()->created_at),
                'created_at_iso' => $notifications->first()->created_at?->toISOString()
            ] : null
        ]);
        
        return response()->json([
            'success' => true,
            'data' => $notifications->map(function ($notif) {
                return [
                    'id' => $notif->id,
                    'type' => $notif->type,
                    'title' => $notif->title,
                    'message' => $notif->message,
                    'data' => $notif->data,
                    'read' => $notif->read,
                    'created_at' => $notif->created_at->toISOString(), // ✅ Forzar formato ISO
                    'updated_at' => $notif->updated_at?->toISOString()
                ];
            })
        ]);
    } catch (\Exception $e) {
        \Log::error('Error obteniendo notificaciones: ' . $e->getMessage());
        \Log::error($e->getTraceAsString());
        
        return response()->json([
            'success' => false,
            'message' => 'Error al obtener notificaciones'
        ], 500);
    }
}
```

---

### **3. Migración de la tabla**

Verificar que la tabla tiene el campo `created_at`:

```php
Schema::create('user_notifications', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->onDelete('cascade');
    $table->string('type');
    $table->string('title');
    $table->text('message');
    $table->json('data')->nullable();
    $table->boolean('read')->default(false);
    $table->timestamp('read_at')->nullable();
    $table->timestamps(); // ← Esto crea created_at y updated_at
});
```

**Verificar en la base de datos:**

```sql
DESCRIBE user_notifications;

-- Debe mostrar:
-- created_at | timestamp | YES | NULL | CURRENT_TIMESTAMP
```

Si el campo NO existe:

```sql
ALTER TABLE user_notifications 
ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
```

---

### **4. Creación de Notificaciones**

Verificar que al crear una notificación se establece `created_at`:

```php
// En OrderController@store o donde se crean notificaciones

// ✅ OPCIÓN 1: Dejar que Laravel maneje created_at automáticamente
$notification = Notification::create([
    'user_id' => $user->id,
    'type' => 'new_order',
    'title' => 'Nueva orden',
    'message' => "Tu pedido #{$order->id} ha sido creado",
    'data' => [
        'order_id' => $order->id,
        'order_number' => $order->order_number
    ]
    // NO especificar created_at, Laravel lo asigna automáticamente
]);

// ✅ OPCIÓN 2: Forzar created_at explícitamente
$notification = Notification::create([
    'user_id' => $user->id,
    'type' => 'new_order',
    'title' => 'Nueva orden',
    'message' => "Tu pedido #{$order->id} ha sido creado",
    'data' => [
        'order_id' => $order->id,
        'order_number' => $order->order_number
    ],
    'created_at' => now(), // ← Forzar explícitamente
    'updated_at' => now()
]);

// ❌ INCORRECTO: No usar valores undefined o null
$notification = Notification::create([
    'user_id' => $user->id,
    'type' => $request->type ?? null, // ❌ Si viene undefined/null
    'created_at' => $request->created_at // ❌ NO tomar del request
]);
```

---

## 🧪 PRUEBA DE DIAGNÓSTICO

### **En el backend (Laravel):**

```bash
# Ver logs en tiempo real
tail -f storage/logs/laravel.log
```

### **Desde Postman o cURL:**

```bash
# Crear una notificación de prueba
curl -X POST http://localhost:8000/api/user-notifications \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "test",
    "title": "Prueba de fecha",
    "message": "Testing created_at",
    "data": {}
  }'

# Listar notificaciones
curl -X GET http://localhost:8000/api/user-notifications \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Output esperado:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "type": "test",
      "title": "Prueba de fecha",
      "message": "Testing created_at",
      "data": {},
      "read": false,
      "created_at": "2025-10-12T15:30:45.000000Z",  // ✅ Fecha ISO válida
      "updated_at": "2025-10-12T15:30:45.000000Z"
    }
  ]
}
```

**Output INCORRECTO actual:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "type": "undefined",       // ❌ String "undefined"
      "title": "Prueba de fecha",
      "message": "Testing created_at",
      "data": {},
      "read": false,
      "created_at": undefined,   // ❌ undefined en lugar de fecha
      "updated_at": undefined
    }
  ]
}
```

---

## 🛠️ SOLUCIONES PROPUESTAS

### **Solución 1: Asegurar timestamps en el modelo**

```php
// app/Models/Notification.php

class Notification extends Model
{
    // ✅ Habilitar timestamps automáticos (debería estar por defecto)
    public $timestamps = true;
    
    // ✅ Especificar nombres de columnas si son diferentes
    const CREATED_AT = 'created_at';
    const UPDATED_AT = 'updated_at';
}
```

---

### **Solución 2: Serializar fechas explícitamente**

```php
// app/Models/Notification.php

protected function serializeDate(\DateTimeInterface $date)
{
    return $date->format('Y-m-d\TH:i:s.u\Z'); // ISO 8601
}
```

---

### **Solución 3: Usar Resource para formatear respuesta**

```php
// app/Http/Resources/NotificationResource.php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class NotificationResource extends JsonResource
{
    public function toArray($request)
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'title' => $this->title,
            'message' => $this->message,
            'data' => $this->data,
            'read' => $this->read,
            'created_at' => $this->created_at?->toISOString() ?? now()->toISOString(),
            'updated_at' => $this->updated_at?->toISOString()
        ];
    }
}

// En el controlador:
return response()->json([
    'success' => true,
    'data' => NotificationResource::collection($notifications)
]);
```

---

## ✅ CHECKLIST

- [ ] Verificar que la tabla tiene columnas `created_at` y `updated_at`
- [ ] Verificar que el modelo Notification tiene `public $timestamps = true`
- [ ] Verificar que `created_at` está en `$casts` o `$dates`
- [ ] Verificar que `created_at` NO está en `$hidden`
- [ ] Probar endpoint GET /api/user-notifications y verificar JSON
- [ ] Verificar logs de Laravel para ver qué devuelve la BD
- [ ] Si hay `type: "undefined"`, verificar de dónde viene ese valor
- [ ] Crear notificación de prueba y verificar que tiene fecha válida

---

## 🚨 PRIORIDAD: ALTA

Este bug impide que el sistema funcione correctamente. Las notificaciones sin fecha no pueden ser ordenadas cronológicamente ni mostrar cuándo ocurrieron los eventos.

**Impacto:**
- ❌ No se puede saber cuándo llegó una notificación
- ❌ No se puede ordenar por fecha de creación
- ❌ Frontend debe inventar fechas (fecha actual) perdiendo información
- ❌ Experiencia de usuario degradada
