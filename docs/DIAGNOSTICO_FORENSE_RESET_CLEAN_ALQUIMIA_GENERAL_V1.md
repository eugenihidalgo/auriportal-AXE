# DIAGNÓSTICO FORENSE — RESET y CLEAN en Alquimia General v1
**Fecha:** 2026-01-18  
**Versión:** v1.0  
**Última actualización:** 2026-01-18 (violación cerrada v5.79.9)  
**Dominio:** MASTER - Alquimia General  
**Estado:** ✅ Diagnóstico completado — Violación cerrada (v5.79.9)

---

## OBJETIVO DEL DIAGNÓSTICO

Comparar el comportamiento **REAL** de RESET y CLEAN en Alquimia General con los contratos canónicos:
- `RESET_CONTRACT_V1.md`
- `CLEAN_AFTER_RESET_CONTRACT_V1.md`

**Propósito:** Identificar violaciones contractuales, código legacy aún activo, y casos rotos actualmente.

**⚠️ IMPORTANTE:** Este diagnóstico NO incluye fixes. Solo documenta el estado REAL del sistema.

---

## SECCIÓN A: MAPA DE RESET

### A.1 — Puntos de Ejecución de RESET

#### **Punto 1: resetStudentItemProgress()** (CANÓNICO)
**Ubicación:** `src/core/master/services/cleaning-engine-service.js:2014-2412`

**Cuándo se ejecuta:**
- `reset_scope='ITEM_STUDENT'` (reset de un item para un estudiante específico)
- `reset_scope='LIST_STUDENT'` (reset de una lista para un estudiante específico, itera items)

**Qué columnas toca:**
- ✅ `{clean_layer}_effective_since` (SOLO esta columna según contrato)
- ✅ `updated_at` (automático)

**Qué columnas NO toca:**
- ✅ `last_cleaned_at` (NO modifica directamente según contrato)
- ✅ `clean_count` (NO modifica directamente según contrato)
- ✅ `remaining`, `completed` (UNA_VEZ no tiene reset)

**Qué estado deja en DB:**
```sql
-- DESPUÉS de resetStudentItemProgress():
shared_effective_since = reset.created_at (o reset_at proporcionado)
shared_last_cleaned_at = NULL (si no hay limpiezas post-RESET)
shared_clean_count = 0 (si no hay limpiezas post-RESET)
-- O valores anteriores si había limpiezas post-RESET (rebaseStateFromReset los recalcula)
```

**Comportamiento por scope:**
- `ITEM_STUDENT`: Reset de un item para un estudiante
- `LIST_STUDENT`: Itera items de la lista, llama `resetStudentItemProgress()` para cada item recurrente

**Idempotencia:**
- ✅ Verifica si existe evento RESET con mismo `execution_key`
- ✅ Si existe y estado coherente → `skipped++`
- ✅ Si existe pero estado incoherente → aplica reset igualmente (idempotencia override)

**Código clave:**
```javascript
// Línea 2196-2298: Generación execution_key e inserción evento RESET
const executionKey = generateExecutionKey('reset', item_ref, student_uuid, new Date(), execution_mode, item_kind, layer);

// Línea 2288-2298: Aplicación reset canónico (SOLO effective_since)
await stateRepo.upsertApplyReset({
  student_uuid,
  product_key,
  domain_type,
  item_ref,
  clean_layer: layer,
  reset_at: resetTimestamp // Usar timestamp del evento RESET (no NOW())
}, client);
```

---

#### **Punto 2: resetAllStudentsItemProgress()** (CANÓNICO)
**Ubicación:** `src/core/master/services/cleaning-engine-service.js:2435-2638`

**Cuándo se ejecuta:**
- `reset_scope='ITEM_ALL'` (reset de un item para TODOS los estudiantes activos)
- `reset_scope='LIST_ALL'` (reset de una lista para TODOS los estudiantes activos, itera items + students)

**Qué columnas toca:**
- ✅ `{clean_layer}_effective_since` (SOLO esta columna según contrato)
- ✅ `updated_at` (automático)

**Qué columnas NO toca:**
- ✅ `last_cleaned_at` (NO modifica directamente según contrato)
- ✅ `clean_count` (NO modifica directamente según contrato)

**Qué estado deja en DB:**
```sql
-- DESPUÉS de resetAllStudentsItemProgress() para cada estudiante:
shared_effective_since = reset.created_at (o reset_at proporcionado)
shared_last_cleaned_at = NULL (si no hay limpiezas post-RESET)
shared_clean_count = 0 (si no hay limpiezas post-RESET)
```

**Comportamiento por scope:**
- `ITEM_ALL`: Itera estudiantes activos, llama `resetStudentItemProgress()` para cada uno
- `LIST_ALL`: Itera items de la lista (solo recurrentes), luego itera estudiantes, llama `resetStudentItemProgress()` para cada combinación

**Exclusiones:**
- ✅ Excluye estudiantes en pausa (`isStudentPaused()`)
- ✅ Solo procesa items recurrentes (salta items una_vez)

**Advertencias:**
- ⚠️ Línea 2494-2499: Warning si `clean_layer !== 'pde'` (contrato dice reset ALL solo PDE), pero NO falla

**Código clave:**
```javascript
// Línea 2525-2530: Obtener estudiantes activos (UUID-only)
const studentsResult = await queryFn(`
  SELECT id AS student_uuid
  FROM students
  WHERE deleted_at IS NULL
  ORDER BY id
