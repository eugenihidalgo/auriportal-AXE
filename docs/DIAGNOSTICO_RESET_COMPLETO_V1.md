# DIAGNÓSTICO COMPLETO — RESET ALQUIMIA GENERAL v1

**DOMINIO:** MASTER  
**OBJETIVO:** Diagnosticar por qué Reset ALL omite ítems y detectar estados inconsistentes históricos  
**FECHA:** 2026-01-27  
**MODO:** SOLO OBSERVACIÓN + AUDITORÍA (NO FIXES)

---

## CONTEXTO CANÓNICO (NO DISCUTIR)

- Dominio: MASTER
- PostgreSQL es Source of Truth
- Reset es acción histórica visible (cleaning_events)
- Reset NO vuelve a NUNCA
- Reset vuelve a PENDIENTE (days_since = threshold + 1 conceptualmente)
- execution_key es BACKEND-ONLY
- Action Registry ya está corregido
- Endpoint único: POST /master/api/alquimia-general/reset
- Cleaning Engine y proyección recurrente funcionan bien en casos nuevos

**El problema está en:**
👉 estados históricos ya existentes + resets previos mal ejecutados

---

## FASE 1 — MAPA COMPLETO DE RESET

### 1.1 Tipos de Reset Soportados

**Confirmados en código (`cleaning-engine-service.js`):**

1. **ITEM_STUDENT**
   - Función: `resetStudentItemProgress()`
   - Scope: Un item para un estudiante específico
   - Requiere: `item_ref`, `student_uuid`, `clean_layer`
   - Repositorio: `CleaningItemStateRepo.upsertApplyReset()`
   - Columnas modificadas: `{layer}_effective_since`, `{layer}_last_cleaned_at` (NULL), `{layer}_clean_count` (0)

2. **ITEM_ALL**
   - Función: `resetAllStudentsItemProgress()`
   - Scope: Un item para TODOS los estudiantes activos
   - Requiere: `item_ref`, `clean_layer`
   - Prohibe: `student_uuid` (reset ALL no acepta student_uuid)
   - Itera sobre todos los estudiantes activos y llama `resetStudentItemProgress()` para cada uno
   - Excluye estudiantes pausados

3. **LIST_STUDENT**
   - Función: `resetByScope()` → itera items de lista → `resetStudentItemProgress()`
   - Scope: Todos los items de una lista para un estudiante específico
   - Requiere: `list_id`, `student_uuid`, `clean_layer`
   - Filtra: Solo items `tipo='recurrente'` (salta `una_vez`)

4. **LIST_ALL**
   - Función: `resetByScope()` → itera items de lista → `resetAllStudentsItemProgress()`
   - Scope: Todos los items de una lista para TODOS los estudiantes activos
   - Requiere: `list_id`, `clean_layer`
   - Prohibe: `student_uuid`
   - Filtra: Solo items `tipo='recurrente'`

### 1.2 Flujo de Ejecución de Reset

**Para ITEM_STUDENT y ITEM_ALL (vía resetStudentItemProgress):**

1. Validar campos requeridos
2. Verificar si alumno está en pausa (si aplica) → `skipped++` si pausado
3. Obtener item del catálogo
4. Validar coherencia con lista
5. Determinar capas a resetear (`layersToReset`)
6. Para cada capa:
   - Generar `execution_key`: `reset:{item_ref}:{student_uuid}:{clean_layer}:{YYYY-MM-DD}`
   - Insertar evento en `cleaning_events` (idempotente vía `ON CONFLICT (execution_key, student_id) DO NOTHING`)
   - Si evento ya existe → `skipped++`, continuar
   - Si evento se inserta → aplicar reset a `cleaning_item_state`:
     - `{layer}_effective_since = NOW()`
     - `{layer}_last_cleaned_at = NULL` (solo si `item_kind='recurrente'`)
     - `{layer}_clean_count = 0` (solo si `item_kind='recurrente'`)
   - `applied++`

**Para LIST_STUDENT y LIST_ALL:**

1. Obtener items de lista (`catalogRepo.listItems(list_id, { onlyActive: true })`)
2. Filtrar: Solo items `tipo='recurrente'` (saltar `una_vez`)
3. Para cada item:
   - ITERAR sobre estudiantes (si LIST_ALL) o usar estudiante único (si LIST_STUDENT)
   - Llamar `resetStudentItemProgress()` o `resetAllStudentsItemProgress()`
   - Acumular `applied` y `skipped`

