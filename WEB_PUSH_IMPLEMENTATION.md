# Implementación de Web Push Notifications (DIY)

Esta implementación utiliza el protocolo Web Push estándar con la librería `minishlink/web-push-php` en el backend Laravel, sin dependencias externas como OneSignal o Firebase.

## 🎯 Características Implementadas

### Backend (Laravel)
- ✅ **Librería web-push-php** instalada y configurada
- ✅ **Modelo PushSubscription** para almacenar suscripciones
- ✅ **Servicio WebPushService** para manejar notificaciones
- ✅ **Controlador WebPushController** con endpoints completos
- ✅ **Rutas API** configuradas
- ✅ **Migración de base de datos** ejecutada

### Frontend (Angular)
- ✅ **Servicio de notificaciones** actualizado para Web Push
- ✅ **Service Worker** implementado
- ✅ **Configuración OneSignal** removida
- ✅ **Integración con Capacitor** para dispositivos nativos

## 🔧 Configuración Requerida

### 1. Generar Claves VAPID

**Opción A: Usar el comando Artisan (recomendado)**
```bash
cd ecommerce_apirest
php artisan webpush:generate-vapid-keys
```

**Opción B: Generar manualmente**
Puedes usar herramientas online como:
- https://vapidkeys.com/
- https://web-push-codelab.glitch.me/

### 2. Configurar Variables de Entorno

Agrega estas variables a tu archivo `.env` en el backend:

```env
# Claves VAPID para Web Push
VAPID_PUBLIC_KEY=tu_clave_publica_vapid_aqui
VAPID_PRIVATE_KEY=tu_clave_privada_vapid_aqui
VAPID_SUBJECT=mailto:tu-email@ejemplo.com
```

### 3. Configurar el Frontend

El frontend ya está configurado para obtener automáticamente la clave pública VAPID del backend.

## 📡 API Endpoints Disponibles

### Públicos
- `GET /api/webpush/vapid-public-key` - Obtiene la clave pública VAPID

### Autenticados
- `POST /api/webpush/subscribe` - Registra una suscripción push
- `POST /api/webpush/unsubscribe` - Elimina una suscripción
- `GET /api/webpush/subscriptions` - Obtiene suscripciones del usuario
- `POST /api/webpush/test` - Envía notificación de prueba

### Administración
- `GET /api/webpush/stats` - Estadísticas de suscripciones
- `POST /api/webpush/cleanup` - Limpia suscripciones inválidas
- `POST /api/webpush/broadcast` - Envía notificación a todos los usuarios

## 🚀 Uso en el Código

### Enviar Notificación desde el Backend

```php
use App\Services\WebPushService;

// Inyectar el servicio
public function __construct(WebPushService $webPushService)
{
    $this->webPushService = $webPushService;
}

// Enviar notificación a un usuario
$result = $this->webPushService->sendToUser($user, [
    'title' => 'Nueva Orden',
    'body' => 'Tu orden ha sido recibida',
    'data' => ['order_id' => 123]
]);

// Enviar notificación a todos los usuarios
$result = $this->webPushService->sendToAllUsers([
    'title' => 'Promoción',
    'body' => '¡Oferta especial disponible!',
    'data' => ['type' => 'promotion']
]);
```

### Enviar Notificación desde el Frontend

```typescript
// Inyectar el servicio
constructor(private notificationService: NotificationService) {}

// Enviar notificación de prueba
await this.notificationService.sendTestNotification();

// Solicitar permisos manualmente
const granted = await this.notificationService.requestNotificationPermission();
```

## 🔄 Flujo de Funcionamiento

1. **Inicialización**: El frontend obtiene la clave pública VAPID del backend
2. **Registro**: El usuario otorga permisos y se crea una suscripción push
3. **Almacenamiento**: La suscripción se guarda en la base de datos
4. **Envío**: El backend usa web-push-php para enviar notificaciones
5. **Recepción**: El service worker recibe y muestra las notificaciones

## 📱 Tipos de Notificaciones Soportadas

### Notificaciones de Orden
```php
$this->webPushService->sendNewOrderNotification($user, [
    'id' => $order->id,
    'total' => $order->total
]);
```

### Notificaciones de Estado de Orden
```php
$this->webPushService->sendOrderStatusNotification($user, [
    'id' => $order->id,
    'status' => 'shipped'
]);
```

### Notificaciones de Promoción
```php
$this->webPushService->sendPromotionNotification($userIds, [
    'id' => $promotion->id,
    'title' => $promotion->title,
    'url' => '/promotions/' . $promotion->id
]);
```

## 🛠️ Mantenimiento

### Limpiar Suscripciones Inválidas
```bash
# Desde el backend
php artisan tinker
>>> app(App\Services\WebPushService::class)->cleanupInvalidSubscriptions();

# O usar el endpoint
POST /api/webpush/cleanup
```

### Ver Estadísticas
```bash
# Desde el backend
php artisan tinker
>>> app(App\Services\WebPushService::class)->getSubscriptionStats();

# O usar el endpoint
GET /api/webpush/stats
```

## 🔒 Seguridad

- ✅ **Claves VAPID**: La clave privada nunca se expone al frontend
- ✅ **Autenticación**: Todas las rutas están protegidas con Sanctum
- ✅ **Validación**: Datos de entrada validados en el controlador
- ✅ **Logs**: Todas las operaciones se registran para auditoría

## 🐛 Troubleshooting

### Error: "VAPID public key not configured"
- Verifica que las variables VAPID estén en el archivo `.env`
- Ejecuta `php artisan config:clear`

### Error: "Service Worker no soportado"
- Asegúrate de que la aplicación se ejecute en HTTPS (o localhost)
- Verifica que el navegador soporte Service Workers

### Error: "Push subscription failed"
- Verifica que la clave pública VAPID sea correcta
- Asegúrate de que el service worker esté registrado correctamente

### Notificaciones no se muestran
- Verifica que los permisos estén concedidos
- Revisa la consola del navegador para errores
- Asegúrate de que el service worker esté activo

## 📊 Ventajas de esta Implementación

### ✅ Ventajas
- **100% Libre**: Sin dependencias de servicios externos
- **Control Total**: Tú manejas todos los datos y la infraestructura
- **Sin Límites**: No hay restricciones de envío
- **Privacidad**: Los datos no pasan por servidores de terceros
- **Personalizable**: Puedes modificar cualquier aspecto

### ⚠️ Consideraciones
- **Mantenimiento**: Debes gestionar la limpieza de suscripciones
- **Infraestructura**: Responsabilidad completa del servidor
- **Escalabilidad**: Para grandes volúmenes, considera optimizaciones

## 🔄 Migración desde OneSignal

Si tenías OneSignal configurado anteriormente:

1. ✅ **Removido**: Servicio OneSignalService
2. ✅ **Removido**: Configuración en app.config.ts
3. ✅ **Removido**: Variables de environment
4. ✅ **Removido**: Dependencia onesignal-ngx
5. ✅ **Implementado**: Web Push nativo

## 📈 Próximos Pasos

1. **Generar claves VAPID** reales
2. **Configurar variables de entorno**
3. **Probar notificaciones** en desarrollo
4. **Implementar notificaciones** en eventos de negocio
5. **Configurar HTTPS** para producción
6. **Monitorear estadísticas** de entrega

## 🆘 Soporte

Si encuentras problemas:

1. Revisa los logs del backend: `storage/logs/laravel.log`
2. Revisa la consola del navegador
3. Verifica que el service worker esté registrado
4. Comprueba que las claves VAPID sean correctas

¡Tu implementación de Web Push está lista para usar! 🎉
