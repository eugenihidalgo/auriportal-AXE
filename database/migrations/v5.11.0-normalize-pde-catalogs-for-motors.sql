-- ============================================================================
-- Migración v5.11.0: Normalización de Catálogos PDE para Motores
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Añade campos necesarios para que los catálogos PDE puedan
--              ser consumidos correctamente por los Motores PDE.
--
-- PRINCIPIOS:
-- 1. Fail-open: Defaults seguros (prioridad='media', is_obligatoria=false)
-- 2. Compatibilidad: No elimina ni renombra columnas existentes
-- 3. Consistencia: Mismo formato de campos en todas las tablas
-- 4. Reversibilidad: Campos pueden ser eliminados si es necesario
-- ============================================================================

-- ============================================================================
-- 1. TÉCNICAS DE LIMPIEZA (tecnicas_limpieza)
-- ============================================================================

-- Añadir campo prioridad
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tecnicas_limpieza' AND column_name = 'prioridad'
  ) THEN
    ALTER TABLE tecnicas_limpieza 
    ADD COLUMN prioridad VARCHAR(10) DEFAULT 'media' 
    CHECK (prioridad IN ('alta', 'media', 'bajo'));
    
    -- Actualizar registros existentes
    UPDATE tecnicas_limpieza SET prioridad = 'media' WHERE prioridad IS NULL;
    
    -- Crear índice
    CREATE INDEX IF NOT EXISTS idx_tecnicas_limpieza_prioridad 
    ON tecnicas_limpieza(prioridad);
    
    RAISE NOTICE '✅ Campo prioridad añadido a tecnicas_limpieza';
  END IF;
END $$;

-- Añadir campo is_obligatoria
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tecnicas_limpieza' AND column_name = 'is_obligatoria'
  ) THEN
    ALTER TABLE tecnicas_limpieza 
    ADD COLUMN is_obligatoria BOOLEAN DEFAULT false;
    
    -- Crear índice
    CREATE INDEX IF NOT EXISTS idx_tecnicas_limpieza_is_obligatoria 
    ON tecnicas_limpieza(is_obligatoria);
    
    RAISE NOTICE '✅ Campo is_obligatoria añadido a tecnicas_limpieza';
  END IF;
END $$;

-- Comentarios
COMMENT ON COLUMN tecnicas_limpieza.prioridad IS 
'Prioridad de la técnica para motores: alta, media, bajo (default: media)';

COMMENT ON COLUMN tecnicas_limpieza.is_obligatoria IS 
'Indica si la técnica es obligatoria para motores (default: false)';

-- ============================================================================
-- 2. PREPARACIONES PARA LA PRÁCTICA (preparaciones_practica)
-- ============================================================================

-- Añadir campo prioridad
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'preparaciones_practica' AND column_name = 'prioridad'
  ) THEN
    ALTER TABLE preparaciones_practica 
    ADD COLUMN prioridad VARCHAR(10) DEFAULT 'media' 
    CHECK (prioridad IN ('alta', 'media', 'bajo'));
    
    -- Actualizar registros existentes
    UPDATE preparaciones_practica SET prioridad = 'media' WHERE prioridad IS NULL;
    
    -- Crear índice
    CREATE INDEX IF NOT EXISTS idx_preparaciones_practica_prioridad 
    ON preparaciones_practica(prioridad);
    
    RAISE NOTICE '✅ Campo prioridad añadido a preparaciones_practica';
  END IF;
END $$;

-- Comentarios
COMMENT ON COLUMN preparaciones_practica.prioridad IS 
'Prioridad de la preparación para motores: alta, media, bajo (default: media)';

-- ============================================================================
-- 3. TÉCNICAS POST-PRÁCTICA (tecnicas_post_practica)
-- ============================================================================

-- Añadir campo prioridad
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tecnicas_post_practica' AND column_name = 'prioridad'
  ) THEN
    ALTER TABLE tecnicas_post_practica 
    ADD COLUMN prioridad VARCHAR(10) DEFAULT 'media' 
    CHECK (prioridad IN ('alta', 'media', 'bajo'));
    
    -- Actualizar registros existentes
    UPDATE tecnicas_post_practica SET prioridad = 'media' WHERE prioridad IS NULL;
    
    -- Crear índice
    CREATE INDEX IF NOT EXISTS idx_tecnicas_post_practica_prioridad 
    ON tecnicas_post_practica(prioridad);
    
    RAISE NOTICE '✅ Campo prioridad añadido a tecnicas_post_practica';
  END IF;
END $$;

-- Comentarios
COMMENT ON COLUMN tecnicas_post_practica.prioridad IS 
'Prioridad de la técnica post-práctica para motores: alta, media, bajo (default: media)';

-- ============================================================================
-- 4. PROTECCIONES ENERGÉTICAS (protecciones_energeticas)
-- ============================================================================

-- Añadir campo nivel_minimo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'protecciones_energeticas' AND column_name = 'nivel_minimo'
  ) THEN
    ALTER TABLE protecciones_energeticas 
    ADD COLUMN nivel_minimo INTEGER DEFAULT 1;
    
    -- Actualizar registros existentes
    UPDATE protecciones_energeticas SET nivel_minimo = 1 WHERE nivel_minimo IS NULL;
    
    -- Crear índice
    CREATE INDEX IF NOT EXISTS idx_protecciones_energeticas_nivel_minimo 
    ON protecciones_energeticas(nivel_minimo);
    
    RAISE NOTICE '✅ Campo nivel_minimo añadido a protecciones_energeticas';
  END IF;
