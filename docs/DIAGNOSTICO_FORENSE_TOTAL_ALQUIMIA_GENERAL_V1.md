# 🔬 DIAGNÓSTICO FORENSE TOTAL — ALQUIMIA GENERAL (MASTER)
## Objetivo: detectar por qué alumnos NO se limpian, NO cambian de columna, NO se actualizan ítems
## Foco especial: RECURRENTES + RESETS

**FECHA:** 2026-01-27  
**MODO:** SOLO OBSERVACIÓN + AUDITORÍA (NO FIXES)  
**DOMINIO:** MASTER

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ REGLAS ABSOLUTAS DEL DIAGNÓSTICO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- ❌ NO implementar fixes
- ❌ NO refactorizar
- ❌ NO "arreglar" nada
- ❌ NO cambiar contratos ni lógica
- ❌ NO suposiciones
- ❌ NO interpretaciones creativas
- ✅ SOLO observar, inspeccionar, loguear y documentar
- ✅ TODO debe basarse en código REAL y datos REALES
- ✅ Cada conclusión debe tener evidencia (archivo + línea + log)

Este diagnóstico busca **causa raíz**, no parches.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1️⃣ MAPA COMPLETO DEL SISTEMA (REAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 1.1 Servicios Involucrados

### A) Cleaning Engine Service
**Archivo:** `src/core/master/services/cleaning-engine-service.js`  
**Líneas clave:** 1-2200

**Funciones públicas:**
- `markCleanStudent(options, client)` (línea 302)
  - **Qué decide:** Si se puede limpiar, qué capa escribir, execution_key, idempotencia
  - **Qué NO decide:** Estado visual (delega a CPM)
  
- `markCleanAllStudents(options, client)` (línea 836)
  - **Qué decide:** Qué estudiantes incluir, filtros de pausa, skip_level_filter
  - **Qué NO decide:** Estado visual (delega a CPM)
  
- `resetStudentItemProgress(options, client)` (línea 1327)
  - **Qué decide:** Capas a resetear, execution_key para reset, coherencia view_layer/clean_layer
  - **Qué NO decide:** Estado visual post-reset (delega a CPM)
  
- `resetAllStudentsItemProgress(options, client)` (línea 1716)
  - **Qué decide:** Qué estudiantes resetear, filtros de pausa
  - **Qué NO decide:** Estado visual post-reset (delega a CPM)

**Dependencias:**
- `cleaning-events-repo-pg.js` → inserta eventos
- `cleaning-item-state-repo-pg.js` → actualiza proyección
- `pausa-repo-pg.js` → verifica pausa
- `alquimia-catalog-repo-pg.js` → valida items
- `student-level-state-repo-pg.js` → obtiene nivel efectivo

**Evidencia:**
```javascript
// cleaning-engine-service.js:302
export async function markCleanStudent(options, client = null) {
  // 1. Verifica pausa (línea 384)
  // 2. Obtiene item (línea 396)
  // 3. Verifica nivel (línea 402-458)
  // 4. Valida coherencia item_kind/lista.tipo (línea 468-479)
  // 5. Genera execution_key (línea 507)
  // 6. Inserta evento (línea 573)
  // 7. Verifica idempotencia (línea 586-620)
  // 8. Verifica reset previo y reconstruye si necesario (línea 622-678)
  // 9. Aplica a proyección (línea 695-745)
}
```

### B) Alquimia General Service
**Archivo:** `src/services/alquimia-general-service.js`  
**Líneas clave:** 1-1584

**Funciones públicas:**
- `getStudentsForItem(itemRef, tipo, productKey, options)` (línea 541)
  - **Qué decide:** Qué datos leer, cómo aplicar overrides, cómo calcular estados
  - **Qué NO decide:** Estado base (lee desde repositorio)
  
- `markCleanStudent(studentUuid, itemRef, itemKind, productKey, cleanLayer)` (línea 1027)
  - **Qué decide:** Delegar a Cleaning Engine
  - **Qué NO decide:** Lógica de limpieza (delega completamente)

**Evidencia:**
```javascript
// alquimia-general-service.js:541
export async function getStudentsForItem(itemRef, tipo, productKey = 'pde', options = {}) {
  // 1. Valida clean_layer obligatorio (línea 552-561)
  // 2. Valida view_layer obligatorio para RECURRENTE (línea 566-576)
  // 3. Lee desde Cleaning Engine (línea 621-634)
  // 4. Filtra pausados (línea 644-652)
  // 5. Calcula estados usando CPM (línea 732-739 para RECURRENTE)
  // 6. Calcula state_by_view_layer completo (línea 762-788)
}
```

### C) Cleaning Projection Model (CPM v2)
**Archivo:** `src/core/master/services/cleaning-projection-model.js`  
**Líneas clave:** 1-480

**Funciones públicas:**
- `computeCleaningProjection({ cleaning_state, item_kind, view_layer, config })` (línea 367)
  - **Qué decide:** Estado visual (reviewed/pending/important/never), days_since_last_clean
  - **Qué NO decide:** Estado base (recibe datos brutos)
  
- `computeRecurrenteLayerState({ threshold_days, criticalThreshold, layerData })` (línea 149)
  - **Qué decide:** Cómo calcular days_since tras reset, estado visual post-reset
  - **Lógica crítica:** Líneas 167-202 (cálculo post-reset)

**Evidencia:**
```javascript
// cleaning-projection-model.js:149-279
function computeRecurrenteLayerState({ threshold_days, criticalThreshold, layerData }) {
  const lastCleanedAt = layerData?.last_cleaned_at ?? null;
  const effectiveSince = layerData?.effective_since ?? null;
  const hasReset = effectiveSince !== null;
  
  if (hasReset && !lastCleanedAt) {
    // RESET aplicado sin limpieza posterior
    state = 'never';
    daysSince = 0;  // NUMBER 0, no null
  }
  // ...
}
```

### D) List Projection Model (LPM v1)
**Archivo:** `src/core/master/services/list-projection-model.js`  
**Líneas clave:** 1-975

**Funciones públicas:**
- `computeListProjection({ list_id, item_kind, view_layer, scope, student_uuid })` (línea 672)
  - **Qué decide:** Cómo agrupar items por estado, métricas agregadas
  - **Qué NO decide:** Estado por item (delega a CPM)

**Evidencia:**
```javascript
// list-projection-model.js:672-961
export async function computeListProjection({ list_id, item_kind, view_layer, scope, student_uuid = null }) {
  // 1. Obtiene items (línea 724)
  // 2. Obtiene cleaning states (línea 734)
  // 3. Para cada item, calcula state_by_view_layer usando CPM (línea 738-885)
  // 4. Calcula métricas (línea 888)
  // 5. Calcula list_state (línea 891)
}
```

## 1.2 Repositorios

### A) Cleaning Item State Repo
**Archivo:** `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js`  
**Tabla:** `cleaning_item_state`

**Estructura de tabla:**
```sql
CREATE TABLE cleaning_item_state (
  id UUID PRIMARY KEY,
  student_id UUID NOT NULL,  -- UUID canónico (migrado en v5.70.0)
  product_key TEXT NOT NULL,
  domain_type TEXT NOT NULL,
  item_ref TEXT NOT NULL,
  -- SHARED columns
  shared_last_cleaned_at TIMESTAMP,
  shared_effective_since TIMESTAMP,
  shared_clean_count INTEGER DEFAULT 0,
  shared_remaining INTEGER,
  shared_completed INTEGER DEFAULT 0,
  -- PDE columns (SIMÉTRICO)
  pde_last_cleaned_at TIMESTAMP,
  pde_effective_since TIMESTAMP,
  pde_clean_count INTEGER DEFAULT 0,
  pde_remaining INTEGER,
  pde_completed INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT cleaning_item_state_unique UNIQUE (student_id, product_key, domain_type, item_ref)
);
```

**Claves primarias:** `(student_id, product_key, domain_type, item_ref)`  
**Constraints:** UNIQUE constraint en (student_id, product_key, domain_type, item_ref)

**Campos que determinan estado RECURRENTE:**
- `shared_last_cleaned_at`: Última limpieza SHARED
- `shared_effective_since`: Inicio del ciclo actual tras reset SHARED
- `shared_clean_count`: Contador de limpiezas SHARED (no usado para estado visual)
- `pde_last_cleaned_at`: Última limpieza PDE
- `pde_effective_since`: Inicio del ciclo actual tras reset PDE
- `pde_clean_count`: Contador de limpiezas PDE (no usado para estado visual)

**Evidencia:**
```javascript
// cleaning-item-state-repo-pg.js:64-114
async upsertApplyRecurrent(options, client = null) {
  // Actualiza SOLO last_cleaned_at y clean_count de la capa especificada
  // NO modifica effective_since (ese es trabajo del reset)
}
```

### B) Cleaning Events Repo
**Archivo:** `src/infra/repos/cleaning/cleaning-events-repo-pg.js`  
**Tabla:** `cleaning_events`

**Estructura de tabla:**
```sql
CREATE TABLE cleaning_events (
  id UUID PRIMARY KEY,
  trace_id TEXT,
  execution_key TEXT NOT NULL,
  student_id UUID NOT NULL,  -- UUID canónico
  product_key TEXT NOT NULL,
  domain_type TEXT NOT NULL,
  item_ref TEXT NOT NULL,
  clean_layer TEXT,
  item_kind TEXT,
  action_type TEXT NOT NULL,  -- 'mark_clean' | 'reset' | 'set_remaining'
  delta_completed INTEGER,
  set_remaining INTEGER,
  actor_type TEXT,
  actor_ref TEXT,
  surface_key TEXT,
  meta JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT cleaning_events_execution_key_unique UNIQUE (execution_key, student_id)
);
```

**Claves primarias:** `(execution_key, student_id)`  
**Constraints:** UNIQUE constraint en (execution_key, student_id) → idempotencia

**Campos que determinan idempotencia:**
- `execution_key`: Clave única por acción/día/capa
- `student_id`: UUID del estudiante
- `action_type`: Tipo de acción ('mark_clean' | 'reset')
- `created_at`: Timestamp del evento

**Evidencia:**
```javascript
// cleaning-events-repo-pg.js:46-80
async insertEvent(event, client = null) {
  // ON CONFLICT (execution_key, student_id) DO NOTHING
  // Si ya existe → devuelve { already_executed: true }
}
```

### C) Alquimia Catalog Repo
**Archivo:** `src/infra/repos/alquimia-catalog-repo-pg.js`  
**Tablas:** `listas_transmutaciones`, `items_transmutaciones`

**Estructura de tablas:**
```sql
CREATE TABLE listas_transmutaciones (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL,  -- 'recurrente' | 'una_vez'
  status TEXT DEFAULT 'active',  -- 'active' | 'archived'
  deleted_at TIMESTAMP
);

CREATE TABLE items_transmutaciones (
  id SERIAL PRIMARY KEY,
  lista_id INTEGER REFERENCES listas_transmutaciones(id),
  item_ref TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  frecuencia_dias INTEGER,  -- Para recurrente
  veces_limpiar INTEGER,    -- Para una_vez
  nivel INTEGER,
  status TEXT DEFAULT 'active',
  deleted_at TIMESTAMP
);
```

**Campos que determinan comportamiento:**
- `lista.tipo`: 'recurrente' | 'una_vez' → determina item_kind canónico
- `item.frecuencia_dias`: Umbral para estado 'reviewed' en RECURRENTE
- `item.veces_limpiar`: Required count para UNA_VEZ

## 1.3 Endpoints API

### A) Endpoints de Lectura
**Archivo:** `src/endpoints/master-api-alquimia-general.js`

**GET /master/api/alquimia-general/items/:item_ref/students** (línea 918)
- **Función:** Devuelve lista de estudiantes para un item
- **Parámetros:** `clean_layer` (obligatorio), `view_layer` (obligatorio para RECURRENTE)
- **Respuesta:** `{ students: [], counts: {}, total: 0 }`
- **Estado calculado:** Sí (vía CPM)

**GET /master/api/alquimia-general/list-projection** (línea 611)
- **Función:** Devuelve proyección de lista completa
- **Parámetros:** `list_id`, `item_kind`, `view_layer`, `scope`, `student_uuid`
- **Respuesta:** `{ items: [], metrics: {}, list_state: {} }`
- **Estado calculado:** Sí (vía LPM → CPM)

### B) Endpoints de Escritura
**POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student** (línea 1154)
- **Función:** Limpia un estudiante específico
- **Body:** `{ student_uuid, item_kind, clean_layer, actor_type, surface_key }`
- **Delega:** `CleaningEngineService.markCleanStudent()`

**POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-all** (línea 1114)
- **Función:** Limpia todos los estudiantes de un item
- **Body:** `{ item_kind, clean_layer, execution_mode }`
- **Delega:** `CleaningEngineService.markCleanAllStudents()`

**POST /master/api/alquimia-general/reset** (línea 1516)
- **Función:** Reset unificado por scope
- **Body:** `{ reset_scope, item_ref, list_id, student_uuid, clean_layer, item_kind }`
- **Delega:** `CleaningEngineService.resetByScope()`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2️⃣ FLUJO REAL DE UNA LIMPIEZA (RECURRENTE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 2.1 Flujo Completo Línea a Línea

### PASO 1: Click en UI
**Archivo:** `public/js/master/master-alquimia-general-client.js`  
**Función:** `handleLimpiarEstudianteRecurrente()` (línea 3645)

**Código:**
```javascript
// master-alquimia-general-client.js:3322
btnClean.addEventListener('click', () => {
  handleLimpiarEstudiante(student, item, 'shared', itemKind);
});

// Línea 3645
async function handleLimpiarEstudianteRecurrente(student, item, cleanLayer) {
  return handleLimpiarEstudianteInternal(student, item, cleanLayer, 'recurrente');
}

// Línea 3662
async function handleLimpiarEstudianteInternal(student, item, cleanLayer, itemKind) {
  // Validaciones (línea 3666-3698)
  // Payload (línea 3712-3720)
  // performAction() (línea 3771-3781)
}
```

**Payload enviado:**
```javascript
{
  action_id: 'alquimia.clean',
  context: {
    item_ref: 'item_123_456',
    student_uuid: 'uuid-del-alumno',
    item_kind: 'recurrente',
    clean_layer: 'shared',  // OBLIGATORIO
    scope: 'student'
  },
  uiState: {
    view_mode: 'operativa',
    view_layer: 'shared',  // state.projection.view_layer
    list_id: 42
  }
}
```

**Logs existentes:**
```javascript
// Línea 3734-3742
console.log('[UI][RECURRENTE][BUTTON] Intento de limpieza', {
  student_uuid, item_ref, action_clean_layer: cleanLayer,
  view_layer: activeViewLayer, days_since_last_clean, enabled: true
});
```

### PASO 2: performAction() Wrapper
**Archivo:** `public/js/master/ux/perform-action.v1.js`  
**Función:** `performAction()` (línea 75)

**Código:**
```javascript
// perform-action.v1.js:75-404
export async function performAction({ action_id, context, uiState }) {
  // 1. Valida que runtime está READY (línea 80-95)
  // 2. Obtiene acción del registry (línea 97-105)
  // 3. Valida payload (línea 107-122)
  // 4. Construye endpoint (línea 124-138)
  // 5. Construye payload final (línea 140-210)
  // 6. Ejecuta fetch (línea 229-231)
  // 7. Ejecuta refresh plan (línea 278-335)
}
```

**Refresh plan:**
```javascript
// ux-action-registry.js (registrado en alquimia-actions-registry.v1.js)
refresh: ['alquimia.flotante_students', 'alquimia.list_projection']
```

### PASO 3: Endpoint Backend
**Archivo:** `src/endpoints/master-api-alquimia-general.js`  
**Función:** Handler POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student (línea 1154)

**Código:**
```javascript
// master-api-alquimia-general.js:1154-1294
if (path.match(/^\/master\/api\/alquimia-general\/items\/([^\/]+)\/master\/mark-clean-student$/) && method === 'POST') {
  // 1. Valida clean_layer (línea 1165-1175)
  // 2. Valida student_uuid (línea 1178-1185)
  // 3. Valida item_kind (línea 1187-1189)
  // 4. Valida item existe (línea 1199-1207)
  // 5. Construye options (línea 1210-1221)
  // 6. Llama Cleaning Engine (línea 1225-1226)
  // 7. Calcula display_name (línea 1237-1266)
  // 8. Retorna estado (línea 1268-1276)
}
```

**Payload enviado a Cleaning Engine:**
```javascript
{
  student_uuid: 'uuid-del-alumno',
  item_ref: 'item_123_456',
  item_kind: 'recurrente',
  clean_layer: 'shared',
  product_key: 'pde',
  domain_type: 'transmutation',
  actor_type: 'master',
  surface_key: 'master.alquimia_general'
}
```

### PASO 4: Cleaning Engine Service
**Archivo:** `src/core/master/services/cleaning-engine-service.js`  
**Función:** `markCleanStudent()` (línea 302)

**Flujo:**
1. **Verifica pausa** (línea 384): `isStudentPaused(student_uuid)` → excluye si pausado
2. **Obtiene item** (línea 396): `catalogRepo.getItemByRef(item_ref)`
3. **Verifica nivel** (línea 402-458): Solo si NO es master, valida nivel
4. **Valida coherencia** (línea 468-479): `item_kind === lista.tipo` (fail-hard si no coincide)
5. **Genera execution_key** (línea 507):
   ```javascript
   // Para RECURRENTE: mark_clean:{item_ref}:{student_uuid}:{clean_layer}:{YYYY-MM-DD}
   execution_key = generateExecutionKey('mark_clean', item_ref, student_uuid, new Date(), 'APPLY', 'recurrente', 'shared');
   // Resultado: "mark_clean:item_123_456:uuid-alumno:shared:2026-01-27"
   ```
6. **Verifica estado antes** (línea 552-571): Log forense de estado actual
7. **Inserta evento** (línea 573): `eventsRepo.insertEvent(eventData, client)`
8. **Verifica idempotencia** (línea 586-620):
   ```javascript
   if (eventResult === 'already_applied' || eventResult?.already_executed === true) {
     // Obtiene estado actual y retorna sin actualizar
     return currentState;
   }
   ```
9. **Verifica reset previo** (línea 622-678):
   ```javascript
   const lastReset = await getLastResetForItem(student_uuid, item_ref, clean_layer);
   if (lastReset) {
     // Verifica coherencia y reconstruye si necesario
     if (needsRebase) {
       await rebaseStateFromReset(...);
     }
   }
   ```
10. **Aplica a proyección** (línea 695-745):
    ```javascript
    if (itemKind === 'recurrente') {
      state = await stateRepo.upsertApplyRecurrent({
        student_uuid, item_ref, clean_layer, cleaned_at: new Date()
      });
    }
    ```

### PASO 5: Repositorio - INSERT/UPDATE en PostgreSQL
**Archivo:** `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js`  
**Función:** `upsertApplyRecurrent()` (línea 64)

**Query ejecutada:**
```sql
-- cleaning-item-state-repo-pg.js:85-104
INSERT INTO cleaning_item_state (
  student_id, product_key, domain_type, item_ref,
  shared_last_cleaned_at, shared_clean_count
) VALUES (
  $1, $2, $3, $4, $5, 1
)
ON CONFLICT (student_id, product_key, domain_type, item_ref)
DO UPDATE SET
  shared_last_cleaned_at = $5,
  shared_clean_count = cleaning_item_state.shared_clean_count + 1,
  updated_at = CURRENT_TIMESTAMP
RETURNING *
```

**Campos modificados:**
- `shared_last_cleaned_at` → `NOW()`
- `shared_clean_count` → `shared_clean_count + 1`
- `updated_at` → `CURRENT_TIMESTAMP`
- **NO modifica:** `shared_effective_since` (solo reset lo modifica)

### PASO 6: Repositorio - INSERT Evento
**Archivo:** `src/infra/repos/cleaning/cleaning-events-repo-pg.js`  
**Función:** `insertEvent()` (línea 33)

**Query ejecutada:**
```sql
-- cleaning-events-repo-pg.js:46-72
INSERT INTO cleaning_events (
  trace_id, execution_key, student_id, product_key, domain_type, item_ref,
  clean_layer, item_kind, action_type, delta_completed, set_remaining,
  actor_type, actor_ref, surface_key, meta
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
)
ON CONFLICT (execution_key, student_id) DO NOTHING
RETURNING *
```

**Si ya existe:** Devuelve `{ already_executed: true }` (sin insertar)

### PASO 7: Refresh Engine (Frontend)
**Archivo:** `public/js/master/ux/perform-action.v1.js`  
**Función:** `performAction()` → Refresh Engine (línea 278-335)

**Código:**
```javascript
// perform-action.v1.js:302-335
const refreshEngine = window.MasterRefreshEngineV1;
const refreshPlan = actionDef.refresh || actionDef.refresh_plan;
// Resuelve refresh plan (función o array)
// Llama refreshEngine.afterMutationV2() o afterMutation()
```

**Refresh plan ejecutado:**
```javascript
// alquimia-actions-registry.v1.js (acción 'alquimia.clean')
refresh: ['alquimia.flotante_students', 'alquimia.list_projection']
```

### PASO 8: Re-fetch de Datos (GET)
**Archivo:** `public/js/master/master-refresh-engine.js` (implícito)

**Endpoints llamados:**
1. `GET /master/api/alquimia-general/items/:item_ref/students?clean_layer=shared&view_layer=shared`
2. `GET /master/api/alquimia-general/list-projection?list_id=42&item_kind=recurrente&view_layer=shared&scope=all`

### PASO 9: Cálculo de Estado (Backend)
**Archivo:** `src/services/alquimia-general-service.js`  
**Función:** `getStudentsForItem()` → CPM (línea 732-739)

**Código:**
```javascript
// alquimia-general-service.js:732-739
const visualStateResult = computeVisualState({
  shared: sharedData,
  pde: pdeData,
  combo: null,
  item_kind: 'recurrente',
  view_layer: view_layer || 'shared',
  config: effectiveConfig
});

// Calcular state_by_view_layer completo (línea 762-788)
const stateByViewLayer = {
  shared: computeVisualState({ ...view_layer: 'shared' }),
  pde: computeVisualState({ ...view_layer: 'pde' }),
  effective: computeVisualState({ ...view_layer: 'effective' })
};
```

### PASO 10: Renderizado UI
**Archivo:** `public/js/master/master-alquimia-general-client.js`  
**Función:** `createStudentRow()` (línea 3103)

**Código que decide columna:**
```javascript
// master-alquimia-general-client.js:2772-2788
const stateData = student.state_by_view_layer?.[activeViewLayer];
if (!stateData) {
  // BLOQUEAR render si falta state_by_view_layer
  console.error('[BUG-011] state_by_view_layer no disponible');
  return; // NO renderizar
}

const state = stateData.state;  // 'reviewed' | 'pending' | 'important' | 'never'
const visualState = stateData.visual_state;

// Agrupar por estado (línea 2812-2824)
if (state === 'reviewed') {
  // Columna "REVISADO"
} else if (state === 'pending') {
  // Columna "PENDIENTE"
} else if (state === 'important') {
  // Columna "IMPORTANTE"
} else {
  // Columna "NUNCA"
}
```

## 2.2 Tabla: Esperado vs Real

| Paso | Campo Esperado | Campo Real | Coincide |
|------|---------------|------------|----------|
| **UI → performAction** | `clean_layer: 'shared'` | `clean_layer: 'shared'` | ✅ |
| **performAction → Endpoint** | `action_id: 'alquimia.clean'` | `action_id: 'alquimia.clean'` | ✅ |
| **Endpoint → Cleaning Engine** | `item_kind: 'recurrente'` | `item_kind: 'recurrente'` | ✅ |
| **Cleaning Engine → Evento** | `execution_key: 'mark_clean:...:shared:2026-01-27'` | `execution_key: 'mark_clean:...:shared:2026-01-27'` | ✅ |
| **Cleaning Engine → State Repo** | UPDATE `shared_last_cleaned_at = NOW()` | UPDATE `shared_last_cleaned_at = NOW()` | ✅ |
| **GET → CPM** | `state_by_view_layer.shared.state` | `state_by_view_layer.shared.state` | ✅ |
| **UI → Columna** | Agrupar por `state_by_view_layer[view_layer].state` | Agrupar por `state_by_view_layer[view_layer].state` | ✅ |

**Conclusión:** El flujo de limpieza está correctamente trazado. No hay discrepancias obvias.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3️⃣ FLUJO REAL DE UN RESET RECURRENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 3.1 ¿Qué es un "Reset" en el Sistema?

**Definición canónica:** Reset es un EVENTO que marca el inicio de un nuevo ciclo, NO es un DELETE.

**Efectos:**
1. ✅ **Inserta evento** en `cleaning_events` con `action_type='reset'`
2. ✅ **Marca effective_since** = fecha del reset (`shared_effective_since` o `pde_effective_since`)
3. ✅ **Resetea contadores** para RECURRENTE: `last_cleaned_at = NULL`, `clean_count = 0`
4. ✅ **NO borra** datos históricos (eventos previos permanecen)
5. ✅ **NO cambia** estado visual directamente (CPM lo calcula desde effective_since)

**Evidencia:**
```javascript
// cleaning-engine-service.js:1327-1693
export async function resetStudentItemProgress(options, client = null) {
  // REGLA CONSTITUCIONAL: Reset es evento, no delete
  // Inserta evento reset (línea 1512-1535)
  // Aplica reset a proyección (línea 1604-1611)
}
```

## 3.2 Código Exacto que Ejecuta el Reset

**Función principal:** `resetStudentItemProgress()` (línea 1327)

**Condiciones:**
- ✅ `item_kind === 'recurrente'` (PROHIBIDO para una_vez, línea 1387-1398)
- ✅ `clean_layer === 'shared'` o `'pde'` (línea 1369-1497)
- ✅ `view_layer` coherente con `clean_layer` (línea 1439-1461)

**Filtros:**
- ✅ Excluye estudiantes pausados (línea 1407-1416)
- ✅ Valida que item existe (línea 1418-1424)
- ✅ Valida que lista existe (línea 1426-1434)

**Generación de execution_key:**
```javascript
// cleaning-engine-service.js:60-61
if (actionType === 'reset' && cleanLayer) {
  return `${actionType}:${itemRef}:${studentUuid}:${cleanLayer}:${day}`;
}
// Resultado: "reset:item_123_456:uuid-alumno:shared:2026-01-27"
```

**Aplicación a proyección:**
```javascript
// cleaning-item-state-repo-pg.js:340-403
async upsertApplyReset(options, client = null) {
  const shouldResetCounters = options.item_kind === 'recurrente';
  const resetClause = shouldResetCounters
    ? `${effectiveSinceColumn} = $5, ${lastCleanedColumn} = NULL, ${countColumn} = 0`
    : `${effectiveSinceColumn} = $5`;
  
  // UPDATE cleaning_item_state
  // SET shared_effective_since = NOW(),
  //     shared_last_cleaned_at = NULL,
  //     shared_clean_count = 0
}
```

**Evidencia completa:**
```javascript
// cleaning-engine-service.js:1506-1611
for (const layer of layersToReset) {
  // 1. Genera execution_key (línea 1509)
  // 2. Inserta evento (línea 1535)
  // 3. Verifica idempotencia con coherencia (línea 1538-1600)
  // 4. Aplica reset a proyección (línea 1604-1611)
}
```

## 3.3 Verificación en BD

**Estado ANTES del reset:**
```sql
-- cleaning_item_state (ejemplo)
student_id: 'uuid-alumno'
item_ref: 'item_123_456'
shared_last_cleaned_at: '2026-01-25 10:00:00'
shared_effective_since: '2026-01-20 08:00:00'
shared_clean_count: 5
```

**Estado DESPUÉS del reset:**
```sql
-- cleaning_item_state (después de reset SHARED)
student_id: 'uuid-alumno'
item_ref: 'item_123_456'
shared_last_cleaned_at: NULL  -- ✅ Reseteado
shared_effective_since: '2026-01-27 12:00:00'  -- ✅ Actualizado a NOW()
shared_clean_count: 0  -- ✅ Reseteado
```

**Evento insertado:**
```sql
-- cleaning_events (evento reset)
execution_key: 'reset:item_123_456:uuid-alumno:shared:2026-01-27'
action_type: 'reset'
clean_layer: 'shared'
created_at: '2026-01-27 12:00:00'
```

## 3.4 Proyección Tras Reset

**Cálculo en CPM:**
```javascript
// cleaning-projection-model.js:167-190
if (hasReset) {
  const effectiveSinceDate = new Date(effectiveSince);  // '2026-01-27 12:00:00'
  
  if (lastCleanedAt) {
    // Hay limpieza posterior al reset
    const lastCleanedDate = new Date(lastCleanedAt);
    if (lastCleanedDate > effectiveSinceDate) {
      lastEffectiveCleanAt = lastCleanedAt;
      daysSince = Math.floor((now - lastCleanedDate) / (1000 * 60 * 60 * 24));
    } else {
      // Limpieza anterior al reset - IGNORAR
      lastEffectiveCleanAt = null;
      daysSince = 0;
    }
  } else {
    // No hay limpieza después del reset
    lastEffectiveCleanAt = null;
    daysSince = 0;  // NUMBER 0
  }
}
```

**Estado calculado tras reset sin limpieza:**
```javascript
{
  state: 'never',
  visual_state: 'never',
  days_since: 0,  // NUMBER 0 (no null)
  metrics: {
    days_since_last_clean: 0,
    last_cleaned_at: null,
    effective_since: '2026-01-27T12:00:00.000Z',
    last_effective_clean_at: null
  }
}
```

**¿Cuándo se recalcula?**
- ✅ Inmediatamente después del reset (GET posterior)
- ✅ Al cambiar view_layer
- ✅ Al refrescar flotante
- ✅ Al cargar proyección

**Evidencia:**
```javascript
// alquimia-general-service.js:762-788
const stateByViewLayer = {
  shared: computeVisualState({ ...view_layer: 'shared' }),
  pde: computeVisualState({ ...view_layer: 'pde' }),
  effective: computeVisualState({ ...view_layer: 'effective' })
};
// Siempre calcula TODAS las view_layers, no solo la activa
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4️⃣ PROYECCIONES: FUENTE ÚNICA DE VERDAD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 4.1 ¿Qué Proyección Decide la Columna?

**Campo EXACTO usado por UI:**
- `student.state_by_view_layer[view_layer].state`

**Tipo:** String enum: `'reviewed' | 'pending' | 'important' | 'never'`

**Valores reales:**
```javascript
// Ejemplo real de respuesta GET
{
  student_uuid: 'uuid-alumno',
  state_by_view_layer: {
    shared: {
      state: 'never',  // ← Este campo decide la columna
      visual_state: 'never',
      metrics: {
        days_since_last_clean: 0,
        threshold_days: 20,
        critical_threshold: 40,
        last_cleaned_at: null,
        effective_since: '2026-01-27T12:00:00.000Z'
      }
    },
    pde: { ... },
    effective: { ... }
  }
}
```

**Evidencia:**
```javascript
// master-alquimia-general-client.js:2772-2788
const stateData = student.state_by_view_layer?.[activeViewLayer];
const state = stateData.state;  // 'reviewed' | 'pending' | 'important' | 'never'
```

## 4.2 ¿Ese Campo se Recalcula SIEMPRE?

**Situaciones donde DEBE recalcularse:**
1. ✅ **Tras limpieza:** Sí (GET inmediato vía Refresh Engine)
2. ✅ **Tras reset:** Sí (GET inmediato vía Refresh Engine)
3. ❓ **Tras override:** ¿Verificado? (requiere investigación)
4. ❓ **Tras cambio de lista:** ¿Verificado? (requiere investigación)

**Verificación en código:**
```javascript
// perform-action.v1.js:278-335
// Refresh plan ejecutado después de performAction()
const refreshEngine = window.MasterRefreshEngineV1;
await refreshEngine.afterMutationV2({
  surfaces: ['alquimia.flotante_students', 'alquimia.list_projection']
});
```

**¿Hay estado recordado en memoria?**
- ✅ `state.modal.item`: Objeto item del flotante
- ✅ `state.projection.data`: Datos de proyección
- ❌ NO hay estado visual recordado (siempre viene del backend)

**Evidencia:**
```javascript
// master-alquimia-general-client.js:74-111
const state = {
  modal: { item: null, cleanLayer: 'shared' },
  projection: { mode: 'operativa', view_layer: 'shared', data: null },
  students: []
};
// NO hay state.modal.students ni state.modal.state_by_view_layer
```

## 4.3 Dobles Fuentes de Verdad

**PROBLEMA POTENCIAL 1: Campos Legacy en Respuesta**
```javascript
// alquimia-general-service.js:825-839
return {
  ...student,
  state: visualStateResult.state,  // ← Campo legacy
  visual_state: visualStateResult.visual_state,  // ← Campo legacy
  state_by_view_layer: stateByViewLayer  // ← Campo canónico
};
```

**Verificación:** UI usa `state_by_view_layer`, no campos legacy (verificado en línea 2772)

**PROBLEMA POTENCIAL 2: Inferencias en Frontend**
```javascript
// master-alquimia-general-client.js:3576-3582
if (student.state_by_view_layer && student.state_by_view_layer[activeViewLayer]) {
  stateData = student.state_by_view_layer[activeViewLayer];
} else {
  console.error('[BUG-011] state_by_view_layer no disponible - BLOQUEANDO render');
  // NO renderizar (correcto)
}
```

**Verificación:** Frontend NO calcula estado, solo consume (correcto)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5️⃣ UI: CAMBIO DE COLUMNA (CRÍTICO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 5.1 ¿Qué Función Decide la Columna?

**Función canónica:** `renderStudentsByState()` (línea 2744)  
**Archivo:** `public/js/master/master-alquimia-general-client.js`

**Código:**
```javascript
// master-alquimia-general-client.js:2744-3091
function renderStudentsByState(students, itemKind) {
  // Obtener view_layer activo (línea 2751)
  const activeViewLayer = state.projection.view_layer || (itemKind === 'una_vez' ? 'combo' : 'shared');
  
  // Agrupar estudiantes por estado (línea 2761-2788)
  const studentsByState = {
    reviewed: [],
    pending: [],
    important: [],
    never: [],
    _error: []  // Estudiantes sin state_by_view_layer
  };
  
  students.forEach(student => {
    const stateData = student.state_by_view_layer?.[activeViewLayer];
    if (!stateData) {
      studentsByState._error.push(student);
      return;
    }
    
    const state = stateData.state;  // ← Campo que decide la columna
    if (state === 'reviewed') {
      studentsByState.reviewed.push(student);
    } else if (state === 'pending') {
      studentsByState.pending.push(student);
    } else if (state === 'important') {
      studentsByState.important.push(student);
    } else {
      studentsByState.never.push(student);
    }
  });
  
  // Renderizar columnas (línea 2795-3091)
  // Cada columna renderiza su array de estudiantes
}
```

**Dato usado:** `student.state_by_view_layer[activeViewLayer].state`

## 5.2 ¿De Dónde Viene ese Dato?

**Origen:** Endpoint GET `/master/api/alquimia-general/items/:item_ref/students`

**Respuesta:**
```javascript
{
  data: {
    students: [
      {
        student_uuid: 'uuid',
        state_by_view_layer: {
          shared: {
            state: 'never',  // ← Este campo
            visual_state: 'never',
            metrics: { ... }
          },
          pde: { ... },
          effective: { ... }
        }
      }
    ]
  }
}
```

**Flujo:**
1. GET request → `getStudentsForItem()` (alquimia-general-service.js:541)
2. Service lee desde repo → `getStudentsForItemFromCleaningEngine()` (línea 621)
3. Service calcula estados → `computeVisualState()` (línea 732-788)
4. Service retorna → `state_by_view_layer` completo

**Evidencia:**
```javascript
// alquimia-general-service.js:762-788
const stateByViewLayer = {
  shared: computeVisualState({ ...view_layer: 'shared' }),
  pde: computeVisualState({ ...view_layer: 'pde' }),
  effective: computeVisualState({ ...view_layer: 'effective' })
};

return {
  ...student,
  state_by_view_layer: stateByViewLayer  // ← Añadido a cada student
};
```

## 5.3 ¿Se Recalcula Tras Acción?

**Refresh plan declarativo:**
```javascript
// alquimia-actions-registry.v1.js (acción 'alquimia.clean')
refresh: ['alquimia.flotante_students', 'alquimia.list_projection']
```

**Refresh Engine ejecuta:**
```javascript
// master-refresh-engine.js (implícito)
await refreshSurface('alquimia.flotante_students', { item_ref, view_layer, clean_layer });
// → GET /master/api/alquimia-general/items/:item_ref/students?clean_layer=shared&view_layer=shared
// → Recalcula state_by_view_layer
// → Re-renderiza flotante
```

**Verificación en código:**
```javascript
// master-alquimia-general-client.js:2325-2339
// CPM v1: Refrescar flotante si está abierto usando state.projection.view_layer
if (state.projection.mode === 'operativa' && state.modal.item && state.modal.item.item_ref === item.item_ref) {
  const preservedViewLayer = state.projection.view_layer || 'shared';
  await handleVerItem(state.modal.item, preservedCleanLayer, preservedViewLayer);
}
```

**Logs existentes:**
```javascript
// master-alquimia-general-client.js:2130-2138
console.log('[REFRESH][GET] flotante (students)', {
  endpoint: `/master/api/alquimia-general/items/${item.item_ref}/students`,
  params: { clean_layer, view_layer },
  timestamp: new Date().toISOString()
});
```

## 5.4 ¿Hay Estado Recordado en Memoria?

**Estado guardado:**
```javascript
// master-alquimia-general-client.js:74-111
const state = {
  modal: {
    item: null,  // Objeto item del flotante
    cleanLayer: 'shared'  // clean_layer usado para GET
  },
  projection: {
    view_layer: 'shared',  // view_layer activo (autoridad única)
    data: null  // Datos de proyección (opcional)
  }
};
```

**NO hay estado recordado de:**
- ❌ `state.modal.students` (siempre se re-fetchea)
- ❌ `state.modal.state_by_view_layer` (siempre viene del backend)
- ❌ `state.modal.lastState` (no existe caché de estado)

**Verificación:**
```javascript
// master-alquimia-general-client.js:2200-2215
async function handleVerItem(item, cleanLayer = 'shared', viewLayer = null) {
  // Siempre hace fetch (línea 2140)
  const response = await fetch(`/master/api/alquimia-general/items/${item.item_ref}/students?${urlParams}`);
  // Siempre parsea respuesta fresca (línea 2151)
  const result = await response.json();
  // Siempre normaliza payload (línea 2164)
  const normalized = normalizeStudentsPayload(result);
  // Siempre muestra flotante con datos frescos (línea 2201)
  showFlotanteVer(item, normalized);
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6️⃣ CASOS ROTOS — AUTOPSIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 6.1 Caso 1: Alumno que NO se Limpia

**Síntoma:** Click en "Limpiar" no cambia estado visual

**Flujo esperado:**
1. Click → `handleLimpiarEstudiante()`
2. `performAction('alquimia.clean')`
3. POST → Cleaning Engine
4. UPDATE `shared_last_cleaned_at = NOW()`
5. GET → Recalcula estado
6. UI muestra nuevo estado

**Flujo real (posible fallo):**
1. ✅ Click → `handleLimpiarEstudiante()` (línea 3614)
2. ✅ `performAction('alquimia.clean')` (línea 3771)
3. ❓ POST → Cleaning Engine (¿falla idempotencia?)
4. ❓ UPDATE (¿se ejecuta?)
5. ❓ GET (¿se ejecuta refresh?)
6. ❓ UI (¿re-renderiza?)

**Puntos de fallo potenciales:**

**A) Idempotencia bloquea actualización**
```javascript
// cleaning-engine-service.js:586-620
if (eventResult === 'already_applied' || eventResult?.already_executed === true) {
  // Retorna estado actual SIN actualizar
  return currentState;  // ⚠️ Puede ser estado antiguo
}
```

**Problema:** Si el evento existe pero el estado NO está actualizado, se retorna estado incoherente.

**Evidencia:**
```javascript
// cleaning-engine-service.js:550-571
// LOG TEMPORAL: Verificar estado antes de insertar evento
const existingState = await stateRepo.getState({ ... });
console.log('[CLEAN][CHECK] Estado antes de insertar evento', {
  existing_state: existingState ? {
    shared_last_cleaned_at: existingState.shared_last_cleaned_at,
    shared_clean_count: existingState.shared_clean_count
  } : null
});
// ⚠️ Este log verifica estado ANTES, pero NO verifica coherencia POST-INSERT
```

**B) Refresh no se ejecuta**
```javascript
// perform-action.v1.js:278-335
const refreshEngine = window.MasterRefreshEngineV1;
if (!refreshEngine) {
  console.warn('Refresh Engine no disponible, saltando refresh');
  // ⚠️ Si Refresh Engine no está disponible, NO se refresca
}
```

**C) UI no re-renderiza**
```javascript
// master-alquimia-general-client.js:2325-2339
if (state.projection.mode === 'operativa' && state.modal.item && ...) {
  await handleVerItem(state.modal.item, preservedCleanLayer, preservedViewLayer);
}
// ⚠️ Solo refresca si modal está abierto Y mode === 'operativa'
// ¿Qué pasa si está en modo proyección?
```

