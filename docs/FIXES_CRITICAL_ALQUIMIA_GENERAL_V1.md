# 🔧 FIXES CRITICAL — ALQUIMIA GENERAL v1

**Fecha:** 2026-01-13  
**Versión:** 5.75.3  
**Alcance:** 5 bugs CRITICAL únicamente

---

## ✅ FIXES IMPLEMENTADOS

### 🔴 BUG-002: Validación dura en increment-all

**Problema:** Los handlers `handleIncrementAllItem` y `handlePdeIncrementAllItem` no validaban explícitamente que `item_kind === 'una_vez'` antes de ejecutar la acción.

**Fix Implementado:**
- Validación explícita `item_kind === 'una_vez'` **ANTES** de ejecutar increment-all
- Si `item_kind !== 'una_vez'`, la acción se **aborta** con toast de error
- Aplicado en 2 handlers:
  1. `handleIncrementAllItem` (línea ~5059)
  2. `handlePdeIncrementAllItem` (línea ~5127)

**Código:**
```javascript
// BUG-002 FIX: Validación dura - Increment-all SOLO para una_vez
if (itemKind !== 'una_vez') {
  console.error('[BUG-002] Increment-all NO permitido para recurrente');
  showToastError('ERROR: Increment-all solo está permitido para items "una vez". Este item es recurrente.');
  return;
}
```

**Resultado:** ✅ Increment-all imposible en recurrente

---

### 🔴 BUG-013: Eliminar cálculo de colores en frontend

**Problema:** En el flotante, cuando `layerView === 'combo'` y `itemKind === 'recurrente'`, se calculaba el estado (`sharedStateText`, `pdeStateText`) basándose en `days_since_last_clean` y comparándolo con `thresholdDays` y `criticalThreshold`. Esto viola View Authority v1.

**Fix Implementado:**
1. **Eliminado cálculo de estado** basado en `days_since_last_clean`
2. **Consumo directo** de `state_by_view_layer[view_layer].state` desde backend
3. **Mapeo de display** (solo texto legible, no cálculo de estado)
4. **Bloqueo de render** si falta `state_by_view_layer` (igual que BUG-011)

**Código:**
```javascript
// BUG-013 FIX: NO calcular estado en frontend - consumir desde state_by_view_layer
const sharedStateData = student.state_by_view_layer?.shared;
const pdeStateData = student.state_by_view_layer?.pde;

if (!sharedStateData || !pdeStateData) {
  // Bloquear render si falta (igual que BUG-011)
  stateDiv.textContent = 'Estado no disponible';
  console.error('[BUG-013] state_by_view_layer faltante');
} else {
  // Consumir estado directamente desde backend (NO calcular)
  const sharedState = sharedStateData.state || 'never';
  const pdeState = pdeStateData.state || 'never';
  // Mapear a texto legible (solo display, no cálculo)
}
```

**Resultado:** ✅ Colores siempre vienen del backend (no se calculan en frontend)

---

### 🔴 BUG-007 / BUG-015: Refresh completo de flotante tras clean-all

**Problema:** Tras ejecutar `clean-all` (shared o pde) o `increment-all`, el flotante no siempre se refrescaba correctamente, y cuando se refrescaba, podía resetear `layerView` a 'shared' por defecto.

**Fix Implementado:**
1. **Refresh explícito** del flotante tras `clean-all` e `increment-all` si está abierto
2. **Preservación de `layerView`** activo (no resetear a 'shared' o 'pde' automáticamente)
3. **Llamada explícita** a `handleVerItem()` con `layerView` preservado
4. Aplicado en 4 handlers:
   - `handleLimpiarItem` (shared clean-all)
   - `handlePdeCleanItem` (pde clean-all)
   - `handleIncrementAllItem` (shared increment-all)
   - `handlePdeIncrementAllItem` (pde increment-all)

