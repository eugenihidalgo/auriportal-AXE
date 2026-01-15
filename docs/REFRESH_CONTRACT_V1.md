# REFRESH CONTRACT v1 - AuriPortal

**Versión:** 1.0.0  
**Fecha:** 2025-01-15  
**Dominio:** MASTER (iniciando por Alquimia General)  
**Estado:** CANÓNICO

---

## 1. ¿Qué es un Surface?

Un **Surface** es una superficie de UI que puede ser invalidada y refrescada después de una mutación.

### Ejemplos de Surfaces

- **`alquimia.list_projection`**: Proyección agregada de lista (modo proyección)
- **`alquimia.items`**: Lista de items (modo operativa)
- **`alquimia.flotante_students`**: Flotante de estudiantes por item

### Características

- **ID canónico**: Identificador único (`surface_id`)
- **Key estable**: Clave generada por `buildKey(context, uiState)` para cache/invalidación
- **Refetch canónico**: Función `refetch(context, uiState)` que ejecuta el refresh

---

## 2. Surface Registry

### Schema Canónico

```javascript
{
  surface_id: string,           // ID único canónico (ej: 'alquimia.list_projection')
  buildKey: (context, uiState) => string,  // Genera clave estable
  refetch: (context, uiState) => Promise<void>,  // Ejecuta refetch
  forensicsLabel: string        // Etiqueta para logs (ej: 'list-projection')
}
```

### Ejemplo Real

```javascript
registry.registerRefreshSurface({
  surface_id: 'alquimia.list_projection',
  buildKey: (context, uiState) => {
    const list_id = uiState.list_id || context.list_id || 'unknown';
    const view_layer = uiState.view_layer || context.view_layer || 'shared';
    const scope = uiState.scope || context.scope || 'all';
    const student_uuid = uiState.student_uuid || context.student_uuid || null;
    return `list_projection:${list_id}:${view_layer}:${scope}:${student_uuid || 'all'}`;
  },
  refetch: async (context, uiState) => {
    const loadListProjection = getAlquimiaFunction('loadListProjection');
    await loadListProjection();
  },
  forensicsLabel: 'list-projection'
});
```

### Keys Estables

Las keys deben ser:
- **Deterministas**: Mismo `context` + `uiState` = misma key
- **Únicas**: Diferentes superficies = diferentes keys
- **Legibles**: Formato `{surface_id}:{param1}:{param2}:...`

---

## 3. Refresh Plan Declarativo

### Formato

El `refresh_plan` puede ser:

1. **Función** que retorna array de `surface_id`s:
   ```javascript
   refresh_plan: (context, uiState, responseData) => {
     const surfaces = [];
     if (uiState.view_mode === 'proyeccion') {
       surfaces.push('alquimia.list_projection');
     }
     if (uiState.view_mode === 'operativa') {
       surfaces.push('alquimia.items');
     }
     if (context.item_ref && window.__AP_ALQUIMIA_STATE__?.modal?.item?.item_ref === context.item_ref) {
       surfaces.push('alquimia.flotante_students');
     }
     return surfaces;
   }
   ```

2. **Array directo** de `surface_id`s:
   ```javascript
   refresh_plan: ['alquimia.items', 'alquimia.flotante_students']
   ```

### Ejemplo Canónico (Alquimia)

```javascript
function buildRefreshPlan(context, uiState) {
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
  // INDEPENDIENTEMENTE del view_mode (regla constitucional)
  if (context.item_ref && window.__AP_ALQUIMIA_STATE__?.modal?.item?.item_ref === context.item_ref) {
    surfaces.push('alquimia.flotante_students');
  }

  return surfaces;
}
```

---

## 4. Secuencia Canónica: POST → PLAN → GETs → APPLY

### Flujo Completo

```
1. Usuario pulsa botón
   ↓
2. Handler llama performAction({ action_id, context, uiState })
   ↓
3. performAction() ejecuta POST
   ↓
4. performAction() resuelve refresh_plan → surfaces
   ↓
5. performAction() llama refreshEngine.afterMutationV2({ surfaces })
   ↓
6. Refresh Engine ejecuta cada surface.refetch()
   ↓
7. Cada surface ejecuta su GET canónico
   ↓
8. Refresh Engine ejecuta render()
   ↓
9. UI actualizada
```

### Logs Estructurados

```javascript
// 1. Inicio de acción
[UX][ACTION][START] { action_id: 'alquimia.clean.all', ... }

// 2. POST ejecutado
[UX][ACTION][END] { action_id: 'alquimia.clean.all', status: 200, ... }

// 3. Plan resuelto
[REFRESH][PLAN] {
  action_id: 'alquimia.clean.all',
  trace_id: '...',
  surfaces: ['alquimia.items', 'alquimia.flotante_students'],
  timestamp: '...'
}

// 4. Cada surface ejecutado
[REFRESH][GET] list-projection { surface_id: 'alquimia.list_projection', key: '...', timestamp: '...' }
[REFRESH][GET] list-projection ok { surface_id: 'alquimia.list_projection', duration_ms: 120, ... }

[REFRESH][GET] flotante (students) { surface_id: 'alquimia.flotante_students', key: '...', timestamp: '...' }
[REFRESH][GET] flotante (students) ok { surface_id: 'alquimia.flotante_students', duration_ms: 85, ... }

// 5. Render final
[REFRESH_ENGINE][ALQG][RENDER] { mutation_type: 'alquimia.clean.all', ... }
```

---

## 5. Casos Especiales

### 5.1. Flotante Abierto

**Regla Constitucional**: El flotante puede estar abierto en cualquier modo (proyección u operativa).

