-- AuriPortal V8.0 - Schema SQL Completo
-- Módulo de Creación + Anatomía Energética

-- ============================================
-- 1. MÓDULO DE CREACIÓN
-- ============================================

-- Objetivos de Creación
CREATE TABLE IF NOT EXISTS creacion_objetivos (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  estado TEXT DEFAULT 'activo',
  prioridad INTEGER DEFAULT 3,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_objetivo TIMESTAMP,
  fecha_completado TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  CONSTRAINT check_estado_objetivo CHECK (estado IN ('activo', 'completado', 'descartado')),
  CONSTRAINT check_prioridad_objetivo CHECK (prioridad IN (1, 2, 3))
);

CREATE INDEX IF NOT EXISTS idx_creacion_objetivos_alumno ON creacion_objetivos(alumno_id);
CREATE INDEX IF NOT EXISTS idx_creacion_objetivos_estado ON creacion_objetivos(estado);

-- Versión Futura del Alumno (IA Local)
CREATE TABLE IF NOT EXISTS creacion_version_futura (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER NOT NULL UNIQUE REFERENCES alumnos(id) ON DELETE CASCADE,
  borrador_original TEXT NOT NULL,
  version_ia TEXT,
  version_editada TEXT,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_ultima_edicion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_creacion_version_futura_alumno ON creacion_version_futura(alumno_id);

-- Problemas Iniciales
CREATE TABLE IF NOT EXISTS creacion_problemas_iniciales (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  gravedad_inicial INTEGER,
  gravedad_actual INTEGER,
  fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_ultima_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  CONSTRAINT check_gravedad CHECK (gravedad_inicial >= 1 AND gravedad_inicial <= 10 AND gravedad_actual >= 1 AND gravedad_actual <= 10)
);

CREATE INDEX IF NOT EXISTS idx_creacion_problemas_alumno ON creacion_problemas_iniciales(alumno_id);

-- ============================================
-- 2. ANATOMÍA ENERGÉTICA - ASPECTOS A LIMPIAR (PRIORITARIO)
-- ============================================

-- Aspectos Energéticos Globales
CREATE TABLE IF NOT EXISTS aspectos_energeticos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  categoria TEXT DEFAULT 'chakra',
  frecuencia_dias INTEGER NOT NULL DEFAULT 14,
  prioridad INTEGER DEFAULT 3,
  activo BOOLEAN DEFAULT TRUE,
  orden INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT check_prioridad_aspecto CHECK (prioridad IN (1, 2, 3))
);

CREATE INDEX IF NOT EXISTS idx_aspectos_energeticos_activo ON aspectos_energeticos(activo);
CREATE INDEX IF NOT EXISTS idx_aspectos_energeticos_categoria ON aspectos_energeticos(categoria);
CREATE INDEX IF NOT EXISTS idx_aspectos_energeticos_orden ON aspectos_energeticos(orden);

-- Estado de Aspectos por Alumno
CREATE TABLE IF NOT EXISTS aspectos_energeticos_alumnos (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  aspecto_id INTEGER NOT NULL REFERENCES aspectos_energeticos(id) ON DELETE CASCADE,
  fecha_ultima_limpieza TIMESTAMP,
  fecha_proxima_recomendada TIMESTAMP,
  estado TEXT DEFAULT 'pendiente',
  veces_limpiado INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  UNIQUE (alumno_id, aspecto_id),
  CONSTRAINT check_estado_aspecto CHECK (estado IN ('pendiente', 'al_dia', 'muy_pendiente'))
);

CREATE INDEX IF NOT EXISTS idx_aspectos_alumnos_alumno ON aspectos_energeticos_alumnos(alumno_id);
CREATE INDEX IF NOT EXISTS idx_aspectos_alumnos_aspecto ON aspectos_energeticos_alumnos(aspecto_id);
CREATE INDEX IF NOT EXISTS idx_aspectos_alumnos_estado ON aspectos_energeticos_alumnos(estado);
CREATE INDEX IF NOT EXISTS idx_aspectos_alumnos_fecha_proxima ON aspectos_energeticos_alumnos(fecha_proxima_recomendada);

