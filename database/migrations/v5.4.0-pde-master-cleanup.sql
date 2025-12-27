-- ============================================================================
-- Migración v5.4.0: PDE Master Cleanup - Soft Delete y Normalización
-- ============================================================================
-- Fecha: 2025-12-17
-- Descripción: Normalización de tablas PDE para soft delete, auditoría y
--              campos faltantes en lugares/proyectos/apadrinados.
--
-- PRINCIPIOS:
-- 1. Soft delete obligatorio (deleted_at en lugar de borrado físico)
-- 2. Índices compuestos para consultas frecuentes
-- 3. Auditoría integrada en limpiezas
-- 4. Backwards compatible
--
-- DOCUMENTACIÓN: docs/FLUJO_COMPLETO_LIMPIEZA_V1.md
-- ============================================================================

-- ============================================================================
-- 1. TRANSMUTACIONES LUGARES - Soft Delete y Normalización
-- ============================================================================

-- Crear tabla si no existe
CREATE TABLE IF NOT EXISTS transmutaciones_lugares (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  descripcion TEXT,
  nivel_minimo INT DEFAULT 1,
  frecuencia_dias INT DEFAULT 30,
  prioridad VARCHAR(50) DEFAULT 'Normal',
  orden INT DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE,
  alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE,
  deleted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Añadir deleted_at si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transmutaciones_lugares' 
    AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE transmutaciones_lugares 
    ADD COLUMN deleted_at TIMESTAMP NULL;
    
    RAISE NOTICE 'Columna deleted_at añadida a transmutaciones_lugares';
  END IF;
END $$;

-- Añadir alumno_id si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transmutaciones_lugares' 
    AND column_name = 'alumno_id'
  ) THEN
    ALTER TABLE transmutaciones_lugares 
    ADD COLUMN alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Columna alumno_id añadida a transmutaciones_lugares';
  END IF;
END $$;

-- Crear índices para lugares
CREATE INDEX IF NOT EXISTS idx_transmutaciones_lugares_activo 
ON transmutaciones_lugares(activo);

CREATE INDEX IF NOT EXISTS idx_transmutaciones_lugares_nivel 
ON transmutaciones_lugares(nivel_minimo);

CREATE INDEX IF NOT EXISTS idx_transmutaciones_lugares_alumno_activo 
ON transmutaciones_lugares(alumno_id, activo) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_transmutaciones_lugares_soft_delete 
ON transmutaciones_lugares(deleted_at) 
WHERE deleted_at IS NOT NULL;

-- Tabla de estado de lugares por alumno
CREATE TABLE IF NOT EXISTS transmutaciones_lugares_estado (
  id SERIAL PRIMARY KEY,
  lugar_id INT REFERENCES transmutaciones_lugares(id) ON DELETE CASCADE,
  alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE,
  estado VARCHAR(50) DEFAULT 'pendiente',
  ultima_limpieza TIMESTAMP,
  veces_limpiado INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (lugar_id, alumno_id)
);

CREATE INDEX IF NOT EXISTS idx_transmutaciones_lugares_estado_lugar 
ON transmutaciones_lugares_estado(lugar_id);

CREATE INDEX IF NOT EXISTS idx_transmutaciones_lugares_estado_alumno 
ON transmutaciones_lugares_estado(alumno_id);

-- ============================================================================
-- 2. TRANSMUTACIONES PROYECTOS - Soft Delete y Normalización
-- ============================================================================

-- Crear tabla si no existe
CREATE TABLE IF NOT EXISTS transmutaciones_proyectos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  descripcion TEXT,
  nivel_minimo INT DEFAULT 1,
  frecuencia_dias INT DEFAULT 30,
  prioridad VARCHAR(50) DEFAULT 'Normal',
  orden INT DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE,
  alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE,
  deleted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Añadir deleted_at si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transmutaciones_proyectos' 
    AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE transmutaciones_proyectos 
    ADD COLUMN deleted_at TIMESTAMP NULL;
    
    RAISE NOTICE 'Columna deleted_at añadida a transmutaciones_proyectos';
  END IF;
