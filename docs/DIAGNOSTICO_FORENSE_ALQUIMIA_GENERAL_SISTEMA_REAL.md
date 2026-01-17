# DIAGNÓSTICO FORENSE — ALQUIMIA GENERAL
## Sistema Real (Sin Interpretaciones Ni Contratos)

**Fecha:** 2026-01-13  
**Objetivo:** Observar, trazar y describir el sistema REAL para servir de base a contratos canónicos  
**Alcance:** Dominio MASTER — Módulo Alquimia General

---

## A) CLEANING ENGINE Y ESTADO

### 1. Cleaning Engine

**Archivo principal:** `src/core/master/services/cleaning-engine-service.js`  
**Tamaño:** ~2761 líneas

#### Funciones Públicas Principales

1. **`markCleanStudent(options, client)`** (línea 507)
   - **Inputs reales:**
     - `student_uuid` (UUID canónico, OBLIGATORIO)
     - `item_ref` (string, OBLIGATORIO)
     - `item_kind` ('recurrente' | 'una_vez', OBLIGATORIO)
     - `clean_layer` ('shared' | 'pde', default: 'shared')
     - `product_key` (default: 'pde')
     - `domain_type` (default: 'transmutation')
     - `actor_type` ('master' | 'student' | 'automation', OBLIGATORIO)
     - `actor_ref` (string, opcional)
     - `surface_key` (string, OBLIGATORIO)
     - `level_cap_override` (number, opcional)
     - `execution_mode` ('APPLY' | 'CERTIFY', default: 'APPLY')
     - `meta` (object, opcional)
   - **Validaciones realizadas:**
     - Guard UUID-only (línea 557): Rechaza `legacy_alumno_id` o `student_id`
     - Valida formato UUID (línea 601)
     - Valida campos requeridos (línea 571)
     - Valida `clean_layer` (línea 589-592)
     - Valida `item_kind` (línea 595-597)
     - Verifica coherencia `item_kind` vs `lista.tipo` (línea 691-702)
   - **Outputs reales:**
     - Retorna `Object|null`: Estado completo de `cleaning_item_state` o `null` si está pausado/no aplica
     - Estado incluye: `shared_last_cleaned_at`, `shared_clean_count`, `shared_remaining`, `shared_completed`, `pde_*` (simétrico)
   - **Qué escribe exactamente en DB:**
     - INSERT en `cleaning_events` (tabla append-only)
       - Columnas: `id`, `execution_key`, `student_id` (UUID), `item_ref`, `action_type='mark_clean'`, `clean_layer`, `item_kind`, `delta_completed`, `actor_type`, `actor_ref`, `surface_key`, `created_at`, `trace_id`, `meta`
     - UPDATE/INSERT en `cleaning_item_state` (proyección materializada)
       - Para RECURRENTE: `shared_last_cleaned_at` o `pde_last_cleaned_at` (según `clean_layer`), `shared_clean_count` o `pde_clean_count`
       - Para UNA_VEZ: `shared_completed`, `shared_remaining`, `shared_clean_count` (o `pde_*` si `clean_layer='pde'`)
   - **Qué NO escribe:**
     - NO escribe en `student_item_state` (tabla histórica, no usada en runtime) — línea 1283-1285
     - NO resuelve `legacy_alumno_id` (prohibido) — línea 557-567
   - **Flujo interno:**
     1. Verifica pausa (línea 607-615)
     2. Valida item desde catálogo (línea 618-623)
     3. Valida nivel efectivo (línea 629-681)
     4. Genera `execution_key` (línea 730)
     5. Inserta evento (línea 796)
     6. Maneja idempotencia (línea 835-933)
     7. Verifica RESET previo y reconstruye estado si aplica (línea 942-1150)
     8. Aplica proyección a `cleaning_item_state` (línea 1218-1261)
     9. Log AUDIT de señal (línea 1290-1302, NO emite señal real)

2. **`markCleanAllStudents(options, client)`** (línea 1380)
   - **Inputs reales:** Similar a `markCleanStudent` pero sin `student_uuid`
   - **Outputs reales:** `{ updated: number, skipped: number, total: number, skipped_breakdown: object }`
   - **Qué escribe:** Múltiples filas en `cleaning_events` y `cleaning_item_state` (una por estudiante activo)
   - **⚠️ Riesgo detectado:** Iteración sobre TODOS los estudiantes activos sin paginación (línea 1495-1559)

3. **`resetStudentItemProgress(options, client)`** (línea 1871)
   - **Inputs reales:**
     - `student_uuid`, `item_ref`, `item_kind` (OBLIGATORIOS)
     - `clean_layer` o `view_layer` (para derivar `clean_layer`)
     - `execution_mode` (default: 'APPLY')
   - **Validación constitucional:** Rechaza `item_kind='una_vez'` (línea 1932-1942)
   - **Qué escribe:**
     - INSERT en `cleaning_events` con `action_type='reset'`
     - UPDATE en `cleaning_item_state` estableciendo `effective_since` (NO borra datos)

4. **`incrementAllStudents(options, client)`** (línea 1621)
   - **Inputs reales:** Similar a `markCleanAllStudents` pero para `una_vez`
   - **⚠️ Comportamiento detectado:** Cambia `execution_mode` a 'CERTIFY' automáticamente si es MASTER + una_vez (línea 1649-1651)

#### Funciones Auxiliares Internas

- **`generateExecutionKey(actionType, itemRef, studentUuid, timestamp, executionMode, itemKind, cleanLayer)`** (línea 50)
  - **Formato real:**
    - APPLY (idempotente): `{action}:{item_ref}:{student_uuid}:{clean_layer}:{YYYY-MM-DD}` (RECURRENTE)
    - APPLY (idempotente): `{action}:{item_ref}:{student_uuid}:{YYYY-MM-DD}` (UNA_VEZ, sin clean_layer)
    - CERTIFY (no idempotente): `certify:{item_ref}:{student_uuid}:{ISO-timestamp}`
  - **⚠️ Observación:** RECURRENTE incluye `clean_layer` en execution_key, UNA_VEZ no (línea 66-71)

- **`isStudentPaused(studentUuid)`** (línea 80)
  - Consulta `pausas` table vía `getDefaultPausaRepo().getPausaActiva(studentUuid)`
  - Fail-open: retorna `false` si falla (línea 89-94)

- **`getStudentEffectiveLevel(studentUuid, lineKey='pde')`** (línea 105)
  - Consulta `student_level_state` vía `getDefaultStudentLevelStateRepo()`
  - Fail-open: retorna `1` si falla (línea 119-124)

- **`getLastResetForItem(studentUuid, itemRef, cleanLayer, productKey, domainType, client)`** (línea 147)
  - Consulta `cleaning_events` filtrando `action_type='reset'` y `clean_layer`
  - Retorna último evento RESET ordenado por `created_at DESC`

