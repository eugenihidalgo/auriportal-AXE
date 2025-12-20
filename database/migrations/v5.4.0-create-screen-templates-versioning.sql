-- ============================================================================
-- Migración v5.4.0: Sistema de Versionado de Screen Templates (DRAFT/PUBLISH)
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Tablas para gestionar screen templates con versionado (draft/publish)
--              y auditoría completa de cambios
--
-- PRINCIPIOS:
-- 1. DRAFT: Editable, puede tener errores, no se usa en runtime
-- 2. PUBLISH: Inmutable, validado, usado en runtime
-- 3. AUDITORÍA: Log completo de todas las acciones
-- 4. INMUTABILIDAD: Las versiones publicadas nunca cambian
-- ============================================================================

-- ============================================================================
-- TABLA: screen_templates
-- ============================================================================
-- Tabla principal que representa un "producto" screen template
-- Un template puede tener múltiples drafts y múltiples versiones publicadas

CREATE TABLE IF NOT EXISTS screen_templates (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id TEXT PRIMARY KEY,
    -- ID único del template (ej: "welcome-screen", "practice-complete")
    
    -- ========================================================================
    -- METADATOS
    -- ========================================================================
    name TEXT NOT NULL,
    -- Nombre legible del template (ej: "Pantalla de Bienvenida")
    
    status TEXT NOT NULL DEFAULT 'draft',
    -- Estado global del "producto": 'draft', 'published', 'deprecated', 'archived'
    -- - draft: Solo tiene drafts, nunca publicado
    -- - published: Tiene al menos una versión publicada activa
    -- - deprecated: Versiones publicadas pero marcadas como obsoletas
    -- - archived: Template archivado (no se usa)
    
    -- ========================================================================
    -- REFERENCIAS A DRAFT Y VERSIÓN ACTUAL
    -- ========================================================================
    current_draft_id UUID,
    -- UUID del draft actual (editable). NULL si no hay draft.
    -- Se actualiza cada vez que se crea/actualiza un draft.
    
    current_published_version INT,
    -- Número de versión publicada más reciente. NULL si nunca se ha publicado.
    -- Se actualiza cada vez que se publica una nueva versión.
    
    -- ========================================================================
    -- METADATOS TEMPORALES
    -- ========================================================================
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLA: screen_template_drafts
-- ============================================================================
-- Drafts editables de un screen template
-- Un template puede tener múltiples drafts históricos, pero solo uno "actual"

CREATE TABLE IF NOT EXISTS screen_template_drafts (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    draft_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID único del draft
    
    screen_template_id TEXT NOT NULL,
    -- FK a screen_templates(id)
    
    -- ========================================================================
    -- DEFINICIÓN
    -- ========================================================================
    definition_json JSONB NOT NULL,
    -- ScreenTemplateDefinition completa (validada o no, según estado)
    -- Puede tener errores si aún no está validado
    -- Estructura: { id, name, description?, template_type, schema, ui_contract?, meta? }
    
    -- ========================================================================
    -- METADATOS TEMPORALES
    -- ========================================================================
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- ========================================================================
    -- AUDITORÍA
    -- ========================================================================
    updated_by TEXT,
    -- ID/email del admin que creó/actualizó este draft (si está disponible en ctx)
    
    -- ========================================================================
    -- CONSTRAINTS
    -- ========================================================================
    CONSTRAINT fk_screen_template_drafts_template 
        FOREIGN KEY (screen_template_id) 
        REFERENCES screen_templates(id) 
        ON DELETE CASCADE
);

-- ============================================================================
-- TABLA: screen_template_versions
-- ============================================================================
-- Versiones publicadas e INMUTABLES de un screen template
-- Una vez publicada, una versión NUNCA puede cambiar

CREATE TABLE IF NOT EXISTS screen_template_versions (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    screen_template_id TEXT NOT NULL,
    -- FK a screen_templates(id)
    
    version INT NOT NULL,
    -- Número de versión (1, 2, 3, ...). Empieza en 1.
    
    -- ========================================================================
    -- ESTADO
    -- ========================================================================
    status TEXT NOT NULL DEFAULT 'published',
    -- Estado de la versión: 'published' (activa) o 'deprecated' (obsoleta)
    -- Las versiones deprecated no se usan en runtime, pero se mantienen para historial
    
    -- ========================================================================
    -- DEFINICIÓN (INMUTABLE)
    -- ========================================================================
    definition_json JSONB NOT NULL,
    -- ScreenTemplateDefinition completa en el momento de publicación
    -- Este campo NUNCA debe cambiar después de la publicación
    -- Estructura: { id, name, description?, template_type, schema, ui_contract?, meta? }
    
    -- ========================================================================
    -- METADATOS DE PUBLICACIÓN
    -- ========================================================================
    release_notes TEXT,
    -- Notas de la versión (opcional, para documentar cambios)
    
    -- ========================================================================
    -- METADATOS TEMPORALES
    -- ========================================================================
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- ========================================================================
    -- AUDITORÍA
    -- ========================================================================
    created_by TEXT,
    -- ID/email del admin que publicó esta versión (si está disponible en ctx)
    
    -- ========================================================================
    -- CONSTRAINTS
    -- ========================================================================
    PRIMARY KEY (screen_template_id, version),
    CONSTRAINT fk_screen_template_versions_template 
        FOREIGN KEY (screen_template_id) 
        REFERENCES screen_templates(id) 
        ON DELETE CASCADE,
    CONSTRAINT ck_screen_template_versions_status 
        CHECK (status IN ('published', 'deprecated')),
    CONSTRAINT ck_screen_template_versions_version 
        CHECK (version > 0)
);

-- ============================================================================
-- TABLA: screen_template_audit_log
-- ============================================================================
-- Log de auditoría de todas las acciones sobre screen templates
-- Append-only: nunca se modifica ni elimina

CREATE TABLE IF NOT EXISTS screen_template_audit_log (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- ========================================================================
    -- REFERENCIAS
    -- ========================================================================
    screen_template_id TEXT NOT NULL,
    -- ID del template afectado
    
    draft_id UUID,
    -- UUID del draft afectado (si aplica)
    
    -- ========================================================================
    -- ACCIÓN
    -- ========================================================================
    action TEXT NOT NULL,
    -- Tipo de acción:
    -- - 'create_template': Se creó un nuevo template
    -- - 'update_draft': Se actualizó un draft
    -- - 'validate_draft': Se validó un draft (puede tener errores/warnings)
    -- - 'publish_version': Se publicó una nueva versión
    -- - 'set_status': Se cambió el status global del template
    -- - 'import': Se importó un template desde bundle
    -- - 'export': Se exportó un template a bundle
    
    -- ========================================================================
    -- DETALLES
    -- ========================================================================
    details_json JSONB,
    -- Detalles de la acción (diff, patch, resumen, errores, warnings, etc.)
    -- Formato flexible según el tipo de acción
    -- Ejemplo para validate_draft: { valid: true, errors: [], warnings: [] }
    -- Ejemplo para publish_version: { version: 1, errors_count: 0, warnings_count: 2 }
    
    -- ========================================================================
    -- METADATOS TEMPORALES
    -- ========================================================================
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- ========================================================================
    -- AUDITORÍA
    -- ========================================================================
    created_by TEXT,
    -- ID/email del admin que realizó la acción (si está disponible en ctx)
    
    -- ========================================================================
    -- CONSTRAINTS
    -- ========================================================================
    CONSTRAINT ck_screen_template_audit_log_action 
        CHECK (action IN (
            'create_template',
            'update_draft',
            'validate_draft',
            'publish_version',
            'set_status',
            'import',
            'export'
        ))
);

-- ============================================================================
-- ÍNDICES PARA CONSULTAS RÁPIDAS
-- ============================================================================

-- screen_templates: Búsqueda por status
CREATE INDEX IF NOT EXISTS idx_screen_templates_status 
    ON screen_templates(status) 
    WHERE status IS NOT NULL;

-- screen_template_drafts: Búsqueda por screen_template_id
CREATE INDEX IF NOT EXISTS idx_screen_template_drafts_template_id 
    ON screen_template_drafts(screen_template_id);

-- screen_template_drafts: Índice GIN para búsquedas en definition_json
CREATE INDEX IF NOT EXISTS idx_screen_template_drafts_definition_gin 
    ON screen_template_drafts USING GIN (definition_json);

-- screen_template_versions: Búsqueda por screen_template_id y version
CREATE INDEX IF NOT EXISTS idx_screen_template_versions_template_version 
    ON screen_template_versions(screen_template_id, version DESC);

-- screen_template_versions: Búsqueda por status
CREATE INDEX IF NOT EXISTS idx_screen_template_versions_status 
    ON screen_template_versions(status) 
    WHERE status = 'published';

-- screen_template_audit_log: Búsqueda por screen_template_id
CREATE INDEX IF NOT EXISTS idx_screen_template_audit_log_template_id 
    ON screen_template_audit_log(screen_template_id);

-- screen_template_audit_log: Búsqueda por action
CREATE INDEX IF NOT EXISTS idx_screen_template_audit_log_action 
    ON screen_template_audit_log(action);

-- screen_template_audit_log: Búsqueda por created_at (para listar recientes)
CREATE INDEX IF NOT EXISTS idx_screen_template_audit_log_created_at 
    ON screen_template_audit_log(created_at DESC);

-- ============================================================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ============================================================================

COMMENT ON TABLE screen_templates IS 
'Tabla principal de screen templates. Representa un "producto" template con múltiples drafts y versiones.';

COMMENT ON COLUMN screen_templates.status IS 
'Estado global: draft (nunca publicado), published (tiene versión activa), deprecated (obsoleto), archived (archivado)';

COMMENT ON COLUMN screen_templates.current_draft_id IS 
'UUID del draft actual (editable). Se actualiza cada vez que se crea/actualiza un draft.';

COMMENT ON COLUMN screen_templates.current_published_version IS 
'Número de versión publicada más reciente. Se actualiza cada vez que se publica una nueva versión.';

COMMENT ON TABLE screen_template_drafts IS 
'Drafts editables de un screen template. Un template puede tener múltiples drafts históricos, pero solo uno "actual".';

COMMENT ON COLUMN screen_template_drafts.definition_json IS 
'ScreenTemplateDefinition completa. Puede tener errores si aún no está validado.';

COMMENT ON TABLE screen_template_versions IS 
'Versiones publicadas e INMUTABLES de un screen template. Una vez publicada, una versión NUNCA puede cambiar.';

COMMENT ON COLUMN screen_template_versions.definition_json IS 
'ScreenTemplateDefinition completa en el momento de publicación. Este campo NUNCA debe cambiar después de la publicación.';

COMMENT ON COLUMN screen_template_versions.status IS 
'Estado: published (activa, usada en runtime) o deprecated (obsoleta, solo historial).';

COMMENT ON TABLE screen_template_audit_log IS 
'Log de auditoría append-only de todas las acciones sobre screen templates. Nunca se modifica ni elimina.';

COMMENT ON COLUMN screen_template_audit_log.action IS 
'Tipo de acción: create_template, update_draft, validate_draft, publish_version, set_status, import, export';

-- ============================================================================
-- NOTAS DE USO
-- ============================================================================
-- 
-- FLUJO TÍPICO:
-- 
-- 1. CREAR TEMPLATE:
--    - INSERT en screen_templates (status='draft')
--    - INSERT en screen_template_drafts (definition_json mínimo)
--    - UPDATE screen_templates.current_draft_id
--    - INSERT en screen_template_audit_log (action='create_template')
-- 
-- 2. ACTUALIZAR DRAFT:
--    - UPDATE screen_template_drafts (definition_json, updated_at, updated_by)
--    - INSERT en screen_template_audit_log (action='update_draft')
-- 
-- 3. VALIDAR DRAFT:
--    - Llamar validateScreenTemplateDefinition(def, { isPublish: false })
--    - INSERT en screen_template_audit_log (action='validate_draft', details_json con errores/warnings)
-- 
-- 4. PUBLICAR VERSIÓN:
--    - Validar draft con isPublish:true (bloquear si invalid)
--    - Calcular next_version = latest_version + 1 (o 1 si no hay)
--    - INSERT en screen_template_versions (definition_json INMUTABLE)
--    - UPDATE screen_templates (current_published_version, status='published' si estaba 'draft')
--    - INSERT en screen_template_audit_log (action='publish_version')
-- 
-- 5. DEPRECAR VERSIÓN:
--    - UPDATE screen_template_versions (status='deprecated')
--    - INSERT en screen_template_audit_log (action='set_status')
-- 
-- IMPORTANTE:
-- - Las versiones publicadas NUNCA se modifican (inmutabilidad)
-- - Los drafts pueden tener errores (no bloquean edición)
-- - El publish SIEMPRE valida con isPublish:true (bloquea si hay errores)
-- 
-- ============================================================================





