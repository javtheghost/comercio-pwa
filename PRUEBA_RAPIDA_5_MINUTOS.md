# 🚀 PRUEBA RÁPIDA - 5 minutos

## ✅ LO QUE YA TIENES:
- ✅ Backend funcionando en `localhost:8000`
- ✅ Usuario ID: 14 con carrito abandonado
- ✅ Notificación ID: 6 creada y lista
- ✅ Frontend con todo el código implementado
- ✅ `environment.apiUrl` apunta a `http://localhost:8000/api`

---

## 🎯 PASOS PARA PROBAR (5 minutos):

### **1️⃣ Iniciar sesión (30 segundos)**
```
1. Abre tu app: http://localhost:4200 (o tu puerto)
2. Inicia sesión con el usuario ID 14
```

---

### **2️⃣ Ver la notificación (30 segundos)**
```
1. Ve al tab "Notificaciones" 🔔
2. Arrastra hacia abajo (pull to refresh)
3. Deberías ver: "¿Olvidaste algo? 🛍️"
4. Verifica que tenga diseño naranja con icono de carrito
```

**✅ Esperado:**
- Notificación visible
- Badge "New"
- Diseño naranja 🛒

---

### **3️⃣ Hacer clic en la notificación (10 segundos)**
```
1. Haz clic en "¿Olvidaste algo? 🛍️"
2. Deberías ir a /tabs/cart automáticamente
```

**✅ Verifica en Console (F12):**
```
🛒 Cart ID guardado para recuperación: 1
```

**✅ Verifica en DevTools > Application > Local Storage:**
```
abandoned_cart_id = "1"
```

---

### **4️⃣ Completar la compra (2 minutos)**
```
1. Desde el carrito, haz clic en "Checkout" o "Pagar"
2. Completa el formulario de dirección
3. Confirma la orden
```

**✅ Verifica en Console (F12):**
```
🛒 [CHECKOUT] Marcando carrito como recuperado: 1
✅ [CHECKOUT] Carrito marcado como recuperado: { success: true }
```

**✅ Verifica en DevTools > Network Tab:**
```
POST http://localhost:8000/api/cart/recovered/1
Status: 200 OK
```

**✅ Verifica en Local Storage:**
```
abandoned_cart_id → (eliminado)
```

---

### **5️⃣ Verificar en el backend (30 segundos)**
```sql
-- Ejecuta en tu BD:
SELECT * FROM abandoned_carts WHERE id = 1;

-- Deberías ver:
recovered: 1
recovered_at: 2025-10-12 HH:MM:SS
```

**✅ Ver logs:**
```bash
tail -f storage/logs/laravel.log

# Deberías ver:
"Carrito marcado como recuperado - User: 14, Cart: 1"
```

---

## 🎉 ¡LISTO!

Si todos los pasos funcionaron:
- ✅ El sistema está 100% funcional
- ✅ Las notificaciones se sincronizan correctamente
- ✅ El carrito se marca como recuperado
- ✅ Las métricas se guardan en la BD

---

## 🧪 PRUEBAS ADICIONALES (Opcional):

### **Probar con Postman:**
```http
POST http://localhost:8000/api/cart/recovered/1
Authorization: Bearer {tu-token}
```

**Respuesta esperada:**
```json
{
  "success": true,
  "message": "Carrito marcado como recuperado"
}
```

---

### **Resetear para probar de nuevo:**
```sql
-- Marcar como no recuperado
UPDATE abandoned_carts 
SET recovered = 0, recovered_at = NULL 
WHERE id = 1;

-- Crear nueva notificación
INSERT INTO notifications (user_id, type, title, message, data, `read`, created_at, updated_at)
VALUES (
  14,
  'cart_abandoned',
  '¿Olvidaste algo? 🛍️',
  'Tienes 1 producto esperándote',
  '{"cart_id": 1, "items_count": 2, "total": "2085.68", "url": "/cart"}',
  0,
  NOW(),
  NOW()
);
```

Luego: Pull to refresh en notificaciones y repite el flujo.

---

## 🐛 TROUBLESHOOTING:

### **No aparece la notificación:**
- Verifica que iniciaste sesión como usuario 14
- Verifica en BD: `SELECT * FROM notifications WHERE user_id = 14`
- Prueba hacer pull to refresh varias veces

### **Error 401 al marcar como recuperado:**
- Token inválido o expirado
- Cierra sesión y vuelve a iniciar sesión

### **cart_id no se guarda:**
- Verifica en Console que salga: "🛒 Cart ID guardado"
- Verifica que `notification.type === 'cart_abandoned'`

---

**✅ TODO LISTO - ¡A probar!** 🚀
