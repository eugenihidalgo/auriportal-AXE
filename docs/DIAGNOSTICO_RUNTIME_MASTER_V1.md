# 🔬 DIAGNÓSTICO FORENSE RUNTIME MASTER v1 - AuriPortal

**Fecha**: 2025-01-XX  
**Contexto**: AuriPortal / Aurelín, dominio MASTER  
**Estado**: Post UX Governance Closure v1  
**Objetivo**: Mapear runtime real, identificar gaps, preparar para GOD/no-code

---

## 📋 RESUMEN EJECUTIVO

El runtime de AuriPortal MASTER está **parcialmente implementado** con arquitectura registry-driven, pero presenta **race conditions críticas** y **dependencias no explícitas** que impiden garantizar determinismo completo.

**Estado actual**:
- ✅ Registry-driven architecture implementada
- ✅ UX Action Registry como única puerta de intención
- ⚠️ Race conditions en carga de scripts
- ⚠️ Dependencias implícitas entre componentes
- ❌ Error recurrente: "UX Action Registry no disponible"
- ⚠️ Falta contrato formal de runtime para GOD/no-code

**Conclusión**: El runtime existe pero **NO es determinista** en el estado actual. Requiere correcciones de orden de carga y formalización de contratos antes de avanzar a GOD.

---

## 1️⃣ INVENTARIO REAL DE RUNTIME

### Tabla de Componentes

| Componente | Rol | Runtime / No | Dominio | Estado |
|----------|-----|-------------|---------|--------|
| `client-state-reset.js` | Limpia estado persistente antes de carga | ✅ Runtime | MASTER/GOD/ADMIN | ✅ Activo |
| `master-script-loader.js` | Carga scripts desde contrato (master-layout-registry.v1.json) | ✅ Runtime | MASTER | ✅ Activo |
| `ux-action-registry-loader.js` | Carga registry core y expone `__AP_UX_ACTION_REGISTRY_CORE__` | ✅ Runtime | MASTER/GOD | ⚠️ Race condition |
| `ux-action-registry.js` | Registry core (Map de acciones) | ✅ Runtime | MASTER/GOD | ✅ Activo |
| `perform-action.v1.js` | Wrapper canónico para ejecutar acciones | ✅ Runtime | MASTER/GOD | ⚠️ Depende de loader |
| `refresh-surface-registry.v1.js` | Registry de superficies de refresh | ✅ Runtime | MASTER/GOD | ✅ Activo |
| `refresh-engine-v1.js` | Engine que orquesta invalidate + refetch + render | ✅ Runtime | MASTER | ✅ Activo |
| `refresh-engine-v2-adapter.js` | Adapter que extiende v1 con surfaces declarativas | ✅ Runtime | MASTER | ✅ Activo |
| `alquimia-actions-registry.v1.js` | Registra acciones de Alquimia en Action Registry | ✅ Runtime | MASTER | ⚠️ Depende de loader |
| `alquimia-surfaces-registry.v1.js` | Registra surfaces de Alquimia en Surface Registry | ✅ Runtime | MASTER | ⚠️ Depende de loader |
| `master-alquimia-general-client.js` | Cliente UI que expone funciones y state | ✅ Runtime | MASTER | ⚠️ Depende de registries |
| `master-layout-registry.v1.json` | Contrato declarativo de scripts y orden | ✅ Runtime | MASTER | ✅ Activo |
| `inject_master.js` | Entry point que carga reset + loader | ✅ Runtime | MASTER | ✅ Activo |

### Componentes que Deciden Acciones

**ÚNICO DECISOR**: `ux-action-registry.js` (registry core)
- Todas las acciones deben estar registradas aquí
- `performAction()` consulta este registry
- Validación dura: acción inexistente = error explícito

**PROBLEMA DETECTADO**: El registry se carga **async** en `ux-action-registry-loader.js`, pero `perform-action.v1.js` puede ejecutarse antes de que termine.

### Componentes que Deciden Estado

**BACKEND ES SOURCE OF TRUTH** (regla constitucional):
- Frontend NO calcula estados
- Frontend consume `state_by_view_layer` del backend
- Cleaning Engine es autoridad de limpieza

**PROBLEMA DETECTADO**: Backend NO recalcula proyecciones después de mutaciones (ver `docs/FASE_3_BACKEND_PROYECCION_PENDIENTE.md`).

### Componentes que Deciden Refresh

**Refresh Engine v1 + v2 Adapter**:
- `refresh-engine-v1.js`: Orquesta invalidate + refetch + render
- `refresh-engine-v2-adapter.js`: Extiende v1 con surfaces declarativas
- `refresh-surface-registry.v1.js`: Registry de superficies

