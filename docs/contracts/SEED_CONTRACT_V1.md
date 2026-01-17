# CONTRATO CANÓNICO — CLEANING STATE SEED v1

**Versión:** 1.0  
**Fecha:** 2026-01-13  
**Estado:** Canónico  
**Dominio:** MASTER / Alquimia General

---

## INTENCIÓN DEL SEED

El Cleaning State Seed es un mecanismo **estructural** que materializa estados iniciales "NUNCA" en `cleaning_item_state` para items aplicables del catálogo que aún no tienen estado materializado.

**Propósito único:** Garantizar que todos los items aplicables tengan una entrada en `cleaning_item_state` desde la cual CPM y LPM pueden proyectar estados.

**NO es:**
- ❌ Un mecanismo correctivo (no repara estados existentes)
- ❌ Un mecanismo reactivo (no responde a cambios de nivel)
- ❌ Un mecanismo de migración (no migra datos legacy)
- ❌ Un mecanismo de sincronización (no sincroniza con fuentes externas)

---

## QUÉ ES / QUÉ NO ES

### ✅ QUÉ ES

1. **Mecanismo estructural:**
   - Crea estados iniciales "NUNCA" para items que NO tienen estado materializado
   - Solo inserta filas NUEVAS (idempotente estricto)
   - No modifica estados existentes

2. **Idempotente estricto:**
   - `ON CONFLICT (student_id, product_key, domain_type, item_ref) DO NOTHING`
   - Múltiples ejecuciones son seguras
   - Mismo resultado independientemente del número de ejecuciones

3. **Observable:**
   - Emite señal técnica `state.seeded` cuando inserta estados
   - Logs estructurados con trace_id
   - Métricas claras: `inserted`, `skipped`, `total_applicable`

4. **UUID-only:**
   - Acepta EXCLUSIVAMENTE `student_uuid` (UUID canónico)
   - Rechaza `legacy_alumno_id` explícitamente
   - PostgreSQL es Source of Truth

---

### ❌ QUÉ NO ES

1. **NO es correctivo:**
   - ❌ NO modifica estados existentes
   - ❌ NO repara estados corruptos
   - ❌ NO actualiza `shared_remaining` si `veces_limpiar` cambia
   - ❌ NO recalcula estados desde eventos

2. **NO es reactivo:**
   - ❌ NO reacciona a cambios de nivel del estudiante
   - ❌ NO seedea items nuevos niveles automáticamente
   - ❌ NO actualiza estados cuando nivel cambia

3. **NO es automático en GET:**
   - ❌ NO debe ejecutarse automáticamente en TODOS los GET
   - ❌ NO debe ejecutarse en lecturas genéricas
   - ❌ Solo debe ejecutarse cuando sea crítico (POST antes de mutación)

4. **NO crea eventos:**
   - ❌ NO inserta en `cleaning_events`
   - ❌ NO crea resets
   - ❌ NO crea señales de limpieza

5. **NO depende de level_cap mutable:**
   - ❌ NO usa `nivel_efectivo` como default (usa `level_cap` observado explícito)
   - ❌ NO garantiza coherencia con cambios de nivel
   - ❌ Solo seedea según `level_cap` OBSERVADO en el momento de ejecución

---

## CUÁNDO PUEDE EJECUTARSE

### ✅ Contextos permitidos

1. **POST antes de mutación crítica:**
   - Antes de `markCleanStudent()` si estado NO existe
   - Antes de `markCleanAllStudents()` si estados faltantes
   - Cuando es **crítico** para que la mutación funcione

2. **Inicialización estructural explícita:**
   - Cuando se crea un estudiante nuevo
   - Cuando se añaden items nuevos al catálogo
   - Cuando se migra desde legacy (una sola vez)

3. **Guard explícito:**
   - Con flag `allow_structural_seed: true` en opciones
   - Con validación explícita de necesidad
   - Con logs estructurados de ejecución

---

### ⚠️ Contextos con WARN (DEPRECATED)

1. **GET /megalist automático:**
   - **DEPRECATED:** Ejecución automática en GET /megalist
   - **Razón:** Operación de lectura no debe ejecutar escritura
   - **Acción:** Log WARN y SKIP si `allow_structural_seed !== true`

