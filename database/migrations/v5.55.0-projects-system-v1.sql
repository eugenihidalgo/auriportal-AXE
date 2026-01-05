-- ============================================================================
-- Migración v5.55.0: Sistema de Proyectos Canónico v1
-- ============================================================================
-- Fecha: 2026-01-05
-- Descripción: Creación del sistema canónico de proyectos desde cero.
--              Espejo del sistema de Lugares (v5.54.0).
--
-- PRINCIPIOS:
-- 1. Sistema canónico con separación clara: catálogo, estado, límites
-- 2. Preparado para UTEs, automatizaciones y paquetes
-- 3. Señales integradas desde el inicio
-- 4. Reutiliza funciones SQL genéricas de Lugares
-- ============================================================================

-- ============================================================================
-- PARTE 1: CLASIFICACIONES DE PROYECTOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_categories (
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

CREATE INDEX IF NOT EXISTS idx_project_categories_active ON project_categories(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_project_categories_sort ON project_categories(sort_order) WHERE deleted_at IS NULL;

COMMENT ON TABLE project_categories IS 'Clasificaciones de proyectos (categorías)';
COMMENT ON COLUMN project_categories.category_key IS 'Clave única de la categoría';
COMMENT ON COLUMN project_categories.default_recurrence_days IS 'Días de recurrencia por defecto para esta categoría';
COMMENT ON COLUMN project_categories.sort_order IS 'Orden de visualización';
COMMENT ON COLUMN project_categories.deleted_at IS 'Soft delete timestamp';

-- ============================================================================
-- PARTE 2: CATÁLOGO DE PROYECTOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS projects_catalog (
  id SERIAL PRIMARY KEY,
  project_key VARCHAR(100) UNIQUE NOT NULL,
  category_id INT NOT NULL REFERENCES project_categories(id) ON DELETE RESTRICT,
  base_name VARCHAR(200) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_catalog_category ON projects_catalog(category_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_catalog_key ON projects_catalog(project_key) WHERE deleted_at IS NULL;

COMMENT ON TABLE projects_catalog IS 'Catálogo canónico de proyectos (sin personalización)';
COMMENT ON COLUMN projects_catalog.project_key IS 'Clave única del proyecto';
COMMENT ON COLUMN projects_catalog.base_name IS 'Nombre genérico del proyecto';
COMMENT ON COLUMN projects_catalog.deleted_at IS 'Soft delete timestamp';

-- ============================================================================
-- PARTE 3: ESTADO ALUMNO-PROYECTO
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_project_state (
  id SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  project_id INT NOT NULL REFERENCES projects_catalog(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  is_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  custom_name VARCHAR(200) NULL,
  description TEXT NULL,
  recurrence_days INT NOT NULL DEFAULT 30,
  last_cleaned_at TIMESTAMPTZ NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_student_project UNIQUE(student_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_student_project_state_student ON student_project_state(student_id);
CREATE INDEX IF NOT EXISTS idx_student_project_state_project ON student_project_state(project_id);
CREATE INDEX IF NOT EXISTS idx_student_project_state_active ON student_project_state(student_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_student_project_state_reviewed ON student_project_state(student_id, is_reviewed) WHERE is_reviewed = FALSE;

COMMENT ON TABLE student_project_state IS 'Estado de proyectos por alumno (activación, limpieza, personalización)';
COMMENT ON COLUMN student_project_state.is_active IS 'Si el proyecto está activo para el alumno';
COMMENT ON COLUMN student_project_state.is_reviewed IS 'Si el proyecto ha sido limpiado/revisado';
COMMENT ON COLUMN student_project_state.custom_name IS 'Nombre personalizado del proyecto (opcional)';
COMMENT ON COLUMN student_project_state.recurrence_days IS 'Días de recurrencia para este proyecto específico';
COMMENT ON COLUMN student_project_state.last_cleaned_at IS 'Última fecha de limpieza';

-- ============================================================================
-- PARTE 4: VERIFICACIÓN DE student_activation_limits
-- ============================================================================

-- Verificar que student_activation_limits ya soporta domain='projects'
-- (fue creado en v5.54.0 con CHECK (domain IN ('places', 'projects')))
-- Si no existe la constraint, la añadimos (pero debería existir)
-- NOTA: Este bloque se ejecuta por separado si es necesario

-- ============================================================================
-- PARTE 5: FUNCIONES DE SALUD (REUTILIZADAS DE LUGARES)
-- ============================================================================

-- Las funciones calculate_days_since_clean y calculate_health_status
-- ya existen en v5.54.0 y son genéricas (no específicas de lugares).
-- Se reutilizan sin cambios.
-- Si no existen (por alguna razón), se crean aquí.

-- Verificar y crear calculate_days_since_clean si no existe
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

COMMENT ON FUNCTION calculate_days_since_clean IS 'Calcula días desde última limpieza (genérica para lugares y proyectos)';

-- Verificar y crear calculate_health_status si no existe
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

COMMENT ON FUNCTION calculate_health_status IS 'Calcula estado de salud (green/yellow/red) - genérica para lugares y proyectos';

-- ============================================================================
-- PARTE 6: TRIGGERS PARA UPDATED_AT
-- ============================================================================

-- La función update_updated_at_column() ya existe en v5.54.0
-- Solo creamos los triggers específicos para proyectos

DROP TRIGGER IF EXISTS update_project_categories_updated_at ON project_categories;
CREATE TRIGGER update_project_categories_updated_at
  BEFORE UPDATE ON project_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_student_project_state_updated_at ON student_project_state;
CREATE TRIGGER update_student_project_state_updated_at
  BEFORE UPDATE ON student_project_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PARTE 7: DATOS INICIALES (CATEGORÍAS POR DEFECTO)
-- ============================================================================

-- Insertar categorías por defecto para proyectos
INSERT INTO project_categories (category_key, name, default_recurrence_days, sort_order, is_active)
VALUES 
  ('proyecto_principal', 'Proyecto Principal', 30, 1, TRUE),
  ('proyecto_secundario', 'Proyecto Secundario', 45, 2, TRUE),
  ('proyecto_familiar', 'Proyecto Familiar', 60, 3, TRUE),
  ('proyecto_trabajo', 'Proyecto de Trabajo', 30, 4, TRUE),
  ('proyecto_sanacion', 'Proyecto de Sanación', 30, 5, TRUE),
  ('otro', 'Otro', 30, 6, TRUE)
ON CONFLICT (category_key) DO NOTHING;

-- ============================================================================
-- PARTE 8: PERMISOS
-- ============================================================================

ALTER TABLE project_categories OWNER TO aurelinportal;
ALTER TABLE projects_catalog OWNER TO aurelinportal;
ALTER TABLE student_project_state OWNER TO aurelinportal;

-- ============================================================================
-- FIN DE MIGRACIÓN
-- ============================================================================
