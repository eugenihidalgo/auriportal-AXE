-- ============================================
-- MIGRACIÓN: v5.23.0-transmutaciones-classification-v1
-- ============================================
-- Sistema de clasificación semántica para listas de transmutaciones energéticas
-- Permite categorías, subtipos y tags para clasificar listas dinámicamente
-- ============================================

-- ============================================
-- TABLA 1: Categorías
-- ============================================
CREATE TABLE IF NOT EXISTS pde_transmutation_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transmutation_categories_key ON pde_transmutation_categories(category_key);
CREATE INDEX IF NOT EXISTS idx_transmutation_categories_active ON pde_transmutation_categories(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_transmutation_categories_sort ON pde_transmutation_categories(sort_order, label);

-- ============================================
-- TABLA 2: Subtipos (NO requieren categoría)
-- ============================================
CREATE TABLE IF NOT EXISTS pde_transmutation_subtypes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subtype_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transmutation_subtypes_key ON pde_transmutation_subtypes(subtype_key);
CREATE INDEX IF NOT EXISTS idx_transmutation_subtypes_active ON pde_transmutation_subtypes(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_transmutation_subtypes_sort ON pde_transmutation_subtypes(sort_order, label);

-- ============================================
-- TABLA 3: Tags
-- ============================================
CREATE TABLE IF NOT EXISTS pde_transmutation_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transmutation_tags_key ON pde_transmutation_tags(tag_key);
CREATE INDEX IF NOT EXISTS idx_transmutation_tags_active ON pde_transmutation_tags(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_transmutation_tags_sort ON pde_transmutation_tags(sort_order, label);

-- ============================================
-- AÑADIR COLUMNAS A listas_transmutaciones
-- ============================================
ALTER TABLE listas_transmutaciones
  ADD COLUMN IF NOT EXISTS category_key TEXT,
  ADD COLUMN IF NOT EXISTS subtype_key TEXT,
  ADD COLUMN IF NOT EXISTS tags JSONB;

-- ============================================
-- ÍNDICES PARA listas_transmutaciones
-- ============================================
CREATE INDEX IF NOT EXISTS idx_transmutation_lists_category ON listas_transmutaciones(category_key) WHERE category_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transmutation_lists_subtype ON listas_transmutaciones(subtype_key) WHERE subtype_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transmutation_lists_tags_gin ON listas_transmutaciones USING GIN (tags) WHERE tags IS NOT NULL;

-- ============================================
-- SEMILLAS MÍNIMAS
-- ============================================

-- Subtipo CRÍTICO: energia_indeseable
INSERT INTO pde_transmutation_subtypes (subtype_key, label, description, sort_order, is_active)
VALUES ('energia_indeseable', 'Energías indeseables', 'Listas de transmutaciones para energías indeseables', 10, TRUE)
ON CONFLICT (subtype_key) DO NOTHING;

-- Categorías iniciales sugeridas
INSERT INTO pde_transmutation_categories (category_key, label, description, sort_order, is_active)
VALUES 
  ('limpieza_recurrente', 'Limpiezas Recurrentes', 'Limpiezas que se realizan periódicamente', 10, TRUE),
  ('limpieza_puntual', 'Limpiezas de Una Sola Vez', 'Limpiezas que se realizan una sola vez', 20, TRUE),
  ('hogar', 'Hogar', 'Transmutaciones relacionadas con el hogar', 30, TRUE),
  ('karma', 'Karmas', 'Transmutaciones relacionadas con karmas', 40, TRUE),
  ('anatomia_energetica', 'Anatomía energética', 'Transmutaciones relacionadas con anatomía energética', 50, TRUE),
  ('relacion_entorno', 'Relación con apadrinados / entorno', 'Transmutaciones relacionadas con relaciones y entorno', 60, TRUE),
  ('otros', 'Otros', 'Otras categorías de transmutaciones', 100, TRUE)
ON CONFLICT (category_key) DO NOTHING;

-- ============================================
-- BACKFILL NO DESTRUCTIVO
-- ============================================
-- Intentar inferir category_key desde el campo 'tipo' existente
-- Si tipo = 'recurrente' → category_key = 'limpieza_recurrente'
-- Si tipo = 'una_vez' → category_key = 'limpieza_puntual'
-- Solo si category_key es NULL (no sobrescribir si ya existe)

UPDATE listas_transmutaciones
SET category_key = CASE 
  WHEN tipo = 'recurrente' THEN 'limpieza_recurrente'
  WHEN tipo = 'una_vez' THEN 'limpieza_puntual'
  ELSE NULL
END
WHERE category_key IS NULL;

-- ============================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ============================================
COMMENT ON TABLE pde_transmutation_categories IS 'Categorías canónicas para clasificar listas de transmutaciones (definidas por Master desde UI)';
COMMENT ON TABLE pde_transmutation_subtypes IS 'Subtipos para clasificar listas de transmutaciones (independientes de categorías, p.ej. energia_indeseable)';
COMMENT ON TABLE pde_transmutation_tags IS 'Tags opcionales para clasificar listas de transmutaciones (multivalor)';
COMMENT ON COLUMN listas_transmutaciones.category_key IS 'Clave de categoría (opcional, referencia a pde_transmutation_categories)';
COMMENT ON COLUMN listas_transmutaciones.subtype_key IS 'Clave de subtipo (opcional, independiente de categoría, referencia a pde_transmutation_subtypes)';
COMMENT ON COLUMN listas_transmutaciones.tags IS 'Array JSONB de tag_key strings (opcional, referencia a pde_transmutation_tags)';








