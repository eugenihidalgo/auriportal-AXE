-- ============================================================================
-- Migración v5.58.0: Level Gates v1 (Multi-Line)
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Extiende level_gates para soportar gates reales multi-línea
--              con Condition Engine v1 y gestión completa.
--
-- PRINCIPIOS:
-- 1. Gates son por line_key (multi-línea)
-- 2. Gates NO congelan días, solo bloquean upgrade
-- 3. Gates se evalúan SOLO cuando computed_days >= min_days siguiente nivel
-- 4. Condition Engine v1 evalúa condiciones declarativas
-- 5. Feature flag: level_gates_v1 (OFF por defecto)
-- ============================================================================

-- Extender level_gates con campos adicionales
ALTER TABLE level_gates
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Actualizar comentarios
COMMENT ON COLUMN level_gates.display_name IS 'Nombre mostrado del gate (opcional, para UI)';
COMMENT ON COLUMN level_gates.description IS 'Descripción del gate (opcional, para UI)';
COMMENT ON COLUMN level_gates.definition IS 'Definición JSONB del gate con Condition Engine v1 contract';

-- Índices adicionales para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_level_gates_line_level_status 
  ON level_gates(line_key, target_level_number, status) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_level_gates_line_status 
  ON level_gates(line_key, status) 
  WHERE status = 'active';

-- ============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================================
DO $$
BEGIN
  -- Verificar que las columnas existen
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'level_gates' AND column_name = 'display_name'
  ) THEN
    RAISE EXCEPTION 'MIGRATION FAILED: Columna display_name no existe';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'level_gates' AND column_name = 'description'
  ) THEN
    RAISE EXCEPTION 'MIGRATION FAILED: Columna description no existe';
  END IF;
  
  RAISE NOTICE 'MIGRATION SUCCESS: level_gates extendido correctamente';
END $$;
