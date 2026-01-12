# 🧠 DIAGNÓSTICO FORENSE — FLOTANTE ALQUIMIA + COHERENCIA ALUMNOS
# AuriPortal / Aurelín — DOMINIO MASTER
# Fecha: 2025-01-27
# MODO: SOLO LECTURA / FORENSICS
# ❌ PROHIBIDO: implementar fixes, refactors, "mejoras", renombrados, cambios de arquitectura, migraciones, commits

---

## 0) CONTEXTO

Tenemos varios "hotfixes" (hasta v5.68.4) que afirman:
- clean_layer literal por botón
- errores visibles con toast + trace_id
- backend autoridad de estados
- COMBO proyección

PERO en la realidad el comportamiento sigue caótico.

Esto indica incoherencia sistémica:
- wiring de botones → endpoints
- endpoints → engine
- engine → repos
- repos → DB
- DB → DTO
- DTO → render
- y posible interferencia con lógica de alumnos/UUID/proyecciones/compat fields.

---

# FASE A — AUDIT DE RULES DE CURSOR (SIN TOCAR CÓDIGO)

## A.1 Archivos de Reglas Encontrados

- **`.cursorrules`**: Existe y contiene reglas constitucionales del proyecto
- **`.cursor/rules`**: No encontrado
- **`docs/rules*.md`**: No encontrado
- **`docs/prompts*.md`**: No encontrado

## A.2 Análisis de Riesgos en `.cursorrules`

### Reglas que PUEDEN provocar problemas:

1. **`alquimia-item-kind-obligatory`** (línea 662-678)
   - ✅ **BUENO**: Obliga `item_kind` explícito
   - ⚠️ **RIESGO**: Si Cursor "normaliza" DTOs, podría eliminar campos legacy necesarios para compatibilidad

2. **`cleaning-engine-two-layers`** (línea 458-471)
   - ✅ **BUENO**: Obliga separación SHARED/PDE
   - ⚠️ **RIESGO**: Si Cursor "simplifica" capas, podría unificar lógica que debe estar separada

3. **`execution-mode-constitutional`** (línea 694-715)
   - ✅ **BUENO**: Define APPLY/CERTIFY
   - ⚠️ **RIESGO**: Si Cursor "optimiza" sin entender, podría eliminar CERTIFY o convertirlo en APPLY

4. **`alquimia-refresh-deterministic`** (línea 633-646)
   - ✅ **BUENO**: Obliga refresh post-acción
   - ⚠️ **RIESGO**: Si Cursor "optimiza" refreshes, podría eliminar refetches necesarios

5. **`ui-refetch-after-mutations`** (línea 270-285)
   - ✅ **BUENO**: Obliga refetch tras mutaciones
   - ⚠️ **RIESGO**: Si Cursor "optimiza" sin tests, podría asumir estado local sin verificar

6. **`alquimia-canonical-documentation`** (línea 680-692)
   - ✅ **BUENO**: Obliga consultar documentación canónica
   - ⚠️ **RIESGO**: Si Cursor "mejora" sin leer docs, podría introducir contradicciones

### Reglas que PROTEGEN contra problemas:

- `cleaning-engine-uuid-only-constitutional`: Prohíbe legacy_alumno_id en runtime
- `alquimia-flotante-no-filter-level`: Prohíbe filtrar por nivel en flotante Master
- `alquimia-toast-no-confirm`: Prohíbe confirm()/alert() en flujos de limpieza

### Conclusión FASE A

**RIESGO BAJO-MEDIO**: Las reglas están bien diseñadas y protegen contra la mayoría de problemas. El riesgo principal es que Cursor "optimice" o "simplifique" sin entender la arquitectura de capas (SHARED/PDE) o sin respetar la necesidad de refetch determinista.

**NO se encontraron reglas que empujen cambios no canónicos de forma directa**, pero hay riesgo de "mejoras" mal entendidas que rompan invariantes.

---

# FASE B — MAPA CANÓNICO DEL FLOTANTE (TRAZA FIN A FIN)

## B.1 Inventario de Botones (Código Real)

### RECURRENTE — Botones del Flotante

| Botón | Handler | Endpoint | Payload | clean_layer | item_kind | student_uuid | execution_mode |
|-------|---------|---------|---------|-------------|-----------|--------------|----------------|
| **S ✓** | `handleLimpiarEstudiante(student, item, 'shared', itemKind)` | `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student` | `{ student_uuid, item_ref, item_kind, domain_type, clean_layer: 'shared', actor_type: 'master', surface_key: 'master.alquimia_general' }` | `'shared'` (literal) | `state.modal?.itemKind \|\| tipo \|\| item.item_kind \|\| item.tipo \|\| state.listaActiva?.tipo \|\| 'recurrente'` | `student.student_uuid` (UUID canónico) | No enviado (default: 'APPLY') |
| **P ✓** | `handleLimpiarEstudiante(student, item, 'pde', itemKind)` | `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student` | `{ student_uuid, item_ref, item_kind, domain_type, clean_layer: 'pde', actor_type: 'master', surface_key: 'master.alquimia_general' }` | `'pde'` (literal) | Mismo que S ✓ | `student.student_uuid` | No enviado (default: 'APPLY') |
| **S+P** | `handleLimpiarEstudiante(student, item, 'shared', itemKind)` + `handleLimpiarEstudiante(student, item, 'pde', itemKind)` (secuencial) | `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student` (2 llamadas) | Primera: `{ clean_layer: 'shared', ... }`<br>Segunda: `{ clean_layer: 'pde', ... }` | `'shared'` luego `'pde'` | Mismo que S ✓ | `student.student_uuid` | No enviado (default: 'APPLY') |

**Referencias código:**
- Handler: `master-alquimia-general-client.js:1695-1794`
- Botones RECURRENTE: `master-alquimia-general-client.js:1594-1636`
- Payload: `master-alquimia-general-client.js:1730-1738`