**PROBLEMA DETECTADO**: `buildRefreshPlan()` depende de `window.__AP_ALQUIMIA_STATE__` que puede no estar disponible en runtime.

### Componentes que Deciden Legalidad

**UX Action Registry**:
- Valida `allowed_item_kinds`, `allowed_layers`, `allowed_scopes`
- Valida dominio (`actionDef.domain` vs `window.__AP_CONTEXT__`)
- Hard fail si validación falla

**PROBLEMA DETECTADO**: Validación ocurre en `performAction()`, pero si el registry no está listo, falla antes de validar.

---

## 2️⃣ SECUENCIA REAL DE ARRANQUE (BOOT)

### Línea Temporal desde Carga de Página hasta Click de Botón

```
T0: HTML se carga
  ↓
T1: <script src="/js/master/inject_master.js" type="module">
  ↓
T2: inject_master.js ejecuta (IIFE síncrono)
  - Verifica window.__AP_CONTEXT__ === 'MASTER'
  - import('/js/core/client-state-reset.js') (async)
  ↓
T3: client-state-reset.js ejecuta (IIFE síncrono)
  - Limpia localStorage/sessionStorage si BUILD_ID cambió
  - NO espera nada (síncrono)
  ↓
T4: inject_master.js continúa después de reset
  - import('/js/master/master-script-loader.js') (async)
  ↓
T5: master-script-loader.js ejecuta (IIFE síncrono)
  - Lee window.__AP_MASTER_REQUIRED_SCRIPTS__ (inyectado en HTML)
  - Espera DOMContentLoaded si necesario
  - Inicia carga secuencial de scripts
  ↓
T6: Carga secuencial de scripts (según master-layout-registry.v1.json)
  
  FASE "core" (críticos):
  T6.1: master-sidebar-client.js
  T6.2: master-theme-resolver.js
  T6.3: master-ui-toast.js
  T6.4: master-refresh-engine-v1.js
  T6.5: ux-action-registry-loader.js ⚠️ ASYNC
    - (async function() { ... })()
    - await import('/js/core/ux/action-registry/ux-action-registry.js')
    - await import('/js/core/ux/action-registry/ux-action-schema.js')
    - window.__AP_UX_ACTION_REGISTRY_CORE__ = { ... }
    - window.__AP_UX_ACTION_REGISTRY_READY__ = { promise, resolve, ready }
    - await import('/js/core/ux/action-registry/alquimia-actions.js')
    - window.__AP_UX_ACTION_REGISTRY_READY__.ready = true
    - window.__AP_UX_ACTION_REGISTRY_READY__.resolve()
  T6.6: refresh-surface-registry.v1.js
  T6.7: perform-action.v1.js ⚠️ ASYNC
    - (async function() { ... })()
    - await window.__AP_UX_ACTION_REGISTRY_READY__.promise
    - window.performAction = performAction
  T6.8: refresh-engine-v2-adapter.js
  
  FASE "ui" (no críticos):
  T6.9: alquimia-actions-registry.v1.js
  T6.10: alquimia-surfaces-registry.v1.js
  T6.11: master-alquimia-general-client.js
    - (function() { ... })() (IIFE síncrono)
    - Define funciones: loadItems, loadListProjection, handleVerItem
    - function boot() {
        window.__AP_ALQUIMIA_STATE__ = state
        window.__AP_ALQUIMIA_FUNCTIONS__ = { loadListProjection, loadItems, handleVerItem }
      }
    - boot() se ejecuta al final del IIFE
  ↓
T7: master-script-loader.js emite evento 'AP_MASTER_SCRIPTS_READY'
  ↓
T8: Usuario hace clic en botón
  ↓
T9: Handler ejecuta window.performAction({ action_id, ... })
  ↓
T10: performAction() verifica registry
  - Si window.__AP_UX_ACTION_REGISTRY_CORE__ no existe → ERROR
  - Si existe, busca action_id
  - Si no encuentra → ERROR
```

### Variables Globales Creadas

**Orden de creación** (según código analizado):

