-- Migración v4.10.3: Tabla master_notifications (AUTO-1B)
-- Fecha: 2025-01-XX
-- Descripción: Tabla para notificaciones del Master (Observatorio del sistema)
--               Usado por la acción master_notification_action

CREATE TABLE IF NOT EXISTS master_notifications (
    id BIGSERIAL PRIMARY KEY,
    type TEXT NOT NULL, -- Tipo de notificación (ej: 'automation_triggered', 'system_alert')
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info', -- 'info' | 'warning' | 'critical'
    context JSONB NOT NULL DEFAULT '{}'::jsonb, -- Contexto de la notificación
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ -- Fecha de lectura (nullable)
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_master_notifications_type ON master_notifications(type);
CREATE INDEX IF NOT EXISTS idx_master_notifications_severity ON master_notifications(severity);
CREATE INDEX IF NOT EXISTS idx_master_notifications_created_at ON master_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_master_notifications_read_at ON master_notifications(read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_master_notifications_unread ON master_notifications(created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_master_notifications_severity_unread ON master_notifications(severity, created_at DESC) WHERE read_at IS NULL;

-- Comentarios para documentación
COMMENT ON TABLE master_notifications IS 'Notificaciones para el Master (Observatorio del sistema) (AUTO-1B)';
COMMENT ON COLUMN master_notifications.type IS 'Tipo de notificación (ej: automation_triggered, system_alert)';
COMMENT ON COLUMN master_notifications.severity IS 'Severidad: info, warning, critical';
COMMENT ON COLUMN master_notifications.context IS 'Contexto de la notificación (JSONB)';
COMMENT ON COLUMN master_notifications.read_at IS 'Fecha de lectura de la notificación (nullable hasta que se lea)';




















