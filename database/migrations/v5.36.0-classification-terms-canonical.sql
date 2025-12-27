-- ============================================================================
-- Migración v5.36.0: Sistema Canónico de Clasificaciones Reutilizables
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Sistema unificado de términos de clasificación canónicos
--              que reemplaza las tablas separadas por un sistema unificado.
--
-- PRINCIPIOS:
-- 1. Un solo vocabulario canónico para keys, subkeys y tags
-- 2. Normalización automática (lowercase + sin acentos)
-- 3. Auto-creación al usar (idempotente)
-- 4. Reutilizable entre listas y futuras pantallas PDE
-- ============================================================================

-- ============================================================================
-- 1. TABLA CANÓNICA: pde_classification_terms
-- ============================================================================

CREATE TABLE IF NOT EXISTS pde_classification_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('key', 'subkey', 'tag')),
  value TEXT NOT NULL,
  normalized TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_classification_term UNIQUE (type, normalized)
);

CREATE INDEX IF NOT EXISTS idx_classification_terms_type ON pde_classification_terms(type);
CREATE INDEX IF NOT EXISTS idx_classification_terms_normalized ON pde_classification_terms(normalized);
CREATE INDEX IF NOT EXISTS idx_classification_terms_type_normalized ON pde_classification_terms(type, normalized);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_classification_terms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_classification_terms_updated_at
  BEFORE UPDATE ON pde_classification_terms
  FOR EACH ROW
  EXECUTE FUNCTION update_classification_terms_updated_at();

-- Comentarios
COMMENT ON TABLE pde_classification_terms IS 'Vocabulario canónico de términos de clasificación (keys, subkeys, tags) - Source of Truth';
COMMENT ON COLUMN pde_classification_terms.type IS 'Tipo de término: key (category), subkey (subtype), tag';
COMMENT ON COLUMN pde_classification_terms.value IS 'Valor original del término (ej: "Energía Indeseable")';
COMMENT ON COLUMN pde_classification_terms.normalized IS 'Valor normalizado (lowercase + sin acentos) para comparación';
COMMENT ON CONSTRAINT unique_classification_term ON pde_classification_terms IS 'Garantiza que no haya duplicados por tipo y valor normalizado';

-- ============================================================================
-- 2. FUNCIÓN: Normalizar término (lowercase + sin acentos)
-- ============================================================================

