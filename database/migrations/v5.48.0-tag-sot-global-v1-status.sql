-- ============================================================================
-- Migración v5.48.0: TAG SOT GLOBAL v1 - Añadir campo status
-- ============================================================================
-- Fecha: 2025-01-02
-- Descripción: Añade campo status a pde_classification_terms para soportar
--              estado active/deprecated en Tags SOT Global v1
--
-- PRINCIPIOS:
-- 1. Tags solo pueden estar active o deprecated (nunca deleted)
-- 2. Status por defecto es 'active'
-- 3. Tags deprecated no se eliminan, solo se marcan
-- ============================================================================

-- Añadir columna status a pde_classification_terms
ALTER TABLE pde_classification_terms
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
CHECK (status IN ('active', 'deprecated'));

-- Crear índice para búsquedas por status
CREATE INDEX IF NOT EXISTS idx_classification_terms_status 
ON pde_classification_terms(status);

-- Crear índice compuesto type + status para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_classification_terms_type_status 
ON pde_classification_terms(type, status) 
WHERE status = 'active';

-- Comentarios
COMMENT ON COLUMN pde_classification_terms.status IS 'Estado del término: active (disponible) o deprecated (descontinuado, no se elimina)';

-- Actualizar comentario de la tabla para reflejar TAG SOT GLOBAL v1
COMMENT ON TABLE pde_classification_terms IS 'TAG SOT GLOBAL v1 - Source of Truth canónico para todos los términos de clasificación (keys, subkeys, tags). Normalizados, reutilizables y gobernados por MASTER.';
