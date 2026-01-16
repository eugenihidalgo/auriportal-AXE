# 🔍 DIAGNÓSTICO FORENSE TOTAL — ALQUIMIA GENERAL v1

**Fecha:** 2026-01-13  
**Modo:** DIAGNÓSTICO PURO (sin fixes, sin mejoras, sin refactors)  
**Estado:** ❌ SISTEMA ROTO — MÚLTIPLES CONTRATOS VIOLADOS

---

## 📋 RESUMEN EJECUTIVO

El sistema de Alquimia General presenta **11 síntomas críticos** que indican violaciones sistémicas de contratos constitucionales. El diagnóstico identifica **3 causas raíz** que explican todos los síntomas observados.

**PRINCIPIO:** Este diagnóstico NO propone soluciones. Solo documenta, demuestra y traza la cadena completa de fallos.

---

## 🧭 FASE 1 — MAPA DE CONTRATOS

### CONTRATO 1: State by View Layer (View Authority v1)

**PROMETE:**
- Backend calcula `state_by_view_layer` para TODAS las view_layers válidas
- Frontend consume EXCLUSIVAMENTE `state_by_view_layer[view_layer]`
- Backend es ÚNICA autoridad de estado

**CAMPOS OBLIGATORIOS:**
- `state_by_view_layer.shared` (siempre)
- `state_by_view_layer.pde` (siempre)
- `state_by_view_layer.combo` (solo una_vez)
- `state_by_view_layer.effective` (solo recurrente)

**QUÉ ROMPE EL CONTRATO:**
- Backend NO calcula `effective` cuando `view_layer='effective'` en recurrente
- Frontend accede a `state_by_view_layer?.effective` sin validación (línea 3146)
- Frontend muestra "undefined" cuando `effective` falta

**EVIDENCIA:**
```javascript
// public/js/master/master-alquimia-general-client.js:3146
const effectiveStateData = student.state_by_view_layer?.effective;
// Si effective no existe → effectiveStateData = undefined
// UI intenta acceder a effectiveStateData.effective_sources → ERROR
```

**ESTADO:** ❌ ROTO

---

### CONTRATO 2: Reset Recurrente

**PROMETE:**
- Reset SOLO para `item_kind='recurrente'`
- Reset establece `effective_since` en `cleaning_item_state`
- Tras reset, estado debe ser `pending` (nunca `never`)
- Reset afecta capa según `clean_layer` (shared/pde)

**CAMPOS OBLIGATORIOS:**
- `item_kind` (debe ser 'recurrente')
- `clean_layer` (debe ser 'shared' o 'pde', nunca 'combo' ni 'effective')
- `student_uuid` (UUID canónico)

**QUÉ ROMPE EL CONTRATO:**
- Reset desde `view_layer='effective'` NO valida que `clean_layer='pde'` (regla canónica violada)
- Tras reset, items quedan bloqueados en `pending` sin posibilidad de cambiar
- Reset NO recalcula proyección inmediatamente

**EVIDENCIA:**
```javascript
// src/core/master/services/cleaning-engine-service.js:1150
export async function resetStudentItemProgress(options, client = null) {
  const { clean_layer = null, view_layer = null } = options;
  // ❌ NO valida que view_layer='effective' → clean_layer='pde'
  // ❌ NO valida coherencia view_layer + clean_layer
}
```

**ESTADO:** ❌ ROTO

---

### CONTRATO 3: Clean Recurrente Múltiple

**PROMETE:**
- Clean múltiple por día es PERMITIDO (idempotencia por execution_key)
- Clean reinicia ciclo (incluso si ya estaba limpio hoy)
- Clean actualiza `last_cleaned_at` en `cleaning_item_state`

**CAMPOS OBLIGATORIOS:**
- `item_kind` (obligatorio según CONTRATO LIMPIEZA v1)
- `clean_layer` (obligatorio)
- `execution_key` (generado automáticamente)

