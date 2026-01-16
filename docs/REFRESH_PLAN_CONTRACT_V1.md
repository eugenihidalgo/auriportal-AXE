# Refresh Plan Contract v1

**Versión**: 1.0.0  
**Fecha**: 2024-12-19  
**Estado**: CANÓNICO

---

## Resumen Ejecutivo

El Refresh Plan es una función canónica que determina qué superficies UI deben refrescarse después de una mutación. Debe incluir **contexto completo** (`list_id`, `item_ref`, `view_layer`, `scope`) para evitar surfaces `unknown`.

---

## Función Canónica

### buildRefreshPlan

```javascript
function buildRefreshPlan(context, uiState) {
  // Retorna Array<string> de surface_ids
}
```

**Parámetros**:
- `context`: Contexto de la mutación (viene del action handler)
- `uiState`: Estado de UI actual (viene de `window.__AP_ALQUIMIA_STATE__` o defaults)

**Retorna**: Array de `surface_id` que deben refrescarse.

---

## Reglas Constitucionales

### 1. Contexto Completo Obligatorio

**REGLA**: `buildRefreshPlan` debe tener acceso a:

- ✅ `list_id` (obligatorio si hay lista)
- ✅ `item_ref` (opcional, solo si aplica)
- ✅ `view_layer` (obligatorio, default: 'shared')
- ✅ `scope` (obligatorio, default: 'all')
- ✅ `view_mode` (obligatorio, default: 'operativa')

**Validación**:
```javascript
function buildRefreshPlan(context, uiState) {
  const list_id = uiState.list_id || context.list_id;
  const view_layer = uiState.view_layer || context.view_layer || 'shared';
  const scope = context.scope || uiState.scope || 'all';
  const view_mode = uiState.view_mode || 'operativa';
  
  // Warning si falta list_id (pero no falla)
  if (!list_id) {
    console.warn('[buildRefreshPlan] list_id no disponible', { context, uiState });
  }
  
  // ... construir refresh plan
}
```

### 2. Surfaces Canónicas

**Permitidas**:
- ✅ `alquimia.list_projection` - Proyección de lista (scope='all' o 'student')
- ✅ `alquimia.items` - Tabla de items (modo operativa)
- ✅ `alquimia.flotante_students` - Modal flotante de estudiantes

**Prohibidas**:
- ❌ `unknown` - Surface no identificada (error de configuración)
- ❌ Cualquier surface no registrada en Refresh Surface Registry

### 3. Lógica de Refresh

#### alquimia.list_projection
**Condición**: `view_mode === 'proyeccion'` AND `list_id` presente

```javascript
if (view_mode === 'proyeccion' && list_id) {
  surfaces.push('alquimia.list_projection');
}
```

#### alquimia.items
**Condición**: `view_mode === 'operativa'` AND `list_id` presente

```javascript
if (view_mode === 'operativa' && list_id) {
  surfaces.push('alquimia.items');
}
```

#### alquimia.flotante_students
**Condición**: `item_ref` presente (independiente de `view_mode`)

```javascript
// BUG-008 FIX: Detección robusta - Si hay item_ref, refrescar siempre (idempotente)
if (context.item_ref) {
  surfaces.push('alquimia.flotante_students');
}
```

**Razón**: El flotante puede estar abierto en cualquier modo (proyección u operativa). Si hay `item_ref`, es probable que el flotante necesite refrescarse.

---

## Logs Forenses Obligatorios

**REGLA**: Todo `buildRefreshPlan` debe emitir logs estructurados:

```javascript
console.log('[AlquimiaActionsRegistry][buildRefreshPlan] Refresh plan construido', {
  surfaces,
  context: {
    list_id,
    item_ref: context.item_ref || null,
    view_layer,
    scope,
    view_mode
  }
});
```

**Ejemplo de log esperado**:
```
[AlquimiaActionsRegistry][buildRefreshPlan] Refresh plan construido
{
  surfaces: ["alquimia.list_projection", "alquimia.flotante_students"],
  context: {
    list_id: "1",
    item_ref: "transmutacion:lista:1:item:1",
    view_layer: "shared",
    scope: "all",
    view_mode: "proyeccion"
  }
}
```

---

## Integración con Refresh Engine v2

### Refresh Surface Registry

Las surfaces deben estar registradas en `Refresh Surface Registry`:

```javascript
// src/core/ux/refresh-surface-registry.v1.js

registry.register({
  surface_id: 'alquimia.list_projection',
  domain: 'master',
  refetch: async (context) => {
    // Refrescar proyección de lista
    await loadListProjection();
    renderView();
  }
});

registry.register({
  surface_id: 'alquimia.items',
  domain: 'master',
  refetch: async (context) => {
    // Refrescar tabla de items
    await loadItems();
    renderView();
  }
});

registry.register({
  surface_id: 'alquimia.flotante_students',
  domain: 'master',
  refetch: async (context) => {
    // Refrescar flotante si está abierto
    if (state.modal?.item?.item_ref === context.item_ref) {
      await handleVerItem(state.modal.item, state.modal.cleanLayer, state.modal.layerView);
    }
  }
});
```

