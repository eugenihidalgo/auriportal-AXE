# ALQUIMIA RESET CANÓNICO v1

**FECHA:** 2026-01-27  
**DOMINIO:** MASTER  
**VERSIÓN:** 1.0.0

---

## DEFINICIÓN SEMÁNTICA

**RESET** es una acción canónica de primer nivel que reinicia el ciclo de limpieza de un item recurrente para uno o más estudiantes.

### Características Fundamentales

1. **SOLO para RECURRENTE**: Reset está PROHIBIDO para `item_kind='una_vez'`
2. **NO vuelve a NUNCA**: Tras reset, el estado es `PENDIENTE` (days_since = 0), no `NUNCA`
3. **Evento auditable**: Se registra en `cleaning_events` con `action_type='reset'`
4. **execution_key BACKEND-ONLY**: El frontend NO incluye execution_key en el payload
5. **Consistencia obligatoria**: Acción → Proyección → Ubicación debe ser consistente

---

## TIPOS DE RESET

### reset_scope

El sistema soporta 4 tipos de reset según `reset_scope`:

| reset_scope | Descripción | Requiere |
|------------|-------------|----------|
| `ITEM_STUDENT` | Reset item para estudiante específico | `item_ref`, `student_uuid`, `clean_layer` |
| `ITEM_ALL` | Reset item para todos los estudiantes | `item_ref`, `clean_layer` |
| `LIST_STUDENT` | Reset lista para estudiante específico | `list_id`, `student_uuid`, `clean_layer` |
| `LIST_ALL` | Reset lista para todos los estudiantes | `list_id`, `clean_layer` |

### clean_layer

**OBLIGATORIO** en todos los tipos de reset:

- `shared`: Resetea solo la capa SHARED
- `pde`: Resetea solo la capa PDE

**REGLA CANÓNICA**: `view_layer='effective'` → `clean_layer='pde'` (OBLIGATORIO)

---

## CONTRATO DE PAYLOAD FRONTEND

### Reglas Obligatorias

| reset_scope   | student_uuid | item_ref | list_id | clean_layer |
|--------------|--------------|----------|---------|-------------|
| `ITEM_STUDENT` | **OBLIGATORIO** | **SÍ** | NO | **OBLIGATORIO** |
| `LIST_STUDENT` | **OBLIGATORIO** | NO | **SÍ** | **OBLIGATORIO** |
| `ITEM_ALL` | **PROHIBIDO** | **SÍ** | NO | **OBLIGATORIO** |
| `LIST_ALL` | **PROHIBIDO** | NO | **SÍ** | **OBLIGATORIO** |

### Validaciones en Action Registry

**buildResetPayload()** aplica validaciones condicionales:

1. **ITEM_STUDENT:**
   - ✅ Requiere `student_uuid`
   - ✅ Requiere `item_ref`
   - ❌ Si falta → Error explícito

2. **LIST_STUDENT:**
   - ✅ Requiere `student_uuid`
   - ✅ Requiere `list_id`
   - ❌ Si falta → Error explícito

3. **ITEM_ALL:**
   - ❌ **PROHIBE** `student_uuid` (si existe → Error explícito)
   - ✅ Requiere `item_ref`
   - ❌ Si falta → Error explícito

4. **LIST_ALL:**
   - ❌ **PROHIBE** `student_uuid` (si existe → Error explícito)
   - ✅ Requiere `list_id`
   - ❌ Si falta → Error explícito

### ¿Por qué student_uuid está PROHIBIDO en *_ALL?

**Razón semántica:**
- Reset ALL afecta a **TODOS** los estudiantes activos
- Incluir `student_uuid` sería semánticamente incorrecto
- El backend itera sobre todos los estudiantes, no sobre uno específico

**Razón técnica:**
- El backend valida que `student_uuid` NO existe para `*_ALL`
- Si se incluye, el backend rechazaría la petición
- Fail-loud en Action Registry previene errores en runtime

