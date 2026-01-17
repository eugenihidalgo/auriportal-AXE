# DIAGNÓSTICO FASE 0 — OVERRIDES SYSTEM
## Análisis del Sistema Real Antes de Implementar Contrato Canónico

**Fecha:** 2026-01-13  
**Objetivo:** Localizar dónde se aplican overrides y verificar problemas antes de implementar contrato canónico

---

## 1) LUGARES DONDE SE APLICAN OVERRIDES

### Lugar #1: LPM (List Projection Model) - scope='student'

**Archivo:** `src/core/master/services/list-projection-model.js:805-811`

**Contexto:** Proyección de lista para un estudiante específico

**Código real:**
```javascript
if (scope === 'student' && studentId) {
  // Aplicar overrides de configuración de item
  effectiveConfig = await resolveItemConfigForStudent(
    effectiveConfig,
    studentId,
    item.item_ref
  );
}
```

**Cuándo se aplica:**
- Solo si `scope === 'student'` (línea 805)
- Solo si `studentId` está presente
- ANTES de calcular proyección con CPM (línea 815)

**✅ CUMPLE:** Overrides SOLO se aplican en `scope='student'`, NUNCA en `scope='all'` (línea 790-792)

---

### Lugar #2: Alquimia Alumno Megalist Service

**Archivo:** `src/core/master/services/alquimia-alumno-megalist-service.js:448-453`

**Contexto:** Construcción de megalist para un estudiante

**Código real:**
```javascript
const config = itemKind === 'recurrente' ? {
  threshold_days: item.frecuencia_dias || 7,
  critical_multiplier: item.critical_multiplier || 2.0
} : {
  required_count: item.veces_limpiar || 1
};
```

**⚠️ PROBLEMA DETECTADO:**
- Overrides NO se aplican en megalist
- Solo usa valores base del item
- No llama a `resolveItemConfigForStudent()`

**Efecto:**
- Megalist NO muestra overrides personalizados
- Inconsistencia con LPM que SÍ aplica overrides

---

### Lugar #3: CPM (Cleaning Projection Model)

**Archivo:** `src/core/master/services/cleaning-projection-model.js:40-78`

**Contexto:** Cálculo de proyección de estado

**Código real:**
```javascript
export function computeEffectiveState({ item_kind, view_layer, item_config, cleaning_state, overrides = {} }) {
  const { threshold_days = 7, critical_multiplier = 2.0, required_count = 1 } = item_config || {};
  ...
}
```

**⚠️ OBSERVACIÓN:**
- CPM recibe `item_config` que ya tiene overrides aplicados (si vienen)
- CPM NO aplica overrides directamente (recibe config efectiva)
- CPM NO valida valores de overrides

**✅ CUMPLE:** CPM NO aplica overrides, solo los consume (separación de responsabilidades correcta)

---

## 2) VERIFICACIONES

### ¿Afectan scope=all?

**✅ NO afectan scope=all**

**Evidencia:**
- LPM tiene guard explícito (línea 790-792):
  ```javascript
  if (scope === 'all') {
    // En scope='all', usar valores base (sin overrides)
    // Esto es constitucional: ALL muestra estado agregado sin personalizaciones
  }
  ```

**✅ CUMPLE:** Overrides NO se aplican en `scope='all'`.

---

### ¿Modifican estado persistido?

**✅ NO modifican estado persistido**

**Evidencia:**
- Overrides se escriben en tablas separadas:
  - `student_overrides` (campos de estudiante: nivel, fecha_creacion, apodo)
  - `student_item_overrides` (configuración de items: required_count, threshold_days, nivel, descripcion)
- Overrides NO se escriben en `cleaning_item_state`
- Overrides NO modifican `cleaning_events`

**✅ CUMPLE:** Overrides NO modifican estado persistido (solo lectura efectiva).

---

### ¿Se validan?

**⚠️ NO se validan**

**Evidencia:**
- `resolveItemConfigForStudent()` NO valida valores (línea 95-179)
- NO valida que `required_count >= 1`
- NO valida que `threshold_days >= 1`
- NO valida que `critical_multiplier >= 1.0`
- NO valida que `nivel >= 0`
- Solo convierte tipos (Number, String) sin validar rangos

**⚠️ PROBLEMA:** Overrides NO se validan antes de aplicar.

**Riesgos:**
- Override `required_count = 0` puede causar estados incorrectos
- Override `threshold_days = 0` puede causar estados incorrectos
- Override `critical_multiplier = 0.5` puede causar estados incorrectos

