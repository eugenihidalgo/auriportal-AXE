# CLEANING RESET CANÓNICO v1

**Fecha:** 2025-01-27  
**Versión:** v5.73.0 (actualizado v5.74.0)  
**Estado:** Implementado  
**Nota v5.74.0:** Reset SOLO aplica a RECURRENTE. UNA_VEZ no tiene reset (hard fail si se intenta).

---

## A) Propósito

### Problema Raíz

Antes de v5.73.0, `reset-item` y `reset-list` eliminaban registros de `cleaning_item_state` (DELETE), lo cual causaba que el Cleaning Projection Model (CPM) calculara estado `never` (porque no había `last_cleaned_at`).

**Semántica incorrecta:**
- Reset eliminaba historia (DELETE de proyección)
- Reset producía estado `never` (semánticamente incorrecto)
- Reset no estaba integrado en Refresh Engine v1 (no determinista)

### Solución Canónica

**RESET CANÓNICO v1** define reset como **invalidación operativa**, preservando historia:

- Reset es un **EVENTO** del Cleaning Engine (append-only en `cleaning_events`)
- Reset **NO borra** `cleaning_item_state`, establece `effective_since` (punto de corte operativo)
- Reset **NUNCA produce** estado `never` si hubo historia; tras reset el estado efectivo es `pending`
- Reset está integrado en Refresh Engine v1 (ciclo determinista: mutación → refetch → render)

---

## B) Modelo de Datos

### Tablas

#### `cleaning_events` (append-only audit)

**Nueva acción:** `action_type='reset'`

**Estructura del evento reset:**
```sql
{
  action_type: 'reset',
  clean_layer: 'shared' | 'pde',
  item_kind: 'recurrente' | 'una_vez',
  execution_key: 'reset:{item_ref}:{student_uuid}:{clean_layer}:{day}',
  meta: {
    reset_canonical_v1: true,
    item_id: number,
    lista_id: number
  }
}
```

**Reglas:**
- Append-only (no se modifica ni elimina)
- Idempotencia vía `execution_key` (unique constraint)
- Soporta reset por capa (shared/pde independientes)

#### `cleaning_item_state` (proyección canónica)

**Nuevas columnas:**

```sql
shared_effective_since TIMESTAMPTZ NULL,
pde_effective_since TIMESTAMPTZ NULL,
shared_had_history BOOLEAN NOT NULL DEFAULT false,
pde_had_history BOOLEAN NOT NULL DEFAULT false
```

**Interpretación de `effective_since`:**

- Si `effective_since` existe → reset aplicado (punto de corte operativo)
- `last_effective_clean = max(last_cleaned_at, effective_since)`
- Si solo existe `effective_since` (sin `last_cleaned_at`) → `last_effective_clean = effective_since`
- `days_since_last_effective_clean = now - last_effective_clean`

**Interpretación de `had_history`:**

- `had_history = true` → hubo limpieza previa antes del reset
- Útil para distinguir `never` (sin historia) vs `pending` (con reset)

**Reglas:**
- Reset NO borra contadores ni fechas históricas
- Reset solo establece `effective_since = NOW()`
- Si no existe fila, se crea con `effective_since = NOW()` y contadores en 0

---

## C) Semántica por item_kind

### RECURRENTE

**Fórmula de `last_effective_clean`:**

```javascript
last_effective_clean_at =
  if last_cleaned_at && effective_since:
    max(last_cleaned_at, effective_since)
  else if effective_since:
    effective_since
  else if last_cleaned_at:
    last_cleaned_at
  else:
    null
```

**Cálculo de `days_since_last_effective_clean`:**

```javascript
days_since_last_effective_clean = now - last_effective_clean_at (si existe)
```

**Regla de estado:**

- Si `last_effective_clean_at === null`:
  - Si `effective_since` existe → `pending` (NO `never`)
  - Si no hay reset y no hay `last_cleaned_at` → `never`
- else:
  - `reviewed` / `pending` / `important` según umbrales usando `days_since_last_effective_clean`

