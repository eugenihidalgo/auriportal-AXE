# IDENTIDAD ALUMNOS UUID-ONLY v2

**Documento Canónico Constitucional**  
**Fecha:** 2026-01-14  
**Versión:** 2.0  
**Estado:** ENFORCED

---

## 1. PRINCIPIO CONSTITUCIONAL

### Regla Absoluta

**`students.id` (UUID) es la ÚNICA identidad válida de alumno en AuriPortal/Aurelín.**

### Prohibición Explícita

- ❌ `legacy_alumno_id` está **PROHIBIDO** en runtime
- ❌ `student_id INTEGER` está **PROHIBIDO** en tablas activas
- ❌ Resolución UUID → legacy está **PROHIBIDO** en runtime
- ❌ JOINs a tabla `alumnos` están **PROHIBIDOS** en dominio MASTER

### Consecuencia

**Cualquier violación es un BUG CONSTITUCIONAL que debe ser corregido inmediatamente.**

---

## 2. HISTORIA BREVE

### Por Qué Existía Legacy

El sistema original usaba `alumnos.id` (INTEGER) como identidad primaria. Durante la migración a UUID, se mantuvo `legacy_alumno_id` como puente temporal para:
- Compatibilidad con tablas legacy
- Migración gradual de datos
- Resolución bidireccional UUID ↔ INTEGER

### Por Qué Se Elimina

**Riesgos críticos identificados:**

1. **List Projection Model (LPM) - Bug de Peor Estado:**
   - LPM calculaba "peor estado" agregando estados de múltiples estudiantes
   - Si un estudiante tenía `legacy_alumno_id = NULL`, no aparecía en agregaciones
   - Resultado: estados "nunca" se calculaban incorrectamente
   - **UUID-only elimina este bug:** todos los estudiantes tienen UUID válido

2. **Cleaning Projection Model (CPM) - Agregaciones Falsas:**
   - CPM agregaba estados usando `student_id INTEGER`
   - Si había inconsistencias en `legacy_alumno_id`, se duplicaban o perdían estados
   - **UUID-only garantiza:** cada estudiante tiene un UUID único e inmutable

3. **Dependencias Ocultas:**
   - Código que parecía UUID-only resolvía legacy internamente
   - JOINs a `alumnos` para obtener `display_name` (apodo, nombre_completo)
   - **UUID-only elimina:** display_name ahora está en `students`

### Fecha de Eliminación

**2026-01-14:** Sprint constitucional v5.70.0 eliminó completamente legacy alumnos.

---

## 3. REGLAS DURAS

### 3.1 Ninguna Tabla Usa `student_id INTEGER`

**Verificación:**
```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'student_id'
  AND data_type != 'uuid';
```

**Resultado esperado:** 0 filas

**Tablas migradas (v5.70.0):**
- `cleaning_events`
- `cleaning_item_state`
- `student_item_state`
- `student_item_state_audit`
- `student_place_state`
- `student_project_state`
- `student_activation_limits`
- `nivel_overrides`
- `sponsor_student_links`
- `pde_daily_item_clean_log`
- `ute_executions`
- `ute_student_state`
- `student_product_memberships`
- `student_domain_policies`
- `pausas`

### 3.2 Ningún Repo Resuelve Legacy

**Prohibido:**
```javascript
// ❌ PROHIBIDO
const legacyId = await identityRepo.resolveLegacyId(student_uuid);
```

**Correcto:**
```javascript
// ✅ CORRECTO
// Usar student_uuid directamente
await repo.getState({ student_uuid });
```

**Guard constitucional:**
- `student-identity-repo-pg.js.resolveLegacyId()` lanza error: `LEGACY_ALUMNO_ID_FORBIDDEN`

### 3.3 Ningún Servicio Acepta Legacy

**Prohibido:**
```javascript
// ❌ PROHIBIDO
await service.markClean({
  student_id: 123,  // INTEGER legacy
  item_ref: 'item-1'
});
```

**Correcto:**
```javascript
// ✅ CORRECTO
await service.markClean({
  student_uuid: '550e8400-e29b-41d4-a716-446655440000',  // UUID
  item_ref: 'item-1'
});
```

**Guards constitucionales:**
- `cleaning-engine-service.js` valida que no venga `legacy_alumno_id` o `student_id INTEGER`
- Lanza error: `LEGACY alumno_id is forbidden in UUID-only Alquimia runtime`

### 3.4 Ningún JOIN a `alumnos`