### 1.3 Lógica de Idempotencia

**Execution Key para RESET:**
```javascript
// cleaning-engine-service.js:60-61
if (actionType === 'reset' && cleanLayer) {
  return `${actionType}:${itemRef}:${studentUuid}:${cleanLayer}:${day}`;
}
```

**Formato:** `reset:{item_ref}:{student_uuid}:{clean_layer}:{YYYY-MM-DD}`

**Idempotencia en cleaning_events:**
```sql
-- cleaning-events-repo-pg.js:54
ON CONFLICT (execution_key, student_id) DO NOTHING
```

**Comportamiento:**
- Si `(execution_key, student_id)` ya existe → no se inserta evento
- Repositorio devuelve `{ already_executed: true }`
- Cleaning Engine detecta esto y marca `skipped++`
- **NO se actualiza `cleaning_item_state`** si el evento ya existe

**PROBLEMA POTENCIAL:**
Si un reset se ejecutó parcialmente (evento insertado pero `cleaning_item_state` no actualizado), el siguiente reset del mismo día será omitido por idempotencia, dejando el estado inconsistente.

---

## FASE 2 — AUDITORÍA DE BASE DE DATOS

### 2.1 Query: Ítems Recurrentes con Estado Inconsistente

**Buscar ítems recurrentes con:**
- `shared_clean_count = 0`
- `shared_last_cleaned_at IS NULL`
- `shared_effective_since IS NOT NULL`
- Pero que tienen eventos de reset o limpieza posteriores inconsistentes

```sql
-- Query 1: Estados base tras reset (deberían ser coherentes)
SELECT 
  cis.student_id AS student_uuid,
  cis.item_ref,
  cis.domain_type,
  cis.shared_effective_since,
  cis.shared_last_cleaned_at,
  cis.shared_clean_count,
  cis.pde_effective_since,
  cis.pde_last_cleaned_at,
  cis.pde_clean_count,
  -- Último evento de reset SHARED
  (SELECT action_type 
   FROM cleaning_events ce 
   WHERE ce.student_id = cis.student_id 
     AND ce.item_ref = cis.item_ref 
     AND ce.clean_layer = 'shared' 
     AND ce.action_type = 'reset'
   ORDER BY ce.created_at DESC 
   LIMIT 1) AS last_reset_shared_action,
  (SELECT created_at 
   FROM cleaning_events ce 
   WHERE ce.student_id = cis.student_id 
     AND ce.item_ref = cis.item_ref 
     AND ce.clean_layer = 'shared' 
     AND ce.action_type = 'reset'
   ORDER BY ce.created_at DESC 
   LIMIT 1) AS last_reset_shared_at,
  -- Último evento de reset PDE
  (SELECT action_type 
   FROM cleaning_events ce 
   WHERE ce.student_id = cis.student_id 
     AND ce.item_ref = cis.item_ref 
     AND ce.clean_layer = 'pde' 
     AND ce.action_type = 'reset'
   ORDER BY ce.created_at DESC 
   LIMIT 1) AS last_reset_pde_action,
  (SELECT created_at 
   FROM cleaning_events ce 
   WHERE ce.student_id = cis.student_id 
     AND ce.item_ref = cis.item_ref 
     AND ce.clean_layer = 'pde' 
     AND ce.action_type = 'reset'
   ORDER BY ce.created_at DESC 
   LIMIT 1) AS last_reset_pde_at,
  -- Último evento de limpieza SHARED (post-reset)
  (SELECT created_at 
   FROM cleaning_events ce 
   WHERE ce.student_id = cis.student_id 
     AND ce.item_ref = cis.item_ref 
     AND ce.clean_layer = 'shared' 
     AND ce.action_type = 'mark_clean'
     AND ce.created_at > COALESCE(
       (SELECT created_at 
        FROM cleaning_events ce2 
        WHERE ce2.student_id = cis.student_id 
          AND ce2.item_ref = cis.item_ref 
          AND ce2.clean_layer = 'shared' 
          AND ce2.action_type = 'reset'
        ORDER BY ce2.created_at DESC 
        LIMIT 1),
       '1970-01-01'::timestamp
     )
   ORDER BY ce.created_at DESC 
   LIMIT 1) AS last_clean_after_reset_shared,
  -- Último evento de limpieza PDE (post-reset)
  (SELECT created_at 
   FROM cleaning_events ce 
   WHERE ce.student_id = cis.student_id 
     AND ce.item_ref = cis.item_ref 
     AND ce.clean_layer = 'pde' 
     AND ce.action_type = 'mark_clean'
     AND ce.created_at > COALESCE(
       (SELECT created_at 
        FROM cleaning_events ce2 
        WHERE ce2.student_id = cis.student_id 
          AND ce2.item_ref = cis.item_ref 
          AND ce2.clean_layer = 'pde' 
          AND ce2.action_type = 'reset'
        ORDER BY ce2.created_at DESC 
        LIMIT 1),
       '1970-01-01'::timestamp
     )
   ORDER BY ce.created_at DESC 
   LIMIT 1) AS last_clean_after_reset_pde
FROM cleaning_item_state cis
WHERE cis.product_key = 'pde'
  AND cis.domain_type = 'transmutation'
  -- Filtrar solo items recurrentes (asumir que están en listas tipo='recurrente')
  AND EXISTS (
    SELECT 1 
    FROM listas_transmutaciones lt 
    WHERE lt.id = (
      SELECT lista_id 
      FROM items_transmutaciones it 
      WHERE it.item_ref = cis.item_ref
    )
    AND lt.tipo = 'recurrente'
  )
ORDER BY cis.updated_at DESC;
```