**view_layer='effective':**

- `effective_state` = mejor estado entre shared y pde
- `effective_days_since` = mínimo de `days_since_effective` por capa
- `effective_sources` = `{ shared: boolean, pde: boolean }` (indica qué capas están en 'reviewed')

### UNA_VEZ

**REGLA CONSTITUCIONAL CPM v2: Reset PROHIBIDO en UNA_VEZ**

**Aclaración explícita:**
- Reset SOLO aplica a RECURRENTE
- UNA_VEZ NO tiene reset
- UNA_VEZ NO tiene `effective_since`
- Overrides ≠ reset (overrides permitidos, reset prohibido)

**Comportamiento:**
- Si se intenta reset en UNA_VEZ → hard fail (error `RESET_UNA_VEZ_FORBIDDEN`)
- `effective_since` en UNA_VEZ se ignora (no afecta cálculo de estado)
- UNA_VEZ solo tiene contadores (`clean_count`, `remaining`, `completed`) + overrides

**Regla de estado UNA_VEZ (sin reset):**

- `never`: `cleanCount === 0`
- `pending`: `cleanCount < required_count`
- `completed`: `cleanCount >= required_count`

**Overrides permitidos:**
- Overrides de configuración (`required_count`, `threshold_days`) están permitidos
- Overrides NO son reset (no invalidan progreso)
- Overrides se aplican vía `resolveItemConfigForStudent()`

---

## D) Contratos API

### POST `/master/api/alquimia-general/reset-item`

**Request:**
```json
{
  "student_uuid": "uuid",
  "item_ref": "string",
  "item_kind": "recurrente" | "una_vez",
  "scope": "student",
  "view_layer": "shared" | "pde" | "combo" | "effective" (opcional),
  "clean_layer": "shared" | "pde" (opcional, deriva de view_layer si no viene)
}
```

**Response:**
```json
{
  "ok": true,
  "reset": true,
  "item_ref": "string",
  "item_kind": "recurrente" | "una_vez",
  "applied": boolean,
  "skipped": number,
  "layers_affected": ["shared", "pde"],
  "mode": "event",
  "deleted": false,
  "trace_id": "string"
}
```

**Layers afectadas:**

- Si `clean_layer` viene explícito → reset solo esa capa
- Si `view_layer='effective'` (recurrente) → reset BOTH (shared + pde)
- Si `view_layer='combo'` (una_vez) → reset BOTH (shared + pde)
- Si `view_layer='shared'` o `'pde'` → reset solo esa capa
- Default: reset `shared` si no hay información

### POST `/master/api/alquimia-general/reset-list`

**Request:**
```json
{
  "student_uuid": "uuid",
  "list_id": number,
  "item_kind": "recurrente" | "una_vez" (opcional),
  "scope": "student",
  "view_layer": "shared" | "pde" | "combo" | "effective" (opcional)
}
```

**Response:**
```json
{
  "ok": true,
  "reset": true,
  "list_id": number,
  "item_kind": "recurrente" | "una_vez" | null,
  "applied": number,
  "skipped": number,
  "layers_affected": ["shared", "pde"],
  "mode": "event",
  "deleted_count": 0,
  "trace_id": "string"
}
```

**Compatibilidad:**

- Campo `deleted` / `deleted_count` se mantiene para compatibilidad (siempre `false` / `0`)
- Campo `mode: 'event'` indica que es reset canónico (evento, no delete)

---

## E) Integración Refresh Engine v1

### Mutations Nuevas

**`alquimia.reset.item`**

```javascript
{
  module: 'alquimia_general',
  mutation_type: 'alquimia.reset.item',
  scope: {
    view_mode: 'proyeccion' | 'operativa',
    view_layer: 'shared' | 'pde' | 'combo' | 'effective'
  },
  context: {
    item_ref: string,
    student_uuid: string,
    item_kind: 'recurrente' | 'una_vez',
    layers_affected: ['shared', 'pde']
  }
}
```

**`alquimia.reset.list`**

