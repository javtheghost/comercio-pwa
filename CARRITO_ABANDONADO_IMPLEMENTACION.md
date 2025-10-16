# 🛒 IMPLEMENTACIÓN: CARRITO ABANDONADO

## 📋 OBJETIVO

Recuperar ventas perdidas enviando notificaciones a usuarios que agregaron productos al carrito pero no completaron la compra.

**Beneficio esperado:** Recuperar 20-30% de carritos abandonados

---

## 🎯 ESTRATEGIA DE NOTIFICACIONES

### **Secuencia de 3 notificaciones:**

1. **Primera notificación** - Después de 1 hora
   - Mensaje: "¿Olvidaste algo? 🛍️"
   - Incentivo: Recordatorio amigable
   
2. **Segunda notificación** - Después de 24 horas
   - Mensaje: "¡Tu carrito te espera! 🛒"
   - Incentivo: 10% de descuento
   
3. **Tercera notificación** - Después de 48 horas (última oportunidad)
   - Mensaje: "¡Última oportunidad! ⏰"
   - Incentivo: 15% de descuento + envío gratis

---

## 🗄️ BASE DE DATOS

### **1. Nueva tabla: `abandoned_carts`**

```sql
CREATE TABLE abandoned_carts (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    cart_data JSON NOT NULL,
    cart_total DECIMAL(10, 2) NOT NULL,
    items_count INT NOT NULL,
    abandoned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    first_notification_sent_at TIMESTAMP NULL,
    second_notification_sent_at TIMESTAMP NULL,
    third_notification_sent_at TIMESTAMP NULL,
    recovered BOOLEAN DEFAULT FALSE,
    recovered_at TIMESTAMP NULL,
    coupon_code VARCHAR(50) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_abandoned_at (abandoned_at),
    INDEX idx_recovered (recovered)
);
```

**Estructura de `cart_data` (JSON):**
```json
{
  "items": [
    {
      "product_id": 123,
      "variant_id": 456,
      "name": "Camiseta Azul",
      "quantity": 2,
      "price": 299.99,
      "image": "/products/camiseta-azul.jpg"
    }
  ],
  "subtotal": 599.98,
  "shipping": 50.00,
  "tax": 45.00,
  "total": 694.98
}
```

---

## 🔧 BACKEND - IMPLEMENTACIÓN

### **1. Modelo: `AbandonedCart.php`**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\User;

class AbandonedCart extends Model
{
    protected $table = 'abandoned_carts';
    
    protected $fillable = [
        'user_id',
        'cart_data',
        'cart_total',
        'items_count',
        'abandoned_at',
        'first_notification_sent_at',
        'second_notification_sent_at',
        'third_notification_sent_at',
        'recovered',
        'recovered_at',
        'coupon_code'
    ];
    
    protected $casts = [
        'cart_data' => 'array',
        'cart_total' => 'decimal:2',
        'abandoned_at' => 'datetime',
        'first_notification_sent_at' => 'datetime',
        'second_notification_sent_at' => 'datetime',
        'third_notification_sent_at' => 'datetime',
        'recovered' => 'boolean',
        'recovered_at' => 'datetime'
    ];
    
    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
```

---

### **2. Job: `DetectAbandonedCarts.php`**

Detectar carritos abandonados cada hora:

```php
<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use App\Models\AbandonedCart;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class DetectAbandonedCarts implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle()
    {
        \Log::info('🔍 Detectando carritos abandonados...');
        
        // Buscar usuarios con productos en carrito
        $users = User::whereNotNull('cart')
            ->where('cart', '!=', '[]')
            ->where('cart', '!=', 'null')
            ->get();
        
        $detected = 0;
        
        foreach ($users as $user) {
            $cart = json_decode($user->cart, true);
            
            if (empty($cart) || !is_array($cart)) {
                continue;
            }
            
            // Verificar que no sea un carrito ya registrado
            $existingCart = AbandonedCart::where('user_id', $user->id)
                ->where('recovered', false)
                ->latest()
                ->first();
            
            // Si ya existe un carrito no recuperado reciente (menos de 7 días), no crear otro
            if ($existingCart && $existingCart->abandoned_at->gt(Carbon::now()->subDays(7))) {
                continue;
            }
            
            // Calcular totales
            $itemsCount = 0;
            $subtotal = 0;
            $items = [];
            
            foreach ($cart as $item) {
                $itemsCount += $item['quantity'] ?? 1;
                $subtotal += ($item['price'] ?? 0) * ($item['quantity'] ?? 1);
                
                $items[] = [
                    'product_id' => $item['product_id'] ?? null,
                    'variant_id' => $item['variant_id'] ?? null,
                    'name' => $item['name'] ?? 'Producto',
                    'quantity' => $item['quantity'] ?? 1,
                    'price' => $item['price'] ?? 0,
                    'image' => $item['image'] ?? '/icons/icon-192x192.png'
                ];
            }
            
            // Crear registro de carrito abandonado
            AbandonedCart::create([
                'user_id' => $user->id,
                'cart_data' => [
                    'items' => $items,
                    'subtotal' => $subtotal,
                    'total' => $subtotal // Simplificado, puedes agregar shipping y tax
                ],
                'cart_total' => $subtotal,
                'items_count' => $itemsCount,
                'abandoned_at' => Carbon::now()
            ]);
            
            $detected++;
            \Log::info("✅ Carrito abandonado detectado para usuario {$user->id}");
        }
        
        \Log::info("✅ Detección completada: {$detected} carritos abandonados detectados");
    }
}
```

---

### **3. Job: `SendAbandonedCartNotifications.php`**

Enviar notificaciones según el tiempo transcurrido:

```php
<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use App\Models\AbandonedCart;
use App\Models\Notification;
use Carbon\Carbon;

