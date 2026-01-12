# DIAGNÓSTICO PIPELINE COLUMNAS ALQUIMIA v1

**Fecha**: 2026-01-12  
**Dominio**: MASTER  
**Sistema**: Alquimia General / Flotante  
**Modo**: SOLO LECTURA / FORENSICS  
**Objetivo**: Identificar por qué los alumnos no se reubican en la columna correcta tras acciones de limpieza.

---

## REGLA CANÓNICA A VERIFICAR

**CONSISTENCIA ACCIÓN → PROYECCIÓN → UBICACIÓN**

Una acción que modifica estado DEBE provocar:
1. ✅ Escritura correcta en DB
2. ✅ Recalculo correcto de proyecciones (shared / pde / combo)
3. ❓ **Reubicación inmediata del alumno en la columna correcta**

Si el alumno no cambia de columna tras la acción, el sistema está canónicamente roto.

---

## FASE 1 — IDENTIFICACIÓN DEL PIPELINE DE COLUMNAS

### 1.1 Función/es que agrupan alumnos en columnas

**Archivo**: `public/js/master/master-alquimia-general-client.js`

**Función principal**: `showFlotanteVer(item, normalized)` (línea 1078)

**Líneas de agrupación**: 1249-1295

```javascript
// Agrupar estudiantes aplicables por estado
const studentsByState = {
  reviewed: [],
  pending: [],
  important: [],
  never: [],
  completed: [],
  in_progress: [], // Para UNA_VEZ: En proceso
  empowered: [] // Para UNA_VEZ: Potenciado (>= required_count * 10)
};

// UI PASIVA: usar solo estados calculados por backend (autoridad única)
// NO calcular estados en frontend, solo agrupar por student.state o student.visual_state
studentsAplicables.forEach(student => {
  // RECURRENTE: usar student.state calculado por backend
  // UNA_VEZ: usar student.visual_state calculado por backend (basado en COMBO)
  const state = itemKind === 'recurrente' 
    ? (student.state || 'never')  // Backend calcula: never | reviewed | pending | important
    : (student.visual_state || 'never'); // Backend calcula: never | in_progress | completed | empowered
  
  // Mapeo de estados UNA_VEZ a estados de columna
  let columnState = state;
  if (itemKind === 'una_vez') {
    // Mapear visual_state del backend a estados de columna
    // Backend devuelve: never | in_progress | completed | empowered
    if (state === 'in_progress') columnState = 'in_progress';
    else if (state === 'empowered') columnState = 'empowered';
    else if (state === 'completed') columnState = 'completed';
    else columnState = 'never';
  }
  
  if (studentsByState[columnState]) {
    studentsByState[columnState].push(student);
  } else {
    // Fallback seguro
    if (itemKind === 'recurrente') {
      studentsByState.never.push(student);
    } else {
      studentsByState.pending.push(student);
    }
  }
});
```

**Función de renderizado**: `createStateColumn(title, students, stateKey, item, normalized, collapsable)` (línea 1407)

**Líneas de renderizado**: 1297-1337

```javascript
// Renderizar columnas por estado según tipo
const columnsContainer = document.createElement('div');

if (tipo === 'recurrente') {
  columnsContainer.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;';
  
  // 🟢 REVISADO
  const colReviewed = createStateColumn('🟢 REVISADO', studentsByState.reviewed, 'reviewed', item, normalized);
  columnsContainer.appendChild(colReviewed);

  // 🟡 PENDIENTE
  const colPending = createStateColumn('🟡 PENDIENTE', studentsByState.pending, 'pending', item, normalized);
  columnsContainer.appendChild(colPending);

  // 🔴 IMPORTANTE REVISAR
  const colImportant = createStateColumn('🔴 IMPORTANTE REVISAR', studentsByState.important, 'important', item, normalized);
  columnsContainer.appendChild(colImportant);

  // ⚪ NUNCA (colapsable)
  const colNever = createStateColumn('⚪ NUNCA', studentsByState.never, 'never', item, normalized, true);
  columnsContainer.appendChild(colNever);
} else {
  // una_vez: 4 columnas obligatorias basadas en TOTAL
  columnsContainer.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;';
  
  // ⚪ NUNCA (gris) - total_clean_count = 0
  const colNever = createStateColumn('⚪ NUNCA', studentsByState.never, 'never', item, normalized);
  columnsContainer.appendChild(colNever);

  // 🟡 EN PROCESO (amarillo) - combo_count > 0 && combo_count < required_count
  const colInProgress = createStateColumn('🟡 EN PROCESO', studentsByState.in_progress || [], 'in_progress', item, normalized);
  columnsContainer.appendChild(colInProgress);

  // ✅ COMPLETADO (verde) - combo_count >= required_count && combo_count < (required_count * 10)
  const colCompleted = createStateColumn('✅ COMPLETADO', studentsByState.completed, 'completed', item, normalized);
  columnsContainer.appendChild(colCompleted);

  // 🟣 POTENCIADO (violeta) - combo_count >= (required_count * 10)
  const colEmpowered = createStateColumn('🟣 POTENCIADO', studentsByState.empowered || [], 'empowered', item, normalized);
  columnsContainer.appendChild(colEmpowered);
}
```

