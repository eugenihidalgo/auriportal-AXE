# DIAGNÓSTICO CLEAN AFTER RESET — Verificación de Comportamiento
## Análisis de cómo se limpia un ítem en estado 'reseteado'

**Fecha:** 2026-01-13  
**Objetivo:** Diagnosticar y verificar el comportamiento actual al limpiar un ítem en estado 'reseteado', confirmando que cumple CLEAN_AFTER_RESET_CONTRACT_V1

---

## RESUMEN EJECUTIVO

### Conclusión Principal

**✅ SÍ se puede limpiar un ítem reseteado. El comportamiento es correcto y cumple CLEAN_AFTER_RESET_CONTRACT_V1.**

**Estado actual REAL:**
- CLEAN sobre ítem reseteado se permite sin restricciones
- NO hay guards que bloqueen CLEAN en estado 'reseteado'
- Si hay RESET previo, se ejecuta `rebaseStateFromReset` automáticamente
- El evento CLEAN actual se incluye en el rebase
- Los contadores se recalculan desde eventos post-RESET (incluyendo el CLEAN actual)
- Estado resultante = `'reviewed'` si `days_since < threshold_days`

**Flujo completo:**
1. CLEAN se ejecuta normalmente (sin verificar estado previo)
2. Se inserta evento CLEAN en `cleaning_events`
3. Se detecta RESET previo (línea 942-944)
4. Se ejecuta `rebaseStateFromReset` (línea 1116)
5. `rebaseStateFromReset` recalcula contadores desde eventos post-RESET (incluyendo CLEAN actual)
6. Se actualiza `last_cleaned_at` con el evento CLEAN
7. CPM calcula estado: `'reviewed'` si `days_since < threshold_days`

---

## FASE 1 — LOCALIZACIÓN DE FLUJO DE CLEAN

### 1.1. Función principal: markCleanStudent

**Archivo:** `src/core/master/services/cleaning-engine-service.js`

**Función:** `markCleanStudent()` (línea 507)

**Qué hace:**
- Inserta evento CLEAN en `cleaning_events`
- Verifica si hay RESET previo
- Si hay RESET previo, ejecuta `rebaseStateFromReset`
- Aplica limpieza usando `upsertApplyRecurrent` (recurrente) o `upsertApplyOneTimeIncrement*` (una_vez)
- Emite señal `clean.executed`

**Código relevante:**
```javascript
// Línea 935-1149
// 7. REGLA CONSTITUCIONAL: RESET ES FRONTERA DURA DE ESTADO
// ANTES de aplicar limpieza, verificar si hay RESET previo y reconstruir estado si es necesario
const lastReset = itemKind === 'recurrente' 
  ? await getLastResetForItem(student_uuid, item_ref, clean_layer, product_key, domain_type, client)
  : null;

if (lastReset && itemKind === 'recurrente') {
  // Verificar si el estado actual es coherente con el RESET
  // ...
  const needsRebase = hasReset || // SIEMPRE rebase si hay reset previo
                       !currentEffective || 
                       currentEffective < resetAt ||
                       (currentLastCleaned && currentLastCleaned < resetAt) ||
                       (currentCount > 0 && !currentLastCleaned) ||
                       (currentCount === 0 && currentLastCleaned);
  
  if (needsRebase) {
    // Reconstruir estado desde RESET (incluyendo el evento de limpieza actual si existe)
    const rebasedState = await rebaseStateFromReset(student_uuid, item_ref, clean_layer, lastReset, product_key, domain_type, traceId, client, currentCleanEvent);
    // ...
  }
}
```

**⚠️ CONCLUSIÓN:** CLEAN NO verifica estado previo antes de ejecutarse. Se ejecuta normalmente y luego se detecta RESET previo para hacer rebase.

---

### 1.2. Validaciones previas a CLEAN

**Búsqueda:** Guards o validaciones que bloqueen CLEAN en estado 'reseteado'

**Resultado:** ❌ NO SE ENCONTRARON

**Validaciones encontradas:**
- UUID-only (línea 556-567)
- Campos requeridos (línea 570-579)
- `clean_layer` válido (línea 583-586)
- `item_kind` válido (línea 588-593)
- Estudiante NO pausado (línea 596-607)

