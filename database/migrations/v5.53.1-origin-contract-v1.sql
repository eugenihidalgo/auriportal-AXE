-- ============================================================================
-- Migración v5.53.1: ORIGIN CONTRACT v1 - Sistema Canónico de Orígenes
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Sistema canónico para describir "cómo se ejecuta/asigna"
--              cualquier trabajo (UTE, encargos) sin acoplarse a un solo SOT.
--
-- PRINCIPIOS FUNDAMENTALES:
-- 1. PostgreSQL es el único Source of Truth
-- 2. Idempotencia por origin_key
-- 3. Auditable (audit_log append-only)
-- 4. Reversible (soft delete)
-- 5. Sin hardcodes (JSONB extensible)
-- ============================================================================

-- ============================================================================
-- TABLA: origin_definitions
-- ============================================================================

CREATE TABLE IF NOT EXISTS origin_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    origin_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
    source_selector JSONB NOT NULL,
    execution JSONB NOT NULL,
    actors JSONB NOT NULL,
    targets JSONB NOT NULL,
    surfaces JSONB NOT NULL DEFAULT '[]'::jsonb,
    signals JSONB NOT NULL DEFAULT '{}'::jsonb,
    ui JSONB NOT NULL DEFAULT '{}'::jsonb,
    meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT check_origin_key_not_empty CHECK (LENGTH(TRIM(origin_key)) > 0)
);

-- ============================================================================
-- TABLA: origin_audit_log
-- ============================================================================

CREATE TABLE IF NOT EXISTS origin_audit_log (
    id BIGSERIAL PRIMARY KEY,
    origin_id UUID NOT NULL REFERENCES origin_definitions(id) ON DELETE RESTRICT,
    action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'archived', 'deleted', 'restored')),
    actor_type TEXT NOT NULL CHECK (actor_type IN ('master', 'system', 'api')),
    actor_id TEXT,
    snapshot JSONB NOT NULL,
    at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    trace_id TEXT,
    notes TEXT
);

-- ============================================================================
-- ÍNDICES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_origin_definitions_key 
    ON origin_definitions(origin_key) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_origin_definitions_status 
    ON origin_definitions(status) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_origin_definitions_source_selector 
    ON origin_definitions USING GIN (source_selector);

CREATE INDEX IF NOT EXISTS idx_origin_definitions_execution 
    ON origin_definitions USING GIN (execution);

CREATE INDEX IF NOT EXISTS idx_origin_audit_log_origin 
    ON origin_audit_log(origin_id, at DESC);

CREATE INDEX IF NOT EXISTS idx_origin_audit_log_action 
    ON origin_audit_log(action, at DESC);

CREATE INDEX IF NOT EXISTS idx_origin_audit_log_trace 
    ON origin_audit_log(trace_id) 
    WHERE trace_id IS NOT NULL;

-- ============================================================================
-- COMENTARIOS
-- ============================================================================

COMMENT ON TABLE origin_definitions IS 'Sistema canónico ORIGIN CONTRACT v1: Definiciones de orígenes de trabajo';

COMMENT ON TABLE origin_audit_log IS 'Sistema canónico ORIGIN CONTRACT v1: Log de auditoría append-only';

-- ============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================================

DO $$
DECLARE
    invalid_status_count INTEGER;
    invalid_origin_key_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO invalid_status_count
    FROM origin_definitions
    WHERE status NOT IN ('draft', 'active', 'archived');
    
    IF invalid_status_count > 0 THEN
        RAISE EXCEPTION 'Migración fallida: % definiciones tienen status inválido', invalid_status_count;
    END IF;
    
    SELECT COUNT(*) INTO invalid_origin_key_count
    FROM origin_definitions
    WHERE LENGTH(TRIM(origin_key)) = 0;
    
    IF invalid_origin_key_count > 0 THEN
        RAISE EXCEPTION 'Migración fallida: % definiciones tienen origin_key vacío', invalid_origin_key_count;
    END IF;
    
    RAISE NOTICE 'Migración v5.53.1 completada: ORIGIN CONTRACT v1 creado exitosamente';
END
$$;
