# 🧹 Script de Limpieza de Notificaciones Duplicadas

## 🎯 Ejecuta esto en la consola del navegador (F12):

### **Opción 1: Limpiar duplicados automáticamente**

```javascript
(function cleanDuplicateNotifications() {
  const userId = JSON.parse(localStorage.getItem('user') || '{}').id || 14;
  const key = `notifications_${userId}`;
  const raw = localStorage.getItem(key);
  
  if (!raw) {
    console.log('❌ No hay notificaciones guardadas');
    return;
  }
  
  const notifications = JSON.parse(raw);
  console.log(`📊 Total notificaciones antes: ${notifications.length}`);
  
  // Limpiar por backendId
  const seen = new Map();
  const unique = [];
  
  for (const notif of notifications) {
    const backendId = notif.backendId;
    
    if (!backendId) {
      // Si no tiene backendId, mantenerlo pero verificar por id
      if (!seen.has(notif.id)) {
        unique.push(notif);
        seen.set(notif.id, true);
      }
      continue;
    }
    
    if (seen.has(backendId)) {
      console.log('🗑️ Duplicado:', notif.title, `(backendId: ${backendId})`);
      continue;
    }
    
    seen.set(backendId, true);
    unique.push(notif);
  }
  
  console.log(`📊 Total notificaciones después: ${unique.length}`);
  console.log(`🗑️ Eliminados: ${notifications.length - unique.length} duplicados`);
  
  localStorage.setItem(key, JSON.stringify(unique));
  console.log('✅ Notificaciones limpiadas y guardadas');
  
  // Disparar evento de actualización
  window.dispatchEvent(new CustomEvent('notifications:updated'));
  
  console.log('🔄 Página actualizada');
})();
```

---

### **Opción 2: Borrar TODO y resincronizar (más agresivo)**

```javascript
(async function resetNotifications() {
  const userId = JSON.parse(localStorage.getItem('user') || '{}').id || 14;
  const key = `notifications_${userId}`;
  
  // Borrar todas
  localStorage.removeItem(key);
  console.log('🗑️ Notificaciones eliminadas');
  
  // Resincronizar desde backend
  await window.syncNotifications();
  console.log('✅ Resincronizadas desde backend');
  
  // Disparar actualización
  window.dispatchEvent(new CustomEvent('notifications:updated'));
  console.log('🔄 Página actualizada');
})();
```

---

### **Opción 3: Verificar duplicados sin borrar**

```javascript
(function checkDuplicates() {
  const userId = JSON.parse(localStorage.getItem('user') || '{}').id || 14;
  const key = `notifications_${userId}`;
  const raw = localStorage.getItem(key);
  
  if (!raw) {
    console.log('❌ No hay notificaciones');
    return;
  }
  
  const notifications = JSON.parse(raw);
  console.log(`📊 Total: ${notifications.length}`);
  
  const backendIds = notifications.map(n => n.backendId).filter(Boolean);
  const uniqueBackendIds = new Set(backendIds);
  
  const duplicateCount = backendIds.length - uniqueBackendIds.size;
  
  if (duplicateCount > 0) {
    console.warn(`⚠️ Se encontraron ${duplicateCount} duplicados`);
    
    // Mostrar cuáles están duplicados
    const counts = new Map();
    backendIds.forEach(id => {
      counts.set(id, (counts.get(id) || 0) + 1);
    });
    
    console.log('🔍 IDs duplicados:');
    counts.forEach((count, id) => {
      if (count > 1) {
        const notifs = notifications.filter(n => n.backendId === id);
        console.log(`  - backendId ${id}: ${count} veces`);
        console.log(`    Títulos:`, notifs.map(n => n.title));
      }
    });
  } else {
    console.log('✅ No hay duplicados');
  }
  
  // Mostrar lista de IDs
  console.log('📋 BackendIds actuales:', Array.from(uniqueBackendIds));
})();
```

---

## 🎯 **RECOMENDACIÓN:**

1. **Primero ejecuta Opción 3** para ver si hay duplicados
2. Si hay duplicados, **ejecuta Opción 1** para limpiarlos
3. Si sigues teniendo problemas, **ejecuta Opción 2** para resetear todo

---

## ✅ **DESPUÉS DE LIMPIAR:**

Recarga la página de notificaciones:
- Ve a otro tab
- Vuelve al tab de notificaciones
- Deberías ver solo UNA notificación de cada tipo

---

## 🔧 **SI EL PROBLEMA PERSISTE:**

Agrega esto al código de sincronización para prevenir duplicados en el futuro:

```typescript
// En notification.service.ts, método syncNotificationsFromBackend()

// DESPUÉS de cargar desde backend, ANTES de guardar:
const uniqueNotifications = [];
const seen = new Set();

for (const notif of localNotifications) {
  if (!seen.has(notif.backendId)) {
    seen.add(notif.backendId);
    uniqueNotifications.push(notif);
  }
}

// Guardar solo las únicas
localStorage.setItem(key, JSON.stringify(uniqueNotifications));
```

---

**Ejecuta Opción 1 ahora y dime cuántos duplicados encontró! 🔍**