### 2.2 Query: Detectar "ANTI-ESTADO" (Estados Imposibles)

**Casos a detectar:**

1. **Reset ejecutado pero sin evento:**
   - `shared_effective_since IS NOT NULL`
   - `shared_last_cleaned_at IS NULL`
   - `shared_clean_count = 0`
   - Pero NO existe evento `action_type='reset'` para `clean_layer='shared'`

2. **Evento reset sin actualización de cleaning_item_state:**
   - Existe evento `action_type='reset'` reciente
   - Pero `{layer}_effective_since` es anterior al evento
   - O `{layer}_last_cleaned_at` NO es NULL cuando debería serlo

3. **shared_effective_since > NOW():**
   - Fecha futura (imposible)

4. **clean_count = 0 pero last_cleaned_at NOT NULL:**
   - Contradicción lógica

5. **Ítems que jamás vuelven a cambiar de columna tras reset:**
   - Reset ejecutado hace > threshold_days
   - Pero nunca se ejecutó limpieza post-reset
   - Estado sigue siendo "never" cuando debería ser "pending"

```sql
-- Query 2: Anti-estado 1 - Reset sin evento
SELECT 
  cis.student_id AS student_uuid,
  cis.item_ref,
  'RESET_SIN_EVENTO_SHARED' AS tipo_inconsistencia,
  cis.shared_effective_since,
  cis.shared_last_cleaned_at,
  cis.shared_clean_count,
  'shared_effective_since IS NOT NULL pero no existe evento reset' AS descripcion
FROM cleaning_item_state cis
WHERE cis.product_key = 'pde'
  AND cis.domain_type = 'transmutation'
  AND cis.shared_effective_since IS NOT NULL
  AND cis.shared_last_cleaned_at IS NULL
  AND cis.shared_clean_count = 0
  AND NOT EXISTS (
    SELECT 1 
    FROM cleaning_events ce 
    WHERE ce.student_id = cis.student_id 
      AND ce.item_ref = cis.item_ref 
      AND ce.clean_layer = 'shared' 
      AND ce.action_type = 'reset'
  );

-- Query 3: Anti-estado 2 - Evento reset sin actualización de estado
SELECT 
  ce.student_id AS student_uuid,
  ce.item_ref,
  'EVENTO_RESET_SIN_ACTUALIZACION_SHARED' AS tipo_inconsistencia,
  ce.created_at AS evento_reset_at,
  cis.shared_effective_since AS estado_effective_since,
  cis.shared_last_cleaned_at AS estado_last_cleaned_at,
  cis.shared_clean_count AS estado_clean_count,
  CASE 
    WHEN cis.shared_effective_since IS NULL THEN 'effective_since NO actualizado'
    WHEN cis.shared_effective_since < ce.created_at THEN 'effective_since anterior al evento'
    WHEN cis.shared_last_cleaned_at IS NOT NULL THEN 'last_cleaned_at NO es NULL (debería ser NULL)'
    WHEN cis.shared_clean_count != 0 THEN 'clean_count NO es 0 (debería ser 0)'
    ELSE 'OK'
  END AS descripcion
FROM cleaning_events ce
LEFT JOIN cleaning_item_state cis ON (
  ce.student_id = cis.student_id 
  AND ce.item_ref = cis.item_ref 
  AND ce.product_key = cis.product_key 
  AND ce.domain_type = cis.domain_type
)
WHERE ce.action_type = 'reset'
  AND ce.clean_layer = 'shared'
  AND ce.product_key = 'pde'
  AND ce.domain_type = 'transmutation'
  AND (
    cis.shared_effective_since IS NULL
    OR cis.shared_effective_since < ce.created_at
    OR cis.shared_last_cleaned_at IS NOT NULL
    OR cis.shared_clean_count != 0
  )
ORDER BY ce.created_at DESC;

-- Query 4: Anti-estado 3 - Fecha futura
SELECT 
  cis.student_id AS student_uuid,
  cis.item_ref,
  'FECHA_FUTURA_SHARED' AS tipo_inconsistencia,
  cis.shared_effective_since,
  NOW() AS ahora,
  cis.shared_effective_since - NOW() AS diferencia
FROM cleaning_item_state cis
WHERE cis.product_key = 'pde'
  AND cis.domain_type = 'transmutation'
  AND cis.shared_effective_since > NOW();

-- Query 5: Anti-estado 4 - Contradicción clean_count / last_cleaned_at
SELECT 
  cis.student_id AS student_uuid,
  cis.item_ref,
  'CONTRADICCION_CLEAN_COUNT_SHARED' AS tipo_inconsistencia,
  cis.shared_clean_count,
  cis.shared_last_cleaned_at,
  CASE 
    WHEN cis.shared_clean_count = 0 AND cis.shared_last_cleaned_at IS NOT NULL 
      THEN 'clean_count=0 pero last_cleaned_at NOT NULL'
    WHEN cis.shared_clean_count > 0 AND cis.shared_last_cleaned_at IS NULL 
      THEN 'clean_count>0 pero last_cleaned_at NULL'
    ELSE 'OK'
  END AS descripcion
FROM cleaning_item_state cis
WHERE cis.product_key = 'pde'
  AND cis.domain_type = 'transmutation'
  AND (
    (cis.shared_clean_count = 0 AND cis.shared_last_cleaned_at IS NOT NULL)
    OR (cis.shared_clean_count > 0 AND cis.shared_last_cleaned_at IS NULL)
  );

-- Query 6: Anti-estado 5 - Reset antiguo sin limpieza post-reset
SELECT 
  cis.student_id AS student_uuid,
  cis.item_ref,
  'RESET_ANTIGUO_SIN_LIMPIEZA_SHARED' AS tipo_inconsistencia,
  cis.shared_effective_since AS reset_at,
  NOW() - cis.shared_effective_since AS dias_desde_reset,
  (SELECT COUNT(*) 
   FROM cleaning_events ce 
   WHERE ce.student_id = cis.student_id 
     AND ce.item_ref = cis.item_ref 
     AND ce.clean_layer = 'shared' 
     AND ce.action_type = 'mark_clean'
     AND ce.created_at > cis.shared_effective_since
  ) AS limpiezas_post_reset
FROM cleaning_item_state cis
WHERE cis.product_key = 'pde'
  AND cis.domain_type = 'transmutation'
  AND cis.shared_effective_since IS NOT NULL
  AND cis.shared_last_cleaned_at IS NULL
  AND cis.shared_clean_count = 0
  AND NOW() - cis.shared_effective_since > INTERVAL '7 days'  -- Más de 7 días sin limpieza
  AND NOT EXISTS (
    SELECT 1 
    FROM cleaning_events ce 
    WHERE ce.student_id = cis.student_id 
      AND ce.item_ref = cis.item_ref 
      AND ce.clean_layer = 'shared' 
      AND ce.action_type = 'mark_clean'
      AND ce.created_at > cis.shared_effective_since
  );
```