END $$;

-- Añadir campo prioridad
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'protecciones_energeticas' AND column_name = 'prioridad'
  ) THEN
    ALTER TABLE protecciones_energeticas 
    ADD COLUMN prioridad VARCHAR(10) DEFAULT 'media' 
    CHECK (prioridad IN ('alta', 'media', 'bajo'));
    
    -- Actualizar registros existentes
    UPDATE protecciones_energeticas SET prioridad = 'media' WHERE prioridad IS NULL;
    
    -- Crear índice
    CREATE INDEX IF NOT EXISTS idx_protecciones_energeticas_prioridad 
    ON protecciones_energeticas(prioridad);
    
    RAISE NOTICE '✅ Campo prioridad añadido a protecciones_energeticas';
  END IF;
END $$;

-- Añadir campo is_obligatoria
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'protecciones_energeticas' AND column_name = 'is_obligatoria'
  ) THEN
    ALTER TABLE protecciones_energeticas 
    ADD COLUMN is_obligatoria BOOLEAN DEFAULT false;
    
    -- Crear índice
    CREATE INDEX IF NOT EXISTS idx_protecciones_energeticas_is_obligatoria 
    ON protecciones_energeticas(is_obligatoria);
    
    RAISE NOTICE '✅ Campo is_obligatoria añadido a protecciones_energeticas';
  END IF;
END $$;

-- Comentarios
COMMENT ON COLUMN protecciones_energeticas.nivel_minimo IS 
'Nivel mínimo requerido para usar esta protección (default: 1)';

COMMENT ON COLUMN protecciones_energeticas.prioridad IS 
'Prioridad de la protección para motores: alta, media, bajo (default: media)';

COMMENT ON COLUMN protecciones_energeticas.is_obligatoria IS 
'Indica si la protección es obligatoria para motores (default: false)';

-- ============================================================================
-- 5. DECRETOS (decretos) - OPCIONAL
-- ============================================================================

-- Añadir campo prioridad (opcional, para consistencia)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'decretos' AND column_name = 'prioridad'
  ) THEN
    ALTER TABLE decretos 
    ADD COLUMN prioridad VARCHAR(10) DEFAULT 'media' 
    CHECK (prioridad IN ('alta', 'media', 'bajo'));
    
    -- Actualizar registros existentes
    UPDATE decretos SET prioridad = 'media' WHERE prioridad IS NULL;
    
    -- Crear índice
    CREATE INDEX IF NOT EXISTS idx_decretos_prioridad 
    ON decretos(prioridad);
    
    RAISE NOTICE '✅ Campo prioridad añadido a decretos (opcional)';
  END IF;
END $$;

-- Comentarios
COMMENT ON COLUMN decretos.prioridad IS 
'Prioridad del decreto para motores: alta, media, bajo (default: media). Opcional, puede usar campo orden.';

-- ============================================================================
-- RESUMEN
-- ============================================================================

-- Verificar que todas las columnas fueron añadidas
DO $$
DECLARE
  missing_columns TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Verificar tecnicas_limpieza
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tecnicas_limpieza' AND column_name = 'prioridad'
  ) THEN
    missing_columns := array_append(missing_columns, 'tecnicas_limpieza.prioridad');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tecnicas_limpieza' AND column_name = 'is_obligatoria'
  ) THEN
    missing_columns := array_append(missing_columns, 'tecnicas_limpieza.is_obligatoria');
  END IF;
  
  -- Verificar preparaciones_practica
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'preparaciones_practica' AND column_name = 'prioridad'
  ) THEN
    missing_columns := array_append(missing_columns, 'preparaciones_practica.prioridad');
  END IF;
  
  -- Verificar tecnicas_post_practica
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tecnicas_post_practica' AND column_name = 'prioridad'
  ) THEN
    missing_columns := array_append(missing_columns, 'tecnicas_post_practica.prioridad');
  END IF;
  
  -- Verificar protecciones_energeticas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'protecciones_energeticas' AND column_name = 'nivel_minimo'
  ) THEN
    missing_columns := array_append(missing_columns, 'protecciones_energeticas.nivel_minimo');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'protecciones_energeticas' AND column_name = 'prioridad'
  ) THEN
    missing_columns := array_append(missing_columns, 'protecciones_energeticas.prioridad');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'protecciones_energeticas' AND column_name = 'is_obligatoria'
  ) THEN
    missing_columns := array_append(missing_columns, 'protecciones_energeticas.is_obligatoria');
  END IF;
  
  -- Mostrar resultado
  IF array_length(missing_columns, 1) > 0 THEN
    RAISE WARNING '⚠️ Columnas faltantes: %', array_to_string(missing_columns, ', ');
  ELSE
    RAISE NOTICE '✅ Todas las columnas fueron añadidas correctamente';
  END IF;
END $$;

-- ============================================================================
-- NOTAS DE USO
-- ============================================================================
-- 
-- Esta migración añade los campos necesarios para que los catálogos PDE
-- puedan ser consumidos correctamente por los Motores PDE.
--
-- Campos añadidos:
-- - prioridad: VARCHAR(10) con valores 'alta', 'media', 'bajo' (default: 'media')
-- - is_obligatoria: BOOLEAN (default: false) - solo en tecnicas_limpieza y protecciones_energeticas
-- - nivel_minimo: INTEGER (default: 1) - solo en protecciones_energeticas
--
-- Todos los campos tienen defaults seguros (fail-open) y no afectan
-- el comportamiento existente del sistema.
--
-- ============================================================================



