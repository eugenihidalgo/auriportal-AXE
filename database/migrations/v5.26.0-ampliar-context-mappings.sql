-- ============================================================================
-- Migración v5.26.0: Ampliar Context Mappings (Capa Humana Explícita)
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Ampliar tabla context_mappings con campos humanos (label, description)
--              para mejorar la UX del editor de mappings.
--
-- PRINCIPIOS:
-- 1. Fail-open: valores por defecto seguros
-- 2. Compatibilidad: no rompe mappings existentes
-- 3. Capa humana explícita separada de mapping_data
-- ============================================================================

-- ============================================================================
-- AMPLIAR TABLA: context_mappings
-- ============================================================================

-- Añadir campo 'label' (string humano editable)
-- Si no existe, se genera automáticamente desde mapping_key
ALTER TABLE context_mappings
  ADD COLUMN IF NOT EXISTS label TEXT;

-- Añadir campo 'description' (string opcional para UX)
ALTER TABLE context_mappings
  ADD COLUMN IF NOT EXISTS description TEXT;

-- ============================================================================
-- MIGRAR DATOS EXISTENTES
-- ============================================================================

-- Generar labels automáticos desde mapping_key si no existen
-- Ejemplo: "rapida" -> "Rápida", "completa" -> "Completa"
UPDATE context_mappings
SET
  label = CASE
    WHEN label IS NULL OR label = '' THEN
      -- Capitalizar primera letra y reemplazar guiones bajos por espacios
      INITCAP(REPLACE(mapping_key, '_', ' '))
    ELSE
      label
  END
WHERE deleted_at IS NULL;

-- ============================================================================
-- ÍNDICES
-- ============================================================================

-- Índice para búsquedas por label (búsqueda de texto)
CREATE INDEX IF NOT EXISTS idx_context_mappings_label 
  ON context_mappings USING gin(to_tsvector('spanish', COALESCE(label, ''))) 
  WHERE deleted_at IS NULL;

-- ============================================================================
-- COMENTARIOS
-- ============================================================================

COMMENT ON COLUMN context_mappings.label IS 'Etiqueta humana editable del mapping (UX)';
COMMENT ON COLUMN context_mappings.description IS 'Descripción opcional del mapping (UX)';
COMMENT ON COLUMN context_mappings.mapping_data IS 'JSON con parámetros derivados (SOLO semántica, NO lógica)';








