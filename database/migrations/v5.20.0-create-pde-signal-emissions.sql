-- ============================================================================
-- Migración v5.20.0: Tabla de Emisiones de Señales
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Registra todas las señales emitidas en el sistema
--              para auditoría, debugging y replay
--
-- PRINCIPIOS:
-- 1. Append-only: nunca se eliminan emisiones (historial completo)
-- 2. Fail-open: si falla la persistencia, la señal se emite igual
-- 3. Si no hay tabla → NO se persisten emisiones (pero se emiten)
-- ============================================================================

-- ============================================================================
-- TABLA: pde_signal_emissions
-- ============================================================================
-- Registra todas las señales emitidas en el sistema

CREATE TABLE IF NOT EXISTS pde_signal_emissions (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID único generado automáticamente
    
    -- ========================================================================
    -- SEÑAL
    -- ========================================================================
    signal_key TEXT NOT NULL,
    -- Clave de la señal emitida (FK lógica a pde_signals.signal_key)
    
    -- ========================================================================
    -- DATOS DE LA EMISIÓN
    -- ========================================================================
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Payload completo de la señal emitida
    
    runtime JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Runtime context (student_id, day_key, trace_id, step_id, etc.)
    
    context JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Contexto resuelto al momento de la emisión
    
    -- ========================================================================
    -- ORIGEN
    -- ========================================================================
    source_type TEXT,
    -- Tipo de origen: 'package', 'recorrido', 'manual', 'system'
    
    source_id TEXT,
    -- ID del origen (package_key, recorrido_id, etc.)
    
    -- ========================================================================
    -- METADATOS TEMPORALES
    -- ========================================================================
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- Fecha/hora de la emisión
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_pde_signal_emissions_signal_key ON pde_signal_emissions(signal_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pde_signal_emissions_source ON pde_signal_emissions(source_type, source_id) WHERE source_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pde_signal_emissions_created_at ON pde_signal_emissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pde_signal_emissions_runtime_student ON pde_signal_emissions((runtime->>'student_id')) WHERE runtime->>'student_id' IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pde_signal_emissions_runtime_trace ON pde_signal_emissions((runtime->>'trace_id')) WHERE runtime->>'trace_id' IS NOT NULL;

-- ============================================================================
-- COMENTARIOS
-- ============================================================================

COMMENT ON TABLE pde_signal_emissions IS 'Registro de todas las señales emitidas en el sistema (append-only)';
COMMENT ON COLUMN pde_signal_emissions.signal_key IS 'Clave de la señal emitida';
COMMENT ON COLUMN pde_signal_emissions.payload IS 'Payload completo de la señal emitida';
COMMENT ON COLUMN pde_signal_emissions.runtime IS 'Runtime context (student_id, day_key, trace_id, etc.)';
COMMENT ON COLUMN pde_signal_emissions.context IS 'Contexto resuelto al momento de la emisión';
COMMENT ON COLUMN pde_signal_emissions.source_type IS 'Tipo de origen: package, recorrido, manual, system';
COMMENT ON COLUMN pde_signal_emissions.source_id IS 'ID del origen (package_key, recorrido_id, etc.)';