**Razón de diseño:**
- El reset es una **acción histórica visible** (para informes futuros)
- Cada estudiante tiene su propio evento en `cleaning_events`
- El `execution_key` se genera por estudiante (backend-only)

### Sanidad del Payload

**Reglas de construcción:**
- `student_uuid` SOLO se incluye en payload para `*_STUDENT`
- `student_uuid` NUNCA se incluye en payload para `*_ALL`
- `execution_key` NUNCA se incluye desde frontend (BACKEND-ONLY)
- `clean_layer` siempre explícito (derivado desde `view_layer`)

**Ejemplo de payload ITEM_ALL (correcto):**
```json
{
  "reset_scope": "ITEM_ALL",
  "item_ref": "item_123",
  "clean_layer": "pde"
  // ❌ NO incluye student_uuid
  // ❌ NO incluye execution_key
}
```

**Ejemplo de payload ITEM_ALL (incorrecto - rechazado):**
```json
{
  "reset_scope": "ITEM_ALL",
  "item_ref": "item_123",
  "student_uuid": "550e8400-...", // ❌ PROHIBIDO
  "clean_layer": "pde"
}
// Error: "student_uuid está PROHIBIDO para reset_scope='ITEM_ALL'"
```

---

## FLUJO TÉCNICO

### 1. Action Registry

**Acción registrada:** `alquimia.reset`

**Ubicación:** `src/core/ux/action-registry/alquimia-actions.js`

**Definición:**
```javascript
{
  action_id: 'alquimia.reset',
  domain: 'master',
  allowed_item_kinds: ['recurrente'], // ❗ SOLO recurrente
  allowed_layers: ['shared', 'pde'],
  allowed_scopes: ['ITEM_STUDENT', 'ITEM_ALL', 'LIST_STUDENT', 'LIST_ALL'],
  handler: {
    method: 'POST',
    endpointBuilder: () => '/master/api/alquimia-general/reset',
    buildPayload: buildResetPayload
  },
  refresh: buildRefreshPlan
}
```

### 2. Backend - Cleaning Engine

**Función unificada:** `resetByScope()`

**Ubicación:** `src/core/master/services/cleaning-engine-service.js`

**Mapeo de scopes:**

```javascript
ITEM_STUDENT → resetStudentItemProgress()
ITEM_ALL → resetAllStudentsItemProgress()
LIST_STUDENT → iterar items + resetStudentItemProgress()
LIST_ALL → iterar items + resetAllStudentsItemProgress()
```

**Campos escritos en DB:**

```sql
-- Para clean_layer='shared' y item_kind='recurrente':
shared_effective_since = NOW()
shared_last_cleaned_at = NULL
shared_clean_count = 0

-- Para clean_layer='pde' y item_kind='recurrente':
pde_effective_since = NOW()
pde_last_cleaned_at = NULL
pde_clean_count = 0
```

**Evento histórico:**

```javascript
{
  action_type: 'reset',
  execution_key: 'reset:item_ref:student_uuid:clean_layer:timestamp', // Generado internamente
  trace_id: '<trace_id>',
  student_uuid: '<uuid>',
  item_ref: '<item_ref>',
  clean_layer: 'shared' | 'pde',
  item_kind: 'recurrente'
}
```

### 3. Endpoint MASTER

**Endpoint único:** `POST /master/api/alquimia-general/reset`

**Body:**
```json
{
  "reset_scope": "ITEM_STUDENT" | "ITEM_ALL" | "LIST_STUDENT" | "LIST_ALL",
  "item_ref": "<item_ref>", // Requerido si scope incluye ITEM
  "list_id": "<list_id>", // Requerido si scope incluye LIST
  "student_uuid": "<uuid>", // Requerido si scope incluye STUDENT
  "clean_layer": "shared" | "pde", // OBLIGATORIO
  "reason": "<razón>", // Opcional, para auditoría
  "item_kind": "recurrente" // Opcional, para validación
}
```

