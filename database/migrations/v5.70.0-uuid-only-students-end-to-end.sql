-- ============================================================================
-- v5.70.0-uuid-only-students-end-to-end.sql
-- ============================================================================
-- MASTER: UUID-Only Students End-to-End Migration
-- 
-- Descripción:
--   Migración constitucional que elimina COMPLETAMENTE dependencias de legacy alumnos.
--   Convierte TODAS las tablas de student_id INTEGER (FK a alumnos.id) a student_uuid UUID (FK a students.id).
--   
--   Tablas migradas:
--   - cleaning_events
--   - cleaning_item_state
--   - student_item_state
--   - student_item_state_audit
--   - student_place_state
--   - student_project_state
--   - student_activation_limits
--   - nivel_overrides
--   - sponsor_student_links
--   - pde_daily_item_clean_log
--   - ute_executions
--   - ute_student_state
--   - student_product_memberships
--   - student_domain_policies
--   - pausas
--
--   También migra display_name (apodo, nombre_completo) a tabla students.
--
-- Fecha: 2026-01-14
-- ============================================================================

BEGIN;

-- ============================================================================
-- FASE 1: MIGRACIÓN DE ESQUEMA (student_id INTEGER → student_uuid UUID)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. cleaning_events
-- ----------------------------------------------------------------------------

-- Añadir columna student_uuid
ALTER TABLE cleaning_events 
  ADD COLUMN IF NOT EXISTS student_uuid UUID;

-- Backfill desde students usando legacy_alumno_id
UPDATE cleaning_events ce
SET student_uuid = s.id
FROM students s
WHERE ce.student_id = s.legacy_alumno_id
  AND ce.student_uuid IS NULL;

-- Verificar que no quedan NULLs (debe fallar si hay huérfanos)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cleaning_events WHERE student_uuid IS NULL) THEN
    RAISE EXCEPTION 'cleaning_events tiene registros sin student_uuid (huérfanos)';
  END IF;
END $$;

-- Añadir FK a students.id
ALTER TABLE cleaning_events
  ADD CONSTRAINT fk_cleaning_events_student_uuid 
  FOREIGN KEY (student_uuid) REFERENCES students(id) ON DELETE CASCADE;

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_cleaning_events_student_uuid_item 
  ON cleaning_events(student_uuid, product_key, domain_type, item_ref);

-- Eliminar FK antigua y columna legacy
ALTER TABLE cleaning_events DROP CONSTRAINT IF EXISTS cleaning_events_student_id_fkey;
ALTER TABLE cleaning_events DROP COLUMN IF EXISTS student_id;

-- Renombrar student_uuid → student_id (mantener nombre canónico)
ALTER TABLE cleaning_events RENAME COLUMN student_uuid TO student_id;

-- Actualizar índices que referencian student_id
DROP INDEX IF EXISTS idx_cleaning_events_student_item;
CREATE INDEX IF NOT EXISTS idx_cleaning_events_student_item 
  ON cleaning_events(student_id, product_key, domain_type, item_ref);

-- ----------------------------------------------------------------------------
-- 2. cleaning_item_state
-- ----------------------------------------------------------------------------

ALTER TABLE cleaning_item_state 
  ADD COLUMN IF NOT EXISTS student_uuid UUID;

UPDATE cleaning_item_state cis
SET student_uuid = s.id
FROM students s
WHERE cis.student_id = s.legacy_alumno_id
  AND cis.student_uuid IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cleaning_item_state WHERE student_uuid IS NULL) THEN
    RAISE EXCEPTION 'cleaning_item_state tiene registros sin student_uuid (huérfanos)';
  END IF;
END $$;

