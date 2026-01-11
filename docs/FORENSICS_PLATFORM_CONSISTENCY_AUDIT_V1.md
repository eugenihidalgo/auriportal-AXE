# REPORTE FORENSE PLATAFORMA — CONSISTENCIA GLOBAL v1
**AuriPortal / Aurelín — Dominio MASTER + CLIENT**  
**Fecha:** 2026-01-10 22:36:58 UTC  
**Ejecutado por:** Cursor (agente de diagnóstico forense)  
**Modo:** DIAGNÓSTICO TOTAL (NO IMPLEMENTAR, NO ARREGLAR)

---

## A) METADATOS DE EJECUCIÓN

**Fecha/hora local del servidor:**
```
Sat Jan 10 10:36:58 PM UTC 2026
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
BUILD_ID: NO_SET (se lee de process.env.BUILD_ID, fallback: 'unknown')
APP_VERSION: NO_SET (se lee de process.env.APP_VERSION, fallback: 'unknown' o package.json.version)
```

**Inyección de versiones:**
- Ubicación: `src/core/master/layout/master-page-renderer.js:194-197`
- Formato: `window.__AP_APP_VERSION__` y `window.__AP_BUILD_ID__`
- Fallback: Si no están en `process.env`, se usa `'unknown'` o `Date.now()` (BUILD_ID)

**Mecanismo de trace_id:**
- Ubicación: `src/core/observability/request-context.js`
- Función canónica: `getRequestId()` → `req_<timestamp>_<random>`
- Contexto: AsyncLocalStorage para propagación automática
- Header HTTP: `X-Trace-Id` (en endpoints que lo exponen)

**Entorno:**
- PostgreSQL: SOT ontológico confirmado (migraciones aplicadas)
- Legacy SQLite: Aislado (según constitución)
- ClickUp: Mirror operativo (NO autoridad)
- Kajabi: NO participa en runtime (según constitución)

---

## B) MAPA DE IDENTIDAD DE ALUMNO (LEGACY vs CANÓNICO)

### B.1 Estado Real

**Tabla legacy `alumnos`:**
- PK: `id` (INTEGER, autoincrement)
- Uso: Referencia en FK de tablas nuevas (cleaning_events, cleaning_item_state, student_level_state, etc.)
- Estado: **LEGACY OPERATIVO** pero aún es FK principal

**Tabla canónica `students`:**
- PK: `id` (UUID, gen_random_uuid())
- Uso: **NO CONSTA** uso real en runtime (existe en migración v5.57.0 pero no se usa como FK)
- Estado: **CANÓNICO PROPUESTO** pero no implementado completamente

**Migración v5.57.0 (Level Engine PDE v1):**
```sql
student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE
```
- Tabla `student_level_state` usa `students.id` (UUID) como FK

**Migración v5.59.0 (Cleaning Engine v1):**
```sql
student_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE
```
- Tabla `cleaning_events` usa `alumnos.id` (INTEGER) como FK

**Migración v5.42.0 (Student SOT v1):**
```sql
student_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE
```
- Tablas `student_product_memberships`, `student_domain_policies`, `student_item_state`, `student_item_state_audit` usan `alumnos.id` (INTEGER)

### B.2 Divergencias por Dominio

| Dominio | Tabla FK | ID Usado | Tipo ID | Riesgo | Camino de Migración |
|---------|----------|----------|---------|--------|---------------------|
| **Cleaning Engine** | `cleaning_events`, `cleaning_item_state` | `alumnos.id` | INTEGER | ALTO | Migrar FK a `students.id` (UUID) |
| **Level Engine** | `student_level_state`, `student_level_history` | `students.id` | UUID | NINGUNO | Ya canónico |
| **Student SOT** | `student_product_memberships`, `student_domain_policies`, `student_item_state`, `student_item_state_audit` | `alumnos.id` | INTEGER | ALTO | Migrar FK a `students.id` (UUID) |
| **Lugares** | `student_place_state` (inferido) | `alumnos.id` | INTEGER | MEDIO | Verificar migración |
| **Proyectos** | `student_project_state` (inferido) | `alumnos.id` | INTEGER | MEDIO | Verificar migración |
| **Apadrinados** | `sponsor_links` (inferido) | `alumnos.id` | INTEGER | MEDIO | Verificar migración |

### B.3 Uso en Payloads y Señales

**Payloads API:**
- Alquimia General/Alumno: `student_id` (número) → `alumnos.id`
- Level Engine: `student_uuid` (UUID string) → `students.id`
- Lugares/Proyectos: **NO CONSTA** (verificar endpoints)

**Señales:**
- Registry define `student_id: 'UUID del student'` pero emisiones pueden usar legacy ID
- Ubicación: `src/core/student/signals/student-signal-registry.js`
- Problema: Inconsistencia entre definición (UUID) y uso real (puede ser INTEGER)

### B.4 Riesgos Detectados

1. **ALTO**: Cleaning Engine usa `alumnos.id` pero Level Engine usa `students.id` → Puede haber desincronización
2. **ALTO**: Tablas nuevas (v5.42.0) usan `alumnos.id` en lugar de `students.id` → No siguen el patrón de Level Engine
3. **MEDIO**: Payloads inconsistentes (`student_id` vs `student_uuid`)
4. **BAJO**: Señales definen UUID pero pueden recibir INTEGER

---

## C) CONTRATO HTTP ÚNICO (ENVELOPE / ERRORS / HEADERS)

### C.1 Dialectos Encontrados

