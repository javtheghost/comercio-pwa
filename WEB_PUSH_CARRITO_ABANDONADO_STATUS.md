# 🔔 Web Push para Carrito Abandonado - Estado de Implementación

**Fecha:** 12 de octubre de 2025  
**Backend:** ✅ 100% Listo  
**Frontend:** ✅ 95% Listo (solo falta testing)

---

## ✅ YA IMPLEMENTADO (No necesitas hacer nada)

### **1. Service Workers (`src/sw.js` y `public/sw.js`)**
- ✅ Listener de eventos `push`
- ✅ Listener de eventos `notificationclick`
- ✅ Manejo especial de `cart_abandoned` type
- ✅ Envío de `cart_id` a la app vía `postMessage`
- ✅ Apertura automática en `/tabs/cart`

### **2. App Component (`src/app/app.ts`)**
- ✅ Inicialización de NotificationService
- ✅ Listener de mensajes del Service Worker
- ✅ Guardado automático de `abandoned_cart_id` en localStorage
- ✅ Logging para debugging

### **3. Notification Service (`src/app/services/notification.service.ts`)**
- ✅ Método `initializePushNotifications()`
- ✅ Obtención de VAPID public key
- ✅ Registro de Service Worker
- ✅ Suscripción a push notifications
- ✅ Envío de subscription al backend
- ✅ Sincronización de notificaciones desde backend
- ✅ Manejo de notificaciones locales y push

### **4. Cart Page**
- ✅ Detección de `abandoned_cart_id` en localStorage
- ✅ Carga automática del carrito desde el backend
- ✅ Llamada a `/api/cart/recovered/{cartId}` al completar orden

---

## 🧪 CÓMO PROBAR (PASO A PASO)

### **PASO 1: Verificar que el scheduler del backend esté corriendo**

En tu terminal del **backend**:

```bash
# Opción A: Modo desarrollo (una sola vez)
php artisan schedule:run

# Opción B: Modo watch (cada minuto automáticamente)
php artisan schedule:work
```

**Deberías ver algo como:**
```
Running scheduled command: Artisan::call('cart:detect-abandoned')
```

---

### **PASO 2: Forzar creación de notificación de carrito abandonado**

Ejecuta en tinker (backend):

```bash
php artisan tinker
```

```php
// 1. Obtener tu carrito
$cart = \App\Models\Cart::where('user_id', 14)->first();

// 2. Forzar que sea "abandonado hace 2 horas"
$cart->updated_at = now()->subHours(2);
$cart->is_abandoned = true;
$cart->save();

echo "✅ Carrito marcado como abandonado\n";
echo "Cart ID: {$cart->id}\n";
echo "User ID: {$cart->user_id}\n";
echo "Updated: {$cart->updated_at}\n";

// 3. Ejecutar el job de envío de notificaciones
\App\Jobs\SendAbandonedCartNotifications::dispatch();

echo "✅ Job ejecutado\n";

// 4. Verificar que se creó la notificación en la BD
$notif = \App\Models\Notification::where('user_id', 14)
    ->where('type', 'cart_abandoned')
    ->latest()
    ->first();

if ($notif) {
    echo "✅ Notificación creada en BD:\n";
    echo "  ID: {$notif->id}\n";
    echo "  Title: {$notif->title}\n";
    echo "  Body: {$notif->body}\n";
    echo "  Data: " . json_encode($notif->data) . "\n";
} else {
    echo "❌ No se creó notificación\n";
}

// 5. Verificar suscripciones push del usuario
$subs = \App\Models\PushSubscription::where('user_id', 14)->get();
echo "\n📱 Suscripciones push encontradas: {$subs->count()}\n";
foreach ($subs as $sub) {
    echo "  - Platform: {$sub->platform}\n";
    echo "    Endpoint: " . substr($sub->endpoint, 0, 50) . "...\n";
}
```

---

### **PASO 3: Sincronizar notificaciones en el frontend**

Abre tu app en el navegador y ejecuta en la consola (F12):

```javascript
// Sincronizar notificaciones desde el backend
await window.syncNotifications()

// Verificar que llegó la notificación
await window.debugNotifications()
```