### 2.3 Query: Detectar Resets Duplicados (Mismo Día)

**Problema:** Si un reset se ejecutó dos veces el mismo día, el segundo será omitido por idempotencia, pero puede haber quedado inconsistente.

```sql
-- Query 7: Resets duplicados el mismo día (mismo execution_key)
SELECT 
  ce1.student_id AS student_uuid,
  ce1.item_ref,
  ce1.execution_key,
  ce1.clean_layer,
  COUNT(*) AS intentos_reset,
  MIN(ce1.created_at) AS primer_intento,
  MAX(ce1.created_at) AS ultimo_intento,
  -- Verificar si el estado está actualizado
  CASE 
    WHEN cis.shared_effective_since IS NULL THEN 'NO ACTUALIZADO'
    WHEN cis.shared_effective_since < MAX(ce1.created_at) THEN 'ACTUALIZADO ANTES DEL ÚLTIMO INTENTO'
    ELSE 'OK'
  END AS estado_coherencia
FROM cleaning_events ce1
LEFT JOIN cleaning_item_state cis ON (
  ce1.student_id = cis.student_id 
  AND ce1.item_ref = cis.item_ref 
  AND ce1.product_key = cis.product_key 
  AND ce1.domain_type = cis.domain_type
)
WHERE ce1.action_type = 'reset'
  AND ce1.product_key = 'pde'
  AND ce1.domain_type = 'transmutation'
GROUP BY ce1.student_id, ce1.item_ref, ce1.execution_key, ce1.clean_layer, 
         cis.shared_effective_since, cis.pde_effective_since
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;
```

