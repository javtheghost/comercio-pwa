# 🐛 DEBUG: Auto-Sync de Notificaciones

## ⚡ CAMBIOS REALIZADOS

### 1. ✅ **Eliminación de Duplicados**
- Ahora usa `backendId` como identificador único
- Filtra automáticamente notificaciones duplicadas del mismo carrito
- Mantiene solo la versión más reciente de cada notificación

### 2. ✅ **Logs Mejorados para Auto-Sync**
- Logs con timestamp para ver exactamente cuándo se ejecuta cada sincronización
- Información del intervalo configurado
- Sincronización inicial inmediata al iniciar
- Comando de debug: `window.debugAutoSync()`

## 🔍 CÓMO VERIFICAR SI FUNCIONA

### **Paso 1: Recargar la App**
```
Ctrl + Shift + R
```

### **Paso 2: Verificar que Auto-Sync Inició**
Abre la consola del navegador (F12) y busca:
```
🚀 [AUTO-SYNC] INICIANDO sincronización automática cada 30 segundos
⏰ [AUTO-SYNC] Intervalo configurado: 30000ms (30s)
✅ [AUTO-SYNC] Intervalo configurado correctamente. ID: [número]
```

### **Paso 3: Verificar Sincronizaciones Periódicas**
Cada 30 segundos deberías ver:
```
🔄 [AUTO-SYNC] [HH:MM:SS] Sincronizando notificaciones...
🔄 [SYNC] [HH:MM:SS] Iniciando sincronización...
🔄 [SYNC] Usuario autenticado (ID: XX), solicitando notificaciones al backend...
📋 [NOTIFICATIONS] Notificaciones recibidas del backend: X
✅ [NOTIFICATIONS] X notificaciones únicas sincronizadas desde backend
```

### **Paso 4: Comando de Debug**
En la consola del navegador ejecuta:
```javascript
window.debugAutoSync()
```

Deberías ver:
```javascript
{
  isActive: true,
  intervalId: [número mayor a 0],
  intervalMs: 30000,
  intervalSeconds: 30
}
```

## 🧪 PRUEBA DE NOTIFICACIONES DE CARRITO ABANDONADO

### **Opción A: Esperar 1 Hora (Producción Real)**
1. Agrega productos al carrito
2. NO completes la orden
3. Espera 1 hora sin tocar el carrito
4. El backend enviará la notificación automáticamente
5. Máximo en 30 segundos verás la notificación popup

### **Opción B: Forzar con Tinker (Desarrollo)**

#### **En Laravel Backend:**
```bash
php artisan tinker
```

```php
// Encontrar tu carrito
$cart = \App\Models\Cart::where('user_id', 14)->first();

// Simular que tiene más de 1 hora de antigüedad
$cart->updated_at = now()->subHours(2);
$cart->save();

// Ejecutar detección de carritos abandonados
\Artisan::call('cart:detect-abandoned');

// Enviar notificaciones
\App\Jobs\SendAbandonedCartNotifications::dispatch();
```

#### **Verificar en la consola del frontend:**
En máximo 30 segundos verás:
```
🔄 [AUTO-SYNC] [HH:MM:SS] Sincronizando notificaciones...
📋 [NOTIFICATIONS] Notificaciones recibidas del backend: X
🆕 [NOTIFICATIONS] Notificaciones nuevas sin leer: 1
🔔 [NOTIFICATIONS] Mostrando notificación push para: ¡Tu carrito te espera!
```

Y deberías ver el **popup del navegador**.

## ❌ SI NO FUNCIONA

### **Problema 1: Auto-Sync No Inicia**
Busca en consola:
```
✅ Usuario autenticado, iniciando auto-sync
```

Si NO aparece, el problema es que el usuario no se detecta como autenticado al inicializar.

**Solución Manual:**
```javascript
window.startAutoSync()
```

### **Problema 2: Sincroniza Pero No Aparece Popup**
Verifica permisos de notificaciones:
```javascript
Notification.permission
```

Debe decir: `"granted"`

Si dice `"denied"`:
1. Ve a configuración del navegador
2. Busca "Notificaciones" o "Permisos"
3. Busca `localhost` o tu dominio
4. Habilita notificaciones

### **Problema 3: Sigue Apareciendo Duplicado**
Ejecuta en consola:
```javascript
// Ver notificaciones guardadas
const user = JSON.parse(localStorage.getItem('secure_user'));
const notifications = JSON.parse(localStorage.getItem('notifications_' + user.id));
console.log('Total:', notifications.length);

// Ver si hay duplicados por backendId
const backendIds = notifications.map(n => n.backendId);
const uniqueIds = [...new Set(backendIds)];
console.log('Únicos:', uniqueIds.length);
console.log('Duplicados:', notifications.length - uniqueIds.length);
```

Si hay duplicados, limpia manualmente:
```javascript
const key = 'notifications_' + user.id;
const unique = new Map();
notifications.forEach(n => {
  if (n.backendId) unique.set(n.backendId, n);
});
localStorage.setItem(key, JSON.stringify([...unique.values()]));
location.reload();
```

## 📊 ESTADÍSTICAS DE AUTO-SYNC

### **Cada Sincronización Consume:**
- ~5-10 KB de datos
- 1 petición HTTP al backend
- Duración: ~100-300ms

### **En 1 Hora (120 sincronizaciones):**
- ~600 KB - 1.2 MB de datos
- Negligible comparado con YouTube (1-5 MB/min)
- Menor que Instagram (2-3 MB/min scroll)

## 🔧 COMANDOS ÚTILES

```javascript
// Ver estado del auto-sync
window.debugAutoSync()

// Detener auto-sync (si molesta durante desarrollo)
window.stopAutoSync()

// Reiniciar auto-sync
window.startAutoSync()

// Forzar sincronización manual inmediata
await window.syncNotifications()

// Ver todas las notificaciones guardadas
const user = JSON.parse(localStorage.getItem('secure_user'));
JSON.parse(localStorage.getItem('notifications_' + user.id))
```

## 🎯 EXPECTATIVA REALISTA

### **¿Cuándo llegarán las notificaciones?**

✅ **Escenario Ideal (Todo Funcionando):**
- Backend crea notificación → Máximo 30 segundos → Popup aparece

✅ **Escenario Real (Con App Cerrada):**
- Backend crea notificación → Usuario abre app → Máximo 30 segundos → Popup aparece

❌ **Lo que NO funciona (Todavía):**
- App cerrada → Backend crea notificación → Popup aparece (requiere Web Push con VAPID en producción)

### **Para Notificaciones con App Cerrada:**
Se requiere implementar **Web Push con VAPID** en producción:
1. Generar claves VAPID en backend
2. Configurar `.env` con claves públicas/privadas
3. Suscribir navegador con `pushManager.subscribe()`
4. Backend envía push directamente al navegador
5. Service Worker muestra notificación

**Estado Actual:**
- ✅ Localhost: Notificaciones locales cuando app abierta
- ⚠️ Producción: Requiere configuración VAPID (pendiente)

