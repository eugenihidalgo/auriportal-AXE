# DIAGNÓSTICO FASE 0 — CPM v2 (OBLIGATORIO ANTES DE CAMBIAR)

**Fecha:** 2025-01-27  
**Objetivo:** Enumerar TODAS las rutas donde se calcula o infiere estado

---

## RUTAS DONDE SE CALCULA ESTADO

### 1. `list-projection-model.js` → `computeListProjection()`

**Ubicación:** `src/core/master/services/list-projection-model.js:624`

**Flujo:**
- Obtiene estados brutos desde `getCleaningStatesForItems()`
- Calcula `combo` para `una_vez` (línea 724-729)
- Llama a `computeCleaningProjection()` del CPM (línea 759)
- **USO CORRECTO:** Delega al CPM

**Problemas detectados:**
- ❌ Calcula `combo` manualmente antes de pasar al CPM (línea 724-729)
- ❌ No pasa `effective_since` al CPM (queries SQL no lo incluyen en `getCleaningStatesForItems`)

---

### 2. `alquimia-general-service.js` → `getStudentsForItem()`

**Ubicación:** `src/services/alquimia-general-service.js:540`

**Flujo:**
- Obtiene datos brutos desde repositorio
- Llama a `computeVisualState()` del CPM (líneas 706, 735, 743, 831, 857, 865, 873)
- **USO CORRECTO:** Delega al CPM

**Problemas detectados:**
- ❌ Calcula `combo` manualmente antes de pasar al CPM (líneas 813-826)
- ❌ No pasa `effective_since` al CPM (datos brutos no lo incluyen)

---

### 3. `alquimia-alumno-megalist-service.js` → `getMegalistForStudent()`

**Ubicación:** `src/core/master/services/alquimia-alumno-megalist-service.js:103`

**Flujo:**
- Obtiene estados desde `cleaning_item_state`
- Calcula `combo` manualmente (líneas 456-467)
- Llama a `computeVisualState()` del CPM (líneas 495, 520, 546, 573)
- **USO CORRECTO:** Delega al CPM

**Problemas detectados:**
- ❌ Calcula `combo` manualmente antes de pasar al CPM (líneas 456-467)
- ❌ Query SQL no incluye `effective_since` (líneas 190-212)
- ❌ No pasa `effective_since` al CPM

---

### 4. `cleaning-projection-model.js` → `computeStateForLayer()` (CPM ACTUAL)

**Ubicación:** `src/core/master/services/cleaning-projection-model.js:29`

**Problemas detectados:**
- ❌ Usa `had_history` (PROHIBIDO según reglas)
- ❌ Lógica de `effective_since` mezclada con `had_history`
- ❌ Para UNA_VEZ: usa `effective_since` (PROHIBIDO según reglas)
- ❌ Lógica condicional compleja con múltiples ramas
- ❌ Inferencias implícitas sobre contexto UI

---

## LÓGICA DUPLICADA IDENTIFICADA

### 1. Cálculo de `combo` (UNA_VEZ)

**Duplicado en:**
- `list-projection-model.js:724-729`
- `alquimia-general-service.js:813-826`
- `alquimia-alumno-megalist-service.js:456-467`

**Lógica duplicada:**
```javascript
combo = {
  clean_count: (shared.clean_count || 0) + (pde.clean_count || 0),
  remaining: max(0, required_count - combo_clean_count),
  completed: (combo_remaining <= 0 ? 1 : 0)
}
```

**Solución:** CPM v2 debe calcular `combo` internamente.

---

### 2. Cálculo de `days_since_last_effective_clean` (RECURRENTE)

**Duplicado en:**
- `list-projection-model.js:337-346` (query SQL)
- `alquimia-alumno-megalist-service.js:194-204` (query SQL)

**Lógica duplicada:**
```sql
CASE 
  WHEN shared_effective_since IS NOT NULL THEN
    EXTRACT(EPOCH FROM (NOW() - GREATEST(shared_effective_since, COALESCE(shared_last_cleaned_at, shared_effective_since)))) / 86400
  WHEN shared_last_cleaned_at IS NOT NULL THEN
    EXTRACT(EPOCH FROM (NOW() - shared_last_cleaned_at)) / 86400
  ELSE NULL
END::integer as shared_days_since_last_clean
```

