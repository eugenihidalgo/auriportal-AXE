# CONTRATO CANÓNICO — RESET v1

**Versión:** 1.0  
**Fecha:** 2026-01-13  
**Estado:** Canónico  
**Dominio:** MASTER / Alquimia General

---

## DEFINICIÓN ONTOLÓGICA

### ¿Qué es Reset?

**Reset es una frontera dura de estado** que marca el inicio de un nuevo ciclo de limpieza para un item RECURRENTE.

**Semántica:**
- Reset establece un punto temporal (`effective_since`) desde el cual se cuentan días para calcular estado
- Reset NO borra historia (eventos previos permanecen en `cleaning_events`)
- Reset NO modifica contadores directamente (estos se calculan desde eventos post-RESET)
- Reset es un EVENTO del Cleaning Engine (append-only), no un delete

**Propósito único:** Permitir que MASTER reinicie el ciclo de limpieza de un item RECURRENTE sin perder la historia previa.

**NO es:**
- ❌ Un delete (no borra eventos ni estados)
- ❌ Un correctivo (no repara estados corruptos)
- ❌ Un mecanismo de migración (no migra datos legacy)
- ❌ Aplicable a UNA_VEZ (solo RECURRENTE tiene ciclos)

---

## QUÉ ES / QUÉ NO ES

### ✅ QUÉ ES

1. **Frontera dura de estado:**
   - Marca inicio de nuevo ciclo (`effective_since = reset.created_at`)
   - Eventos previos quedan "anulados" para cálculo de estado (pero NO borrados)
   - Eventos post-RESET se cuentan desde `effective_since`

2. **Evento append-only:**
   - Inserta evento RESET en `cleaning_events` con `action_type='reset'`
   - Evento NO se borra (append-only)
   - Evento incluye `clean_layer` (reset por capa es independiente)

3. **Modificación mínima:**
   - SOLO modifica `effective_since` en `cleaning_item_state`
   - NO modifica `last_cleaned_at` directamente
   - NO modifica `clean_count` directamente
   - Los contadores se calculan desde eventos post-RESET en `rebaseStateFromReset()`

4. **UUID-only:**
   - Acepta EXCLUSIVAMENTE `student_uuid` (UUID canónico)
   - Rechaza `legacy_alumno_id` explícitamente
   - PostgreSQL es Source of Truth

---

### ❌ QUÉ NO ES

1. **NO es delete:**
   - ❌ NO borra eventos previos (append-only)
   - ❌ NO borra filas en `cleaning_item_state`
   - ❌ NO elimina historia

2. **NO es correctivo:**
   - ❌ NO repara estados corruptos
   - ❌ NO sincroniza estados desde eventos
   - ❌ NO recalcula contadores directamente

3. **NO aplica a UNA_VEZ:**
   - ❌ Reset está PROHIBIDO para `item_kind='una_vez'`
   - ❌ UNA_VEZ solo tiene contadores + overrides, no ciclos
   - ❌ UNA_VEZ NO tiene `effective_since` (no hay reset)

4. **NO es automático:**
   - ❌ NO se ejecuta automáticamente
   - ❌ NO se ejecuta en GET
   - ❌ NO es reactivo (no reacciona a cambios)

5. **NO modifica contadores directamente:**
   - ❌ NO establece `last_cleaned_at = NULL` directamente
   - ❌ NO establece `clean_count = 0` directamente
   - ✅ SOLO establece `effective_since`
   - ✅ Los contadores se calculan en `rebaseStateFromReset()`

---

## PROHIBICIONES

### ❌ Prohibiciones Absolutas

1. **Reset en UNA_VEZ:**
   - ❌ `item_kind='una_vez'` → Error explícito `RESET_UNA_VEZ_FORBIDDEN`
   - ❌ Reset está PROHIBIDO para items UNA_VEZ

2. **Reset en GET:**
   - ❌ Reset NO disponible en GET
   - ❌ Solo disponible en POST (escritura explícita)

3. **Reset automático:**
   - ❌ Reset NO se ejecuta automáticamente
   - ❌ Reset NO es reactivo (no reacciona a cambios)
   - ❌ Reset debe ser acción explícita del usuario

4. **Reset sin evento:**
   - ❌ Reset NO puede modificar estado sin insertar evento RESET
   - ❌ Todo reset DEBE tener evento correspondiente en `cleaning_events`

