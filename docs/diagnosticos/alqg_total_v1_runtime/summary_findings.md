# 📊 SUMMARY FINDINGS - Auditoría Runtime READ-ONLY
## Alquimia General MASTER - Evidencia Ejecutada

**Fecha:** 2025-01-27  
**Versión:** 5.77.7 (package.json)  
**Modo:** READ-ONLY (0 edits, solo evidencia)

---

## 1) ESTADO DEL RUNTIME

### Versiones
- `package.json`: `5.77.7`
- `master/__version`: (vacío - endpoint no responde o requiere auth)
- `__version` root: (vacío - endpoint no responde o requiere auth)
- BUILD_STAMP: (pendiente capturar desde browser console)

### Scripts cargados en MASTER
- **PENDIENTE:** Verificar HTML de `/master/templo-luz/alquimia-general` para confirmar scripts cargados
- **VERIFICAR:** Que NO ejecuta `inject_main.js` en MASTER (requiere inspección HTML)

### Autenticación
- **Requests HTTP requieren autenticación:** Los curls a `/master/api/alquimia-general/*` retornan `{"ok":false,"error":"No autorizado"}` sin cookie válida
- **Nota:** Para auditoría completa en runtime, se requiere autenticación activa o inspección desde browser

---

## 2) EVIDENCIA BUG-001: state_by_view_layer faltante en respuesta GET

### Análisis de código (análisis estático)

**Endpoint:** `src/endpoints/master-api-alquimia-general.js` línea 612+
- GET `/master/api/alquimia-general/listas/:id/list-projection`
- Retorna: `{ data: { items: projection.items, ... } }` (línea 695-705)

**Servicio:** `src/core/master/services/list-projection-model.js`
- `computeListProjection()` línea 672+
- **Línea 738-879:** Calcula `itemsWithProjection` usando `computeCleaningProjection()`
- **Línea 879:** Asigna `state_by_view_layer` a cada item:
  ```javascript
  state_by_view_layer: projection.state_by_view_layer
  ```

**VERIFICACIÓN CÓDIGO:**
- ✅ Cada `item` en `itemsWithProjection` incluye `state_by_view_layer` (línea 879)
- ✅ `projection.state_by_view_layer` viene de `computeCleaningProjection()` (CPM v2)
- ✅ CPM v2 calcula `state_by_view_layer` para todas las view_layers (shared, pde, effective, combo)

**⚠️ HALLAZGO IMPORTANTE:**
- **Para scope='all':** Cada `item` tiene `state_by_view_layer` (proyección agregada por item)
- **Para scope='student':** Necesita verificar si cada `item` tiene también `state_by_view_layer` O si hay estructura diferente con `students` dentro de items

**PENDIENTE VERIFICACIÓN RUNTIME:**
- Ejecutar GET list-projection autenticado y verificar JSON real
- Confirmar estructura exacta de respuesta (¿items con state_by_view_layer? ¿o students dentro de items?)

### GET flotante students (endpoint alternativo)

**PENDIENTE:** Buscar endpoint GET `/master/api/alquimia-general/items/:item_ref/students` y verificar si incluye `state_by_view_layer` en cada student

### BUG-001 ESTADO:
- ✅ **ANÁLISIS CÓDIGO - list-projection (scope='all'):** `computeListProjection()` SÍ asigna `state_by_view_layer` a items (línea 879)
- ✅ **ANÁLISIS CÓDIGO - flotante (GET /items/:item_ref/students):** `getStudentsForItem()` SÍ asigna `state_by_view_layer` a cada student (línea 894)
- ⏳ **PENDIENTE:** Verificar JSON real en runtime con autenticación para confirmar que ambos endpoints devuelven correctamente
- ⚠️ **RIESGO POTENCIAL:** Si `view_layer` no se pasa correctamente en request, puede haber fallback que cause problemas

---

## 3) EVIDENCIA BUG-002: Refresh Engine fallback legacy cuando surfaces vacías

### Código identificado