---

## 3) PROBLEMAS DETECTADOS

### Problema #1: Overrides NO se aplican en Megalist

**Código real (`alquimia-alumno-megalist-service.js:448-453`):**
```javascript
const config = itemKind === 'recurrente' ? {
  threshold_days: item.frecuencia_dias || 7,
  critical_multiplier: item.critical_multiplier || 2.0
} : {
  required_count: item.veces_limpiar || 1
};
```

**⚠️ PROBLEMA:**
- Megalist NO aplica overrides
- Solo usa valores base del item
- Inconsistencia con LPM que SÍ aplica overrides

**Efecto:**
- Megalist y LPM pueden mostrar estados diferentes para el mismo item
- Overrides personalizados NO se reflejan en megalist

---

### Problema #2: Overrides NO se validan

**Código real (`override-resolution-service.js:95-179`):**
```javascript
if (override_key === 'required_count') {
  const value = typeof override_value === 'number' ? override_value : Number(override_value);
  effectiveConfig.required_count = value;
  // NO valida que value >= 1
}
```

**⚠️ PROBLEMA:**
- Overrides NO validan valores antes de aplicar
- Pueden causar estados incorrectos si valores son inválidos
- NO hay fallback seguro si override es inválido

**Riesgos:**
- Override `required_count = 0` → estado siempre `'completed'`
- Override `threshold_days = 0` → estado siempre `'important'`
- Override `critical_multiplier = 0.5` → estado siempre `'important'`

---

### Problema #3: Overrides se aplican después de CPM en algunos lugares

**⚠️ OBSERVACIÓN:**
- En LPM, overrides se aplican ANTES de CPM (línea 807-811) ✅
- En megalist, overrides NO se aplican ⚠️

**Contrato canónico esperado:**
- Overrides SOLO deben aplicarse ANTES de CPM
- Overrides NUNCA deben aplicarse después de CPM

---

## 4) COMPORTAMIENTOS CORRECTOS DETECTADOS

### ✅ Overrides NO afectan scope='all'

- LPM tiene guard explícito que NO aplica overrides en `scope='all'` (línea 790-792)
- Guard es constitucional y documentado

### ✅ Overrides NO modifican estado persistido

- Overrides se escriben en tablas separadas (`student_overrides`, `student_item_overrides`)
- Overrides NO modifican `cleaning_item_state` ni `cleaning_events`

### ✅ Overrides se aplican ANTES de CPM en LPM

- LPM aplica overrides antes de llamar a CPM (línea 807-811)
- CPM recibe config efectiva con overrides aplicados

---

## 5) RESUMEN DE PROBLEMAS

### Problemas Críticos:

1. **Overrides NO se aplican en Megalist:**
   - ❌ Megalist NO llama a `resolveItemConfigForStudent()`
   - ❌ Inconsistencia con LPM que SÍ aplica overrides
   - ✅ Debe aplicar overrides ANTES de calcular estado

2. **Overrides NO se validan:**
   - ❌ NO valida que `required_count >= 1`
   - ❌ NO valida que `threshold_days >= 1`
   - ❌ NO valida que `critical_multiplier >= 1.0`
   - ❌ NO valida que `nivel >= 0`
   - ✅ Debe validar valores antes de aplicar

### Problemas Menores:

3. **No hay función centralizada de resolución efectiva:**
   - ⚠️ `resolveItemConfigForStudent()` resuelve, pero no valida
   - ✅ Debe centralizarse en `resolveEffectiveItemConfigForStudent()` con validación

---

## 6) REQUISITOS PARA CONTRATO CANÓNICO

Basado en el diagnóstico, el contrato canónico debe:

1. ✅ **Centralizar resolución:** `resolveEffectiveItemConfigForStudent()` con validación
2. ✅ **Aplicar SOLO antes de CPM:** Nunca después, nunca en LPM ALL
3. ✅ **Validar valores:** `required_count >= 1`, `threshold_days >= 1`, `critical_multiplier >= 1.0`, `nivel >= 0`
4. ✅ **Aplicar en Megalist:** Megalist debe aplicar overrides igual que LPM
5. ✅ **Ignorar inválidos:** Overrides inválidos se ignoran con WARN, no rompen cálculo
6. ✅ **NO modificar estado:** Overrides solo afectan lectura, nunca escritura

---

**FIN DEL DIAGNÓSTICO FASE 0**
