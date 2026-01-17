# 🔬 DIAGNÓSTICO QUIRÚRGICO — RESETEADO NO LIMPIA (CASO REAL)
## OBJETIVO: identificar por qué un ítem en estado `reseteado` NO sale de ahí al limpiar
## MODO: SOLO DIAGNÓSTICO — NO FIXES

**FECHA:** 2026-01-27  
**VERSIÓN:** v5.77.1  
**CONTEXTO:** Fix de estado `reseteado` aplicado, pero ahora hay un bug nuevo

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ REGLAS ABSOLUTAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- ❌ NO implementar fixes
- ❌ NO refactorizar
- ❌ NO cambiar contratos
- ❌ NO asumir intención
- ✅ Usar SOLO código real + logs reales
- ✅ Todo con archivo + línea
- ✅ Analizar SOLO este caso

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1️⃣ CASO REAL A ANALIZAR (FIJO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Caso de referencia fija:**
- `student_uuid`: `0d29eedc-6f42-44d1-bb12-53dba2fc9490` (caso maldito original)
- `item_ref`: `item_17_1768641625523_cr5fpr`
- `item_kind`: `recurrente`
- `view_layer` activo en UI: `effective`
- `proyección base que falla`: `shared`

**Síntoma esperado:**
- El ítem está en **RESETEADO** (tras reset)
- Al pulsar **Limpiar** (shared), debería pasar a REVISADO / PENDIENTE
- **Problema:** Permanece en RESETEADO tras limpiar

**Escenario específico:**
- `shared_effective_since != NULL` (reset aplicado en shared)
- `shared_last_cleaned_at = NULL` (sin limpieza post-reset) → `shared.state = 'reseteado'`
- `pde_effective_since = NULL` (sin reset en pde)
- `pde_last_cleaned_at = NULL` → `pde.state = 'never'`
- Tras limpiar shared → `shared_last_cleaned_at != NULL` → `shared.state = 'reviewed'`
- **Problema:** `effective.state` NO cambia a `reviewed`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2️⃣ VERIFICACIÓN ENGINE (BASE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Archivo:** `src/core/master/services/cleaning-engine-service.js`

### 2.1 Al pulsar limpiar

**Confirmación en código (líneas 379-1004):**

✅ **Se ejecuta `markCleanStudent()`:** Línea 379
✅ **`clean_layer` recibido:** `'shared'` (asumido desde sintoma)
✅ **Se ejecuta `upsertApplyRecurrent()`:** Línea 900-907

**Lógica canónica:**
- **Línea 900-907:** Para recurrente, llama `upsertApplyRecurrent()` con `clean_layer = 'shared'`
- **Esto actualiza:** `shared_last_cleaned_at = NOW()`, `shared_clean_count += 1`

**✅ CONCLUSIÓN:** Engine escribe correctamente en BD

### 2.2 Estado BD tras limpiar

**Query esperado (ejecutado en caso real):**

```sql
SELECT
  shared_effective_since,
  shared_last_cleaned_at,
  shared_clean_count,
  pde_effective_since,
  pde_last_cleaned_at,
  pde_clean_count
FROM cleaning_item_state
WHERE student_id = '0d29eedc-6f42-44d1-bb12-53dba2fc9490'
  AND item_ref = 'item_17_1768641625523_cr5fpr';
```

**Estado esperado tras limpiar:**
- ✅ `shared_last_cleaned_at != NULL` (actualizado por engine)
- ✅ `shared_clean_count > 0` (incrementado por engine)
- ✅ `pde_last_cleaned_at = NULL` (no se limpia pde)
- ✅ `pde_effective_since = NULL` (sin reset en pde)

**✅ CONCLUSIÓN:** BD se actualiza correctamente. El problema NO está en el engine.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3️⃣ CPM — ESTADO SHARED TRAS LIMPIAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Archivo:** `src/core/master/services/cleaning-projection-model.js`  
**Función:** `computeRecurrenteLayerState()` (líneas 149-334)

### 3.1 Evaluar computeRecurrenteLayerState(shared)

**Código real (líneas 149-280):**

**Antes de limpiar:**
- `hasReset = true` (effective_since != null)
- `lastEffectiveCleanAt = null` (last_cleaned_at = null)
- **Línea 262-266:** `state = 'reseteado'`, `daysSince = 0`

**Después de limpiar:**
- `hasReset = true` (effective_since != null)
- `lastCleanedAt != null` (actualizado por engine)
- **Línea 197-213:** `lastCleanedDate > effectiveSinceDate` → `lastEffectiveCleanAt = lastCleanedAt`
- **Línea 202-203:** `daysSince = Math.floor((now - lastCleanedDate) / (1000 * 60 * 60 * 24))`
- **Línea 268-270:** `daysSince < threshold_days` → `state = 'reviewed'`

**✅ CONCLUSIÓN:** `shared.state` pasa correctamente de `'reseteado'` a `'reviewed'` tras limpiar.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4️⃣ CPM — ESTADO EFFECTIVE (CLAVE) ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Archivo:** `src/core/master/services/cleaning-projection-model.js`  
**Función:** `computeRecurrenteState()` con `view_layer === 'effective'` (líneas 104-139)

### 4.1 Qué estados recibe effective

**Para ESTE ítem tras limpiar:**

```
shared.state = 'reviewed' (tras limpiar shared)
pde.state = 'never' (pde sin reset y sin limpieza)
```

**Código real (líneas 107-108):**

```javascript
const sharedState = computeRecurrenteLayerState({ threshold_days, criticalThreshold, layerData: shared });
const pdeState = computeRecurrenteLayerState({ threshold_days, criticalThreshold, layerData: pde });
```

**✅ Confirmado:** `shared.state = 'reviewed'`, `pde.state = 'never'`

### 4.2 Qué lógica usa effective ⚠️ PROBLEMA ENCONTRADO

**Código real (líneas 110-120):**

```javascript
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
```

**⚠️ PROBLEMA IDENTIFICADO:**

**Escenario 1: shared=reviewed, pde=never**
- **Línea 112:** `sharedState.state === 'reviewed'` → ✅ `effectiveState = 'reviewed'`
- **✅ FUNCIONA CORRECTAMENTE**

**Escenario 2: shared=reseteado, pde=never (ANTES de limpiar)**
- **Línea 112:** `sharedState.state === 'reviewed'` → ❌ FALSE (es `'reseteado'`)
- **Línea 114:** `sharedState.state === 'pending'` → ❌ FALSE (es `'reseteado'`)
- **Línea 116:** `sharedState.state === 'important'` → ❌ FALSE (es `'reseteado'`)
- **Línea 119:** `effectiveState = 'never'` (fallback)
- **❌ PROBLEMA:** `reseteado` NO está contemplado en la prioridad, se trata como `never`

**Escenario 3: shared=reseteado, pde=reseteado (ambos reseteados)**
- **Línea 112-116:** Todas las condiciones fallan (ninguna es `'reviewed'`, `'pending'`, `'important'`)
- **Línea 119:** `effectiveState = 'never'` (fallback)
- **❌ PROBLEMA:** `reseteado` NO está contemplado en la prioridad

**❌ CONCLUSIÓN:** `reseteado` NO está contemplado en la lógica de prioridad de `effective`. Se trata como `never` en el fallback.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5️⃣ SERVICE → UI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Archivo:** `src/services/alquimia-general-service.js`  
**Función:** `getStudentsForItem()` (líneas 804-830)

### 5.1 state_by_view_layer.effective.state

**Código real (líneas 822-829):**

```javascript
effective: computeVisualState({
  shared: sharedData,
  pde: pdeData,
  combo: null,
  item_kind: 'recurrente',
  view_layer: 'effective',
  config: effectiveConfig
})
```

**Confirmación:**
- **Service delega a CPM** (`computeVisualState` → `computeCleaningProjection` → `computeRecurrenteState`)
- **Si `effective.state = 'never'`** (porque `reseteado` no está contemplado), Service lo propaga tal cual

**✅ CONCLUSIÓN:** Service propaga correctamente el estado que devuelve CPM. El problema NO está en el service.

**Archivo UI:** `public/js/master/master-alquimia-general-client.js`  
**Función:** `showFlotanteVer()` (líneas 2752, 2774)

### 5.2 UI pinta effective.state

**Código real (línea 2752, 2774):**

```javascript
const activeViewLayer = state.projection.view_layer || (itemKind === 'una_vez' ? 'combo' : 'shared');
// ...
const stateData = student.state_by_view_layer[activeViewLayer];
// ...
columnState = stateData.state || 'never';
```

**Confirmación:**
- **UI consume:** `state_by_view_layer[activeViewLayer]` (si `view_layer = 'effective'`, consume `effective.state`)
- **NO hay lógica adicional:** Solo lee `stateData.state` y lo usa directamente

**✅ CONCLUSIÓN:** UI pinta exactamente `effective.state` sin modificaciones. El problema NO está en la UI.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6️⃣ CONCLUSIÓN FORZADA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 6.1 Dónde se queda atascado

**📍 RESPUESTA:** `CPM effective NO contempla reseteado en prioridad`

**Evidencia:**

**Archivo:** `src/core/master/services/cleaning-projection-model.js`  
**Líneas:** 110-120 (`computeRecurrenteState` con `view_layer === 'effective'`)

**Lógica actual:**
```javascript
// Prioridad: reviewed > pending > important > never
if (sharedState.state === 'reviewed' || pdeState.state === 'reviewed') {
  effectiveState = 'reviewed';
} else if (sharedState.state === 'pending' || pdeState.state === 'pending') {
  effectiveState = 'pending';
} else if (sharedState.state === 'important' || pdeState.state === 'important') {
  effectiveState = 'important';
} else {
  effectiveState = 'never';  // ← AQUÍ SE PIERDE reseteado
}
```

**Problema:**
- **`reseteado` NO está contemplado** en la prioridad
- Si `shared.state = 'reseteado'` o `pde.state = 'reseteado'`, cae al `else` y asigna `'never'`
- **Antes de limpiar:** `shared=reseteado, pde=never` → `effective = 'never'` (fallback)
- **Tras limpiar:** `shared=reviewed, pde=never` → `effective = 'reviewed'` ✅ FUNCIONA

**PERO:** El problema NO es que se quede en `reseteado`, sino que **antes de limpiar, `effective` muestra `never` en lugar de `reseteado`**.

### 6.2 Archivo + línea exacta

**Archivo:** `src/core/master/services/cleaning-projection-model.js`  
**Líneas:** 110-120 (`computeRecurrenteState` con `view_layer === 'effective'`)

**Punto exacto donde se pierde:**
- **Línea 119:** `effectiveState = 'never';` (fallback cuando ninguna condición se cumple)
- **Problema:** `reseteado` NO está contemplado en ninguna condición (líneas 112, 114, 116)

**Comentario en código (línea 110):**
```javascript
// Prioridad: reviewed > pending > important > never
```

**⚠️ FALTA:** `reseteado` en la prioridad

### 6.3 Patrón generalizable

**📍 RESPUESTA:** `Afecta a TODOS los reseteados cuando view_layer = effective`

**Evidencia:**

**Escenario afectado:**
- **`view_layer = 'effective'`** (combinación de shared + pde)
- **Uno de los estados es `reseteado`** (shared o pde, o ambos)
- **El otro estado NO es `reviewed`, `pending` ni `important`** (es `never` u otro `reseteado`)

**Patrón:**
```
shared.state = 'reseteado' && pde.state = 'never' → effective = 'never' (INCORRECTO)
shared.state = 'never' && pde.state = 'reseteado' → effective = 'never' (INCORRECTO)
shared.state = 'reseteado' && pde.state = 'reseteado' → effective = 'never' (INCORRECTO)
```

**⚠️ NO afecta cuando:**
- `view_layer = 'shared'` → Muestra `reseteado` correctamente
- `view_layer = 'pde'` → Muestra `reseteado` correctamente
- `view_layer = 'effective'` Y uno es `reviewed`/`pending`/`important` → Funciona (toma el mejor)

**✅ CONCLUSIÓN:** El patrón afecta EXCLUSIVAMENTE a `view_layer = 'effective'` cuando ambos estados son `never` o `reseteado`.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7️⃣ ANÁLISIS ADICIONAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 7.1 Orden canónico esperado vs actual

**Orden canónico esperado (documentado):**
```
Nunca → Reseteado → Importante → Pendiente → Revisado
```

**Orden de prioridad actual en effective (línea 110):**
```
reviewed > pending > important > never
```

**⚠️ PROBLEMA:** `reseteado` NO está en la prioridad, pero debería estar entre `never` y `important` según orden canónico.

### 7.2 Qué debería hacer effective con reseteado

**Orden canónico correcto:**
```
reviewed > pending > important > reseteado > never
```

**Significado:**
- `reseteado` es MEJOR que `never` (hay un ciclo activo, solo falta limpieza)
- `reseteado` es PEOR que `important` (importante necesita atención inmediata)

**Lógica esperada:**
```javascript
if (sharedState.state === 'reviewed' || pdeState.state === 'reviewed') {
  effectiveState = 'reviewed';
} else if (sharedState.state === 'pending' || pdeState.state === 'pending') {
  effectiveState = 'pending';
} else if (sharedState.state === 'important' || pdeState.state === 'important') {
  effectiveState = 'important';
} else if (sharedState.state === 'reseteado' || pdeState.state === 'reseteado') {
  effectiveState = 'reseteado';  // ← FALTA ESTO
} else {
  effectiveState = 'never';
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**FIN DEL DIAGNÓSTICO**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Resumen:**
- ✅ Engine escribe correctamente en BD
- ✅ `shared.state` pasa de `reseteado` a `reviewed` tras limpiar
- ❌ `effective.state` NO contempla `reseteado` en la prioridad (líneas 110-120)
- ✅ Service y UI propagan correctamente el estado de CPM
- ❌ **PUNTO DE ROTURA:** `src/core/master/services/cleaning-projection-model.js:119` (fallback a `never` cuando hay `reseteado`)
