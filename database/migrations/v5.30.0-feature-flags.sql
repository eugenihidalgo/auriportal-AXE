-- Migration: v5.30.0-feature-flags.sql
-- Sistema de Feature Flags Canónico - AuriPortal
-- Fecha: 2025-01-XX
--
-- PROPÓSITO:
-- Crear tabla para almacenar el estado (enabled/disabled) de feature flags.
-- El registry canónico (feature-flag-registry.js) define las definiciones.
-- Esta tabla almacena el estado actual de cada flag.
--
-- REGLAS:
-- - PostgreSQL es el Source of Truth del estado
-- - El registry es el Source of Truth de la definición
-- - NO se insertan defaults aquí (el default vive en el registry)
-- - updated_by es JSONB para almacenar { type: 'admin' | 'system', id: string }

-- Tabla principal de feature flags
CREATE TABLE IF NOT EXISTS feature_flags (
  flag_key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL,
  updated_by JSONB NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT feature_flags_flag_key_check CHECK (flag_key ~ '^[a-z0-9._-]+$'),
  CONSTRAINT feature_flags_updated_by_check CHECK (
    updated_by ? 'type' AND 
    updated_by ? 'id' AND
    (updated_by->>'type') IN ('admin', 'system')
  )
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(enabled);
CREATE INDEX IF NOT EXISTS idx_feature_flags_updated_at ON feature_flags(updated_at);

-- Comentarios
COMMENT ON TABLE feature_flags IS 'Estado actual de feature flags. El registry canónico define las definiciones.';
COMMENT ON COLUMN feature_flags.flag_key IS 'Clave única del flag (debe existir en registry)';
COMMENT ON COLUMN feature_flags.enabled IS 'Estado actual del flag (true = enabled, false = disabled)';
COMMENT ON COLUMN feature_flags.updated_by IS 'Actor que actualizó el flag: { type: "admin"|"system", id: string }';
COMMENT ON COLUMN feature_flags.updated_at IS 'Timestamp de última actualización';