5. **Reset que borra historia:**
   - ❌ Reset NO puede borrar eventos previos
   - ❌ Reset NO puede eliminar filas de `cleaning_events`
   - ❌ Reset NO puede eliminar filas de `cleaning_item_state`

6. **Reset que modifica contadores directamente:**
   - ❌ Reset NO puede establecer `last_cleaned_at = NULL` directamente
   - ❌ Reset NO puede establecer `clean_count = 0` directamente
   - ✅ SOLO puede establecer `effective_since`
   - ✅ Los contadores se calculan en `rebaseStateFromReset()`

---

## RELACIÓN CON OTROS SISTEMAS

### Eventos (cleaning_events)

**Relación:**
- Reset inserta evento RESET en `cleaning_events` con `action_type='reset'`
- Evento incluye `clean_layer` (reset por capa es independiente)
- Evento es append-only (no se borra)

**Contrato:**
- Todo reset DEBE tener evento correspondiente
- Evento tiene `execution_key` idempotente (APPLY) o único (CERTIFY)
- Evento incluye metadatos: `actor_type`, `actor_ref`, `surface_key`, `trace_id`

**Precedencia:**
- Eventos previos al RESET NO se usan para calcular estado post-RESET
- Eventos post-RESET se cuentan desde `effective_since`
- `rebaseStateFromReset()` recalcula contadores desde eventos post-RESET

---

### CPM (Cleaning Projection Model)

**Relación:**
- CPM lee `effective_since` para calcular estado post-RESET
- Si hay RESET y NO hay limpiezas post-RESET → estado = `'reseteado'` (days=0)
- Si hay RESET y hay limpiezas post-RESET → estado se calcula desde `effective_since`

**Contrato:**
- CPM usa `max(last_cleaned_at, effective_since)` para calcular `last_effective_clean`
- Si `effective_since != null` y `last_cleaned_at == null` → estado = `'reseteado'`
- Si `effective_since != null` y `last_cleaned_at != null` → estado se calcula desde `effective_since`

**Estados post-RESET:**
- `'reseteado'`: `effective_since != null AND last_effective_clean == null` (days=0)
- `'reviewed'`, `'pending'`, `'important'`: se calculan desde `effective_since` si hay limpiezas post-RESET

**Referencias:** `src/core/master/services/cleaning-projection-model.js:104-621`

---

### LPM (List Projection Model)

**Relación:**
- LPM agrega estados desde `cleaning_item_state` para múltiples estudiantes
- Si hay RESET, estados se calculan desde `effective_since`
- Reset NO afecta a proyección agregada directamente (solo afecta estado individual)

**Contrato:**
- LPM usa CPM para calcular estado individual
- Reset afecta a estado individual, no a agregado directamente
- Si un estudiante tiene RESET, su estado individual se calcula desde `effective_since`

**scope='all':**
- Reset de un estudiante NO afecta a otros estudiantes
- Cada estudiante tiene su propio ciclo de limpieza independiente

**Referencias:** `src/core/master/services/list-projection-model.js:673-1048`

---

### Overrides

**Relación:**
- Reset NO afecta a overrides
- Overrides siguen aplicándose sobre config efectiva después de reset
- Reset y overrides son independientes

**Contrato:**
- Reset establece `effective_since`, pero NO modifica overrides
- Overrides siguen aplicándose sobre `threshold_days`, `required_count`, etc.
- Si hay override de `threshold_days`, se aplica después de reset

**Precedencia:**
- Reset NO prevalece sobre overrides (son independientes)
- Overrides NO prevalecen sobre reset (reset establece ciclo, overrides config)

**Referencias:** `src/core/master/services/override-resolution-service.js`

---

### Seed (Cleaning State Seed)

**Relación:**
- Seed y Reset son independientes
- Seed crea estados iniciales "never", Reset marca inicio de nuevo ciclo
- Seed NO interactúa con Reset

**Contrato:**
- Seed crea estados con `effective_since = NULL` (sin reset)
- Reset establece `effective_since` después de seed
- Si estado no existe, Seed lo crea primero, luego Reset puede establecer `effective_since`

**Precedencia:**
- Seed se ejecuta ANTES de Reset (seed crea estado, reset lo modifica)
- Reset NO requiere seed previo (puede resetear estado existente)

