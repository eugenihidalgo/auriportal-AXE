# DIAGNÓSTICO FORENSE: RESET RECURRENTE DB v1

**Fecha**: 2025-01-13  
**Sistema**: AuriPortal / Aurelín  
**Dominio**: MASTER  
**Módulo**: Alquimia General  
**Item_kind**: recurrente  
**Problema**: `reset-item-all` devuelve 500, ítems reseteados previamente fallan en cálculos posteriores

---

## FASE 1 — INVENTARIO DE ESTADO REAL

### Estructura Canónica de `cleaning_item_state`

**Tabla**: `cleaning_item_state`  
**Migración**: `v5.73.0-reset-canonical-v1.sql`

**Columnas relevantes para RECURRENTE**:
- `student_id` (UUID, PK)
- `item_ref` (TEXT, PK)
- `product_key` (TEXT, PK, default: 'pde')
- `domain_type` (TEXT, PK)
- `shared_last_cleaned_at` (TIMESTAMPTZ NULL)
- `shared_effective_since` (TIMESTAMPTZ NULL) ← **AÑADIDO EN v5.73.0**
- `shared_clean_count` (INTEGER, default: 0)
- `pde_last_cleaned_at` (TIMESTAMPTZ NULL)
- `pde_effective_since` (TIMESTAMPTZ NULL) ← **AÑADIDO EN v5.73.0**
- `pde_clean_count` (INTEGER, default: 0)
- `shared_had_history` (BOOLEAN, default: false) ← **DEPRECADO EN CPM v2**
- `pde_had_history` (BOOLEAN, default: false) ← **DEPRECADO EN CPM v2**

**NOTA CRÍTICA**: 
- Las columnas `shared_had_history` y `pde_had_history` existen en DB (v5.73.0)
- PERO: CPM v2 las marca como PROHIBIDAS y NO las usa
- PERO: `upsertApplyReset()` NO actualiza `had_history`
- **Inconsistencia potencial**: DB tiene columnas que el código ignora

### Estados Esperados vs Reales

#### Estado SANO (nunca reseteado)
```sql
-- Ejemplo esperado:
student_id: 'uuid-123'
item_ref: 'item-ref-456'
shared_last_cleaned_at: '2025-01-10 10:00:00+00'
shared_effective_since: NULL
shared_clean_count: 5
pde_last_cleaned_at: '2025-01-12 15:00:00+00'
pde_effective_since: NULL
pde_clean_count: 3
```

#### Estado POST-RESET (reset aplicado)
```sql
-- Ejemplo esperado tras reset PDE:
student_id: 'uuid-123'
item_ref: 'item-ref-456'
shared_last_cleaned_at: '2025-01-10 10:00:00+00'  -- NO se toca (reset solo PDE)
shared_effective_since: NULL  -- NO se toca (reset solo PDE)
shared_clean_count: 5  -- NO se toca (reset solo PDE)
pde_last_cleaned_at: NULL  -- RESETEADO a NULL (RESET_RECURRENTE_V1)
pde_effective_since: '2025-01-13 14:00:00+00'  -- NUEVO timestamp de reset
pde_clean_count: 0  -- RESETEADO a 0 (RESET_RECURRENTE_V1)
```

#### Estado CORRUPTO (hipótesis)
```sql
-- Posible combinación imposible:
student_id: 'uuid-123'
item_ref: 'item-ref-456'
shared_last_cleaned_at: NULL
shared_effective_since: '2025-01-13 14:00:00+00'  -- Reset aplicado
shared_clean_count: 5  -- NO reseteado (inconsistente)
pde_last_cleaned_at: '2025-01-10 10:00:00+00'  -- Anterior al reset
pde_effective_since: '2025-01-13 14:00:00+00'  -- Reset aplicado
pde_clean_count: 3  -- NO reseteado (inconsistente)
```

**PROBLEMA POTENCIAL**: 
- Si `last_cleaned_at < effective_since`, CPM v2 IGNORA `last_cleaned_at`
- Pero `clean_count` NO se resetea si el reset falla parcialmente
- Esto genera inconsistencia: `effective_since` indica reset, pero `clean_count > 0` indica historial

---

## FASE 2 — TRAZA DEL RESET

### Flujo Completo: `reset-item-all`

