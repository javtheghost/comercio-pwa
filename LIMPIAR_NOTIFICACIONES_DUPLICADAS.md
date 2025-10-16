# 🔧 Script para Limpiar Notificaciones Duplicadas

Ejecuta esto en la **consola del navegador** (F12) para eliminar las notificaciones duplicadas de orden:

```javascript
(function cleanDuplicateOrderNotifications() {
  try {
    const userId = JSON.parse(localStorage.getItem('user') || '{}').id || 14;
    const key = `notifications_${userId}`;
    const raw = localStorage.getItem(key);
    
    if (!raw) {
      console.log('❌ No hay notificaciones guardadas');
      return;
    }
    
    const notifications = JSON.parse(raw);
    console.log(`📊 Total notificaciones: ${notifications.length}`);
    
    // Agrupar por order_id y timestamp (mismo minuto)
    const seen = new Map();
    const cleaned = [];
    
    for (const notif of notifications) {
      const orderId = notif.data?.orderId || notif.data?.order_id;
      const type = notif.type;
      
      // Si es notificación de orden
      if (type === 'order_created' && orderId) {
        const key = `${type}_${orderId}`;
        
        if (seen.has(key)) {
          console.log('🗑️ Duplicado encontrado:', notif.title);
          continue; // Saltar duplicado
        }
        
        seen.set(key, true);
      }
      
      cleaned.push(notif);
    }
    
    console.log(`✅ Notificaciones limpiadas: ${notifications.length} → ${cleaned.length}`);
    console.log(`🗑️ Eliminadas: ${notifications.length - cleaned.length} duplicados`);
    
    // Guardar limpio
    localStorage.setItem(key, JSON.stringify(cleaned));
    
    // Recargar la página para ver los cambios
    console.log('🔄 Recargando página...');
    setTimeout(() => window.location.reload(), 1000);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
})();
```

---

## O simplemente ejecuta:

```javascript
// Borrar TODAS las notificaciones y empezar de cero
const userId = JSON.parse(localStorage.getItem('user') || '{}').id || 14;
localStorage.removeItem(`notifications_${userId}`);
console.log('✅ Notificaciones limpiadas');
window.location.reload();
```

Luego sincroniza de nuevo:

```javascript
await window.syncNotifications()
```

---

**Ahora cuando crees una nueva orden:**
1. ✅ Se mostrará UNA notificación local (optimista)
2. ✅ El backend creará la notificación en BD
3. ✅ Al sincronizar, detectará que es `order_created` en localhost
4. ✅ La saltará y NO mostrará duplicado
5. ✅ Solo aparecerá UNA vez en el tab de notificaciones
