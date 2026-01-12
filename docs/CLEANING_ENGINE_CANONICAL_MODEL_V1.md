# Cleaning Engine Canonical Model v1

**Fecha**: 2026-01-12  
**Dominio**: MASTER  
**Sistema**: Alquimia / Cleaning Engine  
**Versión**: v1.0.0  
**Estado**: CANÓNICO (no negociable)

---

## INTRODUCCIÓN

El Cleaning Engine es el sistema canónico de gestión de limpiezas energéticas en AuriPortal. Este documento define el modelo ontológico, las reglas de operación y los contratos que rigen todo el sistema de Alquimia.

**Principio Fundamental**: El Cleaning Engine es el ÚNICO decisor de estados de limpieza. La UI solo muestra, no decide.

---

## REGLAS ABSOLUTAS (NO VIOLAR)

1. **clean_layer decide ESCRITURA**. Nunca se infiere.
2. **view_layer decide CÁLCULO DE ESTADO y COLUMNA UI**.
3. **combo es SOLO view_layer**. Nunca clean_layer.
4. **No se permite inferencia implícita** en frontend ni backend.
5. **Fallar explícitamente es mejor que actuar mal** (HTTP 400).

**Violar estas reglas es una violación constitucional del sistema.**

---

## ONTOLOGÍA: clean_layer vs view_layer

### Diferencia Fundamental

El sistema distingue dos conceptos ontológicamente distintos:

#### clean_layer (Capa de Limpieza)

**Qué es**: La capa que decide QUÉ COLUMNAS se escriben en la base de datos.

**Cuándo se usa**: SOLO en operaciones de escritura (POST).

**Valores permitidos**: `['shared', 'pde']`  
**Preparado para futuro**: `['group', 'pair']` (sin activar todavía)

**Responsabilidad**:
- Determina si se escribe en `shared_clean_count` o `pde_clean_count`
- Determina si se actualiza `shared_last_cleaned_at` o `pde_last_cleaned_at`
- Determina si se recalcula `shared_remaining` o `pde_remaining`

**Reglas**:
- OBLIGATORIO en POST (escritura)
- PROHIBIDO: `clean_layer='combo'` (combo es SOLO view_layer)
- Validación explícita con `validateCleanLayer()` y `validateCleanLayerNotCombo()`
- Nunca se infiere desde contexto

#### view_layer (Capa de Vista)

**Qué es**: La capa que decide QUÉ ESTADO se calcula y QUÉ COLUMNA UI se muestra.

**Cuándo se usa**: SOLO en operaciones de lectura (GET).

**Valores permitidos**: `['shared', 'pde', 'combo']`

**Responsabilidad**:
- Determina qué datos se usan para calcular el estado visual
- Determina en qué columna UI aparece el estudiante
- Determina qué proyección se muestra (shared, pde o combo)

**Reglas**:
- OBLIGATORIO en GET para RECURRENTE
- Opcional en GET para UNA_VEZ (default: 'combo')
- Validación explícita con `validateViewLayer()`
- Nunca se infiere desde contexto

### Por Qué Esta Separación

**Problema que resuelve**: Evitar confusión entre "dónde escribo" y "qué muestro".

**Ejemplo práctico**:
- Master limpia con `clean_layer='pde'` → escribe en `pde_clean_count`
- UI muestra columna SHARED con `view_layer='shared'` → calcula estado desde `shared.days_since_last_clean`
- Resultado: La acción PDE no afecta la columna SHARED (correcto)

**Sin esta separación**: No se podría tener columnas independientes SHARED/PDE/COMBO.

---

## DEFINICIÓN DE CAPAS

### shared (Compartida)

**Qué es**: Limpiezas realizadas por el estudiante o visibles para el estudiante.

**Características**:
- Visible para estudiantes en su panel
- Se registra en `shared_clean_count`, `shared_last_cleaned_at`, `shared_remaining`
- Puede ser modificada por el estudiante (si tiene permisos)
- Se usa para calcular progreso visible del estudiante

