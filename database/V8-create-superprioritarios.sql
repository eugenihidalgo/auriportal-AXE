-- V8-create-superprioritarios.sql
-- Crear tabla de aspectos super prioritarios para el Master

CREATE TABLE IF NOT EXISTS superprioritarios (
    id SERIAL PRIMARY KEY,
    alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,
    aspecto_id INT NOT NULL,
    fecha TIMESTAMP DEFAULT NOW(),
    creado_por VARCHAR(100) DEFAULT 'Master',
    CONSTRAINT check_tipo_superprioritario CHECK (tipo IN ('anatomia', 'karma', 'indeseable'))
);

CREATE INDEX IF NOT EXISTS idx_superprioritarios_alumno ON superprioritarios(alumno_id);
CREATE INDEX IF NOT EXISTS idx_superprioritarios_tipo ON superprioritarios(tipo);
CREATE INDEX IF NOT EXISTS idx_superprioritarios_fecha ON superprioritarios(fecha DESC);


