ALTER TABLE cleaning_item_state
  ADD CONSTRAINT fk_cleaning_item_state_student_uuid 
  FOREIGN KEY (student_uuid) REFERENCES students(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_cleaning_item_state_student_uuid_item 
  ON cleaning_item_state(student_uuid, product_key, domain_type, item_ref);

ALTER TABLE cleaning_item_state DROP CONSTRAINT IF EXISTS cleaning_item_state_student_id_fkey;
ALTER TABLE cleaning_item_state DROP COLUMN IF EXISTS student_id;

ALTER TABLE cleaning_item_state RENAME COLUMN student_uuid TO student_id;

-- Actualizar PK (student_id ahora es UUID)
ALTER TABLE cleaning_item_state DROP CONSTRAINT IF EXISTS cleaning_item_state_pkey;
ALTER TABLE cleaning_item_state 
  ADD PRIMARY KEY (student_id, product_key, domain_type, item_ref);

-- ----------------------------------------------------------------------------
-- 3. student_item_state
-- ----------------------------------------------------------------------------

ALTER TABLE student_item_state 
  ADD COLUMN IF NOT EXISTS student_uuid UUID;

UPDATE student_item_state sis
SET student_uuid = s.id
FROM students s
WHERE sis.student_id = s.legacy_alumno_id
  AND sis.student_uuid IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM student_item_state WHERE student_uuid IS NULL) THEN
    RAISE EXCEPTION 'student_item_state tiene registros sin student_uuid (huérfanos)';
  END IF;
END $$;

ALTER TABLE student_item_state
  ADD CONSTRAINT fk_student_item_state_student_uuid 
  FOREIGN KEY (student_uuid) REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE student_item_state DROP CONSTRAINT IF EXISTS student_item_state_student_id_fkey;
ALTER TABLE student_item_state DROP COLUMN IF EXISTS student_id;

ALTER TABLE student_item_state RENAME COLUMN student_uuid TO student_id;

-- Actualizar PK si existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'student_item_state_pkey'
  ) THEN
    ALTER TABLE student_item_state DROP CONSTRAINT student_item_state_pkey;
    ALTER TABLE student_item_state 
      ADD PRIMARY KEY (student_id, product_key, domain_type, item_ref);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. student_item_state_audit
-- ----------------------------------------------------------------------------

ALTER TABLE student_item_state_audit 
  ADD COLUMN IF NOT EXISTS student_uuid UUID;

UPDATE student_item_state_audit sisa
SET student_uuid = s.id
FROM students s
WHERE sisa.student_id = s.legacy_alumno_id
  AND sisa.student_uuid IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM student_item_state_audit WHERE student_uuid IS NULL) THEN
    RAISE EXCEPTION 'student_item_state_audit tiene registros sin student_uuid (huérfanos)';
  END IF;
END $$;

ALTER TABLE student_item_state_audit
  ADD CONSTRAINT fk_student_item_state_audit_student_uuid 
  FOREIGN KEY (student_uuid) REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE student_item_state_audit DROP CONSTRAINT IF EXISTS student_item_state_audit_student_id_fkey;
ALTER TABLE student_item_state_audit DROP COLUMN IF EXISTS student_id;

ALTER TABLE student_item_state_audit RENAME COLUMN student_uuid TO student_id;

-- ----------------------------------------------------------------------------
-- 5. student_place_state
-- ----------------------------------------------------------------------------

ALTER TABLE student_place_state 
  ADD COLUMN IF NOT EXISTS student_uuid UUID;

UPDATE student_place_state sps
SET student_uuid = s.id
FROM students s
WHERE sps.student_id = s.legacy_alumno_id
  AND sps.student_uuid IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM student_place_state WHERE student_uuid IS NULL) THEN
    RAISE EXCEPTION 'student_place_state tiene registros sin student_uuid (huérfanos)';
  END IF;
END $$;

ALTER TABLE student_place_state
  ADD CONSTRAINT fk_student_place_state_student_uuid 
  FOREIGN KEY (student_uuid) REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE student_place_state DROP CONSTRAINT IF EXISTS student_place_state_student_id_fkey;
ALTER TABLE student_place_state DROP COLUMN IF EXISTS student_id;

ALTER TABLE student_place_state RENAME COLUMN student_uuid TO student_id;

-- ----------------------------------------------------------------------------
-- 6. student_project_state
-- ----------------------------------------------------------------------------

ALTER TABLE student_project_state 
  ADD COLUMN IF NOT EXISTS student_uuid UUID;

