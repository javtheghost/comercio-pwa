import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import {
  PushNotifications,
  PushNotificationSchema,
  ActionPerformed,
  Token
} from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../environments/environment';

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

  constructor(private http: HttpClient) {}

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

      // Obtener la clave pública VAPID
      await this.getVapidPublicKey();

      // Inicializar Web Push para navegadores
      if (!Capacitor.isNativePlatform()) {
        await this.initializeWebPush();
      } else {
        // Inicializar Capacitor para dispositivos nativos
        await this.initializeCapacitorPush();
      }
    } catch (error) {
      console.error('❌ Error inicializando push notifications:', error);
    }
  }

  /**
   * Obtiene la clave pública VAPID del servidor
   */
  private async getVapidPublicKey(): Promise<void> {
    try {
      const response = await firstValueFrom(this.http.get<VapidKeys>(`${this.API_URL}/webpush/vapid-public-key`));
      if (response?.publicKey) {
        this.vapidPublicKey = response.publicKey;
        console.log('✅ Clave pública VAPID obtenida');
      }
    } catch (error) {
      console.error('❌ Error obteniendo clave VAPID:', error);
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
        // Solicitar permisos y crear nueva suscripción
        await this.requestNotificationPermission();
      }

      // Configurar listeners
      this.setupWebPushListeners();
    } catch (error) {
      console.error('❌ Error inicializando Web Push:', error);
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

      // Solicitar permisos
      const permission = await Notification.requestPermission();

      if (permission === 'granted') {
        console.log('✅ Permisos de notificación concedidos');

        // Crear suscripción
        const subscription = await this.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
        });

        await this.sendSubscriptionToServer(subscription);
        return true;
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

      await firstValueFrom(this.http.post(`${this.API_URL}/webpush/subscribe`, {
        ...subscriptionData,
        user_agent: navigator.userAgent,
        platform: 'web'
      }));

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
      // Solicitar permisos
      const permStatus = await PushNotifications.requestPermissions();

      if (permStatus.receive === 'granted') {
        console.log('✅ Permisos de notificaciones concedidos');

        // Registrar para recibir notificaciones
        await PushNotifications.register();

        // Configurar listeners
        this.setupNotificationListeners();
      } else {
        console.log('❌ Permisos de notificaciones denegados');
      }
    } catch (error) {
      console.error('❌ Error inicializando Capacitor push:', error);
    }
  }


  /**
   * Configura los listeners de notificaciones
   */
  private setupNotificationListeners(): void {
    // Token de registro
    PushNotifications.addListener('registration', (token: Token) => {
      console.log('🔑 Token de registro:', token.value);
      this.tokenSubject.next(token.value);
      this.saveTokenToServer(token.value);
    });

    // Error en el registro
    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('❌ Error en registro de notificaciones:', error);
    });

    // Notificación recibida (app en primer plano)
    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('📱 Notificación recibida:', notification);
      this.handleNotificationReceived(notification);
    });

    // Notificación tocada (app en segundo plano)
    PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
      console.log('👆 Notificación tocada:', notification);
      this.handleNotificationTapped(notification);
    });
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
    // Implementar navegación basada en el tipo de notificación
    // Esto se puede integrar con el Router de Angular
    console.log('🧭 Navegando desde notificación:', data);
  }

  /**
   * Envía una notificación de prueba (para desarrollo)
   */
  async sendTestNotification(): Promise<void> {
    try {
      const payload: NotificationPayload = {
        title: 'Prueba de Notificación',
        body: 'Esta es una notificación de prueba desde tu app',
        data: {
          type: 'test',
          timestamp: new Date().toISOString()
        }
      };

      await firstValueFrom(this.http.post(`${this.API_URL}/webpush/test`, payload));
      console.log('✅ Notificación de prueba enviada');
    } catch (error) {
      console.error('❌ Error enviando notificación de prueba:', error);
    }
  }

  /**
   * Obtiene el token actual
   */
  getCurrentToken(): string | null {
    return this.tokenSubject.value;
  }

  /**
   * Verifica si las notificaciones están disponibles
   */
  isAvailable(): boolean {
    // Web Push funciona en navegadores, Capacitor en nativo
    return ('serviceWorker' in navigator && 'PushManager' in window) || Capacitor.isNativePlatform();
  }

  /**
   * Verifica si los permisos están concedidos
   */
  async checkPermissions(): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const permStatus = await PushNotifications.checkPermissions();
      return permStatus.receive === 'granted';
    } catch (error) {
      console.error('❌ Error verificando permisos:', error);
      return false;
    }
  }
}