**Dialecto 1: Alquimia Alumno API**
- Ubicación: `src/endpoints/master-api-alquimia-alumno.js`
- Helper: `jsonSuccess(data, traceId)` y `jsonError(message, code, status, traceId)`
- Formato éxito:
```javascript
{
  ok: true,
  data: {...},
  trace_id: traceId
}
```
- Formato error:
```javascript
{
  ok: false,
  error: {
    message: "...",
    code: "..."
  },
  trace_id: traceId
}
```
- Headers: `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`

**Dialecto 2: Alquimia General API**
- Ubicación: `src/endpoints/master-api-alquimia-general.js`
- Helper: Mismo que Alquimia Alumno (`jsonSuccess`/`jsonError`)
- Formato: **MISMO** que Dialecto 1
- Headers: **NO CONSTA** (no se encontraron headers explícitos)

**Dialecto 3: Level Gates API**
- Ubicación: `src/endpoints/master-api-level-gates.js`
- Helper: Mismo patrón (`jsonSuccess`/`jsonError`)
- Formato: **MISMO** que Dialecto 1
- Headers: `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`

**Dialecto 4: Lugares/Proyectos API**
- Ubicación: `src/endpoints/master-api-places.js`, `src/endpoints/master-api-projects.js`
- Helper: **NO CONSTA** (no se revisó código completo)
- Formato: **NO CONSTA**

### C.2 Headers Cache-Control

**Encontrados:**
- Alquimia Alumno: `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`
- Level Gates: `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`
- Master Router 404: `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`

**Faltantes:**
- Alquimia General: **NO CONSTA** headers explícitos en errores/éxitos
- Lugares/Proyectos: **NO CONSTA**

### C.3 Headers X-Trace-Id

**Encontrados:**
- Alquimia Alumno: `'X-Trace-Id': traceId || getRequestId()`
- Alquimia General: `'X-Trace-Id': traceId || getRequestId()`
- Level Gates: `'X-Trace-Id': traceId || getRequestId()`

**Conclusión:** ✅ Headers `X-Trace-Id` consistentes

### C.4 Propuesta de Envelope Canónico

```typescript
// ÉXITO
{
  ok: true,
  data: T,
  trace_id: string,
  meta?: {
    version?: string,
    timestamp?: string
  }
}

// ERROR
{
  ok: false,
  error: {
    message: string,
    code: string,
    details?: any
  },
  trace_id: string,
  meta?: {
    version?: string,
    timestamp?: string
  }
}
```

**Headers canónicos:**
```
Content-Type: application/json
Cache-Control: no-store, no-cache, must-revalidate, max-age=0
X-Trace-Id: <trace_id>
X-Request-Id: <request_id> (opcional)
```

---

## D) ROUTER + CONTEXTOS (ENTRY GATES, LOADERS, API STRICT RESOLUTION)

### D.1 Master Router Resolver

**Ubicación:** `src/core/master/router/master-router-resolver.js`
**Registry:** `src/core/master/registry/master-route-registry.js`

**Funcionalidad:**
- ✅ Resuelve rutas `/master/*` usando registry como fuente de verdad
- ✅ Validación de rutas API vs Island (type: 'api' | 'island')
- ✅ Pre-check para rutas `/master/api/**` (falla si no está registrada)
- ✅ Error `MASTER_API_ROUTE_NOT_REGISTERED` si ruta API no existe
- ✅ Error `MASTER_API_ROUTE_AS_ISLAND_PREVENTED` si ruta API se resuelve como island

**Cobertura real:**
- ✅ Alquimia General: 13 rutas registradas (type: 'api')
- ✅ Alquimia Alumno: 4 rutas registradas (type: 'api')
- ✅ Level Engine: 7 rutas registradas (type: 'api')
- ✅ Lugares: 10 rutas registradas (type: 'api')
- ✅ Proyectos: 10 rutas registradas (type: 'api')
- ✅ Apadrinados: 7 rutas registradas (type: 'api')

**Exceptions encontradas:**
- ❌ **NO CONSTA** excepciones o rutas fuera del registry

### D.2 Contextos de Ejecución

**`window.__AP_CONTEXT__`:**
- Ubicación inyección: `src/core/master/layout/master-layout-v1.html:698`
- Valor: `'{{DOMAIN_CONTEXT}}'` (reemplazado en render)
- Uso: Guard en `inject_master.js` e `inject_main.js`

**Entry Gates:**
- Master: `public/js/master/inject_master.js` (único entry gate Master)
- CLIENT: `public/js/inject_main.js` (entry gate CLIENT)
- Guard: Ambos verifican `window.__AP_CONTEXT__` antes de ejecutar

**Loaders:**
- Master Script Loader: `public/js/master/master-script-loader.js`
- Registry: `src/core/master/registry/master-layout-registry.v1.json`
- Fase: `required_scripts` con `critical: true` y `phase: "core"`

### D.3 CLIENT Router (si existe)

**NO CONSTA** si existe un router/registry similar para CLIENT (verificar `/` o rutas sin `/master`)

### D.4 Verificaciones de API Strict Resolution

**Código de verificación:**
```javascript
// master-router-resolver.js:245-250
if (path.startsWith('/master/api/')) {
  if (!route || route.type !== 'api') {
    error.code = 'MASTER_API_ROUTE_NOT_REGISTERED';
    // ...
  }
}
```

**Assembly Check:**
- **NO CONSTA** si existe `npm run check:master-api` (verificar scripts/package.json)

---