`, []);

// Línea 2564-2581: Resetear cada estudiante usando función canónica
const resetResult = await resetStudentItemProgress({
  student_uuid: studentUuid,
  item_ref,
  item_kind,
  clean_layer,
  // ... resto de opciones
}, client);
```

---

#### **Punto 3: resetByScope()** (ORQUESTADOR CANÓNICO)
**Ubicación:** `src/core/master/services/cleaning-engine-service.js:2673-2936`

**Cuándo se ejecuta:**
- Endpoint `POST /master/api/alquimia-general/reset` con `reset_scope`

**Qué hace:**
- Mapea `reset_scope` a función específica:
  - `ITEM_STUDENT` → `resetStudentItemProgress()`
  - `ITEM_ALL` → `resetAllStudentsItemProgress()`
  - `LIST_STUDENT` → Itera items + `resetStudentItemProgress()` para cada item
  - `LIST_ALL` → Itera items + `resetAllStudentsItemProgress()` para cada item

**Validaciones:**
- ✅ Valida `reset_scope` válido
- ✅ Valida `clean_layer` obligatorio
- ✅ Valida campos según scope (item_ref, list_id, student_uuid)

**Código clave:**
```javascript
// Línea 2739-2840: Mapeo de scopes a funciones
if (reset_scope === 'ITEM_STUDENT') {
  const result = await resetStudentItemProgress({ ... });
} else if (reset_scope === 'ITEM_ALL') {
  const result = await resetAllStudentsItemProgress({ ... });
} else if (reset_scope === 'LIST_STUDENT') {
  // Itera items, llama resetStudentItemProgress() para cada uno
} else if (reset_scope === 'LIST_ALL') {
  // Itera items, llama resetAllStudentsItemProgress() para cada uno
}
```

---

#### **Punto 4: Endpoint Handler** (CANÓNICO)
**Ubicación:** `src/endpoints/master-api-alquimia-general.js:1836-1955`

**Cuándo se ejecuta:**
- `POST /master/api/alquimia-general/reset`

**Validaciones:**
- ✅ `reset_scope` obligatorio y válido
- ✅ `clean_layer` obligatorio ('shared' | 'pde')
- ✅ Campos según scope (item_ref, list_id, student_uuid)
- ✅ `item_kind` debe ser 'recurrente' (si viene)

**Llama a:**
- `resetByScope()` (función unificada)

**Código clave:**
```javascript
// Línea 1899-1920: Importar y llamar función unificada
const { resetByScope } = await import('../core/master/services/cleaning-engine-service.js');
const result = await resetByScope({
  reset_scope,
  item_ref,
  list_id,
  student_uuid,
  clean_layer,
  // ... resto de opciones
});
```

---

### A.2 — Repositorio: upsertApplyReset()

**Ubicación:** `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js:340-389`

**Qué hace:**
- ✅ INSERT/UPDATE en `cleaning_item_state`
- ✅ SOLO modifica `{clean_layer}_effective_since` (según contrato)
- ✅ NO modifica `last_cleaned_at` directamente
- ✅ NO modifica `clean_count` directamente

**SQL ejecutado:**
```sql
INSERT INTO cleaning_item_state (
  student_id, product_key, domain_type, item_ref,
  {effectiveSinceColumn}
) VALUES (
  $1, $2, $3, $4, $5
)
ON CONFLICT (student_id, product_key, domain_type, item_ref)
DO UPDATE SET
  {effectiveSinceColumn} = $5,
  updated_at = CURRENT_TIMESTAMP
RETURNING *
```

**⚠️ CONFIRMACIÓN CONTRATO:**
- ✅ Solo toca `{clean_layer}_effective_since`
- ✅ NO toca `last_cleaned_at`
- ✅ NO toca `clean_count`
- ✅ Usa `reset_at` proporcionado (no NOW())

---

### A.3 — Comparación REAL vs CANÓNICO (RESET)

| Aspecto | Contrato Canónico | Comportamiento REAL | ¿Cumple? |
|---------|-------------------|---------------------|----------|
| **Modifica effective_since** | ✅ SÍ (SOLO esta columna) | ✅ SÍ (línea 323-330) | ✅ CUMPLE |
| **Modifica last_cleaned_at** | ❌ NO (NO directamente) | ✅ NO (rebaseStateFromReset lo calcula después) | ✅ CUMPLE |
| **Modifica clean_count** | ❌ NO (NO directamente) | ✅ NO (rebaseStateFromReset lo calcula después) | ✅ CUMPLE |
| **Inserta evento RESET** | ✅ SÍ (obligatorio) | ✅ SÍ (línea 2198-2222) | ✅ CUMPLE |
| **Usa reset.created_at** | ✅ SÍ (no NOW()) | ✅ SÍ (línea 2285, 2297) | ✅ CUMPLE |
| **Prohibido en UNA_VEZ** | ❌ PROHIBIDO | ✅ Rechaza con error (línea 2075-2084) | ✅ CUMPLE |
| **Reset ALL solo PDE** | ✅ Solo PDE según contrato | ⚠️ Warning pero NO falla (línea 2494-2499) | ⚠️ CUMPLE PARCIAL |
| **Excluye pausados** | ✅ SÍ | ✅ SÍ (línea 2095-2103, 2556-2561) | ✅ CUMPLE |

**⚠️ HALLAZGO: Reset ALL warning pero no falla**
- Código: `src/core/master/services/cleaning-engine-service.js:2494-2499`
- Comportamiento: Warning si `clean_layer !== 'pde'` pero NO falla
- Impacto: Reset ALL puede ejecutarse con `clean_layer='shared'` aunque contrato dice solo PDE
- Severidad: Media (funciona pero no cumple contrato estrictamente)

