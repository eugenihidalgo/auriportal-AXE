# Cursor Rules: Cleaning Engine

**Fecha**: 2026-01-12  
**Dominio**: MASTER  
**Sistema**: Alquimia / Cleaning Engine  
**Versión**: v1.0.0  
**Audiencia**: Agentes Cursor / Asistentes de Código

---

## INTRODUCCIÓN

Este documento define reglas estrictas para agentes Cursor que trabajen con el Cleaning Engine. Su objetivo es prevenir errores comunes y garantizar que cualquier cambio respete el modelo canónico.

**Principio**: Si no está explícitamente permitido, está prohibido.

---

## REGLAS ABSOLUTAS PARA AGENTES

### Regla 1: NO INFERIR clean_layer

**❌ PROHIBIDO**:
```javascript
// Inferir clean_layer desde contexto
const cleanLayer = student.product_key === 'pde' ? 'pde' : 'shared';
```

**✅ CORRECTO**:
```javascript
// clean_layer debe venir explícitamente en el payload
const cleanLayer = body.clean_layer;
if (!cleanLayer) {
  throw new Error('clean_layer is required');
}
```

**Por qué**: La inferencia introduce bugs sutiles. El `clean_layer` debe ser explícito.

---

### Regla 2: NO INFERIR view_layer

**❌ PROHIBIDO**:
```javascript
// Inferir view_layer desde clean_layer
const viewLayer = cleanLayer;  // ❌ INCORRECTO
```

**✅ CORRECTO**:
```javascript
// view_layer debe venir explícitamente en query params
const viewLayer = url.searchParams.get('view_layer');
if (!viewLayer && tipo === 'recurrente') {
  throw new Error('view_layer is required for RECURRENTE');
}
```

**Por qué**: `clean_layer` y `view_layer` son conceptos distintos. Pueden tener valores diferentes.

---

### Regla 3: NO PERMITIR clean_layer='combo'

**❌ PROHIBIDO**:
```javascript
// Permitir clean_layer='combo'
if (cleanLayer === 'combo') {
  // Escribir en combo_* (NO EXISTE)
}
```

**✅ CORRECTO**:
```javascript
// Rechazar clean_layer='combo' explícitamente
validateCleanLayerNotCombo(cleanLayer);
```

**Por qué**: `combo` es una proyección calculada, no una capa de escritura.

---

### Regla 4: NO CALCULAR ESTADOS EN UI

**❌ PROHIBIDO**:
```javascript
// Calcular estado en frontend
const state = student.shared.clean_count + student.pde.clean_count > 10 
  ? 'completed' 
  : 'pending';
```

**✅ CORRECTO**:
```javascript
// Consumir estado desde backend
const state = student.state_by_view_layer[viewLayer].state;
```

**Por qué**: La UI no debe duplicar lógica del backend. El backend es la única autoridad.

---

### Regla 5: NO USAR CAMPOS LEGACY TOP-LEVEL

**❌ PROHIBIDO**:
```javascript
// Usar campos legacy ambiguos
const state = student.state;  // ❌ Ambiguo
const count = student.clean_count;  // ❌ ¿shared o pde?
```

**✅ CORRECTO**:
```javascript
// Usar campos explícitos por capa
const state = student.state_by_view_layer[viewLayer].state;
const count = student.shared.clean_count;  // Explícito
```

**Por qué**: Los campos legacy son ambiguos y pueden estar desincronizados.

---

### Regla 6: NO MEZCLAR clean_layer Y view_layer

**❌ PROHIBIDO**:
```javascript
// Usar clean_layer para calcular estado
const state = computeState(cleanLayer);  // ❌ INCORRECTO
```

**✅ CORRECTO**:
```javascript
// Usar view_layer para calcular estado
const state = computeVisualState({
  shared, pde, combo,
  view_layer: viewLayer,  // ← CORRECTO
  item_kind, config
});
```

**Por qué**: `clean_layer` decide escritura, `view_layer` decide cálculo de estado.

---

### Regla 7: VALIDAR SIEMPRE ANTES DE USAR

**❌ PROHIBIDO**:
```javascript
// Usar sin validar
const result = await markCleanStudent({
  clean_layer: body.clean_layer,  // Sin validar
  // ...
});
```

**✅ CORRECTO**:
```javascript
// Validar antes de usar
if (!body.clean_layer) {
  return jsonError('clean_layer is required', 'CLEAN_LAYER_REQUIRED', 400);
}
validateCleanLayer(body.clean_layer);
validateCleanLayerNotCombo(body.clean_layer);

const result = await markCleanStudent({
  clean_layer: body.clean_layer,  // Validado
  // ...
});
```

