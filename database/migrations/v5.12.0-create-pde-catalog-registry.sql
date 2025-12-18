-- ============================================================================
-- Migración v5.12.0: Registro Canónico de Catálogos PDE
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Crea el registro canónico de catálogos PDE como Source of Truth
--              para el Diseñador de Motores y otros sistemas.
--
-- PRINCIPIOS:
-- 1. Registro centralizado: Única fuente de verdad para metadata de catálogos
-- 2. Compatibilidad: No modifica tablas existentes
-- 3. Extensibilidad: Soporta capacidades futuras mediante flags booleanos
-- 4. Fail-open: Defaults seguros para todos los campos
-- ============================================================================

-- ============================================================================
-- 1. CREAR TABLA PRINCIPAL
-- ============================================================================

CREATE TABLE IF NOT EXISTS pde_catalog_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_key VARCHAR(100) UNIQUE NOT NULL,
  label VARCHAR(255) NOT NULL,
  description TEXT,
  source_table VARCHAR(100) NOT NULL,
  source_endpoint VARCHAR(255),
  usable_for_motors BOOLEAN DEFAULT true,
  supports_level BOOLEAN DEFAULT false,
  supports_priority BOOLEAN DEFAULT false,
  supports_obligatory BOOLEAN DEFAULT false,
  supports_duration BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_pde_catalog_registry_catalog_key ON pde_catalog_registry(catalog_key);
CREATE INDEX IF NOT EXISTS idx_pde_catalog_registry_status ON pde_catalog_registry(status);
CREATE INDEX IF NOT EXISTS idx_pde_catalog_registry_usable_for_motors ON pde_catalog_registry(usable_for_motors);

-- Comentarios para documentación
COMMENT ON TABLE pde_catalog_registry IS 'Registro canónico de catálogos PDE. Source of Truth para metadata de catálogos.';
COMMENT ON COLUMN pde_catalog_registry.id IS 'UUID único del registro';
COMMENT ON COLUMN pde_catalog_registry.catalog_key IS 'Clave canónica única del catálogo (ej: preparaciones_practica, tecnicas_limpieza)';
COMMENT ON COLUMN pde_catalog_registry.label IS 'Etiqueta legible para UI (ej: Preparaciones para la Práctica)';
COMMENT ON COLUMN pde_catalog_registry.description IS 'Descripción opcional del catálogo';
COMMENT ON COLUMN pde_catalog_registry.source_table IS 'Nombre de la tabla PostgreSQL que contiene los datos (ej: preparaciones_practica)';
COMMENT ON COLUMN pde_catalog_registry.source_endpoint IS 'Endpoint API opcional para acceder al catálogo (ej: /api/preparaciones-practica)';
COMMENT ON COLUMN pde_catalog_registry.usable_for_motors IS 'Indica si el catálogo puede ser usado en el Diseñador de Motores';
COMMENT ON COLUMN pde_catalog_registry.supports_level IS 'Indica si el catálogo soporta filtrado por nivel mínimo';
COMMENT ON COLUMN pde_catalog_registry.supports_priority IS 'Indica si el catálogo soporta filtrado por prioridad';
COMMENT ON COLUMN pde_catalog_registry.supports_obligatory IS 'Indica si el catálogo soporta marcar ítems como obligatorios';
COMMENT ON COLUMN pde_catalog_registry.supports_duration IS 'Indica si el catálogo soporta duración/dias';
COMMENT ON COLUMN pde_catalog_registry.status IS 'Estado del registro: active o archived';

-- ============================================================================
-- 2. INSERTAR REGISTROS INICIALES
-- ============================================================================
-- Basados en la auditoría realizada en PDE_CATALOGS_FOR_MOTORS_V1.md

INSERT INTO pde_catalog_registry (
  catalog_key, 
  label, 
  description, 
  source_table, 
  source_endpoint,
  usable_for_motors,
  supports_level,
  supports_priority,
  supports_obligatory,
  supports_duration
) VALUES
  (
    'preparaciones_practica',
    'Preparaciones para la Práctica',
    'Catálogo de preparaciones que se pueden realizar antes de la práctica',
    'preparaciones_practica',
    '/api/preparaciones-practica',
    true,
    false,
    true,
    false,
    false
  ),
  (
    'tecnicas_limpieza',
    'Técnicas de Limpieza Energética',
    'Catálogo de técnicas de transmutación energética (limpieza)',
    'tecnicas_limpieza',
    '/api/tecnicas-limpieza',
    true,
    false,
    true,
    true,
    false
  ),
  (
    'tecnicas_post_practica',
    'Técnicas Post-Práctica',
    'Catálogo de técnicas que se realizan después de la práctica',
    'tecnicas_post_practica',
    '/api/tecnicas-post-practica',
    true,
    false,
    true,
    false,
    false
  ),
  (
    'transmutaciones_energeticas',
    'Transmutaciones Energéticas',
    'Catálogo de transmutaciones energéticas (personas, lugares, proyectos)',
    'items_transmutaciones',
    '/api/transmutaciones/items',
    true,
    true,
    true,
    false,
    true
  ),
  (
    'protecciones_energeticas',
    'Protecciones Energéticas',
    'Catálogo de protecciones energéticas',
    'protecciones_energeticas',
    '/api/protecciones-energeticas',
    true,
    true,
    true,
    true,
    false
  ),
  (
    'decretos',
    'Decretos',
    'Biblioteca de decretos PDE',
    'decretos',
    '/api/decretos',
    true,
    false,
    true,
    false,
    false
  ),
  (
    'frases',
    'Frases PDE',
    'Catálogo de frases personalizadas PDE',
    'pde_frases_personalizadas',
    '/api/frases',
    true,
    false,
    false,
    false,
    false
  ),
  (
    'musicas',
    'Músicas de Meditación',
    'Catálogo de músicas para meditación',
    'musicas_meditacion',
    '/api/musicas',
    true,
    false,
    false,
    false,
    false
  ),
  (
    'tonos',
    'Tonos de Meditación',
    'Catálogo de tonos para meditación',
    'tonos_meditacion',
    '/api/tonos',
    true,
    false,
    false,
    false,
    false
  )
ON CONFLICT (catalog_key) DO NOTHING;

-- ============================================================================
-- 3. FUNCIÓN PARA ACTUALIZAR updated_at AUTOMÁTICAMENTE
-- ============================================================================

CREATE OR REPLACE FUNCTION update_pde_catalog_registry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pde_catalog_registry_updated_at
  BEFORE UPDATE ON pde_catalog_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_pde_catalog_registry_updated_at();

-- ============================================================================
-- 4. VERIFICACIÓN
-- ============================================================================

DO $$
DECLARE
  record_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO record_count FROM pde_catalog_registry;
  RAISE NOTICE '✅ Tabla pde_catalog_registry creada con % registros iniciales', record_count;
END $$;

-- ============================================================================
-- NOTAS DE USO
-- ============================================================================
-- 
-- Esta migración crea el registro canónico de catálogos PDE.
-- 
-- Los registros iniciales están basados en la auditoría realizada en
-- docs/PDE_CATALOGS_FOR_MOTORS_V1.md.
--
-- El registro sirve como Source of Truth para:
-- - Diseñador de Motores (dropdowns dinámicos)
-- - Sistema AXE
-- - Futuras automatizaciones
--
-- Para añadir nuevos catálogos:
-- INSERT INTO pde_catalog_registry (catalog_key, label, source_table, ...) VALUES (...);
--
-- Para marcar un catálogo como no usable para motores:
-- UPDATE pde_catalog_registry SET usable_for_motors = false WHERE catalog_key = '...';
--
-- ============================================================================

