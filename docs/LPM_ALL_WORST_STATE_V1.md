# LPM ALL WORST-STATE v1

**Documento Canónico Constitucional**  
**Fecha:** 2026-01-14  
**Versión:** 1.0  
**Estado:** ENFORCED

---

## 1. CONTEXTO

### 1.1 Qué es LPM (List Projection Model)

**List Projection Model (LPM)** es la única capa autorizada para calcular proyecciones de LISTAS en el dominio MASTER.

**Reglas constitucionales:**
- LPM NO escribe (función pura, READ-only)
- LPM NO muta estado
- LPM reutiliza CPM (Cleaning Projection Model) como única autoridad de estado por ítem
- LPM calcula proyecciones agregadas (métricas, list_state)

**Ubicación:** `src/core/master/services/list-projection-model.js`

**Referencias:**
- `docs/LIST_PROJECTION_MODEL_V1.md` (documentación canónica completa)
- `docs/CLEANING_PROJECTION_MODEL_V1.md` (CPM como base)
- `docs/CONSTITUTION_VIEW_AUTHORITY_V1.md` (View Authority)

### 1.2 Diferencia scope=student vs scope=all

**scope='student':**
- Proyección para UN estudiante específico
- Query: `SELECT ... FROM cleaning_item_state WHERE student_id = $1`
- Resultado: estado individual del estudiante
- No hay agregación

**scope='all':**
- Proyección para TODOS los estudiantes activos
- Query: CROSS JOIN + LEFT JOIN (ver sección 3)
- Resultado: estado agregado (PEOR estado del grupo)
- Agregación: calcula el "menos trabajado" entre todos los estudiantes

### 1.3 Regla Canónica: "ALL muestra el menos trabajado"

**REGLA ABSOLUTA:**
> En `scope='all'`, cada ítem debe reflejar el estado MENOS trabajado del grupo.

**Implicaciones:**
- Si existe al menos 1 estudiante sin estado (sin fila), ese estudiante cuenta como NULL y debe empeorar el estado agregado
- Si un estudiante tiene `days_since_last_clean = null` (nunca trabajado), el estado agregado DEBE ser `null` o equivalente "NUNCA/NO_HECHO"
- Si un estudiante tiene `clean_count = 0` en una_vez, el estado agregado NO puede ser "REVISADO/COMPLETO"

**Ejemplo:**
- Student A: `days_since_last_clean = 1` (revisado hace 1 día)
- Student B: `days_since_last_clean = null` (nunca trabajado)
- **Estado agregado ALL:** `days_since_last_clean = null` (peor estado)

---

## 2. CAUSA RAÍZ DEL BUG

### 2.1 Query Anterior (Bug)

**Query original:**
```sql
SELECT 
  item_ref,
  student_id,
  shared_last_cleaned_at,
  shared_days_since_last_clean,
  pde_last_cleaned_at,
  pde_days_since_last_clean
FROM cleaning_item_state
WHERE product_key = 'pde'
  AND domain_type = 'transmutation'
  AND item_ref = ANY($1::text[])
  AND student_id IN (
    SELECT id FROM students WHERE deleted_at IS NULL
  )
ORDER BY item_ref, student_id
```

**Problema:**
- Solo devolvía estudiantes CON fila en `cleaning_item_state`
- Si un estudiante no tenía fila, NO aparecía en el resultado
- `per_student_states_count < students_count` (faltaban estudiantes)

### 2.2 Consecuencias del Bug

**Síntomas:**
1. `per_student_states_count` era menor que `students_count`
2. `hasNull` nunca se activaba (porque no había filas NULL)
3. Estado agregado optimista (p.ej. `days_since=1` cuando debería ser `null`)
4. Items aparecían como "revisados" cuando al menos 1 estudiante no lo estaba