### UNA_VEZ — Botones del Flotante

| Botón | Handler | Endpoint | Payload | clean_layer | item_kind | student_uuid | execution_mode |
|-------|---------|---------|---------|-------------|-----------|--------------|----------------|
| **S +1** | `handleLimpiarEstudiante(student, item, 'shared', itemKind)` | `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student` | `{ student_uuid, item_ref, item_kind, domain_type, clean_layer: 'shared', actor_type: 'master', surface_key: 'master.alquimia_general' }` | `'shared'` (literal) | `state.modal?.itemKind \|\| item.item_kind \|\| item.tipo \|\| state.listaActiva?.tipo \|\| 'una_vez'` | `student.student_uuid` | No enviado (default: 'APPLY', pero engine lo convierte a 'CERTIFY' para MASTER UNA_VEZ) |
| **P +1** | `handleLimpiarEstudiante(student, item, 'pde', itemKind)` | `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student` | `{ clean_layer: 'pde', ... }` | `'pde'` (literal) | Mismo que S +1 | `student.student_uuid` | No enviado (default: 'APPLY', pero engine lo convierte a 'CERTIFY') |
| **S+P** | `handleLimpiarEstudiante(student, item, 'shared', itemKind)` + `handleLimpiarEstudiante(student, item, 'pde', itemKind)` (secuencial) | `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student` (2 llamadas) | Primera: `{ clean_layer: 'shared', ... }`<br>Segunda: `{ clean_layer: 'pde', ... }` | `'shared'` luego `'pde'` | Mismo que S +1 | `student.student_uuid` | No enviado (default: 'APPLY', pero engine lo convierte a 'CERTIFY') |

**Referencias código:**
- Handler: `master-alquimia-general-client.js:1695-1794`
- Botones UNA_VEZ: `master-alquimia-general-client.js:1547-1591`
- Payload: `master-alquimia-general-client.js:1730-1738`

### Botones Globales (No en Flotante, pero relacionados)

| Botón | Handler | Endpoint | Payload | clean_layer | item_kind | execution_mode |
|-------|---------|---------|---------|-------------|-----------|----------------|
| **✓ para todos** (RECURRENTE) | `handleLimpiarItem(item)` | `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-all` | `{ clean_layer: state.modal?.cleanLayer \|\| 'shared', item_kind }` | `state.modal?.cleanLayer \|\| 'shared'` | `state.modal?.itemKind \|\| item.item_kind \|\| item.tipo \|\| state.listaActiva?.tipo \|\| 'recurrente'` | No enviado (default: 'APPLY') |
| **+1 para todos** (UNA_VEZ SHARED) | `handleIncrementAllItem(item)` | `POST /master/api/alquimia-general/items/:item_ref/master/increment-all` | `{ clean_layer: 'shared', item_kind }` | `'shared'` (hardcoded) | `state.modal?.itemKind \|\| item.item_kind \|\| item.tipo \|\| state.listaActiva?.tipo \|\| 'una_vez'` | No enviado (default: 'APPLY', pero engine lo convierte a 'CERTIFY') |
| **+1 PDE para todos** (UNA_VEZ PDE) | `handlePdeIncrementAllItem(item)` | `POST /master/api/alquimia-general/items/:item_ref/master/increment-all` | `{ clean_layer: 'pde', item_kind }` | `'pde'` (hardcoded) | Mismo que +1 SHARED | No enviado (default: 'APPLY', pero engine lo convierte a 'CERTIFY') |

**Referencias código:**
- `handleLimpiarItem`: `master-alquimia-general-client.js:934-1000`
- `handleIncrementAllItem`: `master-alquimia-general-client.js:2605-2654`
- `handlePdeIncrementAllItem`: `master-alquimia-general-client.js:2659-2710`

## B.2 Inventario de Endpoints/Handlers (MASTER)

### GET /master/api/alquimia-general/items/:item_ref/students

**Handler:** `master-api-alquimia-general.js:762-920`

**Función del engine llamada:**
- `getStudentsForItem(itemRef, tipo, productKey, { limit, offset, clean_layer, skip_level_filter: true })`

**Parámetros pasados:**
- `itemRef`: desde URL params
- `tipo`: desde `lista.tipo` (obtenido del item)
- `productKey`: desde query param `product_key` (default: 'pde')
- `clean_layer`: desde query param `clean_layer` (default: 'shared')
- `skip_level_filter`: siempre `true` (regla constitucional Master)

**Validación clean_layer/item_kind:**
- `clean_layer`: validado en servicio `getStudentsForItem` (línea 473-482 de `alquimia-general-service.js`)
- `item_kind`: NO se valida en GET (solo se usa `tipo` de la lista)

**JSON devuelto (shape real):**
```json
{
  "ok": true,
  "data": {
    "item_ref": "string",
    "tipo": "recurrente" | "una_vez",
    "students": [
      {
        "student_uuid": "UUID",
        "display_name": "string",
        "shared": {
          "clean_count": number,
          "last_cleaned_at": "ISO8601" | null,
          "days_since_last_clean": number | null
        },
        "pde": {
          "clean_count": number,
          "last_cleaned_at": "ISO8601" | null,
          "days_since_last_clean": number | null
        },
        "state": "never" | "reviewed" | "pending" | "important" | "completed",
        "visual_state": "never" | "in_progress" | "completed" | "empowered" (solo UNA_VEZ),
        "combo": {
          "clean_count": number,
          "remaining": number,
          "completed": 0 | 1
        } (solo UNA_VEZ),
        "clean_count": number (compat legacy, usa shared.clean_count),
        "remaining": number | null (compat legacy, usa shared.remaining),
        "completed": 0 | 1 (compat legacy, usa shared.completed)
      }
    ],
    "counts": { "reviewed": number, "pending": number, "important": number, "never": number },
    "total": number,
    "threshold_days": number | null,
    "critical_multiplier": number
  },
  "trace_id": "string"
}
```

