# DIAGNÓSTICO OVERRIDES MASTER — Análisis Completo del Sistema Real
## Análisis exhaustivo del comportamiento actual de OVERRIDES en AuriPortal (MASTER)

**Fecha:** 2026-01-13  
**Objetivo:** Diagnosticar el comportamiento REAL del sistema de OVERRIDES, sin proponer soluciones ni implementar cambios

---

## RESUMEN EJECUTIVO

### Sistema de Overrides Identificado

**EXISTEN DOS TIPOS DE OVERRIDES:**

1. **Student Overrides** (`student_overrides`)
   - Campos: `nivel`, `fecha_creacion`, `apodo`
   - Tabla: `student_overrides`
   - Identificador único: `(student_uuid, field_key)`

2. **Student Item Overrides** (`student_item_overrides`)
   - Campos: `required_count`, `threshold_days`, `nivel`, `descripcion`
   - Tabla: `student_item_overrides`
   - Identificador único: `(student_uuid, item_ref, override_key)`

### Hallazgos Críticos

**✅ COMPORTAMIENTOS CORRECTOS:**
- Overrides se aplican ANTES de CPM
- Overrides NO modifican estado persistido (`cleaning_item_state`)
- Overrides son scope='student' únicamente (prohibido scope='all')
- Hay cache de overrides por `student_uuid` en `alquimia-general-service`
- Foreign Key CASCADE elimina overrides si se borra estudiante

**❌ VALIDACIONES FALTANTES:**
- NO se valida que `student_uuid` exista en `students` (depende de FK)
- NO se valida que `item_ref` exista en catálogo
- NO se valida `item_kind` al crear override
- NO se valida `clean_layer` al crear override
- NO se valida si alumno está pausado
- NO se valida coherencia override_key + item_kind

**⚠️ RIESGOS DETECTADOS:**
- Overrides huérfanos posibles (override para item inexistente)
- Overrides huérfanos posibles (override para estudiante inexistente, pero FK previene)
- Cache NO se invalida al cambiar override
- Cache NO se invalida al reset/clean/seed
- Overrides pueden existir antes del seed (sin validación)

---

## 1️⃣ LOCALIZACIÓN DEL SISTEMA DE OVERRIDES

### 1.1. Tablas PostgreSQL

**Tabla 1: `student_overrides`**
- **Archivo migración:** `database/migrations/v5.71.0-student-overrides-v1.sql` (línea 35-57)
- **Campos:**
  - `id` (UUID PRIMARY KEY)
  - `student_uuid` (UUID, FK a `students.id` ON DELETE CASCADE)
  - `field_key` (TEXT, whitelist: 'nivel', 'fecha_creacion', 'apodo')
  - `override_value` (JSONB)
  - `reason` (TEXT, opcional)
  - `created_at` (TIMESTAMPTZ)
  - `created_by` (TEXT, opcional)
- **Constraint UNIQUE:** `(student_uuid, field_key)`
- **Índices:** `student_uuid`, `field_key`

**Tabla 2: `student_item_overrides`**
- **Archivo migración:** `database/migrations/v5.71.0-student-overrides-v1.sql` (línea 65-91)
- **Campos:**
  - `id` (UUID PRIMARY KEY)
  - `student_uuid` (UUID, FK a `students.id` ON DELETE CASCADE)
  - `item_ref` (TEXT, NO tiene FK a catálogo)
  - `override_key` (TEXT, whitelist: 'required_count', 'threshold_days', 'nivel', 'descripcion')
  - `override_value` (JSONB)
  - `reason` (TEXT, opcional)
  - `created_at` (TIMESTAMPTZ)
  - `created_by` (TEXT, opcional)
- **Constraint UNIQUE:** `(student_uuid, item_ref, override_key)`
- **Índices:** `student_uuid`, `item_ref`, `override_key`

**⚠️ OBSERVACIÓN:** `item_ref` NO tiene FOREIGN KEY a `transmutacion_item.ref`. Esto permite overrides huérfanos (override para item inexistente).

---

### 1.2. Repositorios

**Repositorio 1: `StudentOverridesRepoPg`**
- **Archivo:** `src/infra/repos/student-overrides-repo-pg.js`
- **Métodos:**
  - `create(data, client)` - Crea override (línea 32-69)
  - `update(id, data, client)` - Actualiza override (línea 81-135)
  - `delete(id, client)` - Elimina override (línea 144-174)
  - `getById(id, client)` - Obtiene por ID (línea 183-193)
  - `getByStudentAndField(student_uuid, field_key, client)` - Obtiene por estudiante y campo (línea 200-210)
  - `listByStudent(student_uuid, client)` - Lista todos los overrides de un estudiante (línea 219-230)

