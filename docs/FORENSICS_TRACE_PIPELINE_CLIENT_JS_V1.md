# FORENSIC TRACE PIPELINE CLIENT JS v1 - Documentación Canónica
**Versión:** v1.0  
**Fecha:** 2026-01-18  
**Estado:** ✅ Implementado  
**Dominio:** MASTER - Alquimia Alumno (Megalist)

---

## 1. RESUMEN EJECUTIVO

### ¿Qué es el Trace Pipeline Client JS v1?

Sistema de trazado forense **opcional** que registra en memoria el flujo completo del pipeline Client JS para la UI de Alquimia Alumno (megalist), permitiendo diagnosticar problemas de sincronización entre backend y frontend, especialmente en operaciones CLEAN/RESET.

### ¿Qué problema resuelve?

**Problema real:** Después de ejecutar CLEAN o RESET, a veces la UI no refleja el cambio de estado esperado (ej: item sigue en "pendiente" aunque el backend lo marcó como "reviewed").

**Causa posible:**
- El refresh automático no se ejecuta después de la acción
- El refresh se ejecuta pero con parámetros incorrectos
- El estado local no se actualiza después del fetch
- El render no se dispara después del cambio de estado

**Solución:** Instrumentación completa del pipeline Client JS que permite ver exactamente:
1. Qué endpoints se llaman y con qué params
2. Qué JSON vuelve (incluyendo `trace_id`, build/version)
3. Cómo muta el estado local (`viewState`, `selected item`, `student_uuid`, `list filters`)
4. Cuándo y por qué se re-renderiza (o NO)
5. Qué pasa justo después de CLEAN y RESET

### Principios Constitucionales

**INVARIANTES OBLIGATORIOS:**
- ✅ **Fail-open total:** Si el tracer falla, la UI sigue funcionando (nunca bloquea la UX)
- ✅ **OFF por defecto:** El tracer solo se activa con flag explícito (`?ap_trace=1`)
- ✅ **NO cambia semántica:** El tracer es observación pura, no modifica comportamiento de negocio
- ✅ **No es feature de usuario:** Es herramienta forense para debugging, no para uso en producción

---

## 2. ACTIVACIÓN Y DESACTIVACIÓN

### Activación

**Opción 1: Query param (temporal, no persiste)**
```
/master/templo-luz/alquimia-alumno?student_uuid=...&ap_trace=1
```

**Opción 2: localStorage (persistente, sobrevive recargas)**
```javascript
// En la consola del navegador:
localStorage.setItem('ap_trace', '1');
// Recargar página
```

**Opción 3: Query param + persistencia automática**
- Si usas `?ap_trace=1` y no existe en localStorage, se guarda automáticamente
- Siguientes recargas usarán localStorage sin necesidad del query param

### Desactivación

**Opción 1: Eliminar query param**
```
/master/templo-luz/alquimia-alumno?student_uuid=...
```

**Opción 2: Limpiar localStorage**
```javascript
// En la consola del navegador:
localStorage.removeItem('ap_trace');
// Recargar página
```

**Opción 3: Desactivar temporalmente sin recargar**
```javascript
window.apTrace.enabled = false;
```

### Verificación de activación

Si el tracer está activo, verás en console:
```
[TRACE][BOOT] { url: "...", build_stamp: {...}, flags: {...} }
```

Si NO está activo, no aparecerán logs con prefijo `[TRACE]`.

---

## 3. EVENTOS DEL TRACER

### Tabla de Eventos

