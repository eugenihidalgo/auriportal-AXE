-- ============================================================================
-- Migración v5.1.0: Sistema de Versionado de Recorridos (DRAFT/PUBLISH)
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Tablas para gestionar recorridos con versionado (draft/publish)
--              y auditoría completa de cambios
--
-- PRINCIPIOS:
-- 1. DRAFT: Editable, puede tener errores, no se usa en runtime
-- 2. PUBLISH: Inmutable, validado, usado en runtime (Sprint 2B)
-- 3. AUDITORÍA: Log completo de todas las acciones
-- 4. INMUTABILIDAD: Las versiones publicadas nunca cambian
-- ============================================================================

-- ============================================================================
-- TABLA: recorridos
-- ============================================================================
-- Tabla principal que representa un "producto" recorrido
-- Un recorrido puede tener múltiples drafts y múltiples versiones publicadas

CREATE TABLE IF NOT EXISTS recorridos (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id TEXT PRIMARY KEY,
    -- ID único del recorrido (ej: "limpieza-diaria", "preparacion-practica")
    
    -- ========================================================================
    -- METADATOS
    -- ========================================================================
    name TEXT NOT NULL,
    -- Nombre legible del recorrido (ej: "Limpieza Diaria")
    
    status TEXT NOT NULL DEFAULT 'draft',
    -- Estado global del "producto": 'draft', 'published', 'deprecated', 'archived'
    -- - draft: Solo tiene drafts, nunca publicado
    -- - published: Tiene al menos una versión publicada activa
    -- - deprecated: Versiones publicadas pero marcadas como obsoletas
    -- - archived: Recorrido archivado (no se usa)
    
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
-- TABLA: recorrido_drafts
-- ============================================================================
-- Drafts editables de un recorrido
-- Un recorrido puede tener múltiples drafts históricos, pero solo uno "actual"

CREATE TABLE IF NOT EXISTS recorrido_drafts (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    draft_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID único del draft
    
    recorrido_id TEXT NOT NULL,
    -- FK a recorridos(id)
    
    -- ========================================================================
    -- DEFINICIÓN
    -- ========================================================================
    definition_json JSONB NOT NULL,
    -- RecorridoDefinition completa (validada o no, según estado)
    -- Puede tener errores si aún no está validado
    
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
    CONSTRAINT fk_recorrido_drafts_recorrido 
        FOREIGN KEY (recorrido_id) 
        REFERENCES recorridos(id) 
        ON DELETE CASCADE
);

-- ============================================================================
-- TABLA: recorrido_versions
-- ============================================================================
-- Versiones publicadas e INMUTABLES de un recorrido
-- Una vez publicada, una versión NUNCA puede cambiar

CREATE TABLE IF NOT EXISTS recorrido_versions (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    recorrido_id TEXT NOT NULL,
    -- FK a recorridos(id)
    
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
    -- RecorridoDefinition completa en el momento de publicación
    -- Este campo NUNCA debe cambiar después de la publicación
    
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
    PRIMARY KEY (recorrido_id, version),
    CONSTRAINT fk_recorrido_versions_recorrido 
        FOREIGN KEY (recorrido_id) 
        REFERENCES recorridos(id) 
        ON DELETE CASCADE,
    CONSTRAINT ck_recorrido_versions_status 
        CHECK (status IN ('published', 'deprecated')),
    CONSTRAINT ck_recorrido_versions_version 
        CHECK (version > 0)
);

-- ============================================================================
-- TABLA: recorrido_audit_log
-- ============================================================================
-- Log de auditoría de todas las acciones sobre recorridos
-- Append-only: nunca se modifica ni elimina

CREATE TABLE IF NOT EXISTS recorrido_audit_log (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- ========================================================================
    -- REFERENCIAS
    -- ========================================================================
    recorrido_id TEXT NOT NULL,
    -- ID del recorrido afectado
    
    draft_id UUID,
    -- UUID del draft afectado (si aplica)
    
    -- ========================================================================
    -- ACCIÓN
    -- ========================================================================
    action TEXT NOT NULL,
    -- Tipo de acción:
    -- - 'create_recorrido': Se creó un nuevo recorrido
    -- - 'update_draft': Se actualizó un draft
    -- - 'validate_draft': Se validó un draft (puede tener errores/warnings)
    -- - 'publish_version': Se publicó una nueva versión
    -- - 'set_status': Se cambió el status global del recorrido
    -- - 'import': Se importó un recorrido desde bundle
    -- - 'export': Se exportó un recorrido a bundle
    
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
    CONSTRAINT ck_recorrido_audit_log_action 
        CHECK (action IN (
            'create_recorrido',
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

-- recorridos: Búsqueda por status
CREATE INDEX IF NOT EXISTS idx_recorridos_status 
    ON recorridos(status) 
    WHERE status IS NOT NULL;

-- recorrido_drafts: Búsqueda por recorrido_id
CREATE INDEX IF NOT EXISTS idx_recorrido_drafts_recorrido_id 
    ON recorrido_drafts(recorrido_id);

-- recorrido_drafts: Índice GIN para búsquedas en definition_json
CREATE INDEX IF NOT EXISTS idx_recorrido_drafts_definition_gin 
    ON recorrido_drafts USING GIN (definition_json);

-- recorrido_versions: Búsqueda por recorrido_id y version
CREATE INDEX IF NOT EXISTS idx_recorrido_versions_recorrido_version 
    ON recorrido_versions(recorrido_id, version DESC);

-- recorrido_versions: Búsqueda por status
CREATE INDEX IF NOT EXISTS idx_recorrido_versions_status 
    ON recorrido_versions(status) 
    WHERE status = 'published';

-- recorrido_audit_log: Búsqueda por recorrido_id
CREATE INDEX IF NOT EXISTS idx_recorrido_audit_log_recorrido_id 
    ON recorrido_audit_log(recorrido_id);

-- recorrido_audit_log: Búsqueda por action
CREATE INDEX IF NOT EXISTS idx_recorrido_audit_log_action 
    ON recorrido_audit_log(action);

-- recorrido_audit_log: Búsqueda por created_at (para listar recientes)
CREATE INDEX IF NOT EXISTS idx_recorrido_audit_log_created_at 
    ON recorrido_audit_log(created_at DESC);

-- ============================================================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ============================================================================

COMMENT ON TABLE recorridos IS 
'Tabla principal de recorridos. Representa un "producto" recorrido con múltiples drafts y versiones.';

COMMENT ON COLUMN recorridos.status IS 
'Estado global: draft (nunca publicado), published (tiene versión activa), deprecated (obsoleto), archived (archivado)';

COMMENT ON COLUMN recorridos.current_draft_id IS 
'UUID del draft actual (editable). Se actualiza cada vez que se crea/actualiza un draft.';

COMMENT ON COLUMN recorridos.current_published_version IS 
'Número de versión publicada más reciente. Se actualiza cada vez que se publica una nueva versión.';

COMMENT ON TABLE recorrido_drafts IS 
'Drafts editables de un recorrido. Un recorrido puede tener múltiples drafts históricos, pero solo uno "actual".';

COMMENT ON COLUMN recorrido_drafts.definition_json IS 
'RecorridoDefinition completa. Puede tener errores si aún no está validado.';

COMMENT ON TABLE recorrido_versions IS 
'Versiones publicadas e INMUTABLES de un recorrido. Una vez publicada, una versión NUNCA puede cambiar.';

COMMENT ON COLUMN recorrido_versions.definition_json IS 
'RecorridoDefinition completa en el momento de publicación. Este campo NUNCA debe cambiar después de la publicación.';

COMMENT ON COLUMN recorrido_versions.status IS 
'Estado: published (activa, usada en runtime) o deprecated (obsoleta, solo historial).';

COMMENT ON TABLE recorrido_audit_log IS 
'Log de auditoría append-only de todas las acciones sobre recorridos. Nunca se modifica ni elimina.';

COMMENT ON COLUMN recorrido_audit_log.action IS 
'Tipo de acción: create_recorrido, update_draft, validate_draft, publish_version, set_status, import, export';

COMMENT ON COLUMN recorrido_audit_log.details_json IS 
'Detalles de la acción (diff, patch, resumen, errores, warnings, etc.). Formato flexible según el tipo de acción.';

-- ============================================================================
-- NOTAS DE USO
-- ============================================================================
-- 
-- FLUJO TÍPICO:
-- 
-- 1. CREAR RECORRIDO:
--    - INSERT en recorridos (status='draft')
--    - INSERT en recorrido_drafts (definition_json mínimo)
--    - UPDATE recorridos.current_draft_id
--    - INSERT en recorrido_audit_log (action='create_recorrido')
-- 
-- 2. ACTUALIZAR DRAFT:
--    - UPDATE recorrido_drafts (definition_json, updated_at, updated_by)
--    - INSERT en recorrido_audit_log (action='update_draft')
-- 
-- 3. VALIDAR DRAFT:
--    - Llamar validateRecorridoDefinition(def, { isPublish: false })
--    - INSERT en recorrido_audit_log (action='validate_draft', details_json con errores/warnings)
-- 
-- 4. PUBLICAR VERSIÓN:
--    - Validar draft con isPublish:true (bloquear si invalid)
--    - Calcular next_version = latest_version + 1 (o 1 si no hay)
--    - INSERT en recorrido_versions (definition_json INMUTABLE)
--    - UPDATE recorridos (current_published_version, status='published' si estaba 'draft')
--    - INSERT en recorrido_audit_log (action='publish_version')
-- 
-- 5. DEPRECAR VERSIÓN:
--    - UPDATE recorrido_versions (status='deprecated')
--    - INSERT en recorrido_audit_log (action='set_status')
-- 
-- IMPORTANTE:
-- - Las versiones publicadas NUNCA se modifican (inmutabilidad)
-- - Los drafts pueden tener errores (no bloquean edición)
-- - El publish SIEMPRE valida con isPublish:true (bloquea si hay errores)
-- 
-- ============================================================================




