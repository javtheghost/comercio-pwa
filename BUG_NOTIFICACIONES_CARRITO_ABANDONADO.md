# 🐛 BUG: Notificaciones de Carrito Abandonado NO se Crean

**Fecha:** 13 de octubre de 2025  
**Reportado por:** Frontend Team  
**Severidad:** 🔴 ALTA - Funcionalidad crítica no operativa

---

## 📋 RESUMEN DEL PROBLEMA

El sistema de carritos abandonados está detectando y registrando los carritos correctamente, **PERO las notificaciones NO se están creando en la tabla `user_notifications`**, por lo que el frontend nunca las recibe.

---

## 🔍 EVIDENCIA DEL BUG

### **1. La tabla `abandoned_carts` SÍ tiene registros:**

```sql
SELECT * FROM abandoned_carts WHERE user_id = 14;
```

**Resultado:**
```
id: 14
user_id: 14
abandoned_at: 2025-10-13 00:39:10
first_notification_sent_at: 2025-10-13 02:39:10  ✅ SE ACTUALIZÓ
```

### **2. La tabla `user_notifications` NO tiene registros:**

```sql
SELECT * FROM user_notifications 
WHERE user_id = 14 
AND type = 'cart_abandoned';
```

**Resultado:**
```
0 row(s) returned  ❌ NO SE CREÓ LA NOTIFICACIÓN
```

---

## 🎯 CAUSA DEL PROBLEMA

El job `SendAbandonedCartNotifications` está:

✅ Detectando carritos abandonados correctamente  
✅ Actualizando el campo `first_notification_sent_at`  
❌ **NO está creando el registro en la tabla `user_notifications`**

**Línea faltante:**
```php
UserNotification::create([...]);  // ← ESTA LÍNEA NO EXISTE O NO SE EJECUTA
```

---

## 🔧 SOLUCIÓN REQUERIDA

### **Archivo a modificar:**
```
app/Jobs/SendAbandonedCartNotifications.php
```

### **Código correcto que debe tener:**

```php
<?php

namespace App\Jobs;

use App\Models\AbandonedCart;
use App\Models\UserNotification;  // ⭐ IMPORTANTE: Importar este modelo
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendAbandonedCartNotifications implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(): void
    {
        \Log::info('📨 [ABANDONED CART] Enviando notificaciones de carritos abandonados...');
        
        // Buscar carritos abandonados hace más de 15 minutos sin notificación
        $abandonedCarts = AbandonedCart::where('recovered', false)
            ->whereNull('first_notification_sent_at')
            ->where('abandoned_at', '<=', Carbon::now()->subMinutes(15))
            ->get();

        \Log::info("📊 [ABANDONED CART] Carritos para notificar: {$abandonedCarts->count()}");

        foreach ($abandonedCarts as $cart) {
            try {
                // ⭐⭐⭐ ESTA LÍNEA ES CRÍTICA - DEBE EXISTIR ⭐⭐⭐
                UserNotification::create([
                    'user_id' => $cart->user_id,
                    'type' => 'cart_abandoned',
                    'title' => '¿Olvidaste algo? 🛍️',
                    'message' => 'Tienes productos en tu carrito esperándote',
                    'data' => json_encode([
                        'cart_id' => $cart->id,
                        'items_count' => $cart->items_count,
                        'total' => $cart->cart_total
                    ]),
                    'icon' => 'cart-outline',
                    'is_read' => false
                ]);
                
                // DESPUÉS de crear la notificación, actualizar el timestamp
                $cart->update([
                    'first_notification_sent_at' => Carbon::now()
                ]);
                
                \Log::info("✅ [ABANDONED CART] Notificación creada para usuario {$cart->user_id} (carrito {$cart->id})");
                
            } catch (\Exception $e) {
                \Log::error("❌ [ABANDONED CART] Error enviando notificación para carrito {$cart->id}: " . $e->getMessage());
                \Log::error($e->getTraceAsString());
            }
        }
        
        \Log::info("✅ [ABANDONED CART] Proceso completado: {$abandonedCarts->count()} notificaciones enviadas");
    }
}
```

---

## 🧪 CÓMO PROBAR EL FIX

### **Paso 1: Resetear el carrito para que vuelva a intentar**

```sql
UPDATE abandoned_carts 
SET first_notification_sent_at = NULL 
WHERE id = 14;
```

### **Paso 2: Ejecutar el job manualmente**

