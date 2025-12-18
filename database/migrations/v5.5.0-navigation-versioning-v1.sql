-- ============================================================================
-- Migración v5.5.0: Sistema de Versionado de Navegación (DRAFT/PUBLISH)
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Tablas para gestionar definiciones de navegación con versionado 
--              (draft/publish) y auditoría completa de cambios
--
-- PRINCIPIOS (mismo paradigma que Recorridos versionados):
-- 1. DRAFT: Editable, puede tener errores, no se usa en runtime
-- 2. PUBLISH: Inmutable, validado, usado en runtime
-- 3. AUDITORÍA: Log completo de todas las acciones (append-only)
-- 4. INMUTABILIDAD: Las versiones publicadas nunca cambian
-- 5. CHECKSUM: Hash determinista para detectar cambios
-- ============================================================================

-- ============================================================================
-- TABLA: navigation_definitions
-- ============================================================================
-- Tabla principal que representa un "producto" de navegación
-- Una navegación puede tener múltiples drafts y múltiples versiones publicadas

CREATE TABLE IF NOT EXISTS navigation_definitions (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID único generado automáticamente
    
    navigation_id TEXT UNIQUE NOT NULL,
    -- ID semántico único de la navegación (ej: "main-sidebar", "admin-menu")
    -- Este es el identificador que se usa en el código y APIs
    
    -- ========================================================================
    -- METADATOS
    -- ========================================================================
    name TEXT,
    -- Nombre legible de la navegación (ej: "Menú Principal", "Sidebar Admin")
    
    description TEXT,
    -- Descripción opcional de la navegación
    
    -- ========================================================================
    -- CONTROL DE ESTADO
    -- ========================================================================
    activo BOOLEAN NOT NULL DEFAULT true,
    -- Si la navegación está activa (soft delete = false)
    
    -- ========================================================================
    -- METADATOS TEMPORALES
    -- ========================================================================
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
    -- deleted_at se usa para soft delete (si activo=false, deleted_at indica cuándo)
);

-- ============================================================================
-- TABLA: navigation_drafts
-- ============================================================================
-- Drafts editables de una navegación
-- Una navegación tiene UN draft activo a la vez (el más reciente)

CREATE TABLE IF NOT EXISTS navigation_drafts (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID único del draft
    
    navigation_id TEXT NOT NULL,
    -- FK a navigation_definitions(navigation_id)
    
    -- ========================================================================
    -- DEFINICIÓN
    -- ========================================================================
    draft_json JSONB NOT NULL,
    -- NavigationDefinition completa (validada o no, según estado)
    -- Puede tener warnings si aún no está validado para publish
    
    -- ========================================================================
    -- METADATOS TEMPORALES
    -- ========================================================================
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- ========================================================================
    -- AUDITORÍA
    -- ========================================================================
    created_by TEXT,
    -- ID/email del admin que creó este draft
    
    updated_by TEXT,
    -- ID/email del admin que actualizó este draft
    
    -- ========================================================================
    -- CONSTRAINTS
    -- ========================================================================
    CONSTRAINT fk_navigation_drafts_navigation 
        FOREIGN KEY (navigation_id) 
        REFERENCES navigation_definitions(navigation_id) 
        ON DELETE CASCADE
);

-- ============================================================================
-- TABLA: navigation_versions
-- ============================================================================
-- Versiones publicadas e INMUTABLES de una navegación
-- Una vez publicada, una versión NUNCA puede cambiar

CREATE TABLE IF NOT EXISTS navigation_versions (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID único de la versión
    
    navigation_id TEXT NOT NULL,
    -- FK a navigation_definitions(navigation_id)
    
    version INT NOT NULL,
    -- Número de versión (1, 2, 3, ...). Empieza en 1.
    
    -- ========================================================================
    -- ESTADO
    -- ========================================================================
    status TEXT NOT NULL DEFAULT 'published',
    -- Estado de la versión: 'published' (activa) o 'archived' (obsoleta)
    -- Las versiones archived no se usan en runtime, pero se mantienen para historial
    
    -- ========================================================================
    -- DEFINICIÓN (INMUTABLE)
    -- ========================================================================
    definition_json JSONB NOT NULL,
    -- NavigationDefinition completa en el momento de publicación
    -- Este campo NUNCA debe cambiar después de la publicación
    
    checksum TEXT NOT NULL,
    -- Hash SHA256 del JSON canonicalizado
    -- Permite detectar si la definición ha cambiado (integridad)
    
    -- ========================================================================
    -- METADATOS DE PUBLICACIÓN
    -- ========================================================================
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Fecha de publicación
    
    published_by TEXT,
    -- ID/email del admin que publicó esta versión
    
    -- ========================================================================
    -- CONSTRAINTS
    -- ========================================================================
    CONSTRAINT uq_navigation_versions_navigation_version 
        UNIQUE (navigation_id, version),
    CONSTRAINT fk_navigation_versions_navigation 
        FOREIGN KEY (navigation_id) 
        REFERENCES navigation_definitions(navigation_id) 
        ON DELETE CASCADE,
    CONSTRAINT ck_navigation_versions_status 
        CHECK (status IN ('published', 'archived')),
    CONSTRAINT ck_navigation_versions_version 
        CHECK (version > 0)
);