**Referencias:** `docs/contracts/SEED_CONTRACT_V1.md`

---

## POLÍTICA DE FALLOS

### Fail-Hard en Validaciones

**Comportamiento:**
- Si `item_kind='una_vez'` → Error explícito `RESET_UNA_VEZ_FORBIDDEN` (línea 1932-1942)
- Si `legacy_alumno_id` → Error explícito `LEGACY_ALUMNO_ID_FORBIDDEN` (línea 1903-1913)
- Si campos requeridos faltan → Error explícito (línea 1916-1924)
- Si formato UUID inválido → Error explícito (línea 1945-1948)

**Razón:**
- Reset es operación crítica que debe validarse antes de ejecutar
- Validaciones incorrectas pueden corromper estado
- Hard-fail garantiza que reset solo se ejecuta con inputs válidos

---

### Fail-Open en Reset ALL

**Comportamiento:**
- Reset ALL itera sobre estudiantes y continúa aunque falle (línea 2423)
- Si un estudiante falla, se registra error pero continúa con siguiente
- Retorna resumen: `{ updated, failed, skipped, total }`

**Razón:**
- Reset ALL es best-effort, no transaccional
- No se puede cancelar reset de todos si uno falla
- Fail-open permite que reset ALL complete aunque algunos fallen

**Obligatorio:**
- Log estructurado con prefijo `[RESET][ALL]`
- Incluir trace_id en todos los logs
- Incluir error.message y error.code en logs

---

### Fail-Open en Señal

**Comportamiento:**
- Si señal `reset.executed` falla, reset continúa (no bloquea)
- Log WARN estructurado si señal falla
- Reset se considera exitoso aunque señal falle

**Razón:**
- Señal es opcional (observabilidad, no crítica)
- Reset debe completarse aunque señal falle
- Fail-open garantiza que reset no se bloquea por señal

---

### Validaciones que Lanzan Error

**Hard-fail:**
1. `item_kind='una_vez'` → Error explícito `RESET_UNA_VEZ_FORBIDDEN`
2. `legacy_alumno_id` → Error explícito `LEGACY_ALUMNO_ID_FORBIDDEN`
3. Campos requeridos faltantes → Error explícito
4. Formato UUID inválido → Error explícito
5. Reset en GET → Error explícito `RESET_IN_GET_FORBIDDEN`

**Fail-open:**
- Error en señal → Log WARN y continuar
- Error en Reset ALL (estudiante individual) → Log WARN y continuar

---

## INVARIANTES CONSTITUCIONALES

### 1. Reset SOLO aplica a RECURRENTE

**Invariante:**
- Reset está PROHIBIDO para `item_kind='una_vez'`
- UNA_VEZ solo tiene contadores + overrides, no ciclos
- UNA_VEZ NO tiene `effective_since` (no hay reset)

**Verificación:**
- Guard explícito en `resetStudentItemProgress()` (línea 1931-1942)
- Guard explícito en `resetAllStudentsItemProgress()` (línea 2303-2305)
- Error explícito `RESET_UNA_VEZ_FORBIDDEN` si se intenta reset en UNA_VEZ

---

### 2. Reset SOLO modifica effective_since

**Invariante:**
- Reset SOLO establece `effective_since` en `cleaning_item_state`
- Reset NO modifica `last_cleaned_at` directamente
- Reset NO modifica `clean_count` directamente
- Los contadores se calculan desde eventos post-RESET en `rebaseStateFromReset()`

**⚠️ IMPLEMENTACIÓN ACTUAL:**
- `upsertApplyReset()` actualmente establece `last_cleaned_at = NULL` y `clean_count = 0` (línea 368)
- **DEPRECATED:** Debe modificarse para SOLO establecer `effective_since`
- Los contadores deben calcularse en `rebaseStateFromReset()` (ya lo hace, pero después del reset)

**Verificación:**
- Test que verifica que reset SOLO modifica `effective_since`
- Test que verifica que contadores se calculan en `rebaseStateFromReset()`

---

### 3. Reset inserta evento RESET (append-only)

**Invariante:**
- Todo reset DEBE insertar evento RESET en `cleaning_events`
- Evento tiene `action_type='reset'`
- Evento es append-only (no se borra)

