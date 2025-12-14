-- SQL para AuriPortal V6: Tablas de todos los módulos
-- Este archivo contiene todas las tablas necesarias para V6

-- ============================================
-- MÓDULO: AURIBOSSES (Retos de Ascenso)
-- ============================================

CREATE TABLE IF NOT EXISTS auribosses (
  id SERIAL PRIMARY KEY,
  nivel INTEGER NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  condiciones JSONB NOT NULL DEFAULT '{}',
  recompensa JSONB DEFAULT '{}',
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(nivel)
);

CREATE INDEX IF NOT EXISTS idx_auribosses_nivel ON auribosses(nivel);
CREATE INDEX IF NOT EXISTS idx_auribosses_activo ON auribosses(activo);

-- Tabla para tracking de completación de bosses
CREATE TABLE IF NOT EXISTS auribosses_alumnos (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  boss_id INTEGER NOT NULL REFERENCES auribosses(id) ON DELETE CASCADE,
  completado BOOLEAN DEFAULT false,
  intentos INTEGER DEFAULT 0,
  fecha_completado TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(alumno_id, boss_id)
);

CREATE INDEX IF NOT EXISTS idx_auribosses_alumnos_alumno_id ON auribosses_alumnos(alumno_id);
CREATE INDEX IF NOT EXISTS idx_auribosses_alumnos_completado ON auribosses_alumnos(completado);

-- ============================================
-- MÓDULO: ARQUETIPOS DINÁMICOS
-- ============================================

