-- ============================================================================
-- Migración v5.21.0: Sistema de Widgets PDE (RECONSTRUCCIÓN COMPLETA)
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Tablas para gestionar widgets PDE con versionado completo,
--              audit logs y alineación con Widget Prompt Context v1
--
-- PRINCIPIOS:
-- 1. Versionado completo: draft / published
-- 2. Audit log append-only: todas las acciones registradas
-- 3. Widget Prompt Context v1: estructura canónica JSON
-- 4. Soft delete: deleted_at para mantener historial
-- 5. Fail-open absoluto: nunca bloquea por falta de datos
-- ============================================================================

-- ============================================================================
-- TABLA: pde_widgets
-- ============================================================================
-- Tabla principal que representa un "producto" widget
-- Un widget puede tener múltiples drafts y múltiples versiones publicadas

CREATE TABLE IF NOT EXISTS pde_widgets (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID único generado automáticamente
    
    widget_key TEXT UNIQUE NOT NULL,
    -- Clave única del widget (ej: "widget-practica-completada")
    -- Usado para referenciar el widget en código y APIs
    -- Validación: solo [a-z0-9_-]
    
    -- ========================================================================
    -- METADATOS
    -- ========================================================================
    name TEXT NOT NULL,
    -- Nombre legible del widget (ej: "Widget Práctica Completada")
    
    description TEXT,
    -- Descripción opcional del widget
    
    -- ========================================================================
    -- ESTADO GLOBAL
    -- ========================================================================
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'broken', 'archived')),
    -- Estado global del "producto": 
    -- - draft: Solo tiene drafts, nunca publicado
    -- - published: Tiene al menos una versión publicada activa
    -- - broken: Versiones publicadas pero con errores
    -- - archived: Widget archivado (no se usa)
    
    -- ========================================================================
    -- REFERENCIAS A DRAFT Y VERSIÓN ACTUAL
    -- ========================================================================
    current_draft_id UUID,
    -- UUID del draft actual (editable). NULL si no hay draft.
    
    current_published_version INT,
    -- Número de versión publicada más reciente. NULL si nunca se ha publicado.
    
    -- ========================================================================
    -- METADATOS TEMPORALES
    -- ========================================================================
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    -- Soft delete: si tiene valor, el widget está eliminado (pero se mantiene en BD)
    
    -- ========================================================================
    -- CONSTRAINTS
    -- ========================================================================
    CONSTRAINT pde_widgets_widget_key_unique UNIQUE (widget_key)
);

-- ============================================================================
-- TABLA: pde_widget_drafts
-- ============================================================================
-- Drafts editables de un widget
-- Un widget puede tener múltiples drafts históricos, pero solo uno "actual"

CREATE TABLE IF NOT EXISTS pde_widget_drafts (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    draft_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID único del draft
    
    widget_id UUID NOT NULL,
    -- FK a pde_widgets(id)
    
    -- ========================================================================
    -- DEFINICIÓN (Widget Prompt Context v1)
    -- ========================================================================
    prompt_context_json JSONB NOT NULL,
    -- Widget Prompt Context v1 (estructura canónica):
    -- {
    --   "widget_key": "string",
    --   "widget_name": "string",
    --   "description": "string",
    --   "inputs": [
    --     {
    --       "key": "string",
    --       "type": "enum | number | string | boolean",
    --       "values": [],
    --       "default": null,
    --       "required": boolean
    --     }
    --   ],
    --   "outputs": [
    --     {
    --       "key": "string",
    --       "type": "string | number | boolean | object"
    --     }
    --   ],
    --   "contract": {
    --     "description": "string",
    --     "rules": []
    --   }
    -- }
    
    code TEXT,
    -- Código del widget (generado por GPT o escrito manualmente)
    -- NULL si aún no se ha generado/pegado
    
    -- ========================================================================
    -- ESTADO DE VALIDACIÓN
    -- ========================================================================
    validation_status TEXT NOT NULL DEFAULT 'pending' CHECK (validation_status IN ('pending', 'valid', 'invalid', 'warning')),
    -- Estado de validación del draft:
    -- - pending: Aún no validado
    -- - valid: Validado correctamente
    -- - invalid: Tiene errores que impiden publicación
    -- - warning: Tiene advertencias pero puede publicarse
    
    validation_errors JSONB DEFAULT '[]'::jsonb,
    -- Array de errores de validación (si validation_status = 'invalid')
    
    validation_warnings JSONB DEFAULT '[]'::jsonb,
    -- Array de advertencias (si validation_status = 'warning')
    
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
    CONSTRAINT fk_pde_widget_drafts_widget 
        FOREIGN KEY (widget_id) 
        REFERENCES pde_widgets(id) 
        ON DELETE CASCADE
);

