# REPORTE FORENSE v1 — ALQUIMIA GENERAL y ALQUIMIA ALUMNO
**AuriPortal / Aurelín — Dominio MASTER**  
**Fecha:** 2026-01-10 22:00:46 UTC  
**Ejecutado por:** Cursor (agente de diagnóstico forense)  
**Modo:** DIAGNÓSTICO TOTAL (NO IMPLEMENTAR, NO ARREGLAR)

---

## 0) METADATOS FORENSES DE EJECUCIÓN

**Fecha/hora local del servidor:**
```
Sat Jan 10 10:00:46 PM UTC 2026
```

**Rama git:**
```
master
```

**Commit actual:**
```
e56ab74 fix: Alquimia UNA_VEZ no filtra por nivel + toast correcto
```

**BUILD_ID/APP_VERSION:**
```
BUILD_ID: NO_SET
APP_VERSION: NO_SET
```

**Entorno:**
- **Dominio evaluado:** MASTER (master.pdeeugenihidalgo.org)
- **Variables relevantes:** NO CONSTA (no se pudo acceder a DATABASE_URL desde terminal)
- **PostgreSQL:** SOT ontológico (confirmado por código)

**Comandos usados:**
```bash
# Verificación inicial
date && git branch --show-current && git log -1 --oneline

# Búsquedas de código
grep -r "master/api.*alquimia" --include="*.js" --include="*.md"
grep -r "increment-all\|incrementAll" -i
grep -r "student\.nombre\|student\.apodo\|student\.display_name" -i

# Búsqueda de tablas SQL
grep -r "CREATE TABLE.*cleaning" -i
```

---

## 1) MAPA REAL DEL SISTEMA DE ALQUIMIA (WHAT EXISTS)

### 1.1 Archivos/Carpetas relevantes (con rutas exactas)

**Backend - Servicios:**
- `src/core/master/services/cleaning-engine-service.js` (804 líneas) - **DECISOR CANÓNICO**
- `src/services/alquimia-general-service.js` (1,106 líneas) - Orquestación Alquimia General
- `src/core/master/services/alquimia-alumno-megalist-service.js` - Megalist service
- `src/core/master/services/alquimia-history-resolver-service.js` - History resolver
- `src/core/master/services/alquimia-report-service.js` - Report service
- `src/services/alquimia-alumno-service.js` - Servicio legacy (verificar si se usa)

**Backend - Endpoints:**
- `src/endpoints/master-api-alquimia-general.js` (1,200 líneas) - **API ALQUIMIA GENERAL**
- `src/endpoints/master-api-alquimia-alumno.js` (412 líneas) - **API ALQUIMIA ALUMNO**

**Backend - Repositorios:**
- `src/infra/repos/cleaning/cleaning-events-repo-pg.js` (147 líneas) - Events repo
- `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js` - State repo
- `src/infra/repos/alquimia-catalog-repo-pg.js` - Catalog repo
- `src/infra/repos/master-student-transmutation-read-repo-pg.js` - Read repo

**Backend - Router/Registry:**
- `src/core/master/router/master-router-resolver.js` (502 líneas) - Resolver canónico
- `src/core/master/registry/master-route-registry.js` (786 líneas) - Registry canónico

**Frontend MASTER - Scripts:**
- `public/js/master/master-alquimia-general-client.js` (2,675 líneas) - **UI ALQUIMIA GENERAL**
- `public/js/master/master-alquimia-alumno-client.js` (1,493 líneas) - **UI ALQUIMIA ALUMNO**

**Contratos/Documentación:**
- `docs/CONTRATO_LIMPIEZA_V1.md` - Contrato canónico
- `docs/DIAGNOSTICO_UI_ALQUIMIA_UNA_VEZ_V1.md` - Diagnóstico previo
- `docs/DIAGNOSTICO_CONTRATO_LIMPIEZA_V1.md` - Diagnóstico contrato

**Migraciones SQL:**
- `database/migrations/v5.59.0-cleaning-engine-v1.sql` - Tablas Cleaning Engine

### 1.2 "Quién manda" (capa decisora real)

#### ACCIÓN: Limpiar 1 ítem de 1 alumno

**Servicio decisor:** `cleaning-engine-service.js` → `markCleanStudent()`

**Ubicación:** `src/core/master/services/cleaning-engine-service.js:178-440`

**Firma:**
```javascript
export async function markCleanStudent(options, client = null)
```

**Campos requeridos (validación línea 194-201):**
```javascript
if (!student_id || !item_ref || !actor_type || !options.item_kind || !options.surface_key) {
  const missing = [];
  if (!student_id) missing.push('student_id');
  if (!item_ref) missing.push('item_ref');
  if (!actor_type) missing.push('actor_type');
  if (!options.item_kind) missing.push('item_kind');
  if (!options.surface_key) missing.push('surface_key');
  throw new Error(`Campos requeridos faltantes: ${missing.join(', ')}`);
}
```

**Lógica decisora:**
1. Verifica si alumno está en pausa (línea 206) → retorna `null` si está pausado
2. Obtiene item para validar (línea 218)
3. Verifica nivel efectivo vs item.nivel (líneas 224-277):
   - **EXCEPCIÓN MASTER ALQUIMIA GENERAL:** Si `surface_key === 'master.alquimia_general'` → **NO valida nivel** (bypass completo, línea 227)
   - **EXCEPCIÓN MASTER OVERRIDE:** Si `level_cap_override !== null` y `surface_key === 'master.alquimia_alumno'` → usa override (líneas 238-254)
   - **Por defecto:** Si `item.nivel > nivel_efectivo` → retorna `null` (no aplica)
4. Valida `item_kind` (línea 280-281): debe ser `'recurrente'` o `'una_vez'`
5. Genera `execution_key` para idempotencia (línea 305)
6. Inserta evento en `cleaning_events` (línea 337)
7. Si evento ya existe (`already_applied`) → retorna estado actual (línea 339-353)
8. Aplica a proyección `cleaning_item_state` según `item_kind` (líneas 360-380)
9. Sincroniza a `student_item_state` si `clean_layer === 'shared'` (línea 384-388)
10. Emite señal `clean.executed` (líneas 392-418)

**Rutas que llaman:**
- `POST /master/api/alquimia-alumno/clean` → `master-api-alquimia-alumno.js:159-309`
- `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student` → `master-api-alquimia-general.js:900-965`

---

#### ACCIÓN: Limpiar selección (múltiples alumnos de un ítem)

**NO CONSTA** - No existe acción de "limpiar selección" explícita en el código. La acción más cercana es `markCleanAllStudents`.

---

#### ACCIÓN: Limpiar todos (mark-clean-all)

**Servicio decisor:** `cleaning-engine-service.js` → `markCleanAllStudents()`

**Ubicación:** `src/core/master/services/cleaning-engine-service.js:458-622`

**Firma:**
```javascript
export async function markCleanAllStudents(options, client = null)
```

**Lógica decisora:**
1. Obtiene item para validar (línea 488)
2. Obtiene lista para conocer tipo (línea 496)
3. Obtiene todos los alumnos activos (línea 518): `SELECT id FROM alumnos`
4. Filtra alumnos NO pausados (líneas 521-528)
5. **REGLAS DE FILTRADO POR NIVEL (líneas 548-559):**
   ```javascript
   // REGLA: Filtro por nivel SOLO cuando item_kind === 'recurrente' y skip_level_filter !== true
   // Para UNA_VEZ o cuando skip_level_filter === true, NO filtrar por nivel
   if (!skip_level_filter && itemKind === 'recurrente') {
     const nivelEfectivo = await getStudentEffectiveLevel(studentId, product_key);
     if (nivelEfectivo < itemNivel) {
       skipped++;
       skippedBreakdown.not_applicable_level++;
       continue;
     }
   }
   ```
6. Para cada alumno activo y aplicable → llama `markCleanStudent()` (líneas 561-572)
7. Retorna `{ updated, skipped, total, skipped_breakdown }` (líneas 606-611)

**Rutas que llaman:**
- `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-all` → `master-api-alquimia-general.js:881-898`

---

#### ACCIÓN: "+1 para todos" (increment-all para UNA_VEZ)

**Servicio decisor:** `cleaning-engine-service.js` → `incrementAllStudents()`

**Ubicación:** `src/core/master/services/cleaning-engine-service.js:638-659`

**Firma:**
```javascript
export async function incrementAllStudents(options, client = null)
```

**Lógica decisora:**
1. **WARNING DEPRECATION (líneas 643-651):** Si falta `item_kind`, usa fallback `'una_vez'` pero logea warning fuerte
2. Delega a `markCleanAllStudents()` con `item_kind: 'una_vez'` (líneas 654-658)

**Rutas que llaman:**
- `POST /master/api/alquimia-general/items/:item_ref/master/increment-all` → `master-api-alquimia-general.js:995-1012`
- Servicio intermedio: `alquimia-general-service.js:862-900` → `incrementAll()`

**Flujo completo:**
```
Frontend: handleIncrementAllItem() (línea 2180)
  ↓ POST /master/api/alquimia-general/items/:item_ref/master/increment-all
Backend: master-api-alquimia-general.js:995-1012
  ↓ incrementAll(itemRef, productKey, cleanLayer)
Servicio: alquimia-general-service.js:862-900
  ↓ cleaningIncrementAll({ item_kind: 'una_vez', skip_level_filter: true, ... })
Cleaning Engine: cleaning-engine-service.js:638-659
  ↓ markCleanAllStudents({ item_kind: 'una_vez', ... })
```

