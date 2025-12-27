-- ============================================================================
-- Migración v5.41.0: Theme System v1 (Canónico, extensible, por capas)
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Sistema completo de temas con draft/publish, bindings por scope,
--              y resolución por capas (global → entorno → editor → pantalla → usuario)
--
-- PRINCIPIOS:
-- 1. PostgreSQL es Source of Truth soberano
-- 2. Draft/Publish: drafts editables, versions inmutables
-- 3. Bindings por scope: resolución determinista por capas
-- 4. Fail-open: si algo falla, usar default clásico
-- ============================================================================

-- ============================================================================
-- ACTUALIZACIÓN: themes (añadir columnas para Theme System v1)
-- ============================================================================
-- La tabla themes ya existe (v5.2.0), añadimos columnas necesarias

-- Añadir theme_key si no existe (usar id como fallback)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'themes' AND column_name = 'theme_key') THEN
        ALTER TABLE themes ADD COLUMN theme_key TEXT UNIQUE;
        -- Usar id como theme_key inicial para temas existentes
        UPDATE themes SET theme_key = id WHERE theme_key IS NULL;
        -- Hacer NOT NULL después de poblar
        ALTER TABLE themes ALTER COLUMN theme_key SET NOT NULL;
    END IF;
END $$;

-- Añadir definition si no existe (para almacenar ThemeDefinition v1 con modes)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'themes' AND column_name = 'definition') THEN
        ALTER TABLE themes ADD COLUMN definition JSONB DEFAULT '{}';
    END IF;
END $$;

-- Añadir version si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'themes' AND column_name = 'version') THEN
        ALTER TABLE themes ADD COLUMN version INT DEFAULT 1;
    END IF;
END $$;

-- Añadir deleted_at si no existe (soft delete)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'themes' AND column_name = 'deleted_at') THEN
        ALTER TABLE themes ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
END $$;

-- Añadir description si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'themes' AND column_name = 'description') THEN
        ALTER TABLE themes ADD COLUMN description TEXT;
    END IF;
END $$;

-- ============================================================================
-- ACTUALIZACIÓN: theme_versions (añadir columnas para Theme System v1)
-- ============================================================================
-- La tabla theme_versions ya existe (v5.2.0), añadimos columnas necesarias

-- Añadir published_at si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'theme_versions' AND column_name = 'published_at') THEN
        ALTER TABLE theme_versions ADD COLUMN published_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Añadir published_by si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'theme_versions' AND column_name = 'published_by') THEN
        ALTER TABLE theme_versions ADD COLUMN published_by TEXT;
    END IF;
END $$;

-- Nota: theme_versions ya tiene definition_json (v5.2.0)
-- En Theme System v1, usamos definition_json para almacenar ThemeDefinition con modes

-- ============================================================================
-- TABLA: theme_bindings
-- ============================================================================
-- Bindings por scope/capa para resolución determinista
-- Permite asignar un tema a un scope específico (global, environment, editor, screen, user)

CREATE TABLE IF NOT EXISTS theme_bindings (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- ========================================================================
    -- SCOPE (alcance)
    -- ========================================================================
    scope_type TEXT NOT NULL CHECK (scope_type IN ('global', 'environment', 'editor', 'screen', 'user')),
    -- Tipo de scope:
    -- - global: Tema global por defecto
    -- - environment: Tema para entorno ('admin' | 'student')
    -- - editor: Tema para editor específico (ej: 'nav-editor', 'recorridos-editor')
    -- - screen: Tema para pantalla específica (ej: 'admin/tecnicas-limpieza')
    -- - user: Tema para usuario específico (ej: '<student_id>' o '<admin_email>')
    
    scope_key TEXT NOT NULL,
    -- Clave del scope:
    -- - global: 'global'
    -- - environment: 'admin' | 'student'
    -- - editor: 'nav-editor' | 'recorridos-editor' | etc.
    -- - screen: 'admin/tecnicas-limpieza' | 'admin/navigation' | etc.
    -- - user: '<student_id>' | '<admin_email>'
    
    -- ========================================================================
    -- TEMA ASIGNADO
    -- ========================================================================
    theme_key TEXT NOT NULL,
    -- Clave del tema asignado (referencia a themes.theme_key o published key)
    
    mode_pref TEXT NOT NULL DEFAULT 'auto' CHECK (mode_pref IN ('auto', 'light', 'dark')),
    -- Preferencia de modo:
    -- - auto: Detectar automáticamente (light/dark según preferencia del sistema)
    -- - light: Forzar modo claro
    -- - dark: Forzar modo oscuro
    
    -- ========================================================================
    -- PRIORIDAD (para futuro)
    -- ========================================================================
    priority INT NOT NULL DEFAULT 100,
    -- Prioridad del binding (menor = mayor prioridad)
    -- Por ahora no se usa, pero se deja para futuras extensiones
    
    -- ========================================================================
    -- ESTADO
    -- ========================================================================
    active BOOLEAN NOT NULL DEFAULT true,
    -- Si el binding está activo
    
    -- ========================================================================
    -- METADATOS TEMPORALES
    -- ========================================================================
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    -- Soft delete
    
    -- ========================================================================
    -- CONSTRAINTS
    -- ========================================================================
    CONSTRAINT ck_theme_bindings_scope_type 
        CHECK (scope_type IN ('global', 'environment', 'editor', 'screen', 'user')),
    CONSTRAINT ck_theme_bindings_mode_pref 
        CHECK (mode_pref IN ('auto', 'light', 'dark'))
);

