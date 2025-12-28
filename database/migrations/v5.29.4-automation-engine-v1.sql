-- ============================================================================
-- Migración v5.29.4: Motor de Automatizaciones Canónicas v1 (Fase D)
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Sistema canónico de automatizaciones alineado con Contratos A/B/C
--              que consume señales emitidas y ejecuta acciones registradas.
--
-- PRINCIPIOS:
-- 1. PostgreSQL es único Source of Truth
-- 2. Sin migración aplicada = no existe
-- 3. Automatizaciones NO mutan estado directo (usan Contrato B)
-- 4. Todo es auditable y reversible
-- 5. Feature flag OFF → BETA → ON
-- ============================================================================

-- ============================================================================
-- TABLA: automation_definitions
-- ============================================================================
-- Almacena definiciones de automatizaciones (reglas Señal → Acciones)

CREATE TABLE IF NOT EXISTS automation_definitions (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID único generado automáticamente
    
    automation_key TEXT UNIQUE NOT NULL,
    -- Clave única de la automatización (slug, ej: "increment_streak_on_practice")
    -- Usado para referenciar la automatización en runtime
    -- Validación: solo [a-z0-9_-]
    
    -- ========================================================================
    -- METADATOS
    -- ========================================================================
    name TEXT NOT NULL,
    -- Nombre legible de la automatización
    
    description TEXT,
    -- Descripción opcional de la automatización
    
    -- ========================================================================
    -- CONFIGURACIÓN
    -- ========================================================================
    definition JSONB NOT NULL,
    -- Definición canónica de la automatización (JSONB)
    -- Estructura:
    -- {
    --   "trigger": { "signalType": "student.practice_registered" },
    --   "steps": [
    --     { "actionKey": "student.updateStreak", "inputTemplate": {...}, "onError": "continue" }
    --   ],
    --   "parallel_groups": [] (opcional)
    -- }
    
    version INT NOT NULL DEFAULT 1,
    -- Versión de la definición (para migraciones futuras)
    
    -- ========================================================================
    -- ESTADO Y ORIGEN
    -- ========================================================================
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'deprecated', 'broken')),
    -- Estado de la automatización:
    -- - draft: borrador, no se ejecuta
    -- - active: activa, se ejecuta cuando se emite señal
    -- - deprecated: deshabilitada pero mantenida para histórico
    -- - broken: rota, requiere atención
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    -- Soft delete: si tiene valor, la automatización está eliminada
    
    -- ========================================================================
    -- AUDITORÍA
    -- ========================================================================
    created_by TEXT,
    -- Actor que creó la automatización (ej: 'admin:uuid' o 'system')
    
    updated_by TEXT
    -- Actor que actualizó la automatización
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_automation_definitions_automation_key ON automation_definitions(automation_key) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_automation_definitions_status ON automation_definitions(status) WHERE deleted_at IS NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_automation_definitions_deleted_at ON automation_definitions(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_automation_definitions_definition_gin ON automation_definitions USING GIN (definition);

-- ============================================================================
-- TABLA: automation_runs
-- ============================================================================
-- Registro de ejecuciones de automatizaciones

CREATE TABLE IF NOT EXISTS automation_runs (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID único generado automáticamente
    
    automation_id UUID NOT NULL REFERENCES automation_definitions(id) ON DELETE RESTRICT,
    -- FK a automation_definitions
    
    automation_key TEXT NOT NULL,
    -- Clave de la automatización (denormalizada para búsquedas rápidas)
    
    -- ========================================================================
    -- CONTEXTO DE EJECUCIÓN
    -- ========================================================================
    signal_id TEXT NOT NULL,
    -- ID de la señal que disparó la ejecución (de signal envelope)
    
    signal_type TEXT NOT NULL,
    -- Tipo de señal (ej: 'student.practice_registered')
    
    -- ========================================================================
    -- ESTADO Y RESULTADO
    -- ========================================================================
    status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed', 'skipped')),
    -- Estado de la ejecución:
    -- - running: en ejecución
    -- - success: completada exitosamente
    -- - failed: falló
    -- - skipped: saltada (dedupe o condición no cumplida)
    
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    -- Timestamps de inicio y fin
    
    error TEXT,
    -- Mensaje de error si status = failed
    
    meta JSONB,
    -- Metadatos adicionales (trace_id, actor, etc.)
    
    -- ========================================================================
    -- ÍNDICES
    -- ========================================================================
    CONSTRAINT automation_runs_automation_id_fk FOREIGN KEY (automation_id) REFERENCES automation_definitions(id) ON DELETE RESTRICT
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_automation_runs_automation_id ON automation_runs(automation_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_runs_automation_key ON automation_runs(automation_key, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_runs_signal_id ON automation_runs(signal_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_signal_type ON automation_runs(signal_type, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_runs_status ON automation_runs(status, started_at DESC);

-- ============================================================================
-- TABLA: automation_run_steps
-- ============================================================================
-- Registro de pasos individuales dentro de una ejecución

CREATE TABLE IF NOT EXISTS automation_run_steps (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID único generado automáticamente
    
    run_id UUID NOT NULL REFERENCES automation_runs(id) ON DELETE CASCADE,
    -- FK a automation_runs
    
    -- ========================================================================
    -- CONFIGURACIÓN DEL PASO
    -- ========================================================================
    step_index INT NOT NULL,
    -- Índice del paso dentro de la ejecución (0-based)
    
    action_key TEXT NOT NULL,
    -- Clave de la acción a ejecutar (ej: 'student.updateStreak')
    
    -- ========================================================================
    -- ESTADO Y RESULTADO
    -- ========================================================================
    status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed', 'skipped')),
    -- Estado del paso:
    -- - running: en ejecución
    -- - success: completado exitosamente
    -- - failed: falló
    -- - skipped: saltado (onError = 'skip')
    
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    -- Timestamps de inicio y fin
    
    input JSONB NOT NULL,
    -- Input del paso (resuelto desde inputTemplate)
    
    output JSONB,
    -- Output del paso (resultado de la acción)
    
    error TEXT,
    -- Mensaje de error si status = failed
    
    meta JSONB,
    -- Metadatos adicionales
    
    -- ========================================================================
    -- CONSTRAINTS
    -- ========================================================================
    CONSTRAINT automation_run_steps_run_id_fk FOREIGN KEY (run_id) REFERENCES automation_runs(id) ON DELETE CASCADE,
    CONSTRAINT automation_run_steps_unique_step_index UNIQUE (run_id, step_index)
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_automation_run_steps_run_id ON automation_run_steps(run_id, step_index);
CREATE INDEX IF NOT EXISTS idx_automation_run_steps_action_key ON automation_run_steps(action_key);
CREATE INDEX IF NOT EXISTS idx_automation_run_steps_status ON automation_run_steps(status);

-- ============================================================================
-- TABLA: automation_dedup
-- ============================================================================
-- Tabla de deduplicación para idempotencia

CREATE TABLE IF NOT EXISTS automation_dedup (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id BIGSERIAL PRIMARY KEY,
    -- ID secuencial
    
    dedup_key TEXT UNIQUE NOT NULL,
    -- Clave de deduplicación única
    -- Formato: `${signal_id}:${automation_key}`
    -- Ejemplo: 'signal-uuid-123:increment_streak_on_practice'
    
    -- ========================================================================
    -- METADATOS TEMPORALES
    -- ========================================================================
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- Timestamp de creación (para limpieza periódica si es necesario)
);

-- Índice único para dedupe
CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_dedup_dedup_key_unique ON automation_dedup(dedup_key);
CREATE INDEX IF NOT EXISTS idx_automation_dedup_created_at ON automation_dedup(created_at DESC);

-- ============================================================================
-- COMENTARIOS
-- ============================================================================

COMMENT ON TABLE automation_definitions IS 'Definiciones de automatizaciones canónicas (Fase D)';
COMMENT ON COLUMN automation_definitions.automation_key IS 'Clave única de la automatización (slug, solo [a-z0-9_-])';
COMMENT ON COLUMN automation_definitions.definition IS 'Definición canónica JSONB con trigger, steps, parallel_groups';
COMMENT ON TABLE automation_runs IS 'Registro de ejecuciones de automatizaciones';
COMMENT ON TABLE automation_run_steps IS 'Registro de pasos individuales dentro de ejecuciones';
COMMENT ON TABLE automation_dedup IS 'Tabla de deduplicación para idempotencia (dedup_key único)';
COMMENT ON COLUMN automation_dedup.dedup_key IS 'Clave de deduplicación: ${signal_id}:${automation_key}';






