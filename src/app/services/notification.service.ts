import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
// import {
//   PushNotifications,
//   PushNotificationSchema,
//   ActionPerformed,
//   Token
// } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../environments/environment';
import { SecurityService } from './security.service';

export interface NotificationToken {
  token: string;
  platform: 'web' | 'android' | 'ios';
  userId?: number;
}

export interface NotificationPayload {
  title: string;
  body: string;
  data?: any;
  icon?: string;
  badge?: string;
  sound?: string;
  click_action?: string;
}

export interface WebPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface VapidKeys {
  publicKey: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly API_URL = environment.apiUrl;
  private tokenSubject = new BehaviorSubject<string | null>(null);
  public token$ = this.tokenSubject.asObservable();
  private vapidPublicKey: string | null = null;
  private registration: ServiceWorkerRegistration | null = null;
  private isDevelopmentMode: boolean = false;
  // Suscripción pendiente cuando falla por 401 (usuario aún no autenticado)
  private pendingSubscription: PushSubscription | null = null;
  // Indicador de disponibilidad de endpoints WebPush en el backend
  private webPushAvailable: boolean | null = null;
  // Claves por usuario para persistencia
  private readonly NOTIF_PREFIX = 'notifications_';
  private readonly NOTIF_DELETED_PREFIX = 'notifications_deleted_';

  constructor(private http: HttpClient, private securityService: SecurityService) {
    // Reintentar registro de suscripción pendiente cuando el usuario inicia sesión
    if (typeof window !== 'undefined') {
      window.addEventListener('userLoggedIn', () => {
        if (this.pendingSubscription) {
          console.log('🔄 Reintentando registro de suscripción pendiente tras login...');
          // Guardar referencia local y limpiar para evitar loops
          const sub = this.pendingSubscription;
          this.pendingSubscription = null;
          this.sendSubscriptionToServer(sub)
            .then(() => console.log('✅ Suscripción pendiente registrada correctamente tras login'))
            .catch(err => {
              console.error('❌ Error reenviando suscripción tras login:', err);
              // Si vuelve a fallar por 401, se almacenará de nuevo dentro del método sendSubscriptionToServer
            });
        }
      });

      // Limpiar estado y desuscribir si el usuario hace logout
      window.addEventListener('userLoggedOut', async () => {
        try {
          this.pendingSubscription = null;
          if (this.registration) {
            const existing = await this.registration.pushManager.getSubscription();
            if (existing) {
              await existing.unsubscribe();
              console.log('🧹 Suscripción push anulada tras logout');
            }
          }
        } catch (e) {
          console.warn('⚠️ Error limpiando suscripción tras logout (no crítico):', e);
        }
        // Nota: No borramos notificaciones persistentes; se mantienen por usuario
      });
    }
  }

