-- ============================================================================
-- v5.70.2-add-email-to-students.sql
-- ============================================================================
-- MASTER: Añadir email a tabla students
-- 
-- Descripción:
--   Añade columna email a tabla students para completar la migración UUID-only.
--   email es necesario para idempotencia en creación de alumnos.
--
-- Fecha: 2026-01-14
-- ============================================================================

BEGIN;

-- Añadir columna email a students
ALTER TABLE students 
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Backfill desde alumnos usando legacy_alumno_id (si todavía existe)
-- Si legacy_alumno_id ya fue eliminado, este UPDATE no hará nada
DO $$
BEGIN
  -- Intentar backfill solo si existe la columna legacy_alumno_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'students' 
      AND column_name = 'legacy_alumno_id'
  ) THEN
    UPDATE students s
    SET email = a.email
    FROM alumnos a
    WHERE s.legacy_alumno_id = a.id
      AND s.email IS NULL;
  END IF;
END $$;

-- Añadir constraint de unicidad (si no existe)
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_email_unique 
  ON students(email) 
  WHERE deleted_at IS NULL AND email IS NOT NULL;

-- Añadir índice para búsquedas por email
CREATE INDEX IF NOT EXISTS idx_students_email 
  ON students(email) 
  WHERE deleted_at IS NULL;

COMMIT;

-- ============================================================================
-- COMENTARIOS FINALES
-- ============================================================================

COMMENT ON COLUMN students.email IS 'Email del estudiante (único, usado para idempotencia en creación)';
