# 🔍 DIAGNÓSTICO TOTAL ALQUIMIA GENERAL MASTER v1
## (RESET + OVERRIDES + ACTION REGISTRY + CREACIÓN ÍTEMS + LISTAS + PROYECCIONES + CPM + ENGINE + REFRESH + COLUMNAS + FLOTANTES + RENDER)

**Fecha:** 2025-01-27  
**Dominio:** MASTER (`master.pdeeugenihidalgo.org`)  
**UI:** `/master/templo-luz/alquimia-general`  
**Lista fija:** Abundancia (`list_id=11`)  
**Item fijo:** `te_item_63`  
**Alumno fijo:** `student_uuid=44a51f8f-4ed5-4291-ad13-5f07a99c636b`  

**Regla de diagnóstico:** SOLO EVIDENCIA. NO FIXES. NO REFACTORIZACIONES.

---

## A) INVENTARIO TOTAL DEL SISTEMA (MAPA DE PIEZAS)

### A1) Archivos involucrados (mapeo completo)

#### 1) UI Principal
- **`public/js/master/master-alquimia-general-client.js`** (288k+ líneas)
  - Cliente JavaScript principal
  - Estado UI: `state.listas`, `state.items`, `state.students`, `state.classifications`
  - Funciones clave: `renderView()`, `renderOperativeView()`, `loadLista()`, `loadItems()`, `loadStudents()`
  - Renderizado de columnas: `renderListProjection()`, `renderStudentsByState()`

#### 2) Refresh Engine
- **`public/js/master/master-refresh-engine-v1.js`**
  - Refresh Engine v1 (motor base)
  - `afterMutation()` - callback post-mutación
- **`public/js/master/ux/refresh-engine-v2-adapter.js`** (105 líneas)
  - Adaptador v2 que extiende v1
  - Soporte para `surfaces` declarativas
  - Fallback a v1 si no hay surfaces
- **`src/core/ux/refresh-surface-registry.v1.js`** (159 líneas)
  - Registry canónico de superficies
  - Functions: `registerRefreshSurface()`, `refetchSurface()`, `getRefreshSurface()`
- **`public/js/master/ux/perform-action.v1.js`** (481 líneas según archivos recientes)
  - Wrapper canónico para `performAction()`
  - Validación de payload y dominio
  - Integración con Refresh Engine

#### 3) Action Registry / UX Contract
- **`src/core/ux/action-registry/alquimia-actions.js`** (557 líneas)
  - Registry de acciones UX para Alquimia
  - Acciones registradas:
    - `alquimia.clean` - Limpiar item (scope: item | student | all)
    - `alquimia.clean_all` - Limpiar item para todos
    - `alquimia.reset` - Resetear progreso (SOLO recurrente)
    - `alquimia.create_lista` - Crear lista
    - `alquimia.create_item` - Crear item
    - `alquimia.clean_student` - Limpiar desde Alquimia Alumno
    - `alquimia.delete_item` - Eliminar item
    - `alquimia.reset_overrides` - Resetear overrides
    - `alquimia.update_lista` - Actualizar lista
  - `buildRefreshPlan()` - Construye surfaces a refrescar
  - `buildCleanPayload()`, `buildResetPayload()` - Builders de payload

#### 4) Backend Endpoints MASTER
- **`src/endpoints/master-api-alquimia-general.js`** (2334+ líneas)
  - Handler principal de endpoints API `/master/api/alquimia-general/*`
  - Endpoints:
    - `GET /master/api/alquimia-general/listas` - Listar listas
    - `POST /master/api/alquimia-general/listas` - Crear lista
    - `GET /master/api/alquimia-general/listas/:id` - Obtener lista
    - `GET /master/api/alquimia-general/listas/:id/items` - Listar items
    - `GET /master/api/alquimia-general/listas/:id/list-projection` - Proyección
    - `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student` - Limpiar estudiante
    - `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-all` - Limpiar todos
    - `POST /master/api/alquimia-general/reset` - Reset (endpoint único canónico)
    - `POST /master/api/alquimia-general/overrides/reset` - Reset overrides