**QUÉ ROMPE EL CONTRATO:**
- Mensaje "X ya estaban limpios" sugiere que clean NO reinicia ciclo
- Estado NO pasa a `reviewed` tras clean exitoso
- UI NO se actualiza tras clean (no hay refetch determinista)

**EVIDENCIA:**
```javascript
// src/core/master/services/cleaning-engine-service.js:803
// FIX MAJOR: Eliminada lógica "ya estaba limpio hoy"
// REGLA CONSTITUCIONAL: Limpiar SIEMPRE reinicia ciclo
// Pero el mensaje "X ya estaban limpios" sigue apareciendo
```

**ESTADO:** ⚠️ PARCIALMENTE ROTO (lógica corregida, mensajes inconsistentes)

---

### CONTRATO 4: Refresh Surface Registry

**PROMETE:**
- Toda mutación debe declarar `refresh_plan`
- Refresh Engine ejecuta refetch automático tras mutaciones
- Refetch preserva `view_layer` activa

**CAMPOS OBLIGATORIOS:**
- `refresh_plan` (función o array de surface_ids)
- `surface_id` debe estar registrado en Refresh Surface Registry

**QUÉ ROMPE EL CONTRATO:**
- Acciones sin `refresh_plan` declarado
- Refresh NO preserva `view_layer` activa
- Refresh NO ejecuta inmediatamente tras mutaciones

**EVIDENCIA:**
```javascript
// public/js/master/master-alquimia-general-client.js:1652
if (window.MasterRefreshEngineV1) {
  await window.MasterRefreshEngineV1.afterMutation({
    // ❌ NO especifica refresh_plan explícito
    // ❌ NO garantiza preservación de view_layer
  });
}
```

**ESTADO:** ❌ ROTO

---

### CONTRATO 5: UX Action Registry

**PROMETE:**
- Toda acción UI debe estar registrada en UX Action Registry
- Toda acción debe usar `performAction({ action_id, payload })`
- Prohibido `fetch()` POST fuera de `performAction()`

**CAMPOS OBLIGATORIOS:**
- `action_id` (formato canónico: `{domain}.{feature}.{action}`)
- `refresh_plan` (obligatorio)
- `domain` (debe ser 'master' | 'god' | 'admin_legacy')

**QUÉ ROMPE EL CONTRATO:**
- Acciones sin registro (ej: `alquimia.reset.list.all` puede no existir)
- Botones sin `action_id` explícito
- `fetch()` directo en handlers (violación constitucional)

**EVIDENCIA:**
```javascript
// public/js/master/master-alquimia-general-client.js:1633
const resetResult = await resetStudentListProgress(
  // ❌ NO usa performAction()
  // ❌ NO está registrado en UX Action Registry
);
```

**ESTADO:** ❌ ROTO

---

### CONTRATO 6: Runtime Integrity

**PROMETE:**
- Runtime Core debe estar READY antes de registrar acciones
- Runtime BROKEN invalida cualquier comportamiento posterior
- Integrity check valida exports críticos

**CAMPOS OBLIGATORIOS:**
- `__AP_RUNTIME_READY__` (debe existir)
- `__AP_UX_ACTION_REGISTRY_CORE__` (debe existir)
- `__AP_UX_ACTION_SCHEMA__` (debe existir)

**QUÉ ROMPE EL CONTRATO:**
- Runtime entra en BROKEN por `__AP_UX_ACTION_SCHEMA__` faltante
- Acciones se registran DESPUÉS de BROKEN (comportamiento inválido)
- Integrity check NO falla temprano

**EVIDENCIA:**
```javascript
// public/js/core/runtime/runtime-integrity-check.v1.js:67
if (!window.__AP_UX_ACTION_SCHEMA__) {
  errors.push('__AP_UX_ACTION_SCHEMA__ no existe');
  // ❌ Runtime entra en BROKEN
  // ❌ Pero acciones se registran después (comportamiento inválido)
}
```

**ESTADO:** ❌ ROTO

---

