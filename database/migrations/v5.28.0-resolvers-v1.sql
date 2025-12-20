-- ============================================================================
-- Migración v5.28.0: Resolver v1 - Sistema de Resolución Determinista de Packages
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Crea tablas canónicas para Resolver v1 que toma PackageDefinition
--              + contextos efectivos + mappings y devuelve ResolvedPackage listo
--              para ser consumido por Widgets/Recorridos.
--
-- TABLAS:
-- 1. pde_resolvers - Definiciones de resolvers (draft/published/archived)
-- 2. pde_resolver_audit_log - Log append-only de cambios (auditoría)
-- ============================================================================

-- ============================================================================
-- TABLA: pde_resolvers
-- ============================================================================
-- Almacena definiciones de resolvers con su política de resolución v1
CREATE TABLE IF NOT EXISTS pde_resolvers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resolver_key TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    definition JSONB NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')) DEFAULT 'draft',
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

-- Índices para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_pde_resolvers_resolver_key ON pde_resolvers(resolver_key);
CREATE INDEX IF NOT EXISTS idx_pde_resolvers_status ON pde_resolvers(status);
CREATE INDEX IF NOT EXISTS idx_pde_resolvers_deleted_at ON pde_resolvers(deleted_at);
CREATE INDEX IF NOT EXISTS idx_pde_resolvers_definition_gin ON pde_resolvers USING GIN (definition);

-- Comentarios
COMMENT ON TABLE pde_resolvers IS 'Definiciones de Resolver v1 (motor determinista de resolución de packages)';
COMMENT ON COLUMN pde_resolvers.resolver_key IS 'Clave semántica única del resolver (ej: limpieza-rapida-v1)';
COMMENT ON COLUMN pde_resolvers.definition IS 'ResolverDefinition v1 completo (JSONB con policy, meta, etc.)';
COMMENT ON COLUMN pde_resolvers.status IS 'Estado: draft (editable), published (bloqueado, requiere duplicate), archived (oculto)';
COMMENT ON COLUMN pde_resolvers.version IS 'Versión del resolver (incrementa en duplicate)';
COMMENT ON COLUMN pde_resolvers.deleted_at IS 'Soft delete: NULL = activo, TIMESTAMP = borrado';

-- ============================================================================
-- TABLA: pde_resolver_audit_log
-- ============================================================================
-- Log append-only de todas las acciones sobre resolvers (auditoría completa)
CREATE TABLE IF NOT EXISTS pde_resolver_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resolver_id UUID NOT NULL REFERENCES pde_resolvers(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('create', 'update', 'publish', 'archive', 'delete', 'restore', 'duplicate')),
    actor TEXT NOT NULL DEFAULT 'admin',
    before JSONB NULL,
    after JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para auditoría
CREATE INDEX IF NOT EXISTS idx_pde_resolver_audit_log_resolver_id ON pde_resolver_audit_log(resolver_id);
CREATE INDEX IF NOT EXISTS idx_pde_resolver_audit_log_created_at ON pde_resolver_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_pde_resolver_audit_log_action ON pde_resolver_audit_log(action);

-- Comentarios
COMMENT ON TABLE pde_resolver_audit_log IS 'Log append-only de auditoría de cambios en resolvers';
COMMENT ON COLUMN pde_resolver_audit_log.before IS 'Estado anterior (snapshot completo antes del cambio)';
COMMENT ON COLUMN pde_resolver_audit_log.after IS 'Estado posterior (snapshot completo después del cambio)';
COMMENT ON COLUMN pde_resolver_audit_log.actor IS 'Quién realizó la acción (admin, system, etc.)';

-- ============================================================================
-- TRIGGER: Actualizar updated_at automáticamente
-- ============================================================================
CREATE OR REPLACE FUNCTION update_pde_resolvers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_pde_resolvers_updated_at
    BEFORE UPDATE ON pde_resolvers
    FOR EACH ROW
    EXECUTE FUNCTION update_pde_resolvers_updated_at();

-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================
-- Verificar que las tablas se crearon correctamente
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pde_resolvers') THEN
        RAISE EXCEPTION 'Error: tabla pde_resolvers no se creó correctamente';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pde_resolver_audit_log') THEN
        RAISE EXCEPTION 'Error: tabla pde_resolver_audit_log no se creó correctamente';
    END IF;
    
    RAISE NOTICE '✅ Migración v5.28.0-resolvers-v1 completada correctamente';
END $$;