- **`rebaseStateFromReset(studentUuid, itemRef, cleanLayer, lastReset, productKey, domainType, traceId, client, currentCleanEvent)`** (línea 190)
  - **Inputs reales:**
    - `currentCleanEvent` (opcional): Evento de limpieza actual si se está ejecutando CLEAN post-RESET
  - **Qué hace:**
    - Obtiene TODOS los eventos post-RESET (línea 210-215)
    - Incluye `currentCleanEvent` si está presente y es >= resetAt (línea 252-260)
    - Filtra limpiezas >= resetAt usando `>=` (no `>`) (línea 264-269)
    - Reconstruye estado: `effective_since = reset.created_at`, `last_cleaned_at = última limpieza post-reset`, `clean_count = count de limpiezas post-reset`
    - **⚠️ Observación crítica:** Usa `>=` en comparación para incluir eventos en el mismo momento (línea 268)

- **`isCleanStateCoherent(currentState, event, itemKind, clean_layer, cleanedAt)`** (línea 427)
  - Verifica coherencia entre estado y evento antes de omitir por idempotencia
  - Retorna `boolean`

### 2. Cleaning State

**Tablas afectadas:**

1. **`cleaning_item_state`** (proyección materializada)
   - **Columnas relevantes:**
     - `student_id` (UUID, FK a students.id)
     - `item_ref` (text)
     - `product_key` (text, default: 'pde')
     - `domain_type` (text, default: 'transmutation')
     - `shared_last_cleaned_at` (timestamp)
     - `shared_effective_since` (timestamp, solo RECURRENTE)
     - `shared_clean_count` (integer)
     - `shared_completed` (integer, solo UNA_VEZ)
     - `shared_remaining` (integer, solo UNA_VEZ)
     - `pde_last_cleaned_at` (timestamp, simétrico a shared)
     - `pde_effective_since` (timestamp, solo RECURRENTE)
     - `pde_clean_count` (integer, simétrico)
     - `pde_completed` (integer, solo UNA_VEZ)
     - `pde_remaining` (integer, solo UNA_VEZ)
     - `meta` (jsonb)
     - `created_at`, `updated_at`
   - **Constraints:** PRIMARY KEY (`student_id`, `product_key`, `domain_type`, `item_ref`)
   - **⚠️ Observación:** `shared_effective_since` y `pde_effective_since` son NULL para UNA_VEZ (reset no aplica)

2. **`cleaning_events`** (event log append-only)
   - **Columnas relevantes:**
     - `id` (UUID, PK)
     - `execution_key` (text, para idempotencia)
     - `student_id` (UUID, FK a students.id)
     - `item_ref` (text)
     - `action_type` ('mark_clean' | 'reset' | 'set_remaining')
     - `clean_layer` ('shared' | 'pde')
     - `item_kind` ('recurrente' | 'una_vez')
     - `delta_completed` (integer, solo UNA_VEZ)
     - `set_remaining` (integer, solo UNA_VEZ)
     - `actor_type`, `actor_ref`, `surface_key`
     - `created_at`, `trace_id`, `meta`
   - **Constraints:** UNIQUE (`execution_key`, `student_id`) — línea de constraint implícito en repositorio

#### Servicios que Escriben

**ÚNICO escritor:** `cleaning-engine-service.js` a través de:
- `markCleanStudent()` → `upsertApplyRecurrent()` o `upsertApplyOneTimeIncrementShared/Pde()` en repositorio
- `resetStudentItemProgress()` → `upsertApplyReset()` en repositorio
- `setRemainingShared()` → `upsertApplyOneTimeSetRemainingShared()` en repositorio

**⚠️ Observación:** NO hay otros servicios que escriban directamente. Los repositorios encapsulan SQL.

### 3. Cleaning Layers

**Valores existentes:**

- **`clean_layer`** (POST/write): `'shared'` | `'pde'`
  - **Validación:** `validateCleanLayer()` en `cleaning-layer-constants.js` (línea 93)
  - **Prohibido:** `'combo'` (línea 53-57)
  - **Dónde se valida:**
    - `cleaning-engine-service.js:589` (antes de escribir)
    - `cleaning-layer-constants.js:53` (`validateCleanLayerNotCombo()`)

- **`view_layer`** (GET/read): `'shared'` | `'pde'` | `'combo'` | `'effective'`
  - **Validación:** `validateViewLayer()` en `cleaning-layer-constants.js` (línea 64)
  - **Coherencia con item_kind:**
    - `'effective'` SOLO válido para `item_kind='recurrente'` (línea 80-81)
    - `'combo'` SOLO válido para `item_kind='una_vez'` (línea 83-84)
  - **Validación de coherencia:** `validateViewLayerItemKindCoherence()` (línea 79)
  - **Dónde se valida:**
    - `alquimia-alumno-megalist-service.js:122` (antes de calcular estado)
    - `list-projection-model.js:715` (antes de calcular proyección)
    - `master-api-alquimia-alumno.js:130` (antes de procesar request)

**⚠️ Inconsistencias detectadas:**

- `clean_layer` y `view_layer` son conceptos distintos pero a veces se confunden en código:
  - `master-alquimia-general-client.js` mantiene `state.modal.cleanLayer` (legacy, línea 98)
  - Algunos logs usan "layer" sin especificar si es clean o view

---

## B) SEED Y ESTADOS INICIALES (CRÍTICO)

### 4. Cleaning State Seed Service

**Archivo:** `src/core/master/services/cleaning-state-seed-service.js`  
**Tamaño:** 199 líneas

**Función principal:** `ensureCleaningItemStateSeedForStudent(options, client)` (línea 27)

#### Inputs Reales

- `student_uuid` (UUID canónico, OBLIGATORIO)
- `product_key` (default: 'pde')
- `domain_type` (default: 'transmutation')
- `level_cap` (number | null): Si `null`, usa `nivel_efectivo` del estudiante (línea 46-54)
- `client` (opcional, para transacciones)

#### Cuándo se Ejecuta

**Ejecución explícita en:**
1. **`master-api-alquimia-alumno.js:178`** — ANTES de construir megalist (GET /megalist)
2. **`master-api-alquimia-alumno.js:311`** — Si estado no existe al limpiar (POST /clean)

**⚠️ Observación:** Seed se ejecuta en READ (GET) pero NO en todas las rutas que leen estado.

#### Qué Inicializa

**Query SQL INSERT (línea 73-135):**
```sql
INSERT INTO cleaning_item_state (...)
SELECT 
  student_uuid,
  item_ref,
  NULL as shared_last_cleaned_at,  -- NUNCA trabajado
  NULL as pde_last_cleaned_at,      -- NUNCA trabajado
  0 as shared_clean_count,
  0 as pde_clean_count,
  CASE 
    WHEN l.tipo = 'una_vez' AND COALESCE(i.veces_limpiar, 1) > 0 THEN 0
    WHEN l.tipo = 'una_vez' AND COALESCE(i.veces_limpiar, 1) = 0 THEN 1
    ELSE 0
  END as shared_completed,
  CASE 
    WHEN l.tipo = 'una_vez' THEN GREATEST(COALESCE(i.veces_limpiar, 1), 0)
    ELSE 0
  END as shared_remaining
FROM items_transmutaciones i
JOIN listas_transmutaciones l ON l.id = i.lista_id
WHERE (i.status = 'active' OR i.activo = true)
  AND (l.status = 'active' OR l.activo = true)
  AND i.item_ref IS NOT NULL
  AND (i.nivel IS NULL OR i.nivel <= level_cap)
  AND NOT EXISTS (
    SELECT 1 FROM cleaning_item_state s
    WHERE s.student_id = student_uuid
      AND s.item_ref = i.item_ref
  )
ON CONFLICT DO NOTHING
```