**Verificación:**
- Test que verifica que reset inserta evento RESET
- Test que verifica que evento NO se borra
- Test que verifica que evento tiene metadatos correctos

---

### 4. Reset solo disponible en POST

**Invariante:**
- Reset NO disponible en GET
- Reset solo disponible en POST (escritura explícita)
- Guard duro que rechaza reset en GET

**Verificación:**
- Test que verifica que reset falla en GET
- Guard explícito que rechaza reset en GET

---

### 5. Reset no borra historia

**Invariante:**
- Reset NO borra eventos previos
- Reset NO borra filas de `cleaning_events`
- Reset NO borra filas de `cleaning_item_state`
- Eventos previos permanecen accesibles (append-only)

**Verificación:**
- Test que verifica que eventos previos NO se borran
- Test que verifica que `rebaseStateFromReset()` puede reconstruir estado desde eventos

---

### 6. Reset no es automático

**Invariante:**
- Reset NO se ejecuta automáticamente
- Reset NO es reactivo (no reacciona a cambios)
- Reset debe ser acción explícita del usuario

**Verificación:**
- Test que verifica que reset NO se ejecuta automáticamente
- Test que verifica que reset requiere acción explícita

---

### 7. UUID-only

**Invariante:**
- Reset acepta EXCLUSIVAMENTE `student_uuid` (UUID canónico)
- Rechaza `legacy_alumno_id` explícitamente
- PostgreSQL es Source of Truth

**Verificación:**
- Guard explícito que rechaza `legacy_alumno_id`
- Validación de formato UUID antes de ejecutar

---

### 8. Señal técnica opcional

**Invariante:**
- Reset emite señal `reset.executed` SOLO tras persistencia correcta
- Señal es opcional (fail-open absoluto)
- Si señal falla, reset continúa (no bloquea)

**Payload de señal:**
```javascript
{
  student_uuid,        // UUID canónico
  item_ref,
  clean_layer,         // Capa reseteada ('shared' | 'pde')
  item_kind,           // Siempre 'recurrente'
  reset_at,            // Timestamp del reset (effective_since)
  actor_type,          // 'master' | 'student' | 'automation'
  actor_ref,           // Referencia del actor
  surface_key,         // Superficie desde la cual se ejecutó
  trace_id            // Trace ID
}
```

**Verificación:**
- Test que verifica que señal se emite tras persistencia correcta
- Test que verifica que reset continúa aunque señal falle

---

## COMPORTAMIENTOS LEGACY (DEPRECATED)

### 1. Reset que modifica contadores directamente

**DEPRECATED:**
```sql
-- ❌ LEGACY: Reset establece contadores a 0/NULL directamente
UPDATE cleaning_item_state
SET 
  effective_since = $6,
  last_cleaned_at = NULL,  -- ❌ DEPRECATED
  clean_count = 0          -- ❌ DEPRECATED
WHERE ...
```

**Canónico:**
```sql
-- ✅ CANÓNICO: Reset SOLO establece effective_since
UPDATE cleaning_item_state
SET 
  effective_since = $6,
  updated_at = CURRENT_TIMESTAMP
WHERE ...
-- Los contadores se calculan en rebaseStateFromReset() desde eventos post-RESET
```

**Referencia:** `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js:340-403`

---

### 2. Reset sin señal

**DEPRECATED:**
```javascript
// ❌ LEGACY: Reset NO emite señal real
logWarn('AUDIT', 'Signal emission skipped (canonical v1)', {...});
```

**Canónico:**
```javascript
// ✅ CANÓNICO: Reset emite señal reset.executed
await dispatchSignal('reset.executed', {
  student_uuid,
  item_ref,
  clean_layer,
  reset_at: reset.created_at,
  trace_id
});
```

**Referencia:** `src/core/master/services/cleaning-engine-service.js:2187-2192`

---

### 3. Servicios Legacy de Reset

**DEPRECATED:**
- `alquimia-reset-service.js` → Usar Cleaning Engine directamente
- `alquimia-general-service.js` → Usar Cleaning Engine directamente

**Canónico:**
- Usar `resetStudentItemProgress()` desde Cleaning Engine
- Usar `resetAllStudentsItemProgress()` desde Cleaning Engine