1. `window.__AP_CONTEXT__` (inyectado por backend en HTML)
2. `window.__AP_APP_VERSION__` (inyectado por backend)
3. `window.__AP_BUILD_ID__` (inyectado por backend)
4. `window.__AP_MASTER_REQUIRED_SCRIPTS__` (inyectado por backend)
5. `window.__AP_CLIENT_STATE_RESET__` (client-state-reset.js)
6. `window.__AP_MASTER_SCRIPT_LOADER_LOADED__` (master-script-loader.js)
7. `window.__AP_UX_ACTION_REGISTRY_CORE_LOADED__` (ux-action-registry-loader.js)
8. `window.__AP_UX_ACTION_REGISTRY_READY__` (ux-action-registry-loader.js) ⚠️ **CRÍTICO**
9. `window.__AP_UX_ACTION_REGISTRY_CORE__` (ux-action-registry-loader.js) ⚠️ **CRÍTICO**
10. `window.__AP_UX_ACTION_SCHEMA__` (ux-action-registry-loader.js)
11. `window.performActionCore` (ux-action-registry-loader.js)
12. `window.__AP_PERFORM_ACTION_V1_LOADED__` (perform-action.v1.js)
13. `window.performAction` (perform-action.v1.js) ⚠️ **CRÍTICO**
14. `window.__AP_REFRESH_SURFACE_REGISTRY__` (refresh-surface-registry.v1.js)
15. `window.MasterRefreshEngineV1` (master-refresh-engine-v1.js)
16. `window.__AP_ALQUIMIA_STATE__` (master-alquimia-general-client.js) ⚠️ **DEPENDENCIA**
17. `window.__AP_ALQUIMIA_FUNCTIONS__` (master-alquimia-general-client.js) ⚠️ **DEPENDENCIA**

### Momento en que Debería Existir

**`window.__AP_UX_ACTION_REGISTRY_CORE__`**:
- **Debería existir**: Después de que `ux-action-registry-loader.js` termine sus `await import()`
- **Realmente existe**: Después de que TODOS los `await` en el loader terminen
- **PROBLEMA**: Si `perform-action.v1.js` se ejecuta antes, no existe

**`window.performAction`**:
- **Debería existir**: Después de que `perform-action.v1.js` termine de esperar `__AP_UX_ACTION_REGISTRY_READY__`
- **Realmente existe**: Después de que la promesa se resuelva
- **PROBLEMA**: Si un handler UI se ejecuta antes, puede no existir

### Race Conditions Identificadas

**RACE CONDITION #1**: `ux-action-registry-loader.js` vs `perform-action.v1.js`
- **Causa**: Ambos son async, pero `perform-action.v1.js` espera la promesa
- **Estado**: ⚠️ **PARCIALMENTE MITIGADO** (FASE 1 FIX añadió promesa, pero no es determinista si el loader falla)

**RACE CONDITION #2**: `alquimia-actions-registry.v1.js` vs `master-alquimia-general-client.js`
- **Causa**: `alquimia-actions-registry.v1.js` registra acciones, pero `master-alquimia-general-client.js` puede ejecutarse antes
- **Estado**: ⚠️ **NO MITIGADO** (ambos en fase "ui", orden no garantizado)

**RACE CONDITION #3**: `buildRefreshPlan()` vs `window.__AP_ALQUIMIA_STATE__`
- **Causa**: `buildRefreshPlan()` se ejecuta en runtime, pero `window.__AP_ALQUIMIA_STATE__` puede no estar expuesto aún
- **Estado**: ⚠️ **PARCIALMENTE MITIGADO** (FASE 4 FIX mejoró detección, pero sigue dependiendo de estado global)

### Async Loaders Peligrosos

1. **`ux-action-registry-loader.js`**: 
   - Usa `(async function() { ... })()` 
   - Múltiples `await import()`
   - **PELIGRO**: Si algún import falla, el registry queda incompleto

2. **`perform-action.v1.js`**:
   - Usa `(async function() { ... })()`
   - Espera `__AP_UX_ACTION_REGISTRY_READY__.promise`
   - **PELIGRO**: Si la promesa nunca se resuelve, `window.performAction` nunca se expone

3. **`master-script-loader.js`**:
   - Carga scripts secuencialmente con `await loadScript()`
   - **PELIGRO**: Si un script crítico falla, el resto no se carga

### Dependencias No Explícitas

1. **`alquimia-actions-registry.v1.js` depende de `window.__AP_UX_ACTION_REGISTRY_CORE__`**:
   - No hay verificación explícita
   - Si el registry no está listo, las acciones no se registran
   - **PROBLEMA**: Error silencioso

2. **`alquimia-surfaces-registry.v1.js` depende de `window.__AP_REFRESH_SURFACE_REGISTRY__`**:
   - Verifica explícitamente (línea 20)
   - Si no existe, retorna temprano
   - **PROBLEMA**: Error silencioso (no se registran surfaces)

