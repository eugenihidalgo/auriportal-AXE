# IMPLEMENTACIÓN AUTORIDAD ESTADO RECURRENTE v1

**Fecha**: 2026-01-12  
**Dominio**: MASTER  
**Sistema**: Alquimia General / Flotante  
**Versión**: v5.70.0

---

## PROBLEMA IDENTIFICADO

El estado RECURRENTE se calculaba según `clean_layer` del **request**, no según la **vista activa** (`layerView`). Esto causaba que tras acciones PDE, el alumno no se reubicara en la columna correcta porque el refetch usaba `cleanLayer='shared'` (hardcoded) y el estado se calculaba basado en `shared.days_since_last_clean`, no en `pde.days_since_last_clean`.

---

## REGLA CANÓNICA IMPLEMENTADA

### 1. DIFERENCIACIÓN DE CONCEPTOS

**`clean_layer`** (capa de limpieza):
- **Propósito**: Decide qué columnas se **escriben** en DB (`shared_*` o `pde_*`)
- **Uso**: En acciones de limpieza (POST)
- **NUNCA** decide el estado visual

**`view_layer`** (vista activa):
- **Propósito**: Decide qué estado se **calcula** y qué columna se muestra
- **Uso**: En cálculo de estado RECURRENTE (GET)
- **Fuente**: `state.modal.layerView` (vista activa del usuario)

### 2. AUTORIDAD DE ESTADO RECURRENTE

**REGLA**: El estado RECURRENTE se calcula según `view_layer`:
- `view_layer = 'shared'` → usar `shared.days_since_last_clean`
- `view_layer = 'pde'` → usar `pde.days_since_last_clean`

**PROHIBIDO**: Usar `clean_layer` del request para calcular estado.

### 3. BACKEND COMO FUENTE ÚNICA

- El backend recibe explícitamente `view_layer` (o `view_layer` como parámetro)
- El backend calcula `student.state` y `student.visual_state` según `view_layer`
- La UI solo renderiza y reagrupa (no calcula estados)

### 4. REFRESH CANÓNICO POST-ACCIÓN

- Tras cualquier acción: refetch usando la `layerView` ACTIVA
- **PROHIBIDO**: Hardcodear `'shared'` o inferir desde el botón pulsado
- El alumno DEBE reubicarse inmediatamente si su estado cambia

---

## CAMBIOS IMPLEMENTADOS

### A) Backend (`alquimia-general-service.js`)

#### Separación explícita de `clean_layer` y `view_layer`:

```javascript
/**
 * @param {Object} options - Opciones adicionales
 * @param {string} options.clean_layer - Capa de limpieza ('shared' | 'pde') - OBLIGATORIO (para repositorio)
 * @param {string} options.view_layer - Vista activa ('shared' | 'pde') - OBLIGATORIO para RECURRENTE (decide estado)
 */
export async function getStudentsForItem(itemRef, tipo, productKey = 'pde', options = {}) {
  const { clean_layer, view_layer, ...otherOptions } = options;
  
  // GUARD: view_layer es OBLIGATORIO para RECURRENTE
  if (tipo === 'recurrente' && !view_layer) {
    throw new Error('view_layer is required for RECURRENTE items.');
  }
  
  // Validar view_layer
  if (view_layer && view_layer !== 'shared' && view_layer !== 'pde') {
    throw new Error(`view_layer must be 'shared' or 'pde', got: ${view_layer}`);
  }
}
```

#### Cálculo de estado RECURRENTE según `view_layer`:

```javascript
// REGLA CANÓNICA: Estado RECURRENTE se calcula según view_layer (NO clean_layer)
const layerForState = view_layer === 'pde' ? 'pde' : 'shared';
const layerDataForState = layerForState === 'pde' ? pdeData : sharedData;
const daysSince = layerDataForState.days_since_last_clean !== undefined 
  ? layerDataForState.days_since_last_clean 
  : (layerForState === 'pde' ? null : (student.days_since_last_clean || null));

// Calcular estado según daysSince
let state;
if (daysSince === null || daysSince === undefined) {
  state = 'never';
} else if (daysSince < thresholdDays) {
  state = 'reviewed';
} else if (daysSince < criticalThreshold) {
  state = 'pending';
} else {
  state = 'important';
}

// Log forense obligatorio
logInfo('AlquimiaGeneralService', '[FORENSIC][RECURRENTE_STATE] Estado calculado', {
  traceId,
  student_uuid: student.student_uuid,
  item_ref: itemRef,
  clean_layer, // Para escritura
  view_layer, // Para cálculo de estado
  layer_for_state: layerForState,
  days_since_last_clean: daysSince,
  state_calculated: state,
  threshold_days: thresholdDays,
  critical_threshold: criticalThreshold,
  shared_days: sharedData.days_since_last_clean,
  pde_days: pdeData.days_since_last_clean
});
```