## 6.2 Caso 2: Alumno que NO Cambia de Columna

**Síntoma:** Alumno permanece en columna "NUNCA" tras limpieza

**Flujo esperado:**
1. Alumno en "NUNCA" (`state='never'`, `days_since=null`)
2. Click "Limpiar"
3. UPDATE `shared_last_cleaned_at = NOW()`
4. GET recalcula: `days_since=0`, `state='reviewed'`
5. UI mueve a columna "REVISADO"

**Flujo real (posible fallo):**
1. ✅ Alumno en "NUNCA"
2. ✅ Click "Limpiar"
3. ❓ UPDATE (¿se ejecuta?)
4. ❓ GET (¿recalcula correctamente?)
5. ❓ UI (¿lee `state_by_view_layer.shared.state` correctamente?)

**Puntos de fallo potenciales:**

**A) CPM calcula estado incorrecto tras reset sin limpieza**
```javascript
// cleaning-projection-model.js:206-209
if (hasReset && lastEffectiveCleanAt === null) {
  state = 'never';
  daysSince = 0;
}
```

**Problema:** Tras reset, estado es `'never'` con `days_since=0`. Si no se ejecuta limpieza post-reset, el estado permanece `'never'` aunque `days_since=0`.

**Evidencia:**
```javascript
// cleaning-projection-model.js:213-225
if (daysSince !== null && daysSince < threshold_days) {
  state = 'reviewed';  // ⚠️ Requiere daysSince < threshold_days
} else if (daysSince === null) {
  state = 'never';  // ⚠️ daysSince=0 NO es null, entonces NO entra aquí
}
// ⚠️ daysSince=0 (number) → state='reviewed' si threshold_days > 0
```