### 1.2 Momento en que se ejecuta

**Flujo completo**:

1. **Apertura inicial del flotante**: `handleVerItem(item, cleanLayer)` (línea 875) → `showFlotanteVer(item, normalized)` (línea 948)

2. **Tras una acción de limpieza**: 
   - `handleLimpiarEstudiante(student, item, cleanLayer, itemKind)` (línea 1766)
   - POST → OK
   - **Refetch**: `await handleVerItem(item, 'shared')` (línea 1886)
   - `handleVerItem` → `showFlotanteVer(item, normalized)` (línea 948)

**Momento de ejecución**: **DESPUÉS** del refetch. El agrupamiento se ejecuta cada vez que se renderiza el flotante.

---

## FASE 2 — IDENTIFICACIÓN DE LA FUENTE REAL QUE DECIDE LA COLUMNA

### 2.1 Fuente canónica ACTUAL

**RECURRENTE**:
- **Campo usado**: `student.state` (línea 1271)
- **Valores posibles**: `never | reviewed | pending | important`
- **Origen**: Backend (`alquimia-general-service.js`, líneas 606-619)

**UNA_VEZ**:
- **Campo usado**: `student.visual_state` (línea 1272)
- **Valores posibles**: `never | in_progress | completed | empowered`
- **Origen**: Backend (`alquimia-general-service.js`, líneas 695-711)

### 2.2 Cálculo en backend

**Archivo**: `src/services/alquimia-general-service.js`

#### RECURRENTE (líneas 573-633):

```javascript
// REGLA CANÓNICA: Estado RECURRENTE se calcula según clean_layer del request
// Si clean_layer='shared', usar shared.days_since_last_clean
// Si clean_layer='pde', usar pde.days_since_last_clean
// Esto garantiza que el estado refleje la capa que se está visualizando
const layerForState = clean_layer === 'pde' ? 'pde' : 'shared';
const layerDataForState = layerForState === 'pde' ? pdeData : sharedData;
const daysSince = layerDataForState.days_since_last_clean !== undefined 
  ? layerDataForState.days_since_last_clean 
  : (layerForState === 'pde' ? null : (student.days_since_last_clean || null));

let state;
if (daysSince === null || daysSince === undefined) {
  // Nunca limpiado → NUNCA (sección colapsable)
  state = 'never';
} else if (daysSince < thresholdDays) {
  // Última ejecución < threshold_days → REVISADO
  state = 'reviewed';
} else if (daysSince < criticalThreshold) {
  // threshold_days <= días < threshold_days * critical_multiplier → PENDIENTE
  state = 'pending';
} else {
  // días >= threshold_days * critical_multiplier → IMPORTANTE REVISAR
  state = 'important';
}
```

**⚠️ PROBLEMA DETECTADO**: El estado RECURRENTE se calcula según `clean_layer` del **request**, no según la **acción realizada**. Si la acción fue PDE pero el refetch usa `cleanLayer='shared'`, el estado se calcula basado en `shared.days_since_last_clean`, no en `pde.days_since_last_clean`.

#### UNA_VEZ (líneas 655-733):

