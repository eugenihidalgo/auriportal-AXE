# DIAGNÓSTICO FASE 0 — RESET SYSTEM
## Análisis del Sistema Real Antes de Implementar Contrato Canónico

**Fecha:** 2026-01-13  
**Objetivo:** Localizar TODAS las llamadas a reset y verificar problemas antes de implementar contrato canónico

---

## 1) LUGARES DONDE SE EJECUTA RESET

### Llamada #1: POST /master/api/alquimia-general/reset

**Archivo:** `src/endpoints/master-api-alquimia-general.js:2062`

**Contexto:** POST request (escritura)

**Llamada:**
```javascript
const result = await cleaningEngineResetItem({
  student_uuid,
  item_ref,
  item_kind,
  clean_layer: effectiveCleanLayer,
  view_layer: view_layer || null,
  ...
});
```

**Validaciones:**
- ✅ Valida `scope === 'student'` (línea 2078)
- ✅ Valida `item_kind` (línea 2083)
- ✅ Valida formato UUID (línea 2088)
- ✅ Valida coherencia `view_layer` + `clean_layer` (línea 2094-2102)

**⚠️ OBSERVACIÓN:** Endpoint solo disponible en `scope='student'`, no en GET.

---

### Llamada #2: POST /master/api/alquimia-general/reset-item-all

**Archivo:** `src/endpoints/master-api-alquimia-general.js:2342`

**Contexto:** POST request (escritura)

**Llamada:**
```javascript
const result = await cleaningEngineResetAll({
  item_ref,
  item_kind,
  clean_layer: 'pde', // Forzado según contrato
  ...
});
```

**Validaciones:**
- ✅ Valida `scope === 'all'` (línea 2354)
- ✅ Valida `item_kind === 'recurrente'` (línea 2364)
- ✅ Forcea `clean_layer = 'pde'` (línea 2374)

**⚠️ OBSERVACIÓN:** Endpoint solo disponible en `scope='all'`, no en GET.

---

### Llamada #3: resetStudentItemProgress (Cleaning Engine)

**Archivo:** `src/core/master/services/cleaning-engine-service.js:1871`

**Función principal:** `resetStudentItemProgress(options, client)`

**Validaciones:**
- ✅ Guard UUID-only (línea 1903-1913)
- ✅ Valida campos requeridos (línea 1916-1924)
- ✅ Valida `item_kind` (línea 1926-1929)
- ✅ **Guard UNA_VEZ PROHIBIDO** (línea 1931-1942) ✅
- ✅ Valida formato UUID (línea 1945-1948)
- ✅ Excluye estudiantes pausados (línea 1952-1960)

**Qué hace:**
1. Inserta evento RESET en `cleaning_events` (línea 2055-2082)
2. Llama a `upsertApplyReset()` para actualizar `cleaning_item_state` (línea 2148)

---

### Llamada #4: resetAllStudentsItemProgress (Cleaning Engine)

**Archivo:** `src/core/master/services/cleaning-engine-service.js:2260`

**Función principal:** `resetAllStudentsItemProgress(options, client)`

**Validaciones:**
- ✅ **Guard UNA_VEZ PROHIBIDO** (línea 2303-2305) ✅
- ✅ Valida `clean_layer` (línea 2318-2324)
- ✅ Itera sobre estudiantes activos (línea 2366)
- ✅ Excluye estudiantes pausados (línea 2388)

**Qué hace:**
1. Obtiene TODOS los estudiantes activos (sin paginación)
2. Para cada estudiante, llama `resetStudentItemProgress()` (línea 2389)
3. Continúa aunque falle (fail-open, línea 2423)

---

### Llamada #5: resetByScope (Cleaning Engine)

**Archivo:** `src/core/master/services/cleaning-engine-service.js:2498`

**Función principal:** `resetByScope(options, client)`

**Scopes soportados:**
- `ITEM_STUDENT` → `resetStudentItemProgress()`
- `ITEM_ALL` → `resetAllStudentsItemProgress()`
- `LIST_STUDENT` → iterar items + `resetStudentItemProgress()`
- `LIST_ALL` → iterar items + `resetAllStudentsItemProgress()`