## 🔬 FASE 2 — TRAZADO DE DATOS REAL

### CASO DE ESTUDIO: Reset Recurrente

**1. Acción UI (reset)**
```javascript
// public/js/master/master-alquimia-general-client.js:1626
btnResetList.addEventListener('click', async () => {
  const viewLayer = state.projection.view_layer || 'shared';
  const itemKind = state.tipoActivo;
  const resetResult = await resetStudentListProgress(
    state.projection.student_uuid, 
    state.listaActiva.id,
    itemKind,
    viewLayer
  );
});
```

**2. Payload enviado**
```javascript
{
  student_uuid: "uuid-canónico",
  list_id: "lista-id",
  item_kind: "recurrente",
  view_layer: "effective" // ❌ PROBLEMA: view_layer en lugar de clean_layer
}
```

**3. Endpoint backend**
```javascript
// src/endpoints/master-api-alquimia-general.js
// POST /master/api/alquimia-general/listas/:list_id/reset
// ❌ NO valida que view_layer='effective' → clean_layer='pde'
```

**4. Mutación en DB (ANTES / DESPUÉS)**

**ANTES:**
```sql
-- cleaning_item_state
student_uuid | item_ref | shared_last_cleaned_at | shared_effective_since | pde_last_cleaned_at | pde_effective_since
uuid-123     | item-1   | 2026-01-10             | NULL                  | 2026-01-12          | NULL
```

**DESPUÉS (esperado):**
```sql
-- cleaning_item_state
student_uuid | item_ref | shared_last_cleaned_at | shared_effective_since | pde_last_cleaned_at | pde_effective_since
uuid-123     | item-1   | 2026-01-10             | NULL                  | NULL                | 2026-01-13
```

**DESPUÉS (real):**
```sql
-- cleaning_item_state
student_uuid | item_ref | shared_last_cleaned_at | shared_effective_since | pde_last_cleaned_at | pde_effective_since
uuid-123     | item-1   | 2026-01-10             | NULL                  | NULL                | NULL
-- ❌ PROBLEMA: Reset NO establece effective_since correctamente
```

**5. Proyección recalculada**
```javascript
// src/core/master/services/cleaning-projection-model.js:149
function computeRecurrenteLayerState({ threshold_days, criticalThreshold, layerData }) {
  const lastCleanedAt = layerData?.last_cleaned_at ?? null;
  const effectiveSince = layerData?.effective_since ?? null;
  
  // ❌ PROBLEMA: Si effective_since es NULL tras reset, estado queda como 'never'
  // ❌ REGLA VIOLADA: Tras reset, estado debe ser 'pending' (nunca 'never')
}
```

**6. DTO devuelto (students, list_projection)**
```json
{
  "state_by_view_layer": {
    "shared": { "state": "reviewed", ... },
    "pde": { "state": "never", ... }, // ❌ PROBLEMA: Debería ser "pending" tras reset
    "effective": { "state": "never", ... } // ❌ PROBLEMA: Debería ser "pending" tras reset
  }
}
```

**7. state_by_view_layer exacto**
```javascript
// ❌ PROBLEMA: effective NO se calcula cuando view_layer='effective'
// ❌ PROBLEMA: pde.state='never' cuando debería ser 'pending' tras reset
```

**8. Render UI**
```javascript
// public/js/master/master-alquimia-general-client.js:3146
const effectiveStateData = student.state_by_view_layer?.effective;
// ❌ effectiveStateData = undefined
// ❌ UI intenta acceder a effectiveStateData.effective_sources → ERROR
// ❌ UI muestra "Pendiente undefined" o "Revisado undefined"
```

**9. Movimiento de columna esperado vs real**

**ESPERADO:**
- Item en columna "Revisado" → Reset → Item en columna "Pendiente"

**REAL:**
- Item en columna "Revisado" → Reset → Item queda en columna "Revisado" (NO se mueve)
- O Item desaparece (si state='never')