  /**
   * Inicializa las notificaciones push
   */
  async initializePushNotifications(): Promise<void> {
    try {
      // Verificar si estamos en un navegador
      if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        console.warn('⚠️ Service Worker no soportado en este entorno');
        return;
      }

      // Verificar si las notificaciones están disponibles
      if (!this.isAvailable()) {
        console.warn('⚠️ Notificaciones push no disponibles en este entorno');
        return;
      }

      // Obtener la clave pública VAPID
      await this.getVapidPublicKey();

      // Inicializar Web Push para navegadores
      if (!Capacitor.isNativePlatform()) {
        await this.initializeWebPush();
      } else {
        // Inicializar Capacitor para dispositivos nativos
        await this.initializeCapacitorPush();
      }

      // Configurar listeners para notificaciones
      this.setupNotificationListeners();
    } catch (error) {
      console.error('❌ Error inicializando push notifications:', error);
      // No lanzar el error para evitar crashes en la app
    }
  }

  /**
   * Obtiene la clave pública VAPID del servidor
   */
  private async getVapidPublicKey(): Promise<void> {
    try {
      console.log('🔄 Obteniendo clave VAPID desde:', `${this.API_URL}/webpush/vapid-public-key`);

      const response = await firstValueFrom(this.http.get<VapidKeys>(`${this.API_URL}/webpush/vapid-public-key`));

      if (response?.publicKey) {
        this.vapidPublicKey = response.publicKey;
        console.log('✅ Clave pública VAPID obtenida:', this.vapidPublicKey.substring(0, 20) + '...');
      } else {
        console.error('❌ Respuesta VAPID vacía o inválida:', response);
      }
    } catch (error) {
      console.error('❌ Error obteniendo clave VAPID:', error);
      console.error('🔍 URL intentada:', `${this.API_URL}/webpush/vapid-public-key`);

      // Intentar con URL alternativa si falla
      try {
        console.log('🔄 Intentando con URL alternativa...');
        const altResponse = await firstValueFrom(this.http.get<VapidKeys>('http://localhost:8000/api/webpush/vapid-public-key'));
        if (altResponse?.publicKey) {
          this.vapidPublicKey = altResponse.publicKey;
          console.log('✅ Clave VAPID obtenida con URL alternativa');
        }
      } catch (altError) {
        console.error('❌ Error con URL alternativa:', altError);
      }
    }
  }

  /**
   * Inicializa Web Push para navegadores
   */
  private async initializeWebPush(): Promise<void> {
    try {
      // Registrar el service worker
      this.registration = await navigator.serviceWorker.register('/sw.js');
      console.log('✅ Service Worker registrado');

      // Verificar si ya tenemos una suscripción
      const existingSubscription = await this.registration.pushManager.getSubscription();

      if (existingSubscription) {
        console.log('✅ Suscripción existente encontrada');
        await this.sendSubscriptionToServer(existingSubscription);
      } else {
        // NO solicitar permisos automáticamente - solo configurar listeners
        console.log('ℹ️ No hay suscripción existente. Los permisos se solicitarán cuando el usuario lo requiera.');
      }

      // Configurar listeners
      this.setupWebPushListeners();
    } catch (error) {
      console.error('❌ Error inicializando Web Push:', error);
      // No lanzar el error para evitar crashes
    }
  }

  /**
   * Solicita permisos de notificación
   */
  async requestNotificationPermission(): Promise<boolean> {
    try {
      if (!this.vapidPublicKey) {
        console.error('❌ Clave VAPID no disponible');
        return false;
      }

      if (!this.registration) {
        console.error('❌ Service Worker no registrado');
        return false;
      }

      // Verificar si ya tenemos una suscripción activa
      const existingSubscription = await this.registration.pushManager.getSubscription();
      if (existingSubscription) {
        console.log('✅ Ya existe una suscripción activa');
        await this.sendSubscriptionToServer(existingSubscription);
        return true;
      }

      // Solicitar permisos
      const permission = await Notification.requestPermission();

      if (permission === 'granted') {
        console.log('✅ Permisos de notificación concedidos');

        try {
          // Crear suscripción con mejor manejo de errores
          const subscription = await this.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
          });

          console.log('✅ Suscripción push creada exitosamente');
          await this.sendSubscriptionToServer(subscription);
          return true;
        } catch (subscriptionError) {
          console.error('❌ Error creando suscripción push:', subscriptionError);

          // Si es un error de registro, intentar diferentes estrategias
          if ((subscriptionError as any).name === 'AbortError' || (subscriptionError as any).message?.includes('Registration failed')) {
            console.log('🔄 Error de registro detectado, intentando soluciones...');

            // Estrategia 1: Limpiar y reintentar
            try {
              console.log('🔄 Estrategia 1: Limpiar suscripciones existentes...');
              const existingSubs = await this.registration.pushManager.getSubscription();
              if (existingSubs) {
                await existingSubs.unsubscribe();
                console.log('✅ Suscripción anterior eliminada');
              }

              // Esperar un poco más
              await new Promise(resolve => setTimeout(resolve, 2000));

              const newSubscription = await this.registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
              });

              console.log('✅ Nueva suscripción creada exitosamente');
              await this.sendSubscriptionToServer(newSubscription);
              return true;
            } catch (retryError) {
              console.error('❌ Estrategia 1 falló:', retryError);

              // Estrategia 2: Intentar sin userVisibleOnly
              try {
                console.log('🔄 Estrategia 2: Intentar sin userVisibleOnly...');
                const altSubscription = await this.registration.pushManager.subscribe({
                  applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
                });

                console.log('✅ Suscripción alternativa creada');
                await this.sendSubscriptionToServer(altSubscription);
                return true;
              } catch (altError) {
                console.error('❌ Estrategia 2 también falló:', altError);

                // Estrategia 3: Modo de desarrollo - simular éxito
                if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
                  console.log('🔄 Estrategia 3: Modo desarrollo - notificaciones locales habilitadas');
                  console.log('⚠️ Las notificaciones push no funcionarán, pero las locales sí');
                  console.log('💡 Para notificaciones push reales, despliega en HTTPS');

                  // En modo desarrollo, marcar como "activado" pero solo para notificaciones locales
                  this.isDevelopmentMode = true;
                  return true; // Permitir que continúe para notificaciones locales
                }

                return false;
              }
            }
          }

          return false;
        }
      } else {
        console.log('❌ Permisos de notificación denegados');
        return false;
      }
    } catch (error) {
      console.error('❌ Error solicitando permisos:', error);
      return false;
    }
  }

  /**
   * Envía la suscripción al servidor
   */
  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      const subscriptionData: WebPushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
          auth: this.arrayBufferToBase64(subscription.getKey('auth')!)
        }
      };

      // Intentar asociar con el usuario logueado si existe (desde SecurityService para evitar dependencias circulares)
      let userId: number | undefined = undefined;
      try {
        const user = await this.securityService.getSecureUser();
        if (user && typeof user.id === 'number') userId = user.id;
      } catch {}

      // Campos extra para compatibilidad con distintos backends (p. ej. web-push-php)
      const p256dh = subscriptionData.keys.p256dh;
      const auth = subscriptionData.keys.auth;
      const contentEncoding = 'aes128gcm'; // Navegadores modernos
      const expirationTime = (subscription as any).expirationTime || null;

      const body = {
        ...subscriptionData,
        // Alt keys flatten
        p256dh,
        auth,
        publicKey: p256dh,
        authToken: auth,
        content_encoding: contentEncoding,
        expirationTime,
        user_agent: navigator.userAgent,
        platform: 'web',
        user_id: userId
      };

      // Normalizar base y construir URLs seguras (evitar /api/api)
      const base = (this.API_URL || '').replace(/\/+$/, '');
      const primaryUrl = `${base}/webpush/subscribe`;
      const hasApiSuffix = /\/api$/i.test(base);
      const altBase = hasApiSuffix ? base.replace(/\/api$/i, '') : `${base}/api`;
      const altUrl = `${altBase}/webpush/subscribe`;

      // Intento principal
      try {
        await firstValueFrom(this.http.post(primaryUrl, body));
      } catch (primaryErr: any) {
        const status = primaryErr?.status;
        console.warn('⚠️ Error en', primaryUrl, status, primaryErr?.error || primaryErr);

        // 401: no autenticado -> guardar para reintentar tras login
        if (status === 401) {
          console.warn('🔐 Suscripción push diferida: 401 (no autenticado). Se intentará nuevamente tras el evento userLoggedIn.');
          this.pendingSubscription = subscription as PushSubscription;
          return;
        }

        // 404: probar ruta alternativa
        if (status === 404) {
          try {
            await firstValueFrom(this.http.post(altUrl, body));
            console.log('✅ Suscripción enviada usando ruta alternativa', altUrl);
          } catch (altErr: any) {
            const altStatus = altErr?.status;
            if (altStatus === 404) {
              console.warn('ℹ️ Endpoint de WebPush no disponible (ambas rutas 404). Continuando sin push.');
              return;
            }
            console.error('❌ Fallback también falló', altUrl, altStatus, altErr?.error || altErr);
            return;
          }
        } else {
          // Otros errores (500, etc.) se registran y se continúa
          console.warn('ℹ️ Error no crítico registrando suscripción. Continuando.');
          return;
        }
      }

      console.log('✅ Suscripción enviada al servidor');
    } catch (error) {
      console.error('❌ Error enviando suscripción:', error);
    }
  }

  /**
   * Configura los listeners de Web Push
   */
  private setupWebPushListeners(): void {
    if (!this.registration) return;

    // Listener para mensajes push
    this.registration.addEventListener('push', (event: any) => {
      console.log('📱 Push message received:', event);

      if (event.data) {
        const data = event.data.json();
        this.handleNotificationReceived(data);
      }
    });

    // Listener para clics en notificaciones
    this.registration.addEventListener('notificationclick', (event) => {
      console.log('👆 Notification clicked:', event);
      this.handleNotificationTapped(event);
    });
  }

  /**
   * Convierte URL base64 a Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): ArrayBuffer {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray.buffer;
  }

  /**
   * Convierte ArrayBuffer a base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Inicializa Capacitor Push para dispositivos nativos
   */
  private async initializeCapacitorPush(): Promise<void> {
    try {
      // Verificar si Capacitor está disponible
      if (!Capacitor.isNativePlatform()) {
        console.log('ℹ️ No es una plataforma nativa, saltando inicialización de Capacitor');
        return;
      }

      // NO solicitar permisos automáticamente - solo configurar listeners
      console.log('ℹ️ Configurando listeners de Capacitor. Los permisos se solicitarán cuando el usuario lo requiera.');

      // Configurar listeners
      this.setupNotificationListeners();
    } catch (error) {
      console.error('❌ Error inicializando Capacitor push:', error);
      // No lanzar el error para evitar crashes
    }
  }


  /**
   * Configura los listeners de notificaciones
   */
  private setupNotificationListeners(): void {
    // Solo configurar listeners de Capacitor si estamos en una plataforma nativa
    if (Capacitor.isNativePlatform()) {
      // Token de registro
      // PushNotifications.addListener('registration', (token: Token) => {
      //   console.log('🔑 Token de registro:', token.value);
      //   this.tokenSubject.next(token.value);
      //   this.saveTokenToServer(token.value);
      // });
      console.log('🔔 [NOTIFICATIONS] Listeners de Capacitor temporalmente deshabilitados');

      // Error en el registro
      // PushNotifications.addListener('registrationError', (error: any) => {
      //   console.error('❌ Error en registro de notificaciones:', error);
      // });

      // Notificación recibida (app en primer plano)
      // PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      //   console.log('📱 Notificación recibida:', notification);
      //   this.handleNotificationReceived(notification);
      // });

      // Notificación tocada (app en segundo plano)
      // PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
      //   console.log('👆 Notificación tocada:', notification);
      //   this.handleNotificationTapped(notification);
      // });
    }

    // Listener para mensajes del service worker (web)
    if (typeof window !== 'undefined') {
      window.addEventListener('message', (event) => {
        if (!event.data) return;
        // Click en notificación
        if (event.data.type === 'NOTIFICATION_CLICK') {
          // Persistir por si la app no estaba en primer plano cuando llegó el push
          const title = event.data.title || 'Nueva Notificación';
          const body = event.data.body || 'Tienes una nueva notificación';
          this.addToRealNotifications({
            title,
            body,
            data: event.data.data || { type: 'system' },
            icon: event.data.icon,
            badge: event.data.badge
          });
          this.handleNotificationTapped(event.data);
        }
        // Push recibido desde SW (app en primer plano o para actualizar badge)
        if (event.data.type === 'PUSH_RECEIVED') {
          const payload = event.data.payload || {};
          // Persistir en storage para que la pestaña de notificaciones y el badge se actualicen
          this.addToRealNotifications({
            title: payload.title || 'Nueva Notificación',
            body: payload.body || 'Tienes una nueva notificación',
            data: payload.data || { type: 'system' },
            icon: payload.icon,
            badge: payload.badge
          });
        }
      });
    }
  }

  /**
   * Guarda el token en el servidor
   */
  private async saveTokenToServer(token: string, platform?: string): Promise<void> {
    try {
      const detectedPlatform = platform || Capacitor.getPlatform();
      const tokenData: NotificationToken = {
        token,
        platform: detectedPlatform as 'web' | 'android' | 'ios'
      };

      await firstValueFrom(this.http.post(`${this.API_URL}/api/notification-tokens`, tokenData));
      console.log('✅ Token guardado en servidor');
    } catch (error) {
      console.error('❌ Error guardando token:', error);
    }
  }

  /**
   * Maneja notificaciones recibidas en primer plano
   */
  private handleNotificationReceived(notification: any): void {
    // Aquí puedes mostrar una notificación local o actualizar la UI
    console.log('📨 Notificación en primer plano:', notification);

    // Ejemplo: mostrar toast o actualizar contador de notificaciones
    if (notification.data) {
      this.processNotificationData(notification.data);
    }
  }

  /**
   * Maneja notificaciones tocadas
   */
  private handleNotificationTapped(notification: any): void {
    console.log('👆 Notificación tocada:', notification);

    if (notification.data) {
      this.navigateFromNotification(notification.data);
    }
  }

  /**
   * Procesa los datos de la notificación
   */
  private processNotificationData(data: any): void {
    // Aquí puedes procesar diferentes tipos de notificaciones
    switch (data.type) {
      case 'new_order':
        console.log('🛒 Nueva orden recibida');
        break;
      case 'order_status':
        console.log('📦 Estado de orden actualizado');
        break;
      case 'promotion':
        console.log('🎉 Nueva promoción disponible');
        break;
      default:
        console.log('📢 Notificación general');
    }
  }

  /**
   * Navega basado en los datos de la notificación
   */
  private navigateFromNotification(data: any): void {
    // Navegación basada en el payload
    console.log('🧭 Navegando desde notificación:', data);
    try {
      const orderId = data?.orderId ?? data?.order_id;
      const url = data?.url;
      if (orderId) {
        // Preferir la pantalla de confirmación con el detalle de la orden
        this.navigateByUrl(`/order-confirmation?orderId=${orderId}`);
        return;
      }
      if (url) {
        const finalUrl = (typeof url === 'string' && url.length) ? (url.startsWith('/') ? url : `/${url}`) : '/';
        this.navigateByUrl(finalUrl);
        return;
      }
    } catch {}
  }

  private navigateByUrl(url: string) {
    // Intentar usar el Router si está accesible globalmente; fallback a location
    try {
      const ng = (window as any).ng;
      const injector = ng && ng.getInjector && ng.getInjector(document.body);
      const router = injector && injector.get && injector.get((window as any).ng.coreTokens?.Router);
      if (router && typeof router.navigateByUrl === 'function') {
        router.navigateByUrl(url);
        return;
      }
    } catch {}
    try {
      // Fallback
      window.location.hash = `#${url}`;
    } catch {}
  }

  /**
   * Envía una notificación de prueba (para desarrollo)
   */
  async sendTestNotification(): Promise<void> {
    try {
      // Asegurar una suscripción activa antes de enviar
      const ensured = await this.ensureActiveSubscription();
      console.log('🔐 Suscripción activa antes de prueba:', ensured);

      const payload: NotificationPayload = {
        title: 'Prueba de Notificación',
        body: 'Esta es una notificación de prueba desde tu app',
        data: {
          type: 'test',
          timestamp: new Date().toISOString()
        }
      };

      // Intentar siempre el endpoint del servidor primero
      await firstValueFrom(this.http.post(`${this.API_URL}/webpush/test`, payload));
      console.log('✅ Notificación de prueba enviada (WebPush real)');
    } catch (error) {
      console.error('❌ Error enviando notificación de prueba:', error);

      // Fallback a notificación local si falla el envío
      if (Notification.permission === 'granted') {
        this.showLocalNotification({
          title: 'Prueba de Notificación',
          body: 'Esta es una notificación de prueba desde tu app',
          data: { type: 'test' }
        });
        console.log('✅ Notificación local mostrada (fallback)');
      }
    }
  }

  /**
   * Garantiza que exista una suscripción push activa y registrada en el servidor
   */
  private async ensureActiveSubscription(): Promise<boolean> {
    try {
      if (!this.isAvailable()) {
        console.warn('⚠️ Push no disponible, no se puede asegurar suscripción');
        return false;
      }

      if (!this.vapidPublicKey) {
        await this.getVapidPublicKey();
      }

      if (!this.registration) {
        try {
          this.registration = await navigator.serviceWorker.register('/sw.js');
          console.log('✅ Service Worker registrado (ensure)');
        } catch (e) {
          console.error('❌ No se pudo registrar SW en ensureActiveSubscription:', e);
          return false;
        }
      }

      const existing = await this.registration.pushManager.getSubscription();
      if (existing) {
        // Reasegurar que está en el servidor
        await this.sendSubscriptionToServer(existing);
        return true;
      }

      if (!this.vapidPublicKey) {
        console.error('❌ Sin clave VAPID, no se puede suscribir');
        return false;
      }

      // Si los permisos no han sido otorgados, solicitarlos
      if (Notification.permission !== 'granted') {
        const ok = await this.requestNotificationPermission();
        return ok;
      }

      // Permisos concedidos pero sin suscripción: crear y registrar
      try {
        const sub = await this.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
        });
        await this.sendSubscriptionToServer(sub);
        console.log('✅ Suscripción creada (ensure)');
        return true;
      } catch (e) {
        console.error('❌ Error creando suscripción en ensureActiveSubscription:', e);
        // Activar modo desarrollo si estamos en localhost para usar notificaciones locales
        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
          this.isDevelopmentMode = true;
          return true; // Permitimos continuar con locales
        }
        return false;
      }
    } catch (e) {
      console.error('❌ Error en ensureActiveSubscription:', e);
      return false;
    }
  }

  /**
   * Muestra una notificación local
   */
  private showLocalNotification(payload: NotificationPayload): void {
    if (Notification.permission === 'granted') {
      const notification = new Notification(payload.title, {
        body: payload.body,
        icon: payload.icon || '/icons/icon-192x192.png',
        badge: payload.badge || '/icons/icon-72x72.png',
        data: payload.data,
        tag: 'real-notification'
      });

      // Manejar clic en la notificación
      notification.onclick = () => {
        console.log('👆 Notificación local clickeada');
        notification.close();

        // Enfocar la ventana
        if (window.focus) {
          window.focus();
        }
      };

      // Auto-cerrar después de 5 segundos
      setTimeout(() => {
        notification.close();
      }, 5000);

      // Agregar a la lista de notificaciones reales
      this.addToRealNotifications(payload);

      // Emitir evento global para actualizar badges inmediatamente
      try {
        window.dispatchEvent(new CustomEvent('notifications:updated'));
      } catch {}
    }
  }

  /**
   * Agrega una notificación real a la lista
   */
  private addToRealNotifications(payload: NotificationPayload): void {
    try {
      // Obtener la página de notificaciones si está disponible
      const notificationsPage = (window as any).notificationsPage;
      if (notificationsPage && typeof notificationsPage.addRealNotification === 'function') {
        notificationsPage.addRealNotification({
          title: payload.title,
          message: payload.body,
          type: payload.data?.type || 'system',
          read: false,
          data: payload.data
        });
      } else {
        // Si no está disponible, guardar en localStorage directamente
        this.saveNotificationToStorage(payload);
      }
    } catch (error) {
      console.error('❌ Error agregando notificación real:', error);
    }
  }

  /**
   * Espera un breve tiempo por un PUSH entrante que coincida con el tipo/id
   * Si no llega, devuelve false para que mostremos un fallback local.
   */
  private waitForPush(match: { type: string; orderId?: number; timeoutMs?: number }): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        cleanup();
        resolve(false);
      }, Math.max(1500, match.timeoutMs || 4000));

      const handler = (event: MessageEvent) => {
        try {
          const data = event.data;
          if (!data || data.type !== 'PUSH_RECEIVED') return;
          const p = data.payload || {};
          const d = p.data || {};
          if (d.type === match.type) {
            if (match.orderId == null || d.orderId === match.orderId || d.order_id === match.orderId) {
              cleanup();
              resolve(true);
            }
          }
        } catch {}
      };

      const cleanup = () => {
        try { window.removeEventListener('message', handler as any); } catch {}
        clearTimeout(timeout);
      };

      try { window.addEventListener('message', handler as any); } catch {}
    });
  }

  /**
   * Guarda notificación en localStorage directamente
   */
  private async saveNotificationToStorage(payload: NotificationPayload): Promise<void> {
    try {
      const user = await this.securityService.getSecureUser();
      const userId = user && typeof user.id === 'number' ? user.id : 'guest';
      const key = this.getNotificationsKey(userId);
      const notification = {
        id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        title: payload.title,
        message: payload.body,
        type: payload.data?.type || 'system',
        timestamp: new Date().toISOString(),
        read: false,
        data: payload.data
      };

      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.unshift(notification);
      localStorage.setItem(key, JSON.stringify(existing));

      console.log('✅ Notificación real guardada en localStorage');

      // Notificar a otros componentes que hubo cambios
      try {
        window.dispatchEvent(new CustomEvent('notifications:updated'));
      } catch {}
    } catch (error) {
      console.error('❌ Error guardando notificación en localStorage:', error);
    }
  }

  // Helpers de clave por usuario
  private getNotificationsKey(userId: number | 'guest'): string {
    return `${this.NOTIF_PREFIX}${userId}`;
  }
  private getDeletedKey(userId: number | 'guest'): string {
    return `${this.NOTIF_DELETED_PREFIX}${userId}`;
  }

  /**
   * Marca como leídas todas las notificaciones asociadas a una orden dada
   */
  async markNotificationsReadByOrderId(orderId: number): Promise<void> {
    try {
      const user = await this.securityService.getSecureUser();
      const userId = user && typeof user.id === 'number' ? user.id : 'guest';
      const key = this.getNotificationsKey(userId);
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const list = JSON.parse(raw);
      let changed = false;
      for (const n of list) {
        const d = n.data || {};
        const nOrderId = d.orderId ?? d.order_id;
        if (nOrderId === orderId && !n.read) {
          n.read = true;
          changed = true;
        }
      }
      if (changed) {
        localStorage.setItem(key, JSON.stringify(list));
        try { window.dispatchEvent(new CustomEvent('notifications:updated')); } catch {}
      }
    } catch (e) {
      console.warn('⚠️ No se pudieron marcar notificaciones como leídas para la orden', orderId, e);
    }
  }

  /**
   * Obtiene el token actual
   */
  getCurrentToken(): string | null {
    return this.tokenSubject.value;
  }

  /**
   * Verifica si estamos en modo desarrollo
   */
  isInDevelopmentMode(): boolean {
    return this.isDevelopmentMode;
  }

  /**
   * Envía notificación automática cuando se crea una orden
   */
  async sendOrderNotification(orderData: any): Promise<void> {
    try {
      // Asegurar suscripción activa registrada en el servidor (reduce 422 por falta de destino)
      try {
        await this.ensureActiveSubscription();
      } catch {}

      // Normalizar ID y número de orden desde distintas formas posibles
      const orderIdRaw = (orderData && (orderData.id ?? orderData.orderId));
      const idNum = Number(orderIdRaw);
      const orderNumberVal = (orderData && (orderData.order_number ?? orderData.orderNumber)) ?? (Number.isFinite(idNum) ? `#${idNum}` : undefined);

      // Si no tenemos un ID numérico válido, no intentes enviar al backend (evita 422)
      if (!Number.isFinite(idNum) || idNum <= 0) {
        console.warn('⚠️ ID de orden inválido al intentar enviar notificación. Mostrando local. orderIdRaw:', orderIdRaw);
        this.showLocalNotification({
          title: '¡Orden Confirmada!',
          body: `Tu pedido ${orderNumberVal || ''} ha sido confirmado`,
          data: { type: 'new_order', orderId: orderIdRaw, orderNumber: orderNumberVal }
        });
        return;
      }

      const payload: NotificationPayload = {
        title: '¡Orden Confirmada!',
        body: `Tu pedido ${orderNumberVal || `#${idNum}`} ha sido confirmado y está siendo preparado`,
        data: {
          type: 'new_order',
          orderId: idNum,
          orderNumber: orderNumberVal || `#${idNum}`,
          url: `/order-confirmation?orderId=${idNum}`
        }
      };

      // Añadir metadatos útiles para el backend (no rompen si el back no los usa)
      let userId: number | undefined = undefined;
      try {
        const user = await this.securityService.getSecureUser();
        if (user && typeof user.id === 'number') userId = user.id;
      } catch {}
      const plainOrderNumber = (orderNumberVal || `#${idNum}`)?.toString().replace(/^#/, '');
      const customerId = orderData?.customer_id ?? orderData?.customerId;
      const bodyForServer = {
        // Campos de notificación
        title: payload.title,
        body: payload.body,
        data: payload.data,
        // Identificadores y alias comunes
        order_id: idNum,
        orderId: idNum,
        order_number: plainOrderNumber,
        orderNumber: plainOrderNumber,
        customer_id: customerId,
        customerId: customerId,
        user_id: userId,
        recipient_user_id: userId,
        to_user_id: userId,
        notification_type: 'order_created'
      };
      // Enviar al servidor primero (preferir WebPush real)
      try {
        // Log de depuración (no contiene secretos)
        try { console.debug('📤 Enviando order-notification:', bodyForServer); } catch {}
        await firstValueFrom(this.http.post(`${this.API_URL}/webpush/order-notification`, bodyForServer));
        this.webPushAvailable = true;
        console.log('✅ Notificación de orden enviada al servidor');
        // Si no llega push en breve, mostrar fallback local para no dejar al usuario sin feedback visual
        const gotPush = await this.waitForPush({ type: 'new_order', orderId: idNum, timeoutMs: 4000 });
        if (!gotPush && Notification.permission === 'granted') {
          console.log('⏱️ No llegó push a tiempo, mostrando notificación local de cortesía');
          this.showLocalNotification(payload);
        }
      } catch (err: any) {
        const status = err?.status;
        if (status === 422) {
          console.warn('⚠️ Validación falló (422) al enviar notificación de orden. Detalles:', err?.error || err);
        }
        if (status === 404) {
          // Endpoint no existe: marcar como no disponible y caer a local sin ruido rojo
          this.webPushAvailable = false;
          console.warn('ℹ️ WebPush order-notification no disponible (404). Usando notificación local.');
          this.showLocalNotification({
            title: '¡Orden Confirmada!',
            body: `Tu pedido ${orderData.orderNumber || `#${orderData.id}`} ha sido confirmado`,
            data: { type: 'new_order', orderId: orderData.id, orderNumber: orderData.orderNumber }
          });
          console.log('✅ Notificación local de orden mostrada (fallback)');
          return;
        }
        // Otros errores: warning y fallback local si es posible
        console.warn('⚠️ Error enviando notificación de orden al servidor. Mostrando local.', err?.message || err);
        if (Notification.permission === 'granted') {
          this.showLocalNotification({
            title: '¡Orden Confirmada!',
            body: `Tu pedido ${orderData.orderNumber || `#${orderData.id}`} ha sido confirmado`,
            data: { type: 'new_order', orderId: orderData.id, orderNumber: orderData.orderNumber }
          });
          console.log('✅ Notificación local de orden mostrada (fallback)');
        }
        return;
      }
    } catch (error) {
      console.warn('⚠️ Error general en sendOrderNotification:', (error as any)?.message || error);

      // Fallback a notificación local
      if (Notification.permission === 'granted') {
        this.showLocalNotification({
          title: '¡Orden Confirmada!',
          body: `Tu pedido ${orderData.orderNumber || `#${orderData.id}`} ha sido confirmado`,
          data: { type: 'new_order', orderId: orderData.id, orderNumber: orderData.orderNumber }
        });
        console.log('✅ Notificación local de orden mostrada (fallback)');
      }
    }
  }

  /**
   * Envía notificación cuando cambia el estado de una orden
   */
  async sendOrderStatusNotification(orderData: any, newStatus: string): Promise<void> {
    try {
      // Asegurar suscripción activa registrada en el servidor (reduce 422 por falta de destino)
      try {
        await this.ensureActiveSubscription();
      } catch {}

      const statusMessages: { [key: string]: string } = {
        'processing': 'Tu pedido está siendo preparado',
        'shipped': 'Tu pedido ha sido enviado',
        'delivered': 'Tu pedido ha sido entregado',
        'cancelled': 'Tu pedido ha sido cancelado'
      };

      const message = statusMessages[newStatus] || `El estado de tu pedido ha cambiado a: ${newStatus}`;

      // Normalizar ID y número de orden
      const orderIdRaw = (orderData && (orderData.id ?? orderData.orderId));
      const idNum = Number(orderIdRaw);
      const orderNumberVal = (orderData && (orderData.order_number ?? orderData.orderNumber)) ?? (Number.isFinite(idNum) ? `#${idNum}` : undefined);

      if (!Number.isFinite(idNum) || idNum <= 0) {
        console.warn('⚠️ ID de orden inválido al intentar enviar notificación de estado. Mostrando local. orderIdRaw:', orderIdRaw);
        this.showLocalNotification({
          title: 'Actualización de Pedido',
          body: message,
          data: { type: 'order_status', orderId: orderIdRaw, status: newStatus }
        });
        return;
      }

      const payload: NotificationPayload = {
        title: 'Actualización de Pedido',
        body: message,
        data: {
          type: 'order_status',
          orderId: idNum,
          status: newStatus,
          url: `/order-confirmation?orderId=${idNum}`
        }
      };

      // Añadir metadatos útiles para el backend
      let userId: number | undefined = undefined;
      try {
        const user = await this.securityService.getSecureUser();
        if (user && typeof user.id === 'number') userId = user.id;
      } catch {}
      const plainOrderNumber = (orderNumberVal || `#${idNum}`)?.toString().replace(/^#/, '');
      const customerId = orderData?.customer_id ?? orderData?.customerId;
      const bodyForServer = {
        // Campos de notificación
        title: payload.title,
        body: payload.body,
        data: payload.data,
        // Identificadores y alias comunes
        order_id: idNum,
        orderId: idNum,
        order_number: plainOrderNumber,
        orderNumber: plainOrderNumber,
        status: newStatus,
        customer_id: customerId,
        customerId: customerId,
        user_id: userId,
        recipient_user_id: userId,
        to_user_id: userId,
        notification_type: 'order_status'
      };
      // Enviar al servidor primero (preferir WebPush real)
      try {
        try { console.debug('📤 Enviando order-status-notification:', bodyForServer); } catch {}
        await firstValueFrom(this.http.post(`${this.API_URL}/webpush/order-status-notification`, bodyForServer));
        this.webPushAvailable = true;
        console.log('✅ Notificación de estado de orden enviada al servidor');
        const gotPush = await this.waitForPush({ type: 'order_status', orderId: idNum, timeoutMs: 4000 });
        if (!gotPush && Notification.permission === 'granted') {
          console.log('⏱️ No llegó push de estado a tiempo, mostrando notificación local de cortesía');
          this.showLocalNotification(payload);
        }
      } catch (err: any) {
        const status = err?.status;
        if (status === 422) {
          console.warn('⚠️ Validación falló (422) al enviar notificación de estado. Detalles:', err?.error || err);
        }
        if (status === 404) {
          this.webPushAvailable = false;
          console.warn('ℹ️ WebPush order-status-notification no disponible (404). Usando notificación local.');
          this.showLocalNotification({
            title: 'Actualización de Pedido',
            body: message,
            data: { type: 'order_status', orderId: orderData.id, status: newStatus }
          });
          console.log('✅ Notificación local de estado mostrada (fallback)');
          return;
        }
        console.warn('⚠️ Error enviando notificación de estado. Mostrando local.', err?.message || err);
        if (Notification.permission === 'granted') {
          this.showLocalNotification({
            title: 'Actualización de Pedido',
            body: message,
            data: { type: 'order_status', orderId: orderData.id, status: newStatus }
          });
          console.log('✅ Notificación local de estado mostrada (fallback)');
        }
        return;
      }
    } catch (error) {
      console.warn('⚠️ Error general en sendOrderStatusNotification:', (error as any)?.message || error);

      // Fallback a notificación local
      if (Notification.permission === 'granted') {
        this.showLocalNotification({
          title: 'Actualización de Pedido',
          body: `El estado de tu pedido ha cambiado a: ${newStatus}`,
          data: { type: 'order_status', orderId: orderData.id, status: newStatus }
        });
        console.log('✅ Notificación local de estado mostrada (fallback)');
      }
    }
  }

  /**
   * Verifica si las notificaciones están disponibles
   */
  isAvailable(): boolean {
    // Verificar soporte básico
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('⚠️ Service Worker o PushManager no soportados');
      return false;
    }

    // Verificar si estamos en HTTPS o localhost
    const isSecure = location.protocol === 'https:' ||
                     location.hostname === 'localhost' ||
                     location.hostname === '127.0.0.1';

    if (!isSecure) {
      console.warn('⚠️ Push notifications requieren HTTPS o localhost');
      return false;
    }

    // Verificar soporte de notificaciones
    if (!('Notification' in window)) {
      console.warn('⚠️ Notifications API no soportada');
      return false;
    }

    return true;
  }

  /**
   * Verifica si los permisos están concedidos
   */
  async checkPermissions(): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      // Para web, usar la API nativa de Notification
      if (!Capacitor.isNativePlatform()) {
        return Notification.permission === 'granted';
      } else {
        // Para dispositivos nativos, usar Capacitor
        // const permStatus = await PushNotifications.checkPermissions();
        // return permStatus.receive === 'granted';
        return false; // Temporalmente deshabilitado
      }
    } catch (error) {
      console.error('❌ Error verificando permisos:', error);
      return false;
    }
  }



  /**
   * Método público para solicitar permisos manualmente
   */
  async requestPermissionsManually(): Promise<boolean> {
    try {
      // Diagnóstico completo
      console.log('🔍 Diagnóstico de notificaciones push:');
      console.log('  - Service Worker soportado:', 'serviceWorker' in navigator);
      console.log('  - PushManager soportado:', 'PushManager' in window);
      console.log('  - Notification API soportada:', 'Notification' in window);
      console.log('  - Protocolo:', location.protocol);
      console.log('  - Hostname:', location.hostname);
      console.log('  - Es localhost:', location.hostname === 'localhost' || location.hostname === '127.0.0.1');

      if (!this.isAvailable()) {
        console.warn('⚠️ Notificaciones push no disponibles');
        return false;
      }

      // Asegurar que tenemos la clave VAPID antes de proceder
      if (!this.vapidPublicKey) {
        console.log('🔄 Clave VAPID no disponible, intentando obtener...');
        await this.getVapidPublicKey();

        if (!this.vapidPublicKey) {
          console.error('❌ No se pudo obtener la clave VAPID');
          return false;
        }
      }

      if (!Capacitor.isNativePlatform()) {
        // Para web, usar la API nativa
        return await this.requestNotificationPermission();
      } else {
        // Para dispositivos nativos, usar Capacitor
        return await this.requestCapacitorPermissions();
      }
    } catch (error) {
      console.error('❌ Error solicitando permisos manualmente:', error);
      return false;
    }
  }

  /**
   * Solicita permisos usando Capacitor (para dispositivos nativos)
   */
  private async requestCapacitorPermissions(): Promise<boolean> {
    try {
      // const permStatus = await PushNotifications.requestPermissions();

      // if (permStatus.receive === 'granted') {
      //   console.log('✅ Permisos de notificaciones concedidos');
      //   await PushNotifications.register();
      //   return true;
      // } else {
      //   console.log('❌ Permisos de notificaciones denegados');
      //   return false;
      // }
      console.log('🔔 [NOTIFICATIONS] Capacitor permissions temporalmente deshabilitadas');
      return false;
    } catch (error) {
      console.error('❌ Error solicitando permisos de Capacitor:', error);
      return false;
    }
  }
}
