# FIX: Lectura de Estado Recurrente desde Proyección Backend v1

**FECHA:** 2026-01-27  
**DOMINIO:** MASTER  
**TIPO:** Fix de UI (lectura de estado)

---

## PROBLEMA IDENTIFICADO

Tras reset SHARED de un item recurrente, el frontend leía `days_since_last_clean` desde una ubicación que el backend NO proyecta:

- **Backend proyecta:** `student.state_by_view_layer.shared.metrics.days_since_last_clean = 0`
- **Frontend leía:** `student.shared?.days_since_last_clean` → `undefined`

Esto causaba:
- "undefined" en UI
- Necesidad de doble click
- Violación de Consistencia Acción → Proyección → Ubicación

---

## SOLUCIÓN IMPLEMENTADA

### Función Canónica Única de Lectura

Creada función `getRecurrenteStateFromProjection(student, viewLayer)` que:

1. **Lee EXCLUSIVAMENTE desde:** `student.state_by_view_layer[viewLayer]`
2. **Extrae:** `days_since_last_clean` desde `metrics.days_since_last_clean`
3. **Fail-loud:** Si falta `state_by_view_layer` → `console.error` + retorna `null`
4. **PROHIBIDO:** Fallback a `student.shared` o `student.pde`

### Ubicaciones Corregidas

1. **Flotante - COMBO RECURRENTE** (línea ~3271):
   - Antes: `student.shared?.days_since_last_clean`
   - Después: `getRecurrenteStateFromProjection(student, 'shared')`

2. **Flotante - SHARED/PDE RECURRENTE** (línea ~3294):
   - Antes: `student.shared?.days_since_last_clean` / `student.pde?.days_since_last_clean`
   - Después: `getRecurrenteStateFromProjection(student, activeViewLayer)`

3. **Log Forense** (línea ~3749):
   - Antes: `student.state_by_view_layer?.[cleanLayer]?.computed_state?.days_since_last_clean`
   - Después: `getRecurrenteStateFromProjection(student, cleanLayer)`

---

## REGLAS CONSTITUCIONALES RESPETADAS

✅ Frontend NO infiere estado  
✅ Frontend NO calcula estado  
✅ Frontend SOLO lee proyecciones backend  
✅ Fuente Única de Columnas = `state_by_view_layer`  
✅ NO usar `student.shared` ni `student.pde` para estado recurrente  
✅ NO modificar Action Registry  
✅ NO modificar `performAction()`  
✅ NO modificar backend  
✅ NO introducir fallbacks silenciosos  
✅ Si falta `state_by_view_layer` → error visible (fail-loud)

---

## VERIFICACIÓN

### Casos de Prueba

1. **Reset SHARED de ítem recurrente:**
   - ✅ `days_since = 0` (no undefined)
   - ✅ `state = 'never'`
   - ✅ UI muestra "0d" o "Nunca" correctamente

2. **Primer click tras reset:**
   - ✅ Un solo click funciona
   - ✅ `days_since = 0` correcto
   - ✅ `last_cleaned_at` correcto
   - ✅ Alumno se mueve de columna correctamente

3. **Todos los alumnos, todas las listas recurrentes:**
   - ✅ Ningún "undefined"
   - ✅ Consistencia visual total

4. **Verificación de no-regresión:**
   - ✅ Action Registry NO modificado
   - ✅ `performAction()` NO modificado
   - ✅ Backend NO modificado

---

## ARCHIVOS MODIFICADOS

- `public/js/master/master-alquimia-general-client.js`
  - Función nueva: `getRecurrenteStateFromProjection()` (línea ~3548)
  - Fix: Flotante COMBO RECURRENTE (línea ~3271)
  - Fix: Flotante SHARED/PDE RECURRENTE (línea ~3294)
  - Fix: Log forense (línea ~3749)
  - BUILD_STAMP actualizado

---

## COMMIT

```
fix(ui): read recurrent state exclusively from state_by_view_layer projection

- Created getRecurrenteStateFromProjection() canonical function
- Replaced all student.shared/pde.days_since_last_clean accesses
- Fail-loud if state_by_view_layer missing (no silent fallbacks)
- Fixes undefined in UI after SHARED reset
- Restores Action → Projection → Location consistency
```

---

## REFERENCIAS

- Diagnóstico: `docs/DIAGNOSTICO_RESET_SHARED_RECURRENTE_V1.md`
- Contrato View Authority: `docs/CONSTITUTION_VIEW_AUTHORITY_V1.md`
- CPM v2: `src/core/master/services/cleaning-projection-model.js`

---

**FIN DEL FIX**
