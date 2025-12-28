-- ============================================================================
-- Migración v5.38.0: Técnicas de Limpieza - Alineación al Patrón Canónico SOT
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Alinea la tabla tecnicas_limpieza al patrón canónico de Source of Truth
--              establecido, añadiendo status, triggers y asegurando campos de auditoría.
--
-- PRINCIPIOS:
-- 1. Status canónico: VARCHAR 'active'/'archived' en lugar de boolean activo
-- 2. Soft delete: Usar status='archived' para archivar (delete físico permitido también)
-- 3. Auditoría: created_at y updated_at TIMESTAMPTZ obligatorios
-- 4. Triggers: Automatización de updated_at
-- 5. Migración de datos: Mapear activo (boolean) → status (VARCHAR)
-- ============================================================================

-- ============================================================================
-- 1. AÑADIR COLUMNAS CANÓNICAS SI NO EXISTEN
-- ============================================================================

-- Añadir columna status si no existe
ALTER TABLE tecnicas_limpieza
  ADD COLUMN IF NOT EXISTS status VARCHAR(20);

-- Asegurar que created_at existe con tipo correcto
ALTER TABLE tecnicas_limpieza
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Asegurar que updated_at existe con tipo correcto (TIMESTAMPTZ)
DO $$
BEGIN
  -- Si updated_at existe pero no es TIMESTAMPTZ, convertir
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tecnicas_limpieza' 
    AND column_name = 'updated_at'
    AND data_type != 'timestamp with time zone'
  ) THEN
    ALTER TABLE tecnicas_limpieza
      ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::TIMESTAMPTZ;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tecnicas_limpieza' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE tecnicas_limpieza
      ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

-- ============================================================================
-- 2. MIGRAR DATOS: activo (boolean) → status (VARCHAR)
-- ============================================================================

-- Mapear activo (boolean) → status (VARCHAR)
-- activo = true → status = 'active'
-- activo = false → status = 'archived'
-- activo IS NULL → status = 'active' (default)
UPDATE tecnicas_limpieza
SET status = CASE
  WHEN activo = true THEN 'active'
  WHEN activo = false THEN 'archived'
  ELSE 'active'
END
WHERE status IS NULL;

-- ============================================================================
-- 3. ESTABLECER CONSTRAINTS Y DEFAULTS
-- ============================================================================

-- Establecer default y constraint
ALTER TABLE tecnicas_limpieza
  ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE tecnicas_limpieza
  ALTER COLUMN status SET NOT NULL;

-- Añadir constraint si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_tecnicas_limpieza_status'
  ) THEN
    ALTER TABLE tecnicas_limpieza
      ADD CONSTRAINT check_tecnicas_limpieza_status 
      CHECK (status IN ('active', 'archived'));
  END IF;
END $$;

-- ============================================================================
-- 4. ÍNDICES PARA BÚSQUEDA EFICIENTE
-- ============================================================================

-- Índice por status
CREATE INDEX IF NOT EXISTS idx_tecnicas_limpieza_status 
  ON tecnicas_limpieza(status) 
  WHERE status = 'active';

-- Índice por nivel (si no existe)
CREATE INDEX IF NOT EXISTS idx_tecnicas_limpieza_nivel 
  ON tecnicas_limpieza(nivel) 
  WHERE status = 'active';

-- Índice compuesto nivel + created_at para ordenamiento
CREATE INDEX IF NOT EXISTS idx_tecnicas_limpieza_nivel_created 
  ON tecnicas_limpieza(nivel ASC, created_at ASC) 
  WHERE status = 'active';

-- ============================================================================
-- 5. TRIGGERS: Automatización de updated_at
-- ============================================================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_tecnicas_limpieza_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger
DROP TRIGGER IF EXISTS trigger_update_tecnicas_limpieza_updated_at ON tecnicas_limpieza;
CREATE TRIGGER trigger_update_tecnicas_limpieza_updated_at
  BEFORE UPDATE ON tecnicas_limpieza
  FOR EACH ROW
  EXECUTE FUNCTION update_tecnicas_limpieza_updated_at();

-- ============================================================================
-- 6. COMENTARIOS PARA DOCUMENTACIÓN
-- ============================================================================

COMMENT ON COLUMN tecnicas_limpieza.status IS 'Estado canónico del registro: active o archived (soft delete). Usar este campo en lugar de activo.';
COMMENT ON COLUMN tecnicas_limpieza.created_at IS 'Fecha y hora de creación (TIMESTAMPTZ)';
COMMENT ON COLUMN tecnicas_limpieza.updated_at IS 'Fecha y hora de última actualización (TIMESTAMPTZ, actualizado por trigger)';

-- ============================================================================
-- 7. VERIFICACIÓN: Asegurar que todos los registros tienen status válido
-- ============================================================================

-- Actualizar cualquier registro que quede con status NULL
UPDATE tecnicas_limpieza
SET status = 'active'
WHERE status IS NULL;

-- ============================================================================
-- NOTAS IMPORTANTES:
-- ============================================================================
-- 1. La columna 'activo' (boolean) se mantiene por compatibilidad temporal
--    pero NO debe usarse en código nuevo. Usar 'status' siempre.
-- 2. Para soft delete, usar UPDATE SET status='archived'
-- 3. Para delete físico, usar DELETE directamente (está permitido según requerimientos)
-- 4. Todos los repos/services deben usar 'status', no 'activo'.
-- 5. Ordenamiento canónico: level ASC, created_at ASC
-- ============================================================================



