# 🧪 TEST DE NOTIFICACIONES - DIAGNÓSTICO DIRECTO

## ⚠️ PROBLEMA IDENTIFICADO:
- ✅ Código ejecutándose sin errores
- ✅ Permisos concedidos (`granted`)
- ❌ Notificaciones NO aparecen
- ❌ NO hay errores en consola

**Esto indica:** El navegador o Windows está bloqueando las notificaciones silenciosamente.

---

## 🔍 PASO 1: TEST DIRECTO EN CONSOLA

Abre la **consola del navegador** (F12) y ejecuta esto:

```javascript
// Test 1: Verificar estado básico
console.log('Permission:', Notification.permission);
console.log('MaxActions:', Notification.maxActions);

// Test 2: Crear notificación mínima
try {
  const n = new Notification('TEST SIMPLE');
  console.log('✅ Notificación creada:', n);
  
  n.onshow = () => console.log('✅✅✅ NOTIFICACIÓN MOSTRADA!');
  n.onerror = (e) => console.error('❌ Error:', e);
  
} catch (e) {
  console.error('❌ Falló crear notificación:', e);
}
```

### **RESULTADOS ESPERADOS:**

#### ✅ **Si funciona:**
```
✅ Notificación creada: Notification {...}
✅✅✅ NOTIFICACIÓN MOSTRADA!
```
Y VERÁS una notificación emergente.

#### ❌ **Si NO funciona:**
```
✅ Notificación creada: Notification {...}
(pero NO dice "NOTIFICACIÓN MOSTRADA" y NO ves popup)
```

Esto confirma bloqueo del sistema.

---

## 🔍 PASO 2: VERIFICAR CONFIGURACIÓN DE WINDOWS

### **Windows 10/11:**

1. **Configuración de Windows:**
   - Presiona `Win + I`
   - Ve a: **Sistema → Notificaciones**
   - Verifica que "Obtener notificaciones de aplicaciones y remitentes" esté **ACTIVADO** ✅

2. **Configuración del navegador en Windows:**
   - Busca tu navegador (Chrome/Edge/Firefox) en la lista
   - Asegúrate que esté **ACTIVADO** ✅
   - Verifica que "Mostrar notificaciones en el centro de actividades" esté activo

3. **Modo No molestar / Foco:**
   - Presiona `Win + N` (abre el centro de notificaciones)
   - Verifica que **NO** esté activado "No molestar" 🔕
   - Si está activado, desactívalo

### **Configuración del navegador:**

#### **Chrome/Edge:**
1. Ve a: `chrome://settings/content/notifications` (o `edge://settings/content/notifications`)
2. Verifica que **"Los sitios pueden pedir enviar notificaciones"** esté activado
3. Busca `localhost:4200` en la lista de sitios
4. Asegúrate que esté en **"Permitido"** (no en "Bloqueado" ni "Silenciar")
5. Si está en "Silenciar", cámbialo a "Permitir"

#### **Firefox:**
1. Ve a: `about:preferences#privacy`
2. Busca la sección **"Permisos → Notificaciones"**
3. Click en **"Configuración..."**
4. Busca `localhost:4200`
5. Cambia a **"Permitir"** (no "Bloquear")

---

## 🔍 PASO 3: TEST CON SONIDO Y VIBRACIÓN

En consola, ejecuta:

```javascript
// Test más agresivo con todas las opciones
try {
  const n = new Notification('🔔 TEST CON SONIDO', {
    body: '¿Ves esto?',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    requireInteraction: true,  // Forzar que no desaparezca automáticamente
    silent: false,              // NO silenciar
    tag: 'test-visible'
  });
  
  console.log('Notificación creada con requireInteraction:', n);
  
  n.onshow = () => {
    console.log('%c ✅✅✅ ÉXITO! La notificación SÍ apareció!', 'background: green; color: white; font-size: 20px; padding: 10px;');
  };
  
  n.onerror = (e) => {
    console.error('%c ❌ ERROR en la notificación', 'background: red; color: white; font-size: 20px; padding: 10px;', e);
  };
  
  setTimeout(() => {
    console.log('Cerrando notificación...');
    n.close();
  }, 5000);
  
} catch (e) {
  console.error('Error creando notificación:', e);
}
```

