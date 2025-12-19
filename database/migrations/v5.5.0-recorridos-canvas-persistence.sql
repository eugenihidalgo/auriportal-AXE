-- ============================================================================
-- Migración v5.5.0: Persistencia de Canvas en Recorridos (AXE v0.6.3)
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Añade persistencia de CanvasDefinition en drafts y versions
--              para permitir edición visual y coherencia en publish
--
-- PRINCIPIOS:
-- 1. Canvas se guarda SIEMPRE normalizado en draft
-- 2. Canvas en version es INMUTABLE (congelado en publish)
-- 3. Si canvas_json es null, se deriva desde definition_json en runtime
-- 4. Fail-open: si no hay canvas, derivar automáticamente
-- ============================================================================

-- ============================================================================
-- TABLA: recorrido_drafts
-- ============================================================================
-- Añadir columna canvas_json (JSONB) para persistir CanvasDefinition
-- Añadir columna canvas_updated_at (TIMESTAMPTZ) para tracking

ALTER TABLE recorrido_drafts 
  ADD COLUMN IF NOT EXISTS canvas_json JSONB NULL;

ALTER TABLE recorrido_drafts 
  ADD COLUMN IF NOT EXISTS canvas_updated_at TIMESTAMPTZ NULL;

-- Índice GIN para búsquedas futuras en canvas_json
CREATE INDEX IF NOT EXISTS idx_recorrido_drafts_canvas_gin 
  ON recorrido_drafts USING GIN (canvas_json)
  WHERE canvas_json IS NOT NULL;

-- ============================================================================
-- TABLA: recorrido_versions
-- ============================================================================
-- Añadir columna canvas_json (JSONB) para persistir CanvasDefinition INMUTABLE
-- El canvas en version queda congelado igual que definition_json

ALTER TABLE recorrido_versions 
  ADD COLUMN IF NOT EXISTS canvas_json JSONB NULL;

-- Índice GIN para búsquedas futuras en canvas_json
CREATE INDEX IF NOT EXISTS idx_recorrido_versions_canvas_gin 
  ON recorrido_versions USING GIN (canvas_json)
  WHERE canvas_json IS NOT NULL;

-- ============================================================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ============================================================================

COMMENT ON COLUMN recorrido_drafts.canvas_json IS 
'CanvasDefinition normalizada del recorrido. Si es NULL, se deriva automáticamente desde definition_json usando recorrido-to-canvas en runtime. Se guarda SIEMPRE normalizado.';

COMMENT ON COLUMN recorrido_drafts.canvas_updated_at IS 
'Timestamp de última actualización del canvas. Se actualiza cada vez que se guarda canvas_json.';

COMMENT ON COLUMN recorrido_versions.canvas_json IS 
'CanvasDefinition INMUTABLE congelada en el momento de publicación. Si es NULL en publish-time, se deriva desde definition_json y se guarda. Una vez publicado, NUNCA cambia.';

-- ============================================================================
-- NOTAS DE USO
-- ============================================================================
-- 
-- FLUJO TÍPICO:
-- 
-- 1. LECTURA DE DRAFT:
--    - Si draft.canvas_json existe → usar directamente
--    - Si draft.canvas_json es NULL → derivar desde draft.definition_json
--    - Mostrar badge "DERIVED" si es derivado
-- 
-- 2. GUARDADO DE CANVAS:
--    - Validar canvas con validateCanvasDefinition
--    - Normalizar con normalizeCanvasDefinition
--    - Guardar en draft.canvas_json + draft.canvas_updated_at
--    - Si hay errors bloqueantes → 400, no guardar
--    - Si hay warnings → guardar pero reportar warnings
-- 
-- 3. PUBLISH:
--    - Si draft.canvas_json existe:
--      * Validar canvas (estricto, isPublish:true)
--      * Guardar en version.canvas_json junto con definition_json
--    - Si draft.canvas_json es NULL:
--      * Derivar canvas desde draft.definition_json (recorrido-to-canvas)
--      * Normalizar y guardar en version.canvas_json
--      * Añadir warning en respuesta: "Canvas publicado fue derivado automáticamente"
-- 
-- IMPORTANTE:
-- - canvas_json en draft es editable (se actualiza con cada guardado)
-- - canvas_json en version es INMUTABLE (nunca cambia después de publish)
-- - La derivación (recorrido-to-canvas) es automática y transparente
-- 
-- ============================================================================




