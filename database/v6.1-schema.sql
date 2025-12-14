-- AuriPortal V6.1 - Schema SQL Completo
-- 12 Nuevos Módulos

-- ============================================
-- 1. CÍRCULOS AURI - Energía Grupal Compartida
-- ============================================

CREATE TABLE IF NOT EXISTS circulos_auri (
  id SERIAL PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  aspecto_principal TEXT,
  fecha_inicio TIMESTAMP,
  fecha_fin TIMESTAMP,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_circulos_auri_activo ON circulos_auri(activo);
CREATE INDEX IF NOT EXISTS idx_circulos_auri_aspecto ON circulos_auri(aspecto_principal);

CREATE TABLE IF NOT EXISTS circulos_auri_miembros (
  id SERIAL PRIMARY KEY,
  circulo_id INTEGER REFERENCES circulos_auri(id) ON DELETE CASCADE,
  alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
  fecha_union TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  rol TEXT DEFAULT 'miembro',
  UNIQUE(circulo_id, alumno_id)
);

CREATE INDEX IF NOT EXISTS idx_circulos_miembros_circulo ON circulos_auri_miembros(circulo_id);
CREATE INDEX IF NOT EXISTS idx_circulos_miembros_alumno ON circulos_auri_miembros(alumno_id);

CREATE TABLE IF NOT EXISTS circulos_auri_metricas (
  id SERIAL PRIMARY KEY,
  circulo_id INTEGER REFERENCES circulos_auri(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  practicas_totales INTEGER DEFAULT 0,
  energia_media NUMERIC,
  aspecto_dominante TEXT,
  metadata JSONB DEFAULT '{}',
  UNIQUE(circulo_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_circulos_metricas_fecha ON circulos_auri_metricas(fecha);

-- ============================================
-- 2. DIARIO DE AURELÍN
-- ============================================

CREATE TABLE IF NOT EXISTS diario_practicas (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  texto_usuario TEXT,
  resumen_auto TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(alumno_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_diario_alumno_fecha ON diario_practicas(alumno_id, fecha DESC);

-- ============================================
-- 3. PRÁCTICAS CON HORARIO
-- ============================================

CREATE TABLE IF NOT EXISTS practicas_horario (
  id SERIAL PRIMARY KEY,
  codigo_practica TEXT NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  dias_semana INTEGER[] DEFAULT '{1,2,3,4,5,6,7}',
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_practicas_horario_activo ON practicas_horario(activo);
CREATE INDEX IF NOT EXISTS idx_practicas_horario_codigo ON practicas_horario(codigo_practica);

-- ============================================
-- 4. LABORATORIO DE IDEAS + CLICKUP
-- ============================================

CREATE TABLE IF NOT EXISTS ideas_practicas (
  id SERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  estado TEXT DEFAULT 'pendiente',
  aspecto_sugerido TEXT,
  prioridad INTEGER DEFAULT 0,
  clickup_task_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT check_estado_idea CHECK (estado IN ('pendiente', 'en_progreso', 'producida', 'descartada'))
);

CREATE INDEX IF NOT EXISTS idx_ideas_estado ON ideas_practicas(estado);
CREATE INDEX IF NOT EXISTS idx_ideas_prioridad ON ideas_practicas(prioridad DESC);

-- ============================================
-- 5. TAROT ENERGÉTICO
-- ============================================

CREATE TABLE IF NOT EXISTS tarot_cartas (
  id SERIAL PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  significado_luz TEXT,
  significado_sombra TEXT,
  aspecto_asociado TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tarot_cartas_codigo ON tarot_cartas(codigo);
CREATE INDEX IF NOT EXISTS idx_tarot_cartas_activo ON tarot_cartas(activo);

CREATE TABLE IF NOT EXISTS tarot_sesiones (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  cartas JSONB,
  interpretacion TEXT,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_tarot_sesiones_alumno ON tarot_sesiones(alumno_id);
CREATE INDEX IF NOT EXISTS idx_tarot_sesiones_fecha ON tarot_sesiones(fecha DESC);

-- ============================================
-- 6. EDITOR VISUAL DE PANTALLAS
-- ============================================

-- Extender tabla pantallas existente
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pantallas' AND column_name='contenido_html') THEN
    ALTER TABLE pantallas ADD COLUMN contenido_html TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pantallas' AND column_name='metadata') THEN
    ALTER TABLE pantallas ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;
END $$;

-- ============================================
-- 7. HISTORIAL 30 DÍAS
-- No requiere nuevas tablas, usa las existentes
-- ============================================

-- ============================================
-- 8. ALTAR PERSONAL
-- ============================================

CREATE TABLE IF NOT EXISTS altares (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
  configuracion JSONB NOT NULL DEFAULT '{}',
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(alumno_id)
);

CREATE INDEX IF NOT EXISTS idx_altares_alumno ON altares(alumno_id);

-- ============================================
-- 9. PUNTOS DE COMPASIÓN
-- ============================================

-- Extender tabla alumnos
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alumnos' AND column_name='puntos_compasion') THEN
    ALTER TABLE alumnos ADD COLUMN puntos_compasion INTEGER DEFAULT 0;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS practicas_compasion (
  id SERIAL PRIMARY KEY,
  practica_id INTEGER REFERENCES practicas(id) ON DELETE CASCADE,
  alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
  destinatario TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_practicas_compasion_alumno ON practicas_compasion(alumno_id);
CREATE INDEX IF NOT EXISTS idx_practicas_compasion_practica ON practicas_compasion(practica_id);

-- ============================================
-- 10. PREFERENCIAS DE NOTIFICACIONES
-- ============================================

CREATE TABLE IF NOT EXISTS notificaciones_preferencias (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
  email_informe_semanal BOOLEAN DEFAULT true,
  email_recordatorios BOOLEAN DEFAULT true,
  email_sorpresas BOOLEAN DEFAULT false,
  email_circulos BOOLEAN DEFAULT true,
  email_nuevos_modulos BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(alumno_id)
);

CREATE INDEX IF NOT EXISTS idx_notif_prefs_alumno ON notificaciones_preferencias(alumno_id);

-- ============================================
-- 11. MAESTRO INTERIOR (IA LOCAL)
-- ============================================

CREATE TABLE IF NOT EXISTS maestro_insights (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  texto TEXT NOT NULL,
  origen TEXT,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_maestro_insights_alumno ON maestro_insights(alumno_id);
CREATE INDEX IF NOT EXISTS idx_maestro_insights_fecha ON maestro_insights(fecha DESC);

CREATE TABLE IF NOT EXISTS maestro_conversaciones (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  rol TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  CONSTRAINT check_rol_maestro CHECK (rol IN ('usuario', 'maestro'))
);

CREATE INDEX IF NOT EXISTS idx_maestro_conv_alumno ON maestro_conversaciones(alumno_id);
CREATE INDEX IF NOT EXISTS idx_maestro_conv_fecha ON maestro_conversaciones(fecha DESC);

-- ============================================
-- 12. SELLOS DE ASCENSIÓN
-- ============================================

CREATE TABLE IF NOT EXISTS sellos_ascension (
  id SERIAL PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  nivel_desde INTEGER,
  nivel_hasta INTEGER,
  requisitos JSONB,
  imagen_url TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sellos_codigo ON sellos_ascension(codigo);
CREATE INDEX IF NOT EXISTS idx_sellos_nivel ON sellos_ascension(nivel_desde, nivel_hasta);

CREATE TABLE IF NOT EXISTS sellos_alumnos (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
  sello_codigo TEXT REFERENCES sellos_ascension(codigo),
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  UNIQUE(alumno_id, sello_codigo)
);

CREATE INDEX IF NOT EXISTS idx_sellos_alumnos_alumno ON sellos_alumnos(alumno_id);

-- ============================================
-- REGISTRAR MÓDULOS V6.1 EN SISTEMA
-- ============================================

INSERT INTO modulos_sistema (codigo, nombre, descripcion, estado) VALUES
  ('circulos_auri', 'Círculos Auri', 'Energía grupal compartida y retos colectivos', 'off'),
  ('diario_aurelin', 'Diario de Aurelín', 'Diario personal con auto-registro de prácticas', 'off'),
  ('practicas_horario', 'Prácticas por Horario', 'Prácticas desbloqueables por franjas horarias', 'off'),
  ('laboratorio_ideas', 'Laboratorio de Ideas', 'Backlog de prácticas + sync con ClickUp', 'off'),
  ('tarot_energetico', 'Tarot Energético', 'Tarot simbólico no adivinatorio (BETA)', 'off'),
  ('editor_pantallas', 'Editor Visual', 'Editor visual de pantallas HTML del portal', 'off'),
  ('timeline_30dias', 'Timeline 30 Días', 'Historial visual de 30 días del alumno', 'off'),
  ('altar_personal', 'Altar Personal', 'Espacio personal con símbolos y elementos favoritos', 'off'),
  ('puntos_compasion', 'Puntos de Compasión', 'Prácticas para los demás y recompensas', 'off'),
  ('notificaciones_prefs', 'Preferencias Notificaciones', 'Centro de control de notificaciones', 'off'),
  ('maestro_interior', 'Maestro Interior', 'IA local entrenada con iluminaciones del alumno', 'off'),
  ('sellos_ascension', 'Sellos de Ascensión', 'Ceremonias y sellos en transiciones importantes', 'off')
ON CONFLICT (codigo) DO NOTHING;

-- Datos de ejemplo para algunos módulos

-- Círculos Auri de ejemplo
INSERT INTO circulos_auri (codigo, nombre, descripcion, aspecto_principal, fecha_inicio, activo) VALUES
  ('circulo_sanacion_global', 'Círculo de Sanación Global', 'Prácticas colectivas de sanación para el planeta', 'sanacion', NOW(), true),
  ('circulo_luz_interior', 'Círculo de Luz Interior', 'Expandir la luz interior juntos', 'canalizacion', NOW(), true)
ON CONFLICT (codigo) DO NOTHING;

-- Cartas de tarot energético de ejemplo
INSERT INTO tarot_cartas (codigo, nombre, descripcion, significado_luz, significado_sombra, aspecto_asociado) VALUES
  ('ALMA_AGUA', 'Alma de Agua', 'La fluidez emocional', 'Fluir con las emociones, aceptación', 'Estancamiento emocional', 'sanacion'),
  ('FUEGO_INTERNO', 'Fuego Interno', 'La llama de la transformación', 'Poder creador, transformación activa', 'Ira descontrolada, impaciencia', 'canalizacion'),
  ('TIERRA_RAIZ', 'Tierra Raíz', 'Conexión con lo fundamental', 'Arraigo, estabilidad, presencia', 'Rigidez, exceso de control', 'sanacion'),
  ('AIRE_CLARIDAD', 'Aire de Claridad', 'La mente serena', 'Claridad mental, discernimiento', 'Confusión, dispersión', 'meditacion'),
ON CONFLICT (codigo) DO NOTHING;

-- Sellos de ascensión de ejemplo
INSERT INTO sellos_ascension (codigo, nombre, descripcion, nivel_desde, nivel_hasta, requisitos, imagen_url) VALUES
  ('sello_despertar', 'Sello del Despertar', 'Primer gran paso en el camino', 1, 2, '{"min_practicas": 10, "min_racha": 3}'::jsonb, '/assets/sellos/despertar.svg'),
  ('sello_expansion', 'Sello de la Expansión', 'Tu conciencia se expande', 3, 5, '{"min_practicas": 30, "min_racha": 7, "boss_completado": true}'::jsonb, '/assets/sellos/expansion.svg'),
  ('sello_maestria', 'Sello de la Maestría', 'Dominio de tu práctica', 7, 10, '{"min_practicas": 100, "min_racha": 21, "diversidad": 7}'::jsonb, '/assets/sellos/maestria.svg')
ON CONFLICT (codigo) DO NOTHING;

-- Prácticas horarias de ejemplo
INSERT INTO practicas_horario (codigo_practica, nombre, descripcion, hora_inicio, hora_fin, dias_semana) VALUES
  ('aurora_consciente', 'Aurora Consciente', 'Práctica especial del amanecer', '05:00', '07:00', '{1,2,3,4,5,6,7}'),
  ('mediodia_poder', 'Mediodía de Poder', 'Conexión solar al mediodía', '12:00', '14:00', '{1,2,3,4,5,6,7}'),
  ('crepusculo_reflexion', 'Crepúsculo Reflexivo', 'Reflexión al atardecer', '18:00', '20:00', '{1,2,3,4,5,6,7}'),
  ('noche_silencio', 'Noche del Silencio', 'Práctica nocturna profunda', '22:00', '23:59', '{1,2,3,4,5,6,7}')
ON CONFLICT DO NOTHING;

SELECT 'Schema V6.1 ejecutado correctamente - 12 nuevos módulos instalados' AS resultado;



