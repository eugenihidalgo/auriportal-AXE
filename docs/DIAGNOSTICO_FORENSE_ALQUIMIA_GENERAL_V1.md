# 🔬 DIAGNÓSTICO FORENSE TOTAL — ALQUIMIA GENERAL (POST UX GOVERNANCE v1)

**Fecha**: 2025-01-XX  
**Contexto**: AuriPortal / Aurelín, dominio MASTER  
**Estado**: UX Action Registry v1 cerrado constitucionalmente  
**Problema**: Alquimia General visualmente rota tras cierre de UX Governance

---

## 📋 RESUMEN EJECUTIVO

Tras el cierre constitucional de UX Governance v1, Alquimia General presenta **fallas críticas** en múltiples capas:

- ❌ **Error de carga**: "UX Action Registry no disponible"
- ❌ **Botones no funcionan**: Acciones lanzan errores
- ❌ **Columnas no cambian**: Al limpiar ítems, alumnos NO cambian de columna
- ❌ **Colores desincronizados**: No reflejan estado real
- ❌ **Flotantes desincronizados**: Datos inconsistentes con listas

**Causa raíz**: Orden de carga de scripts + wiring incompleto entre Action Registry y clientes UI.

---

## FASE 1 — MAPA DE CONCEPTOS (BASE)

### 1.1 Diferencia CANÓNICA entre tipos de ítem

#### **RECURRENTE**
- **Definición**: Se limpia muchas veces (ciclo continuo)
- **Estados**: `reviewed`, `pending`, `important`, `completed`
- **Cálculo de estado**: Depende de `days_since_last_clean` vs `frecuencia_days`
- **Columnas dinámicas**: Cambia de columna según tiempo transcurrido
- **Lógica temporal**: `last_cleaned_at` + `threshold_days` → estado
- **Overrides**: Puede tener `critical_multiplier`, `level_cap`
- **View layers**: `shared`, `pde`, `effective` (proyección calculada)

#### **UNA_VEZ**
- **Definición**: Se limpia una sola vez (estado terminal)
- **Estados**: `pending` → `completed` (terminal)
- **Cálculo de estado**: Binario (completado o no)
- **Columnas estáticas**: Una vez completado, NO vuelve atrás
- **Lógica booleana**: `completed > 0` → `completed`, sino → `pending`
- **View layers**: `shared`, `pde`, `combo` (combinación de ambas capas)

### 1.2 Mezcla de lógicas detectada

⚠️ **VIOLACIÓN DETECTADA**: En `master-alquimia-general-client.js`:

```javascript
// Línea 3024-3114: Botones COMBO mezclan lógica recurrente/una_vez
if (layerView === 'combo') {
  if (itemKind === 'una_vez') {
    // Botones: [S +1] [P +1] [S+P]
  } else {
    // RECURRENTE: botones ✓ (mismo código, diferente texto)
  }
}
```

**Problema**: Mismo handler `handleLimpiarEstudiante()` para ambos tipos, pero:
- **UNA_VEZ**: Debería usar `increment` o `mark-clean` según clean_layer
- **RECURRENTE**: Debería usar `mark-clean` siempre (idempotente)

**Ubicación**: `master-alquimia-general-client.js:3024-3114`

---

## FASE 2 — INVENTARIO DE UI Y BOTONES

### 2.1 Botones en Alquimia General (`master-alquimia-general-client.js`)

#### **Botón: "Crear Lista"** (línea 610-611)
- **Texto UI**: "Crear Lista"
- **Handler**: `handleCrearLista()`
- **Action ID esperado**: `alquimia.create_lista`
- **Estado actual**: ✅ **MIGRADO** a `performAction('alquimia.create_lista')` (línea 1872)
- **Refresh plan**: `['alquimia.listas']`
- **Superficie**: `alquimia.listas` ✅ registrada