**Repositorio 2: `StudentItemOverridesRepoPg`**
- **Archivo:** `src/infra/repos/student-item-overrides-repo-pg.js`
- **Métodos:**
  - `create(data, client)` - Crea override (línea 32-69)
  - `update(id, data, client)` - Actualiza override (línea 81-135)
  - `delete(id, client)` - Elimina override (línea 144-174)
  - `getById(id, client)` - Obtiene por ID (línea 183-193)
  - `getByStudentItemAndKey(student_uuid, item_ref, override_key, client)` - Obtiene por estudiante, item y clave (línea 204-214)
  - `listByStudent(student_uuid, options, client)` - Lista overrides por estudiante (opcional: filtrar por `item_ref`) (línea 225-247)

---

### 1.3. Servicio de Resolución

**Servicio: `OverrideResolutionService`**
- **Archivo:** `src/core/master/services/override-resolution-service.js`

**Funciones exportadas:**
1. `resolveStudentField(student, field, baseValue, client)` (línea 37-90)
   - Resuelve override de campo de estudiante (nivel, fecha_creacion, apodo)
   - Usado en: `level-engine-service.js` (línea 66)

2. `resolveItemConfigForStudent(itemConfig, student_uuid, item_ref, client)` (línea 102-186)
   - Resuelve overrides de configuración de item (threshold_days, required_count, nivel, descripcion)
   - Usado en:
     - `alquimia-general-service.js` (línea 740, 1019)
     - `list-projection-model.js` (línea 816)

3. `getAllOverridesForStudent(student_uuid, client)` (línea 195-212)
   - Obtiene todos los overrides de un estudiante (diagnóstico)

**⚠️ OBSERVACIÓN:** `resolveItemConfigForStudent` acepta cualquier `override_key` pero solo aplica 4 claves conocidas (línea 127-182). Overrides con claves desconocidas se ignoran silenciosamente (línea 176-181).

---

### 1.4. Endpoints API

**Endpoint 1: `/master/api/student-overrides`**
- **Archivo:** `src/endpoints/master-api-student-overrides.js`
- **Rutas:**
  - `POST /master/api/student-overrides` - Crear override (línea 67-128)
  - `DELETE /master/api/student-overrides/:id` - Eliminar override (línea 134-181)
  - `GET /master/api/student-overrides?student_uuid=...` - Listar overrides (línea 187-230)
- **Autenticación:** Requiere `requireAdminContext()` (línea 73)

**Endpoint 2: `/master/api/student-item-overrides`**
- **Archivo:** `src/endpoints/master-api-student-item-overrides.js`
- **Rutas:**
  - `POST /master/api/student-item-overrides` - Crear/actualizar override (UPSERT) (línea 67-178)
  - `DELETE /master/api/student-item-overrides/:id` - Eliminar override (línea 184-231)
  - `GET /master/api/student-item-overrides?student_uuid=...&item_ref=...` - Listar overrides (línea 237-294)
- **Autenticación:** Requiere `requireAdminContext()` (línea 73)
- **Validaciones:**
  - `override_key` whitelist: `['required_count', 'threshold_days', 'nivel', 'descripcion']` (línea 105)
  - `override_value` validación de tipo según `override_key` (línea 111-127)
  - `scope` debe ser 'student' o undefined (línea 90-92)

---

### 1.5. Servicio de Reset de Overrides

**Servicio: `AlquimiaOverrideResetService`**
- **Archivo:** `src/core/master/services/alquimia-override-reset-service.js`
- **Funciones:**
  - `resetOverridesByStudentItem(options)` - Reset override por estudiante+item (línea 35-90)
  - `resetOverridesByItemAll(options)` - Reset override por item (todos estudiantes) (línea 102-146)
  - `resetOverridesByListStudent(options)` - Reset overrides por lista+estudiante (línea 159-220)
  - `resetOverridesByListAll(options)` - Reset overrides por lista (todos estudiantes) (línea 232-283)
  - `resetOverridesByScope(options)` - Función unificada (línea 298-386)

**⚠️ OBSERVACIÓN:** Reset de overrides NO afecta `cleaning_item_state` (línea 10-11). Solo elimina registros de `student_item_overrides`.

---

## 2️⃣ VALIDACIONES EXISTENTES

### 2.1. Validaciones en Creación de Overrides

**Archivo:** `src/endpoints/master-api-student-item-overrides.js` (línea 67-178)

| Validación | ¿Existe? | Código | Notas |
|------------|----------|--------|-------|
| `student_uuid` formato UUID | ✅ SÍ | Línea 99-102 | Regex UUID válido |
| `student_uuid` existe en `students` | ❌ NO | - | Depende de FK constraint (CASCADE elimina si se borra) |
| `item_ref` no vacío | ✅ SÍ | Línea 94 | Validación de presencia |
| `item_ref` existe en catálogo | ❌ NO | - | **RIESGO: Override huérfano** |
| `override_key` en whitelist | ✅ SÍ | Línea 105-108 | `['required_count', 'threshold_days', 'nivel', 'descripcion']` |
| `override_value` tipo correcto | ✅ SÍ | Línea 111-127 | Number para numéricos, string para descripcion |
| `override_value` número positivo | ✅ SÍ (parcial) | Línea 115 | Solo para numéricos (puede ser 0) |
| `item_kind` válido | ❌ NO | - | No se valida coherencia override_key + item_kind |
| `clean_layer` válido | ❌ NO | - | No aplica (overrides no dependen de layer) |
| Alumno pausado | ❌ NO | - | No se verifica |
| `scope` = 'student' | ✅ SÍ | Línea 90-92 | Prohibido scope='all' |

