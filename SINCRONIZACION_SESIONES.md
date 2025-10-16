# 🔄 SINCRONIZACIÓN DE SESIONES ENTRE NAVEGADORES Y TABS

## 📋 PROBLEMA IDENTIFICADO

### Escenario: Login simultáneo en múltiples navegadores/tabs

```
Usuario abre:
├─ Chrome (Tab 1) → Login → Token: abc123
├─ Firefox (Tab 2) → Login → Token: xyz789 (NUEVO)
└─ Chrome (Tab 1) → ❌ Token abc123 ya no es válido
```

**Problemas:**
1. ❌ El backend invalida el token anterior al crear uno nuevo (Sanctum single token mode)
2. ❌ Las peticiones del navegador con token viejo fallan con 401
3. ❌ No hay sincronización automática entre tabs/navegadores
4. ❌ Los cambios en un navegador no se reflejan en el otro

---

## ✅ SOLUCIÓN IMPLEMENTADA

### **1. Detección de Token Inválido** (Ya existía)

**Ubicación:** `auth.interceptor.ts`

```typescript
// El interceptor ya detecta 401 y:
if (error.status === 401) {
  // 1. Intenta renovar el token
  // 2. Si falla, cierra sesión automáticamente
  authService.logout().subscribe();
}
```

**Resultado:**
- ✅ Si el token es inválido, se cierra sesión automáticamente
- ✅ El usuario es redirigido al login

---

### **2. Nuevo Servicio: SessionSyncService**

**Ubicación:** `src/app/services/session-sync.service.ts`

Este servicio sincroniza sesiones entre múltiples tabs del **mismo navegador**.

#### **Funcionalidades:**

##### **A. Detección de Logout Remoto**
```typescript
// Tab 1: Usuario cierra sesión
authService.logout(); 
// ↓ Dispara evento 'userLoggedOut'
// ↓ SessionSyncService envía mensaje a otras tabs

// Tab 2: Recibe mensaje
handleRemoteLogout() {
  // Cierra sesión SIN llamar a la API
  authService.clearLocalSession();
  // Muestra notificación al usuario
}
```

**Resultado:**
- ✅ Cerrar sesión en una tab cierra sesión en TODAS las tabs del mismo navegador

---

##### **B. Detección de Login Remoto**
```typescript
// Tab 1: Usuario inicia sesión
authService.login(credentials);
// ↓ Dispara evento 'userLoggedIn'
// ↓ SessionSyncService envía mensaje a otras tabs

// Tab 2: Recibe mensaje
handleRemoteLogin() {
  // Verifica si el token cambió
  // Recarga estado de autenticación
  authService.checkAuthStatus();
  // Sincroniza favoritos y notificaciones
  syncAllData();
}
```

**Resultado:**
- ✅ Iniciar sesión en una tab actualiza TODAS las tabs del mismo navegador
- ✅ Los datos se sincronizan automáticamente

---

##### **C. Sincronización de Datos**
```typescript
// Cuando la app vuelve a estar visible
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // Verificar si hubo actividad reciente
    // Si sí, sincronizar datos
    this.syncAllData();
  }
});
```

**Resultado:**
- ✅ Cambiar de tab y volver sincroniza favoritos y notificaciones
- ✅ Los datos están siempre actualizados

---

### **3. Métodos Nuevos en AuthService**

#### **`clearLocalSession()`**
```typescript
// Cerrar sesión SIN llamar a la API
// Usado cuando otra tab ya cerró la sesión
clearLocalSession(): void {
  this.clearAuthData();
  window.dispatchEvent(new CustomEvent('userLoggedOut'));
}
```

#### **`checkAuthStatus()`**
```typescript
// Verificar estado actual de autenticación
// Útil para sincronizar entre tabs
async checkAuthStatus(): Promise<boolean> {
  const token = this.securityService.getTokenSync();
  const user = await this.securityService.getSecureUser();
  
  if (token && user) {
    // Actualizar estado
    this.authStateSubject.next({ isAuthenticated: true, user, token });
    return true;
  } else {
    this.clearAuthData();
    return false;
  }
}
```

---

## 🔧 CÓMO FUNCIONA LA SINCRONIZACIÓN

### **Tecnología: StorageEvent API**