**Valores iniciales:**
- **RECURRENTE:** `shared_remaining = 0`, `shared_completed = 0`, `shared_last_cleaned_at = NULL`, `shared_effective_since = NULL` (sin reset)
- **UNA_VEZ:** `shared_remaining = veces_limpiar` (o 1 si null), `shared_completed = 0`, `shared_last_cleaned_at = NULL`

**⚠️ Riesgo detectado (línea 109-111):** UNA_VEZ inicializa `remaining = veces_limpiar`, pero si `veces_limpiar = 0`, inicializa `completed = 1` y `remaining = 1` (inconsistencia potencial).

#### Condiciones que lo Disparan

1. **GET /megalist:** SIEMPRE se ejecuta (línea 178)
2. **POST /clean:** Solo si estado no existe (línea 309-336)
3. **Nivel aplicable:** Solo items con `nivel <= level_cap` (o `nivel_efectivo` si `level_cap` es null)

#### Idempotencia

**Mecanismo:** `ON CONFLICT (student_id, product_key, domain_type, item_ref) DO NOTHING` (línea 134)

**⚠️ Riesgo detectado:**
- Si se ejecuta dos veces con diferentes `level_cap`, pueden quedar items sin seedear si:
  - Primera ejecución: `level_cap = 5` → seedea items nivel 1-5
  - Segunda ejecución: `level_cap = 10` → NO seedea items nivel 6-10 (ya existe fila para nivel 1-5, pero no para 6-10)
- **NOTA:** Esto es un riesgo teórico, no verificado en código actual.

#### Si se Puede Ejecutar Más de una Vez

**Sí, es idempotente** (línea 134). Retorna `{ inserted, skipped, total_applicable, total_existing }`.

**⚠️ Inconsistencias detectadas:**

1. **Cálculo de `skipped` (línea 160):** `skipped = existing - (total_applicable - inserted)`
   - **Lógica:** Si hay 100 items aplicables, 50 ya existen, inserta 50 → `skipped = 50 - (100 - 50) = 0` ✅
   - **Problema potencial:** Si `total_applicable` cambia (items nuevos), el cálculo de `skipped` puede ser negativo

2. **Filtros de nivel (línea 125):** `(i.nivel IS NULL OR i.nivel <= level_cap)`
   - **⚠️ Comportamiento:** Items sin nivel (`nivel IS NULL`) SIEMPRE se seedean, incluso si `level_cap = 1`

---

## C) PROYECCIONES

### 5. Cleaning Projection Model (CPM)

**Archivo:** `src/core/master/services/cleaning-projection-model.js`  
**Tamaño:** 621 líneas

#### Firma Real

**Función principal:** `computeCleaningProjection({ cleaning_state, item_kind, view_layer, config })` (línea 508)

**Inputs reales:**
- `cleaning_state` (Object):
  - `shared: { last_cleaned_at, effective_since, clean_count, remaining, completed }`
  - `pde: { last_cleaned_at, effective_since, clean_count, remaining, completed }`
- `item_kind` ('recurrente' | 'una_vez')
- `view_layer` ('shared' | 'pde' | 'combo' | 'effective')
- `config` (Object):
  - `threshold_days` (default: 7)
  - `critical_multiplier` (default: 2.0)
  - `required_count` (default: 1)

**Outputs reales:**
- `state_by_view_layer: { shared: {...}, pde: {...}, combo?: {...}, effective?: {...} }`
- `state_active: string` (estado según `view_layer` solicitada)
- `visual_state_active: string` (estado visual según `view_layer` solicitada)

**Funciones auxiliares:**
- `computeEffectiveState()` (línea 40): Calcula estado para una view_layer específica
- `computeRecurrenteState()` (línea 104): Lógica para RECURRENTE
- `computeUnaVezState()` (línea 434): Lógica para UNA_VEZ
- `computeRecurrenteLayerState()` (línea 154): Estado para una capa específica de RECURRENTE

#### Qué Calcula

**Para RECURRENTE:**
- **Estados posibles:** `'never'`, `'reseteado'`, `'pending'`, `'reviewed'`, `'important'`
- **Lógica:**
  - `never`: `last_cleaned_at === null AND effective_since === null`
  - `reseteado`: `effective_since !== null AND last_effective_clean === null` (línea 320-324)
  - `reviewed`: `days_since < threshold_days` (línea 328-330)
  - `pending`: `threshold_days <= days_since < criticalThreshold` (línea 331-333)
  - `important`: `days_since >= criticalThreshold` (línea 334-336)
- **Cálculo de `last_effective_clean`:**
  - Si hay reset: `max(last_cleaned_at, effective_since)` (línea 191-300)
  - Si NO hay reset: `last_cleaned_at` (línea 291-299)
- **Cálculo de `days_since`:**
  - `Math.floor((now - lastEffectiveCleanDate) / (1000 * 60 * 60 * 24))` (línea 232, 295)

**Para UNA_VEZ:**
- **Estados posibles:** `'pending'`, `'completed'` (visual: `'never'`, `'in_progress'`, `'completed'`, `'empowered'`)
- **Lógica (línea 464-476):**
  - `cleanCount === 0` → `visual_state = 'never'`, `state = 'pending'`
  - `cleanCount < required_count` → `visual_state = 'in_progress'`, `state = 'pending'`
  - `cleanCount >= required_count AND cleanCount < (required_count * 10)` → `visual_state = 'completed'`, `state = 'completed'`
  - `cleanCount >= (required_count * 10)` → `visual_state = 'empowered'`, `state = 'completed'`
- **⚠️ Observación:** `state` siempre es `'pending'` o `'completed'`, nunca `'never'` (aunque visual_state puede ser `'never'`)

#### Qué Asume como Input

**Asume que `cleaning_state` tiene estructura completa:**
- `shared` y `pde` siempre presentes (incluso si null/empty)
- **NO valida** que `cleaning_state` venga de `cleaning_item_state` (puede venir de proyección agregada en LPM)

**Asume que `config` tiene valores por defecto seguros:**
- `threshold_days = 7` si no viene
- `critical_multiplier = 2.0` si no viene
- `required_count = 1` si no viene

**Asume que `view_layer` ya fue validado:**
- NO valida `view_layer` internamente (se valida antes de llamar)

#### Qué NO Valida

- **NO valida** que `last_cleaned_at` sea una fecha válida (puede ser string ISO o Date)
- **NO valida** que `effective_since` sea posterior a `last_cleaned_at` (asume que el backend lo garantiza)
- **NO valida** que `clean_count` sea >= 0
- **NO valida** que `remaining` sea coherente con `completed` y `required_count`

**⚠️ Comportamientos implícitos:**

1. **Tratamiento de NULL:**
   - `last_cleaned_at === null` → calcula como "nunca trabajado"
   - `effective_since === null` → no hay reset (línea 164)

2. **Comparación de fechas (línea 228):**
   - Usa `>=` en lugar de `>` para incluir eventos en el mismo momento que el reset
   - Esto fue un hotfix (línea 226: `BUG-C HOTFIX`)

