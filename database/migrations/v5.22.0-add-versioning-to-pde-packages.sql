-- ============================================================================
-- Migración v5.22.0: Añadir Versionado Completo a Paquetes PDE
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Añade sistema de versionado (draft/published) y audit logs
--              a la estructura existente de paquetes PDE
--
-- PRINCIPIOS:
-- 1. Mantiene compatibilidad con datos existentes
-- 2. Añade versionado completo: draft / published
-- 3. Añade audit log append-only
-- 4. Alineación con Package Prompt Context v1
-- ============================================================================

-- ============================================================================
-- AÑADIR CAMPOS DE VERSIONADO A pde_packages
-- ============================================================================

-- Añadir campos de versionado (si no existen)
ALTER TABLE pde_packages 
    ADD COLUMN IF NOT EXISTS current_draft_id UUID,
    ADD COLUMN IF NOT EXISTS current_published_version INT,
    ADD COLUMN IF NOT EXISTS status_new TEXT CHECK (status_new IN ('draft', 'published', 'broken', 'archived'));

-- Actualizar status_new desde status existente
UPDATE pde_packages 
SET status_new = CASE 
    WHEN status = 'active' THEN 'published'
    WHEN status = 'inactive' THEN 'archived'
    ELSE 'draft'
END
WHERE status_new IS NULL;

-- Hacer que status_new sea NOT NULL después de poblarlo
ALTER TABLE pde_packages 
    ALTER COLUMN status_new SET DEFAULT 'draft',
    ALTER COLUMN status_new SET NOT NULL;

-- ============================================================================
-- TABLA: pde_package_drafts
-- ============================================================================
-- Drafts editables de un paquete

CREATE TABLE IF NOT EXISTS pde_package_drafts (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    draft_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID único del draft
    
    package_id UUID NOT NULL,
    -- FK a pde_packages(id)
    
    -- ========================================================================
    -- DEFINICIÓN (Package Prompt Context v1)
    -- ========================================================================
    prompt_context_json JSONB NOT NULL,
    -- Package Prompt Context v1 (estructura canónica):
    -- {
    --   "package_key": "string",
    --   "package_name": "string",
    --   "description": "string",
    --   "sources": [
    --     {
    --       "source_key": "string",
    --       "filter_by_nivel": boolean,
    --       "template_key": "string"
    --     }
    --   ],
    --   "context_contract": {
    --     "inputs": [...],
    --     "outputs": [...]
    --   },
    --   "context_rules": [...]
    -- }
    
    assembled_json JSONB,
    -- JSON ensamblado (generado por GPT o pegado manualmente)
    -- NULL si aún no se ha generado/pegado
    
    -- ========================================================================
    -- ESTADO DE VALIDACIÓN
    -- ========================================================================
    validation_status TEXT NOT NULL DEFAULT 'pending' CHECK (validation_status IN ('pending', 'valid', 'invalid', 'warning')),
    -- Estado de validación del draft
    
    validation_errors JSONB DEFAULT '[]'::jsonb,
    -- Array de errores de validación
    
    validation_warnings JSONB DEFAULT '[]'::jsonb,
    -- Array de advertencias
    
    -- ========================================================================
    -- METADATOS TEMPORALES
    -- ========================================================================
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- ========================================================================
    -- AUDITORÍA
    -- ========================================================================
    updated_by TEXT,
    -- ID/email del admin que creó/actualizó este draft
    
    -- ========================================================================
    -- CONSTRAINTS
    -- ========================================================================
    CONSTRAINT fk_pde_package_drafts_package 
        FOREIGN KEY (package_id) 
        REFERENCES pde_packages(id) 
        ON DELETE CASCADE
);

-- ============================================================================
-- TABLA: pde_package_versions
-- ============================================================================
-- Versiones publicadas (inmutables) de un paquete

CREATE TABLE IF NOT EXISTS pde_package_versions (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID único de la versión
    
    package_id UUID NOT NULL,
    -- FK a pde_packages(id)
    
    version INT NOT NULL,
    -- Número de versión (1, 2, 3, ...) incrementado automáticamente
    
    -- ========================================================================
    -- DEFINICIÓN (Package Prompt Context v1 - INMUTABLE)
    -- ========================================================================
    prompt_context_json JSONB NOT NULL,
    -- Package Prompt Context v1 (snapshot al momento de publicación)
    
    assembled_json JSONB NOT NULL,
    -- JSON ensamblado (snapshot al momento de publicación)
    
    definition JSONB NOT NULL,
    -- Definition canónica (compatibilidad con estructura existente)
    -- Se deriva de prompt_context_json y assembled_json
    
    -- ========================================================================
    -- METADATOS DE PUBLICACIÓN
    -- ========================================================================
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Fecha/hora de publicación (inmutable)
    
    published_by TEXT,
    -- ID/email del admin que publicó esta versión
    
    -- ========================================================================
    -- ESTADO
    -- ========================================================================
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'broken', 'deprecated')),
    -- Estado de la versión:
    -- - published: Activa y disponible para uso
    -- - broken: Rota (tiene errores críticos)
    -- - deprecated: Obsoleta (reemplazada por versión más reciente)
    
    -- ========================================================================
    -- CONSTRAINTS
    -- ========================================================================
    CONSTRAINT fk_pde_package_versions_package 
        FOREIGN KEY (package_id) 
        REFERENCES pde_packages(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT pde_package_versions_package_version_unique 
        UNIQUE (package_id, version)
);