```javascript
{
  module: 'alquimia_general',
  mutation_type: 'alquimia.reset.list',
  scope: {
    view_mode: 'proyeccion' | 'operativa',
    view_layer: 'shared' | 'pde' | 'combo' | 'effective'
  },
  context: {
    list_id: number,
    student_uuid: string,
    item_kind: 'recurrente' | 'una_vez',
    layers_affected: ['shared', 'pde']
  }
}
```

### Garantía: 1 mutación → 1 refetch → 1 render

**Flujo:**

1. Usuario hace clic en "Reset progreso"
2. `resetStudentItemProgress()` → POST endpoint
3. Backend inserta evento en `cleaning_events` y actualiza `cleaning_item_state` (effective_since)
4. Frontend recibe respuesta
5. `afterMutation()` del Refresh Engine:
   - `invalidate()` → limpia `state.projection.data` o `state.items`
   - `refetch()` → `loadListProjection()` o `loadItems()`
   - `refreshModal()` → refresca flotante si está abierto
   - `render()` → `renderView()`

### Flotante se refresca si está abierto

- Si `state.modal.item.item_ref === context.item_ref` → `refreshModal()` se ejecuta
- Flotante se refresca con `view_layer` activo del modal

---

## F) Invariantes Constitucionales

### Prohibido

- ❌ Delete de proyección como semántica de dominio
- ❌ Reset que produce estado `never` si hubo historia
- ❌ Reset sin evento en `cleaning_events`
- ❌ Reset que borra contadores históricos
- ❌ Reset sin integración en Refresh Engine v1
- ❌ `confirm()` o `alert()` en flujos de reset (usar toasts)

### Obligatorio

- ✅ Reset es evento del Cleaning Engine (append-only)
- ✅ Reset conserva historia (contadores, fechas históricas)
- ✅ Reset nunca produce `never` (si hubo reset, siempre es `pending`)
- ✅ Reset pasa por Refresh Engine v1 (ciclo determinista)
- ✅ UI pasiva (backend decide estados, UI solo renderiza)
- ✅ Backend es Source of Truth

---

## G) Casos Límite y Ejemplos

### Alumno nunca limpiado + reset

**Estado inicial:**
- No existe fila en `cleaning_item_state`
- Estado calculado: `never`

**Tras reset:**
- Se crea fila con `shared_effective_since = NOW()`, `shared_had_history = false`
- `last_effective_clean = effective_since = NOW()`
- `days_since_last_effective_clean = 0`
- Estado calculado: `pending` (NO `never`)

**Regla:** Reset manual por Master fuerza estado operativo "pendiente", aunque nunca hubiera historia.

### Alumno con historia + reset

**Estado inicial:**
- `shared_last_cleaned_at = '2025-01-20'`, `shared_clean_count = 5`
- `days_since_last_clean = 7`
- Estado calculado: `reviewed`

**Tras reset:**
- `shared_effective_since = NOW()`, `shared_had_history = true`
- `last_effective_clean = max('2025-01-20', NOW()) = NOW()`
- `days_since_last_effective_clean = 0`
- Estado calculado: `pending` (NO `never`)
- Contadores históricos se conservan: `shared_clean_count = 5`

**Tras limpiar de nuevo:**
- `shared_last_cleaned_at = NOW()`, `shared_clean_count = 6`
- `last_effective_clean = max(NOW(), NOW()) = NOW()`
- `days_since_last_effective_clean = 0`
- Estado calculado: `reviewed`

### effective view_layer y combo

**effective (recurrente):**

- Reset puede aplicarse a BOTH layers (shared + pde)
- `effective_state` = mejor estado entre shared y pde
- Si una capa tiene reset y otra no, `effective` refleja el mejor estado

**combo (una_vez):**

- Reset puede aplicarse a BOTH layers (shared + pde)
- `combo.completed_effective = 0` (reinicio efectivo)
- `combo.remaining_effective = required_count`

### Idempotencia (reset dos veces mismo día)

