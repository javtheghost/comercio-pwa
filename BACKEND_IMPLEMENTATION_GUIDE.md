# 📦 GUÍA PARA EL BACKEND - Sistema de Carritos Abandonados

## 🎯 RESUMEN EJECUTIVO

**✅ IMPORTANTE: EL BACKEND YA ESTÁ 100% IMPLEMENTADO Y FUNCIONANDO**

Según la guía que me pasaste, el backend ya tiene:
- ✅ Tabla `abandoned_carts` creada
- ✅ Modelo `AbandonedCart.php` implementado
- ✅ Job `DetectAbandonedCarts` funcionando cada hora
- ✅ Job `SendAbandonedCartNotifications` funcionando cada 30 minutos
- ✅ Endpoint `POST /api/cart/recovered/{cartId}` listo
- ✅ Sistema de cupones automático (10% y 15%)
- ✅ Scheduler configurado y corriendo

**EL FRONTEND ES LO ÚNICO QUE FALTA AJUSTAR** (2 cambios simples)

---

## ✅ LO QUE YA ESTÁ IMPLEMENTADO EN EL BACKEND:

### **1. Tabla `abandoned_carts` (Base de datos):**
```sql
abandoned_carts
  ├── id                              → ID único
  ├── user_id                         → Usuario dueño del carrito
  ├── cart_data                       → JSON con productos
  ├── cart_total                      → Total del carrito
  ├── items_count                     → Cantidad de productos
  ├── abandoned_at                    → Cuándo se abandonó
  ├── first_notification_sent_at      → Primera notif (1h)
  ├── second_notification_sent_at     → Segunda notif (24h)
  ├── third_notification_sent_at      → Tercera notif (48h)
  ├── recovered                       → Si se recuperó (true/false)
  ├── recovered_at                    → Cuándo se recuperó
  └── coupon_code                     → Cupón de descuento generado
```

### **2. Jobs automáticos (Cada hora):**
- ✅ `DetectAbandonedCarts`: Detecta carritos con >1h sin actividad
- ✅ `SendAbandonedCartNotifications`: Envía notificaciones según el tiempo
  - 1 hora → "¿Olvidaste algo? 🛍️"
  - 24 horas → "¡Tu carrito te espera! 🛒" + cupón 10%
  - 48 horas → "¡Última oportunidad! ⏰" + cupón 15% + envío gratis

### **3. Endpoints:**
```
POST /api/cart/recovered/{cartId}   → Marcar carrito como recuperado
GET  /api/admin/abandoned-carts/report → Dashboard de métricas (admin)
```

### **4. Notificaciones automáticas:**
- ✅ Se crean en la tabla `user_notifications` (o `notifications`)
- ✅ Incluyen tipo `cart_abandoned`
- ✅ Incluyen `cart_id` en el campo `data` (JSON)
- ✅ Se sincronizan automáticamente con el frontend

---

## 🎯 LO QUE EL FRONTEND NECESITA HACER:

### **Solo 2 cambios simples (15 minutos total):**

### **Cambio 1: Guardar `cart_id` al hacer clic en notificación**

**Archivo:** `src/app/pages/notifications/notifications.page.ts`

**Modificar método `openNotification()`:**

```typescript
async openNotification(notification: NotificationItem): Promise<void> {
  // Marcar como leída
  this.markAsRead(notification.id);

  // ✅ AGREGAR: Guardar cart_id si es notificación de carrito abandonado
  if (notification.type === 'cart_abandoned' && notification.data?.cart_id) {
    localStorage.setItem('abandoned_cart_id', notification.data.cart_id.toString());
    console.log('🛒 Cart ID guardado:', notification.data.cart_id);
  }

  // Navegar según el tipo
  if (notification.data?.url) {
    await this.router.navigate([notification.data.url]);
  }
}
```

---

### **Cambio 2: Marcar carrito como recuperado al completar orden**

**Archivo:** `src/app/pages/checkout/checkout.page.ts`

**Agregar al método `placeOrder()` o `completeOrder()`:**