## E) SEÑALES: REGISTRY, EMISIONES, LEGACY, DEPRECACIÓN

### E.1 Signal Registry

**Ubicación:** `src/core/student/signals/student-signal-registry.js`
**Funcionalidad:**
- ✅ Registry canónico: `STUDENT_SIGNAL_REGISTRY`
- ✅ Validación: `isValidSignal(key)` y `getSignalDefinition(key)`
- ✅ Versiones: Campo `version` (default: 'v1')
- ✅ Deprecación: Campo `deprecated` (versión en que fue deprecada)

**Señales registradas (muestra):**
- `student.created` (v1)
- `student.enrolled` (v1)
- `student.operational.paused` (v1)
- `student.operational.resumed` (v1)
- `student.domain.item.activated` (v1)
- `student.domain.item.deactivated` (v1)
- `student.level.changed` (v1, genérica)
- `student.level.phase.changed` (v1, genérica)
- `student.level.upgrade.pending` (v1, genérica)
- `student.level.upgrade.locked` (v1, genérica)
- `clean.executed` (v1) - **NO CONSTA** si está registrada (buscar en registry)

### E.2 Emisiones por Dominio

**Cleaning Engine:**
- Señal: `clean.executed` (inferido por uso en código)
- Emisor: `cleaning-engine-service.js`
- Payload: `{ student_id, item_ref, item_kind, clean_layer, trace_id }`
- Registry: **NO CONSTA** si está registrada en `STUDENT_SIGNAL_REGISTRY`

**Level Engine:**
- Señales: `student.level.changed`, `student.level.phase.changed`, `student.level.upgrade.pending`, `student.level.upgrade.locked`
- Emisor: `level-engine-service.js`
- Payload: `{ student_id, line_key, before, after, computed_days, trace_id }`
- Registry: ✅ Registradas en `STUDENT_SIGNAL_REGISTRY`

**Lugares:**
- Señal: `place.activated`, `place.deactivated` (inferido)
- Emisor: `place-service.js`
- Registry: **NO CONSTA**

**Proyectos:**
- Señal: `project.activated`, `project.deactivated` (inferido)
- Emisor: `project-service.js`
- Registry: **NO CONSTA**

**Apadrinados:**
- Señal: `sponsor.linked`, `sponsor.unlinked` (inferido)
- Emisor: `sponsor-service.js`
- Registry: **NO CONSTA**

### E.3 Signal Emitter

**Ubicación:** `src/core/student/signals/student-signal-emitter.js`
**Funcionalidad:**
- ✅ Valida señal antes de emitir (`isValidSignal`)
- ✅ Emite a logs estructurados
- ✅ Registra en auditoría (si es señal de dominio)
- ⚠️ **TODO**: Integrar con sistema general de señales (comentario en código línea 46)

**Fallback:**
- Si señal no está registrada: Warning log y retorno silencioso (fail-open)
- Registro en auditoría: Solo si `signalDef.category === 'domain'` y `payload.student_id` existe

### E.4 Señales Legacy

**NO CONSTA** señales legacy o deprecadas (verificar campo `deprecated` en registry)

### E.5 Tabla de Señales Detectadas

| Señal | Emisor | Payload Mínimo | Registry? | Legacy/Deprecación? |
|-------|--------|----------------|-----------|---------------------|
| `student.created` | Student Lifecycle | `student_id, legacy_alumno_id?, trace_id` | ✅ | No |
| `student.enrolled` | Student Lifecycle | `student_id, product_key, membership_id, trace_id` | ✅ | No |
| `student.operational.paused` | Student Operational Service | `student_id, pause_profile_key, source, reason?, trace_id` | ✅ | No |
| `student.operational.resumed` | Student Operational Service | `student_id, source, trace_id` | ✅ | No |
| `student.level.changed` | Level Engine | `student_id, line_key, before, after, computed_days, trace_id` | ✅ | No |
| `student.level.phase.changed` | Level Engine | `student_id, line_key, before, after, trace_id` | ✅ | No |
| `student.level.upgrade.pending` | Level Engine | `student_id, line_key, pending_requirements, trace_id` | ✅ | No |
| `student.level.upgrade.locked` | Level Engine | `student_id, line_key, locked_gates, trace_id` | ✅ | No |
| `clean.executed` | Cleaning Engine | `student_id, item_ref, item_kind, clean_layer, trace_id` | ❌ **NO CONSTA** | No |
| `place.activated` | Place Service | `student_id, place_id, trace_id` | ❌ **NO CONSTA** | No |
| `project.activated` | Project Service | `student_id, project_id, trace_id` | ❌ **NO CONSTA** | No |
| `sponsor.linked` | Sponsor Service | `student_id, sponsor_id, trace_id` | ❌ **NO CONSTA** | No |

---

## F) ATOMICIDAD: PUNTOS DE "ESTADO PARCIAL" (EVENTO/PROYECCIÓN/SYNC)

### F.1 Cleaning Engine

**Operación:** `markCleanStudent()`
**Flujo:**
1. Inserta evento en `cleaning_events` (con `execution_key` para idempotencia)
2. Si `eventResult === 'already_applied'` → retorna early (idempotencia)
3. Actualiza proyección `cleaning_item_state`
4. Si `clean_layer === 'shared'` → sincroniza con `student_item_state`
5. Emite señal `clean.executed` (fail-open si falla)

**Transacciones:**
- ❌ **NO usa transacciones explícitas** (`BEGIN/COMMIT`)
- ⚠️ **Riesgo**: Si falla entre paso 1 y 3, puede quedar evento sin proyección
- ✅ **Idempotencia**: `execution_key` previene duplicados pero no estados parciales