```javascript
// PROYECCIÓN COMBO: calcular total (shared + pde) como proyección backend
const sharedCount = sharedData.clean_count !== null && sharedData.clean_count !== undefined ? parseInt(sharedData.clean_count, 10) : 0;
const pdeCount = pdeData.clean_count !== null && pdeData.clean_count !== undefined ? parseInt(pdeData.clean_count, 10) : 0;
const comboCleanCount = sharedCount + pdeCount;

// Calcular estado visual basado en COMBO (proyección backend)
// REGLA CANÓNICA UNA_VEZ v2:
// - never: combo_count == 0
// - in_progress (pending): combo_count > 0 && combo_count < required_count
// - completed: combo_count >= required_count && combo_count < required_count * 10
// - empowered: combo_count >= required_count * 10
let visualState;
let state;

if (comboCleanCount === 0) {
  // Nunca trabajado (gris)
  visualState = 'never';
  state = 'pending';
} else if (comboCleanCount < vecesLimpiar) {
  // En proceso (amarillo) - tiene contador pero aún no alcanzó required_count
  visualState = 'in_progress';
  state = 'pending';
} else if (comboCleanCount >= vecesLimpiar && comboCleanCount < (vecesLimpiar * 10)) {
  // Completado (verde) - alcanzó required_count pero no superó *10
  visualState = 'completed';
  state = 'completed';
} else {
  // Potenciado/Empowered (violeta) - superó required_count * 10
  visualState = 'empowered';
  state = 'completed';
}
```

**✅ CORRECTO**: El estado UNA_VEZ se calcula basado en COMBO (shared + pde), independientemente del `clean_layer` del request. Esto garantiza que el estado refleje el progreso total.

---

## FASE 3 — VERIFICACIÓN DE ORIGEN DEL CAMPO

### 3.1 ¿Proviene DIRECTAMENTE del backend?

**✅ SÍ**: Los campos `student.state` y `student.visual_state` provienen directamente del backend, calculados en `alquimia-general-service.js`.

**Evidencia**:
- `normalizeStudentsPayload` (línea 846) solo extrae `students` del payload, no modifica campos
- `showFlotanteVer` recibe `normalized` que contiene `students` con `state` y `visual_state` calculados por backend
- No hay cálculo de estados en frontend (comentario línea 1265: "NO calcular estados en frontend")

### 3.2 ¿Está recalculado tras cada acción?

**Flujo tras acción**:

1. `handleLimpiarEstudiante` → POST → OK
2. **Refetch**: `await handleVerItem(item, 'shared')` (línea 1886)
3. `handleVerItem` hace fetch a `/master/api/alquimia-general/items/${item.item_ref}/students?clean_layer=shared` (línea 892)
4. Backend calcula estados frescos
5. `showFlotanteVer(item, normalized)` renderiza con datos frescos

**✅ SÍ**: El refetch trae datos frescos del backend, que recalcula estados.

### 3.3 ¿Hay estado local / cacheado / derivado?

**❌ NO**: No hay cache de estudiantes. El estado `state.modal` solo guarda:
- `state.modal.item` (item actual)
- `state.modal.cleanLayer` (capa actual)
- `state.modal.itemKind` (tipo de item)
- `state.modal.layerView` (vista actual: shared/pde/combo)

**No hay cache de `students` ni de estados calculados**.

---

## FASE 4 — VERIFICACIÓN DEL FLUJO TRAS UNA ACCIÓN

### 4.1 Flujo completo (RECURRENTE)

**Click botón SHARED**:
1. `handleLimpiarEstudiante(student, item, 'shared', itemKind)` (línea 1766)
2. POST `/master/api/alquimia-general/items/:item_ref/master/mark-clean-student` con `clean_layer='shared'`
3. Backend escribe en `shared_clean_count`, `shared_last_cleaned_at`
4. **Refetch**: `await handleVerItem(item, 'shared')` (línea 1886)
5. GET `/master/api/alquimia-general/items/:item_ref/students?clean_layer=shared`
6. Backend calcula `state` basado en `shared.days_since_last_clean` (línea 600)
7. `showFlotanteVer(item, normalized)` agrupa por `student.state`
8. **✅ CORRECTO**: El alumno debería moverse a columna "REVISADO" si `days_since_last_clean < threshold_days`

**Click botón PDE**:
1. `handleLimpiarEstudiante(student, item, 'pde', itemKind)` (línea 1766)
2. POST `/master/api/alquimia-general/items/:item_ref/master/mark-clean-student` con `clean_layer='pde'`
3. Backend escribe en `pde_clean_count`, `pde_last_cleaned_at`
4. **Refetch**: `await handleVerItem(item, 'shared')` (línea 1886) ⚠️ **PROBLEMA**
5. GET `/master/api/alquimia-general/items/:item_ref/students?clean_layer=shared`
6. Backend calcula `state` basado en `shared.days_since_last_clean` (línea 600) ⚠️ **NO en `pde.days_since_last_clean`**
7. `showFlotanteVer(item, normalized)` agrupa por `student.state`
8. **❌ INCORRECTO**: El alumno NO se mueve porque el estado se calcula basado en `shared`, no en `pde`