```typescript
async placeOrder(): Promise<void> {
  try {
    // 1. Procesar orden normalmente (tu código existente)
    const response = await this.orderService.createOrder(this.orderData);
    
    if (response.success) {
      // 2. ✅ AGREGAR: Verificar y marcar carrito como recuperado
      await this.handleAbandonedCartRecovery();
      
      // 3. Continuar con tu flujo normal
      await this.cartService.clearCart();
      this.router.navigate(['/order-confirmation', response.data.order_id]);
    }
  } catch (error) {
    console.error('❌ Error completing order:', error);
  }
}

// ✅ AGREGAR ESTE MÉTODO COMPLETO
private async handleAbandonedCartRecovery(): Promise<void> {
  const cartId = localStorage.getItem('abandoned_cart_id');
  
  if (!cartId) {
    return; // No hay carrito abandonado para recuperar
  }
  
  try {
    const token = await this.authService.getToken();
    const response = await fetch(`${environment.apiUrl}/cart/recovered/${cartId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      console.log('✅ Carrito marcado como recuperado:', cartId);
      localStorage.removeItem('abandoned_cart_id');
    }
  } catch (error) {
    console.error('⚠️ Error marcando carrito como recuperado:', error);
    // No hacer throw - esto no debe bloquear el checkout
    localStorage.removeItem('abandoned_cart_id'); // Limpiar de todos modos
  }
}
```

---

## ✅ ¡ESO ES TODO!

Con esos 2 cambios, el sistema estará **100% funcional**:

1. Usuario recibe notificación → Hace clic → Se guarda `cart_id`
2. Usuario completa compra → Se llama `POST /api/cart/recovered/{cartId}` → Backend marca como recuperado
3. Backend trackea métricas de recuperación para el dashboard admin

---

## 🎨 OPCIONAL: Mejoras de UX

### **Mostrar cupón de descuento en la notificación**

Las notificaciones de 24h y 48h incluyen cupones automáticos. Puedes mostrarlos:

**En `notifications.page.html`:**

```html
<ion-card *ngFor="let notif of notifications">
  <ion-card-header>
    <ion-card-title>{{ notif.title }}</ion-card-title>
    
    <!-- ✅ AGREGAR: Mostrar cupón si existe -->
    <div *ngIf="notif.data?.coupon_code" class="coupon-badge">
      <ion-icon name="pricetag"></ion-icon>
      Cupón: <strong>{{ notif.data.coupon_code }}</strong>
    </div>
  </ion-card-header>
  
  <ion-card-content>
    {{ notif.message }}
  </ion-card-content>
</ion-card>
```

**En `notifications.page.scss`:**

```scss
.coupon-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  background: linear-gradient(135deg, #ff6b6b 0%, #ffa500 100%);
  color: white;
  border-radius: 20px;
  font-size: 0.9rem;
  margin-top: 8px;
  
  ion-icon {
    font-size: 1rem;
  }
  
  strong {
    font-weight: 700;
    letter-spacing: 0.5px;
  }
}
```

---

## 🧪 CÓMO PROBAR

### **Opción 1: Prueba rápida con DevTools**

```javascript
// 1. Simular clic en notificación
localStorage.setItem('abandoned_cart_id', '1');

// 2. Completar una orden

// 3. Verificar en Network tab:
// POST /api/cart/recovered/1
```

### **Opción 2: Prueba completa (requiere esperar 1+ hora)**

1. Agrega 2 productos al carrito
2. Cierra la app sin comprar
3. Espera 1 hora (o pide al backend ejecutar jobs manualmente)
4. Abre la app → Pull to refresh en notificaciones
5. Deberías ver: "¿Olvidaste algo? 🛍️"
6. Haz clic → Navega al carrito
7. Completa la compra
8. Verifica en logs: "✅ Carrito marcado como recuperado"

### **Opción 3: Forzar ejecución del backend (sin esperar)**

```bash
# En el servidor backend
php artisan tinker

# Ejecutar jobs manualmente
\App\Jobs\DetectAbandonedCarts::dispatch();
\App\Jobs\SendAbandonedCartNotifications::dispatch();
exit

# Ver logs
tail -f storage/logs/laravel.log
```

---

## 📊 FLUJO COMPLETO DEL SISTEMA:

```
┌─────────────────────────────────────────────────────────────┐
│                    USUARIO (Frontend)                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │ 1. Agrega productos al carrito    │
        │    POST /api/cart/add             │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │ 2. Abandona el carrito            │
        │    (Cierra la app / No compra)    │
        └───────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (Servidor)                        │
└─────────────────────────────────────────────────────────────┘
                            │
          ┌─────────────────┴─────────────────┐
          ▼                                   ▼
┌──────────────────────┐          ┌──────────────────────┐
│  Job 1: Detectar     │          │  Job 2: Enviar       │
│  Carritos            │          │  Notificaciones      │
│  (Cada hora)         │          │  (Cada hora)         │
└──────────────────────┘          └──────────────────────┘
          │                                   │
          ▼                                   ▼
  ¿Carrito sin                      ¿Carrito abandonado?
   actividad >= 1h?                         │
          │                                   │
          ▼                                   ▼
  Marcar como                       Calcular tiempo:
  is_abandoned = true               - 1h  → Notif. 1
  abandoned_at = NOW()              - 24h → Notif. 2
                                    - 48h → Notif. 3
                                            │
                                            ▼
                                    Crear notificación
                                    en user_notifications
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    USUARIO (Frontend)                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │ 3. App sincroniza notificaciones  │
        │    GET /api/user-notifications    │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │ 4. Usuario ve notificación 🛒      │
        │    "¡Tu carrito te espera!"       │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │ 5. Hace clic en notificación      │
        │    → Navega a /tabs/cart          │
        │    → Guarda cart_id en storage    │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │ 6. Completa la compra             │
        │    → Llama POST /api/cart/        │
        │      recovered/{cartId}           │
        └───────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (Servidor)                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │ 7. Marca carrito como recuperado  │
        │    recovered_at = NOW()           │
        │    is_abandoned = false           │
        └───────────────────────────────────┘