#### **Botón: "Crear Item"** (línea 1904)
- **Texto UI**: "Crear Item"
- **Handler**: `handleCrearItem()`
- **Action ID esperado**: `alquimia.create_item`
- **Estado actual**: ✅ **MIGRADO** a `performAction('alquimia.create_item')` (línea 1911)
- **Refresh plan**: `['alquimia.items']`
- **Superficie**: `alquimia.items` ✅ registrada

#### **Botón: "Limpiar para todos" (S/P/S+P)** (línea 2145-2218)
- **Texto UI**: "S +1", "P +1", "S+P" (una_vez) o "S ✓", "P ✓", "S+P" (recurrente)
- **Handler**: `handleLimpiarTodos()` → `performAction('alquimia.clean_all')`
- **Action ID**: `alquimia.clean_all`
- **Estado actual**: ✅ **MIGRADO** a `performAction()` (línea 2167)
- **Refresh plan**: `buildRefreshPlan()` → `['alquimia.list_projection', 'alquimia.items', 'alquimia.flotante_students']`
- **Problema detectado**: ❌ **Acción registrada con `registerAction()` en lugar de `registerActionFn()`** (línea 217 en `alquimia-actions.js`)

#### **Botón: "Limpiar Estudiante" (Flotante)** (línea 3024-3216)
- **Texto UI**: "S +1", "P +1", "S+P" (una_vez) o "S ✓", "P ✓", "S+P" (recurrente)
- **Handler**: `handleLimpiarEstudiante()` → `performAction('alquimia.clean')`
- **Action ID**: `alquimia.clean` (línea 3402)
- **Estado actual**: ✅ **MIGRADO** a `performAction()` (línea 3402)
- **Refresh plan**: `buildRefreshPlan()` → `['alquimia.flotante_students']`
- **Problema detectado**: 
  - ❌ **Fallback a `alquimia.clean.student` (legacy)** si `alquimia.clean` no existe (línea 3398-3400)
  - ❌ **Payload construido manualmente** en lugar de usar `buildPayload()` del handler

#### **Botón: "Reset" (Recurrente)** (línea 1576-1633)
- **Texto UI**: "Reset lista"
- **Handler**: `handleResetLista()` → `performAction('alquimia.reset')`
- **Action ID**: `alquimia.reset`
- **Estado actual**: ✅ **MIGRADO** a `performAction()` (línea 5652)
- **Refresh plan**: `buildRefreshPlan()`
- **Validación**: ✅ Hard fail si `item_kind === 'una_vez'` (línea 158 en `alquimia-actions.js`)

### 2.2 Botones en Alquimia Alumno (`master-alquimia-alumno-client.js`)

#### **Botón: "Limpiar Item" (Megalist)** (línea 1013)
- **Texto UI**: "Limpiar"
- **Handler**: `handleCleanItem()` → `performAction('alquimia.clean_student')`
- **Action ID**: `alquimia.clean_student`
- **Estado actual**: ✅ **MIGRADO** a `performAction()` (línea 1116)
- **Refresh plan**: `['alquimia.megalist']`
- **Superficie**: `alquimia.megalist` ✅ registrada

### 2.3 Resumen de botones

| Botón | Handler | Action ID | Estado | Problema |
|-------|---------|-----------|--------|----------|
| Crear Lista | `handleCrearLista` | `alquimia.create_lista` | ✅ Migrado | Ninguno |
| Crear Item | `handleCrearItem` | `alquimia.create_item` | ✅ Migrado | Ninguno |
| Limpiar Todos | `handleLimpiarTodos` | `alquimia.clean_all` | ✅ Migrado | ❌ `registerAction()` vs `registerActionFn()` |
| Limpiar Estudiante (Flotante) | `handleLimpiarEstudiante` | `alquimia.clean` | ✅ Migrado | ❌ Fallback legacy + payload manual |
| Reset Lista | `handleResetLista` | `alquimia.reset` | ✅ Migrado | Ninguno |
| Limpiar Item (Megalist) | `handleCleanItem` | `alquimia.clean_student` | ✅ Migrado | Ninguno |

