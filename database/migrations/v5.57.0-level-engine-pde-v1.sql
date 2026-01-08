-- ============================================================================
-- Migración v5.57.0: Level Engine PDE v1 (SOT + Señales + Contratos)
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Crea el sistema canónico del Level Engine PDE v1 como Source of Truth
--              de niveles y fases PDE. Define líneas de nivel, niveles, fases,
--              bloqueos (gates) y estado por alumno.
--
-- PRINCIPIOS:
-- 1. PostgreSQL es el único SOT de niveles PDE
-- 2. Level Engine es el único decisor de nivel/fase PDE
-- 3. Señales canónicas para cambios de nivel/fase
-- 4. Soporta alumnos sin PDE (línea ausente/inactiva)
-- 5. Congela conteo en pausas (PAUSED/SUSPENDED)
-- 6. Feature flag: level_engine_pde_v1 (OFF por defecto)
-- ============================================================================

-- Asegurar extensión pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLA 1: level_lines (Líneas de Nivel)
-- ============================================================================
-- Define las líneas de progreso (p.ej. PDE, Canalización, etc.)
-- La línea "pde" es la central por defecto.

CREATE TABLE IF NOT EXISTS level_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_key TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated')),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE level_lines IS 'Líneas de progreso (p.ej. PDE, Canalización). Define el tipo de progreso.';
COMMENT ON COLUMN level_lines.line_key IS 'Clave única de la línea (ej: pde, canalizacion)';
COMMENT ON COLUMN level_lines.display_name IS 'Nombre mostrado de la línea (ej: PDE)';
COMMENT ON COLUMN level_lines.status IS 'Estado: active (en uso) o deprecated (obsoleta)';
COMMENT ON COLUMN level_lines.meta IS 'Metadatos JSONB adicionales';

CREATE INDEX IF NOT EXISTS idx_level_lines_status ON level_lines(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_level_lines_line_key ON level_lines(line_key) WHERE status = 'active';

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_level_lines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_level_lines_updated_at ON level_lines;
CREATE TRIGGER trigger_update_level_lines_updated_at
  BEFORE UPDATE ON level_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_level_lines_updated_at();

-- ============================================================================
-- TABLA 2: level_definitions (Definiciones de Niveles por Línea)
-- ============================================================================
-- Define los niveles dentro de una línea (1, 2, 3, ...) con umbral de días mínimo.

CREATE TABLE IF NOT EXISTS level_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_key TEXT NOT NULL REFERENCES level_lines(line_key) ON DELETE RESTRICT,
  level_number INT NOT NULL,
  min_days INT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated')),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(line_key, level_number),
  UNIQUE(line_key, min_days),
  CHECK (level_number > 0),
  CHECK (min_days >= 0)
);

COMMENT ON TABLE level_definitions IS 'Definiciones de niveles por línea. Cada nivel tiene un umbral mínimo de días.';
COMMENT ON COLUMN level_definitions.line_key IS 'Clave de la línea (FK a level_lines)';
COMMENT ON COLUMN level_definitions.level_number IS 'Número del nivel (1, 2, 3, ...)';
COMMENT ON COLUMN level_definitions.min_days IS 'Días mínimos desde inicio para alcanzar este nivel';
COMMENT ON COLUMN level_definitions.title IS 'Título del nivel (opcional, para UI)';
COMMENT ON COLUMN level_definitions.status IS 'Estado: active (en uso) o deprecated (obsoleto)';

CREATE INDEX IF NOT EXISTS idx_level_definitions_line_key ON level_definitions(line_key) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_level_definitions_min_days ON level_definitions(line_key, min_days) WHERE status = 'active';

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_level_definitions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_level_definitions_updated_at ON level_definitions;
CREATE TRIGGER trigger_update_level_definitions_updated_at
  BEFORE UPDATE ON level_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_level_definitions_updated_at();

