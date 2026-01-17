# DIAGNÓSTICO THRESHOLD / RESET — Estado PENDING
## Análisis de cómo se posiciona un ítem en PENDING tras RESET

**Fecha:** 2026-01-13  
**Objetivo:** Diagnosticar cómo y dónde se aplica la lógica que posiciona un ítem en estado PENDING (amarillo) tras un RESET, en relación con threshold_days

---

## RESUMEN EJECUTIVO

### Conclusión Principal

**❌ NO existe lógica que ajuste `effective_since` basada en `threshold_days` para posicionar ítems en PENDING tras reset.**

**Estado actual REAL:**
- Tras reset, `effective_since = reset.created_at` (timestamp del evento RESET)
- CPM calcula `days_since = 0` cuando NO hay limpieza post-RESET
- Estado resultante = `'reseteado'` (NO `'pending'`)

**Discrepancia detectada:**
- Comentarios históricos sugieren que "reset siempre produce pending"
- Código real produce `'reseteado'` con `days_since = 0`
- **NO hay lógica que ajuste `effective_since` basada en `threshold_days`**

---

## FASE 1 — LOCALIZACIÓN DE CÁLCULOS TEMPORALES

### 1.1. Referencias a threshold_days en código

#### Archivo: `src/core/master/services/cleaning-projection-model.js`

**Función:** `computeRecurrenteLayerState()` (línea 160)

**Qué hace:**
- Recibe `threshold_days` como parámetro
- Calcula `criticalThreshold = threshold_days * critical_multiplier`
- Compara `days_since` con `threshold_days` y `criticalThreshold` para decidir estado

**Código relevante:**
```javascript
// Línea 334-342
if (daysSince !== null && daysSince < threshold_days) {
  // Limpieza reciente → 'reviewed'
  state = 'reviewed';
} else if (daysSince !== null && daysSince < criticalThreshold) {
  // Limpieza antigua pero no crítica → 'pending'
  state = 'pending';
} else if (daysSince !== null) {
  // Limpieza muy antigua → 'important'
  state = 'important';
}
```

**⚠️ CONCLUSIÓN:** CPM usa `threshold_days` SOLO para comparar `days_since`, NO para ajustar `effective_since`.

---

#### Archivo: `src/core/master/services/cleaning-engine-service.js`

**Función:** `resetStudentItemProgress()` (línea 1907)

**Qué hace:**
- Inserta evento RESET en `cleaning_events`
- Llama a `upsertApplyReset()` para establecer `effective_since`

**Código relevante:**
```javascript
// Línea 2184-2191
await stateRepo.upsertApplyReset({
  student_uuid,
  product_key,
  domain_type,
  item_ref,
  clean_layer: layer,
  reset_at: resetTimestamp // Usar timestamp del evento RESET (no NOW())
}, client);
```

**⚠️ CONCLUSIÓN:** Reset NO usa `threshold_days` para ajustar `effective_since`. Usa `reset.created_at` directamente.

---

### 1.2. Referencias a effective_since con offsets

**Búsqueda:** `effective_since +/- días`, `effective_since + threshold`, `effective_since - threshold`

**Resultado:** ❌ NO SE ENCONTRARON

**⚠️ CONCLUSIÓN:** NO existe código que ajuste `effective_since` con offset basado en `threshold_days`.

---

### 1.3. Helpers de fechas relacionados con reset

**Búsqueda:** Funciones que calculen fechas para reset basadas en threshold

**Resultado:** ❌ NO SE ENCONTRARON

**⚠️ CONCLUSIÓN:** NO existe lógica que calcule `effective_since` basándose en `threshold_days`.

---

## FASE 2 — ANÁLISIS DEL RESET ACTUAL

### 2.1. ¿Cómo se calcula effective_since hoy?

**Archivo:** `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js`

**Función:** `upsertApplyReset()` (línea 340)

**Código:**
```javascript
const resetAt = options.reset_at || new Date();

await queryFn(`
  INSERT INTO cleaning_item_state (
    student_id, product_key, domain_type, item_ref,
    ${effectiveSinceColumn}
  ) VALUES (
    $1, $2, $3, $4, $5
  )
  ON CONFLICT (student_id, product_key, domain_type, item_ref)
  DO UPDATE SET
    ${effectiveSinceColumn} = $5,
    updated_at = CURRENT_TIMESTAMP
  RETURNING *