---

## FASE 3 — ANÁLISIS DEL ERROR ACTUAL

### 3.1 Error: "UX Action Registry no disponible"

**Mensaje exacto**:
```
[PerformActionV1] UX Action Registry no disponible. Asegúrate de que está cargado antes de performAction.
```

**Ubicación del error**: `perform-action.v1.js:67`

**Análisis del código**:

```javascript
// perform-action.v1.js:56-73
let actionRegistry = window.__AP_UX_ACTION_REGISTRY_CORE__;
let actionDef = null;

if (actionRegistry) {
  actionDef = actionRegistry.get(action_id);
}

// Fallback a registry legacy si no existe en core
if (!actionDef) {
  const legacyRegistry = window.__AP_UX_ACTION_REGISTRY__;
  if (!legacyRegistry) {
    throw new Error('[PerformActionV1] UX Action Registry no disponible...');
  }
  actionDef = legacyRegistry.get(action_id);
}
```

### 3.2 Orden de carga de scripts (master-layout-registry.v1.json)

**Fase "core"** (críticos, se cargan primero):
1. `master-sidebar-client.js` (línea 112-120)
2. `master-theme-resolver.js` (línea 122-130)
3. `master-ui-toast.js` (línea 132-140)
4. `master-refresh-engine-v1.js` (línea 142-150)
5. **`ux-action-registry-loader.js`** (línea 152-160) ⚠️ **CRÍTICO**
6. `ux-action-registry-legacy.js` (línea 162-170) - opcional
7. `refresh-surface-registry.v1.js` (línea 172-180)
8. **`perform-action.v1.js`** (línea 182-190) ⚠️ **CRÍTICO**

**Fase "ui"** (se cargan después):
9. `alquimia-actions-registry.v1.js` (línea 202-210)
10. `alquimia-surfaces-registry.v1.js` (línea 212-220)
11. `master-alquimia-general-client.js` (línea 222-230)

### 3.3 Problema detectado: Race condition

**Causa raíz**:

1. `ux-action-registry-loader.js` carga **async** (línea 8: `(async function() {...})()`)
2. `perform-action.v1.js` se carga **inmediatamente después** (sin esperar)
3. `master-alquimia-general-client.js` se ejecuta **al cargar** (IIFE, línea 19)
4. Si un botón se hace clic **antes de que el loader termine**, `window.__AP_UX_ACTION_REGISTRY_CORE__` es `undefined`

**Evidencia**:

```javascript
// ux-action-registry-loader.js:8-58
(async function() {
  // ... código async ...
  window.__AP_UX_ACTION_REGISTRY_CORE__ = { ... }; // Se asigna DESPUÉS de async
})();

// perform-action.v1.js:56
let actionRegistry = window.__AP_UX_ACTION_REGISTRY_CORE__; // Puede ser undefined si se ejecuta antes
```

**Solución esperada**: El loader debería exponer un evento o promesa que `perform-action.v1.js` espere antes de exponer `window.performAction`.

### 3.4 Verificación de disponibilidad

**Código actual en clientes**:

```javascript
// master-alquimia-general-client.js:2154, 3383, 4846, 4961, 5026, 5653, 5726
if (typeof window.performAction !== 'function') {
  throw new Error('[MasterAlquimiaGeneral] performAction no disponible...');
}
```

**Problema**: Esta verificación ocurre **en runtime** (cuando se hace clic), no en **load time**. Si el loader falla silenciosamente, el error solo aparece al hacer clic.

---

## FASE 4 — PROYECCIONES Y COLUMNAS

### 4.1 Pipeline completo esperado

```
1. Acción UX (performAction)
   ↓
2. Endpoint backend (POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student)
   ↓
3. Mutación real de estado (DB / CleaningEngineService)
   ↓
4. Señales emitidas (student.level.*, student.pde.*)
   ↓
5. Proyección recalculada (CPM v2: computeCleaningProjection)
   ↓
6. Refresh Surface ejecutado (Refresh Engine v2)
   ↓
7. Render UI (re-agrupar items por state_by_view_layer[view_layer])
   ↓
8. Columna visual final (cambia según nuevo estado)
```