**Archivo:** `src/endpoints/master-api-student-overrides.js` (línea 67-128)

| Validación | ¿Existe? | Código | Notas |
|------------|----------|--------|-------|
| `student_uuid` formato UUID | ❌ NO | - | Solo valida presencia (línea 89) |
| `student_uuid` existe en `students` | ❌ NO | - | Depende de FK constraint |
| `field_key` en whitelist | ✅ SÍ | Línea 94-97 | `['nivel', 'fecha_creacion', 'apodo']` |
| `override_value` tipo correcto | ❌ NO | - | No valida tipo |

---

### 2.2. Validaciones en Repositorios

**Archivo:** `src/infra/repos/student-item-overrides-repo-pg.js`

| Validación | ¿Existe? | Código | Notas |
|------------|----------|--------|-------|
| `student_uuid` presente | ✅ SÍ | Línea 35 | Solo valida presencia |
| `item_ref` presente | ✅ SÍ | Línea 35 | Solo valida presencia |
| `override_key` presente | ✅ SÍ | Línea 35 | Solo valida presencia |
| `override_value` presente | ✅ SÍ | Línea 35 | Solo valida presencia |
| Unicidad | ✅ SÍ | Línea 58-59 | PostgreSQL constraint UNIQUE |

**⚠️ CONCLUSIÓN:** Repositorios solo validan presencia de campos requeridos. Validaciones de negocio (whitelist, tipos, existencia) están en endpoints.

---

### 2.3. Validaciones en Resolución de Overrides

**Archivo:** `src/core/master/services/override-resolution-service.js`

| Validación | ¿Existe? | Código | Notas |
|------------|----------|--------|-------|
| `student_uuid` presente | ✅ SÍ (parcial) | Línea 103 | Log WARN si falta, retorna itemConfig |
| `item_ref` presente | ✅ SÍ (parcial) | Línea 103 | Log WARN si falta, retorna itemConfig |
| `itemConfig` presente | ✅ SÍ (parcial) | Línea 103 | Log WARN si falta, retorna `{}` |
| `override_key` conocido | ⚠️ PARCIAL | Línea 127-182 | Overrides desconocidos se ignoran silenciosamente (WARN) |

**⚠️ CONCLUSIÓN:** Resolución es "fail-safe": si faltan parámetros o hay overrides desconocidos, retorna valor base sin error.

---

## 3️⃣ CAMPOS OVERRIDEABLES REALES

### 3.1. Student Overrides (Campos de Alumno)

**Campos permitidos:**
- `nivel` (number) - Nivel del estudiante
- `fecha_creacion` (Date/string/number) - Fecha de creación
- `apodo` (string) - Apodo del estudiante

**Dónde se usa:**
- `resolveStudentField()` en `level-engine-service.js` (línea 66)
- Override de nivel afecta cálculo de nivel efectivo

**Whitelist:** Línea 94 de `master-api-student-overrides.js`

---

### 3.2. Student Item Overrides (Configuración de Items)

**Campos permitidos:**
- `required_count` (number ≥ 0) - Veces que debe limpiarse (una_vez)
- `threshold_days` (number ≥ 0) - Días para considerar "reviewed" (recurrente)
- `nivel` (number) - Nivel del item
- `descripcion` (string) - Descripción del item

**Whitelist:** Línea 105 de `master-api-student-item-overrides.js`

**⚠️ OBSERVACIÓN:** `override_key` puede ser 'nivel' o 'descripcion', pero estos campos no se usan directamente en CPM. Solo `threshold_days` y `required_count` afectan cálculo de estado.

**Dónde se aplica:**
- `resolveItemConfigForStudent()` en `override-resolution-service.js` (línea 102-186)
- Se usa en:
  - `alquimia-general-service.js` (megalist, flotante) - línea 740, 1019
  - `list-projection-model.js` (list-projection) - línea 816

**Dónde se ignora:**
- Overrides desconocidos se ignoran con WARN (línea 176-181)
- Overrides de claves no reconocidas no se aplican

---

## 4️⃣ MOMENTO EXACTO DE APLICACIÓN

### 4.1. Flujo Real del Pipeline

**Flujo completo identificado:**