### Ejecución del Refresh

El Refresh Engine v2 ejecuta el refresh plan:

```javascript
// public/js/core/ux/refresh-engine-v2.js

async function executeRefreshPlan(surfaces, context) {
  for (const surfaceId of surfaces) {
    const surface = registry.get(surfaceId);
    if (surface && surface.refetch) {
      await surface.refetch(context);
    } else {
      console.error(`[RefreshEngine] Surface ${surfaceId} no encontrada o sin refetch`);
      // NO fallar, solo loguear (fail-open)
    }
  }
}
```

---

## Contexto en Action Handlers

### buildPayload debe incluir contexto completo

**REGLA**: Los action handlers deben pasar contexto completo en `buildPayload`:

```javascript
registry.register({
  action_id: 'alquimia.reset.item.all',
  handler: {
    buildPayload: (uiState, context) => {
      return {
        item_ref: context.item_ref,
        item_kind: context.item_kind,
        scope: 'all',
        clean_layer: 'pde'
        // NOTA: view_layer y list_id van en uiState, no en payload
      };
    }
  },
  refresh: buildRefreshPlan  // buildRefreshPlan recibe (context, uiState)
});
```

### performAction pasa uiState automáticamente

```javascript
// public/js/master/ux/perform-action.v1.js

await window.performAction({
  action_id: 'alquimia.reset.item.all',
  context: {
    item_ref: '...',
    item_kind: 'recurrente'
  },
  uiState: {
    view_mode: state.projection.mode,
    view_layer: state.projection.view_layer || 'shared',
    list_id: state.listaActiva?.id || null
  }
});
```

---

## Errores Comunes y Soluciones

### Surface "unknown"

**Síntoma**: Logs muestran `surface: "unknown"`

**Causa**: `buildRefreshPlan` no puede determinar qué surface refrescar.

**Solución**: Asegurar que `list_id` o `item_ref` estén presentes en `context` o `uiState`.

```javascript
// ❌ MALO
function buildRefreshPlan(context, uiState) {
  // No hay list_id ni item_ref
  return [];  // o ['unknown']
}

// ✅ BUENO
function buildRefreshPlan(context, uiState) {
  const list_id = uiState.list_id || context.list_id;
  const view_mode = uiState.view_mode || 'operativa';
  
  if (view_mode === 'proyeccion' && list_id) {
    return ['alquimia.list_projection'];
  }
  
  return [];
}
```

### list_id no disponible

**Síntoma**: Warning `list_id no disponible` en logs

**Causa**: `uiState` no incluye `list_id` y `context` tampoco.

**Solución**: Asegurar que `performAction` pasa `uiState` con `list_id`:

```javascript
await window.performAction({
  action_id: '...',
  context: { ... },
  uiState: {
    list_id: state.listaActiva?.id || null,  // ✅ OBLIGATORIO
    view_mode: state.projection.mode,
    view_layer: state.projection.view_layer || 'shared'
  }
});
```

---

## Checklist de Verificación

### Backend (alquimia-actions.js)
- [ ] `buildRefreshPlan` valida contexto completo
- [ ] Logs forenses incluyen `list_id`, `item_ref`, `view_layer`, `scope`, `view_mode`
- [ ] NO retorna surfaces `unknown`

### Frontend (alquimia-actions-registry.v1.js)
- [ ] `buildRefreshPlan` es idéntico al backend (o muy similar)
- [ ] Logs forenses están presentes
- [ ] Todas las acciones usan `buildRefreshPlan` como `refresh`

### Refresh Engine
- [ ] Todas las surfaces están registradas en Refresh Surface Registry
- [ ] `executeRefreshPlan` maneja surfaces faltantes (fail-open)
- [ ] Logs muestran qué surfaces se refrescan

---

## Referencias

- `src/core/ux/action-registry/alquimia-actions.js` - Implementación backend
- `public/js/master/ux/alquimia-actions-registry.v1.js` - Implementación frontend
- `src/core/ux/refresh-surface-registry.v1.js` - Registry de surfaces
- `public/js/core/ux/refresh-engine-v2.js` - Motor de refresh
- `docs/UX_CONTRACT_V1.md` - Contrato UX general
- `docs/REFRESH_CONTRACT_V1.md` - Contrato Refresh Engine

---

**Última actualización**: 2024-12-19  
**Mantenido por**: AuriPortal Architecture Team
