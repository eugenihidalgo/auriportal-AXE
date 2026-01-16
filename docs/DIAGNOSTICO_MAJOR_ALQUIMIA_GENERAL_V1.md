# DIAGNÓSTICO MAJOR - ALQUIMIA GENERAL v1

**Fecha**: 2026-01-13  
**Autor**: Arquitecto Principal AuriPortal  
**Objetivo**: Identificar contratos rotos sin tocar código

---

## METODOLOGÍA

- ✅ Análisis de código existente
- ✅ Referencias a contratos canónicos
- ✅ Líneas exactas de código
- ❌ NO se proponen soluciones aún
- ❌ NO se toca código

---

## PROBLEMA 1: EFFECTIVE (RECURRENTE) - CRÍTICO

### CONTRATO ESPERADO
- EFFECTIVE = composición determinista de SHARED + PDE
- NO es opcional para recurrente
- SIEMPRE debe estar en `state_by_view_layer.effective`

### EVIDENCIA ACTUAL

#### Backend: `list-projection-model.js`
**Líneas 793-809**: Intento de fix que calcula effective si falta
```javascript
// BUG-020 FIX: Asegurar que effective siempre se devuelve para recurrente
if (item_kind === 'recurrente' && !projection.state_by_view_layer.effective) {
  logError('ListProjectionModel', '[BUG-020] effective no calculado para recurrente', {
    traceId,
    item_ref: item.item_ref,
    item_kind,
    available_layers: Object.keys(projection.state_by_view_layer)
  });
  // Calcular effective explícitamente si falta
  projection.state_by_view_layer.effective = computeCleaningProjection({
    cleaning_state: cleaningState,
    item_kind: item_kind,
    view_layer: 'effective',
    config: effectiveConfig
  }).state_by_view_layer.effective;
}
```

**ANÁLISIS**: El fix intenta calcular effective si falta, pero:
- Solo se ejecuta en `computeListProjection` (proyección de lista)
- NO se ejecuta en `getStudentsForItem` (flotante)

#### Backend: `alquimia-general-service.js` (flotante)
**Líneas 760-796**: Cálculo de `state_by_view_layer` para flotante
```javascript
// Calcular estados para todas las view_layers posibles (proyección completa)
const stateByViewLayer = {
  shared: computeVisualState({...}),
  pde: computeVisualState({...})
};
```

**CONTRATO ROTO**: 
- ❌ Solo calcula `shared` y `pde`
- ❌ NO calcula `effective` para recurrente
- ❌ El flotante devuelve `available_layers = ['shared','pde']` sin `effective`

#### Frontend: `master-alquimia-general-client.js`
**Líneas 2446-2479**: Selector EFFECTIVE solo aparece si `item_kind === 'recurrente'`
```javascript
if (itemKindForEffective === 'recurrente') {
  const btnEffective = document.createElement('button');
  btnEffective.textContent = 'EFFECTIVE';
  // ...
}
```

**CONTRATO ROTO**:
- ✅ El botón EFFECTIVE se renderiza correctamente
- ❌ Pero el backend NO devuelve `state_by_view_layer.effective`
- ❌ La UI detecta correctamente: `[BUG-011] state_by_view_layer no disponible - BLOQUEANDO render`

### CONCLUSIÓN
**CONTRATO ROTO**: `getStudentsForItem` (flotante) NO calcula `effective` para recurrente, aunque el contrato canónico lo requiere.

**LÍNEAS AFECTADAS**:
- `src/services/alquimia-general-service.js:760-796` (falta cálculo de effective)
- `src/core/master/services/list-projection-model.js:793-809` (fix parcial, solo en proyección)

---

## PROBLEMA 2: RESET ALL (RECURRENTE) - CRÍTICO

### CONTRATO ESPERADO
- Reset ALL (recurrente):
  - Solo afecta PDE
  - Pone a todos los alumnos en estado `pending`
  - Debe invalidar caches y refrescar proyección ALL
- Prioridad visual ALL (recurrente): `never > important > pending > reviewed`
- Reviewed SOLO si TODOS están reviewed

### EVIDENCIA ACTUAL

#### Backend: `master-api-alquimia-general.js`
**Líneas 1513-1608**: `POST /master/api/alquimia-general/reset-item`
- ✅ Requiere `student_uuid` (scope='student')
- ❌ NO existe endpoint para reset ALL (scope='all')