```
1. GET /master/api/alquimia-general/items/:item_ref/students
   ↓
2. alquimia-general-service.js → getStudentsForItem()
   ↓
3. Obtener estado bruto de cleaning_item_state
   ↓
4. Obtener item base del catálogo
   ↓
5. [AQUÍ SE APLICAN OVERRIDES]
   resolveItemConfigForStudent(itemConfig, student_uuid, item_ref)
   → effectiveConfig = { ...itemConfig, ...overrides }
   ↓
6. [CPM RECIBE effectiveConfig]
   computeVisualState({ config: effectiveConfig, ... })
   → computeCleaningProjection({ item_config: effectiveConfig, ... })
   ↓
7. CPM calcula estado usando effectiveConfig.threshold_days
   ↓
8. Retorna estado proyectado
```

---

### 4.2. Aplicación en alquimia-general-service.js

**Archivo:** `src/services/alquimia-general-service.js`

**Función: `getStudentsForItem()` (recurrente)**
- **Línea 712-746:** Cache de overrides por `student_uuid`
- **Línea 738-745:** Resuelve overrides ANTES de CPM
- **Línea 753-760:** CPM recibe `effectiveConfig` (con overrides ya aplicados)

**Código relevante:**
```javascript
// Línea 712-746
const overrideCache = new Map();

// Para cada estudiante:
let effectiveConfig = overrideCache.get(student.student_uuid);
if (!effectiveConfig) {
  effectiveConfig = await resolveItemConfigForStudent(
    baseConfig,
    student.student_uuid,
    itemRef
  );
  overrideCache.set(student.student_uuid, effectiveConfig);
}

// Línea 753-760
const visualStateResult = computeVisualState({
  // ...
  config: effectiveConfig // CPM recibe config CON overrides ya aplicados
});
```

**Función: `getStudentsForItem()` (una_vez)**
- **Línea 996-1025:** Cache de overrides por `student_uuid`
- **Línea 1017-1025:** Resuelve overrides ANTES de CPM
- **Línea 1030-1037:** CPM recibe `effectiveConfigUnaVez`

---

### 4.3. Aplicación en list-projection-model.js

**Archivo:** `src/core/master/services/list-projection-model.js`

**Función: `computeListProjection()`**
- **Línea 816-821:** Resuelve overrides SOLO si `scope === 'student'`
- **Línea 823-829:** CPM recibe `effectiveConfig` (con overrides ya aplicados)

**Código relevante:**
```javascript
// Línea 814-821
if (scope === 'student' && studentId) {
  // Aplicar overrides de configuración de item
  effectiveConfig = await resolveItemConfigForStudent(
    effectiveConfig,
    studentId,
    item.item_ref
  );
}

// Línea 823-829
const projection = computeCleaningProjection({
  // ...
  config: effectiveConfig // CPM recibe config CON overrides ya aplicados
});
```

**⚠️ OBSERVACIÓN:** En `scope='all'`, NO se aplican overrides (línea 800-801). List-projection ALL muestra valores base sin personalizaciones.

---

### 4.4. ¿CPM Sabe que un Valor es Override?

**❌ NO.** CPM recibe `item_config` con valores ya sobrescritos. CPM NO distingue entre valores base y valores override.

**Código relevante:**
- `cleaning-projection-model.js` recibe `item_config` (línea 46)
- CPM usa `item_config.threshold_days` directamente (línea 47)
- CPM NO recibe metadatos de "este valor es override"

**⚠️ CONCLUSIÓN:** CPM es "ciego" a overrides. Solo ve valores efectivos.

---

## 5️⃣ OVERRIDES Y RESET

### 5.1. ¿Un Override Afecta al Reset?

**❌ NO.** Reset NO lee overrides.

**Evidencia:**
- `resetStudentItemProgress()` en `cleaning-engine-service.js` NO llama `resolveItemConfigForStudent()`
- Reset solo modifica `effective_since` (según `RESET_CONTRACT_V1.md`)
- Reset NO usa `threshold_days` (no importa si es override o base)

**⚠️ CONCLUSIÓN:** Overrides NO afectan al reset. Reset es independiente de overrides.

---

### 5.2. ¿Un Reset Invalida Overrides?

**❌ NO.** Reset NO elimina overrides.

**Evidencia:**
- `resetStudentItemProgress()` NO modifica `student_item_overrides`
- Reset solo modifica `cleaning_item_state`
- Overrides persisten después del reset

**⚠️ CONCLUSIÓN:** Reset NO invalida overrides. Overrides permanecen después del reset.

---

### 5.3. ¿Overrides Alteran effective_since?

**❌ NO.** Overrides NO modifican `effective_since`.

**Evidencia:**
- Overrides solo afectan `item_config` (threshold_days, required_count, nivel, descripcion)
- `effective_since` está en `cleaning_item_state`, NO se modifica por overrides
- Overrides son capa de lectura efectiva (línea 9 de `override-resolution-service.js`)

**⚠️ CONCLUSIÓN:** Overrides NO alteran `effective_since`. Overrides solo afectan cálculo de estado (CPM).

---

### 5.4. ¿Overrides Alteran Contadores?

**❌ NO.** Overrides NO modifican contadores (`clean_count`, `last_cleaned_at`).

