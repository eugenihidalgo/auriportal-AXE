# 🔬 DIAGNÓSTICO CANÓNICO TOTAL — RESET + REFRESH ENGINE (ALQUIMIA GENERAL)

**Fecha:** 2026-01-27  
**Versión:** v1.0  
**Objetivo:** Entender por qué los RESET (especialmente reset_all) activan modo LEGACY y rompen la coherencia visual

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ REGLAS DEL DIAGNÓSTICO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- ✅ SOLO observación: código real, flujos reales, logs reales
- ✅ Toda afirmación tiene archivo + línea
- ❌ NO fixes, NO refactorización, NO cambios
- ❌ NO asumir intención

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1️⃣ CASO REAL FIJO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Escenario de prueba:**

- Módulo: `alquimia_general`
- Item kind: `recurrente`
- Acciones:
  - `alquimia.clean`
  - `alquimia.clean_all`
  - `alquimia.reset` (scope: ITEM_STUDENT, ITEM_ALL, LIST_STUDENT, LIST_ALL)
- View mode: `proyeccion`
- View layer: `shared` y `effective`
- Alumno ejemplo: `student_uuid: 44a51f8f-4ed5-4291-ad13-5f07a99c636b`
- Lista: Abundancia (`list_id = 11`)
- Item: `te_item_63`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2️⃣ SÍNTOMAS IDENTIFICADOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 2.1 Log LEGACY_REFRESH

**Cuándo aparece:**
```
[REFRESH_ENGINE][ALQG][LEGACY_REFRESH] Sin surfaces declarativas, usando lógica manual
```

**Archivo:** `public/js/master/master-alquimia-general-client.js`  
**Línea:** 6565

**Log previo:**
```javascript
surfaces: 'legacy'  // Si surfaces.length === 0
```

**Archivo:** `public/js/master/master-alquimia-general-client.js`  
**Línea:** 6513

### 2.2 Condición que activa LEGACY

**Archivo:** `public/js/master/master-alquimia-general-client.js`  
**Líneas:** 6524-6562

```javascript
// UX CONTRACT v1: Si hay surfaces declarativas, usar Refresh Surface Registry
if (surfaces.length > 0 && window.__AP_REFRESH_SURFACE_REGISTRY__) {
  // Usar Refresh Surface Registry
  // ...
  return;
}

// LEGACY: Fallback a lógica manual si no hay surfaces declarativas
console.warn('[REFRESH_ENGINE][ALQG][LEGACY_REFRESH] Sin surfaces declarativas, usando lógica manual', {
  mutation_type,
  action_id: context.action_id || null
});
```

**Conclusión:** LEGACY se activa cuando `surfaces.length === 0`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3️⃣ MAPA COMPLETO DEL FLUJO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 3.1 `alquimia.clean`

**Flujo completo:**

1. **UI dispara acción**  
   **Archivo:** `public/js/master/master-alquimia-general-client.js`  
   **Línea:** ~3750 (botón de limpieza individual)

   ```javascript
   await window.performAction({
     action_id: 'alquimia.clean',
     context: { item_ref, clean_layer, ... },
     uiState: { view_mode, view_layer, list_id }
   });
   ```

2. **performAction resuelve refresh_plan**  
   **Archivo:** `src/core/ux/action-registry/perform-action.js`  
   **Líneas:** 198-214

   ```javascript
   // Resolver refresh_plan
   let surfacesToRefresh = [];
   if (typeof action.refresh === 'function') {
     surfacesToRefresh = action.refresh(context, uiState, responseData);
   }
   
   console.log('[REFRESH][PLAN]', {
     surfaces: surfacesToRefresh,  // Array de surface_ids
     ...
   });
   ```