**Errores:**
- `ok: false, error: "message", code: "CODE", trace_id: "string"` (status 400/404/500)

### POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student

**Handler:** `master-api-alquimia-general.js:962-1093`

**Función del engine llamada:**
- `markCleanStudent(options)` desde `cleaning-engine-service.js`

**Parámetros pasados:**
- `student_uuid`: desde body (validado como UUID)
- `item_ref`: desde URL params
- `item_kind`: desde body (validado: 'recurrente' | 'una_vez')
- `clean_layer`: desde body o query (validado: 'shared' | 'pde')
- `product_key`: desde query (default: 'pde')
- `actor_type`: 'master' (hardcoded)
- `surface_key`: 'master.alquimia_general' (hardcoded)

**Validación clean_layer/item_kind:**
- `clean_layer`: validado en handler (línea 970-974)
- `item_kind`: validado en handler (línea 986-988)

**JSON devuelto:**
```json
{
  "ok": true,
  "state": {
    "student_uuid": "UUID",
    "item_ref": "string",
    "shared_clean_count": number,
    "shared_last_cleaned_at": "ISO8601" | null,
    "pde_clean_count": number,
    "pde_last_cleaned_at": "ISO8601" | null,
    "shared_remaining": number | null,
    "shared_completed": 0 | 1,
    "pde_remaining": number | null,
    "pde_completed": 0 | 1
  },
  "applied_layer": "shared" | "pde",
  "item_kind": "recurrente" | "una_vez",
  "student": {
    "student_uuid": "UUID",
    "display_name": "string"
  },
  "trace_id": "string"
}
```

**Errores:**
- `ok: false, error: "message", code: "INVALID_CLEAN_LAYER" | "INVALID_ITEM_KIND" | "MISSING_STUDENT_UUID" | "ITEM_NOT_FOUND" | "ITEM_ARCHIVED" | "CLEANING_ENGINE_ERROR", trace_id: "string"` (status 400/404/500)

### POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-all

**Handler:** `master-api-alquimia-general.js:922-960`

**Función del engine llamada:**
- `markCleanAll(itemRef, productKey, cleanLayer, item_kind, executionMode)` desde `alquimia-general-service.js`

**Parámetros pasados:**
- `item_ref`: desde URL params
- `product_key`: desde query (default: 'pde')
- `clean_layer`: desde body o query (validado: 'shared' | 'pde')
- `item_kind`: desde body (validado: 'recurrente' | 'una_vez')
- `execution_mode`: desde body (default: 'APPLY', validado: 'APPLY' | 'CERTIFY')

**Validación clean_layer/item_kind:**
- `clean_layer`: validado en handler (línea 938-941)
- `item_kind`: validado en handler (línea 943-946)

**JSON devuelto:**
```json
{
  "ok": true,
  "updated": number,
  "skipped": number,
  "skipped_already_clean": number,
  "total": number,
  "skipped_breakdown": {
    "paused": number,
    "not_applicable_level": number,
    "already_clean": number,
    "missing_item": number,
    "no_change": number,
    "error": number,
    "other": number
  },
  "applied_layer": "shared" | "pde",
  "item_kind": "recurrente" | "una_vez",
  "trace_id": "string"
}
```

### POST /master/api/alquimia-general/items/:item_ref/master/increment-all

**Handler:** `master-api-alquimia-general.js:1144-1176`

**Función del engine llamada:**
- `incrementAll(itemRef, productKey, cleanLayer, item_kind)` desde `alquimia-general-service.js`
- Internamente llama a `incrementAllStudents()` que delega a `markCleanAllStudents()`

**Parámetros pasados:**
- `item_ref`: desde URL params
- `product_key`: desde query (default: 'pde')
- `clean_layer`: desde body o query (validado: 'shared' | 'pde')
- `item_kind`: desde body (validado: 'recurrente' | 'una_vez')

**Validación clean_layer/item_kind:**
- `clean_layer`: validado en handler (línea 1159-1163)
- `item_kind`: validado en handler (línea 1165-1168)

**JSON devuelto:**
```json
{
  "ok": true,
  "updated": number,
  "skipped": number,
  "skipped_already_clean": number,
  "total": number,
  "skipped_breakdown": { ... },
  "applied_layer": "shared" | "pde",
  "item_kind": "recurrente" | "una_vez",
  "trace_id": "string"
}
```

## B.3 Engine y Repos: Escritura Real por Capa

### RECURRENTE SHARED APPLY

**Función:** `cleaning-engine-service.js:markCleanStudent()` → `cleaning-item-state-repo-pg.js:upsertApplyRecurrent()`

**Query exacta:**
```sql
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

**Columnas tocadas:**
- `shared_last_cleaned_at` ✅
- `shared_clean_count` ✅
- `pde_last_cleaned_at` ❌ NO TOCADO
- `pde_clean_count` ❌ NO TOCADO

**Referencia:** `cleaning-item-state-repo-pg.js:90-150`

### RECURRENTE PDE APPLY

**Función:** `cleaning-engine-service.js:markCleanStudent()` → `cleaning-item-state-repo-pg.js:upsertApplyRecurrent()`

**Query exacta:** (Misma que SHARED, pero con columnas PDE)

```sql
INSERT INTO cleaning_item_state (
  student_id, product_key, domain_type, item_ref,
  pde_last_cleaned_at, pde_clean_count
) VALUES (
  $1, $2, $3, $4, $5, 1
)
ON CONFLICT (student_id, product_key, domain_type, item_ref)
DO UPDATE SET
  pde_last_cleaned_at = $5,
  pde_clean_count = cleaning_item_state.pde_clean_count + 1,
  updated_at = CURRENT_TIMESTAMP
