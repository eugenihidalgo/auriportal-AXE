# Column Pipeline Authority

**Fecha**: 2026-01-12  
**Dominio**: MASTER  
**Sistema**: Alquimia / Cleaning Engine  
**Versión**: v1.0.0  
**Estado**: CANÓNICO (no negociable)

---

## INTRODUCCIÓN

Este documento describe el pipeline completo desde el clic del usuario hasta la ubicación del estudiante en una columna UI. Define el punto exacto donde se decide la columna y cómo detectar desincronización.

**Principio**: La columna UI es una consecuencia determinista del estado en la base de datos y el `view_layer` seleccionado.

---

## PIPELINE COMPLETO

### Fase 1: CLICK (Frontend)

**Qué pasa**: Usuario hace clic en botón de limpieza.

**Datos disponibles**:
- `item_ref`: Referencia del item
- `student_uuid`: UUID del estudiante
- `item_kind`: 'recurrente' | 'una_vez'
- `clean_layer`: 'shared' | 'pde' (decidido por el botón)

**Código ejemplo**:
```javascript
// En master-alquimia-general-client.js
async function handleLimpiarEstudiante(student, item, cleanLayer) {
  const response = await fetch(
    `/master/api/alquimia-general/items/${item.item_ref}/master/mark-clean-student`,
    {
      method: 'POST',
      body: JSON.stringify({
        student_uuid: student.student_uuid,
        item_ref: item.item_ref,
        item_kind: item.item_kind,
        clean_layer: cleanLayer,  // 'shared' o 'pde'
        actor_type: 'master',
        surface_key: 'master.alquimia_general'
      })
    }
  );
  
  // Después de POST exitoso, refetch con view_layer actual
  await refetchStudents(item, currentViewLayer);
}
```

**Punto de decisión**: El `clean_layer` se decide en el frontend según qué botón se presionó (botón SHARED → `clean_layer='shared'`, botón PDE → `clean_layer='pde'`).

---

### Fase 2: POST (Backend Endpoint)

**Qué pasa**: Endpoint recibe POST y valida `clean_layer`.

**Validaciones**:
1. `clean_layer` es obligatorio
2. `clean_layer` debe ser 'shared' o 'pde' (no 'combo')
3. `item_kind` es obligatorio
4. `student_uuid` es válido

**Código ejemplo**:
```javascript
// En master-api-alquimia-general.js
if (path.match(/mark-clean-student$/) && method === 'POST') {
  const cleanLayer = body.clean_layer;
  
  // Validación explícita
  if (!cleanLayer) {
    return jsonError('clean_layer is required', 'CLEAN_LAYER_REQUIRED', 400);
  }
  
  validateCleanLayer(cleanLayer);
  validateCleanLayerNotCombo(cleanLayer);  // Rechazar 'combo'
  
  // Llamar a Cleaning Engine
  const state = await cleaningMarkClean({
    student_uuid: body.student_uuid,
    item_ref: itemRef,
    item_kind: body.item_kind,
    clean_layer: cleanLayer,  // Pasa al Cleaning Engine
    // ...
  });
}
```

**Punto de decisión**: El endpoint valida que `clean_layer` es válido antes de pasar al Cleaning Engine.

---

### Fase 3: DB (Cleaning Engine)

**Qué pasa**: Cleaning Engine escribe en `cleaning_item_state`.

**Operaciones**:
1. Valida que el estudiante no está en pausa
2. Valida que el item existe y no está archivado
3. Genera `execution_key` para idempotencia
4. Inserta evento en `cleaning_events`
5. Actualiza proyección en `cleaning_item_state`

**Código ejemplo**:
```javascript
// En cleaning-engine-service.js
export async function markCleanStudent(options) {
  const { clean_layer, item_kind } = options;
  
  // Validación de clean_layer
  validateCleanLayer(clean_layer);
  validateCleanLayerNotCombo(clean_layer);
  
  // Escribir según clean_layer
  if (item_kind === 'recurrente') {
    if (clean_layer === 'shared') {
      await stateRepo.upsertApplyRecurrent({
        student_uuid,
        item_ref,
        clean_layer: 'shared',  // Escribe en shared_*
        cleaned_at: new Date()
      });
    } else if (clean_layer === 'pde') {
      await stateRepo.upsertApplyRecurrent({
        student_uuid,
        item_ref,
        clean_layer: 'pde',  // Escribe en pde_*
        cleaned_at: new Date()
      });
    }
  } else {
    // una_vez: similar pero con incremento
  }
  
  // Log forense
  logInfo('CleaningEngine', '[CLEAN][WRITE] Proyección aplicada', {
    clean_layer,
    delta: {
      shared_clean_count: state?.shared_clean_count,
      pde_clean_count: state?.pde_clean_count
    }
  });
}
```