**Deberías ver:**
```javascript
{
  available: true,
  permission: "granted",
  notifications: [
    {
      id: 123,
      type: "cart_abandoned",
      title: "🛒 ¡Tu carrito te espera!",
      body: "Tienes productos guardados...",
      data: { cart_id: 42 }
    }
  ]
}
```

---

### **PASO 4: Probar el push notification real**

Si tienes una **suscripción push activa**, el backend debería haber enviado un push notification automáticamente cuando ejecutaste el job en el Paso 2.

**Deberías ver:**
1. 🔔 **Notificación emergente del sistema** con el mensaje "🛒 ¡Tu carrito te espera!"
2. **Logs en consola del navegador:**
   ```
   📬 Push notification recibida
   📋 Push data: {type: "cart_abandoned", cart_id: 42, ...}
   ✅ Notificación mostrada
   ```

**Si NO ves la notificación push:**
- Verifica que tengas una suscripción activa (ver Paso 5)
- Verifica los logs del backend para ver si se intentó enviar
- Verifica que el Service Worker esté registrado

---

### **PASO 5: Verificar suscripción push**

En consola del navegador:

```javascript
// Ver si estás suscrito
navigator.serviceWorker.ready.then(reg => {
  reg.pushManager.getSubscription().then(sub => {
    if (sub) {
      console.log('✅ Suscrito a push:', sub.endpoint);
    } else {
      console.log('❌ NO estás suscrito a push');
    }
  });
});
```

**Si NO estás suscrito**, suscríbete manualmente:

```javascript
// Forzar suscripción
await window.resetPush()
```

---

### **PASO 6: Hacer clic en la notificación**

1. Cuando recibas la notificación push de "🛒 ¡Tu carrito te espera!"
2. **Haz clic en ella**
3. Deberías:
   - ✅ Abrir la app en `/tabs/cart`
   - ✅ Ver en localStorage: `abandoned_cart_id = 42`
   - ✅ Ver logs en consola:
     ```
     📨 Mensaje del Service Worker: {type: "CART_ABANDONED_CLICK", cartId: 42}
     💾 Cart ID guardado desde push notification: 42
     🛒 Carrito abandonado restaurado. ID: 42
     ```

---

### **PASO 7: Verificar que el carrito se cargue**

1. Ve a la página del carrito (`/tabs/cart`)
2. La página debería detectar `abandoned_cart_id` en localStorage
3. Debería cargar los productos del carrito abandonado desde el backend
4. **Logs esperados:**
   ```
   🛒 Carrito abandonado detectado: 42
   📥 Cargando carrito desde el backend...
   ✅ Carrito cargado: 3 productos
   ```

---

### **PASO 8: Completar la orden**

1. Completa la compra desde el carrito recuperado
2. En checkout, al confirmar la orden, debería llamar a:
   ```typescript
   await this.http.post(`/api/cart/recovered/${cartId}`, {
     order_id: newOrderId
   });
   ```
3. **Verificar en el backend:**
   ```php
   $cart = \App\Models\Cart::find(42);
   echo "Recuperado: " . ($cart->recovered_at ? 'SÍ' : 'NO') . "\n";
   echo "Order ID: " . $cart->recovered_order_id . "\n";
   ```

---

## 📊 ENDPOINTS DEL BACKEND (Ya listos)

```bash
# Obtener VAPID public key
GET /api/webpush/vapid-public-key
Response: { "publicKey": "BNxxx..." }

# Suscribirse a push (requiere auth)
POST /api/webpush/subscribe
Body: {
  "endpoint": "https://fcm.googleapis.com/...",
  "keys": {
    "p256dh": "...",
    "auth": "..."
  }
}

# Desuscribirse (requiere auth)
POST /api/webpush/unsubscribe
Body: { "endpoint": "https://..." }

# Enviar notificación de prueba (requiere auth)
POST /api/webpush/test

# Sincronizar notificaciones (requiere auth)
GET /api/notifications/sync
Response: [
  {
    "id": 123,
    "type": "cart_abandoned",
    "title": "🛒 ¡Tu carrito te espera!",
    "body": "...",
    "data": { "cart_id": 42 },
    "read_at": null
  }
]

# Marcar carrito como recuperado (requiere auth)
POST /api/cart/recovered/{cartId}
Body: { "order_id": 789 }
```

