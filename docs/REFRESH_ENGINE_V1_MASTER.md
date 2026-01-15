# REFRESH ENGINE V1 — MASTER (AuriPortal)

**Versión:** 1.0.0  
**Fecha:** 2025-01-27  
**Commit:** `934021a`  
**Estado:** ✅ Implementado y activo

---

## 1. PROPÓSITO Y ALCANCE

**Refresh Engine v1** es el sistema canónico que garantiza **1 mutación = 1 refresh = 1 render** en el dominio MASTER de AuriPortal.

### Alcance

- **Dominio:** MASTER únicamente (`/master/*`)
- **NO aplica a:** ADMIN, CLIENT, GOD
- **Objetivo:** Eliminar doble render, refresh condicionado por modo, y loaders que renderizan por efecto colateral

### Problema que Resuelve

Antes de Refresh Engine v1:
- `loadListProjection()` llamaba a `renderView()` internamente (efecto colateral)
- `refreshAfterProjectionMutation()` también llamaba a `renderView()` después de `loadListProjection()`
- **Resultado:** Doble render en cada mutación
- Refresh condicionado por modo (si no estás en proyección, no refresca nada)

Después de Refresh Engine v1:
- Loaders son **puros** (solo cargan datos, NO renderizan)
- Refresh Engine orquesta: invalidate → refetch → render (una vez cada uno)
- Guard de token previene doble render
- Funciona en cualquier modo (operativa/proyección)

---

## 2. DEFINICIONES

### Mutación

Cualquier acción que cambia estado en backend (POST/PUT/DELETE):
- Limpiar item/estudiante
- Reset progreso
- Crear/actualizar/eliminar entidades
- Cualquier cambio que requiera refrescar UI

### Refresh

Proceso completo post-mutación:
1. **Invalidar:** Limpiar state local que quedó obsoleto
2. **Refetch:** Cargar datos frescos desde backend
3. **Render:** Actualizar DOM con datos frescos

### Render

Función que actualiza el DOM basándose en state actual:
- `renderView()` en Alquimia General
- `renderMegalist()` en Alquimia Alumno
- `renderLugaresActivos()` en Lugares
- etc.

**REGLA CONSTITUCIONAL:** Render NO debe calcular estados, solo mostrar lo que viene del backend.

### Loader

Función que carga datos desde backend y actualiza state:
- `loadListProjection()` — carga proyección
- `loadItems()` — carga items
- `loadMegalist()` — carga megalist
- etc.

**REGLA CONSTITUCIONAL:** Loader NO debe llamar a render por efecto colateral. Debe ser **puro** (solo carga datos).

---

## 3. PRINCIPIOS CONSTITUCIONALES

### 3.1. Backend es Source of Truth

**REGLA ABSOLUTA:** El backend es la única autoridad de estado. El frontend NO calcula estados.

- Frontend consume `state_by_view_layer[view_layer]` directamente
- NO se calcula `days_since_last_clean` en frontend
- NO se compara con `threshold_days` en frontend
- NO se infiere estado desde campos raw

**Evidencia en código:**
- `master-alquimia-general-client.js` usa `state_by_view_layer` directamente
- No hay funciones que calculen estado en frontend

### 3.2. 1 Mutación = 1 Refresh = 1 Render

**REGLA ABSOLUTA:** Cada mutación debe resultar en exactamente 1 refresh y 1 render.

**Implementación:**
- Refresh Engine ejecuta: `invalidate()` → `refetch()` → `render()` (una vez cada uno)
- Guard de token previene doble render
- Si se intenta renderizar 2 veces con el mismo token → log warning y NO renderiza

**Evidencia en código:**
```javascript
// master-refresh-engine-v1.js
let renderTokenCounter = 0;
let lastRenderToken = null;

// En afterMutation():
const currentToken = renderTokenCounter++;
lastRenderToken = currentToken;

// En render():
if (lastRenderToken === currentToken) {
  moduleAdapter.render(mutation);
} else {
  console.warn('[REFRESH_ENGINE][RENDER_SKIPPED]', { reason: 'Token desactualizado' });
}
```

