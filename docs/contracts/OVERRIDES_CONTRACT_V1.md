# OVERRIDES CONTRACT v1 — Contrato Canónico del Sistema de Overrides
## Definición ontológica y reglas constitucionales

**Versión:** 1.0  
**Fecha:** 2026-01-13  
**Actualizado:** 2026-01-17 (basado en DIAGNOSTICO_OVERRIDES_MASTER_CANONICO.md)  
**Dominio:** MASTER  
**Estado:** Activo

**⚠️ NOTA:** Este contrato refleja EXACTAMENTE el comportamiento real del sistema verificado en código. No propone cambios, solo documenta lo que YA ES CIERTO.

---

## DEFINICIÓN ONTOLÓGICA

### ¿Qué es Override? (DEFINICIÓN CANÓNICA)

**Override es una capa pura de lectura efectiva** que permite sobrescribir valores base del sistema a nivel de alumno individual, SIN modificar el Source of Truth (SOT) persistido.

**Semántica REAL:**
- ✅ **Override NO muta estado persistido** (nunca escribe en `cleaning_item_state`)
- ✅ **Override SOLO afecta lectura** (cálculo de estado proyectado, visualización)
- ✅ **Override es scope='student' únicamente** (prohibido scope='all')
- ✅ **Override es auditable y reversible** (campos `reason`, `created_by`)
- ✅ **Override NO emite señales** (no es acción WRITE, solo lectura)
- ✅ **Override se aplica ANTES de CPM** (CPM recibe valores efectivos)
- ✅ **Override persiste en PostgreSQL** (tablas dedicadas, no cache persistente)

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

## SCOPE Y ALCANCE

### Scope Permitido (DECISIÓN ACTUAL)

**ÚNICO scope válido:** `scope='student'`

**PROHIBIDO:**
- ❌ `scope='all'` → Error explícito: "Overrides solo disponibles en scope=student"
- ❌ Scope undefined o null → Se asume 'student' (validación implícita)

**Validación:** Línea 90-92 de `master-api-student-item-overrides.js`

**⚠️ RIESGO CONOCIDO:** NO es un bug. Overrides son intencionalmente solo para scope='student'. Para cambiar valores base, modificar catálogo directamente.

---

### Tablas PostgreSQL (ALCANCE REAL)

#### Tabla 1: `student_overrides`

**Ubicación:** `database/migrations/v5.71.0-student-overrides-v1.sql`

**Estructura:**
- `id` (UUID PRIMARY KEY)
- `student_uuid` (UUID, FK a `students.id` ON DELETE CASCADE)
- `field_key` (TEXT, whitelist: 'nivel', 'fecha_creacion', 'apodo')
- `override_value` (JSONB)
- `reason` (TEXT, opcional, auditable)
- `created_at` (TIMESTAMPTZ)
- `created_by` (TEXT, opcional, auditable)

**Constraints:**
- UNIQUE: `(student_uuid, field_key)`
- FK CASCADE: `student_uuid → students.id ON DELETE CASCADE`

**Campos permitidos:**
- `nivel` (number) - Nivel del estudiante
- `fecha_creacion` (Date/string/number) - Fecha de creación
- `apodo` (string) - Apodo del estudiante

**Whitelist:** Línea 94 de `master-api-student-overrides.js`

#### Tabla 2: `student_item_overrides`

**Ubicación:** `database/migrations/v5.71.0-student-overrides-v1.sql`

**Estructura:**
- `id` (UUID PRIMARY KEY)
- `student_uuid` (UUID, FK a `students.id` ON DELETE CASCADE)
- `item_ref` (TEXT, **NO tiene FK a catálogo** ⚠️ RIESGO CONOCIDO)
- `override_key` (TEXT, whitelist: 'required_count', 'threshold_days', 'nivel', 'descripcion')
- `override_value` (JSONB)
- `reason` (TEXT, opcional, auditable)
- `created_at` (TIMESTAMPTZ)
- `created_by` (TEXT, opcional, auditable)