**Ejemplo concreto:**
- Students activos: 2
- Student A: tiene fila con `days_since_last_clean = 1`
- Student B: NO tiene fila (nunca trabajado)
- **Query anterior:** solo devolvía Student A
- **Estado agregado:** `days_since_last_clean = 1` (INCORRECTO)
- **Estado esperado:** `days_since_last_clean = null` (CORRECTO)

### 2.3 Por Qué Ocurría

**Causa técnica:**
- `INNER JOIN` implícito: `WHERE student_id IN (SELECT id FROM students)` solo devuelve filas que existen
- Si un estudiante no tiene fila en `cleaning_item_state`, no aparece en el resultado
- La agregación solo consideraba estudiantes con estado, ignorando estudiantes sin estado

**Impacto:**
- Bug crítico en proyección ALL
- UI mostraba estados optimistas incorrectos
- Violaba regla canónica: "ALL muestra el menos trabajado"

---

## 3. FIX CANÓNICO

### 3.1 Estrategia Elegida

**OPCIÓN A (Implementada): CROSS JOIN + LEFT JOIN**

**Razón:**
- Determinista y eficiente (una sola query)
- PostgreSQL optimiza CROSS JOIN + LEFT JOIN bien
- Garantiza que TODOS los estudiantes aparecen (incluso sin fila)

**Alternativa rechazada:**
- OPCIÓN B: Traer students y luego "rellenar" en memoria
- Rechazada porque es más propensa a bugs si se hace rápido

### 3.2 SQL Final

**Query nueva (fix):**
```sql
WITH item_refs AS (
  SELECT unnest($1::text[]) AS item_ref
),
active_students AS (
  SELECT id AS student_uuid
  FROM students
  WHERE deleted_at IS NULL
)
SELECT 
  ir.item_ref,
  s.student_uuid AS student_id,
  cis.shared_clean_count,
  cis.shared_last_cleaned_at,
  cis.shared_remaining,
  cis.shared_completed,
  cis.pde_clean_count,
  cis.pde_last_cleaned_at,
  cis.pde_remaining,
  cis.pde_completed,
  -- Calcular days_since_last_clean por alumno (NULL si no hay fila)
  CASE 
    WHEN cis.shared_last_cleaned_at IS NOT NULL THEN
      EXTRACT(EPOCH FROM (NOW() - cis.shared_last_cleaned_at)) / 86400
    ELSE NULL
  END::integer as shared_days_since_last_clean,
  CASE 
    WHEN cis.pde_last_cleaned_at IS NOT NULL THEN
      EXTRACT(EPOCH FROM (NOW() - cis.pde_last_cleaned_at)) / 86400
    ELSE NULL
  END::integer as pde_days_since_last_clean
FROM item_refs ir
CROSS JOIN active_students s
LEFT JOIN cleaning_item_state cis
  ON cis.student_id = s.student_uuid
 AND cis.item_ref = ir.item_ref
 AND cis.product_key = 'pde'
 AND cis.domain_type = 'transmutation'
ORDER BY ir.item_ref, s.student_uuid
```

**Fragmentos clave:**
1. **CTE `item_refs`:** Lista de item_refs a procesar
2. **CTE `active_students`:** Todos los estudiantes activos (UUID-only)
3. **CROSS JOIN:** Genera combinación cartesiana (item_ref × student)
4. **LEFT JOIN:** Trae estados si existen, NULL si no existen
5. **Resultado:** Por cada (item_ref, student) hay o fila o NULL

### 3.3 Cómo se Materializa "Student Sin Fila"

**En JavaScript (después de la query):**
```javascript
result.rows.forEach(row => {
  // Si no hay fila (LEFT JOIN devolvió NULL), crear estado NULL explícito
  statesByItem[itemRef].shared.push({
    clean_count: row.shared_clean_count || 0,
    days_since_last_clean: row.shared_days_since_last_clean, // NULL si no hay fila
    remaining: row.shared_remaining || null,
    completed: row.shared_completed || false,
    last_cleaned_at: row.shared_last_cleaned_at || null // NULL si no hay fila
  });
});
```