### 3.3. Prohibición: Loaders → Render Colateral

**REGLA ABSOLUTA:** Los loaders NO deben llamar a render por efecto colateral.

**Antes (VIOLACIÓN):**
```javascript
async function loadListProjection() {
  // ... fetch ...
  state.projection.data = result.data;
  renderView(); // ❌ Efecto colateral
}
```

**Después (CORRECTO):**
```javascript
async function loadListProjection() {
  // ... fetch ...
  state.projection.data = result.data;
  return result.data; // ✅ Loader puro, retorna datos
  // NO llama renderView()
}
```

**Evidencia en código:**
- `loadListProjection()` refactorizado (línea 1390-1453 de `master-alquimia-general-client.js`)
- Comentario explícito: "REFACTOR v1: Loader PURO - NO llama a renderView() por efecto colateral"

### 3.4. Prohibición: Refresh Condicionado por Modo

**REGLA ABSOLUTA:** El refresh NO debe estar condicionado por el modo actual (operativa/proyección).

**Antes (VIOLACIÓN):**
```javascript
async function refreshAfterProjectionMutation() {
  if (state.projection?.mode !== 'proyeccion') {
    return; // ❌ No refresca si no estás en proyección
  }
  // ...
}
```

**Después (CORRECTO):**
```javascript
// Refresh Engine siempre refresca, independientemente del modo
// El adapter decide qué refetch hacer según el modo actual
async refetch(mutation) {
  if (state.projection.mode === 'proyeccion') {
    await loadListProjection();
  } else if (state.projection.mode === 'operativa') {
    await loadItems(state.listaActiva.id);
  }
}
```

**Evidencia en código:**
- `AlquimiaGeneralRefreshAdapter.refetch()` (línea ~5670) decide qué refetch según modo
- NO hay guard temprano que retorne sin hacer nada

---

## 4. CONTRATO DEL ENGINE

### 4.1. API: `afterMutation()`

**Ubicación:** `window.MasterRefreshEngineV1.afterMutation()`

**Firma:**
```javascript
await engine.afterMutation({
  module: 'alquimia_general',        // Nombre del módulo (debe estar registrado)
  mutation_type: 'alquimia.clean.student', // Tipo de mutación
  scope: {                            // Scope de la mutación (opcional)
    view_mode: 'proyeccion',          // 'operativa' | 'proyeccion'
    view_layer: 'shared'             // 'shared' | 'pde' | 'combo' | 'effective'
  },
  context: {                          // Contexto adicional (opcional)
    item_ref: 'item_123',
    student_uuid: 'uuid-...',
    clean_layer: 'shared',
    item_kind: 'recurrente'
  }
});
```

**Flujo Interno:**
1. Genera token único para esta mutación
2. Ejecuta `adapter.invalidate(mutation)`
3. Ejecuta `await adapter.refetch(mutation)`
4. Ejecuta `await adapter.refreshModal(mutation)` (si existe)
5. Ejecuta `adapter.render(mutation)` (con guard de token)

**Evidencia en código:**
- `master-refresh-engine-v1.js` líneas 80-150

### 4.2. ModuleAdapter

**Contrato Obligatorio:**

Cada módulo debe registrar un adapter con estas funciones:

```javascript
const MyModuleRefreshAdapter = {
  // OBLIGATORIO: Invalida state local
  invalidate(mutation) {
    // Limpiar state que quedó obsoleto
    state.someData = null;
  },
  
  // OBLIGATORIO: Refetch datos frescos
  async refetch(mutation) {
    // Cargar datos desde backend
    await loadSomeData();
  },
  
  // OBLIGATORIO: Render final único
  render(mutation) {
    // Actualizar DOM
    renderView();
  },
  
  // OPCIONAL: Refresh modal si está abierto
  async refreshModal(mutation) {
    if (state.modal?.item && mutation.context.item_ref) {
      await handleVerItem(state.modal.item);
    }
  }
};
```