-- ============================================================================
-- TABLA 3: phase_definitions (Definiciones de Fases por Línea)
-- ============================================================================
-- Define las fases dentro de una línea (p.ej. Inicio, Sanación Avanzada, etc.)
-- como agrupaciones de niveles por umbral de días.

CREATE TABLE IF NOT EXISTS phase_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_key TEXT NOT NULL REFERENCES level_lines(line_key) ON DELETE RESTRICT,
  phase_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  min_days INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated')),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(line_key, phase_key),
  CHECK (min_days >= 0)
);

COMMENT ON TABLE phase_definitions IS 'Definiciones de fases por línea. Agrupan niveles por umbral de días.';
COMMENT ON COLUMN phase_definitions.line_key IS 'Clave de la línea (FK a level_lines)';
COMMENT ON COLUMN phase_definitions.phase_key IS 'Clave única de la fase (ej: inicio, sanacion_avanzada)';
COMMENT ON COLUMN phase_definitions.display_name IS 'Nombre mostrado de la fase';
COMMENT ON COLUMN phase_definitions.min_days IS 'Días mínimos desde inicio para entrar en esta fase';
COMMENT ON COLUMN phase_definitions.status IS 'Estado: active (en uso) o deprecated (obsoleta)';

CREATE INDEX IF NOT EXISTS idx_phase_definitions_line_key ON phase_definitions(line_key) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_phase_definitions_min_days ON phase_definitions(line_key, min_days) WHERE status = 'active';

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_phase_definitions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_phase_definitions_updated_at ON phase_definitions;
CREATE TRIGGER trigger_update_phase_definitions_updated_at
  BEFORE UPDATE ON phase_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_phase_definitions_updated_at();

-- ============================================================================
-- TABLA 4: level_gates (Bloqueos/Requisitos de Nivel) - Estructura v1
-- ============================================================================
-- Define bloqueos que impiden subir de nivel aunque se cumplan los días.
-- Estructura v1: solo definición, no validación real aún.

CREATE TABLE IF NOT EXISTS level_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_key TEXT NOT NULL REFERENCES level_lines(line_key) ON DELETE RESTRICT,
  target_level_number INT NOT NULL,
  gate_key TEXT NOT NULL,
  definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(line_key, target_level_number, gate_key),
  CHECK (target_level_number > 0)
);

COMMENT ON TABLE level_gates IS 'Bloqueos/requisitos de nivel. Estructura v1: solo definición, sin validación real aún.';
COMMENT ON COLUMN level_gates.line_key IS 'Clave de la línea (FK a level_lines)';
COMMENT ON COLUMN level_gates.target_level_number IS 'Nivel objetivo al que bloquea el gate';
COMMENT ON COLUMN level_gates.gate_key IS 'Clave única del gate (ej: questionnaire_1, practice_required)';
COMMENT ON COLUMN level_gates.definition IS 'Definición JSONB del gate (a implementar en v2)';
COMMENT ON COLUMN level_gates.status IS 'Estado: active (activo) o deprecated (obsoleto)';

CREATE INDEX IF NOT EXISTS idx_level_gates_line_level ON level_gates(line_key, target_level_number) WHERE status = 'active';

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_level_gates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_level_gates_updated_at ON level_gates;
CREATE TRIGGER trigger_update_level_gates_updated_at
  BEFORE UPDATE ON level_gates
  FOR EACH ROW
  EXECUTE FUNCTION update_level_gates_updated_at();

-- ============================================================================
-- TABLA 5: student_level_state (Estado Calculado por Alumno y Línea)
-- ============================================================================
-- Almacena el estado actual calculado y cacheado del nivel/fase PDE de un alumno.
-- Se actualiza mediante computeAndPersist() del Level Engine.