**Archivo:** `src/core/ux/action-registry/alquimia-actions.js`
- **Función:** `buildRefreshPlan()` (líneas 44-73)
- **Retorna `[]` cuando:**
  ```javascript
  // Si view_mode NO es 'proyeccion'/'operativa' Y NO hay item_ref → surfaces = []
  if (view_mode === 'proyeccion' && list_id) { ... }
  if (view_mode === 'operativa' && list_id) { ... }
  if (context.item_ref) { ... }
  return surfaces;  // ← Puede ser []
  ```

**Archivo:** `public/js/master/master-alquimia-general-client.js`
- **Línea 6525:** Verifica `if (surfaces.length > 0 && window.__AP_REFRESH_SURFACE_REGISTRY__)`
- **Línea 6565:** Si `surfaces.length === 0` → cae a legacy:
  ```javascript
  console.warn('[REFRESH_ENGINE][ALQG][LEGACY_REFRESH] Sin surfaces declarativas, usando lógica manual');
  ```

**Condiciones para `surfaces = []`:**
1. `view_mode !== 'proyeccion'` Y `view_mode !== 'operativa'` Y `!context.item_ref`
2. `view_mode === 'proyeccion'` pero `!list_id`
3. `view_mode === 'operativa'` pero `!list_id`
4. `view_mode` es `undefined`/`null` y no hay `item_ref`

**EVIDENCIA:**
- ✅ Código confirma que `buildRefreshPlan()` puede retornar `[]`
- ✅ Refresh Engine v2 verifica `surfaces.length > 0` y cae a legacy si está vacío
- ⏳ **PENDIENTE:** Verificar logs runtime para confirmar cuando ocurre

### BUG-002 ESTADO:
- ✅ **CONFIRMADO EN CÓDIGO:** `buildRefreshPlan()` puede retornar `[]` → fallback legacy
- ⏳ **PENDIENTE:** Logs runtime para confirmar frecuencia y condiciones exactas

---

## 4) EVIDENCIA BUG-003: UI muestra éxito verde aunque applied=0

### Código identificado

**Archivo:** `public/js/master/master-alquimia-general-client.js`

**Línea 1642:** Reset lista (ITEM_STUDENT / LIST_STUDENT)
```javascript
showToastSuccess(`Reset completado (${resetResult.applied} items, ${resetResult.skipped} omitidos)`);
```
- **Condición:** Solo verifica `!error` en catch (línea 1645)
- **NO VERIFICA:** `applied > 0` antes de mostrar éxito

**Línea 1718:** Reset lista ALL
```javascript
const applied = result.data?.applied || 0;
showToastSuccess(`Reset lista ALL completado (${applied} aplicados, ${skipped} omitidos en ${totalItems} items)`);
```
- **Condición:** Solo verifica `result.ok` (línea 1703)
- **NO VERIFICA:** `applied > 0` antes de mostrar éxito
- **Impacto:** Si `applied=0`, mostrará "Reset lista ALL completado (0 aplicados, X omitidos en Y items)"

**Línea 4809:** Reset ALL (flotante)
```javascript
showToastSuccess(`Reset ALL completado (${applied} aplicados, ${skipped} omitidos de ${total} estudiantes)`);
```
- Similar: muestra éxito aunque `applied=0`

**Línea 4929:** Reset individual
```javascript
showToastSuccess(`Reset completado (${resetResult.applied} aplicado, ${resetResult.skipped} omitido)`);
```

**EVIDENCIA:**
- ✅ Código confirma: `showToastSuccess` se ejecuta sin verificar `applied > 0`
- ✅ Los mensajes incluyen `applied` en el texto, pero no hay validación condicional
- ⚠️ **IMPACTO:** Usuario ve "completado" aunque `applied=0` (idempotencia u otra razón)

### BUG-003 ESTADO:
- ✅ **CONFIRMADO EN CÓDIGO:** UI muestra éxito verde incluso si `applied=0`
- **Severidad:** MEDIA (funcional pero confuso para usuario)
- **Archivos afectados:** `master-alquimia-general-client.js:1642, 1718, 4809, 4929`

