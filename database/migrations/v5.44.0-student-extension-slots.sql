-- ============================================================================
-- Migración v5.44.0: Student Extension Slots v1
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Añade slots extensibles (meta, feature_flags, experiments)
--              a la tabla students para permitir extensión sin refactor.
--
-- PRINCIPIOS:
-- 1. Extension slots NO contienen lógica core.
-- 2. Solo inputs para capabilities/automatizaciones.
-- 3. JSONB para flexibilidad.
-- ============================================================================

-- Asegurar que la extensión pgcrypto está disponible
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- AÑADIR COLUMNAS A students (si no existen)
-- ============================================================================

-- meta: Metadatos generales extensibles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'meta'
  ) THEN
    ALTER TABLE students ADD COLUMN meta JSONB DEFAULT '{}'::jsonb;
    COMMENT ON COLUMN students.meta IS 'Metadatos extensibles del alumno (no lógica core)';
  END IF;
END $$;

-- feature_flags: Flags de funcionalidad
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'feature_flags'
  ) THEN
    ALTER TABLE students ADD COLUMN feature_flags JSONB DEFAULT '{}'::jsonb;
    COMMENT ON COLUMN students.feature_flags IS 'Flags de funcionalidad para el alumno (no lógica core)';
  END IF;
END $$;

-- experiments: Experimentos A/B
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'experiments'
  ) THEN
    ALTER TABLE students ADD COLUMN experiments JSONB DEFAULT '{}'::jsonb;
    COMMENT ON COLUMN students.experiments IS 'Experimentos A/B asignados al alumno (no lógica core)';
  END IF;
END $$;

-- ============================================================================
-- ÍNDICES PARA BÚSQUEDAS EN JSONB
-- ============================================================================

-- Índice GIN para búsquedas en meta
CREATE INDEX IF NOT EXISTS idx_students_meta_gin ON students USING GIN (meta);

-- Índice GIN para búsquedas en feature_flags
CREATE INDEX IF NOT EXISTS idx_students_feature_flags_gin ON students USING GIN (feature_flags);

-- Índice GIN para búsquedas en experiments
CREATE INDEX IF NOT EXISTS idx_students_experiments_gin ON students USING GIN (experiments);

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'students' 
--   AND column_name IN ('meta', 'feature_flags', 'experiments');