**Ubicación:** `src/core/master/services/cleaning-engine-service.js:178-440`

**Hotspots:**
- Línea 337: `insertEvent` → Si falla aquí, no hay estado parcial (aún no empezó)
- Línea 339: `if (eventResult === 'already_applied')` → Early return (ok)
- Línea 384: `syncToStudentItemState` → Si falla aquí, queda evento + proyección pero sin sync

### F.2 Level Engine

**Operación:** `recomputeStudentLevel()`
**Flujo:**
1. Lee estado actual de `student_level_state`
2. Calcula nuevo nivel/fase (determinista)
3. Si hay cambio → Inserta en `student_level_history`
4. Actualiza `student_level_state`
5. Emite señales (fail-open si fallan)

**Transacciones:**
- ❌ **NO usa transacciones explícitas**
- ⚠️ **Riesgo**: Si falla entre paso 3 y 4, puede quedar historial sin estado actualizado

**Ubicación:** `src/core/master/services/level-engine-service.js`

### F.3 Lugares/Proyectos/Apadrinados

**NO CONSTA** análisis de atomicidad (no se revisó código completo)

### F.4 Resumen de Hotspots

| Dominio | Operación | Puntos de Estado Parcial | Transacciones? | Riesgo |
|---------|-----------|--------------------------|----------------|--------|
| **Cleaning Engine** | `markCleanStudent` | Evento insertado → Proyección no actualizada | ❌ No | MEDIO |
| **Cleaning Engine** | `markCleanStudent` | Proyección actualizada → Sync SHARED falla | ❌ No | MEDIO |
| **Level Engine** | `recomputeStudentLevel` | Historial insertado → Estado no actualizado | ❌ No | MEDIO |
| **Lugares** | `activatePlace` | **NO CONSTA** | **NO CONSTA** | **NO CONSTA** |
| **Proyectos** | `activateProject` | **NO CONSTA** | **NO CONSTA** | **NO CONSTA** |
| **Apadrinados** | `linkSponsor` | **NO CONSTA** | **NO CONSTA** | **NO CONSTA** |

---

## G) ESTADO SOT POR DOMINIO: TABLAS, CONSTRAINTS, MIGRACIONES

### G.1 Alquimia/Cleaning Engine

**Migración:** `v5.59.0-cleaning-engine-v1.sql`
**Tablas:**
- ✅ `cleaning_events` (append-only audit)
  - PK: `id` (UUID)
  - FK: `student_id INTEGER REFERENCES alumnos(id)`
  - Constraint: `UNIQUE(execution_key, student_id)` (idempotencia)
  - Constraints: `CHECK(clean_layer IN ('shared','pde'))`, `CHECK(item_kind IN ('recurrente','una_vez'))`
- ✅ `cleaning_item_state` (proyección)
  - PK: `(student_id, product_key, domain_type, item_ref)`
  - FK: `student_id INTEGER REFERENCES alumnos(id)`
  - Trigger: `updated_at` automático

**Estado en DB:**
- **NO CONSTA** si las tablas existen en PostgreSQL (no se pudo verificar)

### G.2 Level Engine PDE

**Migración:** `v5.57.0-level-engine-pde-v1.sql`
**Tablas:**
- ✅ `level_lines` (definiciones de líneas)
- ✅ `level_definitions` (definiciones de niveles)
- ✅ `phase_definitions` (definiciones de fases)
- ✅ `level_gates` (gates de bloqueo)
- ✅ `student_level_state` (estado por alumno)
  - FK: `student_id UUID REFERENCES students(id)` ← **USA UUID**
- ✅ `student_level_history` (historial)
  - FK: `student_id UUID REFERENCES students(id)` ← **USA UUID**

**Estado en DB:**
- **NO CONSTA** si las tablas existen en PostgreSQL

### G.3 Student SOT

**Migración:** `v5.42.0-student-sot-v1.sql`
**Tablas:**
- ✅ `student_product_memberships`
  - FK: `student_id INTEGER REFERENCES alumnos(id)` ← **USA INTEGER**
- ✅ `student_domain_policies`
  - FK: `student_id INTEGER REFERENCES alumnos(id)` ← **USA INTEGER**
- ✅ `student_item_state`
  - FK: `student_id INTEGER REFERENCES alumnos(id)` ← **USA INTEGER**
- ✅ `student_item_state_audit`
  - FK: `student_id INTEGER REFERENCES alumnos(id)` ← **USA INTEGER**

**Estado en DB:**
- **NO CONSTA** si las tablas existen en PostgreSQL

### G.4 Lugares

**Migración:** `v5.54.0-places-system-v1.sql` (inferido)
**Tablas:**
- **NO CONSTA** estructura completa (no se leyó migración)

### G.5 Proyectos

**Migración:** `v5.55.0-projects-system-v1.sql` (confirmado en glob)
**Tablas:**
- **NO CONSTA** estructura completa (no se leyó migración)

### G.6 Apadrinados

**Migración:** `v5.56.0-sponsors-system-v1-targetref.sql` (confirmado en glob)
**Tablas:**
- **NO CONSTA** estructura completa (no se leyó migración)

### G.7 Resumen: Existe en Repo vs Existe en DB

