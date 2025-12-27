-- Migración v5.10.0: Crear tabla pde_motors
-- Diseñador de Motores PDE
-- Fecha: 2024-12-XX
-- Descripción: Crea la tabla para almacenar motores reutilizables que generan estructura AXE

-- Crear tabla pde_motors
CREATE TABLE IF NOT EXISTS pde_motors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  motor_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  definition JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_pde_motors_motor_key ON pde_motors(motor_key);
CREATE INDEX IF NOT EXISTS idx_pde_motors_status ON pde_motors(status);
CREATE INDEX IF NOT EXISTS idx_pde_motors_category ON pde_motors(category);
CREATE INDEX IF NOT EXISTS idx_pde_motors_deleted_at ON pde_motors(deleted_at);

-- Comentarios para documentación
COMMENT ON TABLE pde_motors IS 'Motores reutilizables que generan estructura AXE para recorridos';
COMMENT ON COLUMN pde_motors.id IS 'UUID único del motor';
COMMENT ON COLUMN pde_motors.motor_key IS 'Clave canónica única e inmutable del motor';
COMMENT ON COLUMN pde_motors.name IS 'Nombre descriptivo del motor';
COMMENT ON COLUMN pde_motors.description IS 'Descripción opcional del motor';
COMMENT ON COLUMN pde_motors.category IS 'Categoría del motor (ej: preparacion, limpieza)';
COMMENT ON COLUMN pde_motors.version IS 'Versión del motor (se incrementa al actualizar definition)';
COMMENT ON COLUMN pde_motors.status IS 'Estado: draft, published, archived';
COMMENT ON COLUMN pde_motors.definition IS 'Definición JSONB completa del motor (inputs, rules, outputs)';
COMMENT ON COLUMN pde_motors.created_at IS 'Fecha de creación';
COMMENT ON COLUMN pde_motors.updated_at IS 'Fecha de última actualización';
COMMENT ON COLUMN pde_motors.deleted_at IS 'Soft delete: fecha de eliminación (NULL si no eliminado)';