3. **Logs forenses temporales:**
   - Múltiples logs `[DIAG][CPM]`, `[FORENSICS][CPM]`, `[CPM_V2][INPUT]`, `[CPM_V2][OUTPUT]` (línea 51-88, 169-185, 197-216, 372-384)
   - **⚠️ Observación:** Estos logs son temporales y pueden saturar en producción

### 6. List Projection Model (LPM)

**Archivo:** `src/core/master/services/list-projection-model.js`  
**Tamaño:** 1048 líneas

#### Relación Real con CPM

**LPM usa CPM como base:**
- Línea 22: `import { computeCleaningProjection } from './cleaning-projection-model.js'`
- Línea 815-820: Llama a `computeCleaningProjection()` para cada item

**LPM NO duplica lógica de CPM:**
- Delega TODO cálculo de estado a CPM
- Solo calcula agregaciones y métricas

#### Cómo Calcula Estados Agregados

**Función principal:** `computeListProjection({ list_id, item_kind, view_layer, scope, student_uuid })` (línea 673)

**Scope='student':**
- Obtiene estados directos desde `cleaning_item_state` (línea 396-414)
- Aplica overrides vía `resolveItemConfigForStudent()` (línea 807-811)
- Usa CPM directamente para cada item (línea 815-820)

**Scope='all':**
- Obtiene estados de TODOS los estudiantes activos (línea 447-479)
- Calcula "peor estado" por capa usando `calculateWorstStateForLayer()` (línea 597-598)
- **⚠️ Lógica de "peor estado":**
  - RECURRENTE: NULL tiene prioridad máxima (línea 153-219)
  - UNA_VEZ: `never < partial < done` (línea 220-316)
- Usa CPM sobre el estado agregado (peor estado) (línea 815-820)

#### Casos Especiales

**Overrides (scope='student'):**
- `resolveItemConfigForStudent()` en `override-resolution-service.js`
- Aplica overrides de: `threshold_days`, `required_count`, `nivel`, `descripcion`
- **⚠️ Observación:** Overrides NO se aplican en scope='all' (línea 790-795)

**Normalización de estados legacy (línea 499-545):**
- Función `normalizeState()` interna
- Si `effective_since != null AND last_cleaned_at < effective_since` → normaliza como "sin limpieza en ciclo actual"
- **⚠️ Observación:** Esta normalización solo aplica en scope='all', NO en scope='student'

**CROSS JOIN + LEFT JOIN (línea 447-479):**
- Garantiza que TODOS los estudiantes aparecen (incluso sin estado = NULL)
- Esto asegura que estudiantes sin seed aparecen como "nunca trabajado"

---

## D) SERVICIOS AUXILIARES DE ALQUIMIA

### 7. Alquimia Alumno Megalist Service

**Archivo:** `src/core/master/services/alquimia-alumno-megalist-service.js`  
**Tamaño:** 846 líneas

**Función principal:** `getMegalistForStudent(options)` (línea 103)

#### Rol Real

**Read model canónico:** Construye megalista EXCLUSIVAMENTE desde `cleaning_item_state` (línea 5-6)

#### Inputs Reales

- `student_uuid` (UUID canónico, OBLIGATORIO)
- `view_layer` ('shared' | 'pde' | 'combo', OBLIGATORIO) — línea 114-118
- `lista_tipo` ('recurrente' | 'una_vez', OBLIGATORIO) — línea 132-142
- `levels_mode` (opcional, no usado actualmente)
- `level_cap` (number | null): Si null, usa `nivel_efectivo`

#### Outputs Reales

```javascript
{
  student: { id, email, apodo, nombre_completo, nivel_efectivo },
  summary: { total, never, important, pending, reviewed, reviewed_by_student, reviewed_by_master, percent_reviewed },
  lists: [
    {
      lista_id, lista_nombre, lista_tipo,
      items: [
        {
          item_id, item_ref, item_nombre, item_descripcion, item_nivel,
          lista_id, lista_nombre, lista_tipo,
          state_by_view_layer: { shared: {...}, pde: {...}, combo?: {...}, effective?: {...} },
          state: 'never' | 'pending' | 'reviewed' | 'important',
          visual_state: 'never' | 'pending' | 'reviewed' | 'important',
          shared: {...}, pde: {...}, combo: null,
          last_actor: 'master' | 'student' | null
        }
      ]
    }
  ],
  metrics_by_layer: { shared: {...}, pde: {...}, combo: {...} },
  reviewed: { by_student: [...], by_master: [...] },
  warnings: [...],
  context: { view_layer, lista_tipo, levels_mode, level_cap }
}
```

#### Dependencias

- `computeVisualState()` desde CPM (línea 19)
- `getDefaultCleaningItemStateRepo()` (implicado)
- `getDefaultAlquimiaCatalogRepo()` (línea 15)
- `getDefaultStudentRepo()` (línea 16)
- `getStudentEffectiveLevel()` desde cleaning-engine-service (línea 17)
- `getDefaultPausaRepo()` (línea 18)

#### Si Escribe Estado o Solo Lee

**SOLO LEE** (read model puro):
- Lee desde `cleaning_item_state` (línea 189-201)
- Lee desde catálogo para resolver nombres (línea 218-244)
- NO escribe nada

#### Si Duplica Lógica del Cleaning Engine o CPM

**NO duplica:**
- Usa CPM vía `computeVisualState()` (línea 460-560)
- Delega cálculo de estado a CPM
- Solo agrupa items por listas y calcula métricas agregadas

**⚠️ Observaciones:**

1. **Filtrado por nivel (línea 199):** `(i.nivel IS NULL OR i.nivel <= nivelCap)`
   - Items sin nivel siempre aparecen

2. **Exclusión de archivados (línea 232-337):** Verifica `status='active'` antes de renderizar
   - Items archivados NO aparecen en megalist (línea 297-309)

3. **Cálculo de `state_by_view_layer`:**
   - Calcula para TODAS las view_layers posibles (shared, pde, effective, combo)
   - Frontend consume solo la activa (línea 608)

### 8. Alquimia Report Service

**Archivo:** `src/core/master/services/alquimia-report-service.js`  
**Tamaño:** 299 líneas

**Función principal:** `buildAlquimiaReport({ student_uuid, days })` (línea 19)

#### Rol Real

Construye reporte histórico de limpiezas con dos paneles: técnico (colapsado) y humano (visible).

#### Inputs Reales

- `student_uuid` (UUID canónico, OBLIGATORIO)
- `days` (number, default: 30): Días hacia atrás

#### Outputs Reales

```javascript
{
  technical_panel: {
    visible: false,
    totals: { total_events, master_events, student_events },
    events_by_day: { 'YYYY-MM-DD': count },
    top_items_by_events: [{ item_ref, events_count }],
    dataset: { events: [...], execution_keys: [...] }
  },
  human_panel: {
    visible: true,
    grouped_by_lista: [
      {
        lista_id, lista_nombre,
        items: [{ item_ref, item_nombre, events_count, last_cleaned_at, clasificaciones }]
      }
    ],
    grouped_by_classification: [
      {
        category, subcategory, tags,
        items: [...]
      }
    ]
  },
  metadata: { days, since_date, student_uuid, total_items, total_listas }
}
```

#### Dependencias