**Estado en DB (después de escritura)**:
```sql
SELECT 
  shared_clean_count,
  pde_clean_count,
  shared_last_cleaned_at,
  pde_last_cleaned_at
FROM cleaning_item_state
WHERE student_id = 20 AND item_ref = 'te_item_6';

-- Si clean_layer='pde':
-- shared_clean_count: 5 (no cambió)
-- pde_clean_count: 3 (aumentó de 2 a 3)
-- shared_last_cleaned_at: '2026-01-09' (no cambió)
-- pde_last_cleaned_at: '2026-01-12' (actualizado)
```

**Punto de decisión**: El `clean_layer` determina QUÉ COLUMNAS se actualizan en la base de datos.

---

### Fase 4: PROYECCIÓN (Servicio de Alquimia)

**Qué pasa**: Servicio lee desde DB y calcula proyecciones.

**Operaciones**:
1. Lee `shared` y `pde` desde `cleaning_item_state`
2. Calcula `combo` como proyección (shared + pde)
3. Calcula estados para cada `view_layer` usando `computeVisualState()`
4. Genera `state_by_view_layer` con todos los estados

**Código ejemplo**:
```javascript
// En alquimia-general-service.js
export async function getStudentsForItem(itemRef, tipo, productKey, options) {
  const { view_layer } = options;
  
  // Leer desde DB (siempre lee shared y pde)
  const rawResult = await repo.getStudentsForItemFromCleaningEngine(
    itemRef, tipo, clean_layer, productKey
  );
  
  // Calcular proyecciones
  const students = rawResult.students.map(student => {
    const sharedData = student.shared || { clean_count: 0 };
    const pdeData = student.pde || { clean_count: 0 };
    
    // Calcular combo (proyección)
    const comboData = {
      clean_count: sharedData.clean_count + pdeData.clean_count,
      remaining: Math.max(0, required_count - (sharedData.clean_count + pdeData.clean_count))
    };
    
    // Calcular estados para todas las view_layers
    const stateByViewLayer = {
      shared: computeVisualState({
        shared: sharedData,
        pde: pdeData,
        combo: comboData,
        item_kind: tipo,
        view_layer: 'shared',
        config: { threshold_days, required_count }
      }),
      pde: computeVisualState({
        shared: sharedData,
        pde: pdeData,
        combo: comboData,
        item_kind: tipo,
        view_layer: 'pde',
        config: { threshold_days, required_count }
      }),
      combo: computeVisualState({
        shared: sharedData,
        pde: pdeData,
        combo: comboData,
        item_kind: tipo,
        view_layer: 'combo',
        config: { threshold_days, required_count }
      })
    };
    
    return {
      ...student,
      shared: sharedData,
      pde: pdeData,
      combo: comboData,
      state_by_view_layer: stateByViewLayer,
      state: stateByViewLayer[view_layer].state,  // Estado según view_layer actual
      visual_state: stateByViewLayer[view_layer].visual_state
    };
  });
  
  return { students };
}
```

**Punto de decisión**: El `view_layer` determina QUÉ ESTADO se calcula y se devuelve como `state` y `visual_state`.

---

### Fase 5: GET (Backend Endpoint)

**Qué pasa**: Endpoint devuelve respuesta JSON con proyecciones.

**Validaciones**:
1. `view_layer` es obligatorio para RECURRENTE
2. `view_layer` es opcional para UNA_VEZ (default: 'combo')
3. `view_layer` debe ser válido ('shared', 'pde', 'combo')

**Código ejemplo**:
```javascript
// En master-api-alquimia-general.js
if (path.match(/\/students$/) && method === 'GET') {
  const viewLayer = url.searchParams.get('view_layer');
  
  // Validación
  if (tipo === 'recurrente' && !viewLayer) {
    return jsonError('view_layer is required for RECURRENTE', 'VIEW_LAYER_REQUIRED', 400);
  }
  
  if (viewLayer) {
    validateViewLayer(viewLayer);
  }
  
  // Llamar a servicio
  const result = await getStudentsForItem(itemRef, tipo, productKey, {
    clean_layer: cleanLayer,  // Para repositorio (legacy)
    view_layer: viewLayer || 'combo'  // Para cálculo de estado
  });
  
  return jsonSuccess({ data: result });
}
```