**Constraints:**
- UNIQUE: `(student_uuid, item_ref, override_key)`
- FK CASCADE: `student_uuid → students.id ON DELETE CASCADE`
- ⚠️ **NO FK para `item_ref`** → Permite overrides huérfanos (RIESGO CONOCIDO, NO bug)

**Campos permitidos:**
- `required_count` (number ≥ 0) - Veces que debe limpiarse (una_vez)
- `threshold_days` (number ≥ 0) - Días para considerar "reviewed" (recurrente)
- `nivel` (number) - Nivel del item (NO afecta CPM, solo display)
- `descripcion` (string) - Descripción del item (NO afecta CPM, solo display)

**Whitelist:** Línea 105 de `master-api-student-item-overrides.js`

**⚠️ NOTA TÉCNICA:** `nivel` y `descripcion` existen como campos overrideables pero NO se usan directamente en CPM. Solo `threshold_days` y `required_count` afectan cálculo de estado. Estos overrides se usan para display (mostrar nivel/descripción diferente), no para cálculo.

---

### Validaciones Obligatorias

**Al crear override:**
- ✅ `student_uuid` formato UUID válido (item overrides)
- ✅ `student_uuid` presente (student overrides)
- ✅ `item_ref` presente (item overrides)
- ✅ `override_key` / `field_key` en whitelist
- ✅ `override_value` tipo correcto según `override_key`
- ✅ `scope` = 'student' o undefined (prohibido 'all')

**NO se valida (RIESGOS CONOCIDOS - COMPORTAMIENTO INTENCIONAL):**
- ❌ Existencia de `item_ref` en catálogo (permite overrides huérfanos, NO es bug)
- ❌ Coherencia `override_key + item_kind` (ej: `required_count` solo para `una_vez`, se ignora silenciosamente si incoherente)
- ❌ Existencia de `student_uuid` en `students` (protegido por FK CASCADE en BD)
- ❌ Tipo de `override_value` en student-overrides endpoint (solo presencia)
- ❌ Formato UUID en student-overrides endpoint (solo presencia)
- ❌ Existencia de estado antes de aplicar override (override puede existir antes del seed)

**⚠️ DECISIÓN ACTUAL:** Estas validaciones NO existen intencionalmente. El sistema es "perdonador" (fail-safe): overrides inválidos se ignoran silenciosamente sin romper el sistema.

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

**Relación:** Dependencia unidireccional (CPM depende de override, override NO depende de CPM)

**Comportamiento REAL:**
1. `resolveItemConfigForStudent()` aplica overrides a `itemConfig`
2. Retorna `effectiveConfig` con overrides aplicados (copia, no modifica original)
3. CPM recibe `effectiveConfig` como `item_config` (con overrides ya aplicados)
4. CPM calcula estado usando `effectiveConfig.threshold_days` y `effectiveConfig.required_count`
5. CPM es "ciego" a overrides (no sabe si un valor viene de override o es base)

**Contrato:**
- ✅ Overrides se aplican **ANTES de CPM** (obligatorio)
- ✅ CPM nunca recibe overrides directos (solo valores efectivos)
- ✅ CPM es función pura respecto a overrides (mismo `effectiveConfig` → mismo resultado)
- ✅ CPM NO modifica estado persistido (solo cálculo, no escritura)

---

### Overrides y LPM

**Relación:** Dependencia unidireccional (LPM aplica overrides antes de CPM)

**Comportamiento REAL:**
- `scope='student'` → `resolveItemConfigForStudent()` se llama ANTES de CPM
- `scope='all'` → `effectiveConfig = itemConfig` (sin overrides, valores base)

**Contrato:**
- ✅ List-projection ALL muestra valores base sin personalizaciones
- ✅ List-projection STUDENT muestra valores efectivos con overrides aplicados
- ✅ Overrides se aplican en LPM SOLO si `scope='student'` (guards previenen scope='all')

---

### Overrides y Megalist

**Relación:** Independiente (megalist NO aplica overrides actualmente)

**Comportamiento REAL:**
- `getMegalistForStudent()` NO llama `resolveItemConfigForStudent()`
- Usa valores base del catálogo directamente: `item.frecuencia_dias || 7`, `item.veces_limpiar || 1`
- CPM recibe `itemConfig` base (SIN overrides aplicados)