2. **Seed con `level_cap = null` (usa `nivel_efectivo`):**
   - **DEPRECATED:** Usar `nivel_efectivo` como default
   - **Razón:** `level_cap` debe ser observado explícito
   - **Acción:** Log WARN y usar `999` (infinito) como fallback seguro

---

## CUÁNDO ESTÁ PROHIBIDO

### ❌ Prohibido absoluto

1. **En GET genérico sin flag:**
   - ❌ GET /megalist sin `allow_structural_seed: true`
   - ❌ GET /list-projection sin flag
   - ❌ Cualquier GET de lectura

2. **Después de mutación:**
   - ❌ Después de `markCleanStudent()` exitoso
   - ❌ Después de `markCleanAllStudents()` exitoso
   - ❌ Seed NO debe ejecutarse como "corrección" post-mutación

3. **Dentro de transacciones de limpieza:**
   - ❌ NO debe ejecutarse dentro de la misma transacción que `markCleanStudent()`
   - ❌ NO debe compartir `client` con operaciones de limpieza
   - ✅ Debe ejecutarse ANTES y con transacción propia

4. **Con level_cap mutado:**
   - ❌ NO debe ejecutarse con `level_cap` que cambia entre ejecuciones
   - ❌ NO debe usar `nivel_efectivo` dinámico
   - ✅ Debe usar `level_cap` observado explícito en el momento de ejecución

---

## RELACIÓN CON OTROS SISTEMAS

### Nivel del Estudiante

**Relación:**
- Seed usa `level_cap` OBSERVADO para filtrar items aplicables
- Solo seedea items con `nivel <= level_cap` (o `nivel IS NULL`)
- NO reacciona a cambios de nivel (no seedea items nuevos niveles automáticamente)

**Contrato:**
- `level_cap` debe ser EXPLÍCITO (no `null` que derive a `nivel_efectivo`)
- Seed NO garantiza coherencia si `level_cap` cambia después
- Items nuevos niveles requieren seed EXPLÍCITO con nuevo `level_cap`

**DEPRECATED:**
- ❌ Usar `nivel_efectivo` como default (`level_cap = null`)
- ❌ Ejecutar seed automático cuando nivel cambia

---

### Catálogo (items_transmutaciones)

**Relación:**
- Seed lee desde `items_transmutaciones` y `listas_transmutaciones`
- Solo seedea items con `status='active'` (o `activo=true`)
- Solo seedea items con `item_ref IS NOT NULL`
- Respeto `lista.tipo` para inicializar `shared_remaining` correctamente

**Contrato:**
- Catálogo es Source of Truth para nombres, `veces_limpiar`, `frecuencia_dias`
- Seed inicializa `shared_remaining = COALESCE(veces_limpiar, 1)` para UNA_VEZ
- Seed inicializa `shared_remaining = 0` para RECURRENTE
- Si `veces_limpiar` cambia en catálogo, seed NO actualiza estados existentes

**DEPRECATED:**
- ❌ Seedear items de TODAS las listas cuando solo se necesita una `lista_tipo`
- ❌ Seedear items sin nivel cuando no son aplicables

---

### Reset (resetStudentItemProgress)

**Relación:**
- Seed NO crea resets
- Seed NO afecta `effective_since`
- Estados seedeados pueden ser reseteados posteriormente

**Contrato:**
- Seed crea estados con `effective_since = NULL`
- Reset establece `effective_since` después
- Seed NO interactúa con reset (son independientes)

**Referencias:** `docs/contracts/RESET_CONTRACT_V1.md`

---

### Overrides

**Relación:**
- Seed NO lee overrides
- Seed NO modifica overrides
- Overrides pueden existir antes del seed

**Contrato:**
- Override antes del seed NO tiene efecto hasta que exista estado
- Cuando seed crea estado, override se aplica inmediatamente después
- Seed y overrides son independientes

**Referencias:**
- `docs/contracts/OVERRIDES_CONTRACT_V1.md` (contrato canónico de overrides)
- `docs/DIAGNOSTICO_OVERRIDES_MASTER.md` (análisis completo de overrides huérfanos)

---

### CPM (Cleaning Projection Model)

**Relación:**
- CPM lee desde `cleaning_item_state` (proyección materializada)
- Seed garantiza que items aplicables tengan entrada en `cleaning_item_state`
- CPM calcula estados desde estados seedeados

