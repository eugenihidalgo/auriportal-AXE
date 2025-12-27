-- Migración v4.8.0: Tabla audit_events para eventos del Master (FASE 3)
-- Fecha: 2024-12-XX
-- Descripción: Tabla canónica para auditoría de acciones del Master/Admin
--               Permite control manual de pausas y auditoría completa

CREATE TABLE IF NOT EXISTS audit_events (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_type TEXT NOT NULL, -- 'admin', 'master', 'system'
    actor_id TEXT, -- ID del admin/master (nullable)
    alumno_id INTEGER, -- ID del alumno afectado (nullable)
    action TEXT NOT NULL, -- 'apodo', 'marcar-limpio', 'pause_create', etc.
    entity_type TEXT, -- 'alumno', 'pausa', 'lugar', 'proyecto', etc. (nullable)
    entity_id TEXT, -- ID de la entidad afectada (nullable)
    payload JSONB NOT NULL DEFAULT '{}'::jsonb, -- Datos adicionales del evento
    ip TEXT, -- IP del request (nullable)
    user_agent TEXT, -- User agent del request (nullable)
    request_id TEXT, -- Correlation ID del request (nullable)
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE, -- Soft delete
    deleted_at TIMESTAMPTZ -- Fecha de soft delete (nullable)
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_action ON audit_events(action);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor_type ON audit_events(actor_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor_id ON audit_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_alumno_id ON audit_events(alumno_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity_type ON audit_events(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity_id ON audit_events(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_request_id ON audit_events(request_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_is_deleted ON audit_events(is_deleted);

-- Índices compuestos para consultas comunes
CREATE INDEX IF NOT EXISTS idx_audit_events_alumno_created ON audit_events(alumno_id, created_at DESC) WHERE alumno_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_events_action_created ON audit_events(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor_action ON audit_events(actor_type, action, created_at DESC);

-- Comentarios para documentación
COMMENT ON TABLE audit_events IS 'Tabla canónica para auditoría de acciones del Master/Admin (FASE 3)';
COMMENT ON COLUMN audit_events.actor_type IS 'Tipo de actor: admin, master, system';
COMMENT ON COLUMN audit_events.actor_id IS 'ID del actor (admin_id, master_id, etc.)';
COMMENT ON COLUMN audit_events.alumno_id IS 'ID del alumno afectado por la acción';
COMMENT ON COLUMN audit_events.action IS 'Nombre de la acción: apodo, marcar-limpio, pause_create, pause_end, etc.';
COMMENT ON COLUMN audit_events.entity_type IS 'Tipo de entidad afectada: alumno, pausa, lugar, proyecto, etc.';
COMMENT ON COLUMN audit_events.entity_id IS 'ID de la entidad afectada';
COMMENT ON COLUMN audit_events.payload IS 'Datos adicionales del evento (JSONB)';
COMMENT ON COLUMN audit_events.is_deleted IS 'Soft delete: true si el evento fue eliminado';
COMMENT ON COLUMN audit_events.deleted_at IS 'Fecha de soft delete (si aplica)';




