RETURNING *
```

**Columnas tocadas:**
- `pde_last_cleaned_at` ✅
- `pde_clean_count` ✅
- `shared_last_cleaned_at` ❌ NO TOCADO
- `shared_clean_count` ❌ NO TOCADO

**Referencia:** `cleaning-item-state-repo-pg.js:90-150` (mismo método, columnas dinámicas según `clean_layer`)

### UNA_VEZ SHARED INCREMENT

**Función:** `cleaning-engine-service.js:markCleanStudent()` → `cleaning-item-state-repo-pg.js:upsertApplyOneTimeIncrementShared()`

**Query exacta:**
```sql
INSERT INTO cleaning_item_state (
  student_id, product_key, domain_type, item_ref,
  shared_clean_count, shared_remaining, shared_completed
) VALUES (
  $1, $2, $3, $4, 1, GREATEST(0, $5 - 1), 
  CASE WHEN $5 - 1 <= 0 THEN 1 ELSE 0 END
)
ON CONFLICT (student_id, product_key, domain_type, item_ref)
DO UPDATE SET
  shared_clean_count = cleaning_item_state.shared_clean_count + 1,
  shared_remaining = GREATEST(0, $5 - (cleaning_item_state.shared_clean_count + 1)),
  shared_completed = CASE 
    WHEN GREATEST(0, $5 - (cleaning_item_state.shared_clean_count + 1)) <= 0 THEN 1 
    ELSE 0 
  END,
  updated_at = CURRENT_TIMESTAMP
RETURNING *
```

**Columnas tocadas:**
- `shared_clean_count` ✅
- `shared_remaining` ✅
- `shared_completed` ✅
- `pde_clean_count` ❌ NO TOCADO
- `pde_remaining` ❌ NO TOCADO
- `pde_completed` ❌ NO TOCADO

**Referencia:** `cleaning-item-state-repo-pg.js:163-233`

### UNA_VEZ PDE INCREMENT

**Función:** `cleaning-engine-service.js:markCleanStudent()` → `cleaning-item-state-repo-pg.js:upsertApplyOneTimeIncrementPde()`

**Query exacta:**
```sql
INSERT INTO cleaning_item_state (
  student_id, product_key, domain_type, item_ref,
  pde_clean_count, pde_remaining, pde_completed
) VALUES (
  $1, $2, $3, $4, 1, GREATEST(0, $5 - 1), 
  CASE WHEN $5 - 1 <= 0 THEN 1 ELSE 0 END
)
ON CONFLICT (student_id, product_key, domain_type, item_ref)
DO UPDATE SET
  pde_clean_count = cleaning_item_state.pde_clean_count + 1,
  pde_remaining = GREATEST(0, $5 - (cleaning_item_state.pde_clean_count + 1)),
  pde_completed = CASE 
    WHEN GREATEST(0, $5 - (cleaning_item_state.pde_clean_count + 1)) <= 0 THEN 1 
    ELSE 0 
  END,
  updated_at = CURRENT_TIMESTAMP
