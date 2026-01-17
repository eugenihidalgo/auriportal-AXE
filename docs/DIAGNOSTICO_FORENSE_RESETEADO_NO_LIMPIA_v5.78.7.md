# DIAGNÓSTICO FORENSE: Item en Estado `reseteado` NO se Puede Limpiar

**Versión**: v5.78.7  
**Fecha**: 2026-01-13  
**Estado**: DIAGNÓSTICO COMPLETO - Logs forenses añadidos

---

## SÍNTOMA

Un ítem en estado `reseteado` NO se puede limpiar.

**Observaciones**:
- La UI no muestra error
- El estado permanece `reseteado` después del click
- El botón LIMPIAR está visible y habilitado
- El click se ejecuta (confirmado)

---

## CONTEXTO CONFIRMADO

- Listas cargan correctamente
- Items existen
- Estado `reseteado` se renderiza correctamente
- SyntaxErrors ya resueltos
- El problema es **LÓGICO / DE FLUJO**

---

## LOGS FORENSES AÑADIDOS

Se han añadido logs forenses exhaustivos en **5 FASES** del flujo:

### FASE A — UI / EVENTO

**Archivo**: `public/js/master/master-alquimia-general-client.js`

**Logs añadidos**:
1. `[DIAG][UI][PRE_ACTION]` — Justo antes del click en botón LIMPIAR
   - `state_visible`: Estado visible en UI (string)
   - `item_ref`, `student_uuid`, `view_layer`, `item_kind`
   - `days_since_last_clean`
   - `timestamp`

2. `[DIAG][UI][PRE_PERFORM_ACTION]` — Justo antes de llamar a `performAction`
   - `action_id`: 'alquimia.clean'
   - `context`: Payload completo
   - `uiState`: Estado de UI

**Líneas modificadas**:
- ~3536-3562: Logs en click handler del botón LIMPIAR
- ~3875-3890: Logs antes de `performAction`

**Confirmar**:
- ✅ Si el click se ejecuta (`click_executed: true`)
- ✅ Si `performAction` es llamado (`performAction_called: true`)
- ✅ Qué `state_visible` se detecta antes de la acción

---

### FASE B — ACTION REGISTRY

**Archivo**: `public/js/master/ux/perform-action.v1.js`

**Logs añadidos**:
1. `[DIAG][ACTION][RESOLVED]` — Cuando se resuelve `actionDef` del registry
   - `action_id`: ID de acción
   - `action_found`: Si la acción existe
   - `action_def`: Metadata completa de la acción
   - `allowed_item_kinds`, `allowed_layers`, `allowed_scopes`

2. `[DIAG][ACTION][PAYLOAD_FINAL]` — Payload final antes del POST
   - `endpoint`: URL del endpoint
   - `payload_final`: Payload completo que se envía
   - `refresh_plan_generated`: Superficies a refrescar

3. `[DIAG][REFRESH][PLAN]` — Plan de refresh generado
   - `surfaces_to_refresh`: Array de superficies
   - `refresh_engine_available`: Si existe Refresh Engine
   - `context`, `uiState`: Contexto completo

**Líneas modificadas**:
- ~152-173: Log de resolución de acción
- ~238-257: Log de payload final y refresh plan
- ~402-427: Log de refresh plan después de acción

**Confirmar**:
- ✅ Qué `action_id` se resuelve
- ✅ Si `action_found: true`
- ✅ Qué `payload_final` se envía al backend
- ✅ Qué superficies se refrescan (`surfaces_to_refresh`)

---

### FASE C — BACKEND / CLEANING ENGINE

**Archivo**: `src/core/master/services/cleaning-engine-service.js`

**Logs añadidos**:
1. `[DIAG][ENGINE][ENTRY]` — Entrada a `markCleanStudent`
   - `trace_id`: ID de traza
   - `student_uuid`, `item_ref`, `item_kind`, `clean_layer`
   - `execution_mode`: 'APPLY' | 'CERTIFY'

2. `[DIAG][ENGINE][NEEDS_REBASE]` — Evaluación de rebase tras RESET
   - `needsRebase`: Si necesita rebase
   - `hasReset`: Si hay RESET previo
   - `resetAt`: Timestamp del último RESET
   - `currentEffective`, `currentLastCleaned`, `currentCount`
   - `needsRebase_reasons`: Desglose de razones

3. `[DIAG][ENGINE][WRITE_EVENT]` — Inserción de evento
   - `execution_key`: Clave de idempotencia
   - `event_inserted`: Si se insertó nuevo evento
   - `event_result`: Resultado de la inserción
   - `existing_state_before`: Estado antes de insertar

4. `[DIAG][ENGINE][EXIT_STATE]` — Estado final retornado
   - `exit_state`: Estado completo después de escribir
   - `effective_since`, `last_cleaned_at`, `clean_count`
   - `remaining`, `completed` (para una_vez)