-- ============================================================================
-- TABLA: pde_package_audit_log
-- ============================================================================
-- Log de auditoría append-only para cambios en paquetes

CREATE TABLE IF NOT EXISTS pde_package_audit_log (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID único generado automáticamente
    
    package_id UUID NOT NULL,
    -- Referencia al paquete modificado
    
    -- ========================================================================
    -- ACCIÓN
    -- ========================================================================
    action TEXT NOT NULL CHECK (action IN ('create', 'update', 'publish', 'unpublish', 'archive', 'restore', 'delete', 'validate')),
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
    -- Estado anterior del paquete/draft/versión (null si es create)
    
    after JSONB,
    -- Estado nuevo del paquete/draft/versión (null si es delete)
    
    -- ========================================================================
    -- METADATOS ADICIONALES
    -- ========================================================================
    metadata JSONB DEFAULT '{}'::jsonb,
    -- Metadatos adicionales de la acción (version_number, draft_id, etc.)
    
    -- ========================================================================
    -- METADATOS TEMPORALES
    -- ========================================================================
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- Fecha/hora de la acción
);

-- ============================================================================
-- ÍNDICES
-- ============================================================================

-- Índices para pde_package_drafts
CREATE INDEX IF NOT EXISTS idx_pde_package_drafts_package_id ON pde_package_drafts(package_id);
CREATE INDEX IF NOT EXISTS idx_pde_package_drafts_validation_status ON pde_package_drafts(validation_status);
CREATE INDEX IF NOT EXISTS idx_pde_package_drafts_prompt_context_json_gin ON pde_package_drafts USING GIN (prompt_context_json);

-- Índices para pde_package_versions
CREATE INDEX IF NOT EXISTS idx_pde_package_versions_package_id ON pde_package_versions(package_id);
CREATE INDEX IF NOT EXISTS idx_pde_package_versions_version ON pde_package_versions(package_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_pde_package_versions_status ON pde_package_versions(status) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_pde_package_versions_prompt_context_json_gin ON pde_package_versions USING GIN (prompt_context_json);
CREATE INDEX IF NOT EXISTS idx_pde_package_versions_definition_gin ON pde_package_versions USING GIN (definition);

-- Índices para pde_package_audit_log
CREATE INDEX IF NOT EXISTS idx_pde_package_audit_log_package_id ON pde_package_audit_log(package_id);
CREATE INDEX IF NOT EXISTS idx_pde_package_audit_log_action ON pde_package_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_pde_package_audit_log_created_at ON pde_package_audit_log(created_at DESC);

-- Índices adicionales para pde_packages (campos nuevos)
CREATE INDEX IF NOT EXISTS idx_pde_packages_current_draft_id ON pde_packages(current_draft_id) WHERE current_draft_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pde_packages_current_published_version ON pde_packages(current_published_version) WHERE current_published_version IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pde_packages_status_new ON pde_packages(status_new) WHERE deleted_at IS NULL;

-- ============================================================================
-- COMENTARIOS
-- ============================================================================

COMMENT ON TABLE pde_package_drafts IS 'Drafts editables de paquetes con Package Prompt Context v1';
COMMENT ON COLUMN pde_package_drafts.prompt_context_json IS 'Package Prompt Context v1 (estructura canónica JSON)';
COMMENT ON COLUMN pde_package_drafts.assembled_json IS 'JSON ensamblado (generado por GPT o pegado manualmente)';
COMMENT ON TABLE pde_package_versions IS 'Versiones publicadas (inmutables) de paquetes';
COMMENT ON COLUMN pde_package_versions.prompt_context_json IS 'Package Prompt Context v1 (snapshot al momento de publicación)';
COMMENT ON COLUMN pde_package_versions.assembled_json IS 'JSON ensamblado (snapshot al momento de publicación)';
COMMENT ON TABLE pde_package_audit_log IS 'Log de auditoría append-only para cambios en paquetes';


