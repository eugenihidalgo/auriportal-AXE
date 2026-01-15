# Alquimia General: Modelo Canónico de Lectura

**Versión:** 1.0.0  
**Fecha:** 2025-01-27  
**Estado:** CONSTITUCIONAL  
**Dominio:** MASTER (AuriPortal)

---

## Estatuto Constitucional

Este documento define el **pipeline canónico de lectura** para Alquimia General en dominio MASTER.

**Reglas absolutas:**
- PostgreSQL es Source of Truth
- CPM v2 es única autoridad de estado
- Frontend NO calcula estados
- Toda mutación requiere refetch

---

## Pipeline Completo: DB → CPM → Servicio → API → UI

### Capa 1: PostgreSQL (Source of Truth)

**Tabla:** `cleaning_item_state`

**Columnas canónicas:**
```sql
student_id UUID,
item_ref TEXT,
shared_last_cleaned_at TIMESTAMPTZ,
shared_effective_since TIMESTAMPTZ,  -- SOLO RECURRENTE
shared_clean_count INTEGER,
shared_remaining INTEGER,
shared_completed INTEGER,
pde_last_cleaned_at TIMESTAMPTZ,
pde_effective_since TIMESTAMPTZ,     -- SOLO RECURRENTE
pde_clean_count INTEGER,
pde_remaining INTEGER,
pde_completed INTEGER
```

**Reglas:**
- NO calcular `days_since` en SQL
- NO usar `had_history` (PROHIBIDO)
- Solo pasar datos brutos

**Ejemplo de query canónica:**
```sql
SELECT 
  student_id,
  item_ref,
  shared_last_cleaned_at,
  shared_effective_since,
  shared_clean_count,
  shared_remaining,
  shared_completed,
  pde_last_cleaned_at,
  pde_effective_since,
  pde_clean_count,
  pde_remaining,
  pde_completed
  -- CPM v2: NO calcular days_since en SQL, CPM lo calcula internamente
FROM cleaning_item_state
WHERE student_id = $1 AND item_ref = $2
```

**Prohibiciones:**
- ❌ `EXTRACT(EPOCH FROM ...)` para calcular `days_since`
- ❌ `shared_had_history` o `pde_had_history` en SELECT
- ❌ CASE statements para calcular estados

---

### Capa 2: Repositorio (Infra)

**Responsabilidades:**
- Leer desde PostgreSQL
- Mapear filas a objetos JavaScript
- NO calcular estados
- NO inferir datos

**Archivos canónicos:**
- `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js`
- `src/infra/repos/master-student-transmutation-read-repo-pg.js`

**Ejemplo canónico:**
```javascript
async getState(studentUuid, itemRef) {
  const result = await query(`
    SELECT 
      shared_last_cleaned_at,
      shared_effective_since,
      shared_clean_count,
      shared_remaining,
      shared_completed,
      pde_last_cleaned_at,
      pde_effective_since,
      pde_clean_count,
      pde_remaining,
      pde_completed
    FROM cleaning_item_state
    WHERE student_id = $1 AND item_ref = $2
  `, [studentUuid, itemRef]);
  
  // Mapear a objeto JavaScript (datos brutos)
  return {
    shared: {
      last_cleaned_at: result.rows[0]?.shared_last_cleaned_at || null,
      effective_since: result.rows[0]?.shared_effective_since || null,
      clean_count: result.rows[0]?.shared_clean_count || 0,
      remaining: result.rows[0]?.shared_remaining || null,
      completed: result.rows[0]?.shared_completed || 0
    },
    pde: {
      last_cleaned_at: result.rows[0]?.pde_last_cleaned_at || null,
      effective_since: result.rows[0]?.pde_effective_since || null,
      clean_count: result.rows[0]?.pde_clean_count || 0,
      remaining: result.rows[0]?.pde_remaining || null,
      completed: result.rows[0]?.pde_completed || 0
    }
  };
}
```

**Prohibiciones:**
- ❌ Calcular `days_since` en repositorio
- ❌ Calcular `combo` en repositorio
- ❌ Inferir estados desde datos raw
- ❌ Agregar campos derivados

---

### Capa 3: CPM v2 (Proyección)

**Responsabilidades:**
- Recibir datos brutos desde repositorio
- Calcular estados canónicos
- Generar proyecciones por `view_layer`
- Retornar `state_by_view_layer` completo

