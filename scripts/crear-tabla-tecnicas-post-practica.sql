-- Script SQL para crear la tabla tecnicas_post_practica
CREATE TABLE IF NOT EXISTS tecnicas_post_practica (
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

CREATE INDEX IF NOT EXISTS idx_tecnicas_post_practica_nivel ON tecnicas_post_practica(nivel);
CREATE INDEX IF NOT EXISTS idx_tecnicas_post_practica_activo ON tecnicas_post_practica(activo);
CREATE INDEX IF NOT EXISTS idx_tecnicas_post_practica_orden ON tecnicas_post_practica(orden);







