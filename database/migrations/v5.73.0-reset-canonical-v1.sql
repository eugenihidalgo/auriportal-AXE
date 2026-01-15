-- ============================================================================
-- v5.73.0-reset-canonical-v1.sql
-- ============================================================================
-- MASTER: Reset Canónico v1 (Cleaning Engine)
-- 
-- Descripción:
--   - Añade soporte para reset como evento del Cleaning Engine (no delete)
--   - Añade columnas effective_since para punto de corte operativo por capa
--   - Actualiza CHECK constraint de action_type para incluir 'reset'
--   - Reset conserva historia y nunca produce estado 'never'
--   - Reset invalida validez operativa, no borra datos históricos
--
-- Fecha: 2025-01-27
-- Referencia: docs/CLEANING_RESET_CANONICAL_V1.md
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ACTUALIZAR cleaning_events: Añadir 'reset' a action_type CHECK
-- ============================================================================

-- Eliminar constraint antiguo
ALTER TABLE cleaning_events 
  DROP CONSTRAINT IF EXISTS cleaning_events_action_type_check;

-- Añadir nuevo constraint con 'reset'
ALTER TABLE cleaning_events 
  ADD CONSTRAINT cleaning_events_action_type_check 
  CHECK (action_type IN ('mark_clean', 'set_remaining', 'reset'));

-- Comentario actualizado
COMMENT ON COLUMN cleaning_events.action_type IS 'Tipo de acción: mark_clean (marca limpio), set_remaining (ajusta remaining) o reset (invalida validez operativa)';

-- ============================================================================
-- 2. ACTUALIZAR cleaning_item_state: Añadir effective_since por capa
-- ============================================================================

-- Añadir columnas para punto de corte operativo
ALTER TABLE cleaning_item_state 
  ADD COLUMN IF NOT EXISTS shared_effective_since TIMESTAMPTZ NULL;

ALTER TABLE cleaning_item_state 
  ADD COLUMN IF NOT EXISTS pde_effective_since TIMESTAMPTZ NULL;

-- Añadir flags para indicar si hubo historia previa (útil para never vs pending)
ALTER TABLE cleaning_item_state 
  ADD COLUMN IF NOT EXISTS shared_had_history BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE cleaning_item_state 
  ADD COLUMN IF NOT EXISTS pde_had_history BOOLEAN NOT NULL DEFAULT false;

-- Índices opcionales para consultas por effective_since
CREATE INDEX IF NOT EXISTS idx_cleaning_item_state_shared_effective_since 
  ON cleaning_item_state(shared_effective_since) 
  WHERE shared_effective_since IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cleaning_item_state_pde_effective_since 
  ON cleaning_item_state(pde_effective_since) 
  WHERE pde_effective_since IS NOT NULL;

-- Comentarios constitucionales
COMMENT ON COLUMN cleaning_item_state.shared_effective_since IS 'Punto de corte operativo SHARED. Reset invalida validez operativa previa, no borra historia. Si existe, last_effective_clean = max(last_cleaned_at, effective_since).';
COMMENT ON COLUMN cleaning_item_state.pde_effective_since IS 'Punto de corte operativo PDE. Reset invalida validez operativa previa, no borra historia. Si existe, last_effective_clean = max(last_cleaned_at, effective_since).';
COMMENT ON COLUMN cleaning_item_state.shared_had_history IS 'Indica si hubo historia previa de limpieza SHARED antes del reset. Útil para distinguir never (sin historia) vs pending (con reset).';
COMMENT ON COLUMN cleaning_item_state.pde_had_history IS 'Indica si hubo historia previa de limpieza PDE antes del reset. Útil para distinguir never (sin historia) vs pending (con reset).';

-- ============================================================================
-- 3. BACKFILL: Inicializar had_history para registros existentes
-- ============================================================================

-- Si hay last_cleaned_at, significa que hubo historia
UPDATE cleaning_item_state 
SET shared_had_history = (shared_last_cleaned_at IS NOT NULL),
    pde_had_history = (pde_last_cleaned_at IS NOT NULL)
WHERE shared_had_history = false OR pde_had_history = false;

-- ============================================================================
-- 4. VERIFICACIÓN
-- ============================================================================

DO $$
BEGIN
  -- Verificar que cleaning_events acepta 'reset'
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'cleaning_events_action_type_check'
    AND pg_get_constraintdef(oid) LIKE '%reset%'
  ) THEN
    RAISE EXCEPTION 'Constraint de action_type no incluye reset';
  END IF;
  
  -- Verificar que las columnas existen
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cleaning_item_state' 
    AND column_name = 'shared_effective_since'
  ) THEN
    RAISE EXCEPTION 'Columna shared_effective_since no existe';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cleaning_item_state' 
    AND column_name = 'pde_effective_since'
  ) THEN
    RAISE EXCEPTION 'Columna pde_effective_since no existe';
  END IF;
  
  RAISE NOTICE '✅ Reset Canónico v1: Migración verificada correctamente';
END $$;

COMMIT;