**Verificación:** Si `daysSince=0` y `threshold_days=20`, entonces `0 < 20` → `state='reviewed'` (correcto)

**B) UI agrupa por estado incorrecto**
```javascript
// master-alquimia-general-client.js:2772-2788
const state = stateData.state;  // Lee desde state_by_view_layer
if (state === 'reviewed') {
  studentsByState.reviewed.push(student);
}
```

**Problema:** Si `state_by_view_layer` no está presente o tiene estructura incorrecta, UI no puede agrupar.

**Evidencia:**
```javascript
// master-alquimia-general-client.js:2772-2788
if (student.state_by_view_layer && student.state_by_view_layer[activeViewLayer]) {
  stateData = student.state_by_view_layer[activeViewLayer];
} else {
  console.error('[BUG-011] state_by_view_layer no disponible - BLOQUEANDO render');
  studentsByState._error.push(student);
  return;  // ✅ Correcto: NO renderiza si falta
}
```

## 6.3 Caso 3: Ítem Recurrente Problemático

**Síntoma:** Reset ejecutado pero alumno no cambia de columna

**Estado en BD (después de reset):**
```sql
-- cleaning_item_state
shared_effective_since: '2026-01-27 12:00:00'
shared_last_cleaned_at: NULL
shared_clean_count: 0
```

