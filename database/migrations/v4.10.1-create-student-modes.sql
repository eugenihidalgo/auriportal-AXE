-- Migración v4.10.1: Tabla student_modes (AUTO-1B)
-- Fecha: 2025-01-XX
-- Descripción: Tabla para modos temporales del alumno
--               Usado por la acción mode_set_action

CREATE TABLE IF NOT EXISTS student_modes (
    id BIGSERIAL PRIMARY KEY,
    alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
    mode_key TEXT NOT NULL, -- Identificador del modo (ej: 'navidad', 'sprint', 'cumpleanos', 'sanacion')
    active BOOLEAN NOT NULL DEFAULT TRUE,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at TIMESTAMPTZ, -- Fecha de finalización (nullable)
    source TEXT NOT NULL DEFAULT 'automation', -- 'automation' | 'master'
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb, -- Metadatos adicionales del modo
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ -- Fecha de finalización real (nullable)
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_student_modes_alumno_id ON student_modes(alumno_id);
CREATE INDEX IF NOT EXISTS idx_student_modes_mode_key ON student_modes(mode_key);
CREATE INDEX IF NOT EXISTS idx_student_modes_active ON student_modes(active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_student_modes_alumno_active ON student_modes(alumno_id, active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_student_modes_ends_at ON student_modes(ends_at) WHERE ends_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_student_modes_alumno_mode_key ON student_modes(alumno_id, mode_key, active) WHERE active = TRUE;

-- Constraint: Un alumno solo puede tener un modo activo del mismo mode_key a la vez
-- (se maneja en la aplicación, pero el índice ayuda)

-- Comentarios para documentación
COMMENT ON TABLE student_modes IS 'Modos temporales del alumno (Navidad, Sprint, Cumpleaños, Sanación, etc.) (AUTO-1B)';
COMMENT ON COLUMN student_modes.mode_key IS 'Identificador del modo (ej: navidad, sprint, cumpleanos, sanacion)';
COMMENT ON COLUMN student_modes.active IS 'Si el modo está activo actualmente';
COMMENT ON COLUMN student_modes.ends_at IS 'Fecha de finalización programada (nullable)';
COMMENT ON COLUMN student_modes.source IS 'Origen del modo: automation (sistema) o master (manual)';
COMMENT ON COLUMN student_modes.metadata IS 'Metadatos adicionales del modo (JSONB)';
COMMENT ON COLUMN student_modes.ended_at IS 'Fecha de finalización real (nullable hasta que se desactive)';