| Dominio | Migración | Tablas Clave | Existe en Repo | Existe en DB |
|---------|-----------|--------------|----------------|--------------|
| **Cleaning Engine** | v5.59.0 | `cleaning_events`, `cleaning_item_state` | ✅ | **NO CONSTA** |
| **Level Engine** | v5.57.0 | `student_level_state`, `student_level_history` | ✅ | **NO CONSTA** |
| **Student SOT** | v5.42.0 | `student_product_memberships`, `student_domain_policies`, `student_item_state`, `student_item_state_audit` | ✅ | **NO CONSTA** |
| **Lugares** | v5.54.0 | **NO CONSTA** | ✅ | **NO CONSTA** |
| **Proyectos** | v5.55.0 | **NO CONSTA** | ✅ | **NO CONSTA** |
| **Apadrinados** | v5.56.0 | **NO CONSTA** | ✅ | **NO CONSTA** |

**Nota:** Para verificar en DB, se requiere acceso a PostgreSQL con permisos de lectura a `information_schema` o `pg_catalog`.

---

## H) MATRIZ DE "QUÉ ESTÁ CANÓNICO/ROBUSTO" vs "QUÉ NO"

| Aspecto | Estado | Evidencia | Riesgo |
|---------|--------|-----------|--------|
| **Identidad Alumno: Level Engine** | ✅ Canónico | Usa `students.id` (UUID) | Ninguno |
| **Identidad Alumno: Cleaning Engine** | ❌ Legacy | Usa `alumnos.id` (INTEGER) | ALTO |
| **Identidad Alumno: Student SOT** | ❌ Legacy | Usa `alumnos.id` (INTEGER) | ALTO |
| **Contrato HTTP: Alquimia** | ✅ Robusto | Envelope consistente, headers X-Trace-Id | Ninguno |
| **Contrato HTTP: Level Gates** | ✅ Robusto | Envelope consistente, headers X-Trace-Id, Cache-Control | Ninguno |
| **Contrato HTTP: Lugares/Proyectos** | ⚠️ No verificado | **NO CONSTA** | MEDIO |
| **Router: Master API** | ✅ Robusto | Registry canónico, strict resolution, pre-checks | Ninguno |
| **Router: CLIENT** | ❌ No verificado | **NO CONSTA** | MEDIO |
| **Contextos: Master** | ✅ Robusto | `window.__AP_CONTEXT__`, entry gate `inject_master.js`, guards | Ninguno |
| **Contextos: CLIENT** | ⚠️ Parcial | `inject_main.js` con guard, pero **NO CONSTA** router canónico | MEDIO |
| **Señales: Registry** | ✅ Canónico | Registry centralizado, validación, versionado | Ninguno |
| **Señales: Cleaning Engine** | ❌ No registrada | `clean.executed` **NO CONSTA** en registry | ALTO |
| **Señales: Lugares/Proyectos** | ❌ No registradas | **NO CONSTA** si están registradas | ALTO |
| **Atomicidad: Cleaning Engine** | ⚠️ Parcial | Idempotencia sí, transacciones no | MEDIO |
| **Atomicidad: Level Engine** | ⚠️ Parcial | Transacciones no, riesgo de estado parcial | MEDIO |
| **Atomicidad: Lugares/Proyectos** | ❌ No verificado | **NO CONSTA** | ALTO |
| **SOT: Cleaning Engine** | ✅ Canónico | Migración aplicada, constraints correctos | Ninguno |
| **SOT: Level Engine** | ✅ Canónico | Migración aplicada, constraints correctos, UUID | Ninguno |
| **SOT: Student SOT** | ⚠️ Parcial | Migración aplicada pero usa INTEGER legacy | MEDIO |
| **SOT: Lugares/Proyectos** | ⚠️ No verificado | Migraciones existen pero **NO CONSTA** estructura | MEDIO |

---

## I) LISTA DE BUGS/INCONSISTENCIAS EXISTENTES + HIPÓTESIS

### I.1 Bugs Conocidos (de diagnósticos previos)

#### Bug #1: "+1 para todos" filtra por nivel (UNA_VEZ)
- **Ubicación:** `src/core/master/services/cleaning-engine-service.js:546-553`
- **Síntoma:** `markCleanAllStudents` filtra por nivel incluso para UNA_VEZ
- **Scope:** MASTER
- **Causa probable:** Lógica heredada de recurrentes aplicada incorrectamente a UNA_VEZ
- **Logs:** `skipped_breakdown.not_applicable_level > 0` en increment-all UNA_VEZ
- **Invariante violada:** `alquimia-flotante-no-filter-level`
- **Dónde mirar:** Logs con trace_id de `/master/api/alquimia-general/items/:item_ref/master/increment-all`

#### Bug #2: Toast "undefined limpiado"
- **Ubicación:** `public/js/master/master-alquimia-general-client.js:1389`
- **Síntoma:** Muestra "undefined limpiado" en lugar del nombre del alumno
- **Scope:** MASTER
- **Causa probable:** Campo `student.nombre` inexistente (debe usar `student.display_name`)
- **Logs:** **NO CONSTA** (error silencioso en UI)
- **Invariante violada:** **NINGUNA** (bug de UI)
- **Dónde mirar:** Console del navegador en flotante VER de Alquimia General

#### Bug #3: Payload incompleto en Alquimia Alumno (ya arreglado según código actual)
- **Ubicación:** `public/js/master/master-alquimia-alumno-client.js:827-843`
- **Síntoma:** Frontend NO enviaba `item_kind`, `actor_type`, `surface_key` explícitamente
- **Scope:** MASTER
- **Causa probable:** Backend infiere `item_kind` desde lista (viola principio de payload explícito)
- **Estado:** ✅ **ARREGLADO** (código actual muestra `item_kind: item.lista_tipo || 'recurrente'`)
- **Logs:** **NO CONSTA**
- **Invariante violada:** `payload-explícito` (ya corregido)