**Estado en proyección (esperado):**
```javascript
{
  state: 'never',
  visual_state: 'never',
  days_since: 0,
  metrics: {
    days_since_last_clean: 0,
    last_cleaned_at: null,
    effective_since: '2026-01-27T12:00:00.000Z'
  }
}
```

**Estado en UI (real):**
- **Si viene `state_by_view_layer.shared.state = 'never'`:** Alumno en columna "NUNCA" ✅
- **Si falta `state_by_view_layer`:** Alumno en columna "_error" ⚠️

**Diferencias exactas:**
- ✅ Estado en BD: Correcto (effective_since actualizado, last_cleaned_at NULL)
- ✅ Estado en proyección: Correcto (state='never', days_since=0)
- ❓ Estado en UI: ¿Viene state_by_view_layer completo?

**Verificación requerida:**
```javascript
// GET /master/api/alquimia-general/items/:item_ref/students
// Respuesta debe incluir:
{
  students: [{
    state_by_view_layer: {
      shared: { state: 'never', ... },
      pde: { ... },
      effective: { ... }
    }
  }]
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7️⃣ INVARIANTES CANÓNICAS — CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 7.1 Acción → Estado Base

**Invariante:** Toda acción de limpieza debe actualizar `cleaning_item_state`

**Verificación:**
- ✅ `markCleanStudent()` → `upsertApplyRecurrent()` (línea 702)
- ✅ `resetStudentItemProgress()` → `upsertApplyReset()` (línea 1604)
- ❌ Si idempotencia bloquea → NO actualiza (línea 586-620)

**Estado:** ⚠️ **CONDICIONAL** - Depende de idempotencia

**Evidencia:**
```javascript
// cleaning-engine-service.js:586-620
if (eventResult === 'already_applied' || eventResult?.already_executed === true) {
  const currentState = existingState || await stateRepo.getState({ ... });
  return currentState;  // ⚠️ Retorna estado SIN verificar coherencia
}
```

## 7.2 Estado Base → Proyección

**Invariante:** `state_by_view_layer` se calcula SIEMPRE desde `cleaning_item_state`

**Verificación:**
- ✅ `getStudentsForItem()` → `computeVisualState()` (línea 732-788)
- ✅ CPM recibe datos brutos (línea 701-714)
- ✅ CPM calcula state_by_view_layer completo (línea 762-788)

**Estado:** ✅ **OK**

**Evidencia:**
```javascript
// alquimia-general-service.js:762-788
const stateByViewLayer = {
  shared: computeVisualState({ shared: sharedData, pde: pdeData, ...view_layer: 'shared' }),
  pde: computeVisualState({ shared: sharedData, pde: pdeData, ...view_layer: 'pde' }),
  effective: computeVisualState({ shared: sharedData, pde: pdeData, ...view_layer: 'effective' })
};
// ✅ Siempre calcula TODAS las view_layers
```

## 7.3 Proyección → Columna

**Invariante:** UI agrupa EXCLUSIVAMENTE por `state_by_view_layer[view_layer].state`

**Verificación:**
- ✅ `renderStudentsByState()` usa `state_by_view_layer[activeViewLayer].state` (línea 2772)
- ✅ NO hay fallback legacy (línea 3575-3582 bloquea render si falta)
- ✅ NO calcula estado en frontend (línea 3186-3193 consume desde state_by_view_layer)

**Estado:** ✅ **OK**

**Evidencia:**
```javascript
// master-alquimia-general-client.js:2772-2788
const stateData = student.state_by_view_layer?.[activeViewLayer];
if (!stateData) {
  console.error('[BUG-011] state_by_view_layer no disponible - BLOQUEANDO render');
  studentsByState._error.push(student);
  return;  // ✅ NO renderiza si falta
}