**⚠️ OBSERVACIÓN:** Función wrapper que delega a funciones específicas.

---

### Servicios Legacy (DEPRECATED):

1. **`alquimia-reset-service.js`** (línea 36):
   - Función `resetStudentItemProgress()`
   - Función `resetStudentListProgress()`
   - **DEPRECATED:** Usar Cleaning Engine directamente

2. **`alquimia-general-service.js`** (línea 1632):
   - Función `resetStudentItemProgress()`
   - Función `resetStudentListProgress()`
   - **DEPRECATED:** Usar Cleaning Engine directamente

---

## 2) VERIFICACIONES

### ¿Se permite reset en UNA_VEZ?

**✅ NO se permite reset en UNA_VEZ**

**Evidencia:**
- `resetStudentItemProgress()` tiene guard explícito (línea 1931-1942):
  ```javascript
  if (item_kind === 'una_vez') {
    const error = new Error('Reset está PROHIBIDO para item_kind="una_vez"...');
    error.code = 'RESET_UNA_VEZ_FORBIDDEN';
    throw error;
  }
  ```

- `resetAllStudentsItemProgress()` también tiene guard (línea 2303-2305):
  ```javascript
  if (item_kind === 'una_vez') {
    const error = new Error('Reset está PROHIBIDO para item_kind="una_vez"...');
    throw error;
  }
  ```

**✅ CUMPLE:** Reset está PROHIBIDO en UNA_VEZ con error explícito.

---

### ¿Se modifica algo más que effective_since?

**⚠️ SÍ se modifica más que effective_since**

**Evidencia en `upsertApplyReset()`:**
```sql
UPDATE cleaning_item_state
SET 
  shared_effective_since = CASE WHEN $5 = 'shared' THEN $6 ELSE shared_effective_since END,
  pde_effective_since = CASE WHEN $5 = 'pde' THEN $6 ELSE pde_effective_since END,
  shared_last_cleaned_at = CASE WHEN $5 = 'shared' THEN NULL ELSE shared_last_cleaned_at END,
  shared_clean_count = CASE WHEN $5 = 'shared' THEN 0 ELSE shared_clean_count END,
  pde_last_cleaned_at = CASE WHEN $5 = 'pde' THEN NULL ELSE pde_last_cleaned_at END,
  pde_clean_count = CASE WHEN $5 = 'pde' THEN 0 ELSE pde_clean_count END,
  updated_at = CURRENT_TIMESTAMP
```

**Modificaciones:**
1. ✅ `effective_since` (correcto)
2. ❌ `last_cleaned_at = NULL` (resetear contador)
3. ❌ `clean_count = 0` (resetear contador)

**⚠️ PROBLEMA:** Reset NO solo modifica `effective_since`, también resetea contadores.

**Según contrato canónico:** Reset SOLO debe modificar `effective_since`. Los contadores deben calcularse desde eventos post-RESET.

---

### ¿Hay resets implícitos o automáticos?

**✅ NO hay resets implícitos o automáticos**

**Evidencia:**
- Todos los endpoints de reset son POST (no GET)
- No hay resets automáticos en `markCleanStudent()` (solo rebase de estado)
- No hay resets como "corrección" automática

**✅ CUMPLE:** No hay resets implícitos o automáticos.

---

### ¿Hay resets en GET?

**✅ NO hay resets en GET**

**Evidencia:**
- Todos los endpoints de reset son POST (línea 2070, 2342)
- No hay handlers GET que ejecuten reset

**✅ CUMPLE:** Reset solo disponible en POST.

---

## 3) PROBLEMAS DETECTADOS

### Problema #1: Reset modifica contadores directamente

**Código real (`upsertApplyReset()`):**
```sql
shared_last_cleaned_at = CASE WHEN $5 = 'shared' THEN NULL ELSE shared_last_cleaned_at END,
shared_clean_count = CASE WHEN $5 = 'shared' THEN 0 ELSE shared_clean_count END
```

**⚠️ PROBLEMA:**
- Reset establece `last_cleaned_at = NULL` y `clean_count = 0` directamente
- Según contrato canónico, estos valores deben calcularse desde eventos post-RESET
- Actualmente, `rebaseStateFromReset()` recalcula estos valores, pero `upsertApplyReset()` los resetea primero

