-- Script SQL para crear la tabla preparaciones_practica
CREATE TABLE IF NOT EXISTS preparaciones_practica (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  nivel INTEGER NOT NULL DEFAULT 1,
  video_url TEXT,
  orden INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_preparaciones_practica_nivel ON preparaciones_practica(nivel);
CREATE INDEX IF NOT EXISTS idx_preparaciones_practica_activo ON preparaciones_practica(activo);
CREATE INDEX IF NOT EXISTS idx_preparaciones_practica_orden ON preparaciones_practica(orden);



