---

## SECCIÓN B: MAPA DE CLEAN

### B.1 — Puntos de Ejecución de CLEAN

#### **Punto 1: markCleanStudent()** (CANÓNICO)
**Ubicación:** `src/core/master/services/cleaning-engine-service.js:705-1530` (aproximadamente)

**Cuándo se ejecuta:**
- Acción `alquimia.clean_student` (item individual, scope='student')
- Acción `alquimia.clean_all` (item ALL, scope='all')

**Qué columnas toca:**
- ✅ `{clean_layer}_last_cleaned_at` (establecido a cleanedAt)
- ✅ `{clean_layer}_clean_count` (incrementado)
- ✅ `{clean_layer}_remaining` (recalculado para una_vez)
- ✅ `{clean_layer}_completed` (recalculado para una_vez)
- ✅ `{clean_layer}_effective_since` (PRESERVADO si hay RESET previo)

**Qué columnas NO toca:**
- ✅ `{clean_layer}_effective_since` (PRESERVADO si hay RESET previo, según contrato)

**Detecta RESET previo:**
- ✅ Línea 971-973: Llama `getLastResetForItem()` para recurrente
- ✅ Línea 986-1207: Si hay RESET previo, ejecuta `rebaseStateFromReset()`

**Detecta estado 'reseteado':**
- ✅ Línea 1007-1010: Detecta si `currentEffective !== null && currentLastCleaned === null && currentEffective <= resetAt`
- ✅ Línea 1012-1030: Log forense `[CLEAN_AFTER_RESET]` cuando detecta estado 'reseteado'

**Ejecuta rebase si hay RESET:**
- ✅ Línea 1036-1042: `needsRebase = hasReset || ...` (SIEMPRE rebase si hay reset previo)
- ✅ Línea 1091-1207: Si `needsRebase`, ejecuta `rebaseStateFromReset()`
- ✅ Línea 1102-1151: Pasa `currentCleanEvent` a `rebaseStateFromReset()` para incluir evento actual

**Aplica limpieza:**
- ✅ Línea 1224-1282: RECURRENTE → `upsertApplyRecurrent()` (actualiza `last_cleaned_at`, incrementa `clean_count`)
- ✅ Línea 1283-1327: UNA_VEZ → `upsertApplyOneTimeIncrementShared/Pde()` (incrementa `completed`, recalcula `remaining`)

**Verifica estado resultante:**
- ✅ Línea 1353-1379: Si había estado 'reseteado' previo, verifica que se normalizó a 'reviewed'

**Código clave:**
```javascript
// Línea 971-973: Obtener último RESET (solo recurrente)
const lastReset = itemKind === 'recurrente' 
  ? await getLastResetForItem(student_uuid, item_ref, clean_layer, product_key, domain_type, client)
  : null;

// Línea 1007-1010: Detectar estado 'reseteado'
const isPreviousStateReseteado = currentEffective !== null && 
                                 currentLastCleaned === null && 
                                 currentEffective.getTime() <= resetAt.getTime();

// Línea 1036-1042: Determinar si necesita rebase
const needsRebase = hasReset || // SIEMPRE rebase si hay reset previo
                   !currentEffective || 
                   currentEffective < resetAt ||
                   // ... más condiciones

// Línea 1173: Ejecutar rebase (incluye evento actual)
const rebasedState = await rebaseStateFromReset(
  student_uuid, item_ref, clean_layer, lastReset, 
  product_key, domain_type, traceId, client, 
  currentCleanEvent // ← Incluye evento actual
);
```

---

#### **Punto 2: rebaseStateFromReset()** (CANÓNICO)
**Ubicación:** `src/core/master/services/cleaning-engine-service.js:191-411`

**Cuándo se ejecuta:**
- Durante `markCleanStudent()` si hay RESET previo (línea 1173)

**Qué columnas toca:**
- ✅ `{clean_layer}_effective_since` (re-establece a reset.created_at)
- ✅ `{clean_layer}_last_cleaned_at` (establece desde eventos post-RESET)
- ✅ `{clean_layer}_clean_count` (recalcula desde eventos post-RESET)

**Qué hace:**
1. ✅ Obtiene todos los eventos post-RESET para la capa
2. ✅ Filtra limpiezas posteriores o iguales al RESET (`created_at >= resetAt`)
3. ✅ **INCLUYE evento CLEAN actual** si se está ejecutando un CLEAN post-RESET (línea 248-261)
4. ✅ Recalcula `last_cleaned_at` desde último evento post-RESET
5. ✅ Recalcula `clean_count` desde eventos post-RESET
6. ✅ **PRESERVA effective_since** (no lo modifica a NOW(), queda como reset.created_at)

