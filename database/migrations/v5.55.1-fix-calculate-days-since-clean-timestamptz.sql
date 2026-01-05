-- ============================================================================
-- Migración v5.55.1: Fix calculate_days_since_clean para aceptar TIMESTAMPTZ
-- ============================================================================
-- Fecha: 2026-01-05
-- Descripción: Actualiza la función calculate_days_since_clean para aceptar
--              tanto TIMESTAMP como TIMESTAMPTZ (necesario para proyectos).
--              La función debe ser compatible con ambas columnas.
-- ============================================================================

-- Actualizar función para aceptar TIMESTAMPTZ (primero eliminar la antigua si existe)
DROP FUNCTION IF EXISTS calculate_days_since_clean(TIMESTAMP, INT);

-- Crear función que acepta TIMESTAMPTZ (compatible con proyectos)
CREATE OR REPLACE FUNCTION calculate_days_since_clean(
  p_last_cleaned_at TIMESTAMPTZ,
  p_recurrence_days INT
) RETURNS INT AS $$
BEGIN
  IF p_last_cleaned_at IS NULL THEN
    RETURN 999; -- Nunca limpiado
  END IF;
  RETURN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - p_last_cleaned_at))::INT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Crear sobrecarga para TIMESTAMP (compatibilidad con lugares)
CREATE OR REPLACE FUNCTION calculate_days_since_clean(
  p_last_cleaned_at TIMESTAMP,
  p_recurrence_days INT
) RETURNS INT AS $$
BEGIN
  IF p_last_cleaned_at IS NULL THEN
    RETURN 999; -- Nunca limpiado
  END IF;
  RETURN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - p_last_cleaned_at::TIMESTAMPTZ))::INT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_days_since_clean(TIMESTAMPTZ, INT) IS 'Calcula días desde última limpieza (acepta TIMESTAMPTZ para proyectos)';
COMMENT ON FUNCTION calculate_days_since_clean(TIMESTAMP, INT) IS 'Calcula días desde última limpieza (acepta TIMESTAMP para lugares)';