3. **`buildRefreshPlan()` depende de `window.__AP_ALQUIMIA_STATE__`**:
   - No hay verificación explícita
   - Si no existe, el flotante no se refresca
   - **PROBLEMA**: Comportamiento silencioso

---

## 3️⃣ ANÁLISIS DEL ERROR ACTUAL

### Error: "UX Action Registry no disponible"

**Mensaje exacto**:
```
[PerformActionV1] UX Action Registry no disponible. El loader no ha terminado de cargar o falló. Asegúrate de que ux-action-registry-loader.js se carga antes de perform-action.v1.js.
```

**Ubicación**: `perform-action.v1.js:94`

### Por Qué Aparece

**CAUSA RAÍZ**: `window.__AP_UX_ACTION_REGISTRY_CORE__` es `undefined` cuando `performAction()` intenta usarlo.

**Escenarios posibles**:

1. **Escenario A: Loader no ha terminado**
   - `ux-action-registry-loader.js` está ejecutando `await import()`
   - `perform-action.v1.js` ya se ejecutó y esperó la promesa, pero la promesa aún no se resolvió
   - **EVIDENCIA**: Logs muestran `[PerformActionV1] ✅ Action Registry READY` pero luego falla

2. **Escenario B: Loader falló silenciosamente**
   - Algún `await import()` en `ux-action-registry-loader.js` falló
   - El catch resuelve la promesa con `ready: false`
   - `performAction()` espera la promesa, pero el registry no existe
   - **EVIDENCIA**: Logs muestran `[UXActionRegistryLoader] ❌ Error cargando registry core`

3. **Escenario C: Orden de carga incorrecto**
   - `perform-action.v1.js` se carga antes de `ux-action-registry-loader.js`
   - La promesa `__AP_UX_ACTION_REGISTRY_READY__` no existe aún
   - `performAction()` intenta esperar una promesa inexistente
   - **EVIDENCIA**: Logs muestran `[PerformActionV1] ⚠️ Action Registry no está listo`

### Si el Registry No Existe

**Código actual** (`perform-action.v1.js:82-109`):
```javascript
let actionRegistry = window.__AP_UX_ACTION_REGISTRY_CORE__;
let actionDef = null;

if (actionRegistry) {
  actionDef = actionRegistry.get(action_id);
}

// Fallback a registry legacy si no existe en core
if (!actionDef) {
  const legacyRegistry = window.__AP_UX_ACTION_REGISTRY__;
  if (!legacyRegistry) {
    // Hard fail
    throw new Error('[PerformActionV1] UX Action Registry no disponible...');
  }
  actionDef = legacyRegistry.get(action_id);
}
```

**PROBLEMA**: Si `__AP_UX_ACTION_REGISTRY_CORE__` no existe y `__AP_UX_ACTION_REGISTRY__` (legacy) tampoco, falla.

### Si el Registry Existe pero Está Incompleto

**Código actual** (`ux-action-registry-loader.js:35-73`):
```javascript
try {
  // Cargar registry core
  const { registerAction, ... } = await import('/js/core/ux/action-registry/ux-action-registry.js');
  window.__AP_UX_ACTION_REGISTRY_CORE__ = { register: registerAction, ... };
  
  // Cargar acciones de Alquimia
  await import('/js/core/ux/action-registry/alquimia-actions.js');
  
  // Marcar como ready
  window.__AP_UX_ACTION_REGISTRY_READY__.ready = true;
  window.__AP_UX_ACTION_REGISTRY_READY__.resolve();
} catch (error) {
  // Resolver promesa incluso en error
  window.__AP_UX_ACTION_REGISTRY_READY__.ready = false;
  window.__AP_UX_ACTION_REGISTRY_READY__.resolve();
}
```

**PROBLEMA**: Si `alquimia-actions.js` falla al importar, el registry existe pero está vacío. `performAction()` puede ejecutarse, pero no encuentra acciones.

### Si PerformAction se Expone Antes de Tiempo

**Código actual** (`perform-action.v1.js:39-55`):
```javascript
(async function() {
  // Esperar a que el Action Registry esté listo
  try {
    const registryReady = window.__AP_UX_ACTION_REGISTRY_READY__;
    if (registryReady && registryReady.promise) {
      await registryReady.promise;
    } else {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } catch (error) {
    // Continuar en modo degradado
  }
  
  // Exponer performAction
  window.performAction = performAction;
})();
```

**PROBLEMA**: Si `__AP_UX_ACTION_REGISTRY_READY__` no existe, espera 100ms y continúa. Si el loader falla después, `performAction()` se expone pero el registry no está listo.