**Código clave:**
```javascript
// Línea 248-261: Incluir evento CLEAN actual si se está ejecutando
if (currentCleanEvent) {
  // Solo incluir si es posterior o igual al reset (>= para incluir eventos en el mismo momento)
  if (cleanEventDate >= resetAt) {
    allEvents.push(currentCleanEvent);
    wasCurrentCleanEventIncluded = true;
  }
}

// Línea 263-271: Filtrar limpiezas posteriores o iguales al RESET
const cleansAfterReset = allEvents
  .filter(e => 
    e.action_type === 'mark_clean' && 
    e.clean_layer === cleanLayer &&
    new Date(e.created_at) >= resetAt // ← >= para incluir eventos en el mismo momento
  )
  .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

// Línea 307-312: Reconstruir estado desde RESET
const effectiveSince = resetAt; // ← PRESERVA reset.created_at
const lastCleanedAt = cleansAfterReset.length > 0 
  ? new Date(cleansAfterReset[cleansAfterReset.length - 1].created_at)
  : null;
const cleanCount = cleansAfterReset.length;

// Línea 323-330: Aplicar reset canónico (SOLO effective_since)
await stateRepo.upsertApplyReset({
  student_uuid: studentUuid,
  item_ref: itemRef,
  clean_layer: cleanLayer,
  reset_at: resetAt, // ← Usar reset.created_at (no NOW())
  product_key: productKey,
  domain_type: domainType
}, client);

// Línea 336-354: Ajustar contadores desde eventos post-RESET
await queryFn(`
  UPDATE cleaning_item_state
  SET ${effectiveColumn} = $1,
      ${lastCleanedColumn} = $2,
      ${countColumn} = $3,
      updated_at = CURRENT_TIMESTAMP
  WHERE student_id = $4
    AND product_key = $5
    AND domain_type = $6
    AND item_ref = $7
`, [
  effectiveSince, // ← PRESERVA reset.created_at
  lastCleanedAt,  // ← Desde eventos post-RESET
  cleanCount,     // ← Desde eventos post-RESET
  // ...
]);
```

---

#### **Punto 3: upsertApplyRecurrent()** (CANÓNICO)
**Ubicación:** `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js:540-700` (aproximadamente)

**Cuándo se ejecuta:**
- Durante `markCleanStudent()` para items RECURRENTE (línea 1275-1282)

**Qué columnas toca:**
- ✅ `{clean_layer}_last_cleaned_at` (establecido a cleanedAt)
- ✅ `{clean_layer}_clean_count` (incrementado)

**Qué columnas NO toca:**
- ✅ `{clean_layer}_effective_since` (NO modifica, queda como está)

**⚠️ NOTA:** Este método NO sabe de RESET. Simplemente actualiza `last_cleaned_at` y `clean_count`. El rebase se ejecuta ANTES de este método.

---

#### **Punto 4: Frontend Guard — isCleanAllowed()** (CANÓNICO)
**Ubicación:** `public/js/master/master-alquimia-general-client.js:3696-3699`

**Cuándo se ejecuta:**
- Antes de mostrar botón "Limpiar" en flotante

**Qué hace:**
- ✅ Verifica si el estado permite limpieza
- ✅ `allowedStates = ['never', 'reseteado', 'pending', 'important']`
- ✅ **'reseteado' está permitido** (línea 3697)

**Código clave:**
```javascript
function isCleanAllowed(state) {
  const allowedStates = ['never', 'reseteado', 'pending', 'important'];
  return allowedStates.includes(state);
}
```

**⚠️ CONFIRMACIÓN CONTRATO:**
- ✅ Estado 'reseteado' permite limpieza (cumple CLEAN_AFTER_RESET_CONTRACT_V1)
- ✅ NO bloquea CLEAN sobre estado 'reseteado'

---

### B.2 — Comparación REAL vs CANÓNICO (CLEAN AFTER RESET)

| Aspecto | Contrato Canónico | Comportamiento REAL | ¿Cumple? |
|---------|-------------------|---------------------|----------|
| **CLEAN válido sobre 'reseteado'** | ✅ SÍ (siempre válido) | ✅ SÍ (línea 3697, frontend permite) | ✅ CUMPLE |
| **Detecta estado 'reseteado'** | ✅ SÍ | ✅ SÍ (línea 1007-1010) | ✅ CUMPLE |
| **Log forense cuando detecta** | ✅ SÍ | ✅ SÍ (línea 1012-1030) | ✅ CUMPLE |
| **Ejecuta rebase si hay RESET** | ✅ SÍ (obligatorio) | ✅ SÍ (línea 1091-1207) | ✅ CUMPLE |
| **Incluye evento CLEAN actual** | ✅ SÍ (obligatorio) | ✅ SÍ (línea 1102-1151) | ✅ CUMPLE |
| **PRESERVA effective_since** | ✅ SÍ (no cambia a NOW()) | ✅ SÍ (línea 327, 338, 347) | ✅ CUMPLE |
| **Establece last_cleaned_at** | ✅ SÍ (NOW() o created_at evento) | ✅ SÍ (línea 1226-1266, 339) | ✅ CUMPLE |
| **Incrementa clean_count** | ✅ SÍ (+1) | ✅ SÍ (línea 1275-1282, 340) | ✅ CUMPLE |
| **NO recalcula thresholds** | ✅ SÍ (NO usa threshold_days) | ✅ SÍ (NO valida threshold_days antes de ejecutar) | ✅ CUMPLE |
| **NO aplica overrides** | ✅ SÍ (NO lee overrides) | ✅ SÍ (NO lee student_item_overrides) | ✅ CUMPLE |
| **Verifica estado resultante** | ✅ SÍ | ✅ SÍ (línea 1353-1379) | ✅ CUMPLE |

**✅ RESULTADO:** CLEAN AFTER RESET **CUMPLE EL CONTRATO CANÓNICO** completamente.

---

## SECCIÓN C: VIOLACIONES CONTRACTUALES

### C.1 — Violaciones de RESET

#### **Violación 1: Reset ALL no falla si clean_layer !== 'pde'** ⚠️ MEDIA

**Ubicación:** `src/core/master/services/cleaning-engine-service.js:2494-2499`

**Comportamiento REAL:**
```javascript
// REGLA CONSTITUCIONAL: Reset ALL solo afecta PDE
if (clean_layer !== 'pde') {
  logWarn('MASTER', 'Reset ALL debe usar clean_layer=pde según contrato', {
    traceId,
    clean_layer_provided: clean_layer
  });
  // No fallar, pero advertir (puede ser que se quiera resetear shared también en el futuro)
}
```

