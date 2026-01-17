# OVERRIDES CONTRACT v1 — Contrato Canónico del Sistema de Overrides
## Definición ontológica y reglas constitucionales

**Versión:** 1.0  
**Fecha:** 2026-01-13  
**Dominio:** MASTER  
**Estado:** Activo

---

## DEFINICIÓN ONTOLÓGICA

### ¿Qué es Override?

**Override es una capa de lectura efectiva** que permite sobrescribir valores base del sistema a nivel de alumno individual, sin modificar el Source of Truth (SOT).

**Semántica:**
- Override NO modifica valor base (nunca escribe en tablas base)
- Override SOLO afecta lectura (cálculo de estado, visualización)
- Override es scope='student' únicamente (prohibido scope='all')
- Override es auditable y reversible
- Override NO emite señales (no es acción WRITE)

---

### ¿Qué NO es Override?

**Override NO es:**
- ❌ Mutación de estado persistido (NO modifica `cleaning_item_state`)
- ❌ Reset de ciclo (NO modifica `effective_since`)
- ❌ Limpieza (NO modifica `last_cleaned_at`, `clean_count`)
- ❌ Seed (NO crea estado)
- ❌ Señal (NO emite eventos)
- ❌ Autoridad de estado (Backend es la única autoridad)

---

## SCOPE Y VALIDACIONES

### Scope Permitido

**ÚNICO scope válido:** `scope='student'`

**PROHIBIDO:**
- ❌ `scope='all'` → Error explícito: "Overrides solo disponibles en scope=student"
- ❌ Scope undefined o null → Se asume 'student' (validación implícita)

**Validación:** Línea 90-92 de `master-api-student-item-overrides.js`

---

### Campos Permitidos

#### Student Overrides (`student_overrides`)

**Campos permitidos:**
- `nivel` (number) - Nivel del estudiante
- `fecha_creacion` (Date/string/number) - Fecha de creación
- `apodo` (string) - Apodo del estudiante

**Whitelist:** Línea 94 de `master-api-student-overrides.js`

#### Student Item Overrides (`student_item_overrides`)

**Campos permitidos:**
- `required_count` (number ≥ 0) - Veces que debe limpiarse (una_vez)
- `threshold_days` (number ≥ 0) - Días para considerar "reviewed" (recurrente)
- `nivel` (number) - Nivel del item
- `descripcion` (string) - Descripción del item

**Whitelist:** Línea 105 de `master-api-student-item-overrides.js`

**⚠️ NOTA:** `nivel` y `descripcion` no se usan directamente en CPM, solo `threshold_days` y `required_count` afectan cálculo de estado.

---

### Validaciones Obligatorias

**Al crear override:**
- ✅ `student_uuid` formato UUID válido (item overrides)
- ✅ `student_uuid` presente (student overrides)
- ✅ `item_ref` presente (item overrides)
- ✅ `override_key` / `field_key` en whitelist
- ✅ `override_value` tipo correcto según `override_key`
- ✅ `scope` = 'student' o undefined (prohibido 'all')

**NO se valida (riesgos conocidos):**
- ❌ Existencia de `item_ref` en catálogo (permite overrides huérfanos)
- ❌ Coherencia `override_key + item_kind` (ej: `required_count` solo para `una_vez`)
- ❌ Existencia de `student_uuid` en `students` (protegido por FK CASCADE)

---

## PROHIBICIONES EXPLÍCITAS

### Prohibiciones Constitucionales

1. **❌ Override NO puede modificar `cleaning_item_state`**
   - Override solo afecta lectura, nunca escritura
   - `cleaning_item_state` solo se modifica por Cleaning Engine, Seed, Reset

2. **❌ Override NO puede modificar `effective_since`**
   - `effective_since` solo se modifica por Reset
   - Override solo afecta `item_config` (threshold_days, required_count)

3. **❌ Override NO puede modificar contadores**
   - `last_cleaned_at`, `clean_count` solo se modifican por CLEAN
   - Override solo afecta cálculo de estado, no persistencia

4. **❌ Override NO puede ser scope='all'**
   - Overrides son SOLO por estudiante
   - Para cambiar valores base, modificar catálogo directamente

5. **❌ Override NO puede emitir señales**
   - Overrides son capa de lectura, no WRITE
   - Señales solo se emiten desde acciones WRITE (cleaning-engine, seed)

6. **❌ Override NO puede bloquear CLEAN**
   - CLEAN no lee overrides
   - Override solo afecta visualización del estado, no capacidad de limpiar

7. **❌ Override NO puede afectar RESET**
   - RESET no lee overrides
   - RESET es independiente de overrides

8. **❌ Override NO puede afectar SEED**
   - SEED no lee overrides
   - SEED es independiente de overrides

---

## INTERACCIÓN CON OTROS SISTEMAS

