-- ============================================================================
-- Migración v5.24.0: Context Mapping Editor v1
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Tabla para gestionar mappings de contextos (traducción de valores
--              de enum en parámetros derivados reutilizables)
--
-- PRINCIPIOS:
-- 1. NO ejecuta lógica: solo almacena configuración declarativa
-- 2. NO decide estado: no sustituye Context Definitions
-- 3. Fail-open: warnings, no throws
-- 4. Sin FK físico: context_key es semántico (como signals, sources, etc.)
-- ============================================================================

-- ============================================================================
-- TABLA: context_mappings
-- ============================================================================
-- Almacena mappings de valores de contexto (enum) a parámetros derivados

CREATE TABLE IF NOT EXISTS context_mappings (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID único generado automáticamente
    
    context_key TEXT NOT NULL,
    -- Clave del contexto (ej: "tipo_limpieza")
    -- Semántico, sin FK físico (como signals, sources, etc.)
    
    mapping_key TEXT NOT NULL,
    -- Clave del mapping (valor del enum, ej: "rapida", "completa")
    -- Corresponde a un valor en allowed_values del contexto
    
    -- ========================================================================
    -- DATOS DEL MAPPING
    -- ========================================================================
    mapping_data JSONB NOT NULL,
    -- JSON con parámetros derivados (ej: {"max_aspects": 5, "minutes": 10})
    -- Estructura libre, validada por el servicio
    
    -- ========================================================================
    -- ORDEN Y ESTADO
    -- ========================================================================
    sort_order INT DEFAULT 0,
    -- Orden de visualización (menor = primero)
    
    active BOOLEAN DEFAULT true,
    -- Estado activo/inactivo del mapping
    
    -- ========================================================================
    -- METADATOS TEMPORALES
    -- ========================================================================
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    -- Soft delete: si tiene valor, el mapping está eliminado
    
    -- ========================================================================
    -- CONSTRAINTS
    -- ========================================================================
    -- Nota: El constraint único con WHERE se crea como índice parcial más abajo
    -- No se puede usar UNIQUE con WHERE directamente en CREATE TABLE
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_context_mappings_context_key 
    ON context_mappings(context_key) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_context_mappings_active 
    ON context_mappings(active) 
    WHERE deleted_at IS NULL AND active = true;

CREATE INDEX IF NOT EXISTS idx_context_mappings_sort_order 
    ON context_mappings(context_key, sort_order) 
    WHERE deleted_at IS NULL;

-- Índice GIN para búsquedas rápidas en JSONB
CREATE INDEX IF NOT EXISTS idx_context_mappings_data_gin 
    ON context_mappings USING GIN (mapping_data);

-- Constraint único parcial (un mapping único por context_key + mapping_key solo si no está eliminado)
CREATE UNIQUE INDEX IF NOT EXISTS idx_context_mappings_unique 
    ON context_mappings(context_key, mapping_key) 
    WHERE deleted_at IS NULL;

-- ============================================================================
-- COMENTARIOS
-- ============================================================================

COMMENT ON TABLE context_mappings IS 'Mappings de valores de contexto (enum) a parámetros derivados reutilizables';
COMMENT ON COLUMN context_mappings.context_key IS 'Clave del contexto (semántico, sin FK físico)';
COMMENT ON COLUMN context_mappings.mapping_key IS 'Clave del mapping (valor del enum)';
COMMENT ON COLUMN context_mappings.mapping_data IS 'JSON con parámetros derivados (estructura libre)';
COMMENT ON COLUMN context_mappings.sort_order IS 'Orden de visualización (menor = primero)';

