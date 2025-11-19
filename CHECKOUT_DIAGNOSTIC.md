# Checklist & Exact Prompts — Diagnóstico del flujo de Checkout

Propósito
- Este archivo contiene preguntas y plantillas listas para copiar/pegar a tu IA (o a otra persona) para auditar y diagnosticar por qué el checkout no crea la orden.
- Incluye: qué información proporcionar, prompts exactos, plantillas de logs/Network, hipótesis comunes y pasos de verificación.

Cómo usar
1. Reúne los archivos y logs pedidos en "Qué adjuntar" abajo.
2. Copia uno de los "Prompts listos" y pégalo a la IA (o a la herramienta que uses).
3. Adjunta la salida de la IA aquí o guárdala en un ticket.

---

## 1) Qué adjuntar (obligatorio para diagnósticos útiles)
- Rutas/archivos clave (adjuntar o copiar su contenido):
  - `src/app/pages/checkout/checkout.page.ts`
  - `src/app/pages/checkout/checkout.page.html`
  - `src/app/pages/checkout/checkout.page.scss`
  - `src/app/services/order.service.ts`
  - `src/app/services/cart.service.ts`
  - `src/app/services/auth.service.ts`
  - `src/app/services/security.service.ts`
  - `src/app/interceptors/auth.interceptor.ts`
  - `src/environments/environment.ts` y `environment.prod.ts`
  - `proxy.conf.json` (si usas `ng serve` con proxy)
  - Cualquier servicio adicional que participe (address.service, notification.service)

- Logs en tiempo real (Console) alrededor del intento de checkout:
  - Todos los mensajes Console desde 10s antes hasta 10s después de pulsar "Confirmar Pedido".
  - Filtra por: consola completa (no solo info). Incluye errores/stack traces.

- Red (Network)
  - Si aparece: la petición POST a `/api/orders` o la URL completa.
  - Copia: Request URL, Request Method, Request Headers (especialmente Authorization), Request Payload (body), Response status y response body.
  - Si no aparece petición POST, indicar "no aparece petición".

- Información de entorno
  - ¿Estás probando con `ng serve` (localhost) o con build en servidor (dist/)?
  - ¿Service Worker habilitado? (sí/no)
  - ¿Usas un proxy (`proxy.conf.json`)?

---

## 2) Prompts listos para la IA (copiar/pegar)

A. Explicar el flujo de checkout (nivel alto)
```
Te doy los archivos principales del frontend de una PWA (Angular/Ionic). Explica paso a paso el flujo que debe ocurrir cuando un usuario pulsa "Confirmar Pedido" en checkout. Indica las responsabilidades de cada archivo (checkout page, order.service, cart.service, auth.service, security.service, auth.interceptor). Di también qué logs concretos (mensajes) deberíamos ver en la consola si todo funciona correctamente. No analices aún errores, solo describe el flujo esperado y los puntos de control críticos.
```