**Evidencia:**
- Overrides solo afectan `item_config` (valores base del item)
- Contadores están en `cleaning_item_state`, NO se modifica por overrides
- Overrides son capa de lectura efectiva

**⚠️ CONCLUSIÓN:** Overrides NO alteran contadores. Overrides solo afectan cálculo de estado (CPM).

---

### 5.5. ¿Overrides Pueden Dejar un Ítem "Bloqueado"?

**❌ NO (por diseño).** Overrides NO bloquean limpieza.

**Evidencia:**
- Overrides solo afectan cálculo de estado (CPM)
- CLEAN no lee overrides (solo usa `item_kind` y `clean_layer`)
- Overrides NO afectan `effective_since` ni contadores

**⚠️ CONCLUSIÓN:** Overrides NO pueden bloquear limpieza. Overrides solo afectan visualización del estado.

---

### 5.6. Override + RESET → Estado Correcto?

**✅ SÍ.** Estado es correcto.

**Flujo:**
1. Override existe: `threshold_days = 14` (base: 7)
2. Reset ejecutado: `effective_since = 2024-01-15T10:00:00Z`
3. Override persiste (no se elimina)
4. CPM calcula estado usando `threshold_days = 14` (override)
5. Estado resultante usa override correctamente

---

### 5.7. Override + RESET + CLEAN → Estado Correcto?

**✅ SÍ.** Estado es correcto.

**Flujo:**
1. Override existe: `threshold_days = 14`
2. Reset ejecutado: `effective_since = 2024-01-15T10:00:00Z`
3. CLEAN ejecutado: `last_cleaned_at = 2024-01-15T10:05:00Z`
4. CPM calcula: `days_since = 0`, `threshold_days = 14` (override)
5. Estado = `'reviewed'` (porque `0 < 14`)

**⚠️ CONCLUSIÓN:** Override se aplica correctamente después de RESET+CLEAN.

---

## 6️⃣ OVERRIDES Y CLEAN AFTER RESET

### 6.1. ¿Se Puede Limpiar un Ítem Reseteado con Override Activo?

**✅ SÍ.** Override NO bloquea limpieza.

**Evidencia:**
- `markCleanStudent()` NO lee overrides
- CLEAN solo usa `item_kind` y `clean_layer`
- Override no afecta capacidad de limpiar

**⚠️ CONCLUSIÓN:** Override activo NO impide limpiar ítem reseteado.

---

### 6.2. ¿Override Puede Bloquear la Limpieza?

**❌ NO.** Override NO puede bloquear limpieza.

**Evidencia:**
- Override solo afecta cálculo de estado (CPM)
- CLEAN NO valida overrides
- Override NO afecta `effective_since` ni contadores

---

### 6.3. ¿Override Puede Producir Estados Incoherentes Tras Limpiar?

**❌ NO (por diseño).** Override solo afecta cálculo de estado, no persistencia.

**Evidencia:**
- Override afecta `threshold_days` usado en CPM
- CPM calcula estado desde contadores + override
- Contadores se actualizan correctamente en CLEAN
- Estado resultante es coherente con override

**⚠️ CONCLUSIÓN:** Override NO produce estados incoherentes. Estado es siempre coherente con override aplicado.

---

## 7️⃣ OVERRIDES Y CASOS ALL (MASIVOS)

### 7.1. CLEAN ALL → ¿Aplica Overrides por Alumno?

**✅ SÍ.** CLEAN ALL aplica overrides por alumno.

**Evidencia:**
- `markCleanAllStudents()` llama `markCleanStudent()` por cada estudiante
- `markCleanStudent()` NO lee overrides (solo escribe estado)
- Overrides se aplican en READ (getStudentsForItem), NO en WRITE (markCleanStudent)

**⚠️ CONCLUSIÓN:** Overrides NO se aplican durante CLEAN ALL (es WRITE). Overrides se aplican después en READ (cuando se consulta estado).

---

### 7.2. ¿Existe Override Global?

**❌ NO.** No existe override global.

**Evidencia:**
- Todos los overrides son scope='student' (línea 90-92 de `master-api-student-item-overrides.js`)
- No hay tabla de overrides globales
- No hay campo `scope='all'` permitido

**⚠️ CONCLUSIÓN:** Overrides son SOLO por estudiante. No existe override global.

---

### 7.3. ¿Overrides Afectan el Skip/Updated en CLEAN ALL?

**❌ NO.** Overrides NO afectan skip/updated.

**Evidencia:**
- `markCleanAllStudents()` NO lee overrides
- Skip/updated se basa en validaciones de nivel, pausa, etc.
- Override NO afecta estas validaciones

---

### 7.4. ¿Overrides Pueden Romper CLEAN ALL?

**❌ NO.** Overrides NO pueden romper CLEAN ALL.

**Evidencia:**
- CLEAN ALL NO lee overrides
- Override NO afecta capacidad de limpiar
- Override NO afecta validaciones de nivel/pausa

