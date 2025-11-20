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
import { Router } from '@angular/router';
import { NotificationsApiService, UserNotification } from './notifications-api.service';

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
  // Referencias de notificaciones locales eliminadas por simplificación (preferimos SW.showNotification)
  private readonly isEdge = typeof navigator !== 'undefined' && /Edg\//.test(navigator.userAgent);
  
  // ✅ Polling automático para sincronizar notificaciones
  private syncInterval: any = null;
  private readonly SYNC_INTERVAL_MS = 10000; // 10 segundos (era 30s)

  constructor(
    private http: HttpClient, 
    private securityService: SecurityService,
    private notificationsApi: NotificationsApiService,
    private router: Router
  ) {
    console.log('🏗️ [NotificationService] Constructor ejecutado');
    
    // ✅ IMPORTANTE: Verificar si el usuario YA está logueado al cargar
    this.checkAndStartAutoSync();
    
    // Reintentar registro de suscripción pendiente cuando el usuario inicia sesión
    if (typeof window !== 'undefined') {
      window.addEventListener('userLoggedIn', () => {
        console.log('👤 [NotificationService] Evento userLoggedIn recibido');
        // Sincronizar notificaciones desde backend
        this.syncNotificationsFromBackend();
        
        // ✅ Iniciar polling automático cuando el usuario hace login
        this.startAutoSync();
        
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
        
        // ✅ Detener polling automático cuando el usuario hace logout
        this.stopAutoSync();
        
        // Nota: No borramos notificaciones persistentes; se mantienen por usuario
      });

      // Exponer utilidades de depuración en ventana para diagnósticos rápidos
      try {
        (window as any).debugNotifications = () => this.debugStatus();
        (window as any).triggerTestNotification = () => this.sendTestNotification();
        (window as any).resetPush = () => this.resetAndResubscribe();
        (window as any).showSystemNotif = () => this.showSystemNotificationTest();
        (window as any).testLocalNotif = () => this.testShowLocalNotification();
        (window as any).syncNotifications = () => this.syncNotificationsFromBackend();
      } catch {}
    }
  }

  /**
   * Inicializa las notificaciones push
   */
  async initializePushNotifications(): Promise<void> {
    try {
      // ✅ MODO DESARROLLO: Registrar SW pero sin push subscription en localhost
      const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
      
      if (isLocalhost) {
        console.log('🔧 Modo desarrollo detectado: usando notificaciones locales vía Service Worker (sin push)');
        this.isDevelopmentMode = true;
        
        // IMPORTANTE: Registrar Service Worker de todos modos para que showNotification() funcione
        if ('serviceWorker' in navigator) {
          try {
            this.registration = await navigator.serviceWorker.ready;
            console.log('✅ Service Worker registrado en modo desarrollo');
          } catch (error) {
            console.warn('⚠️ No se pudo obtener Service Worker en localhost:', error);
          }
        }
        
        // No continuar con push subscription, solo retornar
        return;
      }

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

      // ✅ Solicitar permisos de notificación al inicio (primera visita)
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        console.log('📲 Primera visita detectada, solicitando permisos de notificación...');
        const permission = await Notification.requestPermission();
        console.log(`📲 Permisos de notificación: ${permission}`);
        
        if (permission === 'denied') {
          console.warn('⚠️ Usuario denegó permisos de notificación');
          return;
        }
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
      // Activar modo desarrollo como fallback
      this.isDevelopmentMode = true;
      console.log('🔧 Fallback: activado modo desarrollo');
      // No lanzar el error para evitar crashes en la app
    } finally {
      // ✅ Iniciar auto-sync independientemente del resultado de push
      // Esto asegura que las notificaciones se sincronicen incluso sin push activo
      try {
        const user = await this.securityService.getSecureUser();
        if (user && typeof user.id === 'number') {
          console.log('✅ Usuario autenticado, iniciando auto-sync');
          this.startAutoSync();
        } else {
          console.log('ℹ️ Usuario no autenticado, auto-sync se iniciará tras login');
        }
      } catch (e) {
        console.warn('⚠️ No se pudo verificar usuario para auto-sync:', e);
      }
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

              // Estrategia 2: Intentar sin userVisibleOnly (evitar en Edge)
              if (this.isEdge) {
                console.warn('ℹ️ Saltando intento sin userVisibleOnly en Edge');
                return false;
              }
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
        user_id: userId,
        origin: typeof location !== 'undefined' ? location.origin : undefined,
        scope: (this.registration && this.registration.scope) || undefined,
        subscribed_at: new Date().toISOString()
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
      window.addEventListener('message', async (event) => {
        if (!event.data) return;
        // Si el Service Worker incluye un unreadCount, actualizar el app badge inmediatamente
        try {
          const unreadCount = (event.data && (event.data.unreadCount ?? event.data.payload?.data?.unread_count)) || null;
          if (typeof unreadCount === 'number' && Number.isFinite(unreadCount)) {
            const uid = await this.getCurrentUserId();
            try { await this.updateAppBadgeFromLocal(uid); } catch (e) { /* noop */ }
          }
        } catch (e) { /* noop */ }
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
          // Ya no cerramos locales: preferimos notificaciones mostradas desde SW
        }
        // Cuando el Service Worker notifica que una notificación fue cerrada en el SO
        if (event.data.type === 'NOTIFICATION_CLOSED') {
          try {
            // Recalcular badge desde storage/back-end para no depender del estado del SO
            const uid = await this.getCurrentUserId();
            await this.updateAppBadgeFromLocal(uid);
            try { window.dispatchEvent(new CustomEvent('notifications:updated')); } catch {}
            console.log('🔔 [NOTIFICATIONS] NOTIFICATION_CLOSED recibido - badge reafirmado');
          } catch (e) {
            console.warn('⚠️ Error manejando NOTIFICATION_CLOSED:', e);
          }
        }
      });
    }

    // Cuando una ventana gana foco (visibilidadchange) reafirmar el badge basado en storage
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', async () => {
        try {
          if (document.visibilityState === 'visible') {
            const uid = await this.getCurrentUserId();
            await this.updateAppBadgeFromLocal(uid);
            // También emitir evento para que UI se actualice inmediatamente
            try { window.dispatchEvent(new CustomEvent('notifications:updated')); } catch {}
          }
        } catch (e) { /* noop */ }
      });
    }
  }

  /**
   * Helper rápido para obtener el userId o 'guest'
   */
  private async getCurrentUserId(): Promise<number | 'guest'> {
    try {
      const user = await this.securityService.getSecureUser();
      return (user && typeof user.id === 'number') ? user.id : 'guest';
    } catch {
      return 'guest';
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

  // Normalizar base para evitar dobles '/api' cuando environment.apiUrl ya incluye '/api'
  const base = (this.API_URL || '').replace(/\/+$/, '');
  const hasApiSuffix = /\/api$/i.test(base);
  const tokenUrl = hasApiSuffix ? `${base}/notification-tokens` : `${base}/api/notification-tokens`;
  await firstValueFrom(this.http.post(tokenUrl, tokenData));
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
        // Abrir el detalle de la orden: esto debe mostrar siempre el detalle completo
        // en lugar de la pantalla de confirmación que solo se muestra justo después
        // de crear la orden. Usamos la ruta de detalle dentro de tabs para garantizar
        // que el componente OrderDetailPage reciba el parámetro :id correctamente.
        this.navigateByUrl(`/tabs/orders/${orderId}`);
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
      if (this.router && typeof this.router.navigateByUrl === 'function') {
        this.router.navigateByUrl(url);
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
      // ✅ MODO DESARROLLO: Solo mostrar notificación local sin push
      if (this.isDevelopmentMode || location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        console.log('🔧 Modo desarrollo: enviando notificación de prueba local (sin push)');
        
        // Solicitar permisos si no están concedidos
        if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
          const result = await Notification.requestPermission();
          if (result !== 'granted') {
            console.warn('⚠️ Permisos no concedidos');
            return;
          }
        }
        
        // Mostrar notificación local directamente
        this.showLocalNotification({
          title: '🧪 Prueba de Notificación',
          body: 'Esta es una notificación de prueba desde tu app (modo desarrollo)',
          data: {
            type: 'test',
            timestamp: new Date().toISOString(),
            developmentMode: true
          }
        });
        
        console.log('✅ Notificación de prueba enviada (local)');
        return;
      }

      // MODO PRODUCCIÓN: Flujo completo con push
      // Si no hay permisos todavía, solicitarlos en contexto de interacción de usuario
      if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
        try {
          await this.requestPermissionsManually();
        } catch {}
        // Si tras solicitar no están concedidos, dar feedback en-app y salir temprano
  const perm: any = (Notification as any).permission;
  if (perm !== 'granted') {
          try {
            await this.saveNotificationToStorage({
              title: 'Permiso necesario',
              body: 'Activa las notificaciones del navegador para ver alertas del sistema. Puedes permitirlas desde el candado en la barra de direcciones.',
              data: { type: 'system', permissionNeeded: true }
            });
          } catch {}
          return;
        }
      }
      const attemptId = `t_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
      const payload: NotificationPayload = {
        title: 'Prueba de Notificación',
        body: 'Esta es una notificación de prueba desde tu app',
        data: {
          type: 'test',
          timestamp: new Date().toISOString(),
          attemptId
        }
      };
      // 1) Feedback inmediato: si ya tenemos permiso, mostrar notificación local al instante (marcada como optimista)
      if (Notification.permission === 'granted') {
        this.showLocalNotification({
          title: payload.title,
          body: payload.body,
          data: { ...payload.data, optimistic: true, immediate: true, attemptId }
        });
      }

      // 2) Disparar en background: asegurar suscripción y enviar al servidor sin bloquear la UI
      (async () => {
        try {
          const ensured = await this.ensureActiveSubscription();
          console.log('🔐 Suscripción activa antes de prueba (bg):', ensured);
        } catch {}
        let gotPush = false;
        try {
          await firstValueFrom(this.http.post(`${this.API_URL}/webpush/test`, payload));
          console.log('✅ Notificación de prueba enviada (WebPush real)');
          gotPush = await this.waitForPush({ type: 'test', timeoutMs: 1200 });
        } catch (e) {
          console.warn('⚠️ Falla al invocar /webpush/test (bg):', e);
        }
        // Si llegó el push, no hacemos nada especial; la real aparecerá desde SW
      })();
    } catch (error) {
      console.error('❌ Error enviando notificación de prueba:', error);
      // Si algo falla muy temprano, intenta al menos mostrar una local
      if (Notification.permission === 'granted') {
        this.showLocalNotification({
          title: 'Prueba de Notificación',
          body: 'Esta es una notificación de prueba desde tu app',
          data: { type: 'test', optimistic: true }
        });
      }
    }
  }

  /**
   * Garantiza que exista una suscripción push activa y registrada en el servidor
   */
  private async ensureActiveSubscription(): Promise<boolean> {
    try {
      // ✅ MODO DESARROLLO: No crear suscripción push en localhost
      if (this.isDevelopmentMode || location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        console.log('🔧 Modo desarrollo: saltando ensureActiveSubscription (no se requiere push)');
        return false;
      }

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
      } catch (e: any) {
        console.error('❌ Error creando suscripción en ensureActiveSubscription:', e);

        // Estrategia de recuperación si es AbortError/Registration failed
        const msg = String(e?.message || e?.name || '');
        const isAbort = e?.name === 'AbortError' || /Registration failed|abort/i.test(msg);
        if (isAbort) {
          try {
            console.log('🔄 Recuperación: limpiar y reintentar suscripción');
            // 1) Eliminar suscripción colgada si existe
            try {
              const existing = await this.registration!.pushManager.getSubscription();
              if (existing) {
                await existing.unsubscribe();
                console.log('🧹 Suscripción previa eliminada');
              }
            } catch {}
            // 2) Pequeña espera
            await new Promise(r => setTimeout(r, 800));
            // 3) Reintento con Uint8Array explícito
            const key = this.urlBase64ToUint8Array(this.vapidPublicKey);
            const sub2 = await this.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
            await this.sendSubscriptionToServer(sub2);
            console.log('✅ Suscripción creada tras reintento (ensure)');
            return true;
          } catch (e2: any) {
            console.warn('⚠️ Reintento 1 falló:', e2);
            // 4) Reintento alterno sin userVisibleOnly (algunos navegadores toleran esto) - evitar en Edge
            if (this.isEdge) {
              console.warn('ℹ️ Saltando reintento alterno sin userVisibleOnly en Edge');
              // Activar modo desarrollo si estamos en localhost para usar locales
              if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
                this.isDevelopmentMode = true;
                return true;
              }
              return false;
            }
            try {
              const key2 = this.urlBase64ToUint8Array(this.vapidPublicKey);
              const sub3 = await (this.registration as any).pushManager.subscribe({ applicationServerKey: key2 });
              await this.sendSubscriptionToServer(sub3);
              console.log('✅ Suscripción creada con alternativa (ensure)');
              return true;
            } catch (e3: any) {
              console.warn('⚠️ Reintento alterno también falló:', e3);
            }
          }
        }

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
   * Fuerza un reset del Service Worker y resuscribe el Push, reenviando al servidor
   */
  public async resetAndResubscribe(): Promise<boolean> {
    try {
      console.log('🧹 Reiniciando SW y resuscribiendo...');
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          try { const sub = await reg.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); } catch {}
          await reg.unregister();
          await new Promise(r => setTimeout(r, 500));
        }
      } catch {}

      // Registrar de nuevo el SW
      this.registration = await navigator.serviceWorker.register('/sw.js');
      await new Promise(r => setTimeout(r, 300));

      // Pedir permisos si hace falta
      if (Notification.permission !== 'granted') {
        const ok = await this.requestNotificationPermission();
        if (!ok) {
          console.warn('❌ No se concedieron permisos tras reset');
          return false;
        }
      }

      // Crear suscripción y enviarla al servidor
      const sub = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey!)
      });
      await this.sendSubscriptionToServer(sub);
      console.log('✅ Resuscripción completada');
      return true;
    } catch (e) {
      console.error('❌ Error en resetAndResubscribe:', e);
      return false;
    }
  }

  /**
   * Muestra una notificación del sistema directamente (sin backend) usando el Service Worker.
   * Útil para diagnosticar permisos/bloqueos a nivel navegador/SO.
   */
  public async showSystemNotificationTest(): Promise<boolean> {
    try {
      if (!this.isAvailable()) return false;
      if (Notification.permission !== 'granted') {
        const ok = await this.requestNotificationPermission();
        if (!ok) return false;
      }
      if (!this.registration) {
        this.registration = await navigator.serviceWorker.register('/sw.js');
      }
      const title = 'Prueba (Sistema)';
      const options: NotificationOptions = {
        body: 'Notificación mostrada directamente desde el Service Worker',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        data: { type: 'system_test' }
      };
      if (this.registration && (this.registration as any).showNotification) {
        await (this.registration as any).showNotification(title, options);
        return true;
      } else {
        new Notification(title, options);
        return true;
      }
    } catch (e) {
      console.warn('⚠️ No se pudo mostrar notificación de sistema directa:', e);
      return false;
    }
  }

  /**
   * Método público para probar showLocalNotification directamente
   * SOLO PARA DEBUGGING
   */
  public testShowLocalNotification(): void {
    console.log('🧪 [TEST] Llamando showLocalNotification directamente...');
    this.showLocalNotification({
      title: '🧪 Test Directo',
      body: 'Esta notificación se llamó directamente desde testShowLocalNotification()',
      data: { type: 'debug_test' }
    });
  }

  /**
   * Muestra una notificación local
   */
  private showLocalNotification(payload: NotificationPayload, saveToStorage: boolean = true): void {
    console.log('🔔 [showLocalNotification] Llamada recibida:', {
      permission: Notification.permission,
      title: payload.title,
      body: payload.body,
      saveToStorage: saveToStorage,
      hasRegistration: !!this.registration,
      isLocalhost: location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    });

    if (Notification.permission !== 'granted') {
      console.warn('⚠️ [showLocalNotification] Permisos NO concedidos. Estado:', Notification.permission);
      return;
    }

    // ✅ Generar tag único para evitar deduplicación de Windows
    // Windows agrupa notificaciones con el mismo tag y solo muestra la primera
    const uniqueTag = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const finalTag = payload.data?.attemptId 
      ? `notif_${payload.data.attemptId}` 
      : uniqueTag;

    const options: NotificationOptions = {
      body: payload.body,
      icon: payload.icon || '/icons/icon-192x192.png',
      badge: payload.badge || '/icons/icon-72x72.png',
      data: payload.data,
      tag: finalTag,  // Tag único para evitar deduplicación
      requireInteraction: false,
      silent: false
    };

    console.log('✅ [showLocalNotification] Permisos OK, mostrando notificación... Tag:', finalTag);

    // En localhost/desarrollo: SIEMPRE usar new Notification() directamente
    // Es más simple y confiable para desarrollo local
    const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    
    if (isLocalhost) {
      try {
        console.log('🔧 [showLocalNotification] Modo localhost: usando new Notification() directo');
        const notification = new Notification(payload.title, options);
        
        // Agregar eventos para debugging
        notification.onclick = (event) => {
          console.log('🖱️ Notificación clickeada:', event);
          event.preventDefault();
          window.focus();
          notification.close();
        };
        
        notification.onshow = () => {
          console.log('✅ [showLocalNotification] Notificación MOSTRADA exitosamente');
        };
        
        notification.onerror = (error) => {
          console.error('❌ [showLocalNotification] Error en notificación:', error);
        };
        
        console.log('📱 [showLocalNotification] Notificación creada:', notification);
      } catch (error) {
        console.error('❌ [showLocalNotification] Error crítico creando notificación:', error);
      }
    } else {
      // En producción: preferir Service Worker para que funcione en background
      try {
        if (this.registration && typeof this.registration.showNotification === 'function') {
          console.log('📱 [showLocalNotification] Usando Service Worker registration');
          this.registration.showNotification(payload.title, options);
          console.log('✅ [showLocalNotification] Notificación mostrada vía SW');
        } else {
          console.log('📱 [showLocalNotification] Fallback: usando new Notification()');
          new Notification(payload.title, options);
          console.log('✅ [showLocalNotification] Notificación mostrada vía constructor');
        }
      } catch (error) {
        console.error('❌ [showLocalNotification] Error:', error);
        try { 
          new Notification(payload.title, options);
        } catch (fallbackError) {
          console.error('❌ [showLocalNotification] Fallback también falló:', fallbackError);
        }
      }
    }

    // ✅ Persistir SOLO si saveToStorage es true
    // Cuando viene del backend sync, ya está guardada, no duplicar
    if (saveToStorage) {
      console.log('💾 [showLocalNotification] Guardando en localStorage...');
      // Guardar y emitir evento para que UI se actualice inmediatamente
      this.saveNotificationToStorage(payload).then(() => {
        try { window.dispatchEvent(new CustomEvent('notifications:updated')); } catch {}
      }).catch((e) => {
        console.error('❌ Error guardando notificación (showLocalNotification):', e);
      });
    } else {
      console.log('⏭️ [showLocalNotification] Saltando guardado (ya está en localStorage)');
    }
  }

  /**
   * Agrega una notificación real a la lista
   */
  private addToRealNotifications(payload: NotificationPayload): void {
    // Unificar persistencia vía localStorage para permitir dedupe entre optimista y real
    // Guardar y asegurar la UI se actualice
    this.saveNotificationToStorage(payload).then(() => {
      try { window.dispatchEvent(new CustomEvent('notifications:updated')); } catch {}
    }).catch((e) => {
      console.error('❌ Error guardando notificación real:', e);
    });
  }

  /**
   * Diagnóstico detallado del estado de notificaciones
   */
  public async debugStatus(): Promise<any> {
    const result: any = {
      available: this.isAvailable(),
      permission: (typeof Notification !== 'undefined') ? Notification.permission : 'unsupported',
      apiUrl: this.API_URL,
      vapid: !!this.vapidPublicKey,
      webPushAvailable: this.webPushAvailable,
      sw: {
        supported: 'serviceWorker' in navigator,
        registered: !!this.registration
      }
    };
    try {
      const reg = this.registration || (await navigator.serviceWorker.getRegistration());
      result.sw.registered = !!reg;
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        result.subscription = !!sub;
        if (sub) {
          result.subscriptionInfo = {
            endpoint: sub.endpoint?.slice(0, 28) + '…',
            expirationTime: (sub as any).expirationTime || null
          };
        }
      }
    } catch (e) {
      result.error = String(e);
    }
    // Verificar endpoint VAPID rápidamente
    try {
      const vk = await firstValueFrom(this.http.get(`${this.API_URL}/webpush/vapid-public-key`));
      result.vapidKeyFetch = { ok: true, data: vk };
    } catch (e: any) {
      result.vapidKeyFetch = { ok: false, status: e?.status, error: e?.message || e };
    }
    console.table(result);
    return result;
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
      const now = new Date();
      const nowIso = now.toISOString();
      const notification = {
        id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        title: payload.title,
        message: payload.body,
        type: payload.data?.type || 'system',
        timestamp: nowIso,
        read: false,
        data: payload.data,
        icon: payload.icon || '/icons/icon-192x192.png' // ✅ Guardar el icono
      };

      const existing = JSON.parse(localStorage.getItem(key) || '[]');

      // Dedupe/merge: si hay una notificación optimista reciente del mismo "attemptId", actualizarla; si no, permitir múltiples
      const windowMs = 15_000; // 15 segundos de ventana
      const isOptimisticIncoming = !!payload.data?.optimistic;
      const incomingAttempt = payload.data?.attemptId;
      let merged = false;
      try {
        for (const n of existing) {
          if (!n) continue;
          if (n.type !== notification.type) continue;
          const nTime = new Date(n.timestamp).getTime();
          if (!isFinite(nTime)) continue;
          if (now.getTime() - nTime > windowMs) continue;
          const isOptimisticExisting = !!(n.data && n.data.optimistic);
          const existingAttempt = n?.data?.attemptId;
          // Caso A: entra real (no optimista) y ya hay optimista del mismo attemptId -> actualizar la existente
          if (!isOptimisticIncoming && isOptimisticExisting && existingAttempt && incomingAttempt && existingAttempt === incomingAttempt) {
            n.title = notification.title;
            n.message = notification.message;
            n.timestamp = nowIso;
            n.read = false;
            n.data = { ...(n.data || {}), ...(notification.data || {}), optimistic: false };
            merged = true;
            break;
          }
          // Caso B: entra otra optimista pero con distinto attemptId -> permitir para que el contador aumente
          // Solo dedupe si es exactamente el mismo attemptId
          if (isOptimisticIncoming && isOptimisticExisting && existingAttempt && incomingAttempt && existingAttempt === incomingAttempt) {
            merged = true;
            break;
          }
        }
      } catch {}

      if (!merged) {
        existing.unshift(notification);
      }

      localStorage.setItem(key, JSON.stringify(existing));

      console.log('✅ Notificación real guardada en localStorage');

      // Notificar a otros componentes que hubo cambios
      try {
        window.dispatchEvent(new CustomEvent('notifications:updated'));
      } catch {}

      // Actualizar badge del sistema si es soportado
      try {
        this.updateAppBadgeFromLocal(userId);
      } catch (e) { /* noop */ }
    } catch (error) {
      console.error('❌ Error guardando notificación en localStorage:', error);
    }
  }

  /**
   * Actualiza el badge de la app basado en las notificaciones no leídas en localStorage
   */
  private async updateAppBadgeFromLocal(userId: number | 'guest'): Promise<void> {
    try {
      const key = this.getNotificationsKey(userId);
      const raw = localStorage.getItem(key) || '[]';
      const list = JSON.parse(raw) as Array<any>;
      const unread = list.filter(n => !n.read).length;

      // Intentar usar la API de Badging en navegador
      try {
        if (typeof navigator !== 'undefined' && typeof (navigator as any).setAppBadge === 'function') {
          if (unread > 0) {
            await (navigator as any).setAppBadge(unread);
            console.log('🔖 Navigator: setAppBadge ->', unread);
          } else if (typeof (navigator as any).clearAppBadge === 'function') {
            await (navigator as any).clearAppBadge();
            console.log('🔖 Navigator: clearAppBadge');
          }
        } else if (typeof this.registration !== 'undefined' && this.registration && typeof (this.registration as any).setAppBadge === 'function') {
          // Fallback: intentar usar registration.setAppBadge desde contexto de la página
          if (unread > 0) {
            await (this.registration as any).setAppBadge(unread);
            console.log('🔖 Registration: setAppBadge ->', unread);
          } else if (typeof (this.registration as any).clearAppBadge === 'function') {
            await (this.registration as any).clearAppBadge();
            console.log('🔖 Registration: clearAppBadge');
          }
        }
      } catch (e) {
        console.warn('⚠️ No se pudo actualizar app badge desde la app:', e);
      }
    } catch (e) {
      console.warn('⚠️ updateAppBadgeFromLocal fallo:', e);
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
      // ✅ MODO DESARROLLO: Saltar push y usar solo notificaciones locales
      if (this.isDevelopmentMode || location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        console.log('🔧 Modo desarrollo: mostrando solo notificación local');
        const orderIdRaw = (orderData && (orderData.id ?? orderData.orderId));
        const orderNumberVal = (orderData && (orderData.order_number ?? orderData.orderNumber)) ?? `#${orderIdRaw}`;
        this.showLocalNotification({
          title: '¡Orden Confirmada!',
          body: `Tu pedido ${orderNumberVal} ha sido confirmado`,
          data: { type: 'new_order', orderId: orderIdRaw, orderNumber: orderNumberVal }
        });
        return;
      }

      // Paso 0: solicitar permiso si aún está en 'default' (mejora UX para asegurar fallback local visible)
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
          const perm = await Notification.requestPermission();
          try { console.debug('[ORDER-NOTIF] Permiso tras request:', perm); } catch {}
        }
      } catch {}
      // Asegurar suscripción activa registrada en el servidor (reduce 422 por falta de destino)
      try {
        await this.ensureActiveSubscription();
      } catch (e) {
        console.warn('⚠️ No se pudo asegurar suscripción, continuando con notificación local:', e);
      }

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
          // Cambiado a ruta de detalle para que al hacer click abra el order detail
          url: `/tabs/orders/${idNum}`
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
      // Mostrar notificación local inmediata (optimista) si tenemos permiso, antes de esperar push real
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          this.showLocalNotification({ ...payload, body: `Tu pedido ${payload.data.orderNumber} está confirmado.` });
          try { console.debug('[ORDER-NOTIF] Notificación local optimista mostrada'); } catch {}
        } catch {}
      }

      // Enviar al servidor (preferir WebPush real). Si llega push se verá duplicado? Evitamos duplicado con dedupe en saveNotificationToStorage.
      try {
        // Log de depuración (no contiene secretos)
        try { console.debug('📤 Enviando order-notification:', bodyForServer); } catch {}
        await firstValueFrom(this.http.post(`${this.API_URL}/webpush/order-notification`, bodyForServer));
        this.webPushAvailable = true;
        console.log('✅ Notificación de orden enviada al servidor');
        // Ya mostramos optimista; aun así podemos esperar push para actualizar (pero sin forzar doble). Reducimos timeout.
        const gotPush = await this.waitForPush({ type: 'new_order', orderId: idNum, timeoutMs: 2500 });
        if (!gotPush) {
          try { console.debug('[ORDER-NOTIF] No llegó push (timeout). Nos quedamos con la local optimista.'); } catch {}
        }
      } catch (err: any) {
        const status = err?.status;
        if (status === 422) {
          console.warn('⚠️ Validación falló (422) al enviar notificación de orden. Detalles:', err?.error || err);
        }
        if (status === 404) {
          // Endpoint no existe: marcar como no disponible y caer a local sin ruido rojo
          this.webPushAvailable = false;
          console.warn('ℹ️ WebPush order-notification no disponible (404). Ya se mostró (o se intentó) la local optimista.');
          return;
        }
        // Otros errores: warning (local ya se intentó al inicio si había permiso)
        console.warn('⚠️ Error enviando notificación de orden al servidor.', err?.message || err);
        return;
      }
    } catch (error) {
      console.warn('⚠️ Error general en sendOrderNotification:', (error as any)?.message || error);
      // Si no se había mostrado (permiso quizá se concedió tras request), intentamos ahora
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          this.showLocalNotification({
            title: '¡Orden Confirmada!',
            body: `Tu pedido ${orderData.orderNumber || `#${orderData.id}`} ha sido confirmado`,
            data: { type: 'new_order', orderId: orderData.id, orderNumber: orderData.orderNumber }
          });
          console.log('✅ Notificación local de orden mostrada tras error global');
        }
      } catch {}
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
          url: `/tabs/orders/${idNum}`
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

  /**
   * Sincronizar notificaciones desde el backend
   * Se llama automáticamente al iniciar sesión
   */
  private async syncNotificationsFromBackend(): Promise<void> {
    try {
      const now = new Date().toLocaleTimeString();
      console.log(`🔄 [SYNC] [${now}] Iniciando sincronización...`);
      
      const user = await this.securityService.getSecureUser();
      if (!user || typeof user.id !== 'number') {
        console.warn('⚠️ [SYNC] No se puede sincronizar, usuario no autenticado');
        return;
      }

      console.log(`🔄 [SYNC] Usuario autenticado (ID: ${user.id}), solicitando notificaciones al backend...`);

      this.notificationsApi.getNotifications(50, false).subscribe({
        next: (response) => {
          if (response.success && Array.isArray(response.data)) {
            const backendNotifications = response.data;
            const userId = user.id;
            const key = this.getNotificationsKey(userId);

            console.log('📋 [NOTIFICATIONS] Notificaciones recibidas del backend:', backendNotifications.length);
            console.log('🔍 [DEBUG] Primera notificación:', JSON.stringify(backendNotifications[0], null, 2));

            // ✅ BACKEND ES LA FUENTE DE VERDAD - NO hacer merge, reemplazar completamente
            const localNotifications = backendNotifications.map(notif => {
              // Intentar crear fecha desde created_at
              let timestamp = new Date(notif.created_at);
              
              // ✅ Si la fecha es inválida, usar fecha actual como fallback
              if (isNaN(timestamp.getTime())) {
                console.warn('⚠️ [NOTIFICATIONS] Fecha inválida, usando fecha actual:', {
                  id: notif.id,
                  created_at: notif.created_at
                });
                timestamp = new Date();
              }
              
              // ✅ IMPORTANTE: Tomar el icono directamente de notif.data.icon
              // El backend ya debe estar enviando el icono en este campo
              const notifData = notif.data as any;
              const icon = notifData?.icon || notifData?.image || this.getDefaultIconForType(notif.type);
              const url = notifData?.url || '/';
              
              console.log('🎨 [NOTIFICATIONS] Icono de notificación:', {
                id: notif.id,
                type: notif.type,
                backendIcon: notifData?.icon,
                finalIcon: icon
              });
              
              return {
                id: `backend_${notif.id}`, // Prefijo para distinguir de las push locales
                backendId: notif.id, // Guardar ID del backend para operaciones posteriores
                type: notif.type,
                title: notif.title,
                message: notif.message,
                data: notif.data, // ✅ Mantener data original del backend
                read: notif.read,
                timestamp: timestamp.toISOString(),
                icon: icon, // ✅ Icono extraído de data.icon o fallback
                url: url // ✅ URL extraída de data.url o fallback
              };
            });

            // Obtener notificaciones anteriores para detectar nuevas Y evitar duplicados
            const previousNotifications = JSON.parse(localStorage.getItem(key) || '[]');
            const previousIds = new Set(previousNotifications.map((n: any) => n.backendId));

            // ✅ FILTRAR DUPLICADOS: Si ya existe una con el mismo backendId, mantener la más reciente
            const uniqueNotifications = new Map<number, any>();
            
            // Primero agregar las del backend (más recientes)
            localNotifications.forEach(notif => {
              if (notif.backendId) {
                uniqueNotifications.set(notif.backendId, notif);
              }
            });
            
            // Convertir Map a Array
            const dedupedNotifications = Array.from(uniqueNotifications.values());

            // ---------- MERGE: preservar notificaciones locales (optimistas) que aún no tienen backendId ----------
            // Evitar perder notificaciones mostradas localmente (por ejemplo, optimista tras crear una orden)
            try {
              const localsToKeep = (previousNotifications || []).filter((n: any) => {
                // Mantener solo las que NO tienen backendId (local-only) o que no están presentes en el backend sync
                if (!n) return false;
                if (!n.backendId) return true;
                return !uniqueNotifications.has(n.backendId);
              });

              if (localsToKeep.length) {
                console.log(`🔁 [NOTIFICATIONS] Preservando ${localsToKeep.length} notificaciones locales no sincronizadas`);
                // Insertar locales al final para mantener orden cronológico: backend (server) primero, luego locales pendientes
                const merged = dedupedNotifications.concat(localsToKeep);
                localStorage.setItem(key, JSON.stringify(merged));
                console.log(`✅ [NOTIFICATIONS] ${merged.length} notificaciones sincronizadas (incluyendo locales preservadas)`);
              } else {
                localStorage.setItem(key, JSON.stringify(dedupedNotifications));
                console.log(`✅ [NOTIFICATIONS] ${dedupedNotifications.length} notificaciones únicas sincronizadas desde backend`);
              }
            } catch (mergeError) {
              // Si algo falla en el merge, fallback a reemplazo simple
              console.warn('⚠️ [NOTIFICATIONS] Merge fallo, reemplazando localStorage con backend:', mergeError);
              localStorage.setItem(key, JSON.stringify(dedupedNotifications));
              console.log(`✅ [NOTIFICATIONS] ${dedupedNotifications.length} notificaciones únicas sincronizadas desde backend (fallback)`);
            }

            if (localNotifications.length !== dedupedNotifications.length) {
              console.log(`🗑️ [NOTIFICATIONS] ${localNotifications.length - dedupedNotifications.length} duplicados eliminados`);
            }
            console.log('🔍 [DEBUG] Muestra de notificación guardada:', JSON.stringify(dedupedNotifications[0], null, 2));

            // 🔔 Mostrar notificación push local para notificaciones NUEVAS y NO LEÍDAS
            const newNotifications = dedupedNotifications.filter(n => 
              !previousIds.has(n.backendId) && !n.read
            );

            console.log(`🆕 [NOTIFICATIONS] Notificaciones nuevas sin leer: ${newNotifications.length}`);

            // Mostrar notificación push para cada nueva
            // ⚠️ IMPORTANTE: Saltamos order_created en localhost porque ya se mostró optimísticamente
            const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
            
            newNotifications.forEach(notif => {
              // Saltar notificaciones de orden en localhost (ya se mostraron localmente)
              if (isLocalhost && notif.type === 'order_created') {
                console.log('⏭️ [NOTIFICATIONS] Saltando order_created en localhost (ya se mostró):', notif.title);
                return;
              }

              console.log('🔔 [NOTIFICATIONS] Mostrando notificación push para:', notif.title);
              
              // ✅ IMPORTANTE: saveToStorage=false porque YA está guardada en localStorage arriba
              this.showLocalNotification({
                title: notif.title,
                body: notif.message,
                icon: notif.icon,
                data: {
                  ...notif.data,
                  notificationId: notif.backendId,
                  url: notif.url
                }
              }, false); // ← NO guardar, ya está guardada
            });

            // Notificar cambios
            try {
              window.dispatchEvent(new CustomEvent('notifications:updated'));
            } catch {}
            // Actualizar badge del sistema basado en conteo backend (no bloquear)
            try { this.updateAppBadgeFromLocal(userId).catch(() => {}); } catch (e) { /* noop */ }
          }
        },
        error: (error) => {
          console.warn('⚠️ [NOTIFICATIONS] No se pudieron sincronizar notificaciones desde backend:', error);
        }
      });
    } catch (error) {
      console.error('❌ [NOTIFICATIONS] Error sincronizando notificaciones:', error);
    }
  }

  /**
   * Marcar notificación como leída en el backend
   */
  async markBackendNotificationAsRead(backendId: number): Promise<void> {
    try {
      await firstValueFrom(this.notificationsApi.markAsRead(backendId));
      console.log(`✅ [NOTIFICATIONS] Notificación ${backendId} marcada como leída en backend`);
      
      // Actualizar localStorage
      const user = await this.securityService.getSecureUser();
      if (user && typeof user.id === 'number') {
        const key = this.getNotificationsKey(user.id);
        const raw = localStorage.getItem(key);
        if (raw) {
          const list = JSON.parse(raw);
          const notif = list.find((n: any) => n.backendId === backendId);
          if (notif) {
            notif.read = true;
            localStorage.setItem(key, JSON.stringify(list));
            try {
              window.dispatchEvent(new CustomEvent('notifications:updated'));
            } catch {}
            try {
              await this.updateAppBadgeFromLocal(user.id);
            } catch (e) { /* noop */ }
          }
        }
      }
    } catch (error) {
      console.error('❌ [NOTIFICATIONS] Error marcando notificación como leída en backend:', error);
    }
  }

  /**
   * Eliminar notificación del backend
   */
  async deleteBackendNotification(backendId: number): Promise<void> {
    try {
      await firstValueFrom(this.notificationsApi.deleteNotification(backendId));
      console.log(`✅ [NOTIFICATIONS] Notificación ${backendId} eliminada del backend`);
      
      // Actualizar localStorage
      const user = await this.securityService.getSecureUser();
      if (user && typeof user.id === 'number') {
        const key = this.getNotificationsKey(user.id);
        const raw = localStorage.getItem(key);
        if (raw) {
          let list = JSON.parse(raw);
          list = list.filter((n: any) => n.backendId !== backendId);
          localStorage.setItem(key, JSON.stringify(list));
          try {
            window.dispatchEvent(new CustomEvent('notifications:updated'));
          } catch {}
          try {
            await this.updateAppBadgeFromLocal(user.id);
          } catch (e) { /* noop */ }
        }
      }
    } catch (error) {
      console.error('❌ [NOTIFICATIONS] Error eliminando notificación del backend:', error);
    }
  }

  /**
   * Marcar todas las notificaciones como leídas en el backend
   */
  async markAllBackendNotificationsAsRead(): Promise<void> {
    try {
      await firstValueFrom(this.notificationsApi.markAllAsRead());
      console.log('✅ [NOTIFICATIONS] Todas las notificaciones marcadas como leídas en backend');
      
      // Actualizar localStorage
      const user = await this.securityService.getSecureUser();
      if (user && typeof user.id === 'number') {
        const key = this.getNotificationsKey(user.id);
        const raw = localStorage.getItem(key);
        if (raw) {
          const list = JSON.parse(raw);
          list.forEach((n: any) => {
            n.read = true;
          });
          localStorage.setItem(key, JSON.stringify(list));
          try {
            window.dispatchEvent(new CustomEvent('notifications:updated'));
          } catch {}
          try {
            await this.updateAppBadgeFromLocal(user.id);
          } catch (e) { /* noop */ }
        }
      }
    } catch (error) {
      console.error('❌ [NOTIFICATIONS] Error marcando todas como leídas en backend:', error);
    }
  }

  /**
   * Eliminar todas las notificaciones del backend
   */
  async deleteAllBackendNotifications(): Promise<void> {
    try {
      await firstValueFrom(this.notificationsApi.deleteAllNotifications());
      console.log('✅ [NOTIFICATIONS] Todas las notificaciones eliminadas del backend');
      
      // Limpiar localStorage
      const user = await this.securityService.getSecureUser();
        if (user && typeof user.id === 'number') {
        const key = this.getNotificationsKey(user.id);
        localStorage.removeItem(key);
        try {
          window.dispatchEvent(new CustomEvent('notifications:updated'));
        } catch {}
        try {
          await this.updateAppBadgeFromLocal(user.id);
        } catch (e) { /* noop */ }
      }
    } catch (error) {
      console.error('❌ [NOTIFICATIONS] Error eliminando todas las notificaciones del backend:', error);
    }
  }

  /**
   * Forzar sincronización desde backend (útil para refresh manual)
   */
  async forceBackendSync(): Promise<void> {
    await this.syncNotificationsFromBackend();
  }

  /**
   * Obtener icono por defecto según el tipo de notificación
   * Usa el mismo icono que showLocalNotification() para consistencia
   */
  private getDefaultIconForType(type: string): string {
    // ✅ Usar ruta relativa como en showLocalNotification()
    // Esto asegura que el icono aparezca tanto en notificaciones locales
    // como en notificaciones sincronizadas desde el backend
    return '/icons/icon-192x192.png';
  }

  /**
   * ✅ Iniciar sincronización automática en segundo plano
   */
  private startAutoSync(): void {
    // Si ya hay un intervalo, no crear otro
    if (this.syncInterval) {
      console.log('⚠️ [AUTO-SYNC] Ya existe un intervalo de sincronización activo');
      return;
    }

    console.log(`� [AUTO-SYNC] INICIANDO sincronización automática cada ${this.SYNC_INTERVAL_MS / 1000} segundos`);
    console.log(`⏰ [AUTO-SYNC] Intervalo configurado: ${this.SYNC_INTERVAL_MS}ms (${this.SYNC_INTERVAL_MS / 1000}s)`);

    // Hacer una sincronización inmediata al iniciar
    console.log('🔄 [AUTO-SYNC] Sincronización inicial...');
    this.syncNotificationsFromBackend().catch(error => {
      console.error('❌ [AUTO-SYNC] Error en sincronización inicial:', error);
    });

    // ✅ Sincronización periódica SIEMPRE (incluso si la app está en background)
    this.syncInterval = setInterval(() => {
      const now = new Date().toLocaleTimeString();
      console.log(`🔄 [AUTO-SYNC] [${now}] Sincronizando notificaciones...`);
      this.syncNotificationsFromBackend().catch(error => {
        console.error('❌ [AUTO-SYNC] Error en sincronización automática:', error);
      });
    }, this.SYNC_INTERVAL_MS);

    console.log('✅ [AUTO-SYNC] Intervalo configurado correctamente. ID:', this.syncInterval);

    // Exponer en window para debugging
    if (typeof window !== 'undefined') {
      (window as any).stopAutoSync = () => this.stopAutoSync();
      (window as any).startAutoSync = () => this.startAutoSync();
      (window as any).debugAutoSync = () => {
        console.log('🔍 [AUTO-SYNC DEBUG]', {
          isActive: !!this.syncInterval,
          intervalId: this.syncInterval,
          intervalMs: this.SYNC_INTERVAL_MS,
          intervalSeconds: this.SYNC_INTERVAL_MS / 1000
        });
      };
    }
  }

  /**
   * ✅ Detener sincronización automática
   */
  private stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('⏹️ [AUTO-SYNC] Sincronización automática detenida');
    }
  }

  /**
   * ⏸️ Pausar auto-sync temporalmente (para evitar interrupciones en UI)
   * Se usa cuando el usuario está en el tab de notificaciones
   */
  public pauseAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('⏸️ [AUTO-SYNC] Auto-sync pausado (usuario interactuando)');
    }
  }

  /**
   * ▶️ Reanudar auto-sync después de pausarlo
   * Se usa cuando el usuario sale del tab de notificaciones
   */
  public resumeAutoSync(): void {
    // Solo reanudar si no está ya activo
    if (!this.syncInterval) {
      console.log('▶️ [AUTO-SYNC] Reanudando auto-sync...');
      this.startAutoSync();
    } else {
      console.log('ℹ️ [AUTO-SYNC] Ya está activo, no se reanuda');
    }
  }

  /**
   * ✅ Verificar si el auto-sync está activo
   */
  public isAutoSyncActive(): boolean {
    return this.syncInterval !== null;
  }

  /**
   * ✅ Verificar si el usuario está logueado y arrancar auto-sync
   * Se llama en el constructor para manejar el caso de recargas de página
   */
  private async checkAndStartAutoSync(): Promise<void> {
    try {
      console.log('🔍 [AUTO-SYNC] Verificando si el usuario está autenticado...');
      const user = await this.securityService.getSecureUser();
      
      if (user && typeof user.id === 'number') {
        console.log(`✅ [AUTO-SYNC] Usuario YA autenticado (ID: ${user.id}), iniciando auto-sync...`);
        this.startAutoSync();
      } else {
        console.log('ℹ️ [AUTO-SYNC] Usuario no autenticado, esperando login...');
      }
    } catch (error) {
      console.warn('⚠️ [AUTO-SYNC] Error verificando usuario:', error);
    }
  }
}