### B) Endpoint GET (`master-api-alquimia-general.js`)

#### Aceptar `view_layer` explícito:

```javascript
const cleanLayer = url.searchParams.get('clean_layer') || 'shared'; // Default shared (para repositorio)
const viewLayer = url.searchParams.get('view_layer'); // OBLIGATORIO para RECURRENTE (sin default)

// Validar view_layer para RECURRENTE
if (tipo === 'recurrente' && !viewLayer) {
  warnings.push('view_layer es obligatorio para items RECURRENTE.');
  // Fallback temporal: usar cleanLayer como viewLayer (DEPRECATED)
}

// Llamar servicio con view_layer
result = await getStudentsForItem(itemRef, tipo, productKey, { 
  limit, 
  offset, 
  clean_layer: cleanLayer,
  view_layer: viewLayer || cleanLayer, // Fallback temporal para compatibilidad
  skip_level_filter: true
});
```

### C) Frontend (`master-alquimia-general-client.js`)

#### Refetch usando `state.modal.layerView`:

```javascript
async function handleVerItem(item, cleanLayer = 'shared', viewLayer = null) {
  // Si no se pasa viewLayer explícitamente, usar layerView del estado del modal
  const activeViewLayer = viewLayer || state.modal.layerView || cleanLayer;
  
  // Construir URL con clean_layer (repositorio) y view_layer (estado RECURRENTE)
  const urlParams = new URLSearchParams({
    clean_layer: cleanLayer,
    view_layer: activeViewLayer
  });
  
  const response = await fetch(`/master/api/alquimia-general/items/${item.item_ref}/students?${urlParams.toString()}`);
  // ...
}
```

#### Refresh post-acción usando `layerView` ACTIVA:

```javascript
// REGLA CANÓNICA: Refresh determinista post-acción usando layerView ACTIVA
if (state.modal.item && state.modal.item.item_ref === item.item_ref) {
  // Refetch usando la layerView ACTIVA (no hardcoded)
  const activeLayerView = state.modal.layerView || 'shared';
  console.log('[MasterAlquimiaGeneral] [FORENSIC][REFRESH] Refetch post-acción', {
    item_ref: item.item_ref,
    action_clean_layer: cleanLayer,
    active_layer_view: activeLayerView,
    student_uuid: student.student_uuid
  });
  await handleVerItem(item, 'shared', activeLayerView); // cleanLayer='shared' (repositorio), viewLayer=activeLayerView (estado)
}
```

#### Logs forenses obligatorios:

```javascript
// Log forense: action.clean_layer, view_layer, state calculado
const activeViewLayer = state.modal.layerView || 'shared';
console.log('[AG][ACTION][FORENSIC]', {
  actionType: 'mark-clean-student',
  item_kind: itemKind,
  action_clean_layer: cleanLayer, // Capa de escritura (shared_* o pde_*)
  view_layer: activeViewLayer, // Vista activa (decide estado RECURRENTE)
  student_uuid: student.student_uuid,
  item_ref: item.item_ref,
  layerView: state.modal.layerView,
  viewMode: 'flotante',
  expected_column_change: itemKind === 'recurrente' ? `Estado calculado según ${activeViewLayer}.days_since_last_clean` : 'COMBO (shared+pde)'
});
```

---

## FLUJO CANÓNICO

### Caso RECURRENTE: Acción PDE con `layerView='pde'`

1. **Usuario pulsa botón PDE** en flotante con `layerView='pde'`
2. **POST** `/master/api/alquimia-general/items/:item_ref/master/mark-clean-student`
   - `clean_layer='pde'` → escribe en `pde_clean_count`, `pde_last_cleaned_at`
3. **Refetch** usando `layerView='pde'` (no hardcoded)
   - `GET /master/api/alquimia-general/items/:item_ref/students?clean_layer=shared&view_layer=pde`
4. **Backend calcula estado** según `view_layer='pde'`
   - Usa `pde.days_since_last_clean` (no `shared.days_since_last_clean`)
   - Calcula `state = 'reviewed'` si `pde.days_since_last_clean < threshold_days`
5. **Frontend agrupa** por `student.state`
   - Alumno se mueve a columna "REVISADO" ✅

### Caso RECURRENTE: Acción SHARED con `layerView='shared'`

1. **Usuario pulsa botón SHARED** en flotante con `layerView='shared'`
2. **POST** con `clean_layer='shared'` → escribe en `shared_clean_count`, `shared_last_cleaned_at`
3. **Refetch** usando `layerView='shared'`
   - `GET /master/api/alquimia-general/items/:item_ref/students?clean_layer=shared&view_layer=shared`
4. **Backend calcula estado** según `view_layer='shared'`
   - Usa `shared.days_since_last_clean`
5. **Frontend agrupa** por `student.state`
   - Alumno se mueve a columna correcta ✅