-- ============================================================================
-- TABLA: navigation_audit_log
-- ============================================================================
-- Log de auditoría de todas las acciones sobre navegaciones
-- Append-only: nunca se modifica ni elimina

CREATE TABLE IF NOT EXISTS navigation_audit_log (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- ========================================================================
    -- REFERENCIAS
    -- ========================================================================
    navigation_id TEXT NOT NULL,
    -- ID de la navegación afectada
    
    -- ========================================================================
    -- ACCIÓN
    -- ========================================================================
    action TEXT NOT NULL,
    -- Tipo de acción:
    -- - 'create_draft': Se creó un nuevo draft
    -- - 'update_draft': Se actualizó un draft
    -- - 'validate': Se validó un draft (puede tener errores/warnings)
    -- - 'publish': Se publicó una nueva versión
    -- - 'archive': Se archivó una versión
    -- - 'import': Se importó una navegación desde JSON
    -- - 'export': Se exportó una navegación a JSON
    
    -- ========================================================================
    -- DETALLES
    -- ========================================================================
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Detalles de la acción (diff, resumen, errores, warnings, etc.)
    -- Formato flexible según el tipo de acción
    -- Ejemplo para validate: { valid: true, errors: [], warnings: [] }
    -- Ejemplo para publish: { version: 1, checksum: "abc123" }
    
    -- ========================================================================
    -- METADATOS TEMPORALES
    -- ========================================================================
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- ========================================================================
    -- AUDITORÍA
    -- ========================================================================
    actor TEXT,
    -- ID/email del admin que realizó la acción
    
    -- ========================================================================
    -- CONSTRAINTS
    -- ========================================================================
    CONSTRAINT ck_navigation_audit_log_action 
        CHECK (action IN (
            'create_draft',
            'update_draft',
            'validate',
            'publish',
            'archive',
            'import',
            'export'
        ))
);

-- ============================================================================
-- TRIGGER: updated_at automático para navigation_definitions
-- ============================================================================
CREATE OR REPLACE FUNCTION trigger_set_navigation_definitions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_navigation_definitions_updated_at ON navigation_definitions;
CREATE TRIGGER set_navigation_definitions_updated_at
    BEFORE UPDATE ON navigation_definitions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_navigation_definitions_updated_at();

-- ============================================================================
-- TRIGGER: updated_at automático para navigation_drafts
-- ============================================================================
CREATE OR REPLACE FUNCTION trigger_set_navigation_drafts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_navigation_drafts_updated_at ON navigation_drafts;
CREATE TRIGGER set_navigation_drafts_updated_at
    BEFORE UPDATE ON navigation_drafts
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_navigation_drafts_updated_at();

-- ============================================================================
-- ÍNDICES PARA CONSULTAS RÁPIDAS
-- ============================================================================

-- navigation_definitions: Búsqueda por navigation_id (ya es UNIQUE, pero añadimos índice explícito)
CREATE INDEX IF NOT EXISTS idx_navigation_definitions_navigation_id 
    ON navigation_definitions(navigation_id);

-- navigation_definitions: Búsqueda por activo
CREATE INDEX IF NOT EXISTS idx_navigation_definitions_activo 
    ON navigation_definitions(activo) 
    WHERE activo = true;

-- navigation_drafts: Búsqueda por navigation_id
CREATE INDEX IF NOT EXISTS idx_navigation_drafts_navigation_id 
    ON navigation_drafts(navigation_id);

-- navigation_drafts: Índice GIN para búsquedas en draft_json
CREATE INDEX IF NOT EXISTS idx_navigation_drafts_draft_gin 
    ON navigation_drafts USING GIN (draft_json);