### 4.2 Análisis por paso

#### **Paso 1: Acción UX** ✅
- **Ocurre**: Sí
- **Datos**: `action_id`, `payload`, `context`, `uiState`
- **Problema**: Ver FASE 3 (race condition)

#### **Paso 2: Endpoint backend** ❓
- **Ocurre**: Desconocido (requiere verificación en runtime)
- **Endpoint esperado**: `/master/api/alquimia-general/items/:item_ref/master/mark-clean-student`
- **Problema potencial**: Si `alquimia.clean` no está registrado, el endpoint no se construye correctamente

#### **Paso 3: Mutación real de estado** ❓
- **Ocurre**: Desconocido (requiere verificación en runtime)
- **Servicio esperado**: `CleaningEngineService.markCleanStudent()`
- **Problema potencial**: Si el endpoint falla, la mutación no ocurre

#### **Paso 4: Señales emitidas** ❓
- **Ocurre**: Desconocido (requiere verificación en runtime)
- **Señales esperadas**: `student.level.changed`, `student.pde.*`
- **Problema potencial**: Si la mutación falla, no se emiten señales

#### **Paso 5: Proyección recalculada** ❌
- **Ocurre**: **NO** (evidencia: columnas no cambian)
- **CPM esperado**: `computeCleaningProjection()` debería calcular `state_by_view_layer`
- **Problema**: El backend NO está recalculando proyecciones después de mutaciones

#### **Paso 6: Refresh Surface ejecutado** ⚠️
- **Ocurre**: **PARCIALMENTE** (evidencia: flotantes se refrescan, pero con datos viejos)
- **Superficies esperadas**: `alquimia.flotante_students`, `alquimia.items`, `alquimia.list_projection`
- **Problema**: Refresh ejecuta `refetch()`, pero los datos devueltos NO incluyen `state_by_view_layer` actualizado

#### **Paso 7: Render UI** ❌
- **Ocurre**: **NO** (evidencia: columnas no cambian)
- **Agrupación esperada**: Por `state_by_view_layer[view_layer].state`
- **Problema**: UI NO re-agrupa items después de refresh porque `state_by_view_layer` no cambia

#### **Paso 8: Columna visual final** ❌
- **Ocurre**: **NO** (evidencia: alumnos NO cambian de columna)
- **Cálculo esperado**: `state_by_view_layer[view_layer].state` → columna
- **Problema**: Como `state_by_view_layer` no se actualiza, la columna no cambia

### 4.3 Violación de View Authority

**Regla constitucional**:
> "El backend es la ÚNICA autoridad de estado. El frontend NO calcula estados."

**Violación detectada**:
- El backend NO está recalculando `state_by_view_layer` después de mutaciones
- El frontend NO puede re-agrupar items porque `state_by_view_layer` no cambia
- Las columnas NO cambian porque el estado no se actualiza

**Ubicación**: Endpoints POST de limpieza NO recalculan proyecciones antes de devolver respuesta.

---

## FASE 5 — FLOTANTES vs LISTAS

### 5.1 Datos usados por flotantes

**Fuente**: `handleVerItem()` → `GET /master/api/alquimia-general/items/:item_ref/students`

**Datos esperados**:
- `students[]` con `state_by_view_layer.shared`, `.pde`, `.combo`, `.effective`
- `counts` por estado
- `warnings` (pausados, no aplicables)

**Estado actual**: ❓ Desconocido (requiere verificación en runtime)

### 5.2 Datos usados por listas

**Fuente**: `loadListProjection()` → `GET /master/api/alquimia-general/list-projection`

**Datos esperados**:
- `items[]` con `state_by_view_layer` para cada item
- Agrupación por `state_by_view_layer[view_layer].state`

