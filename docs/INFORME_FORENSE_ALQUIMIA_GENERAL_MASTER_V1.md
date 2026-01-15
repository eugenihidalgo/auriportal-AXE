# 🔍 INFORME FORENSE TOTAL — ALQUIMIA GENERAL (MASTER)

**Fecha:** 2025-01-27  
**Objetivo:** Descripción quirúrgica del estado actual del sistema Alquimia General en dominio MASTER, sin propuestas ni diagnósticos causales.

**⚠️ REGLAS ABSOLUTAS CUMPLIDAS:**
- ✅ NO se implementaron cambios
- ✅ NO se propusieron soluciones
- ✅ NO se diagnosticaron causas
- ✅ Todo sustentado con paths + líneas exactas
- ✅ Solo observación y descripción

---

## FASE 1 — INVENTARIO BACKEND

### 1.1) Endpoints API Alquimia General

**Handler Principal:** `src/endpoints/master-api-alquimia-general.js` (1706 líneas)

#### Endpoints de Listas

| Método | Ruta | Líneas | Parámetros | Payload Devuelto |
|--------|------|--------|------------|------------------|
| GET | `/master/api/alquimia-general/listas` | 121-181 | `?tipo=recurrente\|una_vez` | `{ ok: true, listas: Array, trace_id }` |
| POST | `/master/api/alquimia-general/listas` | 184-233 | Body: `{ nombre, tipo, descripcion?, orden?, status? }` | `{ ok: true, lista: Object, trace_id }` (201) |
| GET | `/master/api/alquimia-general/listas/:id` | 236-298 | `:id` (path) | `{ ok: true, lista: Object, trace_id }` |
| PUT | `/master/api/alquimia-general/listas/:id` | 301-392 | `:id` (path), Body: `{ nombre?, tipo?, descripcion?, orden?, classification? }` | `{ ok: true, lista: Object, trace_id }` |
| DELETE | `/master/api/alquimia-general/listas/:id` | 395-433 | `:id` (path) | `{ ok: true, lista: Object, deleted_at: string, trace_id }` |
| GET | `/master/api/alquimia-general/listas/:id/classification` | 436-467 | `:id` (path) | `{ ok: true, classification: { category_key, subtype_key, tags }, trace_id }` |
| PUT | `/master/api/alquimia-general/listas/:id/classification` | 470-546 | `:id` (path), Body: `{ category_key?, subtype_key?, tags? }` | `{ ok: true, classification: Object, trace_id }` |

#### Endpoints de Items

| Método | Ruta | Líneas | Parámetros | Payload Devuelto |
|--------|------|--------|------------|------------------|
| GET | `/master/api/alquimia-general/listas/:id/items` | 600-606 | `:id` (path) | `{ ok: true, items: Array, trace_id }` |
| POST | `/master/api/alquimia-general/items` | 729-795 | Body: `{ lista_id, nombre, nivel?, priority?, days?, frecuencia_dias?, veces_limpiar?, grupo?, descripcion?, status? }` | `{ ok: true, data: { item }, trace_id }` (201) |
| GET | `/master/api/alquimia-general/items/:id` | 825-841 | `:id` (path) | `{ ok: true, item: Object, trace_id }` |
| PUT | `/master/api/alquimia-general/items/:id` | 844-896 | `:id` (path), Body: `{ nombre?, descripcion?, nivel?, prioridad?, frecuencia_dias?, veces_limpiar?, grupo? }` | `{ ok: true, data: { item }, trace_id }` |
| DELETE | `/master/api/alquimia-general/items/:id` | 899-909 | `:id` (path) | `{ ok: true, item: Object, trace_id }` |

#### Endpoints de Proyección

| Método | Ruta | Líneas | Parámetros | Payload Devuelto |
|--------|------|--------|------------|------------------|
| GET | `/master/api/alquimia-general/list-projection` | 609-726 | `?list_id=&item_kind=&view_layer=&scope=&student_uuid=` | `{ ok: true, data: { items, metrics, list_state, view_layer, item_kind, scope, student_uuid, list_meta }, trace_id }` |

**Validaciones Obligatorias:**
- `list_id`: requerido (400 si falta)
- `item_kind`: requerido, debe ser `'recurrente'` o `'una_vez'` (400 si inválido)
- `view_layer`: requerido, debe ser `'shared'`, `'pde'`, `'combo'` o `'effective'` (400 si falta)
- `scope`: requerido, debe ser `'all'` o `'student'` (400 si inválido)
- `student_uuid`: requerido si `scope='student'` (400 si falta)

#### Endpoints de Flotantes (Modal de Alumnos)

| Método | Ruta | Líneas | Parámetros | Payload Devuelto |
|--------|------|--------|------------|------------------|
| GET | `/master/api/alquimia-general/items/:item_ref/students` | 916-1109 | `:item_ref` (path), `?product_key=pde&clean_layer=shared\|pde&view_layer=shared\|pde\|combo\|effective&limit=&offset=` | `{ ok: true, data: { item_ref, tipo, students: Array, counts: { reviewed, pending, important, never }, total, threshold_days, critical_multiplier }, warnings?, trace_id }` |

**Estructura de `students` Array:**
```javascript
{
  student_uuid: string,
  display_name: string,
  shared: {
    state: 'reviewed' | 'pending' | 'important' | 'never',
    visual_state: string,
    days_since_last_clean: number | null,
    last_cleaned_at: string | null,
    clean_count: number,
    completed: number,
    remaining: number | null
  },
  pde: {
    state: 'reviewed' | 'pending' | 'important' | 'never',
    visual_state: string,
    days_since_last_clean: number | null,
    last_cleaned_at: string | null,
    clean_count: number,
    completed: number,
    remaining: number | null
  },
  state_by_view_layer: {
    shared: { state, visual_state, computed_state },
    pde: { state, visual_state, computed_state },
    combo?: { state, visual_state, computed_state },
    effective?: { state, visual_state, computed_state, effective_sources }
  }
}
```