- `resolveItemsFromCatalog()` (línea 9)
- `resolveListasFromCatalog()` (línea 9)
- `resolveListasClassificationsBatch()` (línea 9)

#### Si Escribe Estado o Solo Lee

**SOLO LEE:**
- Lee desde `cleaning_events` (línea 33-52)
- Lee desde catálogo para resolver nombres
- NO escribe nada

#### Si Duplica Lógica del Cleaning Engine o CPM

**NO duplica:**
- Solo agrupa eventos históricos
- No calcula estados (solo muestra eventos)

**⚠️ Observación:** Excluye items archivados del panel humano (línea 156-159, 180-182), pero los eventos históricos permanecen en panel técnico.

### 9. Alquimia History Resolver Service

**Archivo:** `src/core/master/services/alquimia-history-resolver-service.js`  
**Tamaño:** 335 líneas

#### Rol Real

Resolver batch de nombres y clasificaciones para historiales y reportes.

#### Funciones Principales

1. **`resolveItemsFromCatalog(itemRefs)`** (línea 19)
   - **Input:** Array de `item_ref`
   - **Output:** `Map<item_ref, item_data>`
   - **Query:** Solo items `status='active'` (línea 32-36)
   - **⚠️ Observación:** Items archivados NO se resuelven (no aparecen en mapa)

2. **`resolveListasFromCatalog(listaIds)`** (línea 65)
   - Similar a items, solo listas `status='active'`

3. **`resolveListasClassificationsBatch(listaIds)`** (línea 151)
   - Resuelve clasificaciones desde `transmutacion_lista_classifications` + `pde_classification_terms`
   - Retorna `Map<lista_id, { category, subcategory, tags }>`

4. **`buildHumanPanelForItemHistory(events, itemRef)`** (línea 226)
   - Construye panel humano para historial de un item específico
   - **⚠️ Observación:** Verifica si item está archivado consultando directamente (línea 248-252), pero aún así lo muestra en panel (línea 291-304)

#### Si Escribe Estado o Solo Lee

**SOLO LEE:**
- Lee desde catálogo y tablas de clasificación
- NO escribe nada

#### Si Duplica Lógica

**NO duplica:**
- Es un resolver puro (batch lookup)
- Usado por Report Service y History endpoints

### 10. History Generation Service

**Archivo:** `src/core/master/services/history-generation-service.js`  
**Tamaño:** 132 líneas

**Función principal:** `generateActionHistory(signalPayload)` (línea 36)

#### Rol Real

Consume señales `clean.executed` y genera `ACTION_HISTORY` inmediato.

#### Inputs Reales

- `signalPayload.student_uuid` (UUID canónico)
- `signalPayload.item_ref`
- `signalPayload.clean_layer`
- `signalPayload.trace_id` (opcional)

#### Outputs Reales

- `Object|null`: Entrada de historial creada o `null` si falla

#### Dependencias

- `getDefaultHistoryRepo()` (línea 18)
- `getDefaultAlquimiaCatalogRepo()` (línea 19)

#### Si Escribe Estado o Solo Lee

**ESCRIBE:**
- INSERT en `history_entries` (tabla de historial)
- INSERT en `history_links` (vínculo con `cleaning_event`)

#### Si Duplica Lógica

**NO duplica:**
- Solo genera narrativa desde señales
- NO calcula estados de limpieza

**⚠️ Observación:** Actualmente NO se llama desde Cleaning Engine (línea 1290-1302 de cleaning-engine-service.js muestra log AUDIT pero NO emite señal real).

### 11. History Aggregation Service

**Archivo:** `src/core/master/services/history-aggregation-service.js`  
**No leído completamente** — estructura detectada pero no analizada en detalle.

**⚠️ Pendiente:** Revisar este archivo para completar diagnóstico.

---

## E) SEÑALES Y EVENTOS

### 12. Señales Emitidas Durante Limpiezas

#### Quién las Emite

**⚠️ OBSERVACIÓN CRÍTICA:** Cleaning Engine NO emite señales reales actualmente.

**Código real (cleaning-engine-service.js:1287-1302):**
```javascript
// 8. Señal emission skipped (canonical v1 - AUDIT log only)
logWarn('AUDIT', 'Signal emission skipped (canonical v1)', {
  action: 'clean_item',
  student_uuid,
  item_ref,
  clean_layer,
  execution_key: executionKey,
  trace_id: traceId,
  ...
});
```

**⚠️ Comportamiento detectado:**
- Solo log AUDIT, NO emite señal real
- Comentario indica "canonical v1 - AUDIT log only"
- History Generation Service espera señales pero NO se llaman desde Cleaning Engine

#### Payload Esperado (si se emitiera)

**Según `history-generation-service.js:36`:**
```javascript
{
  student_uuid,  // UUID canónico
  item_ref,
  clean_layer,
  trace_id
}
```

**Según `history-signal-listener.js:35`:**
- Señal esperada: `'clean.executed'`

#### Quién las Escucha

**Listener registrado:** `history-signal-listener.js`
- **Función:** `handleHistorySignal(signalEnvelope)` (línea 31)
- **Escucha:** `signal_key === 'clean.executed'`
- **Acción:** Delega a `generateActionHistory()` (línea 59)

**⚠️ Observación:** Listener está implementado pero NO se registra automáticamente (línea 86-104 muestra `registerHistorySignalListener()` que solo hace log, no registra realmente).

### 13. History Signal Listener

**Archivo:** `src/core/master/services/history-signal-listener.js`  
**Tamaño:** 104 líneas

#### Qué Escucha

- `signal_key === 'clean.executed'` (línea 35)

#### Qué Genera

- `ACTION_HISTORY` vía `generateActionHistory()` (línea 59)

#### Qué Pasa si Falla

**Fail-open absoluto (línea 68-77):**
```javascript
catch (error) {
  logError('HistorySignalListener', 'Error procesando señal para historial (fail-open)', {...});
  // No lanzar error: la limpieza debe continuar aunque falle el historial
}
```

**⚠️ Observación:** El listener NO bloquea la limpieza si falla, pero actualmente NO se ejecuta porque no hay señales reales.

---

## F) API MASTER (ALQUIMIA)

### 14. Endpoints de Alquimia General

**Archivo:** `src/endpoints/master-api-alquimia-general.js`  
**Tamaño:** ~2654 líneas (leído parcialmente)

#### Endpoints Principales

1. **GET /master/api/alquimia-general/listas** (línea 123)
   - **Llama a:** `listListas({ onlyActive: true, tipo })`
   - **Lógica en endpoint:**
     - Normalización defensiva de classifications (línea 188-251)
     - Fail-open si classification falla (línea 238-250)
   - **Output:** `{ ok: true, listas: [...] }`

2. **POST /master/api/alquimia-general/listas** (línea 295)
   - **Llama a:** `createLista(listaData)`
   - **Lógica en endpoint:** Validación básica de `nombre` y `tipo`

3. **GET /master/api/alquimia-general/listas/:id** (línea 347)
   - **Llama a:** `getListaById(id)`, `getListWithClassification(id)`, `getListaTags(id)`
   - **Lógica en endpoint:**
     - Rechaza listas archivadas (404) (línea 358-360)
     - Resuelve classifications y tags (línea 363-406)