**Estado actual**: ❓ Desconocido (requiere verificación en runtime)

### 5.3 Sincronización esperada

**Regla constitucional**:
> "Una sola proyección canónica decide columnas y colores"

**Problema detectado**:
- Flotantes y listas usan **endpoints diferentes**
- Flotantes: `/master/api/alquimia-general/items/:item_ref/students`
- Listas: `/master/api/alquimia-general/list-projection`
- **NO hay garantía** de que ambos endpoints usen la misma proyección

**Violación**: Flotantes y listas pueden mostrar estados diferentes para el mismo item+student.

### 5.4 Caches locales

**Estado en `master-alquimia-general-client.js`**:
- `state.items[]` (línea 79)
- `state.groups[]` (línea 81)
- `state.modal.item` (línea 97)
- `state.projection.data` (línea 107)

**Problema**: Si el refresh ejecuta `refetch()` pero los datos NO se actualizan en `state`, la UI muestra datos viejos.

---

## FASE 6 — REFRESH ENGINE

### 6.1 Acciones registradas y refresh_plan

| Action ID | Refresh Plan | Superficies Esperadas | Estado |
|-----------|--------------|----------------------|--------|
| `alquimia.clean` | `buildRefreshPlan()` | `alquimia.list_projection`, `alquimia.items`, `alquimia.flotante_students` | ⚠️ Parcial |
| `alquimia.clean_all` | `buildRefreshPlan()` | `alquimia.list_projection`, `alquimia.items`, `alquimia.flotante_students` | ⚠️ Parcial |
| `alquimia.reset` | `buildRefreshPlan()` | `alquimia.list_projection`, `alquimia.items` | ⚠️ Parcial |
| `alquimia.create_lista` | `['alquimia.listas']` | `alquimia.listas` | ✅ OK |
| `alquimia.create_item` | `['alquimia.items']` | `alquimia.items` | ✅ OK |
| `alquimia.clean_student` | `['alquimia.megalist']` | `alquimia.megalist` | ✅ OK |

### 6.2 Superficies registradas

| Surface ID | buildKey | refetch | Estado |
|------------|----------|---------|--------|
| `alquimia.list_projection` | `list_projection:${list_id}:${view_layer}:${scope}` | `loadListProjection()` | ✅ Registrada |
| `alquimia.items` | `items:${list_id}` | `loadItems(list_id)` | ✅ Registrada |
| `alquimia.flotante_students` | `flotante:${item_ref}:${view_layer}:${clean_layer}` | `handleVerItem(item, clean_layer, view_layer)` | ✅ Registrada |
| `alquimia.listas` | `listas:${tipo}` | `loadListas(tipo)` | ✅ Registrada |
| `alquimia.megalist` | `megalist:${student_uuid}:${view_layer}` | `loadMegalist(student_uuid)` | ✅ Registrada |

### 6.3 Problema detectado: buildRefreshPlan() no encuentra superficies

**Código en `alquimia-actions.js:44-69`**:

```javascript
function buildRefreshPlan(context, uiState, responseData = null) {
  const surfaces = [];
  const view_mode = uiState.view_mode || 'operativa';
  const list_id = uiState.list_id || context.list_id;

  // Proyección: siempre refrescar si hay list_id
  if (view_mode === 'proyeccion' && list_id) {
    surfaces.push('alquimia.list_projection');
  }

  // Items: siempre refrescar si hay list_id y modo operativa
  if (view_mode === 'operativa' && list_id) {
    surfaces.push('alquimia.items');
  }

  // Flotante: SIEMPRE refrescar si está abierto e item_ref coincide
  if (context.item_ref) {
    const alquimiaState = typeof window !== 'undefined' && window.__AP_ALQUIMIA_STATE__;
    if (alquimiaState?.modal?.item?.item_ref === context.item_ref) {
      surfaces.push('alquimia.flotante_students');
    }
  }

  return surfaces;
}
```