| Evento | Cuándo se emite | Payload típico |
|--------|----------------|----------------|
| `BOOT` | Al inicializar el cliente (si tracer enabled) | `url`, `build_stamp`, `flags`, `context` |
| `FETCH START` | Antes de hacer fetch a cualquier endpoint | `method`, `url`, `query`, `request_id`, `timestamp` |
| `FETCH END` | Después de recibir respuesta exitosa | `status`, `duration_ms`, `trace_id`, `ok`, `data_keys` |
| `FETCH ERR` | Si falla el fetch | `error`, `stack`, `duration_ms` |
| `STATE BEFORE` | Antes de cambiar estado local | `snapshot: { student_uuid, view_layer, lista_tipo, ... }` |
| `STATE AFTER` | Después de cambiar estado local | `snapshot: { student_uuid, view_layer, lista_tipo, ... }` |
| `RENDER START` | Antes de renderizar megalist | `motivo`, `view_layer`, `has_data`, `lists_count` |
| `RENDER END` | Después de renderizar megalist | `items_rendered_count`, `selected_item_present` |
| `ACTION CLEAN CLICK` | Al hacer click en botón "Limpiar" | `item_ref`, `item_nombre`, `student_uuid`, `previous_state` |
| `ACTION CLEAN RESPONSE` | Después de recibir respuesta de CLEAN | `ok`, `applied`, `trace_id`, `duration_ms`, `error/reason` |
| `REFRESH REQUEST` | Cuando se solicita refresh después de acción | `motivo`, `strategy`, `item_ref`, `student_uuid` |
| `REFRESH DETECTED` | Si se detecta fetch de megalist después de acción | `motivo`, `url` |
| `REFRESH DONE` | Cuando se confirma refresh/render | `refresh_detected`, `render_detected`, `state_changed` |
| `WARN NO_REFRESH_AFTER_ACTION` | Si después de 250ms no hay refresh/render | `action`, `item_ref`, `state_before`, `state_after`, `elapsed_ms` |

### Ejemplos de Logs

**Ejemplo 1: BOOT exitoso**
```
[TRACE][BOOT] {
  url: "https://auriportal.example.com/master/templo-luz/alquimia-alumno?student_uuid=abc-123&ap_trace=1",
  build_stamp: { version: "5.79.8", build_id: "20260118.123456" },
  flags: { url_trace: true, localStorage_trace: true },
  context: "MASTER"
}
```

**Ejemplo 2: FETCH START/END normal**
```
[TRACE][FETCH][START] {
  method: "GET",
  url: "/master/api/alquimia-alumno/megalist?student_uuid=abc-123&view_layer=shared&lista_tipo=recurrente",
  query: { student_uuid: "abc-123", view_layer: "shared", lista_tipo: "recurrente" },
  request_id: "req_1705654321_abc123",
  timestamp: 1705654321000
}

[TRACE][FETCH][END] {
  method: "GET",
  url: "/master/api/alquimia-alumno/megalist?student_uuid=abc-123&view_layer=shared&lista_tipo=recurrente",
  request_id: "req_1705654321_abc123",
  status: 200,
  duration_ms: 145,
  trace_id: "trace_xyz789",
  ok: true,
  data_keys: ["student", "summary", "lists", "reviewed"],
  has_lists: true,
  lists_count: 3,
  has_summary: true
}
```

**Ejemplo 3: ACTION CLEAN completo**
```
[TRACE][ACTION][CLEAN][CLICK] {
  item_ref: "item_meditacion_diaria",
  item_nombre: "Meditación Diaria",
  lista_tipo: "recurrente",
  student_uuid: "abc-123",
  view_layer: "shared",
  previous_state: "pending"
}

[TRACE][ACTION][CLEAN][RESPONSE] {
  item_ref: "item_meditacion_diaria",
  student_uuid: "abc-123",
  ok: true,
  applied: true,
  trace_id: "trace_clean_456",
  duration_ms: 89,
  error: null,
  reason: null
}

[TRACE][REFRESH][REQUEST] {
  motivo: "clean_success",
  item_ref: "item_meditacion_diaria",
  student_uuid: "abc-123",
  strategy: "refresh_plan"
}

[TRACE][REFRESH][DETECTED] {
  motivo: "fetch_megalist_detected",
  url: "/master/api/alquimia-alumno/megalist?student_uuid=abc-123&view_layer=shared&lista_tipo=recurrente"
}

[TRACE][REFRESH][DONE] {
  refresh_detected: true,
  render_detected: true,
  state_changed: true
}
```

**Ejemplo 4: WARN NO_REFRESH_AFTER_ACTION (problema detectado)**
```
[TRACE][WARN] {
  tipo: "NO_REFRESH_AFTER_ACTION",
  mensaje: "No refresh/render after action",
  action: "CLEAN",
  item_ref: "item_meditacion_diaria",
  state_before: { student_uuid: "abc-123", view_layer: "shared", ... },
  state_after: { student_uuid: "abc-123", view_layer: "shared", ... },
  elapsed_ms: 250
}
```