### 2.4 Query: Reset ALL que Devuelve "0 aplicados, X omitidos"

**Análisis:** Si un reset ALL devuelve "0 aplicados, X omitidos", significa que:
- Todos los estudiantes fueron omitidos por idempotencia (mismo execution_key del día)
- O todos los estudiantes están en pausa
- O hubo un error que no se reportó correctamente

```sql
-- Query 8: Estudiantes que deberían resetearse pero fueron omitidos
-- (tienen execution_key del día actual pero estado no actualizado)
SELECT 
  ce.student_id AS student_uuid,
  ce.item_ref,
  ce.clean_layer,
  ce.execution_key,
  ce.created_at AS evento_created_at,
  cis.shared_effective_since AS estado_effective_since,
  cis.shared_last_cleaned_at AS estado_last_cleaned_at,
  cis.shared_clean_count AS estado_clean_count,
  CASE 
    WHEN cis.shared_effective_since IS NULL THEN 'ESTADO NO ACTUALIZADO'
    WHEN cis.shared_effective_since < ce.created_at THEN 'ESTADO ANTERIOR AL EVENTO'
    WHEN ce.clean_layer = 'shared' AND cis.shared_last_cleaned_at IS NOT NULL THEN 'last_cleaned_at NO es NULL'
    WHEN ce.clean_layer = 'shared' AND cis.shared_clean_count != 0 THEN 'clean_count NO es 0'
    WHEN ce.clean_layer = 'pde' AND cis.pde_last_cleaned_at IS NOT NULL THEN 'pde_last_cleaned_at NO es NULL'
    WHEN ce.clean_layer = 'pde' AND cis.pde_clean_count != 0 THEN 'pde_clean_count NO es 0'
    ELSE 'OK'
  END AS motivo_inconsistencia
FROM cleaning_events ce
LEFT JOIN cleaning_item_state cis ON (
  ce.student_id = cis.student_id 
  AND ce.item_ref = cis.item_ref 
  AND ce.product_key = cis.product_key 
  AND ce.domain_type = cis.domain_type
)
WHERE ce.action_type = 'reset'
  AND ce.product_key = 'pde'
  AND ce.domain_type = 'transmutation'
  AND ce.execution_key LIKE 'reset:%'  -- Solo resets
  AND ce.created_at >= CURRENT_DATE  -- Eventos de hoy
  AND (
    cis.shared_effective_since IS NULL
    OR (ce.clean_layer = 'shared' AND (
      cis.shared_effective_since < ce.created_at
      OR cis.shared_last_cleaned_at IS NOT NULL
      OR cis.shared_clean_count != 0
    ))
    OR (ce.clean_layer = 'pde' AND (
      cis.pde_effective_since IS NULL
      OR cis.pde_effective_since < ce.created_at
      OR cis.pde_last_cleaned_at IS NOT NULL
      OR cis.pde_clean_count != 0
    ))
  )
ORDER BY ce.created_at DESC;
```

---

## FASE 3 — AUDITORÍA DE PROYECCIÓN

### 3.1 Verificar Proyección para Ítems Encallados

**Para cada ítem encallado detectado en FASE 2:**

1. Obtener datos raw de `cleaning_item_state`
2. Calcular proyección usando `cleaning-projection-model.js`
3. Verificar si la proyección calcula correctamente el estado
4. Comparar con lo que la UI debería mostrar

**Script de verificación (NO EJECUTAR, solo diseño):**

```javascript
// verify-projection-for-stuck-items.js (DISEÑO)
import { computeCleaningProjection } from '../src/core/master/services/cleaning-projection-model.js';
import { query } from '../database/pg.js';

// Obtener ítems encallados (de queries FASE 2)
const stuckItems = await query(`
  -- Query de ítems encallados
  SELECT student_id, item_ref, clean_layer, ...
  FROM ...