**Response:**
```json
{
  "ok": true,
  "reset_scope": "ITEM_STUDENT",
  "applied": true,
  "skipped": 0,
  "total": 1,
  "layers_affected": ["shared"],
  "trace_id": "<trace_id>"
}
```

**NOTA:** `execution_key` NO se devuelve (es BACKEND-ONLY)

### 4. UI MASTER

**Función canónica:** `performAction()`

**Ejemplo ITEM_STUDENT:**
```javascript
await window.performAction({
  action_id: 'alquimia.reset',
  context: {
    reset_scope: 'ITEM_STUDENT',
    item_ref: '<item_ref>',
    student_uuid: '<uuid>',
    clean_layer: 'shared',
    item_kind: 'recurrente'
  },
  uiState: {
    view_mode: 'proyeccion',
    view_layer: 'shared',
    list_id: '<list_id>'
  }
});
```

**Ejemplo ITEM_ALL:**
```javascript
await window.performAction({
  action_id: 'alquimia.reset',
  context: {
    reset_scope: 'ITEM_ALL',
    item_ref: '<item_ref>',
    clean_layer: 'pde', // Reset ALL típicamente PDE
    item_kind: 'recurrente'
  },
  uiState: { ... }
});
```

**Ejemplo LIST_STUDENT:**
```javascript
await window.performAction({
  action_id: 'alquimia.reset',
  context: {
    reset_scope: 'LIST_STUDENT',
    list_id: '<list_id>',
    student_uuid: '<uuid>',
    clean_layer: 'shared',
    item_kind: 'recurrente'
  },
  uiState: { ... }
});
```

**Ejemplo LIST_ALL:**
```javascript
await window.performAction({
  action_id: 'alquimia.reset',
  context: {
    reset_scope: 'LIST_ALL',
    list_id: '<list_id>',
    clean_layer: 'pde', // Reset ALL típicamente PDE
    item_kind: 'recurrente'
  },
  uiState: { ... }
});
```

**PROHIBIDO:**
- ❌ `fetch()` directo a endpoints de reset
- ❌ Rutas hardcodeadas (`/master/api/alquimia-general/reset-item`)
- ❌ Refresh manual (Refresh Engine se ejecuta automáticamente)

### 5. Historial

**Tabla:** `cleaning_events`

**Filtros:**
- `action_type = 'reset'`
- `student_uuid = '<uuid>'` (para historial de alumno)
- `item_ref = '<item_ref>'` (para historial de item)

**Campos relevantes:**
- `execution_key`: Identificador único del reset
- `trace_id`: Trazabilidad completa
- `clean_layer`: Capa afectada (shared | pde)
- `meta.reason`: Razón del reset (si se proporcionó)

---

## EJEMPLOS

### Ejemplo 1: Reset SHARED de item para estudiante

**Request:**
```json
POST /master/api/alquimia-general/reset
{
  "reset_scope": "ITEM_STUDENT",
  "item_ref": "item_123",
  "student_uuid": "550e8400-e29b-41d4-a716-446655440000",
  "clean_layer": "shared",
  "reason": "Reinicio de ciclo de práctica"
}
```

**Estado en DB tras reset:**
```sql
shared_effective_since = '2026-01-27 12:00:00'
shared_last_cleaned_at = NULL
shared_clean_count = 0
pde_effective_since = NULL (no afectado)
pde_last_cleaned_at = '<fecha_anterior>' (no afectado)
```

**Proyección resultante:**
```javascript
{
  state: 'never', // Tras reset, sin limpieza posterior
  days_since: 0, // NUMBER 0, no null
  days_since_last_clean: 0
}
```

### Ejemplo 2: Reset ALL de item (PDE)

**Request:**
```json
POST /master/api/alquimia-general/reset
{
  "reset_scope": "ITEM_ALL",
  "item_ref": "item_123",
  "clean_layer": "pde"
}
```