**Contrato:**
- Seed crea estados con valores iniciales correctos para CPM
- CPM asume que estados existen (NO crea estados)
- Si estado no existe, CPM puede fallar (de ahí la necesidad de seed)

**Valores iniciales seedeados:**
- RECURRENTE: `shared_last_cleaned_at = NULL`, `shared_clean_count = 0`, `effective_since = NULL`
- UNA_VEZ: `shared_completed = 0` (o 1 si `veces_limpiar=0`), `shared_remaining = veces_limpiar` (o 1)

---

### LPM (List Projection Model)

**Relación:**
- LPM agrega estados desde `cleaning_item_state` para múltiples estudiantes
- Seed garantiza que TODOS los estudiantes aplicables tengan estados
- LPM puede calcular "peor estado" agregado solo si estados existen

**Contrato:**
- LPM asume que estados existen para items aplicables
- Si estado no existe (estudiante sin seed), LPM trata como NULL (empeora agregado)
- Seed debe ejecutarse para TODOS los estudiantes antes de calcular agregado

**scope='all':**
- Seed debe ejecutarse para cada estudiante antes de calcular agregado
- Items sin seed empeoran el agregado (NULL > never > important > pending > reviewed)

---

## POLÍTICA DE FALLOS

### Fail-Open Robusto

**Comportamiento:**
- Si seed falla, retorna `{ inserted: 0, skipped: 0, error: ... }` sin lanzar error
- Log WARN estructurado con trace_id
- Sistema continúa aunque seed haya fallado

**Razón:**
- Seed NO es crítico para lectura (solo para escritura)
- Lectura puede continuar aunque algunos items no tengan estado
- Escritura debe fallar si estado no existe (validación previa)

**Obligatorio:**
- Log estructurado con prefijo `[SEED_CLEAN_STATE]`
- Incluir trace_id en todos los logs
- Incluir error.message y error.code en logs

---

### Validaciones que Lanzan Error

**Hard-fail:**
1. `student_uuid` faltante → Error explícito (no fail-open)
2. `student_uuid` formato inválido → Error explícito
3. `product_key` o `domain_type` inválidos → Error explícito

**Fail-open:**
- Error de conexión a DB → Log WARN y retornar `{ inserted: 0, error: ... }`
- Error en query SQL → Log WARN y retornar `{ inserted: 0, error: ... }`
- Error al obtener `nivel_efectivo` → Log WARN y usar fallback `999`

---

## INVARIANTES CONSTITUCIONALES

### 1. Idempotencia Estricta

**Invariante:**
- `ON CONFLICT (student_id, product_key, domain_type, item_ref) DO NOTHING`
- Múltiples ejecuciones con mismos parámetros → mismo resultado
- NO debe modificar estados existentes bajo ninguna circunstancia

**Verificación:**
- Test de idempotencia obligatorio
- Verificar que `inserted` disminuye a 0 en segunda ejecución
- Verificar que estados existentes NO cambian

---

### 2. UUID-Only

**Invariante:**
- Seed acepta EXCLUSIVAMENTE `student_uuid` (UUID canónico)
- Rechaza `legacy_alumno_id` explícitamente
- PostgreSQL es Source of Truth

**Verificación:**
- Validar formato UUID antes de ejecutar
- Error explícito si se pasa `legacy_alumno_id`

---

### 3. Estructural, No Correctivo

**Invariante:**
- Seed solo crea estados INEXISTENTES
- NO modifica estados existentes
- NO repara estados corruptos

**Verificación:**
- Test que verifica que estados existentes NO cambian
- Test que verifica que solo se insertan estados faltantes

---

### 4. No Automático en GET

**Invariante:**
- Seed NO debe ejecutarse automáticamente en GET genérico
- Solo debe ejecutarse cuando sea crítico (POST antes de mutación)
- Debe tener guard explícito con flag `allow_structural_seed: true`

**Verificación:**
- Guard que rechaza ejecución en GET sin flag
- Log WARN si se intenta ejecutar en GET sin flag

---

### 5. level_cap Observado

**Invariante:**
- Seed debe usar `level_cap` OBSERVADO explícito (no derivado de `nivel_efectivo`)
- Si `level_cap = null`, debe usar fallback seguro `999` (no derivar a `nivel_efectivo`)
- Seed NO garantiza coherencia si `level_cap` cambia después

**DEPRECATED:**
- ❌ Usar `nivel_efectivo` como default (`level_cap = null`)

