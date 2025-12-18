-- Migración v4.11.1: Tabla post_practice_flows (AUTO-2A)
-- Fecha: 2025-01-XX
-- Descripción: Flujos post-práctica (base del "Typeform interno")
--               Permite definir qué señales se capturan después de cada práctica

CREATE TABLE IF NOT EXISTS post_practice_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_key TEXT, -- Clave de la práctica (ej: 'limpieza', 'abundancia', nullable para flujos generales)
    mode_key TEXT, -- Clave del modo (nullable, permite flujos distintos por modo)
    flow_definition JSONB NOT NULL DEFAULT '{}'::jsonb, -- Definición declarativa del flujo
    active BOOLEAN NOT NULL DEFAULT TRUE, -- Si el flujo está activo
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_post_practice_flows_practice_key ON post_practice_flows(practice_key);
CREATE INDEX IF NOT EXISTS idx_post_practice_flows_mode_key ON post_practice_flows(mode_key);
CREATE INDEX IF NOT EXISTS idx_post_practice_flows_active ON post_practice_flows(active);
CREATE INDEX IF NOT EXISTS idx_post_practice_flows_practice_mode ON post_practice_flows(practice_key, mode_key) WHERE active = TRUE;

-- Comentarios para documentación
COMMENT ON TABLE post_practice_flows IS 'Flujos post-práctica (base del Typeform interno, AUTO-2A)';
COMMENT ON COLUMN post_practice_flows.practice_key IS 'Clave de la práctica específica (nullable para flujos generales)';
COMMENT ON COLUMN post_practice_flows.mode_key IS 'Clave del modo (nullable, permite flujos distintos por modo)';
COMMENT ON COLUMN post_practice_flows.flow_definition IS 'Definición declarativa del flujo en formato JSONB (ej: {steps: [{signal: "friction_level", required: true}]})';
COMMENT ON COLUMN post_practice_flows.active IS 'Si el flujo está activo y debe mostrarse';










