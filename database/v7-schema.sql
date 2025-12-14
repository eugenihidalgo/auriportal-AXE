-- AuriPortal V7 - Schema SQL Completo
-- Expansión masiva del sistema V6.1

-- ============================================
-- 1. MODIFICACIONES A TABLA ALUMNOS
-- ============================================

DO $$ 
BEGIN
  -- Fecha de nacimiento
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alumnos' AND column_name='fecha_nacimiento') THEN
    ALTER TABLE alumnos ADD COLUMN fecha_nacimiento DATE;
  END IF;
  
  -- Lugar de nacimiento
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alumnos' AND column_name='lugar_nacimiento') THEN
    ALTER TABLE alumnos ADD COLUMN lugar_nacimiento TEXT;
  END IF;
  
  -- Hora de nacimiento
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alumnos' AND column_name='hora_nacimiento') THEN
    ALTER TABLE alumnos ADD COLUMN hora_nacimiento TEXT;
  END IF;
  
  -- Nombre completo
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alumnos' AND column_name='nombre_completo') THEN
    ALTER TABLE alumnos ADD COLUMN nombre_completo TEXT;
  END IF;
  
  -- Código AURI (AURI-DNA)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alumnos' AND column_name='codigo_auri') THEN
    ALTER TABLE alumnos ADD COLUMN codigo_auri TEXT;
    CREATE INDEX IF NOT EXISTS idx_alumnos_codigo_auri ON alumnos(codigo_auri);
  END IF;
  
  -- Ajustes personales
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alumnos' AND column_name='ajustes') THEN
    ALTER TABLE alumnos ADD COLUMN ajustes JSONB DEFAULT '{}';
  END IF;
END $$;

-- ============================================
-- 2. CARTA ASTRAL
-- ============================================

