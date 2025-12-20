-- ============================================================================
-- Migración v5.25.0: Ampliar Definición de Contextos (Sistema Canónico)
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Ampliar tabla pde_contexts con campos canónicos obligatorios:
--              scope, kind, injected. Estos campos son la base del sistema
--              definitivo de contextos.
--
-- PRINCIPIOS:
-- 1. Fail-open: valores por defecto seguros para todos los campos
-- 2. Migración compatible: no rompe contextos existentes
-- 3. Campos obligatorios con defaults para evitar NULL
-- ============================================================================

-- ============================================================================
-- AMPLIAR TABLA: pde_contexts
-- ============================================================================

-- Añadir campo 'scope' (ENUM obligatorio)
-- Valores: system, structural, personal, package
DO $$
BEGIN
  -- Crear tipo ENUM si no existe
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'context_scope') THEN
    CREATE TYPE context_scope AS ENUM ('system', 'structural', 'personal', 'package');
  END IF;
END $$;

-- Añadir columna scope (con default para compatibilidad)
ALTER TABLE pde_contexts
  ADD COLUMN IF NOT EXISTS scope context_scope NOT NULL DEFAULT 'package';

-- Añadir campo 'kind' (ENUM)
-- Valores: normal, level
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'context_kind') THEN
    CREATE TYPE context_kind AS ENUM ('normal', 'level');
  END IF;
END $$;

-- Añadir columna kind (con default)
ALTER TABLE pde_contexts
  ADD COLUMN IF NOT EXISTS kind context_kind NOT NULL DEFAULT 'normal';

-- Añadir campo 'injected' (boolean)
-- true = el runtime lo inyecta automáticamente
-- false = solo existe si el package lo define
ALTER TABLE pde_contexts
  ADD COLUMN IF NOT EXISTS injected BOOLEAN NOT NULL DEFAULT false;

-- Añadir campo 'description' (texto opcional para UX)
ALTER TABLE pde_contexts
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Añadir campo 'type' (ENUM para tipo de dato)
-- Valores: string, number, boolean, enum, json
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'context_type') THEN
    CREATE TYPE context_type AS ENUM ('string', 'number', 'boolean', 'enum', 'json');
  END IF;
END $$;

-- Añadir columna type (extraído de definition JSONB)
ALTER TABLE pde_contexts
  ADD COLUMN IF NOT EXISTS type context_type;

-- Añadir campo 'allowed_values' (JSONB array, nullable)
-- Solo para contextos tipo enum
ALTER TABLE pde_contexts
  ADD COLUMN IF NOT EXISTS allowed_values JSONB;

-- Añadir campo 'default_value' (JSONB, nullable)
ALTER TABLE pde_contexts
  ADD COLUMN IF NOT EXISTS default_value JSONB;

-- ============================================================================
-- MIGRAR DATOS EXISTENTES
-- ============================================================================

-- Migrar datos desde definition JSONB a columnas dedicadas
-- Esto asegura compatibilidad con contextos existentes
UPDATE pde_contexts
SET
  type = CASE
    WHEN (definition->>'type')::text IN ('string', 'number', 'boolean', 'enum', 'json')
    THEN (definition->>'type')::context_type
    ELSE 'string'::context_type
  END,
  allowed_values = CASE
    WHEN definition->>'type' = 'enum' AND definition->'allowed_values' IS NOT NULL
    THEN definition->'allowed_values'
    ELSE NULL
  END,
  default_value = CASE
    WHEN definition->'default_value' IS NOT NULL
    THEN definition->'default_value'
    ELSE NULL
  END,
  scope = CASE
    WHEN definition->>'scope' IN ('system', 'structural', 'personal', 'package')
    THEN (definition->>'scope')::context_scope
    ELSE 'package'::context_scope
  END,
  kind = CASE
    WHEN definition->>'kind' = 'level'
    THEN 'level'::context_kind
    ELSE 'normal'::context_kind
  END,
  injected = CASE
    WHEN (definition->>'injected')::boolean = true
    THEN true
    ELSE false
  END,
  description = COALESCE(
    description,
    definition->>'description',
    NULL
  )
WHERE deleted_at IS NULL;

-- ============================================================================
-- ÍNDICES
-- ============================================================================

-- Índice para búsquedas por scope
CREATE INDEX IF NOT EXISTS idx_pde_contexts_scope 
  ON pde_contexts(scope) 
  WHERE deleted_at IS NULL;

-- Índice para búsquedas por kind
CREATE INDEX IF NOT EXISTS idx_pde_contexts_kind 
  ON pde_contexts(kind) 
  WHERE deleted_at IS NULL;

-- Índice compuesto para filtrado común (scope + kind)
CREATE INDEX IF NOT EXISTS idx_pde_contexts_scope_kind 
  ON pde_contexts(scope, kind) 
  WHERE deleted_at IS NULL;

-- Índice para búsquedas por injected
CREATE INDEX IF NOT EXISTS idx_pde_contexts_injected 
  ON pde_contexts(injected) 
  WHERE deleted_at IS NULL;

-- ============================================================================
-- COMENTARIOS
-- ============================================================================

COMMENT ON COLUMN pde_contexts.scope IS 'Scope del contexto: system (global), structural (estado estructural), personal (estado personal), package (definido por experiencia)';
COMMENT ON COLUMN pde_contexts.kind IS 'Tipo de contexto: normal (estándar), level (contexto de nivel)';
COMMENT ON COLUMN pde_contexts.injected IS 'Si true, el runtime lo inyecta automáticamente. Si false, solo existe si el package lo define';
COMMENT ON COLUMN pde_contexts.type IS 'Tipo de dato del contexto: string, number, boolean, enum, json';
COMMENT ON COLUMN pde_contexts.allowed_values IS 'Valores permitidos (solo para type=enum)';
COMMENT ON COLUMN pde_contexts.default_value IS 'Valor por defecto del contexto';
COMMENT ON COLUMN pde_contexts.description IS 'Descripción humana del contexto (UX)';

-- ============================================================================
-- VALIDACIONES Y CONSTRAINTS
-- ============================================================================

-- Constraint: allowed_values solo debe existir si type = 'enum'
-- (Se valida a nivel de aplicación, no constraint DB por flexibilidad)

-- ============================================================================
-- CONTEXTOS DEL SISTEMA (SEED DATA)
-- ============================================================================

-- Actualizar contextos del sistema conocidos con sus valores canónicos
-- nivel_pde (si existe)
UPDATE pde_contexts
SET
  scope = 'structural',
  kind = 'level',
  injected = true,
  type = 'number',
  description = 'Nivel PDE del alumno (estructural)'
WHERE context_key = 'nivel_pde' AND deleted_at IS NULL;

-- temporada (si existe)
UPDATE pde_contexts
SET
  scope = 'system',
  kind = 'normal',
  injected = true,
  type = 'string',
  description = 'Temporada actual del sistema'
WHERE context_key = 'temporada' AND deleted_at IS NULL;

-- tipo_limpieza (si existe)
UPDATE pde_contexts
SET
  scope = 'package',
  kind = 'normal',
  injected = false,
  type = 'enum',
  description = 'Tipo de limpieza energética'
WHERE context_key = 'tipo_limpieza' AND deleted_at IS NULL;

