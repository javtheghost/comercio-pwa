# 🧪 PRUEBA SIMPLE - NOTIFICACIÓN DE CARRITO ABANDONADO

## ✅ SOLUCIÓN: Botón de prueba en la aplicación

He agregado un **botón de prueba** directamente en la página de notificaciones de tu aplicación.

---

## 📝 INSTRUCCIONES MUY SIMPLES:

### **1️⃣ Abre tu aplicación**
```
http://localhost:4200
```

### **2️⃣ Loguéate** (si no lo has hecho)
- Ve a la página de login
- Ingresa tus credenciales
- Inicia sesión

### **3️⃣ Ve a la página de Notificaciones**
- Haz clic en el tab de **Notificaciones** 🔔 (en el menú inferior)
- O navega a: `http://localhost:4200/tabs/notifications`

### **4️⃣ Busca el botón de prueba**
En la esquina superior derecha verás un **icono de matraz** 🧪 (flask) de color **naranja/amarillo**

### **5️⃣ Haz clic en el botón 🧪**
- Se creará automáticamente una notificación de carrito abandonado
- Verás un mensaje: "✅ Notificación de prueba creada. Haz clic en ella para probar la funcionalidad."

### **6️⃣ Verifica el resultado**
Deberías ver:
- ✅ Una **notificación nueva** en la parte superior
- ✅ Con **fondo naranja** (gradiente)
- ✅ Icono de **carrito** 🛒 con animación bounce
- ✅ Título: **"¡Tu carrito te espera! 🛒"**
- ✅ Mensaje: **"Completa tu compra ahora y obtén 10% de descuento con el código CART10-TEST"**

### **7️⃣ Prueba la funcionalidad**
**HAZ CLIC en la notificación:**
- Debería llevarte a la página del **carrito** (`/cart`)
- En localStorage se guardará `abandoned_cart_id = 999`

**Para verificar:**
1. Presiona `F12` para abrir DevTools
2. Ve a la pestaña "Console"
3. Escribe: `localStorage.getItem('abandoned_cart_id')`
4. Deberías ver: `"999"`

### **8️⃣ Prueba completa del flujo**
1. Agrega productos al carrito
2. Completa una orden (checkout)
3. El sistema automáticamente:
   - ✅ Llamará a `POST /api/cart/recovered/999`
   - ✅ Limpiará el `abandoned_cart_id` del localStorage
   - ✅ En el backend se marcará como `recovered = true`

---

## 🎯 UBICACIÓN DEL BOTÓN

```
┌─────────────────────────────────────────┐
│  🔔 Notificaciones (2)     🧪 ✓ 🗑️     │ ← Botón naranja aquí
├─────────────────────────────────────────┤
│                                         │
│  📋 Lista de notificaciones...         │
│                                         │
└─────────────────────────────────────────┘
```

El botón 🧪 está al lado de los botones de "marcar como leído" (✓) y "eliminar todo" (🗑️)

---

## ❓ SI NO VES EL BOTÓN

1. **Recarga la página** (F5)
2. **Verifica que estés en:** `http://localhost:4200/tabs/notifications`
3. **Verifica que estés logueado**
4. **Si no aparece**, verifica en la consola del navegador si hay errores

---

## 🔧 CÓDIGO AGREGADO

### **HTML** (`notifications.page.html`):
```html
<!-- 🧪 BOTÓN DE PRUEBA TEMPORAL -->
<ion-button 
  (click)="createTestNotification()"
  class="header-action-btn"
  color="warning"
  title="Crear notificación de prueba">
  <ion-icon name="flask-outline" slot="icon-only"></ion-icon>
</ion-button>
```

### **TypeScript** (`notifications.page.ts`):
```typescript
/**
 * 🧪 MÉTODO DE PRUEBA: Crear notificación de carrito abandonado
 */
async createTestNotification(): Promise<void> {
  // Verifica que estés logueado
  // Crea notificación de prueba
  // Muestra toast de éxito
  // Agrega a la lista visible
}
```

---

## ✅ VENTAJAS DE ESTE MÉTODO

1. ✅ **Más fácil** - Solo un clic
2. ✅ **Más seguro** - No requiere pegar código
3. ✅ **Visual** - Ves el resultado inmediatamente
4. ✅ **Integrado** - Funciona dentro de tu aplicación
5. ✅ **Compartido** - Usa el mismo localStorage que tu app

---

## 🗑️ ELIMINAR EL BOTÓN DESPUÉS

Cuando termines de probar, puedes eliminar el botón:

1. Abre: `src/app/pages/notifications/notifications.page.html`
2. Busca: `<!-- 🧪 BOTÓN DE PRUEBA TEMPORAL -->`
3. Elimina ese bloque de código
4. También elimina el método `createTestNotification()` en el archivo `.ts`

---

**¡Listo! Ahora es mucho más fácil probar la funcionalidad. Solo haz clic en el botón 🧪 y verás la magia ✨**
