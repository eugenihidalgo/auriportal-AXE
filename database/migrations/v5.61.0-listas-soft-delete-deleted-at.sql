-- ============================================================================
-- Migración: v5.61.0-listas-soft-delete-deleted-at.sql
-- Fecha: 2025-01-XX
-- Descripción: Añade deleted_at para soft delete canónico de listas
-- ============================================================================
--
-- OBJETIVO:
-- Implementar soft delete canónico usando deleted_at en lugar de status='archived'
-- para listas_transmutaciones.
--
-- CAMBIOS:
-- 1. Añadir columna deleted_at TIMESTAMPTZ NULL a listas_transmutaciones
-- 2. Crear índice para consultas rápidas
-- 3. Añadir comentario explicativo
--
-- REGLA CANÓNICA:
-- - deleted_at IS NULL = lista activa (visible en UI)
-- - deleted_at NOT NULL = lista eliminada (no visible en UI)
-- - NO se borran datos históricos (eventos, limpiezas, contadores)
--
-- ============================================================================

DO $$
BEGIN
  -- 1. Añadir columna deleted_at si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'listas_transmutaciones' 
    AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE listas_transmutaciones 
    ADD COLUMN deleted_at TIMESTAMPTZ NULL;
    
    RAISE NOTICE 'Columna deleted_at añadida a listas_transmutaciones';
  ELSE
    RAISE NOTICE 'Columna deleted_at ya existe en listas_transmutaciones';
  END IF;
  
  -- 2. Crear índice para consultas rápidas (solo listas activas)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'listas_transmutaciones' 
    AND indexname = 'idx_listas_transmutaciones_deleted_at'
  ) THEN
    CREATE INDEX idx_listas_transmutaciones_deleted_at 
    ON listas_transmutaciones(deleted_at) 
    WHERE deleted_at IS NULL;
    
    RAISE NOTICE 'Índice idx_listas_transmutaciones_deleted_at creado';
  ELSE
    RAISE NOTICE 'Índice idx_listas_transmutaciones_deleted_at ya existe';
  END IF;
  
  -- 3. Añadir comentario
  COMMENT ON COLUMN listas_transmutaciones.deleted_at IS 
    'Soft delete canónico: NULL = activa (visible), NOT NULL = eliminada (no visible). No borra datos históricos.';
  
  RAISE NOTICE 'Migración v5.61.0 completada: deleted_at añadido a listas_transmutaciones';
END $$;