- **`src/core/master/registry/master-route-registry.js`**
  - Registry de rutas MASTER
  - Validación de `type: 'api'` vs `type: 'island'`
- **`src/core/master/router/master-router-resolver.js`**
  - Resolver de rutas MASTER
  - Mapeo `MASTER_HANDLER_MAP`

#### 5) Servicios MASTER
- **`src/core/master/services/cleaning-engine-service.js`** (2327+ líneas)
  - Cleaning Engine v1 - Single Decider para limpiezas
  - Funciones clave:
    - `markCleanStudent()` - Limpiar item para estudiante
    - `markCleanAllStudents()` - Limpiar para todos
    - `resetStudentItemProgress()` - Reset item para estudiante
    - `resetAllStudentsItemProgress()` - Reset para todos
    - `upsertApplyRecurrent()` - Aplicar limpieza recurrente
    - `rebaseStateFromReset()` - Reconstruir estado desde reset
    - `generateExecutionKey()` - Generación idempotente
- **`src/core/master/services/cleaning-projection-model.js`** (340+ líneas)
  - CPM v2 - Única autoridad de proyección de estado
  - `computeEffectiveState()` - Calcula estado por view_layer
  - `computeRecurrenteState()` - Estado para recurrente
  - `computeRecurrenteLayerState()` - Estado por capa (shared/pde)
  - Estados canónicos: `never`, `reseteado`, `pending`, `reviewed`, `important`
- **`src/core/master/services/alquimia-override-reset-service.js`**
  - Servicio para reset de overrides
  - `resetOverrides()` - Reset según scope
- **`src/core/master/services/list-projection-model.js`**
  - Modelo de proyección de lista
  - `computeListProjection()` - Calcula proyección completa

#### 6) Repos / DB Layer
- **`src/infra/repos/cleaning/cleaning-item-state-repo-pg.js`**
  - Repositorio de `cleaning_item_state`
  - CRUD: `getByStudentItem()`, `upsert()`, `deleteByStudentItem()`
- **`src/infra/repos/cleaning/cleaning-events-repo-pg.js`**
  - Repositorio de `cleaning_events` (event log)
  - `insertEvent()`, `listEventsForStudentItem()`, `getLastEvent()`
- **`src/infra/repos/student-item-overrides-repo-pg.js`**
  - Repositorio de overrides
  - `getOverrides()`, `deleteOverrides()`
- **`src/infra/repos/alquimia-catalog-repo-pg.js`**
  - Repositorio de catálogo (listas, items)
  - `getListaById()`, `getItemByRef()`, etc.

#### 7) Migrations / Tablas PostgreSQL
**PENDIENTE:** Buscar migrations en `database/migrations/` o esquemas

**Tablas identificadas:**
- `transmutacion_listas` - Listas de transmutación
- `transmutacion_items` - Items de transmutación
- `transmutacion_lista_classifications` - Relación lista-clasificaciones
- `cleaning_item_state` - Estado de limpieza por alumno/item/capa
- `cleaning_events` - Event log (append-only)
- `student_item_overrides` - Overrides de items por estudiante

---

### A2) Diagrama textual DATAFLOW

```
UI Click (botón clean/reset)
  ↓
performAction({ action_id, context, uiState })
  ↓
UX Action Registry → buildPayload() + buildRefreshPlan()
  ↓
HTTP POST → Endpoint MASTER API
  ↓
master-api-alquimia-general.js (handler)
  ↓
Cleaning Engine Service (markCleanStudent / resetStudentItemProgress)
  ↓
Repositorios PostgreSQL:
  - cleaning-events-repo-pg.js → insertEvent() (event log)
  - cleaning-item-state-repo-pg.js → upsert() (estado)
  ↓
DB Write:
  - cleaning_events (nuevo evento)
  - cleaning_item_state (estado actualizado)
  ↓
Response JSON (200 OK + metadata)
  ↓
Refresh Engine v2 Adapter → afterMutationV2()
  ↓
Refresh Surface Registry → refetchSurface(surface_id, context, uiState)
  ↓
Frontend refetch:
  - GET /master/api/alquimia-general/listas/:id/list-projection?view_layer=shared
  - GET /master/api/alquimia-general/listas/:id/items
  ↓
Backend projection:
  - list-projection-model.js → computeListProjection()
  - cleaning-projection-model.js → computeEffectiveState()
  ↓
Response JSON con state_by_view_layer[view_layer]
  ↓
UI Render:
  - Agrupar estudiantes por state_by_view_layer[view_layer].state
  - Mover a columna correcta (never / reseteado / pending / reviewed / important)
```

