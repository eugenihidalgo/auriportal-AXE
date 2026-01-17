# DIAGNÓSTICO CANÓNICO — OVERRIDES (MASTER)
## Análisis completo del comportamiento REAL del sistema de Overrides

**Fecha:** 2026-01-17  
**Objetivo:** Diagnosticar y documentar el comportamiento real del sistema de OVERRIDES en AuriPortal (dominio MASTER) para validación con el arquitecto y redacción/corrección de OVERRIDES_CONTRACT_V1.md

---

## RESUMEN EJECUTIVO

### Qué es un Override HOY

Un override es una **capa de lectura efectiva** que permite sobrescribir valores base del sistema a nivel de alumno individual, SIN modificar el Source of Truth persistido.

**Estado actual REAL:**
- ✅ Override es capa pura de lectura (NO modifica `cleaning_item_state`)
- ✅ Override se aplica ANTES de CPM (CPM recibe valores efectivos)
- ✅ Override es scope='student' únicamente (prohibido scope='all')
- ✅ Override es independiente de RESET, CLEAN y SEED (no los lee ni modifica)
- ✅ Override es auditable (campos `reason`, `created_by`) y reversible

**NO es:**
- ❌ Mutación de estado persistido (NO modifica `cleaning_item_state`)
- ❌ Reset de ciclo (NO modifica `effective_since`)
- ❌ Limpieza (NO modifica `last_cleaned_at`, `clean_count`)
- ❌ Seed (NO crea estado)

### Qué NO hace el Override (aunque se piense que sí)

**Mitos NO confirmados:**
- ❌ **NO modifica estado persistido** (override solo afecta lectura)
- ❌ **NO bloquea CLEAN after RESET** (CLEAN no lee overrides)
- ❌ **NO afecta RESET** (RESET no lee overrides)
- ❌ **NO afecta SEED** (SEED no lee overrides)
- ❌ **NO se aplica en WRITE operations** (solo en READ)

### Qué problemas reales genera (o NO genera)

**Problemas REALES:**
- ⚠️ Overrides huérfanos posibles (override para item inexistente, no protegido por FK)
- ⚠️ Overrides pueden existir antes del seed (sin validación)
- ⚠️ Cache request-scoped NO se invalida al modificar override durante la misma request
- ⚠️ NO se valida coherencia `override_key + item_kind` (ej: `required_count` solo para `una_vez`)

**NO genera problemas:**
- ✅ Overrides NO bloquean CLEAN after RESET (CLEAN no lee overrides)
- ✅ Overrides NO producen estados incoherentes (override solo afecta cálculo, no persistencia)
- ✅ Overrides son independientes de RESET/CLEAN/SEED

---

## A) DEFINICIÓN REAL DEL OVERRIDE

### Semántica Ontológica

**Override HOY es:**
- Una **capa de lectura efectiva** que combina valores base con valores sobrescritos
- Un **metadata persistido** en tablas PostgreSQL (`student_overrides`, `student_item_overrides`)
- Un **resolver** que transforma `itemConfig` base → `effectiveConfig` antes de CPM
- **Scope='student'** únicamente (prohibido scope='all')

**Override NO es:**
- ❌ Mutación de estado (NO escribe en `cleaning_item_state`)
- ❌ Evento (NO crea eventos en `cleaning_events`)
- ❌ Señal (NO emite señales)
- ❌ Autoridad de estado (Backend calcula estado, override solo afecta parámetros)

### Dónde vive el Override

**Tablas PostgreSQL:**
1. **`student_overrides`** - Overrides de campos de estudiante (nivel, fecha_creacion, apodo)
2. **`student_item_overrides`** - Overrides de configuración de items (threshold_days, required_count, nivel, descripcion)

**Tablas que NO toca:**
- ❌ `cleaning_item_state` (NO modifica)
- ❌ `cleaning_events` (NO crea eventos)
- ❌ `items_transmutaciones` (NO modifica catálogo)

**Vida del Override:**
- Persistido en PostgreSQL (tablas dedicadas)
- Leído en runtime cuando se calcula estado (READ operations)
- NO existe en memoria como cache persistente (solo cache request-scoped)

---

## B) INVENTARIO DE CÓDIGO

### B.1. Tablas PostgreSQL

#### Tabla 1: `student_overrides`
**Archivo migración:** `database/migrations/v5.71.0-student-overrides-v1.sql` (líneas 35-57)

**Estructura:**
- `id` (UUID PRIMARY KEY)
- `student_uuid` (UUID, FK a `students.id` ON DELETE CASCADE)
- `field_key` (TEXT, whitelist: 'nivel', 'fecha_creacion', 'apodo')
- `override_value` (JSONB)
- `reason` (TEXT, opcional)
- `created_at` (TIMESTAMPTZ)
- `created_by` (TEXT, opcional)

**Constraints:**
- UNIQUE: `(student_uuid, field_key)`
- FK CASCADE: `student_uuid → students.id ON DELETE CASCADE`

#### Tabla 2: `student_item_overrides`
**Archivo migración:** `database/migrations/v5.71.0-student-overrides-v1.sql` (líneas 65-91)

**Estructura:**
- `id` (UUID PRIMARY KEY)
- `student_uuid` (UUID, FK a `students.id` ON DELETE CASCADE)
- `item_ref` (TEXT, **NO tiene FK a catálogo**)
- `override_key` (TEXT, whitelist: 'required_count', 'threshold_days', 'nivel', 'descripcion')
- `override_value` (JSONB)
- `reason` (TEXT, opcional)
- `created_at` (TIMESTAMPTZ)
- `created_by` (TEXT, opcional)