UPDATE student_project_state sps
SET student_uuid = s.id
FROM students s
WHERE sps.student_id = s.legacy_alumno_id
  AND sps.student_uuid IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM student_project_state WHERE student_uuid IS NULL) THEN
    RAISE EXCEPTION 'student_project_state tiene registros sin student_uuid (huérfanos)';
  END IF;
END $$;

ALTER TABLE student_project_state
  ADD CONSTRAINT fk_student_project_state_student_uuid 
  FOREIGN KEY (student_uuid) REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE student_project_state DROP CONSTRAINT IF EXISTS student_project_state_student_id_fkey;
ALTER TABLE student_project_state DROP COLUMN IF EXISTS student_id;

ALTER TABLE student_project_state RENAME COLUMN student_uuid TO student_id;

-- ----------------------------------------------------------------------------
-- 7. student_activation_limits
-- ----------------------------------------------------------------------------

ALTER TABLE student_activation_limits 
  ADD COLUMN IF NOT EXISTS student_uuid UUID;

UPDATE student_activation_limits sal
SET student_uuid = s.id
FROM students s
WHERE sal.student_id = s.legacy_alumno_id
  AND sal.student_uuid IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM student_activation_limits WHERE student_uuid IS NULL) THEN
    RAISE EXCEPTION 'student_activation_limits tiene registros sin student_uuid (huérfanos)';
  END IF;
END $$;

ALTER TABLE student_activation_limits
  ADD CONSTRAINT fk_student_activation_limits_student_uuid 
  FOREIGN KEY (student_uuid) REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE student_activation_limits DROP CONSTRAINT IF EXISTS student_activation_limits_student_id_fkey;
ALTER TABLE student_activation_limits DROP COLUMN IF EXISTS student_id;

ALTER TABLE student_activation_limits RENAME COLUMN student_uuid TO student_id;

-- ----------------------------------------------------------------------------
-- 8. nivel_overrides
-- ----------------------------------------------------------------------------

ALTER TABLE nivel_overrides 
  ADD COLUMN IF NOT EXISTS student_uuid UUID;

UPDATE nivel_overrides no
SET student_uuid = s.id
FROM students s
WHERE no.student_id = s.legacy_alumno_id
  AND no.student_uuid IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM nivel_overrides WHERE student_uuid IS NULL) THEN
    RAISE EXCEPTION 'nivel_overrides tiene registros sin student_uuid (huérfanos)';
  END IF;
END $$;

ALTER TABLE nivel_overrides
  ADD CONSTRAINT fk_nivel_overrides_student_uuid 
  FOREIGN KEY (student_uuid) REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE nivel_overrides DROP CONSTRAINT IF EXISTS nivel_overrides_student_id_fkey;
ALTER TABLE nivel_overrides DROP COLUMN IF EXISTS student_id;

ALTER TABLE nivel_overrides RENAME COLUMN student_uuid TO student_id;

-- ----------------------------------------------------------------------------
-- 9. sponsor_student_links
-- ----------------------------------------------------------------------------

ALTER TABLE sponsor_student_links 
  ADD COLUMN IF NOT EXISTS student_uuid UUID;

UPDATE sponsor_student_links ssl
SET student_uuid = s.id
FROM students s
WHERE ssl.student_id = s.legacy_alumno_id
  AND ssl.student_uuid IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM sponsor_student_links WHERE student_uuid IS NULL) THEN
    RAISE EXCEPTION 'sponsor_student_links tiene registros sin student_uuid (huérfanos)';
  END IF;
END $$;

ALTER TABLE sponsor_student_links
  ADD CONSTRAINT fk_sponsor_student_links_student_uuid 
  FOREIGN KEY (student_uuid) REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE sponsor_student_links DROP CONSTRAINT IF EXISTS sponsor_student_links_student_id_fkey;
ALTER TABLE sponsor_student_links DROP COLUMN IF EXISTS student_id;

ALTER TABLE sponsor_student_links RENAME COLUMN student_uuid TO student_id;

-- ----------------------------------------------------------------------------
-- 10. pde_daily_item_clean_log
-- ----------------------------------------------------------------------------