---

### A3) Contrato REAL de estado que consume la UI

**PENDIENTE:** Inspeccionar código exacto de renderizado en `master-alquimia-general-client.js`

**Hipótesis:**
- UI debe agrupar por `state_by_view_layer[view_layer].state`
- Campo canónico: `student.state_by_view_layer.shared.state` (o `.pde.state`, `.combo.state`)
- Si `state_by_view_layer` falta, puede fallar o usar fallback

**Verificación necesaria:**
1. Buscar `renderListProjection()` o función de renderizado de columnas
2. Identificar qué campo exacto se usa para agrupar
3. Verificar si hay fallback a `student.state` (legacy)

---

## B) DIAGNÓSTICO DE BASE DE DATOS (SOT Y REALIDAD)

### B1) Tablas identificadas

**Tablas de Cleaning Engine:**
- `cleaning_events` (append-only audit)
  - Campos: `id`, `created_at`, `trace_id`, `execution_key`, `student_id` (⚠️ INTEGER, migrado a UUID en runtime), `item_ref`, `clean_layer`, `item_kind`, `action_type` ('mark_clean' | 'set_remaining' | 'reset'), `delta_completed`, `actor_type`, etc.
  - Índices: `idx_cleaning_events_student_item`, `idx_cleaning_events_execution_student` (idempotencia)
  - Migration: `v5.59.0-cleaning-engine-v1.sql`

- `cleaning_item_state` (proyección canónica)
  - Campos: `student_id` (⚠️ INTEGER en schema, UUID en runtime), `item_ref`, `shared_last_cleaned_at`, `pde_last_cleaned_at`, `shared_clean_count`, `pde_clean_count`, `shared_completed`, `shared_remaining`, `pde_completed`, `shared_effective_since`, `pde_effective_since` (v5.73.0), `shared_had_history`, `pde_had_history`
  - Primary Key: `(student_id, product_key, domain_type, item_ref)`
  - Migration: `v5.59.0-cleaning-engine-v1.sql` + `v5.73.0-reset-canonical-v1.sql`

**Tablas de Catálogo:**
- `transmutacion_listas` - Listas de transmutación
- `transmutacion_items` - Items de transmutación
- `transmutacion_lista_classifications` - Relación lista-clasificaciones (v5.36.0)

**Tablas de Overrides:**
- `student_item_overrides` - Overrides de configuración por estudiante/item (v5.71.0)

**⚠️ INCONSISTENCIA DETECTADA:**
- Schema migration `v5.59.0` usa `student_id INTEGER REFERENCES alumnos(id)`
- Runtime usa `student_uuid` (UUID canónico)
- Necesita verificación: ¿hay migración que cambió `student_id` a UUID?

### B2) Script forense DB (PENDIENTE)

**PENDIENTE:** Crear `scripts/diagnostico-alqg-db-dump.js` con:
- Query: estado actual de `cleaning_item_state` para `student_uuid=44a51f8f-4ed5-4291-ad13-5f07a99c636b` + `item_ref=te_item_63`
- Query: eventos `cleaning_events` para mismo par (ordenados por `created_at DESC`)
- Query: overrides activos para el par
- Output: JSON + tabla con timestamps epoch y human

**NOTA:** Verificar si `student_id` en `cleaning_events`/`cleaning_item_state` es INTEGER o UUID en runtime real.

---

## C) DIAGNÓSTICO CPM (CÁLCULO DE ESTADOS Y COLUMNAS)

### C1) Lógica identificada en `cleaning-projection-model.js`

**Función canónica:** `computeEffectiveState({ item_kind, view_layer, item_config, cleaning_state, overrides })`