**Cuándo usar**:
- Limpiezas realizadas por el estudiante
- Limpiezas que el estudiante debe ver
- Limpiezas que afectan el progreso visible

### pde (PDE - Programa de Desarrollo Espiritual)

**Qué es**: Limpiezas realizadas por Master o solo visibles para Master.

**Características**:
- Solo visible para Master
- Se registra en `pde_clean_count`, `pde_last_cleaned_at`, `pde_remaining`
- Solo puede ser modificada por Master
- Se usa para tracking interno de Master

**Cuándo usar**:
- Limpiezas realizadas por Master
- Limpiezas que solo Master debe ver
- Limpiezas que no afectan el progreso visible del estudiante

### combo (Combinada)

**Qué es**: Proyección calculada que suma shared + pde.

**Características**:
- NO se persiste en base de datos (es proyección)
- Se calcula en tiempo real: `combo.clean_count = shared.clean_count + pde.clean_count`
- Solo existe como `view_layer` (nunca como `clean_layer`)
- Útil para ver el total de limpiezas sin importar la capa

**Cuándo usar**:
- Vista que muestra el total de limpiezas (shared + pde)
- Útil para UNA_VEZ donde se quiere ver el progreso total
- NO se usa para escritura (solo lectura)

**Regla crítica**: `combo` es SOLO `view_layer`. Nunca se puede escribir con `clean_layer='combo'`.

---

## REGLA APU (Acción → Proyección → Ubicación)

La regla APU describe el flujo canónico de una limpieza:

### A: Acción (POST)

**Input**: `clean_layer` (obligatorio)

**Proceso**:
1. Usuario hace clic en botón de limpieza
2. Frontend envía POST con `clean_layer` explícito
3. Backend valida `clean_layer` (debe ser 'shared' o 'pde')
4. Cleaning Engine escribe en columnas correspondientes

**Ejemplo**:
```json
POST /master/api/alquimia-general/items/te_item_6/master/mark-clean-student
{
  "student_uuid": "44a51f8f-4ed5-4291-ad13-5f07a99c636b",
  "item_ref": "te_item_6",
  "item_kind": "una_vez",
  "clean_layer": "pde",  // ← DECIDE ESCRITURA
  "actor_type": "master",
  "surface_key": "master.alquimia_general"
}
```

**Resultado**: Se escribe en `pde_clean_count`, `pde_remaining`, etc.

### P: Proyección (GET)

**Input**: `view_layer` (obligatorio para RECURRENTE)

**Proceso**:
1. Backend lee `shared` y `pde` desde `cleaning_item_state`
2. Calcula `combo` como proyección (shared + pde)
3. Calcula estados para cada `view_layer` usando `computeVisualState()`
4. Devuelve `state_by_view_layer` con todos los estados

**Ejemplo**:
```
GET /master/api/alquimia-general/items/te_item_6/students?view_layer=combo
```

**Resultado**:
```json
{
  "student_uuid": "...",
  "shared": { "clean_count": 5, "remaining": 10 },
  "pde": { "clean_count": 2, "remaining": 8 },
  "combo": { "clean_count": 7, "remaining": 3 },
  "state_by_view_layer": {
    "shared": { "state": "pending", "visual_state": "in_progress" },
    "pde": { "state": "pending", "visual_state": "in_progress" },
    "combo": { "state": "pending", "visual_state": "in_progress" }
  },
  "state": "pending",  // Según view_layer='combo'
  "view_layer_used": "combo"
}
```

### U: Ubicación (UI)

**Input**: `view_layer` (determina columna)

**Proceso**:
1. UI consume `state_by_view_layer[view_layer]`
2. Determina en qué columna mostrar el estudiante
3. Renderiza según el estado calculado

**Ejemplo**:
```javascript
// Columna COMBO
const students = await fetch(`/items/${itemRef}/students?view_layer=combo`);
students.forEach(student => {
  const state = student.state_by_view_layer.combo;
  // Renderizar en columna según state.visual_state
  if (state.visual_state === 'in_progress') {
    // Columna "En proceso"
  }
});
```