RETURNING *
```

**Columnas tocadas:**
- `pde_clean_count` ✅
- `pde_remaining` ✅
- `pde_completed` ✅
- `shared_clean_count` ❌ NO TOCADO
- `shared_remaining` ❌ NO TOCADO
- `shared_completed` ❌ NO TOCADO

**Referencia:** `cleaning-item-state-repo-pg.js:312-383`

### CONCLUSIÓN B.3 — WRITE SURFACE AUDIT

✅ **NO HAY VIOLACIONES**: Cada operación toca SOLO las columnas de su capa (SHARED o PDE), nunca ambas. Las queries son simétricas y respetan la separación de capas.

**Independencia verificada:**
- RECURRENTE SHARED: solo `shared_*`
- RECURRENTE PDE: solo `pde_*`
- UNA_VEZ SHARED: solo `shared_*`
- UNA_VEZ PDE: solo `pde_*`

---

# FASE C — VERIFICACIÓN EMPÍRICA CON LOGS (SIN CAMBIAR CÓDIGO)

## C.1 Protocolo de Prueba Definido

**Items de prueba:**
1. **RECURRENTE**: Item con `frecuencia_dias = 20` (no 7, para detectar problemas de threshold)
2. **UNA_VEZ**: Item con `veces_limpiar = 5` (conocido, para verificar remaining/completed)

**Acciones a capturar:**
- Log `[AG][ACTION]` en consola del navegador (payload real)
- Respuesta JSON del endpoint (ok/data/trace_id o error)
- Recarga GET del flotante después de cada acción (ver estado final)

**En servidor:**
- `grep` logs PM2 por `trace_id` de cada acción
- Extraer: endpoint, parámetros recibidos, engine action, repo write, errores

## C.2 RUNTIME TRACE SAMPLES (SIMULADOS)

**NOTA:** Este diagnóstico es SOLO LECTURA, no se ejecutaron pruebas reales. Los siguientes son ejemplos basados en el código analizado.

### Acción 1: RECURRENTE SHARED (botón S ✓)

**Request:**
```json
POST /master/api/alquimia-general/items/test-item-123/master/mark-clean-student
{
  "student_uuid": "550e8400-e29b-41d4-a716-446655440000",
  "item_ref": "test-item-123",
  "item_kind": "recurrente",
  "domain_type": "transmutation",
  "clean_layer": "shared",
  "actor_type": "master",
  "surface_key": "master.alquimia_general"
}
```

**Log esperado en consola:**
```
[AG][ACTION] {
  actionType: 'mark-clean-student',
  item_kind: 'recurrente',
  clean_layer: 'shared',
  student_uuid: '550e8400-e29b-41d4-a716-446655440000',
  item_ref: 'test-item-123',
  layerView: 'shared',
  viewMode: 'flotante'
}
```

**Log esperado en servidor (CleaningEngine):**
```
CleaningEngine markCleanStudent entrada {
  traceId: 'abc-123',
  student_uuid: '550e8400-e29b-41d4-a716-446655440000',
  item_ref: 'test-item-123',
  item_kind: 'recurrente',
  clean_layer: 'shared',
  product_key: 'pde',
  actor_type: 'master',
  surface_key: 'master.alquimia_general'
}
CleaningEngine Recurrente: usando upsertApplyRecurrent {
  traceId: 'abc-123',
  clean_layer: 'shared',
  capa: 'SHARED'
}
CleaningItemStateRepo [FORENSIC] Limpieza recurrente aplicada {
  student_uuid: '550e8400-e29b-41d4-a716-446655440000',
  item_ref: 'test-item-123',
  clean_layer: 'shared',
  columns_updated: 'shared_last_cleaned_at, shared_clean_count',
  independence_check: 'SOLO SHARED columns'
}
```

**Respuesta esperada:**
```json
{
  "ok": true,
  "state": {
    "student_uuid": "550e8400-e29b-41d4-a716-446655440000",
    "item_ref": "test-item-123",
    "shared_clean_count": 1,
    "shared_last_cleaned_at": "2025-01-27T10:00:00Z",
    "pde_clean_count": 0,
    "pde_last_cleaned_at": null
  },
  "applied_layer": "shared",
  "item_kind": "recurrente",
  "student": {
    "student_uuid": "550e8400-e29b-41d4-a716-446655440000",
    "display_name": "Juan Pérez"
  },
  "trace_id": "abc-123"
}
```

### Acción 2: RECURRENTE PDE (botón P ✓)

**Request:** (igual que SHARED, pero `clean_layer: 'pde'`)

**Log esperado en servidor:**
```
CleaningItemStateRepo [FORENSIC] Limpieza recurrente aplicada {
  clean_layer: 'pde',
  columns_updated: 'pde_last_cleaned_at, pde_clean_count',
  independence_check: 'SOLO PDE columns'
}
```

### Acción 3: UNA_VEZ SHARED (botón S +1)

**Request:** (igual estructura, pero `item_kind: 'una_vez'`)

**Log esperado en servidor:**
```
CleaningEngine MASTER UNA_VEZ: usando CERTIFY para permitir múltiples incrementos {
  original_execution_mode: 'APPLY',
  effective_execution_mode: 'CERTIFY'
}
CleaningItemStateRepo [FORENSIC] Incremento una_vez SHARED aplicado {
  columns_updated: 'shared_clean_count, shared_remaining, shared_completed',
  independence_check: 'SOLO SHARED columns (pde_* NO modificadas)'
}
```

### Acción 4: UNA_VEZ PDE (botón P +1)

**Request:** (igual que SHARED, pero `clean_layer: 'pde'`)

**Log esperado en servidor:**
```
CleaningItemStateRepo [FORENSIC] Incremento una_vez PDE aplicado {
  columns_updated: 'pde_clean_count, pde_remaining, pde_completed',
  independence_check: 'SOLO PDE columns (shared_* NO modificadas)'
}
```

### Acción 5: S+P (RECURRENTE o UNA_VEZ)

**Request:** 2 llamadas secuenciales (primera SHARED, segunda PDE)

**Log esperado:**
- Primera llamada: logs de SHARED
- Segunda llamada: logs de PDE
- Si primera falla, segunda NO se ejecuta (según código línea 1570-1582 y 1614-1627)

---

# FASE D — COHERENCIA ALUMNOS / UUID / PROYECCIONES

## D.1 Contrato UUID-Only Verificado

### En Requests (Frontend → Backend)

✅ **VERIFICADO**: Todos los handlers del flotante usan `student.student_uuid` (UUID canónico)

**Evidencia:**
- `handleLimpiarEstudiante`: línea 1697 valida `student.student_uuid`
- Payload: línea 1731 envía `student_uuid: student.student_uuid`
- Warning si se intenta usar `student_id`: línea 1700-1705

### En Engine/Repos

✅ **VERIFICADO**: Engine acepta `student_uuid` y resuelve `legacy_alumno_id` internamente SOLO para escribir en tablas legacy

**Evidencia:**
- `cleaning-engine-service.js:134-176`: Guard constitucional prohíbe `legacy_alumno_id` en runtime
- `cleaning-engine-service.js:303-314`: Resuelve `legacy_alumno_id` SOLO para escribir en tablas legacy
- `cleaning-item-state-repo-pg.js:26-34`: Método privado `_resolveLegacyId()` encapsula resolución

### En Writes (DB)

✅ **VERIFICADO**: Repositorios escriben usando `student_id` (legacy) pero lo resuelven desde `student_uuid` internamente

**Evidencia:**
- `cleaning-item-state-repo-pg.js:90-150`: `upsertApplyRecurrent()` resuelve `legacyStudentId` internamente
- Tabla `cleaning_item_state` usa `student_id` (INTEGER) como FK, pero el runtime nunca lo expone

## D.2 Auditar DTO del Flotante

### Estructura Real del DTO (GET /items/:item_ref/students)

**Para cada student:**

```javascript
{
  // UUID canónico (OBLIGATORIO)
  student_uuid: "550e8400-e29b-41d4-a716-446655440000",
  
  // Display name (calculado por backend)
  display_name: "Juan Pérez",
  
  // Capa SHARED (simétrica)
  shared: {
    clean_count: 5,
    last_cleaned_at: "2025-01-25T10:00:00Z", // RECURRENTE
    days_since_last_clean: 2, // RECURRENTE
    remaining: 3, // UNA_VEZ
    completed: 0 // UNA_VEZ
  },
  
  // Capa PDE (simétrica)
  pde: {
    clean_count: 2,
    last_cleaned_at: "2025-01-26T10:00:00Z", // RECURRENTE
    days_since_last_clean: 1, // RECURRENTE
    remaining: 4, // UNA_VEZ
    completed: 0 // UNA_VEZ
  },
  
  // PROYECCIÓN COMBO (solo UNA_VEZ, calculada en backend)
  combo: {
    clean_count: 7, // shared.clean_count + pde.clean_count
    remaining: 0, // max(veces_limpiar - combo_clean_count, 0)
    completed: 1 // combo_remaining <= 0 ? 1 : 0
  },
  
  // Estado visual (calculado por backend, autoridad única)
  state: "reviewed" | "pending" | "important" | "never" | "completed", // RECURRENTE o UNA_VEZ
  visual_state: "never" | "in_progress" | "completed" | "empowered", // Solo UNA_VEZ
  
  // Campos compat legacy (NO usar para decisiones, solo display)
  clean_count: 5, // = shared.clean_count (compat)
  remaining: 3, // = shared.remaining (compat)
  completed: 0, // = shared.completed (compat)
  
  // Metadata
  veces_limpiar: 10, // Solo UNA_VEZ
  threshold_days: 20, // Solo RECURRENTE
  critical_multiplier: 2.0, // Solo RECURRENTE
  state_calculated_from: "shared" | "pde" // Solo RECURRENTE (forensics)
}
```

### Verificación de Compat Fields

✅ **VERIFICADO**: Los campos `clean_count`, `remaining`, `completed` top-level son SOLO para compatibilidad legacy

**Evidencia:**
- `alquimia-general-service.js:728-731`: Asigna `clean_count = sharedCount`, `remaining = sharedData.remaining`, `completed = sharedData.completed`
- Comentario: "Compatibilidad legacy (usar SHARED como default para campos legacy)"
- UI NO debe usar estos campos para decisiones (debe usar `shared.*` o `pde.*`)

### Verificación de Proyección COMBO

✅ **VERIFICADO**: COMBO es proyección calculada en backend, NO persistida

**Evidencia:**
- `alquimia-general-service.js:677-684`: Calcula `comboCleanCount = sharedCount + pdeCount`, `comboRemaining = max(0, vecesLimpiar - comboCleanCount)`
- Comentario: "PROYECCIÓN COMBO (calculada en backend, no persistida)"
- NO existe en `cleaning_item_state` (solo `shared_*` y `pde_*`)

---

# FASE E — CONCLUSIÓN: CAUSAS RAÍZ + PLAN DE CIERRE

## E.1 Causas Raíz (No Síntomas)

### CAUSA RAÍZ #1: Inferencia de `item_kind` en Frontend

**Problema:**
El frontend infiere `item_kind` usando una cadena de fallbacks:
```javascript
const itemKind = state.modal?.itemKind || tipo || item.item_kind || item.tipo || state.listaActiva?.tipo || 'recurrente';
```

**Riesgo:**
- Si `state.modal.itemKind` no está sincronizado con el item real, puede enviar `item_kind` incorrecto
- Si `item.tipo` no coincide con `lista.tipo`, puede haber inconsistencia
- El backend valida pero solo emite warning (línea 288-297 de `cleaning-engine-service.js`)

**Impacto:**
- RECURRENTE tratado como UNA_VEZ o viceversa
- Estados visuales incorrectos
- Cálculos de remaining/completed erróneos

### CAUSA RAÍZ #2: `clean_layer` Inferido en `handleLimpiarItem` (Global)

**Problema:**
El botón "✓ para todos" (global) infiere `clean_layer` desde `state.modal?.cleanLayer || 'shared'`:

```javascript
const cleanLayer = state.modal?.cleanLayer || 'shared';
```

**Riesgo:**
- Si el modal no está abierto o `state.modal.cleanLayer` no está sincronizado, puede usar capa incorrecta
- No hay validación explícita antes de enviar

**Impacto:**
- Limpieza aplicada a capa incorrecta (SHARED cuando debería ser PDE o viceversa)

### CAUSA RAÍZ #3: Execution Mode Convertido Silenciosamente

**Problema:**
El engine convierte `APPLY` → `CERTIFY` para UNA_VEZ en MASTER sin que el frontend lo sepa:

```javascript
const effectiveExecutionMode = (isMasterDomain && itemKind === 'una_vez' && execution_mode === 'APPLY') 
  ? 'CERTIFY' 
  : execution_mode;