END $$;

-- Añadir alumno_id si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transmutaciones_proyectos' 
    AND column_name = 'alumno_id'
  ) THEN
    ALTER TABLE transmutaciones_proyectos 
    ADD COLUMN alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Columna alumno_id añadida a transmutaciones_proyectos';
  END IF;
END $$;

-- Crear índices para proyectos
CREATE INDEX IF NOT EXISTS idx_transmutaciones_proyectos_activo 
ON transmutaciones_proyectos(activo);

CREATE INDEX IF NOT EXISTS idx_transmutaciones_proyectos_nivel 
ON transmutaciones_proyectos(nivel_minimo);

CREATE INDEX IF NOT EXISTS idx_transmutaciones_proyectos_alumno_activo 
ON transmutaciones_proyectos(alumno_id, activo) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_transmutaciones_proyectos_soft_delete 
ON transmutaciones_proyectos(deleted_at) 
WHERE deleted_at IS NOT NULL;

-- Tabla de estado de proyectos por alumno
CREATE TABLE IF NOT EXISTS transmutaciones_proyectos_estado (
  id SERIAL PRIMARY KEY,
  proyecto_id INT REFERENCES transmutaciones_proyectos(id) ON DELETE CASCADE,
  alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE,
  estado VARCHAR(50) DEFAULT 'pendiente',
  ultima_limpieza TIMESTAMP,
  veces_limpiado INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (proyecto_id, alumno_id)
);

CREATE INDEX IF NOT EXISTS idx_transmutaciones_proyectos_estado_proyecto 
ON transmutaciones_proyectos_estado(proyecto_id);

CREATE INDEX IF NOT EXISTS idx_transmutaciones_proyectos_estado_alumno 
ON transmutaciones_proyectos_estado(alumno_id);

-- ============================================================================
-- 3. TRANSMUTACIONES APADRINADOS - Soft Delete y Normalización
-- ============================================================================

-- Crear tabla si no existe
CREATE TABLE IF NOT EXISTS transmutaciones_apadrinados (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  descripcion TEXT,
  nivel_minimo INT DEFAULT 1,
  frecuencia_dias INT DEFAULT 30,
  prioridad VARCHAR(50) DEFAULT 'Normal',
  orden INT DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE,
  alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE,
  deleted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Añadir deleted_at si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transmutaciones_apadrinados' 
    AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE transmutaciones_apadrinados 
    ADD COLUMN deleted_at TIMESTAMP NULL;
    
    RAISE NOTICE 'Columna deleted_at añadida a transmutaciones_apadrinados';
  END IF;
END $$;

-- Añadir alumno_id si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transmutaciones_apadrinados' 
    AND column_name = 'alumno_id'
  ) THEN
    ALTER TABLE transmutaciones_apadrinados 
    ADD COLUMN alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Columna alumno_id añadida a transmutaciones_apadrinados';
  END IF;
END $$;

-- Crear índices para apadrinados
CREATE INDEX IF NOT EXISTS idx_transmutaciones_apadrinados_activo 
ON transmutaciones_apadrinados(activo);

CREATE INDEX IF NOT EXISTS idx_transmutaciones_apadrinados_nivel 
ON transmutaciones_apadrinados(nivel_minimo);

CREATE INDEX IF NOT EXISTS idx_transmutaciones_apadrinados_alumno_activo 
ON transmutaciones_apadrinados(alumno_id, activo) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_transmutaciones_apadrinados_soft_delete 
ON transmutaciones_apadrinados(deleted_at) 
WHERE deleted_at IS NOT NULL;

-- Tabla de estado de apadrinados por alumno
CREATE TABLE IF NOT EXISTS transmutaciones_apadrinados_estado (
  id SERIAL PRIMARY KEY,
  apadrinado_id INT REFERENCES transmutaciones_apadrinados(id) ON DELETE CASCADE,
  alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE,
  estado VARCHAR(50) DEFAULT 'pendiente',
  ultima_limpieza TIMESTAMP,
  veces_limpiado INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (apadrinado_id, alumno_id)
);