**Prohibido:**
```sql
-- ❌ PROHIBIDO
SELECT s.id, a.apodo, a.nombre_completo
FROM students s
LEFT JOIN alumnos a ON s.legacy_alumno_id = a.id;
```

**Correcto:**
```sql
-- ✅ CORRECTO
SELECT id, apodo, nombre_completo
FROM students
WHERE id = $1;
```

**Razón:** `apodo`, `nombre_completo`, `email` ahora están en `students`

---

## 4. TABLAS CANÓNICAS (POST-MIGRACIÓN)

### 4.1 Tabla `students` (Source of Truth)

```sql
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  email TEXT UNIQUE,
  apodo TEXT,
  nombre_completo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  meta JSONB DEFAULT '{}'::jsonb,
  feature_flags JSONB DEFAULT '{}'::jsonb,
  experiments JSONB DEFAULT '{}'::jsonb
);
```

**Columnas clave:**
- `id`: UUID único (identidad soberana)
- `email`: Email único (usado para idempotencia)
- `apodo`: Display name (migrado desde `alumnos.apodo`)
- `nombre_completo`: Display name (migrado desde `alumnos.nombre_completo`)

**Eliminado:**
- ❌ `legacy_alumno_id` (eliminado en v5.70.1)

### 4.2 Tablas con `student_id UUID`

Todas las siguientes tablas tienen `student_id UUID` con FK a `students(id)`:

| Tabla | FK Constraint | Índices |
|-------|---------------|---------|
| `cleaning_events` | `fk_cleaning_events_student_uuid` | `idx_cleaning_events_student_item` |
| `cleaning_item_state` | `fk_cleaning_item_state_student_uuid` | PK: `(student_id, product_key, domain_type, item_ref)` |
| `student_item_state` | `fk_student_item_state_student_uuid` | PK: `(student_id, product_key, domain_type, item_ref)` |
| `student_item_state_audit` | `fk_student_item_state_audit_student_uuid` | - |
| `student_place_state` | `fk_student_place_state_student_uuid` | - |
| `student_project_state` | `fk_student_project_state_student_uuid` | - |
| `student_activation_limits` | `fk_student_activation_limits_student_uuid` | - |
| `nivel_overrides` | `fk_nivel_overrides_student_uuid` | - |
| `sponsor_student_links` | `fk_sponsor_student_links_student_uuid` | - |
| `pde_daily_item_clean_log` | `fk_pde_daily_item_clean_log_student_uuid` | - |
| `ute_executions` | `fk_ute_executions_student_uuid` | - |
| `ute_student_state` | `fk_ute_student_state_student_uuid` | - |
| `student_product_memberships` | `fk_student_product_memberships_student_uuid` | - |
| `student_domain_policies` | `fk_student_domain_policies_student_uuid` | - |
| `pausas` | `fk_pausas_student_uuid` | - |

**Verificación:**
```sql
SELECT 
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'students'
  AND ccu.column_name = 'id';
```

---

## 5. CONTRATOS DE SERVICIO

### 5.1 Cleaning Engine Service

**Contrato:**
```typescript
interface MarkCleanOptions {
  student_uuid: string;  // UUID canónico (OBLIGATORIO)
  item_ref: string;
  clean_layer: 'shared' | 'pde';
  // ... otros campos
}

// ❌ PROHIBIDO
interface MarkCleanOptionsLegacy {
  student_id?: number;  // INTEGER legacy
  legacy_alumno_id?: number;
}
```

**Ejemplo correcto:**
```javascript
await cleaningEngine.markClean({
  student_uuid: '550e8400-e29b-41d4-a716-446655440000',
  item_ref: 'transmutation-item-1',
  clean_layer: 'shared',
  item_kind: 'recurrente',
  cleaned_at: new Date(),
  actor_type: 'master',
  surface_key: 'master.alquimia_general'
});
```

**Ejemplo incorrecto:**
```javascript
// ❌ PROHIBIDO - Lanza error constitucional
await cleaningEngine.markClean({
  student_id: 123,  // INTEGER legacy
  item_ref: 'transmutation-item-1',
  // ...
});
```

### 5.2 Alquimia Alumno Megalist Service

**Contrato:**
```typescript
interface GetMegalistOptions {
  student_uuid: string;  // UUID canónico (OBLIGATORIO)
  view_layer: 'shared' | 'pde' | 'combo' | 'effective';
  lista_tipo: 'recurrente' | 'una_vez';
  // ... otros campos
}
```

