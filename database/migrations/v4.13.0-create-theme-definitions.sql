-- AuriPortal v4.13.0 - Migración: Editor de Temas
-- Crea tabla para almacenar definiciones de temas personalizados

CREATE TABLE IF NOT EXISTS theme_definitions (
  id SERIAL PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  contract_version VARCHAR(10) DEFAULT 'v1',
  values JSONB NOT NULL DEFAULT '{}',
  source VARCHAR(20) DEFAULT 'custom' CHECK (source IN ('system', 'custom', 'ai')),
  meta JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'draft')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_theme_definitions_key ON theme_definitions(key);
CREATE INDEX IF NOT EXISTS idx_theme_definitions_source ON theme_definitions(source);
CREATE INDEX IF NOT EXISTS idx_theme_definitions_status ON theme_definitions(status);
CREATE INDEX IF NOT EXISTS idx_theme_definitions_created_at ON theme_definitions(created_at);

-- Comentarios para documentación
COMMENT ON TABLE theme_definitions IS 'Almacena definiciones de temas personalizados y generados por IA';
COMMENT ON COLUMN theme_definitions.key IS 'Clave única del tema (ej: "navidad-2024", "generated-calm-01")';
COMMENT ON COLUMN theme_definitions.name IS 'Nombre legible del tema';
COMMENT ON COLUMN theme_definitions.description IS 'Descripción del tema';
COMMENT ON COLUMN theme_definitions.contract_version IS 'Versión del Theme Contract (v1, v2, etc.)';
COMMENT ON COLUMN theme_definitions.values IS 'JSONB con todas las variables CSS del contrato';
COMMENT ON COLUMN theme_definitions.source IS 'Origen: system (read-only), custom (creado manualmente), ai (generado por IA)';
COMMENT ON COLUMN theme_definitions.meta IS 'Metadata adicional (prompt usado, modelo IA, etc.)';
COMMENT ON COLUMN theme_definitions.status IS 'Estado: active (activo), archived (archivado), draft (borrador)';