CREATE INDEX IF NOT EXISTS idx_transmutaciones_apadrinados_estado_apadrinado 
ON transmutaciones_apadrinados_estado(apadrinado_id);

CREATE INDEX IF NOT EXISTS idx_transmutaciones_apadrinados_estado_alumno 
ON transmutaciones_apadrinados_estado(alumno_id);

-- ============================================================================
-- 4. HISTORIAL DE LIMPIEZAS MASTER (Auditoría)
-- ============================================================================

-- Crear tabla de historial de limpiezas si no existe
CREATE TABLE IF NOT EXISTS limpiezas_master_historial (
  id SERIAL PRIMARY KEY,
  alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL,
  aspecto_id INT NOT NULL,
  aspecto_nombre VARCHAR(500),
  seccion VARCHAR(100),
  accion VARCHAR(100) DEFAULT 'marcar_limpio',
  master_id INT REFERENCES alumnos(id),
  metadata JSONB DEFAULT '{}',
  fecha_limpieza TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Añadir columnas si no existen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'limpiezas_master_historial' 
    AND column_name = 'accion'
  ) THEN
    ALTER TABLE limpiezas_master_historial 
    ADD COLUMN accion VARCHAR(100) DEFAULT 'marcar_limpio';
    RAISE NOTICE 'Columna accion añadida a limpiezas_master_historial';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'limpiezas_master_historial' 
    AND column_name = 'master_id'
  ) THEN
    ALTER TABLE limpiezas_master_historial 
    ADD COLUMN master_id INT REFERENCES alumnos(id);
    RAISE NOTICE 'Columna master_id añadida a limpiezas_master_historial';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'limpiezas_master_historial' 
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE limpiezas_master_historial 
    ADD COLUMN metadata JSONB DEFAULT '{}';
    RAISE NOTICE 'Columna metadata añadida a limpiezas_master_historial';
  END IF;
END $$;

-- Crear índices para historial
CREATE INDEX IF NOT EXISTS idx_limpiezas_master_historial_alumno 
ON limpiezas_master_historial(alumno_id);

CREATE INDEX IF NOT EXISTS idx_limpiezas_master_historial_fecha 
ON limpiezas_master_historial(fecha_limpieza);

CREATE INDEX IF NOT EXISTS idx_limpiezas_master_historial_tipo 
ON limpiezas_master_historial(tipo);

CREATE INDEX IF NOT EXISTS idx_limpiezas_master_historial_accion 
ON limpiezas_master_historial(accion);

-- ============================================================================
-- 5. ALUMNOS LUGARES (Lugares personales de alumnos)
-- ============================================================================