**Líneas modificadas**:
- ~391-410: Log de entrada (ENTRY)
- ~851-871: Log de evaluación de rebase (NEEDS_REBASE)
- ~666-688: Log de inserción de evento (WRITE_EVENT)
- ~1120-1146: Log de estado final (EXIT_STATE)

**Confirmar**:
- ✅ Si `markCleanStudent` entra
- ✅ Si `needsRebase: true` o `false`
- ✅ Si `event_inserted: true` o `false`
- ✅ Qué `last_cleaned_at` tiene `exit_state`
- ✅ Qué `effective_since` tiene `exit_state`

---

### FASE D — CPM / PROYECCIÓN

**Archivo**: `src/core/master/services/cleaning-projection-model.js`

**Logs añadidos**:
1. `[DIAG][CPM][INPUT]` — Input a `computeRecurrenteLayerState`
   - `effective_since`: Timestamp del último RESET
   - `last_cleaned_at`: Timestamp de última limpieza
   - `hasReset`: Si hay RESET aplicado
   - `comparison`: Comparación entre `last_cleaned_at` y `effective_since`

2. `[DIAG][CPM][OUTPUT]` — Estado calculado por CPM
   - `state_final`: Estado final calculado ('reseteado' | 'reviewed' | 'pending' | 'important' | 'never')
   - `days_since`: Días desde última limpieza
   - `state_calculation_logic`: Desglose de condiciones evaluadas

**Líneas modificadas**:
- ~154-195: Log de input (INPUT)
- ~308-345: Log de output (OUTPUT)

**Confirmar**:
- ✅ Qué `effective_since` recibe CPM
- ✅ Qué `last_cleaned_at` recibe CPM
- ✅ Si `hasReset: true`
- ✅ Qué `state_final` calcula CPM
- ✅ Por qué sigue siendo `reseteado` en lugar de `reviewed`

---

### FASE E — REFRESH + RENDER

**Archivo**: `public/js/master/ux/perform-action.v1.js`

**Logs añadidos**:
- `[DIAG][REFRESH][PLAN]` — Plan de refresh después de acción exitosa
  - Ver FASE B para detalles

**Archivos relacionados** (pendientes de instrumentar si es necesario):
- `public/js/master/master-alquimia-general-client.js`: `loadListProjection()`, `renderProjectionView()`

**Confirmar**:
- ✅ Qué superficies se refrescan
- ✅ Qué `state_by_view_layer` usa la UI para agrupar
- ✅ Si hay desincronización entre backend y frontend

---

## CÓMO USAR LOS LOGS FORENSES

### 1. Reproducir el Bug

1. Navegar a Alquimia General
2. Seleccionar un ítem en estado `reseteado`
3. Click en botón LIMPIAR
4. **Abrir DevTools Console** antes del click

### 2. Buscar en Console

**Buscar por fase** (orden cronológico):

```javascript
// FASE A - UI
console.log('[DIAG][UI][PRE_ACTION]')  // Click ejecutado
console.log('[DIAG][UI][PRE_PERFORM_ACTION]')  // performAction llamado

// FASE B - Action Registry
console.log('[DIAG][ACTION][RESOLVED]')  // Action resuelta
console.log('[DIAG][ACTION][PAYLOAD_FINAL]')  // Payload final
console.log('[DIAG][REFRESH][PLAN]')  // Refresh plan generado

// FASE C - Backend (en Network tab o logs del servidor)
console.log('[DIAG][ENGINE][ENTRY]')  // markCleanStudent entra
console.log('[DIAG][ENGINE][NEEDS_REBASE]')  // Evaluación de rebase
console.log('[DIAG][ENGINE][WRITE_EVENT]')  // Evento insertado
console.log('[DIAG][ENGINE][EXIT_STATE]')  // Estado final

// FASE D - CPM (en Network tab o logs del servidor)
console.log('[DIAG][CPM][INPUT]')  // Input a CPM
console.log('[DIAG][CPM][OUTPUT]')  // Estado calculado

// FASE E - Refresh (si aplica)
console.log('[DIAG][REFRESH][PLAN]')  // Plan de refresh ejecutado
```

### 3. Análisis del Flujo

**Checklist de diagnóstico**:

#### FASE A — ¿Se ejecuta el click?
- [ ] `[DIAG][UI][PRE_ACTION]` aparece
- [ ] `click_executed: true`
- [ ] `state_visible: 'reseteado'`

#### FASE B — ¿Se llama performAction?
- [ ] `[DIAG][UI][PRE_PERFORM_ACTION]` aparece
- [ ] `performAction_called: true`
- [ ] `[DIAG][ACTION][RESOLVED]` muestra `action_found: true`
- [ ] `[DIAG][ACTION][PAYLOAD_FINAL]` muestra payload correcto

#### FASE C — ¿El backend procesa?
- [ ] `[DIAG][ENGINE][ENTRY]` aparece en logs del servidor
- [ ] `[DIAG][ENGINE][NEEDS_REBASE]` muestra `needsRebase: true/false`
- [ ] `[DIAG][ENGINE][WRITE_EVENT]` muestra `event_inserted: true`
- [ ] `[DIAG][ENGINE][EXIT_STATE]` muestra `last_cleaned_at` actualizado

