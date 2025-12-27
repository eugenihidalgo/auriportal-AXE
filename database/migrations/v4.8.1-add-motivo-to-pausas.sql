-- Migración v4.8.1: Añadir campo motivo a tabla pausas (FASE 3)
-- Fecha: 2024-12-XX
-- Descripción: Añade campo motivo a la tabla pausas para control manual

-- Añadir columna motivo si no existe
ALTER TABLE pausas 
ADD COLUMN IF NOT EXISTS motivo TEXT;

-- Comentario para documentación
COMMENT ON COLUMN pausas.motivo IS 'Motivo de la pausa (requerido para pausas manuales)';




















