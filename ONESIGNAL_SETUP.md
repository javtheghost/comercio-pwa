# Configuración de OneSignal

Este documento explica cómo configurar OneSignal correctamente en la aplicación PWA.

## Problema Resuelto

El error original era:
```
La propiedad 'init' no existe en el tipo 'typeof OneSignal'
```

Esto ocurría porque se intentaba usar `OneSignal.init()` directamente en la configuración de la aplicación Angular, lo cual no es la forma correcta de inicializar OneSignal en Angular.

## Solución Implementada

### 1. Servicio de OneSignal (`src/app/services/onesignal.service.ts`)

Se creó un servicio dedicado para manejar la inicialización y configuración de OneSignal:

- **Inicialización segura**: Verifica que OneSignal esté disponible antes de inicializar
- **Configuración centralizada**: Usa las variables de entorno para la configuración
- **API limpia**: Proporciona métodos para interactuar con OneSignal de forma segura
- **Manejo de errores**: Incluye manejo robusto de errores

### 2. Configuración de Environment

Se agregaron las variables de OneSignal a los archivos de environment:

```typescript
// environment.ts y environment.prod.ts
oneSignal: {
  appId: 'TU_ONESIGNAL_APP_ID', // Reemplazar con tu App ID
  safariWebId: 'TU_SAFARI_WEB_ID' // Reemplazar con tu Safari Web ID
}
```

### 3. Inicialización en el Componente Principal

El componente principal (`app.ts`) ahora inicializa OneSignal correctamente:

```typescript
async ngOnInit() {
  try {
    // Inicializar OneSignal primero
    await this.oneSignalService.initialize();
    
    // Luego inicializar el servicio de notificaciones
    await this.notificationService.initializePushNotifications();
  } catch (error) {
    console.error('❌ Error inicializando servicios:', error);
  }
}
```

### 4. Actualización del Servicio de Notificaciones

El servicio de notificaciones ahora usa el nuevo servicio de OneSignal en lugar de acceder directamente a la API global.

## Configuración Requerida

### 1. Obtener las Credenciales de OneSignal

1. Ve a [OneSignal](https://onesignal.com/) y crea una cuenta
2. Crea una nueva aplicación
3. Obtén los siguientes valores:
   - **App ID**: Encontrado en Settings > Keys & IDs
   - **Safari Web ID**: Para notificaciones web en Safari

### 2. Actualizar las Variables de Environment

Reemplaza los valores placeholder en los archivos de environment:

```typescript
// src/environments/environment.ts (desarrollo)
oneSignal: {
  appId: 'tu-app-id-real-aqui',
  safariWebId: 'tu-safari-web-id-real-aqui'
}

// src/environments/environment.prod.ts (producción)
oneSignal: {
  appId: 'tu-app-id-real-aqui',
  safariWebId: 'tu-safari-web-id-real-aqui'
}
```

### 3. Incluir el SDK de OneSignal

Asegúrate de que el SDK de OneSignal esté incluido en tu `index.html`:

```html
<!-- En src/index.html -->
<script src="https://cdn.onesignal.com/sdks/OneSignalSDK.js" async=""></script>
```

## Funcionalidades Disponibles

El servicio de OneSignal proporciona los siguientes métodos:

- `initialize()`: Inicializa OneSignal
- `isReady()`: Verifica si OneSignal está listo
- `getUserId()`: Obtiene el ID del usuario
- `getSubscriptionState()`: Obtiene el estado de suscripción
- `onSubscriptionChange()`: Configura listener para cambios de suscripción
- `onNotificationDisplay()`: Configura listener para notificaciones recibidas
- `onNotificationClick()`: Configura listener para clics en notificaciones
- `sendTag()`: Envía una etiqueta al usuario
- `sendTags()`: Envía múltiples etiquetas

## Uso en el Código

```typescript
// Inyectar el servicio
constructor(private oneSignalService: OneSignalService) {}

// Verificar si está listo
if (this.oneSignalService.isReady()) {
  // Usar OneSignal
  const userId = await this.oneSignalService.getUserId();
}

// Configurar listeners
this.oneSignalService.onNotificationClick((event) => {
  console.log('Notificación clickeada:', event);
});
```

## Notas Importantes

1. **Desarrollo Local**: La configuración incluye `allowLocalhostAsSecureOrigin: true` para desarrollo local
2. **Compatibilidad**: El servicio funciona tanto en web como en aplicaciones nativas
3. **Manejo de Errores**: Todos los métodos incluyen manejo de errores robusto
4. **TypeScript**: El servicio está completamente tipado para mejor experiencia de desarrollo

## Troubleshooting

### Error: "OneSignal no está disponible"
- Verifica que el SDK esté incluido en `index.html`
- Asegúrate de que la aplicación esté ejecutándose en un servidor (no file://)

### Error: "App ID no válido"
- Verifica que el App ID sea correcto en los archivos de environment
- Asegúrate de que la aplicación esté configurada correctamente en OneSignal

### Notificaciones no funcionan
- Verifica que los permisos estén concedidos
- Revisa la consola del navegador para errores
- Asegúrate de que el Safari Web ID esté configurado para notificaciones web
