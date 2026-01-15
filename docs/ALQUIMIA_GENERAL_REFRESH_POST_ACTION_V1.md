# ALQUIMIA GENERAL — REFRESCO POST-ACCIÓN v1

**Documentación canónica del sistema de refresco unificado tras mutaciones en Alquimia General (MASTER)**

---

## 1) Contexto y Problema

### Síntoma
- "Limpiar a veces no se pone verde" — el estado `reviewed` no se reflejaba inmediatamente en la UI
- "Reset errático" — reset no refrescaba la proyección correctamente o mostraba estado inconsistente
- Comportamiento no determinista: a veces funcionaba, a veces no, dependiendo de la lista/ítem/acción

### Causa Raíz
1. **Patrón de refresco inconsistente**: limpiar y reset usaban lógicas distintas para refrescar la UI
2. **Doble render en reset**: `loadListProjection()` ya llama a `renderView()` internamente, pero se llamaba `renderView()` otra vez explícitamente después
3. **Reset no refrescaba modal**: reset eliminaba estado pero no refrescaba el modal flotante si estaba abierto (limpiar sí lo hacía)
4. **Invalidación inconsistente**: reset invalidaba `state.projection.data = null` explícitamente, limpiar no siempre lo hacía
5. **Llamadas duplicadas**: botones de limpieza en proyección llamaban a `loadListProjection()` + `renderView()` después de `handleLimpiarEstudiante()`, que ya refrescaba internamente

---

## 2) Fuente de Verdad (SOT)

### Backend es Autoridad Única
- El backend calcula `state_by_view_layer[viewLayer].state` usando Cleaning Projection Model (CPM)
- El cálculo se hace en el endpoint GET `/master/api/alquimia-general/list-projection`
- Estados posibles: `never`, `pending`, `important`, `reviewed`, `completed`

### Frontend Solo Consume
- La UI NO calcula estados
- La UI solo consume `item.state_by_view_layer[viewLayer].state` del backend
- Verde = `state === 'reviewed' || state === 'completed'` (línea ~1726 de `master-alquimia-general-client.js`)

### Proyección como Contrato
- `state.projection.data` contiene los datos de proyección desde el backend
- `state.projection.view_layer` determina qué capa de estado se muestra (`shared`, `pde`, `combo`, `effective`)
- `state.projection.mode` determina si estamos en `'operativa'` o `'proyeccion'`

---

## 3) Flujos Canónicos Post-Acción (Norma)

### Regla Absoluta: PROYECCIÓN
En modo PROYECCIÓN (`state.projection.mode === 'proyeccion'`), tras cualquier mutación (clean/reset):

1. **Invalidar estado**: `state.projection.data = null` (forzar recarga desde servidor)
2. **Refrescar modal** (si aplica): si `state.modal.item` existe y `item_ref` coincide → llamar `handleVerItem()` con `state.modal.layerView`
3. **Recargar proyección**: `await loadListProjection()` (ya llama a `renderView()` internamente)
4. **NO llamar `renderView()` después**: `loadListProjection()` ya renderiza (línea 1397)

### Regla Absoluta: MODAL
Si el modal flotante está abierto (`state.modal.item` existe) y la acción afecta a un `item_ref` concreto:

- **Limpiar estudiante**: refrescar modal con `state.modal.layerView` activo
- **Reset ítem**: refrescar modal igual que limpiar (consistencia)
- **Reset lista**: no refrescar modal (afecta múltiples ítems)
- **Limpiar ALL**: refrescar modal si está abierto del mismo ítem

### Regla Absoluta: OPERATIVA
En modo OPERATIVA (`state.projection.mode === 'operativa'`):

- **NO usar helper de proyección**: usar `loadItems()` directamente
- **Modal**: refrescar manualmente si aplica (fuera del helper)

---

## 4) Helper Canónico de Frontend

### Función: `refreshAfterProjectionMutation()`

**Ubicación**: `public/js/master/master-alquimia-general-client.js` (línea ~1328)