### Overrides y RESET

**Relación:**
- RESET NO lee overrides
- RESET NO modifica overrides
- Overrides persisten después del reset

**Comportamiento:**
- Reset ejecutado → `effective_since` actualizado
- Override existe → Persiste sin cambios
- CPM calcula estado → Usa override (threshold_days)

**Contrato:**
- Override + RESET → Estado correcto
- Override + RESET + CLEAN → Estado correcto

---

### Overrides y CLEAN

**Relación:**
- CLEAN NO lee overrides
- CLEAN NO modifica overrides
- Overrides persisten después de CLEAN

**Comportamiento:**
- CLEAN ejecutado → `last_cleaned_at` actualizado
- Override existe → Persiste sin cambios
- CPM calcula estado → Usa override (threshold_days)

**Contrato:**
- Override NO bloquea CLEAN
- Override NO produce estados incoherentes tras CLEAN

---

### Overrides y SEED

**Relación:**
- SEED NO lee overrides
- SEED NO modifica overrides
- Overrides pueden existir antes del seed

**Comportamiento:**
- Override existe → Estado NO existe
- Seed ejecutado → Estado creado
- CPM calcula estado → Usa override (threshold_days)

**⚠️ CASO ESPECIAL:** Override antes del seed
- Override puede existir para item+estudiante que NO tiene `cleaning_item_state`
- Cuando se lee estado, override se aplica, pero si no hay estado, CPM calcula `'never'`
- Override NO tiene efecto hasta que exista estado

**Contrato:**
- Override antes del seed → Override existe pero no tiene efecto hasta seed
- Override después del seed → Override se aplica inmediatamente

---

### Overrides y CPM

**Relación:**
- CPM recibe `item_config` con overrides YA aplicados
- CPM NO sabe que un valor es override (es "ciego" a overrides)
- CPM solo ve valores efectivos

**Comportamiento:**
1. `resolveItemConfigForStudent()` aplica overrides a `itemConfig`
2. Retorna `effectiveConfig` con overrides aplicados
3. CPM recibe `effectiveConfig` como `item_config`
4. CPM calcula estado usando `effectiveConfig.threshold_days`

**Contrato:**
- Overrides se aplican ANTES de CPM
- CPM nunca recibe overrides directos (solo valores efectivos)
- CPM es función pura respecto a overrides (mismo `effectiveConfig` → mismo resultado)

---

### Overrides y LPM

**Relación:**
- LPM aplica overrides SOLO si `scope='student'`
- LPM NO aplica overrides si `scope='all'`

**Comportamiento:**
- `scope='student'` → `resolveItemConfigForStudent()` se llama
- `scope='all'` → `effectiveConfig = itemConfig` (sin overrides)

**Contrato:**
- List-projection ALL muestra valores base sin personalizaciones
- List-projection STUDENT muestra valores efectivos con overrides

---

## MOMENTO DE APLICACIÓN

### Pipeline Real

**Orden canónico de aplicación:**

```
1. GET /master/api/alquimia-general/items/:item_ref/students
   ↓
2. Obtener estado bruto de cleaning_item_state
   ↓
3. Obtener item base del catálogo
   ↓
4. [AQUÍ SE APLICAN OVERRIDES]
   resolveItemConfigForStudent(itemConfig, student_uuid, item_ref)
   → effectiveConfig = { ...itemConfig, ...overrides }
   ↓
5. [CPM RECIBE effectiveConfig]
   computeCleaningProjection({ item_config: effectiveConfig, ... })
   ↓
6. CPM calcula estado usando effectiveConfig.threshold_days
   ↓
7. Retorna estado proyectado
```

**⚠️ CRÍTICO:** Overrides se aplican ANTES de CPM, NUNCA después.

---

### READ vs WRITE

**Overrides SOLO se aplican en READ operations:**

| Operación | ¿Lee Overrides? | ¿Aplica Overrides? |
|-----------|-----------------|-------------------|
| `getStudentsForItem()` (megalist, flotante) | ✅ SÍ | ✅ SÍ |
| `computeListProjection()` (scope=student) | ✅ SÍ | ✅ SÍ |
| `markCleanStudent()` (WRITE) | ❌ NO | ❌ NO |
| `resetStudentItemProgress()` (WRITE) | ❌ NO | ❌ NO |
| `ensureCleaningItemStateSeedForStudent()` (WRITE) | ❌ NO | ❌ NO |

**Contrato:**
- READ operations aplican overrides
- WRITE operations NO leen overrides
- Overrides son "inocuos" para WRITE operations

---

## OVERRIDES HUÉRFANOS

### Override para Ítem Inexistente

**Caso:** Override existe para `item_ref` que NO existe en catálogo.

**Causa:**
- `item_ref` NO tiene FOREIGN KEY a catálogo (línea 68 de migración)
- Endpoint NO valida existencia de `item_ref`

