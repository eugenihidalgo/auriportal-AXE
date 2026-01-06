-- ============================================================================
-- Migración v5.56.0: Sistema de Apadrinados (Sponsors) Canónico v1 + TARGET_REF_CONTRACT
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Creación del sistema canónico de apadrinados (sponsors) desde cero.
--              Modelo 2: "Apadrinado como Nodo personal dependiente"
--              Incluye TARGET_REF_CONTRACT v1 para integración con señales y automatizaciones.
--
-- PRINCIPIOS:
-- 1. Apadrinado es nodo personal dependiente de uno o varios alumnos (padrinos)
-- 2. Desaparece si el alumno se va (soft delete automático)
-- 3. Puede tener estados especiales temporales por categoría
-- 4. Gobernado exclusivamente por el Master
-- 5. TARGET_REF obligatorio en todas las respuestas (computable, no persistido)
-- ============================================================================

-- Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLA 1: sponsors_catalog (nodo apadrinado)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sponsors_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  description TEXT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_sponsors_catalog_active 
  ON sponsors_catalog(status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sponsors_catalog_deleted 
  ON sponsors_catalog(deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sponsors_catalog_display_name 
  ON sponsors_catalog(display_name) WHERE deleted_at IS NULL;

COMMENT ON TABLE sponsors_catalog IS 'Catálogo de apadrinados (nodos personales dependientes)';
COMMENT ON COLUMN sponsors_catalog.display_name IS 'Nombre del apadrinado';
COMMENT ON COLUMN sponsors_catalog.description IS 'Descripción opcional';
COMMENT ON COLUMN sponsors_catalog.status IS 'Estado: active (tiene vínculos activos) o archived (sin vínculos)';
COMMENT ON COLUMN sponsors_catalog.meta IS 'Metadatos JSONB (migración legacy, etc.)';
COMMENT ON COLUMN sponsors_catalog.deleted_at IS 'Soft delete timestamp';

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_sponsors_catalog_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_sponsors_catalog_updated_at ON sponsors_catalog;
CREATE TRIGGER trigger_update_sponsors_catalog_updated_at
  BEFORE UPDATE ON sponsors_catalog
  FOR EACH ROW
  EXECUTE FUNCTION update_sponsors_catalog_updated_at();

-- ============================================================================
-- TABLA 2: sponsor_student_links (N:M sponsor ↔ alumno)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sponsor_student_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id UUID NOT NULL REFERENCES sponsors_catalog(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'padrino' CHECK (role IN ('padrino')),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_sponsor_links_sponsor 
  ON sponsor_student_links(sponsor_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sponsor_links_student 
  ON sponsor_student_links(student_id) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sponsor_links_unique_active 
  ON sponsor_student_links(sponsor_id, student_id) WHERE deleted_at IS NULL;

COMMENT ON TABLE sponsor_student_links IS 'Vínculos entre apadrinados y alumnos (padrinos)';
COMMENT ON COLUMN sponsor_student_links.sponsor_id IS 'ID del apadrinado';
COMMENT ON COLUMN sponsor_student_links.student_id IS 'ID del alumno (padrino)';
COMMENT ON COLUMN sponsor_student_links.role IS 'Rol del alumno (siempre padrino en v1)';
COMMENT ON COLUMN sponsor_student_links.deleted_at IS 'Soft delete timestamp';

-- ============================================================================
-- TABLA 3: sponsor_special_care (estados especiales temporales por categoría)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sponsor_special_care (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id UUID NOT NULL REFERENCES sponsors_catalog(id) ON DELETE CASCADE,
  category_term_id UUID NOT NULL REFERENCES pde_classification_terms(id) ON DELETE RESTRICT,
  starts_at TIMESTAMP NOT NULL DEFAULT now(),
  ends_at TIMESTAMP NOT NULL,
  priority INT NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_sponsor_care_sponsor 
  ON sponsor_special_care(sponsor_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sponsor_care_active 
  ON sponsor_special_care(ends_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sponsor_care_category 
  ON sponsor_special_care(category_term_id) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sponsor_care_unique_active 
  ON sponsor_special_care(sponsor_id, category_term_id) WHERE deleted_at IS NULL;

COMMENT ON TABLE sponsor_special_care IS 'Estados especiales temporales por categoría de apadrinados';
COMMENT ON COLUMN sponsor_special_care.sponsor_id IS 'ID del apadrinado';
COMMENT ON COLUMN sponsor_special_care.category_term_id IS 'ID del término de clasificación (categoría)';
COMMENT ON COLUMN sponsor_special_care.starts_at IS 'Inicio del cuidado especial';
COMMENT ON COLUMN sponsor_special_care.ends_at IS 'Fin del cuidado especial';
COMMENT ON COLUMN sponsor_special_care.priority IS 'Prioridad (mayor = más importante)';
COMMENT ON COLUMN sponsor_special_care.notes IS 'Notas opcionales';
COMMENT ON COLUMN sponsor_special_care.deleted_at IS 'Soft delete timestamp';

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_sponsor_special_care_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_sponsor_special_care_updated_at ON sponsor_special_care;
CREATE TRIGGER trigger_update_sponsor_special_care_updated_at
  BEFORE UPDATE ON sponsor_special_care
  FOR EACH ROW
  EXECUTE FUNCTION update_sponsor_special_care_updated_at();

-- ============================================================================
-- TABLA 4: sponsor_special_care_lists (asociación care ↔ lista alquimia)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sponsor_special_care_lists (
  care_id UUID NOT NULL REFERENCES sponsor_special_care(id) ON DELETE CASCADE,
  transmutation_list_id INTEGER NOT NULL REFERENCES listas_transmutaciones(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY (care_id, transmutation_list_id)
);

CREATE INDEX IF NOT EXISTS idx_sponsor_care_lists_care 
  ON sponsor_special_care_lists(care_id);

CREATE INDEX IF NOT EXISTS idx_sponsor_care_lists_list 
  ON sponsor_special_care_lists(transmutation_list_id);

COMMENT ON TABLE sponsor_special_care_lists IS 'Asociación entre cuidados especiales y listas de alquimia';
COMMENT ON COLUMN sponsor_special_care_lists.care_id IS 'ID del cuidado especial';
COMMENT ON COLUMN sponsor_special_care_lists.transmutation_list_id IS 'ID de la lista de transmutaciones';

-- ============================================================================
-- OWNERSHIP
-- ============================================================================

ALTER TABLE IF EXISTS public.sponsors_catalog OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.sponsor_student_links OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.sponsor_special_care OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.sponsor_special_care_lists OWNER TO aurelinportal;

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

DO $$
BEGIN
  -- Verificar que pde_classification_terms existe
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pde_classification_terms') THEN
    RAISE EXCEPTION 'Tabla pde_classification_terms no existe. Debe crearse antes de esta migración.';
  END IF;
  
  -- Verificar que listas_transmutaciones existe
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'listas_transmutaciones') THEN
    RAISE EXCEPTION 'Tabla listas_transmutaciones no existe. Debe crearse antes de esta migración.';
  END IF;
  
  -- Verificar que alumnos existe
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'alumnos') THEN
    RAISE EXCEPTION 'Tabla alumnos no existe. Debe crearse antes de esta migración.';
  END IF;
END $$;
