-- ============================================================================
-- Migración v5.39.0: Técnicas de Limpieza - Recuperación Controlada del Legacy
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Recupera TODAS las técnicas existentes antes del refactor,
--              normalizando campos y asegurando que ninguna técnica se pierde.
--
-- PRINCIPIOS:
-- 1. NO borrar datos
-- 2. NO descartar registros
-- 3. NO hacer DELETE físicos
-- 4. Normalización controlada: level nulo → 9, name vacío → placeholder
-- ============================================================================

-- ============================================================================
-- 1. NORMALIZACIÓN OBLIGATORIA: Campos críticos
-- ============================================================================

-- Normalizar level nulo o inválido → asignar 9
UPDATE tecnicas_limpieza
SET nivel = 9
WHERE nivel IS NULL OR nivel < 1;

-- Normalizar name vacío o nulo → crear placeholder claro
UPDATE tecnicas_limpieza
SET nombre = CONCAT('Técnica sin nombre (ID: ', id, ')')
WHERE nombre IS NULL OR TRIM(nombre) = '';

-- Normalizar description nula → cadena vacía
UPDATE tecnicas_limpieza
SET descripcion = ''
WHERE descripcion IS NULL;

-- Normalizar status indefinido → 'active'
UPDATE tecnicas_limpieza
SET status = 'active'
WHERE status IS NULL OR status NOT IN ('active', 'archived');

-- Asegurar created_at para registros sin fecha
UPDATE tecnicas_limpieza
SET created_at = COALESCE(created_at, now())
WHERE created_at IS NULL;

-- Asegurar updated_at para registros sin fecha
UPDATE tecnicas_limpieza
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

-- ============================================================================
-- 2. VERIFICACIÓN: Contar técnicas antes y después
-- ============================================================================

-- Log de verificación (se ejecutará en aplicación)
-- SELECT 
--   COUNT(*) as total_tecnicas,
--   COUNT(CASE WHEN status = 'active' THEN 1 END) as activas,
--   COUNT(CASE WHEN status = 'archived' THEN 1 END) as archivadas,
--   COUNT(CASE WHEN nivel IS NULL THEN 1 END) as sin_nivel,
--   COUNT(CASE WHEN nombre IS NULL OR TRIM(nombre) = '' THEN 1 END) as sin_nombre
-- FROM tecnicas_limpieza;

-- ============================================================================
-- 3. GARANTÍAS: Asegurar que ninguna técnica desaparece
-- ============================================================================

-- Asegurar que todos los registros tienen valores válidos para campos obligatorios
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  -- Verificar registros sin nivel válido
  SELECT COUNT(*) INTO invalid_count
  FROM tecnicas_limpieza
  WHERE nivel IS NULL OR nivel < 1;
  
  IF invalid_count > 0 THEN
    RAISE NOTICE 'Advertencia: % registros aún tienen nivel inválido después de normalización', invalid_count;
  END IF;
  
  -- Verificar registros sin nombre válido
  SELECT COUNT(*) INTO invalid_count
  FROM tecnicas_limpieza
  WHERE nombre IS NULL OR TRIM(nombre) = '';
  
  IF invalid_count > 0 THEN
    RAISE NOTICE 'Advertencia: % registros aún tienen nombre inválido después de normalización', invalid_count;
  END IF;
END $$;

-- ============================================================================
-- NOTAS IMPORTANTES:
-- ============================================================================
-- 1. Esta migración NO borra datos. Solo normaliza y asegura valores válidos.
-- 2. Si existe una técnica sin nombre, se crea un placeholder claro con el ID.
-- 3. Todas las técnicas existentes deben reaparecer después de esta migración.
-- 4. El número de técnicas visibles debe ser ≥ número histórico.
-- 5. Ninguna técnica desaparece silenciosamente.
-- ============================================================================



