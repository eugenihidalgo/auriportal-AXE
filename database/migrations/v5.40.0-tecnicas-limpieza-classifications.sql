-- ============================================================================
-- Migración v5.40.0: Sistema de Clasificaciones para Técnicas de Limpieza
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Relación N:M entre técnicas de limpieza y clasificaciones
--              canónicas usando pde_classification_terms como Source of Truth
--
-- PRINCIPIOS:
-- 1. Usa pde_classification_terms existente (tipo 'tag' para técnicas)
-- 2. Relación N:M independiente y reutilizable
-- 3. Clasificaciones viven independientemente (no se borran al eliminar técnica)
-- 4. Preparado para Packages, Resolvers y Widgets
-- ============================================================================

-- ============================================================================
-- 1. TABLA DE RELACIÓN N:M
-- ============================================================================

CREATE TABLE IF NOT EXISTS tecnicas_limpieza_classifications (
  tecnica_id INTEGER NOT NULL,
  classification_term_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tecnica_id, classification_term_id),
  FOREIGN KEY (tecnica_id) REFERENCES tecnicas_limpieza(id) ON DELETE CASCADE,
  FOREIGN KEY (classification_term_id) REFERENCES pde_classification_terms(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tecnicas_limpieza_classifications_tecnica 
  ON tecnicas_limpieza_classifications(tecnica_id);
  
CREATE INDEX IF NOT EXISTS idx_tecnicas_limpieza_classifications_term 
  ON tecnicas_limpieza_classifications(classification_term_id);

COMMENT ON TABLE tecnicas_limpieza_classifications IS 
'Asociación many-to-many entre técnicas de limpieza y términos de clasificación canónicos. 
Usa pde_classification_terms como Source of Truth. 
Las clasificaciones viven independientemente (no se borran al eliminar técnica).';

-- ============================================================================
-- 2. FUNCIÓN HELPER: Obtener clasificaciones de una técnica
-- ============================================================================

CREATE OR REPLACE FUNCTION get_tecnicas_limpieza_classifications(p_tecnica_id INTEGER)
RETURNS TABLE (
  id UUID,
  type TEXT,
  value TEXT,
  normalized TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ct.id,
    ct.type,
    ct.value,
    ct.normalized
  FROM pde_classification_terms ct
  INNER JOIN tecnicas_limpieza_classifications tlc
    ON tlc.classification_term_id = ct.id
  WHERE tlc.tecnica_id = p_tecnica_id
    AND ct.type = 'tag'  -- Solo clasificaciones tipo 'tag' para técnicas
  ORDER BY ct.value ASC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_tecnicas_limpieza_classifications IS 
'Retorna todas las clasificaciones (tipo tag) asociadas a una técnica de limpieza';

-- ============================================================================
-- 3. FUNCIÓN HELPER: Listar clasificaciones disponibles
-- ============================================================================

CREATE OR REPLACE FUNCTION list_tecnicas_limpieza_classifications_available()
RETURNS TABLE (
  id UUID,
  value TEXT,
  normalized TEXT,
  usage_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ct.id,
    ct.value,
    ct.normalized,
    COUNT(tlc.tecnica_id) as usage_count
  FROM pde_classification_terms ct
  LEFT JOIN tecnicas_limpieza_classifications tlc
    ON tlc.classification_term_id = ct.id
  WHERE ct.type = 'tag'
  GROUP BY ct.id, ct.value, ct.normalized
  ORDER BY ct.value ASC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION list_tecnicas_limpieza_classifications_available IS 
'Lista todas las clasificaciones disponibles (tipo tag) con contador de uso en técnicas';

-- ============================================================================
-- 4. NOTAS DE USO
-- ============================================================================
-- 
-- Para asociar una clasificación a una técnica:
-- 1. Usar ensure_classification_term('tag', 'nombre_clasificacion') para crear/obtener el término
-- 2. INSERT INTO tecnicas_limpieza_classifications (tecnica_id, classification_term_id)
--    VALUES (id_tecnica, id_term);
--
-- Las clasificaciones se reutilizan automáticamente entre técnicas.
-- Si una técnica se elimina, solo se eliminan las relaciones (CASCADE),
-- no las clasificaciones en sí (estas viven en pde_classification_terms).
--
-- ============================================================================