**Registro:**
```javascript
// En boot() o init() del módulo
if (window.MasterRefreshEngineV1) {
  window.MasterRefreshEngineV1.registerModule('my_module', MyModuleRefreshAdapter);
}
```

**Evidencia en código:**
- `AlquimiaGeneralRefreshAdapter` (línea ~5650 de `master-alquimia-general-client.js`)
- Registro en `boot()` (línea ~5713)

### 4.3. Render Token Guard

**Propósito:** Prevenir doble render si se intenta renderizar 2 veces con el mismo token.

**Implementación:**
- Contador incremental: `renderTokenCounter++`
- Token por mutación: `const currentToken = renderTokenCounter++`
- Guard en render: Solo renderiza si `lastRenderToken === currentToken`

**Evidencia en código:**
```javascript
// master-refresh-engine-v1.js líneas 45-50
let renderTokenCounter = 0;
let lastRenderToken = null;

// Línea 95
const currentToken = renderTokenCounter++;
lastRenderToken = currentToken;

// Línea 130-140
if (lastRenderToken === currentToken) {
  moduleAdapter.render(mutation);
} else {
  console.warn('[REFRESH_ENGINE][RENDER_SKIPPED]', { reason: 'Token desactualizado' });
}
```

### 4.4. Logs Forenses

**Prefijos Canónicos:**
- `[REFRESH_ENGINE][MASTER]` — Logs del engine
- `[REFRESH_ENGINE][ALQUIMIA_GENERAL]` — Logs del adapter

**Logs Obligatorios:**
1. `[REFRESH_ENGINE][MASTER][AFTER_MUTATION]` — Inicio de mutación
2. `[REFRESH_ENGINE][MASTER][INVALIDATE]` — Invalidación
3. `[REFRESH_ENGINE][MASTER][REFETCH]` — Refetch
4. `[REFRESH_ENGINE][MASTER][REFRESH_MODAL]` — Refresh modal (si aplica)
5. `[REFRESH_ENGINE][MASTER][RENDER]` — Render final
6. `[REFRESH_ENGINE][MASTER][AFTER_MUTATION_COMPLETE]` — Fin exitoso
7. `[REFRESH_ENGINE][MASTER][AFTER_MUTATION_ERROR]` — Error

**Evidencia en código:**
- `master-refresh-engine-v1.js` líneas 100-160
- `master-alquimia-general-client.js` línea ~220 (log en `renderView()` con token)

---

## 5. INTEGRACIÓN ACTUAL (AS-IS)

### 5.1. Alquimia General — Migrado ✅

**Handlers Migrados:**
1. `handleLimpiarEstudiante()` — Línea ~3222
   - Mutation type: `'alquimia.clean.student'`
   - Endpoint: `POST /items/:item_ref/master/mark-clean-student`

2. `handleLimpiarItem()` — Línea ~2038
   - Mutation type: `'alquimia.clean.all'`
   - Endpoint: `POST /items/:item_ref/master/mark-clean-all`

3. `resetStudentItemProgress()` — Línea ~5568
   - Mutation type: `'alquimia.reset.item'`
   - Endpoint: `POST /reset-item`

4. `resetStudentListProgress()` — Línea ~5611
   - Mutation type: `'alquimia.reset.list'`
   - Endpoint: `POST /reset-list`

**Adapter Registrado:**
- `AlquimiaGeneralRefreshAdapter` (línea ~5650)
- Registrado en `boot()` (línea ~5713)

**Loaders Puros:**
- ✅ `loadListProjection()` — Refactorizado (línea 1390-1453)
  - NO llama a `renderView()` internamente
  - Retorna datos o `null`
  - Render explícito después de `loadListProjection()` en contextos no-engine