-- Registro Histórico de Limpiezas
CREATE TABLE IF NOT EXISTS aspectos_energeticos_registros (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  aspecto_id INTEGER NOT NULL REFERENCES aspectos_energeticos(id) ON DELETE CASCADE,
  fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modo_limpieza TEXT,
  origen TEXT,
  notas TEXT,
  metadata JSONB DEFAULT '{}',
  CONSTRAINT check_modo_limpieza CHECK (modo_limpieza IN ('basica', 'media', 'profunda', 'total', 'rescate'))
);

CREATE INDEX IF NOT EXISTS idx_aspectos_registros_alumno ON aspectos_energeticos_registros(alumno_id);
CREATE INDEX IF NOT EXISTS idx_aspectos_registros_aspecto ON aspectos_energeticos_registros(aspecto_id);
CREATE INDEX IF NOT EXISTS idx_aspectos_registros_fecha ON aspectos_energeticos_registros(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_aspectos_registros_modo ON aspectos_energeticos_registros(modo_limpieza);

-- ============================================
-- 3. DATOS DE EJEMPLO - ASPECTOS ENERGÉTICOS
-- ============================================

INSERT INTO aspectos_energeticos (nombre, descripcion, categoria, frecuencia_dias, prioridad, orden) VALUES
  ('Chakra Raíz', 'Primer chakra, conexión con la tierra', 'chakra', 14, 2, 1),
  ('Chakra Sacral', 'Segundo chakra, creatividad y sexualidad', 'chakra', 14, 2, 2),
  ('Chakra Plexo Solar', 'Tercer chakra, poder personal', 'chakra', 14, 2, 3),
  ('Chakra Corazón', 'Cuarto chakra, amor y compasión', 'chakra', 14, 1, 4),
  ('Chakra Garganta', 'Quinto chakra, comunicación', 'chakra', 14, 2, 5),
  ('Chakra Tercer Ojo', 'Sexto chakra, intuición', 'chakra', 14, 2, 6),
  ('Chakra Corona', 'Séptimo chakra, conexión espiritual', 'chakra', 14, 1, 7),
  ('Hígado Sutil', 'Órgano energético del hígado', 'organo', 14, 2, 12),
  ('Corazón Sutil', 'Órgano energético del corazón', 'organo', 14, 1, 13),
  ('Portal Estrella de la Tierra', 'Portal de conexión con la tierra', 'portal', 30, 1, 14),
  ('Portal Estrella del Alma', 'Portal de conexión con el alma', 'portal', 30, 1, 15)
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. NOTAS DEL MASTER
-- ============================================

CREATE TABLE IF NOT EXISTS notas_master (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  tipo VARCHAR(50) DEFAULT 'general',
  contenido TEXT NOT NULL,
  adjuntos JSONB DEFAULT '[]',
  creado_por VARCHAR(100) DEFAULT 'Master',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notas_master_alumno ON notas_master(alumno_id);
CREATE INDEX IF NOT EXISTS idx_notas_master_fecha ON notas_master(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_notas_master_tipo ON notas_master(tipo);

-- ============================================
-- 4. REGISTRAR MÓDULOS V8 EN SISTEMA (TODOS BETA)
-- ============================================

INSERT INTO modulos_sistema (codigo, nombre, descripcion, estado) VALUES
  ('creacion_objetivos', 'Objetivos de Creación', 'Gestión de objetivos para alumnos en módulo Creación', 'beta'),
  ('creacion_version_futura', 'Versión Futura', 'IA local para ordenar visión futura del alumno', 'beta'),
  ('creacion_problemas', 'Problemas Iniciales', 'Registro y evolución de problemas iniciales', 'beta'),
  ('aspectos_energeticos', 'Aspectos Energéticos', 'Biblioteca y gestión de aspectos a limpiar', 'beta'),
  ('rescate_energetico', 'Rescate Espiritual', 'Botón de rescate energético para emergencias', 'beta')
ON CONFLICT (codigo) DO UPDATE SET estado = 'beta';

SELECT 'Schema V8.0 ejecutado correctamente - 5 nuevos módulos en BETA' AS resultado;