CREATE OR REPLACE FUNCTION normalize_classification_term(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Convertir a lowercase
  input_text := LOWER(input_text);
  
  -- Eliminar acentos y caracteres especiales
  input_text := REPLACE(input_text, 'á', 'a');
  input_text := REPLACE(input_text, 'é', 'e');
  input_text := REPLACE(input_text, 'í', 'i');
  input_text := REPLACE(input_text, 'ó', 'o');
  input_text := REPLACE(input_text, 'ú', 'u');
  input_text := REPLACE(input_text, 'ñ', 'n');
  input_text := REPLACE(input_text, 'ü', 'u');
  input_text := REPLACE(input_text, 'Á', 'a');
  input_text := REPLACE(input_text, 'É', 'e');
  input_text := REPLACE(input_text, 'Í', 'i');
  input_text := REPLACE(input_text, 'Ó', 'o');
  input_text := REPLACE(input_text, 'Ú', 'u');
  input_text := REPLACE(input_text, 'Ñ', 'n');
  input_text := REPLACE(input_text, 'Ü', 'u');
  
  -- Eliminar espacios extra y trim
  input_text := TRIM(REGEXP_REPLACE(input_text, '\s+', ' ', 'g'));
  
  RETURN input_text;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION normalize_classification_term IS 'Normaliza un término de clasificación (lowercase + sin acentos)';

-- ============================================================================
-- 3. TABLA DE RELACIÓN: transmutacion_lista_classifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS transmutacion_lista_classifications (
  lista_id INTEGER NOT NULL,
  classification_term_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (lista_id, classification_term_id),
  FOREIGN KEY (lista_id) REFERENCES listas_transmutaciones(id) ON DELETE CASCADE,
  FOREIGN KEY (classification_term_id) REFERENCES pde_classification_terms(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transmutacion_lista_classifications_lista ON transmutacion_lista_classifications(lista_id);
CREATE INDEX IF NOT EXISTS idx_transmutacion_lista_classifications_term ON transmutacion_lista_classifications(classification_term_id);

COMMENT ON TABLE transmutacion_lista_classifications IS 'Asociación many-to-many entre listas de transmutaciones y términos de clasificación canónicos';

-- ============================================================================
-- 4. FUNCIÓN: ensure_classification_term (idempotente)
-- ============================================================================

CREATE OR REPLACE FUNCTION ensure_classification_term(
  p_type TEXT,
  p_value TEXT
)
RETURNS UUID AS $$
DECLARE
  v_normalized TEXT;
  v_term_id UUID;
BEGIN
  -- Normalizar el valor
  v_normalized := normalize_classification_term(p_value);
  
  -- Buscar término existente
  SELECT id INTO v_term_id
  FROM pde_classification_terms
  WHERE type = p_type AND normalized = v_normalized;
  
  -- Si existe, retornar su ID
  IF v_term_id IS NOT NULL THEN
    RETURN v_term_id;
  END IF;
  
  -- Si no existe, crearlo
  INSERT INTO pde_classification_terms (type, value, normalized)
  VALUES (p_type, p_value, v_normalized)
  RETURNING id INTO v_term_id;
  
  RETURN v_term_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION ensure_classification_term IS 'Crea o retorna un término de clasificación de forma idempotente (normaliza y evita duplicados)';

-- ============================================================================
-- 5. MIGRACIÓN DE DATOS EXISTENTES
-- ============================================================================

-- Migrar category_key existentes a términos canónicos tipo 'key'
INSERT INTO pde_classification_terms (type, value, normalized)
SELECT DISTINCT
  'key' as type,
  COALESCE(l.category_key, '') as value,
  normalize_classification_term(COALESCE(l.category_key, '')) as normalized
FROM listas_transmutaciones l
WHERE l.category_key IS NOT NULL
  AND l.category_key != ''
  AND NOT EXISTS (
    SELECT 1 FROM pde_classification_terms ct
    WHERE ct.type = 'key'
      AND ct.normalized = normalize_classification_term(l.category_key)
  )
ON CONFLICT (type, normalized) DO NOTHING;

-- Migrar subtype_key existentes a términos canónicos tipo 'subkey'
INSERT INTO pde_classification_terms (type, value, normalized)
SELECT DISTINCT
  'subkey' as type,
  COALESCE(l.subtype_key, '') as value,
  normalize_classification_term(COALESCE(l.subtype_key, '')) as normalized
FROM listas_transmutaciones l
WHERE l.subtype_key IS NOT NULL
  AND l.subtype_key != ''
  AND NOT EXISTS (
    SELECT 1 FROM pde_classification_terms ct
    WHERE ct.type = 'subkey'
      AND ct.normalized = normalize_classification_term(l.subtype_key)
  )
ON CONFLICT (type, normalized) DO NOTHING;

-- Migrar tags (JSONB array) a términos canónicos tipo 'tag'
INSERT INTO pde_classification_terms (type, value, normalized)
SELECT DISTINCT
  'tag' as type,
  tag_value as value,
  normalize_classification_term(tag_value) as normalized
FROM listas_transmutaciones l,
  jsonb_array_elements_text(l.tags) as tag_value
WHERE l.tags IS NOT NULL
  AND jsonb_array_length(l.tags) > 0
  AND NOT EXISTS (
    SELECT 1 FROM pde_classification_terms ct
    WHERE ct.type = 'tag'
      AND ct.normalized = normalize_classification_term(tag_value)
  )
ON CONFLICT (type, normalized) DO NOTHING;

-- Asociar category_key existentes a listas
INSERT INTO transmutacion_lista_classifications (lista_id, classification_term_id)
SELECT DISTINCT
  l.id as lista_id,
  ct.id as classification_term_id
FROM listas_transmutaciones l
INNER JOIN pde_classification_terms ct
  ON ct.type = 'key'
  AND ct.normalized = normalize_classification_term(l.category_key)
WHERE l.category_key IS NOT NULL
  AND l.category_key != ''
  AND NOT EXISTS (
    SELECT 1 FROM transmutacion_lista_classifications tlc
    WHERE tlc.lista_id = l.id
      AND tlc.classification_term_id = ct.id
  );

-- Asociar subtype_key existentes a listas
INSERT INTO transmutacion_lista_classifications (lista_id, classification_term_id)
SELECT DISTINCT
  l.id as lista_id,
  ct.id as classification_term_id
FROM listas_transmutaciones l
INNER JOIN pde_classification_terms ct
  ON ct.type = 'subkey'
  AND ct.normalized = normalize_classification_term(l.subtype_key)
WHERE l.subtype_key IS NOT NULL
  AND l.subtype_key != ''
  AND NOT EXISTS (
    SELECT 1 FROM transmutacion_lista_classifications tlc
    WHERE tlc.lista_id = l.id
      AND tlc.classification_term_id = ct.id
  );

-- Asociar tags existentes a listas
INSERT INTO transmutacion_lista_classifications (lista_id, classification_term_id)
SELECT DISTINCT
  l.id as lista_id,
  ct.id as classification_term_id
FROM listas_transmutaciones l,
  jsonb_array_elements_text(l.tags) as tag_value
INNER JOIN pde_classification_terms ct
  ON ct.type = 'tag'
  AND ct.normalized = normalize_classification_term(tag_value)
WHERE l.tags IS NOT NULL
  AND jsonb_array_length(l.tags) > 0
  AND NOT EXISTS (
    SELECT 1 FROM transmutacion_lista_classifications tlc
    WHERE tlc.lista_id = l.id
      AND tlc.classification_term_id = ct.id
  );

-- ============================================================================
-- 6. COMENTARIOS FINALES
-- ============================================================================

COMMENT ON TABLE pde_classification_terms IS 'Source of Truth canónico para todos los términos de clasificación (keys, subkeys, tags) - Normalizados y reutilizables';