**Handlers NO Migrados Aún:**
- `handleCreateLista()` — NO CONSTA
- `handleUpdateLista()` — NO CONSTA
- `handleDeleteLista()` — NO CONSTA
- `handleCreateItem()` — NO CONSTA
- `handleUpdateItem()` — NO CONSTA
- `handleDeleteItem()` — NO CONSTA
- `handleIncrementAllItem()` — NO CONSTA

**Función Deprecada:**
- `refreshAfterProjectionMutation()` — Línea 1331
  - Marcada como DEPRECATED
  - Mantenida como fallback si engine no está disponible
  - Log warning: "refreshAfterProjectionMutation() es DEPRECATED. Usar Refresh Engine v1."

### 5.2. Otros Módulos — NO Migrados Aún

- **Alquimia Alumno:** NO migrado
- **Lugares:** NO migrado
- **Proyectos:** NO migrado
- **Apadrinados:** NO migrado

---

## 6. CHECKLIST DE VERIFICACIÓN (SMOKE TESTS)

### Test 1: Modo Operativa — Limpiar Item (Flotante ALL)

**Pasos:**
1. Ir a `/master/templo-luz/alquimia-general`
2. Seleccionar tipo "Recurrente" o "Una Vez"
3. Seleccionar una lista
4. Abrir flotante de un item (botón "VER")
5. En el flotante, hacer clic en "Limpiar" (SHARED o PDE)

**Verificar:**
- ✅ Toast de éxito aparece
- ✅ El estado del item cambia inmediatamente en el flotante
- ✅ La columna del item en la tabla principal se actualiza
- ✅ No hay doble render (verificar logs: solo 1 `[REFRESH_ENGINE][RENDER]`)

**Logs Esperados:**
```
[REFRESH_ENGINE][MASTER][AFTER_MUTATION] { module: 'alquimia_general', mutation_type: 'alquimia.clean.student', ... }
[REFRESH_ENGINE][MASTER][INVALIDATE] ...
[REFRESH_ENGINE][MASTER][REFETCH] ...
[REFRESH_ENGINE][MASTER][RENDER] { render_token: X }
```

### Test 2: Modo Proyección Alumno — Limpiar Item

**Pasos:**
1. Ir a `/master/templo-luz/alquimia-general`
2. Cambiar a tab "Proyección"
3. Seleccionar scope "Alumno"
4. Seleccionar un alumno del selector
5. En la proyección, hacer clic en botón de limpieza (SHARED/PDE) de un item

**Verificar:**
- ✅ Toast de éxito aparece
- ✅ El item se mueve inmediatamente a la columna "REVISADO" (verde)
- ✅ La métrica "reviewed_pct" se actualiza
- ✅ No hay doble render

### Test 3: Reset Item

**Pasos:**
1. En modo proyección con alumno seleccionado
2. Abrir modal de un item (botón "VER")
3. Hacer clic en "Reset Progreso"

**Verificar:**
- ✅ Toast de éxito
- ✅ El item vuelve a estado "PENDIENTE" o "NUNCA" según cálculo backend
- ✅ La proyección se actualiza inmediatamente
- ✅ No hay doble render

### Test 4: Reset Lista

**Pasos:**
1. En modo proyección con alumno seleccionado
2. Hacer clic en "Reset Lista" (si está visible)

**Verificar:**
- ✅ Toast de éxito
- ✅ Todos los items de la lista vuelven a estado inicial
- ✅ La proyección se actualiza inmediatamente

### Test 5: Cambiar de Lista Tras Mutación

**Pasos:**
1. Limpiar un item en lista A
2. Cambiar a lista B
3. Volver a lista A

**Verificar:**
- ✅ El estado del item limpiado se mantiene correcto
- ✅ No hay datos "viejos" o desincronizados

### Test 6: Modal Abierto Durante Mutación

**Pasos:**
1. Abrir modal de un item
2. Limpiar ese mismo item desde el flotante (no desde el modal)
3. Verificar Network tab

