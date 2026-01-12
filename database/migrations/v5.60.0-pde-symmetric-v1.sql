-- ============================================================================
-- Migración: v5.60.0-pde-symmetric-v1.sql
-- Fecha: 2025-01-08
-- Descripción: Añade pde_remaining para hacer PDE simétrico a SHARED
-- ============================================================================
--
-- OBJETIVO:
-- PDE debe ser un espejo exacto de SHARED, con su propio estado completo.
-- Esta migración añade pde_remaining para completar la simetría.
--
-- CAMBIOS:
-- 1. Añadir columna pde_remaining a cleaning_item_state
-- 2. Inicializar pde_remaining = 0 para registros existentes
-- 3. Añadir comentario explicativo
--
-- ============================================================================

DO $$
BEGIN
  -- 1. Añadir columna pde_remaining si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cleaning_item_state' 
    AND column_name = 'pde_remaining'
  ) THEN
    ALTER TABLE cleaning_item_state 
    ADD COLUMN pde_remaining INTEGER NOT NULL DEFAULT 0;
    
    RAISE NOTICE 'Columna pde_remaining añadida a cleaning_item_state';
  ELSE
    RAISE NOTICE 'Columna pde_remaining ya existe en cleaning_item_state';
  END IF;
  
  -- 2. Añadir comentario
  COMMENT ON COLUMN cleaning_item_state.pde_remaining IS 
    'Restantes PDE para una_vez (simétrico a shared_remaining, independiente)';
  
  RAISE NOTICE 'Comentario añadido a pde_remaining';
  
END $$;

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

DO $$
DECLARE
  col_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cleaning_item_state' 
    AND column_name = 'pde_remaining'
  ) INTO col_exists;
  
  IF col_exists THEN
    RAISE NOTICE '✅ VERIFICACIÓN: pde_remaining existe en cleaning_item_state';
  ELSE
    RAISE EXCEPTION '❌ ERROR: pde_remaining NO existe después de la migración';
  END IF;
END $$;