Respuesta (lista para pegar)
```
1) Flujo esperado al pulsar "Confirmar Pedido":
- UI: El usuario pulsa el botón "Confirmar Pedido" en `checkout.page.html`.
- Evento: El handler en `checkout.page.ts` (ej. `onConfirm()` o `processOrder()`) se ejecuta.
- Validaciones locales:
  - Validar formulario de dirección/pago (`isFormValid`).
  - Comprobar carrito no vacío (`cartService.getItems()` / `isCartEmpty`).
  - Verificar estado de autenticación si se requiere (`authService.isAuthenticated()`).
- Preparación del payload:
  - El `checkout.page.ts` construye `orderData` con items, totales, dirección, método de pago y metadata.
  - Normalizar campos (ej. productId, variantId, quantity, price).
- UX: Mostrar loading/disable button (ej. `this.loading = true`).
- Llamada a servicio:
  - `checkout.page.ts` llama a `orderService.createOrder(orderData)` (o `orderService.submit(orderData)`).
  - `orderService` prepara la petición HTTP POST a `${environment.apiUrl}/orders` y devuelve un Observable/Promise.
- Interceptor / Auth:
  - `auth.interceptor.ts` intercepta la petición; si el usuario está autenticado obtiene token de `security.service` o `authService` y añade header `Authorization: Bearer <token>`.
  - Si no hay token y el endpoint lo requiere, el backend devolverá 401/403.
- Respuesta:
  - Si la respuesta es 2xx: `orderService` emite el resultado; `checkout.page.ts` procesa: limpiar carrito (`cartService.clear()`), navegar a página de confirmación, mostrar toast/alert con número de orden.
  - Si error: capturar en `catch`/`subscribe error`: mostrar error amigable, logging y restaurar `this.loading = false`.
- Side effects:
  - Notificaciones push, sincronización de favoritos o analytics.

2) Responsabilidades por archivo:
- `checkout.page.ts`: Manejo de UI y eventos, validaciones, montaje de `orderData`, mostrar loading y manejar la respuesta (navegación/limpieza).
- `checkout.page.html`: Botón Confirmar, bindings a `loading`, mensajes de validación, inputs de dirección/pago.
- `order.service.ts`: Encapsular llamadas HTTP relacionadas a órdenes (createOrder/submitOrder), transformación del payload.
- `cart.service.ts`: Gestión de items locales, totales, persistencia local, clear() después del checkout.
- `auth.service.ts`: Estado de autenticación, user info, login/logout flows, refresco de tokens si aplica.
- `security.service.ts`: Lectura/almacenamiento de tokens (localStorage/sessionStorage), helpers sync/async.
- `auth.interceptor.ts`: Interceptar requests HTTP y añadir Authorization si token presente; manejo 401 (refresh/retry).

3) Logs esperados (ejemplos concretos y orden):
- "isFormValid -> true"
- "isCartEmpty -> false"
- "user -> { id: ..., email: ... }"
- "Preparing orderData -> { items: [...], total: ..., address: {...} }"
- "Showing loading"
- "OrderService.createOrder: POST /orders"
- "Request headers: Authorization: Bearer <redacted>" (si aplica)
- "POST /orders -> status 201, orderId: 12345"
- "Order created: 12345, clearing cart"
- "Navigate to /order-confirmation/12345"
- En error: "Order create failed: <error message>" y stack trace

4) Puntos de control críticos:
- Logs previos a "Preparing orderData".
- Log "OrderService.createOrder" justo antes de la petición.
- Network tab: petición POST a /orders con payload y Headers.
- Interceptor: confirmación de Authorization añadido.
```

B. Diagnóstico cuando no aparece ninguna petición POST
```
Tengo estos archivos: (pegar archivos o sus rutas y contenido). En producción, al pulsar "Confirmar Pedido" no se hace la petición POST a /api/orders y no aparece en Network. En la Console solo veo logs iniciales de validación (ej: isFormValid -> true, isCartEmpty -> false, user -> {..}) pero no veo los logs posteriores (Loading presentado, Enviando POST...). ¿Cuáles son las causas más probables por las que el método no continúa hasta emitir la petición? Dame una lista priorizada de hipótesis (de más a menos probables), y para cada hipótesis, los comandos o checks exactos a ejecutar en el navegador (Console/Network) y qué resultado confirmaría o descartaría esa hipótesis.
```