---

### 6. Señal Técnica Opcional

**Invariante:**
- Seed emite señal `state.seeded` SOLO si `inserted > 0`
- Señal es opcional (fail-open absoluto)
- Si señal falla, seed continúa (no bloquea)

**Payload de señal:**
```javascript
{
  student_uuid,        // UUID canónico
  inserted_count,      // Número de estados insertados
  level_cap,           // level_cap usado
  product_key,         // Product key
  domain_type,         // Domain type
  trace_id            // Trace ID
}
```

---

## COMPORTAMIENTOS LEGACY (DEPRECATED)

### 1. Seed Automático en GET /megalist

**DEPRECATED:**
```javascript
// ❌ LEGACY: Ejecución automática en GET
const seedResult = await ensureCleaningItemStateSeedForStudent({...});
```

**Canónico:**
```javascript
// ✅ CANÓNICO: Guard explícito con flag
if (allow_structural_seed !== true) {
  logWarn('SEED_CLEAN_STATE', 'Seed intentado en GET sin flag, SKIP', {...});
  return; // Skip seed
}
```

**Referencia:** `src/endpoints/master-api-alquimia-alumno.js:178`

---

### 2. Usar `nivel_efectivo` como Default

**DEPRECATED:**
```javascript
// ❌ LEGACY: Usar nivel_efectivo si level_cap es null
if (level_cap === null) {
  nivelCap = await getStudentEffectiveLevel(student_uuid);
}
```

**Canónico:**
```javascript
// ✅ CANÓNICO: Usar fallback seguro si level_cap es null
if (level_cap === null || level_cap === undefined) {
  logWarn('SEED_CLEAN_STATE', 'level_cap es null, usando fallback 999', {...});
  nivelCap = 999; // Fallback seguro (infinito)
}
```

**Referencia:** `src/core/master/services/cleaning-state-seed-service.js:51-54`

---

### 3. Seed Masivo sin Filtro por lista_tipo

**DEPRECATED:**
```sql
-- ❌ LEGACY: Seedear TODOS los items aplicables sin filtrar por lista_tipo
SELECT ... FROM items_transmutaciones i
WHERE (i.status = 'active' OR i.activo = true)
  AND (i.nivel IS NULL OR i.nivel <= $4::integer)
```

**Canónico:**
```sql
-- ✅ CANÓNICO: Filtrar por lista_tipo si viene (opcional)
SELECT ... FROM items_transmutaciones i
WHERE (i.status = 'active' OR i.activo = true)
  AND (i.nivel IS NULL OR i.nivel <= $4::integer)
  AND ($5::text IS NULL OR l.tipo = $5::text) -- Opcional: filtrar por lista_tipo
```

**Nota:** Este filtro es opcional. Seed puede seedear todos los items si no se especifica `lista_tipo`.

---

## FIRMA DE FUNCIÓN CANÓNICA

```javascript
/**
 * Asegura que items aplicables tengan estado materializado (seed estructural)
 * 
 * UUID-ONLY: Acepta student_uuid (UUID canónico)
 * 
 * @param {Object} options - Opciones
 * @param {string} options.student_uuid - UUID canónico del estudiante (OBLIGATORIO)
 * @param {string} [options.product_key='pde'] - Product key
 * @param {string} [options.domain_type='transmutation'] - Domain type
 * @param {number} [options.level_cap] - Cap de nivel OBSERVADO (OBLIGATORIO, no null)
 * @param {string} [options.lista_tipo] - Filtrar por tipo de lista (opcional)
 * @param {boolean} [options.allow_structural_seed=false] - Flag para permitir seed estructural
 * @param {Object} [options.client] - Cliente de transacción (opcional)
 * @returns {Promise<Object>} { inserted, skipped, total_applicable, total_existing }
 */
async function ensureStructuralCleaningState(options = {}, client = null)
```

**Cambios canónicos:**
- ✅ Nombre: `ensureStructuralCleaningState` (más explícito)
- ✅ `level_cap` OBLIGATORIO (no null)
- ✅ Flag `allow_structural_seed` para guards
- ✅ `lista_tipo` opcional para filtrar

---

## VERIFICACIÓN Y TESTS

### Tests Obligatorios

1. **Test de Idempotencia:**
   - Ejecutar seed dos veces con mismos parámetros
   - Verificar que `inserted` disminuye a 0 en segunda ejecución
   - Verificar que estados existentes NO cambian

