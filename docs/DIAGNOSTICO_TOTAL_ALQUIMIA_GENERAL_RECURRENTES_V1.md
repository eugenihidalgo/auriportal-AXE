# 🔬 DIAGNÓSTICO TOTAL — ALQUIMIA GENERAL (RECURRENTES)
## OBJETIVO: localizar exactamente dónde se calculan, transforman y rompen los estados tras reset

**FECHA:** 2026-01-27  
**VERSIÓN:** v5.77.0  
**MODO:** SOLO DIAGNÓSTICO (NO FIXES)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ REGLAS ABSOLUTAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- ❌ NO implementar fixes
- ❌ NO refactorizar
- ❌ NO cambiar contratos
- ❌ NO introducir nuevos estados
- ❌ NO "mejorar" nada
- ❌ NO asumir intención
- ✅ SOLO observar código real, flujos reales y datos reales
- ✅ TODA afirmación debe tener archivo + línea
- ✅ Diferenciar claramente: estado BASE, estado PROYECTADO, estado VISUAL

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1️⃣ MAPA GLOBAL DE ESTADOS (OBLIGATORIO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 1.1 Estados existentes HOY en el sistema

**Estados encontrados en RECURRENTES:**

| Estado | Dónde se define | Tipo | Canónico/Legacy |
|--------|----------------|------|-----------------|
| `never` | `cleaning-projection-model.js:263, 267` | String literal canónico | ✅ Canónico |
| `pending` | `cleaning-projection-model.js:273` | String literal canónico | ✅ Canónico |
| `important` | `cleaning-projection-model.js:276` | String literal canónico | ✅ Canónico |
| `reviewed` | `cleaning-projection-model.js:270` | String literal canónico | ✅ Canónico |

**❌ NO existe estado `reseteado`**

**Archivo:** `src/core/master/services/cleaning-projection-model.js`  
**Función:** `computeRecurrenteLayerState()` (líneas 149-334)

**Estados visibles en UI:**
- **Archivo:** `public/js/master/master-alquimia-general-client.js`
- **Línea 2818:** Para RECURRENTE, usa `stateData.state` (never | reviewed | pending | important)
- **Línea 2933-2946:** Columnas: REVISADO (reviewed), PENDIENTE (pending), IMPORTANTE (important), NUNCA (never)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2️⃣ CLEANING ENGINE — ESTADO BASE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Archivo:** `src/core/master/services/cleaning-engine-service.js`

### 2.1 Qué campos escribe el engine en limpieza recurrente

**Función:** `markCleanStudent()` (línea 379)

**Columnas tocadas:**
- `shared_last_cleaned_at` (o `pde_last_cleaned_at`) → `NOW()` (línea 906: `cleaned_at: new Date()`)
- `shared_clean_count` (o `pde_clean_count`) → Incrementado en 1 (línea 900-907: `upsertApplyRecurrent`)

**Columnas NO tocadas:**
- `shared_effective_since` / `pde_effective_since` → NO se modifica en limpieza normal
- `shared_remaining` / `shared_completed` → Solo para `una_vez`, NO para `recurrente`

**Relación con effective_since:**
- **Línea 785-876:** ANTES de aplicar limpieza, verifica si hay RESET previo
- Si hay `lastReset` y `needsRebase = true`, ejecuta `rebaseStateFromReset()` (línea 842)
- `rebaseStateFromReset()` reconstruye estado desde el último RESET, ignorando limpiezas anteriores al reset

### 2.2 Qué campos escribe el engine en reset recurrente

**Función:** `resetStudentItemProgress()` (línea 1525)

**Qué significa reset en términos de BD:**
- **Línea 1802-1809:** Llama a `stateRepo.upsertApplyReset()` con `clean_layer` y `item_kind`
- **Línea 213-259 (`rebaseStateFromReset`):** Establece:
  - `effective_since = reset.created_at` (línea 252: `effectiveSince = resetAt`)
  - `last_cleaned_at = NULL` (se resetea)
  - `clean_count = 0` (se resetea a 0)
  - Pero **conserva historia**: eventos en `cleaning_events` NO se borran

**Qué NO significa:**
- **NO borra fila** de `cleaning_item_state`
- **NO borra eventos** de `cleaning_events` (append-only)
- **NO calcula estado** (CPM lo calcula después)

**Evidencia:**
- **Línea 1497-1503:** Comentario: "Reset es un EVENTO del Cleaning Engine, no un delete"
- **Línea 1800-1809:** `upsertApplyReset` actualiza proyección, NO borra fila

### 2.3 Qué invariantes asume el engine sobre estado

**Líneas 192-244 (`computeRecurrenteLayerState` en CPM):**

1. **Asume que `last_cleaned_at = NULL` implica `never`**
   - **Línea 265-267:** `if (lastEffectiveCleanAt === null) { state = 'never'; }`

2. **Asume que `effective_since != NULL` implica ciclo activo (reset aplicado)**
   - **Línea 158:** `const hasReset = effectiveSince !== null;`
   - **Línea 192-245:** Si `hasReset`, ignora limpiezas anteriores al reset

3. **Asume que reset inicia nuevo ciclo**
   - **Línea 153-155:** Comentario: "Reset inicia un nuevo ciclo"
   - **Línea 215-228:** Si `lastCleanedAt <= effectiveSince`, ignora la limpieza (es anterior al reset)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3️⃣ CPM — CÁLCULO DE ESTADO (CRÍTICO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Archivo:** `src/core/master/services/cleaning-projection-model.js`  
**Función:** `computeRecurrenteLayerState()` (líneas 149-334)

### 3.1 Orden de evaluación de condiciones

**Orden real (líneas 259-280):**

```javascript
// 1. Si hay reset Y NO hay limpieza posterior → 'never' con days_since = 0
if (hasReset && lastEffectiveCleanAt === null) {
  state = 'never';
  daysSince = 0;
}
// 2. Si NO hay reset Y NO hay limpieza → 'never'
else if (lastEffectiveCleanAt === null) {
  state = 'never';
}
// 3. Si days_since < threshold_days → 'reviewed'
else if (daysSince !== null && daysSince < threshold_days) {
  state = 'reviewed';
}
// 4. Si days_since < criticalThreshold → 'pending'
else if (daysSince !== null && daysSince < criticalThreshold) {
  state = 'pending';
}
// 5. Si days_since >= criticalThreshold → 'important'
else if (daysSince !== null) {
  state = 'important';
}
// 6. Caso edge: daysSince es null pero lastEffectiveCleanAt no es null → 'never'
else {
  state = 'never';
}
```

**⚠️ Confirmación de critical_threshold:**
- **Línea 42:** `const criticalThreshold = threshold_days * critical_multiplier;`
- **Línea 682 (`alquimia-general-service.js`):** `critical_multiplier = 2.0` (canónico único)
- **Sí existe y se respeta siempre:** `critical_threshold = threshold_days * 2.0`

### 3.2 Tabla exacta de decisión

**Basada SOLO en código real (líneas 149-280):**

| effective_since | last_cleaned_at | Comparación | days_since | threshold | critical | state resultante | Líneas |
|-----------------|-----------------|-------------|------------|-----------|----------|------------------|--------|
| `NULL` | `NULL` | - | `null` | - | - | `never` | 265-267 |
| `NULL` | `!= NULL` | - | `< threshold` | - | - | `reviewed` | 268-270 |
| `NULL` | `!= NULL` | - | `>= threshold && < critical` | - | - | `pending` | 271-273 |
| `NULL` | `!= NULL` | - | `>= critical` | - | - | `important` | 274-276 |
| `!= NULL` | `NULL` | - | `0` | - | - | `never` | 261-264 |
| `!= NULL` | `!= NULL` | `lastCleaned > effectiveSince` | `< threshold` | - | - | `reviewed` | 197-213, 268-270 |
| `!= NULL` | `!= NULL` | `lastCleaned > effectiveSince` | `>= threshold && < critical` | - | - | `pending` | 197-213, 271-273 |
| `!= NULL` | `!= NULL` | `lastCleaned > effectiveSince` | `>= critical` | - | - | `important` | 197-213, 274-276 |
| `!= NULL` | `!= NULL` | `lastCleaned <= effectiveSince` | `0` | - | - | `never` | 214-228 |

**⚠️ OBSERVACIÓN CRÍTICA:**
- **Línea 261-264:** Si `hasReset && lastEffectiveCleanAt === null` → `state = 'never'` con `daysSince = 0`
- **Esto significa:** Tras reset SIN limpieza posterior, el estado es **SIEMPRE `never`**
- **NO existe estado intermedio `reseteado`**: el sistema cae directamente en `never`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4️⃣ SERVICE — STATE_BY_VIEW_LAYER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Archivo:** `src/services/alquimia-general-service.js`  
**Función:** `getStudentsForItem()` (líneas 541-1071)

### 4.1 Qué estados entrega realmente al frontend

**Estructura exacta (líneas 804-830):**

```javascript
const stateByViewLayer = {
  shared: computeVisualState({ ... }), // Línea 805-812
  pde: computeVisualState({ ... }),    // Línea 813-820
  effective: computeVisualState({ ... }) // Línea 822-829
};
```

**Normalización o mutación:**
- **NO hay normalización:** Los estados vienen directamente de CPM (línea 732-739: `computeVisualState()`)
- **NO hay mutación:** `computeVisualState()` delega a CPM v2 (línea 515-520: `computeCleaningProjection()`)

**Estados legacy paralelos:**
- **Línea 889-897:** `state` y `visual_state` se añaden al objeto `student` para compatibilidad
- Pero **Línea 894:** `state_by_view_layer` es el campo canónico

### 4.2 Diferencias entre shared, pde, effective

**shared:**
- **Línea 805-812:** Calcula estado solo con datos de `shared_last_cleaned_at`, `shared_effective_since`
- Usa `view_layer: 'shared'`

**pde:**
- **Línea 813-820:** Calcula estado solo con datos de `pde_last_cleaned_at`, `pde_effective_since`
- Usa `view_layer: 'pde'`

**effective:**
- **Línea 105-138 (`cleaning-projection-model.js`):** Calcula el **mejor estado** entre shared y pde
- **Línea 110-120:** Prioridad: `reviewed > pending > important > never`
- **NO puede quedar "congelada"** porque siempre toma el mejor entre ambas capas

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5️⃣ UI — FLOTANTES RECURRENTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Archivo:** `public/js/master/master-alquimia-general-client.js`

### 5.1 Qué campo EXACTO decide la columna

**Línea 2773-2774:**
```javascript
if (student.state_by_view_layer && student.state_by_view_layer[activeViewLayer]) {
  stateData = student.state_by_view_layer[activeViewLayer];
}
```

**Línea 2817-2818:**
```javascript
if (itemKind === 'recurrente') {
  columnState = stateData.state || 'never';
}
```

**✅ Confirmado:** Es `student.state_by_view_layer[view_layer].state`

**❌ NO hay fallback oculto:**
- **Línea 2776-2793:** Si falta `state_by_view_layer`, se registra error y **NO se agrega a ninguna columna**
- **Línea 2797-2811:** Si falta `state`, se registra error y **NO se agrega a ninguna columna**

### 5.2 Orden real de columnas hoy

**Línea 2930-2946:**

```javascript
// Orden canónico: reviewed, pending, important, never
columnsContainer.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;';

const colReviewed = createStateColumn('🟢 REVISADO', studentsByState.reviewed, 'reviewed', item, normalized);
columnsContainer.appendChild(colReviewed);

const colPending = createStateColumn('🟡 PENDIENTE', studentsByState.pending, 'pending', item, normalized);
columnsContainer.appendChild(colPending);

const colImportant = createStateColumn('🔴 IMPORTANTE REVISAR', studentsByState.important, 'important', item, normalized);
columnsContainer.appendChild(colImportant);

const colNever = createStateColumn('⚪ NUNCA', studentsByState.never, 'never', item, normalized, true);
columnsContainer.appendChild(colNever);
```

**Orden canónico:**
1. **REVISADO** (reviewed) - Verde
2. **PENDIENTE** (pending) - Amarillo
3. **IMPORTANTE REVISAR** (important) - Rojo
4. **NUNCA** (never) - Blanco (colapsable)

### 5.3 Qué ocurre si aparece un estado no reconocido

**Línea 2869-2884:**

```javascript
if (studentsByState[columnState]) {
  studentsByState[columnState].push(student);
} else {
  // Fallback seguro
  console.warn('[MasterAlquimiaGeneral] [UI][COLUMN] Estado desconocido, usando fallback', {
    columnState,
    item_kind: itemKind,
    student_uuid: student.student_uuid
  });
  if (itemKind === 'recurrente') {
    studentsByState.never.push(student); // ← Se manda a 'never'
  } else {
    studentsByState.never.push(student);
  }
}
```

**Respuesta:** Si aparece un estado no reconocido → **se manda a `never`** (fallback seguro)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6️⃣ CASO REAL — RESET MALDITO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Caso de referencia fija:**
- `student_uuid`: `0d29eedc-6f42-44d1-bb12-53dba2fc9490`
- `item_ref`: `item_17_1768641625523_cr5fpr`
- `clean_layer`: `shared`
- `item_kind`: `recurrente`

### 6.1 Línea temporal REAL (basada en código)

**ESTADO ANTES DEL RESET:**
```
shared_effective_since: NULL
shared_last_cleaned_at: 2026-01-17 09:20:33
shared_clean_count: 1
```

**CPM calcula:**
- `hasReset = false` (effective_since es NULL)
- `lastEffectiveCleanAt = 2026-01-17 09:20:33`
- `daysSince = días desde 2026-01-17 hasta hoy`
- `state = 'reviewed' | 'pending' | 'important'` (según daysSince)

**ESTADO JUSTO TRAS RESET (BD):**
```
shared_effective_since: 2026-01-17 11:01:22
shared_last_cleaned_at: NULL
shared_clean_count: 0
```

**CPM calcula (líneas 261-264):**
- `hasReset = true` (effective_since != NULL)
- `lastEffectiveCleanAt = null` (last_cleaned_at es NULL)
- `state = 'never'` (porque `hasReset && lastEffectiveCleanAt === null`)
- `daysSince = 0`

**ESTADO PROYECTADO POR CPM:**
- `state_by_view_layer.shared.state = 'never'`
- `state_by_view_layer.shared.days_since = 0`

**ESTADO ENTREGADO AL FRONTEND:**
- **Línea 804-830 (`alquimia-general-service.js`):** `state_by_view_layer.shared.state = 'never'`

**ESTADO VISUAL FINAL:**
- **Línea 2818 (`master-alquimia-general-client.js`):** `columnState = 'never'`
- **Línea 2945:** Columna "⚪ NUNCA"

### 6.2 Punto exacto de divergencia

**El estado se rompe en el paso X, archivo Y, línea Z:**

**PASO 1: Cleaning Engine escribe estado BASE (correcto)**
- **Archivo:** `src/core/master/services/cleaning-engine-service.js`
- **Línea 1802-1809:** `upsertApplyReset()` establece `effective_since = NOW()`, `last_cleaned_at = NULL`, `clean_count = 0`
- **✅ CORRECTO:** Estado BASE refleja reset

**PASO 2: CPM calcula estado PROYECTADO (AQUÍ SE ROMPE)**
- **Archivo:** `src/core/master/services/cleaning-projection-model.js`
- **Línea 261-264:** `if (hasReset && lastEffectiveCleanAt === null) { state = 'never'; daysSince = 0; }`
- **❌ PROBLEMA:** Tras reset SIN limpieza, el estado es **SIEMPRE `never`**
- **NO existe transición a `pending`**: el sistema no diferencia "reset reciente" de "nunca trabajado"

**PASO 3: Service entrega estado (correcto, pero hereda el problema)**
- **Archivo:** `src/services/alquimia-general-service.js`
- **Línea 804-830:** `state_by_view_layer.shared.state = 'never'` (hereda de CPM)

**PASO 4: UI agrupa por columna (correcto, pero hereda el problema)**
- **Archivo:** `public/js/master/master-alquimia-general-client.js`
- **Línea 2818:** `columnState = stateData.state` (hereda de backend)

**📍 PUNTO DE ROTURA EXACTO:**
- **Archivo:** `src/core/master/services/cleaning-projection-model.js`
- **Línea 261-264:** Lógica que asigna `state = 'never'` cuando `hasReset && lastEffectiveCleanAt === null`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7️⃣ CONCLUSIÓN FORZADA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 7.1 Dónde se define realmente el estado hoy

**Estado BASE:**
- **Cleaning Engine** (`cleaning-engine-service.js:1802-1809`) → `effective_since`, `last_cleaned_at`, `clean_count`

**Estado PROYECTADO:**
- **CPM** (`cleaning-projection-model.js:261-264`) → `state` (`never` | `pending` | `important` | `reviewed`)

**Estado VISUAL:**
- **UI** (`master-alquimia-general-client.js:2818`) → `columnState` (hereda de CPM)

**📍 RESPUESTA:** El estado se define en **CPM** (Cleaning Projection Model)

### 7.2 Qué significado REAL tiene hoy

**`last_cleaned_at = NULL`:**
- **CPM línea 265-267:** Sin reset → `state = 'never'` (nunca trabajado)
- **CPM línea 261-264:** Con reset → `state = 'never'` (reset aplicado, sin limpieza posterior)
- **⚠️ PROBLEMA:** El sistema NO puede distinguir entre "nunca trabajado" y "reset reciente"

**`effective_since != NULL`:**
- **CPM línea 158:** `hasReset = effectiveSince !== null`
- **CPM línea 192-245:** Si `hasReset`, ignora limpiezas anteriores al reset
- **Significado:** Frontera dura de un nuevo ciclo (reset aplicado)

### 7.3 Por qué el sistema cae en NEVER tras reset

**Causa raíz única:**

**Archivo:** `src/core/master/services/cleaning-projection-model.js`  
**Línea 261-264:**

```javascript
if (hasReset && lastEffectiveCleanAt === null) {
  // RESET_RECURRENTE_V1: Reset aplicado y sin limpieza posterior → 'never' con days_since = 0
  state = 'never';
  daysSince = 0;
}
```

**Razón:**
- Tras reset, `effective_since != NULL` (marca de reset)
- Tras reset, `last_cleaned_at = NULL` (contadores reseteados)
- CPM detecta `hasReset && lastEffectiveCleanAt === null`
- Asigna `state = 'never'` sin diferenciar "reset reciente" de "nunca trabajado"

**El estado `never` significa DOS cosas distintas:**
1. **Nunca trabajado** (effective_since = NULL, last_cleaned_at = NULL)
2. **Reset aplicado** (effective_since != NULL, last_cleaned_at = NULL)

**El sistema NO puede distinguirlos** porque ambos casos cumplen `lastEffectiveCleanAt === null`

### 7.4 Qué invariantes actuales son incompatibles

**con el modelo deseado:**
```
Nunca → Reseteado → Importante → Pendiente → Revisado
```

**Invariantes actuales incompatibles:**

1. **Invariante roto #1:** "`last_cleaned_at = NULL` implica `never`"
   - **Código:** `cleaning-projection-model.js:265-267`
   - **Problema:** No distingue "nunca trabajado" de "reset reciente"
   - **Modelo deseado:** Requiere estado `reseteado` distinto de `never`

2. **Invariante roto #2:** "Reset aplicado sin limpieza → `never`"
   - **Código:** `cleaning-projection-model.js:261-264`
   - **Problema:** Reset debería producir estado `reseteado` → `pending`, NO `never`
   - **Modelo deseado:** `effective_since != NULL && last_cleaned_at = NULL` → `reseteado`

3. **Invariante roto #3:** "NO existe estado `reseteado`"
   - **Código:** `cleaning-projection-model.js` NO tiene caso para `state = 'reseteado'`
   - **Problema:** El modelo deseado requiere estado `reseteado` como transición entre `never` y `pending`
   - **Modelo deseado:** Requiere agregar `reseteado` al enum de estados

4. **Invariante roto #4:** "`days_since = 0` solo implica `never`"
   - **Código:** `cleaning-projection-model.js:264`
   - **Problema:** `days_since = 0` debería poder significar `reseteado` (reset reciente) o `reviewed` (limpiado hoy)
   - **Modelo deseado:** `days_since = 0` + `effective_since != NULL` + `last_cleaned_at = NULL` → `reseteado`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3️⃣ BIS — RESET COMO ESTADO LÓGICO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 3B.1 Qué significa HOY un reset en el sistema

**Evidencia (basada en código real):**

**Archivo:** `src/core/master/services/cleaning-engine-service.js`  
**Línea 1497-1503:**

```javascript
/**
 * REGLA CONSTITUCIONAL: Reset es un EVENTO del Cleaning Engine, no un delete.
 * - Inserta evento en cleaning_events con action_type='reset'
 * - Actualiza cleaning_item_state estableciendo effective_since (NO borra)
 * - Conserva historia (contadores, fechas históricas)
 * - Reset nunca produce estado 'never' (si hubo reset, siempre es 'pending')
 */
```

**⚠️ CONTRADICCIÓN:** El comentario dice "si hubo reset, siempre es 'pending'", pero el código real produce `never` (línea 261-264 de CPM)

**Respuesta real:**
- **Es un cambio de fechas:** `effective_since = NOW()`, `last_cleaned_at = NULL`, `clean_count = 0`
- **Es un nuevo ciclo:** Ignora limpiezas anteriores al reset (línea 214-228 de CPM)
- **Es tratado como "nunca" por el CPM:** Línea 261-264 asigna `state = 'never'` si no hay limpieza posterior
- **NO existe semántica explícita distinta de NEVER:** No hay estado `reseteado`

### 3B.2 Qué estado lógico produce HOY un reset

**Determinado con código real:**

**Archivo:** `src/core/master/services/cleaning-projection-model.js`  
**Línea 261-264:**

```javascript
if (hasReset && lastEffectiveCleanAt === null) {
  state = 'never';
  daysSince = 0;
}
```

**Respuesta:** Tras reset sin limpieza posterior, el sistema cree estar en **`NEVER`**

**Flujo real:**
1. Reset establece `effective_since = NOW()`, `last_cleaned_at = NULL`
2. CPM detecta `hasReset = true`, `lastEffectiveCleanAt = null`
3. Asigna `state = 'never'`
4. **NO hay transición a `pending`**: el sistema permanece en `never` hasta que haya una limpieza

### 3B.3 Dónde se pierde la identidad del reset

**Punto exacto (archivo + línea):**

**Archivo:** `src/core/master/services/cleaning-projection-model.js`  
**Línea 261-264:**

```javascript
if (hasReset && lastEffectiveCleanAt === null) {
  // RESET_RECURRENTE_V1: Reset aplicado y sin limpieza posterior → 'never' con days_since = 0
  state = 'never';
  daysSince = 0;
}
```

**Donde:**
- El reset deja de ser distinguible: Cuando CPM asigna `state = 'never'` sin considerar `effective_since` como señal de "reset reciente"
- Pasa a ser tratado como NEVER: Porque `lastEffectiveCleanAt === null` es condición suficiente para `never`

**El reset pierde identidad porque:**
- **Línea 265-267:** `if (lastEffectiveCleanAt === null) { state = 'never'; }` (sin reset)
- **Línea 261-264:** `if (hasReset && lastEffectiveCleanAt === null) { state = 'never'; }` (con reset)
- **Ambos casos producen `never`**: No hay diferencia semántica entre "nunca trabajado" y "reset reciente"

### 3B.4 Conflictos semánticos actuales

**Lista de incompatibilidades:**

**1. "Nuevo ciclo tras reset" vs "nunca trabajado"**
- **Problema:** Ambos producen `state = 'never'`
- **Código:** `cleaning-projection-model.js:261-264` y `265-267`
- **Modelo deseado:** Reset debería producir estado `reseteado`, no `never`

**2. "Reset inicia nuevo ciclo" vs "Reset = never"**
- **Problema:** Si reset inicia nuevo ciclo, el estado inicial debería ser `reseteado` → `pending`, NO `never`
- **Código:** `cleaning-projection-model.js:153-155` (comentario) vs `261-264` (código)
- **Modelo deseado:** `effective_since != NULL && last_cleaned_at = NULL` → `reseteado` (transición a `pending`)

**3. "Reset nunca produce estado 'never'" (comentario) vs "Reset produce 'never'" (código)**
- **Problema:** El comentario en `cleaning-engine-service.js:1503` dice "si hubo reset, siempre es 'pending'", pero el código produce `never`
- **Código:** `cleaning-engine-service.js:1503` (comentario) vs `cleaning-projection-model.js:261-264` (código)
- **Modelo deseado:** Eliminar contradicción entre comentario y código

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8️⃣ OUTPUT FINAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**✅ Mapa completo:**
- Estados: `never`, `pending`, `important`, `reviewed` (NO existe `reseteado`)
- Origen: CPM (`cleaning-projection-model.js:261-280`)
- Flujo: Engine → CPM → Service → UI

**✅ Tabla de decisión:**
- 9 casos documentados con condiciones exactas (effective_since, last_cleaned_at, days_since)

**✅ Punto único de rotura:**
- **Archivo:** `src/core/master/services/cleaning-projection-model.js`
- **Línea:** 261-264
- **Problema:** `hasReset && lastEffectiveCleanAt === null` → `state = 'never'` (debería ser `reseteado`)

**❌ Sin fixes:**
- NO se propone solución
- NO se cambia código
- SOLO diagnóstico basado en código real

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**FIN DEL DIAGNÓSTICO**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