`, [
  studentUuid,
  productKey,
  domainType,
  options.item_ref,
  resetAt  // ← Usa reset_at directamente (NO ajusta con threshold)
]);
```

**⚠️ CONCLUSIÓN:** `effective_since = reset.created_at` (timestamp del evento RESET). **NO aplica offset basado en threshold_days.**

---

### 2.2. ¿Dónde se obtiene reset_at?

**Archivo:** `src/core/master/services/cleaning-engine-service.js`

**Función:** `resetStudentItemProgress()` (línea 2115-2191)

**Código:**
```javascript
// 1. Insertar evento RESET
const eventResult = await eventsRepo.insertEvent(eventData, client);

// 2. Obtener timestamp del evento (creado o existente)
let resetTimestamp;
if (eventResult === 'already_applied' || (eventResult && eventResult.already_executed === true)) {
  // Obtener evento existente para su fecha
  const existingEvents = await eventsRepo.listEventsForStudentItem({...}, client);
  const existingResetEvent = existingEvents.find(e => 
    e.execution_key === executionKey && 
    e.action_type === 'reset'
  );
  resetTimestamp = existingResetEvent?.created_at ? new Date(existingResetEvent.created_at) : new Date();
} else {
  // Evento insertado exitosamente
  resetTimestamp = eventResult.created_at ? new Date(eventResult.created_at) : new Date();
}

// 3. Aplicar reset
await stateRepo.upsertApplyReset({
  reset_at: resetTimestamp  // ← Usa timestamp del evento (NO ajusta)
}, client);
```

**⚠️ CONCLUSIÓN:** `reset_at` se obtiene de `event.created_at` (timestamp del evento RESET). **NO se ajusta con threshold_days.**

---

### 2.3. Respuesta explícita: ¿Tras reset, effective_since queda en qué?

**✅ RESPUESTA:** `effective_since = reset.created_at` (timestamp del evento RESET insertado en `cleaning_events`)

**NO se aplica:**
- ❌ NO se ajusta con `threshold_days - 1`
- ❌ NO se ajusta con `threshold_days`
- ❌ NO se usa ningún offset temporal
- ❌ NO depende de `item_config.threshold_days`
- ❌ NO depende de overrides de `threshold_days`

---

## FASE 3 — CPM: DECISIÓN DE ESTADO

### 3.1. Cálculo de days_since_effective

**Archivo:** `src/core/master/services/cleaning-projection-model.js`

**Función:** `computeRecurrenteLayerState()` (línea 225-306)

**Código relevante:**
```javascript
if (hasReset) {
  const effectiveSinceDate = new Date(effectiveSince);
  
  if (lastCleanedAt) {
    const lastCleanedDate = new Date(lastCleanedAt);
    if (lastCleanedDate >= effectiveSinceDate) {
      // Hay limpieza posterior o igual al reset
      lastEffectiveCleanAt = lastCleanedAt;
      const now = new Date();
      daysSince = Math.floor((now - lastCleanedDate) / (1000 * 60 * 60 * 24));
    } else {
      // Limpieza anterior al reset - IGNORAR
      lastEffectiveCleanAt = null;
      daysSince = 0;  // ← Estado inicial tras reset
    }
  } else {
    // No hay limpieza después del reset
    lastEffectiveCleanAt = null;
    daysSince = 0;  // ← Estado inicial tras reset
  }
}
```

**⚠️ CONCLUSIÓN:** Tras reset sin limpieza post-RESET, `days_since = 0`.

---

### 3.2. Comparación con threshold_days

**Código relevante:**
```javascript
// Línea 326-346
if (hasReset && lastEffectiveCleanAt === null) {
  // RESET_RECURRENTE_V1: Reset aplicado y sin limpieza posterior → 'reseteado' con days_since = 0
  state = 'reseteado';
  daysSince = 0;
} else if (lastEffectiveCleanAt === null) {
  // Sin reset y sin limpieza → 'never' (nunca trabajado)
  state = 'never';
} else if (daysSince !== null && daysSince < threshold_days) {
  // Limpieza reciente → 'reviewed'
  state = 'reviewed';
} else if (daysSince !== null && daysSince < criticalThreshold) {
  // Limpieza antigua pero no crítica → 'pending'
  state = 'pending';
} else if (daysSince !== null) {
  // Limpieza muy antigua → 'important'
  state = 'important';
}
```