**Respuesta JSON**:
```json
{
  "ok": true,
  "data": {
    "students": [
      {
        "student_uuid": "44a51f8f-4ed5-4291-ad13-5f07a99c636b",
        "shared": { "clean_count": 5, "days_since_last_clean": 3 },
        "pde": { "clean_count": 3, "days_since_last_clean": 0 },
        "combo": { "clean_count": 8, "remaining": 7 },
        "state_by_view_layer": {
          "shared": { "state": "pending", "visual_state": "pending" },
          "pde": { "state": "reviewed", "visual_state": "reviewed" },
          "combo": { "state": "pending", "visual_state": "in_progress" }
        },
        "state": "pending",  // Según view_layer='combo'
        "visual_state": "in_progress",
        "view_layer_used": "combo"
      }
    ]
  }
}
```

**Punto de decisión**: El endpoint valida `view_layer` y lo pasa al servicio.

---

### Fase 6: COLUMNA (Frontend UI)

**Qué pasa**: UI consume respuesta y renderiza estudiante en columna correcta.

**Operaciones**:
1. Consume `state_by_view_layer[view_layer]`
2. Determina columna según `visual_state`
3. Renderiza estudiante en columna correspondiente

**Código ejemplo**:
```javascript
// En master-alquimia-general-client.js
async function renderStudents(students, viewLayer) {
  // Agrupar por visual_state
  const byState = {
    never: [],
    reviewed: [],
    pending: [],
    important: [],
    in_progress: [],
    completed: [],
    empowered: []
  };
  
  students.forEach(student => {
    // Usar state_by_view_layer[view_layer] (NO campos legacy)
    const state = student.state_by_view_layer[viewLayer];
    byState[state.visual_state].push(student);
  });
  
  // Renderizar columnas
  renderColumn('Revisado', byState.reviewed);
  renderColumn('Pendiente', byState.pending);
  renderColumn('Importante', byState.important);
  renderColumn('En proceso', byState.in_progress);
  renderColumn('Completado', byState.completed);
  // ...
}

// Después de limpiar, refetch con view_layer actual
async function handleLimpiarEstudiante(student, item, cleanLayer) {
  await fetch(`/master/api/alquimia-general/items/${item.item_ref}/master/mark-clean-student`, {
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

**Punto de decisión**: El `view_layer` determina QUÉ COLUMNA se muestra. El `visual_state` determina EN QUÉ COLUMNA aparece el estudiante.

---

## PUNTO EXACTO DONDE SE DECIDE LA COLUMNA

### Decisión Final: computeVisualState()

La función `computeVisualState()` es el punto exacto donde se decide la columna.

**Input**:
- `shared`: Datos shared desde DB
- `pde`: Datos pde desde DB
- `combo`: Proyección calculada (shared + pde)
- `view_layer`: Capa de vista seleccionada
- `item_kind`: 'recurrente' | 'una_vez'
- `config`: { threshold_days, critical_multiplier, required_count }

**Output**:
```javascript
{
  state: 'reviewed' | 'pending' | 'important' | 'never' | 'completed',
  visual_state: 'reviewed' | 'pending' | 'important' | 'never' | 'in_progress' | 'completed' | 'empowered',
  computed_state: { /* detalles del cálculo */ }
}
```

**Lógica para RECURRENTE**:
```javascript
if (view_layer === 'shared') {
  const daysSince = shared.days_since_last_clean;
  if (daysSince === null) return { state: 'never', visual_state: 'never' };
  if (daysSince < threshold_days) return { state: 'reviewed', visual_state: 'reviewed' };
  if (daysSince < critical_threshold) return { state: 'pending', visual_state: 'pending' };
  return { state: 'important', visual_state: 'important' };
} else if (view_layer === 'pde') {
  // Similar pero usando pde.days_since_last_clean
}
```

**Lógica para UNA_VEZ**:
```javascript
if (view_layer === 'combo') {
  const cleanCount = combo.clean_count;  // shared + pde
  if (cleanCount === 0) return { state: 'pending', visual_state: 'never' };
  if (cleanCount < required_count) return { state: 'pending', visual_state: 'in_progress' };
  if (cleanCount < required_count * 10) return { state: 'completed', visual_state: 'completed' };
  return { state: 'completed', visual_state: 'empowered' };
} else if (view_layer === 'shared') {
  // Similar pero usando shared.clean_count
}
```

**Mapeo visual_state → Columna**:
- `never` → Columna "Nunca"
- `reviewed` → Columna "Revisado"
- `pending` → Columna "Pendiente"
- `important` → Columna "Importante"
- `in_progress` → Columna "En proceso"
- `completed` → Columna "Completado"
- `empowered` → Columna "Potenciado"

---

## CÓMO DETECTAR DESINCRONIZACIÓN

### Síntoma 1: Estudiante en columna incorrecta

**Qué observar**:
- Estudiante aparece en columna "Pendiente" pero debería estar en "Revisado"
- Estudiante no aparece en ninguna columna

**Cómo diagnosticar**:
1. Verificar estado en DB:
```sql
SELECT 
  shared_clean_count, pde_clean_count,
  shared_last_cleaned_at, pde_last_cleaned_at