const state = stateData.state;  // ✅ Lee desde state_by_view_layer
```

## 7.4 UNA Sola Fuente de Columnas

**Invariante:** Solo `state_by_view_layer[view_layer].state` determina la columna

**Verificación:**
- ✅ UI usa SOLO `state_by_view_layer` (línea 2772-2788)
- ❌ ¿Hay campos legacy en respuesta? (línea 825-839 incluye `state` y `visual_state` legacy)
- ✅ UI NO usa campos legacy (verificado en línea 2772)

**Estado:** ✅ **OK** (campos legacy presentes pero no usados)

**Evidencia:**
```javascript
// alquimia-general-service.js:825-839
return {
  ...student,
  state: visualStateResult.state,  // ⚠️ Campo legacy (presente pero no usado)
  visual_state: visualStateResult.visual_state,  // ⚠️ Campo legacy
  state_by_view_layer: stateByViewLayer  // ✅ Campo canónico (usado por UI)
};
```

## 7.5 Reset Provoca Cambio Observable

**Invariante:** Tras reset, el estado debe cambiar de forma observable

**Verificación:**
- ✅ Reset actualiza `effective_since` (línea 1604-1611)
- ✅ Reset resetea contadores (línea 368: `last_cleaned_at = NULL`, `clean_count = 0`)
- ✅ CPM recalcula estado tras reset (línea 167-202)
- ❓ ¿Refresh se ejecuta tras reset? (requiere verificar refresh plan)

**Estado:** ❓ **NO DETERMINADO** (requiere verificar refresh plan de reset)

**Evidencia:**
```javascript
// alquimia-actions-registry.v1.js (acción 'alquimia.reset.item')
refresh: ['alquimia.flotante_students', 'alquimia.list_projection']
// ✅ Refresh plan declarado
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8️⃣ CONCLUSIÓN FORENSE (SIN SOLUCIONES)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 8.1 Lista Numerada de Causas Raíz