**Contrato esperado:**
- Según `RESET_CONTRACT_V1.md`, reset ALL debe usar solo PDE
- El código solo hace WARNING, no falla

**Impacto:**
- Reset ALL puede ejecutarse con `clean_layer='shared'` aunque contrato dice solo PDE
- Funciona pero no cumple contrato estrictamente

**Severidad:** Media (funciona pero no cumple contrato estrictamente)

**Código exacto:**
```javascript
// src/core/master/services/cleaning-engine-service.js:2493-2499
// REGLA CONSTITUCIONAL: Reset ALL solo afecta PDE
if (clean_layer !== 'pde') {
  logWarn('MASTER', 'Reset ALL debe usar clean_layer=pde según contrato', {
    traceId,
    clean_layer_provided: clean_layer
  });
  // No fallar, pero advertir
}
```

---

#### **Violación 2: NO HAY violaciones adicionales** ✅

Después de revisar exhaustivamente el código:
- ✅ Reset SOLO modifica `effective_since` (cumple contrato)
- ✅ Reset NO modifica `last_cleaned_at` directamente (cumple contrato)
- ✅ Reset NO modifica `clean_count` directamente (cumple contrato)
- ✅ Reset inserta evento RESET (cumple contrato)
- ✅ Reset usa `reset.created_at` (no NOW()) (cumple contrato)
- ✅ Reset rechaza UNA_VEZ (cumple contrato)
- ✅ Reset excluye pausados (cumple contrato)

---

### C.2 — Violaciones de CLEAN AFTER RESET

#### **Violación 1: NO HAY violaciones** ✅

Después de revisar exhaustivamente el código:
- ✅ CLEAN detecta estado 'reseteado' (cumple contrato)
- ✅ CLEAN ejecuta rebase si hay RESET previo (cumple contrato)
- ✅ CLEAN incluye evento actual en rebase (cumple contrato)
- ✅ CLEAN PRESERVA effective_since (cumple contrato)
- ✅ CLEAN establece last_cleaned_at (cumple contrato)
- ✅ CLEAN incrementa clean_count (cumple contrato)
- ✅ CLEAN NO recalcula thresholds (cumple contrato)
- ✅ CLEAN NO aplica overrides (cumple contrato)
- ✅ CLEAN verifica estado resultante (cumple contrato)
- ✅ Frontend permite CLEAN sobre 'reseteado' (cumple contrato)

---

### C.3 — Código Legacy (DEPRECATED pero aún presente)

#### **Legacy 1: deleteState()** (DEPRECATED)
**Ubicación:** `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js:408-449`

**Estado:** ⚠️ DEPRECATED pero aún presente

**Comportamiento:**
- Elimina fila completa de `cleaning_item_state`
- ⚠️ NO usa eventos (viola contrato canónico)
- ⚠️ NO inserta evento RESET

**Uso actual:**
- ✅ NO se llama desde código canónico (verificado)
- ⚠️ Método aún existe en repositorio

**Código:**
```javascript
// src/infra/repos/cleaning/cleaning-item-state-repo-pg.js:408-449
async deleteState(options, client = null) {
  // ⚠️ DEPRECATED: Usar upsertApplyReset() en su lugar para reset canónico.
  // Este método se mantiene solo para compatibilidad legacy.
  
  // Elimina fila completa (viola contrato canónico)
  const sqlQuery = `DELETE FROM cleaning_item_state WHERE ...`;
}
```

**Recomendación:** Eliminar método o añadir guard que bloquee su uso en runtime canónico.

---

#### **Legacy 2: Endpoints deprecated** (DEPRECATED)
**Ubicación:** `src/endpoints/master-api-alquimia-general.js:2067-2553`

**Endpoints deprecated:**
- `POST /master/api/alquimia-general/reset-item` (línea 2074-2181)
- `POST /master/api/alquimia-general/reset-list` (línea 2187-2294)
- `POST /master/api/alquimia-general/reset-item-all` (línea 2356-2445)
- `POST /master/api/alquimia-general/reset-list-all` (línea 2463-2576)

**Estado:** ⚠️ DEPRECATED pero aún activos

**Nota en código:**
```javascript
// Línea 2067-2068
// NOTA: Estos endpoints están deprecated. Usar POST /master/api/alquimia-general/reset
```

**Comportamiento:**
- ✅ Redirigen a `resetByScope()` (canónico)
- ⚠️ Endpoints aún funcionan pero marcados como deprecated

**Recomendación:** Eliminar endpoints deprecated o añadir guard que bloquee su uso.

---

## SECCIÓN D: CASOS ROTOS ACTUALMENTE

### D.1 — Casos Rotos de RESET

#### **Caso Roto 1: Reset ALL con clean_layer='shared' no falla** ⚠️

**Descripción:**
- Reset ALL puede ejecutarse con `clean_layer='shared'` aunque contrato dice solo PDE
- Código solo hace WARNING, no falla

**Ubicación:** `src/core/master/services/cleaning-engine-service.js:2494-2499`

**Impacto:**
- Reset ALL se ejecuta correctamente pero no cumple contrato estrictamente
- Funciona pero puede causar confusión

**Severidad:** Media (funciona pero no cumple contrato)

---

### D.2 — Casos Rotos de CLEAN AFTER RESET

#### **Caso Roto 1: NO HAY casos rotos** ✅