**Código:**
```javascript
// BUG-007 / BUG-015 FIX: Forzar refresh explícito de flotante si está abierto
// Preservar layerView activo (no resetear a 'shared')
if (state.projection.mode === 'operativa' && state.modal.item && state.modal.item.item_ref === item.item_ref) {
  const preservedLayerView = state.modal.layerView || 'shared';
  const preservedCleanLayer = cleanLayer;
  
  // Refrescar flotante preservando vista activa
  await handleVerItem(state.modal.item, preservedCleanLayer, preservedLayerView);
}
```

**Resultado:** ✅ Flotante SIEMPRE se refresca tras clean-all, preservando la vista activa

---

### 🔴 BUG-008: Detección robusta de flotante abierto

**Problema:** El `buildRefreshPlan` en `alquimia-actions.js` intentaba detectar si el flotante estaba abierto usando `window.__AP_ALQUIMIA_STATE__`, pero este estado puede no estar disponible en tiempo de ejecución. Si no puede determinar si está abierto, no refresca el flotante.

**Fix Implementado:**
1. **Estrategia robusta**: Si `context.item_ref` existe, **siempre** incluir `alquimia.flotante_students` en el refresh plan
2. **Idempotencia**: Refrescar aunque no esté abierto no es error (el refresh es idempotente)
3. **NO depender** de `window.__AP_ALQUIMIA_STATE__`

**Código:**
```javascript
// BUG-008 FIX: Detección robusta - Si hay item_ref, refrescar siempre (idempotente)
if (context.item_ref) {
  // Estrategia robusta - Si hay item_ref, refrescar flotante siempre
  // El refresh es idempotente (refrescar aunque no esté abierto no es error)
  surfaces.push('alquimia.flotante_students');
  console.log('[BUG-008] Flotante incluido en refresh plan (item_ref presente)');
}
```

**Resultado:** ✅ Detección robusta de flotante (siempre refresca si hay item_ref)

---

## 📋 ARCHIVOS MODIFICADOS

1. `public/js/master/master-alquimia-general-client.js`
   - Línea ~5059: Fix BUG-002 (handleIncrementAllItem)
   - Línea ~5127: Fix BUG-002 (handlePdeIncrementAllItem)
   - Línea ~2988: Fix BUG-013 (Eliminar cálculo de estado en combo recurrente)
   - Línea ~2246: Fix BUG-007/BUG-015 (Refresh flotante tras clean-all shared)
   - Línea ~5027: Fix BUG-007/BUG-015 (Refresh flotante tras clean-all pde)
   - Línea ~5096: Fix BUG-007/BUG-015 (Refresh flotante tras increment-all shared)
   - Línea ~5165: Fix BUG-007/BUG-015 (Refresh flotante tras increment-all pde)

2. `src/core/ux/action-registry/alquimia-actions.js`
   - Línea ~59: Fix BUG-008 (Detección robusta de flotante)

3. `package.json`
   - Versión actualizada: `5.75.2` → `5.75.3`

---

## ✅ VERIFICACIÓN

- ✅ Solo se modificaron los 5 bugs CRITICAL
- ✅ No se tocaron fixes de FASE 1 (BLOCKER)
- ✅ No se añadieron features nuevas
- ✅ No se refactorizó arquitectura
- ✅ Comentarios en código referencian BUG-002 / BUG-007 / BUG-008 / BUG-013 / BUG-015
- ✅ Sin errores de linter

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

✅ Increment-all imposible en recurrente  
✅ Colores siempre vienen del backend (no se calculan)  
✅ Flotante SIEMPRE se refresca tras clean-all  
✅ La vista (shared/pde/effective) se preserva  
✅ Detección robusta de flotante (siempre refresca si hay item_ref)  
✅ Sin tocar FASE 1 (BLOCKER)  

**Estado:** ✅ TODOS LOS CRITERIOS CUMPLIDOS

---

**FIN DE FIXES CRITICAL**
