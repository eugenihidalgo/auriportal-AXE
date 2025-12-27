-- Migración v4.11.0: Tabla signal_definitions (AUTO-2A)
-- Fecha: 2025-01-XX
-- Descripción: Catálogo de señales post-práctica (base del sistema adaptativo)
--               Sin IA, sin interpretación psicológica, 100% declarativo

CREATE TABLE IF NOT EXISTS signal_definitions (
    key TEXT PRIMARY KEY, -- Identificador único de la señal (ej: 'friction_level')
    type TEXT NOT NULL CHECK (type IN ('scale', 'boolean', 'choice')), -- Tipo de señal
    scale_min INTEGER, -- Mínimo para tipo 'scale' (nullable)
    scale_max INTEGER, -- Máximo para tipo 'scale' (nullable)
    description TEXT, -- Descripción de la señal
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insertar señales iniciales
INSERT INTO signal_definitions (key, type, scale_min, scale_max, description) VALUES
    ('friction_level', 'scale', 0, 5, 'Nivel de fricción durante la práctica (0=nada, 5=muy alta)'),
    ('flow_level', 'scale', 0, 5, 'Nivel de flujo durante la práctica (0=nada, 5=muy alto)'),
    ('avoidance', 'boolean', NULL, NULL, 'Indica si hubo evitación o resistencia a practicar'),
    ('emotional_intensity', 'scale', 0, 5, 'Intensidad emocional durante la práctica (0=nula, 5=muy intensa)'),
    ('physical_resistance', 'scale', 0, 5, 'Resistencia física durante la práctica (0=nada, 5=muy alta)'),
    ('clarity_after', 'scale', 0, 5, 'Claridad mental después de la práctica (0=nula, 5=muy clara)')
ON CONFLICT (key) DO NOTHING;

-- Índices
CREATE INDEX IF NOT EXISTS idx_signal_definitions_type ON signal_definitions(type);

-- Comentarios para documentación
COMMENT ON TABLE signal_definitions IS 'Catálogo de señales post-práctica (AUTO-2A)';
COMMENT ON COLUMN signal_definitions.key IS 'Identificador único de la señal (ej: friction_level)';
COMMENT ON COLUMN signal_definitions.type IS 'Tipo de señal: scale (numérica), boolean (verdadero/falso), choice (opción)';
COMMENT ON COLUMN signal_definitions.scale_min IS 'Valor mínimo para señales tipo scale';
COMMENT ON COLUMN signal_definitions.scale_max IS 'Valor máximo para señales tipo scale';
COMMENT ON COLUMN signal_definitions.description IS 'Descripción de qué mide la señal';




















