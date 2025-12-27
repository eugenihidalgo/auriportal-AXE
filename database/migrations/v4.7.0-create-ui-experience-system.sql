-- Migración v4.7.0: UI & Experience System v1
-- Fecha: 2024-12-XX
-- Descripción: Sistema de UI & Experience con Themes, Screens, Layers y Conversation Scripts
-- Preparado para extensibilidad total sin romper el core

-- ============================================================================
-- TABLA: ui_themes
-- ============================================================================
-- Almacena temas de diseño con tokens JSONB
CREATE TABLE IF NOT EXISTS ui_themes (
    id BIGSERIAL PRIMARY KEY,
    theme_key TEXT NOT NULL,
    version TEXT NOT NULL,
    tokens JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'draft', -- draft | active | archived
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(theme_key, version)
);

CREATE INDEX IF NOT EXISTS idx_ui_themes_key_version ON ui_themes(theme_key, version);
CREATE INDEX IF NOT EXISTS idx_ui_themes_status ON ui_themes(status);
CREATE INDEX IF NOT EXISTS idx_ui_themes_key_status ON ui_themes(theme_key, status);

COMMENT ON TABLE ui_themes IS 'Temas de diseño con tokens JSONB (colores, tipografías, spacing, etc.)';
COMMENT ON COLUMN ui_themes.theme_key IS 'Identificador único del tema (ej: default, dark, light)';
COMMENT ON COLUMN ui_themes.version IS 'Versión del tema (ej: 1.0.0)';
COMMENT ON COLUMN ui_themes.tokens IS 'Design tokens en JSONB (colores, tipografías, spacing, radios, sombras)';
COMMENT ON COLUMN ui_themes.status IS 'Estado: draft (borrador), active (activo), archived (archivado)';

-- ============================================================================
-- TABLA: ui_screens
-- ============================================================================
-- Almacena definiciones de pantallas (estructura + composición)
CREATE TABLE IF NOT EXISTS ui_screens (
    id BIGSERIAL PRIMARY KEY,
    screen_key TEXT NOT NULL,
    version TEXT NOT NULL,
    definition JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'draft', -- draft | active | archived
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(screen_key, version)
);

CREATE INDEX IF NOT EXISTS idx_ui_screens_key_version ON ui_screens(screen_key, version);
CREATE INDEX IF NOT EXISTS idx_ui_screens_status ON ui_screens(status);
CREATE INDEX IF NOT EXISTS idx_ui_screens_key_status ON ui_screens(screen_key, status);

COMMENT ON TABLE ui_screens IS 'Definiciones de pantallas (estructura + composición, NO lógica de negocio)';
COMMENT ON COLUMN ui_screens.screen_key IS 'Identificador único de la pantalla (ej: enter, topics, practice)';
COMMENT ON COLUMN ui_screens.version IS 'Versión de la pantalla (ej: 1.0.0)';
COMMENT ON COLUMN ui_screens.definition IS 'Definición JSONB (layout + componentes)';
COMMENT ON COLUMN ui_screens.status IS 'Estado: draft (borrador), active (activo), archived (archivado)';

-- ============================================================================
-- TABLA: ui_layers
-- ============================================================================
-- Almacena Experience Layers (plugins opcionales aplicados sobre Screens)
CREATE TABLE IF NOT EXISTS ui_layers (
    id BIGSERIAL PRIMARY KEY,
    layer_key TEXT NOT NULL,
    layer_type TEXT NOT NULL, -- transition_background_v1, guided_conversation_v1, custom_extension_v1, etc.
    version TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'draft', -- draft | active | archived
    priority INTEGER NOT NULL DEFAULT 100, -- Orden de aplicación (menor = primero)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(layer_key, version)
);

CREATE INDEX IF NOT EXISTS idx_ui_layers_key_version ON ui_layers(layer_key, version);
CREATE INDEX IF NOT EXISTS idx_ui_layers_type ON ui_layers(layer_type);
CREATE INDEX IF NOT EXISTS idx_ui_layers_status ON ui_layers(status);
CREATE INDEX IF NOT EXISTS idx_ui_layers_type_status ON ui_layers(layer_type, status);
CREATE INDEX IF NOT EXISTS idx_ui_layers_priority ON ui_layers(priority);