**Reglas Específicas:**
- `view_layer` es OBLIGATORIO para RECURRENTE (400 si falta)
- `view_layer` puede ser opcional para UNA_VEZ (default: 'combo')
- Validación de coherencia `view_layer + item_kind` (400 si no coincide)
- `skip_level_filter=true` siempre (Master no filtra por nivel)

#### Endpoints de Acciones de Limpieza

| Método | Ruta | Líneas | Parámetros | Payload Devuelto |
|--------|------|--------|------------|------------------|
| POST | `/master/api/alquimia-general/items/:item_ref/master/mark-clean-all` | 1112-1149 | `:item_ref` (path), Body: `{ clean_layer: 'shared'\|'pde', item_kind: 'recurrente'\|'una_vez', execution_mode?: 'APPLY'\|'CERTIFY' }` | `{ ok: true, applied, skipped, applied_layer, item_kind, trace_id }` |
| POST | `/master/api/alquimia-general/items/:item_ref/master/mark-clean-student` | 1152-1291 | `:item_ref` (path), Body: `{ student_uuid, item_kind, clean_layer, actor_type, surface_key, actor_ref?, meta? }` | `{ ok: true, state: Object, applied_layer, item_kind, student: { student_uuid, display_name }, trace_id }` |
| POST | `/master/api/alquimia-general/items/:item_ref/master/mark-pde-clean-all` | 1294-1340 | `:item_ref` (path), Body: `{ item_kind, execution_mode? }` | `{ ok: true, data: { applied, skipped }, trace_id }` |
| POST | `/master/api/alquimia-general/items/:item_ref/master/increment-all` | 1343-1383 | `:item_ref` (path), Body: `{ clean_layer, item_kind }` | `{ ok: true, applied, skipped, applied_layer, item_kind, trace_id }` |
| POST | `/master/api/alquimia-general/items/:item_ref/master/adjust-remaining` | 1386-1412 | `:item_ref` (path), Body: `{ student_id, remaining }` | `{ ok: true, state: Object, trace_id }` |

#### Endpoints de Reset

| Método | Ruta | Líneas | Parámetros | Payload Devuelto |
|--------|------|--------|------------|------------------|
| POST | `/master/api/alquimia-general/reset-item` | 1514-1589 | Body: `{ student_uuid, item_ref, item_kind?, scope: 'student', product_key?, domain_type? }` | `{ ok: true, reset: true, item_ref, item_kind, deleted, trace_id }` |
| POST | `/master/api/alquimia-general/reset-list` | 1592-1667 | Body: `{ student_uuid, list_id, item_kind?, scope: 'student', product_key?, domain_type? }` | `{ ok: true, reset: true, list_id, item_kind, deleted_count, trace_id }` |

**Regla Constitucional:** `scope` DEBE ser `'student'` (400 si no coincide)

### 1.2) Servicios Backend

#### Cleaning Engine Service

**Path:** `src/core/master/services/cleaning-engine-service.js` (863+ líneas)

**Funciones Principales:**

1. **`markCleanStudent(options)`** (líneas 146-863)
   - **Input:** `{ student_uuid, item_ref, item_kind, clean_layer, product_key, domain_type, actor_type, actor_ref?, surface_key, level_cap_override?, execution_mode?, meta? }`
   - **Validaciones:**
     - `student_uuid`: UUID válido (regex)
     - `item_kind`: 'recurrente' o 'una_vez'
     - `clean_layer`: 'shared' o 'pde' (no 'combo')
     - `actor_type`: requerido
     - `surface_key`: requerido
   - **Proceso:**
     1. Verifica si alumno está en pausa (retorna `null` si está pausado)
     2. Obtiene item desde catálogo
     3. Valida nivel (excepto si `actor_type === 'master'`)
     4. Genera `execution_key` (idempotente para APPLY, único para CERTIFY)
     5. Inserta evento en `cleaning_events` (con idempotencia)
     6. Actualiza `cleaning_item_state` (proyección)
     7. Emite señales (fail-open)
   - **Output:** `{ state, visual_state, computed_state }` o `null` (si pausado/no aplica)

2. **`getStudentEffectiveLevel(studentUuid, lineKey)`** (líneas 99-120)
   - Consulta Level Engine vía `student-level-state-repo-pg.js`
   - Retorna nivel efectivo (default: 1 si no existe)

3. **`generateExecutionKey(...)`** (líneas 49-66)
   - **APPLY (idempotente):**
     - RECURRENTE: `{action_type}:{item_ref}:{student_uuid}:{clean_layer}:{day}`
     - UNA_VEZ: `{action_type}:{item_ref}:{student_uuid}:{day}`
   - **CERTIFY (no idempotente):**
     - `certify:{item_ref}:{student_uuid}:{timestamp_iso}`

#### Cleaning Projection Model (CPM)

**Path:** `src/core/master/services/cleaning-projection-model.js` (354 líneas)

**Función Principal:** `computeStateForLayer(viewLayer, cleaningState, itemKind, config)`

**Lógica de Estados:**

