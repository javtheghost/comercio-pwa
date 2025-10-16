# 🔍 DEBUG: Iconos de Notificaciones No Aparecen

## 📋 DIAGNÓSTICO PASO A PASO

Ejecuta estos comandos **EN ORDEN** en la consola del navegador (F12 → Console):

---

### **PASO 1: Verificar que el backend envía el icono**

```javascript
// Ver el token de autenticación
const token = localStorage.getItem('authToken');
console.log('Token:', token ? '✅ Existe' : '❌ No existe');

// Hacer petición al backend
fetch('http://localhost:8000/api/user-notifications', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json'
  }
})
.then(r => r.json())
.then(data => {
  console.log('═══════════════════════════════════════════');
  console.log('📋 RESPUESTA DEL BACKEND:');
  console.log('═══════════════════════════════════════════');
  console.log('Total notificaciones:', data.data?.length || 0);
  
  if (data.data && data.data.length > 0) {
    const primera = data.data[0];
    console.log('\n🔍 PRIMERA NOTIFICACIÓN:');
    console.log('ID:', primera.id);
    console.log('Tipo:', primera.type);
    console.log('Título:', primera.title);
    console.log('Data completo:', primera.data);
    console.log('data.icon:', primera.data?.icon);
    console.log('data.image:', primera.data?.image);
    
    // Verificar TODAS las notificaciones
    console.log('\n📊 RESUMEN DE TODAS LAS NOTIFICACIONES:');
    data.data.forEach((n, i) => {
      console.log(`${i + 1}. ${n.title}`);
      console.log(`   - data.icon: ${n.data?.icon || '❌ NO TIENE'}`);
      console.log(`   - data.image: ${n.data?.image || '❌ NO TIENE'}`);
    });
  } else {
    console.log('❌ No hay notificaciones');
  }
  console.log('═══════════════════════════════════════════\n');
})
.catch(err => {
  console.error('❌ Error:', err);
});
```

**RESULTADO ESPERADO:**
```
📋 RESPUESTA DEL BACKEND:
Total notificaciones: 2

🔍 PRIMERA NOTIFICACIÓN:
ID: 1
Tipo: order_created
Título: Pedido Creado
Data completo: {order_id: 123, icon: "/assets/icons/order-created.svg", url: "/orders/123"}
data.icon: /assets/icons/order-created.svg  ← ✅ DEBE TENER VALOR
data.image: undefined
```

**SI `data.icon` es undefined → EL PROBLEMA ESTÁ EN EL BACKEND**

---

### **PASO 2: Verificar localStorage**

```javascript
// Ver usuario actual
const user = JSON.parse(localStorage.getItem('app_user'));
console.log('═══════════════════════════════════════════');
console.log('👤 USUARIO ACTUAL:');
console.log('═══════════════════════════════════════════');
console.log('User ID:', user?.id);
console.log('Email:', user?.email);

// Ver notificaciones guardadas
const key = `app_notifications_${user?.id || 'guest'}`;
const notifs = JSON.parse(localStorage.getItem(key) || '[]');

console.log('\n💾 NOTIFICACIONES EN LOCALSTORAGE:');
console.log('═══════════════════════════════════════════');
console.log('Total guardadas:', notifs.length);

if (notifs.length > 0) {
  console.log('\n🔍 PRIMERA NOTIFICACIÓN GUARDADA:');
  const primera = notifs[0];
  console.log('ID:', primera.id);
  console.log('Título:', primera.title);
  console.log('Icon:', primera.icon || '❌ NO TIENE');
  console.log('Data:', primera.data);
  console.log('Data.icon:', primera.data?.icon || '❌ NO TIENE');
  
  console.log('\n📊 TODAS LAS NOTIFICACIONES:');
  notifs.forEach((n, i) => {
    console.log(`${i + 1}. ${n.title}`);
    console.log(`   - icon: ${n.icon || '❌ NO TIENE'}`);
    console.log(`   - data.icon: ${n.data?.icon || '❌ NO TIENE'}`);
  });
} else {
  console.log('❌ No hay notificaciones guardadas');
}
console.log('═══════════════════════════════════════════\n');
```