ALTER TABLE pde_daily_item_clean_log 
  ADD COLUMN IF NOT EXISTS student_uuid UUID;

UPDATE pde_daily_item_clean_log pdicl
SET student_uuid = s.id
FROM students s
WHERE pdicl.student_id = s.legacy_alumno_id
  AND pdicl.student_uuid IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pde_daily_item_clean_log WHERE student_uuid IS NULL) THEN
    RAISE EXCEPTION 'pde_daily_item_clean_log tiene registros sin student_uuid (huérfanos)';
  END IF;
END $$;

ALTER TABLE pde_daily_item_clean_log
  ADD CONSTRAINT fk_pde_daily_item_clean_log_student_uuid 
  FOREIGN KEY (student_uuid) REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE pde_daily_item_clean_log DROP CONSTRAINT IF EXISTS pde_daily_item_clean_log_student_id_fkey;
ALTER TABLE pde_daily_item_clean_log DROP COLUMN IF EXISTS student_id;

ALTER TABLE pde_daily_item_clean_log RENAME COLUMN student_uuid TO student_id;

-- ----------------------------------------------------------------------------
-- 11. ute_executions
-- ----------------------------------------------------------------------------

ALTER TABLE ute_executions 
  ADD COLUMN IF NOT EXISTS student_uuid UUID;

UPDATE ute_executions ue
SET student_uuid = s.id
FROM students s
WHERE ue.student_id = s.legacy_alumno_id
  AND ue.student_uuid IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM ute_executions WHERE student_uuid IS NULL) THEN
    RAISE EXCEPTION 'ute_executions tiene registros sin student_uuid (huérfanos)';
  END IF;
END $$;

ALTER TABLE ute_executions
  ADD CONSTRAINT fk_ute_executions_student_uuid 
  FOREIGN KEY (student_uuid) REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE ute_executions DROP CONSTRAINT IF EXISTS ute_executions_student_id_fkey;
ALTER TABLE ute_executions DROP COLUMN IF EXISTS student_id;

ALTER TABLE ute_executions RENAME COLUMN student_uuid TO student_id;

-- ----------------------------------------------------------------------------
-- 12. ute_student_state
-- ----------------------------------------------------------------------------

ALTER TABLE ute_student_state 
  ADD COLUMN IF NOT EXISTS student_uuid UUID;

UPDATE ute_student_state uss
SET student_uuid = s.id
FROM students s
WHERE uss.student_id = s.legacy_alumno_id
  AND uss.student_uuid IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM ute_student_state WHERE student_uuid IS NULL) THEN
    RAISE EXCEPTION 'ute_student_state tiene registros sin student_uuid (huérfanos)';
  END IF;
END $$;

ALTER TABLE ute_student_state
  ADD CONSTRAINT fk_ute_student_state_student_uuid 
  FOREIGN KEY (student_uuid) REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE ute_student_state DROP CONSTRAINT IF EXISTS ute_student_state_student_id_fkey;
ALTER TABLE ute_student_state DROP COLUMN IF EXISTS student_id;

ALTER TABLE ute_student_state RENAME COLUMN student_uuid TO student_id;

-- ----------------------------------------------------------------------------
-- 13. student_product_memberships
-- ----------------------------------------------------------------------------

ALTER TABLE student_product_memberships 
  ADD COLUMN IF NOT EXISTS student_uuid UUID;

UPDATE student_product_memberships spm
SET student_uuid = s.id
FROM students s
WHERE spm.student_id = s.legacy_alumno_id
  AND spm.student_uuid IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM student_product_memberships WHERE student_uuid IS NULL) THEN
    RAISE EXCEPTION 'student_product_memberships tiene registros sin student_uuid (huérfanos)';
  END IF;
END $$;

ALTER TABLE student_product_memberships
  ADD CONSTRAINT fk_student_product_memberships_student_uuid 
  FOREIGN KEY (student_uuid) REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE student_product_memberships DROP CONSTRAINT IF EXISTS student_product_memberships_student_id_fkey;
ALTER TABLE student_product_memberships DROP COLUMN IF EXISTS student_id;