**Primera vez:**
- `execution_key = 'reset:item_123:uuid:shared:2025-01-27'`
- Evento insertado, `effective_since = NOW()`

**Segunda vez (mismo día):**
- `execution_key = 'reset:item_123:uuid:shared:2025-01-27'` (mismo)
- Evento ya existe → `skipped = 1`
- `effective_since` no cambia (ya está en NOW())

**Regla:** Reset es idempotente por día y capa (no se puede resetear la misma capa dos veces el mismo día).

---

## H) Checklist de Verificación

### Curls (adaptar a tokens/autenticación)

```bash
# 1. GET list-projection recurrente all
curl -i "http://localhost:3000/master/api/alquimia-general/list-projection?list_id=1&item_kind=recurrente&view_layer=shared&scope=all"

# 2. GET list-projection recurrente student
curl -i "http://localhost:3000/master/api/alquimia-general/list-projection?list_id=1&item_kind=recurrente&view_layer=shared&scope=student&student_uuid=<UUID>"

# 3. GET items/:item_ref/students con view_layer=shared
curl -i "http://localhost:3000/master/api/alquimia-general/items/item_123/students?view_layer=shared&clean_layer=shared"

# 4. POST reset-item
curl -i -X POST "http://localhost:3000/master/api/alquimia-general/reset-item" \
  -H "Content-Type: application/json" \
  -d '{
    "student_uuid": "<UUID>",
    "item_ref": "item_123",
    "item_kind": "recurrente",
    "scope": "student",
    "view_layer": "shared"
  }'

# 5. GET proyección después de reset (verificar pending)
curl -i "http://localhost:3000/master/api/alquimia-general/list-projection?list_id=1&item_kind=recurrente&view_layer=shared&scope=student&student_uuid=<UUID>"
```

### UI Pasos

1. Abrir `/master/templo-luz/alquimia-general`
2. Seleccionar lista recurrente
3. Cambiar a modo "Proyección"
4. Seleccionar scope "Alumno" y elegir estudiante
5. Verificar estado inicial de un item (puede ser `reviewed`, `pending`, `important` o `never`)
6. Hacer clic en "Reset progreso" del item
7. **Verificar:**
   - Toast muestra "Reset completado"
   - Item aparece en columna `pending` (NO `never`)
   - UI refresca sin recargar página
   - Proyección y flotante se sincronizan

### Tests

**Casos mínimos críticos:**

1. **RECURRENTE:**
   - Alumno sin estado → `state=never`
   - Aplicar reset → `state=pending` (NO `never`)
   - Aplicar clean → `state=reviewed`
   - Aplicar reset → `state=pending` (NO `never`)

2. **UNA_VEZ (combo):**
   - Alumno con progreso (`completed>0`) → `pending`/`reviewed` según `required`
   - Aplicar reset → `pending`, `remaining_effective = required`
   - Volver a increment/clean → progresa normal

3. **Refresh Engine:**
   - `handleResetItem` llama `afterMutation` y se ejecuta `refetch+render`
   - No rompe `canRender` (`list_id` no se vuelve `null`)

4. **API:**
   - `reset-item` devuelve `ok` y `applied`/`skipped`
   - NO elimina `cleaning_item_state` (solo establece `effective_since`)

---

## Referencias

- **Migración:** `database/migrations/v5.73.0-reset-canonical-v1.sql`
- **Cleaning Engine:** `src/core/master/services/cleaning-engine-service.js` (función `resetStudentItemProgress`)
- **CPM:** `src/core/master/services/cleaning-projection-model.js` (función `computeStateForLayer`)
- **Endpoints:** `src/endpoints/master-api-alquimia-general.js` (POST `/reset-item`, POST `/reset-list`)
- **Frontend:** `public/js/master/master-alquimia-general-client.js` (funciones `resetStudentItemProgress`, `resetStudentListProgress`)
- **Refresh Engine:** `public/js/master/master-refresh-engine-v1.js` (adapter `AlquimiaGeneralRefreshAdapter`)

---

**FIN DE DOCUMENTACIÓN**