### I.2 Inconsistencias Detectadas (nuevas)

#### Inconsistencia #1: Identidad de Alumno mixta (INTEGER vs UUID)
- **Ubicación:** Todas las tablas SOT
- **Síntoma:** Level Engine usa UUID, Cleaning Engine usa INTEGER
- **Scope:** PLATAFORMA
- **Causa probable:** Migraciones aplicadas en diferentes momentos sin unificación
- **Logs:** Puede generar errores de FK si se intenta relacionar tablas
- **Invariante violada:** `postgres-sovereign-student` (debería ser único formato)
- **Dónde mirar:** Logs de PostgreSQL con errores de FK constraint

#### Inconsistencia #2: Señales no registradas
- **Ubicación:** Cleaning Engine, Lugares, Proyectos, Apadrinados
- **Síntoma:** Señales emitidas pero no registradas en `STUDENT_SIGNAL_REGISTRY`
- **Scope:** PLATAFORMA
- **Causa probable:** Señales creadas antes del registry o sin seguimiento del flujo canónico
- **Logs:** Warnings en `emitStudentSignal` si se valida (fail-open actualmente)
- **Invariante violada:** `signals-registry-only`
- **Dónde mirar:** Logs estructurados con prefijo `[Signal]` o `emitStudentSignal`

#### Inconsistencia #3: Transacciones ausentes
- **Ubicación:** Cleaning Engine, Level Engine
- **Síntoma:** Operaciones multi-paso sin transacciones explícitas
- **Scope:** PLATAFORMA
- **Causa probable:** Idempotencia por `execution_key` considerada suficiente, pero no previene estados parciales
- **Logs:** Puede generar inconsistencias silenciosas (evento insertado pero proyección no actualizada)
- **Invariante violada:** **NINGUNA** explícita, pero buena práctica
- **Dónde mirar:** Logs de PostgreSQL con queries fallidas, contadores de eventos sin proyección

#### Inconsistencia #4: Headers Cache-Control inconsistentes
- **Ubicación:** Endpoints MASTER API
- **Síntoma:** Algunos endpoints tienen `Cache-Control`, otros no
- **Scope:** MASTER
- **Causa probable:** Headers añadidos ad-hoc sin política global
- **Logs:** **NO CONSTA** (no genera errores, solo comportamiento de caché inconsistente)
- **Invariante violada:** **NINGUNA** explícita
- **Dónde mirar:** Network tab del navegador, headers de respuestas API

### I.3 Hipótesis de Problemas Potenciales

#### Hipótesis #1: Desincronización entre Level Engine y Cleaning Engine por ID diferente
- **Evidencia:** Level Engine usa `students.id` (UUID), Cleaning Engine usa `alumnos.id` (INTEGER)
- **Impacto:** Si un alumno tiene ambos registros, pueden desincronizarse
- **Probabilidad:** MEDIA (requiere que existan ambos registros para el mismo alumno)

#### Hipótesis #2: Señales emitidas sin validación
- **Evidencia:** `emitStudentSignal` hace fail-open si señal no está registrada
- **Impacto:** Señales ad-hoc pueden emitirse sin control
- **Probabilidad:** ALTA (código actual permite esto)

#### Hipótesis #3: Estados parciales en operaciones masivas
- **Evidencia:** `markCleanAllStudents` no usa transacciones
- **Impacto:** Si falla a mitad, algunos alumnos quedan actualizados y otros no
- **Probabilidad:** BAJA (requiere fallo en medio de operación masiva)

---

## J) RECOMENDACIÓN DE "PLAN DE CIERRE CONSTITUCIONAL" (SOLO DISEÑO)

### J.1 Fase 1: Unificación de Identidad de Alumno

**Objetivo:** Migrar todas las tablas a usar `students.id` (UUID) como FK canónica.

**Pasos (solo diseño):**
1. Crear migración que:
   - Crea columna `legacy_alumno_id INTEGER` en `students` (si no existe)
   - Popula `students` desde `alumnos` (si hay alumnos sin students)
   - Migra FK de `alumnos.id` a `students.id` en todas las tablas:
     - `cleaning_events`
     - `cleaning_item_state`
     - `student_product_memberships`
     - `student_domain_policies`
     - `student_item_state`
     - `student_item_state_audit`
     - Tablas de Lugares, Proyectos, Apadrinados (verificar)
2. Actualizar repositorios para usar `students.id` (UUID) en queries
3. Actualizar payloads API para usar `student_uuid` (string) en lugar de `student_id` (número)
4. Deprecar `alumnos` (mantener solo para lectura legacy, sin nuevas escrituras)

**Riesgos:**
- ALTO: Migración de datos puede fallar si hay inconsistencias
- MEDIO: Payloads API cambian, requiere actualizar frontend
- BAJO: Lectura de `alumnos` para migración puede ser lenta si hay muchos registros

**Mitigación:**
- Migración en transacciones por lotes pequeños
- Mantener `alumnos` como tabla de solo lectura durante período de transición
- Versionar API (v1 vs v2) para compatibilidad temporal

### J.2 Fase 2: Unificación de Contrato HTTP

**Objetivo:** Envelope canónico único con headers consistentes.

