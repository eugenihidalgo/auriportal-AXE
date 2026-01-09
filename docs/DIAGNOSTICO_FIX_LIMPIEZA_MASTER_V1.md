# DIAGNÓSTICO FIX LIMPIEZA MASTER v1
**AuriPortal / Aurelín — Dominio MASTER**  
**Fecha:** 2026-01-09  
**Problema:** Error "item_kind is not defined" en limpieza Master desde Alquimia General

---

## RESUMEN EJECUTIVO

**Error detectado:** `ReferenceError: item_kind is not defined` en `markCleanStudent` (línea 348 de `cleaning-engine-service.js`)

**Causa raíz:** El frontend `handleLimpiarEstudiante()` no envía `item_kind` en el payload, y el backend intenta usar `item_kind` antes de determinarlo desde la lista.

**Ubicación del error:** `src/core/master/services/cleaning-engine-service.js:348`

---

## FASE 1 — DIAGNÓSTICO

### 1. Handler Frontend

**Ubicación:** `public/js/master/master-alquimia-general-client.js` (línea 1352)

**Función:** `handleLimpiarEstudiante(student, item, cleanLayer = 'shared', tipo = 'recurrente')`

**Payload actual enviado:**
```javascript
{
  student_id: student.student_id,
  clean_layer: cleanLayer
}
```

**Campos faltantes:**
- `item_kind`: No se envía (el parámetro `tipo` existe pero no se incluye en el payload)
- `domain_type`: No se envía
- `actor_type`: No se envía (debería ser `'master'`)
- `surface_key`: No se envía (debería ser `'master.alquimia_general'`)

---

### 2. Endpoint Backend

**Ubicación:** `src/endpoints/master-api-alquimia-general.js` (línea 893)

**Ruta:** `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student`

**Llamada actual:**
```javascript
const state = await markCleanStudent(studentId, itemRef, productKey, cleanLayer);
```

**Problema:** `markCleanStudent` espera un objeto `options` con campos específicos, no parámetros posicionales.

---

### 3. Contrato Backend Real

**Ubicación:** `src/core/master/services/cleaning-engine-service.js` (función `markCleanStudent`)

**Firma esperada:**
```javascript
export async function markCleanStudent(options = {}, client = null)
```

**Campos requeridos en `options`:**
- `student_id` ✅ (recibido)
- `item_ref` ✅ (recibido vía URL)
- `product_key` ✅ (default 'pde')
- `domain_type` ❌ (falta, usa default 'transmutation')
- `clean_layer` ✅ (recibido)
- `actor_type` ❌ (falta, se intenta usar en línea 348 pero no está definido)
- `surface_key` ❌ (falta)
- `item_kind` ❌ (falta, se determina desde la lista pero se usa antes)

**Error específico (línea 348):**
```javascript
const itemKind = lista.tipo; // Se determina en línea 264
// ... más código ...
// Línea 348: Se intenta usar item_kind en syncToStudentItemState
await syncToStudentItemState({
  ...options,
  item_kind,  // ← ERROR: item_kind no está en options, usa variable local
  item_id: item.id
}, client);
```

---

### 4. Análisis del Error

**Stack trace:**
```
ReferenceError: item_kind is not defined
    at markCleanStudent (file:///.../cleaning-engine-service.js:348:9)
```

**Código problemático:**
```javascript
// Línea 264: Se determina item_kind localmente
const itemKind = lista.tipo;

// Línea 348: Se intenta usar item_kind en options
await syncToStudentItemState({
  ...options,
  item_kind,  // ← Variable local, pero se espera que esté en options
  item_id: item.id
}, client);
```

**Problema:** La variable `itemKind` es local, pero el código intenta usar `item_kind` (con guión bajo) que no existe.

---

## FASE 2 — SOLUCIÓN PROPUESTA

### 1. Fix Frontend: Enviar payload completo

**Modificar `handleLimpiarEstudiante()` para enviar:**
```javascript
{
  student_id: student.student_id,
  item_ref: item.item_ref,
  item_kind: tipo,  // 'recurrente' | 'una_vez'
  domain_type: 'transmutation',
  clean_layer: cleanLayer,
  actor_type: 'master',
  surface_key: 'master.alquimia_general'
}
```

### 2. Fix Backend: Usar item_kind correctamente

**Modificar endpoint para pasar objeto completo:**
```javascript
const state = await markCleanStudent({
  student_id: studentId,
  item_ref: itemRef,
  product_key: productKey,
  domain_type: 'transmutation',
  clean_layer: cleanLayer,
  actor_type: 'master',
  surface_key: 'master.alquimia_general',
  item_kind: body.item_kind  // Del payload
});
```

**Fix en `markCleanStudent`:**
- Si `options.item_kind` viene, usarlo directamente
- Si no, determinarlo desde la lista (como ahora)
- Usar la variable local `itemKind` correctamente en `syncToStudentItemState`

### 3. Blindaje Master: No validar nivel

**Modificar `markCleanStudent` para contexto Master:**
- Si `actor_type === 'master'` y `surface_key === 'master.alquimia_general'`, NO validar nivel del alumno
- NO bloquear por aplicabilidad (Master puede limpiar cualquier item a cualquier alumno)

---

## CONCLUSIONES

1. **Frontend:** No envía `item_kind` ni otros campos requeridos
2. **Backend:** Intenta usar `item_kind` que no existe en `options`
3. **Validación:** Master no debería estar sujeto a validación de nivel

---

**FIN DEL DIAGNÓSTICO**