**Archivo canónico:**
- `src/core/master/services/cleaning-projection-model.js`

**Ejemplo canónico:**
```javascript
import { computeCleaningProjection } from './cleaning-projection-model.js';

// Servicio prepara datos brutos
const cleaningState = await repo.getState(studentUuid, itemRef);

// Servicio delega a CPM
const projection = computeCleaningProjection({
  cleaning_state: cleaningState,
  item_kind: 'recurrente',
  view_layer: 'shared',
  config: {
    threshold_days: item.frecuencia_dias || 7,
    critical_multiplier: item.critical_multiplier || 2.0
  }
});

// Servicio usa proyección
return {
  state_by_view_layer: projection.state_by_view_layer,
  state: projection.state_active,
  visual_state: projection.visual_state_active
};
```

**Prohibiciones:**
- ❌ Servicio calcula estado inline
- ❌ Servicio calcula `combo` antes de pasar al CPM
- ❌ Servicio calcula `days_since` antes de pasar al CPM
- ❌ Servicio infiere estados desde datos raw

---

### Capa 4: Servicio de Negocio

**Responsabilidades:**
- Orquestar lectura desde repositorio
- Preparar datos brutos para CPM
- Llamar a CPM v2
- Formatear respuesta para API

**Archivos canónicos:**
- `src/core/master/services/list-projection-model.js` (LPM)
- `src/core/master/services/alquimia-alumno-megalist-service.js`
- `src/services/alquimia-general-service.js`

**Ejemplo canónico (LPM):**
```javascript
// 1. Leer estados desde repositorio (datos brutos)
const cleaningStatesMap = await getCleaningStatesForItems(items, scope, studentId, item_kind);

// 2. Para cada item, preparar datos brutos
const cleaningState = cleaningStatesMap[item.item_ref] || {
  shared: {},
  pde: {}
};

// 3. NO calcular combo aquí (CPM lo hace internamente)
// Solo pasar datos brutos (shared y pde)

// 4. Llamar a CPM
const projection = computeCleaningProjection({
  cleaning_state: cleaningState,
  item_kind: item_kind,
  view_layer: view_layer,
  config: effectiveConfig
});

// 5. Usar proyección
const activeState = projection.state_by_view_layer[view_layer];
```

**Prohibiciones:**
- ❌ Calcular `combo` antes de pasar al CPM
- ❌ Calcular `days_since` antes de pasar al CPM
- ❌ Inferir estados desde datos raw
- ❌ Agregar campos derivados sin pasar por CPM

---

### Capa 5: API (Endpoints)

**Responsabilidades:**
- Validar parámetros (`view_layer`, `item_kind`)
- Llamar a servicios
- Formatear respuesta JSON
- Incluir `state_by_view_layer` completo

**Archivos canónicos:**
- `src/endpoints/master-api-alquimia-general.js`
- `src/endpoints/master-api-alquimia-alumno.js`

**Ejemplo canónico:**
```javascript
// GET /master/api/alquimia-general/list-projection
if (path === '/master/api/alquimia-general/list-projection' && method === 'GET') {
  const { list_id, item_kind, view_layer, scope, student_uuid } = queryParams;
  
  // Validar view_layer
  validateViewLayer(view_layer);
  validateViewLayerItemKindCoherence(view_layer, item_kind);
  
  // Llamar a servicio (LPM)
  const projection = await computeListProjection({
    list_id,
    item_kind,
    view_layer,
    scope,
    student_uuid
  });
  
  // Retornar proyección completa
  return jsonSuccess({
    ok: true,
    projection: {
      items: projection.items,  // Cada item tiene state_by_view_layer
      metrics: projection.metrics,
      list_state: projection.list_state
    },
    context: {
      view_layer: view_layer,
      item_kind: item_kind,
      scope: scope
    },
    trace_id: traceId
  }, traceId);
}
```

**Prohibiciones:**
- ❌ Calcular estados en endpoints
- ❌ Inferir `view_layer` desde contexto
- ❌ Omitir `state_by_view_layer` en respuesta
- ❌ Devolver solo estado activo sin proyección completa

---

### Capa 6: Frontend (UI)

**Responsabilidades:**
- Consumir `state_by_view_layer[view_layer]`
- Renderizar estados recibidos
- NO calcular estados
- NO inferir estados

