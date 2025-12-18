-- Migración v4.11.2: Tabla practice_signals (AUTO-2A)
-- Fecha: 2025-01-XX
-- Descripción: Captura de señales post-práctica
--               Almacena las señales registradas por el alumno después de cada práctica

CREATE TABLE IF NOT EXISTS practice_signals (
    id BIGSERIAL PRIMARY KEY,
    alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
    practice_id INTEGER REFERENCES practicas(id) ON DELETE SET NULL, -- ID de la práctica (nullable si se registra sin práctica)
    practice_key TEXT, -- Clave de la práctica (ej: 'limpieza', 'abundancia')
    signal_key TEXT NOT NULL REFERENCES signal_definitions(key) ON DELETE RESTRICT, -- Clave de la señal
    value INTEGER, -- Valor numérico (para tipo 'scale') o boolean convertido a int (0/1)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_practice_signals_alumno_id ON practice_signals(alumno_id);
CREATE INDEX IF NOT EXISTS idx_practice_signals_practice_id ON practice_signals(practice_id);
CREATE INDEX IF NOT EXISTS idx_practice_signals_signal_key ON practice_signals(signal_key);
CREATE INDEX IF NOT EXISTS idx_practice_signals_created_at ON practice_signals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_practice_signals_alumno_created ON practice_signals(alumno_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_practice_signals_signal_created ON practice_signals(signal_key, created_at DESC);

-- Comentarios para documentación
COMMENT ON TABLE practice_signals IS 'Captura de señales post-práctica (AUTO-2A)';
COMMENT ON COLUMN practice_signals.alumno_id IS 'ID del alumno que registró la señal';
COMMENT ON COLUMN practice_signals.practice_id IS 'ID de la práctica asociada (nullable si se registra sin práctica)';
COMMENT ON COLUMN practice_signals.practice_key IS 'Clave de la práctica (ej: limpieza, abundancia)';
COMMENT ON COLUMN practice_signals.signal_key IS 'Clave de la señal registrada (FK a signal_definitions)';
COMMENT ON COLUMN practice_signals.value IS 'Valor de la señal: número (scale) o 0/1 (boolean)';









