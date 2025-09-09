# Configuración de Encriptación para PWA

## Descripción

Se ha implementado un sistema de encriptación para proteger los datos sensibles del usuario almacenados en localStorage, similar al sistema implementado en Ecommerce_Admin.

## Archivos Creados/Modificados

### Servicios Nuevos

1. **`src/app/services/encryption.service.ts`**
   - Servicio principal de encriptación
   - Utiliza AES-GCM con PBKDF2 para generar claves
   - Incluye validación de tokens JWT
   - Manejo robusto de errores con fallbacks

2. **`src/app/services/security.service.ts`**
   - Servicio de seguridad que maneja el almacenamiento encriptado
   - Configuración flexible de encriptación por tipo de dato
   - Detección automática de datos encriptados vs no encriptados
   - Logs detallados para debugging

### Archivos Modificados

3. **`src/app/services/auth.service.ts`**
   - Integrado con SecurityService para encriptar datos de usuario
   - Métodos actualizados para usar almacenamiento seguro
   - Mantiene compatibilidad con el sistema existente

4. **`src/environments/environment.ts`**
   - Agregada clave de encriptación para desarrollo

5. **`src/environments/environment.prod.ts`**
   - Agregada clave de encriptación para producción

## Configuración

### Variables de Entorno

```typescript
// environment.ts
export const environment = {
  // ... otras configuraciones
  encryptionSecret: 'your-super-secret-encryption-key-change-in-production'
};
```

### Configuración de Seguridad

El SecurityService permite configurar qué datos encriptar:

```typescript
// Por defecto:
{
  enableTokenEncryption: false,  // Tokens sin encriptar
  enableUserEncryption: true     // Datos de usuario encriptados
}
```

## Funcionamiento

### 1. Almacenamiento de Datos

Cuando un usuario hace login:

1. **Token**: Se almacena sin encriptar (por defecto)
2. **Datos de Usuario**: Se encriptan usando AES-GCM
3. **Detección**: El sistema detecta automáticamente si los datos están encriptados

### 2. Recuperación de Datos

Al cargar la aplicación:

1. **Detección**: Verifica si los datos están encriptados
2. **Desencriptación**: Desencripta automáticamente si es necesario
3. **Fallback**: Si falla la desencriptación, intenta usar los datos tal como están

### 3. Logs de Debug

El sistema incluye logs detallados:

```
🔍 [SECURITY SERVICE] Usuario encontrado en localStorage
✅ [SECURITY SERVICE] Usuario desencriptado exitosamente
❌ [SECURITY SERVICE] Error obteniendo usuario
```

## Verificación

### 1. Verificar Encriptación

1. Abrir DevTools (F12)
2. Ir a "Application" > "Local Storage"
3. Verificar que los datos de usuario tengan longitud > 100 caracteres
4. Los datos deben verse como texto encriptado (no JSON legible)

### 2. Verificar Persistencia

1. Hacer login
2. Recargar la página (F5)
3. Verificar que la sesión se mantenga
4. Revisar logs en consola para confirmar desencriptación exitosa

## Seguridad

### Características de Seguridad

- **Algoritmo**: AES-GCM (Autenticado)
- **Derivación de Clave**: PBKDF2 con 100,000 iteraciones
- **Salt**: Único por dominio y día
- **IV**: Generado aleatoriamente para cada encriptación
- **Validación**: Verificación de integridad automática

### Protección de Datos

- **Datos de Usuario**: Encriptados (email, nombres, roles, etc.)
- **Tokens**: Sin encriptar por defecto (configurable)
- **Fallbacks**: Sistema robusto que no falla si hay errores de encriptación

## Troubleshooting

### Si la encriptación no funciona:

1. Verificar que `environment.encryptionSecret` esté configurado
2. Revisar la consola para errores de encriptación
3. Limpiar localStorage y volver a hacer login

### Si la persistencia falla:

1. Verificar que los datos encriptados tengan la longitud correcta
2. Revisar los logs de inicialización en la consola
3. Verificar que no haya errores de desencriptación

### Limpiar Datos de Prueba:

```javascript
// En DevTools Console:
localStorage.clear();
location.reload();
```

## Producción

### Configuración de Producción

1. **Cambiar Clave Secreta**: Usar una clave única y segura
2. **Variables de Entorno**: Configurar `encryptionSecret` como variable de entorno
3. **HTTPS**: Asegurar que la aplicación use HTTPS en producción

### Ejemplo de Configuración:

```typescript
// environment.prod.ts
export const environment = {
  production: true,
  encryptionSecret: process.env['ENCRYPTION_SECRET'] || 'fallback-secret',
  // ... otras configuraciones
};
```

## Compatibilidad

- **Navegadores**: Compatible con navegadores modernos que soporten Web Crypto API
- **Fallbacks**: Sistema robusto que funciona incluso si falla la encriptación
- **Migración**: Compatible con datos existentes no encriptados

## Notas Importantes

- Los logs detallados solo aparecen en desarrollo
- El sistema detecta automáticamente si debe usar encriptación
- Se incluyen múltiples capas de fallback para máxima robustez
- La encriptación es transparente para el resto de la aplicación