**Referencias:**
- `src/core/master/services/alquimia-reset-service.js` (DEPRECATED)
- `src/core/master/services/alquimia-general-service.js` (DEPRECATED)

---

## FIRMA DE FUNCIÓN CANÓNICA

```javascript
/**
 * Resetea el progreso de un item RECURRENTE (RESET CANÓNICO v1)
 * 
 * UUID-ONLY: Acepta student_uuid (UUID canónico)
 * 
 * @param {Object} options - Opciones
 * @param {string} options.student_uuid - UUID canónico del estudiante (OBLIGATORIO)
 * @param {string} options.item_ref - Referencia del item (OBLIGATORIO)
 * @param {string} options.item_kind - Tipo de item ('recurrente' | 'una_vez', OBLIGATORIO)
 * @param {string} options.clean_layer - Capa a resetear ('shared' | 'pde', OBLIGATORIO)
 * @param {string} options.actor_type - Tipo de actor ('master' | 'student' | 'automation', OBLIGATORIO)
 * @param {string} options.surface_key - Superficie desde la cual se ejecutó (OBLIGATORIO)
 * @param {string} [options.actor_ref] - Referencia del actor (opcional)
 * @param {string} [options.execution_mode='APPLY'] - Modo de ejecución ('APPLY' | 'CERTIFY')
 * @param {Object} [options.meta] - Metadatos adicionales (opcional)
 * @param {Object} [options.client] - Cliente de transacción (opcional)
 * @returns {Promise<Object>} { applied, skipped, layers_affected }
 */
async function resetStudentItemProgress(options, client = null)
```

**Cambios canónicos:**
- ✅ `item_kind` OBLIGATORIO y validado (solo 'recurrente')
- ✅ `clean_layer` OBLIGATORIO (no derivado de `view_layer`)
- ✅ Guard explícito para UNA_VEZ
- ✅ Señal `reset.executed` emitida tras persistencia

---

## VERIFICACIÓN Y TESTS

### Tests Obligatorios

1. **Test de Prohibición UNA_VEZ:**
   - Intentar reset en `item_kind='una_vez'`
   - Verificar que lanza error `RESET_UNA_VEZ_FORBIDDEN`
   - Verificar que NO se inserta evento RESET

2. **Test de Prohibición GET:**
   - Intentar reset en GET
   - Verificar que lanza error `RESET_IN_GET_FORBIDDEN`
   - Verificar que guard rechaza reset en GET

3. **Test de No Borrado de Historia:**
   - Crear eventos previos
   - Ejecutar reset
   - Verificar que eventos previos NO se borran
   - Verificar que `rebaseStateFromReset()` puede reconstruir estado desde eventos

4. **Test de Modificación Mínima:**
   - Ejecutar reset
   - Verificar que SOLO se modifica `effective_since`
   - Verificar que contadores se calculan en `rebaseStateFromReset()` (no directamente)

5. **Test de Empeoramiento de Estado:**
   - Crear estado `'reviewed'` (days < threshold)
   - Ejecutar reset
   - Verificar que estado cambia a `'reseteado'` (days=0)
   - Verificar que estado empeora hasta nuevo clean

6. **Test de Reset ALL no Transaccional:**
   - Ejecutar reset ALL con múltiples estudiantes
   - Forzar fallo en un estudiante
   - Verificar que reset continúa con siguientes estudiantes
   - Verificar que reset NO se cancela por fallo parcial

7. **Test de Señal Técnica:**
   - Ejecutar reset exitoso
   - Verificar que señal `reset.executed` se emite
   - Forzar fallo en señal
   - Verificar que reset continúa aunque señal falle

---

## REFERENCIAS

- **Diagnóstico FASE 0:** `docs/DIAGNOSTICO_RESET_FASE0.md`
- **Servicio actual:** `src/core/master/services/cleaning-engine-service.js:1871-2761`
- **Repositorio:** `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js:340-403`
- **Endpoint:** `src/endpoints/master-api-alquimia-general.js:2062-2192`
- **CPM:** `src/core/master/services/cleaning-projection-model.js:104-621`
- **LPM:** `src/core/master/services/list-projection-model.js:673-1048`
- **Rebase:** `src/core/master/services/cleaning-engine-service.js:190-426`

---

**FIN DEL CONTRATO CANÓNICO RESET v1**
