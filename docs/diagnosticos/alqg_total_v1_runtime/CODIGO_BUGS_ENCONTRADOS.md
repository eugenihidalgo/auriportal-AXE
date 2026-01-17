# 🔍 EVIDENCIA DE CÓDIGO - Bugs Identificados (Sin Editar)

**Fecha:** 2025-01-27  
**Modo:** READ-ONLY (análisis estático de código)

---

## BUG-001: state_by_view_layer faltante en respuesta GET

### Código backend que DEBE incluir state_by_view_layer

**Archivo:** `src/core/master/services/list-projection-model.js`
- Función: `computeListProjection()` (línea 672+)
- **Línea 879:** ✅ Asigna `state_by_view_layer: projection.state_by_view_layer` a cada item
- **Línea 803-808:** Llama a `computeCleaningProjection()` que calcula `state_by_view_layer` completo

**Endpoint GET list-projection:** `src/endpoints/master-api-alquimia-general.js` línea 612+
- GET `/master/api/alquimia-general/listas/:id/list-projection`
- **Línea 695-705:** Retorna `{ data: { items: projection.items, ... } }`
- **Cada item en `projection.items`** incluye `state_by_view_layer` (asignado en línea 879)

**Servicio GET flotante:** `src/services/alquimia-general-service.js`
- Función: `getStudentsForItem()` (línea 541+)
- **Línea 804-830 (RECURRENTE):** Calcula `stateByViewLayer` con shared, pde, effective
- **Línea 990-1015 (UNA_VEZ):** Calcula `stateByViewLayer` con shared, pde, combo
- **Línea 894:** ✅ Asigna `state_by_view_layer: stateByViewLayer` a cada student
- **Línea 1026 (UNA_VEZ):** ✅ Asigna `state_by_view_layer: stateByViewLayer` a cada student

**Endpoint GET flotante:** `src/endpoints/master-api-alquimia-general.js` línea 922+
- GET `/master/api/alquimia-general/items/:item_ref/students`
- **Línea 1080:** Retorna `result.students` (cada student tiene `state_by_view_layer` asignado en línea 894/1026)

### Verificación código (ANÁLISIS ESTÁTICO):
- ✅ `computeListProjection()` SÍ asigna `state_by_view_layer` a items (línea 879)
- ✅ `getStudentsForItem()` SÍ asigna `state_by_view_layer` a students (líneas 894, 1026)
- ✅ Ambos usan `computeVisualState()` / `computeCleaningProjection()` de CPM v2

### Verificación necesaria en runtime:
- ⏳ Ejecutar GET list-projection con autenticación y verificar JSON real
- ⏳ Ejecutar GET flotante con autenticación y verificar JSON real
- ⏳ Confirmar que `state_by_view_layer` está presente en respuesta real (no solo en código)

---

## BUG-002: Refresh Engine fallback legacy cuando surfaces vacías

### Código identificado

**Archivo:** `public/js/master/master-alquimia-general-client.js`
- **Línea 6565:** Log `[REFRESH_ENGINE][ALQG][LEGACY_REFRESH]`
- **Condición:** `surfaces.length === 0` (línea 6525: `if (surfaces.length > 0 && window.__AP_REFRESH_SURFACE_REGISTRY__)`)
- **Fallback:** Lógica manual desde línea 6564+

**Archivo:** `src/core/ux/action-registry/alquimia-actions.js`
- **Función:** `buildRefreshPlan()` (líneas 44-73)
- **Retorna array vacío cuando:**
  - `view_mode !== 'proyeccion'` Y `view_mode !== 'operativa'` Y `!context.item_ref`
  - O si `view_mode === 'proyeccion'` pero `!list_id`
  - O si `view_mode === 'operativa'` pero `!list_id`

**Líneas exactas:**
```javascript
// alquimia-actions.js:44-73
function buildRefreshPlan(context, uiState, responseData = null) {
  const surfaces = [];
  const view_mode = uiState.view_mode || 'operativa';
  const list_id = uiState.list_id || context.list_id;

  // Proyección: siempre refrescar si hay list_id
  if (view_mode === 'proyeccion' && list_id) {
    surfaces.push('alquimia.list_projection');
  }

  // Items: siempre refrescar si hay list_id y modo operativa
  if (view_mode === 'operativa' && list_id) {
    surfaces.push('alquimia.items');
  }

  // Flotante: SIEMPRE refrescar si hay item_ref
  if (context.item_ref) {
    surfaces.push('alquimia.flotante_students');
  }

  return surfaces;  // ← Puede retornar [] si ninguna condición se cumple
}
```