---

## 🔍 DEBUGGING

### **Ver estado completo de notificaciones:**

```javascript
await window.debugNotifications()
```

### **Ver suscripciones push:**

```javascript
navigator.serviceWorker.ready.then(async reg => {
  const sub = await reg.pushManager.getSubscription();
  console.log('Suscripción:', sub);
});
```

### **Forzar sincronización:**

```javascript
await window.syncNotifications()
```

### **Enviar notificación de prueba:**

```javascript
await window.triggerTestNotification()
```

### **Resetear y resuscribirse:**

```javascript
await window.resetPush()
```

### **Ver Service Worker activo:**

```javascript
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Service Workers:', regs);
});
```

---

## ⚠️ PROBLEMAS COMUNES

### **1. No recibo push notifications**

**Causa:** No estás suscrito o la suscripción expiró.

**Solución:**
```javascript
await window.resetPush()
```

---

### **2. El carrito no se carga al hacer clic en la notificación**

**Causa:** El `cart_id` no se está guardando en localStorage.

**Verificar:**
```javascript
console.log('cart_id guardado:', localStorage.getItem('abandoned_cart_id'));
```

**Solución:** Verifica que el Service Worker esté enviando el mensaje correctamente.

---

### **3. La notificación aparece pero no abre la app**

**Causa:** El Service Worker no está abriendo la ventana.

**Verificar logs del Service Worker:**
1. DevTools → Application → Service Workers
2. Ver la consola del Service Worker
3. Buscar errores en `notificationclick`

---

### **4. El backend no envía push notifications**

**Causa:** No hay suscripciones push en la BD o el job no se ejecutó.

**Verificar en tinker:**
```php
// Ver suscripciones
\App\Models\PushSubscription::where('user_id', 14)->get();

// Ver si el job se ejecutó
\Illuminate\Support\Facades\DB::table('jobs')->get();
```

---

## ✅ CHECKLIST FINAL

**Backend:**
- [ ] Scheduler corriendo (`php artisan schedule:work`)
- [ ] Job `SendAbandonedCartNotifications` ejecutándose
- [ ] Notificaciones creándose en la tabla `notifications`
- [ ] Suscripciones push en la tabla `push_subscriptions`
- [ ] VAPID keys configuradas en `.env`

**Frontend:**
- [ ] Service Worker registrado y activo
- [ ] Listener de mensajes del SW en `app.ts`
- [ ] Push notifications con permiso `granted`
- [ ] Suscripción push activa
- [ ] `syncNotifications()` trayendo notificaciones del backend
- [ ] Click en notificación abre `/tabs/cart`
- [ ] `abandoned_cart_id` se guarda en localStorage
- [ ] Cart page detecta y carga el carrito abandonado

**Testing:**
- [ ] Notificación en tab de notificaciones ✅
- [ ] Push notification emergente ✅
- [ ] Click abre el carrito ✅
- [ ] Carrito se carga correctamente ✅
- [ ] Al completar orden, se marca como recuperado ✅

---

## 🎯 RESULTADO ESPERADO

```
1. Usuario abandona carrito (agrega productos y sale)
2. Pasa 1 hora sin actividad
3. Scheduler ejecuta job de carritos abandonados
4. Backend crea notificación en BD
5. Backend envía push notification 🔔
6. Usuario recibe popup en Windows/Mac/Android
7. Usuario hace clic en la notificación
8. App abre en /tabs/cart
9. cart_id se guarda en localStorage
10. Cart page detecta abandoned_cart_id
11. Cart page carga productos desde backend
12. Usuario completa la compra
13. POST /api/cart/recovered/{cartId}
14. Backend marca carrito como recuperado ✅
```

---

**Todo está implementado y listo para probar! 🚀**

**Siguiente paso:** Ejecuta el PASO 2 (forzar notificación en tinker) y verifica que recibas el push notification.