**⚠️ CONCLUSIÓN:** Overrides son "inocuos" para WRITE operations. Solo afectan READ (cálculo de estado).

---

## 8️⃣ CACHE Y EFECTOS SECUNDARIOS (CRÍTICO)

### 8.1. ¿Se Cachean los Overrides?

**✅ SÍ.** Hay cache de overrides.

**Ubicación:** `src/services/alquimia-general-service.js`

**Cache 1: Recurrente** (línea 712-746)
- **Tipo:** `Map<student_uuid, effectiveConfig>`
- **Scope:** Función `getStudentsForItem()` (recurrente)
- **Clave:** `student_uuid`
- **Valor:** `effectiveConfig` (itemConfig con overrides aplicados)

**Cache 2: Una_vez** (línea 996-1025)
- **Tipo:** `Map<student_uuid, effectiveConfigUnaVez>`
- **Scope:** Función `getStudentsForItem()` (una_vez)
- **Clave:** `student_uuid`
- **Valor:** `effectiveConfigUnaVez`

**⚠️ OBSERVACIÓN:** Cache es por `student_uuid` únicamente. NO hay cache por `item_ref`.

---

### 8.2. ¿Se Invalidan al Cambiar Override?

**❌ NO.** Cache NO se invalida al cambiar override.

**Evidencia:**
- Cache es local a la función (Map temporal)
- Cache se crea en cada llamada a `getStudentsForItem()`
- Cache solo persiste durante la ejecución de la función
- No hay invalidación explícita

**⚠️ CONCLUSIÓN:** Cache es "request-scoped". Se invalida automáticamente al terminar la request. Pero dentro de la misma request, si se llama `getStudentsForItem()` múltiples veces, el cache persiste.

**⚠️ RIESGO:** Si se modifica un override DURANTE una request que ya cacheó, el cache NO se actualiza.

---

### 8.3. ¿Se Invalidan al Reset?

**❌ NO.** Cache NO se invalida al reset.

**Evidencia:**
- Reset NO modifica overrides
- Cache es independiente de reset
- Cache solo se crea en READ operations

**⚠️ CONCLUSIÓN:** Reset NO afecta cache (porque reset NO modifica overrides).

---

### 8.4. ¿Se Invalidan al Seed?

**❌ NO.** Cache NO se invalida al seed.

**Evidencia:**
- Seed NO modifica overrides
- Cache es independiente de seed
- Cache solo se crea en READ operations

**⚠️ CONCLUSIÓN:** Seed NO afecta cache (porque seed NO modifica overrides).

---

### 8.5. Efectos Secundarios del Cache

**Efectos positivos:**
- Reduce lookups duplicados en la misma request
- Mejora rendimiento en `getStudentsForItem()` cuando hay múltiples estudiantes

**Efectos negativos:**
- Si se modifica override DURANTE una request, cache NO se actualiza
- Cache NO se comparte entre requests (es local a función)

**⚠️ CONCLUSIÓN:** Cache es "request-scoped" y temporal. No hay efectos secundarios persistentes, pero puede causar inconsistencias dentro de la misma request si se modifican overrides.

---

## 9️⃣ OVERRIDES HUÉRFANOS Y SEEDS

### 9.1. ¿Puede Existir Override para un Ítem que No Existe?

**✅ SÍ.** Es posible.

**Evidencia:**
- `item_ref` NO tiene FOREIGN KEY a catálogo (línea 68 de migración)
- Endpoint NO valida que `item_ref` exista (línea 94 solo valida presencia)
- No hay validación de existencia de item en repositorio

**⚠️ RIESGO:** Se puede crear override para `item_ref = 'item_inexistente'` y funcionará "silenciosamente" (no se aplicará porque el item no existe en catálogo, pero el override sí existe en BD).

---

### 9.2. ¿Puede Existir Override para Alumno Inexistente?

**❌ NO (protegido por FK).** Foreign Key CASCADE previene esto.

**Evidencia:**
- `student_uuid` tiene FK a `students.id` ON DELETE CASCADE (línea 37, 67 de migración)
- PostgreSQL rechaza INSERT si `student_uuid` no existe
- Si se borra estudiante, overrides se eliminan automáticamente

**⚠️ CONCLUSIÓN:** FK protege contra overrides huérfanos por estudiante.

---

### 9.3. ¿Puede Existir Override Creado Antes del Seed?

**✅ SÍ.** Es posible.

**Evidencia:**
- Seed NO verifica existencia de overrides antes de crear estado
- Override puede existir antes de que `cleaning_item_state` exista
- No hay validación que prohíba crear override antes del seed

**⚠️ RIESGO:** Override puede existir para item+estudiante que NO tiene `cleaning_item_state`. Cuando se lea estado, el override se aplicará, pero si el estado no existe, puede haber comportamientos inesperados.

---

### 9.4. ¿Qué Pasa si el Seed No Creó el Estado pero Existe Override?

**Comportamiento actual:**

