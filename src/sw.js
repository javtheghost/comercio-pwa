// Service Worker para Web Push Notifications
// Este archivo debe estar en la raíz del proyecto (src/sw.js)

const CACHE_NAME = 'comercio-pwa-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker instalando...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('✅ Cache abierto');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ Service Worker instalado');
        return self.skipWaiting();
      })
  );
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker activando...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Eliminando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker activado');
      return self.clients.claim();
    })
  );
});

// Interceptar requests para cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Devolver desde cache si está disponible
        if (response) {
          return response;
        }

        // Si no está en cache, hacer fetch
        return fetch(event.request);
      })
  );
});

// Manejar mensajes push
self.addEventListener('push', (event) => {
  console.log('📱 Push message received:', event);

  let notificationData = {
    title: 'Nueva Notificación',
    body: 'Tienes una nueva notificación',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    data: {},
    actions: [
      {
        action: 'open',
        title: 'Abrir',
        icon: '/icons/icon-72x72.png'
      },
      {
        action: 'close',
        title: 'Cerrar',
        icon: '/icons/icon-72x72.png'
      }
    ],
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200],
    tag: 'general'
  };

  // Si hay datos en el push event, usarlos
  if (event.data) {
    try {
      const pushData = event.data.json();
      console.log('📋 Push data:', pushData);

      // Combinar datos del push con configuración por defecto
      notificationData = {
        ...notificationData,
        ...pushData,
        data: {
          ...notificationData.data,
          ...pushData.data
        }
      };
    } catch (error) {
      console.error('❌ Error parseando push data:', error);
    }
  }

  // Mostrar la notificación
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
      .then(() => {
        console.log('✅ Notificación mostrada:', notificationData.title);
      })
      .catch((error) => {
        console.error('❌ Error mostrando notificación:', error);
      })
  );
});

// Manejar clics en notificaciones
self.addEventListener('notificationclick', (event) => {
  console.log('👆 Notification clicked:', event);

  event.notification.close();

  const notificationData = event.notification.data || {};
  const action = event.action;

  // Determinar la URL a abrir basada en los datos de la notificación
  let urlToOpen = '/';

  if (notificationData.url) {
    urlToOpen = notificationData.url;
  } else if (notificationData.type) {
    switch (notificationData.type) {
      case 'new_order':
        urlToOpen = `/orders/${notificationData.order_id || ''}`;
        break;
      case 'order_status':
        urlToOpen = `/orders/${notificationData.order_id || ''}`;
        break;
      case 'promotion':
        urlToOpen = notificationData.promotion_url || '/promotions';
        break;
      case 'test':
        urlToOpen = '/';
        break;
      default:
        urlToOpen = '/';
    }
  }

  // Manejar acciones específicas
  if (action === 'close') {
    console.log('🚫 Notificación cerrada');
    return;
  }

  // Abrir la aplicación
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Si ya hay una ventana abierta, enfocarla y navegar
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            data: notificationData,
            url: urlToOpen
          });
          return;
        }
      }

      // Si no hay ventana abierta, abrir una nueva
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Manejar cierre de notificaciones
self.addEventListener('notificationclose', (event) => {
  console.log('🚫 Notification closed:', event);

  // Aquí puedes enviar analytics o hacer seguimiento
  const notificationData = event.notification.data || {};

  // Enviar evento de cierre al servidor si es necesario
  if (notificationData.trackClose) {
    fetch('/api/analytics/notification-closed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notificationId: notificationData.id,
        timestamp: new Date().toISOString()
      })
    }).catch((error) => {
      console.error('❌ Error enviando analytics:', error);
    });
  }
});

// Manejar mensajes del cliente
self.addEventListener('message', (event) => {
  console.log('💬 Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Manejar errores
self.addEventListener('error', (event) => {
  console.error('❌ Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Service Worker unhandled rejection:', event.reason);
});

console.log('🔔 Service Worker cargado y listo para notificaciones push');
