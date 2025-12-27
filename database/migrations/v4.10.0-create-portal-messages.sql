-- Migración v4.10.0: Tabla portal_messages (AUTO-1B)
-- Fecha: 2025-01-XX
-- Descripción: Tabla para mensajes internos del portal al alumno
--               Usado por la acción portal_message_action

CREATE TABLE IF NOT EXISTS portal_messages (
    id BIGSERIAL PRIMARY KEY,
    alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
    message_key TEXT, -- Identificador único del mensaje (opcional)
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal', -- 'low' | 'normal' | 'high'
    context JSONB NOT NULL DEFAULT '{}'::jsonb, -- Contexto de la automatización (rule_key, reason, etc.)
    expires_at TIMESTAMPTZ, -- Fecha de expiración (nullable)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ -- Fecha de lectura (nullable)
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_portal_messages_alumno_id ON portal_messages(alumno_id);
CREATE INDEX IF NOT EXISTS idx_portal_messages_created_at ON portal_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_messages_read_at ON portal_messages(read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_portal_messages_expires_at ON portal_messages(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_portal_messages_alumno_unread ON portal_messages(alumno_id, created_at DESC) WHERE read_at IS NULL;

-- Comentarios para documentación
COMMENT ON TABLE portal_messages IS 'Mensajes internos del portal para alumnos (AUTO-1B)';
COMMENT ON COLUMN portal_messages.message_key IS 'Identificador único del mensaje (opcional, para deduplicación)';
COMMENT ON COLUMN portal_messages.priority IS 'Prioridad: low, normal, high';
COMMENT ON COLUMN portal_messages.context IS 'Contexto de la automatización que creó el mensaje (JSONB)';
COMMENT ON COLUMN portal_messages.expires_at IS 'Fecha de expiración del mensaje (nullable)';
COMMENT ON COLUMN portal_messages.read_at IS 'Fecha de lectura del mensaje (nullable hasta que se lea)';




