**Verificar:**
- ✅ El modal se refresca automáticamente con datos actualizados
- ✅ No hay doble fetch (solo 1 fetch a `/items/:item_ref/students`)
- ✅ El estado en el modal coincide con el estado en la proyección

### Verificación de Logs Forenses

En la consola del navegador, buscar:
- ✅ `[REFRESH_ENGINE][MASTER][AFTER_MUTATION]` — debe aparecer 1 vez por mutación
- ✅ `[REFRESH_ENGINE][MASTER][RENDER]` — debe aparecer 1 vez por mutación (no 2)
- ✅ `[REFRESH_ENGINE][ALQUIMIA_GENERAL][RENDER_VIEW]` — debe incluir `render_token`
- ❌ NO debe aparecer `[REFRESH_ENGINE][RENDER_SKIPPED]` (indica problema de token)

---

## 7. REGLAS PARA FUTURAS PÁGINAS MASTER

### 7.1. Cómo Registrar Adapter del Módulo

**Paso 1:** Crear adapter con funciones obligatorias

```javascript
const MyModuleRefreshAdapter = {
  invalidate(mutation) {
    // Limpiar state obsoleto
  },
  async refetch(mutation) {
    // Cargar datos frescos
  },
  render(mutation) {
    // Render final único
  },
  // Opcional:
  async refreshModal(mutation) {
    // Refresh modal si está abierto
  }
};
```

**Paso 2:** Registrar en `boot()` o `init()`

```javascript
function boot() {
  if (window.MasterRefreshEngineV1) {
    window.MasterRefreshEngineV1.registerModule('my_module', MyModuleRefreshAdapter);
  }
  // ... resto de init ...
}
```

**Evidencia:** `master-alquimia-general-client.js` línea ~5713

### 7.2. Cómo Migrar Handlers Mutadores

**Antes (INCORRECTO):**
```javascript
async function handleMyAction() {
  const response = await fetch('/master/api/my-endpoint', { method: 'POST' });
  const result = await response.json();
  showToastSuccess('Éxito');
  
  // ❌ Refresh manual
  await loadMyData();
  renderMyView();
}
```

**Después (CORRECTO):**
```javascript
async function handleMyAction() {
  const response = await fetch('/master/api/my-endpoint', { method: 'POST' });
  const result = await response.json();
  showToastSuccess('Éxito');
  
  // ✅ Usar Refresh Engine
  if (window.MasterRefreshEngineV1) {
    await window.MasterRefreshEngineV1.afterMutation({
      module: 'my_module',
      mutation_type: 'my.action',
      scope: {
        view_mode: state.viewMode,
        view_layer: state.viewLayer
      },
      context: {
        // Datos relevantes para el adapter
      }
    });
  } else {
    // Fallback si engine no está disponible
    await loadMyData();
    renderMyView();
  }
}
```

**Evidencia:** `master-alquimia-general-client.js` línea ~3357 (handleLimpiarEstudiante)

### 7.3. Qué Está Prohibido

**PROHIBIDO:**
1. ❌ Loaders que llaman a render por efecto colateral
   ```javascript
   async function loadData() {
     await fetch(...);
     renderView(); // ❌ PROHIBIDO
   }
   ```

2. ❌ Refresh condicionado por modo
   ```javascript
   async function refresh() {
     if (state.mode !== 'proyeccion') {
       return; // ❌ PROHIBIDO
     }
     // ...
   }
   ```

3. ❌ Doble render después de mutación
   ```javascript
   await loadData();
   renderView(); // ❌ Si loadData() ya renderiza, esto es doble render
   ```

4. ❌ Llamar `refreshAfterProjectionMutation()` en código nuevo
   ```javascript
   await refreshAfterProjectionMutation({ ... }); // ❌ DEPRECATED
   ```

**PERMITIDO:**
1. ✅ Loaders puros (solo cargan datos)
   ```javascript
   async function loadData() {
     const data = await fetch(...);
     state.data = data;
     return data; // ✅ OK
   }
   ```

