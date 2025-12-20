-- ============================================================================
-- Migración v5.7.0: Añadir campo descripción a preparaciones_practica
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Añade campo descripción (TEXT, nullable) a la tabla
--              preparaciones_practica para permitir contenido PDE editable
--              en creación y edición.
--
-- PRINCIPIOS:
-- - Fail-open: Columna nullable, preparaciones sin descripción siguen funcionando
-- - Compatibilidad: No elimina ni renombra columnas existentes
-- - Idempotente: Puede ejecutarse múltiples veces sin error
-- ============================================================================

-- Añadir columna descripcion si no existe
ALTER TABLE preparaciones_practica 
ADD COLUMN IF NOT EXISTS descripcion TEXT;

-- Comentario para documentación
COMMENT ON COLUMN preparaciones_practica.descripcion IS 
'Descripción opcional de la preparación. Contenido PDE (texto libre) 
editable en creación y edición. Nullable para mantener compatibilidad 
con preparaciones existentes.';

-- ============================================================================
-- NOTAS DE USO
-- ============================================================================
-- 
-- El campo descripcion es:
-- - Opcional: Puede ser NULL
-- - Texto libre: Sin restricciones de formato
-- - Editable: Se puede modificar en creación y edición
-- - Persistente: Se guarda en la base de datos
--
-- Preparaciones existentes sin descripción seguirán funcionando normalmente
-- (fail-open).
--
-- ============================================================================