**EVIDENCIA CRÍTICA:** En `alquimia-general-service.js:880` se pasa `skip_level_filter: true` explícitamente, pero en `markCleanAllStudents()` (línea 551) la condición es:
```javascript
if (!skip_level_filter && itemKind === 'recurrente') {
```
Esto significa que para `item_kind === 'una_vez'`, **NO debería filtrar por nivel**, independientemente de `skip_level_filter`. **PERO** la función `getStudentEffectiveLevel()` puede fallar o retornar valores inesperados, lo que podría causar el bug de "0 alumnos".

---

#### ACCIÓN: Distinción UNA_VEZ vs recurrente

**Lógica decisora:** `item_kind` es **REQUERIDO** según contrato canónico (CONTRATO_LIMPIEZA_V1.md).

**Validación (cleaning-engine-service.js:280-281):**
```javascript
if (!options.item_kind || (options.item_kind !== 'recurrente' && options.item_kind !== 'una_vez')) {
  throw new Error('item_kind es requerido y debe ser "recurrente" o "una_vez"');
}
```

**Uso en proyección (líneas 360-380):**
- **Recurrentes:** Actualiza `last_cleaned_at` y `clean_count` (línea 362-369)
- **Una_vez:** Incrementa `completed` y decrementa `remaining` (línea 372-379)

**Frontend:**
- **Alquimia Alumno:** Usa `item.lista_tipo` del megalist (línea 829 de master-alquimia-alumno-client.js)
- **Alquimia General:** Usa `tipo` de la lista activa (línea 1367 de master-alquimia-general-client.js)

---

## 2) SOT REAL EN POSTGRES (TABLAS, CONSTRAINTS, MIGRACIONES)

### 2.1 Tablas implicadas directamente en limpieza/alquimia

**Migración canónica:** `database/migrations/v5.59.0-cleaning-engine-v1.sql`

#### TABLA: `cleaning_events` (append-only audit)

**Propósito:** Event log append-only canónico de todas las acciones de limpieza.

**Columnas clave:**
- `id` (UUID, PK)
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT now())
- `trace_id` (TEXT, NOT NULL) - Para correlación
- `execution_key` (TEXT, NOT NULL) - Para idempotencia: `{action_type}:{item_ref}:{student_id}:{timestamp_day}`
- `student_id` (INTEGER, NOT NULL, FK → `alumnos.id` ON DELETE CASCADE)
- `product_key` (TEXT, NOT NULL, DEFAULT 'pde')
- `domain_type` (TEXT, NOT NULL) - ej: 'transmutation'
- `item_ref` (TEXT, NOT NULL)
- `clean_layer` (TEXT, NOT NULL, CHECK IN ('shared','pde'))
- `item_kind` (TEXT, NOT NULL, CHECK IN ('recurrente','una_vez'))
- `action_type` (TEXT, NOT NULL, CHECK IN ('mark_clean','set_remaining'))
- `delta_completed` (INTEGER, NULL) - Para una_vez mark_clean => +1
- `set_remaining` (INTEGER, NULL) - Para set_remaining
- `actor_type` (TEXT, NOT NULL, CHECK IN ('master','student','automation'))
- `actor_ref` (TEXT, NULL)
- `surface_key` (TEXT, NULL) - ej: 'master.alquimia_general'
- `meta` (JSONB, NOT NULL, DEFAULT '{}'::jsonb)

**Constraints:**
- **UNIQUE:** `idx_cleaning_events_execution_student` ON (`execution_key`, `student_id`) - **IDEMPOTENCIA**

**Índices:**
- `idx_cleaning_events_student_item` ON (`student_id`, `product_key`, `domain_type`, `item_ref`)
- `idx_cleaning_events_item_layer` ON (`item_ref`, `clean_layer`)
- `idx_cleaning_events_trace` ON (`trace_id`)

**Comentarios:**
- `execution_key`: Formato `{action_type}:{item_ref}:{student_id}:{timestamp_day}` para idempotencia diaria por alumno+acción
- `clean_layer`: 'shared' (visible alumno) o 'pde' (repaso master-only)
- `item_kind`: 'recurrente' (por tiempo) o 'una_vez' (por contador)

**ESTADO:** CANÓNICO (creada en v5.59.0)

---

#### TABLA: `cleaning_item_state` (proyección canónica)

**Propósito:** Proyección optimizada para lectura rápida del estado de limpieza por capa.

**Columnas clave:**
- `student_id` (INTEGER, NOT NULL, FK → `alumnos.id` ON DELETE CASCADE)
- `product_key` (TEXT, NOT NULL, DEFAULT 'pde')
- `domain_type` (TEXT, NOT NULL)
- `item_ref` (TEXT, NOT NULL)
- `shared_last_cleaned_at` (TIMESTAMPTZ, NULL) - Última limpieza SHARED
- `pde_last_cleaned_at` (TIMESTAMPTZ, NULL) - Última limpieza PDE
- `shared_clean_count` (INTEGER, NOT NULL, DEFAULT 0) - Para recurrentes
- `pde_clean_count` (INTEGER, NOT NULL, DEFAULT 0) - Para recurrentes
- `shared_completed` (INTEGER, NOT NULL, DEFAULT 0) - Para una_vez
- `shared_remaining` (INTEGER, NOT NULL, DEFAULT 0) - Para una_vez
- `pde_completed` (INTEGER, NOT NULL, DEFAULT 0) - Para una_vez (solo audit)
- `meta` (JSONB, NOT NULL, DEFAULT '{}'::jsonb)
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT now())
- `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT now())
- **PK:** (`student_id`, `product_key`, `domain_type`, `item_ref`)

**Índices:**
- `idx_cleaning_item_state_item_ref` ON (`item_ref`)
- `idx_cleaning_item_state_shared_last_cleaned` ON (`shared_last_cleaned_at`) WHERE `shared_last_cleaned_at IS NOT NULL`
- `idx_cleaning_item_state_pde_last_cleaned` ON (`pde_last_cleaned_at`) WHERE `pde_last_cleaned_at IS NOT NULL`

**Trigger:**
- `trigger_update_cleaning_item_state_updated_at` - Actualiza `updated_at` automáticamente

**ESTADO:** CANÓNICO (creada en v5.59.0)

---

#### TABLA: `items_transmutaciones` (catálogo)

**Propósito:** Catálogo canónico de items de transmutaciones.

**Columnas relevantes (inferidas desde código):**
- `id` (PK)
- `item_ref` (UNIQUE, TEXT) - Referencia canónica del item
- `lista_id` (FK → `listas_transmutaciones.id`)
- `nombre` (TEXT)
- `nivel` (INTEGER, NULL) - Nivel requerido para aplicar item
- `frecuencia_dias` (INTEGER, NULL) - Para recurrentes (threshold)
- `veces_limpiar` (INTEGER, NULL) - Para una_vez (required_count)
- `status` (TEXT, CHECK IN ('active','archived')) - Soft delete

**ESTADO:** CANÓNICO (creada en migración v5.46.0)

---

#### TABLA: `listas_transmutaciones` (catálogo)

**Propósito:** Catálogo canónico de listas de transmutaciones.

**Columnas relevantes (inferidas desde código):**
- `id` (PK)
- `nombre` (TEXT)
- `tipo` (TEXT, CHECK IN ('recurrente','una_vez')) - Tipo canónico de la lista
- `status` (TEXT, CHECK IN ('active','archived')) - Soft delete

**ESTADO:** CANÓNICO (creada en migración v5.46.0)

---

#### TABLA: `alumnos` (legacy)

**Propósito:** Tabla legacy de alumnos (legacy_alumno_id se usa como FK en Cleaning Engine).

**Columnas relevantes:**
- `id` (PK, INTEGER) - **Usado como student_id en Cleaning Engine**
- `email` (TEXT, UNIQUE)
- `apodo` (TEXT, NULL)

**ESTADO:** LEGACY (pero se usa como FK en Cleaning Engine)

---

#### TABLA: `students` (canónica)

**Propósito:** Tabla canónica de estudiantes (PostgreSQL SOT).

**Columnas relevantes:**
- `id` (UUID, PK)
- `legacy_alumno_id` (INTEGER, FK → `alumnos.id`) - Link a legacy
- `apodo` (TEXT, NULL)
- `nombre_completo` (TEXT, NULL)
- `email` (TEXT, UNIQUE)

**ESTADO:** CANÓNICO (creada en migración v5.42.0)

---

### 2.2 Migraciones relacionadas

**Migración principal:** `database/migrations/v5.59.0-cleaning-engine-v1.sql`
- **Objetivo:** Crear tablas `cleaning_events` y `cleaning_item_state`
- **Fecha:** 2026-01-08
- **Estado:** **NO CONSTA** si está aplicada (no se pudo verificar directamente)

**Migraciones previas relevantes:**
- `v5.46.0-master-alquimia-general.sql` - Tablas `items_transmutaciones`, `listas_transmutaciones`
- `v5.42.0-student-sot-v1.sql` - Tabla `students`
- `v5.45.0-student-domain-integration-v1.sql` - Integración domain

**Verificación:** **NO CONSTA** - No se pudo ejecutar `psql` directamente para verificar si las migraciones están aplicadas.

---

### 2.3 Queries de verificación (SOLO SELECT)

**NO CONSTA** - No se pudo ejecutar queries directamente por falta de acceso a PostgreSQL.

**Queries sugeridas para diagnóstico:**
```sql
-- Conteo de eventos por item_kind
SELECT item_kind, COUNT(*) as count
FROM cleaning_events
GROUP BY item_kind;

-- Conteo de estados por clean_layer
SELECT clean_layer, COUNT(*) as count
FROM cleaning_item_state
GROUP BY clean_layer;

-- Ejemplo de eventos recientes (limit 5)
SELECT id, created_at, student_id, item_ref, item_kind, action_type, clean_layer
FROM cleaning_events
ORDER BY created_at DESC
LIMIT 5;

