import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { defineCustomElements } from '@ionic/pwa-elements/loader';

// Define custom elements for PWA
defineCustomElements(window);

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));

// Auto-update Service Worker: si hay un worker en 'waiting', pedirle que active la nueva versión
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistration().then(reg => {
    if (!reg) return;

    try {
      // Si ya hay un worker esperando, pedir que se active
      if (reg.waiting) {
        try {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        } catch (e) {
          console.warn('No se pudo postMessage a waiting worker:', e);
        }

        // Cuando el nuevo worker se active, recargar la página
        reg.waiting.addEventListener('statechange', (e: any) => {
          if (e?.target?.state === 'activated') {
            console.log('Nueva versión del Service Worker activada, recargando...');
            window.location.reload();
          }
        });
      }

      // Escuchar futuros updates
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // Si hay un controlador activo y el nuevo está instalado -> pedir skipWaiting
            try { newWorker.postMessage({ type: 'SKIP_WAITING' }); } catch (e) { /* noop */ }
          }
        });
      });
    } catch (err) {
      console.warn('Error manejando actualización del Service Worker:', err);
    }
  }).catch(err => console.warn('SW registration check failed', err));
}