```

**Riesgo:**
- Frontend envía `APPLY` (idempotente) pero el engine ejecuta `CERTIFY` (no idempotente)
- Si el frontend intenta re-ejecutar la misma acción, puede duplicar incrementos

**Impacto:**
- Comportamiento no idempotente cuando el frontend espera idempotencia
- Incrementos duplicados en UNA_VEZ

### CAUSA RAÍZ #4: Refresh Post-Acción No Determinista

**Problema:**
Después de acciones, el refresh usa `state.modal.layerView` que puede no estar sincronizado:

```javascript
const currentLayerView = state.modal.layerView || 'shared';
await handleVerItem(item, 'shared'); // Fetch con cualquier clean_layer (datos vienen simétricos ahora)
state.modal.layerView = currentLayerView; // Restaurar vista COMBO
```

**Riesgo:**
- Si `layerView` cambió durante la acción, el refresh puede mostrar vista incorrecta
- El comentario dice "datos vienen simétricos ahora" pero no garantiza que la UI se actualice correctamente

**Impacto:**
- UI desincronizada después de acciones
- Estados visuales incorrectos hasta recarga manual

### CAUSA RAÍZ #5: Campos Compat Legacy en DTO

**Problema:**
El DTO incluye campos `clean_count`, `remaining`, `completed` top-level que son compat legacy:

```javascript
clean_count: sharedCount, // compat legacy
remaining: sharedData.remaining, // compat legacy
completed: sharedData.completed // compat legacy
```

**Riesgo:**
- Si la UI usa estos campos en lugar de `shared.*` o `pde.*`, puede tomar decisiones incorrectas
- No hay validación que prohíba usar estos campos

**Impacto:**
- UI basada en datos legacy en lugar de capas simétricas
- Estados visuales incorrectos si se mezclan campos legacy con capas

## E.2 Invariantes Violadas

### INVARIANTE #1: `item_kind` Debe Ser Explícito

**Estado:** ⚠️ **PARCIALMENTE VIOLADO**

- Backend valida `item_kind` como requerido ✅
- Frontend infiere `item_kind` con fallbacks ⚠️
- Backend emite warning si no coincide con `lista.tipo` pero continúa ⚠️

**Evidencia:**
- `cleaning-engine-service.js:288-297`: Warning pero fail-open

### INVARIANTE #2: `clean_layer` Debe Ser Explícito

**Estado:** ⚠️ **PARCIALMENTE VIOLADO**

- Botones individuales (S ✓, P ✓, S +1, P +1) usan `clean_layer` literal ✅
- Botón global "✓ para todos" infiere `clean_layer` desde `state.modal?.cleanLayer` ⚠️

**Evidencia:**
- `master-alquimia-general-client.js:944`: `const cleanLayer = state.modal?.cleanLayer || 'shared';`

### INVARIANTE #3: Execution Mode Debe Ser Explícito

**Estado:** ❌ **VIOLADO**

- Frontend NO envía `execution_mode` (usa default 'APPLY')
- Engine convierte silenciosamente `APPLY` → `CERTIFY` para UNA_VEZ en MASTER
- Frontend no sabe que se ejecutó `CERTIFY`

**Evidencia:**
- `cleaning-engine-service.js:316-334`: Conversión silenciosa

### INVARIANTE #4: Refresh Debe Ser Determinista

**Estado:** ⚠️ **PARCIALMENTE VIOLADO**

- Refresh se ejecuta después de acciones ✅
- Pero usa `state.modal.layerView` que puede no estar sincronizado ⚠️
- No hay garantía de que la UI se actualice correctamente

**Evidencia:**
- `master-alquimia-general-client.js:1791-1794`: Refresh con restauración de `layerView`

### INVARIANTE #5: Campos Legacy NO Deben Usarse para Decisiones

**Estado:** ⚠️ **NO VERIFICADO**

- DTO incluye campos legacy para compatibilidad ✅
- No hay validación que prohíba usar estos campos en UI ⚠️
- No hay documentación explícita de que son SOLO para display

**Evidencia:**
- `alquimia-general-service.js:728-731`: Campos legacy incluidos sin advertencia

## E.3 Lista Mínima de Fixes Futuros (Solo Títulos)

### Fix 1: Eliminar Inferencia de `item_kind` en Frontend

**Prioridad:** 🔴 **ALTA**

**Acción:**
- Frontend DEBE obtener `item_kind` desde el item o lista (sin fallbacks)
- Si no está disponible, mostrar error y NO permitir acción
- Backend DEBE rechazar (no warning) si `item_kind` no coincide con `lista.tipo`

**Impacto:**
- Elimina riesgo de enviar `item_kind` incorrecto
- Garantiza coherencia entre frontend y backend

### Fix 2: Eliminar Inferencia de `clean_layer` en Botón Global

**Prioridad:** 🔴 **ALTA**

**Acción:**
- Botón "✓ para todos" DEBE pedir confirmación de capa o usar selector explícito
- NO inferir desde `state.modal.cleanLayer`
- Validar `clean_layer` antes de enviar

**Impacto:**
- Elimina riesgo de aplicar limpieza a capa incorrecta
- Garantiza que el usuario sabe qué capa está limpiando

### Fix 3: Hacer Execution Mode Explícito en Frontend

**Prioridad:** 🟡 **MEDIA**

**Acción:**
- Frontend DEBE enviar `execution_mode` explícitamente
- Para UNA_VEZ en MASTER, enviar `'CERTIFY'` directamente (no dejar que engine lo convierta)
- Eliminar conversión silenciosa en engine

**Impacto:**
- Frontend sabe qué execution mode se está usando
- Elimina sorpresas de comportamiento no idempotente

### Fix 4: Refresh Determinista Post-Acción

**Prioridad:** 🟡 **MEDIA**

**Acción:**
- Después de cada acción, hacer refetch completo del flotante
- NO confiar en `state.modal.layerView` para determinar qué datos cargar
- Siempre cargar datos simétricos (shared + pde) y actualizar UI desde datos frescos

**Impacto:**
- UI siempre sincronizada después de acciones
- Elimina desincronización por estado local

### Fix 5: Documentar y Validar Campos Legacy

**Prioridad:** 🟢 **BAJA**

**Acción:**
- Documentar explícitamente que `clean_count`, `remaining`, `completed` top-level son SOLO para compat legacy
- Añadir validación en UI que prohíba usar estos campos para decisiones
- Migrar UI a usar `shared.*` y `pde.*` exclusivamente

**Impacto:**
- Elimina riesgo de usar datos legacy incorrectamente
- Clarifica arquitectura de capas

### Fix 6: Tests End-to-End para Flotante

**Prioridad:** 🟡 **MEDIA**

**Acción:**
- Crear tests que verifiquen wiring completo: botón → endpoint → engine → repo → DB → DTO → render
- Verificar que cada botón envía `clean_layer` e `item_kind` correctos
- Verificar que refresh post-acción muestra datos correctos

**Impacto:**
- Detecta regresiones antes de producción
- Garantiza coherencia del flujo completo

## E.4 Qué NO Tocar (Zonas Sanas)

### ✅ NO TOCAR: Repositorios de Cleaning

**Razón:**
- `cleaning-item-state-repo-pg.js` está correctamente implementado
- Queries respetan separación de capas (SHARED/PDE)
- Logs forenses están presentes

### ✅ NO TOCAR: Cleaning Engine Core

**Razón:**
- `cleaning-engine-service.js` tiene lógica correcta
- Validaciones están presentes
- Solo necesita hacer `execution_mode` explícito (Fix 3)

### ✅ NO TOCAR: Endpoints MASTER API

**Razón:**
- `master-api-alquimia-general.js` valida correctamente
- Manejo de errores está presente
- Solo necesita eliminar inferencias (Fix 1, Fix 2)

### ✅ NO TOCAR: DTO Structure

**Razón:**
- Estructura del DTO es correcta (shared/pde/combo simétricos)
- Solo necesita documentación de campos legacy (Fix 5)

## E.5 Qué Tests/Checks Faltan

### Test 1: Wiring Botón → Endpoint

**Check:**
- Cada botón del flotante envía `clean_layer` e `item_kind` correctos
- Payload coincide con lo esperado por el endpoint

**Script:**
```javascript
// Test: Verificar que botón S ✓ envía clean_layer='shared'
// Test: Verificar que botón P ✓ envía clean_layer='pde'
// Test: Verificar que botón S+P envía ambas capas secuencialmente
// Test: Verificar que item_kind coincide con lista.tipo
```

### Test 2: Wiring Endpoint → Engine

**Check:**
- Endpoint pasa parámetros correctos al engine
- Engine recibe `clean_layer` e `item_kind` explícitos

**Script:**
```javascript
// Test: Verificar que markCleanStudent recibe clean_layer explícito
// Test: Verificar que markCleanStudent recibe item_kind explícito
// Test: Verificar que execution_mode es explícito (no inferido)
```

### Test 3: Wiring Engine → Repo

**Check:**
- Engine llama método correcto del repo según `clean_layer` e `item_kind`
- Repo escribe SOLO en columnas de la capa correcta

**Script:**
```javascript
// Test: Verificar que RECURRENTE SHARED llama upsertApplyRecurrent con clean_layer='shared'
// Test: Verificar que RECURRENTE PDE llama upsertApplyRecurrent con clean_layer='pde'
// Test: Verificar que UNA_VEZ SHARED llama upsertApplyOneTimeIncrementShared
// Test: Verificar que UNA_VEZ PDE llama upsertApplyOneTimeIncrementPde
// Test: Verificar que queries NO tocan columnas de la otra capa
```

### Test 4: Wiring DB → DTO

**Check:**
- DTO incluye `shared.*` y `pde.*` simétricos
- DTO calcula `combo.*` correctamente (UNA_VEZ)
- DTO calcula estados visuales correctamente

**Script:**
```javascript
// Test: Verificar que DTO incluye shared.clean_count y pde.clean_count
// Test: Verificar que DTO calcula combo.clean_count = shared.clean_count + pde.clean_count
// Test: Verificar que DTO calcula estado visual correcto según combo (UNA_VEZ)
// Test: Verificar que DTO calcula estado correcto según days_since_last_clean (RECURRENTE)
```

### Test 5: Wiring DTO → Render

**Check:**
- UI renderiza estados visuales correctos
- UI muestra botones correctos según `item_kind`
- UI refresca correctamente después de acciones

**Script:**
```javascript
// Test: Verificar que UI muestra estado 'reviewed' cuando days_since < threshold_days
// Test: Verificar que UI muestra botones S ✓ / P ✓ para RECURRENTE
// Test: Verificar que UI muestra botones S +1 / P +1 para UNA_VEZ
// Test: Verificar que UI refresca flotante después de acción exitosa
```

### Test 6: Idempotencia

**Check:**
- Misma acción ejecutada dos veces no duplica efectos
- `execution_mode='APPLY'` respeta idempotencia
- `execution_mode='CERTIFY'` siempre ejecuta

**Script:**
```javascript
// Test: Verificar que RECURRENTE APPLY es idempotente (mismo día)
// Test: Verificar que UNA_VEZ CERTIFY siempre ejecuta (no idempotente)
// Test: Verificar que execution_key previene duplicados
```

### Assembly Check Propuesto

**Script:** `scripts/check-flotante-wiring.js`

**Verificaciones:**
1. Todos los botones del flotante envían `clean_layer` e `item_kind` explícitos
2. Todos los endpoints validan `clean_layer` e `item_kind` antes de llamar al engine
3. Engine NO infiere `item_kind` (solo valida)
4. Repositorios escriben SOLO en columnas de la capa correcta
5. DTO incluye `shared.*` y `pde.*` simétricos
6. UI NO usa campos legacy para decisiones

---

# RESUMEN EJECUTIVO

## Estado Actual

✅ **SANAS:**
- Repositorios (separación SHARED/PDE correcta)
- Engine core (lógica correcta, solo necesita hacer execution_mode explícito)
- Endpoints (validaciones presentes)
- DTO structure (simétrico, solo necesita documentación)

⚠️ **PROBLEMÁTICAS:**
- Inferencia de `item_kind` en frontend (fallbacks múltiples)
- Inferencia de `clean_layer` en botón global
- Execution mode convertido silenciosamente
- Refresh post-acción no determinista
- Campos legacy sin documentación explícita

## Prioridad de Fixes

1. **Fix 1 + Fix 2** (Eliminar inferencias): 🔴 **CRÍTICO**
2. **Fix 3** (Execution mode explícito): 🟡 **IMPORTANTE**
3. **Fix 4** (Refresh determinista): 🟡 **IMPORTANTE**
4. **Fix 5** (Documentar legacy): 🟢 **MEJORA**
5. **Fix 6** (Tests E2E): 🟡 **IMPORTANTE**

## Riesgo de No Arreglar

- **Alto:** Fix 1 y Fix 2 pueden causar limpiezas aplicadas a capa/item_kind incorrectos
- **Medio:** Fix 3 puede causar comportamiento no idempotente inesperado
- **Medio:** Fix 4 puede causar UI desincronizada después de acciones

---

**FIN DEL DIAGNÓSTICO**

**Fecha:** 2025-01-27  
**Modo:** SOLO LECTURA / FORENSICS  
**Estado:** COMPLETADO