#### FASE D — ¿CPM calcula correctamente?
- [ ] `[DIAG][CPM][INPUT]` muestra `effective_since` y `last_cleaned_at`
- [ ] `[DIAG][CPM][OUTPUT]` muestra `state_final` calculado
- [ ] Si `last_cleaned_at >= effective_since`, debería ser `'reviewed'`, no `'reseteado'`

#### FASE E — ¿Se refresca la UI?
- [ ] `[DIAG][REFRESH][PLAN]` muestra superficies a refrescar
- [ ] Después del refresh, `state_by_view_layer` debería tener `state: 'reviewed'`

---

## PUNTOS CRÍTICOS A VERIFICAR

### 1. Rebase Post-RESET

**Pregunta**: ¿Se ejecuta `rebaseStateFromReset` cuando hay RESET previo?

**Log clave**: `[DIAG][ENGINE][NEEDS_REBASE]`
- Si `needsRebase: false` pero `hasReset: true` → **BUG POTENCIAL**
- Si `needsRebase: true` pero `exit_state.last_cleaned_at` es `null` → **BUG POTENCIAL**

### 2. Timestamp de Evento vs effective_since

**Pregunta**: ¿`last_cleaned_at` del evento es `>= effective_since`?

**Log clave**: `[DIAG][ENGINE][EXIT_STATE]`
- `exit_state.last_cleaned_at` debe ser `>= exit_state.effective_since`
- Si `last_cleaned_at < effective_since` → **BUG CONFIRMADO**

**Log clave**: `[DIAG][CPM][INPUT]`
- Si `last_cleaned_at >= effective_since` pero CPM calcula `state: 'reseteado'` → **BUG EN CPM**

### 3. CPM State Calculation

**Pregunta**: ¿Por qué CPM calcula `'reseteado'` en lugar de `'reviewed'`?

**Log clave**: `[DIAG][CPM][OUTPUT]`
- Verificar `state_calculation_logic`:
  - Si `condition_1: true` (hasReset && lastEffectiveCleanAt === null) → `state: 'reseteado'`
  - Si `condition_3: true` (daysSince < threshold_days) → `state: 'reviewed'`
- Si `lastEffectiveCleanAt` es `null` pero debería tener valor → **BUG EN REBASE**

### 4. Refresh y Render

**Pregunta**: ¿La UI recibe el estado actualizado?

**Log clave**: `[DIAG][REFRESH][PLAN]`
- Verificar que `surfaces_to_refresh` incluye la superficie correcta
- Después del refresh, verificar `state_by_view_layer[view_layer].state`

---

## HIPÓTESIS DE BUG POTENCIALES

### HIPÓTESIS 1: Rebase no se ejecuta

**Escenario**:
- `hasReset: true`
- `needsRebase: false` (incorrecto)
- `exit_state.last_cleaned_at` es `null` (no se actualiza)

**Fix potencial**:
- Asegurar que `needsRebase` incluya `hasReset ||` siempre

### HIPÓTESIS 2: Timestamp del evento incorrecto

**Escenario**:
- `event_inserted: true`
- Pero `exit_state.last_cleaned_at` es anterior a `effective_since`
- CPM calcula `'reseteado'` porque `last_cleaned_at < effective_since`

**Fix potencial**:
- Asegurar que `cleaned_at` usado en `upsertApplyRecurrent` sea `>= effective_since`

### HIPÓTESIS 3: CPM no considera limpieza post-RESET

**Escenario**:
- `last_cleaned_at >= effective_since` (correcto)
- Pero CPM calcula `state: 'reseteado'` porque `lastEffectiveCleanAt === null`

**Fix potencial**:
- Asegurar que `rebaseStateFromReset` pase `currentCleanEvent` correctamente

### HIPÓTESIS 4: Refresh no actualiza UI

**Escenario**:
- Backend calcula `state: 'reviewed'` correctamente
- Pero UI sigue mostrando `'reseteado'` porque no refresca

**Fix potencial**:
- Verificar que `refresh_plan` incluye superficie correcta
- Verificar que `loadListProjection` se ejecuta después de acción

---

## PRÓXIMOS PASOS

1. **Reproducir bug** con logs habilitados
2. **Recopilar logs** de todas las fases
3. **Identificar punto exacto** donde se rompe el flujo usando checklist
4. **Confirmar hipótesis** basada en evidencia de logs
5. **Implementar fix** solo después de confirmar causa raíz

---

## NOTAS

- **NO implementar fixes todavía** — Solo diagnóstico con logs forenses
- Los logs están diseñados para ser **no intrusivos** (no afectan lógica)
- Todos los logs incluyen `timestamp` para ordenar cronológicamente
- Los logs incluyen `phase` para identificar rápidamente la fase
- Los logs incluyen `trace_id` para correlacionar requests

---

**ENTREGABLE FINAL**: Este documento + logs forenses añadidos en código
