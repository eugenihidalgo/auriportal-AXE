-- ============================================================================
-- Migración v5.17.0: Context Registry v1 (Source of Truth para Contextos)
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Tablas para gestionar contextos globales (variables semánticas)
--              que usan Paquetes / Editor tipo Typeform. Fail-open absoluto.
--
-- PRINCIPIOS:
-- 1. Fail-open absoluto: todo tiene default, nada bloquea
-- 2. Centralizado y reutilizable: como Source-of-Truth Registry
-- 3. Seleccionable/creable desde UI: sin copiar/pegar constante
-- 4. Sin romper sistema actual: compatible con pde_packages existentes
-- ============================================================================

-- ============================================================================
-- TABLA: pde_contexts
-- ============================================================================
-- Almacena definiciones de contextos globales (variables semánticas)

CREATE TABLE IF NOT EXISTS pde_contexts (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID único generado automáticamente
    
    context_key TEXT UNIQUE NOT NULL,
    -- Clave única del contexto (slug, ej: "nivel_efectivo", "tipo_limpieza")
    -- Usado para referenciar el contexto en paquetes y runtime
    -- Validación: solo [a-z0-9_-]
    
    -- ========================================================================
    -- METADATOS
    -- ========================================================================
    label TEXT NOT NULL,
    -- Nombre legible del contexto (ej: "Nivel Efectivo", "Tipo de Limpieza")
    
    -- ========================================================================
    -- DEFINICIÓN CANÓNICA (OBLIGATORIA)
    -- ========================================================================
    definition JSONB NOT NULL,
    -- JSON canónico del contexto siguiendo el contrato:
    -- {
    --   "type": "string | number | boolean | enum | json",
    --   "allowed_values": [],  // Solo si type === "enum"
    --   "default_value": null, // JSON value según type
    --   "scope": "global | workflow | step",  // default: "workflow"
    --   "origin": "system | user_choice | derived",  // default: "user_choice"
    --   "description": "texto opcional"
    -- }
    
    -- ========================================================================
    -- ESTADO
    -- ========================================================================
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    -- Estado del contexto: active (usado en runtime) o archived (deshabilitado)
    
    -- ========================================================================
    -- METADATOS TEMPORALES
    -- ========================================================================
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    -- Soft delete: si tiene valor, el contexto está eliminado (pero se mantiene en BD)
    
    -- ========================================================================
    -- CONSTRAINTS
    -- ========================================================================
    CONSTRAINT pde_contexts_context_key_unique UNIQUE (context_key)
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_pde_contexts_context_key ON pde_contexts(context_key) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pde_contexts_status ON pde_contexts(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pde_contexts_definition_gin ON pde_contexts USING GIN (definition);
-- Índice GIN para búsquedas rápidas en JSONB

-- ============================================================================
-- TABLA: pde_context_audit_log
-- ============================================================================
-- Log de auditoría append-only para cambios en contextos

CREATE TABLE IF NOT EXISTS pde_context_audit_log (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID único generado automáticamente
    
    context_id UUID NOT NULL,
    -- Referencia al contexto modificado
    
    -- ========================================================================
    -- ACCIÓN
    -- ========================================================================
    action TEXT NOT NULL,
    -- Acción realizada: create, update, archive, delete
    
    -- ========================================================================
    -- ACTOR
    -- ========================================================================
    actor_admin_id TEXT,
    -- ID del administrador que realizó la acción (si está disponible)
    
    -- ========================================================================
    -- CAMBIOS
    -- ========================================================================
    before JSONB,
    -- Estado anterior del contexto (null si es create)
    
    after JSONB,
    -- Estado nuevo del contexto (null si es delete)
    
    -- ========================================================================
    -- METADATOS TEMPORALES
    -- ========================================================================
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- Fecha/hora de la acción
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_pde_context_audit_log_context_id ON pde_context_audit_log(context_id);
CREATE INDEX IF NOT EXISTS idx_pde_context_audit_log_action ON pde_context_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_pde_context_audit_log_created_at ON pde_context_audit_log(created_at DESC);

-- ============================================================================
-- COMENTARIOS
-- ============================================================================

COMMENT ON TABLE pde_contexts IS 'Contextos globales (variables semánticas) para Paquetes PDE';
COMMENT ON COLUMN pde_contexts.definition IS 'JSON canónico del contexto (obligatorio, nunca NULL)';
COMMENT ON COLUMN pde_contexts.context_key IS 'Clave única del contexto (slug, solo [a-z0-9_-])';
COMMENT ON TABLE pde_context_audit_log IS 'Log de auditoría append-only para cambios en contextos';