**Resultado**: Estudiante aparece en la columna correcta según `view_layer`.

---

## EJEMPLOS COMPLETOS

### Ejemplo 1: RECURRENTE con view_layer='shared'

**Escenario**: Master limpia item RECURRENTE con `clean_layer='pde'`, UI muestra columna SHARED.

**1. Acción (POST)**:
```json
POST /master/api/alquimia-general/items/te_item_1/master/mark-clean-student
{
  "clean_layer": "pde",  // Escribe en pde_*
  "item_kind": "recurrente"
}
```

**2. Estado en DB** (después de POST):
```sql
SELECT shared_last_cleaned_at, pde_last_cleaned_at 
FROM cleaning_item_state 
WHERE item_ref = 'te_item_1';

-- Resultado:
-- shared_last_cleaned_at: NULL (no cambió)
-- pde_last_cleaned_at: '2026-01-12 10:00:00' (actualizado)
```

**3. Proyección (GET)**:
```
GET /master/api/alquimia-general/items/te_item_1/students?view_layer=shared
```

**4. Cálculo de Estado**:
```javascript
// computeVisualState() usa view_layer='shared'
const daysSince = shared.days_since_last_clean;  // 10 días (no cambió)
const state = daysSince < threshold_days ? 'reviewed' : 'pending';
// Resultado: state = 'pending' (porque shared no cambió)
```

**5. Ubicación (UI)**:
- Estudiante aparece en columna "Pendiente" (porque `state='pending'`)
- La acción PDE NO afectó la columna SHARED (correcto)

### Ejemplo 2: UNA_VEZ con view_layer='combo'

**Escenario**: Master limpia item UNA_VEZ con `clean_layer='pde'`, UI muestra columna COMBO.

**1. Acción (POST)**:
```json
POST /master/api/alquimia-general/items/te_item_6/master/mark-clean-student
{
  "clean_layer": "pde",  // Escribe en pde_*
  "item_kind": "una_vez"
}
```

**2. Estado en DB** (después de POST):
```sql
SELECT shared_clean_count, pde_clean_count 
FROM cleaning_item_state 
WHERE item_ref = 'te_item_6';

-- Antes:
-- shared_clean_count: 5
-- pde_clean_count: 2

-- Después:
-- shared_clean_count: 5 (no cambió)
-- pde_clean_count: 3 (aumentó)
```

**3. Proyección (GET)**:
```
GET /master/api/alquimia-general/items/te_item_6/students?view_layer=combo
```

**4. Cálculo de Estado**:
```javascript
// computeVisualState() usa view_layer='combo'
const comboCount = shared.clean_count + pde.clean_count;  // 5 + 3 = 8
const requiredCount = 15;
const state = comboCount < requiredCount ? 'pending' : 'completed';
// Resultado: state = 'pending', visual_state = 'in_progress'
```

**5. Ubicación (UI)**:
- Estudiante aparece en columna "En proceso" (porque `visual_state='in_progress'`)
- La acción PDE SÍ afectó la columna COMBO (correcto, porque combo = shared + pde)

---

## ERRORES PROHIBIDOS Y POR QUÉ

### Error 1: Usar clean_layer='combo'

**Qué pasa**:
```json
POST /items/te_item_6/master/mark-clean-student
{
  "clean_layer": "combo"  // ❌ PROHIBIDO
}
```

**Por qué está prohibido**:
- `combo` es una proyección calculada, no una capa de escritura
- No existe columna `combo_clean_count` en la base de datos
- Escribir en "combo" no tiene sentido ontológico

**Qué hacer**:
- Usar `clean_layer='shared'` o `clean_layer='pde'`
- Si se quiere afectar ambas, hacer dos POST separados

### Error 2: Inferir clean_layer desde view_layer

**Qué pasa**:
```javascript
// ❌ PROHIBIDO
const cleanLayer = viewLayer;  // Inferir desde view_layer
```

**Por qué está prohibido**:
- `clean_layer` y `view_layer` son conceptos distintos
- Pueden tener valores diferentes (ej: `clean_layer='pde'`, `view_layer='shared'`)
- La inferencia introduce bugs sutiles