**Implementación**:
```javascript
// En buildRefreshPlan()
if (context.item_ref && window.__AP_ALQUIMIA_STATE__?.modal?.item?.item_ref === context.item_ref) {
  surfaces.push('alquimia.flotante_students');  // SIEMPRE, independiente de view_mode
}
```

**Logs**:
```javascript
[REFRESH][GET] flotante (students) {
  surface_id: 'alquimia.flotante_students',
  key: 'flotante:item_ref_123:shared:shared',
  view_mode: 'proyeccion',  // Puede ser cualquier modo
  timestamp: '...'
}
```

### 5.2. Cambio de view_mode

**Regla**: Si cambia `view_mode`, se invalidan superficies del modo anterior y se refrescan del modo nuevo.

**Implementación**:
```javascript
// buildRefreshPlan() evalúa view_mode actual
if (view_mode === 'proyeccion') {
  surfaces.push('alquimia.list_projection');
} else if (view_mode === 'operativa') {
  surfaces.push('alquimia.items');
}
```

### 5.3. view_layer / clean_layer

**Regla**: `view_layer` es para GET (lectura), `clean_layer` es para POST (escritura).

**En refresh_plan**:
- `view_layer` se usa para determinar qué superficie refrescar
- `clean_layer` se pasa en `context` para que surfaces sepan qué capa refrescar

**Ejemplo**:
```javascript
// POST con clean_layer='pde'
const result = await performAction({
  action_id: 'alquimia.clean.all',
  context: {
    item_ref: '...',
    clean_layer: 'pde',  // Capa de escritura
    item_kind: 'recurrente'
  },
  uiState: {
    view_mode: 'operativa',
    view_layer: 'shared',  // Vista activa (puede ser diferente de clean_layer)
    list_id: '...'
  }
});

// refresh_plan decide surfaces según view_mode y view_layer
// surfaces ejecutan refetch con context.clean_layer para saber qué capa refrescar
```

---

## 6. Invariantes

### Invariante 1: Toda Mutación Tiene Refresh Plan

> **Toda acción registrada DEBE tener `refresh_plan` no vacío.**

**Verificación**:
- Assembly check: `npm run check:ux-refresh`
- Error si acción sin `refresh_plan`

### Invariante 2: Surfaces Declarativas

> **Toda superficie refrescada DEBE estar registrada en Refresh Surface Registry.**

**Verificación**:
- `surface_id` debe existir en registry
- Error si `surface_id` no registrado

### Invariante 3: Flotante Independiente de view_mode

> **El flotante se refresca SIEMPRE si está abierto e `item_ref` coincide, INDEPENDIENTEMENTE del `view_mode`.**

**Verificación**:
- Logs `[REFRESH][GET] flotante` después de mutaciones desde cualquier modo
- Flotante muestra estado actualizado sin recargar página

### Invariante 4: Keys Estables

> **Toda superficie DEBE generar keys estables y deterministas.**

**Verificación**:
- Mismo `context` + `uiState` = misma key
- Keys legibles en logs

### Invariante 5: Refetch Idempotente

> **Ejecutar `refetch()` múltiples veces con mismo `context` + `uiState` debe ser idempotente.**

**Verificación**:
- Múltiples llamadas a `surface.refetch()` con mismos parámetros = mismo resultado
- No duplicar datos en UI

### Invariante 6: Backend es Autoridad

> **El frontend NO calcula estados. Consume estados calculados por el backend.**

**Verificación**:
- Surfaces ejecutan GETs, no cálculos
- UI consume `state_by_view_layer` del backend

---

## 7. Refresh Engine v2

### Adapter v2

El Refresh Engine v2 soporta surfaces declarativas:

```javascript
// performAction() llama refreshEngine.afterMutationV2()
await refreshEngine.afterMutationV2({
  module: 'alquimia_general',
  mutation_type: action_id,
  action_id: action_id,
  scope: {
    view_mode: uiState.view_mode,
    view_layer: uiState.view_layer
  },
  context: {
    ...context,
    trace_id,
    action_id,
    surfaces: surfacesToRefresh  // Array de surface_ids
  }
});
```

### Fallback a v1

Si no hay surfaces declarativas, se usa v1 (lógica manual):

```javascript
// Sin surfaces → usar v1
if (surfaces.length === 0) {
  return engineV1.afterMutation(mutation);
}
```

---

## 8. Escalabilidad

### Patrón de Expansión

1. **Crear surfaces específicos del dominio**:
   - `{domain}-surfaces-registry.v1.js`

2. **Registrar en layout registry**:
   - Añadir script en fase `ui`

3. **Usar en refresh_plan**:
   - Incluir `surface_id`s en `buildRefreshPlan()`

### Ejemplo: Nuevo Dominio

```javascript
// nuevo-dominio-surfaces-registry.v1.js
registry.registerRefreshSurface({
  surface_id: 'nuevo_dominio.lista',
  buildKey: (context, uiState) => `lista:${context.list_id}`,
  refetch: async (context, uiState) => {
    await loadLista(context.list_id);
  },
  forensicsLabel: 'lista'
});
```

---

## 9. Referencias

- **Implementación**: `src/core/ux/refresh-surface-registry.v1.js`
- **Ejemplos**: `public/js/master/ux/alquimia-surfaces-registry.v1.js`
- **Engine v2**: `public/js/master/ux/refresh-engine-v2-adapter.js`
- **UX Contract**: `docs/UX_CONTRACT_V1.md`
- **Invariantes**: `docs/INVARIANTES_CONSTITUCIONALES.md`

---

**Última actualización**: 2025-01-15  
**Mantenido por**: Sistema AuriPortal  
**Estado**: CANÓNICO ✅
