-- Migration v5.66.0: Añadir email y apodo a students (mundo nuevo UUID-only)
-- FASE 5: Identidad canónica UUID-only para el mundo nuevo
--
-- OBJETIVO:
-- Añadir columnas email y apodo a la tabla students para el mundo nuevo UUID-only.
-- Crear constraint de unicidad por email (case-insensitive).
--
-- REGLAS:
-- - Email es único (case-insensitive)
-- - Apodo es opcional (nullable)
-- - Solo para el mundo nuevo (sin migrar legacy)
--
-- NOTA: Esta migración NO migra datos legacy, solo prepara el schema para el mundo nuevo.

-- Añadir columna email si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'students' 
    AND column_name = 'email'
  ) THEN
    ALTER TABLE students ADD COLUMN email TEXT;
    RAISE NOTICE 'Columna email añadida a students';
  ELSE
    RAISE NOTICE 'Columna email ya existe en students';
  END IF;
END $$;

-- Añadir columna apodo si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'students' 
    AND column_name = 'apodo'
  ) THEN
    ALTER TABLE students ADD COLUMN apodo TEXT;
    RAISE NOTICE 'Columna apodo añadida a students';
  ELSE
    RAISE NOTICE 'Columna apodo ya existe en students';
  END IF;
END $$;

-- Crear índice único case-insensitive para email si no existe
-- Usar expresión lower(email) para case-insensitive uniqueness
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'students' 
    AND indexname = 'idx_students_email_ci_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_students_email_ci_unique ON students (lower(email)) WHERE email IS NOT NULL;
    RAISE NOTICE 'Índice único case-insensitive para email creado';
  ELSE
    RAISE NOTICE 'Índice único case-insensitive para email ya existe';
  END IF;
END $$;

-- Añadir comentarios
COMMENT ON COLUMN students.email IS 'Email del estudiante (mundo nuevo UUID-only, único case-insensitive)';
COMMENT ON COLUMN students.apodo IS 'Apodo del estudiante (mundo nuevo UUID-only, opcional)';