**Qué hacer**:
- `clean_layer` debe venir explícitamente en POST
- Nunca inferir desde contexto

### Error 3: Calcular estado en UI

**Qué pasa**:
```javascript
// ❌ PROHIBIDO
const state = student.shared.clean_count + student.pde.clean_count > 10 ? 'completed' : 'pending';
```

**Por qué está prohibido**:
- La UI no debe duplicar lógica del backend
- El backend es la única autoridad de estados
- Duplicar lógica introduce desincronización

**Qué hacer**:
- Consumir `state_by_view_layer[view_layer]` del backend
- Nunca calcular estados en frontend

### Error 4: Usar campos legacy top-level

**Qué pasa**:
```javascript
// ❌ PROHIBIDO
const state = student.state;  // Campo legacy ambiguo
```

**Por qué está prohibido**:
- Los campos legacy (`state`, `clean_count`, `remaining`) son ambiguos
- No indican de qué capa provienen
- Pueden estar desincronizados

**Qué hacer**:
- Usar `student.state_by_view_layer[view_layer].state`
- Usar `student.shared.clean_count` o `student.pde.clean_count`
- Nunca usar campos top-level ambiguos

---

## BACKEND — SERVICIOS

### Separación de Responsabilidades

#### Lógica de Escritura (usa clean_layer)

**Archivo**: `src/core/master/services/cleaning-engine-service.js`

**Función principal**: `markCleanStudent()`

**Responsabilidad**:
- Validar `clean_layer` (obligatorio, no 'combo')
- Escribir en columnas `shared_*` o `pde_*` según `clean_layer`
- Registrar evento en `cleaning_events`
- Actualizar proyección en `cleaning_item_state`

**Logs**: `[CLEAN][WRITE]` con `clean_layer` y `delta`

#### Lógica de Cálculo de Estado (usa view_layer)

**Archivo**: `src/services/alquimia-general-service.js`

**Función principal**: `computeVisualState()`

**Responsabilidad**:
- Calcular estado según `view_layer` y `item_kind`
- Generar `state_by_view_layer` con todos los estados
- Proyectar `combo` (shared + pde) si es necesario

**Logs**: `[CLEAN][STATE]` con `view_layer` y `computed_state`

### Función Canónica: computeVisualState()

```javascript
computeVisualState({ shared, pde, combo, item_kind, view_layer, config })
```

**Parámetros**:
- `shared`: Datos shared { clean_count, days_since_last_clean, remaining, completed }
- `pde`: Datos pde { clean_count, days_since_last_clean, remaining, completed }
- `combo`: Datos combo { clean_count, remaining, completed } (calculado)
- `item_kind`: 'recurrente' | 'una_vez'
- `view_layer`: 'shared' | 'pde' | 'combo'
- `config`: { threshold_days, critical_multiplier, required_count }

**Retorna**:
```javascript
{
  state: 'reviewed' | 'pending' | 'important' | 'never' | 'completed',
  visual_state: 'reviewed' | 'pending' | 'important' | 'never' | 'in_progress' | 'completed' | 'empowered',
  computed_state: {
    view_layer: 'shared',
    days_since_last_clean: 3,  // Para RECURRENTE
    // o
    clean_count: 8,  // Para UNA_VEZ
    remaining: 7
  }
}
```

**Para RECURRENTE**:
- `view_layer='shared'` → usa `shared.days_since_last_clean`
- `view_layer='pde'` → usa `pde.days_since_last_clean`
- Estados: `never`, `reviewed`, `pending`, `important`

**Para UNA_VEZ**:
- `view_layer='combo'` → usa `combo.clean_count` (shared + pde)
- `view_layer='shared'` → usa `shared.clean_count`
- `view_layer='pde'` → usa `pde.clean_count`
- Estados: `never`, `in_progress`, `completed`, `empowered`

---

## BACKEND — ENDPOINTS

### POST (Escritura)