4. **PUT /master/api/alquimia-general/listas/:id** (línea 412)
   - **Llama a:** `updateListaMeta(id, patch)`, `updateListClassification(id, classification)`, `updateListaTags(id, tags)`
   - **Lógica en endpoint:**
     - Rechaza listas archivadas (404) (línea 418-420)
     - Actualiza tags usando TAG SOT GLOBAL v1 (línea 441-466)

5. **GET /master/api/alquimia-general/listas/:id/items** (no leído completamente)
   - **Llama a:** `listItems(listaId, { onlyActive: true })`

6. **GET /master/api/alquimia-general/list-projection** (no leído completamente)
   - **Llama a:** `computeListProjection({ list_id, item_kind, view_layer, scope, student_uuid })`

7. **POST /master/api/alquimia-general/clean** (no leído completamente)
   - **Llama a:** `markCleanStudent()` desde `alquimia-general-service.js`

8. **POST /master/api/alquimia-general/clean-all** (no leído completamente)
   - **Llama a:** `markCleanAllStudents()` o `incrementAllStudents()`

#### Qué Lógica Hay en Endpoint vs Servicio

**Endpoint hace:**
- Validación de auth (`requireAdminContext`)
- Validación de parámetros HTTP
- Normalización defensiva (classifications, tags)
- Construcción de respuesta JSON
- Manejo de errores HTTP

**Servicio hace:**
- Lógica de negocio
- Escritura en DB
- Cálculos de estado

**⚠️ Observación:** Endpoints tienen bastante lógica de transformación y normalización (especialmente en GET /listas, línea 188-251).

### 15. Endpoints de Alquimia Alumno

**Archivo:** `src/endpoints/master-api-alquimia-alumno.js`  
**Tamaño:** 492 líneas

#### Endpoints Principales

1. **GET /master/api/alquimia-alumno/megalist** (línea 112)
   - **Inputs requeridos:** `student_uuid`, `view_layer`, `lista_tipo`
   - **Validaciones:**
     - UUID format (línea 160-162)
     - `view_layer` válido (línea 130-133)
     - `lista_tipo` válido (línea 138-144)
     - Coherencia `view_layer` + `lista_tipo` (línea 149-153)
   - **Lógica en endpoint:**
     - Ejecuta seed ANTES de construir megalist (línea 178-192)
     - Llama a `getMegalistForStudent()` (línea 197-203)
   - **Output:** Estructura completa de megalist

2. **POST /master/api/alquimia-alumno/clean** (línea 209)
   - **Inputs requeridos:** `student_uuid`, `item_ref`, `item_kind`, `actor_type`, `surface_key`
   - **Validaciones:**
     - UUID format (línea 235-237)
     - `item_kind` válido (línea 240-242)
     - `clean_layer` (default: 'shared')
     - `level_cap_override` (normalización, línea 253-263)
   - **Lógica en endpoint:**
     - Valida que estado existe (línea 299-336)
     - Si no existe, ejecuta seed (línea 311-316)
     - Llama a `markCleanStudent()` (línea 340-351)
   - **Output:** `{ applied: boolean, state: {...} }`

3. **GET /master/api/alquimia-alumno/item-history** (línea 368)
   - **Inputs requeridos:** `student_uuid`, `item_ref`
   - **Llama a:** `getDefaultCleaningEventsRepo().listEventsForStudentItem()`, `buildHumanPanelForItemHistory()`
   - **Output:** Dos paneles (técnico + humano)

4. **GET /master/api/alquimia-alumno/report** (línea 441)
   - **Inputs requeridos:** `student_uuid`
   - **Llama a:** `buildAlquimiaReport({ student_uuid, days })`
   - **Output:** Reporte completo

**⚠️ Observaciones:**

1. **Seed se ejecuta en GET (línea 178):** Esto puede causar lentitud si hay muchos items nuevos
2. **Seed se ejecuta en POST si estado no existe (línea 311):** Doble seed potencial si se ejecuta POST sin GET previo
3. **Validación de nivel (línea 279-296):** Valida `level_cap_override` contra nivel del item, pero Cleaning Engine puede tener bypass MASTER

---

## G) CLIENTE JS — ALQUIMIA GENERAL (CRÍTICO)

### 16. master-alquimia-general-client.js

**Archivo:** `public/js/master/master-alquimia-general-client.js`  
**Tamaño:** 6868 líneas

#### Arquitectura General

**Estructura:**
- IIFE (Immediately Invoked Function Expression) (línea 19)
- Guard de contexto MASTER (línea 41-44)
- Estado global `state` (línea 74-111)
- Funciones de carga de datos (loadListas, loadItems, loadListProjection)
- Funciones de renderizado (renderView, renderOperativeView, renderProjectionView)
- Handlers de UI (handleCleanItem, handleVerItem, etc.)

#### Estado Interno Mantenido

**Objeto `state` (línea 74-111):**
```javascript
{
  tipoActivo: 'recurrente' | 'una_vez',
  list_id: string | null,           // Estado intencional
  listaActiva: object | null,        // Dato derivado
  listas: array,
  items: array,
  itemsSortPipeline: array,
  groups: array,
  classifications: { categories, subtypes, tags },
  modal: { item, cleanLayer },
  projection: {
    mode: 'operativa' | 'proyeccion',
    view_layer: 'shared' | 'pde' | 'combo' | 'effective',
    scope: 'all' | 'student',
    student_uuid: string | null,
    data: object | null,
    loading: boolean
  },
  students: array
}
```

**⚠️ Observación:** `state.list_id` es "estado intencional", `state.listaActiva` es "dato derivado" (comentario línea 76-77). Esto indica separación conceptual pero no siempre se respeta en código.

#### Qué Decisiones Toma

1. **Decisión de renderizado (línea 251):**
   ```javascript
   const canRender = viewState.list_id !== null;
   ```
   - **⚠️ Comportamiento:** Solo renderiza si hay `list_id` seleccionado

2. **Decisión de view_layer (línea 1437-1455):**
   ```javascript
   let activeViewLayer = state.projection.view_layer;
   if (!activeViewLayer) {
     // Defaults canónicos según item_kind
     if (itemKind === 'recurrente') {
       activeViewLayer = 'shared';
     } else if (itemKind === 'una_vez') {
       activeViewLayer = 'combo';
     }
   }
   ```
   - **⚠️ Comportamiento:** Infiere view_layer si no está definido (viola regla de no inferencia)

3. **Decisión de scope (línea 1580-1608):**
   - `scope='all'` → fuerza `student_uuid=null` (línea 1582)
   - `scope='student'` → requiere `student_uuid` (línea 1594)

#### Qué Cálculos Hace

1. **Ordenamiento de items (línea 427, 1251):**
   - Usa `applyItemsSort()` que carga pipeline desde localStorage
   - Aplica múltiples criterios de orden (order pipeline)

2. **Agrupación visual por estado (línea 1895-1933):**
   - Ordena items por estado (never, reseteado, important, pending, reviewed)
   - Añade separadores visuales entre grupos

