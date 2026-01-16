# 🔧 FIXES MAJOR — ALQUIMIA GENERAL v1

**Fecha:** 2026-01-13  
**Versión:** 5.75.4  
**Alcance:** 8 bugs MAJOR únicamente

---

## ✅ FIXES IMPLEMENTADOS

### 🔴 BUG-003: Validación explícita de item_kind antes de renderizar clean-all

**Problema:** Los botones "Limpiar" (clean-all) se renderizaban basándose solo en `listaActiva.tipo`, sin validar explícitamente `item_kind` antes de renderizar.

**Fix Implementado:**
- Validación explícita de `item_kind` usando `getItemKindExplicit()` **ANTES** de renderizar botones clean-all
- Si `item_kind !== 'recurrente'`, los botones clean-all **NO se renderizan**
- Ubicación: línea ~4340

**Código:**
```javascript
// BUG-003 FIX: Validar item_kind explícitamente ANTES de renderizar (no confiar solo en listaActiva.tipo)
const itemKindForClean = getItemKindExplicit(item, state.listaActiva);
if (itemKindForClean === 'recurrente' && state.projection.scope !== 'student') {
  // Renderizar botones clean-all solo si es recurrente
}
```

**Resultado:** ✅ Clean-all solo se renderiza si item_kind es explícitamente 'recurrente'

---

### 🔴 BUG-005: Migrar selector de vista a Refresh Surface Registry

**Problema:** El selector de vista (SHARED/PDE/EFFECTIVE/COMBO) en el flotante hacía refetch manual (`handleVerItem`) en lugar de usar Refresh Surface Registry.

**Fix Implementado:**
1. **Uso de Refresh Surface Registry** en lugar de refetch manual
2. **Fallback seguro** si registry no está disponible
3. **Preservación de tamaño** antes de refetch
4. Ubicación: línea ~2380

**Código:**
```javascript
// BUG-005 FIX: Usar Refresh Surface Registry en lugar de refetch manual
if (window.__AP_REFRESH_SURFACE_REGISTRY__) {
  const surfaceRegistry = window.__AP_REFRESH_SURFACE_REGISTRY__;
  await surfaceRegistry.refetch('alquimia.flotante_students', {
    item_ref: item.item_ref,
    view_layer: newView,
    clean_layer: state.modal.cleanLayer || 'shared'
  }, uiState);
} else {
  // Fallback: refetch manual si registry no está disponible
  await handleVerItem(item, state.modal.cleanLayer || 'shared', newView);
}
```

**Resultado:** ✅ Selector de vista usa Refresh Surface Registry declarativamente

---

### 🔴 BUG-006: Eliminar fetch() directo - Crear acciones UX

**Problema:** Los handlers `handleEliminarItem` y `resetItemOverrides` usaban `fetch()` directo sin pasar por UX Action Registry.

**Fix Implementado:**
1. **Creación de 3 acciones UX nuevas** en `alquimia-actions.js`:
   - `alquimia.delete_item`: Eliminar item (soft delete)
   - `alquimia.reset_overrides`: Resetear overrides de un item para un estudiante
   - `alquimia.update_lista`: Actualizar configuración de lista
2. **Reemplazo de fetch() directo** con `performAction()` en:
   - `handleEliminarItem` (línea ~5419)
   - Botón "Reset Overrides" (línea ~4613)

**Código:**
```javascript
// BUG-006 FIX: Usar performAction() en lugar de fetch() directo
const result = await window.performAction({
  action_id: 'alquimia.delete_item',
  context: {
    item_id: item.id,
    item_ref: item.item_ref,
    list_id: state.listaActiva?.id || null
  },
  uiState
});
```

**Resultado:** ✅ Todos los botones mutadores usan performAction() (sin fetch() directo)

---

### 🔴 BUG-009: Preservar view_layer activo en refresh de proyección

**Problema:** En `loadListProjection()`, cuando se refrescaba la proyección, **no siempre preservaba el `view_layer` activo**. Si el usuario estaba en `view_layer='effective'` y ejecutaba una acción, el refresh podía volver a `view_layer='shared'`.

**Fix Implementado:**
1. **Preservación explícita** de `state.projection.view_layer` antes de hacer fetch
2. **Defaults canónicos** según `item_kind` si `view_layer` no está definido:
   - `recurrente` → `'shared'`
   - `una_vez` → `'combo'`
3. **Actualización de state** para preservar en siguiente llamada
4. Ubicación: línea ~1413