2. ✅ Render explícito después de load (en contextos no-engine)
   ```javascript
   await loadData();
   renderView(); // ✅ OK si loadData() NO renderiza
   ```

3. ✅ Usar Refresh Engine para mutaciones
   ```javascript
   await engine.afterMutation({ ... }); // ✅ OK
   ```

---

## 8. ASSEMBLY CHECK FUTURE WORK

### 8.1. Invariantes a Automatizar

**NO IMPLEMENTADO AÚN** — Futuro trabajo:

1. **Detectar Loaders que Llaman Render**
   - Buscar funciones `async function load*()` que contengan `render*()`
   - Verificar que no hay `renderView()` o similar dentro de loaders
   - **Script propuesto:** `scripts/check-loaders-no-render.js`

2. **Verificar Adapters Registrados**
   - Verificar que todos los módulos con handlers mutadores tienen adapter registrado
   - Verificar que adapter tiene funciones obligatorias (invalidate/refetch/render)
   - **Script propuesto:** `scripts/check-refresh-engine-adapters.js`

3. **Detectar Refresh Condicionado**
   - Buscar funciones que retornen temprano basándose en `state.mode` o similar
   - **Script propuesto:** `scripts/check-refresh-conditional.js`

4. **Verificar Doble Render**
   - Detectar llamadas a `renderView()` después de `loadListProjection()` o similar
   - **Script propuesto:** `scripts/check-double-render.js`

### 8.2. Cómo Detectar Loaders que Llaman Render

**Estrategia:**
1. Buscar funciones que coincidan con patrón `async function load*()`
2. Dentro de esas funciones, buscar llamadas a `render*()`
3. Reportar violaciones

**Ejemplo de detección:**
```javascript
// Buscar en código:
const loaderPattern = /async function load\w+\(/g;
const renderPattern = /render\w+\(/g;

// Si una función load* contiene render*, es violación
```

**Evidencia de violación histórica:**
- `loadListProjection()` antes tenía `renderView()` en línea 1441 (eliminado en refactor)

---

## 9. HISTORIAL

### Commit `934021a` (2025-01-27)

**Mensaje:**
```
feat(master): refresh engine v1 + fix alquimia refresh determinism
```

**Cambios:**
- ✅ Added MasterRefreshEngineV1 skeleton (`public/js/master/master-refresh-engine-v1.js`)
- ✅ Refactored `loadListProjection()` to be pure loader (no render side effects)
- ✅ Migrated Alquimia General mutations to `engine.afterMutation()`
- ✅ Removed double render after projection fetch
- ✅ Added forensic logs + render token guard
- ✅ Registered Refresh Engine in `master-layout-registry.v1.json`
- ✅ Created `AlquimiaGeneralRefreshAdapter` with invalidate/refetch/render/refreshModal
- ✅ Migrated handlers: `handleLimpiarEstudiante`, `handleLimpiarItem`, `resetStudentItemProgress`, `resetStudentListProgress`
- ✅ Added explicit `renderView()` calls after `loadListProjection()` in non-engine contexts
- ✅ Deprecated `refreshAfterProjectionMutation()` (kept as fallback)

**Archivos Modificados:**
- `public/js/master/master-refresh-engine-v1.js` (nuevo)
- `public/js/master/master-alquimia-general-client.js` (modificado)
- `src/core/master/registry/master-layout-registry.v1.json` (modificado)
- `docs/DIAGNOSTICO_REFRESH_RERENDER_MASTER_V1.md` (nuevo)

---

## 10. REFERENCIAS

- **Diagnóstico Forense:** `docs/DIAGNOSTICO_REFRESH_RERENDER_MASTER_V1.md`
- **Implementación Engine:** `public/js/master/master-refresh-engine-v1.js`
- **Adapter Alquimia General:** `public/js/master/master-alquimia-general-client.js` (línea ~5650)
- **Registry Layout:** `src/core/master/registry/master-layout-registry.v1.json`

---

**FIN DEL DOCUMENTO**