2. **Test de No Modificación:**
   - Crear estado manualmente
   - Ejecutar seed
   - Verificar que estado existente NO cambia

3. **Test de Guard en GET:**
   - Intentar ejecutar seed en GET sin flag
   - Verificar que seed NO se ejecuta (log WARN)
   - Verificar que seed se ejecuta con flag `allow_structural_seed: true`

4. **Test de level_cap Observado:**
   - Ejecutar seed con `level_cap = 5`
   - Ejecutar seed con `level_cap = 10`
   - Verificar que items nivel 6-10 quedan sin seed (idempotencia)

5. **Test de Señal Técnica:**
   - Ejecutar seed con `inserted > 0`
   - Verificar que señal `state.seeded` se emite
   - Ejecutar seed con `inserted = 0`
   - Verificar que señal NO se emite

---

## SEEDREADINESSMETRICS v1 (READ OBSERVABILITY)

### ¿Qué es?

SeedReadinessMetrics v1 es una **capa de observabilidad** que diagnostica el estado de seed SIN ejecutar seed. Proporciona métricas sobre qué items aplicables tienen estado materializado y cuáles faltan.

**Propósito único:** Permitir que endpoints READ (GET) informen sobre el estado de seed sin ejecutarlo, manteniendo GET como READ puro.

**NO es:**
- ❌ Un mecanismo de seed automático (NO ejecuta seed)
- ❌ Una forma de crear estados desde GET (GET sigue siendo READ puro)
- ❌ Una validación que bloquea respuestas (fail-open absoluto)

**SÍ es:**
- ✅ Observabilidad pura (solo métricas, no acciones)
- ✅ Diagnóstico de estado (explica por qué faltan cosas)
- ✅ Guía para operaciones (indica cuándo ejecutar POST initialize)

---

### Dónde aparece

**Endpoints que incluyen seed_metrics:**

1. **GET /master/api/alquimia-alumno/megalist**
   - Endpoint: `src/endpoints/master-api-alquimia-alumno.js` (línea 112)
   - Servicio: `src/core/master/services/alquimia-alumno-megalist-service.js`
   - Métricas calculadas por: `src/core/master/services/seed-readiness-metrics-service.js`

**Respuesta JSON:**

```json
{
  "ok": true,
  "data": {
    "items": [...],
    "lists": [...],
    "metrics": {...},
    "seed_metrics": {
      "total_applicable_items": 42,
      "total_items_with_state": 38,
      "missing_state_count": 4,
      "needs_initialize": true,
      "sample_missing_item_refs": ["item_ref_1", "item_ref_2", "item_ref_3"]
    },
    "context": {...}
  },
  "trace_id": "..."
}
```

---

### Campos exactos

**Estructura de `seed_metrics`:**

| Campo | Tipo | Descripción | Obligatorio |
|-------|------|-------------|-------------|
| `total_applicable_items` | `number` | Total de items del catálogo aplicables según filtros (activos, nivel <= level_cap, lista_tipo si aplica) | ✅ Sí |
| `total_items_with_state` | `number` | Total de items que tienen estado en `cleaning_item_state` dentro del universo aplicable | ✅ Sí |
| `missing_state_count` | `number` | Diferencia: `total_applicable_items - total_items_with_state` | ✅ Sí |
| `needs_initialize` | `boolean` | `true` si `missing_state_count > 0`, `false` en caso contrario | ✅ Sí |
| `sample_missing_item_refs` | `string[]` | Array de hasta 10 `item_ref` faltantes (solo si `missing_state_count <= 50` para no encarecer) | ⚠️ Opcional |

**Validaciones:**
- `missing_state_count = total_applicable_items - total_items_with_state` (coherencia obligatoria)
- `needs_initialize = (missing_state_count > 0)` (coherencia obligatoria)
- `sample_missing_item_refs` solo aparece si hay items faltantes y el cálculo es barato (≤50 items faltantes)

---

### Interpretación canónica

#### Cuando `needs_initialize = true`

**Significado:**
- Existen items aplicables que NO tienen estado materializado en `cleaning_item_state`
- La megalist puede estar incompleta (no muestra items sin estado)
- El sistema está operativo pero requiere inicialización explícita

