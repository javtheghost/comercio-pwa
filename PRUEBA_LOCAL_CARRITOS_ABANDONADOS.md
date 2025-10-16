# 🧪 GUÍA DE PRUEBA LOCAL - Carritos Abandonados

## ✅ ESTADO: Backend funcionando en local con datos reales

**Fecha:** 12 de octubre de 2025  
**Usuario de prueba:** ID 14  
**Cart ID:** 1  
**Total:** $2,085.68  
**Items:** 2 productos  
**Notificación ID:** 6 creada y lista

---

## 🎯 OBJETIVO

Probar el flujo completo del sistema de carritos abandonados en tu entorno local:
1. Sincronizar notificaciones desde el backend
2. Ver la notificación en el frontend
3. Hacer clic → Navegar al carrito
4. Completar la compra
5. Marcar carrito como recuperado

---

## ✅ LO QUE YA FUNCIONA EN EL BACKEND LOCAL:

```bash
✅ Usuario ID: 14
✅ Cart ID: 1 (abandonado detectado)
✅ Total: $2,085.68 (2 productos)
✅ Notificación ID: 6 creada
✅ Tipo: cart_abandoned
✅ Título: "¿Olvidaste algo? 🛍️"
✅ Endpoint disponible: POST /api/cart/recovered/{cartId}
```

---

## 🚀 PASO 1: Verificar que el Frontend esté listo

### **Ya implementado en tu código:**

#### **1.1 Archivo: `notifications.page.ts` (Líneas 167-187)**
```typescript
openNotification(notification: NotificationItem) {
  this.markAsRead(notification);
  const data = notification.data || {};
  
  // ✅ YA IMPLEMENTADO: Guardar cart_id
  if (notification.type === 'cart_abandoned') {
    const cartId = data.cart_id;
    if (cartId) {
      localStorage.setItem('abandoned_cart_id', cartId.toString());
      console.log('🛒 Cart ID guardado para recuperación:', cartId);
    }
    
    // Navegar al carrito
    this.router.navigate(['/tabs/cart']);
    return;
  }
  
  // ... resto del código
}
```
**✅ Estado:** Ya implementado correctamente

---

#### **1.2 Archivo: `checkout.page.ts` (Líneas 333 y 595-635)**
```typescript
async placeOrder() {
  try {
    // ... crear orden
    
    if (response && response.success) {
      // ✅ YA IMPLEMENTADO: Marcar como recuperado
      await this.handleAbandonedCartRecovery();
      
      // ... resto del código
    }
  } catch (error) {
    // ...
  }
}

// ✅ YA IMPLEMENTADO: Método completo
private async handleAbandonedCartRecovery(): Promise<void> {
  try {
    const cartId = localStorage.getItem('abandoned_cart_id');
    
    if (!cartId) {
      return; // No viene de carrito abandonado
    }

    console.log('🛒 [CHECKOUT] Marcando carrito como recuperado:', cartId);

    const token = this.authService.getToken();
    
    if (!token) {
      console.warn('⚠️ [CHECKOUT] No hay token para marcar carrito como recuperado');
      return;
    }

    const response = await fetch(
      `${environment.apiUrl}/cart/recovered/${cartId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.ok) {
      const data = await response.json();
      console.log('✅ [CHECKOUT] Carrito marcado como recuperado:', data);
      localStorage.removeItem('abandoned_cart_id');
    } else {
      console.warn('⚠️ [CHECKOUT] Error al marcar carrito como recuperado:', response.status);
    }
    
  } catch (error) {
    console.error('❌ [CHECKOUT] Error en handleAbandonedCartRecovery:', error);
  }
}
```
**✅ Estado:** Ya implementado correctamente

---

## 🧪 PASO 2: Probar el Flujo Completo

### **2.1 Iniciar sesión como Usuario 14**

1. Abre tu app en el navegador
2. Inicia sesión con las credenciales del usuario ID 14
3. Verifica que `environment.apiUrl` apunte a `http://localhost:8000`

---

### **2.2 Sincronizar notificaciones**

**Opción A: Automático (Recomendado)**
- Ve al tab de Notificaciones
- Pull to refresh (arrastra hacia abajo)