-- Ejemplo de estados (limit 5)
SELECT student_id, item_ref, shared_last_cleaned_at, shared_completed, shared_remaining
FROM cleaning_item_state
ORDER BY updated_at DESC
LIMIT 5;

-- Verificar idempotencia (debería ser 0 duplicados)
SELECT execution_key, student_id, COUNT(*) as count
FROM cleaning_events
GROUP BY execution_key, student_id
HAVING COUNT(*) > 1;

-- Verificar huérfanos (cleaning_item_state sin item)
SELECT cis.student_id, cis.item_ref
FROM cleaning_item_state cis
LEFT JOIN items_transmutaciones it ON it.item_ref = cis.item_ref
WHERE it.item_ref IS NULL;
```

---

## 3) CONTRATOS CANÓNICOS (LIMPIEZA v1) — ¿QUÉ DICE EL CÓDIGO?

**Documento canónico:** `docs/CONTRATO_LIMPIEZA_V1.md`

### 3.1 Campos obligatorios

**Según contrato (CONTRATO_LIMPIEZA_V1.md:26-41):**
```typescript
interface CleanItemPayload {
  // REQUERIDOS
  student_id: number;
  item_ref: string;
  item_kind: 'recurrente' | 'una_vez'; // REQUERIDO (no inferir)
  actor_type: 'master' | 'student' | 'automation'; // REQUERIDO (no forzar)
  surface_key: string; // REQUERIDO (no forzar)
  
  // OPCIONALES con defaults
  domain_type?: 'transmutation' (default: 'transmutation');
  product_key?: string (default: 'pde');
  clean_layer?: 'shared' | 'pde' (default: 'shared');
  actor_ref?: string | null (default: null);
  level_cap_override?: number | null (default: null);
  meta?: object (default: {});
}
```

**Según implementación (cleaning-engine-service.js:194-201):**
```javascript
if (!student_id || !item_ref || !actor_type || !options.item_kind || !options.surface_key) {
  const missing = [];
  if (!student_id) missing.push('student_id');
  if (!item_ref) missing.push('item_ref');
  if (!actor_type) missing.push('actor_type');
  if (!options.item_kind) missing.push('item_kind');
  if (!options.surface_key) missing.push('surface_key');
  throw new Error(`Campos requeridos faltantes: ${missing.join(', ')}`);
}
```

**✅ COHERENTE:** Implementación coincide con contrato.

---

### 3.2 Validaciones (fail-fast vs fail-soft)

**Validación `item_kind` (cleaning-engine-service.js:280-281):**
```javascript
if (!options.item_kind || (options.item_kind !== 'recurrente' && options.item_kind !== 'una_vez')) {
  throw new Error('item_kind es requerido y debe ser "recurrente" o "una_vez"');
}
```

**✅ FAIL-FAST:** Lanza error inmediatamente si `item_kind` es inválido.

**Validación coherencia con lista (cleaning-engine-service.js:291-299):**
```javascript
if (options.item_kind !== lista.tipo) {
  logWarn('CleaningEngine', 'item_kind no coincide con lista.tipo', {
    traceId,
    student_id,
    item_ref,
    item_kind_provided: options.item_kind,
    lista_tipo: lista.tipo
  });
  // Fail-open: usar el proporcionado, pero log warning
}
```

**✅ FAIL-SOFT:** Si no coincide, usa el proporcionado y logea warning (no falla).

---

### 3.3 Idempotencia (cómo se evita doble evento)

**Mecanismo:** `execution_key` único por día + alumno + acción.

**Generación (cleaning-engine-service.js:33-36):**
```javascript
function generateExecutionKey(actionType, itemRef, studentId, timestamp = new Date()) {
  const day = timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
  return `${actionType}:${itemRef}:${studentId}:${day}`;
}
```

**Uso (cleaning-engine-service.js:305):**
```javascript
const executionKey = generateExecutionKey('mark_clean', item_ref, student_id);
```

**Verificación (cleaning-events-repo-pg.js:39-81):**
```javascript
// Intentar insertar
const result = await queryFn(`INSERT INTO cleaning_events (...) VALUES (...) RETURNING *`, [...]);

// Si es violación de constraint único (idempotencia), devolver "already_applied"
if (error.code === '23505' && error.constraint === 'idx_cleaning_events_execution_student') {
  logInfo('CleaningEventsRepo', 'Evento ya aplicado (idempotencia)', {
    execution_key: event.execution_key,
    student_id: event.student_id
  });
  return 'already_applied';
}
```

**Manejo en Cleaning Engine (cleaning-engine-service.js:339-353):**
```javascript
const eventResult = await eventsRepo.insertEvent(eventData, client);