**Para recurrente:**
- `days_since_last_clean = null` → significa "nunca trabajado"
- `last_cleaned_at = null` → confirma que no hay fila
- `calculateWorstStateForLayer()` detecta NULL y activa `hasNull = true`
- Estado agregado: `days_since_last_clean = null` (peor estado)

**Para una_vez:**
- `clean_count = 0` + `remaining = null` → significa "nunca trabajado"
- `calculateWorstStateForLayer()` detecta `cleanCount === 0 && remaining === null`
- Estado agregado: `state = 'never'` (peor estado)

### 3.4 Funciones Modificadas

**Archivo:** `src/core/master/services/list-projection-model.js`

**Función 1: `getCleaningStatesForItems()` (scope='all')**
- **Líneas:** ~371-536
- **Cambio:** Query reemplazada con CROSS JOIN + LEFT JOIN
- **Logging añadido:** Verificación de que todos los estudiantes están incluidos

**Función 2: `calculateWorstStateForLayer()`**
- **Líneas:** ~78-250
- **Cambio:** Mejora en detección de NULLs
- **Recurrente:** Verifica `last_cleaned_at === null` además de `days_since_last_clean === null`
- **Una_vez:** Verifica `remaining === null` para detectar "nunca trabajado"

**Archivo adicional:** `src/core/master/services/cleaning-projection-model.js`
- **Fix:** Corregido error `critical_threshold` (variable name)

---

## 4. CONTRATO DE SALIDA (No Romper)

### 4.1 Estructura de Respuesta

**Función:** `computeListProjection()`

**Salida esperada:**
```typescript
{
  items: Array<{
    item_ref: string;
    item_kind: 'recurrente' | 'una_vez';
    state_by_view_layer: {
      shared: {
        state: 'never' | 'pending' | 'important' | 'reviewed' | 'completed';
        visual_state: string;
        computed_state: {
          days_since_last_clean: number | null;
          threshold_days: number;
          critical_threshold: number;
        };
      };
      pde: { ... };
      combo?: { ... };
      effective?: { ... };
    };
    active_state: { ... };
    active_visual_state: string;
  }>;
  metrics: {
    total_items: number;
    by_state_counts: {
      never: number;
      pending: number;
      important: number;
      reviewed: number;
    };
    by_state_pct: { ... };
    reviewed_pct: number;
  };
  list_state: 'healthy' | 'warning' | 'critical';
}
```

### 4.2 Campos Críticos para UI

**UI espera:**
- `items[].state_by_view_layer[view_layer].state` → Estado canónico
- `items[].active_visual_state` → Estado visual para renderizar
- `metrics.by_state_counts` → Contadores por estado
- `metrics.reviewed_pct` → Porcentaje revisado

**Autoridad backend:**
- Backend es la ÚNICA autoridad de estado
- Frontend NO calcula estados (solo renderiza)
- Si `state = 'never'`, UI debe mostrar "NUNCA" o equivalente

### 4.3 Reglas de No Romper

**PROHIBIDO:**
- Cambiar estructura de `state_by_view_layer` sin actualizar UI
- Eliminar campos que UI consume
- Cambiar nombres de estados canónicos sin migración

**OBLIGATORIO:**
- Mantener contrato de salida estable
- Si se añade campo nuevo, debe ser opcional o con default
- Documentar cambios breaking en este documento

---

## 5. PRUEBA CANÓNICA REPRODUCIBLE

### 5.1 Script de Diagnóstico

**Archivo:** `scripts/diagnose-all-projection-uuid-only.js`

**Ejecución:**
```bash
node scripts/diagnose-all-projection-uuid-only.js
```

### 5.2 Escenario Exacto

**Setup:**
1. **2 estudiantes activos:**
   - Student A: UUID canónico
   - Student B: UUID canónico