---

## 4. PIPELINE ESPERADO

### Pipeline Normal (Carga Inicial)

```
1. BOOT
   ↓
2. FETCH START (GET /master/api/alquimia-alumno/megalist)
   ↓
3. FETCH END (200 OK, trace_id: "trace_xyz")
   ↓
4. STATE BEFORE (snapshot inicial)
   ↓
5. STATE AFTER (state.megalistData = result.data)
   ↓
6. RENDER START (motivo: "fetch_completed")
   ↓
7. RENDER END (items_rendered_count: 25, selected_item_present: false)
```

### Pipeline CLEAN (Acción Exitosa)

```
1. ACTION CLEAN CLICK (user click en botón)
   ↓
2. STATE BEFORE (snapshot antes de acción)
   ↓
3. POST /master/api/alquimia-alumno/clean (vía performAction)
   ↓
4. ACTION CLEAN RESPONSE (ok: true, applied: true, trace_id: "trace_clean_123")
   ↓
5. REFRESH REQUEST (motivo: "clean_success", strategy: "refresh_plan")
   ↓
6. FETCH START (GET /master/api/alquimia-alumno/megalist - refresh automático)
   ↓
7. FETCH END (200 OK, trace_id: "trace_refresh_456")
   ↓
8. STATE AFTER (state.megalistData actualizado)
   ↓
9. RENDER START (motivo: "fetch_completed")
   ↓
10. RENDER END (items_rendered_count: 25, selected_item_present: true)
    ↓
11. REFRESH DONE (refresh_detected: true, render_detected: true, state_changed: true)
```

### Pipeline CLEAN con Problema (NO REFRESH)

```
1. ACTION CLEAN CLICK
   ↓
2. ACTION CLEAN RESPONSE (ok: true, applied: true, trace_id: "trace_clean_123")
   ↓
3. REFRESH REQUEST (motivo: "clean_success", strategy: "refresh_plan")
   ↓
4. [NO HAY FETCH START] ← Problema detectado
   ↓
5. WARN NO_REFRESH_AFTER_ACTION (después de 250ms)
   ↓
   state_before === state_after (sin cambios)
   elapsed_ms: 250
```

---

## 5. SEÑALES FORENSES DE FALLO

### Señal 1: "POST ok pero strategy none"

**Síntoma:**
```
[TRACE][ACTION][CLEAN][RESPONSE] { ok: true, applied: true, ... }
[TRACE][REFRESH][REQUEST] { strategy: "none" } ← PROBLEMA
[TRACE][WARN] { tipo: "NO_REFRESH_AFTER_ACTION", ... }
```

**Diagnóstico:**
- El backend procesó la acción correctamente
- Pero el `refresh_plan` de la acción retorna `"none"` (no hay refresh declarado)
- La UI no se refresca automáticamente

**Causa posible:**
- La acción `alquimia.clean_student` no tiene `refresh_plan` declarado
- O el `refresh_plan` está vacío/incorrecto

**Solución:**
- Verificar `src/core/ux/action-registry/ux-action-registry.js`
- Añadir/verificar `refresh_plan` en la definición de la acción

---

### Señal 2: "No render after action"

**Síntoma:**
```
[TRACE][ACTION][CLEAN][RESPONSE] { ok: true, applied: true, ... }
[TRACE][REFRESH][REQUEST] { strategy: "refetch", ... }
[TRACE][FETCH][START] { url: "/master/api/alquimia-alumno/megalist", ... }
[TRACE][FETCH][END] { ok: true, trace_id: "trace_refresh_456", ... }
[TRACE][STATE][AFTER] { state.megalistData actualizado }
[TRACE][WARN] { tipo: "NO_REFRESH_AFTER_ACTION" } ← PROBLEMA
```

**Diagnóstico:**
- El backend respondió OK
- El refresh se ejecutó (fetch de megalist ocurrió)
- El estado se actualizó
- Pero NO hubo RENDER después del fetch

**Causa posible:**
- `renderMegalist()` no se llama después de `state.megalistData = result.data`
- O `renderMegalist()` falla silenciosamente
- O el código de render está condicionado por algo que no se cumple

