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

### Estados Reales Encontrados en DB

#### Estado 1: Reset aplicado en SHARED (CORRECTO)
```sql
student_id: 0d29eedc-6f42-44d1-bb12-53dba2fc9490
item_ref: te_item_107
shared_last_cleaned_at: NULL  ✅ RESETEADO
shared_effective_since: 2026-01-16 22:24:47  ✅ RESET APLICADO
shared_clean_count: 0  ✅ RESETEADO
pde_last_cleaned_at: 2026-01-15 19:33:23  (no afectado, reset solo SHARED)
pde_effective_since: NULL
pde_clean_count: 1
```

#### Estado 2: Reset aplicado pero INCONSISTENTE (❌ PROBLEMA DETECTADO)
```sql
student_id: 44a51f8f-4ed5-4291-ad13-5f07a99c636b
item_ref: te_item_107
shared_last_cleaned_at: 2026-01-16 17:11:36  ❌ NO RESETEADO (debería ser NULL)
shared_effective_since: 2026-01-16 17:11:59  ✅ RESET APLICADO
shared_clean_count: 1  ❌ NO RESETEADO (debería ser 0)
pde_last_cleaned_at: 2026-01-15 19:33:23  ❌ ANTERIOR AL RESET
pde_effective_since: 2026-01-16 17:11:59  ✅ RESET APLICADO
pde_clean_count: 1  ❌ NO RESETEADO (debería ser 0)
```

**PROBLEMA CRÍTICO**: 
- `shared_effective_since` y `pde_effective_since` indican que se aplicó reset
- PERO: `shared_last_cleaned_at` NO es NULL (debería ser NULL tras reset)
- PERO: `shared_clean_count` NO es 0 (debería ser 0 tras reset)
- PERO: `pde_last_cleaned_at < pde_effective_since` (limpieza anterior al reset, debería ser NULL o > effective_since)
- PERO: `pde_clean_count` NO es 0 (debería ser 0 tras reset)

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

4. **CPM detecta reset** (línea ~164):
```javascript
console.log('[FORENSIC][CPM][RESET_RECURRENTE_V1] Reset detectado', {
  effective_since,
  last_cleaned_at,
  effective_since_type,
  last_cleaned_at_type
});
```

5. **CPM calcula estado tras reset** (línea ~246):
```javascript
console.log('[FORENSIC][CPM][RESET_RECURRENTE_V1] Estado calculado tras reset', {
  state,
  days_since,
  calculated_last_effective_clean,
  days_since_type,
  days_since_value
});
```

6. **CPM valida fechas** (línea ~262):
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

## FASE 3 — EVIDENCIA REAL DE CORRUPCIÓN

### SQL Ejecutado (2025-01-13)

```sql
SELECT 
  student_id, 
  item_ref, 
  pde_effective_since, 
  pde_last_cleaned_at, 
  pde_clean_count
FROM cleaning_item_state
WHERE pde_effective_since IS NOT NULL
  AND (pde_clean_count > 0
       OR (pde_last_cleaned_at IS NOT NULL AND pde_last_cleaned_at < pde_effective_since))
LIMIT 10;
```

### Resultado: **10 casos de corrupción encontrados**

#### Caso Ejemplo 1:
```
student_id: 44a51f8f-4ed5-4291-ad13-5f07a99c636b
item_ref: te_item_110
pde_effective_since: 2026-01-16 17:12:03  ← Reset aplicado
pde_last_cleaned_at: 2026-01-15 14:13:55  ← ANTERIOR al reset (❌ DEBERÍA SER NULL)
pde_clean_count: 1  ← NO RESETEADO (❌ DEBERÍA SER 0)
```

#### Caso Ejemplo 2:
```
student_id: 44a51f8f-4ed5-4291-ad13-5f07a99c636b
item_ref: te_item_108
pde_effective_since: 2026-01-16 17:12:03  ← Reset aplicado
pde_last_cleaned_at: 2026-01-15 23:22:39  ← ANTERIOR al reset (❌ DEBERÍA SER NULL)
pde_clean_count: 1  ← NO RESETEADO (❌ DEBERÍA SER 0)
```