FROM cleaning_item_state
WHERE student_id = ? AND item_ref = ?;
```

2. Verificar respuesta GET:
```bash
curl "http://localhost:3000/master/api/alquimia-general/items/te_item_6/students?view_layer=shared" | jq '.data.students[0].state_by_view_layer.shared'
```

3. Verificar logs:
```bash
grep "CLEAN][STATE" logs/app.log | tail -20
```

**Causas comunes**:
- `view_layer` incorrecto en GET
- Cálculo de estado incorrecto en `computeVisualState()`
- Datos desincronizados entre `shared` y `pde`

### Síntoma 2: Acción no refleja en columna

**Qué observar**:
- Se limpia con `clean_layer='pde'` pero la columna SHARED no cambia (correcto)
- Se limpia con `clean_layer='pde'` pero la columna COMBO no cambia (incorrecto)

**Cómo diagnosticar**:
1. Verificar que POST escribió correctamente:
```sql
SELECT * FROM cleaning_events 
WHERE item_ref = ? AND clean_layer = 'pde' 
ORDER BY created_at DESC LIMIT 1;
```

2. Verificar que GET calcula combo correctamente:
```bash
curl "http://localhost:3000/master/api/alquimia-general/items/te_item_6/students?view_layer=combo" | jq '.data.students[0].combo'
```

3. Verificar logs de escritura:
```bash
grep "CLEAN][WRITE" logs/app.log | tail -20
```

**Causas comunes**:
- `clean_layer` incorrecto en POST
- Proyección `combo` no se recalcula después de escritura
- UI no hace refetch después de POST

### Síntoma 3: Estados inconsistentes entre view_layers

**Qué observar**:
- `state_by_view_layer.shared.state` = 'pending'
- `state_by_view_layer.pde.state` = 'reviewed'
- `state_by_view_layer.combo.state` = 'pending'
- Pero `state` (top-level) = 'reviewed' (incorrecto, debería ser 'pending' si `view_layer='combo'`)

**Cómo diagnosticar**:
1. Verificar que `view_layer_used` coincide con `view_layer` del GET:
```bash
curl "http://localhost:3000/master/api/alquimia-general/items/te_item_6/students?view_layer=combo" | jq '.data.students[0].view_layer_used'
```

2. Verificar que `state` coincide con `state_by_view_layer[view_layer]`:
```bash
curl "http://localhost:3000/master/api/alquimia-general/items/te_item_6/students?view_layer=combo" | jq '.data.students[0] | {state, view_layer_used, state_by_view_layer_combo: .state_by_view_layer.combo.state}'
```

**Causas comunes**:
- `view_layer` no se pasa correctamente a `computeVisualState()`
- `state` top-level no se calcula desde `state_by_view_layer[view_layer]`

---

## CHECKLIST DE VERIFICACIÓN

Antes de considerar que el pipeline funciona correctamente:

- [ ] POST escribe en columnas correctas según `clean_layer`
- [ ] GET calcula `combo` correctamente (shared + pde)
- [ ] GET calcula `state_by_view_layer` para todas las view_layers
- [ ] GET devuelve `state` según `view_layer` actual
- [ ] UI consume `state_by_view_layer[view_layer]` (no campos legacy)
- [ ] UI renderiza estudiante en columna correcta según `visual_state`
- [ ] UI hace refetch después de POST
- [ ] Logs forenses incluyen `[CLEAN][WRITE]` y `[CLEAN][STATE]`

---

## REFERENCIAS

- `docs/CLEANING_ENGINE_CANONICAL_MODEL_V1.md` - Modelo canónico
- `src/core/master/services/cleaning-engine-service.js` - Motor de limpieza
- `src/services/alquimia-general-service.js` - Servicio de alquimia
- `src/endpoints/master-api-alquimia-general.js` - Endpoints API

---

**FIN DEL DOCUMENTO**