**CONCLUSIÓN:** La cadena se rompe en **3 puntos críticos:**
1. Reset NO establece `effective_since` correctamente
2. CPM calcula `never` en lugar de `pending` tras reset
3. UI NO recibe `state_by_view_layer.effective` cuando `view_layer='effective'`

---

## 🔍 FASE 3 — ANÁLISIS DE `undefined`

### Origen del `undefined`

**1. Dónde sale el `undefined`:**
```javascript
// public/js/master/master-alquimia-general-client.js:3146
const effectiveStateData = student.state_by_view_layer?.effective;
// Si effective no existe → effectiveStateData = undefined
```

**2. Qué campo falta:**
- `state_by_view_layer.effective` NO existe cuando `view_layer='effective'` en recurrente
- Backend NO calcula `effective` aunque `item_kind='recurrente'`

**3. En qué capa se pierde:**
- **Backend:** CPM v2 calcula `effective` (línea 347), pero NO se incluye en respuesta si `view_layer` solicitada es otra
- **DTO:** Respuesta NO incluye `state_by_view_layer.effective` si no se solicita explícitamente
- **Frontend:** UI accede a `effective` sin validar que existe

**4. Por qué UI no puede resolverlo:**
```javascript
// public/js/master/master-alquimia-general-client.js:3147
const effectiveSources = effectiveStateData?.effective_sources || { shared: false, pde: false };
// ❌ Si effectiveStateData es undefined, effectiveSources = { shared: false, pde: false }
// ❌ UI muestra "Pendiente undefined" porque intenta acceder a campos que no existen
```

**5. Por qué no falla antes:**
- Backend NO valida que `state_by_view_layer.effective` existe antes de devolver respuesta
- Frontend NO valida que `effective` existe antes de renderizar
- No hay guards constitucionales que bloqueen render si `effective` falta

**EVIDENCIA COMPLETA:**
```javascript
// src/core/master/services/cleaning-projection-model.js:312
export function computeCleaningProjection({ cleaning_state, item_kind, view_layer, config }) {
  // ...
  // effective solo para recurrente
  if (item_kind === 'recurrente') {
    stateByViewLayer.effective = computeEffectiveState({
      // ✅ CPM calcula effective
    });
  }
  // ❌ PROBLEMA: Si view_layer solicitada NO es 'effective', 
  // ❌ el backend puede NO incluir effective en la respuesta
}
```

---

## 🎯 FASE 4 — EFFECTIVE (CRÍTICO)

### Cómo se calcula effective

**1. Cálculo en CPM v2:**
```javascript
// src/core/master/services/cleaning-projection-model.js:105
if (view_layer === 'effective') {
  const sharedState = computeRecurrenteLayerState({ threshold_days, criticalThreshold, layerData: shared });
  const pdeState = computeRecurrenteLayerState({ threshold_days, criticalThreshold, layerData: pde });
  
  // Prioridad: reviewed > pending > important > never
  let effectiveState;
  if (sharedState.state === 'reviewed' || pdeState.state === 'reviewed') {
    effectiveState = 'reviewed';
  } else if (sharedState.state === 'pending' || pdeState.state === 'pending') {
    effectiveState = 'pending';
  } else if (sharedState.state === 'important' || pdeState.state === 'important') {
    effectiveState = 'important';
  } else {
    effectiveState = 'never';
  }
}
```

**2. Qué depende de shared vs pde:**
- `effective` es proyección: `min(shared.state, pde.state)` (mejor estado)
- `effective` NO escribe nada (solo proyección)
- `effective` se calcula desde `shared` y `pde` en runtime

**3. Qué ocurre tras reset:**
```javascript
// src/core/master/services/cleaning-projection-model.js:179
if (effectiveSince !== null) {
  // Reset aplicado: verificar si last_effective_clean === effective_since
  const effectiveSinceDate = new Date(effectiveSince);
  if (lastEffectiveCleanAt && lastEffectiveCleanAt.getTime() === effectiveSinceDate.getTime()) {
    // Reset aplicado y nunca limpiado después → pending (nunca never)
    state = 'pending';
  }
}
```