3. **buildRefreshPlan genera surfaces**  
   **Archivo:** `src/core/ux/action-registry/alquimia-actions.js`  
   **Líneas:** 44-73

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

     // Flotante: SIEMPRE refrescar si hay item_ref
     if (context.item_ref) {
       surfaces.push('alquimia.flotante_students');
     }

     return surfaces;
   }
   ```

4. **Refresh Engine v2 procesa surfaces**  
   **Archivo:** `public/js/master/ux/perform-action.v1.js`  
   **Líneas:** 360-374

   ```javascript
   if (typeof refreshEngine.afterMutationV2 === 'function') {
     await refreshEngine.afterMutationV2({
       module: 'alquimia_general',
       mutation_type: action_id,
       action_id: action_id,
       scope: { view_mode, view_layer },
       context: { ...context, surfaces: surfacesToRefresh }
     });
   }
   ```

5. **Adapter procesa surfaces**  
   **Archivo:** `public/js/master/master-alquimia-general-client.js`  
   **Líneas:** 6524-6562

   ```javascript
   if (surfaces.length > 0 && window.__AP_REFRESH_SURFACE_REGISTRY__) {
     // Ejecutar surfaces declarativas
     for (const surface_id of surfaces) {
       await surfaceRegistry.refetch(surface_id, context, uiState);
     }
     return;
   }
   ```

**Resultado esperado:** `surfaces = ['alquimia.list_projection', 'alquimia.flotante_students']` (si `view_mode === 'proyeccion'` y hay `list_id` e `item_ref`)

### 3.2 `alquimia.clean_all`

**Flujo:** IDÉNTICO a `alquimia.clean` (mismo `buildRefreshPlan`)

**Archivo:** `src/core/ux/action-registry/alquimia-actions.js`  
**Línea:** 284 (`alquimia.clean_all` usa `refresh: buildRefreshPlan`)

**Resultado esperado:** Igual que `clean`

### 3.3 `alquimia.reset` (ITEM_STUDENT, ITEM_ALL)

**Flujo:** IDÉNTICO a `alquimia.clean` (mismo `buildRefreshPlan`)

**Archivo:** `src/core/ux/action-registry/alquimia-actions.js`  
**Línea:** 342 (`alquimia.reset` usa `refresh: buildRefreshPlan`)

**UI dispara (Reset ALL):**  
**Archivo:** `public/js/master/master-alquimia-general-client.js`  
**Líneas:** 4758-4792

```javascript
const uiState = {
  view_mode: state.projection.mode,
  view_layer: state.projection.view_layer || 'shared',
  list_id: state.listaActiva?.id || null  // ⚠️ PUEDE SER null
};

