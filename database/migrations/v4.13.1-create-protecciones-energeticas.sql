-- ============================================================================
-- AuriPortal v4.13.1 - Migración: Protecciones Energéticas
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Crea tabla para almacenar protecciones energéticas
--              (Categoría de contenido PDE reutilizable dentro de prácticas)
-- 
-- PRINCIPIOS:
-- 1. Tabla debe existir antes de que el servicio la use
-- 2. Sin enums estrictos (usar TEXT con defaults seguros)
-- 3. Índice por status para consultas rápidas
-- 4. Defaults seguros para todos los campos opcionales
-- ============================================================================

CREATE TABLE IF NOT EXISTS protecciones_energeticas (
  id SERIAL PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  usage_context TEXT DEFAULT '',
  recommended_moment TEXT DEFAULT 'transversal',
  tags JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_protecciones_energeticas_key ON protecciones_energeticas(key);
CREATE INDEX IF NOT EXISTS idx_protecciones_energeticas_status ON protecciones_energeticas(status);

-- Comentarios para documentación
COMMENT ON TABLE protecciones_energeticas IS 
'Tabla para almacenar protecciones energéticas (categoría de contenido PDE reutilizable dentro de prácticas). 
Piezas de contenido energético que pueden incorporarse en diferentes momentos de la práctica.';

COMMENT ON COLUMN protecciones_energeticas.id IS 'ID único de la protección';
COMMENT ON COLUMN protecciones_energeticas.key IS 'Clave única de la protección (slug)';
COMMENT ON COLUMN protecciones_energeticas.name IS 'Nombre legible de la protección';
COMMENT ON COLUMN protecciones_energeticas.description IS 'Descripción de la protección';
COMMENT ON COLUMN protecciones_energeticas.usage_context IS 'Contexto de uso de la protección';
COMMENT ON COLUMN protecciones_energeticas.recommended_moment IS 'Momento recomendado: pre-practica, durante, post-practica, transversal';
COMMENT ON COLUMN protecciones_energeticas.tags IS 'Tags asociados en formato JSONB array';
COMMENT ON COLUMN protecciones_energeticas.status IS 'Estado: active (activa) o archived (archivada)';
COMMENT ON COLUMN protecciones_energeticas.created_at IS 'Fecha de creación';
COMMENT ON COLUMN protecciones_energeticas.updated_at IS 'Fecha de última actualización';