**Reglas**:
- `clean_layer` OBLIGATORIO
- `view_layer` PROHIBIDO (no se envía en POST)
- Rechazar `clean_layer='combo'` (HTTP 400)

**Endpoints**:
- `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student`
- `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-all`
- `POST /master/api/alquimia-general/items/:item_ref/master/increment-all`

**Ejemplo**:
```json
POST /master/api/alquimia-general/items/te_item_6/master/mark-clean-student
{
  "student_uuid": "44a51f8f-4ed5-4291-ad13-5f07a99c636b",
  "item_ref": "te_item_6",
  "item_kind": "recurrente",
  "clean_layer": "shared",  // OBLIGATORIO
  "actor_type": "master",
  "surface_key": "master.alquimia_general"
}
```

**Validación**:
```javascript
// En endpoint
if (!cleanLayer) {
  return jsonError('clean_layer is required in POST', 'CLEAN_LAYER_REQUIRED', 400);
}
validateCleanLayer(cleanLayer);
validateCleanLayerNotCombo(cleanLayer);  // Rechazar 'combo'
```

### GET (Lectura)

**Reglas**:
- `view_layer` OBLIGATORIO para RECURRENTE
- `view_layer` opcional para UNA_VEZ (default: 'combo')
- Permitir `view_layer='combo'`
- Rechazar `view_layer` desconocido (HTTP 400)

**Endpoint**:
- `GET /master/api/alquimia-general/items/:item_ref/students`

**Ejemplo**:
```
GET /master/api/alquimia-general/items/te_item_6/students?view_layer=shared
GET /master/api/alquimia-general/items/te_item_6/students?view_layer=combo
```

**Validación**:
```javascript
// En endpoint
if (tipo === 'recurrente' && !viewLayer) {
  return jsonError('view_layer is required for RECURRENTE', 'VIEW_LAYER_REQUIRED', 400);
}
if (viewLayer) {
  validateViewLayer(viewLayer);  // Rechazar valores desconocidos
}
```

---

## PROYECCIÓN

El backend devuelve estructura canónica:

```json
{
  "student_uuid": "44a51f8f-4ed5-4291-ad13-5f07a99c636b",
  "display_name": "Eugeni el Magnànim",
  "shared": {
    "clean_count": 5,
    "days_since_last_clean": 3,
    "remaining": 10,
    "completed": 0,
    "last_cleaned_at": "2026-01-09T10:00:00Z"
  },
  "pde": {
    "clean_count": 2,
    "days_since_last_clean": 1,
    "remaining": 8,
    "completed": 0,
    "last_cleaned_at": "2026-01-11T10:00:00Z"
  },
  "combo": {
    "clean_count": 7,
    "remaining": 3,
    "completed": 0
  },
  "state_by_view_layer": {
    "shared": {
      "state": "reviewed",
      "visual_state": "reviewed",
      "computed_state": {
        "view_layer": "shared",
        "days_since_last_clean": 3,
        "threshold_days": 7,
        "critical_threshold": 14
      }
    },
    "pde": {
      "state": "reviewed",
      "visual_state": "reviewed",
      "computed_state": {
        "view_layer": "pde",
        "days_since_last_clean": 1,
        "threshold_days": 7,
        "critical_threshold": 14
      }
    },
    "combo": {
      "state": "pending",
      "visual_state": "in_progress",
      "computed_state": {
        "view_layer": "combo",
        "clean_count": 7,
        "remaining": 3,
        "required_count": 15
      }
    }
  },
  "state": "pending",  // Estado según view_layer actual
  "visual_state": "in_progress",
  "view_layer_used": "combo"
}
```

**Regla**: La UI NO calcula estados. Consume `state_by_view_layer[view_layer]`.

---

## UI (MASTER)

### Reglas

1. Cada columna consume SOLO su `view_layer` correspondiente
2. Prohibido usar campos legacy o top-level ambiguos
3. Tras cada acción:
   - Refetch con `view_layer` actual
   - Verificar movimiento de columna

### Ejemplo