**⚠️ INCONSISTENCIA DOCUMENTADA (COMPORTAMIENTO ACTUAL):**
- Megalist NO aplica overrides (diferente a flotante y list-projection)
- Esta es una **DECISIÓN ACTUAL**, no un bug reportado

**Contrato:**
- ✅ Megalist muestra valores base sin personalizaciones (comportamiento actual)
- ⚠️ Flotante y list-projection muestran valores efectivos con overrides (comportamiento actual)
- ⚠️ Esta inconsistencia debe documentarse explícitamente para evitar confusión

---

## ORDEN DE RESOLUCIÓN (CRÍTICO - OBLIGATORIO)

### Orden Exacto Documentado (COMPORTAMIENTO REAL)

El orden de resolución es **CONSTITUCIONAL** y define cómo el sistema combina estado persistido, valores base, overrides y CPM:

```
1. ESTADO PERSISTIDO (cleaning_item_state)
   - last_cleaned_at, effective_since, clean_count, remaining, completed
   - Valores REALES persistidos en BD (Source of Truth)
   ↓
2. ITEM BASE (catálogo)
   - frecuencia_dias, veces_limpiar, nivel, descripcion
   - Valores BASE del catálogo (items_transmutaciones, listas_transmutaciones)
   ↓
3. OVERRIDE (si existe)
   - threshold_days, required_count, nivel, descripcion
   - Valores SOBRESCRITOS desde student_item_overrides
   - Se aplica ANTES de CPM (resolver)
   ↓
4. EFFECTIVE CONFIG (resultado de override)
   - effectiveConfig.threshold_days = override.threshold_days || item.frecuencia_dias || 7
   - effectiveConfig.required_count = override.required_count || item.veces_limpiar || 1
   - Copia del itemConfig con overrides aplicados (NO modifica original)
   ↓
5. CPM (Cleaning Projection Model)
   - Recibe: cleaning_state (bruto) + effectiveConfig (con overrides ya aplicados)
   - Calcula: state_by_view_layer usando effectiveConfig
   - CPM es "ciego" a overrides (solo ve valores efectivos, no sabe si son override)
   ↓
6. ESTADO PROYECTADO (resultado final)
   - state_by_view_layer[view_layer].state
   - Calculado usando override aplicado (si existía)
```

**REGLA CONSTITUCIONAL:**
- ✅ Override se aplica **ANTES de CPM** (obligatorio)
- ✅ CPM **NO distingue** entre valores base y valores override (es "ciego")
- ✅ Estado persistido **NO cambia** por override (override solo afecta lectura)
- ✅ Override solo participa en **READ operations**, nunca en WRITE

**⚠️ CRÍTICO:** Este orden es INVARIANTE. Cualquier cambio a este orden rompe el contrato constitucional.

---

### READ vs WRITE (COMPORTAMIENTO REAL)

**Overrides SOLO se aplican en READ operations:**

| Operación | ¿Lee Overrides? | ¿Aplica Overrides? | Ubicación |
|-----------|-----------------|-------------------|-----------|
| `getStudentsForItem()` (flotante) | ✅ SÍ | ✅ SÍ | `alquimia-general-service.js` |
| `computeListProjection()` (scope='student') | ✅ SÍ | ✅ SÍ | `list-projection-model.js` |
| `getMegalistForStudent()` (megalist) | ❌ NO | ❌ NO | `alquimia-alumno-megalist-service.js` ⚠️ |
| `markCleanStudent()` (WRITE) | ❌ NO | ❌ NO | `cleaning-engine-service.js` |
| `resetStudentItemProgress()` (WRITE) | ❌ NO | ❌ NO | `cleaning-engine-service.js` |
| `ensureCleaningItemStateSeedForStudent()` (WRITE) | ❌ NO | ❌ NO | `cleaning-state-seed-service.js` |