**Comportamiento:**
- Override se crea exitosamente en `student_item_overrides`
- Cuando se lee estado, override se busca
- Si `item_ref` no existe en catálogo, override NO se aplica (item no se lee)
- Override existe pero no tiene efecto (silencioso)

**Contrato:**
- Override huérfano NO rompe el sistema
- Override huérfano simplemente NO se aplica
- Es responsabilidad del usuario validar `item_ref` antes de crear override

---

### Override para Estudiante Inexistente

**Caso:** Override existe para `student_uuid` que NO existe en `students`.

**Causa:**
- `student_uuid` tiene FK a `students.id` ON DELETE CASCADE (línea 37, 67 de migración)
- PostgreSQL rechaza INSERT si `student_uuid` no existe
- Si se borra estudiante, overrides se eliminan automáticamente

**Comportamiento:**
- Override NO se puede crear si `student_uuid` no existe (FK constraint)
- Si se borra estudiante, overrides se eliminan automáticamente (CASCADE)

**Contrato:**
- FK protege contra overrides huérfanos por estudiante
- Overrides huérfanos por estudiante NO son posibles

---

### Override Antes del Seed

**Caso:** Override existe para item+estudiante que NO tiene `cleaning_item_state`.

**Causa:**
- Seed NO verifica existencia de overrides
- Override puede crearse antes del seed

**Comportamiento:**
1. Override existe → `student_item_overrides` tiene registro
2. Estado NO existe → `cleaning_item_state` NO tiene registro
3. `getStudentsForItem()` intenta leer estado
4. Estado NO existe → `cleaning_state` es `null` o `undefined`
5. CPM recibe `cleaning_state` vacío
6. Override se aplica a `itemConfig`, pero CPM calcula estado como `'never'` (sin estado)

**Contrato:**
- Override antes del seed NO tiene efecto hasta que exista estado
- Override NO rompe el sistema (simplemente no tiene efecto)
- Cuando se crea estado (seed), override se aplica inmediatamente

---

## CACHE REQUEST-SCOPED

### Cache de Overrides

**Ubicación:** `src/services/alquimia-general-service.js`

**Cache 1: Recurrente** (línea 712-746)
- **Tipo:** `Map<student_uuid, effectiveConfig>`
- **Scope:** Función `getStudentsForItem()` (recurrente)
- **Clave:** `student_uuid` (NO por `item_ref`)
- **Valor:** `effectiveConfig` (itemConfig con overrides aplicados)

**Cache 2: Una_vez** (línea 996-1025)
- **Tipo:** `Map<student_uuid, effectiveConfigUnaVez>`
- **Scope:** Función `getStudentsForItem()` (una_vez)
- **Clave:** `student_uuid` (NO por `item_ref`)
- **Valor:** `effectiveConfigUnaVez`

---

### Comportamiento del Cache

**Cache es request-scoped:**
- Cache se crea en cada llamada a `getStudentsForItem()`
- Cache persiste durante la ejecución de la función
- Cache se elimina automáticamente al terminar la función
- Cache NO persiste entre requests

**Invalidación:**
- ❌ Cache NO se invalida explícitamente al modificar override
- ❌ Cache NO se invalida al reset
- ❌ Cache NO se invalida al seed
- Cache se invalida automáticamente al terminar la request

**⚠️ CASO ESPECIAL:** Si se modifica un override DURANTE una request que ya cacheó, el cache NO se actualiza. Sin embargo, esto es raro porque:
- Cache es local a la función
- Modificar override requiere otra request (POST)
- Cache se recrea en cada nueva request

---

### Efectos Secundarios del Cache

**Efectos positivos:**
- Reduce lookups duplicados en la misma request
- Mejora rendimiento en `getStudentsForItem()` cuando hay múltiples estudiantes

**Efectos negativos:**
- Si se modifica override DURANTE una request, cache NO se actualiza (raro)
- Cache NO se comparte entre requests (es local a función)

**Contrato:**
- Cache es request-scoped y temporal
- No hay efectos secundarios persistentes
- Cache es "inocuo" respecto a persistencia

---

## POLÍTICA DE FALLOS

### Fail-Safe Absoluto

**Regla constitucional:** Overrides son fail-safe.

**Comportamiento:**
- Si faltan parámetros → Retorna valor base (log WARN)
- Si `override_key` desconocido → Se ignora silenciosamente (log WARN)
- Si override huérfano → NO se aplica (silencioso)
- Si override antes del seed → NO tiene efecto hasta que exista estado (silencioso)

**Contrato:**
- Overrides NUNCA rompen el sistema
- Overrides desconocidos o inválidos se ignoran
- Sistema funciona correctamente sin overrides

---

### Validación de Coherencia