**Por qué**: La validación temprana previene bugs y errores en producción.

---

### Regla 8: REFETCH DESPUÉS DE POST

**❌ PROHIBIDO**:
```javascript
// No refetch después de POST
await fetch('/mark-clean-student', { method: 'POST', body });
// UI sigue mostrando estado antiguo
```

**✅ CORRECTO**:
```javascript
// Refetch después de POST
await fetch('/mark-clean-student', { method: 'POST', body });
await refetchStudents(item, currentViewLayer);  // Refetch con view_layer actual
```

**Por qué**: El estado cambió en DB, la UI debe actualizarse.

---

### Regla 9: LOGS FORENSES OBLIGATORIOS

**❌ PROHIBIDO**:
```javascript
// Sin logs forenses
await markCleanStudent(options);
```

**✅ CORRECTO**:
```javascript
// Con logs forenses
await markCleanStudent(options);
logInfo('CleaningEngine', '[CLEAN][WRITE] Proyección aplicada', {
  clean_layer,
  delta: { /* cambios */ }
});
```

**Por qué**: Los logs forenses permiten diagnosticar problemas y auditar cambios.

---

### Regla 10: NO CREAR LÓGICA AD-HOC

**❌ PROHIBIDO**:
```javascript
// Lógica ad-hoc fuera del modelo canónico
if (someCondition) {
  // Lógica especial que no sigue el modelo
}
```

**✅ CORRECTO**:
```javascript
// Usar funciones canónicas
const state = computeVisualState({
  shared, pde, combo,
  item_kind, view_layer, config
});
```

**Por qué**: La lógica ad-hoc rompe la consistencia y dificulta el mantenimiento.

---

## CHECKLIST ANTES DE TOCAR ALQUIMIA

Antes de modificar cualquier código relacionado con Alquimia, verificar:

### ✅ Validaciones

- [ ] ¿Se valida `clean_layer` explícitamente?
- [ ] ¿Se valida `view_layer` explícitamente?
- [ ] ¿Se rechaza `clean_layer='combo'`?
- [ ] ¿Se valida `item_kind`?

### ✅ Separación de Responsabilidades

- [ ] ¿La escritura usa `clean_layer`?
- [ ] ¿El cálculo de estado usa `view_layer`?
- [ ] ¿No se mezclan `clean_layer` y `view_layer`?

### ✅ Proyección

- [ ] ¿Se calcula `combo` correctamente (shared + pde)?
- [ ] ¿Se calcula `state_by_view_layer` para todas las view_layers?
- [ ] ¿Se devuelve `state` según `view_layer` actual?

### ✅ UI

- [ ] ¿La UI consume `state_by_view_layer[view_layer]`?
- [ ] ¿La UI NO calcula estados?
- [ ] ¿La UI hace refetch después de POST?

### ✅ Logs

- [ ] ¿Hay logs `[CLEAN][WRITE]` después de escritura?
- [ ] ¿Hay logs `[CLEAN][STATE]` después de cálculo de estado?
- [ ] ¿Los logs incluyen `clean_layer` y `view_layer`?

### ✅ Errores

- [ ] ¿Los errores son explícitos (HTTP 400)?
- [ ] ¿No se infiere nada implícitamente?
- [ ] ¿Los mensajes de error son claros?

---

## PATRONES PERMITIDOS

### Patrón 1: Validación de clean_layer en POST

```javascript
// ✅ CORRECTO
if (path.match(/mark-clean-student$/) && method === 'POST') {
  const cleanLayer = body.clean_layer;
  
  if (!cleanLayer) {
    return jsonError('clean_layer is required', 'CLEAN_LAYER_REQUIRED', 400);
  }
  
  try {
    validateCleanLayer(cleanLayer);
    validateCleanLayerNotCombo(cleanLayer);
  } catch (error) {
    return jsonError(`clean_layer validation failed: ${error.message}`, 'INVALID_CLEAN_LAYER', 400);
  }
  
  // Usar cleanLayer validado
}
```

### Patrón 2: Validación de view_layer en GET