class SendAbandonedCartNotifications implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle()
    {
        \Log::info('📧 Enviando notificaciones de carrito abandonado...');
        
        $now = Carbon::now();
        $sent = 0;
        
        // Buscar carritos no recuperados
        $abandonedCarts = AbandonedCart::where('recovered', false)->get();
        
        foreach ($abandonedCarts as $cart) {
            $hoursSinceAbandoned = $cart->abandoned_at->diffInHours($now);
            
            // Primera notificación: después de 1 hora
            if ($hoursSinceAbandoned >= 1 && is_null($cart->first_notification_sent_at)) {
                $this->sendFirstNotification($cart);
                $cart->first_notification_sent_at = $now;
                $cart->save();
                $sent++;
            }
            
            // Segunda notificación: después de 24 horas
            elseif ($hoursSinceAbandoned >= 24 && is_null($cart->second_notification_sent_at)) {
                $this->sendSecondNotification($cart);
                $cart->second_notification_sent_at = $now;
                $cart->save();
                $sent++;
            }
            
            // Tercera notificación: después de 48 horas
            elseif ($hoursSinceAbandoned >= 48 && is_null($cart->third_notification_sent_at)) {
                $this->sendThirdNotification($cart);
                $cart->third_notification_sent_at = $now;
                $cart->save();
                $sent++;
            }
        }
        
        \Log::info("✅ Notificaciones enviadas: {$sent}");
    }
    
    private function sendFirstNotification(AbandonedCart $cart)
    {
        $items = $cart->cart_data['items'];
        $itemsText = count($items) === 1 
            ? "1 producto" 
            : count($items) . " productos";
        
        Notification::create([
            'user_id' => $cart->user_id,
            'type' => 'cart_abandoned',
            'title' => '¿Olvidaste algo? 🛍️',
            'message' => "Tienes {$itemsText} esperándote en tu carrito por un total de \${$cart->cart_total}",
            'data' => [
                'cart_id' => $cart->id,
                'items_count' => $cart->items_count,
                'total' => $cart->cart_total,
                'icon' => '/icons/icon-192x192.png',
                'url' => '/cart'
            ],
            'read' => false
        ]);
        
        \Log::info("📧 Primera notificación enviada a usuario {$cart->user_id}");
    }
    
    private function sendSecondNotification(AbandonedCart $cart)
    {
        // Generar cupón de 10%
        $couponCode = 'CART10-' . strtoupper(substr(md5($cart->id), 0, 6));
        $cart->coupon_code = $couponCode;
        $cart->save();
        
        Notification::create([
            'user_id' => $cart->user_id,
            'type' => 'cart_abandoned',
            'title' => '¡Tu carrito te espera! 🛒',
            'message' => "Completa tu compra ahora y obtén 10% de descuento con el código {$couponCode}",
            'data' => [
                'cart_id' => $cart->id,
                'discount' => '10%',
                'coupon_code' => $couponCode,
                'icon' => '/icons/icon-192x192.png',
                'url' => '/cart'
            ],
            'read' => false
        ]);
        
        \Log::info("📧 Segunda notificación enviada a usuario {$cart->user_id} con cupón {$couponCode}");
    }
    
    private function sendThirdNotification(AbandonedCart $cart)
    {
        // Generar cupón de 15% + envío gratis
        $couponCode = 'CART15-' . strtoupper(substr(md5($cart->id . 'final'), 0, 6));
        $cart->coupon_code = $couponCode;
        $cart->save();
        
        Notification::create([
            'user_id' => $cart->user_id,
            'type' => 'cart_abandoned',
            'title' => '¡Última oportunidad! ⏰',
            'message' => "15% de descuento + envío gratis. Código: {$couponCode}. ¡No dejes pasar esta oferta!",
            'data' => [
                'cart_id' => $cart->id,
                'discount' => '15%',
                'free_shipping' => true,
                'coupon_code' => $couponCode,
                'icon' => '/icons/icon-192x192.png',
                'url' => '/cart'
            ],
            'read' => false
        ]);
        
        \Log::info("📧 Tercera notificación (final) enviada a usuario {$cart->user_id} con cupón {$couponCode}");
    }
}
```

---

### **4. Scheduler: `app/Console/Kernel.php`**

Agregar los jobs al scheduler:

```php
protected function schedule(Schedule $schedule)
{
    // Detectar carritos abandonados cada hora
    $schedule->job(new \App\Jobs\DetectAbandonedCarts())
        ->hourly()
        ->withoutOverlapping();
    
    // Enviar notificaciones de carrito abandonado cada 30 minutos
    $schedule->job(new \App\Jobs\SendAbandonedCartNotifications())
        ->everyThirtyMinutes()
        ->withoutOverlapping();
}
```

---

### **5. Endpoint: Marcar carrito como recuperado**

```php
// routes/api.php
Route::post('/cart/recovered/{cartId}', [CartController::class, 'markAsRecovered'])
    ->middleware('auth:sanctum');