🎉 ¡Carrito recuperado exitosamente!
```

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN:

### **✅ BACKEND (Ya completado según la guía que me pasaste):**
- [x] Crear tabla `abandoned_carts` con todos los campos
- [x] Crear modelo `AbandonedCart.php`
- [x] Crear job `DetectAbandonedCarts.php` (detecta cada hora)
- [x] Crear job `SendAbandonedCartNotifications.php` (envía cada 30 min)
- [x] Registrar jobs en `app/Console/Kernel.php`
- [x] Crear endpoint `POST /api/cart/recovered/{cartId}`
- [x] Sistema de cupones automático (10% y 15%)
- [x] Activar scheduler: `php artisan schedule:work`

### **🎯 FRONTEND (Lo único que falta - 15 minutos):**
- [ ] Modificar `notifications.page.ts` → Guardar `cart_id` al hacer clic
- [ ] Modificar `checkout.page.ts` → Llamar `/api/cart/recovered/{cartId}` al completar orden
- [ ] OPCIONAL: Agregar estilos CSS para mostrar cupón
- [ ] OPCIONAL: Agregar badge de cupón en la UI

### **🧪 PRUEBAS:**
- [ ] Agregar productos al carrito y esperar 1 hora
- [ ] Verificar que llega notificación "¿Olvidaste algo? 🛍️"
- [ ] Hacer clic en notificación → Verificar navegación a carrito
- [ ] Completar compra → Verificar llamada a `/api/cart/recovered`
- [ ] Esperar 24h → Verificar segunda notificación con cupón 10%
- [ ] Esperar 48h → Verificar tercera notificación con cupón 15%

---

## 📊 ESTRUCTURA DE NOTIFICACIONES QUE RECIBIRÁS:

### **Primera notificación (1 hora):**
```json
{
  "id": 123,
  "type": "cart_abandoned",
  "title": "¿Olvidaste algo? 🛍️",
  "message": "Tienes 2 productos esperándote en tu carrito por un total de $599.98",
  "data": {
    "cart_id": 45,              // ← IMPORTANTE: Guardar este ID
    "items_count": 2,
    "total": 599.98,
    "icon": "/icons/icon-192x192.png",
    "url": "/cart"
  },
  "read": false,
  "created_at": "2025-10-12T18:30:00Z"
}
```

### **Segunda notificación (24 horas - con cupón 10%):**
```json
{
  "type": "cart_abandoned",
  "title": "¡Tu carrito te espera! 🛒",
  "message": "Completa tu compra ahora y obtén 10% de descuento con el código CART10-ABC123",
  "data": {
    "cart_id": 45,
    "discount": "10%",
    "coupon_code": "CART10-ABC123",  // ← Cupón generado automáticamente
    "icon": "/icons/icon-192x192.png",
    "url": "/cart"
  }
}
```

### **Tercera notificación (48 horas - con cupón 15% + envío gratis):**
```json
{
  "type": "cart_abandoned",
  "title": "¡Última oportunidad! ⏰",
  "message": "15% de descuento + envío gratis. Código: CART15-XYZ789. ¡No dejes pasar esta oferta!",
  "data": {
    "cart_id": 45,
    "discount": "15%",
    "free_shipping": true,
    "coupon_code": "CART15-XYZ789",  // ← Cupón mejorado
    "icon": "/icons/icon-192x192.png",
    "url": "/cart"
  }
}
```

---

## 🎯 FLUJO COMPLETO DEL SISTEMA:

```
┌─────────────────────────────────────────────────────────────┐
│                    USUARIO (Frontend)                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │ 1. Agrega productos al carrito    │
        │    Usuario autenticado            │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │ 2. Cierra la app sin comprar      │
        │    (Abandona el carrito)          │
        └───────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│         BACKEND - Job: DetectAbandonedCarts (Cada hora)     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │ 3. Detecta carrito con >1h sin    │
        │    actividad + productos          │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │ 4. Crea registro en tabla:        │
        │    abandoned_carts                │
        │    - cart_data (JSON)             │
        │    - cart_total                   │
        │    - items_count                  │
        │    - abandoned_at = NOW()         │
        └───────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│    BACKEND - Job: SendAbandonedCartNotifications (Cada 30min)│
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │ 5. Calcula tiempo desde abandono: │
        │    - 1h  → Notif 1 (recordatorio) │
        │    - 24h → Notif 2 (cupón 10%)    │
        │    - 48h → Notif 3 (cupón 15%)    │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │ 6. Crea notificación en:          │
        │    user_notifications             │
        │    type = 'cart_abandoned'        │
        │    data.cart_id = 45              │
        └───────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    USUARIO (Frontend)                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │ 7. App sincroniza notificaciones  │
        │    GET /api/user-notifications    │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │ 8. Usuario ve notificación:       │
        │    "¿Olvidaste algo? 🛍️"          │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │ 9. Hace clic en notificación      │
        │    ✅ localStorage.setItem(       │
        │       'abandoned_cart_id', 45)    │
        │    → Navega a /tabs/cart          │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │ 10. Completa la compra            │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │ 11. Frontend llama:               │
        │     POST /api/cart/recovered/45   │
        └───────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (Servidor)                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │ 12. Marca en abandoned_carts:     │
        │     recovered = true              │
        │     recovered_at = NOW()          │
        └───────────────────────────────────┘