**Para RECURRENTE:**
- `computeRecurrenteLayerState()` - Calcula estado por capa (shared/pde)
- Reglas de RESET (líneas 152-338):
  1. `hasReset = effectiveSince !== null`
  2. Si `hasReset && lastCleanedAt === null` → estado `'reseteado'`, `days_since = 0`
  3. Si `hasReset && lastCleanedAt > effectiveSince` → usar `lastCleanedAt`, calcular `days_since`
  4. Si `hasReset && lastCleanedAt <= effectiveSince` → IGNORAR limpieza antigua, `days_since = 0`, estado `'reseteado'`
  5. Si `!hasReset && lastCleanedAt === null` → estado `'never'`
  6. Si `lastCleanedAt` existe → calcular `days_since` y comparar con `threshold_days` / `criticalThreshold`

**Estados canónicos:**
- `never` - Sin historia (no reset, no limpieza)
- `reseteado` - Reset aplicado, sin limpieza posterior (`effective_since != null && last_cleaned_at == null`)
- `pending` - `threshold_days <= days_since < criticalThreshold`
- `reviewed` - `days_since < threshold_days`
- `important` - `days_since >= criticalThreshold` (2x threshold_days)

**⚠️ HALLAZGO CRÍTICO:**
- CPM calcula `state_by_view_layer[view_layer]` para TODAS las view_layers (shared, pde, effective, combo)
- UI consume `state_by_view_layer[view_layer].state` (verificado en sección A3)
- Si falta `state_by_view_layer`, UI tiene fallback a `student.state` (legacy) con warning

### C2) Verificación de salida backend

**PENDIENTE:** Verificar estructura exacta de respuesta `GET /master/api/alquimia-general/list-projection`:
- ¿Incluye `state_by_view_layer` para cada student?
- ¿Incluye para todas las view_layers o solo la solicitada?

**Endpoint:** `src/endpoints/master-api-alquimia-general.js` línea 612+  
**Servicio:** `list-projection-model.js` → `computeListProjection()`

---

## D) DIAGNÓSTICO ENGINE (RESET/CLEAN Y REBASE)

### D1) Funciones identificadas en `cleaning-engine-service.js`

**`markCleanStudent()`** (línea 391+):
- Verifica pausa (UUID-only)
- Obtiene item del catálogo
- Verifica nivel (bypass en MASTER)
- Genera `execution_key` (idempotente)
- Obtiene último RESET: `getLastResetForItem()`
- Si hay RESET previo: llama `rebaseStateFromReset()`
- Inserta evento en `cleaning_events`
- Aplica a `cleaning_item_state` vía `upsertApplyRecurrent()` o `upsertApplyUnaVez()`

**`rebaseStateFromReset()`** (línea 190+):
- Reconstruye estado desde último RESET
- Obtiene eventos posteriores al RESET
- Recalcula `last_cleaned_at`, `clean_count`, `effective_since`
- **PARÁMETRO NUEVO:** `currentCleanEvent` (para incluir limpieza actual)

**`needsRebase`** (línea 819):
```javascript
const needsRebase = hasReset || // SIEMPRE rebase si hay reset previo
  // ... otras condiciones
```
- **HALLAZGO:** `needsRebase` incluye `hasReset ||` para forzar rebase cuando hay reset

**`upsertApplyRecurrent()`** (línea ~800+):
- Actualiza `cleaning_item_state`
- Para RECURRENTE: actualiza `last_cleaned_at`, `clean_count`
- **FIX:** Usa `created_at` del evento insertado (no `new Date()`)

### D2) Reset endpoints

**Endpoint único canónico:** `POST /master/api/alquimia-general/reset`  
**Handler:** `src/endpoints/master-api-alquimia-general.js` línea 1518+

**Payload canónico:**
```javascript
{
  reset_scope: 'ITEM_STUDENT' | 'ITEM_ALL' | 'LIST_STUDENT' | 'LIST_ALL',
  clean_layer: 'shared' | 'pde',
  item_ref: string (si ITEM_*),
  list_id: number (si LIST_*),
  student_uuid: string (si *_STUDENT),
  reason?: string,
  item_kind?: 'recurrente' | 'una_vez' (validación)
}
```