1. Override existe: `student_item_overrides` tiene registro
2. Seed NO creó estado: `cleaning_item_state` NO tiene registro para ese item+estudiante
3. `getStudentsForItem()` intenta leer estado
4. Estado NO existe → `cleaning_state` es `null` o `undefined`
5. CPM recibe `cleaning_state` vacío
6. Override se aplica a `itemConfig`, pero CPM calcula estado como `'never'` (sin estado)

**⚠️ RIESGO:** Override existe pero no se aplica porque no hay estado. Esto es "silencioso" (no hay error, pero el override no tiene efecto).

---

## 🔚 TABLA RESUMEN DE COMPORTAMIENTOS

### Tabla 1: Validaciones

| Validación | Student Overrides | Item Overrides | Ubicación |
|------------|-------------------|----------------|-----------|
| `student_uuid` formato UUID | ❌ NO | ✅ SÍ | Endpoint |
| `student_uuid` existe | ❌ NO (FK) | ❌ NO (FK) | DB constraint |
| `item_ref` existe | N/A | ❌ NO | **FALTA** |
| `override_key` whitelist | ✅ SÍ | ✅ SÍ | Endpoint |
| `override_value` tipo | ❌ NO | ✅ SÍ | Endpoint |
| `item_kind` coherente | N/A | ❌ NO | **FALTA** |
| Alumno pausado | ❌ NO | ❌ NO | **FALTA** |

---

### Tabla 2: Aplicación de Overrides

| Operación | ¿Lee Overrides? | ¿Aplica Overrides? | ¿Efecto? |
|-----------|-----------------|-------------------|----------|
| **READ: getStudentsForItem** | ✅ SÍ | ✅ SÍ | Aplica overrides antes de CPM |
| **READ: list-projection** | ✅ SÍ (si scope=student) | ✅ SÍ | Aplica overrides antes de CPM |
| **READ: megalist** | ✅ SÍ | ✅ SÍ | Aplica overrides antes de CPM |
| **WRITE: markCleanStudent** | ❌ NO | ❌ NO | No lee overrides |
| **WRITE: resetStudentItemProgress** | ❌ NO | ❌ NO | No lee overrides |
| **WRITE: seed** | ❌ NO | ❌ NO | No lee overrides |

---

### Tabla 3: Cache

| Aspecto | Respuesta | Detalle |
|---------|-----------|---------|
| ¿Existe cache? | ✅ SÍ | Map por `student_uuid` en `alquimia-general-service` |
| ¿Por qué clave? | `student_uuid` | NO por `item_ref` |
| ¿Scope del cache? | Request-scoped | Cache local a función |
| ¿Se invalida al cambiar override? | ❌ NO | Cache persiste durante request |
| ¿Se invalida al reset? | ❌ NO | Reset NO modifica overrides |
| ¿Se invalida al seed? | ❌ NO | Seed NO modifica overrides |

---

### Tabla 4: Overrides Huérfanos

| Escenario | ¿Es Posible? | ¿Protegido? | Riesgo |
|-----------|--------------|-------------|--------|
| Override para item inexistente | ✅ SÍ | ❌ NO | Override existe pero no se aplica |
| Override para estudiante inexistente | ❌ NO | ✅ SÍ (FK) | FK previene |
| Override antes del seed | ✅ SÍ | ❌ NO | Override existe pero no tiene efecto hasta que exista estado |

---

### Tabla 5: Interacciones con Otros Sistemas

| Sistema | ¿Lee Overrides? | ¿Modifica Overrides? | Efecto |
|---------|-----------------|---------------------|--------|
| **CPM** | ❌ NO (indirecto) | ❌ NO | Recibe `item_config` con overrides ya aplicados |
| **LPM** | ✅ SÍ | ❌ NO | Lee y aplica overrides antes de CPM |
| **RESET** | ❌ NO | ❌ NO | Independiente de overrides |
| **CLEAN** | ❌ NO | ❌ NO | Independiente de overrides |
| **SEED** | ❌ NO | ❌ NO | Independiente de overrides |
| **Override Reset Service** | ✅ SÍ | ✅ SÍ | Elimina overrides (no modifica estado) |

---

## 📋 LISTA EXPLÍCITA DE "NO EXISTE"

### Validaciones NO Existentes

1. ❌ **NO se valida que `item_ref` exista en catálogo** al crear override
2. ❌ **NO se valida `item_kind`** al crear override
3. ❌ **NO se valida coherencia `override_key + item_kind`** (ej: `required_count` solo para `una_vez`)
4. ❌ **NO se valida si alumno está pausado** al crear override
5. ❌ **NO se valida tipo de `override_value`** en student-overrides endpoint
6. ❌ **NO se valida formato UUID** en student-overrides endpoint
7. ❌ **NO hay validación de existencia de `student_uuid`** (solo FK constraint)
8. ❌ **NO hay validación de existencia de estado** antes de aplicar override

---

### Mecanismos NO Existentes