### Si Hay Errores Silenciosos en Loaders

**Código actual** (`ux-action-registry-loader.js:75-83`):
```javascript
} catch (error) {
  console.error('[UXActionRegistryLoader] ❌ Error cargando registry core:', error);
  // Resolver promesa incluso en error
  window.__AP_UX_ACTION_REGISTRY_READY__.ready = false;
  window.__AP_UX_ACTION_REGISTRY_READY__.resolve();
  // Continuar sin registry core (modo degradado)
}
```

**PROBLEMA**: El error se loguea, pero el sistema continúa. `performAction()` puede ejecutarse y fallar más tarde con un error menos claro.

---

## 4️⃣ DIAGNÓSTICO DE ACTION REGISTRY

### Cuántas Acciones Están Realmente Registradas en Runtime

**Según código analizado** (`alquimia-actions.js`):
- `alquimia.clean` (línea 204)
- `alquimia.clean_all` (línea 226)
- `alquimia.reset` (línea 262)
- `alquimia.create_lista` (línea 281)
- `alquimia.create_item` (línea 308)
- `alquimia.clean_student` (línea 338)

**Total esperado**: 6 acciones

**PROBLEMA**: Si `alquimia-actions.js` falla al importar, 0 acciones están registradas.

### Cuándo se Registran

**Orden de registro**:
1. `ux-action-registry-loader.js` carga `ux-action-registry.js` (registry core)
2. `ux-action-registry-loader.js` carga `alquimia-actions.js` (registra 6 acciones)
3. `alquimia-actions-registry.v1.js` se carga (fase "ui", puede no ejecutarse si hay error)

**PROBLEMA**: Si `alquimia-actions.js` falla, las acciones no se registran, pero el sistema continúa.

### Qué Pasa si una Acción Falla al Registrarse

**Código actual** (`alquimia-actions.js:19-35`):
```javascript
let registerActionFn;
if (window.__AP_UX_ACTION_REGISTRY_CORE__) {
  registerActionFn = window.__AP_UX_ACTION_REGISTRY_CORE__.register;
} else {
  // Fallback: intentar registrar cuando el registry esté disponible
  registerActionFn = (actionDef) => {
    const registry = window.__AP_UX_ACTION_REGISTRY_CORE__;
    if (registry && registry.register) {
      registry.register(actionDef);
    } else {
      console.error('[AlquimiaActions] Registry no disponible para registrar:', actionDef.action_id);
    }
  };
}
```

**PROBLEMA**: Si el registry no está disponible, las acciones no se registran, pero el error es silencioso. `performAction()` fallará más tarde con un error menos claro.

### Si se Bloquea el Sistema o Sigue en Estado Inconsistente

**RESPUESTA**: El sistema **NO se bloquea**, pero queda en **estado inconsistente**.

- Si el registry no se carga: `performAction()` falla con error claro
- Si las acciones no se registran: `performAction()` falla con "Acción no registrada"
- Si el registry está incompleto: Algunas acciones funcionan, otras no

**PROBLEMA**: No hay verificación de integridad del registry después de la carga.

### Verificaciones Adicionales

**registerAction vs registerActionFn**:
- `alquimia-actions.js` usa `registerActionFn` (wrapper que resuelve `registerAction` desde `window.__AP_UX_ACTION_REGISTRY_CORE__`)
- **PROBLEMA**: Si el registry no está disponible, `registerActionFn` es una función que no hace nada (error silencioso)

**Schema loading**:
- `ux-action-schema.js` se carga en `ux-action-registry-loader.js`
- Se expone en `window.__AP_UX_ACTION_SCHEMA__`
- **PROBLEMA**: Si falla, `performAction()` no puede validar payloads

**Imports rotos**:
- Si algún `await import()` falla, el catch resuelve la promesa con `ready: false`
- **PROBLEMA**: El sistema continúa, pero el registry está incompleto

**Errores silenciosos**:
- Múltiples lugares usan `console.error()` pero continúan
- **PROBLEMA**: El sistema puede estar en estado inconsistente sin que el usuario lo sepa

---

## 5️⃣ DIAGNÓSTICO DE REFRESH ENGINE

### Si las Surfaces Existen cuando se Llaman

**Código actual** (`refresh-surface-registry.v1.js:99-104`):
```javascript
export async function refetchSurface(surface_id, context, uiState) {
  const surface = getRefreshSurface(surface_id);
  if (!surface) {
    console.error(`[REFRESH_SURFACE_REGISTRY] Superficie ${surface_id} no registrada`);
    return;
  }
  // ...
}
```

