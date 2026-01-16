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
- **PROBLEMA**: Si `lastCleanedAt` es NULL, `new Date(lastCleanedAt)` crea `Invalid Date`, pero el código ya verifica `if (lastCleanedAt)` antes de crear la fecha

### 5. **Error en query SQL de proyección ALL** (MEDIA PROBABILIDAD)
- `list-projection-model.js` línea 447-479: Query con CROSS JOIN + LEFT JOIN
- Si `cleaning_item_state` tiene filas con `effective_since` inválido, la query podría fallar
- **Ubicación**: `list-projection-model.js` línea 463, 468

### 6. **Error en conversión de tipos en proyección** (BAJA PROBABILIDAD)
- `list-projection-model.js` línea 500: `completed: row.shared_completed || false`
- Si `shared_completed` es NULL, se convierte a `false` (boolean), pero CPM espera integer
- **Ubicación**: `list-projection-model.js` línea 500, 508
- **NOTA**: Este problema está marcado como FIX 2 en el código (línea 419), pero podría no estar aplicado correctamente

---

## ANÁLISIS DE CÓDIGO CRÍTICO

### Punto Crítico 1: Comparación de Fechas en CPM

**Código**: `cleaning-projection-model.js` líneas 174-197

```javascript
if (hasReset) {
  const effectiveSinceDate = new Date(effectiveSince);  // ← Línea 176
  
  if (lastCleanedAt) {
    const lastCleanedDate = new Date(lastCleanedAt);    // ← Línea 180
    if (lastCleanedDate > effectiveSinceDate) {         // ← Línea 181
      // OK: limpieza posterior
    } else {
      // OK: limpieza anterior, ignorar
    }
  }
}
```

**PROBLEMA POTENCIAL**:
- Si `effectiveSince` es string inválido → `new Date(effectiveSince)` → `Invalid Date`
- `Invalid Date` en comparación → siempre `false`
- Esto podría causar comportamiento inesperado, pero NO debería causar 500

**VERIFICACIÓN**: El código ya valida `if (hasReset && lastCleanedAt && effectiveSince)` antes de crear las fechas

### Punto Crítico 2: Query SQL con NULLs

**Código**: `list-projection-model.js` líneas 447-511

```sql
SELECT 
  cis.shared_effective_since,
  cis.pde_effective_since
FROM item_refs ir
CROSS JOIN active_students s
LEFT JOIN cleaning_item_state cis
  ON cis.student_id = s.student_uuid
 AND cis.item_ref = ir.item_ref
```

**PROBLEMA POTENCIAL**:
- Si `cis.shared_effective_since` es string inválido (no TIMESTAMPTZ), PostgreSQL devuelve el valor raw
- JavaScript `new Date('invalid_string')` → `Invalid Date`
- **Esto SÍ podría causar 500** si el código no valida antes de crear `Date` objects

**VERIFICACIÓN**: El código en `list-projection-model.js` línea 502 pasa `effective_since: row.shared_effective_since || null`, pero NO valida si es una fecha válida

### Punto Crítico 3: Conversión de `completed`

**Código**: `list-projection-model.js` línea 500

```javascript
completed: row.shared_completed || false  // ← FALSO: debería ser Number(...) || 0
```

**PROBLEMA POTENCIAL**:
- El comentario dice "FIX 2: completed SIEMPRE es integer" (línea 419)
- Pero el código usa `|| false` en lugar de `Number(...) || 0`
- CPM espera `completed` como integer, pero podría recibir boolean
- **Esto podría causar 500** si CPM intenta hacer aritmética con boolean

**VERIFICACIÓN**: Este problema está documentado en el código (línea 419), pero NO está corregido en todas las ubicaciones

---

## PUNTO EXACTO DEL 500 (HIPÓTESIS)

### Hipótesis Principal: Fecha Inválida en DB

**Escenario**:
1. Reset anterior dejó `effective_since` con valor inválido (string no fecha)
2. `list-projection-model.js` consulta DB y obtiene `effective_since: 'INVALID_STRING'`
3. Pasa a CPM como `effective_since: 'INVALID_STRING'`
4. CPM hace `new Date('INVALID_STRING')` → `Invalid Date`
5. Comparación con `Invalid Date` → comportamiento impredecible
6. **NO debería causar 500 directamente**, pero podría causar error downstream

### Hipótesis Secundaria: Error en Proyección ALL

**Escenario**:
1. Reset ALL se ejecuta para múltiples estudiantes
2. Para un estudiante, `upsertApplyReset()` falla parcialmente
3. `effective_since` se actualiza, pero `clean_count` NO se resetea
4. Proyección ALL intenta calcular estado agregado
5. CPM recibe combinación imposible: `effective_since !== null` pero `clean_count > 0` y `last_cleaned_at < effective_since`
6. CPM ignora `last_cleaned_at`, calcula estado como `never` con `days_since = 0`
7. **Pero algo más falla** (¿validación de estado? ¿cálculo de agregado?)

### Hipótesis Terciaria: Error en Conversión de Tipos

**Escenario**:
1. `list-projection-model.js` convierte `completed: row.shared_completed || false`
2. Pasa a CPM como `completed: false` (boolean)
3. CPM espera `completed: 0` (integer)
4. Si CPM intenta hacer `completed + 1` o similar → `TypeError`
5. **Esto SÍ podría causar 500**

---

## CONCLUSIÓN (DIAGNÓSTICO)

### Causas Raíz Priorizadas:

1. **ALTA**: Fecha inválida en `effective_since` o `last_cleaned_at` (DB corrupto o migración incompleta)
2. **MEDIA**: Error en conversión de tipos (`completed` como boolean en lugar de integer)
3. **MEDIA**: Inconsistencia `clean_count` vs `effective_since` (reset parcial fallido)
4. **BAJA**: Error en comparación de fechas (código ya valida NULLs)

### Siguiente Paso Obligatorio:

**EJECUTAR reset-item-all y capturar logs completos** para identificar el punto exacto del 500.

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