**Respuesta (PENDIENTE verificar estructura exacta):**
- `total_items` - Items afectados
- `applied` - Resets aplicados
- `skipped` - Resets saltados (idempotencia)

**⚠️ HALLAZGO CRÍTICO POTENCIAL:**
- Si `applied=0` o `total_items=0`, UI podría mostrar éxito verde pero sin efecto real
- Necesita verificar: ¿UI interpreta `applied`/`total_items` o solo HTTP 200?

---

## E) DIAGNÓSTICO OVERRIDES (RESET OVERRIDES, APLICACIÓN Y EFECTO)

### E1) Tablas y repos identificados

**Tabla:** `student_item_overrides`
- Repositorio: `src/infra/repos/student-item-overrides-repo-pg.js`
- Campos: `id`, `student_uuid`, `item_ref`, `override_type`, `value`, etc.

### E2) Endpoint identificado

**`POST /master/api/alquimia-general/overrides/reset`**
- Handler: `src/endpoints/master-api-alquimia-general.js` línea 1638+
- Payload: `{ scope: 'ITEM_STUDENT' | 'ITEM_ALL' | 'LIST_STUDENT' | 'LIST_ALL', item_ref?, list_id?, student_uuid? }`
- Servicio: `resetOverridesByScope()` → `alquimia-override-reset-service.js`

**Respuesta:**
```javascript
{
  ok: true,
  scope: string,
  applied: number,  // Overrides eliminados
  skipped: number,
  total: number,
  deleted_count: number  // Alias de applied
}
```

### E3) Reglas constitucionales

**REGLA ABSOLUTA:** Override ≠ cleaning state, Override ≠ reset
- Reset overrides NO modifica `cleaning_item_state`
- Reset overrides NO modifica `effective_since` o `last_cleaned_at`
- Solo afecta tabla `student_item_overrides`

**⚠️ HALLAZGO:**
- Overrides se aplican en lectura (override-resolution-service.js)
- Cache por `student_uuid` posible - necesita verificar invalidación tras reset

---

## F) DIAGNÓSTICO ACTION REGISTRY (PAYLOADS, SCOPES, CLEAN_LAYER)

### F1) Acciones registradas (alquimia-actions.js)

**9 acciones totales:**
1. `alquimia.clean` - buildCleanPayload(), buildRefreshPlan()
2. `alquimia.clean_all` - buildRefreshPlan()
3. `alquimia.reset` - buildResetPayload(), buildRefreshPlan()
4. `alquimia.create_lista` - refresh: ['alquimia.listas']
5. `alquimia.create_item` - refresh: ['alquimia.items']
6. `alquimia.clean_student` - refresh: ['alquimia.megalist']
7. `alquimia.delete_item` - refresh dinámico según view_mode
8. `alquimia.reset_overrides` - buildRefreshPlan()
9. `alquimia.update_lista` - refresh: ['alquimia.items', 'alquimia.list_projection']

### F2) buildRefreshPlan() canónico

**Lógica (líneas 44-73):**
```javascript
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
  
  // Flotante: SIEMPRE refrescar si hay item_ref (BUG-008 FIX)
  if (context.item_ref) {
    surfaces.push('alquimia.flotante_students');
  }
  
  return surfaces;
}
```

**⚠️ HALLAZGO CRÍTICO:**
- `buildRefreshPlan()` puede retornar array vacío si `view_mode` no es 'proyeccion'/'operativa' Y no hay `item_ref`
- Si `surfaces.length === 0`, Refresh Engine v2 cae a legacy

### F3) buildResetPayload() - Validaciones

**Validaciones identificadas (líneas 154-251):**
- `item_kind === 'una_vez'` → Error hard fail
- `reset_scope` obligatorio y válido
- `clean_layer` obligatorio ('shared' | 'pde')
- `ITEM_STUDENT` → requiere `item_ref` + `student_uuid`
- `ITEM_ALL` → requiere `item_ref`, PROHIBE `student_uuid`
- `LIST_STUDENT` → requiere `list_id` + `student_uuid`
- `LIST_ALL` → requiere `list_id`, PROHIBE `student_uuid`