CREATE TABLE IF NOT EXISTS arquetipos (
  id SERIAL PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  icono TEXT,
  descripcion TEXT,
  condiciones JSONB NOT NULL DEFAULT '{}',
  prioridad INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_arquetipos_codigo ON arquetipos(codigo);
CREATE INDEX IF NOT EXISTS idx_arquetipos_activo ON arquetipos(activo);

-- Tabla para asignación de arquetipos a alumnos
CREATE TABLE IF NOT EXISTS arquetipos_alumnos (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  arquetipo_codigo TEXT NOT NULL REFERENCES arquetipos(codigo) ON DELETE CASCADE,
  fecha_asignado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(alumno_id, arquetipo_codigo)
);

CREATE INDEX IF NOT EXISTS idx_arquetipos_alumnos_alumno_id ON arquetipos_alumnos(alumno_id);

-- ============================================
-- MÓDULO: INFORME SEMANAL
-- ============================================

CREATE TABLE IF NOT EXISTS informes_semanales (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  semana INTEGER NOT NULL,
  año INTEGER NOT NULL,
  fecha_generado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  contenido JSONB NOT NULL DEFAULT '{}',
  enviado BOOLEAN DEFAULT false,
  fecha_enviado TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(alumno_id, año, semana)
);

CREATE INDEX IF NOT EXISTS idx_informes_semanales_alumno_id ON informes_semanales(alumno_id);
CREATE INDEX IF NOT EXISTS idx_informes_semanales_enviado ON informes_semanales(enviado);

-- ============================================
-- MÓDULO: PRÁCTICAS SORPRESA
-- ============================================

CREATE TABLE IF NOT EXISTS sorpresas (
  id SERIAL PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  texto TEXT NOT NULL,
  tipo TEXT NOT NULL,
  condiciones JSONB DEFAULT '{}',
  prioridad INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sorpresas_tipo ON sorpresas(tipo);
CREATE INDEX IF NOT EXISTS idx_sorpresas_activo ON sorpresas(activo);

-- Tabla para tracking de sorpresas mostradas
CREATE TABLE IF NOT EXISTS sorpresas_alumnos (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  sorpresa_id INTEGER NOT NULL REFERENCES sorpresas(id) ON DELETE CASCADE,
  fecha_mostrada TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completada BOOLEAN DEFAULT false,
  fecha_completada TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sorpresas_alumnos_alumno_id ON sorpresas_alumnos(alumno_id);

-- ============================================
-- MÓDULO: MODO HISTORIA
-- ============================================

CREATE TABLE IF NOT EXISTS historias (
  id SERIAL PRIMARY KEY,
  capitulo INTEGER NOT NULL,
  escena INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  contenido TEXT NOT NULL,
  condiciones JSONB DEFAULT '{}',
  media_url TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(capitulo, escena)
);

CREATE INDEX IF NOT EXISTS idx_historias_capitulo ON historias(capitulo);
CREATE INDEX IF NOT EXISTS idx_historias_activo ON historias(activo);

-- Tabla para tracking de progreso en historia
CREATE TABLE IF NOT EXISTS historias_alumnos (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  historia_id INTEGER NOT NULL REFERENCES historias(id) ON DELETE CASCADE,
  completada BOOLEAN DEFAULT false,
  fecha_vista TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_completada TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(alumno_id, historia_id)
);

CREATE INDEX IF NOT EXISTS idx_historias_alumnos_alumno_id ON historias_alumnos(alumno_id);

-- ============================================
-- MÓDULO: EVOLUCIÓN AVATAR AURELÍN
-- ============================================

CREATE TABLE IF NOT EXISTS avatar_estados (
  id SERIAL PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  nivel_min INTEGER DEFAULT 0,
  racha_min INTEGER DEFAULT 0,
  emocion_min INTEGER DEFAULT 0,
  arquetipo_requerido TEXT,
  imagen_url TEXT,
  descripcion TEXT,
  prioridad INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_avatar_estados_codigo ON avatar_estados(codigo);
CREATE INDEX IF NOT EXISTS idx_avatar_estados_activo ON avatar_estados(activo);

-- Tabla para tracking del avatar actual del alumno
CREATE TABLE IF NOT EXISTS avatar_alumnos (
  alumno_id INTEGER PRIMARY KEY REFERENCES alumnos(id) ON DELETE CASCADE,
  avatar_codigo TEXT NOT NULL REFERENCES avatar_estados(codigo),
  fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- MÓDULO: AURIMAPA (Mapa Interior)
-- ============================================

CREATE TABLE IF NOT EXISTS aurimapa_nodos (
  id SERIAL PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  condiciones JSONB DEFAULT '{}',
  icono TEXT,
  orden INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_aurimapa_nodos_codigo ON aurimapa_nodos(codigo);
CREATE INDEX IF NOT EXISTS idx_aurimapa_nodos_orden ON aurimapa_nodos(orden);

-- Tabla para tracking de nodos desbloqueados
CREATE TABLE IF NOT EXISTS aurimapa_alumnos (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  nodo_id INTEGER NOT NULL REFERENCES aurimapa_nodos(id) ON DELETE CASCADE,
  desbloqueado BOOLEAN DEFAULT false,
  fecha_desbloqueado TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(alumno_id, nodo_id)
);

CREATE INDEX IF NOT EXISTS idx_aurimapa_alumnos_alumno_id ON aurimapa_alumnos(alumno_id);

-- ============================================
-- MÓDULO: AURIQUEST (Viajes Guiados)
-- ============================================

CREATE TABLE IF NOT EXISTS quests (
  id SERIAL PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  dias INTEGER NOT NULL,
  contenido JSONB NOT NULL DEFAULT '[]',
  recompensa JSONB DEFAULT '{}',
  nivel_minimo INTEGER DEFAULT 1,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quests_codigo ON quests(codigo);
CREATE INDEX IF NOT EXISTS idx_quests_activo ON quests(activo);

-- Tabla para tracking de quests de alumnos
CREATE TABLE IF NOT EXISTS quests_alumnos (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  quest_id INTEGER NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  dia_actual INTEGER DEFAULT 1,
  completada BOOLEAN DEFAULT false,
  fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_completada TIMESTAMP,
  progreso JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quests_alumnos_alumno_id ON quests_alumnos(alumno_id);
CREATE INDEX IF NOT EXISTS idx_quests_alumnos_completada ON quests_alumnos(completada);

-- ============================================
-- MÓDULO: TOKEN AURI (Beta)
-- ============================================

CREATE TABLE IF NOT EXISTS tokens_auri (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  balance INTEGER DEFAULT 0,
  total_ganados INTEGER DEFAULT 0,
  total_gastados INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(alumno_id)
);

CREATE INDEX IF NOT EXISTS idx_tokens_auri_alumno_id ON tokens_auri(alumno_id);

-- Tabla para historial de transacciones de tokens
CREATE TABLE IF NOT EXISTS tokens_transacciones (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  cantidad INTEGER NOT NULL,
  concepto TEXT,
  metadata JSONB DEFAULT '{}',
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tokens_transacciones_alumno_id ON tokens_transacciones(alumno_id);
CREATE INDEX IF NOT EXISTS idx_tokens_transacciones_tipo ON tokens_transacciones(tipo);
CREATE INDEX IF NOT EXISTS idx_tokens_transacciones_fecha ON tokens_transacciones(fecha);

-- Insertar datos iniciales de ejemplo para cada módulo
-- Los módulos ya están en modulos_sistema, ahora añadimos contenido base

-- Auribosses de ejemplo
INSERT INTO auribosses (nivel, nombre, descripcion, condiciones) VALUES
  (2, 'Guardián del Despertar', 'Primer reto: demuestra tu compromiso inicial', 
   '{"min_practicas": 10, "min_racha": 3, "energia_min": 4}'::jsonb),
  (4, 'Explorador de la Conciencia', 'Reto intermedio: expande tu práctica', 
   '{"min_practicas": 25, "min_practicas_aspecto": {"sanacion": 5}, "min_racha": 7, "energia_min": 5}'::jsonb),
  (7, 'Maestro de la Transformación', 'Reto avanzado: dominio completo', 
   '{"min_practicas": 50, "min_racha": 14, "energia_min": 7, "min_diversidad": 5}'::jsonb),
  (10, 'Canalizador Supremo', 'Reto máximo: ascensión total', 
   '{"min_practicas": 100, "min_racha": 21, "energia_min": 8, "min_diversidad": 8}'::jsonb)
ON CONFLICT (nivel) DO NOTHING;

-- Arquetipos de ejemplo
INSERT INTO arquetipos (codigo, nombre, icono, descripcion, condiciones) VALUES
  ('explorador', 'El Explorador', '🧭', 'Practica muchos aspectos diferentes', 
   '{"diversidad_min": 6, "practicas_mes": 15}'::jsonb),
  ('constante', 'El Constante', '⚡', 'Mantiene racha larga y consistente', 
   '{"racha_min": 14, "practicas_semana": 4}'::jsonb),
  ('profundo', 'El Profundo', '🔮', 'Se enfoca intensamente en pocos aspectos', 
   '{"practicas_aspecto_principal": 20, "reflexiones_mes": 10}'::jsonb),
  ('sanador', 'El Sanador', '💚', 'Orientado a sanación y bienestar', 
   '{"practicas_sanacion": 15, "energia_promedio": 7}'::jsonb),
  ('canalizador', 'El Canalizador', '✨', 'Domina la canalización', 
   '{"practicas_canalizacion": 20, "nivel_min": 7}'::jsonb)
ON CONFLICT (codigo) DO NOTHING;

-- Estados de avatar de ejemplo
INSERT INTO avatar_estados (codigo, nombre, nivel_min, racha_min, emocion_min, imagen_url, descripcion) VALUES
  ('aurelin_novato', 'Aurelín Novato', 1, 0, 0, '/assets/avatar/novato.svg', 'Inicio del viaje'),
  ('aurelin_aprendiz', 'Aurelín Aprendiz', 3, 5, 4, '/assets/avatar/aprendiz.svg', 'Primeros pasos consolidados'),
  ('aurelin_practicante', 'Aurelín Practicante', 5, 10, 5, '/assets/avatar/practicante.svg', 'Práctica constante'),
  ('aurelin_maestro', 'Aurelín Maestro', 7, 15, 6, '/assets/avatar/maestro.svg', 'Dominio avanzado'),
  ('aurelin_iluminado', 'Aurelín Iluminado', 10, 21, 8, '/assets/avatar/iluminado.svg', 'Máxima evolución')
ON CONFLICT (codigo) DO NOTHING;

-- Nodos de Aurimapa de ejemplo
INSERT INTO aurimapa_nodos (codigo, nombre, descripcion, icono, orden, condiciones) VALUES
  ('inicio', 'Inicio del Viaje', 'El primer paso en tu mapa interior', '🌱', 1, '{}'::jsonb),
  ('sanacion_basica', 'Sanación Básica', 'Fundamentos de sanación personal', '💚', 2, '{"practicas_min": 5}'::jsonb),
  ('exploracion', 'Exploración Interna', 'Descubre tus profundidades', '🧭', 3, '{"practicas_min": 10, "aspectos_min": 3}'::jsonb),
  ('transformacion', 'Portal de Transformación', 'Umbral de cambio profundo', '🔮', 4, '{"nivel_min": 5, "racha_min": 7}'::jsonb),
  ('canalizacion', 'Maestría en Canalización', 'Dominio de la canalización', '✨', 5, '{"nivel_min": 7, "practicas_canalizacion": 15}'::jsonb),
  ('iluminacion', 'Iluminación Total', 'Estado de máxima consciencia', '🌟', 6, '{"nivel_min": 10, "racha_min": 21, "energia_min": 8}'::jsonb)
ON CONFLICT (codigo) DO NOTHING;

-- Quests de ejemplo
INSERT INTO quests (codigo, nombre, descripcion, dias, nivel_minimo, contenido) VALUES
  ('viaje_sanacion', 'Viaje de 7 Días: Sanación Profunda', 'Una semana dedicada a sanar y liberar', 7, 1,
   '[
     {"dia": 1, "titulo": "Reconocimiento", "practica": "Respiración consciente", "reflexion": "¿Qué necesita sanar en mí?"},
     {"dia": 2, "titulo": "Aceptación", "practica": "Meditación del perdón", "reflexion": "¿Qué estoy listo para aceptar?"},
     {"dia": 3, "titulo": "Liberación", "practica": "Movimiento liberador", "reflexion": "¿Qué puedo soltar hoy?"},
     {"dia": 4, "titulo": "Integración", "practica": "Silencio interior", "reflexion": "¿Qué he aprendido?"},
     {"dia": 5, "titulo": "Renovación", "practica": "Conexión con la naturaleza", "reflexion": "¿Cómo me siento renovado?"},
     {"dia": 6, "titulo": "Gratitud", "practica": "Práctica de gratitud", "reflexion": "¿Por qué estoy agradecido?"},
     {"dia": 7, "titulo": "Celebración", "practica": "Ritual de cierre", "reflexion": "¿Qué celebro de este viaje?"}
   ]'::jsonb),
  ('quest_exploracion', 'Quest de Exploración: 5 Aspectos', '5 días explorando diferentes aspectos', 5, 3,
   '[
     {"dia": 1, "titulo": "Sanación", "aspecto": "sanacion"},
     {"dia": 2, "titulo": "Meditación", "aspecto": "meditacion"},
     {"dia": 3, "titulo": "Movimiento", "aspecto": "movimiento"},
     {"dia": 4, "titulo": "Creatividad", "aspecto": "creatividad"},
     {"dia": 5, "titulo": "Canalización", "aspecto": "canalizacion"}
   ]'::jsonb)
ON CONFLICT (codigo) DO NOTHING;

-- Sorpresas de ejemplo
INSERT INTO sorpresas (codigo, texto, tipo, condiciones) VALUES
  ('primera_practica', '¡Felicidades por tu primera práctica! 🎉', 'celebracion', '{"practicas_total": 1}'::jsonb),
  ('racha_7', '¡7 días seguidos! Tu constancia es inspiradora ⚡', 'motivacion', '{"racha": 7}'::jsonb),
  ('nivel_up', '¡Has subido de nivel! Tu evolución es hermosa 🌟', 'logro', '{"nivel_cambio": true}'::jsonb),
  ('practica_sorpresa_sanacion', '¿Qué tal una práctica de sanación hoy? Tu cuerpo te lo agradecerá 💚', 'sugerencia', '{"sin_practica_dias": 2}'::jsonb)
ON CONFLICT (codigo) DO NOTHING;