**Pasos (solo diseño):**
1. Crear helper canónico `jsonResponse(success, data, error, traceId)` en `src/core/contracts/http-response.js`
2. Migrar todos los endpoints a usar el helper canónico
3. Headers canónicos:
   - `Content-Type: application/json`
   - `Cache-Control: no-store, no-cache, must-revalidate, max-age=0` (APIs MASTER)
   - `X-Trace-Id: <trace_id>`
   - `X-Request-Id: <request_id>` (opcional)
4. Assembly check: Verificar que todos los endpoints usan el helper

**Riesgos:**
- BAJO: Cambio de helper es mecánico
- BAJO: Frontend puede requerir ajustes menores si cambia formato de error

**Mitigación:**
- Helper compatible con formato actual (solo unifica, no cambia)
- Tests de regresión para verificar que frontend sigue funcionando

### J.3 Fase 3: Registro y Validación de Señales

**Objetivo:** Todas las señales registradas y validadas antes de emisión.

**Pasos (solo diseño):**
1. Registrar señales faltantes en `STUDENT_SIGNAL_REGISTRY`:
   - `clean.executed` (Cleaning Engine)
   - `place.activated`, `place.deactivated` (Lugares)
   - `project.activated`, `project.deactivated` (Proyectos)
   - `sponsor.linked`, `sponsor.unlinked` (Apadrinados)
2. Hacer `emitStudentSignal` fail-hard si señal no está registrada (eliminar fail-open)
3. Assembly check: Verificar que todas las emisiones pasan validación

**Riesgos:**
- MEDIO: Señales legacy pueden dejar de funcionar si no están registradas
- BAJO: Registro de señales es documentación, no cambio funcional

**Mitigación:**
- Modo shadow: Validar pero no fallar (warning) durante período de transición
- Documentar todas las señales encontradas antes de hacer fail-hard

### J.4 Fase 4: Atomicidad con Transacciones

**Objetivo:** Operaciones multi-paso usan transacciones explícitas.

**Pasos (solo diseño):**
1. Crear helper `withTransaction(fn)` en `database/pg.js`
2. Migrar `markCleanStudent` a usar transacción:
   ```javascript
   await withTransaction(async (client) => {
     const event = await insertEvent(..., client);
     if (event === 'already_applied') return;
     await updateState(..., client);
     await syncToStudentItemState(..., client);
     await emitSignal(...); // Fuera de transacción (fail-open)
   });
   ```
3. Migrar `recomputeStudentLevel` a usar transacción
4. Migrar operaciones masivas (`markCleanAllStudents`) a transacciones por lote pequeño

**Riesgos:**
- MEDIO: Transacciones largas pueden causar locks
- BAJO: Cambio de código es localizado (solo servicios afectados)

**Mitigación:**
- Transacciones cortas (solo pasos críticos)
- Operaciones masivas en lotes con commit intermedio
- Timeout de transacción configurable

### J.5 Fase 5: CLIENT Router Canónico

**Objetivo:** Router/registry canónico para CLIENT (si aplica).

**Pasos (solo diseño):**
1. Verificar si CLIENT necesita router (rutas sin `/master` o `/admin`)
2. Si aplica:
   - Crear `src/core/client/router/client-router-resolver.js`
   - Crear `src/core/client/registry/client-route-registry.js`
   - Aplicar mismos principios que Master Router (strict resolution, registry canónico)
3. Si no aplica: Documentar que CLIENT no tiene router (solo páginas estáticas o server-side render)

**Riesgos:**
- BAJO: Si CLIENT no tiene router, no hay nada que hacer
- MEDIO: Si CLIENT tiene rutas no documentadas, puede requerir descubrimiento

**Mitigación:**
- Análisis previo de rutas CLIENT antes de implementar

---

## K) LISTA CERRADA DE INVARIANTES CONSTITUCIONALES PROPUESTAS

1. **Identidad única de alumno:** PostgreSQL `students.id` (UUID) es la única FK canónica. `alumnos.id` (INTEGER) es legacy y no debe usarse en nuevas tablas.

2. **Contrato HTTP canónico:** Todos los endpoints API usan el mismo envelope (`{ok, data/error, trace_id}`) y headers (`Cache-Control`, `X-Trace-Id`).

3. **Router registry-driven:** Toda ruta debe estar en un registry canónico. Rutas API no pueden resolverse como island.

4. **Señales registradas:** Solo se pueden emitir señales registradas en `STUDENT_SIGNAL_REGISTRY`. Fail-hard si señal no está registrada.

5. **Atomicidad con transacciones:** Operaciones multi-paso (evento + proyección + sync) usan transacciones explícitas.

6. **Contextos explícitos:** `window.__AP_CONTEXT__` determina dominio. Entry gates verifican contexto antes de ejecutar.

7. **SOT canónico por dominio:** Cada dominio tiene tablas SOT claras con migraciones versionadas y constraints correctos.

8. **Idempotencia por execution_key:** Operaciones idempotentes usan `execution_key` único. Mismo `execution_key` = mismo resultado.

9. **Observabilidad obligatoria:** Todo código propaga `trace_id`, usa logging estructurado, respeta Error Contract v1.

10. **Versionado determinista:** Assets versionados con `APP_VERSION.BUILD_ID`. Cambio de versión → cambio de URLs.

---

## L) CAMBIOS REQUERIDOS (SOLO DISEÑO)

### L.1 Identidad Alumno

**Cambio:** Migrar todas las FK de `alumnos.id` (INTEGER) a `students.id` (UUID).