**PROBLEMA**: Si una superficie no está registrada, el error se loguea pero el refresh continúa. No hay fallo hard.

### Si buildRefreshPlan Puede Fallar

**Código actual** (`alquimia-actions.js:44-77`):
```javascript
function buildRefreshPlan(context, uiState, responseData = null) {
  const surfaces = [];
  // ...
  if (context.item_ref) {
    const alquimiaState = typeof window !== 'undefined' && window.__AP_ALQUIMIA_STATE__;
    if (alquimiaState?.modal?.item?.item_ref === context.item_ref) {
      surfaces.push('alquimia.flotante_students');
    }
  }
  return surfaces;
}
```

**PROBLEMA**: Si `window.__AP_ALQUIMIA_STATE__` no existe, `buildRefreshPlan()` no falla, pero no añade `alquimia.flotante_students` al plan. El flotante no se refresca.

### Si Depende de Estado Global Inexistente

**DEPENDENCIAS IDENTIFICADAS**:

1. **`buildRefreshPlan()` depende de `window.__AP_ALQUIMIA_STATE__`**:
   - Si no existe, el flotante no se refresca
   - **PROBLEMA**: Comportamiento silencioso

2. **`alquimia-surfaces-registry.v1.js` depende de `window.__AP_ALQUIMIA_FUNCTIONS__`**:
   - Si no existe, `getAlquimiaFunction()` lanza error
   - **PROBLEMA**: Error en runtime, no en load time

3. **`refresh-engine-v2-adapter.js` depende de `window.__AP_ALQUIMIA_STATE__`**:
   - Si no existe, `uiState.modal_layerView` es `null`
   - **PROBLEMA**: Comportamiento silencioso

### Si Hay Refresh que No Mutan State Interno

**Código actual** (`master-alquimia-general-client.js:1082, 1465`):
```javascript
// loadItems()
state.items = result.items || result.data || [];
if (typeof window !== 'undefined' && window.__AP_ALQUIMIA_STATE__) {
  window.__AP_ALQUIMIA_STATE__ = state; // FASE 4 FIX: Actualizar referencia
}
if (state.projection.mode === 'operativa') {
  renderListaContent(); // FASE 4 FIX: Disparar render
}

// loadListProjection()
state.projection.data = result.data;
if (typeof window !== 'undefined' && window.__AP_ALQUIMIA_STATE__) {
  window.__AP_ALQUIMIA_STATE__ = state; // FASE 4 FIX: Actualizar referencia
}
if (state.projection.mode === 'proyeccion') {
  renderView(); // FASE 4 FIX: Disparar render
}
```

**PROBLEMA**: Si `window.__AP_ALQUIMIA_STATE__` no existe, el state se actualiza localmente, pero la referencia global no se actualiza. `buildRefreshPlan()` no puede detectar el flotante abierto.

---

## 6️⃣ ANÁLISIS DE RULES DE CURSOR

### Tabla de Reglas

| Rule | Estado | Problema | Acción futura |
|-----|-------|---------|---------------|
| `ux-action-registry-constitutional` | ✅ Válida | Ninguno | Mantener |
| `ux-actions-only-permanent` | ✅ Válida | Ninguno | Mantener |
| `ux-action-registry-checklist-cursor` | ✅ Válida | Ninguno | Mantener |
| `master-api-strict-resolution-v1` | ✅ Válida | Ninguno | Mantener |
| `ui-refetch-after-mutations` | ✅ Válida | Ninguno | Mantener |
| `classification-attach-persistence` | ✅ Válida | Ninguno | Mantener |
| `level-engine-pde-v1-authority` | ✅ Válida | Ninguno | Mantener |
| `cleaning-engine-v1-single-decider` | ✅ Válida | Ninguno | Mantener |
| `view-authority-backend-only` | ✅ Válida | Ninguno | Mantener |
| `cpm-v1-canonical-authority` | ✅ Válida | Ninguno | Mantener |
| `alumnos-uuid-only-constitutional` | ✅ Válida | Ninguno | Mantener |
| `backups-postgresql-gitignore-mandatory` | ✅ Válida | Ninguno | Mantener |

### Reglas Obsoletas

**NINGUNA** identificada. Todas las reglas siguen siendo válidas.

### Reglas que Contradicen el Estado Actual

**NINGUNA** identificada. Las reglas son consistentes con el código.

### Reglas que Faltan para Runtime / GOD