### CAUSA RAÍZ 1: Idempotencia Sin Verificación de Coherencia
**Archivo:** `src/core/master/services/cleaning-engine-service.js`  
**Líneas:** 586-620

**Por qué rompe el sistema:**
Si un evento existe (`already_executed: true`) pero `cleaning_item_state` NO está actualizado (fallo parcial, transacción abortada, etc.), el sistema retorna estado antiguo y NO actualiza.

**Evidencia:**
```javascript
// cleaning-engine-service.js:586-620
if (eventResult === 'already_applied' || eventResult?.already_executed === true) {
  const currentState = existingState || await stateRepo.getState({ ... });
  return currentState;  // ⚠️ Retorna SIN verificar si está coherente con el evento
}
```

**Desde cuándo puede estar rota:**
- Sistema de idempotencia existe desde v5.65.0
- Problema potencial si hay fallos parciales en transacciones

**Impacto:**
- Alumnos que "no se limpian" (evento existe pero estado no actualizado)
- Reset que "no aplica" (evento existe pero estado no reseteado)

---

### CAUSA RAÍZ 2: Reset Reconstrucción No Coherente en Todos los Casos
**Archivo:** `src/core/master/services/cleaning-engine-service.js`  
**Líneas:** 622-678

**Por qué rompe el sistema:**
La lógica de reconstrucción desde reset (`rebaseStateFromReset`) solo se ejecuta si `needsRebase === true`. Si el estado está "casi coherente" pero no exactamente, puede pasar desapercibido.