**Constraints:**
- UNIQUE: `(student_uuid, item_ref, override_key)`
- FK CASCADE: `student_uuid → students.id ON DELETE CASCADE`
- ⚠️ **NO FK para `item_ref`** → Permite overrides huérfanos (override para item inexistente)

---

### B.2. Repositorios

#### Repositorio 1: `StudentOverridesRepoPg`
**Archivo:** `src/infra/repos/student-overrides-repo-pg.js`

**Métodos:**
- `create(data, client)` - Crea override (línea 32-69)
- `update(id, data, client)` - Actualiza override (línea 81-135)
- `delete(id, client)` - Elimina override (línea 144-174)
- `getById(id, client)` - Obtiene por ID (línea 183-193)
- `getByStudentAndField(student_uuid, field_key, client)` - Obtiene por estudiante y campo (línea 200-210)
- `listByStudent(student_uuid, client)` - Lista todos los overrides de un estudiante (línea 219-230)

**Responsabilidades:**
- CRUD completo de overrides de campos de estudiante
- Validación de presencia de campos (NO valida tipos ni existencia)

#### Repositorio 2: `StudentItemOverridesRepoPg`
**Archivo:** `src/infra/repos/student-item-overrides-repo-pg.js`

**Métodos:**
- `create(data, client)` - Crea override (línea 32-69)
- `update(id, data, client)` - Actualiza override (línea 81-135)
- `delete(id, client)` - Elimina override (línea 144-174)
- `getById(id, client)` - Obtiene por ID (línea 183-193)
- `getByStudentItemAndKey(student_uuid, item_ref, override_key, client)` - Obtiene por estudiante, item y clave (línea 204-214)
- `listByStudent(student_uuid, options, client)` - Lista overrides por estudiante (opcional: filtrar por `item_ref`) (línea 225-247)

**Responsabilidades:**
- CRUD completo de overrides de configuración de items
- Validación de presencia de campos (NO valida existencia de `item_ref` en catálogo)

---

### B.3. Servicio de Resolución

#### Servicio: `OverrideResolutionService`
**Archivo:** `src/core/master/services/override-resolution-service.js`

**Funciones exportadas:**

1. **`resolveStudentField(student, field, baseValue, client)`** (línea 37-90)
   - **Propósito:** Resuelve override de campo de estudiante (nivel, fecha_creacion, apodo)
   - **Usado en:**
     - `level-engine-service.js` (línea 66) - Para obtener nivel efectivo con override

2. **`resolveItemConfigForStudent(itemConfig, student_uuid, item_ref, client)`** (línea 117-205)
   - **Propósito:** Resuelve overrides de configuración de item (threshold_days, required_count, nivel, descripcion)
   - **Usado en:**
     - `alquimia-general-service.js` (líneas 740, 1019) - Para flotante de alumnos
     - `list-projection-model.js` (línea 832) - Para list-projection con scope='student'
   - **⚠️ NO usado en:**
     - `alquimia-alumno-megalist-service.js` - Megalist NO aplica overrides actualmente

3. **`getAllOverridesForStudent(student_uuid, client)`** (línea 214-231)
   - **Propósito:** Obtiene todos los overrides de un estudiante (diagnóstico)

**Comportamiento:**
- Overrides desconocidos se ignoran silenciosamente (log WARN, línea 195-200)
- Solo 4 claves son reconocidas: `required_count`, `threshold_days`, `nivel`, `descripcion`
- Retorna copia de `itemConfig` con overrides aplicados (NO modifica original)

---

### B.4. Endpoints API

#### Endpoint 1: `/master/api/student-overrides`
**Archivo:** `src/endpoints/master-api-student-overrides.js`

**Rutas:**
- `POST /master/api/student-overrides` - Crear override (línea 67-128)
- `DELETE /master/api/student-overrides/:id` - Eliminar override (línea 134-181)
- `GET /master/api/student-overrides?student_uuid=...` - Listar overrides (línea 187-230)

**Validaciones:**
- ✅ `student_uuid` presente (NO valida formato UUID)
- ✅ `field_key` en whitelist: ['nivel', 'fecha_creacion', 'apodo']
- ❌ NO valida tipo de `override_value`

#### Endpoint 2: `/master/api/student-item-overrides`
**Archivo:** `src/endpoints/master-api-student-item-overrides.js`

**Rutas:**
- `POST /master/api/student-item-overrides` - Crear/actualizar override (UPSERT) (línea 67-178)
- `DELETE /master/api/student-item-overrides/:id` - Eliminar override (línea 184-231)
- `GET /master/api/student-item-overrides?student_uuid=...&item_ref=...` - Listar overrides (línea 237-294)

**Validaciones:**
- ✅ `student_uuid` formato UUID válido (línea 100)
- ✅ `override_key` en whitelist: ['required_count', 'threshold_days', 'nivel', 'descripcion']
- ✅ `override_value` tipo correcto según `override_key`
- ✅ `scope` = 'student' o undefined (prohibido 'all', línea 90-92)
- ❌ NO valida existencia de `item_ref` en catálogo
- ❌ NO valida coherencia `override_key + item_kind`

---

### B.5. Aplicación de Overrides

#### Lugar 1: `list-projection-model.js` (LPM)
**Archivo:** `src/core/master/services/list-projection-model.js`
**Función:** `computeListProjection()` (línea 832)