```bash
php artisan tinker
```

```php
\App\Jobs\SendAbandonedCartNotifications::dispatch();
```

### **Paso 3: Verificar que se creó la notificación**

```sql
SELECT * FROM user_notifications 
WHERE user_id = 14 
AND type = 'cart_abandoned'
ORDER BY id DESC 
LIMIT 1;
```

**Resultado esperado:**
```
✅ 1 row returned
✅ Campos: id, user_id=14, type='cart_abandoned', title, message, data, is_read=0
```

### **Paso 4: Verificar en el frontend**

```
1. Abrir la app
2. Ir al tab de notificaciones
3. En MÁXIMO 10 segundos debe aparecer la notificación 🔔
```

---

## 📊 FLUJO CORRECTO DESPUÉS DEL FIX

```
┌─────────────────────────────────────────────┐
│  Usuario agrega productos y abandona       │
└─────────────────┬───────────────────────────┘
                  │
         ⏰ Pasan 10 minutos
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  Job: DetectAbandonedCarts                 │
│  ✅ Crea registro en "abandoned_carts"      │
└─────────────────┬───────────────────────────┘
                  │
         ⏰ Pasan 5 minutos más
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  Job: SendAbandonedCartNotifications       │
│  ✅ Crea notificación en "user_notifications" │  ← ESTE ES EL FIX
│  ✅ Actualiza "first_notification_sent_at"  │
└─────────────────┬───────────────────────────┘
                  │
         ⏰ Pasan 10 segundos
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  Frontend sincroniza                       │
│  GET /api/notifications/sync               │
│  🔔 Notificación aparece en la app         │
└─────────────────────────────────────────────┘
```

---

## 🔴 IMPACTO ACTUAL

**Sistemas afectados:**
- ❌ Notificaciones de carrito abandonado
- ❌ Sistema de recuperación de ventas
- ❌ Experiencia de usuario (no reciben recordatorios)

**Sistemas funcionando correctamente:**
- ✅ Detección de carritos abandonados
- ✅ Registro en base de datos
- ✅ Frontend (sincronización automática)
- ✅ Endpoint `/api/notifications/sync`

---

## ⚠️ NOTA ADICIONAL: Zona Horaria

Se detectó una diferencia de **2 horas** entre `abandoned_at` y `first_notification_sent_at`:

```
abandoned_at: 2025-10-13 00:39:10
first_notification_sent_at: 2025-10-13 02:39:10  ← 2 horas después
```

**Recomendación:** Verificar la configuración de zona horaria en:

```php
// config/app.php
'timezone' => 'America/Mexico_City',  // o la zona horaria correcta del servidor

// Y usar Carbon con timezone explícito
$now = Carbon::now('America/Mexico_City');
```

---

## 📝 CHECKLIST DE IMPLEMENTACIÓN

- [ ] Importar `use App\Models\UserNotification;` en el job
- [ ] Agregar `UserNotification::create([...])` en el loop
- [ ] Agregar logs para debugging (`\Log::info()`)
- [ ] Agregar try-catch para manejo de errores
- [ ] Verificar que la tabla `user_notifications` existe
- [ ] Verificar permisos de escritura en la tabla
- [ ] Probar con el reset del carrito abandonado
- [ ] Ejecutar job manualmente para verificar
- [ ] Confirmar que la notificación aparece en el frontend

---

## 🧪 PRUEBA RÁPIDA (WORKAROUND TEMPORAL)

Mientras se implementa el fix, se puede crear notificaciones manualmente para testing:

```bash
php artisan tinker
```

```php
\App\Models\UserNotification::create([
    'user_id' => 14,
    'type' => 'cart_abandoned',
    'title' => '¿Olvidaste algo? 🛍️',
    'message' => 'Tienes productos en tu carrito esperándote',
    'data' => json_encode([
        'cart_id' => 14,
        'items_count' => 1,
        'total' => '1506.84'
    ]),
    'icon' => 'cart-outline',
    'is_read' => false
]);
```

**Resultado:** La notificación debe aparecer en la app en máximo 10 segundos.

---

## 📞 CONTACTO

Si necesitas más información o ayuda para implementar el fix, contacta al equipo de frontend.

**Prioridad:** 🔴 ALTA  
**Estimación de fix:** 15 minutos  
**Testing:** 5 minutos

---

**Total:** Este bug se puede resolver en menos de 30 minutos.