`);

for (const item of stuckItems) {
  // Obtener estado raw
  const rawState = await getCleaningItemState(item);
  
  // Calcular proyección
  const projection = computeCleaningProjection({
    item_kind: 'recurrente',
    view_layer: item.clean_layer,
    layerData: {
      effective_since: rawState[`${item.clean_layer}_effective_since`],
      last_cleaned_at: rawState[`${item.clean_layer}_last_cleaned_at`],
      clean_count: rawState[`${item.clean_layer}_clean_count`]
    },
    itemConfig: {
      frecuencia_days: item.frecuencia_days,
      critical_multiplier: 2.0
    }
  });
  
  // Verificar coherencia
  console.log({
    item_ref: item.item_ref,
    student_uuid: item.student_id,
    raw_state: rawState,
    projection: projection,
    state_by_view_layer: projection.state_by_view_layer,
    is_coherent: /* lógica de verificación */
  });
}
```

---

## FASE 4 — AUDITORÍA DE RESET ALL

### 4.1 Por Qué Reset ALL Omite Ítems

**Análisis del código (`resetAllStudentsItemProgress`):**

1. Obtiene todos los estudiantes activos (no pausados)
2. Para cada estudiante, llama `resetStudentItemProgress()`
3. `resetStudentItemProgress()` genera `execution_key` con formato: `reset:{item_ref}:{student_uuid}:{clean_layer}:{YYYY-MM-DD}`
4. Intenta insertar evento en `cleaning_events`
5. Si `(execution_key, student_id)` ya existe → `ON CONFLICT DO NOTHING` → evento no se inserta
6. Repositorio devuelve `{ already_executed: true }`
7. Cleaning Engine detecta esto y marca `skipped++`
8. **NO se actualiza `cleaning_item_state`** si el evento ya existe

**Causa raíz de "0 aplicados, X omitidos":**

- Si un reset ALL se ejecutó parcialmente (algunos estudiantes procesados, otros no)
- Y se vuelve a ejecutar el mismo día
- Todos los estudiantes que ya fueron procesados tendrán el mismo `execution_key`
- Por lo tanto, serán omitidos por idempotencia
- Si TODOS los estudiantes fueron omitidos → "0 aplicados, X omitidos"

**Problema adicional:**

Si un reset se ejecutó pero falló al actualizar `cleaning_item_state` (error en `upsertApplyReset`), el evento SÍ se insertó. El siguiente reset del mismo día será omitido por idempotencia, dejando el estado inconsistente permanentemente.

### 4.2 Localización Exacta de la Decisión "skipped"

**Código exacto:**

```javascript
// cleaning-engine-service.js:1327-1340
const eventResult = await eventsRepo.insertEvent(eventData, client);

// Verificar idempotencia
if (eventResult === 'already_applied' || (eventResult && eventResult.already_executed === true)) {
  logInfo('MASTER', '[RESET][IDEMPOTENCY] Reset ya aplicado para esta capa', {
    traceId,
    execution_key: executionKey,
    student_uuid,
    item_ref,
    clean_layer: layer
  });
  skipped++;
  continue;  // ⚠️ NO se actualiza cleaning_item_state
}
```

**Condición de skip:**
- `eventResult === 'already_applied'` (legacy, no usado actualmente)
- `eventResult.already_executed === true` (retornado por repositorio cuando `ON CONFLICT`)

**Problema:** Esta condición NO verifica si `cleaning_item_state` está actualizado. Solo verifica si el evento existe.

---

## FASE 5 — PLAN DE SANEAMIENTO MANUAL (NO EJECUTAR AÚN)

### 5.1 Diseño de Función de Saneamiento

**Objetivo:** Recalcular estado base coherente para ítems encallados sin falsear historia.

**Contrato:**
- NO borrar eventos históricos
- NO modificar `cleaning_events` (append-only)
- Recalcular `cleaning_item_state` desde eventos si es necesario
- Insertar evento RESET HISTÓRICO válido si falta
- Ajustar `cleaning_item_state` de forma consistente

**Función canónica (DISEÑO):**

