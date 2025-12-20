-- Migración v4.12.0: Tabla pattern_definitions (AUTO-2B)
-- Fecha: 2025-01-XX
-- Descripción: Catálogo de patrones derivados de señales acumuladas
--               Patrones son DERIVADOS, no verdades absolutas
--               Comparación SIEMPRE contra el propio alumno

CREATE TABLE IF NOT EXISTS pattern_definitions (
    key TEXT PRIMARY KEY, -- Identificador único del patrón (ej: 'high_friction')
    description TEXT NOT NULL, -- Descripción del patrón
    source_signal TEXT NOT NULL REFERENCES signal_definitions(key) ON DELETE RESTRICT, -- Señal fuente
    logic JSONB NOT NULL DEFAULT '{}'::jsonb, -- Reglas declarativas del patrón
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insertar patrones iniciales
INSERT INTO pattern_definitions (key, description, source_signal, logic) VALUES
    (
        'high_friction',
        'Fricción alta sostenida en ventana de 14 días',
        'friction_level',
        '{"window": "14d", "avg_gte": 3.0, "count_gte": 3}'::jsonb
    ),
    (
        'sustained_flow',
        'Flujo sostenido en ventana de 14 días',
        'flow_level',
        '{"window": "14d", "avg_gte": 3.0, "count_gte": 3}'::jsonb
    ),
    (
        'repeated_avoidance',
        'Evitación repetida en ventana de 30 días',
        'avoidance',
        '{"window": "30d", "count_gte": 3}'::jsonb
    ),
    (
        'emotional_intensity_high',
        'Intensidad emocional alta en ventana de 14 días',
        'emotional_intensity',
        '{"window": "14d", "avg_gte": 4.0, "count_gte": 3}'::jsonb
    ),
    (
        'physical_resistance_high',
        'Resistencia física alta en ventana de 14 días',
        'physical_resistance',
        '{"window": "14d", "avg_gte": 3.0, "count_gte": 3}'::jsonb
    )
ON CONFLICT (key) DO NOTHING;

-- Índices
CREATE INDEX IF NOT EXISTS idx_pattern_definitions_source_signal ON pattern_definitions(source_signal);

-- Comentarios para documentación
COMMENT ON TABLE pattern_definitions IS 'Catálogo de patrones derivados de señales (AUTO-2B)';
COMMENT ON COLUMN pattern_definitions.key IS 'Identificador único del patrón (ej: high_friction)';
COMMENT ON COLUMN pattern_definitions.description IS 'Descripción del patrón';
COMMENT ON COLUMN pattern_definitions.source_signal IS 'Señal fuente (FK a signal_definitions)';
COMMENT ON COLUMN pattern_definitions.logic IS 'Reglas declarativas del patrón (JSONB con window, avg_gte, count_gte, etc.)';