CREATE TABLE IF NOT EXISTS carta_astral (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER UNIQUE REFERENCES alumnos(id) ON DELETE CASCADE,
  imagen_url TEXT,
  notas TEXT,
  fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_carta_astral_alumno ON carta_astral(alumno_id);

-- ============================================
-- 3. DISEÑO HUMANO
-- ============================================

CREATE TABLE IF NOT EXISTS disenohumano (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER UNIQUE REFERENCES alumnos(id) ON DELETE CASCADE,
  imagen_url TEXT,
  tipo TEXT,
  notas JSONB DEFAULT '{}',
  fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_disenohumano_alumno ON disenohumano(alumno_id);

-- ============================================
-- 4. CUMPLEAÑOS
-- ============================================

CREATE TABLE IF NOT EXISTS cumpleaños_eventos (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
  fecha_exec DATE NOT NULL,
  mensaje_html TEXT,
  enviado BOOLEAN DEFAULT FALSE,
  fecha_enviado TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(alumno_id, fecha_exec)
);

CREATE INDEX IF NOT EXISTS idx_cumpleaños_alumno ON cumpleaños_eventos(alumno_id);
CREATE INDEX IF NOT EXISTS idx_cumpleaños_fecha ON cumpleaños_eventos(fecha_exec);
CREATE INDEX IF NOT EXISTS idx_cumpleaños_enviado ON cumpleaños_eventos(enviado);

-- ============================================
-- 5. SINERGIA ENTRE ALUMNOS
-- ============================================

CREATE TABLE IF NOT EXISTS alumnos_disponibilidad (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER UNIQUE REFERENCES alumnos(id) ON DELETE CASCADE,
  disponible BOOLEAN DEFAULT FALSE,
  mensaje TEXT,
  actualizado TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_disponibilidad_alumno ON alumnos_disponibilidad(alumno_id);

CREATE TABLE IF NOT EXISTS practicas_conjuntas (
  id SERIAL PRIMARY KEY,
  alumno1_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
  alumno2_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
  practica_id INTEGER REFERENCES practicas(id) ON DELETE SET NULL,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_practicas_conjuntas_alumno1 ON practicas_conjuntas(alumno1_id);
CREATE INDEX IF NOT EXISTS idx_practicas_conjuntas_alumno2 ON practicas_conjuntas(alumno2_id);
CREATE INDEX IF NOT EXISTS idx_practicas_conjuntas_fecha ON practicas_conjuntas(fecha);

-- ============================================
-- 6. SKILL TREE ESPIRITUAL
-- ============================================

CREATE TABLE IF NOT EXISTS skilltree_nodos (
  id SERIAL PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  nivel_minimo INTEGER DEFAULT 1,
  requisitos JSONB DEFAULT '{}',
  icono_url TEXT,
  categoria TEXT,
  orden INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_skilltree_codigo ON skilltree_nodos(codigo);
CREATE INDEX IF NOT EXISTS idx_skilltree_nivel ON skilltree_nodos(nivel_minimo);
CREATE INDEX IF NOT EXISTS idx_skilltree_activo ON skilltree_nodos(activo);

CREATE TABLE IF NOT EXISTS skilltree_progreso (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
  nodo_id INTEGER REFERENCES skilltree_nodos(id) ON DELETE CASCADE,
  completado BOOLEAN DEFAULT FALSE,
  completado_en TIMESTAMP,
  progreso NUMERIC DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(alumno_id, nodo_id)
);

CREATE INDEX IF NOT EXISTS idx_skilltree_progreso_alumno ON skilltree_progreso(alumno_id);
CREATE INDEX IF NOT EXISTS idx_skilltree_progreso_nodo ON skilltree_progreso(nodo_id);
CREATE INDEX IF NOT EXISTS idx_skilltree_progreso_completado ON skilltree_progreso(completado);

-- ============================================
-- 7. PAREJAS / AMISTADES
-- ============================================

CREATE TABLE IF NOT EXISTS amistades (
  id SERIAL PRIMARY KEY,
  alumno1 INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
  alumno2 INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
  estado TEXT DEFAULT 'pendiente',
  iniciado_por INTEGER REFERENCES alumnos(id),
  iniciado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  aceptado_en TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  CONSTRAINT check_estado_amistad CHECK (estado IN ('pendiente', 'aceptado', 'bloqueado', 'rechazado')),
  CONSTRAINT check_diferentes_alumnos CHECK (alumno1 != alumno2),
  UNIQUE(alumno1, alumno2)
);

CREATE INDEX IF NOT EXISTS idx_amistades_alumno1 ON amistades(alumno1);
CREATE INDEX IF NOT EXISTS idx_amistades_alumno2 ON amistades(alumno2);
CREATE INDEX IF NOT EXISTS idx_amistades_estado ON amistades(estado);

-- ============================================
-- 8. RITMOS DEL DÍA (AURICLOCK)
-- ============================================

CREATE TABLE IF NOT EXISTS auriclock_registro (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
  hora TIME NOT NULL,
  categoria TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT check_categoria_auriclock CHECK (categoria IN ('aurora', 'zenit', 'crepusculo', 'noche'))
);

CREATE INDEX IF NOT EXISTS idx_auriclock_alumno ON auriclock_registro(alumno_id);
CREATE INDEX IF NOT EXISTS idx_auriclock_categoria ON auriclock_registro(categoria);
CREATE INDEX IF NOT EXISTS idx_auriclock_fecha ON auriclock_registro(fecha DESC);

-- ============================================
-- 9. MENSAJES ESPECIALES
-- ============================================

CREATE TABLE IF NOT EXISTS mensajes_especiales (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  html TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  visto BOOLEAN DEFAULT FALSE,
  fecha_visto TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT check_tipo_mensaje CHECK (tipo IN ('cumpleaños', 'ascension', 'wrapped', 'especial', 'evento'))
);

CREATE INDEX IF NOT EXISTS idx_mensajes_alumno ON mensajes_especiales(alumno_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_tipo ON mensajes_especiales(tipo);
CREATE INDEX IF NOT EXISTS idx_mensajes_visto ON mensajes_especiales(visto);

-- ============================================
-- 10. IDEAS PENDIENTES (MEJORADO)
-- ============================================

-- Ya existe ideas_practicas, pero añadimos campos si faltan
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ideas_practicas' AND column_name='link_typeform') THEN
    ALTER TABLE ideas_practicas ADD COLUMN link_typeform TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ideas_practicas' AND column_name='tipo') THEN
    ALTER TABLE ideas_practicas ADD COLUMN tipo TEXT DEFAULT 'practica';
  END IF;
END $$;

-- ============================================
-- 11. TAROT MEJORADO
-- ============================================

CREATE TABLE IF NOT EXISTS tarot_interpretaciones (
  id SERIAL PRIMARY KEY,
  carta_id INTEGER REFERENCES tarot_cartas(id) ON DELETE CASCADE,
  interpretacion TEXT NOT NULL,
  contexto TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tarot_interpretaciones_carta ON tarot_interpretaciones(carta_id);

-- ============================================
-- 12. PERFIL EMOCIONAL ANUAL
-- ============================================

CREATE TABLE IF NOT EXISTS emocional_ano (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
  año INTEGER NOT NULL,
  media NUMERIC,
  picos_positivo INTEGER DEFAULT 0,
  picos_negativo INTEGER DEFAULT 0,
  json_detalle JSONB DEFAULT '{}',
  generado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(alumno_id, año)
);

CREATE INDEX IF NOT EXISTS idx_emocional_ano_alumno ON emocional_ano(alumno_id);
CREATE INDEX IF NOT EXISTS idx_emocional_ano_año ON emocional_ano(año);

-- ============================================
-- 13. EVENTOS GLOBALES
-- ============================================

CREATE TABLE IF NOT EXISTS eventos_globales (
  id SERIAL PRIMARY KEY,
  fecha TIMESTAMP NOT NULL,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensaje_html TEXT,
  metadata JSONB DEFAULT '{}',
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_eventos_fecha ON eventos_globales(fecha);
CREATE INDEX IF NOT EXISTS idx_eventos_tipo ON eventos_globales(tipo);
CREATE INDEX IF NOT EXISTS idx_eventos_activo ON eventos_globales(activo);

-- ============================================
-- 14. ALTAR AVANZADO
-- ============================================

-- Ya existe tabla altares, solo añadir items si no existe
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='altares_items') THEN
    CREATE TABLE altares_items (
      id SERIAL PRIMARY KEY,
      alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL,
      posicion_x NUMERIC DEFAULT 0,
      posicion_y NUMERIC DEFAULT 0,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_altares_items_alumno ON altares_items(alumno_id);
  END IF;
END $$;

-- ============================================
-- 15. REGISTRAR MÓDULOS V7 EN SISTEMA
-- ============================================

INSERT INTO modulos_sistema (codigo, nombre, descripcion, estado) VALUES
  ('mod_cumpleaños', 'Cumpleaños', 'Sistema de cumpleaños con mensajes especiales', 'off'),
  ('mod_carta_astral', 'Carta Astral', 'Gestión de cartas astrales de alumnos', 'off'),
  ('mod_disenohumano', 'Diseño Humano', 'Gestión de diseños humanos de alumnos', 'off'),
  ('mod_sinergia', 'Sinergias', 'Prácticas conjuntas entre alumnos', 'off'),
  ('mod_skilltree', 'Skill Tree Espiritual', 'Árbol de habilidades espirituales', 'off'),
  ('mod_amistades', 'Amistades', 'Sistema de conexiones y parejas', 'off'),
  ('mod_auriclock', 'AuriClock', 'Ritmos del día y momentos energéticos', 'off'),
  ('mod_mensajes_especiales', 'Mensajes Especiales', 'Mensajes personalizados para alumnos', 'off'),
  ('mod_ideas', 'Panel de Ideas', 'Gestión mejorada de ideas de prácticas', 'off'),
  ('mod_eventos_globales', 'Eventos Globales', 'Eventos y celebraciones globales', 'off'),
  ('mod_emocional_anual', 'Perfil Emocional Anual', 'Resumen emocional anual del alumno', 'off'),
  ('mod_ajustes_alumno', 'Ajustes Alumno', 'Configuración personal del alumno', 'off'),
  ('mod_economia_v2', 'Economía Tokens V2', 'Sistema avanzado de tokens', 'off')
ON CONFLICT (codigo) DO NOTHING;

-- ============================================
-- 16. DATOS DE EJEMPLO
-- ============================================

-- Skill Tree: Nodos de ejemplo
INSERT INTO skilltree_nodos (codigo, nombre, descripcion, nivel_minimo, categoria, orden) VALUES
  ('fundamentos_sanacion', 'Fundamentos de Sanación', 'Bases de la sanación personal', 1, 'sanacion', 1),
  ('sanacion_avanzada', 'Sanación Avanzada', 'Técnicas profundas de sanación', 5, 'sanacion', 2),
  ('canalizacion_basica', 'Canalización Básica', 'Primeros pasos en canalización', 7, 'canalizacion', 3),
  ('canalizacion_maestria', 'Maestría en Canalización', 'Dominio completo de canalización', 10, 'canalizacion', 4),
  ('meditacion_profunda', 'Meditación Profunda', 'Estados profundos de meditación', 3, 'meditacion', 5),
  ('movimiento_consciente', 'Movimiento Consciente', 'Integración cuerpo-mente', 4, 'movimiento', 6),
  ('creatividad_espiritual', 'Creatividad Espiritual', 'Expresión creativa desde el espíritu', 6, 'creatividad', 7)
ON CONFLICT (codigo) DO NOTHING;

SELECT 'Schema V7 ejecutado correctamente - 13 nuevos módulos instalados' AS resultado;