**FALTA**: Regla explícita sobre orden de carga de scripts
- **Problema**: No hay garantía de que los scripts se carguen en el orden correcto
- **Acción futura**: Añadir regla que prohíba dependencias implícitas entre scripts

**FALTA**: Regla explícita sobre verificación de integridad del registry
- **Problema**: No hay verificación de que todas las acciones se registraron correctamente
- **Acción futura**: Añadir regla que obligue a verificar integridad después de la carga

**FALTA**: Regla explícita sobre estado global expuesto
- **Problema**: No hay garantía de que `window.__AP_ALQUIMIA_STATE__` esté disponible cuando se necesita
- **Acción futura**: Añadir regla que prohíba dependencias de estado global no documentadas

**FALTA**: Regla explícita sobre contratos de runtime para GOD/no-code
- **Problema**: No hay contrato formal que defina qué piezas del runtime pueden ser modificadas por un editor no-code
- **Acción futura**: Crear contrato formal de Runtime Contract v1

---

## 7️⃣ GAP ANALYSIS PARA GOD / NO-CODE UI

### ¿Puede el Runtime Actual Soportar un Editor No-Code?

**RESPUESTA**: **PARCIALMENTE**.

**LO QUE FUNCIONA**:
- Registry-driven architecture permite añadir acciones sin tocar código
- Refresh Surface Registry permite añadir superficies sin tocar código
- `performAction()` es genérico y puede ejecutar cualquier acción registrada

**LO QUE FALTA**:
- Contrato formal de qué piezas pueden modificarse
- Verificación de integridad después de modificaciones
- Garantías de determinismo después de modificaciones
- Sistema de validación de acciones creadas dinámicamente

### ¿Qué Garantías Faltan?

1. **Garantía de Orden de Carga**:
   - No hay garantía de que los scripts se carguen en el orden correcto
   - **PROBLEMA**: Un editor no-code no puede garantizar que sus modificaciones se carguen antes de que se necesiten

2. **Garantía de Integridad del Registry**:
   - No hay verificación de que todas las acciones se registraron correctamente
   - **PROBLEMA**: Un editor no-code no puede verificar que sus acciones se registraron

3. **Garantía de Estado Global**:
   - No hay garantía de que `window.__AP_ALQUIMIA_STATE__` esté disponible cuando se necesita
   - **PROBLEMA**: Un editor no-code no puede depender de estado global no documentado

4. **Garantía de Determinismo**:
   - No hay garantía de que el runtime sea determinista después de modificaciones
   - **PROBLEMA**: Un editor no-code no puede garantizar comportamiento predecible

### ¿Qué Piezas NO Deben Tocarse?

**PIEZAS CONSTITUCIONALES (NO MODIFICABLES)**:
- `ux-action-registry.js` (registry core)
- `perform-action.v1.js` (wrapper canónico)
- `refresh-surface-registry.v1.js` (registry de superficies)
- `refresh-engine-v1.js` (engine de refresh)
- `master-script-loader.js` (loader de scripts)
- `client-state-reset.js` (reset de estado)

**PIEZAS MODIFICABLES (CON CONTRATO)**:
- `alquimia-actions.js` (registro de acciones)
- `alquimia-surfaces-registry.v1.js` (registro de superficies)
- `master-alquimia-general-client.js` (cliente UI)

**PROBLEMA**: No hay contrato formal que defina qué piezas son modificables y cuáles no.

### ¿Qué Contratos Faltan Formalizar?

1. **Runtime Contract v1**:
   - Define qué piezas son constitucionales (no modificables)
   - Define qué piezas son modificables (con contrato)
   - Define garantías de determinismo
   - Define verificación de integridad

2. **Action Registration Contract v1**:
   - Define cómo registrar acciones dinámicamente
   - Define validación de acciones creadas dinámicamente
   - Define verificación de integridad después de registro

3. **Surface Registration Contract v1**:
   - Define cómo registrar superficies dinámicamente
   - Define validación de superficies creadas dinámicamente
   - Define verificación de integridad después de registro

4. **State Exposure Contract v1**:
   - Define qué estado debe exponerse globalmente
   - Define cuándo debe exponerse
   - Define garantías de disponibilidad

---

## 8️⃣ CONCLUSIÓN EJECUTIVA

### ¿Tenemos Runtime?

**RESPUESTA**: **SÍ, pero NO es determinista**.

**EVIDENCIA**:
- ✅ Registry-driven architecture implementada
- ✅ UX Action Registry como única puerta de intención
- ✅ Refresh Engine orquesta invalidate + refetch + render
- ⚠️ Race conditions en carga de scripts
- ⚠️ Dependencias implícitas entre componentes
- ❌ Error recurrente: "UX Action Registry no disponible"