**Acción recomendada:**
- Ejecutar `POST /master/api/alquimia-alumno/initialize` con `level_cap` correcto
- Esto creará estados para todos los items aplicables faltantes
- Después de inicializar, `needs_initialize` debería ser `false` (requiere nuevo GET)

**Ejemplo:**

```json
{
  "seed_metrics": {
    "total_applicable_items": 42,
    "total_items_with_state": 38,
    "missing_state_count": 4,
    "needs_initialize": true,
    "sample_missing_item_refs": ["alquimia_meditacion_1", "alquimia_reflexion_2", "alquimia_integracion_3"]
  }
}
```

**Solución operativa:**
```bash
POST /master/api/alquimia-alumno/initialize
{
  "student_uuid": "...",
  "level_cap": 10,
  "lista_tipo": "recurrente"
}
```

#### Cuando `needs_initialize = false`

**Significado:**
- Todos los items aplicables tienen estado materializado
- La megalist está completa (muestra todos los items aplicables)
- No se requiere acción inmediata

**Ejemplo:**

```json
{
  "seed_metrics": {
    "total_applicable_items": 42,
    "total_items_with_state": 42,
    "missing_state_count": 0,
    "needs_initialize": false
  }
}
```

---

### Aclaración: NO ejecuta seed

**REGLA CONSTITUCIONAL:**
- SeedReadinessMetrics **NO ejecuta seed**
- Solo calcula métricas observables (queries SELECT, no INSERT)
- GET sigue siendo READ puro (no escribe en `cleaning_item_state`)

**Criterios de aplicabilidad:**
- Mismos filtros que seed estructural:
  - Items activos (`status='active'` OR `activo=true`)
  - Items con `item_ref IS NOT NULL`
  - Items con `nivel <= level_cap` (usando `COALESCE(i.nivel, 0) <= level_cap`)
  - Items de `lista_tipo` si se especifica (opcional)

**Eficiencia:**
- 1-2 queries SQL optimizadas
- Fail-open: si falla el cálculo, `seed_metrics` puede ser `null` (no bloquea respuesta)

---

### Logs forenses

**Cuándo se emite:**
- Log INFO forense cuando `missing_state_count > 0`
- Prefijo: `[SEED_READINESS][FORENSIC]`

**Contenido del log:**
```
[AlquimiaAlumnoMegalist] [SEED_READINESS][FORENSIC] Estados faltantes detectados
{
  traceId: "...",
  student_uuid: "...",
  view_layer: "shared",
  lista_tipo: "recurrente",
  level_cap: 10,
  missing_state_count: 4,
  total_applicable_items: 42,
  total_items_with_state: 38,
  needs_initialize: true,
  sample_missing_item_refs: [...]
}
```

**Cuándo NO se emite:**
- Si `missing_state_count = 0` (no spam de logs)
- Si el cálculo de métricas falla (fail-open)

---

### Referencias técnicas

- **Servicio:** `src/core/master/services/seed-readiness-metrics-service.js`
- **Integración:** `src/core/master/services/alquimia-alumno-megalist-service.js`
- **Endpoint:** `src/endpoints/master-api-alquimia-alumno.js`
- **Script de verificación:** `scripts/verify-seed-readiness-metrics.js`
- **Diagnóstico relacionado:** `docs/DIAGNOSTICO_SEED_MASTER.md`

---

## REFERENCIAS

- **Diagnóstico FASE 0:** `docs/DIAGNOSTICO_SEED_FASE0_CLEANING_STATE.md`
- **Diagnóstico canónico:** `docs/DIAGNOSTICO_SEED_MASTER.md`
- **Servicio actual:** `src/core/master/services/cleaning-state-seed-service.js`
- **Servicio métricas:** `src/core/master/services/seed-readiness-metrics-service.js`
- **Endpoint GET:** `src/endpoints/master-api-alquimia-alumno.js:112`
- **Endpoint POST:** `src/endpoints/master-api-alquimia-alumno.js:194`
- **Contrato RESET:** `docs/contracts/RESET_CONTRACT_V1.md`
- **Contrato OVERRIDES:** `docs/contracts/OVERRIDES_CONTRACT_V1.md`
- **CPM:** `src/core/master/services/cleaning-projection-model.js`
- **LPM:** `src/core/master/services/list-projection-model.js`

---

**FIN DEL CONTRATO CANÓNICO SEED v1**