Respuesta (lista para pegar)
```
Causas más probables (priorizadas) y checks exactos:

1) Exception silenciosa o early return en el handler antes del POST
- Qué ocurre: Un error no capturado lanza y evita continuar (try/await/Observable) o hay un `return` condicional inesperado.
- Checks en Console/Network:
  - Console: buscar errores (rojos) justo tras pulsar. Si hay stack trace, abrir y ver archivo/línea.
  - Agregar temporalmente logs más abajo en el método (por ejemplo: "after validations", "before building orderData", "before calling orderService").
  - Check: Si no hay error visible pero tampoco logs posteriores, esto apunta a excepción silenciosa o ruta de retorno.
- Resultado que confirma: Error en consola o logs intermedios faltantes y no hay POST.

2) Código de producción difiere y el método viene parcheado/removido (build no actualizado)
- Qué ocurre: La versión desplegada no contiene la llamada (por build viejo o CDN/Cache).
- Checks:
  - DevTools Sources: localizar `checkout.page.js` transpiled y buscar `createOrder` o `processOrder`.
  - Console: `typeof window.processOrder` o `typeof window.triggerCheckoutProcess` (si existe un punto de entrada global).
  - Application -> Service Workers -> Disable/Bypass for network; Hard reload.
  - Check: Si el JS en producción no contiene el llamado a orderService, confirma que el build está desactualizado.
- Resultado que confirma: Código minificado sin la llamada; el método es distinto.

3) Un overlay/CSS o elemento bloquea el click (evento no llega)
- Qué ocurre: El click no alcanza el botón y el handler no se dispara.
- Checks:
  - En DevTools Console ejecutar:
    - Obtener coordenadas: `const btn = document.querySelector('button.confirm'); btn.getBoundingClientRect()`; luego `document.elementFromPoint(x,y)` con el centro.
    - `btn.disabled` y `btn.hasAttribute('disabled')`.
  - Reproducir click programáticamente: `btn.click()`; ver si logs aparecen o petición se dispara.
- Resultado que confirma: `elementFromPoint` muestra otro elemento encima o `btn.click()` tampoco ejecuta el flujo -> problema de overlay/disabled.

4) `loading` boolean o estado bloqueante ya está true (previene nueva petición)
- Qué ocurre: `this.loading` está true impedirá la ejecución posterior.
- Checks:
  - Console: inspeccionar componente en Angular DevTools o exponer `window.__app__` para leer `component.loading`.
  - Probar forzar `window.__component__.loading = false` y luego `btn.click()` para ver si procede.
- Resultado que confirma: Cambiar loading a false permite enviar la petición.

5) Service Worker intercepta y responde con shell o cache, evitando la petición XHR (o el SW hace fallback)
- Qué ocurre: SW captura fetch y responde sin contactar al backend (por ejemplo, offline fallback).
- Checks:
  - Application -> Service Workers -> Bypass for network; recargar y reintentar.
  - Network Tab: filtrar por `service-worker` o verificar que la petición no aparece en Network pero hay actividad en SW logs.
- Resultado que confirma: Bypass permite que la petición aparezca; entonces SW intercepta.

6) El flujo depende de una confirmación async (ej: confirm dialog/ionic modal) que no se resuelve
- Qué ocurre: El handler abre modal/prompt y espera una resolución que no ocurre (promise pendiente).
- Checks:
  - Console logs: buscar "Opening confirm modal" y "Modal result:".
  - Programáticamente resolver: si modal expone API, simular la respuesta desde consola.
- Resultado que confirma: Modal no se resuelve, por eso no sigue.

7) Problemas de permisos CSP o bloqueo de JS por políticas que silencian errores
- Qué ocurre: CSP bloquea eval/import dinámico y el flujo se rompe.
- Checks:
  - Console: buscar mensajes CSP.
  - Network: revisar que no hay 0-byte scripts o errores 403 para archivos JS.
- Resultado que confirma: Mensajes CSP o scripts con status != 200.

8) Event listener fue eliminado por otro script (race condition)
- Qué ocurre: Otra librería sobrescribe el handler después de la inicialización.
- Checks:
  - `getEventListeners(btn)` (Chrome) para ver listeners adjuntos.
  - Search en Sources para `addEventListener('click'` o `.onclick` en runtime.
- Resultado que confirma: No hay listener o listener no es el esperado.

Para cada hipótesis incluye comando exacto de consola y qué verás:
(El texto anterior ya incluye comandos concretos: `document.elementFromPoint`, `btn.click()`, `getEventListeners(btn)`, `typeof window.processOrder`, inspección en Application -> Service Workers, etc.)
```

C. Pedir parches concretos (si la IA detecta overlay/CSS o evento que no llega)
```
Si detectas que un elemento está interceptando el click o que el botón está cubierto por un overlay, sugiéreme el parche CSS mínimo concreto para asegurar que el botón sea clickeable en dispositivos móviles (incluir selectores exactos y propiedades). Además, proporciona un small code patch (diff) para `checkout.page.scss` o `checkout.page.html` listo para aplicar.
```

Respuesta (lista para pegar)
```
Parche CSS mínimo (para `checkout.page.scss`):
/* Asegura que el botón de confirmar esté en el top-most stacking context y reciba clicks */
button.confirm {
  position: relative;
  z-index: 9999 !important; /* elevar por encima de overlays */
  pointer-events: auto !important; /* forzar que acepte eventos */
}

/* Si hay overlay semi-transparente que cubre la pantalla, permitir clicks en el área del botón */
.overlay-selector { /* reemplazar por el selector real del overlay si conoces */
  pointer-events: none !important;
}

/* Alternativa: forzar el área clickeable del botón */
button.confirm::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
}
```

Small patch (apply_patch style) listo para aplicar (ejemplo):
```
*** Begin Patch
*** Update File: src/app/pages/checkout/checkout.page.scss
@@
+/* Temp fix: ensure confirm button is clickable above overlays */
+button.confirm {
+  position: relative;
+  z-index: 9999 !important;
+  pointer-events: auto !important;
+}
+
+.overlay-selector {
+  pointer-events: none !important;
+}
*** End Patch
```

Nota: Reemplaza `.overlay-selector` por el selector real de tu overlay modal/elemento si lo identificas.

D. Pedir un parche temporal de diagnóstico (fetch-debug)
```
Propón un parche temporal (debug-only) que inserte en `processOrder()` un `fetch()` directo a `${environment.apiUrl}/orders` con el mismo payload `orderData`, y que imprima en Console la respuesta y los headers (sin modificar la lógica principal del método y removible después). Adjunta el snippet TypeScript exacto listo para pegar. Indica dónde insertarlo (líneas o contexto).
```

Respuesta (lista para pegar)
```
Snippet TypeScript temporal (debug-only) — insertar justo antes de la llamada principal a orderService.createOrder(orderData) en `processOrder()`:

import { environment } from 'src/environments/environment';

/* DEBUG TEMP - direct fetch to verify network from client */
try {
  console.log('DEBUG fetch: starting direct fetch to orders with payload', orderData);
  fetch(`${environment.apiUrl.replace(/\\/$/, '')}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Si usas auth token en securityService, añade aquí para replicar:
      // 'Authorization': `Bearer ${this.securityService.getTokenSync() || ''}`
    },
    body: JSON.stringify(orderData),
    credentials: 'include' // si necesitas cookies
  }).then(async res => {
    console.log('DEBUG fetch: status', res.status, 'headers:', [...res.headers.entries()]);
    const text = await res.text();
    try { console.log('DEBUG fetch: body (json):', JSON.parse(text)); }
    catch(e) { console.log('DEBUG fetch: body (text):', text); }
  }).catch(err => {
    console.error('DEBUG fetch: error', err);
  });
} catch (err) {
  console.error('DEBUG fetch: exception', err);
}