```javascript
// ✅ CORRECTO
if (path.match(/\/students$/) && method === 'GET') {
  const viewLayer = url.searchParams.get('view_layer');
  
  if (tipo === 'recurrente' && !viewLayer) {
    return jsonError('view_layer is required for RECURRENTE', 'VIEW_LAYER_REQUIRED', 400);
  }
  
  if (viewLayer) {
    try {
      validateViewLayer(viewLayer);
    } catch (error) {
      return jsonError(`view_layer validation failed: ${error.message}`, 'INVALID_VIEW_LAYER', 400);
    }
  }
  
  // Usar viewLayer validado (o default 'combo' para UNA_VEZ)
}
```

### Patrón 3: Cálculo de Estado con computeVisualState

```javascript
// ✅ CORRECTO
const stateByViewLayer = {
  shared: computeVisualState({
    shared: sharedData,
    pde: pdeData,
    combo: comboData,
    item_kind: 'recurrente',
    view_layer: 'shared',
    config: { threshold_days, critical_multiplier }
  }),
  pde: computeVisualState({
    shared: sharedData,
    pde: pdeData,
    combo: comboData,
    item_kind: 'recurrente',
    view_layer: 'pde',
    config: { threshold_days, critical_multiplier }
  }),
  combo: computeVisualState({
    shared: sharedData,
    pde: pdeData,
    combo: comboData,
    item_kind: 'una_vez',
    view_layer: 'combo',
    config: { required_count }
  })
};
```

### Patrón 4: Consumo de Estado en UI

```javascript
// ✅ CORRECTO
async function renderStudents(students, viewLayer) {
  students.forEach(student => {
    // Usar state_by_view_layer[viewLayer] (NO campos legacy)
    const state = student.state_by_view_layer[viewLayer];
    
    // Renderizar según visual_state
    if (state.visual_state === 'reviewed') {
      renderInColumn('Revisado', student);
    } else if (state.visual_state === 'pending') {
      renderInColumn('Pendiente', student);
    }
    // ...
  });
}
```

### Patrón 5: Refetch después de POST

```javascript
// ✅ CORRECTO
async function handleLimpiarEstudiante(student, item, cleanLayer) {
  // POST
  await fetch(`/items/${item.item_ref}/master/mark-clean-student`, {
    method: 'POST',
    body: JSON.stringify({
      clean_layer: cleanLayer,
      // ...
    })
  });
  
  // Refetch con view_layer actual
  const currentViewLayer = state.modal.viewLayer || 'combo';
  await refetchStudents(item, currentViewLayer);
}
```

---

## ERRORES COMUNES Y CÓMO EVITARLOS

### Error 1: Usar clean_layer para calcular estado

**Síntoma**: Estado calculado incorrectamente después de limpiar.

**Causa**: Usar `clean_layer` en lugar de `view_layer` para calcular estado.

**Solución**: Usar `view_layer` para cálculo de estado, `clean_layer` solo para escritura.

### Error 2: No refetch después de POST

**Síntoma**: UI no se actualiza después de limpiar.

**Causa**: No hacer refetch después de POST exitoso.

**Solución**: Siempre hacer refetch con `view_layer` actual después de POST.

### Error 3: Calcular combo en UI

**Síntoma**: Combo incorrecto o desincronizado.

**Causa**: Calcular `combo` en frontend en lugar de consumir del backend.

**Solución**: Consumir `combo` desde la respuesta del backend.

### Error 4: Usar campos legacy

**Síntoma**: Estado ambiguo o incorrecto.

**Causa**: Usar `student.state` o `student.clean_count` en lugar de `state_by_view_layer`.

**Solución**: Usar siempre `state_by_view_layer[viewLayer]`.

---

## REFERENCIAS

- `docs/CLEANING_ENGINE_CANONICAL_MODEL_V1.md` - Modelo canónico completo
- `docs/CLEANING_ENGINE_EXTENSIBILITY.md` - Extensibilidad (group/pair)
- `docs/COLUMN_PIPELINE_AUTHORITY.md` - Pipeline completo
- `src/core/master/services/cleaning-layer-constants.js` - Constantes y validadores

---

## RESUMEN PARA AGENTES

**Reglas de oro**:
1. `clean_layer` decide escritura (POST)
2. `view_layer` decide cálculo de estado (GET)
3. `combo` es SOLO `view_layer` (nunca `clean_layer`)
4. Validar siempre, inferir nunca
5. UI consume, no calcula
6. Refetch después de POST
7. Logs forenses obligatorios

**Si dudas**: Consultar `CLEANING_ENGINE_CANONICAL_MODEL_V1.md` antes de modificar código.

---

**FIN DEL DOCUMENTO**