**⚠️ INCONSISTENCIA DOCUMENTADA (COMPORTAMIENTO ACTUAL):**
- ✅ **Flotante** (`getStudentsForItem`) SÍ aplica overrides
- ✅ **List-projection** (scope='student') SÍ aplica overrides
- ❌ **Megalist** (`getMegalistForStudent`) NO aplica overrides actualmente (verificado en código línea 449-454)

**DECISIÓN ACTUAL:** Esta inconsistencia es un comportamiento real del sistema, no un bug reportado. Debe documentarse explícitamente para evitar confusión.

**Contrato:**
- READ operations en flotante y list-projection aplican overrides
- READ operation en megalist NO aplica overrides (comportamiento actual)
- WRITE operations NO leen overrides (obligatorio)
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

## CASOS LÍMITE DOCUMENTADOS

### Caso 1: Override sin estado base

**Escenario:** Override existe para item+estudiante que NO tiene `cleaning_item_state`.

**Comportamiento REAL:**
1. Override existe en `student_item_overrides`
2. `cleaning_item_state` NO existe → `cleaning_state` es `null` o `undefined`
3. `resolveItemConfigForStudent()` lee override y retorna `effectiveConfig` con override aplicado
4. CPM recibe `effectiveConfig` pero `cleaning_state = null`
5. CPM calcula estado como `'never'` (sin estado)
6. Override NO tiene efecto hasta que exista estado

**Veredicto:** ✅ **Funciona pero es raro** (override existe pero no tiene efecto hasta seed)

**⚠️ RIESGO CONOCIDO:** NO es bug. Override puede existir antes del seed y se aplicará cuando exista estado.

---

### Caso 2: Override + Reset

**Escenario:** Override existe, luego se ejecuta RESET.

**Comportamiento REAL:**
1. Override persiste (reset NO modifica overrides)
2. Reset establece `effective_since`
3. `resolveItemConfigForStudent()` lee override y retorna `effectiveConfig` con override
4. CPM calcula estado usando `effective_since` (del reset) + `threshold_days` (del override)

**Veredicto:** ✅ **Funciona correctamente** (override se aplica después de reset)

**Contrato:** Overrides persisten después de RESET y se aplican correctamente en lectura.

---

### Caso 3: Override + Clean después de Reset

**Escenario:** Override existe, se ejecuta RESET, luego CLEAN.

**Comportamiento REAL:**
1. Override persiste (clean NO modifica overrides)
2. Reset establece `effective_since`
3. CLEAN actualiza `last_cleaned_at` (clean NO lee overrides)
4. `resolveItemConfigForStudent()` lee override y retorna `effectiveConfig` con override
5. CPM calcula estado usando `last_cleaned_at` (del clean) + `threshold_days` (del override)

**Veredicto:** ✅ **Funciona correctamente** (override se aplica después de reset+clean)

**Contrato:** Overrides NO bloquean CLEAN after RESET. CLEAN es independiente de overrides.

---

### Caso 4: Override + Seed

**Escenario:** Override existe antes del seed, luego se ejecuta seed.

**Comportamiento REAL:**
1. Override existe antes del seed
2. Seed crea estado con valores base (seed NO lee overrides)
3. Estado creado tiene valores base (NO valores overrideados)
4. Cuando se lee estado: `resolveItemConfigForStudent()` aplica override → CPM calcula con override

**Veredicto:** ✅ **Funciona correctamente** (seed NO aplica overrides, pero overrides se aplican en lectura)

**Contrato:** Seed es independiente de overrides. Overrides se aplican después del seed en lectura.

---

### Caso 5: Override con item UNA_VEZ

**Escenario:** Item tipo `una_vez`, override de `required_count = 5` (base: 3).

**Comportamiento REAL:**
1. Override existe: `student_item_overrides` tiene `override_key='required_count'`, `override_value=5`
2. `resolveItemConfigForStudent()` retorna `effectiveConfig.required_count = 5`
3. CPM calcula estado para `una_vez` usando `required_count = 5` (del override)

**Veredicto:** ✅ **Funciona correctamente** (override se aplica en UNA_VEZ)