**Evidencia:**
```javascript
// cleaning-engine-service.js:647-652
const needsRebase = !currentEffective || 
                   currentEffective < resetAt ||
                   (currentLastCleaned && currentLastCleaned < resetAt) ||
                   (currentCount > 0 && !currentLastCleaned) ||
                   (currentCount === 0 && currentLastCleaned);
// ⚠️ Si currentEffective === resetAt pero currentLastCleaned !== NULL, NO detecta incoherencia
```

**Desde cuándo puede estar rota:**
- Reconstrucción desde reset existe desde v5.70.0
- Problema potencial si estados quedan "medio coherentes"

**Impacto:**
- Reset que se ejecuta pero estado visual no cambia
- Alumnos que quedan en estado intermedio tras reset

---

### CAUSA RAÍZ 3: Refresh Plan Condicional por view_mode
**Archivo:** `public/js/master/master-alquimia-general-client.js`  
**Líneas:** 2325-2339

**Por qué rompe el sistema:**
El refresh del flotante solo se ejecuta si `state.projection.mode === 'operativa'`. Si la UI está en modo 'proyeccion', el flotante NO se refresca tras acciones.

**Evidencia:**
```javascript
// master-alquimia-general-client.js:2325-2339
// CPM v1: Refrescar flotante si está abierto usando state.projection.view_layer
if (state.projection.mode === 'operativa' && state.modal.item && ...) {
  await handleVerItem(state.modal.item, preservedCleanLayer, preservedViewLayer);
}
// ⚠️ Solo refresca si mode === 'operativa'
```

**Desde cuándo puede estar rota:**
- Refresh condicional existe desde implementación de view_mode
- Problema potencial si acciones se ejecutan desde modo proyección

**Impacto:**
- Flotante abierto en modo proyección no se actualiza tras acciones
- Alumnos que "no cambian" porque el flotante no se refresca

**NOTA:** Este punto puede estar corregido en código más reciente (ver línea 6542-6551), requiere verificación.

---

### CAUSA RAÍZ 4: Execution Key Diario Bloquea Reset del Mismo Día
**Archivo:** `src/core/master/services/cleaning-engine-service.js`  
**Líneas:** 50-72, 1538-1600

**Por qué rompe el sistema:**
Si un reset se ejecuta el mismo día dos veces, el segundo intento es omitido por idempotencia (mismo execution_key). Si el primer reset falló parcialmente, el segundo NO puede corregirlo.

**Evidencia:**
```javascript
// cleaning-engine-service.js:60-61
if (actionType === 'reset' && cleanLayer) {
  return `${actionType}:${itemRef}:${studentUuid}:${cleanLayer}:${day}`;
}
// Resultado: "reset:item_123:uuid:shared:2026-01-27"
// ⚠️ Mismo execution_key para todo el día
```

**Desde cuándo puede estar rota:**
- Execution key diario existe desde v5.65.0
- Problema potencial si hay fallos parciales en reset ALL

**Impacto:**
- Reset ALL que devuelve "0 aplicados, X omitidos"
- Reset que no se puede repetir el mismo día aunque haya fallado

---

### CAUSA RAÍZ 5: CPM Calcula days_since=0 Tras Reset Pero Estado es 'never'
**Archivo:** `src/core/master/services/cleaning-projection-model.js`  
**Líneas:** 206-209, 213-225

**Por qué rompe el sistema:**
Tras reset sin limpieza posterior, CPM calcula `days_since=0` (number) pero `state='never'`. Si `threshold_days > 0`, entonces `0 < threshold_days` debería dar `state='reviewed'`, pero la lógica prioriza `hasReset && lastEffectiveCleanAt === null` → `state='never'`.