// app/Http/Controllers/CartController.php
public function markAsRecovered($cartId)
{
    $user = auth()->user();
    
    $cart = AbandonedCart::where('id', $cartId)
        ->where('user_id', $user->id)
        ->first();
    
    if (!$cart) {
        return response()->json([
            'success' => false,
            'message' => 'Carrito no encontrado'
        ], 404);
    }
    
    $cart->recovered = true;
    $cart->recovered_at = now();
    $cart->save();
    
    return response()->json([
        'success' => true,
        'message' => 'Carrito marcado como recuperado'
    ]);
}
```

---

## 🎯 FRONTEND - INTEGRACIÓN

### **Llamar al endpoint cuando se complete una orden:**

```typescript
// En checkout.page.ts o donde se complete la compra

async completeOrder() {
  // ... procesar orden
  
  // Marcar carrito como recuperado
  const cartId = this.getCartIdFromNotification();
  if (cartId) {
    await this.markCartAsRecovered(cartId);
  }
}

private async markCartAsRecovered(cartId: number): Promise<void> {
  try {
    const response = await fetch(`${environment.apiUrl}/cart/recovered/${cartId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      console.log('✅ Carrito marcado como recuperado');
    }
  } catch (error) {
    console.error('❌ Error marcando carrito como recuperado:', error);
  }
}
```

---

## 📊 MÉTRICAS Y REPORTES

### **Dashboard de carritos abandonados:**

```php
// app/Http/Controllers/Admin/DashboardController.php

public function abandonedCartsReport()
{
    $stats = [
        'total_abandoned' => AbandonedCart::where('recovered', false)->count(),
        'total_recovered' => AbandonedCart::where('recovered', true)->count(),
        'recovery_rate' => 0,
        'total_value_lost' => AbandonedCart::where('recovered', false)->sum('cart_total'),
        'total_value_recovered' => AbandonedCart::where('recovered', true)->sum('cart_total'),
        'by_hour' => []
    ];
    
    if ($stats['total_abandoned'] + $stats['total_recovered'] > 0) {
        $stats['recovery_rate'] = ($stats['total_recovered'] / ($stats['total_abandoned'] + $stats['total_recovered'])) * 100;
    }
    
    // Agrupar por hora del día
    $stats['by_hour'] = AbandonedCart::selectRaw('HOUR(abandoned_at) as hour, COUNT(*) as count')
        ->groupBy('hour')
        ->orderBy('hour')
        ->get();
    
    return response()->json($stats);
}
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### **Backend:**
- [ ] Crear migración de tabla `abandoned_carts`
- [ ] Crear modelo `AbandonedCart.php`
- [ ] Crear job `DetectAbandonedCarts.php`
- [ ] Crear job `SendAbandonedCartNotifications.php`
- [ ] Agregar jobs al scheduler en `Kernel.php`
- [ ] Crear endpoint `POST /api/cart/recovered/{cartId}`
- [ ] Probar con `php artisan schedule:work`

### **Frontend:**
- [x] Agregar tipo `cart_abandoned` a notificaciones
- [x] Agregar estilos CSS para notificación (naranja con animación)
- [x] Agregar icono `cart-outline` con animación bounce
- [ ] Integrar llamada a `/api/cart/recovered` al completar orden
- [ ] Probar flujo completo

### **Testing:**
- [ ] Crear carrito y abandonarlo
- [ ] Verificar que se detecta después de 1 hora
- [ ] Verificar primera notificación (1h)
- [ ] Verificar segunda notificación (24h) con cupón
- [ ] Verificar tercera notificación (48h) con cupón mejorado
- [ ] Completar orden y verificar que se marca como recuperado

---

## 🚀 COMANDOS ÚTILES

```bash
# Ejecutar detección manual (testing)
php artisan tinker
>>> dispatch(new \App\Jobs\DetectAbandonedCarts());

# Ejecutar envío de notificaciones manual
>>> dispatch(new \App\Jobs\SendAbandonedCartNotifications());

# Ver carritos abandonados
>>> App\Models\AbandonedCart::all();

# Marcar todos como no recuperados (testing)
>>> App\Models\AbandonedCart::update(['recovered' => false]);

# Ejecutar scheduler en desarrollo
php artisan schedule:work
```

---

## 📈 RESULTADO ESPERADO

**Antes:**
- 100 carritos abandonados
- 0 recuperados
- 0% tasa de recuperación
- $10,000 perdidos

**Después (20-30% recuperación):**
- 100 carritos abandonados
- 25 recuperados
- 25% tasa de recuperación
- $2,500 recuperados

**ROI:** 🚀 Alto retorno, bajo costo de implementación