3. **Cálculo de `clean_layer` desde `view_layer` (línea 1686-1695):**
   ```javascript
   const activeViewLayer = state.projection.view_layer || 'shared';
   let cleanLayer = 'pde'; // Reset ALL siempre PDE según contrato
   if (activeViewLayer === 'effective') {
     cleanLayer = 'pde'; // REGLA CANÓNICA
   } else if (activeViewLayer === 'shared') {
     cleanLayer = 'shared';
   } else if (activeViewLayer === 'pde') {
     cleanLayer = 'pde';
   }
   ```
   - **⚠️ Comportamiento:** Deriva `clean_layer` desde `view_layer` para reset (esto está permitido según comentario)

#### Qué Estados Infiere

**⚠️ INFERENCIAS DETECTADAS:**

1. **`item_kind` (línea 539-564):**
   ```javascript
   function getItemKindExplicit(item, lista = null) {
     const itemKind = item.item_kind || item.tipo;
     if (!itemKind && lista) {
       return lista.tipo;
     }
     return null;
   }
   ```
   - **Inferencia:** Si `item.item_kind` no existe, usa `item.tipo`, luego `lista.tipo`
   - **Comentario:** Dice "EXPLÍCITA (sin inferencias ni fallbacks)" pero SÍ infiere

2. **`view_layer` por defecto (línea 1437-1455):**
   - Infiere desde `item_kind` si no está definido

3. **Estado desde `state_by_view_layer` (línea 1896, 1921):**
   ```javascript
   const itemState = item.state_by_view_layer?.[viewLayer]?.state || 'never';
   ```
   - **Comportamiento:** Consume estado calculado (no lo calcula), pero tiene fallback `'never'`

#### Qué Asume como Verdad sin Verificar

1. **Asume que `state.projection.data` tiene estructura correcta:**
   - Línea 1796: `if (state.projection.data)` sin validar estructura interna
   - Línea 1813: `state.projection.data.metrics.reviewed_pct` sin verificar que `metrics` existe

2. **Asume que `state.listaActiva` existe cuando `canRender === true`:**
   - Línea 351: `state.listaActiva.nombre` sin verificar null

3. **Asume que `performAction()` está disponible:**
   - Múltiples checks `typeof window.performAction !== 'function'` pero NO siempre los hay
   - Línea 2281-2283: Check presente
   - Línea 3882-3884: Check presente
   - **⚠️ Inconsistencia:** Algunos handlers NO verifican antes de usar

### 17. Relación con Refresh Engine

**Código real (línea 6559-6774):**
- Adapter `setupRefreshEngineAdapter()` que conecta Refresh Engine con Alquimia General
- **Superficies registradas:**
  - `'alquimia.list-projection'` (línea 6610)
  - `'alquimia.flotante'` (línea 6611)
  - `'alquimia.megalist'` (línea 6612)

#### Qué Acciones Disparan Refresh

**Acciones que usan `performAction()`:**
1. **`alquimia.create_lista`** (línea 1976)
2. **`alquimia.create_item`** (línea 2015)
3. **`alquimia.clean_all`** (línea 2294)
4. **`alquimia.clean`** (línea 3922)
5. **`alquimia.reset`** (línea 1697, 4869)
6. **`alquimia.reset_overrides`** (línea 4962)

**⚠️ Observación:** TODAS las acciones mutantes usan `performAction()`, que internamente llama a Refresh Engine (según `perform-action.v1.js`).

#### Qué Superficies se Refrescan

**Según `perform-action.v1.js` (no leído completamente):**
- Refresh Engine resuelve `refresh_plan` desde action registry
- Ejecuta superficies declarativas
- Adapter de Alquimia General conecta superficies con funciones reales

**Superficies posibles:**
- `'alquimia.list-projection'` → `loadListProjection()`
- `'alquimia.flotante'` → `handleVerItem()` si modal abierto
- `'alquimia.megalist'` → (no hay función específica en cliente, probablemente se refresca desde otro lugar)

#### Qué Pasa si el Refresh Falla

**Código real (perform-action.v1.js, no leído completamente):**
- **⚠️ Pendiente:** Revisar manejo de errores en Refresh Engine

**Fallback manual (línea 47-94 de perform-action.v1.js):**
- `forceManualRefetch()` se ejecuta si Refresh Engine no está disponible
- Refresca flotante y list-projection manualmente

---

## H) PIPELINE REAL (NO TEÓRICO)

### 18. Pipeline Real Completo

#### Pipeline: UX Action → API → Servicio → Cleaning Engine → Proyección → Refresh → UI

**FLUJO DETALLADO (basado en código real):**

#### A) Acción de Limpieza (mark_clean)

1. **UX Action (cliente JS)**
   - **Archivo:** `master-alquimia-general-client.js:3922`
   - **Función:** `handleCleanItem()` llama a `window.performAction({ action_id: 'alquimia.clean', ... })`
   - **Input:** `{ item_ref, student_uuid, item_kind, clean_layer, ... }`
   - **Sincronía:** Async (await)

2. **performAction wrapper**
   - **Archivo:** `public/js/master/ux/perform-action.v1.js:121`
   - **Validaciones:**
     - Runtime READY (línea 129-138)
     - Action registry core disponible (línea 141-150)
     - Action ID registrado (línea 152-189)
     - Dominio coherente (línea 198-218)
     - Payload válido (línea 262-300)
   - **Construcción de endpoint/payload:** `actionDef.handler.endpointBuilder()` y `buildPayload()` (línea 225-235)
   - **Ejecución:** `fetch(endpoint, { method: 'POST', body: JSON.stringify(finalPayload) })` (línea ~300+)
   - **Sincronía:** Async (await)

3. **API Endpoint**
   - **Archivo:** `src/endpoints/master-api-alquimia-alumno.js:209`
   - **Ruta:** `POST /master/api/alquimia-alumno/clean`
   - **Validaciones:**
     - Auth (`requireAdminContext`)
     - UUID format (línea 235-237)
     - `item_kind` válido (línea 240-242)
     - Estado existe (línea 299-336, ejecuta seed si no existe)
   - **Llamada a servicio:** `markCleanStudent({ student_uuid, item_ref, item_kind, clean_layer, ... })` (línea 340)
   - **Sincronía:** Async (await)

4. **Cleaning Engine**
   - **Archivo:** `src/core/master/services/cleaning-engine-service.js:507`
   - **Flujo interno:**
     1. Verifica pausa (línea 607-615) — **Síncrono** (await)
     2. Valida item (línea 618-623) — **Síncrono** (await)
     3. Valida nivel (línea 629-681) — **Síncrono** (await)
     4. Genera execution_key (línea 730) — **Síncrono**
     5. Inserta evento (línea 796) — **Síncrono** (await, con transacción si client)
     6. Maneja idempotencia (línea 835-933) — **Síncrono** (await)
     7. Verifica RESET y reconstruye estado (línea 942-1150) — **Síncrono** (await, puede ser costoso)
     8. Aplica proyección (línea 1218-1261) — **Síncrono** (await)
     9. Log AUDIT (línea 1290-1302) — **Síncrono**
   - **Retorna:** Estado completo de `cleaning_item_state` o `null`
   - **Sincronía:** Async (await), pero pasos internos son secuenciales

5. **Señal (NO SE EMITE)**
   - **Código real:** Solo log AUDIT (línea 1290-1302)
   - **Listener:** Existe pero NO se ejecuta (no hay señal real)