**⚠️ CONCLUSIÓN:**
- Condición para `'pending'`: `threshold_days <= days_since < criticalThreshold`
- Tras reset sin limpieza: `days_since = 0` → Estado = `'reseteado'` (NO `'pending'`)
- Para que sea `'pending'`: `days_since >= threshold_days` (ej: `days_since >= 7` si `threshold_days = 7`)

---

### 3.3. Condición exacta para PENDING

**Condición canónica:**
```javascript
threshold_days <= days_since < criticalThreshold
```

**Valores:**
- `threshold_days = 7` (default, puede ser override)
- `criticalThreshold = threshold_days * critical_multiplier` (default: 7 * 2.0 = 14)

**Rango para PENDING:**
- Mínimo: `days_since >= 7` (threshold_days)
- Máximo: `days_since < 14` (criticalThreshold)

**Ejemplo:**
- `days_since = 0` → `'reseteado'` (NO pending)
- `days_since = 6` → `'reviewed'` (NO pending)
- `days_since = 7` → `'pending'` ✅
- `days_since = 13` → `'pending'` ✅
- `days_since = 14` → `'important'` (NO pending)

---

### 3.4. ¿Qué valor de days produce PENDING?

**✅ RESPUESTA:** `threshold_days <= days_since < criticalThreshold`

**Ejemplo con `threshold_days = 7` y `critical_multiplier = 2.0`:**
- `days_since >= 7` y `days_since < 14` → `'pending'`

---

## FASE 4 — ¿DUPLICACIONES O LEGACY?

### 4.1. Comentarios históricos (DISCREPANCIAS)

#### Archivo: `src/core/master/services/cleaning-engine-service.js`

**Línea 1885:**
```javascript
/**
 * - Reset nunca produce estado 'never' (si hubo reset, siempre es 'pending')
 */
```

**⚠️ DISCREPANCIA:** El comentario dice "siempre es pending", pero el código produce `'reseteado'` con `days_since = 0`.

---

#### Archivo: `src/core/master/services/cleaning-engine-service.js`

**Línea 2547:**
```javascript
/**
 * REGLA CONSTITUCIONAL:
 * - effective_since = NOW()
 * - last_cleaned_at = NULL
 * - clean_count = 0
 * - days_since resultante = recurrencia + 1 (PENDIENTE, no NUNCA)
 */
```

**⚠️ DISCREPANCIA:** El comentario dice "days_since resultante = recurrencia + 1 (PENDIENTE)", pero:
1. El código NO establece `clean_count = 0` (ya no se hace tras refactor RESET v1)
2. El código NO calcula `days_since = recurrencia + 1`
3. El código establece `days_since = 0` y estado `'reseteado'` (NO `'pending'`)

---

#### Archivo: `src/core/master/services/cleaning-projection-model.js`

**Línea 105:**
```javascript
/**
 * - pending (post-reset): effective_since !== null AND last_effective_clean === effective_since
 */
```

**⚠️ ACLARACIÓN:** Este comentario describe un caso teórico donde `last_effective_clean === effective_since` (limpieza exactamente en el momento del reset), pero el código actual NO produce este estado. En su lugar, produce `'reseteado'` cuando `lastEffectiveCleanAt === null`.

---

### 4.2. Código legacy comentado

**Búsqueda:** Código comentado relacionado con reset y threshold

**Resultado:** ❌ NO SE ENCONTRÓ código legacy comentado relacionado con ajuste de `effective_since` basado en `threshold_days`.

---

### 4.3. Lógica de "forzar amarillo"

**Búsqueda:** Funciones que fuercen estado `'pending'` o "amarillo"

**Resultado:** ❌ NO SE ENCONTRÓ lógica que fuerce estado `'pending'` después de reset.

---

### 4.4. Corrección post-reset