await window.performAction({
  action_id: 'alquimia.reset',
  context: {
    reset_scope: 'ITEM_ALL',
    item_ref: item.item_ref,  // ✅ PRESENTE
    clean_layer: cleanLayer,
    item_kind: 'recurrente'
  },
  uiState  // ⚠️ PUEDE TENER list_id === null
});
```

**Resultado:**
- Si `uiState.list_id === null` → `surfaces = ['alquimia.flotante_students']` (solo flotante)
- Si `uiState.list_id === null` y NO hay `item_ref` → `surfaces = []` (VACÍO → LEGACY)

### 3.4 `alquimia.reset` (LIST_STUDENT, LIST_ALL)

**Flujo:** IDÉNTICO a `alquimia.reset` (ITEM_*)

**Problema potencial:** Si `reset_scope === 'LIST_ALL'`, `context.item_ref` puede ser `undefined` (solo hay `list_id` en payload), entonces `buildRefreshPlan` NO añade `alquimia.flotante_students`.

**Archivo:** `src/core/ux/action-registry/alquimia-actions.js`  
**Líneas:** 62-71

```javascript
// Flotante: SIEMPRE refrescar si hay item_ref
if (context.item_ref) {  // ⚠️ LIST_ALL puede NO tener item_ref
  surfaces.push('alquimia.flotante_students');
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4️⃣ SURFACES — ANÁLISIS QUIRÚRGICO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 4.1 Surfaces declaradas por acción

**Archivo:** `src/core/ux/action-registry/alquimia-actions.js`  
**Líneas:** 44-73 (`buildRefreshPlan`)

| Acción | `view_mode` | `list_id` | `item_ref` | Surfaces resultantes |
|--------|-------------|-----------|------------|---------------------|
| `alquimia.clean` | `proyeccion` | ✅ | ✅ | `['alquimia.list_projection', 'alquimia.flotante_students']` |
| `alquimia.clean` | `proyeccion` | ✅ | ❌ | `['alquimia.list_projection']` |
| `alquimia.clean` | `proyeccion` | ❌ | ✅ | `['alquimia.flotante_students']` |
| `alquimia.clean` | `proyeccion` | ❌ | ❌ | `[]` → **LEGACY** |
| `alquimia.clean_all` | `proyeccion` | ✅ | ✅ | `['alquimia.list_projection', 'alquimia.flotante_students']` |
| `alquimia.clean_all` | `proyeccion` | ❌ | ✅ | `['alquimia.flotante_students']` |
| `alquimia.reset` (ITEM_ALL) | `proyeccion` | ✅ | ✅ | `['alquimia.list_projection', 'alquimia.flotante_students']` |
| `alquimia.reset` (ITEM_ALL) | `proyeccion` | ❌ | ✅ | `['alquimia.flotante_students']` |
| `alquimia.reset` (ITEM_ALL) | `proyeccion` | ❌ | ❌ | `[]` → **LEGACY** |
| `alquimia.reset` (LIST_ALL) | `proyeccion` | ✅ | ❌ | `['alquimia.list_projection']` |
| `alquimia.reset` (LIST_ALL) | `proyeccion` | ❌ | ❌ | `[]` → **LEGACY** |

**Conclusión:** `buildRefreshPlan` puede retornar `[]` cuando:
- `view_mode === 'proyeccion'` pero `list_id === null`
- NO hay `item_ref` en `context`

### 4.2 Condición exacta que activa LEGACY

**Archivo:** `public/js/master/master-alquimia-general-client.js`  
**Líneas:** 6507, 6524

```javascript
const surfaces = context.surfaces || [];  // Línea 6507

// Línea 6513: Log
surfaces: surfaces.length > 0 ? surfaces : 'legacy',

// Línea 6524: Condición
if (surfaces.length > 0 && window.__AP_REFRESH_SURFACE_REGISTRY__) {
  // Usar Refresh Surface Registry
} else {
  // Línea 6565: LEGACY
  console.warn('[REFRESH_ENGINE][ALQG][LEGACY_REFRESH] Sin surfaces declarativas, usando lógica manual');
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5️⃣ STATE_BY_VIEW_LAYER — CUÁNDO DESAPARECE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 5.1 Invalidate (antes de refetch)

**Archivo:** `public/js/master/master-alquimia-general-client.js`  
**Líneas:** 6484-6496

```javascript
// Invalidar proyección si la mutación afecta proyección
if (scope.view_mode === 'proyeccion' || state.projection.mode === 'proyeccion') {
  state.projection.data = null;  // ⚠️ Borra state.projection.data
  state.projection.loading = true;
}
```

**Consecuencia:** `state.projection.data = null` → `normalized.students` desaparece → `state_by_view_layer` no está disponible temporalmente.

### 5.2 Refetch (LEGACY)

**Archivo:** `public/js/master/master-alquimia-general-client.js`  
**Líneas:** 6579-6603

```javascript
// LEGACY: Fallback a lógica manual
if (state.projection.mode === 'proyeccion') {
  await loadListProjection();  // Restaura state.projection.data
}
```

**Problema:** Durante el tiempo entre `invalidate` y `loadListProjection()`, `state_by_view_layer` no existe en `state.projection.data`.

### 5.3 Refetch (Surfaces declarativas)

**Archivo:** `public/js/core/ux/refresh-surface-registry.v1.js`  
**Líneas:** 99-134

```javascript
export async function refetchSurface(surface_id, context, uiState) {
  const surface = getRefreshSurface(surface_id);
  await surface.refetch(context, uiState);  // Llama a loadListProjection() vía adapter
}
```

**Conclusión:** Con surfaces declarativas, el refetch es más rápido y `state_by_view_layer` se restaura antes del render.

### 5.4 Por qué desaparece SOLO tras reset

**Hipótesis:** Reset invalida `state.projection.data` igual que clean, PERO:

1. **Si cae en LEGACY**, el refetch manual puede ser más lento o incompleto
2. **Si `surfaces = []`**, NO hay refetch automático de proyección → `state.projection.data` permanece `null` → `state_by_view_layer` no existe
3. **Flotante intenta leer `state_by_view_layer`** antes de que se restaure → fallback a `student.state` o error

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6️⃣ DIFERENCIA CLAVE: CLEAN vs RESET
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 6.1 Comparación estructural

| Aspecto | `alquimia.clean` | `alquimia.reset` |
|---------|------------------|------------------|
| **refresh_plan** | `buildRefreshPlan` | `buildRefreshPlan` (igual) |
| **buildRefreshPlan** | Mismo código | Mismo código |
| **Condiciones surfaces** | `view_mode === 'proyeccion' && list_id` | `view_mode === 'proyeccion' && list_id` (igual) |
| **UI pasa `list_id`** | ✅ `uiState.list_id` (de `state.listaActiva?.id`) | ⚠️ Puede ser `null` si `state.listaActiva?.id === undefined` |

### 6.2 Diferencia crítica: `uiState.list_id`

**Archivo:** `public/js/master/master-alquimia-general-client.js`

**Clean (individual):**  
**Línea:** ~3750 (handler de botón clean individual)

```javascript
const uiState = {
  view_mode: state.projection.mode,
  view_layer: state.projection.view_layer || 'shared',
  list_id: state.listaActiva?.id || null  // ✅ Generalmente presente
};
```

**Reset ALL:**  
**Líneas:** 4766-4770

```javascript
const uiState = {
  view_mode: state.projection.mode,
  view_layer: state.projection.view_layer || 'shared',
  list_id: state.listaActiva?.id || null  // ⚠️ PUEDE SER null
};
```

**Conclusión:** NO hay diferencia en el código, PERO `state.listaActiva?.id` puede ser `undefined` en ciertos momentos durante reset (por invalidación).

### 6.3 Qué hace reset que clean no hace

**NO hay diferencia en Refresh Engine.** Ambos usan el mismo `buildRefreshPlan` y el mismo flujo.

**Diferencia real:** Timing de invalidación. Reset puede invalidar `state.listaActiva` antes de que `buildRefreshPlan` se ejecute, haciendo que `uiState.list_id === null`.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7️⃣ HIPÓTESIS VALIDADAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### ✅ Hipótesis 1: Reset no tiene surfaces declarativas (FALSO)

**Evidencia:**
- `alquimia.reset` usa `refresh: buildRefreshPlan` (línea 342 de `alquimia-actions.js`)
- `buildRefreshPlan` genera surfaces igual que `clean` y `clean_all`

**Conclusión:** Reset SÍ tiene surfaces declarativas, PERO pueden estar vacías si `list_id === null` o `item_ref === undefined`.

### ✅ Hipótesis 2: Reset invalida más de lo que vuelve a refetchear (VERDADERO PARCIAL)

**Evidencia:**
- `invalidate()` borra `state.projection.data` (línea 6486)
- Si `surfaces = []`, NO hay refetch de proyección → `state.projection.data` permanece `null`
- `state_by_view_layer` no existe hasta que `loadListProjection()` se ejecute

**Conclusión:** Si cae en LEGACY (`surfaces = []`), reset invalida pero NO refetchea proyección automáticamente.

### ✅ Hipótesis 3: Reset_all rompe el contrato de scope (FALSO)

**Evidencia:**
- `reset_scope: 'ITEM_ALL'` es válido según `allowed_scopes: ['item', 'list', 'all', 'student']` (línea 336)
- El scope NO afecta `buildRefreshPlan` (solo usa `view_mode`, `list_id`, `item_ref`)

**Conclusión:** El scope es correcto. El problema es que `list_id` puede ser `null`.

### ✅ Hipótesis 4: Refresh Engine v2 no sabe recomponer estado tras reset (FALSO)

**Evidencia:**
- Refresh Engine v2 SÍ sabe recomponer estado (surfaces declarativas funcionan)
- El problema es que `surfaces = []` → NO entra en v2 → cae en LEGACY → refetch manual puede ser incompleto

**Conclusión:** Refresh Engine v2 funciona correctamente si `surfaces.length > 0`.

### ✅ Hipótesis 5: El fallback legacy es correcto pero insuficiente (VERDADERO)

**Evidencia:**
- LEGACY ejecuta `loadListProjection()` si `view_mode === 'proyeccion'` (línea 6586)
- PERO: Si `state.listaActiva?.id === undefined`, `loadListProjection()` puede fallar o ser incompleto

**Conclusión:** LEGACY intenta refetchear, pero puede fallar si el contexto (`list_id`) no está disponible.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8️⃣ PUNTO EXACTO DE FALLO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 8.1 Punto 1: `buildRefreshPlan` retorna `[]`

**Archivo:** `src/core/ux/action-registry/alquimia-actions.js`  
**Líneas:** 44-73

**Condición:** `view_mode === 'proyeccion'` pero `list_id === null` Y `item_ref === undefined`

**Resultado:** `surfaces = []`

### 8.2 Punto 2: Refresh Engine detecta `surfaces = []`

**Archivo:** `public/js/master/master-alquimia-general-client.js`  
**Líneas:** 6507, 6524, 6565

**Condición:** `surfaces.length === 0`

**Resultado:** Cae en LEGACY (línea 6565)

### 8.3 Punto 3: LEGACY intenta refetch pero contexto incompleto

**Archivo:** `public/js/master/master-alquimia-general-client.js`  
**Líneas:** 6579-6591

```javascript
if (state.projection.mode === 'proyeccion') {
  await loadListProjection();  // ⚠️ Usa state.listaActiva?.id internamente
}
```

**Problema:** Si `state.listaActiva?.id === undefined`, `loadListProjection()` puede no refetchear correctamente.

### 8.4 Punto 4: `state_by_view_layer` no existe durante render

**Archivo:** `public/js/master/master-alquimia-general-client.js`  
**Líneas:** 2774-2795

```javascript
if (student.state_by_view_layer && student.state_by_view_layer[activeViewLayer]) {
  stateData = student.state_by_view_layer[activeViewLayer];
} else {
  // Fallback a student.state (fix reciente v5.77.3)
}
```

**Conclusión:** Si `state.projection.data === null` o está incompleto, `state_by_view_layer` no existe → fallback a `student.state` o error.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9️⃣ RESUMEN EJECUTIVO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 9.1 Causa raíz

**`buildRefreshPlan` retorna `surfaces = []` cuando:**

1. `view_mode === 'proyeccion'` pero `uiState.list_id === null`
2. `context.item_ref === undefined` (para LIST_ALL o casos edge)

### 9.2 Efecto en cadena

1. `surfaces = []` → Refresh Engine detecta → cae en LEGACY
2. LEGACY ejecuta `loadListProjection()` pero puede fallar si `state.listaActiva?.id === undefined`
3. `state.projection.data` permanece `null` o incompleto
4. `state_by_view_layer` no existe durante render
5. Frontend usa fallback a `student.state` o muestra error

### 9.3 Por qué ocurre SOLO con reset

**NO es que reset sea diferente**, sino que:

- Reset puede ejecutarse en momentos donde `state.listaActiva?.id === undefined` (timing de invalidación)
- Reset ALL puede no tener `item_ref` en `context` si es LIST_ALL
- La combinación de `list_id === null` + `item_ref === undefined` → `surfaces = []` → LEGACY

### 9.4 Diferencias estructurales

| Aspecto | Clean | Reset |
|---------|-------|-------|
| **refresh_plan** | `buildRefreshPlan` | `buildRefreshPlan` (igual) |
| **Condiciones** | Mismas | Mismas |
| **Timing `list_id`** | Generalmente presente | Puede ser `null` (timing) |
| **`item_ref` en LIST_*** | No aplica | Puede faltar (LIST_ALL) |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔟 ARCHIVOS Y LÍNEAS CLAVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 10.1 buildRefreshPlan

**Archivo:** `src/core/ux/action-registry/alquimia-actions.js`  
**Líneas:** 44-73

**Punto de fallo:** Retorna `[]` si `view_mode === 'proyeccion' && !list_id` y `!item_ref`

### 10.2 Condición LEGACY

**Archivo:** `public/js/master/master-alquimia-general-client.js`  
**Líneas:** 6524, 6565

**Punto de fallo:** `surfaces.length === 0` → cae en LEGACY

### 10.3 Invalidate

**Archivo:** `public/js/master/master-alquimia-general-client.js`  
**Líneas:** 6484-6496

**Punto de fallo:** Borra `state.projection.data` → `state_by_view_layer` desaparece temporalmente

### 10.4 Refetch LEGACY

**Archivo:** `public/js/master/master-alquimia-general-client.js`  
**Líneas:** 6579-6591

**Punto de fallo:** `loadListProjection()` puede fallar si `state.listaActiva?.id === undefined`

### 10.5 Render con state_by_view_layer faltante

**Archivo:** `public/js/master/master-alquimia-general-client.js`  
**Líneas:** 2774-2795

**Punto de fallo:** Si `state_by_view_layer` no existe, usa fallback a `student.state` (fix v5.77.3)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIN DEL DIAGNÓSTICO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Conclusión final:** El problema NO es que reset sea diferente estructuralmente, sino que `buildRefreshPlan` puede retornar `surfaces = []` cuando `list_id === null` o `item_ref === undefined`, causando que el Refresh Engine caiga en LEGACY, que puede no refetchear correctamente si el contexto (`list_id`) no está disponible.