```javascript
// Columna SHARED
async function loadSharedColumn(itemRef) {
  const response = await fetch(
    `/master/api/alquimia-general/items/${itemRef}/students?view_layer=shared`
  );
  const data = await response.json();
  
  data.data.students.forEach(student => {
    const state = student.state_by_view_layer.shared;
    // Renderizar según state.visual_state
    if (state.visual_state === 'reviewed') {
      // Columna "Revisado"
    } else if (state.visual_state === 'pending') {
      // Columna "Pendiente"
    }
  });
}

// Columna COMBO
async function loadComboColumn(itemRef) {
  const response = await fetch(
    `/master/api/alquimia-general/items/${itemRef}/students?view_layer=combo`
  );
  const data = await response.json();
  
  data.data.students.forEach(student => {
    const state = student.state_by_view_layer.combo;
    // Renderizar según state.visual_state
    if (state.visual_state === 'in_progress') {
      // Columna "En proceso"
    }
  });
}
```

---

## FORÉNSICA

### Logs Obligatorios

#### [CLEAN][WRITE]

**Cuándo**: Después de escribir en `cleaning_item_state`

**Contenido**:
- `clean_layer`: Capa de escritura
- `delta`: Cambios aplicados

**Ejemplo**:
```javascript
logInfo('CleaningEngine', '[CLEAN][WRITE] Proyección aplicada', {
  traceId,
  student_uuid,
  item_ref,
  clean_layer: 'pde',
  item_kind: 'una_vez',
  delta: {
    shared_clean_count: 5,  // No cambió
    pde_clean_count: 3,      // Aumentó de 2 a 3
    shared_remaining: 10,    // No cambió
    pde_remaining: 7         // Disminuyó de 8 a 7
  }
});
```

#### [CLEAN][STATE]

**Cuándo**: Después de calcular estado visual

**Contenido**:
- `view_layer`: Capa de vista usada
- `computed_state`: Estado calculado

**Ejemplo**:
```javascript
logInfo('AlquimiaGeneralService', '[CLEAN][STATE] Estado RECURRENTE calculado', {
  traceId,
  student_uuid,
  item_ref,
  view_layer: 'shared',
  computed_state: {
    days_since_last_clean: 3,
    threshold_days: 7,
    critical_threshold: 14,
    state: 'reviewed'
  }
});
```

#### [CLEAN][COLUMN]

**Cuándo**: Cuando un estudiante cambia de columna (UI)

**Contenido**:
- `from`: Columna origen
- `to`: Columna destino
- `view_layer`: Capa de vista

**Ejemplo**:
```javascript
logInfo('AlquimiaGeneralService', '[CLEAN][COLUMN] Movimiento de columna', {
  traceId,
  student_uuid,
  item_ref,
  from: 'pending',
  to: 'reviewed',
  view_layer: 'shared'
});
```

---

## VERIFICACIÓN

### Script Automático

`scripts/verify-cleaning-pipeline.js`

**Ejecuta**:
1. SHARED → Limpiar item con `clean_layer='shared'`
2. PDE → Limpiar item con `clean_layer='pde'`
3. COMBO → Verificar que `combo.clean_count = shared.clean_count + pde.clean_count`

**Verifica**:
- DB: Estado en `cleaning_item_state`
- GET: Respuesta con `state_by_view_layer`
- UI: Columnas correctas según `view_layer`

**Uso**:
```bash
node scripts/verify-cleaning-pipeline.js
```

---

## REFERENCIAS

- `src/core/master/services/cleaning-layer-constants.js` - Constantes y validadores
- `src/core/master/services/cleaning-engine-service.js` - Motor de limpieza
- `src/services/alquimia-general-service.js` - Servicio de alquimia
- `src/endpoints/master-api-alquimia-general.js` - Endpoints API
- `docs/CLEANING_ENGINE_EXTENSIBILITY.md` - Extensibilidad (group/pair)
- `docs/COLUMN_PIPELINE_AUTHORITY.md` - Pipeline completo
- `docs/CURSOR_RULES_CLEANING_ENGINE.md` - Reglas para agentes

---

**FIN DEL DOCUMENTO**