**Archivo canónico:**
- `public/js/master/master-alquimia-general-client.js`

**Ejemplo canónico:**
```javascript
// Frontend consume proyección
function renderItem(item, viewLayer) {
  const stateData = item.state_by_view_layer?.[viewLayer];
  const state = stateData?.state || 'never';
  const visualState = stateData?.visual_state || 'never';
  
  // Renderizar según estado recibido
  const column = getColumnForState(state);
  const badge = createBadge(visualState);
  
  // NO calcular estado
  // NO inferir desde datos raw
}
```

**Prohibiciones:**
- ❌ Calcular `days_since` en frontend
- ❌ Comparar `last_cleaned_at` con `threshold_days` en frontend
- ❌ Calcular `combo` en frontend
- ❌ Inferir estados desde `shared_last_cleaned_at` o `pde_last_cleaned_at`
- ❌ Reutilizar estado previo sin refetch

---

## Rutas que Leen Estado

### 1. List Projection (`/master/api/alquimia-general/list-projection`)

**Pipeline:**
1. Endpoint valida `view_layer` y `item_kind`
2. LPM lee estados desde repositorio (datos brutos)
3. LPM llama a CPM v2 para cada item
4. LPM agrega métricas y `list_state`
5. API retorna proyección completa

**Archivos:**
- Endpoint: `src/endpoints/master-api-alquimia-general.js` (línea ~608)
- Servicio: `src/core/master/services/list-projection-model.js` (línea ~624)
- CPM: `src/core/master/services/cleaning-projection-model.js`

**Datos brutos requeridos:**
- `shared_last_cleaned_at`, `shared_effective_since`, `shared_clean_count`, `shared_remaining`, `shared_completed`
- `pde_last_cleaned_at`, `pde_effective_since`, `pde_clean_count`, `pde_remaining`, `pde_completed`

**Prohibiciones:**
- ❌ Calcular `days_since` en SQL
- ❌ Calcular `combo` antes de CPM
- ❌ Calcular estados en LPM

---

### 2. Flotante Alumnos (`/master/api/alquimia-general/items/:item_ref/students`)

**Pipeline:**
1. Endpoint valida `view_layer` y `clean_layer`
2. Servicio lee estudiantes desde repositorio (datos brutos)
3. Servicio llama a CPM v2 para cada estudiante
4. API retorna estudiantes con `state_by_view_layer`

**Archivos:**
- Endpoint: `src/endpoints/master-api-alquimia-general.js` (línea ~1026)
- Servicio: `src/services/alquimia-general-service.js` (línea ~540)
- Repositorio: `src/infra/repos/master-student-transmutation-read-repo-pg.js`

**Datos brutos requeridos:**
- Mismos que List Projection

**Prohibiciones:**
- ❌ Calcular `days_since` en repositorio
- ❌ Calcular `combo` en servicio
- ❌ Calcular estados en servicio

---

### 3. Megalist Alumno (`/master/api/alquimia-alumno/megalist`)

**Pipeline:**
1. Endpoint valida `view_layer`
2. Servicio lee estados desde repositorio (datos brutos)
3. Servicio llama a CPM v2 para cada item
4. API retorna megalist con `state_by_view_layer` por item

**Archivos:**
- Endpoint: `src/endpoints/master-api-alquimia-alumno.js` (línea ~112)
- Servicio: `src/core/master/services/alquimia-alumno-megalist-service.js` (línea ~103)
- CPM: `src/core/master/services/cleaning-projection-model.js`

**Datos brutos requeridos:**
- Mismos que List Projection

**Prohibiciones:**
- ❌ Calcular `days_since` en SQL
- ❌ Calcular `combo` antes de CPM
- ❌ Calcular estados en servicio

---

## Prohibiciones Explícitas por Capa

### PostgreSQL

**PROHIBIDO:**
- ❌ Calcular `days_since_last_effective_clean` en SQL
- ❌ Usar `shared_had_history` o `pde_had_history` en SELECT
- ❌ CASE statements para calcular estados
- ❌ Agregar campos derivados

**OBLIGATORIO:**
- ✅ Solo pasar datos brutos: `last_cleaned_at`, `effective_since`, `clean_count`, `remaining`, `completed`

---

### Repositorio