**Resultado:**
- Todos los estudiantes activos (excluyendo pausados)
- Solo capa PDE reseteada
- SHARED no afectado

### Ejemplo 3: Reset LIST_STUDENT

**Request:**
```json
POST /master/api/alquimia-general/reset
{
  "reset_scope": "LIST_STUDENT",
  "list_id": 5,
  "student_uuid": "550e8400-e29b-41d4-a716-446655440000",
  "clean_layer": "shared"
}
```

**Resultado:**
- Todos los items recurrentes de la lista
- Solo para el estudiante especificado
- Solo capa SHARED reseteada

---

## INVARIANTES

### Invariante 1: Reset SOLO Recurrente

**Regla:** Reset está PROHIBIDO para `item_kind='una_vez'`

**Validación:**
- Action Registry: `allowed_item_kinds: ['recurrente']`
- Backend: Hard fail si `item_kind !== 'recurrente'`
- UI: Botones de reset NO se renderizan para `una_vez`

### Invariante 2: clean_layer Obligatorio

**Regla:** `clean_layer` es OBLIGATORIO en todos los tipos de reset

**Validación:**
- Action Registry: `allowed_layers: ['shared', 'pde']`
- Backend: Hard fail si `clean_layer` falta o es inválido
- UI: `clean_layer` siempre explícito en `context`

### Invariante 3: execution_key BACKEND-ONLY

**Regla:** `execution_key` NO se incluye en payload frontend

**Validación:**
- Action Registry: `buildResetPayload()` NO incluye `execution_key`
- Backend: Genera `execution_key` internamente
- Response: NO devuelve `execution_key`

### Invariante 4: Reset NO vuelve a NUNCA

**Regla:** Tras reset, el estado es `PENDIENTE` (days_since = 0), no `NUNCA`

**Validación:**
- Backend: `effective_since = NOW()` → estado calculado = `never` con `days_since = 0`
- Proyección: `days_since_last_clean = 0` (NUMBER, no null)
- UI: Muestra "0d" o "Nunca" según implementación de display

### Invariante 5: Consistencia Acción → Proyección → Ubicación

**Regla:** La UI lee estado EXCLUSIVAMENTE desde `state_by_view_layer`

**Validación:**
- UI: Usa `getRecurrenteStateFromProjection(student, viewLayer)`
- Backend: Proyecta `state_by_view_layer[view_layer].metrics.days_since_last_clean`
- NO hay undefined en UI tras reset

### Invariante 6: Refresh Automático

**Regla:** Refresh se ejecuta automáticamente vía Refresh Engine

**Validación:**
- `performAction()` ejecuta refresh plan declarativo
- UI NO hace refresh manual
- Refresh Engine refresca superficies según `refresh_plan`

---

## VERIFICACIÓN

### Checklist Obligatorio

- [ ] Reset → columna PENDIENTE (no NUNCA)
- [ ] `days_since = 0` (NUMBER, no null)
- [ ] Un solo click funciona
- [ ] No hay undefined en UI
- [ ] No hay dobles ejecuciones (idempotencia)
- [ ] Frontend NO depende de `execution_key`
- [ ] Historial muestra eventos RESET
- [ ] Action Registry valida correctamente
- [ ] Backend genera `execution_key` internamente
- [ ] Refresh automático funciona

---

## REFERENCIAS

- Action Registry: `src/core/ux/action-registry/alquimia-actions.js`
- Backend Service: `src/core/master/services/cleaning-engine-service.js` → `resetByScope()`
- Endpoint: `src/endpoints/master-api-alquimia-general.js` → `POST /master/api/alquimia-general/reset`
- UI Client: `public/js/master/master-alquimia-general-client.js`
- CPM v2: `src/core/master/services/cleaning-projection-model.js`
- View Authority: `docs/CONSTITUTION_VIEW_AUTHORITY_V1.md`

---

**FIN DEL DOCUMENTO**