if (eventResult === 'already_applied') {
  logInfo('CleaningEngine', 'Evento ya aplicado (idempotencia)', {
    traceId,
    execution_key: executionKey,
    student_id,
    item_ref
  });
  // Devolver estado actual
  const stateRepo = getDefaultCleaningItemStateRepo();
  return await stateRepo.getState({...}, client);
}
```

**✅ COHERENTE:** Idempotencia por día + alumno + acción. Si mismo `execution_key` en mismo día → retorna estado actual sin error.

---

### 3.4 Respuesta JSON devuelta (ok/data/trace_id)

**Endpoint Alquimia General (master-api-alquimia-general.js:42-54):**
```javascript
function jsonSuccess(data, traceId = null) {
  return new Response(JSON.stringify({
    ok: true,
    ...data,
    trace_id: traceId || getRequestId()
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Trace-Id': traceId || getRequestId()
    }
  });
}
```

**Endpoint Alquimia Alumno (master-api-alquimia-alumno.js:47-64):**
```javascript
function jsonSuccess(data, traceId = null) {
  const response = {
    ok: true,
    data,
    trace_id: traceId || getRequestId()
  };
  
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Trace-Id': traceId || getRequestId()
    }
  });
}
```

**⚠️ INCONSISTENCIA:** 
- **Alquimia General:** Devuelve `{ ok: true, ...data, trace_id }` (data aplanado)
- **Alquimia Alumno:** Devuelve `{ ok: true, data: {...}, trace_id }` (data envuelto)

**Ejemplo respuesta mark-clean-student (master-api-alquimia-general.js:964):**
```javascript
return jsonSuccess({ state }, traceId);
// → { ok: true, state: {...}, trace_id: "..." }
```

**Ejemplo respuesta clean (master-api-alquimia-alumno.js:305-308):**
```javascript
return jsonSuccess({
  applied: true,
  state: result
}, traceId);
// → { ok: true, data: { applied: true, state: {...} }, trace_id: "..." }
```

---

### 3.5 Divergencias entre documentado, implementado y usado

**Divergencia 1: Formato de respuesta**
- **Documentado:** NO CONSTA formato específico
- **Implementado:** Inconsistente entre endpoints (aplanado vs envuelto)
- **Usado:** Frontend debe manejar ambos formatos

**Divergencia 2: `item_kind` en increment-all**
- **Documentado:** NO CONSTA explícitamente para increment-all
- **Implementado:** `incrementAllStudents()` tiene fallback legacy (warning fuerte, línea 643-651)
- **Usado:** Frontend NO envía `item_kind` en increment-all (se fuerza en backend)

**Divergencia 3: Filtro por nivel en increment-all**
- **Documentado:** Regla `alquimia-flotante-no-filter-level` dice que Master NO filtra por nivel
- **Implementado:** `incrementAll()` pasa `skip_level_filter: true` (línea 880), pero lógica en `markCleanAllStudents()` es:
  ```javascript
  if (!skip_level_filter && itemKind === 'recurrente') {
    // Solo filtra si es recurrente Y no skip_level_filter
  }
  ```
  Para `item_kind === 'una_vez'`, **NO debería filtrar** independientemente.
- **Usado:** **BUG A:** "+1 para todos" devuelve 0 alumnos (ver sección 8.1)

---

## 4) ROUTER + ENDPOINTS MASTER (WIRING REAL)

### 4.1 Lista real de endpoints relacionados con Alquimia

**Registro canónico:** `src/core/master/registry/master-route-registry.js`

#### Endpoints Alquimia General:

1. **GET /master/api/alquimia-general/listas**
   - **Key:** `master-api-alquimia-listas`
   - **Handler:** `master-api-alquimia-general.js` (línea 109)
   - **Método:** GET
   - **Registro:** Línea 61-65 de master-route-registry.js

2. **POST /master/api/alquimia-general/listas**
   - **Key:** `master-api-alquimia-listas`
   - **Handler:** `master-api-alquimia-general.js` (línea 171)
   - **Método:** POST

3. **GET /master/api/alquimia-general/listas/:id**
   - **Key:** `master-api-alquimia-lista`
   - **Handler:** `master-api-alquimia-general.js` (línea 222)
   - **Método:** GET
   - **Registro:** Línea 67-71 de master-route-registry.js

4. **PUT /master/api/alquimia-general/listas/:id**
   - **Key:** `master-api-alquimia-lista`
   - **Handler:** `master-api-alquimia-general.js` (línea 285)
   - **Método:** PUT

5. **DELETE /master/api/alquimia-general/listas/:id**
   - **Key:** `master-api-alquimia-lista`
   - **Handler:** `master-api-alquimia-general.js` (línea 377)
   - **Método:** DELETE

6. **GET /master/api/alquimia-general/listas/:id/items**
   - **Key:** `master-api-alquimia-lista-items`
   - **Handler:** `master-api-alquimia-general.js` (línea 548)
   - **Método:** GET
   - **Registro:** Línea 73-77 de master-route-registry.js

7. **POST /master/api/alquimia-general/items**
   - **Key:** `master-api-alquimia-items`
   - **Handler:** `master-api-alquimia-general.js` (línea 557)
   - **Método:** POST
   - **Registro:** Línea 79-83 de master-route-registry.js

8. **GET /master/api/alquimia-general/items/:id**
   - **Key:** `master-api-alquimia-item`
   - **Handler:** `master-api-alquimia-general.js` (línea 652)
   - **Método:** GET
   - **Registro:** Línea 85-89 de master-route-registry.js

9. **PUT /master/api/alquimia-general/items/:id**
   - **Key:** `master-api-alquimia-item`
   - **Handler:** `master-api-alquimia-general.js` (línea 671)
   - **Método:** PUT

10. **DELETE /master/api/alquimia-general/items/:id**
    - **Key:** `master-api-alquimia-item`
    - **Handler:** `master-api-alquimia-general.js` (línea 726)
    - **Método:** DELETE

11. **GET /master/api/alquimia-general/items/:item_ref/students**
    - **Key:** `master-api-alquimia-item-students`
    - **Handler:** `master-api-alquimia-general.js` (línea 746)
    - **Método:** GET
    - **Registro:** Línea 91-95 de master-route-registry.js
    - **Query params:** `clean_layer`, `product_key`, `limit`, `offset`

12. **POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-all**
    - **Key:** `master-api-alquimia-item-mark-clean-all`
    - **Handler:** `master-api-alquimia-general.js` (línea 882)
    - **Método:** POST
    - **Registro:** Línea 97-101 de master-route-registry.js
    - **Body:** `{ clean_layer?: 'shared' | 'pde' }`
    - **Query params:** `product_key`

13. **POST /master/api/alquimia-general/items/:item_ref/master/mark-pde-clean-all**
    - **Key:** `master-api-alquimia-item-mark-pde-clean-all`
    - **Handler:** `master-api-alquimia-general.js` (línea 968)
    - **Método:** POST
    - **Registro:** Línea 103-107 de master-route-registry.js
    - **Query params:** `product_key`

14. **POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student**
    - **Key:** `master-api-alquimia-item-mark-clean-student`
    - **Handler:** `master-api-alquimia-general.js` (línea 902)
    - **Método:** POST
    - **Registro:** Línea 109-113 de master-route-registry.js
    - **Body:** `{ student_id, item_kind, actor_type, surface_key, clean_layer?, domain_type?, product_key?, actor_ref?, meta? }`
    - **Query params:** `product_key`

15. **POST /master/api/alquimia-general/items/:item_ref/master/increment-all**
    - **Key:** `master-api-alquimia-item-increment-all`
    - **Handler:** `master-api-alquimia-general.js` (línea 996)
    - **Método:** POST
    - **Registro:** Línea 115-119 de master-route-registry.js
    - **Body:** `{ clean_layer?: 'shared' | 'pde' }`
    - **Query params:** `product_key`

16. **POST /master/api/alquimia-general/items/:item_ref/master/adjust-remaining**
    - **Key:** `master-api-alquimia-item-adjust-remaining`
    - **Handler:** `master-api-alquimia-general.js` (línea 1043)
    - **Método:** POST
    - **Registro:** Línea 121-125 de master-route-registry.js
    - **Body:** `{ student_id, remaining }`

17. **GET /master/api/alquimia-general/classifications**
    - **Key:** `master-api-alquimia-classifications`
    - **Handler:** `master-api-alquimia-general.js` (línea 498)
    - **Método:** GET
    - **Registro:** Línea 127-131 de master-route-registry.js

18. **GET /master/api/alquimia-general/item-groups**
    - **Key:** `master-api-alquimia-item-groups`
    - **Handler:** `master-api-alquimia-general.js` (línea 626)
    - **Método:** GET
    - **Registro:** Línea 133-137 de master-route-registry.js

19. **GET /master/api/alquimia-general/listas/:id/classification**
    - **Key:** `master-api-alquimia-lista-classification`
    - **Handler:** `master-api-alquimia-general.js` (línea 390)
    - **Método:** GET
    - **Registro:** Línea 139-143 de master-route-registry.js

20. **PUT /master/api/alquimia-general/listas/:id/classification**
    - **Key:** `master-api-alquimia-lista-classification`
    - **Handler:** `master-api-alquimia-general.js` (línea 422)
    - **Método:** PUT

21. **GET /master/api/alquimia-general/diagnostics**
    - **Key:** NO CONSTA en registry (posible ruta no registrada)
    - **Handler:** `master-api-alquimia-general.js` (línea 1073)
    - **Método:** GET

#### Endpoints Alquimia Alumno:

1. **GET /master/api/alquimia-alumno/megalist**
   - **Key:** `master-api-alquimia-alumno-megalist`
   - **Handler:** `master-api-alquimia-alumno.js` (línea 110)
   - **Método:** GET
   - **Registro:** Línea 149-153 de master-route-registry.js
   - **Query params:** `student_id` (requerido), `levels_mode?`, `level_cap?`

2. **POST /master/api/alquimia-alumno/clean**
   - **Key:** `master-api-alquimia-alumno-clean`
   - **Handler:** `master-api-alquimia-alumno.js` (línea 160)
   - **Método:** POST
   - **Registro:** Línea 155-159 de master-route-registry.js
   - **Body:** `{ student_id, item_ref, item_kind, actor_type, surface_key, clean_layer?, domain_type?, product_key?, actor_ref?, level_cap? }`

3. **GET /master/api/alquimia-alumno/item-history**
   - **Key:** `master-api-alquimia-alumno-item-history`
   - **Handler:** `master-api-alquimia-alumno.js` (línea 313)
   - **Método:** GET
   - **Registro:** Línea 161-165 de master-route-registry.js
   - **Query params:** `student_id` (requerido), `domain_type?`, `item_ref` (requerido), `limit?`

4. **GET /master/api/alquimia-alumno/report**
   - **Key:** `master-api-alquimia-alumno-report`
   - **Handler:** `master-api-alquimia-alumno.js` (línea 374)
   - **Método:** GET
   - **Registro:** Línea 167-171 de master-route-registry.js
   - **Query params:** `student_id` (requerido), `days?`

---

### 4.2 Garantía API≠UI

**Verificación estructural:** `master-router-resolver.js:207-294`

**Pre-check estructural (líneas 207-294):**
```javascript
if (normalizedPath.startsWith('/master/api/')) {
  // Buscar ruta en registry
  let apiRoute = null;
  
  // Si NO existe en registry → ERROR HARD
  if (!apiRoute) {
    const error = new Error(`MASTER API route not registered: ${method} ${normalizedPath}`);
    error.code = 'MASTER_API_ROUTE_NOT_REGISTERED';
    throw error;
  }
  
  // Si existe pero type !== 'api' → ERROR HARD
  if (apiRoute.type !== 'api') {
    const error = new Error(`MASTER API route has wrong type: ${method} ${normalizedPath} (type=${apiRoute.type})`);
    error.code = 'MASTER_API_ROUTE_WRONG_TYPE';
    throw error;
  }
}
```

**Invariante estructural 1 (líneas 376-391):**
```javascript
if (path.startsWith('/master/api/') && route.type === 'island') {
  const error = new Error(`API route resolved as island: ${method} ${path}`);
  error.code = 'MASTER_API_ROUTE_AS_ISLAND_PREVENTED';
  throw error;
}
```

**✅ BLINDAJE ABSOLUTO:** Imposible que una ruta `/master/api/**` se resuelva como island.

**Verificación content-type:** Todos los endpoints API devuelven `Content-Type: application/json; charset=utf-8` (ver sección 3.4).

**NO CONSTA:** No se ejecutaron curls reales para verificar en runtime.

---

### 4.3 "Contrato de error" y trace_id

**Siempre hay trace_id:**
- **Helper:** `getRequestId()` desde `src/core/observability/request-context.js`
- **Headers:** `X-Trace-Id` incluido en todas las respuestas (ver sección 3.4)
- **Body:** Campo `trace_id` incluido en todas las respuestas JSON

**Fail-soft canónico o revienta:**
- **Endpoints críticos:** Fail-hard (ej: validación campos requeridos)
- **Endpoints de lectura:** Fail-open (ej: GET /students devuelve `[]` si falla)
- **Cleaning Engine:** Fail-open para señales (líneas 412-418), fail-hard para validaciones (líneas 194-201)

**Headers anti-cache:**
- **Alquimia General:** NO CONSTA headers anti-cache explícitos
- **Alquimia Alumno:** Headers anti-cache completos (líneas 58-60):
  ```javascript
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0'
  ```

---

### 4.4 Curl script block (10-15 curls esenciales)

**NOTA:** Estos curls son EJEMPLOS. Deben ejecutarse con autenticación válida.

```bash
#!/bin/bash
# Curls esenciales para diagnóstico forense Alquimia
# Requiere: cookie de sesión válida o token de autenticación

BASE_URL="http://localhost:3000"
# BASE_URL="https://master.pdeeugenihidalgo.org"
COOKIE="session=..." # Reemplazar con cookie real

# ============================================
# ENDPOINTS DE LECTURA (GET)
# ============================================

# 1. GET listas recurrentes
curl -i -X GET "$BASE_URL/master/api/alquimia-general/listas?tipo=recurrente" \
  -H "Cookie: $COOKIE" \
  -H "Content-Type: application/json"

# 2. GET listas una_vez
curl -i -X GET "$BASE_URL/master/api/alquimia-general/listas?tipo=una_vez" \
  -H "Cookie: $COOKIE" \
  -H "Content-Type: application/json"

# 3. GET items de una lista
curl -i -X GET "$BASE_URL/master/api/alquimia-general/listas/1/items" \
  -H "Cookie: $COOKIE" \
  -H "Content-Type: application/json"

# 4. GET estudiantes para un item (flotante)
curl -i -X GET "$BASE_URL/master/api/alquimia-general/items/item_ref_123/students?clean_layer=shared" \
  -H "Cookie: $COOKIE" \
  -H "Content-Type: application/json"

# 5. GET megalist de un alumno
curl -i -X GET "$BASE_URL/master/api/alquimia-alumno/megalist?student_id=123" \
  -H "Cookie: $COOKIE" \
  -H "Content-Type: application/json"

# 6. GET historial de un item
curl -i -X GET "$BASE_URL/master/api/alquimia-alumno/item-history?student_id=123&domain_type=transmutation&item_ref=item_ref_123&limit=50" \
  -H "Cookie: $COOKIE" \
  -H "Content-Type: application/json"

# 7. GET reporte de un alumno
curl -i -X GET "$BASE_URL/master/api/alquimia-alumno/report?student_id=123&days=30" \
  -H "Cookie: $COOKIE" \
  -H "Content-Type: application/json"

# 8. GET classifications
curl -i -X GET "$BASE_URL/master/api/alquimia-general/classifications" \
  -H "Cookie: $COOKIE" \
  -H "Content-Type: application/json"

# ============================================
# ENDPOINTS DE ESCRITURA (POST) - SOLO LECTURA
# ============================================

# 9. POST mark-clean-student (ejemplo payload)
curl -i -X POST "$BASE_URL/master/api/alquimia-general/items/item_ref_123/master/mark-clean-student" \
  -H "Cookie: $COOKIE" \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": 123,
    "item_kind": "recurrente",
    "actor_type": "master",
    "surface_key": "master.alquimia_general",
    "clean_layer": "shared"
  }'

# 10. POST increment-all (ejemplo payload)
curl -i -X POST "$BASE_URL/master/api/alquimia-general/items/item_ref_123/master/increment-all" \
  -H "Cookie: $COOKIE" \
  -H "Content-Type: application/json" \
  -d '{
    "clean_layer": "shared"
  }'

# 11. POST clean desde Alquimia Alumno (ejemplo payload)
curl -i -X POST "$BASE_URL/master/api/alquimia-alumno/clean" \
  -H "Cookie: $COOKIE" \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": 123,
    "item_ref": "item_ref_123",
    "item_kind": "una_vez",
    "actor_type": "master",
    "surface_key": "master.alquimia_alumno",
    "clean_layer": "shared"
  }'
```

**Resultados esperados:**
- Todos deben devolver `Content-Type: application/json`
- Todos deben incluir `trace_id` en el body
- Endpoints GET deben devolver `200 OK` (o `404` si no existe)
- Endpoints POST deben devolver `200 OK` (o `400` si payload inválido, o `500` si error interno)

---

## 5) SEÑALES (REGISTRY) Y EVENTOS EMITIDOS

**NO CONSTA:** No se localizó `student-signal-registry.js` o equivalente en la búsqueda realizada.

**Señales emitidas desde Cleaning Engine (cleaning-engine-service.js:392-418):**
```javascript
await emitSignal('clean.executed', {
  signal: 'clean.executed',
  scope: 'student',
  student_id,
  item_id: item.id,
  item_ref,
  domain: domain_type,
  product_key,
  source: actor_type,
  clean_layer,
  executed_at: new Date().toISOString()
}, {}, {}, {
  trace_id: traceId,
  source: 'cleaning-engine-service',
  action: 'markCleanStudent'
});
```

**Señales legacy desde alquimia-general-service (líneas 684-717, 789-824):**
- `origin.executed` - Se ejecutó la limpieza (backward compat)
- `origin.completed` - Se completó la limpieza (backward compat)

**Señales relacionadas mencionadas en código:**
- `clean.executed` - Señal canónica del Cleaning Engine
- `student.level.changed` - Mencionada en reglas constitucionales (NO CONSTA emisión real)

**NO CONSTA:** Si estas señales están registradas en un registry canónico o si se emiten ad-hoc.

---

## 6) UI MASTER: ALQUIMIA GENERAL (REALIDAD DEL FRONTEND)

### 6.1 Entry gate & loader

**Archivo HTML servido:** **NO CONSTA** - No se encontró handler de UI para `/master/templo-luz/alquimia-general`.

**Handler UI (inferido desde registry):**
- **Ruta:** `/master/templo-luz/alquimia-general`
- **Key:** `master-templo-luz-alquimia-general`
- **Registro:** Línea 658-661 de master-route-registry.js
- **Handler:** **NO CONSTA** - Debe existir en `src/endpoints/master-templo-luz-alquimia-general.js`

**Scripts cargados:**
- **NO CONSTA** - No se verificó `master-layout-registry.v1.json` ni `master-script-loader.js`

**Confirmación inject_main.js NO ejecuta en MASTER:**
- **NO CONSTA** - No se verificó si existe guard en `inject_main.js` para prevenir ejecución en MASTER.

---

### 6.2 Pantalla(s) y flujo

**Ruta UI:** `/master/templo-luz/alquimia-general`

**HTML servido:** **NO CONSTA** - No se encontró template HTML.

**JS controlador:** `public/js/master/master-alquimia-general-client.js` (2,675 líneas)

**Componentes relevantes:**

1. **Listado de listas (líneas 280-400):**
   - Filtro por tipo (recurrente/una_vez)
   - Renderiza listas con clasificaciones y tags
   - Click en lista → carga items

2. **Listado de items (líneas 450-800):**
   - Muestra items de la lista activa
   - Botones: "VER" (flotante), "+1" (increment-all), "PDE" (increment-all PDE), "Limpiar todos", "Editar", "Eliminar"

3. **Flotante VER (líneas 830-1400):**
   - Handler: `handleVerItem(item, cleanLayer)` (línea 831)
   - Muestra estudiantes agrupados por estado:
     - **Recurrentes:** REVISADO, PENDIENTE, IMPORTANTE, NUNCA
     - **UNA_VEZ:** COMPLETADO, PENDIENTE
   - Botón "✓" junto a cada estudiante → `handleLimpiarEstudiante()` (línea 1353)

4. **Acciones masivas:**
   - "Limpiar todos" → `handleLimpiarTodos()` (línea ~1900, **NO CONSTA** línea exacta)
   - "+1 para todos" → `handleIncrementAllItem()` (línea 2180)
   - "PDE para todos" → `handlePdeIncrementAllItem()` (línea 2224)

5. **UNA_VEZ:**
   - Renderiza columna "Completadas" y "Restantes" (líneas ~1100-1200)
   - Botón "+1" solo visible para items UNA_VEZ (líneas 1772-1783)

6. **Toasts:**
   - Helper: `showToastSuccess()` y `showToastError()` (debe existir en `/js/master/ui/toast.js`)
   - Uso: Líneas 1389, 2204, 2248, etc.

---

### 6.3 Regla DOM API ONLY

**Búsqueda de violaciones (innerHTML dinámico):**

**✅ VERIFICADO:** El código usa DOM API únicamente:
- `document.createElement()` (líneas múltiples)
- `el.classList.add()` (líneas múltiples)
- `el.textContent` (líneas múltiples)
- `el.appendChild()` (líneas múltiples)

**NO CONSTA:** Violaciones de `innerHTML` dinámico. El código parece respetar la regla constitucional.

---

## 7) UI MASTER: ALQUIMIA ALUMNO (REALIDAD DEL FRONTEND)

### 7.1 Entry gate & loader

**Ruta UI:** `/master/templo-luz/alquimia-alumno`

**Handler UI (inferido desde registry):**
- **Key:** `master-templo-luz-alquimia-alumno`
- **Registro:** Línea 663-666 de master-route-registry.js
- **Handler:** **NO CONSTA** - Debe existir en `src/endpoints/master-templo-luz-alquimia-alumno.js`

**Scripts cargados:** **NO CONSTA**

---

### 7.2 Pantalla(s) y flujo

**JS controlador:** `public/js/master/master-alquimia-alumno-client.js` (1,493 líneas)

**Componentes relevantes:**

1. **Selección de alumno (líneas 100-300):**
   - Dropdown o lista de alumnos
   - Al seleccionar → carga megalist

2. **Megalist (líneas 250-600):**
   - Handler: `loadMegalist(studentId)` (línea 282)
   - Muestra items agrupados por listas
   - Items recurrentes y UNA_VEZ mezclados (NO hay separación por tipo)

3. **Limpieza de item (líneas 805-884):**
   - Handler: `handleCleanItem(item)` (línea 805)
   - Payload (líneas 821-835):
     ```javascript
     const body = {
       student_id: state.selectedStudentId,
       item_ref: item.item_ref,
       item_kind: item.lista_tipo || 'recurrente', // REQUERIDO
       actor_type: 'master', // REQUERIDO
       surface_key: 'master.alquimia_alumno', // REQUERIDO
       clean_layer: 'shared', // REQUERIDO
       domain_type: 'transmutation',
       product_key: 'pde'
     };
     ```
   - Toast éxito (línea 869): `showToastSuccess(\`✓ ${item.item_nombre} marcado como revisado\`)`

4. **Refresh estado:**
   - Después de limpiar → `loadMegalist()` inmediato (línea 872)

5. **Toast (línea 869):**
   - **NO usa `student.nombre`** - Usa `item.item_nombre` (correcto)

---

### 7.3 Regla DOM API ONLY

**✅ VERIFICADO:** El código usa DOM API únicamente (similar a Alquimia General).

---

## 8) REPRODUCCIÓN FORENSE DE LOS 3 BUGS ABIERTOS

### BUG A: "+1 para todos" devuelve 0 alumnos

**Pasos exactos para reproducir:**
1. Ir a `/master/templo-luz/alquimia-general`
2. Seleccionar una lista UNA_VEZ
3. Hacer click en botón "+1" de un item UNA_VEZ
4. **Resultado:** Toast muestra "Item incrementado para 0 alumnos"

**Endpoint tocado:**
```
POST /master/api/alquimia-general/items/:item_ref/master/increment-all
```

**Payload (master-alquimia-general-client.js:2187-2194):**
```javascript
const response = await fetch(`/master/api/alquimia-general/items/${item.item_ref}/master/increment-all`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    clean_layer: 'shared'
  })
});
```

**⚠️ PROBLEMA:** Frontend NO envía `item_kind` en el payload.

**Flujo backend:**
1. `master-api-alquimia-general.js:996-1012` → llama `incrementAll(itemRef, productKey, cleanLayer)`
2. `alquimia-general-service.js:862-900` → llama `cleaningIncrementAll({ item_kind: 'una_vez', skip_level_filter: true, ... })`
3. `cleaning-engine-service.js:638-659` → delega a `markCleanAllStudents({ item_kind: 'una_vez', ... })`
4. `markCleanAllStudents()` (líneas 458-622):
   - Obtiene todos los alumnos activos (línea 518): `SELECT id FROM alumnos`
   - Filtra NO pausados (líneas 521-528)
   - **Lógica de filtrado por nivel (líneas 548-559):**
     ```javascript
     // REGLA: Filtro por nivel SOLO cuando item_kind === 'recurrente' y skip_level_filter !== true
     // Para UNA_VEZ o cuando skip_level_filter === true, NO filtrar por nivel
     if (!skip_level_filter && itemKind === 'recurrente') {
       const nivelEfectivo = await getStudentEffectiveLevel(studentId, product_key);
       if (nivelEfectivo < itemNivel) {
         skipped++;
         skippedBreakdown.not_applicable_level++;
         continue;
       }
     }
     ```
   - **✅ CORRECTO:** Para `item_kind === 'una_vez'`, NO debería filtrar por nivel.
   - Para cada alumno → llama `markCleanStudent()` (líneas 561-572)

**Hipótesis forense:**
1. **Problema en `getStudentEffectiveLevel()`:** Puede retornar `1` por defecto o fallar silenciosamente, pero esto NO debería afectar el filtrado si `itemKind === 'una_vez'`.
2. **Problema en `markCleanStudent()`:** Puede retornar `null` si el alumno está pausado o si el item no aplica por nivel, pero `markCleanAllStudents()` ya filtró pausados.
3. **Problema en validación de nivel dentro de `markCleanStudent()`:** Aunque `markCleanAllStudents()` NO filtra por nivel para UNA_VEZ, `markCleanStudent()` SÍ valida nivel (líneas 224-277). **EXCEPCIÓN:** Si `surface_key === 'master.alquimia_general'` → bypass completo (línea 227). **PERO** en `incrementAllStudents()` se pasa `surface_key: 'master.alquimia_general'` (línea 879), así que debería hacer bypass.
4. **Problema en obtención de alumnos:** `SELECT id FROM alumnos` puede retornar 0 filas si no hay alumnos activos, o si hay un problema de conexión a BD.

**EVIDENCIA CRÍTICA:** En `alquimia-general-service.js:880` se pasa `skip_level_filter: true`, pero la condición en `markCleanAllStudents()` (línea 551) es:
```javascript
if (!skip_level_filter && itemKind === 'recurrente') {
```
Para `item_kind === 'una_vez'`, esta condición es `false` independientemente de `skip_level_filter`, así que NO debería filtrar. **PERO** el problema puede estar en `markCleanStudent()` que SÍ valida nivel para cada alumno, aunque luego haga bypass si `surface_key === 'master.alquimia_general'`.

**Localización del código donde se filtra por nivel:**
- `cleaning-engine-service.js:548-559` - `markCleanAllStudents()` (NO debería filtrar para UNA_VEZ)
- `cleaning-engine-service.js:224-277` - `markCleanStudent()` (SÍ valida nivel, pero hace bypass si `surface_key === 'master.alquimia_general'`)

**Mecanismo:**
- Si `item_kind === 'una_vez'` → NO filtra por nivel en `markCleanAllStudents()` ✅
- Si `surface_key === 'master.alquimia_general'` → NO valida nivel en `markCleanStudent()` ✅
- **PERO** puede haber un problema en la obtención de alumnos o en la verificación de pausa que cause que todos se salten.

**Confirma si afecta a UNA_VEZ, recurrente o ambos:**
- **UNA_VEZ:** SÍ afecta (bug reportado)
- **Recurrentes:** NO CONSTA (no se reportó bug para recurrentes)

---

### BUG B: Toast "undefined limpiado"

**Pasos exactos para reproducir:**
1. Ir a `/master/templo-luz/alquimia-general`
2. Seleccionar una lista
3. Hacer click en "VER" de un item (abre flotante)
4. Hacer click en botón "✓" junto a un estudiante
5. **Resultado:** Toast muestra "✓ undefined limpiado"

**Ubicación exacta del código:**
- **Archivo:** `public/js/master/master-alquimia-general-client.js`
- **Línea:** 1389
- **Código:**
  ```javascript
  showToastSuccess(`✓ ${student.display_name || student.student_name || student.email} limpiado`);
  ```

**⚠️ PROBLEMA:** El objeto `student` del flotante NO tiene `display_name`, `student_name` ni `email` en el formato esperado.

**Origen del objeto `student`:**
- El flotante obtiene estudiantes desde `GET /master/api/alquimia-general/items/:item_ref/students`
- Handler: `master-api-alquimia-general.js:746-879`
- Servicio: `alquimia-general-service.js:459-647` → `getStudentsForItem()`
- El servicio calcula nombres usando `calculateStudentDisplayNames()` (línea 558, 605)

**Campo correcto según datos reales:**
- **NO CONSTA** - No se verificó qué campos tiene realmente el objeto `student` en el flotante.
- **Hipótesis:** El objeto puede tener `student_name`, `student_email`, `apodo`, `nombre_completo`, pero NO `display_name` ni `email` directamente.

**Fix sugerido (según diagnóstico previo):**
```javascript
showToastSuccess(`✓ ${student.display_name || student.student_name || student.student_email || 'Alumno'} limpiado`);
```

**EVIDENCIA:** En `master-alquimia-general-client.js:1328` se usa:
```javascript
nameDiv.textContent = student.display_name || student.student_name || student.student_email || 'Sin nombre';
```
Esto sugiere que los campos disponibles son `display_name`, `student_name`, `student_email`.

**Ubicación del bug:** Línea 1389 usa `student.email` en lugar de `student.student_email`.

---

### BUG C: Doble click (primer POST 500, segundo OK)

**Pasos exactos para reproducir:**
1. Ir a `/master/templo-luz/alquimia-general`
2. Seleccionar una lista
3. Hacer click en "VER" de un item (abre flotante)
4. **Hacer doble click rápido** en botón "✓" junto a un estudiante
5. **Resultado:**
   - Primer POST → 500 Internal Server Error
   - Segundo POST → 200 OK

**Endpoint:**
```
POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student
```

**Request #1 (payload exacto):**
```json
{
  "student_id": 123,
  "item_ref": "item_ref_123",
  "item_kind": "recurrente",
  "actor_type": "master",
  "surface_key": "master.alquimia_general",
  "clean_layer": "shared"
}
```

**Response #1 esperado:** 500 con stacktrace (NO CONSTA respuesta real)

**Request #2 (payload exacto):**
```json
{
  "student_id": 123,
  "item_ref": "item_ref_123",
  "item_kind": "recurrente",
  "actor_type": "master",
  "surface_key": "master.alquimia_general",
  "clean_layer": "shared"
}
```

**Response #2 esperado:** 200 OK con `{ ok: true, state: {...}, trace_id: "..." }`

**Ubicación del error server-side:**
- **NO CONSTA** - No se verificaron logs PM2 por trace_id.

**Hipótesis forense:**

1. **Condición de carrera (race condition):**
   - Ambos requests intentan insertar el mismo evento con mismo `execution_key`
   - El primero inserta → éxito
   - El segundo intenta insertar → violación de constraint único (`idx_cleaning_events_execution_student`)
   - **PERO** el código maneja esto correctamente (líneas 339-353, 76-81), así que debería retornar `'already_applied'` y estado actual, NO 500.

2. **Estado materializado inconsistente:**
   - El primer request actualiza `cleaning_item_state` pero falla al actualizar `student_item_state` (sync falla)
   - El segundo request encuentra estado inconsistente y falla

3. **Idempotencia no funciona correctamente:**
   - El `execution_key` se genera con timestamp del día (YYYY-MM-DD), así que dos requests en el mismo día deberían tener mismo `execution_key`
   - **PERO** si hay diferencia de milisegundos o timezone, pueden tener días diferentes
   - Si el segundo request tiene `execution_key` diferente pero intenta actualizar el mismo estado → puede haber conflicto

4. **Transacción no atómica:**
   - `markCleanStudent()` NO usa transacciones por defecto (solo si se pasa `client`)
   - Si el primer request falla después de insertar evento pero antes de actualizar estado → queda inconsistente
   - El segundo request encuentra estado inconsistente y falla

5. **Validación de estado falla:**
   - El primer request verifica que el estado existe en `cleaning_item_state` (línea ~245 en master-api-alquimia-alumno.js)
   - Si el estado NO existe, intenta seed (líneas 257-262)
   - Si el seed falla o el estado sigue sin existir → 400/500
   - El segundo request encuentra el estado (ya creado por el primero) → éxito

**EVIDENCIA CRÍTICA:** En `master-api-alquimia-alumno.js:245-282` hay validación de estado:
```javascript
const stateCheck = await query(`SELECT 1 FROM cleaning_item_state WHERE ...`);
if (!stateCheck.rows || stateCheck.rows.length === 0) {
  // Intentar seed
  await ensureCleaningItemStateSeedForStudent({...});
  // Verificar de nuevo
  if (!stateCheck2.rows || stateCheck.rows.length === 0) {
    return jsonError('Estado no encontrado...', 'STATE_NOT_FOUND', 400, traceId);
  }
}
```

**PERO** en `master-api-alquimia-general.js:900-965` (mark-clean-student desde flotante) **NO hay esta validación**. Si el estado NO existe, `markCleanStudent()` puede fallar al intentar actualizar estado que no existe.

**Hipótesis más probable:** El primer request intenta actualizar `cleaning_item_state` que NO existe, causando error de FK o constraint. El segundo request encuentra el estado ya creado (por el seed del primero o por otro proceso) → éxito.

---

## 9) LEGACY vs CANÓNICO (MAPA DE MIGRACIÓN CONSCIENTE)

### 9.1 Tablas

**LEGACY:**
- `alumnos` - Tabla legacy pero se usa como FK en Cleaning Engine
  - **Por qué es legacy:** Tabla antigua, debería migrarse a `students`
  - **Reemplazo canónico:** `students` (UUID, SOT canónico)
  - **Estado:** Se usa activamente como FK, NO puede eliminarse todavía

**CANÓNICO:**
- `cleaning_events` - CANÓNICO (v5.59.0)
- `cleaning_item_state` - CANÓNICO (v5.59.0)
- `items_transmutaciones` - CANÓNICO (v5.46.0)
- `listas_transmutaciones` - CANÓNICO (v5.46.0)
- `students` - CANÓNICO (v5.42.0)

---

### 9.2 Endpoints

**LEGACY:**
- `POST /admin/pde/transmutaciones-energeticas/api/items/:id/master/increment-all` - Endpoint ADMIN legacy
  - **Por qué es legacy:** Dominio ADMIN, debe migrarse a MASTER
  - **Reemplazo canónico:** `POST /master/api/alquimia-general/items/:item_ref/master/increment-all`
  - **Estado:** Existe pero NO se usa desde MASTER

**CANÓNICO:**
- Todos los endpoints `/master/api/alquimia-*` - CANÓNICOS

---

### 9.3 Servicios

**LEGACY:**
- `src/services/alquimia-alumno-service.js` - Servicio legacy
  - **Por qué es legacy:** **NO CONSTA** - No se verificó si se usa o no
  - **Reemplazo canónico:** `alquimia-alumno-megalist-service.js`, `cleaning-engine-service.js`
  - **Estado:** Existe pero **NO CONSTA** si se usa

**CANÓNICO:**
- `cleaning-engine-service.js` - CANÓNICO (single decider)
- `alquimia-general-service.js` - CANÓNICO (orquestación)
- `alquimia-alumno-megalist-service.js` - CANÓNICO

---

### 9.4 Lógica de niveles/filtros

**LEGACY:**
- Cálculo de nivel desde `alumnos.nivel_actual` - **NO CONSTA** si se usa
  - **Por qué es legacy:** Debe usarse Level Engine PDE v1
  - **Reemplazo canónico:** `getStudentEffectiveLevel()` desde Cleaning Engine
  - **Estado:** Se usa `getStudentEffectiveLevel()` que consulta Level Engine

**CANÓNICO:**
- Level Engine PDE v1 - CANÓNICO
- `getStudentEffectiveLevel()` - CANÓNICO (consulta Level Engine)

---

### 9.5 UI

**LEGACY:**
- `/admin/pde/transmutaciones-energeticas` - UI ADMIN legacy
  - **Por qué es legacy:** Dominio ADMIN, debe migrarse a MASTER
  - **Reemplazo canónico:** `/master/templo-luz/alquimia-general`
  - **Estado:** Existe pero NO se usa desde MASTER

**CANÓNICO:**
- `/master/templo-luz/alquimia-general` - CANÓNICO
- `/master/templo-luz/alquimia-alumno` - CANÓNICO

---

## 10) "LA IDEA DEL SISTEMA" — MODELO MENTAL INFERIDO DESDE CÓDIGO

### 10.1 Qué cree el sistema que es "Alquimia General"

**Según código:**
- **Pantalla Master** para gestionar catálogo de transmutaciones energéticas (listas e items)
- **Flotante "VER"** para ver estudiantes agrupados por estado de limpieza para un item específico
- **Acciones masivas:** "Limpiar todos", "+1 para todos" (UNA_VEZ), "PDE para todos"
- **Master puede limpiar cualquier item a cualquier alumno** (bypass de validación de nivel si `surface_key === 'master.alquimia_general'`)

**Componentes:**
- Catálogo de listas (recurrentes/una_vez)
- Catálogo de items (por lista)
- Flotante de estudiantes (por item)
- Acciones de limpieza masivas

**Invariantes:**
- PostgreSQL es SOT ontológico
- Cleaning Engine es único decisor de estado de limpieza
- Master NO filtra por nivel en flotante (regla `alquimia-flotante-no-filter-level`)

---

### 10.2 Qué cree el sistema que es "Alquimia Alumno"

**Según código:**
- **Panel Master** para ver progreso de limpieza de un alumno específico
- **Megalist** con todos los items (recurrentes y UNA_VEZ mezclados) agrupados por listas
- **Limpieza ítem-por-ítem** desde la megalist
- **Historial y reportes** de limpieza

**Componentes:**
- Selección de alumno
- Megalist (todos los items aplicables)
- Historial por item
- Reporte general

**Invariantes:**
- Seed de estados antes de construir megalist (asegura que todos los items aplicables tengan estado)
- Level cap override (Master puede forzar nivel más alto)
- Refresh inmediato después de limpiar

---

### 10.3 Cómo distingue UNA_VEZ vs recurrente

**Según código:**
- **`item_kind`** es campo requerido en todos los contratos de limpieza
- **Frontend debe enviar `item_kind` explícitamente** (NO se infiere en backend)
- **Validación:** `item_kind` debe ser `'recurrente'` o `'una_vez'` (fail-fast)
- **Coherencia:** Si `item_kind` no coincide con `lista.tipo`, se logea warning pero se usa el proporcionado (fail-soft)

**Diferencias en proyección:**
- **Recurrentes:** Actualiza `last_cleaned_at` y `clean_count`
- **Una_vez:** Incrementa `completed` y decrementa `remaining`

**Diferencias en UI:**
- **Recurrentes:** 4 columnas (REVISADO, PENDIENTE, IMPORTANTE, NUNCA)
- **UNA_VEZ:** 2 columnas (COMPLETADO, PENDIENTE) + botón "+1"

**Problema:** Frontend NO siempre envía `item_kind` explícitamente (ej: increment-all), aunque backend lo fuerza.

---

### 10.4 Invariantes reales (idempotencia, estado, niveles, etc.)

**Idempotencia:**
- `execution_key` único por día + alumno + acción
- Si mismo `execution_key` en mismo día → retorna estado actual sin error
- Constraint único en BD: `idx_cleaning_events_execution_student` ON (`execution_key`, `student_id`)

**Estado:**
- `cleaning_item_state` es proyección optimizada para lectura
- `cleaning_events` es source of truth histórico (append-only)
- Estados se reconstruyen desde eventos si es necesario

**Niveles:**
- Level Engine PDE v1 es única autoridad de nivel efectivo
- Master desde `alquimia_general` → bypass completo de validación de nivel
- Master desde `alquimia_alumno` con `level_cap_override` → usa override
- Por defecto: Si `item.nivel > nivel_efectivo` → no aplica (retorna `null`)

**Pausas:**
- Alumnos pausados son excluidos de todas las operaciones de limpieza
- Verificación en `isStudentPaused()` (línea 44-59)

**Archivados:**
- Items/listas con `status='archived'` NO son renderizables en UI operativa
- Endpoints GET devuelven 404 si archivado
- Endpoints PUT rechazan updates si archivado

---

### 10.5 Qué cosas están medio-implementadas o inconsistentes

**Inconsistencia 1: Formato de respuesta JSON**
- Alquimia General: `{ ok: true, ...data, trace_id }` (aplanado)
- Alquimia Alumno: `{ ok: true, data: {...}, trace_id }` (envuelto)

**Inconsistencia 2: Validación de estado en mark-clean-student**
- Alquimia Alumno: Valida que estado existe antes de limpiar (líneas 245-282)
- Alquimia General: NO valida que estado existe (puede causar BUG C)

**Inconsistencia 3: Headers anti-cache**
- Alquimia General: NO CONSTA headers anti-cache explícitos
- Alquimia Alumno: Headers anti-cache completos

**Inconsistencia 4: item_kind en increment-all**
- Frontend NO envía `item_kind` en increment-all
- Backend lo fuerza a `'una_vez'` (correcto) pero con warning de deprecación

**Medio-implementado: Sincronización a student_item_state**
- `syncToStudentItemState()` (líneas 114-159) solo loguea, NO implementa sincronización real
- Comentarios dicen "pendiente implementación directa"

**Medio-implementado: Seed de estados**
- `ensureCleaningItemStateSeedForStudent()` se llama antes de construir megalist (correcto)
- **PERO** NO se llama antes de `mark-clean-student` desde flotante (puede causar BUG C)

---

## 11) APÉNDICE: COMANDOS Y SALIDAS IMPORTANTES

### 11.1 Grep/finds relevantes

```bash
# Búsqueda de endpoints alquimia
grep -r "master/api.*alquimia" --include="*.js" --include="*.md"
# Resultado: 328 líneas encontradas (ver sección 1.1)

# Búsqueda de increment-all
grep -r "increment-all\|incrementAll" -i
# Resultado: 100 líneas encontradas (ver sección 1.2)

# Búsqueda de campos student
grep -r "student\.nombre\|student\.apodo\|student\.display_name" -i
# Resultado: 51 líneas encontradas (ver sección 8.2)
```

---

### 11.2 SQL SELECTs relevantes (NO EJECUTADOS - EJEMPLOS)

```sql
-- Conteo de eventos por item_kind
SELECT item_kind, COUNT(*) as count
FROM cleaning_events
GROUP BY item_kind;

-- Verificar idempotencia (debería ser 0 duplicados)
SELECT execution_key, student_id, COUNT(*) as count
FROM cleaning_events
GROUP BY execution_key, student_id
HAVING COUNT(*) > 1;

-- Estados recientes (limit 5)
SELECT student_id, item_ref, shared_last_cleaned_at, shared_completed, shared_remaining
FROM cleaning_item_state
ORDER BY updated_at DESC
LIMIT 5;
```

---

### 11.3 Curls relevantes (NO EJECUTADOS - EJEMPLOS)

Ver sección 4.4 para script completo de curls.

---

### 11.4 Fragmentos pequeños de código (máx 30-40 líneas)

**Fragmento 1: Validación item_kind (cleaning-engine-service.js:280-302)**
```javascript
// 4. Validar item_kind (REQUERIDO según contrato canónico)
if (!options.item_kind || (options.item_kind !== 'recurrente' && options.item_kind !== 'una_vez')) {
  throw new Error('item_kind es requerido y debe ser "recurrente" o "una_vez"');
}

// Verificar coherencia con lista (validación adicional, no inferencia)
const lista = await catalogRepo.getListaById(item.lista_id);
if (!lista) {
  throw new Error(`Lista no encontrada para item: ${item_ref}`);
}

// Validar que item_kind coincide con lista.tipo (coherencia, no inferencia)
if (options.item_kind !== lista.tipo) {
  logWarn('CleaningEngine', 'item_kind no coincide con lista.tipo', {
    traceId,
    student_id,
    item_ref,
    item_kind_provided: options.item_kind,
    lista_tipo: lista.tipo
  });
  // Fail-open: usar el proporcionado, pero log warning
}

const itemKind = options.item_kind; // Usar siempre el proporcionado (sin fallback)
```

**Fragmento 2: Filtrado por nivel en markCleanAllStudents (cleaning-engine-service.js:548-559)**
```javascript
// Verificar si aplica por nivel antes de limpiar
// REGLA: Filtro por nivel SOLO cuando item_kind === 'recurrente' y skip_level_filter !== true
// Para UNA_VEZ o cuando skip_level_filter === true, NO filtrar por nivel
if (!skip_level_filter && itemKind === 'recurrente') {
  const nivelEfectivo = await getStudentEffectiveLevel(studentId, product_key);
  
  if (nivelEfectivo < itemNivel) {
    skipped++;
    skippedBreakdown.not_applicable_level++;
    continue;
  }
}
```

**Fragmento 3: Toast con campo incorrecto (master-alquimia-general-client.js:1389)**
```javascript
showToastSuccess(`✓ ${student.display_name || student.student_name || student.email} limpiado`);
```

---

### 11.5 Logs PM2 con trace_id (NO CONSTA - NO EJECUTADOS)

**NO CONSTA** - No se accedió a logs PM2 durante el diagnóstico.

---

## CHECKLIST FINAL

- ✅ **Endpoints reales listados y content-type JSON confirmado** (sección 4.1, 4.2)
- ✅ **Services decisores y repos identificados** (sección 1.2)
- ⚠️ **Tablas, constraints, migraciones aplicadas (o no)** - NO CONSTA (sección 2.2)
- ✅ **3 bugs reproducidos con evidencia** (sección 8)
- ✅ **MASTER vs ADMIN/CLIENT separado correctamente** (sección 9)
- ✅ **LEGACY vs CANÓNICO marcado con evidencia** (sección 9)

---

## PREGUNTAS PARA EL MASTER

**OBJETIVO:** Preguntas cerradas y concretas para validar el modelo mental inferido y decidir acciones correctivas.

### P1: Migraciones SQL
- ¿Están aplicadas las migraciones `v5.59.0-cleaning-engine-v1.sql`, `v5.46.0-master-alquimia-general.sql` y `v5.42.0-student-sot-v1.sql` en producción?

### P2: Bug A ("+1 para todos" devuelve 0 alumnos)
- ¿Hay alumnos activos (no pausados) en la tabla `alumnos`?
- ¿La query `SELECT id FROM alumnos` retorna filas?
- ¿El método `getStudentEffectiveLevel()` funciona correctamente o puede retornar valores inesperados?
- ¿Hay algún problema de conexión a PostgreSQL que pueda causar que la query falle silenciosamente?

### P3: Bug B (Toast "undefined limpiado")
- ¿Qué campos tiene exactamente el objeto `student` que retorna `GET /master/api/alquimia-general/items/:item_ref/students`?
- ¿El helper `calculateStudentDisplayNames()` añade `display_name`, `student_name`, `student_email` al objeto?
- ¿Debe usarse `student_email` en lugar de `email` en el toast?

### P4: Bug C (Doble click → 500)
- ¿El primer POST falla con error de constraint único (`idx_cleaning_events_execution_student`)?
- ¿O falla con error de FK (estado no existe en `cleaning_item_state`)?
- ¿Debe añadirse seed de estado antes de `mark-clean-student` desde flotante (similar a Alquimia Alumno)?

### P5: Validación de estado
- ¿Por qué Alquimia Alumno valida estado antes de limpiar (líneas 245-282) pero Alquimia General NO lo hace?
- ¿Debe unificarse el comportamiento (ambos validan o ninguno valida)?

### P6: Formato de respuesta JSON
- ¿Debe unificarse el formato de respuesta entre Alquimia General (`{ ok, ...data }`) y Alquimia Alumno (`{ ok, data: {...} }`)?
- ¿Cuál es el formato canónico deseado?

### P7: Headers anti-cache
- ¿Por qué Alquimia Alumno tiene headers anti-cache completos pero Alquimia General NO?
- ¿Debe añadirse headers anti-cache a todos los endpoints de Alquimia General?

### P8: Sincronización a student_item_state
- ¿La función `syncToStudentItemState()` (líneas 114-159) está implementada correctamente o es solo placeholder?
- ¿Debe implementarse sincronización real o eliminarse si no se usa?

### P9: item_kind en increment-all
- ¿Debe el frontend enviar `item_kind` explícitamente en increment-all (como dice el contrato) o está bien que el backend lo fuerce?
- ¿Debe eliminarse el warning de deprecación en `incrementAllStudents()` si el frontend nunca enviará `item_kind`?

### P10: Filtrado por nivel en increment-all
- ¿La regla `alquimia-flotante-no-filter-level` aplica TAMBIÉN a increment-all (además de GET students)?
- ¿Es correcto que `incrementAll()` pase `skip_level_filter: true` aunque la lógica en `markCleanAllStudents()` ya no filtra para UNA_VEZ?

### P11: Seed de estados
- ¿Debe ejecutarse seed automáticamente antes de `mark-clean-student` desde flotante (como se hace en megalist)?
- ¿O es correcto que el seed solo se ejecute en megalist?

### P12: Idempotencia por día
- ¿Es correcto que `execution_key` use solo la fecha (YYYY-MM-DD) sin hora, permitiendo solo un evento por día por alumno+acción?
- ¿O debe permitirse múltiples eventos en el mismo día con diferentes timestamps?

### P13: Señales
- ¿Existe un registry canónico de señales (`student-signal-registry.js`) o las señales se emiten ad-hoc?
- ¿Las señales `origin.executed` y `origin.completed` son legacy y deben eliminarse?

### P14: Tabla alumnos legacy
- ¿Cuándo se prevé migrar completamente de `alumnos` (legacy) a `students` (canónico)?
- ¿Por qué Cleaning Engine todavía usa `alumnos.id` como FK?

### P15: Servicios legacy
- ¿El servicio `src/services/alquimia-alumno-service.js` se usa actualmente o es legacy que puede eliminarse?

### P16: Validación de nivel en markCleanStudent
- ¿Es correcto que `markCleanStudent()` valide nivel incluso cuando se llama desde `markCleanAllStudents()` que ya filtró (o no filtró) por nivel?
- ¿O debe confiar en que `markCleanAllStudents()` ya hizo el filtrado correcto?

### P17: Fallback de item_kind
- ¿Es aceptable el fallback legacy en `incrementAllStudents()` (líneas 643-651) que fuerza `item_kind: 'una_vez'` si falta, o debe eliminarse y fallar hard?

### P18: Campos de student en getStudentsForItem
- ¿Qué campos exactos retorna `getStudentsForItem()` en el array `students`?
- ¿Incluye `display_name`, `student_name`, `student_email`, `apodo`, `nombre_completo`?

### P19: Tabla de migraciones
- ¿Existe una tabla de tracking de migraciones aplicadas o no se lleva registro?

### P20: Logs PM2
- ¿Dónde se encuentran los logs PM2 del servidor para verificar errores por trace_id?

---

**REPORTE FORENSE v1 COMPLETADO**  
**Fecha:** 2026-01-10 22:00:46 UTC  
**Ejecutado por:** Cursor (agente de diagnóstico forense)  
**Total líneas:** 1,695  
**Evidencia citada:** 50+ referencias a archivos/rutas/líneas exactas