Instrucciones:
- Insertar este bloque inmediatamente antes de la línea que llama a `orderService.createOrder(orderData)` en `checkout.page.ts`.
- Remover después de diagnóstico.
- Si tu app usa token via `securityService`, descomenta y añade la cabecera Authorization con el token obtenido por `this.securityService.getTokenSync()` o similar.
```

E. Si la petición aparece pero da 401/403
```
La petición a /api/orders se envía pero responde 401 o 403. Adjunté headers de la petición y response. Analiza por qué puede faltar Authorization en la petición, revisa `auth.interceptor.ts` y `security.service.ts` y enumera causas posibles (por ejemplo token no guardado en localStorage, authState no actualizado). Para cada causa, sugiere la corrección exacta y un test (comando de Console) para verificar que el header Authorization está presente.
```

Respuesta (lista para pegar)
```
Causas posibles por las que falta o es incorrecto Authorization (priorizado) y correcciones + checks:

1) Token no se guarda/lee correctamente desde storage (localStorage/sessionStorage)
- Por qué: `security.service` guarda token pero con clave distinta o usando async storage (Ionic Storage) y `auth.interceptor` usa sync access.
- Corrección: Asegurar un método sync: `securityService.getTokenSync()` que lea de `localStorage.getItem('auth_token')` o, si usas Ionic Storage async, adaptar interceptor para esperar (o cachear token en memory).
- Test console:
  - `localStorage.getItem('auth_token')` -> debe devolver token no-empty.
  - `console.log('token from securityService', (window as any).securityService.getTokenSync && window.securityService.getTokenSync())` (exponer temporalmente).

2) Interceptor no está registrado o no se aplica (módulo HTTP no configurado)
- Por qué: `auth.interceptor` no fue provisto en app.module (providers) o fue sobrescrito.
- Corrección: En `app.module.ts` asegurar:
  ```
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  ]
  ```
- Test console:
  - En consola, intercepta fetch: `fetch('/some-test', {method:'GET'})` y ver si se añade Authorization (más fácil inspeccionar Network para requests XHR que pasan por HttpClient).