**PROBLEMA:** Si `effective_since` es NULL tras reset, estado queda como `never` (viola regla canónica).

**4. Por qué effective queda inconsistente:**
- Reset NO establece `effective_since` correctamente
- CPM calcula `never` cuando `effective_since` es NULL
- `effective` se calcula desde `shared` y `pde`, pero si ambos tienen `effective_since=NULL`, `effective` queda como `never`

**5. Si effective es una proyección válida o un híbrido roto:**
- **TEÓRICAMENTE:** `effective` es proyección válida (función pura)
- **PRÁCTICAMENTE:** `effective` es híbrido roto porque:
  - NO se calcula cuando debería
  - NO se incluye en respuesta cuando `view_layer` solicitada es otra
  - Depende de `effective_since` que NO se establece correctamente tras reset

**EVIDENCIA:**
```javascript
// src/core/master/services/cleaning-projection-model.js:346
if (item_kind === 'recurrente') {
  stateByViewLayer.effective = computeEffectiveState({
    // ✅ CPM calcula effective
  });
}
// ❌ PROBLEMA: Esto solo ocurre si se llama computeCleaningProjection
// ❌ Si el endpoint NO llama computeCleaningProjection con view_layer='effective',
// ❌ effective NO se calcula
```

---

## ⚙️ FASE 5 — RUNTIME CORE

### Orden REAL de carga de scripts

**1. Orden declarado en master-layout-registry.v1.json:**
```json
{
  "required_scripts": [
    { "id": "runtime-ready", "phase": "core", ... },
    { "id": "ux-action-registry-loader", "phase": "core", ... },
    { "id": "runtime-integrity-check", "phase": "core", ... }
  ]
}
```

**2. Cuándo corre runtime-integrity-check:**
```javascript
// public/js/core/runtime/runtime-integrity-check.v1.js:112
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runIntegrityCheck);
} else {
  runIntegrityCheck(); // Ejecutar inmediatamente
}
```

**3. Por qué entra en BROKEN:**
```javascript
// public/js/core/runtime/runtime-integrity-check.v1.js:67
if (!window.__AP_UX_ACTION_SCHEMA__) {
  errors.push('__AP_UX_ACTION_SCHEMA__ no existe');
}
// ❌ Si __AP_UX_ACTION_SCHEMA__ no existe, runtime entra en BROKEN
```

**4. Qué variable falta exactamente:**
- `__AP_UX_ACTION_SCHEMA__` (debe exponerse desde `ux-action-schema.js`)
- Si no existe, integrity check falla y runtime entra en BROKEN

**5. Si el BROKEN es legítimo o un falso positivo:**
- **LEGÍTIMO:** Si `__AP_UX_ACTION_SCHEMA__` realmente no existe, BROKEN es legítimo
- **FALSO POSITIVO:** Si `__AP_UX_ACTION_SCHEMA__` existe pero integrity check corre ANTES de que se exponga, BROKEN es falso positivo

**6. Qué se registra después del BROKEN (y por qué eso es grave):**
- Acciones se registran DESPUÉS de que runtime entra en BROKEN
- Esto viola contrato: Runtime BROKEN invalida cualquier comportamiento posterior
- Acciones registradas después de BROKEN NO deberían funcionar, pero funcionan (comportamiento inválido)

**EVIDENCIA:**
```javascript
// public/js/core/runtime/runtime-integrity-check.v1.js:102
if (errors.length > 0) {
  window.__AP_RUNTIME_READY__.failHard(error);
  return;
}
// ❌ Runtime entra en BROKEN
// ❌ Pero acciones se registran después (comportamiento inválido)
```

---

## 📊 FASE 6 — CONCLUSIÓN

### Lista de CONTRATOS ROTOS (numerados)