**⚠️ RIESGO CONOCIDO:** NO se valida que `required_count` solo aplique a `una_vez`. Se puede crear override `required_count` para `recurrente` (se ignora silenciosamente en CPM). NO es bug, es comportamiento intencional.

---

### Caso 6: Override con item RECURRENTE

**Escenario:** Item tipo `recurrente`, override de `threshold_days = 14` (base: 7).

**Comportamiento REAL:**
1. Override existe: `student_item_overrides` tiene `override_key='threshold_days'`, `override_value=14`
2. `resolveItemConfigForStudent()` retorna `effectiveConfig.threshold_days = 14`
3. CPM calcula estado para `recurrente` usando `threshold_days = 14` (del override)

**Veredicto:** ✅ **Funciona correctamente** (override se aplica en RECURRENTE)

**⚠️ RIESGO CONOCIDO:** NO se valida que `threshold_days` solo aplique a `recurrente`. Se puede crear override `threshold_days` para `una_vez` (se ignora silenciosamente en CPM). NO es bug, es comportamiento intencional.

---

### Caso 7: Override ALL vs por alumno

**Escenario:** Intento de crear override con `scope='all'`.

**Comportamiento REAL:**
1. Endpoint valida: `if (scope !== undefined && scope !== 'student')` → Error 400
2. Error: "Overrides solo disponibles en scope=student. En scope=all debe actualizarse el ítem base directamente."
3. Override NO se crea

**Veredicto:** ✅ **Funciona correctamente** (guards previenen scope='all')

---

### Caso 8: Override que intenta forzar estado final

**Escenario:** Item `recurrente` con `last_cleaned_at = null`, override de `threshold_days = 999` (muy alto).

**Comportamiento REAL:**
1. Override existe: `threshold_days = 999`
2. `resolveItemConfigForStudent()` retorna `effectiveConfig.threshold_days = 999`
3. CPM calcula: `last_cleaned_at = null` → `days_since = null` → Estado = `'never'` (sin limpieza previa)
4. Override NO fuerza estado (CPM calcula desde contadores, override solo afecta threshold)

**Veredicto:** ✅ **Funciona correctamente** (override NO fuerza estado, solo afecta cálculo de threshold)

**⚠️ ACLARACIÓN:** Override NO puede forzar estado final (ej: "siempre limpio"). Override solo afecta `threshold_days` y `required_count`, pero el estado se calcula desde contadores reales.

---

## POLÍTICA DE FALLOS (FAIL-SAFE ABSOLUTO)

### Regla Constitucional

**Overrides son fail-safe absoluto:** NUNCA rompen el sistema, incluso con datos inválidos.

**Comportamiento REAL:**
- Si faltan parámetros → Retorna valor base (log WARN, no error)
- Si `override_key` desconocido → Se ignora silenciosamente (log WARN, no error)
- Si override huérfano (item inexistente) → NO se aplica (silencioso, no error)
- Si override antes del seed → NO tiene efecto hasta que exista estado (silencioso, no error)
- Si override incoherente (`required_count` para `recurrente`) → Se ignora en CPM (silencioso)

**Contrato:**
- ✅ Overrides NUNCA rompen el sistema (fail-safe)
- ✅ Overrides desconocidos o inválidos se ignoran (perdonador)
- ✅ Sistema funciona correctamente sin overrides o con overrides inválidos

---

## COSAS QUE NO HACE EL SISTEMA (COMPORTAMIENTO INTENCIONAL)

### Validaciones que NO existen

**Estas validaciones NO existen intencionalmente (NO son bugs):**

1. ❌ **NO se valida existencia de `item_ref`** en catálogo al crear override (permite overrides huérfanos)
2. ❌ **NO se valida `item_kind`** al crear override
3. ❌ **NO se valida coherencia `override_key + item_kind`** (ej: `required_count` solo para `una_vez`)
4. ❌ **NO se valida si alumno está pausado** al crear override
5. ❌ **NO se valida tipo de `override_value`** en student-overrides endpoint (solo presencia)
6. ❌ **NO se valida formato UUID** en student-overrides endpoint (solo presencia)
7. ❌ **NO hay validación de existencia de estado** antes de aplicar override