**Firma**:
```javascript
async function refreshAfterProjectionMutation({ 
  reason,           // string: razón del refresco (para logs forenses)
  item_ref = null,  // string|null: item_ref si aplica (para refrescar modal)
  forceModalRefresh = false  // boolean: si true, refresca modal si está abierto
})
```

**Comportamiento EXACTO**:

1. **Guard**: si `state.projection?.mode !== 'proyeccion'` → return (sin hacer nada)
2. **Invalidar SIEMPRE**: `state.projection.data = null`
3. **Refrescar modal** (si `forceModalRefresh === true` y `state.modal?.item` existe y `item_ref` coincide):
   - Llamar `handleVerItem(state.modal.item, 'shared', state.modal.layerView || 'shared')`
   - Usar `state.modal.layerView` como view_layer activo
4. **Recargar proyección**: `await loadListProjection()` (NO llamar `renderView()` después)
5. **Log forense**: `console.log('[UI][REFRESH_AFTER_MUTATION]', {...})`

**Reglas Críticas**:
- ❌ **PROHIBIDO**: llamar `renderView()` después de `loadListProjection()` (doble render)
- ❌ **PROHIBIDO**: usar helper fuera de modo proyección (guard lo previene)
- ✅ **OBLIGATORIO**: invalidar `state.projection.data` antes de recargar
- ✅ **OBLIGATORIO**: usar `state.modal.layerView` para refrescar modal (no hardcodear)

---

## 5) Acciones Cubiertas

### clean-student
**Handler**: `handleLimpiarEstudiante()` (línea ~3180)

**Uso del helper**:
```javascript
await refreshAfterProjectionMutation({ 
  reason: 'clean-student', 
  item_ref: item.item_ref,
  forceModalRefresh: !!(state.modal?.item && state.modal.item.item_ref === item.item_ref)
});
```

**Comportamiento**: Limpia un ítem para un alumno específico en proyección. Refresca modal si está abierto del mismo ítem.

### clean-all
**Handler**: `handleLimpiarItem()` (línea ~1999)

**Uso del helper**:
```javascript
if (state.projection.mode === 'proyeccion') {
  await refreshAfterProjectionMutation({ 
    reason: 'clean-all', 
    item_ref: item.item_ref,
    forceModalRefresh: !!(state.modal?.item && state.modal.item.item_ref === item.item_ref)
  });
} else {
  // Modo operativa: loadItems() directamente
}
```

**Comportamiento**: Limpia un ítem para todos los alumnos. Solo usa helper si está en proyección. En operativa, usa `loadItems()` directamente.

### reset-item
**Handler**: Botón "Reset progreso" en proyección (línea ~4308)

**Uso del helper**:
```javascript
await refreshAfterProjectionMutation({ 
  reason: 'reset-item', 
  item_ref: item.item_ref,
  forceModalRefresh: true  // Siempre refrescar modal si está abierto
});
```

**Comportamiento**: Resetea progreso de un ítem para un alumno. Siempre refresca modal si está abierto (consistencia con limpiar).

### reset-list
**Handler**: Botón "Reset lista" en proyección (línea ~1500)

**Uso del helper**:
```javascript
await refreshAfterProjectionMutation({ 
  reason: 'reset-list', 
  item_ref: null,  // No hay item_ref específico
  forceModalRefresh: false  // No refrescar modal (afecta múltiples ítems)
});
```

**Comportamiento**: Resetea progreso de todos los ítems de una lista para un alumno. No refresca modal (afecta múltiples ítems).

---

## 6) Tests de Verificación (Checklist)

### Smoke Tests Manuales

En `/master/templo-luz/alquimia-general`:

#### ✅ Test 1: Limpiar Ítem en Proyección
1. Entrar en PROYECCIÓN → Alumno → Lista recurrente
2. Pulsar "Limpiar" (SHARED o PDE) en un ítem
3. **Esperado**: Ítem se pone verde inmediatamente (sin recargar página)
4. **Verificar consola**: Debe aparecer `[UI][REFRESH_AFTER_MUTATION]` con `reason: 'clean-student'`

