-- ============================================================================
-- Migración v5.45.0: Student Domain Integration v1
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Ajusta student_item_state para integración canónica con dominios
--              (Transmutaciones, Proyectos, Lugares, Apadrinados)
--
-- PRINCIPIOS:
-- 1. student_item_state como overlay del catálogo SOT
-- 2. Soporte para proyectos como repositorio personal (name, description)
-- 3. Campos flexibles para diferentes tipos de dominios
-- 4. Constraints y índices optimizados
-- ============================================================================

-- Asegurar que la extensión pgcrypto está disponible
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- AJUSTAR TABLA student_item_state
-- ============================================================================

-- Añadir product_key si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'student_item_state' AND column_name = 'product_key'
  ) THEN
    ALTER TABLE student_item_state ADD COLUMN product_key TEXT DEFAULT 'pde';
    COMMENT ON COLUMN student_item_state.product_key IS 'Clave del producto (ej. pde)';
  END IF;
END $$;

-- Añadir domain_type si no existe (alias de domain_key para claridad)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'student_item_state' AND column_name = 'domain_type'
  ) THEN
    ALTER TABLE student_item_state ADD COLUMN domain_type TEXT;
    -- Copiar valores de domain_key a domain_type
    UPDATE student_item_state SET domain_type = domain_key WHERE domain_type IS NULL;
    COMMENT ON COLUMN student_item_state.domain_type IS 'Tipo de dominio (transmutation, project, place, sponsor)';
  END IF;
END $$;

-- Añadir item_ref_type si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'student_item_state' AND column_name = 'item_ref_type'
  ) THEN
    ALTER TABLE student_item_state ADD COLUMN item_ref_type TEXT DEFAULT 'catalog_id';
    COMMENT ON COLUMN student_item_state.item_ref_type IS 'Tipo de referencia del ítem (catalog_id, uuid, custom)';
  END IF;
END $$;

-- Añadir item_ref si no existe (alias de item_id para flexibilidad)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'student_item_state' AND column_name = 'item_ref'
  ) THEN
    ALTER TABLE student_item_state ADD COLUMN item_ref TEXT;
    -- Copiar valores de item_id a item_ref
    UPDATE student_item_state SET item_ref = item_id::TEXT WHERE item_ref IS NULL;
    COMMENT ON COLUMN student_item_state.item_ref IS 'Referencia del ítem (flexible: ID, UUID, custom)';
  END IF;
END $$;

-- Añadir active_state si no existe (reemplazo de is_active)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'student_item_state' AND column_name = 'active_state'
  ) THEN
    ALTER TABLE student_item_state ADD COLUMN active_state TEXT DEFAULT 'inactive';
    -- Migrar is_active a active_state
    UPDATE student_item_state SET active_state = CASE WHEN is_active THEN 'active' ELSE 'inactive' END WHERE active_state = 'inactive';
    COMMENT ON COLUMN student_item_state.active_state IS 'Estado de activación (active, inactive)';
  END IF;
END $$;

-- Añadir clean_state si no existe (reemplazo de is_clean)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'student_item_state' AND column_name = 'clean_state'
  ) THEN
    ALTER TABLE student_item_state ADD COLUMN clean_state TEXT DEFAULT 'unclean';
    -- Migrar is_clean a clean_state
    UPDATE student_item_state SET clean_state = CASE WHEN is_clean THEN 'clean' ELSE 'unclean' END WHERE clean_state = 'unclean';
    COMMENT ON COLUMN student_item_state.clean_state IS 'Estado de limpieza (clean, unclean)';
  END IF;
END $$;

-- Añadir counters si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'student_item_state' AND column_name = 'counters'
  ) THEN
    ALTER TABLE student_item_state ADD COLUMN counters JSONB DEFAULT '{}'::jsonb;
    COMMENT ON COLUMN student_item_state.counters IS 'Contadores adicionales (ej. clean_count ya existe, pero este es extensible)';
  END IF;
END $$;

-- Añadir per_item_config si no existe (para proyectos: name, description, etc.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'student_item_state' AND column_name = 'per_item_config'
  ) THEN
    ALTER TABLE student_item_state ADD COLUMN per_item_config JSONB DEFAULT '{}'::jsonb;
    COMMENT ON COLUMN student_item_state.per_item_config IS 'Configuración específica por ítem (ej. name, description para proyectos)';
  END IF;
END $$;

-- ============================================================================
-- ACTUALIZAR CONSTRAINT UNIQUE
-- ============================================================================

-- Eliminar constraint antiguo si existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'student_item_state_student_id_domain_key_item_id_key'
  ) THEN
    ALTER TABLE student_item_state DROP CONSTRAINT student_item_state_student_id_domain_key_item_id_key;
  END IF;
END $$;

-- Crear nuevo constraint con product_key, domain_type, item_ref
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'student_item_state_unique_ref'
  ) THEN
    ALTER TABLE student_item_state 
    ADD CONSTRAINT student_item_state_unique_ref 
    UNIQUE (student_id, product_key, domain_type, item_ref);
  END IF;
END $$;

-- ============================================================================
-- ÍNDICES
-- ============================================================================

-- Índice para búsquedas por student, domain_type, active_state
CREATE INDEX IF NOT EXISTS idx_student_item_state_domain_active 
  ON student_item_state(student_id, domain_type, active_state) 
  WHERE active_state = 'active';

-- Índice para búsquedas por student, domain_type, clean_state
CREATE INDEX IF NOT EXISTS idx_student_item_state_domain_clean 
  ON student_item_state(student_id, domain_type, clean_state) 
  WHERE clean_state = 'unclean';

-- Índice GIN para per_item_config (búsquedas en JSONB)
CREATE INDEX IF NOT EXISTS idx_student_item_state_per_item_config_gin 
  ON student_item_state USING GIN (per_item_config);

-- Índice para item_ref (búsquedas por referencia)
CREATE INDEX IF NOT EXISTS idx_student_item_state_item_ref 
  ON student_item_state(item_ref);

-- ============================================================================
-- ACTUALIZAR COMENTARIOS
-- ============================================================================

COMMENT ON TABLE student_item_state IS 'Estado personal del alumno por ítem y dominio. Overlay del catálogo SOT.';
COMMENT ON COLUMN student_item_state.product_key IS 'Clave del producto (ej. pde)';
COMMENT ON COLUMN student_item_state.domain_type IS 'Tipo de dominio (transmutation, project, place, sponsor)';
COMMENT ON COLUMN student_item_state.item_ref_type IS 'Tipo de referencia del ítem (catalog_id, uuid, custom)';
COMMENT ON COLUMN student_item_state.item_ref IS 'Referencia del ítem (flexible: ID, UUID, custom)';
COMMENT ON COLUMN student_item_state.active_state IS 'Estado de activación (active, inactive)';
COMMENT ON COLUMN student_item_state.clean_state IS 'Estado de limpieza (clean, unclean)';
COMMENT ON COLUMN student_item_state.counters IS 'Contadores adicionales (extensible)';
COMMENT ON COLUMN student_item_state.per_item_config IS 'Configuración específica por ítem (ej. name, description para proyectos)';

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'student_item_state'
-- ORDER BY ordinal_position;


