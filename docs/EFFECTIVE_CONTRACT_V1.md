# EFFECTIVE Contract v1

**Versión**: 1.0.0  
**Fecha**: 2024-12-19  
**Estado**: CANÓNICO

---

## Resumen Ejecutivo

`EFFECTIVE` es una view_layer exclusiva de items `recurrente` que representa una composición determinista de `SHARED` + `PDE`. Es **OBLIGATORIA** y **NO opcional** para items recurrentes.

---

## Definición

### EFFECTIVE = Composición Determinista de SHARED + PDE

Para un item `recurrente`, el estado `effective` se calcula como:

```
effective_state = mejor_estado(shared_state, pde_state)
```

**Regla canónica**: Se toma el **mejor estado** entre `shared` y `pde` (donde mejor = más avanzado en el flujo de limpieza).

### Estados Canónicos (orden de "mejor" a "peor")

1. `reviewed` (verde) - Más avanzado
2. `pending` (amarillo)
3. `important` (rojo)
4. `never` (gris) - Menos avanzado

**Ejemplo**:
- `shared = 'pending'`, `pde = 'reviewed'` → `effective = 'reviewed'`
- `shared = 'never'`, `pde = 'important'` → `effective = 'important'`
- `shared = 'reviewed'`, `pde = 'pending'` → `effective = 'reviewed'`

---

## Reglas Constitucionales

### 1. EFFECTIVE solo existe para `recurrente`

- ✅ **PERMITIDO**: `view_layer='effective'` en items `recurrente`
- ❌ **PROHIBIDO**: `view_layer='effective'` en items `una_vez`
- ❌ **PROHIBIDO**: `clean_layer='effective'` (effective es solo lectura/proyección)

### 2. EFFECTIVE es OBLIGATORIO

Para items `recurrente`, `state_by_view_layer.effective` **DEBE** estar presente en todas las respuestas que calculan estado:

- ✅ `GET /master/api/alquimia-general/items/:item_ref/students` (flotante)
- ✅ `GET /master/api/alquimia-general/lists/:list_id/projection` (list projection)
- ✅ `GET /master/api/alquimia-alumno/megalist` (megalist)

**Bloqueo**: Si `effective` falta para un item `recurrente`, la UI debe bloquear el render con error explícito.

### 3. EFFECTIVE no escribe

- ✅ **PERMITIDO**: Leer `state_by_view_layer.effective`
- ❌ **PROHIBIDO**: Escribir en `effective` (no existe `clean_layer='effective'`)
- ❌ **PROHIBIDO**: Resetear `effective` directamente

**Reset de EFFECTIVE**: Resetear `effective` implica resetear ambas capas (`shared` + `pde`), pero se hace desde las capas individuales.

---

## Comportamiento Post-RESET

### Reset SHARED

Después de resetear `clean_layer='shared'`:
- `shared` → `pending`
- `effective` → recalculado (puede ser `pending` o mejor si `pde` es mejor)

### Reset PDE

Después de resetear `clean_layer='pde'`:
- `pde` → `pending`
- `effective` → recalculado (puede ser `pending` o mejor si `shared` es mejor)

### Reset ALL (scope='all')

**CONTRATO**: Reset ALL solo afecta `pde` (nunca `shared`).

Después de reset ALL:
- `pde` → `pending` (todos los estudiantes)
- `shared` → sin cambios
- `effective` → recalculado (mejor estado entre `shared` y `pde` nuevo)

**Implicación**: Después de reset ALL, `effective` puede seguir siendo mejor que `pending` si `shared` es mejor.

---

## Implementación Técnica

### Backend: CPM v2

El Cleaning Projection Model (CPM v2) calcula `effective` automáticamente:

```javascript
// src/core/master/services/cleaning-projection-model.js

computeCleaningProjection({
  shared: sharedData,
  pde: pdeData,
  item_kind: 'recurrente',
  view_layer: 'effective'
})

// Retorna:
{
  state_by_view_layer: {
    shared: { state: '...', ... },
    pde: { state: '...', ... },
    effective: { state: '...', ... }  // ✅ OBLIGATORIO
  }
}
```

### Flotante Students

El endpoint `GET /master/api/alquimia-general/items/:item_ref/students` debe incluir `effective`:

```javascript
// src/services/alquimia-general-service.js

const stateByViewLayer = {
  shared: computeVisualState({ ... }),
  pde: computeVisualState({ ... }),
  effective: computeVisualState({  // ✅ OBLIGATORIO
    shared: sharedData,
    pde: pdeData,
    item_kind: 'recurrente',
    view_layer: 'effective',
    config: effectiveConfig
  })
};
```

### List Projection Model (LPM)

El LPM calcula `effective` para la proyección de lista (scope='all'):

```javascript
// src/core/master/services/list-projection-model.js

const worstState = calculateWorstStateForLayer(layerStates, 'recurrente', item);
// worstState incluye effective_state si item_kind === 'recurrente'
```

---

## Validaciones

### Coherencia view_layer + item_kind

**REGLA**: `view_layer='effective'` solo es válido si `item_kind='recurrente'`.

```javascript
if (view_layer === 'effective' && item_kind !== 'recurrente') {
  throw new Error('view_layer="effective" solo disponible para item_kind="recurrente"');
}
```

### Presencia Obligatoria

**REGLA**: Para `recurrente`, `state_by_view_layer.effective` debe existir.

```javascript
if (item_kind === 'recurrente' && !stateByViewLayer.effective) {
  throw new Error('state_by_view_layer.effective es obligatorio para recurrente');
}
```

---

## UI: Renderizado

### Botón EFFECTIVE en Flotante

El botón "EFFECTIVE" debe aparecer SOLO para items `recurrente`:

```javascript
const itemKind = getItemKindExplicit(item, lista);
const showEffectiveButton = itemKind === 'recurrente';

if (showEffectiveButton) {
  // Renderizar botón EFFECTIVE
}
```

### Bloqueo de Render

Si `effective` falta y el usuario selecciona view_layer='effective':

```javascript
if (view_layer === 'effective' && !student.state_by_view_layer?.effective) {
  console.error('[BUG-011] state_by_view_layer.effective no disponible - BLOQUEANDO render');
  // Bloquear render, mostrar error visible
  return;
}
```

---

## Logs Forenses

Todos los cálculos de `effective` deben emitir logs estructurados:

```
[CPM_V2][INPUT] Calculando estado effective
{
  item_ref: "...",
  item_kind: "recurrente",
  shared_state: "...",
  pde_state: "..."
}

[CPM_V2][OUTPUT] effective_state calculado
{
  effective_state: "...",
  rationale: "mejor entre shared y pde"
}
```

---

## Referencias

- `src/core/master/services/cleaning-projection-model.js` - Cálculo canónico
- `src/services/alquimia-general-service.js` - Integración en flotante
- `src/core/master/services/list-projection-model.js` - Integración en list projection
- `docs/CLEANING_PROJECTION_MODEL_V1.md` - Documentación CPM
- `docs/RECURRENTE_EFFECTIVE_VIEW_V1.md` - Documentación técnica

---

**Última actualización**: 2024-12-19  
**Mantenido por**: AuriPortal Architecture Team