**Opción B: Manual (DevTools Console)**
```javascript
// En console del navegador
await fetch('http://localhost:8000/api/notifications/sync', {
  headers: {
    'Authorization': 'Bearer TU_TOKEN_AQUI',
    'Content-Type': 'application/json'
  }
}).then(r => r.json()).then(console.log);
```

**✅ Resultado esperado:**
```json
{
  "success": true,
  "data": {
    "unread_count": 1,
    "notifications": [
      {
        "id": 6,
        "type": "cart_abandoned",
        "title": "¿Olvidaste algo? 🛍️",
        "message": "Tienes 1 producto esperándote en tu carrito por un total de $2085.68",
        "data": {
          "cart_id": 1,
          "items_count": 2,
          "total": "2085.68",
          "icon": "/icons/icon-192x192.png",
          "url": "/cart"
        },
        "read": false
      }
    ]
  }
}
```

**✅ Verifica en la UI:**
- La notificación aparece en el listado
- Badge "New" visible
- Icono del carrito 🛍️ con diseño naranja
- Badge de unread count actualizado

---

### **2.3 Hacer clic en la notificación**

**Acción:**
- Haz clic en la notificación "¿Olvidaste algo? 🛍️"

**✅ Verifica en Console:**
```
📲 Notificación clickeada: { type: 'cart_abandoned', data: { cart_id: 1 } }
🛒 Cart ID guardado para recuperación: 1
```

**✅ Verifica en DevTools > Application > Local Storage:**
```
Key: abandoned_cart_id
Value: "1"
```

**✅ Verifica navegación:**
- Debes estar en la página `/tabs/cart`
- Debes ver los 2 productos del carrito
- Total debe ser $2,085.68

---

### **2.4 Completar la compra**

**Acción:**
1. Desde el carrito, haz clic en "Proceder al pago" o "Checkout"
2. Completa el formulario de dirección
3. Confirma la orden

**✅ Verifica en Console:**
```
🛒 [CHECKOUT] Orden creada exitosamente: {...}
🛒 [CHECKOUT] Marcando carrito como recuperado: 1
✅ [CHECKOUT] Carrito marcado como recuperado: { success: true, message: "Carrito marcado como recuperado" }
```

**✅ Verifica en Network Tab (DevTools):**
```
POST http://localhost:8000/api/cart/recovered/1
Status: 200 OK
Headers:
  Authorization: Bearer eyJ...
Response:
  {
    "success": true,
    "message": "Carrito marcado como recuperado",
    "data": {
      "cart_id": 1,
      "recovered": true,
      "recovered_at": "2025-10-12T20:30:00.000000Z"
    }
  }
```

**✅ Verifica en Local Storage:**
```
abandoned_cart_id → (eliminado / ya no existe)
```

---

### **2.5 Verificar en el Backend**

**Consulta en la base de datos:**
```sql
-- Ver el carrito marcado como recuperado
SELECT * FROM abandoned_carts WHERE id = 1;

-- Resultado esperado:
id: 1
user_id: 14
cart_total: 2085.68
items_count: 2
recovered: 1 (true)
recovered_at: 2025-10-12 20:30:00
```

**Ver logs del backend:**
```bash
tail -f storage/logs/laravel.log
```

**Logs esperados:**
```
[2025-10-12 20:30:00] INFO: Carrito marcado como recuperado - User: 14, Cart: 1
```

---

## 📊 PRUEBAS ADICIONALES CON POSTMAN/THUNDER CLIENT

### **Prueba 1: Sincronizar notificaciones**
```http
GET http://localhost:8000/api/notifications/sync
Authorization: Bearer {token-usuario-14}
```

**Respuesta esperada: 200 OK**
```json
{
  "success": true,
  "data": {
    "unread_count": 1,
    "notifications": [...]
  }
}
```

---

### **Prueba 2: Marcar carrito como recuperado**
```http
POST http://localhost:8000/api/cart/recovered/1
Authorization: Bearer {token-usuario-14}
Content-Type: application/json
```

**Respuesta esperada: 200 OK**
```json
{
  "success": true,
  "message": "Carrito marcado como recuperado",
  "data": {
    "cart_id": 1,
    "recovered": true,
    "recovered_at": "2025-10-12T20:30:00.000000Z"
  }
}
```

---