2. **1 lista activa:**
   - Tipo: `recurrente` o `una_vez`
   - Con al menos 2 items

3. **Preparación:**
   - **Student A:** Crear/actualizar fila en `cleaning_item_state` para item recurrente
     - `shared_last_cleaned_at = NOW() - INTERVAL '1 day'`
     - `shared_clean_count = 1`
   - **Student B:** Asegurar NO fila (DELETE si existe)
   - **Item una_vez:** Student A con estado parcial, Student B sin fila

### 5.3 Expected Outputs (Lista de Checks)

**Check 1: Students Count**
```javascript
expected_students_count = 2
per_student_states_count = 2
✅ CORRECTO: Todos los estudiantes están incluidos
```

**Check 2: Recurrente - NULL States**
```javascript
has_null_states = true
aggregated_days_since_last_clean = null
✅ CORRECTO: Hay estados NULL (Student B sin fila)
✅ CORRECTO: Estado agregado es NULL (peor estado)
```

**Check 3: Una_vez - Never States**
```javascript
has_never_states = true
aggregated_state = 'never' | 'pending' | 'in_progress'
✅ CORRECTO: Hay estados "never" (Student B sin fila)
✅ CORRECTO: Estado agregado NO es "reviewed" (porque Student B no tiene fila)
```

**Check 4: Logs Estructurados**
```javascript
[LPM][ALL_PROJECTION][FIX] Estados obtenidos con CROSS JOIN + LEFT JOIN
  - expected_students_count: 2
  - rows_returned: (item_refs_count * 2)
  - per_item_states: [{ shared_count: 2, pde_count: 2, has_null_states: true }]
```

### 5.4 Criterio de Aceptación

**Si todos los checks pasan:**
- ✅ Fix funciona correctamente
- ✅ Estado agregado refleja peor estado
- ✅ Todos los estudiantes están incluidos

**Si algún check falla:**
- ❌ Fix incompleto o regresión
- ❌ Revisar query o lógica de agregación

---

## 6. GUARDS / PREVENCIÓN

### 6.1 Validación en Runtime

**Ubicación:** `src/core/master/services/list-projection-model.js`

**Validación añadida:**
```javascript
// DIAGNÓSTICO: Verificar que todos los estudiantes están incluidos
const activeStudentsCount = await query(`
  SELECT COUNT(*) as total
  FROM students
  WHERE deleted_at IS NULL
`);
const expectedStudentsCount = parseInt(activeStudentsCount.rows[0]?.total || '0', 10);

logInfo('LPM', '[ALL_PROJECTION][FIX] Estados obtenidos con CROSS JOIN + LEFT JOIN', {
  traceId,
  item_refs_count: itemRefs.length,
  expected_students_count: expectedStudentsCount,
  rows_returned: result.rows.length,
  expected_rows: itemRefs.length * expectedStudentsCount,
  per_item_states: Object.keys(statesByItem).map(itemRef => ({
    item_ref: itemRef,
    shared_count: statesByItem[itemRef].shared.length,
    pde_count: statesByItem[itemRef].pde.length,
    has_null_states: statesByItem[itemRef].shared.some(s => s.days_since_last_clean === null) ||
                     statesByItem[itemRef].pde.some(s => s.days_since_last_clean === null)
  }))
});
```

**Assert recomendado (futuro):**
```javascript
// En desarrollo/testing, lanzar error si faltan estudiantes
if (process.env.NODE_ENV === 'development') {
  const actualCount = statesByItem[itemRef].shared.length;
  if (actualCount !== expectedStudentsCount) {
    throw new Error(`LPM ALL: Faltan estudiantes. Esperado: ${expectedStudentsCount}, Obtenido: ${actualCount}`);
  }
}
```

### 6.2 Logging Recomendado

**Niveles:**
- **Producción:** Solo errores y warnings
- **Desarrollo:** Logs estructurados con prefijos `[LPM][ALL_PROJECTION][FIX]`
- **Debug:** Activar con variable de entorno `DEBUG_LPM_ALL=true`