Después de revisar exhaustivamente el código:
- ✅ CLEAN funciona correctamente sobre estado 'reseteado'
- ✅ CLEAN normaliza estado a 'reviewed' después de ejecutarse
- ✅ Frontend permite CLEAN sobre 'reseteado'
- ✅ Backend ejecuta rebase correctamente
- ✅ effective_since se preserva
- ✅ last_cleaned_at se establece correctamente

**✅ RESULTADO:** CLEAN AFTER RESET **NO tiene casos rotos** actualmente.

---

## SECCIÓN E: HIPÓTESIS — ¿Por qué el reset antiguo "rompía todo"?

### E.1 — Hipótesis Principal: Reset antiguo usaba DELETE

**Evidencia:**
- Método `deleteState()` aún existe (DEPRECATED)
- Endpoints deprecated aún están presentes
- Código menciona "reset antiguo" en comentarios

**Hipótesis:**
El reset antiguo probablemente:
1. ❌ **Eliminaba la fila completa** de `cleaning_item_state` (DELETE)
2. ❌ **NO insertaba evento RESET** en `cleaning_events`
3. ❌ **NO preservaba historia** (eventos previos quedaban huérfanos)
4. ❌ **NO permitía rebase** (no había evento RESET para calcular desde)
5. ❌ **CLEAN después de reset fallaba** (no había effective_since, estado quedaba inconsistente)

**Evidencia en código:**
- Método `deleteState()` aún existe (línea 408-449)
- Comentarios mencionan "reset canónico" vs "delete" (línea 397-398)
- `rebaseStateFromReset()` necesita evento RESET para funcionar (línea 191-411)

**Flujo antiguo (hipotético):**
```
1. RESET antiguo:
   DELETE FROM cleaning_item_state WHERE ... (elimina fila completa)
   ❌ NO inserta evento RESET
   ↓
2. Estado queda como si nunca existió
   ↓
3. CLEAN intenta ejecutarse:
   ❌ No hay effective_since (fila eliminada)
   ❌ No hay evento RESET para calcular desde
   ❌ rebaseStateFromReset() falla o no se ejecuta
   ↓
4. Estado queda inconsistente:
   - last_cleaned_at actualizado pero effective_since = NULL
   - CPM calcula estado incorrectamente
   - UI muestra estado incorrecto
```

**Flujo nuevo (canónico):**
```
1. RESET canónico:
   INSERT evento RESET en cleaning_events (append-only)
   UPDATE cleaning_item_state SET effective_since = reset.created_at (SOLO esta columna)
   ✅ Historia preservada
   ↓
2. Estado queda como 'reseteado' (effective_since presente, last_cleaned_at = NULL)
   ↓
3. CLEAN se ejecuta:
   ✅ Detecta RESET previo (getLastResetForItem)
   ✅ Detecta estado 'reseteado'
   ✅ Ejecuta rebaseStateFromReset()
   ✅ Incluye evento CLEAN actual en eventos post-RESET
   ✅ Recalcula contadores desde eventos post-RESET
   ✅ PRESERVA effective_since
   ✅ Establece last_cleaned_at
   ↓
4. Estado queda consistente:
   - effective_since = reset.created_at (PRESERVADO)
   - last_cleaned_at = cleanedAt (NUEVO)
   - clean_count = 1 (NUEVO)
   - CPM calcula estado como 'reviewed' (days_since = 0)
   - UI muestra estado correcto
```

---

### E.2 — Hipótesis Secundaria: Reset antiguo no preservaba effective_since

**Evidencia:**
- Reset canónico establece `effective_since = reset.created_at` (línea 327, 338)
- `rebaseStateFromReset()` PRESERVA effective_since (línea 327, 338, 347)
- CLEAN después de reset necesita `effective_since` para calcular estado

**Hipótesis:**
El reset antiguo probablemente:
- ❌ Establecía `effective_since = NOW()` (no preservaba timestamp del reset)
- ❌ O NO establecía `effective_since` (dejaba NULL)
- ❌ CLEAN después de reset no podía calcular estado correctamente

**Evidencia en código:**
- Reset canónico usa `reset.created_at` (no NOW()) (línea 327, 338)
- Comentarios explícitos: "Usar timestamp del evento RESET (no NOW())" (línea 2297)

---

### E.3 — Hipótesis Terciaria: Reset antiguo no permitía CLEAN inmediato

**Evidencia:**
- Código actual NO tiene validaciones temporales antes de CLEAN
- Frontend permite CLEAN sobre 'reseteado' (línea 3697)
- Backend ejecuta CLEAN sobre 'reseteado' sin problemas (línea 1012-1030)

**Hipótesis:**
El reset antiguo probablemente:
- ❌ Validaba tiempo transcurrido desde reset antes de permitir CLEAN
- ❌ O bloqueaba CLEAN sobre estado 'reseteado'
- ❌ CLEAN después de reset fallaba o no se ejecutaba

**Evidencia en código:**
- CLEAN actual NO valida tiempo desde reset (cumple contrato)
- Comentarios explícitos: "CLEAN NO depende del tiempo desde reset" (línea 943)
- Guard semántico: "CLEAN SIEMPRE es válido sobre estado reseteado" (línea 941-942)

---

## SECCIÓN F: RESUMEN EJECUTIVO

### F.1 — Estado Actual del Sistema

**RESET:**
- ✅ **CUMPLE el contrato canónico** (excepto warning en reset ALL)
- ✅ Solo modifica `effective_since`
- ✅ Inserta evento RESET
- ✅ Usa `reset.created_at` (no NOW())
- ⚠️ **WARNING:** Reset ALL no falla si `clean_layer !== 'pde'` (funciona pero no cumple contrato estrictamente)