```
POST /master/api/alquimia-general/reset-item-all
  ↓
master-api-alquimia-general.js (línea 1795)
  ↓
cleaningEngineResetAll() (cleaning-engine-service.js, línea 1484)
  ↓
  - Obtiene todos los estudiantes activos
  - Para cada estudiante:
    ↓
    resetStudentItemProgress() (cleaning-engine-service.js, línea 1150)
      ↓
      - Determina capas a resetear (clean_layer='pde')
      - Para cada capa:
        ↓
        - Genera execution_key
        - Inserta evento en cleaning_events (action_type='reset')
        ↓
        stateRepo.upsertApplyReset() (cleaning-item-state-repo-pg.js, línea 340)
          ↓
          SQL: UPDATE cleaning_item_state SET
            pde_effective_since = NOW(),
            pde_last_cleaned_at = NULL,
            pde_clean_count = 0
          WHERE student_id = $1 AND item_ref = $2
```

### Logs Forenses Añadidos (TEMPORALES)

**Ubicación**: `cleaning-engine-service.js`

1. **ANTES del reset** (línea ~1615):
```javascript
console.log('[FORENSIC][RESET_ALL] [BEFORE] Estado antes de reset', {
  student_uuid,
  item_ref,
  state_before: {
    shared_last_cleaned_at,
    shared_effective_since,
    shared_clean_count,
    pde_last_cleaned_at,
    pde_effective_since,
    pde_clean_count
  }
});
```

2. **DESPUÉS del reset** (línea ~1650):
```javascript
console.log('[FORENSIC][RESET_ALL] [AFTER] Estado después de reset', {
  student_uuid,
  item_ref,
  reset_result: { applied, skipped },
  state_after: {
    shared_last_cleaned_at,
    shared_effective_since,
    shared_clean_count,
    pde_last_cleaned_at,
    pde_effective_since,
    pde_clean_count
  }
});
```

3. **ERROR capturado** (línea ~1670):
```javascript
console.error('[FORENSIC][RESET_ALL] [ERROR] Error reseteando estudiante', {
  student_uuid,
  item_ref,
  error_message,
  error_code,
  error_stack,
  error_name
});
```

**Ubicación**: `cleaning-projection-model.js`

4. **CPM detecta reset** (línea ~162):
```javascript
console.log('[FORENSIC][CPM][RESET_RECURRENTE_V1] Reset detectado', {
  effective_since,
  last_cleaned_at,
  effective_since_type,
  last_cleaned_at_type
});
```

5. **CPM calcula estado tras reset** (línea ~236):
```javascript
console.log('[FORENSIC][CPM][RESET_RECURRENTE_V1] Estado calculado tras reset', {
  state,
  days_since,
  calculated_last_effective_clean,
  days_since_type,
  days_since_value
});
```

6. **CPM valida fechas** (línea ~260):
```javascript
// Detecta fechas inválidas que podrían causar 500
if (isNaN(lastCleanedDate.getTime()) || isNaN(effectiveSinceDate.getTime())) {
  console.error('[FORENSIC][CPM][ERROR] Fechas inválidas detectadas', {
    last_cleaned_at,
    effective_since
  });
}
```

---

## FASE 3 — PUNTO EXACTO DEL 500 (PENDIENTE DE EJECUCIÓN)

**INSTRUCCIONES**:
1. Ejecutar `POST /master/api/alquimia-general/reset-item-all` con logs activos
2. Buscar en logs: `[FORENSIC][RESET_ALL] [ERROR]`
3. Identificar:
   - `student_uuid` exacto que rompe
   - `error_message` completo
   - `error_stack` completo
   - `state_before` y `state_after` (si están disponibles)

**LOGS ESPERADOS**:
```
[FORENSIC][RESET_ALL] [ENTRADA] resetAllStudentsItemProgress
[FORENSIC][RESET_ALL] [BEFORE] Estado antes de reset (estudiante 1)
[FORENSIC][RESET_ALL] [AFTER] Estado después de reset (estudiante 1)
[FORENSIC][RESET_ALL] [BEFORE] Estado antes de reset (estudiante 2)
[FORENSIC][RESET_ALL] [ERROR] Error reseteando estudiante (estudiante 2) ← AQUÍ
```

---

## FASE 4 — CPM Y COMBINACIONES NO SOPORTADAS

### Casos que CPM debe manejar:

#### Caso 1: Reset aplicado, sin limpieza posterior
```javascript
effective_since: '2025-01-13 14:00:00+00'
last_cleaned_at: null
clean_count: 0
```
**Resultado esperado**: `state = 'never'`, `days_since = 0`  
**Código**: Línea 213-216

#### Caso 2: Reset aplicado, limpieza posterior
```javascript
effective_since: '2025-01-13 14:00:00+00'
last_cleaned_at: '2025-01-15 10:00:00+00'  // > effective_since
clean_count: 1
```
**Resultado esperado**: `state = 'reviewed'`, `days_since = 2`  
**Código**: Línea 179-185