**Código relevante:**
```javascript
// Línea 829-837
if (scope === 'student' && studentId) {
  // Aplicar overrides de configuración de item
  // REGLA CONSTITUCIONAL: Overrides SOLO en scope='student'
  effectiveConfig = await resolveItemConfigForStudent(
    effectiveConfig,
    studentId,
    item.item_ref
  );
}

// Línea 840-845
const projection = computeCleaningProjection({
  cleaning_state: cleaningState,
  item_kind: item_kind,
  view_layer: view_layer,
  config: effectiveConfig // CPM recibe config CON overrides ya aplicados
});
```

**Comportamiento REAL:**
- ✅ Overrides se aplican SOLO si `scope === 'student'`
- ✅ Overrides se aplican ANTES de CPM
- ✅ CPM recibe `effectiveConfig` con overrides ya aplicados

#### Lugar 2: `alquimia-general-service.js` (Flotante)
**Archivo:** `src/services/alquimia-general-service.js`
**Función:** `getStudentsForItem()` (recurrente línea 740, una_vez línea 1019)

**Comportamiento REAL:**
- ✅ Overrides se aplican ANTES de CPM
- ✅ Cache request-scoped por `student_uuid` (Map)
- ✅ CPM recibe `effectiveConfig` con overrides ya aplicados

#### Lugar 3: `alquimia-alumno-megalist-service.js` (Megalist)
**Archivo:** `src/core/master/services/alquimia-alumno-megalist-service.js`
**Función:** `getMegalistForStudent()` (línea 449-454)

**Comportamiento REAL:**
- ❌ **NO aplica overrides** actualmente
- ❌ Usa valores base del catálogo directamente: `item.frecuencia_dias || 7`, `item.veces_limpiar || 1`
- ⚠️ **DIFERENCIA con flotante:** Flotante aplica overrides, megalist NO

---

## C) FLUJO REAL DE RESOLUCIÓN

### Flujo 1: List-Projection con scope='student'

```
GET /master/api/alquimia-general/list-projection
  ↓
computeListProjection({
  list_id,
  item_kind,
  view_layer,
  scope: 'student',  ← SOLO si scope='student'
  student_uuid
})
  ↓
Obtener item base del catálogo
  ↓
Crear itemConfig base = {
  threshold_days: item.frecuencia_dias || 7,
  required_count: item.veces_limpiar || 1,
  nivel: item.nivel || null,
  descripcion: item.descripcion || null
}
  ↓
[AQUÍ SE APLICAN OVERRIDES]
if (scope === 'student' && student_uuid) {
  effectiveConfig = await resolveItemConfigForStudent(
    itemConfig,
    student_uuid,
    item.item_ref
  );
  // Overrides se aplican aquí:
  // - Lee student_item_overrides WHERE student_uuid = ? AND item_ref = ?
  // - Aplica overrides a itemConfig (copia, no modifica original)
  // - Retorna effectiveConfig con valores sobrescritos
}
  ↓
Obtener cleaning_state bruto desde cleaning_item_state
  ↓
[CPM RECIBE effectiveConfig]
computeCleaningProjection({
  cleaning_state,
  item_kind,
  view_layer,
  config: effectiveConfig  ← CPM recibe valores con overrides ya aplicados
})
  ↓
CPM calcula estado usando:
- effectiveConfig.threshold_days (puede ser override)
- effectiveConfig.required_count (puede ser override)
  ↓
CPM retorna state_by_view_layer[view_layer] con estado calculado usando override
```

### Flujo 2: Flotante (getStudentsForItem)

```
GET /master/api/alquimia-general/items/:item_ref/students
  ↓
getStudentsForItem({
  item_ref,
  item_kind: 'recurrente' | 'una_vez',
  level_cap,
  ...
})
  ↓
Cache request-scoped: overrideCache = new Map()
  ↓
Para cada estudiante:
  ↓
Obtener cleaning_state bruto desde cleaning_item_state
  ↓
Obtener item base del catálogo
  ↓
Crear baseConfig = {
  threshold_days: item.frecuencia_dias || 7,
  required_count: item.veces_limpiar || 1,
  ...
}
  ↓
[AQUÍ SE APLICAN OVERRIDES CON CACHE]
let effectiveConfig = overrideCache.get(student_uuid);
if (!effectiveConfig) {
  effectiveConfig = await resolveItemConfigForStudent(
    baseConfig,
    student_uuid,
    item_ref
  );
  overrideCache.set(student_uuid, effectiveConfig);
}
  ↓
[CPM RECIBE effectiveConfig]
computeVisualState({
  config: effectiveConfig  ← CPM recibe valores con overrides ya aplicados
})
  ↓
CPM calcula estado usando effectiveConfig
  ↓
Retorna estado proyectado con override aplicado
```

### Flujo 3: Megalist (getMegalistForStudent)

```
GET /master/api/alquimia-alumno/megalist?student_uuid=...&view_layer=...&lista_tipo=...
  ↓
getMegalistForStudent({
  student_uuid,
  view_layer,
  lista_tipo,
  level_cap
})
  ↓
Obtener cleaning_state bruto desde cleaning_item_state
  ↓
Obtener item base del catálogo
  ↓
Crear config base = {
  threshold_days: item.frecuencia_dias || 7,  ← VALORES BASE, SIN OVERRIDES
  required_count: item.veces_limpiar || 1,
  critical_multiplier: item.critical_multiplier || 2.0
}
  ↓
[NO SE APLICAN OVERRIDES]
  ↓
[CPM RECIBE config base]
computeVisualState({
  config  ← CPM recibe valores BASE, SIN overrides
})
  ↓
CPM calcula estado usando valores base (override NO aplicado)
  ↓
Retorna state_by_view_layer con estado calculado SIN override
```