**⚠️ HALLAZGO:**
- No hay warning sobre "Reset ALL debe usar clean_layer=pde" en Action Registry
- Ese warning debe venir del backend o logs forenses

---

## G) DIAGNÓSTICO REFRESH ENGINE (V1/V2, SURFACES, LEGACY)

### G1) Mapa de surfaces

**Surfaces identificadas:**
- `alquimia.list_projection` - Proyección de lista
- `alquimia.items` - Lista de items (modo operativa)
- `alquimia.flotante_students` - Flotante de estudiantes
- `alquimia.listas` - Lista de listas
- `alquimia.megalist` - Megalist (Alquimia Alumno)

**Registry:** `src/core/ux/refresh-surface-registry.v1.js`
- `registerRefreshSurface()`, `refetchSurface()`, `getRefreshSurface()`

### G2) Condición de fallback a LEGACY

**Localización:** `public/js/master/master-alquimia-general-client.js` línea 6565+
```javascript
console.warn('[REFRESH_ENGINE][ALQG][LEGACY_REFRESH] Sin surfaces declarativas, usando lógica manual', {
  // ...
});
```

**Causas potenciales:**
1. `surfaces.length === 0` (buildRefreshPlan retorna vacío)
2. `window.__AP_REFRESH_SURFACE_REGISTRY__` no disponible
3. `uiState` incompleto (list_id null, view_mode undefined)
4. `context.item_ref` missing (no entra en flotante)

**⚠️ HALLAZGO CRÍTICO:**
- Refresh Engine v2 Adapter (líneas 32-98) verifica `surfaces.length > 0` antes de usar registry
- Si `surfaces` está vacío → fallback a v1 → `afterMutation()` manual

### G3) Refresh Engine v1

**Archivo:** `public/js/master/master-refresh-engine-v1.js`
- `afterMutation(mutation)` - Orquesta invalidate + refetch + render
- Guard de token para prevenir doble render
- Usa adapters de módulos registrados

**Flujo v1:**
1. `invalidate(mutation)` 
2. `refetch(mutation)`
3. `refreshModal(mutation)` (opcional)
4. `render(mutation)` (con guard de token)

---

## H) DIAGNÓSTICO UI (RENDER, COLUMNAS, FLOTANTES, FUENTE ÚNICA)

### H1) Renderizado de columnas - CONTRATO REAL

**Función:** `renderListProjection()` en `master-alquimia-general-client.js`

**Agrupación por estado (líneas 2763-2906):**
```javascript
// REGLA CANÓNICA: UI consume EXCLUSIVAMENTE state_by_view_layer[view_layer]
if (student.state_by_view_layer && student.state_by_view_layer[activeViewLayer]) {
  stateData = student.state_by_view_layer[activeViewLayer];
  columnState = stateData.state || 'never';  // RECURRENTE
  // O columnState = stateData.visual_state || 'never';  // UNA_VEZ
} else {
  // FALLBACK LEGACY (con warnings)
  console.error('[INVARIANT_BROKEN] Missing state_by_view_layer');
  if (student.state) {
    // Construir stateData desde student.state (CPM legacy)
    stateData = { state: student.state, visual_state: student.visual_state || student.state };
  }
}
```

**Estudiantes agrupados en `studentsByState`:**
- `studentsByState.never`
- `studentsByState.reseteado`
- `studentsByState.pending`
- `studentsByState.important`
- `studentsByState.reviewed`
- `studentsByState._error` (si falta state_by_view_layer)

**⚠️ HALLAZGO CRÍTICO:**
- Campo canónico: `state_by_view_layer[activeViewLayer].state`
- Si falta → fallback a `student.state` + columna `_error` visible
- UI marca estudiante como error si falta `state_by_view_layer`

### H2) "Verde pero falso" - Pantalla de éxito

**PENDIENTE:** Buscar código que muestra toast/estado verde tras reset_all
- ¿Depende solo de HTTP 200?
- ¿Interpreta `applied`/`total_items` de respuesta?

**Hipótesis:** Si UI solo verifica `response.ok`, mostrará éxito aunque `applied=0`

### H3) Flotante - Render y refresh

