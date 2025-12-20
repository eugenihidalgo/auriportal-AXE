-- Script SQL para crear la tabla tecnicas_limpieza
CREATE TABLE IF NOT EXISTS tecnicas_limpieza (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  nivel INTEGER NOT NULL DEFAULT 1,
  orden INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tecnicas_limpieza_nivel ON tecnicas_limpieza(nivel);
CREATE INDEX IF NOT EXISTS idx_tecnicas_limpieza_activo ON tecnicas_limpieza(activo);
CREATE INDEX IF NOT EXISTS idx_tecnicas_limpieza_orden ON tecnicas_limpieza(orden);






