### Caso UNA_VEZ: Sin cambios

- **Sin cambios**: UNA_VEZ ya usa COMBO (shared + pde), independiente de `view_layer`
- El estado se calcula basado en `combo.clean_count = shared.clean_count + pde.clean_count`
- Funciona correctamente sin modificaciones ✅

---

## VERIFICACIÓN

### 1. Caso RECURRENTE: Acción PDE con `layerView='pde'`

**Escenario**:
- Alumno tiene `shared.days_since_last_clean = 10` (PENDIENTE)
- Alumno tiene `pde.days_since_last_clean = 1` (REVISADO)
- Master hace acción PDE con `layerView='pde'`
- `pde_last_cleaned_at` se actualiza → `pde.days_since_last_clean = 0`

**Resultado esperado**:
- Refetch usa `view_layer='pde'`
- Backend calcula `state` basado en `pde.days_since_last_clean = 0`
- `state = 'reviewed'` (si `threshold_days > 0`)
- Alumno se mueve a columna "REVISADO" ✅

### 2. Caso SHARED: Acción SHARED con `layerView='shared'`

**Escenario**:
- Alumno tiene `shared.days_since_last_clean = 10` (PENDIENTE)
- Master hace acción SHARED con `layerView='shared'`
- `shared_last_cleaned_at` se actualiza → `shared.days_since_last_clean = 0`

**Resultado esperado**:
- Refetch usa `view_layer='shared'`
- Backend calcula `state` basado en `shared.days_since_last_clean = 0`
- `state = 'reviewed'`
- Alumno se mueve a columna "REVISADO" ✅

### 3. No regresión: UNA_VEZ sigue funcionando

**Escenario**:
- Alumno tiene `shared.clean_count = 1`, `pde.clean_count = 1`
- `combo.clean_count = 2`
- Master hace acción PDE

**Resultado esperado**:
- `pde.clean_count = 2`
- `combo.clean_count = 3` (1 + 2)
- Estado visual se calcula basado en COMBO
- Alumno se mueve según `combo.clean_count` ✅

---

## LOGS FORENSES

### Backend (`alquimia-general-service.js`):

```javascript
logInfo('AlquimiaGeneralService', '[FORENSIC][RECURRENTE_STATE] Estado calculado', {
  traceId,
  student_uuid: student.student_uuid,
  item_ref: itemRef,
  clean_layer, // Para escritura
  view_layer, // Para cálculo de estado
  layer_for_state: layerForState,
  days_since_last_clean: daysSince,
  state_calculated: state,
  threshold_days: thresholdDays,
  critical_threshold: criticalThreshold,
  shared_days: sharedData.days_since_last_clean,
  pde_days: pdeData.days_since_last_clean
});
```

### Frontend (`master-alquimia-general-client.js`):

```javascript
console.log('[AG][ACTION][FORENSIC]', {
  actionType: 'mark-clean-student',
  item_kind: itemKind,
  action_clean_layer: cleanLayer, // Capa de escritura
  view_layer: activeViewLayer, // Vista activa
  student_uuid: student.student_uuid,
  item_ref: item.item_ref,
  layerView: state.modal.layerView,
  expected_column_change: itemKind === 'recurrente' ? `Estado calculado según ${activeViewLayer}.days_since_last_clean` : 'COMBO (shared+pde)'
});
```

---

## ARCHIVOS MODIFICADOS

1. `src/services/alquimia-general-service.js`
   - Separación de `clean_layer` y `view_layer`
   - Cálculo de estado RECURRENTE según `view_layer`
   - Logs forenses obligatorios

2. `src/endpoints/master-api-alquimia-general.js`
   - Aceptar `view_layer` explícito
   - Validar `view_layer` para RECURRENTE
   - Pasar `view_layer` al servicio

3. `public/js/master/master-alquimia-general-client.js`
   - `handleVerItem` acepta `viewLayer`
   - Refetch post-acción usa `state.modal.layerView`
   - Logs forenses obligatorios

---

## COMPATIBILIDAD

### Fallback temporal (DEPRECATED):

- Si `view_layer` no se proporciona para RECURRENTE, se usa `cleanLayer` como fallback
- Esto permite compatibilidad con código legacy que no pasa `view_layer`
- **TODO**: Eliminar este fallback en versión futura (será error obligatorio)

---

## CONCLUSIÓN

La implementación garantiza que:

1. ✅ El estado RECURRENTE se calcula según `view_layer` (vista activa), no según `clean_layer` (request)
2. ✅ El refetch post-acción usa `state.modal.layerView` (nunca hardcoded)
3. ✅ El alumno se reubica inmediatamente en la columna correcta tras acciones
4. ✅ UNA_VEZ sigue funcionando correctamente (sin cambios)
5. ✅ Logs forenses permiten diagnosticar problemas de estado

---

**FIN DE LA IMPLEMENTACIÓN**