**⚠️ DIFERENCIA CRÍTICA:** Megalist NO aplica overrides actualmente (verificado en código línea 449-454), mientras que flotante y list-projection SÍ los aplican. Esta inconsistencia debe documentarse explícitamente.

---

## D) MATRIZ DE INTERACCIONES

### Tabla Cruzada: OVERRIDES × SEED × RESET × CLEAN × CPM × LPM

| Sistema | OVERRIDES lee? | OVERRIDES modifica? | Sistema lee OVERRIDES? | Sistema modifica OVERRIDES? | Relación |
|---------|---------------|-------------------|----------------------|---------------------------|----------|
| **SEED** | ❌ NO | ❌ NO | ❌ NO | ❌ NO | **Independiente** |
| **RESET** | ❌ NO | ❌ NO | ❌ NO | ❌ NO | **Independiente** |
| **CLEAN** | ❌ NO | ❌ NO | ❌ NO | ❌ NO | **Independiente** |
| **CPM** | ❌ NO (indirecto) | ❌ NO | ❌ NO (recibe effectiveConfig) | ❌ NO | **Dependencia unidireccional** (CPM recibe config con overrides ya aplicados) |
| **LPM** | ✅ SÍ | ❌ NO | ✅ SÍ (si scope='student') | ❌ NO | **Dependencia unidireccional** (LPM aplica overrides antes de CPM) |
| **Megalist** | ❌ NO | ❌ NO | ❌ NO | ❌ NO | **Independiente** (megalist NO aplica overrides actualmente) |

---

## E) CASOS LÍMITE OBLIGATORIOS

### Caso 1: Override sin estado base

**Escenario:**
- Override existe: `student_item_overrides` tiene registro con `threshold_days = 14`
- Estado NO existe: `cleaning_item_state` NO tiene registro para ese item+estudiante

**Comportamiento REAL:**
1. Override existe en BD
2. `resolveItemConfigForStudent()` lee override y retorna `effectiveConfig.threshold_days = 14`
3. `cleaning_item_state` NO existe → `cleaning_state` es `null` o `undefined`
4. CPM recibe `effectiveConfig.threshold_days = 14` pero `cleaning_state = null`
5. CPM calcula estado como `'never'` (sin estado)
6. Override NO tiene efecto hasta que exista estado

**Veredicto:** ✅ **Funciona pero es raro** (override existe pero no tiene efecto hasta seed)

---

### Caso 2: Override + Reset

**Escenario:**
- Override existe: `threshold_days = 14` (base: 7)
- Reset ejecutado: `effective_since = 2024-01-15T10:00:00Z`

**Comportamiento REAL:**
1. Override persiste (reset NO modifica overrides)
2. Reset establece `effective_since`
3. `resolveItemConfigForStudent()` lee override y retorna `effectiveConfig.threshold_days = 14`
4. CPM calcula estado usando:
   - `effective_since` (del reset)
   - `threshold_days = 14` (del override)
5. Estado resultante usa override correctamente

**Veredicto:** ✅ **Funciona correctamente** (override se aplica después de reset)

---

### Caso 3: Override + Clean después de Reset

**Escenario:**
- Override existe: `threshold_days = 14`
- Reset ejecutado: `effective_since = 2024-01-15T10:00:00Z`
- CLEAN ejecutado: `last_cleaned_at = 2024-01-15T10:05:00Z`

**Comportamiento REAL:**
1. Override persiste (clean NO modifica overrides)
2. Reset establece `effective_since`
3. CLEAN actualiza `last_cleaned_at` (clean NO lee overrides)
4. `resolveItemConfigForStudent()` lee override y retorna `effectiveConfig.threshold_days = 14`
5. CPM calcula:
   - `days_since = 0` (porque `last_cleaned_at` es reciente)
   - `threshold_days = 14` (del override)
   - Estado = `'reviewed'` (porque `0 < 14`)

**Veredicto:** ✅ **Funciona correctamente** (override se aplica después de reset+clean)

---

### Caso 4: Override + Seed

**Escenario:**
- Override existe: `threshold_days = 14`
- Seed ejecutado: crea estado con valores base

**Comportamiento REAL:**
1. Override existe antes del seed
2. Seed crea estado con valores base (`threshold_days` del catálogo)
3. Seed NO lee overrides
4. Estado creado tiene valores base (NO valores overrideados)
5. Cuando se lee estado:
   - `resolveItemConfigForStudent()` lee override y retorna `effectiveConfig.threshold_days = 14`
   - CPM calcula estado usando override

**Veredicto:** ✅ **Funciona correctamente** (seed NO aplica overrides, pero overrides se aplican en lectura)

---

### Caso 5: Override con item UNA_VEZ

**Escenario:**
- Item tipo: `una_vez`
- Override: `required_count = 5` (base: 3)

**Comportamiento REAL:**
1. Override existe: `student_item_overrides` tiene `override_key='required_count'`, `override_value=5`
2. `resolveItemConfigForStudent()` lee override y retorna `effectiveConfig.required_count = 5`
3. CPM calcula estado para `una_vez` usando:
   - `required_count = 5` (del override)
   - `clean_count` desde `cleaning_item_state`
   - Estado = `'pending'` si `clean_count < 5`, `'completed'` si `clean_count >= 5`

**Veredicto:** ✅ **Funciona correctamente** (override se aplica en UNA_VEZ)