COMMENT ON TABLE ui_layers IS 'Experience Layers (plugins opcionales aplicados sobre Screens)';
COMMENT ON COLUMN ui_layers.layer_key IS 'Identificador único del layer (ej: aurelin-overlay-v1)';
COMMENT ON COLUMN ui_layers.layer_type IS 'Tipo de layer (ej: transition_background_v1, guided_conversation_v1)';
COMMENT ON COLUMN ui_layers.version IS 'Versión del layer (ej: 1.0.0)';
COMMENT ON COLUMN ui_layers.config IS 'Configuración JSONB del layer (específica por tipo)';
COMMENT ON COLUMN ui_layers.status IS 'Estado: draft (borrador), active (activo), archived (archivado)';
COMMENT ON COLUMN ui_layers.priority IS 'Prioridad de aplicación (menor = primero, default: 100)';

-- ============================================================================
-- TABLA: ui_conversation_scripts
-- ============================================================================
-- Almacena scripts de conversación guiada (Aurelín) versionados
CREATE TABLE IF NOT EXISTS ui_conversation_scripts (
    id BIGSERIAL PRIMARY KEY,
    script_key TEXT NOT NULL,
    version TEXT NOT NULL,
    definition JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'draft', -- draft | active | archived
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(script_key, version)
);

CREATE INDEX IF NOT EXISTS idx_ui_conversation_scripts_key_version ON ui_conversation_scripts(script_key, version);
CREATE INDEX IF NOT EXISTS idx_ui_conversation_scripts_status ON ui_conversation_scripts(status);
CREATE INDEX IF NOT EXISTS idx_ui_conversation_scripts_key_status ON ui_conversation_scripts(script_key, status);

COMMENT ON TABLE ui_conversation_scripts IS 'Scripts de conversación guiada (Aurelín) versionados';
COMMENT ON COLUMN ui_conversation_scripts.script_key IS 'Identificador único del script (ej: welcome-v1, practice-hint-v1)';
COMMENT ON COLUMN ui_conversation_scripts.version IS 'Versión del script (ej: 1.0.0)';
COMMENT ON COLUMN ui_conversation_scripts.definition IS 'Definición JSONB del script (pasos, condiciones, acciones)';
COMMENT ON COLUMN ui_conversation_scripts.status IS 'Estado: draft (borrador), active (activo), archived (archivado)';

-- ============================================================================
-- TABLA: ui_active_config
-- ============================================================================
-- Almacena configuración activa por entorno (qué theme y layers están activos)
CREATE TABLE IF NOT EXISTS ui_active_config (
    id BIGSERIAL PRIMARY KEY,
    env TEXT NOT NULL, -- dev | beta | prod
    active_theme_key TEXT,
    active_theme_version TEXT,
    enabled_layers JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array de {layer_key, version}
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT, -- actor_id que hizo el cambio
    UNIQUE(env)
);

CREATE INDEX IF NOT EXISTS idx_ui_active_config_env ON ui_active_config(env);

COMMENT ON TABLE ui_active_config IS 'Configuración activa por entorno (theme y layers habilitados)';
COMMENT ON COLUMN ui_active_config.env IS 'Entorno: dev, beta, prod';
COMMENT ON COLUMN ui_active_config.active_theme_key IS 'Theme activo (FK a ui_themes.theme_key)';
COMMENT ON COLUMN ui_active_config.active_theme_version IS 'Versión del theme activo';
COMMENT ON COLUMN ui_active_config.enabled_layers IS 'Array JSONB de layers habilitados: [{layer_key, version}, ...]';
COMMENT ON COLUMN ui_active_config.updated_at IS 'Última actualización de la configuración';
COMMENT ON COLUMN ui_active_config.updated_by IS 'Actor que hizo el cambio (admin_id, etc.)';




