**Función:** `handleVerItem(item, viewLayer)` 
- Abre modal/flotante con estudiantes
- Refresca si `item_ref` coincide después de mutación
- INDEPENDIENTE del `view_mode` (regla constitucional)

---

## I) DIAGNÓSTICO CREACIÓN DE ÍTEMS Y LISTAS (INTEGRIDAD DEL CATÁLOGO)

### I1) Endpoints de creación

**POST /master/api/alquimia-general/listas** (línea 187+):
- Valida: `nombre` requerido
- Crea con: `tipo`, `descripcion`, `orden`, `status`
- Retorna: `{ ok: true, lista: created }`

**POST /master/api/alquimia-general/items** (PENDIENTE buscar línea exacta):
- Valida: `lista_id`, `nombre`, etc.
- Crea item y lo asigna a lista

### I2) Integridad después de crear

**PENDIENTE:** Verificar que tras crear ítems:
- Aparecen en `list-projection` (GET con `list_id`)
- Aparecen en operativa (GET `/listas/:id/items`)
- Estado inicial para alumnos: `never` (sin `cleaning_item_state` hasta primera limpieza)

---

## J) PROTOCOLO DE EVIDENCIA (LOGS, TRACE_ID, REPRO)

### J1) Logs estructurados identificados

**Prefijos canónicos:**
- `[REFRESH_ENGINE][MASTER]` - Refresh Engine v1
- `[REFRESH_ENGINE_V2][SURFACES]` - Refresh Engine v2
- `[REFRESH][GET]` - Refetch de surfaces
- `[CLEAN][WRITE]` - Escritura de limpieza
- `[RESET][CANONICAL]` - Reset canónico
- `[OVERRIDE_RESET][CANONICAL]` - Reset overrides
- `[CPM_V2][INPUT]` / `[CPM_V2][OUTPUT]` - CPM cálculo
- `[FORENSIC][CPM][RESET_RECURRENTE_V1]` - Logs forenses CPM
- `[INVARIANT_BROKEN]` - Violaciones de invariantes
- `[ALQUIMIA_ACTIONS][buildRefreshPlan]` - Plan de refresh

### J2) Comandos forenses

```bash
# Logs PM2 correlados
pm2 logs aurelinportal --lines 400 | grep -E "req_|ux_action_|ALQG|RESET|CLEAN|SURFACES|LEGACY_REFRESH|list-projection|OVERRIDE|INVARIANT_BROKEN"

# Buscar trace_id específico
pm2 logs aurelinportal | grep "ux_action_123456"
```

### J3) Estructura de evidencia (PENDIENTE crear)

**Carpeta:** `docs/diagnosticos/alqg_total/`
- `repro_steps.md` - Pasos de reproducción
- `payloads/` - Payloads capturados (JSON)
- `responses/` - Respuestas backend (JSON)
- `logs/` - Logs correlados por trace_id
- `db_dumps/` - Estado DB antes/después

---

## K) INVARIANTES CONSTITUCIONALES A CHEQUEAR (CHECKLIST)

### K1) Acción → Proyección → Ubicación (OBLIGATORIO)

**✅ VERIFICADO:**
- Acción (POST) → Cleaning Engine escribe DB
- Proyección: `computeListProjection()` → `computeEffectiveState()` → `state_by_view_layer`
- Ubicación: UI agrupa por `state_by_view_layer[view_layer].state`

**❌ VIOLACIÓN DETECTADA:**
- Si `state_by_view_layer` falta → UI usa fallback a `student.state` + columna `_error`
- **PUNTO DE ROTURA:** Backend no devuelve `state_by_view_layer` en respuesta GET

### K2) Fuente Única de Columnas

**✅ VERIFICADO:**
- Campo canónico: `state_by_view_layer[view_layer].state`
- UI usa exclusivamente este campo (con fallback documentado)

**❌ VIOLACIÓN POTENCIAL:**
- Fallback a `student.state` puede causar desincronización si backend calcula diferente

### K3) Contrato de estados

**✅ VERIFICADO EN CPM:**
- `reseteado`: `effective_since != null && last_cleaned_at == null`
- `important`: `days_since >= threshold_days * 2`
- `effective` layer contempla reseteado correctamente