**PROHIBIDO:**
- ❌ Calcular `days_since` desde `last_cleaned_at`
- ❌ Calcular `combo` desde `shared_clean_count + pde_clean_count`
- ❌ Inferir estados desde datos raw
- ❌ Agregar campos derivados

**OBLIGATORIO:**
- ✅ Mapear filas SQL a objetos JavaScript (datos brutos)
- ✅ Incluir `effective_since` en datos brutos (CPM decide si lo usa)

---

### Servicio

**PROHIBIDO:**
- ❌ Calcular estados inline
- ❌ Calcular `combo` antes de pasar al CPM
- ❌ Calcular `days_since` antes de pasar al CPM
- ❌ Inferir estados desde datos raw
- ❌ Duplicar lógica de CPM

**OBLIGATORIO:**
- ✅ Preparar datos brutos (`shared` y `pde`)
- ✅ Llamar a `computeCleaningProjection()` del CPM
- ✅ Usar `state_by_view_layer` del CPM

---

### API

**PROHIBIDO:**
- ❌ Calcular estados en endpoints
- ❌ Inferir `view_layer` desde contexto
- ❌ Omitir `state_by_view_layer` en respuesta
- ❌ Devolver solo estado activo sin proyección completa

**OBLIGATORIO:**
- ✅ Validar `view_layer` y `item_kind`
- ✅ Incluir `state_by_view_layer` completo en respuesta
- ✅ Incluir `context.view_layer` en respuesta

---

### Frontend

**PROHIBIDO:**
- ❌ Calcular `days_since` en JavaScript
- ❌ Comparar `last_cleaned_at` con `threshold_days`
- ❌ Calcular `combo` en JavaScript
- ❌ Inferir estados desde datos raw
- ❌ Reutilizar estado previo sin refetch

**OBLIGATORIO:**
- ✅ Consumir `state_by_view_layer[view_layer]`
- ✅ Renderizar estados recibidos
- ✅ Refetch tras mutaciones (Refresh Engine v1)

---

## Flujo de Datos Canónico

### Lectura (GET)

```
PostgreSQL (cleaning_item_state)
  ↓ (datos brutos)
Repositorio (mapeo a objetos JS)
  ↓ (datos brutos)
Servicio (preparación)
  ↓ (datos brutos)
CPM v2 (cálculo de estados)
  ↓ (state_by_view_layer)
Servicio (formateo)
  ↓ (proyección completa)
API (respuesta JSON)
  ↓ (state_by_view_layer)
Frontend (render)
```

### Escritura (POST) + Refetch

```
Frontend (acción)
  ↓ (POST)
API (validación)
  ↓ (delegación)
Cleaning Engine (escritura)
  ↓ (evento + actualización)
API (respuesta)
  ↓ (afterMutation)
Refresh Engine v1
  ↓ (invalidate + refetch)
GET (nueva lectura)
  ↓ (state_by_view_layer)
Frontend (re-render)
```

---

## Ejemplos de Violaciones

### Violación 1: SQL Calcula `days_since`

**❌ PROHIBIDO:**
```sql
SELECT 
  CASE 
    WHEN shared_effective_since IS NOT NULL THEN
      EXTRACT(EPOCH FROM (NOW() - GREATEST(...))) / 86400
    ...
  END::integer as shared_days_since_last_clean
```

**✅ CORRECTO:**
```sql
SELECT 
  shared_last_cleaned_at,
  shared_effective_since
  -- CPM calcula days_since internamente
```

---

### Violación 2: Servicio Calcula `combo`

**❌ PROHIBIDO:**
```javascript
// Servicio calcula combo antes de CPM
const combo = {
  clean_count: shared.clean_count + pde.clean_count,
  remaining: max(0, required_count - combo.clean_count)
};
const projection = computeCleaningProjection({
  cleaning_state: { shared, pde, combo },  // ❌ Combo pre-calculado
  ...
});
```

**✅ CORRECTO:**
```javascript
// CPM calcula combo internamente
const projection = computeCleaningProjection({
  cleaning_state: { shared, pde },  // ✅ Solo datos brutos
  item_kind: 'una_vez',
  view_layer: 'combo',
  ...
});
```

---

### Violación 3: Frontend Calcula Estado

**❌ PROHIBIDO:**
```javascript
// Frontend calcula estado desde datos raw
const daysSince = calculateDaysSince(item.shared_last_cleaned_at);
if (daysSince < threshold_days) {
  state = 'reviewed';
} else {
  state = 'pending';
}
```