-- navigation_versions: Búsqueda por navigation_id y version
CREATE INDEX IF NOT EXISTS idx_navigation_versions_navigation_version 
    ON navigation_versions(navigation_id, version DESC);

-- navigation_versions: Búsqueda por status
CREATE INDEX IF NOT EXISTS idx_navigation_versions_status 
    ON navigation_versions(status) 
    WHERE status = 'published';

-- navigation_audit_log: Búsqueda por navigation_id
CREATE INDEX IF NOT EXISTS idx_navigation_audit_log_navigation_id 
    ON navigation_audit_log(navigation_id);

-- navigation_audit_log: Búsqueda por action
CREATE INDEX IF NOT EXISTS idx_navigation_audit_log_action 
    ON navigation_audit_log(action);

-- navigation_audit_log: Búsqueda por created_at (para listar recientes)
CREATE INDEX IF NOT EXISTS idx_navigation_audit_log_created_at 
    ON navigation_audit_log(created_at DESC);

-- ============================================================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ============================================================================

COMMENT ON TABLE navigation_definitions IS 
'Tabla principal de navegaciones. Representa una navegación con múltiples drafts y versiones.';

COMMENT ON COLUMN navigation_definitions.navigation_id IS 
'ID semántico único (ej: main-sidebar, admin-menu). Se usa en código y APIs.';

COMMENT ON COLUMN navigation_definitions.activo IS 
'Control de soft delete. Si false, la navegación está "eliminada" pero sus datos persisten.';

COMMENT ON TABLE navigation_drafts IS 
'Drafts editables de una navegación. Solo uno activo a la vez (el más reciente).';

COMMENT ON COLUMN navigation_drafts.draft_json IS 
'NavigationDefinition completa. Puede tener warnings si no está validado para publish.';

COMMENT ON TABLE navigation_versions IS 
'Versiones publicadas e INMUTABLES de una navegación. Una vez publicada, NUNCA cambia.';

COMMENT ON COLUMN navigation_versions.definition_json IS 
'NavigationDefinition completa en el momento de publicación. Este campo NUNCA debe cambiar.';

COMMENT ON COLUMN navigation_versions.checksum IS 
'Hash SHA256 del JSON canonicalizado. Permite verificar integridad.';

COMMENT ON COLUMN navigation_versions.status IS 
'Estado: published (activa, usada en runtime) o archived (obsoleta, solo historial).';

COMMENT ON TABLE navigation_audit_log IS 
'Log de auditoría append-only de todas las acciones sobre navegaciones. Nunca se modifica.';

COMMENT ON COLUMN navigation_audit_log.action IS 
'Tipo: create_draft, update_draft, validate, publish, archive, import, export';

COMMENT ON COLUMN navigation_audit_log.payload IS 
'Detalles de la acción (JSON flexible según tipo). Incluye errores, warnings, versión, etc.';

-- ============================================================================
-- NOTAS DE USO
-- ============================================================================
-- 
-- FLUJO TÍPICO:
-- 
-- 1. CREAR NAVEGACIÓN:
--    - INSERT en navigation_definitions (activo=true)
--    - INSERT en navigation_drafts (draft_json con definición inicial)
--    - INSERT en navigation_audit_log (action='create_draft')
-- 
-- 2. ACTUALIZAR DRAFT:
--    - UPDATE navigation_drafts (draft_json, updated_at, updated_by)
--    - INSERT en navigation_audit_log (action='update_draft')
-- 
-- 3. VALIDAR DRAFT:
--    - Llamar validateNavigationDraft(def)
--    - INSERT en navigation_audit_log (action='validate', payload con errores/warnings)
-- 
-- 4. PUBLICAR VERSIÓN:
--    - Validar draft con modo publish (estricto)
--    - Calcular next_version = max(version)+1 (o 1 si no hay)
--    - Calcular checksum del JSON canonicalizado
--    - INSERT en navigation_versions (definition_json INMUTABLE)
--    - INSERT en navigation_audit_log (action='publish')
-- 
-- 5. ARCHIVAR VERSIÓN:
--    - UPDATE navigation_versions (status='archived')
--    - INSERT en navigation_audit_log (action='archive')
-- 
-- IMPORTANTE:
-- - Las versiones publicadas NUNCA se modifican (inmutabilidad)
-- - Los drafts pueden tener warnings (no bloquean edición)
-- - El publish SIEMPRE valida con modo estricto (bloquea si hay errores)
-- - El checksum permite verificar integridad de las versiones
-- 
-- ============================================================================