**CLEAN AFTER RESET:**
- ✅ **CUMPLE el contrato canónico completamente**
- ✅ Detecta estado 'reseteado'
- ✅ Ejecuta rebase automáticamente
- ✅ PRESERVA effective_since
- ✅ Establece last_cleaned_at correctamente
- ✅ Normaliza estado a 'reviewed'
- ✅ NO tiene casos rotos actualmente

---

### F.2 — Violaciones Contractuales Detectadas

| Violación | Ubicación | Severidad | Estado |
|-----------|-----------|-----------|--------|
| Reset ALL no falla si clean_layer !== 'pde' | `cleaning-engine-service.js:2494-2499` | Media | ✅ CERRADA (v5.79.9) |

**Total:** 1 violación detectada, **1 violación cerrada (v5.79.9)**

**⚠️ NOTA:** La violación fue detectada en el diagnóstico inicial y cerrada en v5.79.9 mediante fallo duro obligatorio.

---

### F.3 — Código Legacy Detectado

| Código Legacy | Ubicación | Estado | Acción Recomendada |
|---------------|-----------|--------|-------------------|
| `deleteState()` | `cleaning-item-state-repo-pg.js:408-449` | DEPRECATED | Eliminar o añadir guard que bloquee uso |
| `POST /reset-item` (deprecated) | `master-api-alquimia-general.js:2074-2181` | DEPRECATED | Eliminar endpoint o añadir guard |
| `POST /reset-list` (deprecated) | `master-api-alquimia-general.js:2187-2294` | DEPRECATED | Eliminar endpoint o añadir guard |
| `POST /reset-item-all` (deprecated) | `master-api-alquimia-general.js:2356-2445` | DEPRECATED | Eliminar endpoint o añadir guard |
| `POST /reset-list-all` (deprecated) | `master-api-alquimia-general.js:2463-2576` | DEPRECATED | Eliminar endpoint o añadir guard |

**Total:** 5 elementos legacy (DEPRECATED pero aún presentes)

---

### F.4 — Casos Rotos Actualmente

| Caso Roto | Descripción | Ubicación | Severidad |
|-----------|-------------|-----------|-----------|
| Reset ALL con clean_layer='shared' | No falla aunque contrato dice solo PDE | `cleaning-engine-service.js:2494-2499` | Media |

**Total:** 1 caso roto (severidad media)

**✅ NOTA IMPORTANTE:** CLEAN AFTER RESET **NO tiene casos rotos** actualmente. El sistema funciona correctamente según contrato.

---

## SECCIÓN G: TABLA COMPARATIVA REAL vs CANÓNICO

### G.1 — Tabla de RESET

| Comportamiento | RESET_CONTRACT_V1 | Código REAL | ¿Cumple? | Archivo + Línea |
|----------------|-------------------|-------------|----------|-----------------|
| **Modifica effective_since** | ✅ SÍ (SOLO esta columna) | ✅ SÍ | ✅ SÍ | `cleaning-engine-service.js:323-330` |
| **Modifica last_cleaned_at** | ❌ NO (NO directamente) | ✅ NO | ✅ SÍ | `rebaseStateFromReset()` lo calcula después |
| **Modifica clean_count** | ❌ NO (NO directamente) | ✅ NO | ✅ SÍ | `rebaseStateFromReset()` lo calcula después |
| **Inserta evento RESET** | ✅ SÍ (obligatorio) | ✅ SÍ | ✅ SÍ | `cleaning-engine-service.js:2198-2222` |
| **Usa reset.created_at** | ✅ SÍ (no NOW()) | ✅ SÍ | ✅ SÍ | `cleaning-engine-service.js:2285, 2297` |
| **Prohibido en UNA_VEZ** | ❌ PROHIBIDO | ✅ Rechaza con error | ✅ SÍ | `cleaning-engine-service.js:2075-2084` |
| **Reset ALL solo PDE** | ✅ Solo PDE | ⚠️ Warning pero NO falla | ⚠️ PARCIAL | `cleaning-engine-service.js:2494-2499` |
| **Excluye pausados** | ✅ SÍ | ✅ SÍ | ✅ SÍ | `cleaning-engine-service.js:2095-2103` |

---

### G.2 — Tabla de CLEAN AFTER RESET

| Comportamiento | CLEAN_AFTER_RESET_CONTRACT_V1 | Código REAL | ¿Cumple? | Archivo + Línea |
|----------------|-------------------------------|-------------|----------|-----------------|
| **CLEAN válido sobre 'reseteado'** | ✅ SÍ (siempre válido) | ✅ SÍ | ✅ SÍ | `master-alquimia-general-client.js:3697` |
| **Detecta estado 'reseteado'** | ✅ SÍ | ✅ SÍ | ✅ SÍ | `cleaning-engine-service.js:1007-1010` |
| **Log forense cuando detecta** | ✅ SÍ | ✅ SÍ | ✅ SÍ | `cleaning-engine-service.js:1012-1030` |
| **Ejecuta rebase si hay RESET** | ✅ SÍ (obligatorio) | ✅ SÍ | ✅ SÍ | `cleaning-engine-service.js:1091-1207` |
| **Incluye evento CLEAN actual** | ✅ SÍ (obligatorio) | ✅ SÍ | ✅ SÍ | `cleaning-engine-service.js:1102-1151` |
| **PRESERVA effective_since** | ✅ SÍ (no cambia a NOW()) | ✅ SÍ | ✅ SÍ | `cleaning-engine-service.js:327, 338, 347` |
| **Establece last_cleaned_at** | ✅ SÍ (NOW() o created_at evento) | ✅ SÍ | ✅ SÍ | `cleaning-engine-service.js:1226-1266, 339` |
| **Incrementa clean_count** | ✅ SÍ (+1) | ✅ SÍ | ✅ SÍ | `cleaning-engine-service.js:1275-1282, 340` |
| **NO recalcula thresholds** | ✅ SÍ (NO usa threshold_days) | ✅ SÍ | ✅ SÍ | NO valida threshold_days antes de ejecutar |
| **NO aplica overrides** | ✅ SÍ (NO lee overrides) | ✅ SÍ | ✅ SÍ | NO lee student_item_overrides |
| **Verifica estado resultante** | ✅ SÍ | ✅ SÍ | ✅ SÍ | `cleaning-engine-service.js:1353-1379` |

