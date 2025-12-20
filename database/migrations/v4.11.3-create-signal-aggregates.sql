-- Migración v4.11.3: Tabla signal_aggregates (AUTO-2A)
-- Fecha: 2025-01-XX
-- Descripción: Agregados de señales por alumno y ventana temporal
--               Calcula promedios y estadísticas de señales en ventanas de tiempo

CREATE TABLE IF NOT EXISTS signal_aggregates (
    alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
    signal_key TEXT NOT NULL REFERENCES signal_definitions(key) ON DELETE RESTRICT,
    window_days INTEGER NOT NULL CHECK (window_days IN (7, 14, 30)), -- Ventana temporal en días
    avg_value NUMERIC(10, 2) NOT NULL, -- Valor promedio
    count INTEGER NOT NULL DEFAULT 0, -- Número de señales en la ventana
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (alumno_id, signal_key, window_days)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_signal_aggregates_alumno_id ON signal_aggregates(alumno_id);
CREATE INDEX IF NOT EXISTS idx_signal_aggregates_signal_key ON signal_aggregates(signal_key);
CREATE INDEX IF NOT EXISTS idx_signal_aggregates_window_days ON signal_aggregates(window_days);
CREATE INDEX IF NOT EXISTS idx_signal_aggregates_alumno_signal ON signal_aggregates(alumno_id, signal_key);
CREATE INDEX IF NOT EXISTS idx_signal_aggregates_last_updated ON signal_aggregates(last_updated DESC);

-- Comentarios para documentación
COMMENT ON TABLE signal_aggregates IS 'Agregados de señales por alumno y ventana temporal (AUTO-2A)';
COMMENT ON COLUMN signal_aggregates.alumno_id IS 'ID del alumno';
COMMENT ON COLUMN signal_aggregates.signal_key IS 'Clave de la señal (FK a signal_definitions)';
COMMENT ON COLUMN signal_aggregates.window_days IS 'Ventana temporal en días (7, 14 o 30)';
COMMENT ON COLUMN signal_aggregates.avg_value IS 'Valor promedio de la señal en la ventana';
COMMENT ON COLUMN signal_aggregates.count IS 'Número de señales registradas en la ventana';
COMMENT ON COLUMN signal_aggregates.last_updated IS 'Última vez que se actualizó el agregado';













