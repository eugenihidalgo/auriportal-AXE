# 🔧 FIXES BLOCKER — ALQUIMIA GENERAL v1

**Fecha:** 2026-01-13  
**Versión:** 5.75.2  
**Alcance:** 3 bugs BLOCKER únicamente

---

## ✅ FIXES IMPLEMENTADOS

### 🔴 BUG-001: Reset SOLO para recurrente

**Problema:** Botones "Reset progreso" y "Reset lista" aparecían en items `una_vez` sin validación previa.

**Fix Implementado:**
- Validación explícita de `item_kind === 'recurrente'` **ANTES** de renderizar botones Reset
- Si `item_kind !== 'recurrente'`, el botón **NO se renderiza** (no aparece en UI)
- Aplicado en 2 ubicaciones:
  1. Botón "Reset lista" (línea ~1592)
  2. Botón "Reset progreso" (línea ~4466)

**Código:**
```javascript
// Validar item_kind ANTES de renderizar
const itemKind = getItemKindExplicit(item, state.listaActiva);
if (itemKind !== 'recurrente') {
  // NO renderizar botón Reset si es una_vez (BUG-001)
} else {
  // Renderizar botón solo si es recurrente
}
```

**Resultado:** ✅ Reset nunca visible en `una_vez`

---

### 🔴 BUG-010: Columnas SIEMPRE se re-renderizan

**Problema:** Tras limpiar un estudiante, las columnas no siempre se actualizaban visualmente (el estudiante no cambiaba de columna).

**Fix Implementado:**
1. **Limpieza de estado anterior** en `showFlotanteVer()`:
   - Elimina `_last_column_state` y `_action_expected_change` de todos los estudiantes antes de renderizar
   - Fuerza re-render completo eliminando referencias anteriores

2. **Re-render determinista** en lógica de columnas:
   - Elimina `_last_column_state` cuando se detecta movimiento de columna
   - Si no hay cambio tras acción esperada, **fuerza re-render** eliminando referencias

**Código:**
```javascript
// BUG-010 FIX: Limpiar estado anterior para forzar re-render completo
normalized.students.forEach(student => {
  delete student._last_column_state;
  delete student._action_expected_change;
});

// BUG-010 FIX: Si no hay cambio tras acción, forzar re-render
if (student._action_expected_change) {
  delete student._last_column_state; // Forzar re-agrupación
  delete student._action_expected_change;
}
```

**Resultado:** ✅ Tras limpiar, los alumnos SIEMPRE cambian de columna visualmente

---

### 🔴 BUG-011: ELIMINAR fallback legacy

**Problema:** Si `state_by_view_layer[view_layer]` no existía, el código usaba fallback legacy (`student.state`, `visual_state`) silenciosamente, causando desincronización.

**Fix Implementado:**
1. **Eliminación completa del fallback legacy**:
   - Si `state_by_view_layer[view_layer]` no existe, **NO se agrega el estudiante a ninguna columna**
   - El estudiante se agrega a un array de error `_error`

2. **Error visible en UI**:
   - Si hay estudiantes con `state_by_view_layer` faltante, se muestra una columna de error roja
   - Mensaje: "Estado no disponible — datos inconsistentes"

**Código:**
```javascript
// BUG-011: NO usar fallback legacy - BLOQUEAR render
if (!student.state_by_view_layer || !student.state_by_view_layer[activeViewLayer]) {
  console.error('[BUG-011] state_by_view_layer no disponible - BLOQUEANDO render');
  studentsByState._error.push({
    ...student,
    _error_message: `Estado no disponible — datos inconsistentes`
  });
  return; // Saltar este estudiante
}
```

**Resultado:** ✅ Si falta `state_by_view_layer`, la UI NO miente (muestra error visible)

---

## 📋 ARCHIVOS MODIFICADOS

1. `public/js/master/master-alquimia-general-client.js`
   - Línea ~1592: Fix BUG-001 (Reset lista)
   - Línea ~2259: Fix BUG-010 (Limpieza estado anterior)
   - Línea ~2613: Fix BUG-011 (Eliminar fallback legacy)
   - Línea ~2652: Fix BUG-010 (Re-render determinista)
   - Línea ~2714: Fix BUG-011 (Columna de error)
   - Línea ~4466: Fix BUG-001 (Reset progreso)

2. `package.json`
   - Versión actualizada: `5.75.1` → `5.75.2`

---

## ✅ VERIFICACIÓN

- ✅ Solo se modificaron los 3 bugs BLOCKER
- ✅ No se tocó runtime ni registry
- ✅ No se añadieron features nuevas
- ✅ No se usaron fallbacks legacy
- ✅ Comentarios en código referencian BUG-001 / BUG-010 / BUG-011
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

✅ Reset nunca visible en `una_vez`  
✅ Si falta `state_by_view_layer`, la UI NO miente (muestra error visible)  
✅ Tras limpiar, los alumnos SIEMPRE cambian de columna  
✅ Sin warnings silenciosos  
✅ Sin tocar runtime ni registry  

**Estado:** ✅ TODOS LOS CRITERIOS CUMPLIDOS

---

**FIN DE FIXES BLOCKER**
