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
  private isDevelopmentMode: boolean = false;

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

    // Listener para mensajes del service worker (web)
    if (typeof window !== 'undefined') {
      window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
          this.handleNotificationTapped(event.data);
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

      // Si estamos en modo desarrollo, mostrar notificación local
      if (this.isDevelopmentMode) {
        this.showLocalNotification(payload);
        console.log('✅ Notificación local mostrada (modo desarrollo)');
        return;
      }

      await firstValueFrom(this.http.post(`${this.API_URL}/webpush/test`, payload));
      console.log('✅ Notificación de prueba enviada');
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
   * Guarda notificación en localStorage directamente
   */
  private saveNotificationToStorage(payload: NotificationPayload): void {
    try {
      const notification = {
        id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        title: payload.title,
        message: payload.body,
        type: payload.data?.type || 'system',
        timestamp: new Date().toISOString(),
        read: false,
        data: payload.data
      };

      const existing = JSON.parse(localStorage.getItem('user_notifications') || '[]');
      existing.unshift(notification);
      localStorage.setItem('user_notifications', JSON.stringify(existing));
      
      console.log('✅ Notificación real guardada en localStorage');
    } catch (error) {
      console.error('❌ Error guardando notificación en localStorage:', error);
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
      const payload: NotificationPayload = {
        title: '¡Orden Confirmada!',
        body: `Tu pedido ${orderData.orderNumber || `#${orderData.id}`} ha sido confirmado y está siendo preparado`,
        data: {
          type: 'new_order',
          orderId: orderData.id,
          orderNumber: orderData.orderNumber || `#${orderData.id}`,
          url: `/orders/${orderData.id}`
        }
      };

      // Si estamos en modo desarrollo, mostrar notificación local
      if (this.isDevelopmentMode) {
        this.showLocalNotification(payload);
        console.log('✅ Notificación de orden mostrada (modo desarrollo)');
        return;
      }

      // En producción, enviar al servidor
      await firstValueFrom(this.http.post(`${this.API_URL}/webpush/order-notification`, payload));
      console.log('✅ Notificación de orden enviada al servidor');
    } catch (error) {
      console.error('❌ Error enviando notificación de orden:', error);
      
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
      const statusMessages: { [key: string]: string } = {
        'processing': 'Tu pedido está siendo preparado',
        'shipped': 'Tu pedido ha sido enviado',
        'delivered': 'Tu pedido ha sido entregado',
        'cancelled': 'Tu pedido ha sido cancelado'
      };

      const message = statusMessages[newStatus] || `El estado de tu pedido ha cambiado a: ${newStatus}`;

      const payload: NotificationPayload = {
        title: 'Actualización de Pedido',
        body: message,
        data: {
          type: 'order_status',
          orderId: orderData.id,
          status: newStatus,
          url: `/orders/${orderData.id}`
        }
      };

      // Si estamos en modo desarrollo, mostrar notificación local
      if (this.isDevelopmentMode) {
        this.showLocalNotification(payload);
        console.log('✅ Notificación de estado de orden mostrada (modo desarrollo)');
        return;
      }

      // En producción, enviar al servidor
      await firstValueFrom(this.http.post(`${this.API_URL}/webpush/order-status-notification`, payload));
      console.log('✅ Notificación de estado de orden enviada al servidor');
    } catch (error) {
      console.error('❌ Error enviando notificación de estado de orden:', error);
      
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
        const permStatus = await PushNotifications.checkPermissions();
        return permStatus.receive === 'granted';
      }
    } catch (error) {
      console.error('❌ Error verificando permisos:', error);
      return false;
    }
  }

  /**
   * Suscripción automática para usuarios autenticados
   */
  async subscribeForAuthenticatedUser(): Promise<boolean> {
    try {
      if (!this.vapidPublicKey || !this.registration) {
        console.warn('⚠️ VAPID key o Service Worker no disponible');
        return false;
      }

      // Verificar si ya tenemos una suscripción
      const existingSubscription = await this.registration.pushManager.getSubscription();

      if (existingSubscription) {
        console.log('✅ Suscripción existente encontrada');
        await this.sendSubscriptionToServer(existingSubscription);
        return true;
      }

      // Solicitar permisos y crear nueva suscripción
      const granted = await this.requestNotificationPermission();
      return granted;
    } catch (error) {
      console.error('❌ Error en suscripción automática:', error);
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
      const permStatus = await PushNotifications.requestPermissions();

      if (permStatus.receive === 'granted') {
        console.log('✅ Permisos de notificaciones concedidos');
        await PushNotifications.register();
        return true;
      } else {
        console.log('❌ Permisos de notificaciones denegados');
        return false;
      }
    } catch (error) {
      console.error('❌ Error solicitando permisos de Capacitor:', error);
      return false;
    }
  }
}