```typescript
// Tab 1: Escribe en localStorage
localStorage.setItem('session_sync_event', JSON.stringify({
  type: 'logout',
  timestamp: Date.now()
}));

// Tab 2: Detecta el cambio automáticamente
window.addEventListener('storage', (event) => {
  if (event.key === 'session_sync_event') {
    const syncEvent = JSON.parse(event.newValue);
    handleSyncEvent(syncEvent);
  }
});
```

**Características:**
- ✅ Nativo del navegador (sin polling)
- ✅ Funciona solo entre tabs del **mismo navegador**
- ✅ No funciona entre navegadores diferentes (Chrome ↔ Firefox)
- ✅ Sin costo de rendimiento

---

## 📊 COMPORTAMIENTO EN DIFERENTES ESCENARIOS

### **Escenario 1: Login en múltiples tabs del mismo navegador**

```
Chrome Tab 1             Chrome Tab 2
    │                        │
    │ 1. Login              │
    │ ✅ Token: abc123      │
    │ 📡 Evento enviado     │
    │                        │
    │                    2. Recibe evento
    │                    🔄 Sincroniza datos
    │                    ✅ Token actualizado
    │                        │
    │ 3. Hacer cambios      │
    │ ⭐ Agregar favorito   │
    │ 📡 Evento enviado     │
    │                        │
    │                    4. Recibe evento
    │                    🔄 Refresca favoritos
    │                    ✅ Favorito visible
```

**Resultado:**
- ✅ Ambas tabs comparten la misma sesión
- ✅ Los cambios se reflejan inmediatamente

---

### **Escenario 2: Login en navegadores diferentes**

```
Chrome                   Firefox
  │                        │
  │ 1. Login              │
  │ ✅ Token: abc123      │
  │                        │
  │                    2. Login
  │                    ✅ Token: xyz789 (NUEVO)
  │                    ⚠️ Token abc123 INVALIDADO
  │                        │
  │ 3. Hacer petición     │
  │ ❌ Error 401          │
  │ 🚪 Logout automático  │
  │ 🔴 Sesión cerrada     │
```

**Resultado:**
- ⚠️ El backend invalida el token anterior
- ✅ El interceptor detecta el 401 y cierra sesión automáticamente
- ✅ El usuario es redirigido al login

**Solución para el usuario:**
1. Cerrar sesión en Chrome antes de iniciar sesión en Firefox
2. O simplemente volver a iniciar sesión en Chrome

---

### **Escenario 3: Cerrar sesión en una tab**

```
Chrome Tab 1             Chrome Tab 2
    │                        │
    │ Ambas con sesión      │
    │                        │
    │ 1. Logout             │
    │ 🚪 Cerrar sesión      │
    │ 📡 Evento enviado     │
    │                        │
    │                    2. Recibe evento
    │                    🚪 Logout local
    │                    🔴 Sesión cerrada
    │                    📢 Notificación
```

**Resultado:**
- ✅ Ambas tabs cierran sesión simultáneamente
- ✅ Solo una tab llama a la API (eficiencia)

---

## 🧪 PRUEBAS

### **Test 1: Sincronización entre tabs**

1. Abre la app en **2 tabs de Chrome**
2. Inicia sesión en **Tab 1**
3. **Verifica**: Tab 2 detecta el login automáticamente
4. Agrega un favorito en **Tab 1**
5. **Verifica**: Tab 2 refresca favoritos automáticamente

**Consola esperada en Tab 2:**
```
🔄 [SESSION SYNC] Inicializando sincronización entre tabs...
✅ [SESSION SYNC] Escuchando cambios en otras tabs
✅ [SESSION SYNC] Escuchando cambios de visibilidad
✅ [SESSION SYNC] Escuchando eventos de auth
📨 [SESSION SYNC] Evento recibido de otra tab: login
🟢 [SESSION SYNC] Otra tab inició sesión, recargando datos...
🔄 [SESSION SYNC] Sincronizando todos los datos...
```

---

### **Test 2: Logout en una tab**

1. Abre la app en **2 tabs de Chrome**
2. Inicia sesión en ambas
3. Cierra sesión en **Tab 1**
4. **Verifica**: Tab 2 cierra sesión automáticamente

**Consola esperada en Tab 2:**
```
📨 [SESSION SYNC] Evento recibido de otra tab: logout
🔴 [SESSION SYNC] Otra tab cerró sesión, cerrando aquí también...
🧹 [AUTH SERVICE] Limpiando sesión local (sin llamar API)...
```

---

### **Test 3: Login en navegadores diferentes**

