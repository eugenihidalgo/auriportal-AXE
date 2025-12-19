-- Migración v4.6.0: Tabla analytics_events para Analytics Spine v1
-- Fecha: 2024-12-XX
-- Descripción: Tabla append-only para registrar eventos de analytics (client y server)
-- Preparada para futuros módulos: progreso, prácticas, funnels, IA basada en datos

CREATE TABLE IF NOT EXISTS analytics_events (
    id BIGSERIAL PRIMARY KEY,
    event_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    request_id TEXT,
    actor_type TEXT NOT NULL,
    actor_id TEXT,
    session_id TEXT,
    source TEXT NOT NULL,
    event_name TEXT NOT NULL,
    path TEXT,
    screen TEXT,
    app_version TEXT NOT NULL,
    build_id TEXT NOT NULL,
    props JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_actor_id ON analytics_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_request_id ON analytics_events(request_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_source ON analytics_events(source);

-- Índice compuesto para consultas comunes (event_name + created_at)
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_created ON analytics_events(event_name, created_at DESC);

-- Índice compuesto para consultas por actor (actor_type + actor_id + created_at)
CREATE INDEX IF NOT EXISTS idx_analytics_events_actor_created ON analytics_events(actor_type, actor_id, created_at DESC);

-- Comentarios para documentación
COMMENT ON TABLE analytics_events IS 'Tabla append-only para eventos de analytics (client y server). Preparada para futuros módulos: progreso, prácticas, funnels, IA basada en datos';
COMMENT ON COLUMN analytics_events.event_id IS 'UUID único del evento (generado automáticamente)';
COMMENT ON COLUMN analytics_events.request_id IS 'Correlation ID del request HTTP (permite correlación con audit_log)';
COMMENT ON COLUMN analytics_events.actor_type IS 'Tipo de actor: student, admin, system, anonymous';
COMMENT ON COLUMN analytics_events.actor_id IS 'ID del actor (alumno_id, admin_id, etc.). NUNCA email ni PII';
COMMENT ON COLUMN analytics_events.session_id IS 'ID de sesión del cliente (opcional)';
COMMENT ON COLUMN analytics_events.source IS 'Origen del evento: client o server';
COMMENT ON COLUMN analytics_events.event_name IS 'Nombre del evento (ej: page_view, button_click, practice_completed)';
COMMENT ON COLUMN analytics_events.path IS 'Ruta HTTP del evento (opcional)';
COMMENT ON COLUMN analytics_events.screen IS 'Pantalla/vista del evento (opcional)';
COMMENT ON COLUMN analytics_events.app_version IS 'Versión de la aplicación (APP_VERSION)';
COMMENT ON COLUMN analytics_events.build_id IS 'Build ID de la aplicación (BUILD_ID)';
COMMENT ON COLUMN analytics_events.props IS 'Propiedades adicionales del evento (JSONB, máximo 16KB)';