**⚠️ DECISIÓN ACTUAL:** Estas validaciones NO existen porque el sistema es "perdonador" (fail-safe). Overrides inválidos se ignoran silenciosamente sin romper el sistema.

---

### Guards que NO existen

**Estos guards NO existen intencionalmente:**

1. ❌ **NO hay guard que prevenga override para item inexistente** (FK ausente es intencional)
2. ❌ **NO hay guard que prevenga override incoherente con item_kind** (se ignora silenciosamente)
3. ❌ **NO hay guard que invalide cache request-scoped** al modificar override durante la misma request

**⚠️ DECISIÓN ACTUAL:** Estos guards NO existen porque:
- Overrides huérfanos simplemente no se aplican (no rompen sistema)
- Overrides incoherentes se ignoran en CPM (no rompen sistema)
- Cache request-scoped se recrea en cada nueva request (no es problema persistente)

---

### Contratos implícitos documentados explícitamente

**Estos comportamientos NO estaban documentados pero ahora SÍ:**

1. ✅ **Megalist NO aplica overrides** (comportamiento actual, ahora documentado)
2. ✅ **Orden exacto de resolución** (Estado persistido → Item base → Override → Effective Config → CPM, ahora documentado)
3. ✅ **Comportamiento de overrides huérfanos** (NO se aplican, silencioso, ahora documentado)

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
**Última actualización:** 2026-01-17

**Historial:**
- v1.0 (2026-01-13): Contrato canónico inicial
- v1.0 (2026-01-17): Actualización basada en DIAGNOSTICO_OVERRIDES_MASTER_CANONICO.md
  - Documentación explícita del orden de resolución
  - Casos límite documentados (8 casos)
  - Inconsistencia megalist/flotante documentada
  - Riesgos conocidos marcados como COMPORTAMIENTO INTENCIONAL
  - Cosas que NO hace el sistema documentadas explícitamente

---

## REFERENCIAS

### Documentación Canónica

**Diagnóstico canónico:**
- `docs/DIAGNOSTICO_OVERRIDES_MASTER_CANONICO.md` - Análisis completo del comportamiento REAL del sistema (2026-01-17)

**⚠️ NOTA:** El diagnóstico canónico reemplaza y actualiza el diagnóstico anterior `docs/DIAGNOSTICO_OVERRIDES_MASTER.md`. El diagnóstico canónico refleja el comportamiento REAL verificado en código actual.

### Contratos Relacionados

- `docs/contracts/RESET_CONTRACT_V1.md` - Contrato canónico del sistema de reset
- `docs/contracts/SEED_CONTRACT_V1.md` - Contrato canónico del Cleaning State Seed
- `docs/contracts/CLEANING_PROJECTION_MODEL_V1.md` - Contrato canónico de CPM
- `docs/contracts/SIGNALS_CONTRACT_V1.md` - Contrato canónico del sistema de señales

### Archivos Clave

1. **Migración:**
   - `database/migrations/v5.71.0-student-overrides-v1.sql` (tablas: `student_overrides`, `student_item_overrides`)

2. **Repositorios:**
   - `src/infra/repos/student-overrides-repo-pg.js` (CRUD de overrides de estudiante)
   - `src/infra/repos/student-item-overrides-repo-pg.js` (CRUD de overrides de items)

3. **Servicios:**
   - `src/core/master/services/override-resolution-service.js` (resolver overrides, aplicar antes de CPM)
   - `src/core/master/services/list-projection-model.js` (aplica overrides si scope='student')
   - `src/services/alquimia-general-service.js` (aplica overrides en flotante)
   - `src/core/master/services/alquimia-alumno-megalist-service.js` (NO aplica overrides, comportamiento actual)

4. **Endpoints:**
   - `src/endpoints/master-api-student-overrides.js` (CRUD de overrides de estudiante)
   - `src/endpoints/master-api-student-item-overrides.js` (CRUD de overrides de items)

---

### Tests

**Tests constitucionales:**
- `tests/overrides/overrides-constitutional.test.js` (verifica invariantes constitucionales)

---

**FIN DEL CONTRATO**