**Prefijos canónicos:**
- `[LPM][ALL_PROJECTION][FIX]` → Verificación de fix
- `[LPM][DEBUG][WORST_STATE][INPUT]` → Estados individuales por alumno
- `[LPM][DEBUG][WORST_STATE][RECURRENTE]` → Cálculo de peor estado (recurrente)
- `[LPM][DEBUG][WORST_STATE][UNA_VEZ]` → Cálculo de peor estado (una_vez)

### 6.3 UUID-Only Enforcement

**Regla constitucional:**
- Sistema es UUID-only (ver `docs/IDENTIDAD_ALUMNOS_UUID_ONLY_V2.md`)
- Query usa `student_id UUID` directamente (sin resolución legacy)
- Sin JOINs a tabla `alumnos`
- Sin referencias a `legacy_alumno_id`

**Verificación:**
```bash
# Grep debe devolver 0 en runtime MASTER
grep -r "legacy_alumno\|JOIN.*alumnos\|student_id INTEGER" src/core/master/services/
```

---

## 7. CHANGES LOG

### 7.1 Commits Relacionados

**Commit principal:**
```
fix(master-lpm): ALL projection uses worst-state incl students without rows (uuid-only)

CAUSA RAÍZ:
- Query en scope='all' solo traía estados existentes en cleaning_item_state
- Si un estudiante no tenía fila, no aparecía en la agregación
- Resultado: peor estado se calculaba incorrectamente

QUÉ CAMBIÓ:
- Implementado CROSS JOIN + LEFT JOIN para traer TODOS los estudiantes activos
- Incluso estudiantes sin fila aparecen como NULL (nunca trabajado)
- calculateWorstStateForLayer() ahora maneja NULLs correctamente

FIX ADICIONAL:
- Corregido error en cleaning-projection-model.js: critical_threshold variable name
```

**Fecha:** 2026-01-14  
**Hash:** `cf492c1`

### 7.2 Migraciones

**No aplica:** Este fix no requiere migraciones de base de datos.

**Razón:** Solo cambia la query de lectura, no la estructura de tablas.

### 7.3 Versión

**Versión del documento:** 1.0  
**Fecha de creación:** 2026-01-14  
**Estado:** ENFORCED

---

## 8. REFERENCIAS

### 8.1 Documentos Relacionados

- `docs/IDENTIDAD_ALUMNOS_UUID_ONLY_V2.md` → UUID-only enforcement
- `docs/LIST_PROJECTION_MODEL_V1.md` → Documentación completa de LPM
- `docs/CLEANING_PROJECTION_MODEL_V1.md` → CPM como base
- `docs/CONSTITUTION_VIEW_AUTHORITY_V1.md` → View Authority

### 8.2 Código Canónico

- `src/core/master/services/list-projection-model.js` → Implementación LPM
- `src/core/master/services/cleaning-projection-model.js` → CPM
- `scripts/diagnose-all-projection-uuid-only.js` → Script de diagnóstico

---

## 9. CONCLUSIÓN

**Regla constitucional activa:**
> En `scope='all'`, cada ítem debe reflejar el estado MENOS trabajado del grupo.

**Fix canónico implementado:**
- CROSS JOIN + LEFT JOIN garantiza que TODOS los estudiantes aparecen
- Estudiantes sin fila se materializan como NULL (nunca trabajado)
- Estado agregado refleja correctamente el peor estado

**Prevención:**
- Validación en runtime detecta estudiantes faltantes
- Logging estructurado para debugging
- Script de diagnóstico reproducible

**Este documento es CONSTITUCIONAL. Cualquier cambio que afecte la proyección ALL debe respetar estas reglas.**

---

**Última actualización:** 2026-01-14  
**Versión del documento:** 1.0  
**Estado:** ENFORCED