**Líneas 1610-1751**: `POST /master/api/alquimia-general/reset-list`
- ✅ Requiere `student_uuid` (scope='student')
- ❌ NO existe endpoint para reset lista ALL (scope='all')

**CONTRATO ROTO**: 
- ❌ No existe botón "Reset ALL" por ítem en proyección ALL
- ❌ No existe "Reset lista ALL"
- ❌ Los endpoints existentes requieren `student_uuid` (solo scope='student')

#### Frontend: `alquimia-actions-registry.v1.js`
**Líneas 178-207**: Acción `alquimia.reset.item`
- ✅ Registrada correctamente
- ❌ Requiere `student_uuid` (solo scope='student')

**Líneas 212-241**: Acción `alquimia.reset.list`
- ✅ Registrada correctamente
- ❌ Requiere `student_uuid` (solo scope='student')

**CONTRATO ROTO**: 
- ❌ No existen acciones para reset ALL (scope='all')
- ❌ No se pueden renderizar botones de reset en proyección ALL

#### Backend: `list-projection-model.js`
**Líneas 38-64**: Función `aggregateStateForAll`
- ✅ Prioridad canónica implementada: `never > important > pending > reviewed`
- ✅ Reviewed solo si TODOS están reviewed

**ANÁLISIS**: La prioridad visual está correcta, pero:
- ❌ No hay forma de resetear ALL desde la UI
- ❌ Tras reset + clean_all → "0 limpiados, 2 ya estaban limpios hoy" → el ítem NO pasa a verde

### CONCLUSIÓN
**CONTRATO ROTO**: No existen endpoints ni acciones para reset ALL (scope='all') en recurrente.

**LÍNEAS AFECTADAS**:
- `src/endpoints/master-api-alquimia-general.js:1513-1751` (solo scope='student')
- `public/js/master/ux/alquimia-actions-registry.v1.js:178-241` (solo scope='student')
- `public/js/master/master-alquimia-general-client.js` (no hay render de botones reset ALL)

---

## PROBLEMA 3: UNA_VEZ - BOTONES INCORRECTOS

### CONTRATO ESPERADO
- En proyección alumno (una_vez):
  - ✅ +1 SHARED
  - ✅ +1 PDE
  - ❌ Reset NO aplica a una_vez
  - ❌ EFFECTIVE no aplica a una_vez

### EVIDENCIA ACTUAL

#### Frontend: `master-alquimia-general-client.js`
**Líneas 2446-2479**: Selector EFFECTIVE
```javascript
if (itemKindForEffective === 'recurrente') {
  const btnEffective = document.createElement('button');
  // ...
}
```

**ANÁLISIS**: 
- ✅ EFFECTIVE solo se renderiza para recurrente (correcto)
- ❌ Pero no hay validación que bloquee reset en una_vez

#### Frontend: `alquimia-actions-registry.v1.js`
**Líneas 178-207**: Acción `alquimia.reset.item`
- ❌ NO valida `item_kind` antes de registrar
- ❌ Se puede llamar desde una_vez (incorrecto)

**Líneas 212-241**: Acción `alquimia.reset.list`
- ❌ NO valida `item_kind` antes de registrar
- ❌ Se puede llamar desde una_vez (incorrecto)

**CONTRATO ROTO**: 
- ❌ Las acciones de reset están disponibles para una_vez
- ❌ No hay filtrado por `item_kind` en el render de botones

### CONCLUSIÓN
**CONTRATO ROTO**: No hay validación que bloquee reset en una_vez. Los botones de reset aparecen incorrectamente.

**LÍNEAS AFECTADAS**:
- `public/js/master/ux/alquimia-actions-registry.v1.js:178-241` (no valida item_kind)
- `public/js/master/master-alquimia-general-client.js` (no filtra botones por item_kind)

---

## PROBLEMA 4: UNA_VEZ - PROYECCIÓN / EFFECTIVE

### CONTRATO ESPERADO
- UNA_VEZ NO tiene EFFECTIVE
- EFFECTIVE es EXCLUSIVO de recurrente
- Si se intenta usar EFFECTIVE en una_vez → error 400

