-- ============================================================================
-- Migración v5.54.0: Sistema de Lugares Canónico v1
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Eliminación total del legacy de lugares/proyectos y creación
--              del sistema canónico de lugares desde cero.
--
-- PRINCIPIOS:
-- 1. Eliminación total del legacy (sin migración de datos)
-- 2. Modelo canónico con separación clara: catálogo, estado, límites
-- 3. Preparado para UTEs, automatizaciones y paquetes
-- 4. Señales integradas desde el inicio
-- ============================================================================

-- ============================================================================
-- PARTE 1: ELIMINACIÓN DE LEGACY (OBLIGATORIO)
-- ============================================================================

-- Eliminar tablas legacy de lugares y proyectos
-- NO migrar datos, eliminar completamente

DROP TABLE IF EXISTS transmutaciones_lugares_estado CASCADE;
DROP TABLE IF EXISTS transmutaciones_lugares CASCADE;
DROP TABLE IF EXISTS alumnos_lugares CASCADE;
DROP TABLE IF EXISTS transmutaciones_proyectos_estado CASCADE;
DROP TABLE IF EXISTS transmutaciones_proyectos CASCADE;
DROP TABLE IF EXISTS alumnos_proyectos CASCADE;

-- ============================================================================
-- PARTE 2: CLASIFICACIONES DE LUGARES
-- ============================================================================