### **Prueba 3: Ver métricas de admin (opcional)**
```http
GET http://localhost:8000/api/admin/abandoned-carts/report
Authorization: Bearer {token-admin}
```

**Respuesta esperada: 200 OK**
```json
{
  "total_abandoned": 1,
  "total_recovered": 1,
  "recovery_rate": 100,
  "total_value_lost": 0,
  "total_value_recovered": 2085.68
}
```

---

## 🎨 MEJORAS OPCIONALES (Ya implementadas en tu código)

### **Estilos CSS (notifications.page.scss - líneas 407-417)**
```scss
&.cart-abandoned {
  ion-icon {
    background: linear-gradient(135deg, #ff6b6b 0%, #ffa500 100%);
    animation: bounce 2s ease-in-out infinite;
  }
  
  .notification-text h3 {
    color: #ff6b6b;
  }
}
```
**✅ Estado:** Ya implementado con diseño naranja y animación

---

### **Mostrar cupón de descuento (Para notificaciones de 24h y 48h)**

Cuando el backend envíe notificaciones con cupones (después de 24h y 48h), ya estarán en `notification.data.coupon_code`.

**Opcional: Agregar en `notifications.page.html`:**
```html
<ion-item *ngFor="let notif of notifications">
  <ion-icon [name]="getNotificationIcon(notif)" slot="start"></ion-icon>
  
  <ion-label>
    <h3>{{ notif.title }}</h3>
    <p>{{ notif.message }}</p>
    
    <!-- ✅ Mostrar cupón si existe -->
    <div *ngIf="notif.data?.coupon_code" class="coupon-badge">
      🎟️ Cupón: <strong>{{ notif.data.coupon_code }}</strong>
    </div>
  </ion-label>
  
  <ion-badge *ngIf="!notif.read" color="danger" slot="end">New</ion-badge>
</ion-item>
```

**CSS para el cupón:**
```scss
.coupon-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  background: linear-gradient(135deg, #ff6b6b 0%, #ffa500 100%);
  color: white;
  border-radius: 20px;
  font-size: 0.85rem;
  margin-top: 8px;
  font-weight: 600;
}
```

---

## 📈 PRÓXIMAS NOTIFICACIONES AUTOMÁTICAS

El backend enviará automáticamente (sin necesidad de hacer nada):

| Tiempo | Título | Mensaje | Cupón | Campo `data.coupon_code` |
|--------|--------|---------|-------|--------------------------|
| **1 hora** | ¿Olvidaste algo? 🛍️ | Recordatorio simple | ❌ No | `null` |
| **24 horas** | ¡Tu carrito te espera! 🛒 | 10% de descuento | ✅ Sí | `CART10-XXXXXX` |
| **48 horas** | ¡Última oportunidad! ⏰ | 15% + envío gratis | ✅ Sí | `CART15-XXXXXX` |

**Para probar las notificaciones de 24h y 48h:**
```bash
# En el backend, ejecuta manualmente:
php artisan tinker

# Simular que pasaron 24 horas
>>> $cart = App\Models\AbandonedCart::find(1);
>>> $cart->abandoned_at = now()->subHours(25);
>>> $cart->save();

# Ejecutar job de notificaciones
>>> dispatch(new \App\Jobs\SendAbandonedCartNotifications());

# Deberías ver en logs:
# "📧 Segunda notificación enviada a usuario 14 con cupón CART10-ABC123"
```

---

## ✅ CHECKLIST DE PRUEBA COMPLETA:

### **Frontend:**
- [ ] Usuario 14 inicia sesión correctamente
- [ ] Tab de notificaciones carga sin errores
- [ ] Pull to refresh sincroniza notificaciones
- [ ] Notificación ID 6 aparece en el listado
- [ ] Notificación tiene diseño naranja con icono 🛍️
- [ ] Badge "New" visible
- [ ] Al hacer clic → navega a `/tabs/cart`
- [ ] `localStorage.getItem('abandoned_cart_id')` = `"1"`
- [ ] Carrito muestra 2 productos ($2,085.68)
- [ ] Checkout se completa correctamente
- [ ] Console log: "✅ Carrito marcado como recuperado: 1"
- [ ] Network: POST `/cart/recovered/1` → 200 OK
- [ ] `localStorage.getItem('abandoned_cart_id')` = `null` (eliminado)

