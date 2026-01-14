-- ============================================================================
-- v5.71.0-student-overrides-v1.sql
-- ============================================================================
-- MASTER: Sistema Canónico de Overrides v1 (Alumnos + Cleaning)
-- 
-- Descripción:
--   Crea sistema canónico de overrides que permite sobrescribir valores base
--   del sistema a nivel de alumno individual, sin romper Source of Truth,
--   Proyecciones, UUID-only, LPM/CPM ni Auditoría.
--
--   ALCANCE V1:
--   - Student Overrides: nivel, fecha_creacion, apodo
--   - Item Overrides: required_count (una_vez), threshold_days (recurrente)
--
-- PRINCIPIOS CONSTITUCIONALES:
--   - Backend es la única autoridad
--   - UUID-only (student_uuid)
--   - Override ≠ Mutación (nunca modifica valor base)
--   - Auditable y reversible
--
-- Fecha: 2026-01-XX
-- ============================================================================

BEGIN;

-- Asegurar extensión pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLA 1: student_overrides (Overrides de Campos de Alumno)
-- ============================================================================
-- Permite sobrescribir campos base del alumno (nivel, fecha_creacion, apodo)
-- sin modificar el valor base en students.

CREATE TABLE IF NOT EXISTS student_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_uuid UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  override_value JSONB NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT,
  
  UNIQUE (student_uuid, field_key)
);

COMMENT ON TABLE student_overrides IS 'Overrides de campos de alumno. Permite sobrescribir valores base sin modificar students.';
COMMENT ON COLUMN student_overrides.student_uuid IS 'UUID canónico del estudiante (FK a students)';
COMMENT ON COLUMN student_overrides.field_key IS 'Clave del campo a sobrescribir (ej: nivel, fecha_creacion, apodo)';
COMMENT ON COLUMN student_overrides.override_value IS 'Valor de override en JSONB (puede ser string, number, date, etc.)';
COMMENT ON COLUMN student_overrides.reason IS 'Razón del override (opcional, para auditoría)';
COMMENT ON COLUMN student_overrides.created_by IS 'Quién creó el override (opcional, para auditoría)';

CREATE INDEX IF NOT EXISTS idx_student_overrides_student_uuid 
  ON student_overrides(student_uuid);
CREATE INDEX IF NOT EXISTS idx_student_overrides_field_key 
  ON student_overrides(field_key);

-- ============================================================================
-- TABLA 2: student_item_overrides (Overrides de Configuración de Items)
-- ============================================================================
-- Permite sobrescribir configuración de items por alumno
-- (required_count para una_vez, threshold_days para recurrente)

CREATE TABLE IF NOT EXISTS student_item_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_uuid UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  item_ref TEXT NOT NULL,
  override_key TEXT NOT NULL,
  override_value JSONB NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT,
  
  UNIQUE (student_uuid, item_ref, override_key)
);

COMMENT ON TABLE student_item_overrides IS 'Overrides de configuración de items por alumno. Permite sobrescribir required_count o threshold_days.';
COMMENT ON COLUMN student_item_overrides.student_uuid IS 'UUID canónico del estudiante (FK a students)';
COMMENT ON COLUMN student_item_overrides.item_ref IS 'Referencia del item (ej: transmutacion_item.ref)';
COMMENT ON COLUMN student_item_overrides.override_key IS 'Clave del override (ej: required_count, threshold_days)';
COMMENT ON COLUMN student_item_overrides.override_value IS 'Valor de override en JSONB (number para required_count/threshold_days)';
COMMENT ON COLUMN student_item_overrides.reason IS 'Razón del override (opcional, para auditoría)';
COMMENT ON COLUMN student_item_overrides.created_by IS 'Quién creó el override (opcional, para auditoría)';

CREATE INDEX IF NOT EXISTS idx_student_item_overrides_student_uuid 
  ON student_item_overrides(student_uuid);
CREATE INDEX IF NOT EXISTS idx_student_item_overrides_item_ref 
  ON student_item_overrides(item_ref);
CREATE INDEX IF NOT EXISTS idx_student_item_overrides_override_key 
  ON student_item_overrides(override_key);

-- ============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================================
-- Verificar que las tablas existen y tienen constraints activos

DO $$
DECLARE
  student_overrides_exists BOOLEAN;
  student_item_overrides_exists BOOLEAN;
  unique_constraint_exists BOOLEAN;
BEGIN
  -- Verificar student_overrides
  SELECT EXISTS(
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name = 'student_overrides'
  ) INTO student_overrides_exists;
  
  IF NOT student_overrides_exists THEN
    RAISE EXCEPTION 'MIGRATION FAILED: Tabla student_overrides no existe';
  END IF;
  
  -- Verificar student_item_overrides
  SELECT EXISTS(
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name = 'student_item_overrides'
  ) INTO student_item_overrides_exists;
  
  IF NOT student_item_overrides_exists THEN
    RAISE EXCEPTION 'MIGRATION FAILED: Tabla student_item_overrides no existe';
  END IF;
  
  -- Verificar constraint UNIQUE en student_overrides
  SELECT EXISTS(
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'student_overrides_student_uuid_field_key_key'
  ) INTO unique_constraint_exists;
  
  IF NOT unique_constraint_exists THEN
    RAISE EXCEPTION 'MIGRATION FAILED: Constraint UNIQUE en student_overrides no existe';
  END IF;
  
  -- Verificar constraint UNIQUE en student_item_overrides
  SELECT EXISTS(
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'student_item_overrides_student_uuid_item_ref_override_key_key'
  ) INTO unique_constraint_exists;
  
  IF NOT unique_constraint_exists THEN
    RAISE EXCEPTION 'MIGRATION FAILED: Constraint UNIQUE en student_item_overrides no existe';
  END IF;
  
  RAISE NOTICE 'MIGRATION SUCCESS: Tablas student_overrides y student_item_overrides creadas correctamente';
END $$;

COMMIT;

-- ============================================================================
-- COMENTARIOS FINALES
-- ============================================================================

COMMENT ON TABLE student_overrides IS 'Sistema Canónico de Overrides v1 - Overrides de campos de alumno (nivel, fecha_creacion, apodo)';
COMMENT ON TABLE student_item_overrides IS 'Sistema Canónico de Overrides v1 - Overrides de configuración de items (required_count, threshold_days)';