### 4.2 Flujo completo (UNA_VEZ)

**Click botón SHARED**:
1. `handleLimpiarEstudiante(student, item, 'shared', itemKind)` (línea 1766)
2. POST con `clean_layer='shared'`
3. Backend escribe en `shared_clean_count`
4. **Refetch**: `await handleVerItem(item, 'shared')` (línea 1886)
5. GET con `clean_layer=shared`
6. Backend calcula `visual_state` basado en COMBO (`shared.clean_count + pde.clean_count`) (línea 680)
7. `showFlotanteVer(item, normalized)` agrupa por `student.visual_state`
8. **✅ CORRECTO**: El alumno debería moverse según COMBO total

**Click botón PDE**:
1. `handleLimpiarEstudiante(student, item, 'pde', itemKind)` (línea 1766)
2. POST con `clean_layer='pde'`
3. Backend escribe en `pde_clean_count`
4. **Refetch**: `await handleVerItem(item, 'shared')` (línea 1886)
5. GET con `clean_layer=shared`
6. Backend calcula `visual_state` basado en COMBO (`shared.clean_count + pde.clean_count`) (línea 680)
7. `showFlotanteVer(item, normalized)` agrupa por `student.visual_state`
8. **✅ CORRECTO**: El alumno debería moverse según COMBO total (incluye PDE)

---

## FASE 5 — CONCLUSIÓN: DESFASE DETECTADO

### 5.1 Fuente canónica ACTUAL

**RECURRENTE**:
- **Fuente**: `student.state` calculado por backend
- **Cálculo**: Basado en `clean_layer` del **request** (línea 600)
- **Problema**: Si acción fue PDE pero refetch usa `cleanLayer='shared'`, el estado se calcula basado en `shared`, no en `pde`

**UNA_VEZ**:
- **Fuente**: `student.visual_state` calculado por backend
- **Cálculo**: Basado en COMBO (`shared.clean_count + pde.clean_count`) (línea 680)
- **Estado**: ✅ **CORRECTO** (independiente de `clean_layer` del request)

### 5.2 Fuente que DEBERÍA ser canónica

**RECURRENTE**:
- **Debería**: Calcular estado basado en **ambas capas** (shared Y pde), no solo en la capa del request
- **Alternativa 1**: Calcular estado basado en la capa de la **acción realizada** (no del request)
- **Alternativa 2**: Calcular estado basado en la capa de la **vista actual** (`state.modal.layerView`)
- **Alternativa 3**: Calcular estado basado en **COMBO** (similar a UNA_VEZ)

**UNA_VEZ**:
- **Estado**: ✅ **YA ES CANÓNICO** (basado en COMBO)

### 5.3 Desfase exacto

**RECURRENTE**:

**Escenario problemático**:
1. Alumno tiene `shared.days_since_last_clean = 10` (PENDIENTE)
2. Alumno tiene `pde.days_since_last_clean = 1` (REVISADO)
3. Master hace acción PDE → `pde_last_cleaned_at` se actualiza → `pde.days_since_last_clean = 0`
4. Refetch usa `cleanLayer='shared'` → Backend calcula `state` basado en `shared.days_since_last_clean = 10` → `state = 'pending'`
5. **Resultado**: Alumno queda en columna "PENDIENTE" aunque PDE está REVISADO

**Evidencia en código**:
- Línea 1886: `await handleVerItem(item, 'shared')` (hardcoded, no usa `cleanLayer` de la acción)
- Línea 600: `const layerForState = clean_layer === 'pde' ? 'pde' : 'shared'` (usa `clean_layer` del request, no de la acción)

**UNA_VEZ**:
- **Sin desfase**: El cálculo basado en COMBO garantiza que el estado refleje el progreso total, independientemente de la capa del request.

---

## EVIDENCIAS

### Evidencia 1: Refetch hardcoded a 'shared'

**Archivo**: `public/js/master/master-alquimia-general-client.js`  
**Línea**: 1886

