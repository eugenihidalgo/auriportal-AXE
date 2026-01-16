# POST ACTION RECOMPUTE CONTRACT v1

**Versión**: 1.0.0  
**Fecha**: 2025-01-XX  
**Dominio**: MASTER  
**Componente**: Alquimia General

---

## 📋 RESUMEN EJECUTIVO

Este contrato define qué debe recalcularse SIEMPRE después de una acción que muta estado en Alquimia General. El backend es la única autoridad de estado y debe recalcular completamente las proyecciones tras cualquier mutación.

---

## 🎯 PRINCIPIOS CONSTITUCIONALES

### Regla 1: Backend es Única Autoridad

**TODA mutación de estado debe**:
1. ✅ Escribir en PostgreSQL (Source of Truth)
2. ✅ Recalcular proyecciones completamente
3. ✅ Devolver DTO mínimo con `state_by_view_layer` completo
4. ✅ **NUNCA** asumir estado previo en frontend

**PROHIBIDO**: Frontend infiere estados o reutiliza estado previo tras acción.

### Regla 2: Recomputación Obligatoria

**DESPUÉS de cualquier acción que muta estado**:
1. ✅ Recalcular `state_by_view_layer` completo (shared, pde, effective/combo)
2. ✅ Recalcular ubicación del alumno (columna: pending/reviewed/important/never)
3. ✅ Actualizar contadores y fechas
4. ✅ Devolver DTO mínimo con proyección completa

**PROHIBIDO**: Saltarse recomputación porque "ya estaba limpio hoy" o similar.

---

## 🔧 ACCIONES QUE MUTAN ESTADO

### Acciones en Cleaning Engine

1. **`markCleanStudent`**: Limpia item para un estudiante específico
2. **`markCleanAllStudents`**: Limpia item para todos los estudiantes
3. **`incrementAllStudents`**: Incrementa contador (una_vez) para todos
4. **`resetStudentItemProgress`**: Resetea progreso de item para un estudiante
5. **`resetAllStudentsItemProgress`**: Resetea progreso de item para todos

### Características Comunes

- ✅ Todas escriben en `cleaning_events` (event sourcing)
- ✅ Todas actualizan `cleaning_item_state` (proyección)
- ✅ Todas deben recalcular `state_by_view_layer` completo
- ✅ Todas deben devolver estado actualizado

---

## 📐 DTO MÍNIMO OBLIGATORIO

### Para Respuestas POST de Acciones

**OBLIGATORIO** en respuesta:
```json
{
  "ok": true,
  "data": {
    "student_uuid": "...",
    "item_ref": "...",
    "item_kind": "recurrente" | "una_vez",
    "state_by_view_layer": {
      "shared": { "state": "...", "visual_state": "...", ... },
      "pde": { "state": "...", "visual_state": "...", ... },
      "effective": { "state": "...", "visual_state": "...", ... } // Solo si recurrente
    },
    "view_layer": "shared" | "pde" | "effective" | "combo"
  },
  "trace_id": "..."
}
```

**PROHIBIDO**: Devolver solo `ok: true` sin `state_by_view_layer`.

---

## 🔍 RECOMPUTACIÓN OBLIGATORIA

### Paso 1: Escribir en Source of Truth

1. Insertar evento en `cleaning_events` (idempotente)
2. Actualizar `cleaning_item_state` (proyección)
3. **NUNCA** saltarse escritura por "ya estaba limpio hoy"

### Paso 2: Recalcular Proyección

1. Leer estado actualizado desde `cleaning_item_state`
2. Calcular `state_by_view_layer` completo usando CPM (Cleaning Projection Model)
3. **SIEMPRE** calcular para todas las view_layers (shared, pde, effective/combo)
4. **NUNCA** reutilizar cálculo previo

### Paso 3: Devolver DTO Completo

1. Incluir `state_by_view_layer` completo en respuesta
2. Incluir `view_layer` activa
3. Incluir metadatos necesarios (trace_id, etc.)

---

## 🚫 PROHIBICIONES

### Prohibido 1: Lógica "Ya Estaba Limpio Hoy"

**REGLA**: Limpiar SIEMPRE reinicia ciclo, incluso si ya estaba limpio hoy.

**RAZÓN**: La acción de limpieza es un evento que debe registrarse y recalcular estado, no una verificación condicional.

**EJEMPLO INCORRECTO**:
```javascript
if (last_cleaned_at === today) {
  // Saltarse limpieza (INCORRECTO)
  return { skipped: true };
}
```

**EJEMPLO CORRECTO**:
```javascript
// SIEMPRE ejecutar limpieza (idempotencia por execution_key)
await upsertApplyRecurrent({ ... });
// Recalcular estado completo
const newState = await recalculateState(...);
return { state_by_view_layer: newState };
```

### Prohibido 2: Reutilizar Estado Previo en Frontend

**REGLA**: Frontend **NUNCA** debe reutilizar estado previo tras acción.

**EJEMPLO INCORRECTO**:
```javascript
// INCORRECTO: Reutilizar estado previo
const prevState = item.state;
await performAction(...);
item.state = prevState; // ❌ INCORRECTO
```

**EJEMPLO CORRECTO**:
```javascript
// CORRECTO: Refetch completo
const result = await performAction(...);
const newState = result.data.state_by_view_layer[view_layer];
item.state = newState; // ✅ CORRECTO
```

### Prohibido 3: Saltarse Recomputación

**REGLA**: **SIEMPRE** recalcular `state_by_view_layer` completo tras mutación.

**EJEMPLO INCORRECTO**:
```javascript
if (already_clean) {
  return { ok: true }; // ❌ Sin state_by_view_layer
}
```

**EJEMPLO CORRECTO**:
```javascript
// SIEMPRE recalcular
const stateByViewLayer = await recalculateStateByViewLayer(...);
return { ok: true, data: { state_by_view_layer: stateByViewLayer } };
```

---

## ✅ VERIFICACIÓN

### Assembly Check

```bash
# Verificar que no hay lógica "ya estaba limpio hoy"
npm run check:master-ui
```

### Tests Manuales

1. Limpiar item que ya estaba limpio hoy
2. **VERIFICAR**: Se ejecuta limpieza (no se salta)
3. **VERIFICAR**: Se recalcula `state_by_view_layer` completo
4. **VERIFICAR**: Frontend recibe DTO completo y re-renderiza

---

## 📚 REFERENCIAS

- `docs/CONSTITUTION_VIEW_AUTHORITY_V1.md` (View Authority)
- `docs/CLEANING_PROJECTION_MODEL_V1.md` (CPM)
- `src/core/master/services/cleaning-engine-service.js` (Cleaning Engine)
- `src/core/master/services/list-projection-model.js` (List Projection Model)

---

**FIN DEL CONTRATO**