CREATE TABLE IF NOT EXISTS place_categories (
  id SERIAL PRIMARY KEY,
  category_key VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  default_recurrence_days INT NOT NULL DEFAULT 30,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_place_categories_active ON place_categories(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_place_categories_sort ON place_categories(sort_order) WHERE deleted_at IS NULL;

COMMENT ON TABLE place_categories IS 'Clasificaciones de lugares (categorías)';
COMMENT ON COLUMN place_categories.category_key IS 'Clave única de la categoría';
COMMENT ON COLUMN place_categories.default_recurrence_days IS 'Días de recurrencia por defecto para esta categoría';
COMMENT ON COLUMN place_categories.sort_order IS 'Orden de visualización';
COMMENT ON COLUMN place_categories.deleted_at IS 'Soft delete timestamp';

-- ============================================================================
-- PARTE 3: CATÁLOGO DE LUGARES
-- ============================================================================

CREATE TABLE IF NOT EXISTS places_catalog (
  id SERIAL PRIMARY KEY,
  place_key VARCHAR(100) UNIQUE NOT NULL,
  category_id INT NOT NULL REFERENCES place_categories(id) ON DELETE RESTRICT,
  base_name VARCHAR(200) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_places_catalog_category ON places_catalog(category_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_places_catalog_key ON places_catalog(place_key) WHERE deleted_at IS NULL;

COMMENT ON TABLE places_catalog IS 'Catálogo canónico de lugares (sin personalización)';
COMMENT ON COLUMN places_catalog.place_key IS 'Clave única del lugar';
COMMENT ON COLUMN places_catalog.base_name IS 'Nombre genérico del lugar';
COMMENT ON COLUMN places_catalog.deleted_at IS 'Soft delete timestamp';

-- ============================================================================
-- PARTE 4: ESTADO ALUMNO-LUGAR
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_place_state (
  id SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  place_id INT NOT NULL REFERENCES places_catalog(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  is_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  custom_name VARCHAR(200) NULL,
  description TEXT NULL,
  recurrence_days INT NOT NULL DEFAULT 30,
  last_cleaned_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_student_place UNIQUE(student_id, place_id)
);

CREATE INDEX IF NOT EXISTS idx_student_place_state_student ON student_place_state(student_id);
CREATE INDEX IF NOT EXISTS idx_student_place_state_place ON student_place_state(place_id);
CREATE INDEX IF NOT EXISTS idx_student_place_state_active ON student_place_state(student_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_student_place_state_reviewed ON student_place_state(student_id, is_reviewed) WHERE is_reviewed = FALSE;

COMMENT ON TABLE student_place_state IS 'Estado de lugares por alumno (activación, limpieza, personalización)';
COMMENT ON COLUMN student_place_state.is_active IS 'Si el lugar está activo para el alumno';
COMMENT ON COLUMN student_place_state.is_reviewed IS 'Si el lugar ha sido limpiado/revisado';
COMMENT ON COLUMN student_place_state.custom_name IS 'Nombre personalizado del lugar (opcional)';
COMMENT ON COLUMN student_place_state.recurrence_days IS 'Días de recurrencia para este lugar específico';
COMMENT ON COLUMN student_place_state.last_cleaned_at IS 'Última fecha de limpieza';

-- ============================================================================
-- PARTE 5: LÍMITES DE ACTIVACIÓN POR ALUMNO
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_activation_limits (
  id SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  domain VARCHAR(50) NOT NULL CHECK (domain IN ('places', 'projects')),
  activation_limit INT NULL CHECK (activation_limit IS NULL OR activation_limit > 0),
  source VARCHAR(50) NOT NULL DEFAULT 'default' CHECK (source IN ('default', 'master', 'automation')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_student_domain UNIQUE(student_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_student_activation_limits_student ON student_activation_limits(student_id);
CREATE INDEX IF NOT EXISTS idx_student_activation_limits_domain ON student_activation_limits(domain);

COMMENT ON TABLE student_activation_limits IS 'Límites de activación por dominio (places, projects)';
COMMENT ON COLUMN student_activation_limits.activation_limit IS 'Límite de activaciones (NULL = ilimitado)';
COMMENT ON COLUMN student_activation_limits.source IS 'Origen del límite (default, master, automation)';

-- ============================================================================
-- PARTE 6: DATOS INICIALES (CATEGORÍAS POR DEFECTO)
-- ============================================================================

-- Insertar categorías por defecto (más potentes según diseño)
INSERT INTO place_categories (category_key, name, default_recurrence_days, sort_order, is_active)
VALUES 
  ('lugar_meditacion', 'Lugar de meditación', 30, 1, TRUE),
  ('casa', 'Casa', 30, 2, TRUE),
  ('segunda_residencia', 'Segunda residencia', 45, 3, TRUE),
  ('trabajo', 'Trabajo', 30, 4, TRUE),
  ('casa_ajena', 'Casa ajena', 90, 5, TRUE),
  ('otro', 'Otro', 30, 6, TRUE)
ON CONFLICT (category_key) DO NOTHING;

-- ============================================================================
-- PARTE 7: FUNCIONES DE SALUD (BACKEND)
-- ============================================================================

-- Función para calcular días desde limpieza
CREATE OR REPLACE FUNCTION calculate_days_since_clean(
  p_last_cleaned_at TIMESTAMP,
  p_recurrence_days INT
) RETURNS INT AS $$
BEGIN
  IF p_last_cleaned_at IS NULL THEN
    RETURN 999; -- Nunca limpiado
  END IF;
  RETURN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - p_last_cleaned_at))::INT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Función para calcular estado de salud
CREATE OR REPLACE FUNCTION calculate_health_status(
  p_days_since_clean INT,
  p_recurrence_days INT
) RETURNS VARCHAR(20) AS $$
BEGIN
  IF p_days_since_clean <= p_recurrence_days THEN
    RETURN 'green';
  ELSIF p_days_since_clean <= (p_recurrence_days * 2) THEN
    RETURN 'yellow';
  ELSE
    RETURN 'red';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_days_since_clean IS 'Calcula días desde última limpieza';
COMMENT ON FUNCTION calculate_health_status IS 'Calcula estado de salud (green/yellow/red)';

-- ============================================================================
-- PARTE 8: TRIGGERS PARA UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_place_categories_updated_at ON place_categories;
CREATE TRIGGER update_place_categories_updated_at
  BEFORE UPDATE ON place_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_student_place_state_updated_at ON student_place_state;
CREATE TRIGGER update_student_place_state_updated_at
  BEFORE UPDATE ON student_place_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_student_activation_limits_updated_at ON student_activation_limits;
CREATE TRIGGER update_student_activation_limits_updated_at
  BEFORE UPDATE ON student_activation_limits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PARTE 9: PERMISOS
-- ============================================================================

ALTER TABLE place_categories OWNER TO aurelinportal;
ALTER TABLE places_catalog OWNER TO aurelinportal;
ALTER TABLE student_place_state OWNER TO aurelinportal;
ALTER TABLE student_activation_limits OWNER TO aurelinportal;