```javascript
// REGLA CONSTITUCIONAL: Refresh determinista post-acción
// NO usar state.modal.layerView para decidir datos
// SIEMPRE hacer refetch completo del flotante desde datos frescos del backend
if (state.modal.item && state.modal.item.item_ref === item.item_ref) {
  // Refetch completo: usar cualquier clean_layer (los datos vienen simétricos)
  // El backend devuelve shared.* y pde.* siempre, independientemente del clean_layer usado en el fetch
  await handleVerItem(item, 'shared'); // ⚠️ HARDCODED a 'shared'
  // layerView se mantiene automáticamente en state.modal.layerView
  // El flotante se re-renderizará con los datos frescos del backend
}
```

**Problema**: El refetch siempre usa `cleanLayer='shared'`, incluso si la acción fue PDE.

### Evidencia 2: Cálculo de estado RECURRENTE depende de clean_layer del request

**Archivo**: `src/services/alquimia-general-service.js`  
**Líneas**: 596-604

```javascript
// REGLA CANÓNICA: Estado RECURRENTE se calcula según clean_layer del request
// Si clean_layer='shared', usar shared.days_since_last_clean
// Si clean_layer='pde', usar pde.days_since_last_clean
// Esto garantiza que el estado refleje la capa que se está visualizando
const layerForState = clean_layer === 'pde' ? 'pde' : 'shared';
const layerDataForState = layerForState === 'pde' ? pdeData : sharedData;
const daysSince = layerDataForState.days_since_last_clean !== undefined 
  ? layerDataForState.days_since_last_clean 
  : (layerForState === 'pde' ? null : (student.days_since_last_clean || null));
```

**Problema**: El estado se calcula según `clean_layer` del **request**, no según la **acción realizada** ni la **vista actual**.

### Evidencia 3: UNA_VEZ usa COMBO (correcto)

**Archivo**: `src/services/alquimia-general-service.js`  
**Líneas**: 677-680

```javascript
// PROYECCIÓN COMBO: calcular total (shared + pde) como proyección backend
const sharedCount = sharedData.clean_count !== null && sharedData.clean_count !== undefined ? parseInt(sharedData.clean_count, 10) : 0;
const pdeCount = pdeData.clean_count !== null && pdeData.clean_count !== undefined ? parseInt(pdeData.clean_count, 10) : 0;
const comboCleanCount = sharedCount + pdeCount;
```

**Estado**: ✅ **CORRECTO** (independiente de `clean_layer` del request)

---

## CONCLUSIÓN FINAL

### Problema identificado

**RECURRENTE**: El estado se calcula basado en `clean_layer` del **request**, no en la **acción realizada** ni en la **vista actual**. Si la acción fue PDE pero el refetch usa `cleanLayer='shared'`, el estado se calcula basado en `shared.days_since_last_clean`, no en `pde.days_since_last_clean`. Esto causa que el alumno no se reubique en la columna correcta tras acciones PDE.

**UNA_VEZ**: ✅ **SIN PROBLEMA**. El estado se calcula basado en COMBO (shared + pde), independientemente del `clean_layer` del request.

### Desfase exacto

**RECURRENTE**:
- **Fuente actual**: `student.state` calculado basado en `clean_layer` del request
- **Fuente debería**: `student.state` calculado basado en la **vista actual** (`state.modal.layerView`) o en **COMBO** (similar a UNA_VEZ)
- **Desfase**: El refetch hardcoded a `'shared'` + cálculo basado en `clean_layer` del request = estado incorrecto tras acciones PDE

**UNA_VEZ**:
- **Sin desfase**: Ya usa COMBO (canónico)

---

## ARCHIVOS REVISADOS

- `public/js/master/master-alquimia-general-client.js` (UI frontend)
- `src/services/alquimia-general-service.js` (servicio backend)
- `src/infra/repos/master-student-transmutation-read-repo-pg.js` (repositorio de lectura)

---

## MÉTODO DE VERIFICACIÓN

1. ✅ Revisión de código fuente (pipeline de columnas)
2. ✅ Trazado de flujo completo (acción → refetch → render)
3. ✅ Identificación de fuente canónica (state / visual_state)
4. ✅ Verificación de cálculo en backend
5. ✅ Detección de desfase (RECURRENTE vs UNA_VEZ)

---

**FIN DEL DIAGNÓSTICO**
