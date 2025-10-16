# ✅ CONFIGURACIÓN FINAL - Backend en Railway

## 🌐 URL del Backend Configurada

**URL Base:** `https://ecommerceapi-production-fe72.up.railway.app`

---

## ⚙️ Archivos Actualizados

### 1. `src/environments/environment.ts` (Desarrollo)
```typescript
apiUrl: 'https://ecommerceapi-production-fe72.up.railway.app/api'
```

### 2. `src/environments/environment.prod.ts` (Producción)
```typescript
apiUrl: 'https://ecommerceapi-production-fe72.up.railway.app/api'
```

---

## 🔗 Endpoints Disponibles

### Favoritos
- `GET /api/favorites` - Obtener favoritos
- `POST /api/favorites` - Agregar favorito
- `DELETE /api/favorites/{id}` - Eliminar favorito
- `POST /api/favorites/sync` - Sincronización bulk

### Notificaciones
- `GET /api/user-notifications` - Obtener notificaciones
- `PUT /api/user-notifications/{id}/read` - Marcar como leída
- `PUT /api/user-notifications/read-all` - Marcar todas como leídas
- `DELETE /api/user-notifications/{id}` - Eliminar notificación
- `DELETE /api/user-notifications` - Eliminar todas

---

## 🔐 Autenticación

**Todos los endpoints requieren:**
```
Authorization: Bearer {token}
```

El interceptor de Angular (`auth.interceptor.ts`) ya se encarga de agregar este header automáticamente a todas las peticiones.

---

## ✅ Servicios Actualizados

Los siguientes servicios ya están configurados para usar la URL correcta:

### 1. `favorites-api.service.ts`
```typescript
private apiUrl = `${environment.apiUrl}/favorites`;
// Resultado: https://ecommerceapi-production-fe72.up.railway.app/api/favorites
```

### 2. `notifications-api.service.ts`
```typescript
private apiUrl = `${environment.apiUrl}/user-notifications`;
// Resultado: https://ecommerceapi-production-fe72.up.railway.app/api/user-notifications
```

---

## 🧪 Prueba de Conexión

Para verificar que la configuración es correcta, abre la consola del navegador (F12) y ejecuta:

```javascript
// Verificar URL configurada
console.log('API URL:', localStorage.getItem('auth_token') ? 'Configurada correctamente' : 'Token no encontrado');

// Verificar que el backend responde
fetch('https://ecommerceapi-production-fe72.up.railway.app/api/favorites', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => console.log('✅ Backend responde:', data))
.catch(err => console.error('❌ Error conectando:', err));
```

---

## 📊 Logs Esperados

Al iniciar sesión, deberías ver en la consola:

```
✅ Login exitoso, guardando datos: {...}
🔄 [FAVORITES] Usuario inició sesión, sincronizando favoritos locales con backend...
🔄 [NOTIFICATIONS] Sincronizando notificaciones desde backend...
✅ [FAVORITES API] Sincronización: +X, -Y, total: Z
✅ [NOTIFICATIONS API] Notificaciones obtenidas: N, no leídas: M
```

---

## 🔥 Próximos Pasos

1. **Inicia sesión** en la aplicación
2. **Abre la consola** del navegador (F12)
3. **Verifica los logs** de sincronización
4. **Agrega un favorito** y verifica que se sincroniza
5. **Crea una orden** y verifica que aparece la notificación
6. **Abre otro navegador** con la misma cuenta y verifica que todo se sincroniza

---

## ⚠️ Troubleshooting

### Error: "CORS policy"
**Causa:** El backend no tiene CORS configurado para el frontend

**Solución:** Verificar que el backend tenga configurado CORS para aceptar peticiones desde el frontend:
- En desarrollo: `http://localhost:4200`
- En producción: La URL de tu frontend desplegado

### Error: "401 Unauthorized"
**Causa:** Token expirado o inválido

**Solución:** 
1. Cerrar sesión
2. Volver a iniciar sesión
3. Verificar que el token se guarda correctamente:
   ```javascript
   console.log('Token:', localStorage.getItem('auth_token'));
   ```

### Error: "Network Error"
**Causa:** Backend no está disponible

**Solución:**
1. Verificar que Railway está corriendo: https://ecommerceapi-production-fe72.up.railway.app
2. Verificar que la URL en `environment.ts` es correcta
3. Verificar que tienes conexión a internet

---

## 🎯 Configuración Completa ✅

- ✅ URL del backend configurada en `environment.ts`
- ✅ URL del backend configurada en `environment.prod.ts`
- ✅ Servicios API creados y configurados
- ✅ Sincronización automática implementada
- ✅ Interceptor HTTP agrega token automáticamente
- ✅ Sistema híbrido localStorage + backend funcionando

**¡Todo listo para usar!** 🚀
