-- ============================================================================
-- v5.72.0-history-system-v1.sql
-- ============================================================================
-- MASTER: Sistema de Historial de Limpiezas v1
-- 
-- Descripción:
--   - Crea tablas para historial narrativo pedagógico (append-only)
--   - history_entries: Entradas de historial (ACTION_HISTORY, NARRATIVE_HISTORY, SILENCE_HISTORY)
--   - history_aggregation_runs: Ejecuciones de agregación por ventana temporal
--   - history_entry_links: Vínculos entre historial y acciones/eventos originales
--   - UUID-only: student_id es UUID (FK a students.id)
--   - Append-only: nunca se modifica ni elimina contenido narrativo
--
-- Fecha: 2025-01-12
-- Referencia: docs/HISTORIAL_LIMPIEZAS_V1.md
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. TABLA history_entries (Source of Truth del historial narrativo)
-- ============================================================================

CREATE TABLE IF NOT EXISTS history_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('action_history', 'narrative_history', 'silence_history')),
  scope TEXT NOT NULL CHECK (scope IN ('person', 'group', 'platform')),
  scope_ref TEXT NOT NULL,  -- UUID para person, string para group/platform
  "window" TEXT CHECK ("window" IN ('daily', 'weekly', 'monthly', 'yearly') OR "window" IS NULL),
  window_start TIMESTAMPTZ,
  window_end TIMESTAMPTZ,
  title TEXT NOT NULL,
  content JSONB NOT NULL,  -- Bloques estructurados (title, context, actions, reading, closure)
  triggered_by TEXT NOT NULL,  -- Señal o agregación que lo generó
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trace_id UUID NOT NULL
);

-- Índices para history_entries
CREATE INDEX IF NOT EXISTS idx_history_entries_scope_ref 
  ON history_entries(scope, scope_ref);

CREATE INDEX IF NOT EXISTS idx_history_entries_type 
  ON history_entries(type);

CREATE INDEX IF NOT EXISTS idx_history_entries_window 
  ON history_entries("window", window_start, window_end) 
  WHERE "window" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_history_entries_created_at 
  ON history_entries(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_history_entries_trace_id 
  ON history_entries(trace_id);

-- Constraint: window_start y window_end deben ser coherentes
ALTER TABLE history_entries 
  ADD CONSTRAINT check_window_coherence 
  CHECK (
    ("window" IS NULL AND window_start IS NULL AND window_end IS NULL) OR
    ("window" IS NOT NULL AND window_start IS NOT NULL AND window_end IS NOT NULL AND window_start <= window_end)
  );

-- Comentarios
COMMENT ON TABLE history_entries IS 'Entradas de historial narrativo pedagógico (Source of Truth). Append-only, nunca se modifica ni elimina.';
COMMENT ON COLUMN history_entries.type IS 'Tipo: action_history (inmediato), narrative_history (agregado), silence_history (periodos sin actividad)';
COMMENT ON COLUMN history_entries.scope IS 'Alcance: person (estudiante), group (grupo), platform (plataforma)';
COMMENT ON COLUMN history_entries.scope_ref IS 'Referencia del scope: UUID para person, string para group/platform';
COMMENT ON COLUMN history_entries."window" IS 'Ventana temporal: daily, weekly, monthly, yearly (null para action_history)';
COMMENT ON COLUMN history_entries.content IS 'Contenido estructurado en bloques JSON (title, context, actions, reading, closure)';
COMMENT ON COLUMN history_entries.triggered_by IS 'Origen: señal (signal:...) o agregación (aggregation:...) que generó esta entrada';

-- ============================================================================
-- 2. TABLA history_aggregation_runs (Ejecuciones de agregación)
-- ============================================================================

CREATE TABLE IF NOT EXISTS history_aggregation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "window" TEXT NOT NULL CHECK ("window" IN ('daily', 'weekly', 'monthly', 'yearly')),
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('person', 'group', 'platform')),
  scope_ref TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')) DEFAULT 'pending',
  entries_generated INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  trace_id UUID NOT NULL,
  CONSTRAINT check_window_end_after_start CHECK (window_end >= window_start),
  CONSTRAINT check_entries_generated_non_negative CHECK (entries_generated >= 0)
);

-- Índice único para idempotencia (una ejecución por ventana/scope/scope_ref)
CREATE UNIQUE INDEX IF NOT EXISTS idx_history_aggregation_runs_unique 
  ON history_aggregation_runs("window", window_start, window_end, scope, scope_ref);

-- Índices adicionales
CREATE INDEX IF NOT EXISTS idx_history_aggregation_runs_status 
  ON history_aggregation_runs(status);

CREATE INDEX IF NOT EXISTS idx_history_aggregation_runs_window 
  ON history_aggregation_runs("window", window_start);

CREATE INDEX IF NOT EXISTS idx_history_aggregation_runs_trace_id 
  ON history_aggregation_runs(trace_id);

-- Comentarios
COMMENT ON TABLE history_aggregation_runs IS 'Ejecuciones de agregación de historial por ventana temporal. Idempotente por ventana/scope/scope_ref.';
COMMENT ON COLUMN history_aggregation_runs.status IS 'Estado: pending, running, completed, failed';
COMMENT ON COLUMN history_aggregation_runs.entries_generated IS 'Número de entradas de historial generadas en esta ejecución';

-- ============================================================================
-- 3. TABLA history_entry_links (Vínculos historial-acciones)
-- ============================================================================

CREATE TABLE IF NOT EXISTS history_entry_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  history_entry_id UUID NOT NULL REFERENCES history_entries(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('cleaning_event', 'signal', 'aggregation')),
  source_ref TEXT NOT NULL,  -- UUID o string según source_type
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para history_entry_links
CREATE INDEX IF NOT EXISTS idx_history_entry_links_history_entry_id 
  ON history_entry_links(history_entry_id);

CREATE INDEX IF NOT EXISTS idx_history_entry_links_source 
  ON history_entry_links(source_type, source_ref);

-- Comentarios
COMMENT ON TABLE history_entry_links IS 'Vínculos entre entradas de historial y acciones/eventos originales. Permite trazabilidad completa.';
COMMENT ON COLUMN history_entry_links.source_type IS 'Tipo de origen: cleaning_event, signal, aggregation';
COMMENT ON COLUMN history_entry_links.source_ref IS 'Referencia al origen: UUID de cleaning_event o signal, string para aggregation';

-- ============================================================================
-- 4. VERIFICACIÓN
-- ============================================================================

DO $$
BEGIN
  -- Verificar que history_entries existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'history_entries'
  ) THEN
    RAISE EXCEPTION 'Tabla history_entries no existe';
  END IF;
  
  -- Verificar que history_aggregation_runs existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'history_aggregation_runs'
  ) THEN
    RAISE EXCEPTION 'Tabla history_aggregation_runs no existe';
  END IF;
  
  -- Verificar que history_entry_links existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'history_entry_links'
  ) THEN
    RAISE EXCEPTION 'Tabla history_entry_links no existe';
  END IF;
  
  -- Verificar constraint de idempotencia en history_aggregation_runs
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_history_aggregation_runs_unique'
  ) THEN
    RAISE EXCEPTION 'Índice de idempotencia idx_history_aggregation_runs_unique no existe';
  END IF;
  
  RAISE NOTICE '✅ Sistema de Historial v1: Tablas creadas correctamente';
END $$;

COMMIT;
