-- ============================================================================
-- Migración v5.2.0: Sistema de Versionado de Temas (DRAFT/PUBLISH)
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Tablas para gestionar temas con versionado (draft/publish)
--              y auditoría completa de cambios
--
-- PRINCIPIOS:
-- 1. DRAFT: Editable, puede tener errores, no se usa en runtime
-- 2. PUBLISH: Inmutable, validado, usado en runtime
-- 3. AUDITORÍA: Log completo de todas las acciones
-- 4. INMUTABILIDAD: Las versiones publicadas nunca cambian
-- ============================================================================

-- ============================================================================
-- TABLA: themes
-- ============================================================================
-- Tabla principal que representa un "producto" tema
-- Un tema puede tener múltiples drafts y múltiples versiones publicadas

CREATE TABLE IF NOT EXISTS themes (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id TEXT PRIMARY KEY,
    -- ID único del tema (ej: "dark-classic", "light-classic", "custom-theme-1")
    
    -- ========================================================================
    -- METADATOS
    -- ========================================================================
    name TEXT NOT NULL,
    -- Nombre legible del tema (ej: "Dark Classic", "Light Classic")
    
    status TEXT NOT NULL DEFAULT 'draft',
    -- Estado global del "producto": 'draft', 'published', 'deprecated', 'archived'
    -- - draft: Solo tiene drafts, nunca publicado
    -- - published: Tiene al menos una versión publicada activa
    -- - deprecated: Versiones publicadas pero marcadas como obsoletas
    -- - archived: Tema archivado (no se usa)
    
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
-- TABLA: theme_drafts
-- ============================================================================
-- Drafts editables de un tema
-- Un tema puede tener múltiples drafts históricos, pero solo uno "actual"

CREATE TABLE IF NOT EXISTS theme_drafts (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    draft_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID único del draft
    
    theme_id TEXT NOT NULL,
    -- FK a themes(id)
    
    -- ========================================================================
    -- DEFINICIÓN
    -- ========================================================================
    definition_json JSONB NOT NULL,
    -- ThemeDefinition completa (validada o no, según estado)
    -- Puede tener errores si aún no está validado
    -- Estructura: { id, name, description?, tokens, meta? }
    
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
    CONSTRAINT fk_theme_drafts_theme 
        FOREIGN KEY (theme_id) 
        REFERENCES themes(id) 
        ON DELETE CASCADE
);

-- ============================================================================
-- TABLA: theme_versions
-- ============================================================================
-- Versiones publicadas e INMUTABLES de un tema
-- Una vez publicada, una versión NUNCA puede cambiar

CREATE TABLE IF NOT EXISTS theme_versions (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    theme_id TEXT NOT NULL,
    -- FK a themes(id)
    
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
    -- ThemeDefinition completa en el momento de publicación
    -- Este campo NUNCA debe cambiar después de la publicación
    -- Estructura: { id, name, description?, tokens, meta? }
    
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
    PRIMARY KEY (theme_id, version),
    CONSTRAINT fk_theme_versions_theme 
        FOREIGN KEY (theme_id) 
        REFERENCES themes(id) 
        ON DELETE CASCADE,
    CONSTRAINT ck_theme_versions_status 
        CHECK (status IN ('published', 'deprecated')),
    CONSTRAINT ck_theme_versions_version 
        CHECK (version > 0)
);

-- ============================================================================
-- TABLA: theme_audit_log
-- ============================================================================
-- Log de auditoría de todas las acciones sobre temas
-- Append-only: nunca se modifica ni elimina

CREATE TABLE IF NOT EXISTS theme_audit_log (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- ========================================================================
    -- REFERENCIAS
    -- ========================================================================
    theme_id TEXT NOT NULL,
    -- ID del tema afectado
    
    draft_id UUID,
    -- UUID del draft afectado (si aplica)
    
    -- ========================================================================
    -- ACCIÓN
    -- ========================================================================
    action TEXT NOT NULL,
    -- Tipo de acción:
    -- - 'create_theme': Se creó un nuevo tema
    -- - 'update_draft': Se actualizó un draft
    -- - 'validate_draft': Se validó un draft (puede tener errores/warnings)
    -- - 'publish_version': Se publicó una nueva versión
    -- - 'set_status': Se cambió el status global del tema
    -- - 'import': Se importó un tema desde bundle
    -- - 'export': Se exportó un tema a bundle
    
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
    CONSTRAINT ck_theme_audit_log_action 
        CHECK (action IN (
            'create_theme',
            'update_draft',
            'validate_draft',
            'publish_version',
            'set_status',
            'import',
            'export'
        ))
);

-- ============================================================================
-- TABLA: theme_rules (PREPARACIÓN FUTURA)
-- ============================================================================
-- Estructura para reglas de aplicación automática de temas
-- NO se implementa lógica todavía, solo estructura

CREATE TABLE IF NOT EXISTS theme_rules (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    theme_id TEXT NOT NULL,
    -- FK a themes(id) - tema que se aplicará cuando se cumpla la regla
    
    -- ========================================================================
    -- REGLA
    -- ========================================================================
    rule_type TEXT NOT NULL,
    -- Tipo de regla: 'date', 'event', 'student_state', 'custom'
    -- NO se implementa lógica todavía
    
    rule_config JSONB NOT NULL,
    -- Configuración de la regla (formato flexible según rule_type)
    -- Ejemplo para date: { start_date: '2025-01-01', end_date: '2025-12-31' }
    -- Ejemplo para event: { event_name: 'navidad', active: true }
    -- Ejemplo para student_state: { nivel_min: 5, nivel_max: 10 }
    
    -- ========================================================================
    -- PRIORIDAD
    -- ========================================================================
    priority INT NOT NULL DEFAULT 100,
    -- Prioridad de la regla (menor = mayor prioridad)
    -- Si múltiples reglas coinciden, se usa la de menor prioridad
    
    -- ========================================================================
    -- ESTADO
    -- ========================================================================
    active BOOLEAN NOT NULL DEFAULT true,
    -- Si la regla está activa (NO se usa todavía)
    
    -- ========================================================================
    -- METADATOS TEMPORALES
    -- ========================================================================
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- ========================================================================
    -- AUDITORÍA
    -- ========================================================================
    created_by TEXT,
    
    -- ========================================================================
    -- CONSTRAINTS
    -- ========================================================================
    CONSTRAINT fk_theme_rules_theme 
        FOREIGN KEY (theme_id) 
        REFERENCES themes(id) 
        ON DELETE CASCADE,
    CONSTRAINT ck_theme_rules_rule_type 
        CHECK (rule_type IN ('date', 'event', 'student_state', 'custom'))
);

-- ============================================================================
-- ÍNDICES PARA CONSULTAS RÁPIDAS
-- ============================================================================

-- themes: Búsqueda por status
CREATE INDEX IF NOT EXISTS idx_themes_status 
    ON themes(status) 
    WHERE status IS NOT NULL;

-- theme_drafts: Búsqueda por theme_id
CREATE INDEX IF NOT EXISTS idx_theme_drafts_theme_id 
    ON theme_drafts(theme_id);

-- theme_drafts: Índice GIN para búsquedas en definition_json
CREATE INDEX IF NOT EXISTS idx_theme_drafts_definition_gin 
    ON theme_drafts USING GIN (definition_json);

-- theme_versions: Búsqueda por theme_id y version
CREATE INDEX IF NOT EXISTS idx_theme_versions_theme_version 
    ON theme_versions(theme_id, version DESC);

-- theme_versions: Búsqueda por status
CREATE INDEX IF NOT EXISTS idx_theme_versions_status 
    ON theme_versions(status) 
    WHERE status = 'published';

-- theme_audit_log: Búsqueda por theme_id
CREATE INDEX IF NOT EXISTS idx_theme_audit_log_theme_id 
    ON theme_audit_log(theme_id);

-- theme_audit_log: Búsqueda por action
CREATE INDEX IF NOT EXISTS idx_theme_audit_log_action 
    ON theme_audit_log(action);

-- theme_audit_log: Búsqueda por created_at (para listar recientes)
CREATE INDEX IF NOT EXISTS idx_theme_audit_log_created_at 
    ON theme_audit_log(created_at DESC);

-- theme_rules: Búsqueda por theme_id
CREATE INDEX IF NOT EXISTS idx_theme_rules_theme_id 
    ON theme_rules(theme_id);

-- theme_rules: Búsqueda por active
CREATE INDEX IF NOT EXISTS idx_theme_rules_active 
    ON theme_rules(active) 
    WHERE active = true;

-- ============================================================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ============================================================================

COMMENT ON TABLE themes IS 
'Tabla principal de temas. Representa un "producto" tema con múltiples drafts y versiones.';

COMMENT ON COLUMN themes.status IS 
'Estado global: draft (nunca publicado), published (tiene versión activa), deprecated (obsoleto), archived (archivado)';

COMMENT ON COLUMN themes.current_draft_id IS 
'UUID del draft actual (editable). Se actualiza cada vez que se crea/actualiza un draft.';

COMMENT ON COLUMN themes.current_published_version IS 
'Número de versión publicada más reciente. Se actualiza cada vez que se publica una nueva versión.';

COMMENT ON TABLE theme_drafts IS 
'Drafts editables de un tema. Un tema puede tener múltiples drafts históricos, pero solo uno "actual".';

COMMENT ON COLUMN theme_drafts.definition_json IS 
'ThemeDefinition completa. Puede tener errores si aún no está validado.';

COMMENT ON TABLE theme_versions IS 
'Versiones publicadas e INMUTABLES de un tema. Una vez publicada, una versión NUNCA puede cambiar.';

COMMENT ON COLUMN theme_versions.definition_json IS 
'ThemeDefinition completa en el momento de publicación. Este campo NUNCA debe cambiar después de la publicación.';

COMMENT ON COLUMN theme_versions.status IS 
'Estado: published (activa, usada en runtime) o deprecated (obsoleta, solo historial).';

COMMENT ON TABLE theme_audit_log IS 
'Log de auditoría append-only de todas las acciones sobre temas. Nunca se modifica ni elimina.';

COMMENT ON COLUMN theme_audit_log.action IS 
'Tipo de acción: create_theme, update_draft, validate_draft, publish_version, set_status, import, export';

COMMENT ON TABLE theme_rules IS 
'Reglas de aplicación automática de temas (PREPARACIÓN FUTURA - NO se implementa lógica todavía).';

COMMENT ON COLUMN theme_rules.rule_type IS 
'Tipo de regla: date (por fecha), event (por evento), student_state (por estado del alumno), custom (personalizada)';

-- ============================================================================
-- NOTAS DE USO
-- ============================================================================
-- 
-- FLUJO TÍPICO:
-- 
-- 1. CREAR TEMA:
--    - INSERT en themes (status='draft')
--    - INSERT en theme_drafts (definition_json mínimo)
--    - UPDATE themes.current_draft_id
--    - INSERT en theme_audit_log (action='create_theme')
-- 
-- 2. ACTUALIZAR DRAFT:
--    - UPDATE theme_drafts (definition_json, updated_at, updated_by)
--    - INSERT en theme_audit_log (action='update_draft')
-- 
-- 3. VALIDAR DRAFT:
--    - Llamar validateThemeDefinition(def, { isPublish: false })
--    - INSERT en theme_audit_log (action='validate_draft', details_json con errores/warnings)
-- 
-- 4. PUBLICAR VERSIÓN:
--    - Validar draft con isPublish:true (bloquear si invalid)
--    - Calcular next_version = latest_version + 1 (o 1 si no hay)
--    - INSERT en theme_versions (definition_json INMUTABLE)
--    - UPDATE themes (current_published_version, status='published' si estaba 'draft')
--    - INSERT en theme_audit_log (action='publish_version')
-- 
-- 5. DEPRECAR VERSIÓN:
--    - UPDATE theme_versions (status='deprecated')
--    - INSERT en theme_audit_log (action='set_status')
-- 
-- IMPORTANTE:
-- - Las versiones publicadas NUNCA se modifican (inmutabilidad)
-- - Los drafts pueden tener errores (no bloquean edición)
-- - El publish SIEMPRE valida con isPublish:true (bloquea si hay errores)
-- - theme_rules NO se usa todavía (preparación futura)
-- 
-- ============================================================================