-- ============================================================================
-- TABLA: pde_widget_versions
-- ============================================================================
-- Versiones publicadas (inmutables) de un widget
-- Cada versión publicada es inmutable y puede usarse en runtime

CREATE TABLE IF NOT EXISTS pde_widget_versions (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID único de la versión
    
    widget_id UUID NOT NULL,
    -- FK a pde_widgets(id)
    
    version INT NOT NULL,
    -- Número de versión (1, 2, 3, ...) incrementado automáticamente
    
    -- ========================================================================
    -- DEFINICIÓN (Widget Prompt Context v1 - INMUTABLE)
    -- ========================================================================
    prompt_context_json JSONB NOT NULL,
    -- Widget Prompt Context v1 (snapshot al momento de publicación)
    
    code TEXT NOT NULL,
    -- Código del widget (snapshot al momento de publicación)
    
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
    CONSTRAINT fk_pde_widget_versions_widget 
        FOREIGN KEY (widget_id) 
        REFERENCES pde_widgets(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT pde_widget_versions_widget_version_unique 
        UNIQUE (widget_id, version)
);

-- ============================================================================
-- TABLA: pde_widget_audit_log
-- ============================================================================
-- Log de auditoría append-only para cambios en widgets

CREATE TABLE IF NOT EXISTS pde_widget_audit_log (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID único generado automáticamente
    
    widget_id UUID NOT NULL,
    -- Referencia al widget modificado
    
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
    -- Estado anterior del widget/draft/versión (null si es create)
    
    after JSONB,
    -- Estado nuevo del widget/draft/versión (null si es delete)
    
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

-- Índices para pde_widgets
CREATE INDEX IF NOT EXISTS idx_pde_widgets_widget_key ON pde_widgets(widget_key) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pde_widgets_status ON pde_widgets(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pde_widgets_current_draft_id ON pde_widgets(current_draft_id) WHERE current_draft_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pde_widgets_current_published_version ON pde_widgets(current_published_version) WHERE current_published_version IS NOT NULL;

-- Índices para pde_widget_drafts
CREATE INDEX IF NOT EXISTS idx_pde_widget_drafts_widget_id ON pde_widget_drafts(widget_id);
CREATE INDEX IF NOT EXISTS idx_pde_widget_drafts_validation_status ON pde_widget_drafts(validation_status);
CREATE INDEX IF NOT EXISTS idx_pde_widget_drafts_prompt_context_json_gin ON pde_widget_drafts USING GIN (prompt_context_json);

-- Índices para pde_widget_versions
CREATE INDEX IF NOT EXISTS idx_pde_widget_versions_widget_id ON pde_widget_versions(widget_id);
CREATE INDEX IF NOT EXISTS idx_pde_widget_versions_version ON pde_widget_versions(widget_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_pde_widget_versions_status ON pde_widget_versions(status) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_pde_widget_versions_prompt_context_json_gin ON pde_widget_versions USING GIN (prompt_context_json);

-- Índices para pde_widget_audit_log
CREATE INDEX IF NOT EXISTS idx_pde_widget_audit_log_widget_id ON pde_widget_audit_log(widget_id);
CREATE INDEX IF NOT EXISTS idx_pde_widget_audit_log_action ON pde_widget_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_pde_widget_audit_log_created_at ON pde_widget_audit_log(created_at DESC);

-- ============================================================================
-- COMENTARIOS
-- ============================================================================

COMMENT ON TABLE pde_widgets IS 'Widgets PDE con versionado completo y audit logs';
COMMENT ON COLUMN pde_widgets.widget_key IS 'Clave única del widget (slug, solo [a-z0-9_-])';
COMMENT ON COLUMN pde_widgets.current_draft_id IS 'UUID del draft actual (editable)';
COMMENT ON COLUMN pde_widgets.current_published_version IS 'Número de versión publicada más reciente';
COMMENT ON TABLE pde_widget_drafts IS 'Drafts editables de widgets con Widget Prompt Context v1';
COMMENT ON COLUMN pde_widget_drafts.prompt_context_json IS 'Widget Prompt Context v1 (estructura canónica JSON)';
COMMENT ON TABLE pde_widget_versions IS 'Versiones publicadas (inmutables) de widgets';
COMMENT ON COLUMN pde_widget_versions.prompt_context_json IS 'Widget Prompt Context v1 (snapshot al momento de publicación)';
COMMENT ON TABLE pde_widget_audit_log IS 'Log de auditoría append-only para cambios en widgets';