**⚠️ CONCLUSIÓN:** NO hay guard que bloquee CLEAN en estado 'reseteado'. CLEAN se ejecuta sin restricciones por estado previo.

---

### 1.3. Detección de RESET previo

**Archivo:** `src/core/master/services/cleaning-engine-service.js`

**Función:** `getLastResetForItem()` (línea 148)

**Qué hace:**
- Obtiene el último evento RESET para el item+student+layer
- Retorna null si no hay RESET previo

**Código relevante:**
```javascript
// Línea 942-944
const lastReset = itemKind === 'recurrente' 
  ? await getLastResetForItem(student_uuid, item_ref, clean_layer, product_key, domain_type, client)
  : null;
```

**⚠️ CONCLUSIÓN:** Se detecta RESET previo ANTES de aplicar limpieza, pero NO se usa para bloquear CLEAN, solo para hacer rebase.

---

### 1.4. Rebase desde RESET

**Archivo:** `src/core/master/services/cleaning-engine-service.js`

**Función:** `rebaseStateFromReset()` (línea 191)

**Qué hace:**
- Obtiene todos los eventos posteriores al RESET
- Incluye el evento CLEAN actual si se está ejecutando un CLEAN post-RESET
- Recalcula contadores desde eventos post-RESET
- Actualiza `effective_since`, `last_cleaned_at` y `clean_count`

**Código relevante:**
```javascript
// Línea 253-271
if (currentCleanEvent) {
  // Solo incluir si es posterior o igual al reset (>= para incluir eventos en el mismo momento)
  if (cleanEventDate >= resetAt) {
    allEvents.push(currentCleanEvent);
    wasCurrentCleanEventIncluded = true;
  }
}

const cleansAfterReset = allEvents
  .filter(e => 
    e.action_type === 'mark_clean' && 
    e.clean_layer === cleanLayer &&
    new Date(e.created_at) >= resetAt
  )
  .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

const lastCleanedAt = cleansAfterReset.length > 0 
  ? new Date(cleansAfterReset[cleansAfterReset.length - 1].created_at)
  : null;
const cleanCount = cleansAfterReset.length;
```

**⚠️ CONCLUSIÓN:** El evento CLEAN actual se incluye en el rebase si es posterior o igual al RESET. Los contadores se recalculan desde eventos post-RESET (incluyendo el CLEAN actual).

---

## FASE 2 — INTERACCIÓN RESET → CLEAN

### 2.1. Caso: Ítem reseteado sin limpieza post-RESET

**Estado inicial:**
- `effective_since = reset_at` (timestamp del evento RESET)
- `last_cleaned_at = NULL`
- `clean_count = 0` (o valor previo si no se recalculó)
- Estado CPM = `'reseteado'` con `days_since = 0`

**Ejecutar CLEAN:**

1. **Se inserta evento CLEAN** (línea 756-824)
   - Evento con `action_type='mark_clean'`
   - `created_at = NOW()` (timestamp del evento)
   - `execution_key` generado

2. **Se detecta RESET previo** (línea 942-944)
   - `lastReset !== null`

3. **Se ejecuta rebase** (línea 1116)
   - `rebaseStateFromReset()` se llama con `currentCleanEvent` (línea 1048-1094)
   - Evento CLEAN actual se incluye en eventos post-RESET (línea 253-271)
   - `lastCleanedAt = created_at` del evento CLEAN (línea 309-311)
   - `cleanCount = 1` (línea 312)

4. **Se actualiza estado** (línea 336-354)
   - `effective_since = reset_at` (mantiene)
   - `last_cleaned_at = created_at` del evento CLEAN
   - `clean_count = 1`

5. **Se aplica limpieza** (línea 1218-1225)
   - `upsertApplyRecurrent()` actualiza `last_cleaned_at` y `clean_count`

**⚠️ CONCLUSIÓN:** Limpiar un ítem reseteado:
- ✅ Se permite (NO hay bloqueo)
- ✅ Genera evento CLEAN
- ✅ Actualiza `last_cleaned_at` (timestamp del evento CLEAN)
- ✅ Incrementa `clean_count` (calculado desde eventos post-RESET)
- ✅ NO ignora ningún campo