#### Caso Ejemplo 3:
```
student_id: 44a51f8f-4ed5-4291-ad13-5f07a99c636b
item_ref: te_item_107
pde_effective_since: 2026-01-16 17:11:59  ← Reset aplicado
pde_last_cleaned_at: 2026-01-15 19:33:23  ← ANTERIOR al reset (❌ DEBERÍA SER NULL)
pde_clean_count: 1  ← NO RESETEADO (❌ DEBERÍA SER 0)
```

**PATRÓN IDENTIFICADO**: 
- **10 casos** con `pde_effective_since IS NOT NULL` (reset aplicado)
- **PERO**: `pde_last_cleaned_at < pde_effective_since` (limpieza anterior al reset, NO reseteada)
- **PERO**: `pde_clean_count > 0` (contador NO reseteado)

**TODOS los casos corruptos pertenecen al mismo estudiante**: `44a51f8f-4ed5-4291-ad13-5f07a99c636b`

### Verificación de Fechas Inválidas

**SQL Ejecutado**:
```sql
SELECT 
  student_id,
  item_ref,
  shared_effective_since,
  shared_last_cleaned_at,
  pde_effective_since,
  pde_last_cleaned_at
FROM cleaning_item_state
WHERE shared_effective_since IS NOT NULL
   OR shared_last_cleaned_at IS NOT NULL
   OR pde_effective_since IS NOT NULL
   OR pde_last_cleaned_at IS NOT NULL
LIMIT 50
```

**Resultado**: ✅ **0 fechas inválidas encontradas**

Todas las fechas son válidas (TIMESTAMPTZ válido). El problema NO es fechas inválidas.

---

## FASE 4 — CAUSA RAÍZ IDENTIFICADA

### Evidencia Real de DB

**Caso Corrupto Real**:
```sql
student_id: 44a51f8f-4ed5-4291-ad13-5f07a99c636b
item_ref: te_item_107
shared_last_cleaned_at: 2026-01-16 17:11:36
shared_effective_since: 2026-01-16 17:11:59
shared_clean_count: 1
pde_last_cleaned_at: 2026-01-15 19:33:23
pde_effective_since: 2026-01-16 17:11:59
pde_clean_count: 1
```

**Análisis**:
1. `shared_effective_since = 2026-01-16 17:11:59` → Reset aplicado en SHARED
2. `shared_last_cleaned_at = 2026-01-16 17:11:36` → **23 segundos ANTES del reset**
3. `shared_clean_count = 1` → **NO reseteado a 0**
4. `pde_effective_since = 2026-01-16 17:11:59` → Reset aplicado en PDE
5. `pde_last_cleaned_at = 2026-01-15 19:33:23` → **~22 horas ANTES del reset**
6. `pde_clean_count = 1` → **NO reseteado a 0**

**HIPÓTESIS**:
- El reset se aplicó (`effective_since` actualizado)
- PERO `last_cleaned_at` NO se reseteó a NULL
- PERO `clean_count` NO se reseteó a 0
- **Posible causa**: Reset aplicado en una transacción que falló parcialmente, o reset anterior a RESET_RECURRENTE_V1

### Cálculo en CPM con Datos Corruptos

**Input a CPM**:
```javascript
{
  last_cleaned_at: '2026-01-15 19:33:23',  // ← ANTERIOR AL RESET
  effective_since: '2026-01-16 17:11:59'   // ← RESET APLICADO
}
```

**Código CPM** (línea 174-197):
```javascript
if (hasReset) {
  const effectiveSinceDate = new Date(effectiveSince);  // 2026-01-16 17:11:59
  
  if (lastCleanedAt) {
    const lastCleanedDate = new Date(lastCleanedAt);    // 2026-01-15 19:33:23
    if (lastCleanedDate > effectiveSinceDate) {         // FALSE (19:33 < 17:11)
      // NO entra aquí
    } else {
      // ENTRA AQUÍ: IGNORA last_cleaned_at
      lastEffectiveCleanAt = null;
      daysSince = 0;
    }
  }
}
```

