# 📋 ALQUIMIA — ESTADO `RESETEADO` v1 (RECURRENTES)
## Definición canónica y tabla de decisión

**FECHA:** 2026-01-27  
**VERSIÓN:** v1.0  
**CONTEXTO:** Fix canónico para separar "NUNCA" de "RESET RECIENTE" en recurrentes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1️⃣ DEFINICIÓN EXACTA DE RESETEADO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Estado `reseteado`:**
- **Aplicación:** Solo RECURRENTES (UNA_VEZ no tiene reset)
- **Condición:** `effective_since != null && last_cleaned_at == null`
- **Significado:** Nuevo ciclo abierto por reset, aún sin limpieza en este ciclo
- **days_since:** `0` (días desde el reset)

**Archivo:** `src/core/master/services/cleaning-projection-model.js`  
**Función:** `computeRecurrenteLayerState()` (líneas 261-264)

**Código canónico:**
```javascript
if (hasReset && lastEffectiveCleanAt === null) {
  // RESET_RECURRENTE_V1: Reset aplicado y sin limpieza posterior → 'reseteado' con days_since = 0
  // effective_since != null && last_cleaned_at == null => reseteado (nuevo ciclo abierto)
  state = 'reseteado';
  daysSince = 0;
}
```

**Diferencia con `never`:**
- **`never`:** `effective_since == null && last_cleaned_at == null` → Nunca trabajado
- **`reseteado`:** `effective_since != null && last_cleaned_at == null` → Reset aplicado, nuevo ciclo abierto

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2️⃣ TABLA DE DECISIÓN RECURRENTE ACTUALIZADA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Basada en código real (`cleaning-projection-model.js:259-280`):**

| effective_since | last_cleaned_at | Comparación | days_since | threshold | critical | state resultante | Líneas |
|-----------------|-----------------|-------------|------------|-----------|----------|------------------|--------|
| `NULL` | `NULL` | - | `null` | - | - | `never` | 265-267 |
| `NULL` | `!= NULL` | - | `< threshold` | - | - | `reviewed` | 268-270 |
| `NULL` | `!= NULL` | - | `>= threshold && < critical` | - | - | `pending` | 271-273 |
| `NULL` | `!= NULL` | - | `>= critical` | - | - | `important` | 274-276 |
| `!= NULL` | `NULL` | - | `0` | - | - | `reseteado` | **261-264** |
| `!= NULL` | `!= NULL` | `lastCleaned > effectiveSince` | `< threshold` | - | - | `reviewed` | 197-213, 268-270 |
| `!= NULL` | `!= NULL` | `lastCleaned > effectiveSince` | `>= threshold && < critical` | - | - | `pending` | 197-213, 271-273 |
| `!= NULL` | `!= NULL` | `lastCleaned > effectiveSince` | `>= critical` | - | - | `important` | 197-213, 274-276 |
| `!= NULL` | `!= NULL` | `lastCleaned <= effectiveSince` | `0` | - | - | `reseteado` | 214-228, 261-264 |

**⚠️ IMPORTANTE:**
- `critical_threshold = threshold_days * 2.0` (canónico único)
- `effective_since != null` indica reset aplicado (frontera dura de nuevo ciclo)
- `last_cleaned_at <= effective_since` se ignora (limpieza anterior al reset)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3️⃣ ORDEN VISUAL CANÓNICO DE COLUMNAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Orden canónico exigido:**
1. **⚪ NUNCA** (`never`) - Nunca trabajado
2. **🔵 RESETEADO** (`reseteado`) - Nuevo ciclo abierto por reset
3. **🔴 IMPORTANTE REVISAR** (`important`) - Limpieza muy antigua (days_since >= critical_threshold)
4. **🟡 PENDIENTE** (`pending`) - Limpieza antigua pero no crítica (threshold <= days_since < critical)
5. **🟢 REVISADO** (`reviewed`) - Limpieza reciente (days_since < threshold)

**Archivo:** `public/js/master/master-alquimia-general-client.js`  
**Líneas:** 2929-2946