**Problema:** Esta lógica está en SQL, no en CPM. CPM recibe `days_since_last_clean` ya calculado.

**Solución:** CPM v2 debe recibir datos brutos y calcular `days_since_last_effective_clean` internamente.

---

### 3. Uso de `had_history` (PROHIBIDO)

**Ubicado en:**
- `cleaning-projection-model.js:70-150` (múltiples lugares)
- Migración v5.73.0 añadió columnas `shared_had_history` y `pde_had_history`

**Problema:** `had_history` es un flag artificial que no debería existir.

**Solución:** Eliminar `had_history` completamente. CPM v2 debe inferir "nunca limpiado" desde `last_cleaned_at === null AND effective_since === null`.

---

### 4. Reset en UNA_VEZ (PROHIBIDO)

**Ubicado en:**
- `cleaning-projection-model.js:188-280` (lógica de UNA_VEZ con `effective_since`)
- `cleaning-engine-service.js:1163-1350` (función `resetStudentItemProgress` permite reset en UNA_VEZ)

**Problema:** UNA_VEZ NO debe tener reset ni `effective_since`.

**Solución:** 
- Hard fail si se intenta reset en UNA_VEZ
- Eliminar lógica de `effective_since` en UNA_VEZ del CPM

---

## RESUMEN DE PROBLEMAS

### Problemas Críticos

1. **CPM usa `had_history`** → PROHIBIDO, eliminar
2. **CPM permite reset en UNA_VEZ** → PROHIBIDO, hard fail
3. **Cálculo de `combo` duplicado** → Mover a CPM v2
4. **Cálculo de `days_since_last_effective_clean` en SQL** → Mover a CPM v2
5. **Queries SQL no pasan `effective_since` al CPM** → Incluir en datos brutos

### Problemas Menores

1. **Lógica condicional compleja en CPM** → Simplificar con contrato exacto
2. **Inferencias implícitas** → Eliminar, hacer explícito

---

## PLAN DE REFACTORIZACIÓN

### FASE 1: CPM v2 (NÚCLEO)

**Contrato exacto:**
```javascript
computeEffectiveState({
  item_kind,        // 'recurrente' | 'una_vez'
  view_layer,       // 'shared' | 'pde' | 'effective' | 'combo'
  item_config,      // { threshold_days, critical_multiplier, required_count }
  cleaning_state,   // { shared: { last_cleaned_at, effective_since, clean_count, ... }, pde: {...} }
  overrides         // opcional
}) => {
  state,            // 'never' | 'pending' | 'reviewed' | 'important'
  visual_state,     // igual que state para RECURRENTE, 'never'|'in_progress'|'completed'|'empowered' para UNA_VEZ
  metrics           // opcional
}
```

**Eliminar:**
- `had_history` (completamente)
- Lógica de reset en UNA_VEZ
- Inferencias implícitas

**Implementar:**
- RECURRENTE: `last_effective_clean = max(last_cleaned_at, effective_since)`
- UNA_VEZ: NO usar `effective_since`, solo contadores
- Cálculo de `combo` interno
- Cálculo de `days_since_last_effective_clean` interno

### FASE 2: Unificar Lecturas

**Archivos a refactorizar:**
- `list-projection-model.js` → Pasar datos brutos, CPM calcula `combo`
- `alquimia-general-service.js` → Pasar datos brutos, CPM calcula `combo`
- `alquimia-alumno-megalist-service.js` → Pasar datos brutos, CPM calcula `combo`

**Cambios:**
- Queries SQL incluyen `effective_since` en datos brutos
- NO calcular `combo` antes de CPM
- NO calcular `days_since_last_effective_clean` en SQL
- CPM recibe datos brutos y calcula todo internamente

### FASE 3: Reset

**Cambios:**
- `resetStudentItemProgress()` → Hard fail si `item_kind === 'una_vez'`
- Eliminar lógica de reset en UNA_VEZ del CPM
- Mantener reset SOLO para RECURRENTE

---

**FIN DEL DIAGNÓSTICO**
