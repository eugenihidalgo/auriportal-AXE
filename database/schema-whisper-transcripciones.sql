-- Schema para historial de transcripciones Whisper
-- Tabla para guardar historial de todas las transcripciones realizadas

CREATE TABLE IF NOT EXISTS whisper_transcripciones (
  id SERIAL PRIMARY KEY,
  archivo_id TEXT NOT NULL,
  archivo_nombre TEXT NOT NULL,
  carpeta_audio_id TEXT NOT NULL,
  carpeta_transcripcion_id TEXT NOT NULL,
  carpeta_procesados_id TEXT NOT NULL,
  modelo_usado TEXT NOT NULL, -- 'large' o 'medium'
  estado TEXT NOT NULL DEFAULT 'pendiente', -- 'pendiente', 'procesando', 'completado', 'error', 'pausado'
  transcripcion_id TEXT, -- ID del archivo de transcripción en Google Drive
  error_message TEXT,
  duracion_segundos INTEGER,
  tamaño_archivo_mb NUMERIC(10,2),
  progreso_porcentaje INTEGER DEFAULT 0, -- Progreso de transcripción (0-100)
  tiempo_estimado_restante INTEGER, -- Tiempo estimado restante en segundos
  fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_fin TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_whisper_transcripciones_estado ON whisper_transcripciones(estado);
CREATE INDEX idx_whisper_transcripciones_fecha ON whisper_transcripciones(fecha_inicio);
CREATE INDEX idx_whisper_transcripciones_archivo_id ON whisper_transcripciones(archivo_id);

-- Tabla para control de transcripciones (pausar/activar)
CREATE TABLE IF NOT EXISTS whisper_control (
  id SERIAL PRIMARY KEY,
  activo BOOLEAN DEFAULT true,
  ultima_ejecucion TIMESTAMP,
  proxima_ejecucion TIMESTAMP,
  total_procesados INTEGER DEFAULT 0,
  total_exitosos INTEGER DEFAULT 0,
  total_fallidos INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar registro inicial de control
INSERT INTO whisper_control (activo) VALUES (true) ON CONFLICT DO NOTHING;