1. Abre la app en **Chrome**
2. Inicia sesión → Token ABC
3. Abre la app en **Firefox**
4. Inicia sesión → Token XYZ (invalida Token ABC)
5. Vuelve a **Chrome**
6. Haz clic en favoritos o cualquier acción
7. **Verifica**: Detecta 401 y cierra sesión automáticamente

**Consola esperada en Chrome:**
```
🔴 [AUTH INTERCEPTOR] 401 detectado, intentando renovar token...
❌ [AUTH INTERCEPTOR] Error al renovar token, cerrando sesión
🧹 [AUTH SERVICE] Limpiando datos de autenticación...
```

---

## ⚙️ CONFIGURACIÓN DEL BACKEND

### **Opción 1: Permitir múltiples tokens (Recomendado)**

En Laravel Sanctum, permitir múltiples tokens activos por usuario:

```php
// config/sanctum.php
return [
    // ...
    
    /**
     * Sanctum puede revocar todos los tokens del usuario al hacer logout,
     * o permitir múltiples tokens activos (útil para múltiples dispositivos)
     */
    'expiration' => null, // null = tokens sin expiración
    
    // En AuthController.php
    public function login(Request $request)
    {
        // NO revocar tokens anteriores
        // Solo crear nuevo token
        $token = $user->createToken('auth_token')->plainTextToken;
        
        return response()->json([
            'success' => true,
            'data' => [
                'user' => $user,
                'token' => $token
            ]
        ]);
    }
    
    public function logout(Request $request)
    {
        // Solo revocar el token actual
        $request->user()->currentAccessToken()->delete();
        
        return response()->json([
            'success' => true,
            'message' => 'Logged out successfully'
        ]);
    }
];
```

**Ventajas:**
- ✅ Múltiples navegadores pueden estar logueados simultáneamente
- ✅ No se invalidan tokens de otros dispositivos
- ✅ Mejor experiencia de usuario

---

### **Opción 2: Mantener single token (Más seguro)**

Si prefieres mayor seguridad (un solo dispositivo activo):

```php
// AuthController.php
public function login(Request $request)
{
    // Revocar TODOS los tokens anteriores
    $user->tokens()->delete();
    
    // Crear nuevo token
    $token = $user->createToken('auth_token')->plainTextToken;
    
    return response()->json([
        'success' => true,
        'data' => [
            'user' => $user,
            'token' => $token
        ]
    ]);
}
```

**Ventajas:**
- ✅ Mayor seguridad (un solo token activo)
- ✅ Cierra sesiones en otros dispositivos automáticamente

**Desventajas:**
- ⚠️ El usuario debe iniciar sesión cada vez que cambia de navegador
- ⚠️ El interceptor detectará el 401 y cerrará sesión automáticamente

---

## 📝 RESUMEN

| Feature | Estado | Sincronización |
|---------|--------|----------------|
| **Detección de 401** | ✅ Funciona | Entre todos los navegadores |
| **Logout automático** | ✅ Funciona | Tab que detecta el 401 |
| **Sincronización entre tabs** | ✅ Implementado | Mismo navegador |
| **Sincronización entre navegadores** | ⚠️ Limitado | Requiere backend multi-token |
| **Refresh de datos** | ✅ Implementado | Al volver a la tab |

---

## 🎯 RECOMENDACIÓN FINAL

Para **mejor experiencia de usuario**, configura el backend para:
1. ✅ **Permitir múltiples tokens activos**
2. ✅ **Expiración de tokens opcional** (30 días recomendado)
3. ✅ **Logout solo revoca token actual** (no todos)

Con esta configuración:
- ✅ El usuario puede usar múltiples navegadores simultáneamente
- ✅ Los tokens no se invalidan entre sí
- ✅ El sistema de sincronización funciona perfectamente
- ✅ Mejor experiencia mobile + desktop

---

## 🔧 COMANDOS DE DEBUG

### Ver estado de sincronización
```javascript
// En la consola del navegador
localStorage.getItem('session_sync_event')
localStorage.getItem('last_session_activity')
```

### Forzar sincronización
```javascript
// Simular evento de otra tab
localStorage.setItem('session_sync_event', JSON.stringify({
  type: 'login',
  timestamp: Date.now()
}));
```

### Ver tokens activos (backend)
```sql
SELECT * FROM personal_access_tokens 
WHERE tokenable_id = [USER_ID] 
ORDER BY created_at DESC;
```