```javascript
// sanitize-stuck-reset-items.js (DISEÑO - NO EJECUTAR)
/**
 * Sanea ítems encallados tras resets históricos mal ejecutados.
 * 
 * REGLAS:
 * - NO modifica cleaning_events (append-only)
 * - Recalcula cleaning_item_state desde eventos si es necesario
 * - Inserta evento RESET HISTÓRICO si falta (con execution_key único histórico)
 * - Ajusta cleaning_item_state de forma consistente
 * 
 * @param {Array} stuckItems - Array de { student_uuid, item_ref, clean_layer, tipo_inconsistencia }
 * @returns {Promise<Object>} { sanitized: number, errors: Array }
 */
async function sanitizeStuckResetItems(stuckItems) {
  const sanitized = [];
  const errors = [];
  
  for (const item of stuckItems) {
    try {
      // 1. Verificar si existe evento reset para este item
      const eventsRepo = getDefaultCleaningEventsRepo();
      const resetEvents = await eventsRepo.listEventsForStudentItem({
        student_uuid: item.student_uuid,
        item_ref: item.item_ref,
        product_key: 'pde',
        domain_type: 'transmutation'
      });
      
      const resetEvent = resetEvents.find(e => 
        e.action_type === 'reset' && e.clean_layer === item.clean_layer
      );
      
      // 2. Si NO existe evento reset pero el estado indica reset:
      if (!resetEvent && item.tipo_inconsistencia === 'RESET_SIN_EVENTO_SHARED') {
        // Insertar evento RESET HISTÓRICO con execution_key único
        const historicalExecutionKey = `reset:${item.item_ref}:${item.student_uuid}:${item.clean_layer}:historical:${Date.now()}`;
        
        await eventsRepo.insertEvent({
          trace_id: `sanitize-${Date.now()}`,
          execution_key: historicalExecutionKey,
          student_uuid: item.student_uuid,
          product_key: 'pde',
          domain_type: 'transmutation',
          item_ref: item.item_ref,
          clean_layer: item.clean_layer,
          item_kind: 'recurrente',
          action_type: 'reset',
          delta_completed: null,
          set_remaining: null,
          actor_type: 'master',
          actor_ref: 'sanitize-script',
          surface_key: 'master.sanitize',
          meta: {
            sanitize_reason: item.tipo_inconsistencia,
            sanitize_timestamp: new Date().toISOString()
          }
        });
      }
      
      // 3. Recalcular cleaning_item_state desde eventos
      const stateRepo = getDefaultCleaningItemStateRepo();
      const currentState = await stateRepo.getState({
        student_uuid: item.student_uuid,
        item_ref: item.item_ref,
        product_key: 'pde',
        domain_type: 'transmutation'
      });
      
      // 4. Si el estado está inconsistente, recalcularlo
      if (needsRecalculation(currentState, resetEvent, item)) {
        // Obtener último reset para esta capa
        const lastReset = resetEvents
          .filter(e => e.action_type === 'reset' && e.clean_layer === item.clean_layer)
          .sort((a, b) => b.created_at - a.created_at)[0];
        
        // Obtener limpiezas post-reset
        const cleansAfterReset = resetEvents
          .filter(e => 
            e.action_type === 'mark_clean' 
            && e.clean_layer === item.clean_layer
            && e.created_at > lastReset.created_at
          )
          .sort((a, b) => b.created_at - a.created_at);
        
        // Recalcular estado
        const recalculatedState = {
          effective_since: lastReset.created_at,
          last_cleaned_at: cleansAfterReset[0]?.created_at || null,
          clean_count: cleansAfterReset.length
        };
        
        // Actualizar cleaning_item_state
        await stateRepo.upsertApplyReset({
          student_uuid: item.student_uuid,
          item_ref: item.item_ref,
          clean_layer: item.clean_layer,
          item_kind: 'recurrente',
          product_key: 'pde',
          domain_type: 'transmutation'
        });
        
        // Ajustar last_cleaned_at y clean_count manualmente si es necesario
        // (usar UPDATE directo solo si es necesario)
      }
      
      sanitized.push(item);
    } catch (error) {
      errors.push({
        item,
        error: error.message,
        stack: error.stack
      });
    }
  }
  
  return { sanitized: sanitized.length, errors };
}
```

### 5.2 Verificación de Saneamiento

**Después de ejecutar saneamiento (cuando se apruebe):**

1. Re-ejecutar queries de FASE 2
2. Verificar que los ítems encallados ya no aparecen
3. Verificar que `cleaning_item_state` está coherente con `cleaning_events`
4. Verificar que la proyección calcula correctamente el estado

---

## FASE 6 — INFORME FINAL

### 6.1 Tipos de Estados Encallados Detectados

**Resumen de queries FASE 2:**