**✅ CORRECTO:**
```javascript
// Frontend consume estado del backend
const stateData = item.state_by_view_layer?.[viewLayer];
const state = stateData?.state || 'never';
```

---

## Verificación de Pipeline

### Assembly Check

**Comandos:**
```bash
# Verificar que CPM importa correctamente
node -e "import('./src/core/master/services/cleaning-projection-model.js').then(() => console.log('✅ CPM v2 OK'))"

# Verificar que no hay cálculos de estado fuera de CPM
grep -r "state.*=.*reviewed\|pending\|important\|never" src/services src/endpoints --exclude-dir=node_modules | grep -v "cleaning-projection-model"

# Verificar que no hay cálculo de days_since en SQL
grep -r "EXTRACT.*days_since" src/core/master/services src/infra/repos --exclude-dir=node_modules
```

### Logs Estructurados

**Prefijos canónicos:**
- `[CPM_V2][INPUT]` - Input al CPM
- `[CPM_V2][OUTPUT]` - Output del CPM
- `[LPM][CPM_V2][INPUT]` - Input al CPM desde LPM
- `[LPM][CPM_V2][OUTPUT]` - Output del CPM desde LPM

**Verificación:**
- Buscar logs `[CPM_V2]` en runtime
- Verificar que inputs incluyen datos brutos
- Verificar que outputs incluyen `state_by_view_layer`

---

## Paridad de Inputs CPM v2 entre Superficies

### Regla Constitucional

Para los mismos `(student_uuid + item_ref + view_layer + item_kind)`, todas las superficies (list-projection, flotante, megalist) DEBEN pasar al CPM v2 inputs idénticos.

**OBLIGATORIO:**
- ✅ Misma `effectiveConfig` (incluye overrides si existen)
- ✅ Mismo `cleaning_state` (mismos datos brutos)
- ✅ Mismo `item_kind` y `view_layer`

**PROHIBIDO:**
- ❌ Flotante sin overrides mientras list-projection/megalist sí los aplican
- ❌ Diferentes valores de `threshold_days` o `required_count` para el mismo alumno+ítem
- ❌ `completed` como boolean en una superficie e integer en otra

### Ejemplos

**Flotante debe aplicar overrides igual que list-projection/megalist:**

```javascript
// ✅ CORRECTO (flotante con overrides)
const baseConfig = {
  threshold_days: item.frecuencia_dias || 7,
  critical_multiplier: 2.0,
  required_count: item.veces_limpiar || 1
};

// Aplicar overrides por alumno
const effectiveConfig = await resolveItemConfigForStudent(
  baseConfig,
  student_uuid,
  item_ref
);

// Pasar effectiveConfig al CPM
const projection = computeCleaningProjection({
  cleaning_state,
  item_kind,
  view_layer,
  config: effectiveConfig // ✅ Incluye overrides
});
```

**❌ PROHIBIDO (flotante sin overrides):**
```javascript
// ❌ INCORRECTO
const config = {
  threshold_days: item.frecuencia_dias || 7,
  critical_multiplier: 2.0
};
// ❌ NO aplica resolveItemConfigForStudent()
```

### Verificación

**Logs forenses:**
- `[CPM_V2][INPUT]` debe mostrar `config.threshold_days` idéntico entre superficies para el mismo alumno+ítem
- Si hay override, `has_override: true` debe aparecer en logs

**Comandos:**
```bash
# Buscar logs CPM input para mismo trace_id o student_uuid+item_ref
grep -r "\[CPM_V2\]\[INPUT\]" logs/ | grep "student_uuid.*item_ref"
```

---

## Referencias

- **CPM v2:** `docs/CPM_V2_CANONICAL_MODEL.md`
- **View Authority:** `docs/CONSTITUTION_VIEW_AUTHORITY_V1.md`
- **Reset Canónico:** `docs/CLEANING_RESET_CANONICAL_V1.md`
- **Refresh Engine:** `docs/REFRESH_ENGINE_V1_MASTER.md`
- **Fix Input Parity:** `docs/FORENSICS_FIX_CPM_INPUT_PARITY_V1.md`

---

**FIN DE DOCUMENTACIÓN CANÓNICA READ MODEL**