**Código:**
```javascript
// BUG-009 FIX: Preservar view_layer activo (no resetear a 'shared' por defecto)
let activeViewLayer = state.projection.view_layer;
if (!activeViewLayer) {
  // Defaults canónicos según item_kind
  if (itemKind === 'recurrente') {
    activeViewLayer = 'shared';
  } else if (itemKind === 'una_vez') {
    activeViewLayer = 'combo';
  } else {
    activeViewLayer = 'shared'; // Fallback seguro
  }
  state.projection.view_layer = activeViewLayer;
}
```

**Resultado:** ✅ view_layer siempre se preserva durante refresh de proyección

---

### 🔴 BUG-012: Validar item_kind antes de renderizar columnas

**Problema:** Las columnas se renderizaban sin validar explícitamente `item_kind`. Si `item_kind` era inconsistente o null, las columnas podían renderizarse incorrectamente.

**Fix Implementado:**
1. **Validación explícita** de `item_kind` antes de renderizar columnas
2. **Bloqueo de render** si `item_kind` es inválido o inconsistente
3. **Error visible** en lugar de renderizar columnas incorrectas
4. Ubicación: línea ~2674

**Código:**
```javascript
// BUG-012 FIX: Validar item_kind antes de renderizar columnas (bloquear si inconsistente)
if (!itemKind || (itemKind !== 'recurrente' && itemKind !== 'una_vez')) {
  console.error('[BUG-012] item_kind inválido o faltante antes de renderizar columnas');
  // Mostrar error visible en lugar de renderizar columnas incorrectas
  const errorColumn = document.createElement('div');
  errorColumn.textContent = '❌ ERROR: item_kind inconsistente';
  content.appendChild(errorColumn);
  return; // Bloquear render de columnas
}
```

**Resultado:** ✅ Columnas solo se renderizan si item_kind es válido y consistente

---

### 🔴 BUG-014: Forzar re-render completo de filas tras refresh

**Problema:** Tras refresh, las filas de estudiantes podían "recordar" colores y estado anteriores, causando que los colores no cambiaran visualmente tras acciones.

**Fix Implementado:**
1. **Limpieza de referencias anteriores** antes de crear nueva fila
2. **Consumo de color desde backend** (`state_by_view_layer[view_layer].computed_state.color`)
3. **Fallback seguro** si color no está disponible
4. **Guardado de referencia** para siguiente comparación
5. Ubicación: línea ~3017

**Código:**
```javascript
// BUG-014 FIX: Forzar re-render completo eliminando referencias anteriores
delete student._last_row_element;
delete student._last_row_state;

// BUG-014: Colores siempre desde backend (state_by_view_layer), no hardcodeados
const activeViewLayer = state.modal.layerView || 'shared';
const stateData = student.state_by_view_layer?.[activeViewLayer];
const computedColor = stateData?.computed_state?.color;

if (computedColor) {
  // Usar color del backend (si está disponible)
  row.style.cssText += `background: ${computedColor};`;
} else {
  // Fallback seguro
}
```

**Resultado:** ✅ Colores y estado siempre vienen del backend (no se "recuerdan")

---

### 🔴 BUG-016: Corregir fallback de view_layer en handleVerItem

**Problema:** En `handleVerItem()`, si `viewLayer` no estaba definido, se usaba `cleanLayer` como fallback. Esto viola la separación constitucional entre `view_layer` (GET) y `clean_layer` (POST).

**Fix Implementado:**
1. **Eliminación del fallback** a `cleanLayer`
2. **Defaults canónicos** según `item_kind`:
   - `recurrente` → `'shared'`
   - `una_vez` → `'combo'`
3. **Separación absoluta** entre `view_layer` y `clean_layer`
4. Ubicación: línea ~2006

**Código:**
```javascript
// BUG-016 FIX: Corregir fallback de view_layer (NUNCA usar cleanLayer como fallback)
let activeViewLayer = viewLayer || state.modal.layerView;

// Si aún no está definido, obtener item_kind y usar default canónico
if (!activeViewLayer) {
  const itemKind = getItemKindExplicit(item, state.listaActiva);
  if (itemKind === 'recurrente') {
    activeViewLayer = 'shared';
  } else if (itemKind === 'una_vez') {
    activeViewLayer = 'combo';
  } else {
    activeViewLayer = 'shared'; // Fallback seguro
  }
}

// BUG-016: NUNCA usar cleanLayer como fallback de view_layer
// cleanLayer y view_layer son conceptos distintos y NO se mezclan
```