ALTER TABLE student_product_memberships RENAME COLUMN student_uuid TO student_id;

-- ----------------------------------------------------------------------------
-- 14. student_domain_policies
-- ----------------------------------------------------------------------------

ALTER TABLE student_domain_policies 
  ADD COLUMN IF NOT EXISTS student_uuid UUID;

UPDATE student_domain_policies sdp
SET student_uuid = s.id
FROM students s
WHERE sdp.student_id = s.legacy_alumno_id
  AND sdp.student_uuid IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM student_domain_policies WHERE student_uuid IS NULL) THEN
    RAISE EXCEPTION 'student_domain_policies tiene registros sin student_uuid (huérfanos)';
  END IF;
END $$;

ALTER TABLE student_domain_policies
  ADD CONSTRAINT fk_student_domain_policies_student_uuid 
  FOREIGN KEY (student_uuid) REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE student_domain_policies DROP CONSTRAINT IF EXISTS student_domain_policies_student_id_fkey;
ALTER TABLE student_domain_policies DROP COLUMN IF EXISTS student_id;

ALTER TABLE student_domain_policies RENAME COLUMN student_uuid TO student_id;

-- ----------------------------------------------------------------------------
-- 15. pausas (caso especial: usa alumno_id, no student_id)
-- ----------------------------------------------------------------------------

ALTER TABLE pausas 
  ADD COLUMN IF NOT EXISTS student_uuid UUID;

UPDATE pausas p
SET student_uuid = s.id
FROM students s
WHERE p.alumno_id = s.legacy_alumno_id
  AND p.student_uuid IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pausas WHERE student_uuid IS NULL) THEN
    RAISE EXCEPTION 'pausas tiene registros sin student_uuid (huérfanos)';
  END IF;
END $$;

ALTER TABLE pausas
  ADD CONSTRAINT fk_pausas_student_uuid 
  FOREIGN KEY (student_uuid) REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE pausas DROP CONSTRAINT IF EXISTS pausas_alumno_id_fkey;
ALTER TABLE pausas DROP COLUMN IF EXISTS alumno_id;

ALTER TABLE pausas RENAME COLUMN student_uuid TO student_id;

-- ============================================================================
-- FASE 2: MIGRACIÓN DE DISPLAY NAME (apodo, nombre_completo)
-- ============================================================================

-- Añadir columnas a students
ALTER TABLE students 
  ADD COLUMN IF NOT EXISTS apodo TEXT,
  ADD COLUMN IF NOT EXISTS nombre_completo TEXT;

-- Backfill desde alumnos usando legacy_alumno_id (ÚLTIMA VEZ)
UPDATE students s
SET apodo = a.apodo,
    nombre_completo = a.nombre_completo
FROM alumnos a
WHERE s.legacy_alumno_id = a.id
  AND (s.apodo IS NULL OR s.nombre_completo IS NULL);

-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================

-- Verificar que todas las tablas tienen student_id como UUID
DO $$
DECLARE
  tbl_name TEXT;
  column_type TEXT;
BEGIN
  FOR tbl_name IN 
    SELECT unnest(ARRAY[
      'cleaning_events', 'cleaning_item_state', 'student_item_state',
      'student_item_state_audit', 'student_place_state', 'student_project_state',
      'student_activation_limits', 'nivel_overrides', 'sponsor_student_links',
      'pde_daily_item_clean_log', 'ute_executions', 'ute_student_state',
      'student_product_memberships', 'student_domain_policies', 'pausas'
    ])
  LOOP
    SELECT data_type INTO column_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND information_schema.columns.table_name = tbl_name
      AND column_name = 'student_id';
    
    IF column_type != 'uuid' THEN
      RAISE EXCEPTION 'Tabla % tiene student_id de tipo % (debe ser uuid)', tbl_name, column_type;
    END IF;
  END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- COMENTARIOS FINALES
-- ============================================================================

COMMENT ON COLUMN students.apodo IS 'Apodo del estudiante (migrado desde alumnos.apodo)';
COMMENT ON COLUMN students.nombre_completo IS 'Nombre completo del estudiante (migrado desde alumnos.nombre_completo)';
