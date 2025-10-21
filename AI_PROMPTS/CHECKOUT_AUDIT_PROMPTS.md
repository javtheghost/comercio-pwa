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

B. Diagnóstico cuando no aparece ninguna petición POST (caso mío)
```
Tengo estos archivos: (pegar archivos o sus rutas y contenido). En producción, al pulsar "Confirmar Pedido" no se hace la petición POST a /api/orders y no aparece en Network. En la Console solo veo logs iniciales de validación (ej: isFormValid -> true, isCartEmpty -> false, user -> {..}) pero no veo los logs posteriores (Loading presentado, Enviando POST...). ¿Cuáles son las causas más probables por las que el método no continúa hasta emitir la petición? Dame una lista priorizada de hipótesis (de más a menos probables), y para cada hipótesis, los comandos o checks exactos a ejecutar en el navegador (Console/Network) y qué resultado confirmaría o descartaría esa hipótesis.
```

C. Pedir parches concretos (si la IA detecta overlay/CSS o evento que no llega)
```
Si detectas que un elemento está interceptando el click o que el botón está cubierto por un overlay, sugiéreme el parche CSS mínimo concreto para asegurar que el botón sea clickeable en dispositivos móviles (incluir selectores exactos y propiedades). Además, proporciona un small code patch (diff) para `checkout.page.scss` o `checkout.page.html` listo para aplicar.
```

D. Pedir un parche temporal de diagnóstico (fetch-debug)
```
Propón un parche temporal (debug-only) que inserte en `processOrder()` un `fetch()` directo a `${environment.apiUrl}/orders` con el mismo payload `orderData`, y que imprima en Console la respuesta y los headers (sin modificar la lógica principal del método y removible después). Adjunta el snippet TypeScript exacto listo para pegar. Indica dónde insertarlo (líneas o contexto).```

E. Si la petición aparece pero da 401/403
```
La petición a /api/orders se envía pero responde 401 o 403. Adjunté headers de la petición y response. Analiza por qué puede faltar Authorization en la petición, revisa `auth.interceptor.ts` y `security.service.ts` y enumera causas posibles (por ejemplo token no guardado en localStorage, authState no actualizado). Para cada causa, sugiere la corrección exacta y un test (comando de Console) para verificar que el header Authorization está presente.
```

F. Pedir un plan de despliegue para validar cambios rápido
```
Dame un plan paso a paso para desplegar una rama `server-changes` que contiene debug fixes a producción temporalmente (build + deploy), y luego cómo revertirlos o confirmar y mergear a `master`. Incluye comandos para un servidor típico (git pull, npm ci, npm run build, reiniciar servicio) y pruebas post-deploy en el navegador.
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
