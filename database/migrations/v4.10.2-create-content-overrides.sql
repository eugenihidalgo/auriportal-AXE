-- Migración v4.10.2: Tabla content_overrides (AUTO-1B)
-- Fecha: 2025-01-XX
-- Descripción: Tabla para overrides de visibilidad/prioridad de contenido
--               Usado por la acción content_visibility_action

CREATE TABLE IF NOT EXISTS content_overrides (
    id BIGSERIAL PRIMARY KEY,
    alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
    content_key TEXT NOT NULL, -- Identificador del contenido
    visibility TEXT NOT NULL, -- 'show' | 'hide' | 'priority'
    priority_level INTEGER, -- Nivel de prioridad (nullable, solo si visibility = 'priority')
    source TEXT NOT NULL DEFAULT 'automation', -- 'automation' | 'master'
    expires_at TIMESTAMPTZ, -- Fecha de expiración (nullable)
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb, -- Metadatos adicionales
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_content_overrides_alumno_id ON content_overrides(alumno_id);
CREATE INDEX IF NOT EXISTS idx_content_overrides_content_key ON content_overrides(content_key);
CREATE INDEX IF NOT EXISTS idx_content_overrides_alumno_content ON content_overrides(alumno_id, content_key);
CREATE INDEX IF NOT EXISTS idx_content_overrides_expires_at ON content_overrides(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_overrides_visibility ON content_overrides(visibility);
CREATE INDEX IF NOT EXISTS idx_content_overrides_alumno_visibility ON content_overrides(alumno_id, visibility, created_at DESC);

-- Comentarios para documentación
COMMENT ON TABLE content_overrides IS 'Overrides de visibilidad/prioridad de contenido para alumnos (AUTO-1B)';
COMMENT ON COLUMN content_overrides.content_key IS 'Identificador del contenido afectado';
COMMENT ON COLUMN content_overrides.visibility IS 'Visibilidad: show (mostrar), hide (ocultar), priority (prioridad especial)';
COMMENT ON COLUMN content_overrides.priority_level IS 'Nivel de prioridad (solo si visibility = priority, nullable)';
COMMENT ON COLUMN content_overrides.source IS 'Origen del override: automation (sistema) o master (manual)';
COMMENT ON COLUMN content_overrides.expires_at IS 'Fecha de expiración del override (nullable)';
COMMENT ON COLUMN content_overrides.metadata IS 'Metadatos adicionales del override (JSONB)';