-- Crear tabla si no existe
CREATE TABLE IF NOT EXISTS alumnos_lugares (
  id SERIAL PRIMARY KEY,
  alumno_id INT NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  nombre VARCHAR(200) NOT NULL,
  descripcion TEXT,
  frecuencia_dias INT DEFAULT 30,
  prioridad VARCHAR(50) DEFAULT 'Normal',
  activo BOOLEAN DEFAULT TRUE,
  deleted_at TIMESTAMP NULL,
  ultima_limpieza TIMESTAMP,
  veces_limpiado INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Añadir deleted_at si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'alumnos_lugares' 
    AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE alumnos_lugares 
    ADD COLUMN deleted_at TIMESTAMP NULL;
    RAISE NOTICE 'Columna deleted_at añadida a alumnos_lugares';
  END IF;
END $$;

-- Crear índices para lugares personales
CREATE INDEX IF NOT EXISTS idx_alumnos_lugares_alumno 
ON alumnos_lugares(alumno_id);

CREATE INDEX IF NOT EXISTS idx_alumnos_lugares_activo 
ON alumnos_lugares(alumno_id, activo) 
WHERE deleted_at IS NULL;

-- ============================================================================
-- 6. ALUMNOS PROYECTOS (Proyectos personales de alumnos)
-- ============================================================================

-- Crear tabla si no existe
CREATE TABLE IF NOT EXISTS alumnos_proyectos (
  id SERIAL PRIMARY KEY,
  alumno_id INT NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  nombre VARCHAR(200) NOT NULL,
  descripcion TEXT,
  frecuencia_dias INT DEFAULT 30,
  prioridad VARCHAR(50) DEFAULT 'Normal',
  activo BOOLEAN DEFAULT TRUE,
  deleted_at TIMESTAMP NULL,
  ultima_limpieza TIMESTAMP,
  veces_limpiado INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Añadir deleted_at si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'alumnos_proyectos' 
    AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE alumnos_proyectos 
    ADD COLUMN deleted_at TIMESTAMP NULL;
    RAISE NOTICE 'Columna deleted_at añadida a alumnos_proyectos';
  END IF;
END $$;

-- Crear índices para proyectos personales
CREATE INDEX IF NOT EXISTS idx_alumnos_proyectos_alumno 
ON alumnos_proyectos(alumno_id);

CREATE INDEX IF NOT EXISTS idx_alumnos_proyectos_activo 
ON alumnos_proyectos(alumno_id, activo) 
WHERE deleted_at IS NULL;

-- ============================================================================
-- 7. ALUMNOS APADRINADOS (Apadrinados personales de alumnos)
-- ============================================================================

-- Crear tabla si no existe
CREATE TABLE IF NOT EXISTS alumnos_apadrinados (
  id SERIAL PRIMARY KEY,
  alumno_id INT NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  nombre VARCHAR(200) NOT NULL,
  descripcion TEXT,
  frecuencia_dias INT DEFAULT 30,
  prioridad VARCHAR(50) DEFAULT 'Normal',
  activo BOOLEAN DEFAULT TRUE,
  deleted_at TIMESTAMP NULL,
  ultima_limpieza TIMESTAMP,
  veces_limpiado INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Añadir deleted_at si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'alumnos_apadrinados' 
    AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE alumnos_apadrinados 
    ADD COLUMN deleted_at TIMESTAMP NULL;
    RAISE NOTICE 'Columna deleted_at añadida a alumnos_apadrinados';
  END IF;
END $$;

-- Crear índices para apadrinados personales
CREATE INDEX IF NOT EXISTS idx_alumnos_apadrinados_alumno 
ON alumnos_apadrinados(alumno_id);

CREATE INDEX IF NOT EXISTS idx_alumnos_apadrinados_activo 
ON alumnos_apadrinados(alumno_id, activo) 
WHERE deleted_at IS NULL;

-- ============================================================================
-- 8. COMENTARIOS PARA DOCUMENTACIÓN
-- ============================================================================

COMMENT ON COLUMN transmutaciones_lugares.deleted_at IS 
'Timestamp de soft delete. NULL = activo, NOT NULL = eliminado (no borrar físicamente)';

COMMENT ON COLUMN transmutaciones_proyectos.deleted_at IS 
'Timestamp de soft delete. NULL = activo, NOT NULL = eliminado (no borrar físicamente)';

COMMENT ON COLUMN transmutaciones_apadrinados.deleted_at IS 
'Timestamp de soft delete. NULL = activo, NOT NULL = eliminado (no borrar físicamente)';

COMMENT ON TABLE limpiezas_master_historial IS 
'Historial de todas las acciones de limpieza realizadas por el Master.
Formato de accion: marcar_limpio, marcar_todo_limpio, activar, desactivar';

COMMENT ON COLUMN limpiezas_master_historial.metadata IS 
'Metadatos adicionales de la acción en formato JSON:
- Para marcar_todo_limpio: {total_items, tipo}
- Para individual: {anterior_estado, nuevo_estado}';

-- ============================================================================
-- 9. REGISTRO DE MIGRACIÓN
-- ============================================================================

-- Crear tabla de migraciones si no existe
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(50) PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  description TEXT
);

-- Registrar esta migración
INSERT INTO schema_migrations (version, description)
VALUES ('v5.4.0', 'PDE Master Cleanup: Soft delete, normalización y auditoría de limpiezas')
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- FIN DE MIGRACIÓN v5.4.0
-- ============================================================================