**⚠️ RIESGO:** NO se valida que `required_count` solo aplique a `una_vez`. Se puede crear override `required_count` para `recurrente` (se ignora silenciosamente en CPM).

---

### Caso 6: Override con item RECURRENTE

**Escenario:**
- Item tipo: `recurrente`
- Override: `threshold_days = 14` (base: 7)

**Comportamiento REAL:**
1. Override existe: `student_item_overrides` tiene `override_key='threshold_days'`, `override_value=14`
2. `resolveItemConfigForStudent()` lee override y retorna `effectiveConfig.threshold_days = 14`
3. CPM calcula estado para `recurrente` usando:
   - `threshold_days = 14` (del override)
   - `days_since` desde `last_cleaned_at` y `effective_since`
   - Estado = `'reviewed'` si `days_since < 14`, `'pending'` si `14 <= days_since < 28`, `'important'` si `days_since >= 28`

**Veredicto:** ✅ **Funciona correctamente** (override se aplica en RECURRENTE)

**⚠️ RIESGO:** NO se valida que `threshold_days` solo aplique a `recurrente`. Se puede crear override `threshold_days` para `una_vez` (se ignora silenciosamente en CPM).

---

### Caso 7: Override ALL vs por alumno

**Escenario:**
- Intento de crear override con `scope='all'`

**Comportamiento REAL:**
1. Endpoint valida: `if (scope !== undefined && scope !== 'student')` → Error 400
2. Error: "Overrides solo disponibles en scope=student. En scope=all debe actualizarse el ítem base directamente."
3. Override NO se crea

**Veredicto:** ✅ **Funciona correctamente** (guards previenen scope='all')

---

### Caso 8: Override que fuerza estado final

**Escenario:**
- Item `recurrente` con `last_cleaned_at = null` (nunca limpio)
- Override: `threshold_days = 999` (muy alto)

**Comportamiento REAL:**
1. Override existe: `threshold_days = 999`
2. `resolveItemConfigForStudent()` lee override y retorna `effectiveConfig.threshold_days = 999`
3. CPM calcula:
   - `last_cleaned_at = null` → `days_since = null`
   - Estado = `'never'` (sin limpieza previa)
4. Override NO fuerza estado (CPM calcula desde contadores, override solo afecta threshold)

**Veredicto:** ✅ **Funciona correctamente** (override NO fuerza estado, solo afecta cálculo de threshold)

**⚠️ ACLARACIÓN:** Override NO puede forzar estado final (ej: "siempre limpio"). Override solo afecta `threshold_days` y `required_count`, pero el estado se calcula desde contadores reales.

---

## F) RIESGOS REALES

### Riesgos Críticos

#### 1. Override huérfano por item inexistente

**Riesgo:** Override puede existir para `item_ref` que NO existe en catálogo.

**Causa:**
- `item_ref` NO tiene FOREIGN KEY a catálogo
- Endpoint NO valida existencia de `item_ref` antes de crear override

**Efecto:**
- Override existe en BD pero NO se aplica (item no existe en catálogo)
- Silencioso (no hay error, simplemente no se aplica)

**Severidad:** ⚠️ Media (no rompe sistema, pero override no tiene efecto)

**Mitigación:**
- Override solo se aplica cuando item existe en catálogo
- Si item no existe, override simplemente no se aplica (fail-safe)

---

#### 2. Megalist NO aplica overrides

**Riesgo:** Megalist muestra valores base sin overrides, mientras que flotante y list-projection SÍ aplican overrides.

**Causa:**
- `alquimia-alumno-megalist-service.js` NO llama `resolveItemConfigForStudent()`
- Usa valores base del catálogo directamente

**Efecto:**
- Inconsistencia: flotante muestra estado con override, megalist muestra estado sin override
- Usuario puede ver estados diferentes en megalist vs flotante para el mismo item+alumno

**Severidad:** ⚠️ Media (inconsistencia visible, pero no rompe sistema)

**Estado actual:** Megalist NO aplica overrides (comportamiento verificado en código línea 449-454)

---

### Riesgos Medios

#### 3. Override antes del seed

**Riesgo:** Override puede existir antes de que `cleaning_item_state` exista.

**Causa:**
- Seed NO verifica existencia de overrides antes de crear estado
- No hay validación que prohíba crear override antes del seed

**Efecto:**
- Override existe pero NO tiene efecto hasta que exista estado
- Silencioso (no hay error, override simplemente no se aplica hasta que exista estado)

**Severidad:** ⚠️ Baja (override se aplicará cuando se cree estado)

---

#### 4. NO se valida coherencia override_key + item_kind

**Riesgo:** Se puede crear override incoherente (ej: `required_count` para `recurrente`).

**Causa:**
- Endpoint NO valida `item_kind` al crear override
- No hay validación de coherencia `override_key + item_kind`

**Efecto:**
- Override incoherente se crea exitosamente
- Override se ignora silenciosamente en CPM (override desconocido o no aplicable)

**Severidad:** ⚠️ Baja (override se ignora si no es coherente, fail-safe)

---

#### 5. Cache request-scoped NO se invalida

**Riesgo:** Si se modifica override DURANTE una request que ya cacheó, el cache NO se actualiza.

**Causa:**
- Cache es request-scoped (Map local a función)
- NO hay invalidación explícita al modificar override

**Efecto:**
- Dentro de la misma request, si se modifica override, el cache NO se actualiza
- Request siguiente verá el override actualizado (cache se recrea)

**Severidad:** ⚠️ Baja (solo afecta misma request, no persistente)

