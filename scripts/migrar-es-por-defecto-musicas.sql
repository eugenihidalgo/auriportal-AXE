-- Migración: Agregar columna es_por_defecto a musicas_meditacion
-- Ejecutar este script si la columna no existe

ALTER TABLE musicas_meditacion 
ADD COLUMN IF NOT EXISTS es_por_defecto BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_musicas_meditacion_por_defecto ON musicas_meditacion(es_por_defecto);