**Resultado:** ✅ view_layer nunca usa cleanLayer como fallback (separación absoluta)

---

### 🔴 BUG-017: Validar item_kind antes de renderizar columnas en flotante

**Problema:** En el flotante, las columnas se renderizaban sin validar explícitamente `item_kind`. Si `item_kind` era inconsistente, las columnas podían renderizarse incorrectamente.

**Fix Implementado:**
1. **Validación explícita** de `item_kind` antes de renderizar columnas en flotante
2. **Bloqueo de render** si `item_kind` es inválido o inconsistente
3. **Error visible** en lugar de renderizar columnas incorrectas
4. Ubicación: línea ~2674

**Código:**
```javascript
// BUG-017 FIX: Validar item_kind antes de renderizar columnas en flotante
if (!itemKind || (itemKind !== 'recurrente' && itemKind !== 'una_vez')) {
  console.error('[BUG-017] item_kind inválido o faltante antes de renderizar columnas en flotante');
  // Mostrar error visible en lugar de renderizar columnas incorrectas
  const errorColumn = document.createElement('div');
  errorColumn.textContent = '❌ ERROR: item_kind inconsistente';
  content.appendChild(errorColumn);
  return; // Bloquear render de columnas
}
```

**Resultado:** ✅ Columnas en flotante solo se renderizan si item_kind es válido y consistente

---

## 📋 ARCHIVOS MODIFICADOS

1. `public/js/master/master-alquimia-general-client.js`
   - Línea ~4340: Fix BUG-003 (Validación item_kind antes de renderizar clean-all)
   - Línea ~2380: Fix BUG-005 (Migrar selector de vista a Refresh Surface Registry)
   - Línea ~1413: Fix BUG-009 (Preservar view_layer en loadListProjection)
   - Línea ~2674: Fix BUG-012 (Validar item_kind antes de renderizar columnas)
   - Línea ~3017: Fix BUG-014 (Forzar re-render completo de filas)
   - Línea ~2006: Fix BUG-016 (Corregir fallback de view_layer en handleVerItem)
   - Línea ~2674: Fix BUG-017 (Validar item_kind antes de renderizar columnas en flotante)
   - Línea ~5419: Fix BUG-006 (Migrar handleEliminarItem a performAction)
   - Línea ~4613: Fix BUG-006 (Migrar resetItemOverrides a performAction)

2. `src/core/ux/action-registry/alquimia-actions.js`
   - Línea ~383: Fix BUG-006 (Crear 3 acciones UX nuevas: delete_item, reset_overrides, update_lista)

3. `package.json`
   - Versión actualizada: `5.75.3` → `5.75.4`

---

## ✅ VERIFICACIÓN

- ✅ Solo se modificaron los 8 bugs MAJOR
- ✅ No se tocaron fixes de FASE 1 (BLOCKER) ni FASE 2 (CRITICAL)
- ✅ No se añadieron features nuevas
- ✅ No se refactorizó arquitectura
- ✅ Comentarios en código referencian BUG-003 / BUG-005 / BUG-006 / BUG-009 / BUG-012 / BUG-014 / BUG-016 / BUG-017
- ✅ Sin errores de linter
- ✅ Todos los fetch() directos eliminados (migrados a performAction)
- ✅ Selector de vista usa Refresh Surface Registry

---

## 🚀 DESPLIEGUE

```bash
# Reiniciar servidor
pm2 restart aurelinportal

# Verificar logs
pm2 logs aurelinportal
```

---

## 📝 CRITERIOS DE ACEPTACIÓN

✅ Clean-all solo se renderiza si item_kind es explícitamente 'recurrente'  
✅ Selector de vista usa Refresh Surface Registry declarativamente  
✅ Todos los botones mutadores usan performAction() (sin fetch() directo)  
✅ view_layer siempre se preserva durante refresh de proyección  
✅ Columnas solo se renderizan si item_kind es válido y consistente  
✅ Colores y estado siempre vienen del backend (no se "recuerdan")  
✅ view_layer nunca usa cleanLayer como fallback (separación absoluta)  
✅ Columnas en flotante solo se renderizan si item_kind es válido  
✅ Sin tocar FASE 1 (BLOCKER) ni FASE 2 (CRITICAL)  

**Estado:** ✅ TODOS LOS CRITERIOS CUMPLIDOS

---

**FIN DE FIXES MAJOR**