**NO se valida coherencia:**
- ❌ `override_key + item_kind` (ej: `required_count` solo para `una_vez`)
- ❌ Existencia de `item_ref` en catálogo
- ❌ Existencia de estado antes de crear override

**Comportamiento:**
- Overrides incoherentes se ignoran silenciosamente
- Overrides huérfanos NO se aplican
- Sistema funciona correctamente con overrides inválidos

**Contrato:**
- Es responsabilidad del usuario crear overrides coherentes
- Sistema es "perdonador" (ignora overrides inválidos)

---

## INVARIANTES CONSTITUCIONALES

### Invariante 1: Override ≠ Mutación

**Regla:** Override NUNCA modifica estado persistido.

**Verificación:**
- Override solo afecta `item_config` (valores base)
- Override NO modifica `cleaning_item_state`
- Override NO modifica `effective_since`
- Override NO modifica contadores

**Test:** `tests/overrides/overrides-constitutional.test.js`

---

### Invariante 2: Override Solo en READ

**Regla:** Overrides SOLO se aplican en READ operations.

**Verificación:**
- `getStudentsForItem()` aplica overrides ✅
- `computeListProjection()` (scope=student) aplica overrides ✅
- `markCleanStudent()` NO lee overrides ✅
- `resetStudentItemProgress()` NO lee overrides ✅
- `ensureCleaningItemStateSeedForStudent()` NO lee overrides ✅

**Test:** `tests/overrides/overrides-constitutional.test.js`

---

### Invariante 3: Override Persiste Tras RESET/CLEAN

**Regla:** Overrides persisten después de RESET o CLEAN.

**Verificación:**
- RESET NO elimina overrides
- CLEAN NO elimina overrides
- Overrides permanecen después de RESET/CLEAN

**Test:** `tests/overrides/overrides-constitutional.test.js`

---

### Invariante 4: Override NO Bloquea CLEAN

**Regla:** Override NO puede bloquear limpieza.

**Verificación:**
- CLEAN NO lee overrides
- Override NO afecta capacidad de limpiar
- CLEAN funciona independientemente de overrides

**Test:** `tests/overrides/overrides-constitutional.test.js`

---

### Invariante 5: Override Solo en scope='student'

**Regla:** Overrides SOLO se aplican si `scope='student'`.

**Verificación:**
- `scope='student'` → Overrides se aplican ✅
- `scope='all'` → Overrides NO se aplican ✅
- `scope` undefined → Se asume 'student' (default)

**Test:** `tests/overrides/overrides-constitutional.test.js`

---

## RELACIÓN CON OTROS CONTRATOS

### RESET_CONTRACT_V1.md

**Relación:**
- RESET es independiente de overrides
- RESET NO lee overrides
- RESET NO modifica overrides
- Overrides persisten después del reset

**Referencias:**
- `docs/contracts/RESET_CONTRACT_V1.md` (contrato canónico de reset)
- `docs/DIAGNOSTICO_CLEAN_AFTER_RESET.md` (verificación de CLEAN después de RESET)

---

### CLEANING_PROJECTION_MODEL_V1.md

**Relación:**
- CPM recibe `item_config` con overrides YA aplicados
- CPM NO sabe que un valor es override
- CPM calcula estado usando valores efectivos

**Referencia:** `docs/CLEANING_PROJECTION_MODEL_V1.md`

---

### SEED_CONTRACT_V1.md

**Relación:**
- SEED es independiente de overrides
- SEED NO lee overrides
- SEED NO modifica overrides
- Overrides pueden existir antes del seed

**Referencias:**
- `docs/contracts/SEED_CONTRACT_V1.md` (contrato canónico de seed)
- `docs/DIAGNOSTICO_OVERRIDES_MASTER.md` (análisis completo de overrides huérfanos)

---

## VERSIONADO

**Versión actual:** 1.0  
**Fecha de activación:** 2026-01-13

**Historial:**
- v1.0 (2026-01-13): Contrato canónico inicial

---

## REFERENCIAS

### Archivos Clave

1. **Migración:**
   - `database/migrations/v5.71.0-student-overrides-v1.sql`

2. **Repositorios:**
   - `src/infra/repos/student-overrides-repo-pg.js`
   - `src/infra/repos/student-item-overrides-repo-pg.js`

3. **Servicios:**
   - `src/core/master/services/override-resolution-service.js`
   - `src/core/master/services/alquimia-override-reset-service.js`

4. **Endpoints:**
   - `src/endpoints/master-api-student-overrides.js`
   - `src/endpoints/master-api-student-item-overrides.js`

5. **Aplicación:**
   - `src/services/alquimia-general-service.js`
   - `src/core/master/services/list-projection-model.js`

---

### Tests

**Tests constitucionales:**
- `tests/overrides/overrides-constitutional.test.js`

---

**FIN DEL CONTRATO**