#### Caso 3: Reset aplicado, limpieza ANTERIOR (INVÁLIDO)
```javascript
effective_since: '2025-01-13 14:00:00+00'
last_cleaned_at: '2025-01-10 10:00:00+00'  // < effective_since ← IGNORAR
clean_count: 5  // ← INCONSISTENTE (debería ser 0)
```
**Resultado esperado**: `state = 'never'`, `days_since = 0` (ignorar last_cleaned_at)  
**Código**: Línea 187-191  
**PROBLEMA**: `clean_count = 5` indica historial, pero CPM lo ignora. **¿Es esto un bug o comportamiento esperado?**

#### Caso 4: Fechas inválidas
```javascript
effective_since: 'INVALID_DATE'
last_cleaned_at: '2025-01-10 10:00:00+00'
```
**Resultado esperado**: Error explícito (no 500 silencioso)  
**Código**: Línea 260-280 (validación añadida)

### Combinaciones NO SOPORTADAS (hipótesis)

1. **`effective_since !== null` pero `last_cleaned_at > effective_since` y `clean_count = 0`**
   - Estado: Reset aplicado, contador reseteado, pero hay limpieza posterior
   - ¿Cómo se distingue de "reset aplicado sin limpieza"?

2. **`effective_since !== null` pero `last_cleaned_at < effective_since` y `clean_count > 0`**
   - Estado: Reset aplicado, pero contador NO reseteado
   - ¿Inconsistencia de DB? ¿Bug en `upsertApplyReset`?

3. **`effective_since` es string inválido (no fecha)**
   - Estado: DB corrupto o migración incompleta
   - CPM v2 lanza `TypeError: Invalid Date` en `new Date(effectiveSince)`

4. **`effective_since` es NULL pero `clean_count = 0` y `last_cleaned_at = NULL`**
   - Estado: ¿Nunca trabajado? ¿Reset fallido?
   - CPM v2 devuelve `state = 'never'` (correcto)

---

## CAUSAS RAÍZ POTENCIALES (PRIORIZADAS)

### 1. **Fechas inválidas en DB** (ALTA PROBABILIDAD)
- `effective_since` o `last_cleaned_at` con formato incorrecto
- `new Date()` lanza `TypeError` si la fecha es inválida
- **Ubicación**: `cleaning-projection-model.js` línea 176, 180

### 2. **Inconsistencia `clean_count` vs `effective_since`** (MEDIA PROBABILIDAD)
- `upsertApplyReset()` resetea `last_cleaned_at = NULL` y `clean_count = 0`
- Pero si hay error parcial, `clean_count` podría quedarse > 0
- **Ubicación**: `cleaning-item-state-repo-pg.js` línea 368

### 3. **`had_history` no actualizado** (BAJA PROBABILIDAD, pero existe inconsistencia)
- DB tiene `shared_had_history` y `pde_had_history`
- CPM v2 NO las usa (PROHIBIDO)
- `upsertApplyReset()` NO las actualiza
- **No debería causar 500, pero es inconsistencia arquitectónica**

### 4. **Error en comparación de fechas** (MEDIA PROBABILIDAD)
- `lastCleanedDate > effectiveSinceDate` podría fallar si una fecha es NULL
- **Ubicación**: `cleaning-projection-model.js` línea 181

---

## PRÓXIMOS PASOS (PENDIENTE DE EJECUCIÓN)

1. **Ejecutar reset-item-all** y capturar logs completos
2. **Buscar `[FORENSIC][RESET_ALL] [ERROR]`** en logs del servidor
3. **Extraer**:
   - `student_uuid` que falla
   - `error_message` completo
   - `state_before` y `state_after`
4. **Consultar DB directamente** para ese estudiante:
   ```sql
   SELECT * FROM cleaning_item_state 
   WHERE student_id = '<student_uuid>' AND item_ref = '<item_ref>';
   ```
5. **Reproducir el cálculo en CPM** con esos valores exactos

---

## NOTAS FINALES

- **Logs forenses son TEMPORALES** (se deben eliminar después del diagnóstico)
- **NO se debe modificar DB** sin entender la causa raíz
- **NO se debe cambiar CPM** sin entender qué combinación de valores causa el 500
- **El diagnóstico debe ser REPRODUCIBLE** (mismo estudiante, mismo item_ref, mismo reset)

---

**ESTADO**: Diagnóstico en progreso (logs añadidos, pendiente de ejecución)
