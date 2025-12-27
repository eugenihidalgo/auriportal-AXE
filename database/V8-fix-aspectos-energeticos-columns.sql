-- V8-fix-aspectos-energeticos-columns.sql
-- Añade las columnas necesarias a la tabla aspectos_energeticos
-- IMPORTANTE: No usar DO $$ ni lógica auto-mutante, solo ALTER TABLE con IF NOT EXISTS

-- Añadir columna nivel_minimo
ALTER TABLE aspectos_energeticos 
  ADD COLUMN IF NOT EXISTS nivel_minimo INTEGER DEFAULT 1;

-- Añadir columna seccion_id con referencia a secciones_limpieza
ALTER TABLE aspectos_energeticos 
  ADD COLUMN IF NOT EXISTS seccion_id INTEGER REFERENCES secciones_limpieza(id) ON DELETE SET NULL;

-- Añadir columna tipo_limpieza
ALTER TABLE aspectos_energeticos 
  ADD COLUMN IF NOT EXISTS tipo_limpieza VARCHAR(20) DEFAULT 'regular';

-- Añadir columna cantidad_minima
ALTER TABLE aspectos_energeticos 
  ADD COLUMN IF NOT EXISTS cantidad_minima INTEGER;

-- Añadir columna descripcion_corta
ALTER TABLE aspectos_energeticos
  ADD COLUMN IF NOT EXISTS descripcion_corta TEXT;

-- Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_aspectos_energeticos_seccion_id ON aspectos_energeticos(seccion_id);
CREATE INDEX IF NOT EXISTS idx_aspectos_energeticos_nivel_minimo ON aspectos_energeticos(nivel_minimo);
CREATE INDEX IF NOT EXISTS idx_aspectos_energeticos_tipo_limpieza ON aspectos_energeticos(tipo_limpieza);

SELECT '✅ Columnas añadidas correctamente a aspectos_energeticos' AS resultado;






