---

### Comportamientos Simplemente "Confusos" (No Riesgos)

#### 6. Override de nivel/descripcion no afecta CPM

**Comportamiento:** Overrides de `nivel` y `descripcion` existen pero NO afectan cálculo de estado.

**No es riesgo:** Estos overrides se usan para display (mostrar nivel/descripción diferente), no para cálculo de estado. CPM solo usa `threshold_days` y `required_count`.

---

## G) COSAS QUE NO EXISTEN

### Validaciones que NO existen

1. ❌ **NO se valida existencia de `item_ref`** en catálogo al crear override
2. ❌ **NO se valida `item_kind`** al crear override
3. ❌ **NO se valida coherencia `override_key + item_kind`** (ej: `required_count` solo para `una_vez`)
4. ❌ **NO se valida si alumno está pausado** al crear override
5. ❌ **NO se valida tipo de `override_value`** en student-overrides endpoint
6. ❌ **NO se valida formato UUID** en student-overrides endpoint
7. ❌ **NO hay validación de existencia de estado** antes de aplicar override

### Guards que NO existen

1. ❌ **NO hay guard que prevenga override para item inexistente**
2. ❌ **NO hay guard que prevenga override incoherente con item_kind**
3. ❌ **NO hay guard que invalide cache al modificar override**

### Contratos implícitos NO documentados

1. ❌ **NO está documentado que megalist NO aplica overrides** (inconsistencia con flotante)
2. ❌ **NO está documentado el orden exacto de resolución** (override → CPM)
3. ❌ **NO está documentado el comportamiento de overrides huérfanos**

---

## H) CONCLUSIÓN

### ¿Overrides están bien delimitados?

**Veredicto:** ✅ **Sí, overrides están bien delimitados.**

**Evidencia:**
- Un solo servicio de resolución: `override-resolution-service.js`
- Dos repositorios dedicados (student-overrides, student-item-overrides)
- Dos endpoints dedicados (no mezclados con otras funcionalidades)
- Scope='student' único (guards previenen scope='all')
- Overrides NO modifican estado persistido (solo lectura efectiva)

**NO son difusos:**
- NO hay overrides en múltiples lugares con lógica diferente
- NO hay overrides que modifiquen estado persistido
- NO hay overrides que afecten WRITE operations

---

### ¿Son capa pura de lectura?

**Veredicto:** ✅ **Sí, overrides son capa pura de lectura.**

**Evidencia:**
- Overrides NO modifican `cleaning_item_state`
- Overrides NO modifican `effective_since`
- Overrides NO modifican contadores
- Overrides solo afectan cálculo de estado (CPM), no persistencia

**Comportamiento REAL:**
- Overrides se aplican ANTES de CPM
- CPM recibe `effectiveConfig` con overrides ya aplicados
- CPM es "ciego" a overrides (solo ve valores efectivos)
- Estado persistido NO cambia por overrides

---

### ¿Se pueden cerrar con contrato limpio?

**Veredicto:** ✅ **Sí, pueden cerrarse con contrato limpio.**

**Razones:**
1. **Comportamiento bien definido:** Overrides tienen propósito claro y comportamiento predecible
2. **Independencia:** Overrides son independientes de RESET, CLEAN, SEED
3. **Observabilidad:** Overrides tienen logs estructurados y campos auditables (`reason`, `created_by`)
4. **Reversibilidad:** Overrides pueden eliminarse sin afectar estado persistido

**Inconsistencias a documentar:**
- ⚠️ Megalist NO aplica overrides (comportamiento actual, debe documentarse)
- ⚠️ Flotante y list-projection SÍ aplican overrides (comportamiento actual)

**Contrato ya existe:** `docs/contracts/OVERRIDES_CONTRACT_V1.md` - El contrato ya está cerrado y documentado, pero debe actualizarse para reflejar que megalist NO aplica overrides.

---

### ¿Bloquean CLEAN after RESET?

**Veredicto:** ❌ **NO, overrides NO bloquean CLEAN after RESET.**

**Evidencia:**
- CLEAN NO lee overrides (verificado en código `cleaning-engine-service.js`)
- Override solo afecta cálculo de estado (CPM), no capacidad de limpiar
- Override NO afecta `effective_since` ni contadores

**Comportamiento REAL:**
- RESET ejecutado → `effective_since` actualizado
- CLEAN ejecutado → `last_cleaned_at` actualizado
- Override existe → Persiste sin cambios
- CPM calcula estado → Usa override (threshold_days) para calcular estado, pero CLEAN ya se ejecutó correctamente

**⚠️ CONCLUSIÓN:** Overrides NO bloquean CLEAN after RESET. CLEAN es independiente de overrides.

---

## I) ORDEN REAL DE RESOLUCIÓN (CRÍTICO)

### Orden Exacto Documentado

```
1. ESTADO PERSISTIDO (cleaning_item_state)
   - last_cleaned_at, effective_since, clean_count, remaining, completed
   - Valores REALES persistidos en BD
   ↓
2. ITEM BASE (catálogo)
   - frecuencia_dias, veces_limpiar, nivel, descripcion
   - Valores BASE del catálogo
   ↓
3. OVERRIDE (si existe)
   - threshold_days, required_count, nivel, descripcion
   - Valores SOBRESCRITOS desde student_item_overrides
   - Se aplica ANTES de CPM
   ↓
4. EFFECTIVE CONFIG (resultado de override)
   - effectiveConfig.threshold_days = override.threshold_days || item.frecuencia_dias || 7
   - effectiveConfig.required_count = override.required_count || item.veces_limpiar || 1
   ↓
5. CPM (Cleaning Projection Model)
   - Recibe: cleaning_state + effectiveConfig
   - Calcula: state_by_view_layer usando effectiveConfig (con overrides ya aplicados)
   - CPM es "ciego" a overrides (solo ve valores efectivos)
   ↓
6. ESTADO PROYECTADO (resultado final)
   - state_by_view_layer[view_layer].state
   - Calculado usando override aplicado
```

