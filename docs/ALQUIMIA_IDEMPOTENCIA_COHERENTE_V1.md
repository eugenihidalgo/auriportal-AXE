# ALQUIMIA IDEMPOTENCIA COHERENTE V1
## Idempotencia ≠ Estado Verdadero

**FECHA:** 2026-01-27  
**VERSIÓN:** v5.77.0  
**DOMINIO:** MASTER

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1️⃣ PRINCIPIO CONSTITUCIONAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**REGLA ABSOLUTA:**
> La existencia de un evento en `cleaning_events` NO garantiza que el estado en `cleaning_item_state` esté actualizado correctamente.

**PROBLEMA:**
- Idempotencia se verifica SOLO por `execution_key` (UNIQUE constraint)
- Si una transacción falla parcialmente (evento insertado pero estado NO actualizado), idempotencia bloquea reintentos
- El sistema retorna estado antiguo sin verificar coherencia

**SOLUCIÓN CANÓNICA:**
- Verificar coherencia evento ↔ estado antes de omitir por idempotencia
- Si estado es INCOHERENTE → aplicar acción igualmente (idempotencia override)
- Si estado es COHERENTE → omitir correctamente

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2️⃣ VERIFICACIÓN DE COHERENCIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 2.1 Limpieza (mark_clean)

**Helper canónico:**
```javascript
function isCleanStateCoherent({ currentState, event, itemKind, clean_layer, cleanedAt })
```

**Coherencia para RECURRENTE:**
- Si hay reset posterior al evento:
  - `last_cleaned_at >= effective_since` O
  - `last_cleaned_at === null` Y `clean_count === 0`
- Si NO hay reset posterior:
  - `last_cleaned_at >= event.created_at`

**Coherencia para UNA_VEZ:**
- `completed >= expectedCompleted` (donde `expectedCompleted = event.delta_completed`)

**Logs obligatorios:**
- `[CLEAN][IDEMPOTENCY_CHECK]` - Verificación iniciada
- `[CLEAN][IDEMPOTENCY_OVERRIDE]` - Estado incoherente, aplicando override
- `[CLEAN][IDEMPOTENCY_OK]` - Estado coherente, omitiendo correctamente

## 2.2 Reset

**Coherencia canónica:**
- `effective_since >= event.created_at`
- `last_cleaned_at === null`
- `clean_count === 0`

**Logs obligatorios:**
- `[RESET][IDEMPOTENCY_OVERRIDE]` - Estado incoherente, aplicando override
- `[RESET][IDEMPOTENCY_OK]` - Estado coherente, omitiendo correctamente

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3️⃣ COMPORTAMIENTO CANÓNICO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 3.1 Si Evento Existe Y Estado Es Coherente
**Comportamiento:** Omitir acción (idempotencia correcta)
**Log:** `[CLEAN][IDEMPOTENCY_OK]` o `[RESET][IDEMPOTENCY_OK]`

### 3.2 Si Evento Existe Y Estado Es Incoherente
**Comportamiento:** Aplicar acción igualmente (idempotencia override)
**Log:** `[CLEAN][IDEMPOTENCY_OVERRIDE]` o `[RESET][IDEMPOTENCY_OVERRIDE]`
**Razón:** El estado no refleja el evento, permitir corrección

### 3.3 Si Evento NO Existe
**Comportamiento:** Aplicar acción normalmente (primera vez)
**Log:** Normal (no idempotencia)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4️⃣ INVARIANTE ACCIÓN → PROYECCIÓN → COLUMNA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**REGLA CONSTITUCIONAL:**
> Toda acción que inserta evento Y modifica `cleaning_item_state` DEBE provocar:
> 1. Nuevo GET (refetch)
> 2. Nuevo `state_by_view_layer` (recalculado desde CPM)
> 3. Re-render de columnas (agrupación por estado)

**Assert defensivo en frontend:**
```javascript
if (!student.state_by_view_layer?.[activeViewLayer]) {
  console.error('[INVARIANT_BROKEN] Missing state_by_view_layer', student);
  // BLOQUEAR render
}
```

**Refresh garantizado:**
- Refresh Engine disponible → usar engine canónico
- Refresh Engine NO disponible → forzar refetch manual mínimo
- Independiente de `view_mode` (proyección u operativa)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5️⃣ FIXES IMPLEMENTADOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### FIX 1: Idempotencia Coherente en Limpieza
**Archivo:** `src/core/master/services/cleaning-engine-service.js`
**Función:** `markCleanStudent()`
**Helper:** `isCleanStateCoherent()`
**Estado:** ✅ Implementado

### FIX 2: Idempotencia de Reset Corregible
**Archivo:** `src/core/master/services/cleaning-engine-service.js`
**Función:** `resetStudentItemProgress()`
**Estado:** ✅ Ya existía, mejorado con logs

### FIX 3: Refresh Post-Acción Garantizado
**Archivo:** `public/js/master/ux/perform-action.v1.js`
**Función:** `performAction()`, `forceManualRefetch()`
**Estado:** ✅ Implementado

### FIX 4: Invariante Defensivo
**Archivo:** `public/js/master/master-alquimia-general-client.js`
**Función:** `renderStudentsByState()`
**Estado:** ✅ Implementado

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6️⃣ REFERENCIAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- **Diagnóstico:** `docs/DIAGNOSTICO_FORENSE_TOTAL_ALQUIMIA_GENERAL_V1.md`
- **Código Limpieza:** `src/core/master/services/cleaning-engine-service.js`
- **Código Refresh:** `public/js/master/ux/perform-action.v1.js`
- **Código UI:** `public/js/master/master-alquimia-general-client.js`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**FIN DEL DOCUMENTO**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