CREATE TABLE IF NOT EXISTS student_level_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  line_key TEXT NOT NULL REFERENCES level_lines(line_key) ON DELETE RESTRICT,
  started_at TIMESTAMPTZ NOT NULL,
  frozen_seconds BIGINT NOT NULL DEFAULT 0,
  computed_days INT NOT NULL DEFAULT 0,
  current_level_number INT,
  current_phase_key TEXT,
  upgrade_status TEXT NOT NULL DEFAULT 'ok' CHECK (upgrade_status IN ('ok', 'pending_requirements', 'locked')),
  pending_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, line_key)
);

COMMENT ON TABLE student_level_state IS 'Estado calculado y cacheado del nivel/fase PDE de un alumno.';
COMMENT ON COLUMN student_level_state.student_id IS 'ID del alumno (FK a students)';
COMMENT ON COLUMN student_level_state.line_key IS 'Clave de la línea (FK a level_lines)';
COMMENT ON COLUMN student_level_state.started_at IS 'Fecha de inicio del conteo para esta línea (alta en AuriPortal para PDE)';
COMMENT ON COLUMN student_level_state.frozen_seconds IS 'Segundos congelados por pausas (se resta del tiempo total)';
COMMENT ON COLUMN student_level_state.computed_days IS 'Días calculados: floor((now - started_at - frozen_duration) / 86400)';
COMMENT ON COLUMN student_level_state.current_level_number IS 'Número del nivel actual (según computed_days y level_definitions)';
COMMENT ON COLUMN student_level_state.current_phase_key IS 'Clave de la fase actual (según computed_days y phase_definitions)';
COMMENT ON COLUMN student_level_state.upgrade_status IS 'Estado de upgrade: ok (normal), pending_requirements (cumple días pero hay gates), locked (bloqueado)';
COMMENT ON COLUMN student_level_state.pending_requirements IS 'Array JSONB con keys de gates pendientes (solo estructura v1)';
COMMENT ON COLUMN student_level_state.last_computed_at IS 'Última vez que se calculó este estado';

CREATE INDEX IF NOT EXISTS idx_student_level_state_student_id ON student_level_state(student_id);
CREATE INDEX IF NOT EXISTS idx_student_level_state_line_key ON student_level_state(line_key);
CREATE INDEX IF NOT EXISTS idx_student_level_state_last_computed ON student_level_state(last_computed_at);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_student_level_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_student_level_state_updated_at ON student_level_state;
CREATE TRIGGER trigger_update_student_level_state_updated_at
  BEFORE UPDATE ON student_level_state
  FOR EACH ROW
  EXECUTE FUNCTION update_student_level_state_updated_at();

-- ============================================================================
-- TABLA 6: student_level_history (Timeline Append-Only)
-- ============================================================================
-- Historial completo de eventos relacionados con niveles PDE de un alumno.
-- Append-only: solo INSERT, nunca UPDATE o DELETE.

CREATE TABLE IF NOT EXISTS student_level_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  line_key TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('line_started', 'level_changed', 'phase_changed', 'frozen', 'unfrozen', 'upgrade_pending', 'upgrade_locked', 'recomputed')),
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  before JSONB,
  after JSONB,
  actor_type TEXT CHECK (actor_type IN ('system', 'master')),
  actor_id TEXT,
  trace_id TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE student_level_history IS 'Historial completo append-only de eventos de niveles PDE.';
COMMENT ON COLUMN student_level_history.student_id IS 'ID del alumno (FK a students)';
COMMENT ON COLUMN student_level_history.line_key IS 'Clave de la línea';
COMMENT ON COLUMN student_level_history.event_type IS 'Tipo de evento: line_started, level_changed, phase_changed, frozen, unfrozen, upgrade_pending, upgrade_locked, recomputed';
COMMENT ON COLUMN student_level_history.before IS 'Estado anterior (JSONB)';
COMMENT ON COLUMN student_level_history.after IS 'Estado nuevo (JSONB)';
COMMENT ON COLUMN student_level_history.actor_type IS 'Tipo de actor: system (automático) o master (manual)';
COMMENT ON COLUMN student_level_history.actor_id IS 'ID del actor (p.ej. UUID del master si actor_type=master)';
COMMENT ON COLUMN student_level_history.trace_id IS 'ID de traza para correlación';

