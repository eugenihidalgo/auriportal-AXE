-- ============================================================================
-- Migración v5.34.0: Transmutaciones Energéticas - Alineación al Patrón Canónico SOT
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Alinea las tablas de transmutaciones energéticas al patrón canónico
--              de Source of Truth establecido en catalog-registry.
--
-- PRINCIPIOS:
-- 1. Status canónico: VARCHAR 'active'/'archived' en lugar de boolean activo
-- 2. Soft delete: Prohibir DELETE físico, usar status='archived'
-- 3. Auditoría: created_at y updated_at TIMESTAMPTZ obligatorios
-- 4. Triggers: Automatización de updated_at
-- 5. Migración de datos: Mapear activo (boolean) → status (VARCHAR)
-- ============================================================================

-- ============================================================================
-- 1. TABLA: listas_transmutaciones
-- ============================================================================

-- Añadir columna status si no existe
ALTER TABLE listas_transmutaciones
  ADD COLUMN IF NOT EXISTS status VARCHAR(20);

-- Asegurar que created_at existe con tipo correcto
ALTER TABLE listas_transmutaciones
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Asegurar que updated_at existe con tipo correcto (TIMESTAMPTZ)
DO $$
BEGIN
  -- Si updated_at existe pero no es TIMESTAMPTZ, convertir
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'listas_transmutaciones' 
    AND column_name = 'updated_at'
    AND data_type != 'timestamp with time zone'
  ) THEN
    ALTER TABLE listas_transmutaciones
      ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::TIMESTAMPTZ;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'listas_transmutaciones' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE listas_transmutaciones
      ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

-- Mapear activo (boolean) → status (VARCHAR)
-- activo = true → status = 'active'
-- activo = false → status = 'archived'
-- activo IS NULL → status = 'active' (default)
UPDATE listas_transmutaciones
SET status = CASE
  WHEN activo = true THEN 'active'
  WHEN activo = false THEN 'archived'
  ELSE 'active'
END
WHERE status IS NULL;

-- Establecer default y constraint
ALTER TABLE listas_transmutaciones
  ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE listas_transmutaciones
  ADD CONSTRAINT check_listas_transmutaciones_status 
  CHECK (status IN ('active', 'archived'));

-- Crear índice para status
CREATE INDEX IF NOT EXISTS idx_listas_transmutaciones_status 
  ON listas_transmutaciones(status) 
  WHERE status = 'active';

-- Comentarios para documentación
COMMENT ON COLUMN listas_transmutaciones.status IS 'Estado canónico del registro: active o archived (soft delete)';
COMMENT ON COLUMN listas_transmutaciones.created_at IS 'Fecha y hora de creación (TIMESTAMPTZ)';
COMMENT ON COLUMN listas_transmutaciones.updated_at IS 'Fecha y hora de última actualización (TIMESTAMPTZ, actualizado por trigger)';

-- ============================================================================
-- 2. TABLA: items_transmutaciones
-- ============================================================================

-- Añadir columna status si no existe
ALTER TABLE items_transmutaciones
  ADD COLUMN IF NOT EXISTS status VARCHAR(20);

-- Asegurar que created_at existe
ALTER TABLE items_transmutaciones
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Asegurar que updated_at existe con tipo correcto
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'items_transmutaciones' 
    AND column_name = 'updated_at'
    AND data_type != 'timestamp with time zone'
  ) THEN
    ALTER TABLE items_transmutaciones
      ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::TIMESTAMPTZ;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'items_transmutaciones' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE items_transmutaciones
      ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

-- Mapear activo (boolean) → status (VARCHAR)
UPDATE items_transmutaciones
SET status = CASE
  WHEN activo = true THEN 'active'
  WHEN activo = false THEN 'archived'
  ELSE 'active'
END
WHERE status IS NULL;

-- Establecer default y constraint
ALTER TABLE items_transmutaciones
  ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE items_transmutaciones
  ADD CONSTRAINT check_items_transmutaciones_status 
  CHECK (status IN ('active', 'archived'));

-- Crear índice para status
CREATE INDEX IF NOT EXISTS idx_items_transmutaciones_status 
  ON items_transmutaciones(status) 
  WHERE status = 'active';

-- Comentarios para documentación
COMMENT ON COLUMN items_transmutaciones.status IS 'Estado canónico del registro: active o archived (soft delete)';
COMMENT ON COLUMN items_transmutaciones.created_at IS 'Fecha y hora de creación (TIMESTAMPTZ)';
COMMENT ON COLUMN items_transmutaciones.updated_at IS 'Fecha y hora de última actualización (TIMESTAMPTZ, actualizado por trigger)';

-- ============================================================================
-- 3. TRIGGERS: Automatización de updated_at
-- ============================================================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_listas_transmutaciones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_items_transmutaciones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear triggers
DROP TRIGGER IF EXISTS trigger_update_listas_transmutaciones_updated_at ON listas_transmutaciones;
CREATE TRIGGER trigger_update_listas_transmutaciones_updated_at
  BEFORE UPDATE ON listas_transmutaciones
  FOR EACH ROW
  EXECUTE FUNCTION update_listas_transmutaciones_updated_at();

DROP TRIGGER IF EXISTS trigger_update_items_transmutaciones_updated_at ON items_transmutaciones;
CREATE TRIGGER trigger_update_items_transmutaciones_updated_at
  BEFORE UPDATE ON items_transmutaciones
  FOR EACH ROW
  EXECUTE FUNCTION update_items_transmutaciones_updated_at();

-- ============================================================================
-- 4. VERIFICACIÓN: Asegurar que todos los registros tienen status válido
-- ============================================================================

-- Actualizar cualquier registro que quede con status NULL
UPDATE listas_transmutaciones
SET status = 'active'
WHERE status IS NULL;

UPDATE items_transmutaciones
SET status = 'active'
WHERE status IS NULL;

-- ============================================================================
-- NOTAS IMPORTANTES:
-- ============================================================================
-- 1. La columna 'activo' (boolean) se mantiene por compatibilidad temporal
--    pero NO debe usarse en código nuevo. Usar 'status' siempre.
-- 2. DELETE físico está PROHIBIDO. Usar UPDATE SET status='archived' siempre.
-- 3. Todos los repos/services deben usar 'status', no 'activo'.
-- 4. En el futuro (Fase 2+), se puede eliminar la columna 'activo' si está
--    confirmado que ningún código legacy la usa.
-- ============================================================================