3) El interceptor obtiene token de `authService` y `authService` aún no ha inicializado (race)
- Por qué: Token está en storage pero `authService` lo carga asíncronamente y el interceptor lee null en el primer request.
- Corrección: Cambiar interceptor para leer token directamente desde `securityService` sync o reintentar (queue) requests hasta auth loaded.
- Test console:
  - `console.log('authService.user', window.authService && authService.user)` y `console.log('security get token', securityService.getTokenSync && securityService.getTokenSync())`.
  - Forzar un retry: `setTimeout(()=> btn.click(), 1000)` — si funciona después de delay, es race condition.

4) Token expirado / invalidado y backend responde 401
- Por qué: Token caducado y no hay refresh flow o refresh falla.
- Corrección: Implementar refresh-token flow o detectar 401 en interceptor, intentar refresh y replay request.
- Test:
  - Inspeccionar token payload (JWT): `JSON.parse(atob(token.split('.')[1]))` y verificar `exp`.
  - Hacer curl con token y ver respuesta.

5) Header eliminado por CORS/Security en el servidor (disallow Authorization header)
- Por qué: El backend no permite header Authorization por CORS.
- Corrección: Añadir `Access-Control-Allow-Headers: Authorization, Content-Type` en servidor CORS config.
- Test:
  - Revisar la respuesta OPTIONS preflight en Network: comprobar `Access-Control-Allow-Headers`.

6) Interceptor manipula la petición y la transforma a modo que backend rechaza (p. ej. content-type incorrecto)
- Por qué: El interceptor sobrescribe headers o transforma body de forma incompatible.
- Corrección: Verificar que interceptor preserve headers importantes y solo añada Authorization sin remover Content-Type.
- Test:
  - Ver en Network los headers enviados: `Authorization` presente y `Content-Type` correcto.

Pasos de verificación rápidos en Console/Network:
- En Console: `console.log('token', localStorage.getItem('auth_token'))`
- En Network: seleccionar la petición POST y confirmar `Request Headers` contiene `Authorization: Bearer ...`
- En caso de no aparecer, revisar Sources para confirmar que `auth.interceptor.ts` está incluido en el build y su código no fue minificado de forma que se elimine la lógica.

Correcciones concretas (snippet) - ejemplo para interceptor sync token:
```ts
// auth.interceptor.ts (simplified)
intercept(req, next) {
  const token = this.securityService.getTokenSync(); // ensure sync getter
  let headers = req.headers;
  if (token) {
    headers = headers.set('Authorization', `Bearer ${token}`);
  }
  const cloned = req.clone({ headers });
  return next.handle(cloned).pipe(
    catchError(err => {
      if (err.status === 401) {
        // option: trigger refresh flow
      }
      return throwError(err);
    })
  );
}
```
```

F. Pedir un plan de despliegue para validar cambios rápido
```
Dame un plan paso a paso para desplegar una rama `server-changes` que contiene debug fixes a producción temporalmente (build + deploy), y luego cómo revertirlos o confirmar y mergear a `master`. Incluye comandos para un servidor típico (git pull, npm ci, npm run build, reiniciar servicio) y pruebas post-deploy en el navegador.
```

Respuesta (lista para pegar)
```
Plan de despliegue rápido (temporal) para rama `server-changes` (6 pasos) y revert/merge:

Precondiciones: tienes acceso al servidor y privilegios para git pull, npm, y reiniciar el servicio (systemd, pm2, docker, etc.).

Desplegar temporal:
1) En el servidor, hacer backup y cambiar a rama:
   git fetch origin
   git checkout -b server-changes origin/server-changes

2) Instalar dependencias limpias:
   npm ci

3) Build producción:
   npm run build --if-present
   # o el script usado en tu proyecto (ej. npm run build -- --prod)

4) Reiniciar servicio web (ejemplos):
   # systemd
   sudo systemctl restart comercio-pwa
   # pm2
   pm2 restart comercio-pwa
   # docker (si usas container)
   docker-compose down && docker-compose up -d --build

5) Validación post-deploy (en navegador):
   - Bypass Service Worker en DevTools -> Application -> Service Workers -> check "Bypass for network".
   - Hard reload.
   - Reproducir el checkout y verificar Network tab la petición POST /orders.
   - Ver logs del servidor para confirmar llegada de request y respuesta 2xx.