**Problema**: `buildRefreshPlan()` depende de `window.__AP_ALQUIMIA_STATE__`, pero:
- `master-alquimia-general-client.js` NO expone `state` en `window.__AP_ALQUIMIA_STATE__`
- El refresh NO puede determinar si el flotante está abierto
- La superficie `alquimia.flotante_students` NO se refresca si el estado no está expuesto

**Ubicación**: `alquimia-actions.js:44-69`, `master-alquimia-general-client.js:113-116`

---

## FASE 7 — CONCLUSIÓN FORENSE

### 7.1 Lista numerada de FALLAS

#### **FALLA #1: Race condition en carga de Action Registry**
- **Capa**: Wiring / Load Order
- **Tipo**: Orden de ejecución
- **Gravedad**: **BLOQUEANTE**
- **Descripción**: `ux-action-registry-loader.js` carga async, pero `perform-action.v1.js` no espera. Si un botón se hace clic antes de que el loader termine, `window.__AP_UX_ACTION_REGISTRY_CORE__` es `undefined`.
- **Ubicación**: `ux-action-registry-loader.js:8-58`, `perform-action.v1.js:56-73`
- **Evidencia**: Error "UX Action Registry no disponible" al hacer clic en botones

#### **FALLA #2: Acción `alquimia.clean_all` registrada con función incorrecta**
- **Capa**: Action Registry
- **Tipo**: Contrato
- **Gravedad**: **CRÍTICA**
- **Descripción**: `alquimia.clean_all` usa `registerAction()` en lugar de `registerActionFn()`, causando inconsistencia en el conteo de acciones vs refresh_plans.
- **Ubicación**: `alquimia-actions.js:217`
- **Evidencia**: Assembly check puede fallar si cuenta acciones vs refresh_plans

#### **FALLA #3: Fallback a acción legacy en `handleLimpiarEstudiante`**
- **Capa**: UI / Action Registry
- **Tipo**: Wiring
- **Gravedad**: **CRÍTICA**
- **Descripción**: `handleLimpiarEstudiante()` intenta usar `alquimia.clean`, pero si no existe, hace fallback a `alquimia.clean.student` (legacy). Además, construye payload manualmente en lugar de usar `buildPayload()` del handler.
- **Ubicación**: `master-alquimia-general-client.js:3396-3418`
- **Evidencia**: Código con fallback legacy y payload manual

#### **FALLA #4: Backend NO recalcula proyecciones después de mutaciones**
- **Capa**: Backend / Projection
- **Tipo**: Contrato (View Authority)
- **Gravedad**: **BLOQUEANTE**
- **Descripción**: Endpoints POST de limpieza NO recalculan `state_by_view_layer` después de mutar estado. El frontend recibe datos viejos y NO puede re-agrupar items por columna.
- **Ubicación**: Endpoints POST `/master/api/alquimia-general/items/:item_ref/master/mark-clean-*`
- **Evidencia**: Columnas NO cambian después de limpiar ítems

#### **FALLA #5: Refresh ejecuta refetch pero datos NO se actualizan en state**
- **Capa**: Refresh Engine / UI State
- **Tipo**: Wiring
- **Gravedad**: **CRÍTICA**
- **Descripción**: Refresh Engine ejecuta `refetch()` de superficies, pero los datos devueltos NO se actualizan en `state.items[]`, `state.groups[]`, etc. La UI muestra datos viejos.
- **Ubicación**: `master-alquimia-general-client.js:79-111`, funciones `loadItems()`, `loadListProjection()`
- **Evidencia**: Flotantes y listas muestran estados desincronizados

#### **FALLA #6: `buildRefreshPlan()` depende de `window.__AP_ALQUIMIA_STATE__` que NO existe**
- **Capa**: Refresh Engine / State Exposure
- **Tipo**: Wiring
- **Gravedad**: **CRÍTICA**
- **Descripción**: `buildRefreshPlan()` intenta acceder a `window.__AP_ALQUIMIA_STATE__` para determinar si el flotante está abierto, pero `master-alquimia-general-client.js` NO expone `state` en esa variable global. La superficie `alquimia.flotante_students` NO se refresca.
- **Ubicación**: `alquimia-actions.js:62-66`, `master-alquimia-general-client.js:113-116`
- **Evidencia**: Flotantes NO se refrescan después de mutaciones