**Ejemplo correcto:**
```javascript
const megalist = await getMegalistForStudent({
  student_uuid: '550e8400-e29b-41d4-a716-446655440000',
  view_layer: 'shared',
  lista_tipo: 'recurrente'
});
```

### 5.3 Cleaning State Seed Service

**Contrato:**
```typescript
interface SeedOptions {
  student_uuid: string;  // UUID canónico (OBLIGATORIO)
  product_key?: string;
  domain_type?: string;
  level_cap?: number | null;
}
```

**Ejemplo correcto:**
```javascript
await ensureCleaningItemStateSeedForStudent({
  student_uuid: '550e8400-e29b-41d4-a716-446655440000',
  product_key: 'pde',
  domain_type: 'transmutation',
  level_cap: 5
});
```

### 5.4 Repositorios

**Todos los repositorios aceptan SOLO `student_uuid`:**

```javascript
// ✅ CORRECTO
await cleaningItemStateRepo.getState({
  student_uuid: '550e8400-e29b-41d4-a716-446655440000',
  item_ref: 'item-1',
  product_key: 'pde',
  domain_type: 'transmutation'
});

// ❌ PROHIBIDO
await cleaningItemStateRepo.getState({
  student_id: 123,  // INTEGER legacy
  item_ref: 'item-1'
});
```

---

## 6. GUARDS CONSTITUCIONALES

### 6.1 Cleaning Engine Service

**Ubicación:** `src/core/master/services/cleaning-engine-service.js`

**Guard:**
```javascript
// GUARD CONSTITUCIONAL: UUID-only Alquimia
if (options.legacy_alumno_id || options.student_id) {
  const error = new Error('LEGACY alumno_id is forbidden in UUID-only Alquimia runtime');
  error.code = 'LEGACY_ALUMNO_ID_FORBIDDEN';
  logError('CleaningEngine', 'Intento de usar legacy_alumno_id en runtime UUID-only', {
    traceId,
    student_uuid,
    legacy_alumno_id: options.legacy_alumno_id,
    student_id: options.student_id
  });
  throw error;
}
```

**Métodos protegidos:**
- `markClean()`
- `setRemainingShared()`

### 6.2 Student Identity Repo

**Ubicación:** `src/infra/repos/student-identity-repo-pg.js`

**Guard:**
```javascript
async resolveLegacyId(student_uuid, client = null) {
  const traceId = getRequestId();
  const error = new Error('LEGACY alumno_id is FORBIDDEN. legacy_alumno_id fue eliminado en v5.70.1. Use student_uuid directamente.');
  error.code = 'LEGACY_ALUMNO_ID_FORBIDDEN';
  logError('StudentIdentityRepo', 'Intento de usar resolveLegacyId() en runtime UUID-only', {
    traceId,
    student_uuid,
    error: error.message
  });
  throw error;
}
```

**Razón:** `legacy_alumno_id` fue eliminado de la tabla `students` en v5.70.1

### 6.3 Verificación en Runtime

**Si aparece legacy en runtime:**
1. El guard lanza error explícito
2. El error incluye `code: 'LEGACY_ALUMNO_ID_FORBIDDEN'`
3. El log incluye `traceId` para debugging
4. El sistema **NO continúa** (fail-hard)

---

## 7. IMPACTO EN LPM / CPM

### 7.1 List Projection Model (LPM) - Bug de Peor Estado

**Problema anterior:**
```sql
-- ❌ BUG: Si legacy_alumno_id es NULL, el estudiante no aparece
SELECT item_ref, MIN(state) as worst_state
FROM cleaning_item_state
WHERE student_id IN (
  SELECT legacy_alumno_id FROM students WHERE deleted_at IS NULL
)
GROUP BY item_ref;
```

**Resultado:**
- Estudiantes sin `legacy_alumno_id` no aparecían en agregaciones
- Estados "nunca" se calculaban incorrectamente
- Peor estado podía ser incorrecto si faltaban estudiantes

**Solución UUID-only:**
```sql
-- ✅ CORRECTO: Todos los estudiantes tienen UUID válido
SELECT item_ref, MIN(state) as worst_state
FROM cleaning_item_state
WHERE student_id IN (
  SELECT id FROM students WHERE deleted_at IS NULL
)
GROUP BY item_ref;
```

**Resultado:**
- Todos los estudiantes aparecen en agregaciones
- Estados se calculan correctamente
- Peor estado es determinista

