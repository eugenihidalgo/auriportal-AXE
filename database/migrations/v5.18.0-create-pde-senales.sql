-- ============================================================================
-- Migración v5.18.0: Señales Registry v1 (Sistema de Señales PDE)
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Tablas para gestionar señales (signals) que reemplazan outputs
--              en paquetes. Sistema canónico con registry, DB, API y UI.
--
-- PRINCIPIOS:
-- 1. Fail-open absoluto: todo tiene default, nada bloquea
-- 2. Soft delete normalizado: deleted_at
-- 3. Audit log append-only: pde_signal_audit_log
-- 4. Si no hay tablas/migración aplicada → NO existe
-- ============================================================================

-- ============================================================================
-- TABLA: pde_signals
-- ============================================================================
-- Almacena definiciones de señales (signals) que pueden emitirse desde paquetes

CREATE TABLE IF NOT EXISTS pde_signals (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID único generado automáticamente
    
    signal_key TEXT UNIQUE NOT NULL,
    -- Clave única de la señal (slug, ej: "practica_completada")
    -- Usado para referenciar la señal en paquetes y runtime
    -- Validación: solo [a-z0-9_-]
    
    -- ========================================================================
    -- METADATOS
    -- ========================================================================
    label TEXT NOT NULL,
    -- Nombre legible de la señal (ej: "Práctica Completada")
    
    description TEXT,
    -- Descripción opcional de la señal
    
    -- ========================================================================
    -- CONFIGURACIÓN
    -- ========================================================================
    scope TEXT NOT NULL DEFAULT 'workflow' CHECK (scope IN ('global', 'workflow', 'step')),
    -- Ámbito de la señal: global, workflow, step
    
    payload_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Schema JSON que define la estructura del payload de la señal
    -- Ejemplo: {"type":"object","properties":{"practica_key":{"type":"string"}},"required":["practica_key"]}
    
    default_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Payload por defecto (valores iniciales)
    
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Array de tags para categorización (ej: ["streak","progress","analytics"])
    
    -- ========================================================================
    -- ESTADO Y ORIGEN
    -- ========================================================================
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    -- Estado de la señal: active (disponible) o archived (deshabilitado)
    
    origin TEXT NOT NULL DEFAULT 'user' CHECK (origin IN ('user', 'system')),
    -- Origen de la señal: user (creada por usuario) o system (del sistema)
    
    order_index INT NOT NULL DEFAULT 0,
    -- Índice de ordenamiento (menor = primero)
    
    -- ========================================================================
    -- METADATOS TEMPORALES
    -- ========================================================================
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    -- Soft delete: si tiene valor, la señal está eliminada (pero se mantiene en BD)
    
    -- ========================================================================
    -- CONSTRAINTS
    -- ========================================================================
    CONSTRAINT pde_signals_signal_key_unique UNIQUE (signal_key)
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_pde_signals_signal_key ON pde_signals(signal_key) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pde_signals_status_scope ON pde_signals(status, scope) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pde_signals_order_index ON pde_signals(order_index) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pde_signals_deleted_at ON pde_signals(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pde_signals_payload_schema_gin ON pde_signals USING GIN (payload_schema);
CREATE INDEX IF NOT EXISTS idx_pde_signals_tags_gin ON pde_signals USING GIN (tags);

-- ============================================================================
-- TABLA: pde_signal_audit_log
-- ============================================================================
-- Log de auditoría append-only para cambios en señales

CREATE TABLE IF NOT EXISTS pde_signal_audit_log (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID único generado automáticamente
    
    signal_key TEXT NOT NULL,
    -- Clave de la señal modificada (no FK para permitir soft delete)
    
    -- ========================================================================
    -- ACCIÓN
    -- ========================================================================
    action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'archive', 'restore')),
    -- Acción realizada
    
    -- ========================================================================
    -- ACTOR
    -- ========================================================================
    actor_admin_id TEXT,
    -- ID del administrador que realizó la acción (si está disponible)
    
    -- ========================================================================
    -- CAMBIOS
    -- ========================================================================
    before JSONB,
    -- Estado anterior de la señal (null si es create)
    
    after JSONB,
    -- Estado nuevo de la señal (null si es delete)
    
    -- ========================================================================
    -- METADATOS TEMPORALES
    -- ========================================================================
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- Fecha/hora de la acción
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_pde_signal_audit_log_signal_key ON pde_signal_audit_log(signal_key);
CREATE INDEX IF NOT EXISTS idx_pde_signal_audit_log_action ON pde_signal_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_pde_signal_audit_log_created_at ON pde_signal_audit_log(created_at DESC);

-- ============================================================================
-- INSERCIONES INICIALES (SEÑALES DEL SISTEMA)
-- ============================================================================

-- Señal: Práctica Completada
INSERT INTO pde_signals (signal_key, label, description, scope, payload_schema, default_payload, tags, status, origin, order_index)
VALUES (
    'practica_completada',
    'Práctica Completada',
    'Se emite cuando un estudiante completa una práctica',
    'workflow',
    '{"type":"object","properties":{"practica_key":{"type":"string"},"duracion_minutos":{"type":"number"}},"required":["practica_key"]}'::jsonb,
    '{}'::jsonb,
    '["streak","progress","analytics"]'::jsonb,
    'active',
    'system',
    1
) ON CONFLICT (signal_key) DO NOTHING;

-- Señal: Paquete Completado
INSERT INTO pde_signals (signal_key, label, description, scope, payload_schema, default_payload, tags, status, origin, order_index)
VALUES (
    'paquete_completado',
    'Paquete Completado',
    'Se emite cuando un estudiante completa un paquete de contenido',
    'workflow',
    '{"type":"object","properties":{"package_key":{"type":"string"}},"required":["package_key"]}'::jsonb,
    '{}'::jsonb,
    '["analytics"]'::jsonb,
    'active',
    'system',
    2
) ON CONFLICT (signal_key) DO NOTHING;

-- Señal: Step Completado
INSERT INTO pde_signals (signal_key, label, description, scope, payload_schema, default_payload, tags, status, origin, order_index)
VALUES (
    'step_completado',
    'Step Completado',
    'Se emite cuando un estudiante completa un step dentro de un recorrido',
    'step',
    '{"type":"object","properties":{"step_id":{"type":"string"}},"required":["step_id"]}'::jsonb,
    '{}'::jsonb,
    '["analytics"]'::jsonb,
    'active',
    'system',
    3
) ON CONFLICT (signal_key) DO NOTHING;

-- ============================================================================
-- COMENTARIOS
-- ============================================================================

COMMENT ON TABLE pde_signals IS 'Señales (signals) que pueden emitirse desde paquetes y recorridos';
COMMENT ON COLUMN pde_signals.signal_key IS 'Clave única de la señal (slug, solo [a-z0-9_-])';
COMMENT ON COLUMN pde_signals.payload_schema IS 'Schema JSON que define la estructura del payload';
COMMENT ON COLUMN pde_signals.tags IS 'Array de tags para categorización';
COMMENT ON TABLE pde_signal_audit_log IS 'Log de auditoría append-only para cambios en señales';