**Archivos afectados:**
- Migraciones: Crear `v5.60.0-unify-student-identity-uuid.sql`
- Repositorios: `cleaning-events-repo-pg.js`, `cleaning-item-state-repo-pg.js`, `student-*-repo-pg.js`, etc.
- Servicios: `cleaning-engine-service.js`, `place-service.js`, `project-service.js`, `sponsor-service.js`
- Endpoints: `master-api-*.js` (cambiar `student_id` a `student_uuid` en payloads)

**Riesgo:** ALTO (requiere migración de datos)

### L.2 HTTP Envelope

**Cambio:** Helper canónico `jsonResponse()` y headers consistentes.

**Archivos afectados:**
- Crear: `src/core/contracts/http-response.js`
- Migrar: Todos los endpoints API (`master-api-*.js`)
- Assembly check: Script que verifica uso del helper

**Riesgo:** BAJO (cambio mecánico)

### L.3 Señales

**Cambio:** Registrar todas las señales y hacer validación fail-hard.

**Archivos afectados:**
- Actualizar: `student-signal-registry.js` (añadir señales faltantes)
- Migrar: `student-signal-emitter.js` (fail-hard en lugar de fail-open)
- Servicios: `cleaning-engine-service.js`, `place-service.js`, `project-service.js`, `sponsor-service.js` (usar señales registradas)

**Riesgo:** MEDIO (señales legacy pueden romper)

### L.4 Atomicidad

**Cambio:** Transacciones explícitas en operaciones multi-paso.

**Archivos afectados:**
- Crear: Helper `withTransaction()` en `database/pg.js`
- Migrar: `cleaning-engine-service.js`, `level-engine-service.js`
- Verificar: `place-service.js`, `project-service.js`, `sponsor-service.js`

**Riesgo:** MEDIO (transacciones largas pueden causar locks)

### L.5 Observabilidad

**Cambio:** Propagar `trace_id` en todas las capas, logging estructurado consistente.

**Archivos afectados:**
- Todos los servicios y repositorios (ya tienen `getRequestId()`, verificar cobertura)
- Endpoints (ya exponen `X-Trace-Id`, verificar consistencia)

**Riesgo:** BAJO (ya implementado parcialmente, solo completar)

---

## M) RIESGOS DE MIGRACIÓN Y PLAN DE NO PÉRDIDA DE DATOS

### M.1 Riesgos Críticos

**Riesgo #1: Migración de identidad de alumno**
- **Pérdida de datos:** ALTA (si migración falla, puede perder relaciones FK)
- **Mitigación:**
  - Backup completo de PostgreSQL antes de migración
  - Migración en transacciones por lotes pequeños (100 registros)
  - Validación post-migración: Verificar que todas las FK existen
  - Rollback plan: Mantener `alumnos` durante período de transición

**Riesgo #2: Cambio de payloads API (student_id → student_uuid)**
- **Pérdida de datos:** BAJA (solo afecta requests, no datos persistidos)
- **Mitigación:**
  - Versionar API (v1 mantiene `student_id`, v2 usa `student_uuid`)
  - Frontend migra gradualmente a v2
  - Deprecar v1 después de período de transición (6 meses)

**Riesgo #3: Transacciones en operaciones masivas**
- **Pérdida de datos:** MEDIA (si transacción falla, puede dejar estado parcial previo)
- **Mitigación:**
  - Idempotencia por `execution_key` previene duplicados
  - Transacciones cortas (solo pasos críticos)
  - Operaciones masivas en lotes con commit intermedio
  - Timeout de transacción configurable (30s)

### M.2 Plan de No Pérdida de Datos

**Fase 1: Preparación**
1. Backup completo de PostgreSQL
2. Verificar que todas las migraciones están aplicadas
3. Documentar estado actual (este reporte)

**Fase 2: Migración de Identidad (si aplica)**
1. Crear columna `legacy_alumno_id` en `students` (si no existe)
2. Poblar `students` desde `alumnos` (si hay alumnos sin students)
3. Migrar FK en lotes pequeños (100 registros por transacción)
4. Validación post-migración: Query que verifica que todas las FK existen
5. Mantener `alumnos` como tabla de solo lectura durante período de transición (6 meses)

**Fase 3: Migración de Código**
1. Actualizar repositorios para usar `students.id` (UUID)
2. Actualizar payloads API (versionar v1/v2)
3. Actualizar frontend gradualmente a v2
4. Tests de regresión completos

**Fase 4: Deprecación**
1. Deprecar `alumnos` (solo lectura)
2. Deprecar API v1 (después de 6 meses)
3. Eliminar código legacy (después de 1 año)

---

## CONCLUSIÓN FINAL

**Estado Actual:**
- ✅ Master Router canónico y robusto
- ✅ Level Engine canónico (UUID)
- ✅ Signal Registry canónico (pero señales faltantes)
- ⚠️ Cleaning Engine legacy (INTEGER)
- ⚠️ Student SOT legacy (INTEGER)
- ❌ Atomicidad parcial (sin transacciones)
- ❌ Contrato HTTP inconsistente (headers faltantes)
- ❌ CLIENT Router no verificado

**Prioridad de Cambios:**
1. **ALTA:** Unificar identidad de alumno (UUID canónico)
2. **ALTA:** Registrar señales faltantes
3. **MEDIA:** Transacciones explícitas
4. **MEDIA:** Contrato HTTP canónico
5. **BAJA:** CLIENT Router (si aplica)

**Riesgo General:** MEDIO (migración de identidad es crítica pero mitigable)

---

**FIN DEL REPORTE FORENSE**