1. ❌ **NO hay invalidación explícita de cache** al modificar overrides
2. ❌ **NO hay cache persistente** entre requests
3. ❌ **NO hay cache por `item_ref`** (solo por `student_uuid`)
4. ❌ **NO hay señalización** cuando se crea/modifica override
5. ❌ **NO hay auditoría automática** de cambios en overrides (solo campos `reason`, `created_by`)
6. ❌ **NO hay validación de coherencia** override + estado existente

---

### Contratos NO Existentes

1. ❌ **NO existe `OVERRIDES_CONTRACT_V1.md`** documentando el contrato canónico
2. ❌ **NO existe documentación explícita** de cuándo aplicar overrides
3. ❌ **NO existe documentación** de efectos secundarios del cache
4. ❌ **NO existe documentación** de overrides huérfanos

---

## 🎯 REFERENCIAS A ARCHIVOS Y FUNCIONES

### Archivos Clave

1. **Migración:** `database/migrations/v5.71.0-student-overrides-v1.sql`
   - Define tablas y constraints
   - FK CASCADE para `student_uuid`
   - NO FK para `item_ref`

2. **Repositorios:**
   - `src/infra/repos/student-overrides-repo-pg.js`
   - `src/infra/repos/student-item-overrides-repo-pg.js`

3. **Servicios:**
   - `src/core/master/services/override-resolution-service.js` (resolución)
   - `src/core/master/services/alquimia-override-reset-service.js` (reset overrides)

4. **Endpoints:**
   - `src/endpoints/master-api-student-overrides.js`
   - `src/endpoints/master-api-student-item-overrides.js`

5. **Aplicación:**
   - `src/services/alquimia-general-service.js` (megalist, flotante) - línea 712-746, 996-1025
   - `src/core/master/services/list-projection-model.js` (list-projection) - línea 816-821

---

### Funciones Clave

1. **Resolución:**
   - `resolveStudentField()` - `override-resolution-service.js:37`
   - `resolveItemConfigForStudent()` - `override-resolution-service.js:102`

2. **Creación:**
   - `createStudentOverrideHandler()` - `master-api-student-overrides.js:67`
   - `createStudentItemOverrideHandler()` - `master-api-student-item-overrides.js:67`

3. **Aplicación:**
   - `getStudentsForItem()` (recurrente) - `alquimia-general-service.js:650+`
   - `getStudentsForItem()` (una_vez) - `alquimia-general-service.js:950+`
   - `computeListProjection()` - `list-projection-model.js:700+`

4. **Reset:**
   - `resetOverridesByScope()` - `alquimia-override-reset-service.js:298`

---

## ⚠️ RIESGOS DETECTADOS

### Riesgos Críticos

1. **Override huérfano por item inexistente:**
   - **Causa:** `item_ref` NO tiene FK a catálogo
   - **Efecto:** Override existe pero no se aplica (silencioso)
   - **Severidad:** Media (no rompe sistema, pero override no tiene efecto)

2. **Cache NO se invalida al modificar override:**
   - **Causa:** Cache es request-scoped, NO hay invalidación explícita
   - **Efecto:** Si se modifica override DURANTE una request, cache NO se actualiza
   - **Severidad:** Baja (solo afecta misma request, no persistente)

3. **Override antes del seed:**
   - **Causa:** Seed NO verifica existencia de overrides
   - **Efecto:** Override existe pero no tiene efecto hasta que exista estado
   - **Severidad:** Baja (override se aplicará cuando se cree estado)

---

### Riesgos Menores

1. **No validación de coherencia override_key + item_kind:**
   - **Causa:** No se valida que `required_count` sea solo para `una_vez`
   - **Efecto:** Se puede crear override incoherente (se ignora silenciosamente)
   - **Severidad:** Baja (override se ignora si no es coherente)

2. **No validación de tipo en student-overrides:**
   - **Causa:** Endpoint NO valida tipo de `override_value`
   - **Efecto:** Se puede crear override con tipo incorrecto
   - **Severidad:** Baja (resolución intenta convertir tipo)

---

## 🔚 CONCLUSIÓN FINAL

### Estado Actual del Sistema

**El sistema de OVERRIDES funciona correctamente en su mayoría:**
- ✅ Overrides se aplican ANTES de CPM
- ✅ Overrides NO modifican estado persistido
- ✅ Overrides son scope='student' únicamente
- ✅ Reset/CLEAN/SEED son independientes de overrides
- ✅ FK CASCADE previene overrides huérfanos por estudiante

**Sin embargo, hay validaciones faltantes:**
- ❌ NO se valida existencia de `item_ref`
- ❌ NO se valida coherencia `override_key + item_kind`
- ❌ Cache NO se invalida explícitamente

**El sistema es "fail-safe":**
- Overrides desconocidos se ignoran silenciosamente
- Falta de parámetros retorna valor base
- Overrides huérfanos no rompen el sistema (simplemente no se aplican)

---

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

---

**FIN DEL DIAGNÓSTICO**