**Evidencia:**
```javascript
// cleaning-projection-model.js:206-225
if (hasReset && lastEffectiveCleanAt === null) {
  state = 'never';  // ⚠️ Prioriza reset sobre days_since
  daysSince = 0;
} else if (daysSince !== null && daysSince < threshold_days) {
  state = 'reviewed';  // ⚠️ Esta rama NO se ejecuta si hasReset=true
}
```

**Desde cuándo puede estar rota:**
- Lógica de reset existe desde RESET_RECURRENTE_V1
- Problema potencial si se espera que reset dé estado 'pending' pero da 'never'

**Impacto:**
- Alumnos que tras reset quedan en "NUNCA" aunque days_since=0
- UI no muestra cambio de columna tras reset (siempre "NUNCA" hasta primera limpieza)

---

### CAUSA RAÍZ 6: Refresh Plan No Ejecuta Si Refresh Engine No Está Disponible
**Archivo:** `public/js/master/ux/perform-action.v1.js`  
**Líneas:** 279-282

**Por qué rompe el sistema:**
Si `window.MasterRefreshEngineV1` no está disponible (carga tardía, error en boot, etc.), el refresh plan NO se ejecuta. La UI queda con estado desincronizado.

**Evidencia:**
```javascript
// perform-action.v1.js:279-282
const refreshEngine = window.MasterRefreshEngineV1;
if (!refreshEngine) {
  console.warn('[PerformActionV1] Refresh Engine no disponible, saltando refresh');
  // ⚠️ NO ejecuta refresh, UI queda desincronizada
}
```

**Desde cuándo puede estar rota:**
- Refresh Engine existe desde UX_CONTRACT_V1
- Problema potencial si runtime no está READY o Refresh Engine falla en boot

**Impacto:**
- Acciones que se ejecutan pero UI no se actualiza
- Alumnos que "no cambian" porque refresh no se ejecuta

---

### CAUSA RAÍZ 7: Verificación de Coherencia en Idempotencia Solo para Reset
**Archivo:** `src/core/master/services/cleaning-engine-service.js`  
**Líneas:** 1538-1600 (reset), 586-620 (limpieza)

**Por qué rompe el sistema:**
La verificación de coherencia en idempotencia existe SOLO para reset (línea 1538-1600), NO para limpieza normal (línea 586-620). Si una limpieza es idempotente pero el estado no está actualizado, se retorna estado antiguo.

**Evidencia:**
```javascript
// cleaning-engine-service.js:586-620 (limpieza)
if (eventResult === 'already_applied' || eventResult?.already_executed === true) {
  return currentState;  // ⚠️ NO verifica coherencia
}

// cleaning-engine-service.js:1538-1600 (reset)
if (eventResult === 'already_applied' || eventResult?.already_executed === true) {
  // ✅ Verifica coherencia antes de omitir
  const isCoherent = currentEffective && currentEffective >= eventCreatedAt && ...;
  if (!isCoherent) {
    // ⚠️ Aplica reset igualmente (idempotencia override)
  }
}
```

**Desde cuándo puede estar rota:**
- Verificación de coherencia para reset existe desde BLINDAJE v1
- Limpieza normal NO tiene verificación equivalente

**Impacto:**
- Limpiezas que "no aplican" aunque deberían
- Alumnos que no cambian de estado aunque se ejecutó limpieza

---

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9️⃣ OUTPUT FINAL OBLIGATORIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Resumen Ejecutivo

Este diagnóstico ha identificado **7 causas raíz potenciales** que explican por qué alumnos NO se limpian, NO cambian de columna, o NO se actualizan tras acciones:

1. **Idempotencia sin verificación de coherencia** (crítico)
2. **Reset reconstrucción no coherente en todos los casos** (medio)
3. **Refresh plan condicional por view_mode** (medio)
4. **Execution key diario bloquea reset del mismo día** (alto)
5. **CPM calcula days_since=0 pero estado='never'** (medio)
6. **Refresh plan no ejecuta si Refresh Engine no disponible** (alto)
7. **Verificación de coherencia solo para reset, no para limpieza** (alto)

**Prioridad:**
- **Crítico:** #1 (afecta todas las acciones)
- **Alto:** #4, #6, #7 (afecta reset y refresh)
- **Medio:** #2, #3, #5 (afecta casos específicos)

## Evidencias Técnicas

### Tabla Comparativa: Limpieza vs Reset

| Aspecto | Limpieza | Reset |
|---------|----------|-------|
| **Execution Key** | `mark_clean:{item}:{student}:{layer}:{day}` | `reset:{item}:{student}:{layer}:{day}` |
| **Idempotencia** | ON CONFLICT DO NOTHING | ON CONFLICT DO NOTHING |
| **Verificación Coherencia** | ❌ NO | ✅ SÍ (línea 1538-1600) |
| **Actualización Estado** | ✅ SIEMPRE (si no idempotente) | ✅ SIEMPRE (si no idempotente) |
| **Refresh Plan** | ✅ Declarado | ✅ Declarado |
| **Refresh Ejecuta** | ❓ Depende de Refresh Engine | ❓ Depende de Refresh Engine |

### Logs Relevantes

**Logs existentes (forense):**
- `[CLEAN][WRITE]` - Limpieza aplicada (cleaning-engine-service.js:319)
- `[CLEAN][IDEMPOTENCY]` - Evento ya aplicado (cleaning-engine-service.js:605)
- `[RESET][CANONICAL]` - Reset aplicado (cleaning-engine-service.js:1344)
- `[REFRESH][GET]` - Re-fetch tras acción (master-alquimia-general-client.js:2131)
- `[UI][RECURRENTE][BUTTON]` - Intento de limpieza desde UI (master-alquimia-general-client.js:3734)

**Logs faltantes (requeridos):**
- ❌ Verificación de coherencia post-idempotencia en limpieza
- ❌ Estado antes vs después de acción (solo reset lo tiene parcialmente)
- ❌ Refresh plan ejecutado vs omitido
- ❌ state_by_view_layer presente vs faltante en respuesta GET

## Hipótesis Descartadas

### Hipótesis 1: Frontend calcula estado
**Estado:** ❌ DESCARTADA  
**Evidencia:** Frontend consume EXCLUSIVAMENTE `state_by_view_layer` (línea 2772-2788)

### Hipótesis 2: Estado cachead en memoria
**Estado:** ❌ DESCARTADA  
**Evidencia:** `state.modal` solo guarda `item` y `cleanLayer`, NO guarda `students` ni `state_by_view_layer` (línea 96-100)

### Hipótesis 3: Reset no actualiza BD
**Estado:** ❌ DESCARTADA  
**Evidencia:** `upsertApplyReset()` actualiza `effective_since` y contadores (línea 372-390)

### Hipótesis 4: CPM no calcula correctamente
**Estado:** ⚠️ PARCIAL  
**Evidencia:** CPM calcula `days_since=0` pero `state='never'` tras reset (línea 206-209), lo cual es coherente con la lógica pero puede no ser el comportamiento esperado

## Próximos Pasos (Solo Observación)

### Fase 1: Ejecutar Queries de Diagnóstico
**Script:** `scripts/diagnostico-reset-queries.sql` (del diagnóstico previo)

**Objetivo:** Identificar ítems con estados inconsistentes en BD

### Fase 2: Logs Forenses Adicionales
**Añadir logs SOLO para observar:**
- Estado antes vs después de cada acción
- Coherencia evento vs estado
- Refresh plan ejecutado vs omitido
- state_by_view_layer presente vs faltante

### Fase 3: Verificación en Runtime
**Acciones a verificar:**
1. Limpiar un alumno → verificar logs de idempotencia
2. Reset un item → verificar logs de coherencia
3. Cambiar view_layer → verificar recálculo
4. Abrir flotante en modo proyección → verificar refresh tras acción

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**FIN DEL DIAGNÓSTICO FORENSE**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Este documento será usado para el PROMPT DE FIX CANÓNICO posterior.**