**Búsqueda:** Código que ajuste `effective_since` después de reset basado en threshold

**Resultado:** ❌ NO SE ENCONTRÓ lógica de corrección post-reset basada en threshold.

---

### 4.5. Lógica en UI que altere estado

**Búsqueda:** Código frontend que calcule o ajuste estado tras reset

**Resultado:** ❌ NO SE ENCONTRÓ lógica en UI que altere estado después de reset. UI consume estados calculados por CPM (backend).

---

## FASE 5 — CONCLUSIÓN DEL DIAGNÓSTICO

### 5.1. Estado actual REAL del sistema

**Flujo completo:**

1. **Reset se ejecuta:**
   - `resetStudentItemProgress()` inserta evento RESET con `created_at = NOW()`
   - `upsertApplyReset()` establece `effective_since = reset.created_at`
   - **NO se ajusta `effective_since` basado en `threshold_days`**

2. **CPM calcula estado:**
   - Si NO hay limpieza post-RESET: `days_since = 0`, estado = `'reseteado'`
   - Si hay limpieza post-RESET: `days_since = (now - last_cleaned_at)`, estado según comparación con `threshold_days`

3. **Decisión de estado:**
   - `days_since = 0` → `'reseteado'` (NO pending)
   - `0 < days_since < threshold_days` → `'reviewed'`
   - `threshold_days <= days_since < criticalThreshold` → `'pending'` ✅
   - `days_since >= criticalThreshold` → `'important'`

---

### 5.2. Tabla resumen

| Capa | ¿Usa threshold? | ¿Cómo? | ¿Correcto? |
|------|-----------------|--------|------------|
| **Reset (upsertApplyReset)** | ❌ NO | NO usa threshold para ajustar `effective_since` | ✅ Correcto según RESET_CONTRACT_V1 (SOLO modifica effective_since) |
| **CPM (computeRecurrenteLayerState)** | ✅ SÍ | Compara `days_since` con `threshold_days` para decidir estado | ✅ Correcto (función pura que calcula estado) |
| **Overrides (override-resolution-service)** | ✅ SÍ | Permite override de `threshold_days` | ✅ Correcto (overrides aplican a cálculo, no a reset) |
| **UI (frontend)** | ❌ NO | Solo consume estados calculados por CPM | ✅ Correcto (UI no calcula estados) |

---

### 5.3. Respuestas claras

#### ¿El reset deja hoy el ítem en PENDING?

**❌ NO.** El reset deja el ítem en estado `'reseteado'` con `days_since = 0`.

**Para que sea `'pending'`:**
- Debe pasar tiempo hasta que `days_since >= threshold_days`
- O debe haber una limpieza post-RESET que, con el tiempo, produzca `days_since >= threshold_days`

---

#### ¿Lo hace por diseño o por accidente?

**Por diseño.** El código actual implementa RESET_CONTRACT_V1:
- Reset SOLO modifica `effective_since`
- NO ajusta `effective_since` basado en `threshold_days`
- CPM calcula estado desde `effective_since` y `last_cleaned_at`
- Estado inicial tras reset = `'reseteado'` (nuevo ciclo abierto)

**Los comentarios históricos que dicen "siempre es pending" están DESACTUALIZADOS** y no reflejan el código real.

---

#### ¿Está alineado con RESET_CONTRACT_V1?

**✅ SÍ.** El código está alineado con RESET_CONTRACT_V1:
- Reset SOLO modifica `effective_since` ✅
- NO modifica contadores directamente ✅
- NO ajusta `effective_since` basado en threshold ✅
- CPM calcula estado desde `effective_since` ✅

**DISCREPANCIA:** Los comentarios en código (líneas 1885, 2547) están DESACTUALIZADOS y contradicen el código real.

---

### 5.4. Riesgos detectados

#### Riesgo #1: Comentarios desactualizados

**Ubicación:**
- `src/core/master/services/cleaning-engine-service.js:1885`
- `src/core/master/services/cleaning-engine-service.js:2547`

**Problema:**
- Comentarios dicen "reset siempre produce pending"
- Código real produce `'reseteado'`
- Puede confundir a desarrolladores

