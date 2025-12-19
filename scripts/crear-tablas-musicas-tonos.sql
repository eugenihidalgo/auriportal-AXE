-- Script SQL para crear las tablas de músicas y tonos de meditación
CREATE TABLE IF NOT EXISTS musicas_meditacion (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  archivo_path TEXT,
  url_externa TEXT,
  duracion_segundos INTEGER,
  peso_mb DECIMAL(10,2),
  categoria VARCHAR(100),
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_musicas_meditacion_activo ON musicas_meditacion(activo);
CREATE INDEX IF NOT EXISTS idx_musicas_meditacion_categoria ON musicas_meditacion(categoria);

CREATE TABLE IF NOT EXISTS tonos_meditacion (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  archivo_path TEXT,
  url_externa TEXT,
  duracion_segundos INTEGER,
  peso_mb DECIMAL(10,2),
  categoria VARCHAR(100),
  es_por_defecto BOOLEAN DEFAULT FALSE,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tonos_meditacion_activo ON tonos_meditacion(activo);
CREATE INDEX IF NOT EXISTS idx_tonos_meditacion_categoria ON tonos_meditacion(categoria);
CREATE INDEX IF NOT EXISTS idx_tonos_meditacion_por_defecto ON tonos_meditacion(es_por_defecto);



