#### **FALLA #7: Mezcla de lógica recurrente/una_vez en handlers**
- **Capa**: UI Logic
- **Tipo**: Mezcla de lógica
- **Gravedad**: **VISUAL** (funcional pero incorrecto)
- **Descripción**: `handleLimpiarEstudiante()` usa el mismo código para `recurrente` y `una_vez`, pero deberían tener lógicas diferentes (idempotencia vs increment).
- **Ubicación**: `master-alquimia-general-client.js:3283-3433`
- **Evidencia**: Código unificado para ambos tipos

#### **FALLA #8: Flotantes y listas usan endpoints diferentes sin garantía de sincronización**
- **Capa**: Data Source
- **Tipo**: Contrato (View Authority)
- **Gravedad**: **CRÍTICA**
- **Descripción**: Flotantes usan `/master/api/alquimia-general/items/:item_ref/students` y listas usan `/master/api/alquimia-general/list-projection`. NO hay garantía de que ambos endpoints usen la misma proyección canónica.
- **Ubicación**: `master-alquimia-general-client.js:2230` (flotantes), `loadListProjection()` (listas)
- **Evidencia**: Flotantes y listas pueden mostrar estados diferentes

### 7.2 Resumen por gravedad

**BLOQUEANTES** (2):
- FALLA #1: Race condition en carga de Action Registry
- FALLA #4: Backend NO recalcula proyecciones después de mutaciones

**CRÍTICAS** (4):
- FALLA #2: Acción `alquimia.clean_all` registrada con función incorrecta
- FALLA #3: Fallback a acción legacy en `handleLimpiarEstudiante`
- FALLA #5: Refresh ejecuta refetch pero datos NO se actualizan en state
- FALLA #6: `buildRefreshPlan()` depende de `window.__AP_ALQUIMIA_STATE__` que NO existe
- FALLA #8: Flotantes y listas usan endpoints diferentes sin garantía de sincronización

**VISUALES** (1):
- FALLA #7: Mezcla de lógica recurrente/una_vez en handlers

### 7.3 Orden de corrección recomendado

1. **FALLA #1**: Arreglar race condition (exponer promesa/evento en loader)
2. **FALLA #2**: Cambiar `registerAction()` a `registerActionFn()` en `alquimia.clean_all`
3. **FALLA #3**: Eliminar fallback legacy y usar `buildPayload()` del handler
4. **FALLA #6**: Exponer `state` en `window.__AP_ALQUIMIA_STATE__` o cambiar `buildRefreshPlan()` para no depender de estado global
5. **FALLA #4**: Hacer que endpoints POST recalculen `state_by_view_layer` antes de devolver respuesta
6. **FALLA #5**: Asegurar que `loadItems()`, `loadListProjection()` actualicen `state` correctamente
7. **FALLA #8**: Garantizar que flotantes y listas usen la misma proyección canónica
8. **FALLA #7**: Separar lógica de `recurrente` y `una_vez` en handlers distintos

---

## 📝 NOTAS FINALES

Este diagnóstico es **SOLO FORENSE**. NO se ha implementado ningún fix.

**Próximo paso**: Corrección dirigida, capa por capa, sin romper UX Governance, sin reintroducir legacy, sin mezclar recurrente y una_vez.

**Verificación obligatoria después de fixes**:
- Assembly check: `npm run check:ux-action-registry` → 0 errors / 0 warnings
- Verificar en runtime: Botones funcionan, columnas cambian, colores reflejan estado real
- Verificar sincronización: Flotantes y listas muestran mismos datos

---

**FIN DEL DIAGNÓSTICO FORENSE**