**Impacto:** ⚠️ Medio (puede causar confusión, pero no rompe funcionalidad)

---

#### Riesgo #2: Expectativa vs. Realidad

**Problema:**
- Históricamente se esperaba que reset dejara ítem en `'pending'`
- Código actual deja ítem en `'reseteado'`
- Puede haber UX que asuma estado `'pending'` inmediato

**Impacto:** ⚠️ Medio (depende de si UI asume estado `'pending'` tras reset)

---

### 5.5. Lugares que habría que tocar (SIN TOCAR AÚN)

#### 1. Comentarios desactualizados

**Archivo:** `src/core/master/services/cleaning-engine-service.js`

**Línea 1885:**
```javascript
// ACTUAL (INCORRECTO):
/**
 * - Reset nunca produce estado 'never' (si hubo reset, siempre es 'pending')
 */

// DEBERÍA SER:
/**
 * - Reset inicia nuevo ciclo (effective_since = reset.created_at)
 * - Estado inicial tras reset: 'reseteado' con days_since = 0
 * - NO produce 'never' (siempre hay ciclo abierto si hubo reset)
 */
```

**Línea 2547:**
```javascript
// ACTUAL (INCORRECTO):
/**
 * - days_since resultante = recurrencia + 1 (PENDIENTE, no NUNCA)
 */

// DEBERÍA SER:
/**
 * - effective_since = reset.created_at
 * - days_since resultante = 0 (RESETEADO, no PENDING)
 * - Para PENDING: debe pasar tiempo hasta days_since >= threshold_days
 */
```

---

#### 2. Verificar UI

**Archivo:** `public/js/master/master-alquimia-general-client.js`

**Verificar:**
- ¿UI asume estado `'pending'` inmediato tras reset?
- ¿UI maneja correctamente estado `'reseteado'`?
- ¿Hay lógica que espere días >= threshold tras reset?

**⚠️ NO TOCAR AÚN:** Solo verificar si hay problemas de UX.

---

#### 3. Documentación

**Archivo:** `docs/RESET_CONTRACT_V1.md`

**Verificar:**
- ¿Documenta correctamente que reset produce `'reseteado'`?
- ¿Documenta que NO se ajusta `effective_since` basado en threshold?
- ¿Documenta que para `'pending'` debe pasar tiempo?

**⚠️ NO TOCAR AÚN:** Solo verificar si documentación está alineada.

---

## RESUMEN FINAL

### Estado Actual REAL

1. **Reset establece:** `effective_since = reset.created_at` (timestamp del evento)
2. **CPM calcula:** `days_since = 0` si NO hay limpieza post-RESET
3. **Estado resultante:** `'reseteado'` (NO `'pending'`)
4. **Para PENDING:** Debe pasar tiempo hasta `days_since >= threshold_days`

### Discrepancias Detectadas

1. **Comentarios desactualizados** que dicen "reset siempre produce pending"
2. **Código real produce `'reseteado'`**, no `'pending'`

### Conclusión

**NO existe lógica que ajuste `effective_since` basada en `threshold_days` para posicionar ítems en PENDING tras reset.**

**Si históricamente existía esa lógica, fue eliminada o nunca existió en el código actual.**

**El código actual está alineado con RESET_CONTRACT_V1:**
- Reset SOLO modifica `effective_since`
- CPM calcula estado desde `effective_since` y `last_cleaned_at`
- Estado inicial tras reset = `'reseteado'` (nuevo ciclo abierto)

---

## REFERENCIAS

### Archivos Analizados

1. `src/core/master/services/cleaning-engine-service.js` (resetStudentItemProgress, resetByScope)
2. `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js` (upsertApplyReset)
3. `src/core/master/services/cleaning-projection-model.js` (computeRecurrenteLayerState)
4. `src/core/master/services/override-resolution-service.js` (resolveEffectiveItemConfigForStudent)
5. `docs/RESET_CONTRACT_V1.md` (contrato canónico)

### Búsquedas Realizadas

- `threshold_days` en todo el código
- `effective_since` con offsets temporales
- `reset` + `threshold`
- `pending` + `reset`
- Comentarios legacy sobre reset y pending

---

**FIN DEL DIAGNÓSTICO**
