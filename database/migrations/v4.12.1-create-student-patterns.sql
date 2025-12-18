-- Migración v4.12.1: Tabla student_patterns (AUTO-2B)
-- Fecha: 2025-01-XX
-- Descripción: Patrones activos/inactivos por alumno
--               Estado derivado de signal_aggregates
--               100% reversible y explicable

CREATE TABLE IF NOT EXISTS student_patterns (
    alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
    pattern_key TEXT NOT NULL REFERENCES pattern_definitions(key) ON DELETE RESTRICT,
    time_window TEXT NOT NULL CHECK (time_window IN ('7d', '14d', '30d')), -- Ventana temporal
    state TEXT NOT NULL DEFAULT 'inactive' CHECK (state IN ('active', 'inactive')), -- Estado del patrón
    last_evaluated TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Última evaluación
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb, -- Evidencia del patrón (avg, count, window)
    PRIMARY KEY (alumno_id, pattern_key, time_window)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_student_patterns_alumno_id ON student_patterns(alumno_id);
CREATE INDEX IF NOT EXISTS idx_student_patterns_pattern_key ON student_patterns(pattern_key);
CREATE INDEX IF NOT EXISTS idx_student_patterns_state ON student_patterns(state);
CREATE INDEX IF NOT EXISTS idx_student_patterns_alumno_state ON student_patterns(alumno_id, state) WHERE state = 'active';
CREATE INDEX IF NOT EXISTS idx_student_patterns_last_evaluated ON student_patterns(last_evaluated DESC);

-- Comentarios para documentación
COMMENT ON TABLE student_patterns IS 'Patrones activos/inactivos por alumno (AUTO-2B)';
COMMENT ON COLUMN student_patterns.alumno_id IS 'ID del alumno';
COMMENT ON COLUMN student_patterns.pattern_key IS 'Clave del patrón (FK a pattern_definitions)';
COMMENT ON COLUMN student_patterns.time_window IS 'Ventana temporal (7d, 14d, 30d)';
COMMENT ON COLUMN student_patterns.state IS 'Estado: active (patrón presente) o inactive (patrón ausente)';
COMMENT ON COLUMN student_patterns.last_evaluated IS 'Última vez que se evaluó el patrón';
COMMENT ON COLUMN student_patterns.evidence IS 'Evidencia del patrón (JSONB con avg, count, window)';