**REGLA CONSTITUCIONAL:**
- Override se aplica ANTES de CPM
- CPM NO distingue entre valores base y valores override
- Estado persistido NO cambia por override (override solo afecta lectura)

---

### Orden REAL en cada operación

#### En READ (getStudentsForItem, list-projection):
```
Estado persistido → Item base → Override → Effective Config → CPM → Estado proyectado
```

#### En WRITE (markCleanStudent, resetStudentItemProgress):
```
Payload → Validaciones → Cleaning Engine → Estado persistido
(NINGUNA mención de overrides)
```

#### En SEED:
```
Catálogo → Validaciones → Seed → Estado persistido (valores base)
(NINGUNA mención de overrides)
```

**⚠️ CONCLUSIÓN:** Overrides solo participan en READ operations. WRITE operations (CLEAN, RESET, SEED) son completamente independientes de overrides.

---

## J) SEÑALES Y OBSERVABILIDAD

### ¿Se emiten señales al aplicar override?

**❌ NO.** Overrides NO emiten señales.

**Evidencia:**
- `override-resolution-service.js` NO llama `dispatchSignal()`
- Repositorios NO emiten señales al crear/modificar/eliminar overrides
- Endpoints NO emiten señales

**Referencia:** `docs/contracts/SIGNALS_CONTRACT_V1.md` - Señales solo se emiten desde acciones WRITE (cleaning-engine, seed). Overrides son capa de lectura.

---

### ¿Hay logs?

**✅ SÍ.** Hay logs estructurados.

**Logs al aplicar override:**
```
[OverrideResolution] Override aplicado
{
  student_uuid: "...",
  field: "threshold_days",
  base_value: 7,
  override_value: 14,
  override_id: "..."
}
```

**Logs al crear/modificar override:**
```
[MasterAPIStudentItemOverrides] Item override creado
{
  override_id: "...",
  student_uuid: "...",
  item_ref: "...",
  override_key: "threshold_days",
  traceId: "..."
}
```

**Logs al override desconocido:**
```
[OverrideResolution] Override key desconocido
{
  student_uuid: "...",
  item_ref: "...",
  override_key: "unknown_key",
  override_id: "..."
}
```

**Prefijos canónicos:**
- `[OverrideResolution]` - Logs del servicio de resolución
- `[MasterAPIStudentItemOverrides]` - Logs del endpoint
- `[StudentItemOverridesRepo]` - Logs del repositorio

---

### ¿Es observable cuándo un override está activo?

**✅ SÍ, parcialmente.**

**Observabilidad disponible:**
- ✅ Logs estructurados cuando se aplica override
- ✅ Campos auditables (`reason`, `created_by`) en BD
- ✅ Endpoint GET para listar overrides: `/master/api/student-item-overrides?student_uuid=...`

**Observabilidad faltante:**
- ❌ NO hay campo en respuesta que indique "este valor es override"
- ❌ NO hay metadatos en `state_by_view_layer` indicando si usa override
- ❌ Frontend NO puede saber directamente si un estado está overrideado

**⚠️ CONCLUSIÓN:** Override es observable en logs y BD, pero NO hay metadatos explícitos en respuestas que indiquen si un valor viene de override.

---

### ¿El frontend puede saber que un estado está overrideado?

**❌ NO directamente.**

**Comportamiento REAL:**
- Frontend recibe `state_by_view_layer` con estado calculado
- Frontend recibe `threshold_days` y `required_count` en item (pueden ser overrideados)
- Frontend NO recibe metadatos explícitos indicando "este valor es override"

**Workaround posible:**
- Frontend puede comparar `threshold_days` del item con valores esperados del catálogo
- Frontend puede consultar endpoint GET overrides para verificar si hay override activo
- **NO hay forma directa** de saber desde el estado proyectado si usa override

**⚠️ CONCLUSIÓN:** Frontend NO puede saber directamente desde `state_by_view_layer` si el estado usa override. Debe consultar overrides explícitamente si necesita saberlo.

---

## K) EFECTOS COLATERALES

### ¿Rompen el ciclo natural?

**❌ NO.** Overrides NO rompen el ciclo natural.

**Evidencia:**
- Override solo afecta `threshold_days` (cuándo considerar "pending")
- Override NO afecta `effective_since` (ciclo lo gobierna RESET)
- Override NO afecta contadores (ciclo lo gobierna CLEAN)

**Comportamiento REAL:**
- RESET marca inicio de ciclo → `effective_since` actualizado
- CLEAN marca limpieza → `last_cleaned_at` actualizado
- Override afecta cálculo de estado → CPM calcula estado usando override, pero ciclo sigue funcionando

**⚠️ CONCLUSIÓN:** Overrides NO rompen el ciclo natural. Solo afectan cálculo de estado, no el ciclo en sí.

---

### ¿Ocultan errores de seed?

**❌ NO.** Overrides NO ocultan errores de seed.

**Evidencia:**
- Override NO crea estado si no existe
- Si estado no existe, override NO tiene efecto
- Seed debe ejecutarse para crear estado, override no puede suplir esto