**RECURRENTE:**
- `never`: `days_since_last_clean === null || undefined`
- `reviewed`: `days_since_last_clean < threshold_days`
- `pending`: `threshold_days <= days_since_last_clean < (threshold_days * critical_multiplier)`
- `important`: `days_since_last_clean >= (threshold_days * critical_multiplier)`

**UNA_VEZ:**
- `never`: `clean_count === 0`
- `reviewed`: `clean_count >= required_count && remaining === 0`
- `pending`: `clean_count < required_count || remaining > 0`
- `important`: (no aplica para una_vez)

**view_layer='effective' (solo RECURRENTE):**
- Proyección agregada de `shared` + `pde`
- `effective_state` = mejor estado entre shared y pde
- `effective_days_since` = mínimo entre shared y pde
- `effective_sources` = `{ shared: boolean, pde: boolean }` (indica qué capas están en 'reviewed')

**view_layer='combo' (solo UNA_VEZ):**
- Suma `shared.completed + pde.completed`
- `remaining = max(required_count - combo.completed, 0)`

#### Alquimia General Service

**Path:** `src/services/alquimia-general-service.js` (1513+ líneas)

**Funciones Principales:**

1. **`getStudentsForItem(itemRef, tipo, productKey, options)`** (líneas 600-1100 aprox.)
   - **Input:** `{ limit?, offset?, clean_layer?, view_layer?, skip_level_filter? }`
   - **Proceso:**
     1. Obtiene item desde catálogo
     2. Obtiene lista para conocer tipo
     3. Valida `view_layer` según tipo
     4. Llama a repositorio para obtener estudiantes con estados
     5. Calcula `state_by_view_layer` usando CPM
     6. Agrupa por estado (reviewed, pending, important, never)
   - **Output:** `{ students: Array, counts: Object, total: number, threshold_days, critical_multiplier }`

2. **`markCleanAll(itemRef, productKey, cleanLayer, itemKind, executionMode)`**
   - Llama a Cleaning Engine para todos los estudiantes activos (no pausados)
   - Retorna `{ applied: number, skipped: number }`

3. **`markPdeCleanAll(itemRef, productKey, ctx, itemKind, executionMode)`**
   - Similar a `markCleanAll` pero específico para capa PDE

4. **`incrementAll(itemRef, productKey, cleanLayer, itemKind)`**
   - Incrementa `completed` en +1 para todos los estudiantes (una_vez)

### 1.3) Tablas de Base de Datos

#### `cleaning_events` (append-only audit)

**Migración:** `database/migrations/v5.59.0-cleaning-engine-v1.sql` (líneas 22-66)