**Contrato canónico esperado:**
- Reset SOLO debe establecer `effective_since`
- Los contadores deben calcularse desde eventos post-RESET en `rebaseStateFromReset()`

---

### Problema #2: No hay señal real emitida

**Código real (línea 2187-2192):**
```javascript
// Señal emission skipped (canonical v1 - AUDIT log only)
logWarn('AUDIT', 'Signal emission skipped (canonical v1)', {
  action: 'reset_item_recurrente',
  ...
});
```

**⚠️ PROBLEMA:**
- Reset NO emite señal `reset.executed` real
- Solo log AUDIT
- Similar al problema de `clean.executed`

---

### Problema #3: Reset ALL no es transaccional

**Código real (línea 2423):**
```javascript
logWarn('MASTER', 'Error reseteando estudiante en reset ALL (continuando)', {...});
// Continuar con siguiente estudiante (fail-open)
```

**⚠️ PROBLEMA:**
- Reset ALL itera sobre estudiantes y continúa aunque falle
- NO es transaccional (puede quedar parcial)
- **✅ COMPORTAMIENTO DESEADO:** Reset ALL debe ser best-effort, no transaccional (según contrato)

---

### Problema #4: Reset modifica contadores antes de rebase

**Flujo actual:**
1. `resetStudentItemProgress()` inserta evento RESET
2. `upsertApplyReset()` establece `effective_since` y resetea contadores a 0/NULL
3. `rebaseStateFromReset()` recalcula contadores desde eventos post-RESET

**⚠️ PROBLEMA:**
- Reset establece contadores a 0/NULL antes de recalcular
- Debería SOLO establecer `effective_since` y dejar que `rebaseStateFromReset()` calcule contadores

**Contrato canónico esperado:**
- Reset SOLO establece `effective_since`
- Los contadores se calculan en `rebaseStateFromReset()` (ya lo hace, pero después del reset)

---

## 4) COMPORTAMIENTOS CORRECTOS DETECTADOS

### ✅ Guard UNA_VEZ funciona correctamente

- `resetStudentItemProgress()` rechaza `item_kind='una_vez'` con error explícito
- `resetAllStudentsItemProgress()` también rechaza `item_kind='una_vez'`

### ✅ Reset solo disponible en POST

- Todos los endpoints son POST
- No hay resets en GET

### ✅ Reset NO es automático

- No hay resets implícitos
- Reset es explícito por acción del usuario

### ✅ Reset inserta evento (append-only)

- `resetStudentItemProgress()` inserta evento RESET en `cleaning_events`
- Evento tiene `action_type='reset'`
- Evento es append-only (no se borra)

---

## 5) RESUMEN DE PROBLEMAS

### Problemas Críticos:

1. **Reset modifica contadores directamente:**
   - ❌ `upsertApplyReset()` establece `last_cleaned_at = NULL` y `clean_count = 0`
   - ✅ Debería SOLO establecer `effective_since`
   - ✅ Los contadores deben calcularse en `rebaseStateFromReset()`

2. **No hay señal real emitida:**
   - ❌ Reset NO emite señal `reset.executed` real
   - ✅ Solo log AUDIT

### Problemas Menores:

3. **Reset modifica contadores antes de rebase:**
   - ⚠️ Orden incorrecto: reset → contadores a 0 → rebase recalcula
   - ✅ Debería: reset → solo effective_since → rebase calcula contadores

---

## 6) REQUISITOS PARA CONTRATO CANÓNICO

Basado en el diagnóstico, el contrato canónico debe:

1. ✅ **Prohibir reset en UNA_VEZ** (ya está implementado)
2. ✅ **Reset SOLO modifica effective_since** (modificar `upsertApplyReset()`)
3. ✅ **Reset inserta evento RESET** (ya está implementado)
4. ✅ **Reset solo disponible en POST** (ya está implementado)
5. ✅ **Guard duro en GET** (añadir guard explícito)
6. ✅ **Emitir señal reset.executed** (implementar señal)
7. ✅ **Reset ALL no transaccional** (ya está implementado como best-effort)

---

**FIN DEL DIAGNÓSTICO FASE 0**