**RESULTADO ESPERADO:**
```
💾 NOTIFICACIONES EN LOCALSTORAGE:
Total guardadas: 2

🔍 PRIMERA NOTIFICACIÓN GUARDADA:
ID: backend_1
Título: Pedido Creado
Icon: /assets/icons/order-created.svg  ← ✅ DEBE TENER VALOR
Data: {order_id: 123, icon: "/assets/icons/order-created.svg"}
Data.icon: /assets/icons/order-created.svg
```

**SI `icon` es undefined → EL PROBLEMA ESTÁ EN notification.service.ts**

---

### **PASO 3: Forzar resincronización**

```javascript
console.log('🔄 LIMPIANDO Y RESINCRONIZANDO...\n');

// Limpiar notificaciones antiguas
const user = JSON.parse(localStorage.getItem('app_user'));
const key = `app_notifications_${user?.id || 'guest'}`;
localStorage.removeItem(key);
console.log('✅ Notificaciones eliminadas de localStorage');

// Recargar página para forzar resincronización
console.log('🔄 Recargando página...');
setTimeout(() => location.reload(), 1000);
```

Después de recargar, busca en la consola estos logs:

```
📋 [NOTIFICATIONS] Notificaciones recibidas del backend: X
🔍 [DEBUG] Primera notificación: {...}
🎨 [NOTIFICATIONS] Icono de notificación: {...}
✅ [NOTIFICATIONS] X notificaciones sincronizadas desde backend
🔍 [DEBUG] Muestra de notificación guardada: {...}
```

---

### **PASO 4: Verificar HTML de la página**

```javascript
// Ver cómo se está renderizando el HTML
const notifItems = document.querySelectorAll('.notification-item');
console.log('═══════════════════════════════════════════');
console.log('🎨 NOTIFICACIONES EN EL DOM:');
console.log('═══════════════════════════════════════════');
console.log('Total elementos:', notifItems.length);

notifItems.forEach((item, i) => {
  const title = item.querySelector('.notification-title')?.textContent;
  const iconWrapper = item.querySelector('.icon-wrapper');
  const ionIcon = item.querySelector('ion-icon');
  
  console.log(`\n${i + 1}. ${title}`);
  console.log('   - Icon wrapper:', iconWrapper ? '✅ Existe' : '❌ No existe');
  console.log('   - Ion-icon:', ionIcon ? '✅ Existe' : '❌ No existe');
  console.log('   - Icon name:', ionIcon?.getAttribute('name') || '❌ Sin nombre');
  console.log('   - Icon src:', ionIcon?.getAttribute('src') || '❌ Sin src');
});
console.log('═══════════════════════════════════════════\n');
```

---

## 🎯 DIAGNÓSTICO SEGÚN LOS RESULTADOS

### **CASO A: `data.icon` NO viene del backend**
```
data.icon: undefined  ← ❌ PROBLEMA EN BACKEND
```

**SOLUCIÓN:** El backend no está enviando el icono. Verifica que:
- Las notificaciones en la BD tienen `data->icon`
- El controlador está devolviendo el campo `data` completo
- No hay filtros o transformadores que eliminen el campo

---

### **CASO B: `data.icon` viene del backend pero NO se guarda en localStorage**
```
Backend: data.icon: "/assets/icons/order-created.svg"  ← ✅ OK
localStorage: icon: undefined  ← ❌ NO SE GUARDÓ
```

**SOLUCIÓN:** Problema en `notification.service.ts` al mapear. Revisar el método `syncNotificationsFromBackend()`.

---

### **CASO C: `icon` está en localStorage pero NO aparece en el HTML**
```
localStorage: icon: "/assets/icons/order-created.svg"  ← ✅ OK
DOM: Icon name: cart-outline  ← ❌ NO USA EL ICONO CORRECTO
```

**SOLUCIÓN:** Problema en `notifications.page.html` o `notifications.page.ts`. La página no está usando el campo `icon`, está usando un método `getNotificationIcon(type)` que devuelve íconos de Ionicons.

---

## 🚨 EJECUTA ESTOS COMANDOS Y ENVÍAME LOS RESULTADOS

Por favor ejecuta los **PASO 1, PASO 2 y PASO 4** y envíame un screenshot o copia/pega de lo que aparece en la consola.

Así podré saber exactamente dónde está el problema y cómo arreglarlo.