-- Índice único parcial para garantizar un solo binding activo por scope
CREATE UNIQUE INDEX IF NOT EXISTS idx_theme_bindings_scope_unique 
    ON theme_bindings(scope_type, scope_key) 
    WHERE deleted_at IS NULL;

-- ============================================================================
-- ÍNDICES PARA CONSULTAS RÁPIDAS
-- ============================================================================

-- themes: Búsqueda por theme_key
CREATE INDEX IF NOT EXISTS idx_themes_theme_key 
    ON themes(theme_key) 
    WHERE deleted_at IS NULL;

-- themes: Búsqueda por status
CREATE INDEX IF NOT EXISTS idx_themes_status 
    ON themes(status) 
    WHERE deleted_at IS NULL;

-- theme_versions: Búsqueda por theme_id y version (ya existe en v5.2.0, pero lo creamos si no existe)
CREATE INDEX IF NOT EXISTS idx_theme_versions_theme_version 
    ON theme_versions(theme_id, version DESC);

-- theme_versions: Búsqueda por status (ya existe en v5.2.0, pero lo creamos si no existe)
CREATE INDEX IF NOT EXISTS idx_theme_versions_status 
    ON theme_versions(status) 
    WHERE status = 'published';

-- theme_bindings: Búsqueda por scope_type y scope_key
CREATE INDEX IF NOT EXISTS idx_theme_bindings_scope 
    ON theme_bindings(scope_type, scope_key) 
    WHERE deleted_at IS NULL AND active = true;

-- theme_bindings: Búsqueda por theme_key
CREATE INDEX IF NOT EXISTS idx_theme_bindings_theme_key 
    ON theme_bindings(theme_key) 
    WHERE deleted_at IS NULL AND active = true;

-- ============================================================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ============================================================================

COMMENT ON TABLE themes IS 
'Tabla principal de temas. Representa un "producto" tema con múltiples drafts y versiones.';

COMMENT ON COLUMN themes.theme_key IS 
'Clave única del tema (ej: "admin-classic", "admin-default"). Usado para referencias.';

COMMENT ON COLUMN themes.status IS 
'Estado global: draft (nunca publicado), published (tiene versión activa), archived (archivado)';

COMMENT ON COLUMN themes.definition IS 
'ThemeDefinition completa con light/dark. Puede tener errores si es draft.';

COMMENT ON TABLE theme_versions IS 
'Versiones publicadas e INMUTABLES de un tema. Una vez publicada, una versión NUNCA puede cambiar.';

COMMENT ON COLUMN theme_versions.definition IS 
'ThemeDefinition completa en el momento de publicación. Este campo NUNCA debe cambiar después de la publicación.';

COMMENT ON TABLE theme_bindings IS 
'Bindings por scope/capa para resolución determinista. Permite asignar un tema a un scope específico.';

COMMENT ON COLUMN theme_bindings.scope_type IS 
'Tipo de scope: global, environment, editor, screen, user';

COMMENT ON COLUMN theme_bindings.scope_key IS 
'Clave del scope: global="global", environment="admin"/"student", editor="nav-editor", screen="admin/tecnicas-limpieza", user="<id>"';

COMMENT ON COLUMN theme_bindings.mode_pref IS 
'Preferencia de modo: auto (detectar automáticamente), light (forzar claro), dark (forzar oscuro)';

-- ============================================================================
-- SEED INICIAL
-- ============================================================================
-- Crear theme draft/published basado en el look actual del Admin

