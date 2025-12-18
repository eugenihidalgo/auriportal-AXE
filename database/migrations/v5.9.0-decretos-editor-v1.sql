-- ============================================================================
-- Migración v5.9.0: Editor WYSIWYG para Biblioteca de Decretos
-- ============================================================================
-- Fecha: 2024-12-19
-- Descripción: Añade columnas necesarias para soportar editor WYSIWYG
--              y mejorar la gestión de decretos en el admin.
--
-- PRINCIPIOS:
-- - Fail-open: Columnas nullable, decretos existentes siguen funcionando
-- - Compatibilidad: No elimina ni renombra columnas existentes
-- - Idempotente: Puede ejecutarse múltiples veces sin error
-- - Soft delete normalizado: Añade deleted_at además de activo
-- ============================================================================

-- ============================================================================
-- AÑADIR COLUMNAS NUEVAS
-- ============================================================================

-- content_delta: JSONB para guardar formato del editor WYSIWYG (Quill Delta)
-- Permite edición futura sin pérdida de formato
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'decretos' AND column_name = 'content_delta'
    ) THEN
        ALTER TABLE decretos ADD COLUMN content_delta JSONB;
        COMMENT ON COLUMN decretos.content_delta IS 
        'Delta JSON del editor WYSIWYG (Quill). Permite edición futura sin pérdida de formato. Nullable.';
    END IF;
END $$;

-- content_text: TEXT para búsquedas y previews simples
-- Texto plano extraído del HTML
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'decretos' AND column_name = 'content_text'
    ) THEN
        ALTER TABLE decretos ADD COLUMN content_text TEXT;
        COMMENT ON COLUMN decretos.content_text IS 
        'Texto plano extraído del HTML para búsquedas y previews. Nullable.';
    END IF;
END $$;

-- descripcion: TEXT para descripción opcional del decreto
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'decretos' AND column_name = 'descripcion'
    ) THEN
        ALTER TABLE decretos ADD COLUMN descripcion TEXT;
        COMMENT ON COLUMN decretos.descripcion IS 
        'Descripción opcional del decreto. Contenido PDE (texto libre) editable en creación y edición. Nullable.';
    END IF;
END $$;

-- deleted_at: TIMESTAMPTZ para soft delete normalizado
-- Complementa el campo activo existente
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'decretos' AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE decretos ADD COLUMN deleted_at TIMESTAMPTZ NULL;
        COMMENT ON COLUMN decretos.deleted_at IS 
        'Soft delete normalizado: NULL = activo, TIMESTAMP = eliminado. Complementa el campo activo.';
    END IF;
END $$;

-- ============================================================================
-- ÍNDICES PARA CONSULTAS RÁPIDAS
-- ============================================================================

-- Índice para filtrar activos por deleted_at
CREATE INDEX IF NOT EXISTS idx_decretos_deleted_at 
    ON decretos(deleted_at) 
    WHERE deleted_at IS NULL;

-- Índice GIN para búsquedas en content_text (si se usa full-text search)
-- Nota: Para búsquedas full-text, considerar usar tsvector en el futuro
CREATE INDEX IF NOT EXISTS idx_decretos_content_text 
    ON decretos(content_text) 
    WHERE content_text IS NOT NULL;

-- Índice GIN para búsquedas en content_delta (JSONB)
CREATE INDEX IF NOT EXISTS idx_decretos_content_delta_gin 
    ON decretos USING GIN (content_delta) 
    WHERE content_delta IS NOT NULL;

-- ============================================================================
-- MIGRACIÓN DE DATOS EXISTENTES (OPCIONAL)
-- ============================================================================

-- Si hay decretos con activo = false pero deleted_at NULL, 
-- establecer deleted_at para normalizar soft delete
-- (Solo si no hay datos en deleted_at para evitar sobrescribir)
DO $$
BEGIN
    UPDATE decretos 
    SET deleted_at = updated_at 
    WHERE activo = false 
      AND deleted_at IS NULL
      AND updated_at IS NOT NULL;
    
    -- Si no hay updated_at, usar created_at
    UPDATE decretos 
    SET deleted_at = created_at 
    WHERE activo = false 
      AND deleted_at IS NULL
      AND updated_at IS NULL
      AND created_at IS NOT NULL;
END $$;

-- ============================================================================
-- NOTAS DE USO
-- ============================================================================
-- 
-- ESTRUCTURA DE DATOS:
-- 
-- 1. content_html (TEXT): HTML renderizado - SIEMPRE presente
--    - Se usa para renderizado inmediato en cliente
--    - Debe estar sanitizado antes de guardar
-- 
-- 2. content_delta (JSONB): Delta de Quill - OPCIONAL
--    - Permite edición futura sin pérdida de formato
--    - Estructura: { ops: [...] } (formato Quill Delta)
--    - Si no existe, se puede regenerar desde content_html (con pérdida)
-- 
-- 3. content_text (TEXT): Texto plano - OPCIONAL
--    - Para búsquedas y previews simples
--    - Se puede extraer de content_html automáticamente
-- 
-- 4. descripcion (TEXT): Descripción opcional - OPCIONAL
--    - Contenido PDE editable en creación y edición
-- 
-- 5. deleted_at (TIMESTAMPTZ): Soft delete normalizado
--    - NULL = activo
--    - TIMESTAMP = eliminado
--    - Complementa el campo activo (mantener ambos por compatibilidad)
-- 
-- COMPATIBILIDAD:
-- 
-- - Decretos existentes sin estas columnas seguirán funcionando (fail-open)
-- - El servicio debe manejar valores NULL correctamente
-- - El resolver PDE usa content_html (no cambia)
-- 
-- SANITIZACIÓN:
-- 
-- - content_html DEBE sanitizarse antes de guardar (server-side)
-- - Allowlist: p, br, strong, em, u, h1-h3, ul/ol/li, blockquote, a[href], span[style limitado]
-- - Si sanitización falla → guardar como texto plano en content_text y HTML escapado
-- 
-- ============================================================================