6. **Proyección (NO SE CALCULA INMEDIATAMENTE)**
   - Proyección se calcula en GET posterior, NO en POST

7. **Refresh Engine**
   - **Archivo:** `perform-action.v1.js` (no leído completamente)
   - **Acción:** Resuelve `refresh_plan` desde action registry
   - **Ejecución:** Llama a superficies declarativas (ej: `'alquimia.list-projection'`, `'alquimia.flotante'`)
   - **Adapter:** `setupRefreshEngineAdapter()` en cliente JS conecta superficies con funciones reales
   - **Sincronía:** Async (await)

8. **UI Update**
   - **Cliente JS:** `loadListProjection()` o `handleVerItem()` según superficie
   - **Sincronía:** Async (await)
   - **Render:** `renderView()` actualiza DOM
   - **Sincronía:** Síncrono

#### Pasos Síncronos vs Asíncronos

**Síncronos:**
- Validaciones de formato (UUID, tipos)
- Generación de execution_key
- Logs estructurados
- Cálculos matemáticos (days_since, thresholds)
- Renderizado DOM

**Asíncronos:**
- Consultas a DB (eventos, estado, catálogo)
- Llamadas HTTP (fetch)
- Cálculos de proyección (CPM, LPM)
- Refresh de superficies

#### Dónde se Puede Romper el Pipeline

**Puntos de fallo detectados:**

1. **Runtime no READY (perform-action.v1.js:129-138):**
   - Si runtime está `'booting'` o `'broken'`, lanza error
   - **Mitigación:** Check explícito con error duro

2. **Action registry no disponible (perform-action.v1.js:141-150):**
   - Si registry core no está cargado, lanza error
   - **Mitigación:** Check explícito con error duro

3. **Estado no existe (master-api-alquimia-alumno.js:299-336):**
   - Si estado no existe, ejecuta seed
   - Si seed falla o no crea estado, retorna 400
   - **⚠️ Riesgo:** Seed puede ser lento si hay muchos items nuevos

4. **RESET previo con rebase costoso (cleaning-engine-service.js:942-1150):**
   - `rebaseStateFromReset()` obtiene TODOS los eventos post-RESET
   - Puede ser costoso si hay muchos eventos
   - **⚠️ Riesgo:** No hay límite en número de eventos consultados

5. **Proyección falla (list-projection-model.js):**
   - Si cálculo de proyección falla, refresh falla
   - **Mitigación:** Fail-open en algunos lugares, pero no todos

6. **Refresh Engine no disponible (perform-action.v1.js:47-94):**
   - Fallback manual ejecuta refetch básico
   - **⚠️ Riesgo:** Fallback puede no refrescar todas las superficies necesarias

**⚠️ Comportamientos silenciosos detectados:**

1. **Idempotencia silenciosa (cleaning-engine-service.js:835-933):**
   - Si evento ya existe, retorna estado actual sin log claro de "ya aplicado"
   - Solo log `[CLEAN][IDEMPOTENCY_OK]` (línea 918)

2. **Seed falla silenciosamente (cleaning-state-seed-service.js:182-197):**
   - Si seed falla, retorna `{ inserted: 0, ... }` sin lanzar error
   - Endpoint continúa aunque seed haya fallado

3. **Items archivados excluidos silenciosamente:**
   - Múltiples lugares excluyen items/listas archivados sin warning claro al usuario

---

## OBSERVACIONES DE RIESGO

### Riesgos Críticos

1. **Seed se ejecuta en GET /megalist (master-api-alquimia-alumno.js:178)**
   - Puede causar lentitud en primera carga
   - No hay paginación ni límite en número de items seedeados

2. **Rebase desde RESET obtiene TODOS los eventos (cleaning-engine-service.js:210-215)**
   - Query sin límite puede ser costoso
   - No hay paginación

3. **Clean-all itera sobre TODOS los estudiantes (cleaning-engine-service.js:1495-1559)**
   - Sin paginación ni límite
   - Puede ser muy costoso con muchos estudiantes

4. **Inferencias en cliente JS (master-alquimia-general-client.js:539-564, 1437-1455)**
   - Infiere `item_kind` y `view_layer` cuando no están definidos
   - Puede causar inconsistencias entre frontend y backend

5. **Señales NO se emiten (cleaning-engine-service.js:1290-1302)**
   - History Generation Service existe pero NO se ejecuta
   - Eventos de limpieza NO generan historial automático

### Inconsistencias Detectadas

1. **Clean_layer vs view_layer confundidos:**
   - `state.modal.cleanLayer` en cliente JS (legacy)
   - Algunos logs usan "layer" sin especificar

2. **Seed puede ejecutarse múltiples veces con diferentes level_cap:**
   - Primera ejecución: `level_cap=5` → seedea items 1-5
   - Segunda ejecución: `level_cap=10` → NO seedea items 6-10 (conflict)

3. **Cálculo de `skipped` en seed puede ser negativo (cleaning-state-seed-service.js:160):**
   - Fórmula: `skipped = existing - (total_applicable - inserted)`
   - Si `total_applicable` cambia, puede dar negativo

4. **Items sin nivel siempre se seedean:**
   - Query: `(i.nivel IS NULL OR i.nivel <= level_cap)`
   - Items sin nivel aparecen incluso si `level_cap=1`

### Comportamientos Implícitos No Contractuados

1. **Reset ALL siempre usa PDE (master-alquimia-general-client.js:1688):**
   - `cleanLayer = 'pde'` hardcodeado para reset ALL
   - No está documentado en contrato explícito

2. **Effective view_layer siempre deriva a PDE en reset (master-alquimia-general-client.js:1689-1690):**
   - Comentario dice "REGLA CANÓNICA" pero no está en contrato visible

3. **UNA_VEZ en MASTER cambia execution_mode a CERTIFY automáticamente (cleaning-engine-service.js:1649-1651):**
   - Comportamiento implícito, no documentado en firma de función

4. **Normalización de estados legacy solo en scope='all' (list-projection-model.js:499-545):**
   - `normalizeState()` solo se aplica en proyección ALL
   - Scope='student' no normaliza

---

## RESUMEN EJECUTIVO

### Sistema Real Observado

1. **Cleaning Engine:** Funciona con UUID-only, escribe en `cleaning_events` y `cleaning_item_state`, NO emite señales reales
2. **CPM:** Calcula estados correctamente, pero tiene logs forenses temporales que pueden saturar
3. **LPM:** Calcula proyecciones agregadas correctamente, normaliza estados legacy solo en scope='all'
4. **Seed Service:** Idempotente pero puede tener problemas con diferentes level_cap
5. **APIs:** Validan correctamente pero tienen lógica de transformación significativa
6. **Cliente JS:** Infiere valores cuando no están definidos (viola principio de no inferencia)
7. **Refresh Engine:** Existe pero no todos los lugares lo usan correctamente
8. **Señales:** NO se emiten realmente, solo logs AUDIT

### Riesgos Principales

- Performance: Seed en GET, rebase sin límites, clean-all sin paginación
- Consistencia: Inferencias en cliente, seed con diferentes level_cap
- Funcionalidad: Señales no se emiten, historial no se genera automáticamente

---

**FIN DEL DIAGNÓSTICO FORENSE**