-- Theme: admin-classic
-- Nota: themes.id es TEXT (de v5.2.0), usar theme_key como id
INSERT INTO themes (id, theme_key, name, description, status, version, definition)
VALUES (
    'admin-classic',
    'admin-classic',
    'Admin Classic (Base)',
    'Tema clásico del Admin basado en el look actual',
    'published',
    1,
    '{
        "theme_key": "admin-classic",
        "name": "Admin Classic (Base)",
        "description": "Tema clásico del Admin basado en el look actual",
        "modes": {
            "light": {
                "bg.base": "#ffffff",
                "bg.surface": "#f5f5f5",
                "bg.panel": "#ffffff",
                "bg.elevated": "#ffffff",
                "text.primary": "#000000",
                "text.muted": "#666666",
                "text.inverse": "#ffffff",
                "border.subtle": "#e0e0e0",
                "border.strong": "#cccccc",
                "accent.primary": "#007bff",
                "accent.secondary": "#6c757d",
                "state.hover": "#f0f0f0",
                "state.active": "#e0e0e0",
                "state.focus": "#007bff",
                "danger.base": "#dc3545",
                "warning.base": "#ffc107",
                "success.base": "#28a745",
                "shadow.soft": "0 1px 3px rgba(0,0,0,0.1)",
                "shadow.medium": "0 4px 6px rgba(0,0,0,0.1)",
                "radius.sm": "4px",
                "radius.md": "8px",
                "radius.lg": "12px",
                "spacing.xs": "4px",
                "spacing.sm": "8px",
                "spacing.md": "16px",
                "spacing.lg": "24px",
                "font.base": "system-ui, -apple-system, sans-serif",
                "font.mono": "monospace"
            },
            "dark": {
                "bg.base": "#1a1a1a",
                "bg.surface": "#2d2d2d",
                "bg.panel": "#3a3a3a",
                "bg.elevated": "#4a4a4a",
                "text.primary": "#ffffff",
                "text.muted": "#aaaaaa",
                "text.inverse": "#000000",
                "border.subtle": "#404040",
                "border.strong": "#555555",
                "accent.primary": "#007bff",
                "accent.secondary": "#6c757d",
                "state.hover": "#3a3a3a",
                "state.active": "#4a4a4a",
                "state.focus": "#007bff",
                "danger.base": "#dc3545",
                "warning.base": "#ffc107",
                "success.base": "#28a745",
                "shadow.soft": "0 1px 3px rgba(0,0,0,0.3)",
                "shadow.medium": "0 4px 6px rgba(0,0,0,0.3)",
                "radius.sm": "4px",
                "radius.md": "8px",
                "radius.lg": "12px",
                "spacing.xs": "4px",
                "spacing.sm": "8px",
                "spacing.md": "16px",
                "spacing.lg": "24px",
                "font.base": "system-ui, -apple-system, sans-serif",
                "font.mono": "monospace"
            }
        },
        "meta": {
            "created_by": "system",
            "created_at": "2025-01-XX"
        }
    }'::jsonb
)
ON CONFLICT (theme_key) DO NOTHING;

-- Crear versión publicada del theme admin-classic
-- Nota: theme_versions usa definition_json (no definition) y theme_id es TEXT (no UUID)
INSERT INTO theme_versions (theme_id, version, status, definition_json, published_at, published_by)
SELECT 
    id,
    1,
    'published',
    definition::jsonb,
    NOW(),
    'system'
FROM themes
WHERE theme_key = 'admin-classic' AND id = 'admin-classic'
ON CONFLICT (theme_id, version) DO NOTHING;

-- Crear binding global/environment
-- Primero verificar si ya existen, si no, insertar
INSERT INTO theme_bindings (scope_type, scope_key, theme_key, mode_pref, priority, active)
SELECT 'environment', 'admin', 'admin-classic', 'auto', 100, true
WHERE NOT EXISTS (
    SELECT 1 FROM theme_bindings 
    WHERE scope_type = 'environment' AND scope_key = 'admin' AND deleted_at IS NULL
);

INSERT INTO theme_bindings (scope_type, scope_key, theme_key, mode_pref, priority, active)
SELECT 'global', 'global', 'admin-classic', 'auto', 100, true
WHERE NOT EXISTS (
    SELECT 1 FROM theme_bindings 
    WHERE scope_type = 'global' AND scope_key = 'global' AND deleted_at IS NULL
);

-- ============================================================================
-- NOTAS DE USO
-- ============================================================================
-- 
-- FLUJO TÍPICO:
-- 
-- 1. CREAR TEMA:
--    - INSERT en themes (status='draft', definition con tokens)
--    - Guardar como draft
-- 
-- 2. ACTUALIZAR DRAFT:
--    - UPDATE themes (definition, updated_at)
-- 
-- 3. PUBLICAR VERSIÓN:
--    - Validar definition
--    - Calcular next_version = latest_version + 1 (o 1 si no hay)
--    - INSERT en theme_versions (definition INMUTABLE)
--    - UPDATE themes (version, status='published' si estaba 'draft')
-- 
-- 4. CREAR BINDING:
--    - INSERT en theme_bindings (scope_type, scope_key, theme_key, mode_pref)
-- 
-- 5. RESOLVER TEMA:
--    - Buscar bindings por capas (user → screen → editor → environment → global)
--    - Obtener theme_key del binding más específico
--    - Cargar definition desde themes (draft) o theme_versions (published)
--    - Aplicar modo (light/dark) según mode_pref
-- 
-- IMPORTANTE:
-- - Las versiones publicadas NUNCA se modifican (inmutabilidad)
-- - Los drafts pueden tener errores (no bloquean edición)
-- - El publish SIEMPRE valida (bloquea si hay errores)
-- - Los bindings se resuelven por prioridad de capas
-- 
-- ============================================================================