**EVIDENCIA:**
- Si `view_mode` es undefined/null y no hay `item_ref` → `surfaces = []`
- Si `list_id` es null y no hay `item_ref` → `surfaces = []`
- Refresh Engine v2 (línea 6525) verifica `surfaces.length > 0` → cae a legacy (línea 6565)

---

## BUG-003: UI muestra éxito verde aunque applied=0

### Código identificado

**Archivo:** `public/js/master/master-alquimia-general-client.js`

**Línea 1642:** Reset lista (ITEM_STUDENT / LIST_STUDENT)
```javascript
showToastSuccess(`Reset completado (${resetResult.applied} items, ${resetResult.skipped} omitidos)`);
```
- **CONDICIÓN:** Solo verifica `!error` en catch (línea 1645)
- **NO VERIFICA:** `applied > 0` antes de mostrar éxito

**Línea 1718:** Reset lista ALL
```javascript
const applied = result.data?.applied || 0;
const skipped = result.data?.skipped || 0;
const totalItems = result.data?.total_items || 0;

showToastSuccess(`Reset lista ALL completado (${applied} aplicados, ${skipped} omitidos en ${totalItems} items)`);
```
- **CONDICIÓN:** Solo verifica `result.ok` (línea 1703)
- **NO VERIFICA:** `applied > 0` antes de mostrar éxito
- Si `applied=0`, mostrará: "Reset lista ALL completado (0 aplicados, X omitidos en Y items)"

**Línea 3862:** Clean individual
```javascript
showToastSuccess(`✓ ${displayName} limpiado`);
```
- **CONDICIÓN:** Solo verifica que no haya error
- **NO VERIFICA:** applied/response.ok del backend

**Línea 4809:** Reset ALL (flotante)
```javascript
showToastSuccess(`Reset ALL completado (${applied} aplicados, ${skipped} omitidos de ${total} estudiantes)`);
```
- Similar: muestra éxito aunque `applied=0`

### Conclusión BUG-003

**✅ CONFIRMADO:** La UI muestra éxito verde incluso si `applied=0`
- Muestra el mensaje con `applied=0` pero con formato de éxito
- No hay verificación `if (applied > 0)` antes de `showToastSuccess`
- **Impacto:** Usuario ve "completado" aunque nada se aplicó (por idempotencia u otra razón)

---

## BUG-004: Fallback legacy student.state puede desincronizar

### Código identificado

**Archivo:** `public/js/master/master-alquimia-general-client.js`

**Líneas 2775-2808:** Renderizado de columnas (renderListProjection)
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
- Si `state_by_view_layer` falta → usa `student.state` (legacy)
- `student.state` puede no coincidir con `state_by_view_layer[view_layer].state` si:
  - El backend calculó `state` para una `view_layer` diferente
  - Hay cache desincronizado
  - El CPM calculó diferente en diferentes momentos

**Impacto:**
- Alumno puede aparecer en columna incorrecta
- Columna `_error` solo se muestra si `state_by_view_layer` falta Y `student.state` también falta

---

## RESUMEN EVIDENCIA CÓDIGO

### BUG-001
- **Estado:** ⏳ PENDIENTE verificar JSON real de respuesta GET
- **Archivo:** `list-projection-model.js` + `master-api-alquimia-general.js`

### BUG-002
- **Estado:** ✅ CONFIRMADO en código
- **Archivo:** `alquimia-actions.js:44-73` (buildRefreshPlan puede retornar [])
- **Archivo:** `master-alquimia-general-client.js:6565` (log LEGACY_REFRESH)
- **Condición:** `surfaces.length === 0` → fallback a legacy

### BUG-003
- **Estado:** ✅ CONFIRMADO en código
- **Archivos:** `master-alquimia-general-client.js:1642, 1718, 3862, 4809`
- **Evidencia:** `showToastSuccess` se ejecuta sin verificar `applied > 0`

### BUG-004
- **Estado:** ✅ CONFIRMADO en código
- **Archivo:** `master-alquimia-general-client.js:2775-2808`
- **Evidencia:** Fallback a `student.state` si falta `state_by_view_layer`

---

**NOTA:** Para BUG-001, se requiere verificar JSON real de respuesta GET list-projection (requiere autenticación).