🎉 ¡Carrito recuperado exitosamente!
   → Métrica registrada para dashboard admin
```

---

## 📊 MÉTRICAS ESPERADAS:

### **Tasa de recuperación típica:**
- **20-30%** de los carritos abandonados se recuperan
- **70%** de las recuperaciones ocurren en las primeras 24 horas
- **30%** responden a los cupones de descuento

### **ROI (Retorno de Inversión):**
- **Implementación:** ~2 horas (backend ya hecho, frontend 15 minutos)
- **Aumento en ventas:** 2-3% del total
- **Retorno:** 200-300% en el primer mes

### **Ejemplo práctico:**
```
Carritos abandonados/mes: 100
Valor promedio: $50
Total perdido: $5,000

Con notificaciones (25% recuperación):
Carritos recuperados: 25
Valor recuperado: $1,250/mes = $15,000/año
```

---

## 🚨 LOGS QUE DEBERÍAS VER:

### **Backend (Laravel logs):**
```
[2025-10-12 10:00:00] INFO: 🔍 Detectando carritos abandonados...
[2025-10-12 10:00:05] INFO: ✅ Carrito abandonado detectado para usuario 123
[2025-10-12 10:00:05] INFO: ✅ Detección completada: 5 carritos abandonados detectados

[2025-10-12 11:00:00] INFO: 📧 Enviando notificaciones de carrito abandonado...
[2025-10-12 11:00:02] INFO: 📧 Primera notificación enviada a usuario 123
[2025-10-12 11:00:02] INFO: ✅ Notificaciones enviadas: 3

[2025-10-12 15:30:00] INFO: Carrito recuperado: User 123, Cart 45
```

### **Frontend (Console logs):**
```
📲 Notificación clickeada: { type: 'cart_abandoned', data: { cart_id: 45 } }
🛒 Cart ID guardado: 45
✅ Carrito marcado como recuperado: 45
```

---

## 🎯 RESUMEN ULTRA-CORTO PARA PASARLE AL BACKEND:

**El backend YA tiene todo implementado según tu guía:**
- ✅ Tabla `abandoned_carts` creada
- ✅ Jobs corriendo cada hora/30 min
- ✅ Endpoint `/api/cart/recovered/{cartId}` listo
- ✅ Sistema de cupones automático

**El frontend solo necesita:**
1. Guardar `cart_id` al hacer clic en notificación (5 líneas)
2. Llamar `POST /api/cart/recovered/{cartId}` al completar orden (10 líneas)

**Total: 15 líneas de código, 15 minutos de trabajo.** ✨

---

## 📞 SOPORTE:

### **Para verificar que el backend está funcionando:**
```bash
# Ver si el scheduler está corriendo
php artisan schedule:list

# Ejecutar jobs manualmente (para probar)
php artisan tinker
>>> \App\Jobs\DetectAbandonedCarts::dispatch();
>>> \App\Jobs\SendAbandonedCartNotifications::dispatch();

# Ver logs
tail -f storage/logs/laravel.log

# Ver carritos abandonados
>>> App\Models\AbandonedCart::all();
```

### **Para verificar que el frontend está funcionando:**
```javascript
// En DevTools Console
localStorage.getItem('abandoned_cart_id') // Debería mostrar el cart_id después de hacer clic

// En Network tab
// Deberías ver: POST /api/cart/recovered/45 (al completar orden)
```

---

**✅ CONCLUSIÓN:**

El sistema está **casi completo**. El backend funciona al 100%, solo faltan **2 pequeños cambios** en el frontend (15 minutos) para tener el sistema de recuperación de carritos abandonados completamente funcional y rastreando métricas. 🚀
