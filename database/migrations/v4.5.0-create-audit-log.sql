-- Migración v4.5.0: Tabla audit_log para observabilidad y auditoría
-- Fecha: 2024-12-XX
-- Descripción: Tabla append-only para registrar eventos de auditoría

CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    request_id TEXT,
    actor_type TEXT,
    actor_id TEXT,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info',
    data JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_request_id ON audit_log(request_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_severity ON audit_log(severity);

-- Índice compuesto para consultas comunes (event_type + created_at)
CREATE INDEX IF NOT EXISTS idx_audit_log_event_created ON audit_log(event_type, created_at DESC);

-- Comentarios para documentación
COMMENT ON TABLE audit_log IS 'Tabla append-only para eventos de auditoría y observabilidad';
COMMENT ON COLUMN audit_log.request_id IS 'Correlation ID del request HTTP';
COMMENT ON COLUMN audit_log.actor_type IS 'Tipo de actor: student, admin, system';
COMMENT ON COLUMN audit_log.actor_id IS 'ID del actor (alumno_id, admin_id, etc.)';
COMMENT ON COLUMN audit_log.event_type IS 'Tipo de evento (SUBSCRIPTION_BLOCKED_PRACTICE, AUTH_CONTEXT_FAIL, etc.)';
COMMENT ON COLUMN audit_log.severity IS 'Severidad: info, warn, error';
COMMENT ON COLUMN audit_log.data IS 'Datos adicionales del evento (JSONB)';