---

### 2.2. Respuesta explícita: ¿Limpiar un ítem reseteado produce qué?

**✅ RESPUESTA:** 

```
Limpiar un ítem reseteado produce:
- effective_since = reset_at (mantiene, NO cambia)
- last_cleaned_at = created_at del evento CLEAN (nuevo timestamp)
- clean_count = 1 (calculado desde eventos post-RESET)
- Estado CPM = 'reviewed' (si days_since < threshold_days)
```

**Ejemplo concreto:**
- RESET ejecutado: `2024-01-15T10:00:00Z`
- CLEAN ejecutado: `2024-01-15T10:05:00Z`
- Resultado:
  - `effective_since = 2024-01-15T10:00:00Z` (mantiene)
  - `last_cleaned_at = 2024-01-15T10:05:00Z` (nuevo)
  - `clean_count = 1`
  - `days_since = 0` (mismo día)
  - Estado = `'reviewed'` (si `threshold_days > 0`)

---

## FASE 3 — CPM Y ESTADO RESULTANTE

### 3.1. Cálculo de estado tras CLEAN post-RESET

**Archivo:** `src/core/master/services/cleaning-projection-model.js`

**Función:** `computeRecurrenteLayerState()` (línea 160)

**Código relevante:**
```javascript
// Línea 230-299
if (hasReset) {
  const effectiveSinceDate = new Date(effectiveSince);
  
  if (lastCleanedAt) {
    const lastCleanedDate = new Date(lastCleanedAt);
    if (lastCleanedDate >= effectiveSinceDate) {
      // Hay limpieza posterior o igual al reset - usar esa fecha
      lastEffectiveCleanAt = lastCleanedAt;
      const now = new Date();
      daysSince = Math.floor((now - lastCleanedDate) / (1000 * 60 * 60 * 24));
    }
  }
}

// Línea 331-346
if (hasReset && lastEffectiveCleanAt === null) {
  state = 'reseteado';
  daysSince = 0;
} else if (lastEffectiveCleanAt === null) {
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

Tras CLEAN post-RESET:
- `lastEffectiveCleanAt = last_cleaned_at` (timestamp del evento CLEAN)
- `daysSince = 0` (si CLEAN es el mismo día que RESET)
- Estado = `'reviewed'` (si `daysSince < threshold_days`)
- Estado = `'pending'` (si `threshold_days <= daysSince < criticalThreshold`)

---

### 3.2. Edge case: CLEAN exactamente en el momento del RESET

**Código relevante:**
```javascript
// Línea 234-239
if (lastCleanedDate >= effectiveSinceDate) {
  // Hay limpieza posterior o igual al reset - usar esa fecha
  lastEffectiveCleanAt = lastCleanedAt;
  const now = new Date();
  daysSince = Math.floor((now - lastCleanedDate) / (1000 * 60 * 60 * 24));
}
```

**⚠️ CONCLUSIÓN:** Si CLEAN ocurre exactamente en el mismo momento que RESET (`lastCleanedDate === effectiveSinceDate`), se trata como "después" (>=), por lo que:
- `lastEffectiveCleanAt = last_cleaned_at`
- `daysSince = 0` (mismo día)
- Estado = `'reviewed'` (si `threshold_days > 0`)

---

### 3.3. Edge case: CLEAN antes del RESET (ignorado)

**Código relevante:**
```javascript
// Línea 263-278
} else {
  // La limpieza es anterior al reset - IGNORAR (reset inicia nuevo ciclo)
  // RESET_RECURRENTE_V1: Estado inicial del ciclo = 'reseteado' con days_since = 0
  lastEffectiveCleanAt = null;
  daysSince = 0;
}
```

**⚠️ CONCLUSIÓN:** Si hay una limpieza anterior al RESET, se IGNORA. El RESET inicia un nuevo ciclo. Solo se consideran limpiezas posteriores o iguales al RESET.

---

## FASE 4 — OVERRIDES

### 4.1. Aplicación de overrides en CPM

**Archivo:** `src/core/master/services/override-resolution-service.js`

**Función:** `resolveItemConfigForStudent()` (línea 102)

**Qué hace:**
- Obtiene overrides del estudiante para el item
- Aplica overrides a `item_config` (threshold_days, required_count, nivel, descripcion)
- Retorna `effectiveConfig` con overrides aplicados

**Código relevante:**
```javascript
// Línea 139-150
} else if (override_key === 'threshold_days') {
  // Para items recurrentes
  const value = typeof override_value === 'number' ? override_value : Number(override_value);
  effectiveConfig.threshold_days = value;
  
  logInfo('OverrideResolution', 'Override threshold_days aplicado', {
    student_uuid,
    item_ref,
    base_threshold_days: itemConfig.threshold_days,
    override_threshold_days: value,
    override_id: overrideRecord.id
  });
}
```

**⚠️ CONCLUSIÓN:** Overrides se aplican ANTES de CPM, afectando `threshold_days` usado en el cálculo de estado. Overrides NO afectan a `effective_since` o `last_cleaned_at`.

---

### 4.2. Impacto de overrides en primera limpieza post-reset

**Escenario:**
- Ítem reseteado: `effective_since = 2024-01-15T10:00:00Z`, `last_cleaned_at = NULL`
- Override: `threshold_days = 14` (base: 7)
- CLEAN ejecutado: `2024-01-15T10:05:00Z`

**Cálculo:**
- `lastEffectiveCleanAt = 2024-01-15T10:05:00Z`
- `daysSince = 0` (mismo día)
- `threshold_days = 14` (override aplicado)
- Estado = `'reviewed'` (porque `0 < 14`)

**⚠️ CONCLUSIÓN:** Overrides afectan el cálculo de estado en la primera limpieza post-reset. Si `threshold_days` tiene override, se usa el valor override para decidir si es `'reviewed'` o `'pending'`.

---

### 4.3. ¿Hay override que invalide la limpieza?

**Búsqueda:** Overrides que bloqueen o invaliden CLEAN

**Resultado:** ❌ NO SE ENCONTRARON

**⚠️ CONCLUSIÓN:** NO hay override que invalide la limpieza. Overrides solo afectan a configuración (`threshold_days`, `required_count`), NO a la capacidad de limpiar.

---

### 4.4. ¿Hay override que mantenga estado 'reseteado'?

**Búsqueda:** Overrides que fuercen estado 'reseteado'

**Resultado:** ❌ NO SE ENCONTRARON

**⚠️ CONCLUSIÓN:** NO hay override que mantenga estado 'reseteado'. El estado se calcula desde `effective_since` y `last_cleaned_at`, no desde overrides.

---

## FASE 5 — CASOS MASIVOS / ALL

### 5.1. CLEAN ALL sobre ítems reseteados

**Archivo:** `src/core/master/services/cleaning-engine-service.js`

**Función:** `markCleanAllStudents()` (línea 1415)

**Qué hace:**
- Itera sobre todos los estudiantes activos (NO pausados)
- Para cada estudiante, llama `markCleanStudent()`
- Si un estudiante falla, continúa con el siguiente (fail-open)
- NO valida estado previo antes de limpiar

**Código relevante:**
```javascript
// Línea 1564-1594
for (const { uuid: studentUuid } of activeStudentUuids) {
  try {
    // ...
    const result = await markCleanStudent({
      student_uuid: studentUuid,
      item_ref,
      item_kind: itemKind,
      clean_layer,
      // ...
    }, client);
    
    if (result) {
      updated++;
    } else {
      skipped++;
      skippedBreakdown.no_change++;
    }
  } catch (error) {
    logWarn('MASTER', 'Error en markCleanStudent individual (continuando)', {
      traceId,
      student_uuid: studentUuid,
      item_ref,
      error: error.message
    });
    skipped++;
    skippedBreakdown.error++;
  }
}
```

**⚠️ CONCLUSIÓN:** CLEAN ALL NO valida estado previo. Limpia todos los estudiantes activos, independientemente de si están en estado 'reseteado', 'pending', 'reviewed', etc. Si un estudiante falla, continúa con el siguiente (fail-open).

---

### 5.2. Fail-open en CLEAN ALL

**Código relevante:**
```javascript
// Línea 1585-1594
} catch (error) {
  logWarn('MASTER', 'Error en markCleanStudent individual (continuando)', {
    traceId,
    student_uuid: studentUuid,
    item_ref,
    error: error.message
  });
  skipped++;
  skippedBreakdown.error++;
  // Continúa con siguiente estudiante
}
```

**⚠️ CONCLUSIÓN:** CLEAN ALL es fail-open. Si un estudiante falla (por cualquier razón), se registra el error, se incrementa `skipped`, y se continúa con el siguiente estudiante. NO hay rollback global ni cancelación del proceso.

---

## FASE 6 — CONCLUSIÓN

### 6.1. ¿Se puede limpiar un ítem reseteado?

**✅ SÍ.** Se puede limpiar un ítem reseteado sin restricciones.

**Evidencia:**
- NO hay guard que bloquee CLEAN en estado 'reseteado'
- CLEAN se ejecuta normalmente
- RESET previo se detecta y se hace rebase automático
- El evento CLEAN actual se incluye en el rebase

---

### 6.2. ¿El comportamiento es correcto?

**✅ SÍ.** El comportamiento es correcto y cumple CLEAN_AFTER_RESET_CONTRACT_V1.

**Flujo canónico:**
1. CLEAN se ejecuta normalmente (sin verificar estado previo)
2. Se inserta evento CLEAN en `cleaning_events`
3. Se detecta RESET previo
4. Se ejecuta `rebaseStateFromReset` (reconstruye estado desde RESET)
5. El evento CLEAN actual se incluye en eventos post-RESET
6. Se actualiza `last_cleaned_at` con el evento CLEAN
7. Se incrementa `clean_count` (calculado desde eventos post-RESET)
8. CPM calcula estado: `'reviewed'` si `days_since < threshold_days`

**Comportamiento esperado según CLEAN_AFTER_RESET_CONTRACT_V1:**
- ✅ CLEAN sobre ítem reseteado se permite
- ✅ RESET previo se detecta automáticamente
- ✅ Estado se reconstruye desde RESET
- ✅ Evento CLEAN actual se incluye en el rebase
- ✅ Contadores se recalculan correctamente

---

### 6.3. ¿Hay bloqueos, guards o edge cases?

**Bloqueos:** ❌ NO hay bloqueos que impidan limpiar ítem reseteado.

**Guards:** ✅ Guards existentes son correctos:
- UUID-only (línea 556-567)
- Campos requeridos (línea 570-579)
- `clean_layer` válido (línea 583-586)
- Estudiante NO pausado (línea 596-607)

**Edge cases:** ✅ Edge cases manejados correctamente:
- CLEAN exactamente en momento del RESET: se trata como "después" (>=)
- CLEAN antes del RESET: se ignora (reset inicia nuevo ciclo)
- CLEAN después del RESET: se incluye en rebase

---

### 6.4. ¿Es compatible con overrides?

**✅ SÍ.** Overrides son compatibles con CLEAN post-RESET.

**Comportamiento:**
- Overrides se aplican ANTES de CPM
- Overrides afectan `threshold_days` usado para calcular estado
- Overrides NO afectan `effective_since` o `last_cleaned_at`
- Overrides NO bloquean ni invalidan la limpieza
- Overrides NO mantienen estado 'reseteado'

**Ejemplo:**
- Base: `threshold_days = 7`
- Override: `threshold_days = 14`
- CLEAN post-RESET con `days_since = 0`
- Estado = `'reviewed'` (porque `0 < 14`, usa override)

---

### 6.5. ¿Cumple CLEAN_AFTER_RESET_CONTRACT_V1?

**✅ SÍ.** El comportamiento cumple CLEAN_AFTER_RESET_CONTRACT_V1.

**Contrato esperado:**
- CLEAN sobre ítem reseteado se permite ✅
- RESET previo se detecta automáticamente ✅
- Estado se reconstruye desde RESET ✅
- Evento CLEAN actual se incluye en el rebase ✅
- Contadores se recalculan correctamente ✅
- Estado resultante = `'reviewed'` si `days_since < threshold_days` ✅

---

## RESUMEN DE HALLAZGOS

### ✅ Comportamientos Correctos

1. **CLEAN sobre ítem reseteado se permite:**
   - NO hay guard que bloquee CLEAN en estado 'reseteado'
   - CLEAN se ejecuta normalmente

2. **RESET previo se detecta automáticamente:**
   - `getLastResetForItem()` obtiene último RESET
   - Se verifica ANTES de aplicar limpieza

3. **Rebase automático:**
   - Si hay RESET previo, se ejecuta `rebaseStateFromReset`
   - El evento CLEAN actual se incluye en el rebase
   - Los contadores se recalculan desde eventos post-RESET

4. **Estado resultante correcto:**
   - `last_cleaned_at` se actualiza con timestamp del evento CLEAN
   - `clean_count` se calcula desde eventos post-RESET
   - Estado CPM = `'reviewed'` si `days_since < threshold_days`

5. **Compatible con overrides:**
   - Overrides se aplican ANTES de CPM
   - Overrides afectan `threshold_days` usado en cálculo de estado
   - Overrides NO bloquean ni invalidan la limpieza

6. **CLEAN ALL funciona correctamente:**
   - Limpia todos los estudiantes activos (NO pausados)
   - Fail-open por estudiante (continúa aunque falle uno)
   - NO valida estado previo antes de limpiar

---

### ⚠️ Observaciones

1. **No hay validación explícita de estado previo:**
   - CLEAN NO verifica si el ítem está en estado 'reseteado' antes de ejecutarse
   - Se detecta RESET previo automáticamente, pero NO se usa para bloquear CLEAN
   - **Impacto:** Ninguno (el comportamiento es correcto)

2. **Rebase siempre se ejecuta si hay RESET:**
   - Línea 980: `needsRebase = hasReset || ...`
   - Si hay RESET previo, SIEMPRE se ejecuta rebase
   - **Impacto:** Ninguno (el comportamiento es correcto)

---

## TABLA RESUMEN

| Pregunta | Respuesta | Evidencia |
|----------|-----------|-----------|
| ¿Se puede limpiar un ítem reseteado? | ✅ SÍ | NO hay guard que bloquee CLEAN |
| ¿El comportamiento es correcto? | ✅ SÍ | Cumple CLEAN_AFTER_RESET_CONTRACT_V1 |
| ¿Hay bloqueos por estado? | ❌ NO | CLEAN se ejecuta sin verificar estado previo |
| ¿Hay guards que bloqueen? | ❌ NO | Guards existentes son correctos (UUID, campos, pausa) |
| ¿Es compatible con overrides? | ✅ SÍ | Overrides se aplican ANTES de CPM |
| ¿Cumple CLEAN_AFTER_RESET_CONTRACT_V1? | ✅ SÍ | Flujo canónico correcto |

---

## REFERENCIAS

### Archivos Analizados

1. `src/core/master/services/cleaning-engine-service.js` (markCleanStudent, rebaseStateFromReset)
2. `src/core/master/services/cleaning-projection-model.js` (computeRecurrenteLayerState)
3. `src/core/master/services/override-resolution-service.js` (resolveItemConfigForStudent)
4. `docs/contracts/RESET_CONTRACT_V1.md` (contrato canónico)
5. `docs/contracts/OVERRIDES_CONTRACT_V1.md` (contrato canónico de overrides)

### Funciones Clave

1. **markCleanStudent()** (línea 507): Función principal que procesa CLEAN
2. **rebaseStateFromReset()** (línea 191): Reconstruye estado desde RESET
3. **getLastResetForItem()** (línea 148): Obtiene último RESET previo
4. **computeRecurrenteLayerState()** (línea 160): Calcula estado en CPM
5. **resolveItemConfigForStudent()** (línea 102): Aplica overrides

---

---

## REFERENCIA A CONTRATO CANÓNICO

Este diagnóstico verifica el cumplimiento del comportamiento esperado. Para el contrato canónico completo de Overrides, consultar:

**Referencia canónica:**
- `docs/contracts/OVERRIDES_CONTRACT_V1.md` - Contrato canónico del sistema de overrides

**Contrato relacionado:**
- `docs/contracts/RESET_CONTRACT_V1.md` - Contrato canónico del sistema de reset

---

**FIN DEL DIAGNÓSTICO**