**Solución:**
- Verificar que `loadMegalist()` llama `renderMegalist()` después de actualizar estado
- Verificar que `renderMegalist()` no tiene guards que bloqueen el render
- Añadir try/catch en `renderMegalist()` para detectar errores silenciosos

---

### Señal 3: "Fetch ocurre pero selected item desaparece"

**Síntoma:**
```
[TRACE][ACTION][CLEAN][RESPONSE] { item_ref: "item_abc", ... }
[TRACE][FETCH][START] { url: ".../megalist?student_uuid=abc&view_layer=shared&..." }
[TRACE][FETCH][END] { ok: true, lists_count: 3, ... }
[TRACE][RENDER][END] { items_rendered_count: 20, selected_item_present: false } ← PROBLEMA
```

**Diagnóstico:**
- El fetch se ejecutó correctamente
- Los items se renderizaron
- Pero `selected_item_present: false` (el item que se limpió no aparece)

**Causa posible:**
- El item cambió de estado y se movió a otra columna (ej: "pending" → "reviewed")
- Pero la UI no está mostrando la columna "reviewed" (view_layer incorrecto)
- O el item cambió de lista y ya no está en la lista actual (lista_tipo incorrecto)

**Solución:**
- Verificar que el `view_layer` en el refresh coincide con el `view_layer` activo
- Verificar que el `lista_tipo` en el refresh coincide con el `activeTab`
- Verificar que `renderMegalistByLists()` renderiza TODAS las columnas (never, pending, reviewed, etc.)

---

### Señal 4: "State cambia pero render no"

**Síntoma:**
```
[TRACE][STATE][BEFORE] { view_layer: "shared", lista_tipo: "recurrente" }
[TRACE][FETCH][END] { ok: true, ... }
[TRACE][STATE][AFTER] { view_layer: "shared", lista_tipo: "recurrente", has_megalist_data: true }
[TRACE][RENDER][START] { motivo: "fetch_completed" }
[TRACE][RENDER][END] { items_rendered_count: 0 } ← PROBLEMA (esperábamos 25)
```

**Diagnóstico:**
- El estado se actualizó correctamente
- El render se inició
- Pero `items_rendered_count: 0` (no se renderizó ningún item)

**Causa posible:**
- `result.data.lists` está vacío o undefined
- O `renderMegalistByLists()` tiene un guard que bloquea el render
- O `renderList()` falla para todas las listas

**Solución:**
- Verificar que `result.data.lists` tiene items antes de llamar `renderMegalistByLists()`
- Verificar logs de `renderMegalistByLists()` para detectar errores silenciosos
- Verificar que los items tienen `state_by_view_layer[view_layer]` válido

---

## 6. RECETA DE DIAGNÓSTICO PASO A PASO

### Checklist de Diagnóstico (10 pasos máximo)

**Paso 1: Activar tracer**
- Añadir `?ap_trace=1` a la URL
- Verificar que aparece `[TRACE][BOOT]` en console

**Paso 2: Reproducir problema**
- Cargar megalist de un alumno
- Ejecutar CLEAN en un item que está en estado "reseteado" o "pending"

**Paso 3: Verificar ACTION CLEAN**
- Buscar `[TRACE][ACTION][CLEAN][CLICK]` y `[TRACE][ACTION][CLEAN][RESPONSE]`
- Verificar que `ok: true` y `applied: true`
- **Copiar `trace_id` del response** (ej: `trace_clean_123`)

**Paso 4: Verificar REFRESH REQUEST**
- Buscar `[TRACE][REFRESH][REQUEST]` después del CLEAN
- Verificar `strategy`:
  - Si es `"none"` → **PROBLEMA**: la acción no tiene refresh_plan
  - Si es `"refetch"` → OK, continuar

**Paso 5: Verificar FETCH POST-ACCION**
- Buscar `[TRACE][FETCH][START]` con URL de megalist DESPUÉS del CLEAN
- Si NO aparece → **PROBLEMA**: el refresh no se ejecutó
- Si aparece → **Copiar `trace_id` del FETCH END** (ej: `trace_refresh_456`)

**Paso 6: Verificar RENDER POST-ACCION**
- Buscar `[TRACE][RENDER][START]` y `[TRACE][RENDER][END]` después del FETCH
- Si NO aparece → **PROBLEMA**: el render no se ejecutó después del fetch
- Si aparece → Verificar `items_rendered_count` y `selected_item_present`