#### ✅ Test 2: Limpiar con Modal Abierto
1. Abrir modal flotante de un ítem (botón "VER")
2. Pulsar "Limpiar" en ese mismo ítem desde la tabla
3. **Esperado**: 
   - Ítem se pone verde en la tabla
   - Modal se refresca y muestra el estudiante en columna "REVISADO"
4. **Verificar consola**: Logs de `handleVerItem()` y `refreshAfterProjectionMutation()`

#### ✅ Test 3: Reset Ítem
1. Con un ítem en estado "reviewed" (verde)
2. Pulsar "Reset progreso"
3. **Esperado**: Ítem vuelve a "never" (sin verde) inmediatamente
4. **Verificar consola**: `[UI][REFRESH_AFTER_MUTATION]` con `reason: 'reset-item'`

#### ✅ Test 4: Reset Ítem con Modal Abierto
1. Abrir modal flotante de un ítem
2. Pulsar "Reset progreso" de ese ítem
3. **Esperado**: 
   - Ítem vuelve a "never" en la tabla
   - Modal se refresca y muestra el estudiante en columna "NUNCA"
4. **Verificar**: Modal se refresca igual que en limpiar (consistencia)

#### ✅ Test 5: Reset Lista
1. Con varios ítems en diferentes estados
2. Pulsar "Reset lista"
3. **Esperado**: Todos los ítems vuelven a "never" inmediatamente
4. **Verificar consola**: `[UI][REFRESH_AFTER_MUTATION]` con `reason: 'reset-list'`

#### ✅ Test 6: Limpiar ALL en Proyección
1. En modo PROYECCIÓN
2. Pulsar "Limpiar" (ALL) desde flotante de un ítem
3. **Esperado**: Proyección se refresca y muestra cambios inmediatamente
4. **Verificar**: Solo se refresca si estás en proyección (no en operativa)

#### ✅ Test 7: Operativa No Cambia
1. En modo OPERATIVA
2. Realizar cualquier acción de limpieza
3. **Esperado**: No se usa helper de proyección, funciona como antes
4. **Verificar**: No aparece `[UI][REFRESH_AFTER_MUTATION]` en consola

#### ✅ Test 8: Sin Doble Render
1. Abrir DevTools → Network → Filtrar por "list-projection"
2. Realizar cualquier acción (limpiar/reset)
3. **Esperado**: Solo 1 request a `list-projection` (no 2)
4. **Verificar consola**: Solo 1 log de `[TRACE][renderView]` después de la acción

---

## 7) Nota Forense

### Por Qué Había Doble Render

**Problema original**:
- `loadListProjection()` ya llama a `renderView()` internamente (línea 1397)
- Los handlers de reset llamaban:
  1. `await loadListProjection()` → llama `renderView()` (primera vez)
  2. `renderView()` explícito → segunda vez (redundante)

**Solución**:
- Helper `refreshAfterProjectionMutation()` llama solo a `loadListProjection()`
- NO llama a `renderView()` después
- Regla absoluta: **nunca llamar `renderView()` después de `loadListProjection()`**

### Por Qué Reset No Refrescaba Modal

**Problema original**:
- `handleLimpiarEstudiante()` refrescaba modal manualmente
- Reset no tenía esa lógica

**Solución**:
- Helper unifica el comportamiento
- Reset usa `forceModalRefresh: true` para refrescar modal igual que limpiar
- Consistencia: ambas acciones refrescan modal si está abierto

### Invalidación Consistente

**Antes**:
- Reset invalidaba `state.projection.data = null` explícitamente
- Limpiar no siempre lo hacía

**Ahora**:
- Helper SIEMPRE invalida `state.projection.data = null` antes de recargar
- Garantiza que siempre se recarga desde servidor (no caché local)

---

## 8) Metadatos

**Versión del Fix**: v1  
**Commit Hash**: `590cf26`  
**Fecha**: 2026-01-15  
**Archivo Modificado**: `public/js/master/master-alquimia-general-client.js`  
**Líneas Cambiadas**: +82 / -100

**Build Info**:
- Helper ubicado en línea ~1328
- Usado en 4 puntos: reset-item, reset-list, clean-student, clean-all

---

**FIN DEL DOCUMENTO**
