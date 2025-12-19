-- ============================================================================
-- Migración v5.6.0: Añadir flags de clasificación a técnicas de limpieza
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Añade dos campos booleanos independientes para clasificar
--              técnicas de transmutación energética:
--              - aplica_energias_indeseables: Para técnicas de energías indeseables
--              - aplica_limpiezas_recurrentes: Para técnicas de limpiezas recurrentes
--
-- PRINCIPIOS:
-- - Fail-open: Defaults en false
-- - Independencia: Ambos flags pueden estar activos simultáneamente
-- - Compatibilidad: No elimina ni renombra columnas existentes
-- - Extensibilidad: Preparado para futuras categorías sin refactor
-- ============================================================================

-- Añadir columna aplica_energias_indeseables si no existe
ALTER TABLE tecnicas_limpieza 
ADD COLUMN IF NOT EXISTS aplica_energias_indeseables BOOLEAN NOT NULL DEFAULT false;

-- Añadir columna aplica_limpiezas_recurrentes si no existe
ALTER TABLE tecnicas_limpieza 
ADD COLUMN IF NOT EXISTS aplica_limpiezas_recurrentes BOOLEAN NOT NULL DEFAULT false;

-- Comentarios para documentación
COMMENT ON COLUMN tecnicas_limpieza.aplica_energias_indeseables IS 
'Indica si esta técnica aplica para energías indeseables. 
Puede estar activo simultáneamente con aplica_limpiezas_recurrentes.';

COMMENT ON COLUMN tecnicas_limpieza.aplica_limpiezas_recurrentes IS 
'Indica si esta técnica aplica para limpiezas recurrentes. 
Puede estar activo simultáneamente con aplica_energias_indeseables.';

-- ============================================================================
-- NOTAS DE USO
-- ============================================================================
-- 
-- Una técnica puede:
-- - Aplicarse solo a energías indeseables (aplica_energias_indeseables=true, aplica_limpiezas_recurrentes=false)
-- - Aplicarse solo a limpiezas recurrentes (aplica_energias_indeseables=false, aplica_limpiezas_recurrentes=true)
-- - Aplicarse a ambas (aplica_energias_indeseables=true, aplica_limpiezas_recurrentes=true)
-- - No aplicarse a ninguna (aplica_energias_indeseables=false, aplica_limpiezas_recurrentes=false)
--
-- Técnicas existentes tendrán ambos flags en false por defecto (fail-open).
-- El Master debe configurar explícitamente cada técnica según corresponda.
--
-- ============================================================================



