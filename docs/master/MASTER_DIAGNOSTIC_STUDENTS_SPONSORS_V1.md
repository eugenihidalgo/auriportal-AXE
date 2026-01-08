# DIAGNÓSTICO FORÉNSE MASTER — ALUMNOS Y APADRINADOS v1
## AuriPortal / Aurelín
**Fecha:** 2025-01-XX  
**Objetivo:** Fijar realidad canónica antes de diseño  
**Modo:** Observación pura (sin implementación)

---

## ═══════════════════════════════════════════════════════════════
## FASE 1 — INVENTARIO DE DATOS (POSTGRESQL)
## ═══════════════════════════════════════════════════════════════

### TABLA BASE: `alumnos` (Legacy Operativo)

**Ubicación:** Definida en `database/pg.js` (función `createTables()`)

**Estructura:**
```sql
CREATE TABLE alumnos (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  apodo VARCHAR(255),
  fecha_inscripcion TIMESTAMP NOT NULL,
  fecha_ultima_practica TIMESTAMP,
  nivel_actual INTEGER DEFAULT 1,
  nivel_manual INTEGER,
  streak INTEGER DEFAULT 0,
  estado_suscripcion VARCHAR(50) DEFAULT 'activa',
  fecha_reactivacion TIMESTAMP,
  energia_emocional INTEGER DEFAULT 5,
  tono_meditacion_id INTEGER REFERENCES tonos_meditacion(id),
  tema_preferido VARCHAR(20) DEFAULT 'light',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Índices:**
- `idx_alumnos_email` (email)
- `idx_alumnos_nivel_actual` (nivel_actual)
- `idx_alumnos_fecha_inscripcion` (fecha_inscripcion)
- `idx_alumnos_estado_suscripcion` (estado_suscripcion)

**Estado:** ⚠️ **LEGACY OPERATIVO** — Referenciada por múltiples tablas nuevas, pero NO es el SOT canónico del alumno.

**Referencias:**
- Usada como FK en múltiples tablas (student_product_memberships, student_domain_policies, student_item_state, etc.)
- Tabla `students` (UUID) tiene `legacy_alumno_id INTEGER` para migración gradual

---

### TABLA CANÓNICA: `students` (SOT Ontológico v1)

**Migración:** `v5.43.0-student-sot-ontological-operational.sql`

**Estructura:**
```sql
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status VARCHAR(20) NOT NULL DEFAULT 'NORMAL' CHECK (status IN ('NORMAL', 'DEGRADED', 'BROKEN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  legacy_alumno_id INTEGER UNIQUE REFERENCES alumnos(id) ON DELETE SET NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  feature_flags JSONB DEFAULT '{}'::jsonb,
  experiments JSONB DEFAULT '{}'::jsonb
);
```

**Estado:** ✅ **SOT ONTOLÓGICO CANÓNICO** — Identidad soberana del alumno.

**Comentarios canónicos:**
- `status`: Estado ontológico (NORMAL/DEGRADED/BROKEN), NO estado de negocio
- `legacy_alumno_id`: Referencia temporal para migración
- `meta`, `feature_flags`, `experiments`: Extension slots (v5.44.0)

---

### TABLA: `student_operational_state` (Estado Operativo)

**Migración:** `v5.43.0-student-sot-ontological-operational.sql`

**Estructura:**
```sql
CREATE TABLE student_operational_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  state VARCHAR(20) NOT NULL CHECK (state IN ('ACTIVE', 'PAUSED', 'SUSPENDED')),
  pause_profile_key TEXT REFERENCES pause_profiles(profile_key),
  pause_reason TEXT,
  source VARCHAR(20) NOT NULL CHECK (source IN ('subscription', 'master', 'system')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Estado:** ✅ **SOT OPERATIVO CANÓNICO** — Gobierna progreso, rachas, automatizaciones.

**Constraint único:** Solo un estado operativo activo por alumno (sin `ends_at`).

---

### TABLA: `student_product_memberships` (Suscripciones a Productos)

**Migración:** `v5.42.0-student-sot-v1.sql`

**Estructura:**
```sql
CREATE TABLE student_product_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  product_key TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, product_key)
);
```

**Estado:** ⚠️ **HÍBRIDO** — Usa `student_id INTEGER` (FK a `alumnos`), no `students.id` (UUID). Pendiente migración.

---

### TABLA: `student_domain_policies` (Políticas de Gobierno)

**Migración:** `v5.42.0-student-sot-v1.sql`

**Estructura:**
```sql
CREATE TABLE student_domain_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  domain_key TEXT NOT NULL,
  active_limit_default INTEGER NOT NULL DEFAULT 1,
  active_limit_override INTEGER,
  can_activate_multiple BOOLEAN GENERATED ALWAYS AS (...),
  set_by TEXT NOT NULL DEFAULT 'system' CHECK (set_by IN ('master', 'system')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, domain_key)
);
```

**Estado:** ⚠️ **HÍBRIDO** — Usa `student_id INTEGER` (FK a `alumnos`).

**Dominios soportados:** `transmutaciones_energeticas`, `proyectos`, `lugares`, `apadrinados`

---

### TABLA: `student_item_state` (Estado Personal por Ítem)

**Migración:** `v5.42.0-student-sot-v1.sql` + `v5.45.0-student-domain-integration-v1.sql`

**Estructura (simplificada):**
```sql
CREATE TABLE student_item_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  domain_key TEXT NOT NULL,
  domain_type TEXT,
  product_key TEXT DEFAULT 'pde',
  item_id INTEGER NOT NULL,
  item_ref_type TEXT DEFAULT 'catalog_id',
  item_ref TEXT,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  active_state TEXT DEFAULT 'inactive',
  is_clean BOOLEAN NOT NULL DEFAULT FALSE,
  clean_state TEXT DEFAULT 'unclean',
  clean_count INTEGER NOT NULL DEFAULT 0,
  last_cleaned_at TIMESTAMPTZ,
  recommended_recurrence_days INTEGER,
  student_recurrence_days INTEGER,
  counters JSONB DEFAULT '{}'::jsonb,
  per_item_config JSONB DEFAULT '{}'::jsonb,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, product_key, domain_type, item_ref)
);
```

**Estado:** ⚠️ **HÍBRIDO** — Usa `student_id INTEGER` (FK a `alumnos`).

**Campos evolutivos:**
- `domain_key` (legacy) + `domain_type` (nuevo)
- `item_id` (legacy) + `item_ref` (nuevo)
- `is_active` (legacy) + `active_state` (nuevo)
- `is_clean` (legacy) + `clean_state` (nuevo)

---

### TABLA: `student_item_state_audit` (Auditoría Append-Only)

**Migración:** `v5.42.0-student-sot-v1.sql`

**Estructura:**
```sql
CREATE TABLE student_item_state_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  domain_key TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('master', 'student', 'system')),
  actor_id TEXT,
  before JSONB,
  after JSONB,
  trace_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Estado:** ✅ **AUDITORÍA CANÓNICA** — Append-only, no se modifica.

---

### TABLA: `pause_profiles` (Perfiles de Pausa Configurables)

**Migración:** `v5.43.0-student-sot-ontological-operational.sql`

**Estructura:**
```sql
CREATE TABLE pause_profiles (
  profile_key TEXT PRIMARY KEY,
  definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Estado:** ✅ **SOT CANÓNICO** — Define efectos de pausa sin hardcodear lógica.

**Perfil por defecto:** `subscription_pause_default` (freeze level_progression, streaks, block_new contexts, etc.)

---

### TABLA: `sponsors_catalog` (Catálogo de Apadrinados)

**Migración:** `v5.56.0-sponsors-system-v1-targetref.sql`

**Estructura:**
```sql
CREATE TABLE sponsors_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  description TEXT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP NULL
);
```

**Estado:** ✅ **SOT CANÓNICO** — Nodo apadrinado (dependiente de alumnos).

---

### TABLA: `sponsor_student_links` (Vínculos Apadrinado ↔ Alumno)

**Migración:** `v5.56.0-sponsors-system-v1-targetref.sql`

**Estructura:**
```sql
CREATE TABLE sponsor_student_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id UUID NOT NULL REFERENCES sponsors_catalog(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'padrino' CHECK (role IN ('padrino')),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP NULL,
  UNIQUE (sponsor_id, student_id) WHERE deleted_at IS NULL
);
```

**Estado:** ⚠️ **HÍBRIDO** — Usa `student_id INTEGER` (FK a `alumnos`), no `students.id` (UUID).

**Invariante:** Sponsor existe operativamente si tiene >=1 vínculo activo.

---

### TABLA: `sponsor_special_care` (Cuidados Especiales)

**Migración:** `v5.56.0-sponsors-system-v1-targetref.sql`

**Estructura:**
```sql
CREATE TABLE sponsor_special_care (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id UUID NOT NULL REFERENCES sponsors_catalog(id) ON DELETE CASCADE,
  category_term_id UUID NOT NULL REFERENCES pde_classification_terms(id) ON DELETE RESTRICT,
  starts_at TIMESTAMP NOT NULL DEFAULT now(),
  ends_at TIMESTAMP NOT NULL,
  priority INT NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP NULL,
  UNIQUE (sponsor_id, category_term_id) WHERE deleted_at IS NULL
);
```

**Estado:** ✅ **SOT CANÓNICO** — Estados especiales temporales por categoría.

---

### TABLA: `sponsor_special_care_lists` (Asociación Care ↔ Lista Alquimia)

**Migración:** `v5.56.0-sponsors-system-v1-targetref.sql`

**Estructura:**
```sql
CREATE TABLE sponsor_special_care_lists (
  care_id UUID NOT NULL REFERENCES sponsor_special_care(id) ON DELETE CASCADE,
  transmutation_list_id INTEGER NOT NULL REFERENCES listas_transmutaciones(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY (care_id, transmutation_list_id)
);
```

**Estado:** ✅ **SOT CANÓNICO** — Relación N:M entre cuidados y listas.

---

### TABLA: `ute_student_state` (Estado UTE por Alumno)

**Migración:** `v5.53.0-ute-core-v1.sql`

**Estructura (simplificada):**
```sql
CREATE TABLE ute_student_state (
  id BIGSERIAL PRIMARY KEY,
  ute_id UUID NOT NULL REFERENCES ute_definitions(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('never', 'pending', 'reviewed', 'critical', 'completed')),
  last_executed_at TIMESTAMPTZ,
  count_executed INTEGER NOT NULL DEFAULT 0,
  days_since_last_execution INTEGER,
  days_until_critical INTEGER,
  remaining_count INTEGER,
  ...
);
```

**Estado:** ⚠️ **HÍBRIDO** — Usa `student_id INTEGER` (sin FK explícita, asume `alumnos.id`).

---

### TABLAS LEGACY (Referenciadas pero No Canónicas)

**Tablas que usan `alumno_id` pero son legacy operativo:**

1. **`alumnos_lugares`** — Lugares personales de alumnos (v5.4.0)
2. **`alumnos_proyectos`** — Proyectos personales de alumnos (v5.4.0)
3. **`alumnos_apadrinados`** — Apadrinados personales de alumnos (v5.4.0)
4. **`transmutaciones_apadrinados`** — Transmutaciones de apadrinados (v5.4.0)
5. **`transmutaciones_apadrinados_estado`** — Estado de transmutaciones de apadrinados (v5.4.0)
6. **`pausas`** — Pausas de alumnos (legacy)
7. **`practicas`** — Prácticas de alumnos (legacy)

**Estado:** ❌ **LEGACY OPERATIVO** — Mantenidas por compatibilidad, no son SOT canónico.

---

## ═══════════════════════════════════════════════════════════════
## FASE 2 — REPOSITORIOS (DOMINIO vs INFRA)
## ═══════════════════════════════════════════════════════════════

### REPOSITORIOS CANÓNICOS (Core Domain)

#### `src/core/repos/student-repo.js` + `src/infra/repos/student-repo-pg.js`

**Interfaz pública:**
- `getById(id)` — Obtiene alumno por ID
- `getByEmail(email)` — Obtiene alumno por email
- `create(data)` — Crea nuevo alumno
- `update(id, patch)` — Actualiza alumno
- `delete(id)` — Elimina alumno (soft delete)

**Tablas que toca:** `alumnos` (legacy)

**Estado:** ⚠️ **DUDOSO** — Usa tabla `alumnos` legacy, no `students` (UUID).

**Violaciones:**
- ❌ No usa `students` (UUID) como SOT ontológico
- ⚠️ Mezcla identidad (alumnos) con estado operativo

---

#### `src/core/repos/student-ontological-repo.js` + `src/infra/repos/student-ontological-repo-pg.js`

**Interfaz pública:**
- `getById(id)` — Obtiene student (UUID) por ID
- `create(data)` — Crea nuevo student (UUID)
- `update(id, patch)` — Actualiza student
- `linkLegacy(legacyAlumnoId)` — Vincula con `alumnos.id`

**Tablas que toca:** `students` (UUID)

**Estado:** ✅ **CANÓNICO** — SOT ontológico.

---

#### `src/core/repos/student-operational-state-repo.js` + `src/infra/repos/student-operational-state-repo-pg.js`

**Interfaz pública:**
- `getActiveState(studentId)` — Obtiene estado operativo activo
- `setState(studentId, state, options)` — Establece estado operativo
- `endState(stateId)` — Finaliza estado operativo

**Tablas que toca:** `student_operational_state`

**Estado:** ✅ **CANÓNICO** — SOT operativo.

---

#### `src/core/repos/student-item-state-repo.js` + `src/infra/repos/student-item-state-repo-pg.js`

**Interfaz pública:**
- `getByStudentAndDomain(studentId, domainKey)` — Obtiene estados por dominio
- `getByItem(studentId, domainKey, itemId)` — Obtiene estado de un ítem
- `activate(studentId, domainKey, itemId, options)` — Activa ítem
- `deactivate(studentId, domainKey, itemId)` — Desactiva ítem
- `markClean(studentId, domainKey, itemId)` — Marca como limpio
- `updateRecurrence(studentId, domainKey, itemId, days)` — Actualiza recurrencia

**Tablas que toca:** `student_item_state`, `student_item_state_audit`

**Estado:** ⚠️ **HÍBRIDO** — Usa `student_id INTEGER` (FK a `alumnos`), no `students.id` (UUID).

---

#### `src/core/repos/student-domain-policy-repo.js` + `src/infra/repos/student-domain-policy-repo-pg.js`

**Interfaz pública:**
- `getByStudentAndDomain(studentId, domainKey)` — Obtiene política
- `setOverride(studentId, domainKey, override, options)` — Establece override del Master
- `removeOverride(studentId, domainKey)` — Elimina override

**Tablas que toca:** `student_domain_policies`

**Estado:** ⚠️ **HÍBRIDO** — Usa `student_id INTEGER` (FK a `alumnos`).

---

#### `src/core/repos/student-transmutation-state-repo.js` + `src/infra/repos/student-transmutation-state-repo-pg.js`

**Interfaz pública:**
- Métodos para gestionar estado de transmutaciones energéticas por alumno

**Tablas que toca:** `student_te_recurrent_state`, `student_te_one_time_state` (v5.35.0)

**Estado:** ⚠️ **HÍBRIDO** — Usa `student_id INTEGER` (FK a `alumnos`).

---

#### `src/core/repos/student-place-state-repo.js` + `src/infra/repos/student-place-state-repo-pg.js`

**Interfaz pública:**
- Métodos para gestionar estado de lugares por alumno

**Tablas que toca:** `student_place_state` (v5.54.0)

**Estado:** ⚠️ **HÍBRIDO** — Usa `student_id INTEGER` (FK a `alumnos`).

---

#### `src/core/repos/student-project-state-repo.js` + `src/infra/repos/student-project-state-repo-pg.js`

**Interfaz pública:**
- Métodos para gestionar estado de proyectos por alumno

**Tablas que toca:** `student_project_state` (v5.55.0)

**Estado:** ⚠️ **HÍBRIDO** — Usa `student_id INTEGER` (FK a `alumnos`).

---

#### `src/core/repos/student-activation-limit-repo.js` + `src/infra/repos/student-activation-limit-repo-pg.js`

**Interfaz pública:**
- Métodos para gestionar límites de activación por dominio

**Tablas que toca:** `student_activation_limits` (v5.54.0)

**Estado:** ⚠️ **HÍBRIDO** — Usa `student_id INTEGER` (FK a `alumnos`).

---

#### `src/core/repos/student-audit-repo.js` + `src/infra/repos/student-audit-repo-pg.js`

**Interfaz pública:**
- `createAuditEvent(data, client)` — Crea evento de auditoría

**Tablas que toca:** `student_item_state_audit`

**Estado:** ✅ **CANÓNICO** — Auditoría append-only.

---

#### `src/infra/repos/master-student-transmutation-read-repo-pg.js`

**Interfaz pública:**
- Métodos de lectura para transmutaciones por alumno (vista Master)

**Estado:** ⚠️ **HÍBRIDO** — Usa `student_id INTEGER`.

---

### REPOSITORIOS SPONSORS (Canónicos)

#### `src/infra/repos/sponsors/sponsor-catalog-repo-pg.js`

**Interfaz pública:**
- `getById(id)` — Obtiene sponsor por ID
- `create(data)` — Crea nuevo sponsor
- `update(id, patch)` — Actualiza sponsor
- `archive(id)` — Archiva sponsor
- `list(options)` — Lista sponsors con filtros

**Tablas que toca:** `sponsors_catalog`

**Estado:** ✅ **CANÓNICO** — SOT de apadrinados.

---

#### `src/infra/repos/sponsors/sponsor-links-repo-pg.js`

**Interfaz pública:**
- `link(sponsorId, studentId)` — Vincula alumno a sponsor
- `unlink(sponsorId, studentId)` — Desvincula alumno de sponsor
- `listBySponsor(sponsorId)` — Lista vínculos por sponsor
- `listByStudent(studentId)` — Lista vínculos por alumno
- `countActiveLinks(sponsorId)` — Cuenta vínculos activos

**Tablas que toca:** `sponsor_student_links`

**Estado:** ⚠️ **HÍBRIDO** — Usa `student_id INTEGER` (FK a `alumnos`).

---

#### `src/infra/repos/sponsors/sponsor-special-care-repo-pg.js`

**Interfaz pública:**
- `createCare(data)` — Crea cuidado especial
- `updateCare(careId, patch)` — Actualiza cuidado
- `endCare(careId)` — Finaliza cuidado
- `listActiveCareBySponsor(sponsorId, now)` — Lista cuidados activos
- `getCareLists(careId)` — Obtiene listas asociadas
- `setCareLists(careId, listIds)` — Establece listas asociadas
- `listQueue(options)` — Lista cola de cuidados (horizon_days)

**Tablas que toca:** `sponsor_special_care`, `sponsor_special_care_lists`

**Estado:** ✅ **CANÓNICO** — SOT de cuidados especiales.

---

#### `src/core/repos/sponsors/sponsor-catalog-repo.js`

**Interfaz pública:**
- Interfaz core (implementación en infra)

**Estado:** ✅ **CANÓNICO** — Interfaz core.

---

#### `src/core/repos/sponsors/sponsor-links-repo.js`

**Interfaz pública:**
- Interfaz core (implementación en infra)

**Estado:** ✅ **CANÓNICO** — Interfaz core.

---

#### `src/core/repos/sponsors/sponsor-special-care-repo.js`

**Interfaz pública:**
- Interfaz core (implementación en infra)

**Estado:** ✅ **CANÓNICO** — Interfaz core.

---

## ═══════════════════════════════════════════════════════════════
## FASE 3 — SERVICIOS (QUIÉN DECIDE)
## ═══════════════════════════════════════════════════════════════

### SERVICIO: `sponsor-service.js` (Canónico)

**Path:** `src/core/master/services/sponsor-service.js`

**Responsabilidades:**
- Crear/actualizar/archivar sponsors
- Vincular/desvincular estudiantes
- Gestionar cuidados especiales
- Emitir señales con TARGET_REF

**Decisiones que toma:**
- ✅ Invariante: Sponsor archivado si sin vínculos activos
- ✅ Invariante: Sponsor reactivado si obtiene vínculos
- ✅ Invariante: No permitir cuidado duplicado activo por categoría
- ✅ Emisión de señales: `sponsor.created`, `sponsor.updated`, `sponsor.archived`, `sponsor.linked`, `sponsor.unlinked`, `sponsor.special_care.started`, `sponsor.special_care.extended`, `sponsor.special_care.ended`

**Dependencias:**
- `sponsor-catalog-repo-pg.js`
- `sponsor-links-repo-pg.js`
- `sponsor-special-care-repo-pg.js`
- `student-repo-pg.js` (⚠️ usa tabla `alumnos` legacy)
- `signal-dispatcher.js`

**Señales que emite:**
- `sponsor.created` (con target_ref)
- `sponsor.updated` (con target_ref)
- `sponsor.archived` (con target_ref)
- `sponsor.linked` (con target_ref)
- `sponsor.unlinked` (con target_ref)
- `sponsor.special_care.started` (con target_ref)
- `sponsor.special_care.extended` (con target_ref)
- `sponsor.special_care.ended` (con target_ref)

**Estado:** ✅ **CANÓNICO** — Lógica de negocio pura, sin UI, con invariantes explícitos.

**Función especial:** `handleStudentPauseOrUnsubscribe(studentId, reason, options)`
- Desvincula todos los sponsors del alumno
- Archiva sponsors que quedan sin vínculos
- Emite señales de desvinculación

---

### SERVICIO: `student-sot-service.js` (Híbrido)

**Path:** `src/services/student-sot-service.js`

**Responsabilidades:**
- Gestión de identidad del alumno
- Gestión de product memberships
- PostgreSQL como única autoridad

**Métodos:**
- `getStudent(studentId)` — Obtiene alumno por ID
- `getStudentByEmail(email)` — Obtiene alumno por email
- `listStudents(filter)` — Lista alumnos con filtros
- `ensureStudentExists(email, data)` — Asegura que existe un alumno

**Tablas que toca:** `alumnos` (legacy)

**Estado:** ⚠️ **HÍBRIDO** — Usa tabla `alumnos` legacy, no `students` (UUID).

**Problemas:**
- ❌ No usa `students` (UUID) como SOT ontológico
- ❌ No gestiona `student_product_memberships`

---

### SERVICIO: `student-operational-service.js` (Canónico)

**Path:** `src/services/student-operational-service.js`

**Responsabilidades:**
- Pausar/reanudar alumnos
- Aplicar perfiles de pausa
- Emitir eventos de auditoría
- Asegurar coherencia del estado operativo

**Métodos:**
- `pauseStudent(studentId, profileKey, source, reason, traceId)` — Pausa un alumno
- `resumeStudent(studentId, source, traceId)` — Reanuda un alumno
- `getCurrentState(studentId)` — Obtiene estado operativo actual

**Tablas que toca:** `student_operational_state`, `pause_profiles`, `students` (UUID)

**Dependencias:**
- `student-operational-state-repo-pg.js`
- `pause-profiles-repo-pg.js`
- `student-ontological-repo-pg.js`
- `student-audit-repo-pg.js`

**Estado:** ✅ **CANÓNICO** — Usa `students` (UUID) como SOT ontológico.

**Nota:** El servicio tiene TODO para emitir señal `student.paused`, pero está comentado: `// TODO: Emitir señal student.paused (cuando el sistema de señales esté listo)`

---

### SERVICIO: `student-domain-state-service.js` (Híbrido)

**Path:** `src/services/student-domain-state-service.js`

**Responsabilidades:**
- Gestión de estado de ítems por dominio
- Enforcement de políticas (límites de activación)
- Auditoría completa
- Operaciones de limpieza

**Métodos:**
- `listDomainItemsForStudent(studentId, domainKey, options)` — Lista ítems de un dominio
- `setActive(studentId, domainKey, itemId, isActive, actor, traceId)` — Activa/desactiva ítem
- `cleanItem(studentId, domainKey, itemId, actor, traceId)` — Marca ítem como limpio
- `setStudentRecurrence(studentId, domainKey, itemId, days, actor, traceId)` — Actualiza recurrencia

**Tablas que toca:** `student_item_state`, `student_domain_policies`, `student_item_state_audit`

**Estado:** ⚠️ **HÍBRIDO** — Usa `student_id INTEGER` (FK a `alumnos`).

**Decisiones que toma:**
- ✅ Valida límite de activos si actor es `student` (no si es `master`)
- ✅ Master puede activar sin límite
- ✅ Auditoría completa de todas las operaciones

---

### SERVICIO: `student-mutation-service.js` (Híbrido)

**Path:** `src/core/services/student-mutation-service.js`

**Responsabilidades:**
- Coordinador de escritura (NO motor de negocio)
- Validación, escritura, auditoría, preparación de señales
- Manejo de transacciones

**Métodos:**
- `updateNivel(email, nivel, actor, client)` — Actualiza nivel
- `updateStreak(email, streak, actor, client)` — Actualiza racha
- `updateLastPractice(email, fecha, actor, client)` — Actualiza última práctica
- `updateSubscriptionStatus(email, estado, actor, client)` — Actualiza estado de suscripción
- `updateApodo(email, nuevoApodo, actor, client)` — Actualiza apodo
- `createStudent(data, actor, client)` — Crea nuevo alumno
- `registerPractice(email, fecha, tipo, origen, actor, client)` — Registra práctica

**Tablas que toca:** `alumnos` (legacy), `practicas`, `audit_log`

**Dependencias:**
- `student-repo-pg.js` (⚠️ usa `alumnos` legacy)
- `audit-repo-pg.js`
- `practice-repo-pg.js`
- `sponsor-service.js` (para limpieza en pausa/baja)

**Estado:** ⚠️ **HÍBRIDO** — Usa tabla `alumnos` legacy, no `students` (UUID).

**Señales que prepara (pero NO emite aún):**
- `student.level_changed`
- `student.streak_changed`
- `student.last_practice_updated`
- `student.subscription_status_changed`
- `student.apodo_changed`
- `student.created`
- `student.practice_registered`

**Problemas:**
- ❌ Prepara señales pero NO las emite (solo placeholder)
- ❌ Usa `alumnos` legacy, no `students` (UUID)
- ⚠️ Integrado con `sponsor-service` para limpieza en pausa/baja

---

### SERVICIO: `student-domain-integration-service.js` (Híbrido)

**Path:** `src/core/student/domains/student-domain-integration-service.js`

**Responsabilidades:**
- Integración de dominios (transmutaciones, proyectos, lugares)
- Emisión de señales de dominio

**Métodos:**
- Métodos para activar/desactivar/limpiar ítems por dominio
- Emisión de señales: `student.domain.item.cleaned`, `student.domain.item.activated`, `student.project.active_changed`, `student.domain.item.metadata_updated`

**Estado:** ⚠️ **HÍBRIDO** — Usa `student_id INTEGER`.

---

### SERVICIO: `student-coherence-checker.js` (Canónico)

**Path:** `src/core/student/coherence/student-coherence-checker.js`

**Responsabilidades:**
- Verificar coherencia del estado del alumno
- Detectar violaciones de invariantes
- Emitir señales de observabilidad

**Señales que emite:**
- `student.coherence.degraded`
- `student.coherence.broken`
- `student.sot.invariant_violation_detected`

**Estado:** ✅ **CANÓNICO** — Verifica coherencia del SOT.

---

### SERVICIOS LEGACY (No Canónicos)

**No se encontraron servicios MASTER canónicos para:**
- Crear/modificar alumnos desde MASTER (solo desde Admin o legacy)
- Gestionar políticas de dominio desde MASTER (solo repos)

**Estado:** ❌ **DEUDA** — Falta capa de servicios canónica para operaciones de alumnos desde MASTER.

---

## ═══════════════════════════════════════════════════════════════
## FASE 4 — ENDPOINTS / APIs MASTER
## ═══════════════════════════════════════════════════════════════

### API: `/master/api/students` (Diagnóstico v1)

**Handler:** `src/endpoints/master-api-students.js`

**Endpoints:**
- `GET /master/api/students?limit=50&offset=0&search=&include_columns=true` — Lista alumnos
- `GET /master/api/students/:id` — Obtiene alumno por ID

**Contrato de respuesta:**
```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": 123,
        "student_id": 123,
        "email": "alumno@ejemplo.com",
        "name": "Apodo",
        "apodo": "Apodo",
        "nombre_completo": null
      }
    ],
    "total": 100,
    "limit": 50,
    "offset": 0
  },
  "trace_id": "..."
}
```

**Tabla que consulta:** `alumnos` (legacy)

**Auth:** `requireAdminContext()` (mismo sistema de sesión que Admin)

**Estado:** ⚠️ **DIAGNÓSTICO** — Read-only, solo para diagnóstico. No es API canónica de gestión.

**Problemas:**
- ❌ Usa tabla `alumnos` legacy, no `students` (UUID)
- ❌ No incluye estado operativo
- ❌ No incluye políticas de dominio
- ❌ No incluye vínculos con sponsors

---

### API: `/master/api/sponsors` (Canónica v1)

**Handler:** `src/endpoints/master-api-sponsors.js`

**Endpoints:**
- `GET /master/api/sponsors?search=&include_archived=0&order1=display_name:ASC&limit=50&offset=0` — Lista sponsors
- `POST /master/api/sponsors` — Crea sponsor
- `GET /master/api/sponsors/:id` — Obtiene sponsor por ID
- `PATCH /master/api/sponsors/:id` — Actualiza sponsor
- `POST /master/api/sponsors/:id/link` — Vincula estudiante
- `POST /master/api/sponsors/:id/unlink` — Desvincula estudiante
- `GET /master/api/sponsors/by-student/:studentId` — Obtiene sponsors por alumno
- `POST /master/api/sponsors/internal/cleanup-student/:studentId` — Limpieza interna (desvincula todos)

**Contrato de respuesta:**
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "display_name": "Nombre",
    "description": "...",
    "status": "active",
    "target_ref": {
      "target_type": "sponsor",
      "target_id": "uuid"
    },
    "links": [...],
    "active_care": [...]
  },
  "trace_id": "..."
}
```

**Servicio usado:** `sponsor-service.js`

**Auth:** `requireAdminContext()`

**Estado:** ✅ **CANÓNICA** — API completa con TARGET_REF_CONTRACT v1.

---

### API: `/master/api/sponsors/care/*` (Cuidados Especiales)

**Handler:** `src/endpoints/master-api-sponsor-care.js`

**Endpoints:**
- `GET /master/api/sponsors/care/queue?horizon_days=14&category_term_id=...` — Cola de cuidados
- `POST /master/api/sponsors/:id/care` — Añade cuidado especial
- `POST /master/api/sponsors/care/:careId/extend` — Extiende cuidado
- `POST /master/api/sponsors/care/:careId/end` — Finaliza cuidado

**Servicio usado:** `sponsor-service.js`

**Estado:** ✅ **CANÓNICA** — API completa para cuidados especiales.

---

### APIs que usan `student_id` (No Canónicas de Alumnos)

**APIs que reciben `student_id` pero NO son APIs de gestión de alumnos:**

1. `/master/api/alquimia/alumno/:student_id` — Alquimia por alumno
2. `/master/api/places/student/:student_id` — Lugares por alumno
3. `/master/api/projects/student/:student_id` — Proyectos por alumno

**Estado:** ⚠️ **DEUDA** — Usan `student_id` pero no gestionan el alumno en sí.

---

## ═══════════════════════════════════════════════════════════════
## FASE 5 — UI MASTER (USO REAL DE ALUMNOS)
## ═══════════════════════════════════════════════════════════════

### UI: `/master/alumnos` (Island)

**Handler:** `src/endpoints/master-alumnos.js`

**Endpoints que consume:**
- `GET /master/api/students` (diagnóstico)

**Qué espera del alumno:**
- `id`, `email`, `apodo`, `nombre_completo`

**Estado:** ⚠️ **DIAGNÓSTICO** — Solo lectura, no gestión.

---

### UI: `/master/alumnos/postgresql` (Island)

**Handler:** `src/endpoints/master-alumnos-postgresql.js`

**Estado:** ⚠️ **DIAGNÓSTICO** — Visualización de datos PostgreSQL.

---

### UI: `/master/alumnos/alumnos` (Island)

**Handler:** `src/endpoints/master-alumnos-alumnos.js`

**Estado:** ⚠️ **DIAGNÓSTICO** — Visualización de tabla `alumnos`.

---

### UI: `/master/alumnos/info` (Island)

**Handler:** `src/endpoints/master-alumnos-info.js`

**Estado:** ⚠️ **DIAGNÓSTICO** — Información detallada de alumno.

---

### UI: `/master/templo-luz/alquimia-alumno` (Island)

**Handler:** `src/endpoints/master-templo-luz-alquimia-alumno.js`

**Endpoints que consume:**
- `GET /master/api/alquimia/alumno/:student_id`

**Qué espera del alumno:**
- `student_id` (parámetro de ruta)

**Estado:** ⚠️ **DEUDA** — Usa `student_id` pero no gestiona el alumno.

---

### UI: `/master/templo-luz/apadrinados` (Island)

**Handler:** `src/endpoints/master-templo-luz-apadrinados.js`

**Endpoints que consume:**
- `GET /master/api/sponsors`
- `POST /master/api/sponsors`
- `GET /master/api/sponsors/:id`
- `PATCH /master/api/sponsors/:id`
- `POST /master/api/sponsors/:id/link`
- `POST /master/api/sponsors/:id/unlink`
- `GET /master/api/sponsors/by-student/:studentId`
- `GET /master/api/sponsors/care/queue`

**Qué espera del alumno:**
- `student_id` (para vincular/desvincular)

**Estado:** ✅ **CANÓNICA** — UI completa para gestión de apadrinados.

---

### UI: `/master/templo-luz/lugares` (Island)

**Handler:** `src/endpoints/master-templo-luz-lugares.js`

**Endpoints que consume:**
- `GET /master/api/places/active`
- `GET /master/api/places/student/:student_id`
- `POST /master/api/places/activate`
- `POST /master/api/places/deactivate`
- `POST /master/api/places/clean`
- `POST /master/api/places/clean-bulk`
- `POST /master/api/places/clean-all`
- `POST /master/api/places/limit`
- `PATCH /master/api/places/state/:id`
- `POST /master/api/places/create-for-student`

**Qué espera del alumno:**
- `student_id` (parámetro de ruta o body)

**Estado:** ⚠️ **DEUDA** — Usa `student_id` pero no gestiona el alumno.

---

### UI: `/master/templo-luz/proyectos` (Island)

**Handler:** `src/endpoints/master-templo-luz-proyectos.js`

**Endpoints que consume:**
- `GET /master/api/projects/active`
- `GET /master/api/projects/student/:student_id`
- `POST /master/api/projects/activate`
- `POST /master/api/projects/deactivate`
- `POST /master/api/projects/clean`
- `POST /master/api/projects/clean-bulk`
- `POST /master/api/projects/clean-all`
- `POST /master/api/projects/limit`
- `PATCH /master/api/projects/state/:id`
- `POST /master/api/projects/create-for-student`

**Qué espera del alumno:**
- `student_id` (parámetro de ruta o body)

**Estado:** ⚠️ **DEUDA** — Usa `student_id` pero no gestiona el alumno.

---

## ═══════════════════════════════════════════════════════════════
## FASE 6 — SEÑALES
## ═══════════════════════════════════════════════════════════════

### SEÑALES SPONSORS (Canónicas)

**Emitidas por:** `sponsor-service.js`

1. **`sponsor.created`**
   - Payload: `{ sponsor_id, target_ref, display_name, student_ids }`
   - Incluye `target_ref`: `{ target_type: 'sponsor', target_id: uuid }`

2. **`sponsor.updated`**
   - Payload: `{ sponsor_id, target_ref, changes }`

3. **`sponsor.archived`**
   - Payload: `{ sponsor_id, target_ref }`

4. **`sponsor.linked`**
   - Payload: `{ sponsor_id, target_ref, student_id }`

5. **`sponsor.unlinked`**
   - Payload: `{ sponsor_id, target_ref, student_id, reason }`

6. **`sponsor.special_care.started`**
   - Payload: `{ sponsor_id, target_ref, care_id, category_term_id, duration_days, ends_at }`

7. **`sponsor.special_care.extended`**
   - Payload: `{ sponsor_id, target_ref, care_id, category_term_id, new_ends_at, add_days, set_days }`

8. **`sponsor.special_care.ended`**
   - Payload: `{ sponsor_id, target_ref, care_id, category_term_id }`

**Estado:** ✅ **CANÓNICAS** — Todas incluyen `target_ref` (TARGET_REF_CONTRACT v1).

---

### SEÑALES STUDENTS (Registradas pero No Emitidas)

**Registry:** `src/core/student/signals/student-signal-registry.js`

**Señales DOMAIN registradas (pero NO todas se emiten):**

1. **`student.created`**
   - Payload: `{ student_id (UUID), legacy_alumno_id, trace_id }`
   - Estado: ⚠️ Registrada pero NO se emite desde servicios canónicos
   - Emitida desde: `student-mutation-service.js` (prepara pero no emite)

2. **`student.enrolled`**
   - Payload: `{ student_id (UUID), product_key, membership_id, trace_id }`
   - Estado: ❌ Registrada pero NO se emite

3. **`student.operational.paused`**
   - Payload: `{ student_id (UUID), pause_profile_key, source, reason, trace_id }`
   - Estado: ⚠️ Registrada, `student-operational-service.js` tiene TODO pero está comentado

4. **`student.operational.resumed`**
   - Payload: `{ student_id (UUID), source, trace_id }`
   - Estado: ⚠️ Registrada pero NO se emite

5. **`student.domain.item.activated`**
   - Payload: `{ student_id (UUID), domain_key, item_id, actor_type, trace_id }`
   - Estado: ✅ Emitida desde `student-domain-integration-service.js`

6. **`student.domain.item.deactivated`**
   - Payload: `{ student_id (UUID), domain_key, item_id, actor_type, trace_id }`
   - Estado: ❌ Registrada pero NO se emite

7. **`student.domain.item.cleaned`**
   - Payload: `{ student_id (UUID), domain_key, item_id, clean_count, actor_type, trace_id }`
   - Estado: ✅ Emitida desde `student-domain-integration-service.js`

8. **`student.domain.bulk_cleaned`**
   - Payload: `{ student_id (UUID), domain_key, items_count, actor_type, trace_id }`
   - Estado: ❌ Registrada pero NO se emite

9. **`student.capability.changed`**
   - Payload: `{ student_id (UUID), changed_capabilities, reason, trace_id }`
   - Estado: ❌ Registrada pero NO se emite

10. **`student.domain.item.metadata_updated`**
    - Payload: `{ student_id (UUID), domain_key, item_id, metadata, actor_type, trace_id }`
    - Estado: ✅ Emitida desde `student-domain-integration-service.js`

11. **`student.project.active_changed`**
    - Payload: `{ student_id (UUID), project_ref, actor_type, trace_id }`
    - Estado: ✅ Emitida desde `student-domain-integration-service.js`

**Señales OBSERVABILITY registradas:**

1. **`student.coherence.degraded`**
   - Payload: `{ student_id (UUID), issues, trace_id }`
   - Estado: ✅ Emitida desde `student-coherence-checker.js`

2. **`student.coherence.broken`**
   - Payload: `{ student_id (UUID), issues, trace_id }`
   - Estado: ✅ Emitida desde `student-coherence-checker.js`

3. **`student.sot.invariant_violation_detected`**
   - Payload: `{ student_id (UUID), invariant_code, severity, details, trace_id }`
   - Estado: ✅ Emitida desde `student-coherence-checker.js`

4. **`student.sot.backfill.applied`**
   - Payload: `{ student_id (UUID), legacy_alumno_id, backfill_type, trace_id }`
   - Estado: ❌ Registrada pero NO se emite

**Señales PLACES registradas:**

- `place.activated`, `place.deactivated`, `place.cleaned`, `place.cleaned.bulk`, `place.cleaned.all`, `place.deactivated.all`
- `place.category.created`, `place.category.updated`, `place.category.reordered`, `place.category.deactivated`
- `place.activation_limit.updated`

**Estado:** ⚠️ **HÍBRIDO** — Muchas señales registradas pero NO todas se emiten.

**Señales PROJECTS registradas:**

- `project.activated`, `project.deactivated`, `project.cleaned`, `project.cleaned.bulk`, `project.cleaned.all`, `project.deactivated.all`
- `project.category.created`, `project.category.updated`, `project.category.reordered`, `project.category.deactivated`
- `project.activation_limit.updated`

**Estado:** ⚠️ **HÍBRIDO** — Muchas señales registradas pero NO todas se emiten.

**Problemas:**
- ❌ `student-mutation-service.js` prepara señales pero NO las emite (solo placeholder)
- ❌ `student-operational-service.js` tiene TODO para emitir `student.operational.paused` pero está comentado
- ⚠️ Solo algunas señales de dominio se emiten desde `student-domain-integration-service.js`
- ✅ Señales de observabilidad SÍ se emiten desde `student-coherence-checker.js`

**Emitter:** `src/core/student/signals/student-signal-emitter.js`
- Valida que la señal esté registrada
- Registra en auditoría si es señal de dominio
- TODO: Integrar con sistema general de señales cuando esté disponible

---

## ═══════════════════════════════════════════════════════════════
## FASE 7 — CONTEXTOS / UTE / AUTOMATIZACIONES
## ═══════════════════════════════════════════════════════════════

### UTE (Unidades de Trabajo Energético)

**Tabla:** `ute_student_state` (v5.53.0)

**Estructura:**
- `student_id INTEGER` (sin FK explícita, asume `alumnos.id`)
- `ute_id UUID` (FK a `ute_definitions`)
- `state`: `'never' | 'pending' | 'reviewed' | 'critical' | 'completed'`
- Métricas temporales: `last_executed_at`, `count_executed`, `days_since_last_execution`, etc.

**APIs:**
- `GET /master/api/ute/definitions` — Lista definiciones UTE
- `GET /master/api/ute/:ute_id/states` — Estados por UTE
- `POST /master/api/ute/:ute_id/execute` — Ejecuta UTE para un alumno
- `POST /master/api/ute/:ute_id/execute_global` — Ejecuta UTE globalmente
- `POST /master/api/ute/:ute_id/recompute` — Recalcula estados

**Estado:** ⚠️ **HÍBRIDO** — Usa `student_id INTEGER` (legacy), no `students.id` (UUID).

**Dependencias:**
- Asume que `student_id` existe en `alumnos`
- No valida existencia en `students` (UUID)

---

### CONTEXTOS (No Encontrados Específicos)

**No se encontraron contextos específicos para:**
- Alumnos (solo referencias genéricas)
- Apadrinados (solo referencias genéricas)

**Estado:** ❓ **PENDIENTE** — Contextos pueden estar en otra capa (Packages/Resolvers).

**Referencias encontradas:**
- `src/core/student/student-context-builder.js` — Constructor de contexto del estudiante
- `src/core/student-context.js` — Contexto del estudiante (legacy)
- Contextos pueden estar definidos en `pde_contexts` (tabla)

---

### AUTOMATIZACIONES (No Encontradas Específicas)

**No se encontraron automatizaciones específicas para:**
- Pausa de alumnos
- Baja de alumnos
- Cambio de estado operativo

**Estado:** ❓ **PENDIENTE** — Automatizaciones pueden estar en otra capa.

**Referencias encontradas:**
- `automation-engine-v2.js` — Motor de automatizaciones
- `automation-definitions-repo-pg.js` — Repositorio de definiciones
- Tabla `automation_definitions` — Definiciones de automatizaciones
- Las automatizaciones pueden estar definidas en la tabla pero no se encontraron específicas para alumnos

---

## ═══════════════════════════════════════════════════════════════
## FASE 8 — SEGURIDAD Y CONTEXTO
## ═══════════════════════════════════════════════════════════════

### VALIDACIÓN DE CONTEXTO

**APIs MASTER usan:** `requireAdminContext()`

**Problemas detectados:**
- ⚠️ `requireAdminContext()` puede devolver `Response` (redirect) o contexto
- ⚠️ APIs MASTER deben convertir redirect a JSON 401 (implementado en algunos handlers)
- ⚠️ No se encontró `requireMasterContext()` específico

**Endpoints que validan contexto:**
- ✅ `/master/api/students` — Usa `requireAdminContext()`
- ✅ `/master/api/sponsors` — Usa `requireAdminContext()`
- ✅ `/master/api/sponsors/care/*` — Usa `requireAdminContext()`

**Endpoints que NO validan contexto explícitamente:**
- ❓ No se encontraron endpoints sin validación (todos usan `requireAdminContext()`)

**Estado:** ⚠️ **HÍBRIDO** — Usa sistema de autenticación de Admin, no específico de Master.

---

### SUPOSICIONES PELIGROSAS

1. **`student_id INTEGER` vs `students.id UUID`**
   - Muchas tablas usan `student_id INTEGER` (FK a `alumnos`)
   - Tabla `students` usa `id UUID`
   - No hay migración completa de referencias

2. **Tabla `alumnos` como autoridad**
   - Muchos repos y servicios asumen que `alumnos` es la autoridad
   - Tabla `students` (UUID) es el SOT ontológico, pero no se usa consistentemente

3. **Sin validación de existencia en `students`**
   - UTE y otras tablas usan `student_id INTEGER` sin validar existencia en `students` (UUID)

---

## ═══════════════════════════════════════════════════════════════
## FASE 9 — CONCLUSIÓN DEL DIAGNÓSTICO
## ═══════════════════════════════════════════════════════════════

### 1) QUÉ EXISTE REALMENTE SOBRE ALUMNOS EN MASTER

**Tablas:**
- ✅ `students` (UUID) — SOT ontológico canónico (v5.43.0)
- ✅ `student_operational_state` — SOT operativo canónico (v5.43.0)
- ✅ `student_product_memberships` — Suscripciones (v5.42.0, híbrido)
- ✅ `student_domain_policies` — Políticas de gobierno (v5.42.0, híbrido)
- ✅ `student_item_state` — Estado por ítem (v5.42.0, híbrido)
- ✅ `student_item_state_audit` — Auditoría (v5.42.0)
- ✅ `pause_profiles` — Perfiles de pausa (v5.43.0)
- ⚠️ `alumnos` (INTEGER) — Legacy operativo, referenciada por múltiples tablas nuevas
- ⚠️ `ute_student_state` — Estado UTE (v5.53.0, híbrido)

**Repositorios:**
- ✅ `student-ontological-repo` — SOT ontológico (UUID)
- ✅ `student-operational-state-repo` — SOT operativo
- ⚠️ `student-repo` — Usa `alumnos` legacy
- ⚠️ `student-item-state-repo` — Usa `student_id INTEGER`
- ⚠️ `student-domain-policy-repo` — Usa `student_id INTEGER`
- ⚠️ `student-transmutation-state-repo` — Usa `student_id INTEGER`
- ⚠️ `student-place-state-repo` — Usa `student_id INTEGER`
- ⚠️ `student-project-state-repo` — Usa `student_id INTEGER`
- ⚠️ `student-activation-limit-repo` — Usa `student_id INTEGER`
- ✅ `student-audit-repo` — Auditoría canónica

**Servicios:**
- ✅ `student-operational-service` — Canónico para estado operativo (usa `students` UUID)
- ✅ `student-coherence-checker` — Canónico para verificación de coherencia
- ⚠️ `student-sot-service` — Híbrido (usa `alumnos` legacy)
- ⚠️ `student-domain-state-service` — Híbrido (usa `student_id INTEGER`)
- ⚠️ `student-mutation-service` — Híbrido (usa `alumnos` legacy, prepara señales pero no emite)
- ⚠️ `student-domain-integration-service` — Híbrido (emite algunas señales de dominio)
- ✅ `sponsor-service` — Canónico para apadrinados

**APIs:**
- ⚠️ `/master/api/students` — Solo diagnóstico (read-only)
- ❌ **NO EXISTE** API canónica para gestión de alumnos (create/update/delete)
- ✅ `/master/api/sponsors` — Canónica completa

**UIs:**
- ⚠️ `/master/alumnos*` — Solo diagnóstico (read-only)
- ❌ **NO EXISTE** UI canónica para gestión de alumnos

**Señales:**
- ⚠️ **REGISTRADAS pero NO todas se emiten** — Registry completo en `student-signal-registry.js`
- ✅ Señales de observabilidad (`student.coherence.*`, `student.sot.invariant_violation_detected`) — SÍ se emiten
- ⚠️ Señales de dominio (`student.domain.*`) — Algunas se emiten, otras no
- ❌ Señales de ciclo de vida (`student.created`, `student.operational.paused`) — Registradas pero NO se emiten
- ✅ Señales de sponsors (canónicas con TARGET_REF) — Todas se emiten

---

### 2) QUÉ PARTES SON CANÓNICAS, CUÁLES NO

**CANÓNICAS:**
- ✅ Tabla `students` (UUID) — SOT ontológico
- ✅ Tabla `student_operational_state` — SOT operativo
- ✅ Tabla `pause_profiles` — Perfiles configurables
- ✅ Tabla `sponsors_catalog` — SOT de apadrinados
- ✅ Tabla `sponsor_student_links` — Vínculos (estructura canónica, FK híbrida)
- ✅ Tabla `sponsor_special_care` — Cuidados especiales
- ✅ Repositorio `student-ontological-repo` — SOT ontológico
- ✅ Repositorio `student-operational-state-repo` — SOT operativo
- ✅ Servicio `sponsor-service` — Lógica de negocio canónica
- ✅ API `/master/api/sponsors` — API canónica completa
- ✅ UI `/master/templo-luz/apadrinados` — UI canónica

**HÍBRIDAS (Estructura canónica, FK legacy):**
- ⚠️ `student_product_memberships` — Usa `student_id INTEGER` (FK a `alumnos`)
- ⚠️ `student_domain_policies` — Usa `student_id INTEGER` (FK a `alumnos`)
- ⚠️ `student_item_state` — Usa `student_id INTEGER` (FK a `alumnos`)
- ⚠️ `sponsor_student_links` — Usa `student_id INTEGER` (FK a `alumnos`)
- ⚠️ `ute_student_state` — Usa `student_id INTEGER` (sin FK explícita)

**LEGACY OPERATIVO:**
- ❌ Tabla `alumnos` (INTEGER) — Legacy, referenciada por múltiples tablas nuevas
- ❌ Repositorio `student-repo` — Usa `alumnos` legacy
- ❌ Tablas `alumnos_lugares`, `alumnos_proyectos`, `alumnos_apadrinados` — Legacy

**DEUDA (No existe pero debería):**
- ❌ Servicio canónico MASTER para gestión de alumnos (existen servicios pero híbridos o no desde MASTER)
- ❌ API canónica MASTER para gestión de alumnos (create/update/delete)
- ❌ UI canónica MASTER para gestión de alumnos
- ❌ Emisión completa de señales registradas (muchas están registradas pero no se emiten)

---

### 3) QUÉ APIs SON ESTABLES Y CUÁLES SON DEUDA

**ESTABLES (Canónicas):**
- ✅ `/master/api/sponsors` — API completa, estable, con TARGET_REF
- ✅ `/master/api/sponsors/care/*` — API completa para cuidados especiales

**DEUDA (Solo diagnóstico):**
- ⚠️ `/master/api/students` — Solo read-only, no gestión
- ❌ **NO EXISTE** `/master/api/students` POST/PUT/DELETE
- ❌ **NO EXISTE** `/master/api/students/:id/operational-state`
- ❌ **NO EXISTE** `/master/api/students/:id/policies`
- ❌ **NO EXISTE** `/master/api/students/:id/sponsors`

**APIs ADMIN (No MASTER):**
- ⚠️ `/admin/api/students/search` — Búsqueda de alumnos (Admin, no MASTER)
- ⚠️ `/admin/api/students/:student_id/universe` — Universo del alumno (Admin, no MASTER)
- ⚠️ `/admin/api/students/:student_id/overrides` — Overrides del Master (Admin, no MASTER)
- ⚠️ `/admin/api/students/:student_id/domains/:domain_type/items/:item_id/activate` — Activar ítem (Admin, no MASTER)
- ⚠️ `/admin/api/students/:student_id/domains/:domain_type/items/:item_id/clean` — Limpiar ítem (Admin, no MASTER)

**Estado:** ⚠️ **HÍBRIDO** — Existen APIs en Admin pero NO en MASTER.

**INCONSISTENTES:**
- ⚠️ APIs que usan `student_id` pero no gestionan el alumno:
  - `/master/api/alquimia/alumno/:student_id`
  - `/master/api/places/student/:student_id`
  - `/master/api/projects/student/:student_id`

---

### 4) QUÉ UIs DEPENDEN DE UN ALUMNO MAL DEFINIDO

**UIs que asumen `alumnos` legacy:**
- ⚠️ `/master/alumnos` — Lee desde `alumnos`, no muestra estado operativo
- ⚠️ `/master/alumnos/postgresql` — Visualización de `alumnos`
- ⚠️ `/master/alumnos/alumnos` — Visualización de `alumnos`
- ⚠️ `/master/alumnos/info` — Información de `alumnos`

**UIs que usan `student_id` sin validar:**
- ⚠️ `/master/templo-luz/alquimia-alumno` — Usa `student_id` como parámetro
- ⚠️ `/master/templo-luz/lugares` — Puede usar `student_id`
- ⚠️ `/master/templo-luz/proyectos` — Puede usar `student_id`

**UIs que NO muestran estado completo:**
- ❌ Ninguna UI muestra estado operativo (`student_operational_state`)
- ❌ Ninguna UI muestra políticas de dominio (`student_domain_policies`)
- ❌ Ninguna UI muestra vínculos con sponsors desde la perspectiva del alumno

---

### 5) RIESGOS CLAROS SI SE DISEÑA SIN CERRAR STUDENT SOT

**RIESGOS CRÍTICOS:**

1. **Dualidad de identidad:**
   - Tabla `students` (UUID) es SOT ontológico, pero no se usa consistentemente
   - Tabla `alumnos` (INTEGER) es legacy pero referenciada por múltiples tablas nuevas
   - **Riesgo:** Inconsistencias entre identidad ontológica y operativa

2. **FK híbridas:**
   - Múltiples tablas usan `student_id INTEGER` (FK a `alumnos`)
   - Tabla `students` usa `id UUID`
   - **Riesgo:** Imposible migrar completamente sin romper referencias

3. **Sin servicio canónico:**
   - No existe servicio que gobierne creación/modificación de alumnos
   - **Riesgo:** Lógica de negocio dispersa en repos/endpoints

4. **Señales registradas pero no emitidas:**
   - Muchas señales están registradas pero NO se emiten desde servicios
   - `student-mutation-service.js` prepara señales pero NO las emite (solo placeholder)
   - `student-operational-service.js` tiene TODO para emitir pero está comentado
   - **Riesgo:** Imposible automatizar reacciones a cambios de alumnos aunque las señales estén definidas

5. **Sin API canónica:**
   - Solo existe API de diagnóstico (read-only)
   - **Riesgo:** Imposible gestionar alumnos desde MASTER de forma canónica

6. **Sin UI canónica:**
   - Solo existen UIs de diagnóstico
   - **Riesgo:** Imposible gestionar alumnos desde MASTER de forma canónica

7. **UTE usa `student_id INTEGER` sin validar:**
   - `ute_student_state` usa `student_id INTEGER` sin FK explícita
   - **Riesgo:** Estados UTE pueden referenciar alumnos inexistentes

---

### 6) LISTA DE PREGUNTAS ABIERTAS QUE SOLO DISEÑO PUEDE RESOLVER

**PREGUNTAS CRÍTICAS:**

1. **¿Cuál es la identidad canónica del alumno?**
   - ¿`students.id` (UUID) o `alumnos.id` (INTEGER)?
   - ¿Cómo se migran las referencias existentes?

2. **¿Cómo se gestiona el ciclo de vida del alumno?**
   - ¿Quién crea alumnos? ¿Desde dónde?
   - ¿Cómo se actualiza estado operativo?
   - ¿Cómo se gestionan pausas?

3. **¿Qué APIs necesita MASTER para gestionar alumnos?**
   - ¿POST `/master/api/students`?
   - ¿PUT `/master/api/students/:id`?
   - ¿POST `/master/api/students/:id/operational-state`?
   - ¿POST `/master/api/students/:id/policies`?

4. **¿Qué señales se deben emitir?**
   - ¿`student.created`? (registrada pero no se emite)
   - ¿`student.updated`? (no registrada)
   - ¿`student.operational.paused`? (registrada, servicio tiene TODO pero comentado)
   - ¿`student.operational.resumed`? (registrada pero no se emite)
   - ¿`student.unsubscribed`? (no registrada)
   - ¿Cómo activar emisión de señales ya registradas?

5. **¿Cómo se integra con sponsors?**
   - ¿Los sponsors deben usar `students.id` (UUID) o `alumnos.id` (INTEGER)?
   - ¿Cómo se migran vínculos existentes?

6. **¿Cómo se integra con UTE?**
   - ¿UTE debe usar `students.id` (UUID) o mantener `student_id INTEGER`?
   - ¿Cómo se migran estados UTE existentes?

7. **¿Qué UI necesita MASTER para gestionar alumnos?**
   - ¿Pantalla de lista de alumnos?
   - ¿Pantalla de detalle de alumno?
   - ¿Pantalla de gestión de estado operativo?
   - ¿Pantalla de gestión de políticas de dominio?

8. **¿Cómo se valida contexto en MASTER?**
   - ¿Se mantiene `requireAdminContext()` o se crea `requireMasterContext()`?
   - ¿Cómo se diferencia acceso Admin vs Master?

---

## ═══════════════════════════════════════════════════════════════
## RESUMEN EJECUTIVO
## ═══════════════════════════════════════════════════════════════

### ESTADO ACTUAL

**✅ CANÓNICO (Completo):**
- Sistema de Apadrinados (Sponsors) — SOT, repos, servicios, APIs, UIs, señales

**⚠️ HÍBRIDO (Estructura canónica, FK legacy):**
- Sistema de Alumnos — SOT ontológico existe (`students` UUID), pero múltiples tablas usan `alumnos` (INTEGER)

**❌ DEUDA (No existe):**
- Servicio canónico para gestión de alumnos
- API canónica para gestión de alumnos (create/update/delete)
- UI canónica para gestión de alumnos
- Señales para operaciones de alumnos

### RIESGO PRINCIPAL

**Dualidad de identidad:** `students` (UUID) es SOT ontológico, pero `alumnos` (INTEGER) es la autoridad operativa actual. Múltiples tablas nuevas referencian `alumnos`, creando deuda técnica que impide migración completa.

### ACCIÓN REQUERIDA

**Antes de diseñar APIs/UI de alumnos, se debe:**
1. Decidir identidad canónica (UUID vs INTEGER)
2. Definir estrategia de migración de referencias
3. Crear servicio canónico para gestión de alumnos
4. Definir señales para operaciones de alumnos
5. Diseñar APIs canónicas con TARGET_REF
6. Diseñar UIs canónicas con estado completo

---

---

## ═══════════════════════════════════════════════════════════════
## INVENTARIO COMPLETO ADICIONAL
## ═══════════════════════════════════════════════════════════════

### TABLAS ADICIONALES RELACIONADAS (No Documentadas en Fase 1)

**Tablas que referencian `alumno_id` o `student_id` pero no fueron detalladas:**

1. **`pausas`** (Legacy)
   - `alumno_id INTEGER` (FK a `alumnos`)
   - Estado: ❌ **LEGACY OPERATIVO**

2. **`practicas`** (Legacy)
   - `alumno_id INTEGER` (FK a `alumnos`)
   - Estado: ❌ **LEGACY OPERATIVO**

3. **`student_te_recurrent_state`** (v5.35.0)
   - `student_id INTEGER` (FK a `alumnos`)
   - Estado: ⚠️ **HÍBRIDO**

4. **`student_te_one_time_state`** (v5.35.0)
   - `student_id INTEGER` (FK a `alumnos`)
   - Estado: ⚠️ **HÍBRIDO**

5. **`student_place_state`** (v5.54.0)
   - `student_id INTEGER` (FK a `alumnos`)
   - Estado: ⚠️ **HÍBRIDO**

6. **`student_project_state`** (v5.55.0)
   - `student_id INTEGER` (FK a `alumnos`)
   - Estado: ⚠️ **HÍBRIDO**

7. **`student_activation_limits`** (v5.54.0)
   - `student_id INTEGER` (FK a `alumnos`)
   - Estado: ⚠️ **HÍBRIDO**

8. **`signal_aggregates`** (v4.11.3)
   - `alumno_id INTEGER` (FK a `alumnos`)
   - Estado: ❌ **LEGACY OPERATIVO**

9. **`student_patterns`** (v4.12.1)
   - `alumno_id INTEGER` (FK a `alumnos`)
   - Estado: ❌ **LEGACY OPERATIVO**

10. **`student_modes`** (v4.10.1)
    - `alumno_id INTEGER` (FK a `alumnos`)
    - Estado: ❌ **LEGACY OPERATIVO**

---

### MÓDULOS LEGACY (No Canónicos)

**Módulos que usan `alumnos` legacy:**

1. **`src/modules/student.js`**
   - Estado: ❌ **LEGACY DESHABILITADO** — Funciones lanzan error
   - Alternativa: `src/modules/student-v4.js`

2. **`src/modules/student-v4.js`**
   - Estado: ⚠️ **HÍBRIDO** — Usa `alumnos` legacy pero es la alternativa canónica actual
   - Métodos: `findStudentByEmail()`, `getOrCreateStudent()`

3. **`src/modules/student-v7.js`**
   - Estado: ❓ **PENDIENTE** — No se revisó en detalle

---

### HELPERS Y UTILIDADES

**Helpers relacionados con estudiantes:**

1. **`src/core/helpers/student-display-name-helper.js`**
   - Helper para mostrar nombre del estudiante
   - Estado: ⚠️ **HÍBRIDO** — Puede usar `alumnos` legacy

2. **`src/core/student/student-context-builder.js`**
   - Constructor de contexto del estudiante
   - Estado: ⚠️ **HÍBRIDO** — Puede usar `alumnos` legacy

3. **`src/core/student/capabilities/student-capability-resolver.js`**
   - Resuelve capabilities del estudiante
   - Estado: ⚠️ **HÍBRIDO** — Puede usar `alumnos` legacy

4. **`src/core/student/capabilities/student-capability-registry.js`**
   - Registry de capabilities
   - Estado: ✅ **CANÓNICO** — Registry puro

5. **`src/core/student/lifecycle/student-lifecycle.js`**
   - Gestión del ciclo de vida del estudiante
   - Estado: ⚠️ **HÍBRIDO** — Puede usar `alumnos` legacy

---

### SCRIPTS DE MIGRACIÓN Y VERIFICACIÓN

**Scripts relacionados con estudiantes/apadrinados:**

1. **`scripts/backfill-student-sot.js`**
   - Backfill de Student SOT
   - Estado: ⚠️ **MIGRACIÓN** — Script de migración

2. **`scripts/backfill-student-sot-v2.js`**
   - Backfill de Student SOT v2
   - Estado: ⚠️ **MIGRACIÓN** — Script de migración

3. **`scripts/backfill-student-domain-items-v1.js`**
   - Backfill de items de dominio
   - Estado: ⚠️ **MIGRACIÓN** — Script de migración

4. **`scripts/migrate-legacy-apadrinados-to-sponsors-v1.js`**
   - Migración de apadrinados legacy a sponsors
   - Estado: ⚠️ **MIGRACIÓN** — Script de migración

5. **`scripts/verify-sponsor-student-links.js`**
   - Verificación de vínculos sponsor-student
   - Estado: ✅ **VERIFICACIÓN** — Script de verificación

6. **`scripts/verify-sponsors-db.js`**
   - Verificación de sponsors en DB
   - Estado: ✅ **VERIFICACIÓN** — Script de verificación

7. **`scripts/verify-sponsors-migration.js`**
   - Verificación de migración de sponsors
   - Estado: ✅ **VERIFICACIÓN** — Script de verificación

8. **`scripts/apply-sponsors-migration.js`**
   - Aplicación de migración de sponsors
   - Estado: ⚠️ **MIGRACIÓN** — Script de migración

---

### RESOLVERS Y CATÁLOGOS

**Resolvers relacionados con sponsors:**

1. **`src/core/pde/catalogs/sponsors-resolver.js`**
   - Resolver de catálogo de sponsors
   - Estado: ✅ **CANÓNICO** — Resolver de catálogo

---

## ═══════════════════════════════════════════════════════════════
## ESTADÍSTICAS FINALES
## ═══════════════════════════════════════════════════════════════

### CONTEO DE COMPONENTES

**Tablas PostgreSQL:**
- ✅ Canónicas: 6 (`students`, `student_operational_state`, `pause_profiles`, `sponsors_catalog`, `sponsor_special_care`, `sponsor_special_care_lists`)
- ⚠️ Híbridas: 8 (`student_product_memberships`, `student_domain_policies`, `student_item_state`, `sponsor_student_links`, `ute_student_state`, `student_te_*`, `student_place_state`, `student_project_state`)
- ❌ Legacy: 10+ (`alumnos`, `pausas`, `practicas`, `alumnos_*`, `transmutaciones_apadrinados_*`, `signal_aggregates`, `student_patterns`, `student_modes`)

**Repositorios:**
- ✅ Canónicos: 6 (`student-ontological-repo`, `student-operational-state-repo`, `student-audit-repo`, `sponsor-catalog-repo`, `sponsor-links-repo`, `sponsor-special-care-repo`)
- ⚠️ Híbridos: 8 (`student-repo`, `student-item-state-repo`, `student-domain-policy-repo`, `student-transmutation-state-repo`, `student-place-state-repo`, `student-project-state-repo`, `student-activation-limit-repo`, `master-student-transmutation-read-repo`)

**Servicios:**
- ✅ Canónicos: 3 (`sponsor-service`, `student-operational-service`, `student-coherence-checker`)
- ⚠️ Híbridos: 4 (`student-sot-service`, `student-domain-state-service`, `student-mutation-service`, `student-domain-integration-service`)

**APIs MASTER:**
- ✅ Canónicas: 2 (`/master/api/sponsors`, `/master/api/sponsors/care/*`)
- ⚠️ Diagnóstico: 1 (`/master/api/students`)
- ⚠️ Que usan `student_id`: 4 (`/master/api/alquimia/alumno/:student_id`, `/master/api/places/student/:student_id`, `/master/api/projects/student/:student_id`, `/master/api/ute/:ute_id/states`)

**UIs MASTER:**
- ✅ Canónicas: 1 (`/master/templo-luz/apadrinados`)
- ⚠️ Diagnóstico: 4 (`/master/alumnos`, `/master/alumnos/postgresql`, `/master/alumnos/alumnos`, `/master/alumnos/info`)
- ⚠️ Que usan `student_id`: 3 (`/master/templo-luz/alquimia-alumno`, `/master/templo-luz/lugares`, `/master/templo-luz/proyectos`)

**Señales:**
- ✅ Registradas y emitidas: 8 (sponsors: 8 señales)
- ⚠️ Registradas pero NO emitidas: 15+ (students: muchas registradas pero no se emiten)
- ✅ Registradas y emitidas (observabilidad): 3 (`student.coherence.*`, `student.sot.invariant_violation_detected`)

---

**FIN DEL DIAGNÓSTICO**