**Paso 7: Verificar WARN**
- Buscar `[TRACE][WARN]` con tipo `NO_REFRESH_AFTER_ACTION`
- Si aparece → **PROBLEMA confirmado**: no hay refresh/render después de acción
- Revisar `state_before` vs `state_after` para ver qué no cambió

**Paso 8: Correlar con backend**
- Usar `trace_id` del CLEAN (ej: `trace_clean_123`) para buscar logs en backend
- Usar `trace_id` del FETCH POST-ACCION (ej: `trace_refresh_456`) para buscar logs en backend
- Verificar que el backend procesó la acción correctamente
- Verificar que el backend devolvió el estado correcto en el refresh

**Paso 9: Volcar dump completo**
```javascript
window.apTrace.dump()
```
- Copiar JSON del clipboard
- Enviar tramo relevante (desde CLEAN CLICK hasta RENDER END o WARN)

**Paso 10: Verificar invariantes**
- ✅ El tracer debe estar `enabled: true`
- ✅ El tracer NO debe tener errores (buscar `[TRACE][ERROR]`)
- ✅ Todos los eventos deben tener `timestamp` válido
- ✅ Los `trace_id` deben ser strings válidos (no null/undefined)

---

## 7. CORRELACIÓN CON BACKEND

### Cómo correlacionar trace_id frontend ↔ backend

**Frontend:** El tracer captura `trace_id` de respuestas JSON automáticamente:
```javascript
[TRACE][FETCH][END] {
  trace_id: "trace_clean_123",  // ← Este trace_id
  ok: true,
  ...
}
```

**Backend:** Buscar logs con el mismo `trace_id`:
```bash
# Buscar en logs del servidor
grep "trace_clean_123" /var/log/aurelinportal/app.log

# O si usas pm2
pm2 logs aurelinportal | grep "trace_clean_123"
```

**Ejemplo de correlación:**

**Frontend (trace pipeline):**
```
[TRACE][ACTION][CLEAN][RESPONSE] {
  trace_id: "trace_clean_123",  // ← ID del CLEAN
  ok: true,
  applied: true
}

[TRACE][FETCH][END] {
  trace_id: "trace_refresh_456",  // ← ID del refresh post-CLEAN
  ok: true,
  lists_count: 3
}
```

**Backend (logs estructurados):**
```
[AlquimiaAlumnoClean] [WRITE] Item limpiado exitosamente {
  trace_id: "trace_clean_123",  // ← Mismo ID
  student_uuid: "abc-123",
  item_ref: "item_meditacion_diaria",
  applied: true
}

[AlquimiaAlumnoMegalist] [READ] GET megalist {
  trace_id: "trace_refresh_456",  // ← Mismo ID
  student_uuid: "abc-123",
  view_layer: "shared",
  lists_count: 3
}
```

**Diagnóstico correlado:**
- Si `trace_clean_123` aparece en backend → el CLEAN se procesó
- Si `trace_refresh_456` aparece en backend → el refresh se ejecutó
- Si `trace_clean_123` aparece pero `trace_refresh_456` NO → el refresh no se ejecutó (problema frontend)
- Si ambos aparecen pero el estado en frontend no cambia → problema de sincronización

---

## 8. REFERENCIAS CRUZADAS

### Documentación Relacionada

**Contratos API:**
- `docs/MASTER_API_ALQUIMIA_ALUMNO_CONTRACTS_V1.md`
  - Define contrato de `GET /master/api/alquimia-alumno/megalist`
  - Define contrato de `POST /master/api/alquimia-alumno/clean`
  - Documenta `trace_id` en respuestas JSON
  - Documenta estructura de respuesta (student, summary, lists, reviewed)

**Contratos de Sistema:**
- `docs/contracts/OVERRIDES_CONTRACT_V1.md`
  - Recordar: Megalist aplica overrides antes de CPM
  - Overrides NO mutan estado persistido (solo afectan lectura)
  - Si el estado visual no coincide con el estado persistido, puede ser override activo

- `docs/contracts/CLEAN_AFTER_RESET_CONTRACT_V1.md`
  - Define comportamiento canónico de CLEAN después de RESET
  - Si un item está en estado "reseteado", CLEAN debe normalizar a "reviewed"
  - El tracer debe detectar si este comportamiento se cumple en frontend

