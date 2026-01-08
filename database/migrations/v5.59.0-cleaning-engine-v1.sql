-- ============================================================================
-- v5.59.0-cleaning-engine-v1.sql
-- ============================================================================
-- MASTER: Cleaning Engine v1
-- 
-- Descripción:
--   - Crea tablas cleaning_events (append-only audit) y cleaning_item_state (proyección)
--   - Soporta 2 capas de limpieza (SHARED vs PDE)
--   - Actores (master/student/automation)
--   - Idempotencia vía execution_key
--   - Compatibilidad con student_item_state existente
--
-- Fecha: 2026-01-08
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. TABLA cleaning_events (append-only, audit real)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cleaning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trace_id TEXT NOT NULL,
  execution_key TEXT NOT NULL,  -- Para idempotencia por alumno+acción
  student_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  product_key TEXT NOT NULL DEFAULT 'pde',
  domain_type TEXT NOT NULL,  -- ej: 'transmutation'
  item_ref TEXT NOT NULL,
  clean_layer TEXT NOT NULL CHECK (clean_layer IN ('shared','pde')),
  item_kind TEXT NOT NULL CHECK (item_kind IN ('recurrente','una_vez')),
  action_type TEXT NOT NULL CHECK (action_type IN ('mark_clean','set_remaining')),
  delta_completed INTEGER NULL,  -- Para una_vez mark_clean => +1
  set_remaining INTEGER NULL,    -- Para set_remaining
  actor_type TEXT NOT NULL CHECK (actor_type IN ('master','student','automation')),
  actor_ref TEXT NULL,
  surface_key TEXT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Índices para cleaning_events
CREATE INDEX IF NOT EXISTS idx_cleaning_events_student_item 
  ON cleaning_events(student_id, product_key, domain_type, item_ref);

CREATE INDEX IF NOT EXISTS idx_cleaning_events_item_layer 
  ON cleaning_events(item_ref, clean_layer);

CREATE INDEX IF NOT EXISTS idx_cleaning_events_trace 
  ON cleaning_events(trace_id);

-- Constraint de idempotencia (execution_key + student_id único)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cleaning_events_execution_student 
  ON cleaning_events(execution_key, student_id);

-- Comentarios
COMMENT ON TABLE cleaning_events IS 'Eventos de limpieza (append-only, audit real). Soporta 2 capas (shared/pde) y actores múltiples.';
COMMENT ON COLUMN cleaning_events.execution_key IS 'Clave de ejecución para idempotencia (formato: {action_type}:{item_ref}:{student_id}:{timestamp_day})';
COMMENT ON COLUMN cleaning_events.clean_layer IS 'Capa de limpieza: shared (visible alumno) o pde (repaso master-only)';
COMMENT ON COLUMN cleaning_events.item_kind IS 'Tipo de item: recurrente (por tiempo) o una_vez (por contador)';
COMMENT ON COLUMN cleaning_events.action_type IS 'Tipo de acción: mark_clean (marca limpio) o set_remaining (ajusta remaining)';
COMMENT ON COLUMN cleaning_events.delta_completed IS 'Incremento de completed para una_vez (mark_clean => +1)';
COMMENT ON COLUMN cleaning_events.set_remaining IS 'Valor de remaining establecido (set_remaining)';
COMMENT ON COLUMN cleaning_events.actor_type IS 'Tipo de actor: master, student o automation';
COMMENT ON COLUMN cleaning_events.surface_key IS 'Superficie de origen (ej: master.alquimia_general, student.alquimia, auto.job)';

-- ============================================================================
-- 2. TABLA cleaning_item_state (proyección canónica)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cleaning_item_state (
  student_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  product_key TEXT NOT NULL DEFAULT 'pde',
  domain_type TEXT NOT NULL,
  item_ref TEXT NOT NULL,
  shared_last_cleaned_at TIMESTAMPTZ NULL,
  pde_last_cleaned_at TIMESTAMPTZ NULL,
  shared_clean_count INTEGER NOT NULL DEFAULT 0,
  pde_clean_count INTEGER NOT NULL DEFAULT 0,
  shared_completed INTEGER NOT NULL DEFAULT 0,  -- Para una_vez
  shared_remaining INTEGER NOT NULL DEFAULT 0,   -- Para una_vez
  pde_completed INTEGER NOT NULL DEFAULT 0,     -- Opcional, no afecta alumno
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, product_key, domain_type, item_ref)
);

-- Índices para cleaning_item_state
CREATE INDEX IF NOT EXISTS idx_cleaning_item_state_item_ref 
  ON cleaning_item_state(item_ref);

CREATE INDEX IF NOT EXISTS idx_cleaning_item_state_shared_last_cleaned 
  ON cleaning_item_state(shared_last_cleaned_at) 
  WHERE shared_last_cleaned_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cleaning_item_state_pde_last_cleaned 
  ON cleaning_item_state(pde_last_cleaned_at) 
  WHERE pde_last_cleaned_at IS NOT NULL;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_cleaning_item_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_cleaning_item_state_updated_at 
  ON cleaning_item_state;
CREATE TRIGGER trigger_update_cleaning_item_state_updated_at
  BEFORE UPDATE ON cleaning_item_state
  FOR EACH ROW
  EXECUTE FUNCTION update_cleaning_item_state_updated_at();

-- Comentarios
COMMENT ON TABLE cleaning_item_state IS 'Proyección canónica del estado de limpieza por capa (shared/pde). Para lectura rápida y estado por capa.';
COMMENT ON COLUMN cleaning_item_state.shared_last_cleaned_at IS 'Última limpieza SHARED (visible al alumno)';
COMMENT ON COLUMN cleaning_item_state.pde_last_cleaned_at IS 'Última limpieza PDE (repaso master-only, no afecta alumno)';
COMMENT ON COLUMN cleaning_item_state.shared_completed IS 'Completadas SHARED para una_vez';
COMMENT ON COLUMN cleaning_item_state.shared_remaining IS 'Restantes SHARED para una_vez';
COMMENT ON COLUMN cleaning_item_state.pde_completed IS 'Completadas PDE para una_vez (solo audit, no afecta remaining del alumno)';

-- ============================================================================
-- 3. VERIFICACIÓN
-- ============================================================================

DO $$
BEGIN
  -- Verificar que cleaning_events existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'cleaning_events'
  ) THEN
    RAISE EXCEPTION 'Tabla cleaning_events no existe';
  END IF;
  
  -- Verificar que cleaning_item_state existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'cleaning_item_state'
  ) THEN
    RAISE EXCEPTION 'Tabla cleaning_item_state no existe';
  END IF;
  
  -- Verificar constraint de idempotencia
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_cleaning_events_execution_student'
  ) THEN
    RAISE EXCEPTION 'Índice de idempotencia no existe';
  END IF;
  
  RAISE NOTICE '✅ Cleaning Engine v1: Tablas y constraints verificados correctamente';
END $$;

COMMIT;