### EVIDENCIA ACTUAL

#### Backend: `cleaning-layer-constants.js`
**Validación**: `validateViewLayerItemKindCoherence`
- ✅ Valida que `effective` solo se usa en recurrente
- ✅ Error 400 si se usa en una_vez

#### Backend: `cleaning-projection-model.js`
**Líneas 345-353**: Cálculo de effective
```javascript
// effective solo para recurrente
if (item_kind === 'recurrente') {
  stateByViewLayer.effective = computeEffectiveState({
    item_kind,
    view_layer: 'effective',
    item_config: config,
    cleaning_state
  });
}
```

**ANÁLISIS**: 
- ✅ CPM solo calcula effective para recurrente (correcto)
- ✅ No se calcula para una_vez (correcto)

#### Frontend: `master-alquimia-general-client.js`
**Líneas 2446-2479**: Selector EFFECTIVE
```javascript
if (itemKindForEffective === 'recurrente') {
  const btnEffective = document.createElement('button');
  // ...
}
```

**ANÁLISIS**: 
- ✅ El botón EFFECTIVE solo se renderiza para recurrente (correcto)
- ✅ No aparece en una_vez (correcto)

### CONCLUSIÓN
**CONTRATO CORRECTO**: UNA_VEZ NO tiene EFFECTIVE. El sistema bloquea correctamente.

**NO HAY PROBLEMA**: Este punto está correctamente implementado.

---

## PROBLEMA 5: REFRESH ENGINE - DESAJUSTE DE CONTEXTO

### CONTRATO ESPERADO
- `buildRefreshPlan` debe incluir:
  - `list_id`
  - `item_ref`
  - `view_layer`
  - `scope`
- Todas las surfaces deben tener contexto completo
- NO deben existir surfaces con key `unknown`

### EVIDENCIA ACTUAL

#### Frontend: `alquimia-actions-registry.v1.js`
**Líneas 47-69**: Función `buildRefreshPlan`
```javascript
function buildRefreshPlan(context, uiState) {
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

  // Flotante: SIEMPRE refrescar si está abierto e item_ref coincide
  if (context.item_ref && window.__AP_ALQUIMIA_STATE__?.modal?.item?.item_ref === context.item_ref) {
    surfaces.push('alquimia.flotante_students');
  }

  return surfaces;
}
```

**CONTRATO ROTO**: 
- ❌ Solo devuelve array de surface_ids
- ❌ NO pasa `list_id`, `item_ref`, `view_layer`, `scope` al contexto de refresh
- ❌ El Refresh Engine no tiene contexto completo para construir URLs

#### Backend: `refresh-engine-v2-adapter.js`
**ANÁLISIS**: Necesita contexto completo para construir URLs de refresh, pero:
- ❌ `buildRefreshPlan` no proporciona contexto
- ❌ Las surfaces pueden tener key `unknown` si falta contexto

### CONCLUSIÓN
**CONTRATO ROTO**: `buildRefreshPlan` no pasa contexto completo al Refresh Engine.

**LÍNEAS AFECTADAS**:
- `public/js/master/ux/alquimia-actions-registry.v1.js:47-69` (no pasa contexto)
- `public/js/core/ux/refresh-engine-v2-adapter.js` (espera contexto que no llega)

---

## RESUMEN DE CONTRATOS ROTOS

1. **EFFECTIVE (recurrente)**: `getStudentsForItem` NO calcula `effective` para flotante
2. **RESET ALL (recurrente)**: No existen endpoints ni acciones para reset ALL (scope='all')
3. **UNA_VEZ botones**: Reset aparece incorrectamente en una_vez (no hay filtrado)
4. **UNA_VEZ EFFECTIVE**: ✅ CORRECTO (no hay problema)
5. **REFRESH ENGINE**: `buildRefreshPlan` no pasa contexto completo

---

## PRÓXIMOS PASOS

**FASE 2**: Implementar fixes solo para los contratos rotos identificados:
1. Calcular `effective` en `getStudentsForItem` (flotante)
2. Crear endpoints y acciones para reset ALL (recurrente)
3. Filtrar botones reset por `item_kind` (bloquear en una_vez)
4. Pasar contexto completo en `buildRefreshPlan`

---

**FIN DEL DIAGNÓSTICO**
