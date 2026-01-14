-- ============================================================================
-- v5.70.1-drop-legacy-alumno-id.sql
-- ============================================================================
-- MASTER: Eliminación final de legacy_alumno_id
-- 
-- Descripción:
--   Elimina la columna legacy_alumno_id de la tabla students.
--   Esta migración SOLO debe ejecutarse después de que TODAS las tablas
--   hayan sido migradas a UUID y TODO el código runtime haya sido refactorizado.
--
-- Fecha: 2026-01-14
-- ============================================================================

BEGIN;

-- Verificar que no hay tablas que dependan de legacy_alumno_id
-- (esto debería ser 0 si la migración v5.70.0 se aplicó correctamente)
DO $$
DECLARE
  dependent_tables INTEGER;
BEGIN
  SELECT COUNT(*) INTO dependent_tables
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND column_name = 'legacy_alumno_id';
  
  IF dependent_tables > 1 THEN
    RAISE EXCEPTION 'Todavía existen % tablas con legacy_alumno_id. Debe ser 0 (solo students)', dependent_tables;
  END IF;
END $$;

-- Eliminar columna legacy_alumno_id de students
ALTER TABLE students DROP COLUMN IF EXISTS legacy_alumno_id;

-- Verificar que se eliminó correctamente
DO $$
DECLARE
  column_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'students'
      AND column_name = 'legacy_alumno_id'
  ) INTO column_exists;
  
  IF column_exists THEN
    RAISE EXCEPTION 'legacy_alumno_id todavía existe en students';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- COMENTARIOS FINALES
-- ============================================================================

COMMENT ON TABLE students IS 'Tabla canónica de estudiantes (UUID-only). students.id es la ÚNICA identidad válida.';