### ¿Es Determinista Hoy?

**RESPUESTA**: **NO**.

**EVIDENCIA**:
- ⚠️ Orden de carga de scripts no está garantizado
- ⚠️ Dependencias implícitas pueden fallar silenciosamente
- ⚠️ Estado global puede no estar disponible cuando se necesita
- ⚠️ No hay verificación de integridad después de la carga

### ¿Qué lo Rompe?

**CAUSAS RAÍZ**:

1. **Race Conditions**:
   - `ux-action-registry-loader.js` es async, pero otros scripts pueden ejecutarse antes
   - `perform-action.v1.js` espera la promesa, pero si el loader falla, la promesa se resuelve con `ready: false`
   - **IMPACTO**: Error "UX Action Registry no disponible"

2. **Dependencias Implícitas**:
   - `buildRefreshPlan()` depende de `window.__AP_ALQUIMIA_STATE__` que puede no existir
   - `alquimia-actions-registry.v1.js` depende de `window.__AP_UX_ACTION_REGISTRY_CORE__` que puede no existir
   - **IMPACTO**: Comportamiento silencioso, acciones no se registran, refresh no funciona

3. **Falta de Verificación de Integridad**:
   - No hay verificación de que todas las acciones se registraron correctamente
   - No hay verificación de que todas las superficies se registraron correctamente
   - **IMPACTO**: Sistema puede estar en estado inconsistente sin que el usuario lo sepa

4. **Errores Silenciosos**:
   - Múltiples lugares usan `console.error()` pero continúan
   - El sistema puede estar en estado inconsistente sin fallar explícitamente
   - **IMPACTO**: Difícil de debuggear, comportamiento impredecible

### ¿Qué es Prioritario Arreglar Antes de Avanzar?

**PRIORIDAD 1 (BLOQUEANTE)**:

1. **Garantizar Orden de Carga Determinista**:
   - Asegurar que `ux-action-registry-loader.js` termine antes de que `perform-action.v1.js` se exponga
   - Asegurar que `alquimia-actions-registry.v1.js` se ejecute después de que el registry esté listo
   - **ACCIÓN**: Implementar sistema de dependencias explícitas entre scripts

2. **Eliminar Dependencias Implícitas**:
   - Hacer explícitas todas las dependencias entre componentes
   - Verificar que todas las dependencias estén disponibles antes de usarlas
   - **ACCIÓN**: Añadir verificaciones explícitas en todos los puntos de dependencia

3. **Verificación de Integridad del Registry**:
   - Verificar que todas las acciones se registraron correctamente después de la carga
   - Verificar que todas las superficies se registraron correctamente después de la carga
   - **ACCIÓN**: Implementar verificación de integridad después de la carga

**PRIORIDAD 2 (CRÍTICO)**:

4. **Formalizar Contratos para GOD/no-code**:
   - Crear Runtime Contract v1 que defina qué piezas son modificables
   - Crear Action Registration Contract v1 para acciones dinámicas
   - Crear Surface Registration Contract v1 para superficies dinámicas
   - **ACCIÓN**: Documentar contratos formales

5. **Eliminar Errores Silenciosos**:
   - Reemplazar `console.error()` + continuar con fallos hard donde sea apropiado
   - Añadir verificación de integridad que falle hard si el sistema está inconsistente
   - **ACCIÓN**: Implementar fail-hard en puntos críticos

**PRIORIDAD 3 (IMPORTANTE)**:

6. **Mejorar Logging Forense**:
   - Añadir logs estructurados en todos los puntos críticos
   - Añadir verificación de integridad que emita logs forenses
   - **ACCIÓN**: Mejorar observabilidad del runtime

---

## 📝 NOTAS FINALES

Este diagnóstico es **SOLO FORENSE**. NO se ha implementado ningún fix.

**Próximos pasos recomendados**:
1. Implementar sistema de dependencias explícitas entre scripts
2. Añadir verificación de integridad del registry después de la carga
3. Formalizar contratos para GOD/no-code
4. Eliminar errores silenciosos con fail-hard donde sea apropiado

**Verificación obligatoria después de fixes**:
- Runtime debe ser determinista (mismo orden de carga siempre)
- No deben existir dependencias implícitas
- Verificación de integridad debe pasar después de la carga
- No deben existir errores silenciosos

---

**FIN DEL DIAGNÓSTICO FORENSE**