6) Revert / Confirm:
   - Si rollback necesario: git checkout master && git reset --hard origin/master && restart servicio.
   - Si confirmar cambios: en tu workstation, crea PR de `server-changes` -> `master`, revisa y mergea; luego en servidor:
     git checkout master && git pull origin master && npm ci && npm run build && restart servicio

Comandos compactos ejemplo (PowerShell / bash adaptado):
- Deploy server-changes:
  git fetch origin; git checkout -b server-changes origin/server-changes; npm ci; npm run build; sudo systemctl restart comercio-pwa
- Rollback to master:
  git fetch origin; git checkout master; git reset --hard origin/master; npm ci; npm run build; sudo systemctl restart comercio-pwa

Notas:
- Siempre hacer `npm ci` en servidores de CI/producción para reproducibilidad.
- Evita hacer deploy directo en master sin PR/revisión salvo emergencia.
- Si se usa CDN, invalidar cache o versionar assets para evitar servir JS viejo.
```

---

## 3) Plantillas para pegar logs y network

- Console (usa esto para pegar):
```
[CONSOLE LOGS - desde T0-10s hasta T0+10s]
TIMESTAMP - <mensaje>
... (pegar todo)
```

- Network (si aparece petición a orders):
```
REQUEST URL: <...>
METHOD: POST
STATUS: <...>
REQUEST HEADERS:
  Authorization: <...>
  Content-Type: <...>
REQUEST BODY:
  <pegar JSON>
RESPONSE BODY:
  <pegar JSON>
```

- Si NO aparece petición:
```
NO_XHR_POST_TO_ORDERS: true
Console logs: (pegar lo que había)
```

---

## 4) Hipótesis comunes y pruebas rápidas (resumen)
1. Click no llega (overlay / z-index / pointer-events) — Prueba: `document.elementFromPoint(x,y)` en el centro del botón.
2. `loading` boolean está en true bloqueando el botón — Prueba: inspeccionar `btn.disabled` y buscar `this.loading` asignada en código.
3. Versión en servidor no contiene cambios (debug/helper no existe) — Prueba: `typeof window.triggerCheckoutProcess`.
4. Exception silent justo antes del POST — Prueba: escanear Console por errores rojos; envolver más try/catch y logs.
5. Service Worker interceptando/serving cached shell — Prueba: DevTools Application -> Service Workers -> Bypass for network y recargar.
6. Petición se envía pero falta Authorization (401) — Prueba: inspeccionar headers en Network.

---

## 5) Preguntas de seguimiento que le puedes hacer a la IA tras su primera respuesta
- "Dame un patch mínimo (apply_patch style) para arreglar X" (si IA propone cambiar un archivo).
- "Escribe los tests unitarios (Jasmine/Karma) que verifiquen que processOrder() llama a orderService.createOrder cuando isFormValid es true".
- "Crea un script curl exacto que simule la petición POST a /api/orders con un token de ejemplo".

---

## 6) Ejemplo de prompt completo (lista para enviar)
```
Tengo un problema: en el checkout, al pulsar "Confirmar Pedido" no se hace la petición POST a /api/orders. He incluido estos archivos: (pegar paths). Adjunto además los logs de la consola (pegar) y la info de Network (pegar si existe). Dame:
  1) Un mapa paso a paso del flujo (qué archivo hace qué).
  2) Las 5 hipótesis más probables para no llegar a hacer la petición y los checks concretos para confirmar cada una.
  3) Si una hipótesis requiere un parche JS/CSS, dame el diff listo para aplicar.
  4) Un plan de despliegue y revert en 6 pasos.
```

---

## 7) Mini-FAQ (respuestas rápidas que la IA debería dar)
- Q: "¿El interceptor añade Authorization automáticamente?" → A: Debe hacerlo si `authService.isAuthenticated()` es true y `securityService.getTokenSync()` devuelve un token.
- Q: "¿Por qué no aparece petición en Network?" → A: Porque el método no llegó al POST (overlay/evento bloqueado, early return o excepción antes del POST), o el SW está bloqueando/atrapando.

---

Guarda este archivo y úsalo cada vez que pidas ayuda a tu IA; acelera el diagnóstico y hace que las respuestas sean accionables. Si quieres, puedo generar automáticamente un `HAR` extractor script o un `curl` generator para el endpoint de orders basándome en la estructura `orderData` del código.
