-- ============================================================================
-- Migración v5.3.0: Studio Multi-Editor - Layout + Theme Binding
-- ============================================================================
-- Fecha: 2025-12-17
-- Descripción: Añade campos para soportar múltiples vistas de edición (Studio)
--              sin crear nuevas tablas.
--
-- PRINCIPIOS:
-- 1. NO crear nuevas tablas (reusar recorrido_drafts/recorrido_versions)
-- 2. layout_json es metadata de Studio, NO se publica
-- 3. theme_binding SÍ se publica (tema resuelto con la versión)
-- 4. Backwards compatible (defaults seguros)
--
-- DOCUMENTACIÓN: docs/STUDIO_MULTI_EDITOR_V1.md
-- ============================================================================

-- ============================================================================
-- VERIFICACIÓN PREVIA: Asegurar que existen las tablas base
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'recorrido_drafts'
  ) THEN
    RAISE EXCEPTION 'Tabla recorrido_drafts no existe. Ejecutar v5.1.0 primero.';
  END IF;

  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'recorrido_versions'
  ) THEN
    RAISE EXCEPTION 'Tabla recorrido_versions no existe. Ejecutar v5.1.0 primero.';
  END IF;
END $$;

-- ============================================================================
-- 1. AÑADIR layout_json A recorrido_drafts
-- ============================================================================
-- Contiene: positions, visual_order, collapsed, groups, viewport
-- NO se publica (es metadata de edición de Studio)

ALTER TABLE recorrido_drafts
ADD COLUMN IF NOT EXISTS layout_json JSONB DEFAULT '{}';

-- ============================================================================
-- 2. AÑADIR theme_binding A recorrido_drafts
-- ============================================================================
-- Contiene: base_theme_id, overrides, preview_mode
-- SE publica (el tema es parte del contenido)

ALTER TABLE recorrido_drafts
ADD COLUMN IF NOT EXISTS theme_binding JSONB DEFAULT '{
  "base_theme_id": "aurora-dark",
  "overrides": {},
  "preview_mode": "dark"
}';

-- ============================================================================
-- 3. AÑADIR theme_binding A recorrido_versions
-- ============================================================================
-- Contiene el tema RESUELTO en el momento de publicación (inmutable)
-- Incluye effective_values_snapshot para reproducibilidad

ALTER TABLE recorrido_versions
ADD COLUMN IF NOT EXISTS theme_binding JSONB DEFAULT '{}';

-- ============================================================================
-- 4. ÍNDICES PARA CONSULTAS
-- ============================================================================

-- Índice para búsqueda por tema base (útil para reportes)
CREATE INDEX IF NOT EXISTS idx_recorrido_drafts_theme_base
ON recorrido_drafts ((theme_binding->>'base_theme_id'))
WHERE theme_binding IS NOT NULL AND theme_binding->>'base_theme_id' IS NOT NULL;

-- Índice GIN para búsquedas en layout_json (grupos, posiciones)
CREATE INDEX IF NOT EXISTS idx_recorrido_drafts_layout_gin
ON recorrido_drafts USING GIN (layout_json)
WHERE layout_json IS NOT NULL AND layout_json != '{}';

-- ============================================================================
-- 5. MIGRAR DATOS EXISTENTES: Generar layout_json inicial
-- ============================================================================
-- Para drafts que ya existen, generar un layout_json básico

UPDATE recorrido_drafts
SET layout_json = jsonb_build_object(
  'schema_version', 'v1',
  'positions', '{}'::jsonb,
  'visual_order', COALESCE(
    (
      SELECT jsonb_agg(key ORDER BY key)
      FROM jsonb_object_keys(definition_json->'steps') AS key
    ),
    '[]'::jsonb
  ),
  'collapsed', '[]'::jsonb,
  'groups', '[]'::jsonb,
  'viewport', '{"zoom": 1.0, "pan_x": 0, "pan_y": 0}'::jsonb
)
WHERE (layout_json IS NULL OR layout_json = '{}'::jsonb)
  AND definition_json IS NOT NULL
  AND definition_json->'steps' IS NOT NULL;

-- ============================================================================
-- 6. COMENTARIOS PARA DOCUMENTACIÓN
-- ============================================================================

COMMENT ON COLUMN recorrido_drafts.layout_json IS 
'Metadata visual para Studio Multi-Editor: posiciones de nodos, grupos, viewport.
NO se publica con la versión (es solo para edición).
Schema: LayoutModel v1 (ver docs/STUDIO_MULTI_EDITOR_V1.md)';

COMMENT ON COLUMN recorrido_drafts.theme_binding IS 
'Binding de tema: base_theme_id + overrides del documento.
SE publica con la versión (el tema es parte del contenido).
Schema: ThemeBinding v1 (ver docs/STUDIO_MULTI_EDITOR_V1.md)';

COMMENT ON COLUMN recorrido_versions.theme_binding IS 
'Tema RESUELTO en el momento de publicación. Incluye:
- base_theme_id: ID del tema base usado
- overrides: Patch de variables aplicado
- effective_values_snapshot: Valores CSS efectivos (para reproducibilidad)
INMUTABLE después de publicación.';

-- ============================================================================
-- NOTAS DE USO
-- ============================================================================
--
-- GUARDAR DRAFT:
--   UPDATE recorrido_drafts
--   SET definition_json = $1,
--       layout_json = $2,
--       theme_binding = $3,
--       updated_at = NOW(),
--       updated_by = $4
--   WHERE draft_id = $5;
--
-- PUBLICAR VERSIÓN:
--   INSERT INTO recorrido_versions (
--     recorrido_id, version, definition_json, theme_binding, created_by
--   ) VALUES (
--     $1, $2, $3,
--     jsonb_build_object(
--       'base_theme_id', draft.theme_binding->>'base_theme_id',
--       'overrides', draft.theme_binding->'overrides',
--       'effective_values_snapshot', $resolved_values
--     ),
--     $4
--   );
--
-- OBTENER DRAFT CON LAYOUT Y TEMA:
--   SELECT draft_id, definition_json, layout_json, theme_binding
--   FROM recorrido_drafts
--   WHERE recorrido_id = $1
--   ORDER BY updated_at DESC
--   LIMIT 1;
--
-- ============================================================================