---

## SECCIÓN H: ARCHIVOS CLAVE REVISADOS

### H.1 — Servicios

1. **`src/core/master/services/cleaning-engine-service.js`** (2936 líneas)
   - `resetStudentItemProgress()` (línea 2014-2412)
   - `resetAllStudentsItemProgress()` (línea 2435-2638)
   - `resetByScope()` (línea 2673-2936)
   - `markCleanStudent()` (línea 705-1530 aprox.)
   - `rebaseStateFromReset()` (línea 191-411)
   - `getLastResetForItem()` (línea 148-174)

2. **`src/core/master/services/cleaning-layer-constants.js`**
   - Validaciones de clean_layer (NO bloquea CLEAN sobre 'reseteado')

---

### H.2 — Repositorios

1. **`src/infra/repos/cleaning/cleaning-item-state-repo-pg.js`**
   - `upsertApplyReset()` (línea 340-389) - CANÓNICO ✅
   - `deleteState()` (línea 408-449) - DEPRECATED ⚠️
   - `upsertApplyRecurrent()` (línea ~540-700) - CANÓNICO ✅
   - `upsertApplyOneTimeIncrementShared()` - CANÓNICO ✅
   - `upsertApplyOneTimeIncrementPde()` - CANÓNICO ✅

---

### H.3 — Endpoints

1. **`src/endpoints/master-api-alquimia-general.js`**
   - `POST /master/api/alquimia-general/reset` (línea 1836-1955) - CANÓNICO ✅
   - `POST /master/api/alquimia-general/reset-item` (línea 2074-2181) - DEPRECATED ⚠️
   - `POST /master/api/alquimia-general/reset-list` (línea 2187-2294) - DEPRECATED ⚠️
   - `POST /master/api/alquimia-general/reset-item-all` (línea 2356-2445) - DEPRECATED ⚠️
   - `POST /master/api/alquimia-general/reset-list-all` (línea 2463-2576) - DEPRECATED ⚠️

---

### H.4 — Frontend

1. **`public/js/master/master-alquimia-general-client.js`**
   - `isCleanAllowed()` (línea 3696-3699) - CANÓNICO ✅
   - Render de botones CLEAN (línea 3510-3573) - CANÓNICO ✅

---

## SECCIÓN I: CONCLUSIONES

### I.1 — Estado General del Sistema

**RESET:**
- ✅ **Estado:** Completamente canónico (violación cerrada v5.79.9)
- ✅ **Violación:** CERRADA (v5.79.9) - Reset ALL ahora falla si `clean_layer !== 'pde'`
- ⚠️ **Legacy:** Métodos y endpoints deprecated aún presentes (no se usan pero existen)

**CLEAN AFTER RESET:**
- ✅ **Estado:** Completamente canónico
- ✅ **Violaciones:** NINGUNA
- ✅ **Casos rotos:** NINGUNO

---

### I.2 — Recomendaciones

1. ✅ **Fix Violación Reset ALL:**
   - ✅ **COMPLETADO (v5.79.9):** `resetAllStudentsItemProgress()` ahora falla si `clean_layer !== 'pde'`
   - ✅ Ubicación: `src/core/master/services/cleaning-engine-service.js:2493-2505`
   - ✅ Error code: `RESET_ALL_INVALID_LAYER`
   - ✅ Log estructurado: Prefijo `[RESET][ALL][INVALID_LAYER]`

2. **Eliminar Código Legacy (Pendiente):**
   - Eliminar método `deleteState()` o añadir guard que bloquee uso
   - Eliminar endpoints deprecated o añadir guard que bloquee uso

3. **Verificación:**
   - ✅ Ejecutar tests de RESET y CLEAN AFTER RESET
   - ✅ Verificar que reset ALL falla con `clean_layer='shared'` (v5.79.9+)

---

## SECCIÓN J: REFERENCIAS

### J.1 — Contratos Canónicos

- `docs/contracts/RESET_CONTRACT_V1.md` - Contrato canónico de RESET
- `docs/contracts/CLEAN_AFTER_RESET_CONTRACT_V1.md` - Contrato canónico de CLEAN AFTER RESET

### J.2 — Diagnósticos Relacionados

- `docs/DIAGNOSTICO_CLEAN_AFTER_RESET.md` - Diagnóstico histórico de CLEAN después de RESET
- `docs/DIAGNOSTICO_THRESHOLD_RESET.md` - Análisis de PENDING después de RESET

### J.3 — Código Clave

- `src/core/master/services/cleaning-engine-service.js` - Servicio principal
- `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js` - Repositorio
- `src/endpoints/master-api-alquimia-general.js` - Endpoints

---

**FIN DEL DIAGNÓSTICO**