---

## 5) EVIDENCIA BUG-004: Fallback legacy student.state puede desincronizar

### Código identificado

**Archivo:** `public/js/master/master-alquimia-general-client.js`

**Líneas 2775-2808:** Renderizado de columnas (`renderListProjection`)
```javascript
// REGLA CANÓNICA: UI consume EXCLUSIVAMENTE state_by_view_layer[view_layer]
if (student.state_by_view_layer && student.state_by_view_layer[activeViewLayer]) {
  stateData = student.state_by_view_layer[activeViewLayer];
  columnState = stateData.state || 'never';
} else {
  // FALLBACK LEGACY
  console.error('[INVARIANT_BROKEN] Missing state_by_view_layer');
  if (student.state) {
    console.warn('[MasterAlquimiaGeneral] [UI][COLUMN] Usando fallback a student.state (CPM)');
    stateData = {
      state: student.state,
      visual_state: student.visual_state || student.state,
      metrics: {}
    };
    columnState = stateData.state;
  } else {
    // Alumno va a columna _error
    studentsByState._error.push(student);
  }
}
```

**EVIDENCIA:**
- ✅ Código confirma: Fallback a `student.state` si falta `state_by_view_layer`
- ⚠️ **RIESGO:** `student.state` puede no coincidir con `state_by_view_layer[view_layer].state` si:
  - Backend calculó `state` para una `view_layer` diferente
  - Hay cache desincronizado
  - CPM calculó diferente en diferentes momentos

**Columna _error:**
- **Línea 2907-2916:** Si hay `studentsByState._error`, se muestra columna especial con mensaje de error
- Solo se agrega si falta `state_by_view_layer` Y falta `student.state`

### BUG-004 ESTADO:
- ✅ **CONFIRMADO EN CÓDIGO:** Fallback legacy existe y puede desincronizar
- **Severidad:** MEDIA (depende de frecuencia de BUG-001)
- **Archivo:** `master-alquimia-general-client.js:2775-2808`

---

## 6) ROOT CAUSE OPERACIONAL (jerarquía de evidencia)

### Orden por severidad y evidencia:

**1. BUG-001 (CRÍTICO):** `state_by_view_layer` faltante en respuesta GET
- **Impacto:** UI no puede agrupar por columna correcta
- **Evidencia código:** `computeListProjection()` SÍ asigna `state_by_view_layer` (línea 879), pero necesita verificación runtime
- **Dependencias:** Si este falla, BUG-004 se activa automáticamente

**2. BUG-002 (ALTA):** Refresh Engine fallback legacy cuando surfaces vacías
- **Impacto:** Refresh puede no ejecutarse o ejecutarse incorrectamente
- **Evidencia código:** Confirmado que `buildRefreshPlan()` puede retornar `[]`
- **Dependencias:** Puede causar que cambios no se reflejen en UI (acumula con BUG-001)

**3. BUG-003 (MEDIA):** UI muestra éxito verde aunque `applied=0`
- **Impacto:** Confusión del usuario (piensa que se aplicó cuando no)
- **Evidencia código:** Confirmado en múltiples lugares (líneas 1642, 1718, 4809, 4929)

**4. BUG-004 (MEDIA):** Fallback legacy `student.state` puede desincronizar
- **Impacto:** Alumno aparece en columna incorrecta
- **Evidencia código:** Confirmado fallback en líneas 2775-2808
- **Dependencias:** Solo se activa si BUG-001 ocurre

---

## 7) ARCHIVOS + LÍNEAS EXACTAS

### BUG-001
- **Backend list-projection:** `src/core/master/services/list-projection-model.js:879` (asignación `state_by_view_layer` a items)
- **Backend flotante:** `src/services/alquimia-general-service.js:894` (asignación `state_by_view_layer` a students)
- **Endpoint list-projection:** `src/endpoints/master-api-alquimia-general.js:695-705` (respuesta JSON)
- **Endpoint flotante:** `src/endpoints/master-api-alquimia-general.js:1080` (retorna `result.students` con `state_by_view_layer`)
- ✅ **CÓDIGO CONFIRMA:** Ambos endpoints SÍ incluyen `state_by_view_layer` en sus respuestas
- ⏳ **PENDIENTE:** Verificar JSON real en runtime (requiere autenticación)