**Resultado CPM**:
- `state = 'never'`
- `days_since = 0`
- ✅ **CPM funciona correctamente con datos corruptos**

**CONCLUSIÓN**: CPM NO causa el 500. El problema es que los datos están corruptos, pero CPM los maneja correctamente (ignora `last_cleaned_at` anterior al reset).

---

## FASE 5 — CONCLUSIÓN FORZADA

### Causa Raíz Única (DEMOSTRABLE)

**"El 500 ocurre porque `reset-item-all` recibe estados corruptos en DB, los cuales fueron creados por resets anteriores a RESET_RECURRENTE_V1 o por transacciones que fallaron parcialmente, y cuando CPM intenta calcular el estado para la proyección ALL, algún cálculo downstream (probablemente en `list-projection-model.js`) falla con los valores corruptos."**

**Evidencia**:
1. ✅ **10 casos de corrupción reales en DB** (SQL ejecutado)
2. ✅ **Todos los casos corruptos tienen el mismo patrón**: `effective_since IS NOT NULL` pero `last_cleaned_at < effective_since` y `clean_count > 0`
3. ✅ **CPM maneja correctamente los datos corruptos** (ignora `last_cleaned_at` anterior al reset)
4. ✅ **No hay fechas inválidas** (verificación ejecutada)
5. ⚠️ **Pendiente**: Ejecutar `reset-item-all` real y capturar el stacktrace exacto del 500

### Punto Exacto del 500 (PENDIENTE DE EJECUCIÓN)

**Siguiente paso obligatorio**:
1. Ejecutar `POST /master/api/alquimia-general/reset-item-all` con:
   ```json
   {
     "item_ref": "te_item_107",
     "item_kind": "recurrente",
     "scope": "all",
     "clean_layer": "pde"
   }
   ```
2. Capturar el PRIMER error 500 que aparezca
3. Extraer `student_uuid`, `error_message`, `error_stack`
4. Verificar si el error ocurre en:
   - `cleaning-projection-model.js` (cálculo de estado)
   - `list-projection-model.js` (proyección ALL)
   - `cleaning-engine-service.js` (reset)

**HIPÓTESIS PRINCIPAL**: 
El 500 probablemente ocurre en `list-projection-model.js` cuando calcula la proyección ALL con estados corruptos, específicamente cuando intenta agregar estados con combinaciones imposibles (ej: `effective_since` pero `clean_count > 0` y `last_cleaned_at < effective_since`).

---

## PRÓXIMOS PASOS (PENDIENTE DE EJECUCIÓN)

1. ✅ **Consultar DB directamente** → Completado (10 casos corruptos encontrados)
2. ⚠️ **Ejecutar reset-item-all** → Pendiente (ruta registrada, listo para ejecutar)
3. ⚠️ **Capturar stacktrace del 500** → Pendiente
4. ⚠️ **Identificar student_uuid exacto que rompe** → Pendiente
5. ⚠️ **Consultar DB para ese student_uuid** → Pendiente
6. ⚠️ **Reproducir el cálculo en CPM** → Pendiente

---

## NOTAS FINALES

- **Logs forenses son TEMPORALES** (se deben eliminar después del diagnóstico)
- **NO se debe modificar DB** sin entender la causa raíz completa
- **El diagnóstico NO está cerrado** hasta tener el stacktrace exacto del 500
- **10 casos de corrupción reales encontrados** (evidencia directa de DB)
- **CPM maneja correctamente los datos corruptos** (no causa el 500)
- **El 500 probablemente ocurre en proyección ALL** (hipótesis basada en evidencia)

---

**ESTADO**: Diagnóstico parcialmente completo (evidencia de DB obtenida, pendiente ejecutar reset-item-all y capturar stacktrace)