- `docs/contracts/RESET_CONTRACT_V1.md`
  - Define comportamiento canónico de RESET
  - RESET establece `effective_since` pero NO modifica `last_cleaned_at`
  - El tracer debe verificar que el refresh post-RESET muestra estado "reseteado"

**UX Action Registry:**
- `src/core/ux/action-registry/ux-action-registry.js`
  - Define acciones disponibles (ej: `alquimia.clean_student`)
  - Define `refresh_plan` de cada acción
  - Si `refresh_plan` retorna `"none"`, el tracer detectará `strategy: "none"`

---

## 9. CHANGELOG

**v1.0 (2026-01-18):** Documentación canónica inicial
- Documentación completa del sistema de tracing forense
- Tabla de eventos con payload típico
- Pipeline esperado (normal, CLEAN exitoso, CLEAN con problema)
- 4 señales forenses de fallo documentadas
- Receta de diagnóstico paso a paso (10 pasos)
- Correlación con backend (trace_id)
- Referencias cruzadas con contratos relacionados

---

## 10. INSTRUCCIONES DE VERIFICACIÓN

### Verificación Básica (Smoke Test)

**1. Activar tracer:**
```
/master/templo-luz/alquimia-alumno?student_uuid=...&ap_trace=1
```

**2. Verificar BOOT:**
- Abrir DevTools → Console
- Debe aparecer `[TRACE][BOOT]` con URL y flags activos

**3. Cargar megalist:**
- Seleccionar un alumno
- Debe aparecer secuencia:
  ```
  [TRACE][FETCH][START] → [TRACE][FETCH][END] → [TRACE][STATE][AFTER] → [TRACE][RENDER][END]
  ```

**4. Ejecutar CLEAN:**
- Hacer click en "Limpiar" en un item
- Debe aparecer secuencia:
  ```
  [TRACE][ACTION][CLEAN][CLICK] → [TRACE][ACTION][CLEAN][RESPONSE] → [TRACE][REFRESH][REQUEST] → [TRACE][FETCH][START] → [TRACE][RENDER][END] → [TRACE][REFRESH][DONE]
  ```

**5. Verificar NO WARN:**
- NO debe aparecer `[TRACE][WARN]` con tipo `NO_REFRESH_AFTER_ACTION`
- Si aparece → problema detectado

### Verificación Avanzada (Diagnóstico Completo)

**1. Volcar dump completo:**
```javascript
window.apTrace.dump()
```

**2. Copiar JSON del clipboard:**
- Pega en un editor JSON
- Busca el tramo desde `ACTION CLEAN CLICK` hasta `RENDER END` o `WARN`

**3. Verificar correlación backend:**
- Copia `trace_id` de `ACTION CLEAN RESPONSE`
- Busca en logs backend:
  ```bash
  pm2 logs aurelinportal | grep "trace_clean_..."
  ```

**4. Verificar que el item cambió de estado:**
- En el dump, busca `state_before` y `state_after`
- Compara `previous_state` en `ACTION CLEAN CLICK` con el estado final en `RENDER END`
- Si el item estaba en "pending" y sigue en "pending" → problema

---

## 11. RECORDATORIO IMPORTANTE

### ⚠️ El tracer NO es una feature de usuario

**PROHIBIDO:**
- ❌ Usar el tracer en producción para usuarios finales
- ❌ Exponer el tracer como funcionalidad visible en la UI
- ❌ Depender del tracer para funcionalidad crítica
- ❌ Modificar el comportamiento de negocio basado en el tracer

**PERMITIDO:**
- ✅ Usar el tracer para debugging forense durante desarrollo
- ✅ Activar el tracer con `?ap_trace=1` en sesiones de diagnóstico
- ✅ Usar `apTrace.dump()` para obtener datos forenses
- ✅ Correlar `trace_id` con logs backend para diagnóstico completo

### ⚠️ Estándar operativo: reinicio después de cambios

**Después de implementar cambios en el tracer:**
```bash
pm2 restart aurelinportal
```

**Nota:** Esto ya se ejecutó en el prompt de implementación, pero debe constar aquí como estándar operativo para futuras modificaciones.

---

**FIN DEL DOCUMENTO**