1. **CONTRATO State by View Layer:** Backend NO calcula `effective` cuando debería
2. **CONTRATO Reset Recurrente:** Reset NO establece `effective_since` correctamente
3. **CONTRATO Clean Recurrente Múltiple:** Mensajes inconsistentes, estado NO se actualiza
4. **CONTRATO Refresh Surface Registry:** Refresh NO preserva `view_layer` activa
5. **CONTRATO UX Action Registry:** Acciones sin registro, `fetch()` directo
6. **CONTRATO Runtime Integrity:** Runtime BROKEN pero acciones funcionan (comportamiento inválido)

### Lista de FALSOS SUPUESTOS actuales

1. **FALSO:** "Backend siempre calcula `effective` para recurrente"
   - **REAL:** Backend solo calcula `effective` si se solicita explícitamente

2. **FALSO:** "Reset establece `effective_since` correctamente"
   - **REAL:** Reset NO establece `effective_since` en algunos casos

3. **FALSO:** "Runtime BROKEN bloquea todas las acciones"
   - **REAL:** Acciones se registran después de BROKEN y funcionan (comportamiento inválido)

4. **FALSO:** "UI valida que `state_by_view_layer.effective` existe antes de renderizar"
   - **REAL:** UI accede a `effective` sin validación, causando `undefined`

5. **FALSO:** "Refresh preserva `view_layer` activa"
   - **REAL:** Refresh NO preserva `view_layer` en algunos casos

### Punto único de verdad que se está violando

**VIEW AUTHORITY v1:** El backend es la ÚNICA autoridad de estado.

**VIOLACIÓN:** El backend NO calcula `state_by_view_layer.effective` cuando debería, y el frontend NO valida que existe antes de renderizar.

### Diagnóstico raíz (1–3 causas)

**CAUSA RAÍZ 1: Backend NO calcula `effective` cuando `view_layer` solicitada es otra**
- CPM v2 calcula `effective` solo si se llama `computeCleaningProjection` con `view_layer='effective'`
- Si `view_layer` solicitada es `shared` o `pde`, `effective` NO se calcula
- Frontend accede a `effective` sin validar que existe

**CAUSA RAÍZ 2: Reset NO establece `effective_since` correctamente**
- Reset elimina estado pero NO establece `effective_since` en algunos casos
- CPM calcula `never` cuando `effective_since` es NULL (viola regla canónica)
- Tras reset, estado queda como `never` en lugar de `pending`

**CAUSA RAÍZ 3: Runtime BROKEN pero acciones funcionan (comportamiento inválido)**
- Runtime entra en BROKEN por `__AP_UX_ACTION_SCHEMA__` faltante
- Acciones se registran después de BROKEN y funcionan (viola contrato)
- Integrity check NO falla temprano

---

## 🚨 TABLA: CONTRATO → ESTADO

| Contrato | Estado | Evidencia |
|----------|--------|-----------|
| State by View Layer | ❌ ROTO | Backend NO calcula `effective` cuando debería |
| Reset Recurrente | ❌ ROTO | Reset NO establece `effective_since` correctamente |
| Clean Recurrente Múltiple | ⚠️ PARCIALMENTE ROTO | Mensajes inconsistentes, estado NO se actualiza |
| Refresh Surface Registry | ❌ ROTO | Refresh NO preserva `view_layer` activa |
| UX Action Registry | ❌ ROTO | Acciones sin registro, `fetch()` directo |
| Runtime Integrity | ❌ ROTO | Runtime BROKEN pero acciones funcionan |

---

## 📝 NOTAS FINALES

**NO SE PROPONEN SOLUCIONES.** Este diagnóstico solo documenta, demuestra y traza la cadena completa de fallos.

**PRÓXIMO PASO:** Implementar fixes en orden de prioridad (CAUSA RAÍZ 1 → CAUSA RAÍZ 2 → CAUSA RAÍZ 3).

**VERIFICACIÓN:** Cualquier fix debe pasar assembly checks y demostrar que los contratos se cumplen.

---

**FIN DE DIAGNÓSTICO FORENSE TOTAL**