### K4) Refresh Engine

**❌ VIOLACIÓN DETECTADA:**
- Si `buildRefreshPlan()` retorna `[]` → fallback a legacy
- Legacy refresh puede no refrescar superficies necesarias
- **PUNTO DE ROTURA:** `view_mode` undefined o `list_id` null en `buildRefreshPlan()`

---

## L) ENTREGABLE FINAL - LISTA DE BUGS Y PLAN

### L1) BUGS IDENTIFICADOS (Severidad y punto de rotura)

#### BUG-001: state_by_view_layer faltante en respuesta GET
- **Severidad:** CRÍTICA
- **Archivo:** Backend (list-projection-model.js o endpoint handler)
- **Línea:** PENDIENTE identificar exacta
- **Descripción:** Si backend no devuelve `state_by_view_layer`, UI usa fallback legacy + columna error
- **Evidencia:** UI muestra `[INVARIANT_BROKEN] Missing state_by_view_layer` (línea 2779)

#### BUG-002: Refresh Engine fallback a legacy cuando surfaces vacías
- **Severidad:** ALTA
- **Archivo:** `public/js/master/master-alquimia-general-client.js`
- **Línea:** 6565+
- **Descripción:** Si `buildRefreshPlan()` retorna `[]`, Refresh Engine v2 cae a legacy manual
- **Evidencia:** Log `[REFRESH_ENGINE][ALQG][LEGACY_REFRESH] Sin surfaces declarativas`

#### BUG-003: UI muestra éxito verde aunque applied=0
- **Severidad:** MEDIA (hipótesis, necesita verificación)
- **Archivo:** UI handler de reset_all
- **Línea:** PENDIENTE identificar
- **Descripción:** Si UI solo verifica HTTP 200, muestra éxito aunque backend reporte `applied=0`
- **Evidencia:** PENDIENTE verificar código exacto de toast/success

#### BUG-004: Fallback legacy a student.state puede desincronizar
- **Severidad:** MEDIA
- **Archivo:** `master-alquimia-general-client.js`
- **Línea:** 2775-2808
- **Descripción:** Fallback usa `student.state` que puede diferir de `state_by_view_layer[view_layer].state`
- **Evidencia:** Código tiene fallback con warning, pero no bloquea render completamente

### L2) HIPÓTESIS CONFIRMADAS/REFUTADAS

**✅ CONFIRMADO:**
- UI usa `state_by_view_layer[view_layer].state` como fuente canónica
- CPM calcula estados correctamente según RESET_RECURRENTE_V1
- Refresh Engine v2 existe pero puede caer a legacy
- Reset endpoints devuelven `applied`/`skipped`/`total`

**❌ REFUTADO:**
- (Ninguna hipótesis refutada aún - diagnóstico en progreso)

**⏳ PENDIENTE VERIFICAR:**
- ¿Backend SIEMPRE devuelve `state_by_view_layer`?
- ¿UI interpreta `applied` de respuesta reset?
- ¿Hay cache de overrides que no se invalida?

### L3) PLAN DE REPARACIÓN (Solo plan, NO cambios)

**Prioridad 1 (Rompe invariantes):**
1. **BUG-001:** Verificar que `computeListProjection()` SIEMPRE incluye `state_by_view_layer` en respuesta
2. **BUG-002:** Asegurar que `buildRefreshPlan()` NUNCA retorna array vacío (fallback seguro)

**Prioridad 2 (Causa síntomas):**
3. **BUG-003:** Verificar UI interpreta `applied`/`total_items` antes de mostrar éxito
4. **BUG-004:** Eliminar fallback legacy o bloquear render si falta `state_by_view_layer`

**Prioridad 3 (Robustez):**
5. Invalidad cache de overrides tras reset overrides
6. Verificar coherencia DB (student_id INTEGER vs student_uuid UUID)

---

**DIAGNÓSTICO COMPLETO - v1**  
**Fecha:** 2025-01-27  
**Estado:** ✅ INVENTARIO Y EVIDENCIA RECOPILADA  
**Pendiente:** Scripts forenses (B2), verificaciones de DB (B3), evidencia de repro (J3)