### BUG-002
- **buildRefreshPlan:** `src/core/ux/action-registry/alquimia-actions.js:44-73`
- **Condición surfaces vacías:** `alquimia-actions.js:44-73` (puede retornar `[]`)
- **Log LEGACY_REFRESH:** `public/js/master/master-alquimia-general-client.js:6565`
- **Verificación:** `master-alquimia-general-client.js:6525` (`if (surfaces.length > 0 && ...)`)

### BUG-003
- **Reset lista:** `master-alquimia-general-client.js:1642`
- **Reset lista ALL:** `master-alquimia-general-client.js:1718`
- **Reset ALL (flotante):** `master-alquimia-general-client.js:4809`
- **Reset individual:** `master-alquimia-general-client.js:4929`

### BUG-004
- **Fallback legacy:** `master-alquimia-general-client.js:2775-2808`
- **Columna _error:** `master-alquimia-general-client.js:2907-2916`

---

## 8) REQUESTS CORRELADOS CON TRACE_ID

**NOTA:** Requests HTTP requieren autenticación. Para auditoría completa en runtime, se necesita:
- Cookie de sesión válida
- O inspección desde browser con DevTools Network

**PENDIENTE:**
- Ejecutar GET list-projection con autenticación
- Ejecutar POST reset/clean/override-reset y capturar trace_id
- Correlacionar logs PM2 con trace_id

---

## 9) LOGS PM2 GUARDADOS

**PENDIENTE:** Para cada acción con trace_id:
- `logs/pm2_grep_<trace_id>.log`

**Comandos forenses:**
```bash
pm2 logs aurelinportal --lines 600 | grep -E "trace_id|ux_action|ALQG|SURFACES|LEGACY_REFRESH|list-projection|RESET|CLEAN|OVERRIDE|INVARIANT_BROKEN" > logs/pm2_grep_<ID>.log
```

---

## 10) EVIDENCIA DB

### Script forense existente
- **Archivo:** `scripts/diagnostico-reset-clean-forense.js`
- **PENDIENTE:** Ejecutar con `node scripts/diagnostico-reset-clean-forense.js 44a51f8f-4ed5-4291-ad13-5f07a99c636b te_item_63`

### Queries directas (solo lectura)
**PENDIENTE:** Ejecutar y guardar en `db_dumps/`:
- Estado actual `cleaning_item_state` para student+item
- Último RESET y CLEAN (shared/pde)
- Overrides en `student_item_overrides`

---

## 11) CONCLUSIÓN EJECUTIVA

### Evidencia confirmada (código estático):
- ✅ **BUG-002:** CONFIRMADO - `buildRefreshPlan()` puede retornar `[]` → fallback legacy
- ✅ **BUG-003:** CONFIRMADO - UI muestra éxito sin verificar `applied > 0`
- ✅ **BUG-004:** CONFIRMADO - Fallback legacy existe y puede desincronizar

### Evidencia pendiente (runtime con autenticación):
- ⏳ **BUG-001:** PENDIENTE - Verificar JSON real de GET list-projection (requiere auth)
- ⏳ **BUG-002:** PENDIENTE - Logs runtime para confirmar frecuencia
- ⏳ **DB:** PENDIENTE - Ejecutar queries forenses y script diagnóstico

### Prioridad de verificación:
1. **BUG-001** (CRÍTICO): Verificar JSON real de respuesta GET list-projection
2. **BUG-002:** Confirmar logs runtime de LEGACY_REFRESH
3. **DB:** Ejecutar script forense y queries directas

---

**NOTA:** Auditoría READ-ONLY completada en análisis estático. Para evidencia completa de runtime, se requiere autenticación activa o inspección desde browser.
