-- ============================================================================
-- Migración v5.13.0: Sistema de Paquetes PDE (Package Creator)
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Tablas para gestionar paquetes de contenido PDE con Source of Truth,
--              Templates reutilizables, contextos con defaults y reglas declarativas
--
-- PRINCIPIOS:
-- 1. Fail-open absoluto: nunca bloquea por falta de contexto
-- 2. JSON canónico: todo paquete tiene definition JSON obligatorio
-- 3. Templates reutilizables: un template puede usarse en múltiples paquetes
-- 4. Soft delete: deleted_at para mantener historial
-- ============================================================================

-- ============================================================================
-- TABLA: pde_packages
-- ============================================================================
-- Almacena definiciones de paquetes con su JSON canónico

CREATE TABLE IF NOT EXISTS pde_packages (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID único generado automáticamente
    
    package_key TEXT UNIQUE NOT NULL,
    -- Clave única del paquete (ej: "paquete-inicial-nivel-1")
    -- Usado para referenciar el paquete en código y APIs
    
    -- ========================================================================
    -- METADATOS
    -- ========================================================================
    name TEXT NOT NULL,
    -- Nombre legible del paquete (ej: "Paquete Inicial Nivel 1")
    
    description TEXT,
    -- Descripción opcional del paquete
    
    -- ========================================================================
    -- ESTADO
    -- ========================================================================
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    -- Estado del paquete: active (usado en runtime) o inactive (deshabilitado)
    
    -- ========================================================================
    -- DEFINICIÓN CANÓNICA (OBLIGATORIA)
    -- ========================================================================
    definition JSONB NOT NULL,
    -- JSON canónico del paquete siguiendo el contrato:
    -- {
    --   "package_key": "string",
    --   "sources": [
    --     {
    --       "source_key": "string",
    --       "filter_by_nivel": true,
    --       "template_key": "string"
    --     }
    --   ],
    --   "context_contract": {
    --     "inputs": [
    --       {
    --         "key": "string",
    --         "type": "enum | number | string | boolean",
    --         "values": [],
    --         "default": null
    --       }
    --     ],
    --     "outputs": [
    --       {
    --         "key": "string",
    --         "type": "ids_array | number | string | boolean"
    --       }
    --     ]
    --   },
    --   "context_rules": [
    --     {
    --       "when": { "context_key": "value" },
    --       "limits": {
    --         "source_key": 10
    --       }
    --     }
    --   ]
    -- }
    
    -- ========================================================================
    -- METADATOS TEMPORALES
    -- ========================================================================
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    -- Soft delete: si tiene valor, el paquete está eliminado (pero se mantiene en BD)
    
    -- ========================================================================
    -- ÍNDICES
    -- ========================================================================
    CONSTRAINT pde_packages_package_key_unique UNIQUE (package_key)
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_pde_packages_package_key ON pde_packages(package_key) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pde_packages_status ON pde_packages(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pde_packages_definition_gin ON pde_packages USING GIN (definition);
-- Índice GIN para búsquedas rápidas en JSONB

-- ============================================================================
-- TABLA: pde_source_templates
-- ============================================================================
-- Almacena templates reutilizables por Source of Truth

CREATE TABLE IF NOT EXISTS pde_source_templates (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID único generado automáticamente
    
    source_key TEXT NOT NULL,
    -- Clave del Source of Truth (ej: "transmutaciones_energeticas")
    -- Debe existir en el registro de catálogos PDE
    
    template_key TEXT NOT NULL,
    -- Clave única del template dentro del source (ej: "template-basico")
    -- Combinación source_key + template_key debe ser única
    
    -- ========================================================================
    -- METADATOS
    -- ========================================================================
    name TEXT NOT NULL,
    -- Nombre legible del template (ej: "Template Básico")
    
    -- ========================================================================
    -- DEFINICIÓN DEL TEMPLATE
    -- ========================================================================
    definition JSONB NOT NULL,
    -- JSON que define cómo se muestra el contenido del Source
    -- Estructura libre (depende del Source)
    
    -- ========================================================================
    -- METADATOS TEMPORALES
    -- ========================================================================
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- ========================================================================
    -- CONSTRAINTS
    -- ========================================================================
    CONSTRAINT pde_source_templates_source_template_unique UNIQUE (source_key, template_key)
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_pde_source_templates_source_key ON pde_source_templates(source_key);
CREATE INDEX IF NOT EXISTS idx_pde_source_templates_template_key ON pde_source_templates(template_key);
CREATE INDEX IF NOT EXISTS idx_pde_source_templates_definition_gin ON pde_source_templates USING GIN (definition);

-- ============================================================================
-- COMENTARIOS
-- ============================================================================

COMMENT ON TABLE pde_packages IS 'Paquetes de contenido PDE con definición JSON canónica';
COMMENT ON COLUMN pde_packages.definition IS 'JSON canónico del paquete (obligatorio, nunca NULL)';
COMMENT ON TABLE pde_source_templates IS 'Templates reutilizables por Source of Truth';
COMMENT ON COLUMN pde_source_templates.definition IS 'JSON que define cómo se muestra el contenido del Source';


