# 🔧 FIXES BLOCKER — ALQUIMIA GENERAL v2

**Fecha:** 2026-01-13  
**Versión:** 5.75.6  
**Alcance:** 3 bugs BLOCKER únicamente (post Auditoría Funcional Extrema v1)

---

## ✅ FIXES IMPLEMENTADOS

### 🔴 BUG-018: Agregación de Estado ALL Incorrecta en RECURRENTE

**Problema:**  
En proyección ALL para `recurrente`, el backend no calculaba explícitamente el estado agregado canónico. El frontend ordenaba por `item.state_by_view_layer[viewLayer].state`, pero no había un campo explícito `aggregated_state_all` que garantizara la prioridad canónica.

**Prioridad Canónica (NO cambiar):**
1. `never` (si ALGÚN estudiante está en never)
2. `important` (si ALGÚN estudiante está en important)
3. `pending` (si ALGÚN estudiante está en pending)
4. `reviewed` (solo si TODOS están en reviewed)

**Fix Implementado:**
- Función canónica `aggregateStateForAll()` en `list-projection-model.js` (línea ~27)
- Campo `aggregated_state_all` añadido en respuesta cuando `scope='all'` y `item_kind='recurrente'`
- Campo contiene estados agregados para `shared`, `pde`, y `effective` (si aplica)
- Logs forenses con prefijo `[BUG-018]` para debugging

**Ubicación:**
- `src/core/master/services/list-projection-model.js` (líneas ~27-60, ~820-860)

**Código:**
```javascript
// BUG-018 FIX: Función canónica de agregación
function aggregateStateForAll(students, viewLayer) {
  // Prioridad: never > important > pending > reviewed
  if (states.includes('never')) return 'never';
  if (states.includes('important')) return 'important';
  if (states.includes('pending')) return 'pending';
  if (states.every(s => s === 'reviewed')) return 'reviewed';
  return 'pending'; // Fallback seguro
}
```

---

### 🔴 BUG-020: EFFECTIVE No Devuelve state_by_view_layer.effective

**Problema:**  
Para `item_kind === 'recurrente'`, el backend no garantizaba que `state_by_view_layer.effective` siempre estuviera presente. Si el CPM no calculaba effective por alguna razón, el frontend fallaba al intentar acceder a él.

**Fix Implementado:**
- Validación explícita: si `item_kind === 'recurrente'` y `effective` falta, calcularlo explícitamente
- Error estructurado si no se puede calcular (log con prefijo `[BUG-020]`)
- Frontend puede bloquear render si `effective` falta (no hay fallback silencioso)

**Ubicación:**
- `src/core/master/services/list-projection-model.js` (líneas ~795-809)

**Código:**
```javascript
// BUG-020 FIX: Asegurar que effective siempre se devuelve para recurrente
if (item_kind === 'recurrente' && !projection.state_by_view_layer.effective) {
  logError('ListProjectionModel', '[BUG-020] effective no calculado para recurrente', {
    traceId,
    item_ref: item.item_ref,
    item_kind,
    available_layers: Object.keys(projection.state_by_view_layer)
  });
  // Calcular effective explícitamente si falta
  projection.state_by_view_layer.effective = computeCleaningProjection({
    cleaning_state: cleaningState,
    item_kind: item_kind,
    view_layer: 'effective',
    config: effectiveConfig
  }).state_by_view_layer.effective;
}
```

---

### 🔴 BUG-023: Error "vecesLimpiar is not defined"

**Problema:**  
El backend no garantizaba que `veces_limpiar` y `required_count` siempre estuvieran presentes en las respuestas. El frontend podía intentar acceder a `vecesLimpiar` (camelCase) que no existe, o a campos que faltaban.

**Fix Implementado:**
- Backend garantiza que `veces_limpiar` (snake_case, campo base) siempre está presente
- Backend garantiza que `required_count` (campo efectivo con overrides) siempre está presente
- Ambos campos se añaden explícitamente en `effectiveItem` (líneas ~831-832)
- Frontend debe consumir `veces_limpiar` o `required_count`, nunca `vecesLimpiar` (camelCase)

**Ubicación:**
- `src/core/master/services/list-projection-model.js` (líneas ~811-832)

**Código:**
```javascript
// BUG-023 FIX: Garantizar que required_count y veces_limpiar siempre están presentes
const requiredCount = effectiveConfig.required_count !== undefined 
  ? effectiveConfig.required_count 
  : (item.veces_limpiar || 1);
const vecesLimpiar = item.veces_limpiar || 1;

const effectiveItem = {
  ...item,
  // BUG-023 FIX: Garantizar que ambos campos están presentes (snake_case canónico)
  veces_limpiar: vecesLimpiar, // Campo base (obligatorio)
  required_count: requiredCount, // Campo efectivo con overrides (obligatorio)
  // ...
};
```

**Nota:**  
Las referencias a `vecesLimpiar` como variable local en el backend son válidas (ej: `alquimia-general-service.js:357`, `student-transmutation-state-repo-pg.js:275`). El problema era que el backend no garantizaba que estos campos estuvieran en las respuestas.

---

## 📋 VERIFICACIÓN

### Checks Ejecutados:
- ✅ `npm run check:runtime-core` (sin cambios en runtime)
- ✅ `npm run check:ux-refresh` (sin cambios en UX actions)
- ✅ Linter: sin errores

### Pruebas Manuales Requeridas:
1. **Recurrente → ALL → orden correcto:**
   - Verificar que items se ordenan por prioridad canónica (never > important > pending > reviewed)
   - Verificar que `aggregated_state_all` está presente en respuesta

2. **Recurrente → EFFECTIVE → no error:**
   - Seleccionar vista EFFECTIVE en recurrente
   - Verificar que `state_by_view_layer.effective` está presente
   - Verificar que no hay errores en consola

3. **Una vez → sin ReferenceError:**
   - Verificar que `veces_limpiar` y `required_count` están presentes
   - Verificar que no hay errores de "vecesLimpiar is not defined"

---

## 🔄 CAMBIOS TÉCNICOS

### Archivos Modificados:
1. `src/core/master/services/list-projection-model.js`
   - Función `aggregateStateForAll()` añadida
   - Campo `aggregated_state_all` añadido en respuesta
   - Validación de `effective` para recurrente
   - Garantía de `veces_limpiar` y `required_count` en respuestas

### Sin Cambios en:
- Runtime Core
- UX Action Registry
- Frontend (solo backend fixes)

---

## 📝 NOTAS

- **BUG-018:** El campo `aggregated_state_all` solo se añade cuando `scope='all'` y `item_kind='recurrente'`
- **BUG-020:** El cálculo de `effective` es idempotente (si ya existe, no se recalcula)
- **BUG-023:** Los campos `veces_limpiar` y `required_count` son obligatorios en todas las respuestas de items

---

**Versión:** 5.75.5 → 5.75.6  
**Commit:** `fix(blocker): cerrar agregación ALL, effective obligatorio y naming contract`