CREATE INDEX IF NOT EXISTS idx_student_level_history_student_line ON student_level_history(student_id, line_key, at DESC);
CREATE INDEX IF NOT EXISTS idx_student_level_history_trace_id ON student_level_history(trace_id);
CREATE INDEX IF NOT EXISTS idx_student_level_history_event_type ON student_level_history(event_type);

-- ============================================================================
-- SEED MÍNIMO OBLIGATORIO
-- ============================================================================
-- Insertar línea 'pde' activa y niveles/fases placeholder (marcados en meta como seed).

-- Insertar línea PDE
INSERT INTO level_lines (line_key, display_name, status, meta)
VALUES ('pde', 'PDE', 'active', '{"seed": true, "description": "Línea de progreso PDE (Programa de Desarrollo Espiritual)"}'::jsonb)
ON CONFLICT (line_key) DO NOTHING;

-- Insertar niveles placeholder básicos para PDE
-- NOTA: Estos valores son placeholder y deben revisarse/configurarse vía UI futura
INSERT INTO level_definitions (line_key, level_number, min_days, title, status, meta)
VALUES
  ('pde', 1, 0, 'Nivel 1 - Inicio', 'active', '{"seed": true, "needs_review": true}'::jsonb),
  ('pde', 2, 30, 'Nivel 2', 'active', '{"seed": true, "needs_review": true}'::jsonb),
  ('pde', 3, 60, 'Nivel 3', 'active', '{"seed": true, "needs_review": true}'::jsonb),
  ('pde', 4, 90, 'Nivel 4', 'active', '{"seed": true, "needs_review": true}'::jsonb),
  ('pde', 5, 120, 'Nivel 5', 'active', '{"seed": true, "needs_review": true}'::jsonb)
ON CONFLICT (line_key, level_number) DO NOTHING;

-- Insertar fases placeholder para PDE
-- NOTA: Estos valores son placeholder y deben revisarse/configurarse vía UI futura
INSERT INTO phase_definitions (line_key, phase_key, display_name, min_days, status, meta)
VALUES
  ('pde', 'inicio', 'Fase Inicio', 0, 'active', '{"seed": true, "needs_review": true}'::jsonb),
  ('pde', 'sanacion_avanzada', 'Fase Sanación Avanzada', 90, 'active', '{"seed": true, "needs_review": true}'::jsonb),
  ('pde', 'canalizacion', 'Fase Canalización', 180, 'active', '{"seed": true, "needs_review": true}'::jsonb)
ON CONFLICT (line_key, phase_key) DO NOTHING;

-- ============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================================
-- Verificar que la línea 'pde' existe y tiene niveles/fases
DO $$
DECLARE
  line_exists BOOLEAN;
  level_count INT;
  phase_count INT;
BEGIN
  SELECT EXISTS(SELECT 1 FROM level_lines WHERE line_key = 'pde' AND status = 'active') INTO line_exists;
  IF NOT line_exists THEN
    RAISE EXCEPTION 'MIGRATION FAILED: Línea pde no existe o no está activa';
  END IF;
  
  SELECT COUNT(*) INTO level_count FROM level_definitions WHERE line_key = 'pde' AND status = 'active';
  IF level_count = 0 THEN
    RAISE EXCEPTION 'MIGRATION FAILED: No hay niveles activos para línea pde';
  END IF;
  
  SELECT COUNT(*) INTO phase_count FROM phase_definitions WHERE line_key = 'pde' AND status = 'active';
  IF phase_count = 0 THEN
    RAISE EXCEPTION 'MIGRATION FAILED: No hay fases activas para línea pde';
  END IF;
  
  RAISE NOTICE 'MIGRATION SUCCESS: Línea pde creada con % niveles y % fases', level_count, phase_count;
END $$;
