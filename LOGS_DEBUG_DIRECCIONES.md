# 🔧 LOGS DE DEBUG AGREGADOS - Direcciones Duplicadas

## ✅ CAMBIOS REALIZADOS

He agregado **logs detallados** en el servicio de direcciones para identificar exactamente dónde y cómo se duplican las direcciones.

---

## 🧪 CÓMO PROBAR

### **Paso 1: Crear una nueva dirección**

1. Ve a **Perfil → Agregar dirección**
2. Llena el formulario y guarda
3. **Abre la consola del navegador** (F12)
4. Busca los mensajes que empiecen con `🔍 [ADDRESS DEBUG]`

---

### **Paso 2: Analizar los logs**

Verás una secuencia como esta:

```javascript
🔍 [ADDRESS DEBUG] createAddress respuesta: {
  success: true,
  dataType: 'OBJECT',
  data: {
    id: 5,
    first_name: 'Juan',
    last_name: 'Pérez',
    address_line_1: 'Calle 123',
    // ...
  }
}

🔍 [ADDRESS DEBUG] Dirección creada: {
  id: 5,
  nombre: 'Juan Pérez',
  direccion: 'Calle 123',
  firma: 'juan|pérez|calle123|...'
}

🔍 [ADDRESS DEBUG] Lista actual ANTES de agregar: {
  count: 2,
  ids: [3, 4],
  firmas: ['maria|lopez|...', 'pedro|gomez|...']
}

🔍 [ADDRESS DEBUG] Dirección NUEVA, agregando al inicio...

🔍 [ADDRESS DEBUG] Lista DESPUÉS de agregar: {
  count: 3,
  ids: [5, 3, 4]  // ✅ Solo 1 vez el ID 5
}
```

---

### **Paso 3: Verificar si hay duplicados**

Después de crear la dirección, ejecuta en la consola:

```javascript
debugAddresses()
```

**Output esperado (SIN duplicados):**
```
┌─────────┬────┬──────────────┬─────────────────┬───────┬─────┐
│ (index) │ id │     name     │     line1       │  cp   │ def │
├─────────┼────┼──────────────┼─────────────────┼───────┼─────┤
│    0    │ 5  │ 'Juan Pérez' │ 'Calle 123'     │ 12345 │true │
│    1    │ 3  │ 'María López'│ 'Av. Principal' │ 54321 │false│
└─────────┴────┴──────────────┴─────────────────┴───────┴─────┘
```

**Output problemático (CON duplicados):**
```
┌─────────┬────┬──────────────┬─────────────────┬───────┬─────┐
│ (index) │ id │     name     │     line1       │  cp   │ def │
├─────────┼────┼──────────────┼─────────────────┼───────┼─────┤
│    0    │ 5  │ 'Juan Pérez' │ 'Calle 123'     │ 12345 │true │
│    1    │ 5  │ 'Juan Pérez' │ 'Calle 123'     │ 12345 │false│ ← DUPLICADO
└─────────┴────┴──────────────┴─────────────────┴───────┴─────┘
```

---

### **Paso 4: Verificar llamada al backend**

También busca este log:

```javascript
🔍 [ADDRESS DEBUG] getUserAddresses respuesta: {
  count: 2,  // ← ¿Cuántas devolvió el backend?
  addresses: [
    { id: 5, nombre: 'Juan Pérez', direccion: 'Calle 123', cp: '12345' },
    { id: 5, nombre: 'Juan Pérez', direccion: 'Calle 123', cp: '12345' }  // ← ¡DUPLICADO!
  ]
}

❌ [ADDRESS DEBUG] ¡BACKEND DEVOLVIÓ DUPLICADOS POR ID! {
  total: 2,
  unicos: 1,
  duplicados: [5]  // ← IDs que están duplicados
}

🔍 [ADDRESS DEBUG] Después de dedupe: {
  antes: 2,
  despues: 1,
  eliminados: 1,  // ← Sistema eliminó 1 duplicado
  ids_finales: [5]
}
```

---

## 📊 INTERPRETACIÓN DE RESULTADOS

### **Caso 1: Backend devuelve duplicados** ⭐

**Síntomas:**
- El log muestra: `❌ [ADDRESS DEBUG] ¡BACKEND DEVOLVIÓ DUPLICADOS POR ID!`
- `getUserAddresses` devuelve 2+ direcciones con el mismo ID

**Diagnóstico:** 
✅ **Problema del BACKEND** - El endpoint GET /api/addresses devuelve la misma dirección múltiples veces

**Acción:**
Pasa el archivo `DIAGNOSTICO_DIRECCIONES_DUPLICADAS.md` al Backend AI con el mensaje:

```
El frontend está detectando que GET /api/addresses devuelve direcciones duplicadas.

EVIDENCIA:
- Log muestra: "BACKEND DEVOLVIÓ DUPLICADOS POR ID"
- El mismo ID aparece múltiples veces en la respuesta
- Total: 2, Únicos: 1, Duplicados: [5]

Por favor revisa el documento DIAGNOSTICO_DIRECCIONES_DUPLICADAS.md
y aplica las soluciones sugeridas (DISTINCT, unique(), validación).
```

---

### **Caso 2: Backend NO devuelve duplicados, pero aparecen en la UI**

**Síntomas:**
- NO aparece el log de error del backend
- `getUserAddresses` devuelve cada ID solo 1 vez
- Pero `debugAddresses()` muestra el mismo ID 2 veces

**Diagnóstico:**
✅ **Problema del FRONTEND** - Hay múltiples llamadas concurrentes o race condition

**Acción:**
Buscar en los logs cuántas veces se llama `getUserAddresses`:

```javascript
// Buscar en consola cuántos de estos aparecen:
🔍 [ADDRESS DEBUG] getUserAddresses respuesta:

// Si aparece 2+ veces seguidas → Múltiples llamadas
```

---

### **Caso 3: Se duplica solo al crear, no al recargar**

**Síntomas:**
- Crear dirección → aparece duplicada
- Recargar página (F5) → ya NO está duplicada

**Diagnóstico:**
✅ **Problema de SINCRONIZACIÓN** - El frontend agrega la dirección antes de que el backend confirme

**Acción:**
El sistema de debounce debería evitar esto, pero podemos fortalecerlo.

---

## 🎯 SIGUIENTE PASO

1. **Crea una dirección nueva**
2. **Copia TODOS los logs** que empiecen con `🔍 [ADDRESS DEBUG]`
3. **Pégamelos aquí** para que pueda diagnosticar exactamente qué está pasando
4. **Ejecuta `debugAddresses()`** y muéstrame el resultado

Con esa información sabré si es problema del backend o del frontend.

---

## 🧹 LIMPIAR LOGS (Opcional)

Una vez identificado el problema, puedo remover todos los logs de debug para limpiar la consola.

Por ahora, **déjalos activos** para poder diagnosticar.

---

## 📋 RESUMEN RÁPIDO

| Síntoma | Diagnóstico | Acción |
|---------|-------------|--------|
| Log: "BACKEND DEVOLVIÓ DUPLICADOS" | Problema del backend | Pasar documento al Backend AI |
| Backend devuelve 1, UI muestra 2 | Múltiples llamadas frontend | Buscar llamadas concurrentes |
| Duplicado al crear, no al recargar | Sincronización | Fortalecer debounce |

---

**¿Listo para probar?** 🚀

Crea una dirección y muéstrame los logs que aparecen en la consola.