---

## 🔍 PASO 4: VERIFICAR HORA DE SILENCIO

Windows tiene una función llamada **"Horario de silencio"** o **"Asistente de concentración"**:

1. Presiona `Win + A` (Abre el Panel de Acción)
2. Busca el botón **"Asistente de concentración"**
3. Si está activado, cámbialo a **"Desactivado"**

O:

1. `Win + I` → **Sistema → Asistente de concentración**
2. Selecciona **"Desactivado"**

---

## 🔍 PASO 5: TEST EN MODO INCÓGNITO

A veces las extensiones o configuraciones bloquean notificaciones.

1. Abre tu navegador en **modo incógnito/privado**
2. Ve a `localhost:4200`
3. Cuando pida permisos, presiona **"Permitir"**
4. Ejecuta en consola:
   ```javascript
   new Notification('TEST INCÓGNITO', {body: '¿Funciona aquí?'})
   ```

Si funciona en incógnito pero NO en modo normal, entonces **alguna extensión** está bloqueando.

---

## 🔍 PASO 6: VERIFICAR SERVICIO DE NOTIFICACIONES DE WINDOWS

1. Presiona `Win + R`
2. Escribe: `services.msc`
3. Busca: **"Servicio de plataforma de notificaciones de Windows"**
4. Estado debe ser: **"En ejecución"**
5. Tipo de inicio: **"Automático"**

Si está detenido:
- Click derecho → **Iniciar**
- Click derecho → **Propiedades** → Tipo de inicio: **"Automático"**

---

## ✅ SOLUCIÓN RÁPIDA (SI TODO LO ANTERIOR NO FUNCIONA):

### **REINICIAR SERVICIOS DE NOTIFICACIONES:**

Ejecuta en **PowerShell como Administrador**:

```powershell
# Reiniciar servicio de notificaciones
Restart-Service -Name "WpnService" -Force

# Verificar estado
Get-Service -Name "WpnService"
```

Luego **reinicia el navegador** completamente.

---

## 📊 CHECKLIST FINAL:

Marca cada uno que verifiques:

- [ ] `Notification.permission` es `"granted"`
- [ ] Ejecuté test directo en consola y se creó la notificación
- [ ] El evento `onshow` se disparó (vi el log verde)
- [ ] Vi la notificación emergente en pantalla
- [ ] Windows → Notificaciones está activado
- [ ] El navegador está permitido en Windows
- [ ] No está activado "No molestar"
- [ ] El sitio `localhost:4200` está en "Permitir" en configuración del navegador
- [ ] Probé en modo incógnito
- [ ] Servicio WpnService está corriendo
- [ ] Reinicié el navegador después de cambios

---

## 🎯 RESULTADO ESPERADO:

Después de verificar todo lo anterior, ejecuta en consola:

```javascript
new Notification('🎉 FUNCIONÓ!', {
  body: 'Si ves esto, las notificaciones están activas',
  requireInteraction: true
})
```

**Deberías ver una notificación emergente en la esquina de tu pantalla.**

---

## 💬 SI SIGUE SIN FUNCIONAR:

Envíame captura de pantalla de:

1. **Consola del navegador** después de ejecutar los tests
2. **Configuración de Windows** → Sistema → Notificaciones
3. **Configuración del navegador** (la parte de permisos de `localhost:4200`)
4. **Resultado de ejecutar en PowerShell:**
   ```powershell
   Get-Service -Name "WpnService"
   ```

---

**Fecha:** 12 de octubre de 2025  
**Versión:** Guía de Diagnóstico de Notificaciones v1.0