1. **RESET_SIN_EVENTO_SHARED**: Estado indica reset pero no existe evento
2. **EVENTO_RESET_SIN_ACTUALIZACION_SHARED**: Evento reset existe pero estado no actualizado
3. **FECHA_FUTURA_SHARED**: `effective_since` en el futuro (imposible)
4. **CONTRADICCION_CLEAN_COUNT_SHARED**: `clean_count=0` pero `last_cleaned_at NOT NULL` (o viceversa)
5. **RESET_ANTIGUO_SIN_LIMPIEZA_SHARED**: Reset ejecutado hace >7 días pero nunca se limpió post-reset
6. **RESETS_DUPLICADOS**: Múltiples intentos de reset el mismo día (mismo execution_key)

### 6.2 Causa Raíz de Reset ALL "0 aplicados, X omitidos"

**Causa raíz identificada:**

1. **Idempotencia por execution_key diario:**
   - `execution_key = reset:{item_ref}:{student_uuid}:{clean_layer}:{YYYY-MM-DD}`
   - Si un reset se ejecutó el mismo día, el segundo intento será omitido
   - Si el primer reset falló parcialmente (evento insertado pero estado no actualizado), el segundo reset no puede corregirlo

2. **Falta de verificación de coherencia:**
   - La lógica de idempotencia solo verifica si el evento existe
   - NO verifica si `cleaning_item_state` está actualizado
   - Si el evento existe pero el estado no está actualizado, el reset se omite incorrectamente

3. **Resets parciales:**
   - Si un reset ALL falla a mitad de ejecución (error en `upsertApplyReset` para algunos estudiantes)
   - Los eventos SÍ se insertaron para esos estudiantes
   - El siguiente reset del mismo día será omitido por idempotencia
   - El estado queda inconsistente permanentemente

### 6.3 Qué NO Debe Volver a Pasar (Reglas)

**Reglas constitucionales para prevenir el problema:**

1. **Verificación de coherencia en idempotencia:**
   - Antes de omitir un reset por idempotencia, verificar que `cleaning_item_state` está actualizado
   - Si el evento existe pero el estado no está actualizado, forzar actualización

2. **Transacciones atómicas:**
   - Reset debe ser atómico: evento + actualización de estado en la misma transacción
   - Si falla la actualización de estado, rollback del evento

3. **Logs forenses obligatorios:**
   - Registrar cuando un reset es omitido por idempotencia
   - Registrar cuando un reset falla parcialmente
   - Incluir `trace_id` para correlación

4. **Verificación post-reset:**
   - Después de ejecutar reset ALL, verificar que todos los estudiantes fueron procesados correctamente
   - Si hay inconsistencias, reportarlas inmediatamente

### 6.4 Propuesta de Saneamiento Canónica

**Fase 1: Detección (YA COMPLETADA)**
- ✅ Queries de diagnóstico creadas
- ✅ Tipos de inconsistencias identificados

**Fase 2: Saneamiento Manual (PENDIENTE APROBACIÓN)**
- Ejecutar queries de FASE 2 para obtener lista de ítems encallados
- Para cada ítem encallado:
  - Verificar causa raíz específica
  - Aplicar saneamiento canónico (función de FASE 5)
  - Verificar que el estado queda coherente

**Fase 3: Verificación (POST-SANEAMIENTO)**
- Re-ejecutar queries de FASE 2
- Verificar que no quedan ítems encallados
- Verificar que reset ALL funciona correctamente

**Fase 4: Prevención (IMPLEMENTACIÓN FUTURA)**
- Implementar verificación de coherencia en idempotencia
- Implementar transacciones atómicas
- Implementar logs forenses obligatorios
- Implementar verificación post-reset

---

## CONCLUSIÓN

**Diagnóstico completado:**

✅ Tipos de reset mapeados completamente  
✅ Lógica de idempotencia entendida  
✅ Queries de diagnóstico creadas  
✅ Causa raíz de "0 aplicados, X omitidos" identificada  
✅ Plan de saneamiento diseñado  

**Próximos pasos (PENDIENTE APROBACIÓN):**

1. Ejecutar queries de FASE 2 en base de datos real
2. Obtener lista de ítems encallados
3. Revisar y aprobar plan de saneamiento
4. Ejecutar saneamiento manual (una vez aprobado)
5. Verificar que el sistema queda coherente

**NO se implementarán fixes sin validación explícita del usuario.**

---

**FIN DEL DIAGNÓSTICO**