**Implementación:**
```javascript
// Orden canónico: Nunca → Reseteado → Importante → Pendiente → Revisado
columnsContainer.style.cssText = 'display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem;';

const colNever = createStateColumn('⚪ NUNCA', studentsByState.never, 'never', item, normalized, true);
const colReseteado = createStateColumn('🔵 RESETEADO', studentsByState.reseteado, 'reseteado', item, normalized);
const colImportant = createStateColumn('🔴 IMPORTANTE REVISAR', studentsByState.important, 'important', item, normalized);
const colPending = createStateColumn('🟡 PENDIENTE', studentsByState.pending, 'pending', item, normalized);
const colReviewed = createStateColumn('🟢 REVISADO', studentsByState.reviewed, 'reviewed', item, normalized);
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4️⃣ TRANSICIONES DE ESTADO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Flujo canónico tras reset:**

1. **Reset aplicado:**
   - BD: `effective_since = NOW()`, `last_cleaned_at = NULL`, `clean_count = 0`
   - CPM: `state = 'reseteado'`, `days_since = 0`
   - UI: Alumno cae en columna **RESETEADO**

2. **Primera limpieza post-reset:**
   - BD: `last_cleaned_at = NOW()`, `clean_count = 1`
   - CPM: `state = 'reviewed'` (si `days_since < threshold`)
   - UI: Alumno se mueve a columna **REVISADO**

3. **Paso de días:**
   - `days_since >= threshold && days_since < critical` → `state = 'pending'`
   - `days_since >= critical` → `state = 'important'`

**⚠️ NOTA IMPORTANTE:**
- `critical_threshold = threshold_days * 2.0` (canónico único)
- `important` siempre es el doble exacto del `threshold_days`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5️⃣ ESTADO EFFECTIVE Y PRIORIDAD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Archivo:** `src/core/master/services/cleaning-projection-model.js`  
**Función:** `computeRecurrenteState()` con `view_layer === 'effective'` (líneas 104-139)

**Estado `effective` combina estados de `shared` y `pde`:**
- Calcula estado para cada capa (`shared` y `pde`)
- Selecciona el mejor estado según prioridad canónica

**Orden de prioridad canónica:**
```
reviewed > pending > important > reseteado > never
```

**Significado:**
- `reseteado` es MEJOR que `never` (hay un ciclo activo, solo falta limpieza)
- `reseteado` es PEOR que `important` (importante necesita atención inmediata)
- `reseteado` NO es estado final efectivo (es un estado transitorio de ciclo)

**Lógica canónica (líneas 110-122):**
```javascript
// Prioridad canónica: reviewed > pending > important > reseteado > never
// `reseteado` es un estado base de ciclo: mejor que `never`, peor que `important`
let effectiveState;
if (sharedState.state === 'reviewed' || pdeState.state === 'reviewed') {
  effectiveState = 'reviewed';
} else if (sharedState.state === 'pending' || pdeState.state === 'pending') {
  effectiveState = 'pending';
} else if (sharedState.state === 'important' || pdeState.state === 'important') {
  effectiveState = 'important';
} else if (sharedState.state === 'reseteado' || pdeState.state === 'reseteado') {
  effectiveState = 'reseteado';
} else {
  effectiveState = 'never';
}
```

**Ejemplos:**
- `shared.state = 'reseteado'` y `pde.state = 'never'` → `effective.state = 'reseteado'` ✅
- `shared.state = 'reviewed'` y `pde.state = 'never'` → `effective.state = 'reviewed'` ✅
- `shared.state = 'reseteado'` y `pde.state = 'reseteado'` → `effective.state = 'reseteado'` ✅

**⚠️ IMPORTANTE:**
- `reseteado` NO se trata como `never` en `effective` (fix aplicado v5.77.2)
- Tras limpiar una capa, `effective` refleja el cambio correctamente (ej: `shared` pasa a `reviewed` → `effective` pasa a `reviewed`)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6️⃣ FALLBACK DE ESTADOS DESCONOCIDOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Regla canónica:**
- **UI fallback:** Si aparece un estado desconocido → se envía a `never` (fallback seguro)
- **⚠️ IMPORTANTE:** `reseteado` ya NO se considera desconocido (está incluido en `studentsByState`)

**Archivo:** `public/js/master/master-alquimia-general-client.js`  
**Líneas:** 2869-2884

**Implementación:**
```javascript
if (studentsByState[columnState]) {
  studentsByState[columnState].push(student);
} else {
  // Fallback seguro: enviar a 'never'
  console.warn('[MasterAlquimiaGeneral] [UI][COLUMN] Estado desconocido, usando fallback', {
    columnState,
    item_kind: itemKind,
    student_uuid: student.student_uuid
  });
  studentsByState.never.push(student);
}
```

**Estados válidos para RECURRENTES:**
- `never` ✅
- `reseteado` ✅ (nuevo)
- `important` ✅
- `pending` ✅
- `reviewed` ✅

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7️⃣ PUNTO DE ROTURA ORIGINAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Bug original:**
- **Archivo:** `src/core/master/services/cleaning-projection-model.js`
- **Líneas:** 261-264 (antes del fix)
- **Problema:** `hasReset && lastEffectiveCleanAt === null` → `state = 'never'`
- **Causa:** El sistema no distinguía entre "nunca trabajado" y "reset reciente"

**Fix aplicado:**
- **Línea 261-264:** `hasReset && lastEffectiveCleanAt === null` → `state = 'reseteado'`
- **Línea 265-267:** `!hasReset && lastEffectiveCleanAt === null` → `state = 'never'`
- **Resultado:** Separación clara entre `never` (nunca trabajado) y `reseteado` (reset reciente)

**Diagnóstico base:**
- **Documento:** `docs/DIAGNOSTICO_TOTAL_ALQUIMIA_GENERAL_RECURRENTES_V1.md`
- **Caso maldito:** `student_uuid: 0d29eedc-6f42-44d1-bb12-53dba2fc9490`, `item_ref: item_17_1768641625523_cr5fpr`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8️⃣ VERIFICACIÓN OBLIGATORIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Caso de prueba canónico:**
- `student_uuid`: `0d29eedc-6f42-44d1-bb12-53dba2fc9490`
- `item_ref`: `item_17_1768641625523_cr5fpr`
- `layer`: `shared`
- `item_kind`: `recurrente`

**Pasos de verificación:**

1. **Reset recurrente SHARED:**
   - ✅ BD: `effective_since != null`, `last_cleaned_at = null`, `clean_count = 0`
   - ✅ CPM: `state = 'reseteado'`
   - ✅ UI: Alumno cae en columna **RESETEADO** (NO en NUNCA)

2. **Primera limpieza post-reset:**
   - ✅ BD: `last_cleaned_at != null`, `clean_count = 1`
   - ✅ CPM: `state = 'reviewed'` (si `days_since < threshold`)
   - ✅ UI: Alumno se mueve a columna **REVISADO**

3. **Paso de días:**
   - ✅ `days_since >= threshold` → `state = 'pending'`
   - ✅ `days_since >= 2*threshold` → `state = 'important'`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9️⃣ REFERENCIAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Archivos modificados:**
- `src/core/master/services/cleaning-projection-model.js` (CPM - introducción de `reseteado` y prioridad en `effective`)
- `src/services/alquimia-general-service.js` (Service - counts incluyen `reseteado`)
- `public/js/master/master-alquimia-general-client.js` (UI - columna RESETEADO y orden canónico)

**Documentos relacionados:**
- `docs/DIAGNOSTICO_TOTAL_ALQUIMIA_GENERAL_RECURRENTES_V1.md` (diagnóstico base)
- `docs/DIAGNOSTICO_QUIRURGICO_RESETEADO_NO_LIMPIA_V1.md` (diagnóstico effective)
- `docs/FORENSICS_RESET_MALDITO_V1.md` (forensics original)

**Versión:**
- **v1.0** - 2026-01-27 - Introducción de estado `reseteado` para recurrentes
- **v1.1** - 2026-01-27 - Fix: Inclusión de `reseteado` en prioridad de `effective`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**FIN DEL DOCUMENTO**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