**Comportamiento REAL:**
- Override existe pero estado NO existe → Override NO se aplica, estado = 'never'
- Seed crea estado → Estado creado con valores base
- Override se aplica en lectura → CPM calcula estado usando override

**⚠️ CONCLUSIÓN:** Overrides NO ocultan errores de seed. Si estado no existe, override NO tiene efecto.

---

### ¿Ocultan errores de reset?

**❌ NO.** Overrides NO ocultan errores de reset.

**Evidencia:**
- Override NO modifica `effective_since`
- Reset debe ejecutarse para establecer `effective_since`
- Override solo afecta cálculo de estado después del reset

**Comportamiento REAL:**
- Reset establece `effective_since`
- Override afecta `threshold_days` usado en cálculo
- CPM calcula estado usando ambos (effective_since del reset + threshold_days del override)

**⚠️ CONCLUSIÓN:** Overrides NO ocultan errores de reset. Reset establece ciclo, override afecta cálculo.

---

### ¿Hacen imposible volver a estado limpio?

**❌ NO.** Overrides NO hacen imposible volver a estado limpio.

**Evidencia:**
- Override NO modifica `last_cleaned_at`
- CLEAN actualiza `last_cleaned_at` independientemente de override
- Estado se calcula desde `last_cleaned_at` + override

**Comportamiento REAL:**
- CLEAN ejecutado → `last_cleaned_at = NOW()`
- Override existe → `threshold_days = 14`
- CPM calcula: `days_since = 0`, `threshold_days = 14` → Estado = `'reviewed'`

**⚠️ CONCLUSIÓN:** Overrides NO hacen imposible volver a estado limpio. CLEAN actualiza contadores independientemente de override.

---

### ¿Generan estados imposibles?

**❌ NO.** Overrides NO generan estados imposibles.

**Evidencia:**
- Override solo afecta `threshold_days` y `required_count`
- Estado se calcula desde contadores REALES + override
- CPM garantiza coherencia (estado calculado desde datos reales)

**Ejemplos:**
- Estado `'reviewed'` con `days_since = 100` y `threshold_days = 999` (override) → ✅ Posible (override permite threshold alto)
- Estado `'never'` con `last_cleaned_at != null` → ❌ Imposible (CPM calcula desde contadores reales)

**⚠️ CONCLUSIÓN:** Overrides NO generan estados imposibles. Estado siempre se calcula desde contadores reales, override solo afecta thresholds.

---

## L) CONCLUSIÓN FINAL

### Si los overrides están bien delimitados

**Veredicto:** ✅ **Sí, los overrides están bien delimitados.**

**Evidencia:**
- Un solo servicio de resolución
- Dos repositorios dedicados
- Dos endpoints dedicados
- Scope='student' único
- NO modifican estado persistido

**NO son difusos:**
- NO hay overrides en múltiples lugares con lógica diferente
- NO hay overrides que modifiquen estado persistido

---

### Si son capa pura de lectura

**Veredicto:** ✅ **Sí, son capa pura de lectura.**

**Evidencia:**
- NO modifican `cleaning_item_state`
- NO modifican `effective_since`
- NO modifican contadores
- Solo afectan cálculo de estado (CPM)

---

### Si se pueden cerrar con contrato limpio

**Veredicto:** ✅ **Sí, pueden cerrarse con contrato limpio.**

**Razones:**
1. Comportamiento bien definido
2. Independencia de otros sistemas
3. Observabilidad presente
4. Reversibilidad garantizada

**Inconsistencias a documentar:**
- ⚠️ Megalist NO aplica overrides (debe documentarse explícitamente)
- ⚠️ Flotante y list-projection SÍ aplican overrides

**Contrato existente:** `docs/contracts/OVERRIDES_CONTRACT_V1.md` - Debe actualizarse para reflejar que megalist NO aplica overrides.

---

### Si bloquean CLEAN after RESET

**Veredicto:** ❌ **NO, overrides NO bloquean CLEAN after RESET.**

**Evidencia:**
- CLEAN NO lee overrides
- Override solo afecta cálculo de estado, no capacidad de limpiar
- CLEAN after RESET funciona independientemente de overrides

---

## REFERENCIA A CONTRATO CANÓNICO

Este diagnóstico documenta el comportamiento REAL del sistema. Para el contrato canónico completo, consultar:

**Referencia canónica:**
- `docs/contracts/OVERRIDES_CONTRACT_V1.md` - Contrato canónico del sistema de overrides

**Contratos relacionados:**
- `docs/contracts/RESET_CONTRACT_V1.md` - Contrato canónico del sistema de reset
- `docs/contracts/SEED_CONTRACT_V1.md` - Contrato canónico del Cleaning State Seed
- `docs/contracts/SIGNALS_CONTRACT_V1.md` - Contrato canónico del sistema de señales

**Diagnósticos relacionados:**
- `docs/DIAGNOSTICO_CLEAN_AFTER_RESET.md` - Verificación de CLEAN después de RESET
- `docs/DIAGNOSTICO_SEED_MASTER.md` - Análisis completo del sistema de seed

**NOTA CRÍTICA:**
- Este diagnóstico reemplaza y actualiza el diagnóstico anterior `docs/DIAGNOSTICO_OVERRIDES_MASTER.md`
- Este diagnóstico refleja el comportamiento REAL verificado en código actual (2026-01-17)
- Diferencia clave identificada: megalist NO aplica overrides, flotante/list-projection SÍ aplican

---

**FIN DEL DIAGNÓSTICO**
