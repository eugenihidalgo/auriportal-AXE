-- ============================================================================
-- Migración v5.39.2: Técnicas de Limpieza - Alineación Schema con SOT Certificado
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Añade campos faltantes para alinear PostgreSQL con el contrato
--              semántico del SOT certificado de Técnicas de Limpieza.
--
-- PRINCIPIOS:
-- 1. NO borrar datos existentes
-- 2. NO modificar semántica existente
-- 3. Mantener status, level, created_at, updated_at intactos
-- 4. Añadir solo campos que faltan según el contrato SOT
-- ============================================================================

-- ============================================================================
-- 1. AÑADIR CAMPOS FALTANTES DEL CONTRATO SOT
-- ============================================================================

-- estimated_duration: Duración estimada en minutos (declarado en SOT)
ALTER TABLE tecnicas_limpieza
  ADD COLUMN IF NOT EXISTS estimated_duration INTEGER;

-- Campos de referencia a recursos interactivos (media)
-- Nota: Estos campos almacenan referencias UUID a interactive_resources
-- La relación real se maneja mediante interactive_resources.origin
-- pero mantener referencias directas para queries eficientes
ALTER TABLE tecnicas_limpieza
  ADD COLUMN IF NOT EXISTS video_resource_id UUID,
  ADD COLUMN IF NOT EXISTS audio_resource_id UUID,
  ADD COLUMN IF NOT EXISTS image_resource_id UUID;

-- metadata: Campo JSONB para metadata adicional extensible
ALTER TABLE tecnicas_limpieza
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- ============================================================================
-- 2. COMENTARIOS PARA DOCUMENTACIÓN
-- ============================================================================

COMMENT ON COLUMN tecnicas_limpieza.estimated_duration IS 'Duración estimada de la técnica en minutos (campo opcional del contrato SOT)';
COMMENT ON COLUMN tecnicas_limpieza.video_resource_id IS 'Referencia UUID al recurso interactivo de tipo video (FK a interactive_resources.id)';
COMMENT ON COLUMN tecnicas_limpieza.audio_resource_id IS 'Referencia UUID al recurso interactivo de tipo audio (FK a interactive_resources.id)';
COMMENT ON COLUMN tecnicas_limpieza.image_resource_id IS 'Referencia UUID al recurso interactivo de tipo image (FK a interactive_resources.id)';
COMMENT ON COLUMN tecnicas_limpieza.metadata IS 'Metadata adicional en formato JSONB para extensibilidad futura';

-- ============================================================================
-- 3. VERIFICACIÓN: Asegurar que todos los campos existen
-- ============================================================================

DO $$
DECLARE
  missing_columns TEXT[] := ARRAY[]::TEXT[];
  required_columns TEXT[] := ARRAY[
    'estimated_duration',
    'video_resource_id',
    'audio_resource_id',
    'image_resource_id',
    'metadata'
  ];
  col TEXT;
BEGIN
  FOR col IN SELECT unnest(required_columns)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'tecnicas_limpieza' 
      AND column_name = col
    ) THEN
      missing_columns := array_append(missing_columns, col);
    END IF;
  END LOOP;
  
  IF array_length(missing_columns, 1) > 0 THEN
    RAISE EXCEPTION 'Error: Faltan columnas después de la migración: %', array_to_string(missing_columns, ', ');
  END IF;
END $$;

-- ============================================================================
-- NOTAS IMPORTANTES:
-- ============================================================================
-- 1. Todos los campos añadidos son opcionales (permiten NULL)
-- 2. estimated_duration puede ser usado para filtrado en listForConsumption()
-- 3. Las referencias a recursos (video_resource_id, etc.) son preparatorias
--    para futuras optimizaciones de queries (la relación principal sigue
--    siendo mediante interactive_resources.origin)
-- 4. metadata permite extensibilidad sin alterar el esquema principal
-- ============================================================================