### **Backend:**
- [ ] Notificación ID 6 existe en BD
- [ ] `abandoned_carts` table tiene cart_id = 1
- [ ] Después de compra: `recovered = 1`, `recovered_at` tiene fecha
- [ ] Logs muestran: "Carrito marcado como recuperado"

---

## 🎯 COMANDOS ÚTILES PARA DESARROLLO:

### **Ver todas las notificaciones de un usuario:**
```sql
SELECT * FROM notifications 
WHERE user_id = 14 
ORDER BY created_at DESC;
```

### **Ver carritos abandonados:**
```sql
SELECT * FROM abandoned_carts 
WHERE user_id = 14 
ORDER BY created_at DESC;
```

### **Resetear para probar de nuevo:**
```sql
-- Marcar como no recuperado
UPDATE abandoned_carts SET recovered = 0, recovered_at = NULL WHERE id = 1;

-- Crear nueva notificación
INSERT INTO notifications (user_id, type, title, message, data, `read`, created_at, updated_at)
VALUES (
  14,
  'cart_abandoned',
  '¿Olvidaste algo? 🛍️',
  'Tienes 1 producto esperándote en tu carrito por un total de $2085.68',
  '{"cart_id": 1, "items_count": 2, "total": "2085.68", "icon": "/icons/icon-192x192.png", "url": "/cart"}',
  0,
  NOW(),
  NOW()
);
```

---

## 🐛 TROUBLESHOOTING:

### **Problema: No aparece la notificación**
```javascript
// Verificar en Console:
fetch('http://localhost:8000/api/notifications/sync', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('auth_token'),
    'Content-Type': 'application/json'
  }
}).then(r => r.json()).then(console.log);
```

**Solución:** Verificar que el token sea del usuario 14

---

### **Problema: Error 401 al marcar como recuperado**
**Causa:** Token inválido o expirado  
**Solución:** Cerrar sesión y volver a iniciar sesión

---

### **Problema: Error 404 en POST /cart/recovered/1**
**Causa:** Endpoint no existe o ruta mal configurada  
**Solución:** Verificar `routes/api.php` tiene:
```php
Route::post('/cart/recovered/{cartId}', [CartController::class, 'markAsRecovered'])
    ->middleware('auth:sanctum');
```

---

### **Problema: cart_id no se guarda en localStorage**
**Causa:** Tipo de notificación no es `cart_abandoned`  
**Solución:** Verificar en BD que `type = 'cart_abandoned'` (no `cart_abandoned_reminder` ni otro)

---

## 📞 SOPORTE:

### **Logs importantes:**
```bash
# Backend (Laravel)
tail -f storage/logs/laravel.log

# Frontend (Browser Console)
# Filtrar por "CHECKOUT" o "Cart ID"
```

### **Archivos clave:**
- `notifications.page.ts` (líneas 167-187)
- `checkout.page.ts` (líneas 333, 595-635)
- `notifications.page.scss` (líneas 407-417)
- Backend: `app/Http/Controllers/CartController.php` (método `markAsRecovered`)

---

## 🎉 RESULTADO FINAL ESPERADO:

```
Usuario agrega productos → Abandona carrito
  ↓
Backend detecta (1h después)
  ↓
Notificación creada en BD
  ↓
Usuario abre app → Pull to refresh
  ↓
Ve notificación "¿Olvidaste algo? 🛍️" (diseño naranja)
  ↓
Hace clic → Navega al carrito
  ↓
localStorage.setItem('abandoned_cart_id', '1')
  ↓
Completa checkout
  ↓
POST /api/cart/recovered/1 → 200 OK
  ↓
BD actualiza: recovered = true
  ↓
localStorage.removeItem('abandoned_cart_id')
  ↓
✅ Carrito recuperado con éxito
  ↓
📊 Métricas actualizadas en dashboard admin
```

---

**✅ TODO LISTO PARA PROBAR EN LOCAL** 🚀

**Fecha:** 12 de octubre de 2025  
**Versión:** 1.0.0 - Guía de Prueba Local Completa  
**Status:** ✅ Backend funcionando | ✅ Frontend implementado | 🧪 Listo para testing
