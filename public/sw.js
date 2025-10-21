// Service Worker para Web Push Notifications
// Este archivo debe estar en la raíz del proyecto (public/sw.js)


const CACHE_NAME = 'comercio-pwa-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Verificar si estamos en un entorno de desarrollo
const isDevelopment = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

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
  // Solo interceptar requests GET
  if (event.request.method !== 'GET') {
    return;
  }

  // No interceptar requests a dominios externos problemáticos
  const url = new URL(event.request.url);
  const externalDomains = [
    'via.placeholder.com',
    'placeholder.com',
    'loremflickr.com',
    'picsum.photos'
  ];

  if (externalDomains.some(domain => url.hostname.includes(domain))) {
    // Para dominios externos problemáticos, no interceptar
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Devolver desde cache si está disponible
        if (response) {
          return response;
        }
        
        // Si no está en cache, hacer fetch con manejo de errores
        return fetch(event.request)
          .catch((error) => {
            console.warn('⚠️ Fetch failed for:', event.request.url, error);
            
            // Para imágenes, devolver una imagen placeholder local si falla
            if (event.request.destination === 'image') {
              return caches.match('/icons/icon-192x192.png')
                .then((fallbackResponse) => {
                  if (fallbackResponse) {
                    return fallbackResponse;
                  }
                  // Si no hay fallback, devolver una respuesta vacía
                  return new Response('', { status: 404, statusText: 'Not Found' });
                });
            }
            
            // Para otros recursos, devolver error
            return new Response('Network error', { 
              status: 503, 
              statusText: 'Service Unavailable' 
            });
          });
      })
  );
});

// Manejar mensajes push
self.addEventListener('push', (event) => {
  console.log('📱 Push message received:', event);
  
  // Verificar si estamos en desarrollo
  if (isDevelopment) {
    console.log('🔧 Modo desarrollo detectado');
  }
  
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
    requireInteraction: true, // Mantener visible hasta que el usuario interactúe
    renotify: true, // Re-notificar si llega otra con el mismo tag
    silent: false,
    vibrate: [200, 100, 200],
    tag: 'general',
    timestamp: Date.now()
  };

  // Si hay datos en el push event, usarlos
  if (event.data) {
    try {
      const pushData = event.data.json();
      console.log('📋 Push data:', pushData);
      
      // Combinar datos del push con configuración por defecto
      const base = {
        ...notificationData,
        ...pushData,
        data: {
          ...notificationData.data,
          ...pushData.data
        }
      };
      // Generar un tag único cuando sea test/orden para evitar que el SO colapse banners
      const attempt = pushData?.data?.attemptId || pushData?.data?.orderId || pushData?.data?.order_id || Date.now();
      notificationData = {
        ...base,
        tag: `${(pushData?.data?.type || 'general')}-${attempt}`
      };
    } catch (error) {
      console.error('❌ Error parseando push data:', error);
    }
  }

  // Mostrar la notificación
  event.waitUntil(
    (async () => {
      try {
        // Si el payload trae un unread_count, intentar actualizar el app badge (si está soportado)
        const unreadCount = (notificationData && notificationData.data && notificationData.data.unread_count) || (notificationData && notificationData.unread_count) || null;
        if (typeof unreadCount === 'number' && Number.isFinite(unreadCount)) {
          try {
            if (self.registration && typeof self.registration.setAppBadge === 'function') {
              await self.registration.setAppBadge(unreadCount);
              console.log('🔖 Service Worker: app badge seteado a', unreadCount);
            }
          } catch (e) {
            console.warn('⚠️ No se pudo setear app badge desde SW:', e);
          }
        }

        await self.registration.showNotification(notificationData.title, notificationData);
        console.log('✅ Notificación mostrada:', notificationData.title);

        // Informar a las ventanas abiertas para actualizar badges/listas
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
          clientsList.forEach((client) => {
            try {
              // Incluir unreadCount si está en el payload para que la pestaña actualice el badge inmediatamente
              client.postMessage({ type: 'PUSH_RECEIVED', payload: notificationData, unreadCount: unreadCount });
            } catch (e) { /* noop */ }
          });
        });
      } catch (error) {
        console.error('❌ Error mostrando notificación o actualizando badge:', error);
      }
    })()
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
      case 'cart_abandoned':
        // 🛒 CARRITO ABANDONADO - Abrir carrito y guardar cart_id
        urlToOpen = '/tabs/cart';
        // Enviar cart_id a la app para que lo cargue
        event.waitUntil(
          clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
            clientsList.forEach((client) => {
              try {
                client.postMessage({
                  type: 'CART_ABANDONED_CLICK',
                  cartId: notificationData.cart_id,
                  data: notificationData
                });
                console.log('✅ cart_id enviado a la app:', notificationData.cart_id);
              } catch (e) { console.error('Error posting message:', e); }
            });
          })
        );
        break;
      case 'new_order':
        urlToOpen = `/order-confirmation?orderId=${notificationData.order_id || ''}`;
        break;
      case 'order_status':
        urlToOpen = `/order-confirmation?orderId=${notificationData.order_id || ''}`;
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
          try {
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              data: notificationData,
              url: urlToOpen,
              title: notificationData.title,
              body: notificationData.body
            });
          } catch (e) { /* noop */ }
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
self.addEventListener('notificationclose', async (event) => {
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

  // Informar a las ventanas abiertas que la notificación fue cerrada
  // para que la app pueda reafirmar el badge basado en su estado interno (localStorage/backend)
  try {
    const clientsList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsList) {
      try {
        client.postMessage({
          type: 'NOTIFICATION_CLOSED',
          payload: notificationData
        });
      } catch (e) { /* noop */ }
    }
  } catch (e) {
    console.warn('⚠️ Error notificando a clients sobre cierre de notificación:', e);
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
  // No propagar el error para evitar crashes
  event.preventDefault();
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Service Worker unhandled rejection:', event.reason);
  // Prevenir que el error no manejado cause problemas
  event.preventDefault();
});

console.log('🔔 Service Worker cargado y listo para notificaciones push');