### 7.2 Cleaning Projection Model (CPM) - Agregaciones Falsas

**Problema anterior:**
- CPM agregaba estados usando `student_id INTEGER`
- Si había inconsistencias en `legacy_alumno_id`, se duplicaban o perdían estados
- Un estudiante podía tener múltiples `legacy_alumno_id` (violación de unicidad)

**Solución UUID-only:**
- CPM agrega estados usando `student_id UUID`
- UUID es único e inmutable (garantía de PostgreSQL)
- No hay duplicados ni pérdidas de estado

### 7.3 Por Qué UUID-Only Lo Hace Imposible

1. **UUID es único e inmutable:**
   - Generado por PostgreSQL: `gen_random_uuid()`
   - No puede haber duplicados (constraint PRIMARY KEY)
   - No cambia nunca (inmutable)

2. **FK garantiza integridad:**
   - Todas las tablas tienen FK a `students(id)`
   - Si un estudiante no existe, la FK falla
   - No hay estados huérfanos

3. **Sin resolución:**
   - No hay conversión UUID → INTEGER
   - No hay JOINs a `alumnos`
   - No hay dependencias ocultas

---

## 8. REGLA DE FUTURO

### 8.1 Cualquier Feature Nueva

**Regla absoluta:**
- ❌ **Legacy → RECHAZADA**
- ✅ **UUID → ACEPTADA**

### 8.2 Checklist Obligatorio

Antes de implementar cualquier feature que toque estudiantes:

- [ ] ¿Acepta `student_uuid` (UUID)?
- [ ] ¿NO acepta `student_id` (INTEGER)?
- [ ] ¿NO resuelve `legacy_alumno_id`?
- [ ] ¿NO hace JOIN a `alumnos`?
- [ ] ¿Usa `students.apodo`, `students.nombre_completo`, `students.email`?
- [ ] ¿FK apunta a `students.id` (UUID)?

**Si alguna respuesta es NO → RECHAZAR**

### 8.3 Ejemplos de Rechazo

**Rechazado:**
```javascript
// ❌ RECHAZADO: Usa student_id INTEGER
async function getStudentData(student_id) {
  // ...
}
```

**Aceptado:**
```javascript
// ✅ ACEPTADO: Usa student_uuid UUID
async function getStudentData(student_uuid) {
  // ...
}
```

---

## 9. MIGRACIONES APLICADAS

### 9.1 v5.70.0 - Migración de Esquema

**Archivo:** `database/migrations/v5.70.0-uuid-only-students-end-to-end.sql`

**Acciones:**
- 15 tablas migradas de `student_id INTEGER` → `student_uuid UUID`
- Backfill desde `students.legacy_alumno_id`
- FKs añadidas a `students(id)`
- Columnas legacy eliminadas

### 9.2 v5.70.1 - Eliminación de `legacy_alumno_id`

**Archivo:** `database/migrations/v5.70.1-drop-legacy-alumno-id.sql`

**Acciones:**
- Eliminada columna `legacy_alumno_id` de tabla `students`
- Verificación de que no hay dependencias

### 9.3 v5.70.2 - Añadir `email` a `students`

**Archivo:** `database/migrations/v5.70.2-add-email-to-students.sql`

**Acciones:**
- Añadida columna `email` a tabla `students`
- Backfill desde `alumnos.email` (última vez)
- Índice único añadido

---

## 10. REFERENCIAS

### 10.1 Documentos Relacionados

- `docs/IDENTIDAD_ALUMNOS_CANONICA_V1.md` → **DEPRECATED** (ver este documento)
- `docs/ALQUIMIA_UUID_ONLY_V1.md` → **DEPRECATED** (ver este documento)
- `docs/DIAGNOSTICO_FORENSE_LEGACY_ALUMNOS_V1.md` → Histórico (pre-migración)

### 10.2 Código Canónico

- `src/infra/repos/student-identity-repo-pg.js` → Guard constitucional
- `src/core/master/services/cleaning-engine-service.js` → Guards constitucionales
- `database/migrations/v5.70.0-*.sql` → Migraciones aplicadas

---

## 11. CONCLUSIÓN

**Legacy alumnos está MUERTO.**

**UUID es la única identidad válida.**

**Cualquier violación es bug constitucional.**

---

**Última actualización:** 2026-01-14  
**Versión del documento:** 2.0  
**Estado:** ENFORCED