**Estructura:**
```sql
CREATE TABLE cleaning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL, -- UUID canónico (renombrado desde student_uuid)
  product_key VARCHAR(50) NOT NULL,
  domain_type VARCHAR(50) NOT NULL,
  item_ref VARCHAR(255) NOT NULL,
  clean_layer VARCHAR(20) NOT NULL, -- 'shared' | 'pde'
  item_kind VARCHAR(20) NOT NULL, -- 'recurrente' | 'una_vez'
  action_type VARCHAR(50) NOT NULL, -- 'mark_clean' | 'set_remaining'
  execution_key VARCHAR(500) NOT NULL, -- Clave de idempotencia
  actor_type VARCHAR(50) NOT NULL, -- 'master' | 'student' | 'automation'
  actor_ref VARCHAR(255),
  surface_key VARCHAR(255),
  delta_completed INTEGER, -- Incremento para una_vez
  set_remaining INTEGER, -- Valor establecido
  meta JSONB,
  trace_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Índices:**
- `idx_cleaning_events_student_item` (student_id, product_key, domain_type, item_ref)
- `idx_cleaning_events_item_layer` (item_ref, clean_layer)
- `idx_cleaning_events_trace` (trace_id)
- `idx_cleaning_events_execution_student` UNIQUE (execution_key, student_id)

**Reglas:**
- Append-only (no se modifica ni elimina)
- Idempotencia vía `execution_key` (unique constraint)
- Soporta 2 capas (shared/pde) independientes

#### `cleaning_item_state` (proyección canónica)

**Migración:** `database/migrations/v5.59.0-cleaning-engine-v1.sql` (líneas 71-123)

**Estructura:**
```sql
CREATE TABLE cleaning_item_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL, -- UUID canónico
  product_key VARCHAR(50) NOT NULL,
  domain_type VARCHAR(50) NOT NULL,
  item_ref VARCHAR(255) NOT NULL,
  -- SHARED (visible al alumno)
  shared_last_cleaned_at TIMESTAMP,
  shared_clean_count INTEGER DEFAULT 0,
  shared_completed INTEGER DEFAULT 0, -- Para una_vez
  shared_remaining INTEGER, -- Para una_vez
  -- PDE (repaso master-only)
  pde_last_cleaned_at TIMESTAMP,
  pde_clean_count INTEGER DEFAULT 0,
  pde_completed INTEGER DEFAULT 0, -- Para una_vez
  pde_remaining INTEGER, -- Para una_vez
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(student_id, product_key, domain_type, item_ref)
);
```

**Índices:**
- `idx_cleaning_item_state_item_ref` (item_ref)
- `idx_cleaning_item_state_shared_last_cleaned` (shared_last_cleaned_at) WHERE shared_last_cleaned_at IS NOT NULL
- `idx_cleaning_item_state_pde_last_cleaned` (pde_last_cleaned_at) WHERE pde_last_cleaned_at IS NOT NULL
- `idx_cleaning_item_state_student_uuid_item` (student_id, product_key, domain_type, item_ref)

**Reglas:**
- Proyección optimizada para lecturas
- Se actualiza desde `cleaning_events` (no se escribe directamente)
- Soporta 2 capas independientes (shared/pde)

#### `listas_transmutaciones` (catálogo)

**Path:** `database/pg.js` (líneas 1354-1371)

**Estructura:**
```sql
CREATE TABLE listas_transmutaciones (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  tipo VARCHAR(20) NOT NULL, -- 'recurrente' | 'una_vez'
  descripcion TEXT,
  orden INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active', -- 'active' | 'archived'
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `items_transmutaciones` (catálogo)

**Path:** `database/pg.js` (líneas 1372-1439)

**Estructura:**
```sql
CREATE TABLE items_transmutaciones (
  id SERIAL PRIMARY KEY,
  lista_id INTEGER NOT NULL REFERENCES listas_transmutaciones(id),
  item_ref VARCHAR(255) UNIQUE NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  nivel INTEGER, -- 1-9
  prioridad INTEGER DEFAULT 10,
  frecuencia_dias INTEGER, -- Para recurrentes
  veces_limpiar INTEGER, -- Para una_vez (required_count)
  grupo VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active', -- 'active' | 'archived'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 1.4) Cálculo de Estados

**Ubicación:** `src/core/master/services/cleaning-projection-model.js`

**Condiciones Exactas:**

**RECURRENTE:**
- **never:** `shared_last_cleaned_at === null && pde_last_cleaned_at === null` (para view_layer específico)
- **pending:** `days_since_last_clean >= threshold_days && days_since_last_clean < (threshold_days * critical_multiplier)`
- **important:** `days_since_last_clean >= (threshold_days * critical_multiplier)`
- **reviewed:** `days_since_last_clean < threshold_days`

**UNA_VEZ:**
- **never:** `clean_count === 0` (combo suma shared + pde)
- **reviewed:** `clean_count >= required_count && remaining === 0`
- **pending:** `clean_count < required_count || remaining > 0`
- **important:** (no aplica)

**Diferencia never vs pending:**
- `never` = nunca limpiado (no existe registro en `cleaning_item_state` o `last_cleaned_at === null`)
- `pending` = limpio antes pero ahora necesita limpieza (existe `last_cleaned_at` pero `days_since >= threshold_days`)

### 1.5) Acciones Clean y Reset

#### Clean (markCleanStudent)

**Qué hace:**
1. Inserta evento en `cleaning_events` (si no existe por idempotencia)
2. Actualiza `cleaning_item_state`:
   - RECURRENTE: `{clean_layer}_last_cleaned_at = NOW()`, `{clean_layer}_clean_count += 1`
   - UNA_VEZ: `{clean_layer}_completed += 1`, `{clean_layer}_remaining = max(required_count - completed, 0)`
3. Emite señales (fail-open)

**Qué NO toca:**
- Overrides (tabla `student_item_overrides`)
- Tabla `student_item_state` (histórica, no usada en runtime)
- Tabla `alumnos` (legacy, no usada en runtime)

#### Reset (resetStudentItemProgress)

**Qué hace:**
1. Elimina registros de `cleaning_item_state` para el item_ref específico
2. NO elimina eventos de `cleaning_events` (append-only)
3. Retorna `deleted: true` si eliminó algo

**Qué NO toca:**
- `cleaning_events` (histórico se conserva)
- Overrides
- Catálogo (items/listas)

---

## FASE 2 — ALUMNOS Y student_uuid

### 2.1) Definición de student_uuid

**Source of Truth:** Tabla `students` (UUID canónico)

**Path:** `database/pg.js` (estructura no visible en migraciones, pero referenciada en código)

**Formato:** UUID v4 (regex: `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`)

### 2.2) Pase de student_uuid a Proyección ALUMNO

**Endpoint:** `GET /master/api/alquimia-general/list-projection`

**Parámetros:**
- `scope='student'` (obligatorio)
- `student_uuid` (obligatorio si scope='student')

**Validación:** Líneas 640-642 de `master-api-alquimia-general.js`
```javascript
if (scope === 'student' && !studentUuid) {
  return jsonError('student_uuid es requerido cuando scope="student"', 'MISSING_STUDENT_UUID', 400, traceId);
}
```

**Uso en Servicio:** Líneas 645-651
```javascript
const projection = await computeListProjection({
  list_id: parseInt(listId, 10),
  item_kind: itemKind,
  view_layer: viewLayer,
  scope: scope,
  student_uuid: scope === 'student' ? studentUuid : null
});
```

### 2.3) Pase de student_uuid a Flotantes

**Endpoint:** `GET /master/api/alquimia-general/items/:item_ref/students`

**Parámetros:**
- `view_layer` (obligatorio para RECURRENTE)
- `clean_layer` (opcional, default: 'shared')

**Uso:** El flotante NO filtra por `student_uuid` (muestra TODOS los alumnos). El `student_uuid` solo se usa en acciones POST (mark-clean-student).

### 2.4) Pase de student_uuid a Acciones de Limpiar/Reset

**Endpoints POST:**
- `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student` (línea 1176-1183)
  - Body: `{ student_uuid, item_kind, clean_layer, actor_type, surface_key, ... }`
  - Validación UUID: líneas 1181-1183
- `POST /master/api/alquimia-general/reset-item` (línea 1523-1541)
  - Body: `{ student_uuid, item_ref, item_kind?, scope: 'student', ... }`
  - Validación UUID: líneas 1538-1541

### 2.5) Comportamiento con student_uuid null

**Proyección:**
- Si `scope='all'` → `student_uuid` es `null` (válido)
- Si `scope='student'` → `student_uuid` es requerido (400 si falta)

**Flotantes:**
- `student_uuid` NO se usa en GET (muestra todos los alumnos)

**Acciones:**
- `student_uuid` es requerido en POST (400 si falta o es inválido)

### 2.6) Cambio de Alumno

**Frontend:** `master-alquimia-general-client.js`

**Estado:** `state.projection.student_uuid` (línea 106)

**Actualización:** Función `updateViewState()` (líneas 138-214)
- Si `scope='all'` → fuerza `student_uuid=null` (línea 187-189)
- Si `scope='student'` → `student_uuid` se actualiza explícitamente

**Persistencia:** NO hay persistencia en localStorage (se pierde al recargar)

### 2.7) Discrepancias Observadas

**NO CONSTA** en el código actual si hay discrepancias entre:
- Alumno seleccionado en UI
- Alumno usado en requests reales

**Verificación Requerida:** Inspección en runtime con logs estructurados.

---

## FASE 3 — LISTAS E ÍTEMS

### 3.1) Definición de Lista en Backend

**Tabla:** `listas_transmutaciones`

**Campos Principales:**
- `id`: SERIAL PRIMARY KEY
- `nombre`: VARCHAR(255) NOT NULL
- `tipo`: VARCHAR(20) NOT NULL ('recurrente' | 'una_vez')
- `descripcion`: TEXT
- `orden`: INTEGER DEFAULT 0
- `status`: VARCHAR(20) DEFAULT 'active' ('active' | 'archived')
- `deleted_at`: TIMESTAMP (soft delete)

**Repositorio:** `src/infra/repos/alquimia-catalog-repo-pg.js`

### 3.2) Definición de Ítem

**Tabla:** `items_transmutaciones`

**Campos Principales:**
- `id`: SERIAL PRIMARY KEY
- `lista_id`: INTEGER NOT NULL (FK a `listas_transmutaciones`)
- `item_ref`: VARCHAR(255) UNIQUE NOT NULL (identificador canónico)
- `nombre`: VARCHAR(255) NOT NULL
- `descripcion`: TEXT
- `nivel`: INTEGER (1-9, nullable)
- `prioridad`: INTEGER DEFAULT 10
- `frecuencia_dias`: INTEGER (para recurrentes, nullable)
- `veces_limpiar`: INTEGER (para una_vez, nullable, required_count)
- `grupo`: VARCHAR(255) (nullable)
- `status`: VARCHAR(20) DEFAULT 'active' ('active' | 'archived')

**Identificadores:**
- `id`: numérico (interno)
- `item_ref`: string único (canónico, usado en APIs)

### 3.3) Carga de Operativa

**Endpoint:** `GET /master/api/alquimia-general/listas/:id/items`

**Handler:** `master-api-alquimia-general.js` (líneas 600-606)

**Servicio:** `listItems(listaId, { onlyActive: true })` → `alquimia-catalog-repo-pg.js`

**Orden:** `ORDER BY nivel ASC, created_at ASC` (ley absoluta, línea 191 de `alquimia-general-service.js`)

**Payload:** `{ ok: true, items: Array, trace_id }`

**Estructura de Item:**
```javascript
{
  id: number,
  lista_id: number,
  item_ref: string,
  nombre: string,
  descripcion: string | null,
  nivel: number | null,
  prioridad: number,
  frecuencia_dias: number | null,
  veces_limpiar: number | null,
  grupo: string | null,
  status: 'active' | 'archived',
  created_at: string,
  updated_at: string
}
```

### 3.4) Carga de Proyección

**Endpoint:** `GET /master/api/alquimia-general/list-projection`

**Handler:** `master-api-alquimia-general.js` (líneas 609-726)

**Servicio:** `computeListProjection()` → `list-projection-model.js`

**Payload:** `{ ok: true, data: { items, metrics, list_state, view_layer, item_kind, scope, student_uuid, list_meta }, trace_id }`

**Estructura de Item en Proyección:**
```javascript
{
  item_ref: string,
  nombre: string,
  nivel: number | null,
  grupo: string | null,
  // Estado calculado por CPM
  state_by_view_layer: {
    shared: { state, visual_state, computed_state },
    pde: { state, visual_state, computed_state },
    combo?: { state, visual_state, computed_state },
    effective?: { state, visual_state, computed_state, effective_sources }
  },
  // Agregados (solo si scope='all')
  aggregated_state?: {
    reviewed_count: number,
    pending_count: number,
    important_count: number,
    never_count: number
  }
}
```

**Diferencia con Operativa:**
- Operativa: items planos del catálogo (sin estado)
- Proyección: items con `state_by_view_layer` calculado por CPM

### 3.5) Listas Recurrentes vs Una_vez

**Campo:** `lista.tipo` ('recurrente' | 'una_vez')

**Diferencia en Items:**
- **Recurrentes:** `frecuencia_dias` (días entre limpiezas)
- **Una_vez:** `veces_limpiar` (required_count, veces que debe limpiarse)

**Diferencia en Estados:**
- **Recurrentes:** Estados basados en `days_since_last_clean`
- **Una_vez:** Estados basados en `clean_count` vs `required_count`

**Diferencia en view_layer:**
- **Recurrentes:** `view_layer` puede ser 'shared', 'pde', 'effective'
- **Una_vez:** `view_layer` puede ser 'shared', 'pde', 'combo'

### 3.6) Estado Agregado en Proyección

**Solo si `scope='all'`:**

**Métricas:** `projection.metrics`
```javascript
{
  total_items: number,
  reviewed_count: number,
  pending_count: number,
  important_count: number,
  never_count: number,
  reviewed_pct: number,
  pending_pct: number,
  important_pct: number,
  never_pct: number
}
```

**List State:** `projection.list_state`
```javascript
{
  dominant_state: 'reviewed' | 'pending' | 'important' | 'never',
  health_bucket: 'healthy' | 'attention' | 'critical',
  reviewed_pct: number
}
```

**Cálculo:** Agregación de `state_by_view_layer[view_layer].state` de todos los items.

---

## FASE 4 — FLOTANTES (CRÍTICO)

### 4.1) Endpoint del Flotante

**Endpoint:** `GET /master/api/alquimia-general/items/:item_ref/students`

**Handler:** `master-api-alquimia-general.js` (líneas 916-1109)

**Parámetros Query:**
- `product_key`: default 'pde'
- `clean_layer`: default 'shared' (para repositorio, no afecta cálculo)
- `view_layer`: OBLIGATORIO para RECURRENTE, opcional para UNA_VEZ (default: 'combo')
- `limit`: opcional (paginación)
- `offset`: opcional (paginación)

### 4.2) Datos que Recibe el Flotante

**Payload:** `{ ok: true, data: { item_ref, tipo, students: Array, counts, total, threshold_days, critical_multiplier }, warnings?, trace_id }`

**Estructura de `students` Array:**
Cada estudiante tiene:
```javascript
{
  student_uuid: string,
  display_name: string,
  shared: {
    state: 'reviewed' | 'pending' | 'important' | 'never',
    visual_state: string,
    days_since_last_clean: number | null,
    last_cleaned_at: string | null,
    clean_count: number,
    completed: number,
    remaining: number | null
  },
  pde: {
    state: 'reviewed' | 'pending' | 'important' | 'never',
    visual_state: string,
    days_since_last_clean: number | null,
    last_cleaned_at: string | null,
    clean_count: number,
    completed: number,
    remaining: number | null
  },
  state_by_view_layer: {
    shared: { state, visual_state, computed_state },
    pde: { state, visual_state, computed_state },
    combo?: { state, visual_state, computed_state },
    effective?: { state, visual_state, computed_state, effective_sources }
  }
}
```

**Estructura de `counts`:**
```javascript
{
  reviewed: number,
  pending: number,
  important: number,
  never: number
}
```

### 4.3) Datos que Renderiza el Flotante

**Frontend:** `master-alquimia-general-client.js`

**Función de Render:** `renderFloatModal()` (líneas 2500-3400 aprox.)

**Agrupación por Estado:**
- Usa `state_by_view_layer[layerView].state` para agrupar
- `layerView` viene de `state.modal.layerView` ('shared' | 'pde' | 'combo')

**Columnas Renderizadas:**
1. **Reviewed:** `state === 'reviewed'`
2. **Pending:** `state === 'pending'`
3. **Important:** `state === 'important'`
4. **Never:** `state === 'never'`

### 4.4) Botones del Flotante

**Botones por Columna:**

1. **"Limpiar" (por estudiante):**
   - Función: `handleLimpiarEstudiante(item, student, cleanLayer)` (líneas 3222-3369)
   - Endpoint: `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student`
   - Body: `{ student_uuid, item_kind, clean_layer, actor_type: 'master', surface_key: 'master.alquimia_general' }`
   - Post-acción: Refresh Engine v1 (`afterMutation()`)

2. **"+1 para todos" (una_vez):**
   - Función: `handleIncrementAllItem(item)` (líneas 4922-5000)
   - Endpoint: `POST /master/api/alquimia-general/items/:item_ref/master/increment-all`
   - Body: `{ clean_layer, item_kind }`
   - Post-acción: Refresh Engine v1

3. **"Limpiar todos" (recurrente):**
   - Función: `handleLimpiarItem(item, cleanLayer)` (líneas 2038-2115)
   - Endpoint: `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-all`
   - Body: `{ clean_layer, item_kind }`
   - Post-acción: Refresh Engine v1

4. **"PDE Limpiar todos" (recurrente):**
   - Función: `handlePdeCleanAll(item)` (líneas 5001-5120)
   - Endpoint: `POST /master/api/alquimia-general/items/:item_ref/master/mark-pde-clean-all`
   - Body: `{ item_kind }`
   - Post-acción: Refresh Engine v1

### 4.5) Dependencia del Scope Actual

**NO CONSTA** explícitamente en el código si el flotante depende del scope.

**Observación:**
- El flotante se abre desde cualquier superficie (operativa o proyección)
- El `view_layer` del flotante viene de `state.modal.layerView` (independiente del scope)
- El flotante muestra TODOS los alumnos (no filtra por scope)

### 4.6) Compartimiento de Estado

**Estado del Flotante:**
- `state.modal.item`: item actual (línea 97)
- `state.modal.cleanLayer`: 'shared' | 'pde' (legacy, línea 98)
- `state.modal.layerView`: 'shared' | 'pde' | 'combo' (vista actual, línea 99)

**Independencia:**
- El flotante tiene su propio estado (`state.modal`)
- NO comparte estado con `state.projection` ni `state.items`
- El flotante se refresca independientemente después de mutaciones

---

## FASE 5 — REFRESH ENGINE v1 (MASTER)

### 5.1) Localización

**Path:** `public/js/master/master-refresh-engine-v1.js` (224 líneas)

**Carga:** Vía `master-script-loader.js` (registrado en `master-layout-registry.v1.json`)

**Disponibilidad:** `window.MasterRefreshEngineV1` (global)

### 5.2) Adapter de Alquimia General

**Path:** `public/js/master/master-alquimia-general-client.js` (líneas 5850-6010)

**Registro:** Líneas 6005-6009
```javascript
if (window.MasterRefreshEngineV1) {
  window.MasterRefreshEngineV1.registerModule('alquimia_general', AlquimiaGeneralRefreshAdapter);
}
```

**Estructura del Adapter:**
```javascript
const AlquimiaGeneralRefreshAdapter = {
  invalidate(mutation) {
    // Limpia estado (no implementado explícitamente)
  },
  async refetch(mutation) {
    // Refetch según vista activa
    // - Si proyección: loadListProjection()
    // - Si operativa: loadItems() + refreshFloat si está abierto
  },
  render(mutation) {
    // Llama a renderView()
  },
  async refreshModal(mutation) {
    // Refresca flotante si está abierto
  }
}
```

### 5.3) Eventos que Disparan Refresh

**Mutations Registradas:**

1. **`alquimia.clean.student`** (líneas 3428-3444)
   - Trigger: `handleLimpiarEstudiante()`
   - Scope: `{ view_mode: 'proyeccion' | 'operativa', view_layer: string }`
   - Context: `{ item_ref, student_uuid, clean_layer, item_kind }`

2. **`alquimia.clean.all`** (líneas 2179-2195)
   - Trigger: `handleLimpiarItem()`
   - Scope: `{ view_mode: 'proyeccion' | 'operativa', view_layer: string }`
   - Context: `{ item_ref, clean_layer, item_kind }`

3. **`alquimia.increment.all`** (líneas 5004-5022)
   - Trigger: `handleIncrementAllItem()`
   - Scope: `{ view_mode: 'proyeccion' | 'operativa', view_layer: string }`
   - Context: `{ item_ref, clean_layer, item_kind }`

4. **`alquimia.pde.clean.all`** (líneas 5097-5120)
   - Trigger: `handlePdeCleanAll()`
   - Scope: `{ view_mode: 'proyeccion' | 'operativa', view_layer: string }`
   - Context: `{ item_ref, item_kind }`

### 5.4) Mutaciones que Activan Refresh

**Todas las mutaciones POST que modifican `cleaning_item_state`:**

- `mark-clean-student`
- `mark-clean-all`
- `mark-pde-clean-all`
- `increment-all`
- `reset-item` (NO CONSTA si usa Refresh Engine)
- `reset-list` (NO CONSTA si usa Refresh Engine)

### 5.5) Funcionamiento del Token Guard

**Implementación:** `master-refresh-engine-v1.js` (líneas 45-47, 102-160)

**Proceso:**
1. Cada mutación genera un token único (`renderTokenCounter++`)
2. Token se guarda en `lastRenderToken`
3. Antes de render, verifica si `lastRenderToken === currentToken`
4. Si NO coincide → skip render (otra mutación ya renderizó)

**Logs:**
- `[RENDER]` si token coincide
- `[RENDER_SKIPPED]` si token desactualizado

### 5.6) Cuándo un Refetch es Cancelado

**NO CONSTA** explícitamente si hay cancelación de refetch.

**Observación:**
- El refetch es `async` pero no hay `AbortController` visible
- Si hay múltiples mutaciones rápidas, el último token gana (render se salta)

### 5.7) Cuándo un Render NO Ocurre

**Condiciones:**
1. Token desactualizado (líneas 142-160)
2. `canRender === false` (línea 247 de `master-alquimia-general-client.js`)
   - `canRender = viewState.list_id !== null`

### 5.8) Traza Post-Clean

**Flujo:**
1. Usuario hace clic en "Limpiar"
2. `handleLimpiarEstudiante()` → POST endpoint
3. Backend actualiza `cleaning_item_state`
4. Frontend recibe respuesta
5. `afterMutation()` del Refresh Engine:
   - `invalidate()` (no-op actual)
   - `refetch()` → `loadListProjection()` o `loadItems()`
   - `refreshModal()` → refresca flotante si está abierto
   - `render()` → `renderView()`

### 5.9) Traza Post-Reset

**NO CONSTA** si reset usa Refresh Engine.

**Observación:**
- `handleResetItem()` y `handleResetList()` NO aparecen en búsqueda de `afterMutation`
- Probablemente usan `refreshAfterProjectionMutation()` (deprecated)

### 5.10) Traza si se Repite la Acción

**Idempotencia:**
- Backend: `execution_key` previene duplicados (unique constraint)
- Frontend: Token guard previene doble render
- Si se repite la misma acción el mismo día → `skipped > 0` en respuesta

---

## FASE 6 — FRONTEND / VIEW STATE

### 6.1) Estado Real de la UI

**Path:** `public/js/master/master-alquimia-general-client.js`

**Estructura de `state` (líneas 74-110):**
```javascript
{
  tipoActivo: 'recurrente' | 'una_vez',
  list_id: number | null, // Estado intencional
  listaActiva: Object | null, // Dato derivado
  listas: Array,
  items: Array,
  itemsSortPipeline: Array,
  groups: Array,
  classifications: { categories, subtypes, tags },
  newItemDraft: Object,
  debounceTimers: Map,
  modal: {
    item: Object | null,
    cleanLayer: 'shared' | 'pde',
    layerView: 'shared' | 'pde' | 'combo'
  },
  projection: {
    mode: 'operativa' | 'proyeccion',
    view_layer: 'shared' | 'pde' | 'combo' | 'effective',
    scope: 'all' | 'student',
    student_uuid: string | null,
    data: Object | null,
    loading: boolean
  },
  students: Array
}
```

### 6.2) Función getViewState()

**Path:** Líneas 118-127

**Retorna:**
```javascript
{
  item_kind: state.tipoActivo,
  list_id: state.list_id, // Estado intencional (NO derivado)
  viewMode: state.projection.mode,
  view_layer: state.projection.view_layer,
  scope: state.projection.scope,
  student_uuid: state.projection.student_uuid
}
```

**Regla Canónica:** `list_id` viene EXCLUSIVAMENTE del estado intencional, NO de `listaActiva`.

### 6.3) Variables que Deciden QUÉ se Renderiza

**Función `renderView()` (líneas 220-328):**

**Decisión Principal:**
```javascript
const canRender = viewState.list_id !== null;
```

**Si `canRender === false`:**
- Renderiza mensaje: "Selecciona una lista para comenzar"
- NO renderiza contenido

**Si `canRender === true`:**
- Renderiza tabs (Operativa / Proyección)
- Según `viewState.viewMode`:
  - `'operativa'` → `renderOperativeView()`
  - `'proyeccion'` → `renderProjectionView()`

### 6.4) Eventos que Cambian Cada Variable

**`updateViewState(updates)` (líneas 138-214):**

**Cambios:**
- `item_kind`: limpia `list_id` (línea 146)
- `list_id`: actualiza `listaActiva` (derivado, línea 159)
- `viewMode`: cambia modo de vista (línea 168)
- `view_layer`: cambia capa de vista (línea 176)
- `scope`: si `'all'` → fuerza `student_uuid=null` (línea 187)
- `student_uuid`: actualiza UUID del estudiante (línea 200)

### 6.5) Triggers para Render

**Llamadas a `renderView()`:**

1. **Después de `selectListAndRender()`** (línea 1018)
2. **Después de `loadListProjection()`** (línea 1519, 1536, 1636)
3. **Después de cambio de tab** (líneas 292, 305)
4. **Después de Refresh Engine** (línea 5971)
5. **Después de crear item** (línea 1901)
6. **Después de ordenar** (línea 479)
7. **Después de actualizar item** (línea 3869)

### 6.6) Estados Muertos

**NO CONSTA** explícitamente si hay estados muertos.

**Observación:**
- Si `list_id === null` → no renderiza contenido (línea 263)
- Si `projection.data === null` y `mode === 'proyeccion'` → muestra loading o selector

### 6.7) Renders Bloqueados

**Condiciones:**
1. `canRender === false` (línea 247)
2. Token desactualizado en Refresh Engine (línea 152 de `master-refresh-engine-v1.js`)

### 6.8) Incoherencias entre Superficies

**NO CONSTA** explícitamente si hay incoherencias.

**Observación:**
- Operativa y Proyección comparten `state.items` y `state.projection.data`
- Flotante tiene su propio estado (`state.modal`)
- Si se limpia desde flotante, Refresh Engine debería sincronizar todas las superficies

---

## FASE 7 — SÍNTOMAS OBSERVADOS (CORRELACIÓN)

### 7.1) Flotantes Vacíos

**NO CONSTA** en código si hay casos de flotantes vacíos.

**Posibles Causas (especulación, NO diagnóstico):**
- `getStudentsForItem()` retorna array vacío
- Filtro de nivel (aunque `skip_level_filter=true`)
- Error en cálculo de estados

### 7.2) Listas que No Renderizan

**Condición:** `list_id === null` (línea 247)

**Posibles Causas:**
- `selectListAndRender()` no se ejecutó
- `updateViewState()` limpió `list_id` sin razón
- Cambio de `item_kind` limpia `list_id` (línea 146)

### 7.3) Estados que No Cambian Tras Limpiar/Reset

**NO CONSTA** si hay casos reales.

**Posibles Causas:**
- Refresh Engine no se ejecutó
- Refetch no se completó
- Render se saltó por token desactualizado
- Backend no actualizó `cleaning_item_state`

### 7.4) Casos donde Funciona para un Alumno y Otro No

**NO CONSTA** si hay casos reales.

**Posibles Causas:**
- Alumno en pausa (retorna `null` en Cleaning Engine)
- Nivel del item > nivel efectivo del alumno
- Error en cálculo de estado para alumno específico

### 7.5) Casos donde Tras Reset Ya No Vuelve a Funcionar

**NO CONSTA** si hay casos reales.

**Posibles Causas:**
- Reset elimina `cleaning_item_state` pero no se recrea en seed
- Refresh Engine no se ejecuta después de reset
- Estado local no se sincroniza

---

## BASE REAL PARA DIAGNÓSTICO DE CIERRE

**Confirmación:**

Con esta información ya se puede diseñar un diagnóstico causal y proponer fixes sin especulación.

**Información Disponible:**
- ✅ Todos los endpoints documentados con paths y líneas
- ✅ Estructura de tablas de base de datos
- ✅ Lógica de cálculo de estados (CPM)
- ✅ Flujo de mutaciones y refresh
- ✅ Estado del frontend y triggers de render
- ✅ Contratos de Refresh Engine v1

**Zonas Ciegas Identificadas:**
- Comportamiento en runtime con datos reales
- Casos edge de idempotencia
- Sincronización entre superficies después de mutaciones
- Persistencia de estado entre recargas

**Próximos Pasos Sugeridos (NO implementados):**
1. Inspección en runtime con logs estructurados
2. Tests de casos edge (reset, idempotencia, múltiples mutaciones)
3. Verificación de coherencia entre superficies
4. Análisis de performance de refetch/render

---

**FIN DEL INFORME FORENSE**
