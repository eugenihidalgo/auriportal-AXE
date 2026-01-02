-- ============================================================================
-- Migración v5.43.0: Student SOT v1 - Estado Ontológico y Operativo
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Crea las tablas canónicas para el estado ontológico (students)
--              y operativo (student_operational_state) del Alumno SOT,
--              incluyendo perfiles de pausa configurables.
--
-- PRINCIPIOS:
-- 1. PostgreSQL es el ÚNICO Source of Truth del Alumno
-- 2. Separación clara: ontología (quién es) vs operativo (cómo opera)
-- 3. PAUSA es un estado operativo configurable, no hardcoded
-- 4. Todo comportamiento debe ser configurable vía pause_profiles
-- 5. Soft delete con deleted_at
-- ============================================================================

-- Asegurar extensión pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLA 1: students (Identidad Ontológica Soberana)
-- ============================================================================
-- Representa la coherencia del sistema para este alumno, NO el estado de negocio.
-- El status ontológico (NORMAL|DEGRADED|BROKEN) describe la salud del registro
-- del alumno en el sistema, no su estado operativo.

CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status VARCHAR(20) NOT NULL DEFAULT 'NORMAL' CHECK (status IN ('NORMAL', 'DEGRADED', 'BROKEN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  -- Relación con tabla legacy alumnos (temporal, para migración)
  legacy_alumno_id INTEGER UNIQUE REFERENCES alumnos(id) ON DELETE SET NULL
);

COMMENT ON TABLE students IS 'Identidad ontológica soberana del alumno. Representa la coherencia del sistema, NO el estado de negocio.';
COMMENT ON COLUMN students.id IS 'UUID único del alumno (identidad soberana)';
COMMENT ON COLUMN students.status IS 'Estado ontológico: NORMAL (coherente), DEGRADED (datos incompletos), BROKEN (inconsistencias críticas)';
COMMENT ON COLUMN students.legacy_alumno_id IS 'Referencia temporal a tabla alumnos legacy (para migración)';

CREATE INDEX IF NOT EXISTS idx_students_status ON students(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_students_legacy_alumno_id ON students(legacy_alumno_id) WHERE legacy_alumno_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_students_deleted_at ON students(deleted_at) WHERE deleted_at IS NOT NULL;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_students_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_students_updated_at ON students;
CREATE TRIGGER trigger_update_students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW
  EXECUTE FUNCTION update_students_updated_at();

-- ============================================================================
-- TABLA 2: pause_profiles (Perfiles de Pausa Configurables)
-- ============================================================================
-- Define los efectos de pausa de forma configurable, no hardcoded.
-- Cada perfil especifica qué comportamientos se congelan/bloquean durante pausa.

CREATE TABLE IF NOT EXISTS pause_profiles (
  profile_key TEXT PRIMARY KEY,
  definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE pause_profiles IS 'Perfiles de pausa configurables. Define efectos de pausa sin hardcodear lógica.';
COMMENT ON COLUMN pause_profiles.profile_key IS 'Clave única del perfil (ej. subscription_pause_default)';
COMMENT ON COLUMN pause_profiles.definition IS 'JSONB con efectos del perfil: level_progression, streaks, contexts, automations, penalties, manual_actions, master_actions';
COMMENT ON COLUMN pause_profiles.status IS 'Estado del perfil: active (en uso) o deprecated (obsoleto)';

CREATE INDEX IF NOT EXISTS idx_pause_profiles_status ON pause_profiles(status) WHERE status = 'active';

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_pause_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_pause_profiles_updated_at ON pause_profiles;
CREATE TRIGGER trigger_update_pause_profiles_updated_at
  BEFORE UPDATE ON pause_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_pause_profiles_updated_at();

-- Insertar perfil por defecto
INSERT INTO pause_profiles (profile_key, definition, status)
VALUES (
  'subscription_pause_default',
  '{
    "level_progression": "freeze",
    "streaks": "freeze",
    "contexts": "block_new",
    "automations": "block_progression",
    "penalties": "disable",
    "manual_actions": "allow",
    "master_actions": "allow"
  }'::jsonb,
  'active'
)
ON CONFLICT (profile_key) DO NOTHING;

-- ============================================================================
-- TABLA 3: student_operational_state (Estado Operativo del Alumno)
-- ============================================================================
-- Representa cómo opera el alumno ahora: ACTIVE, PAUSED, SUSPENDED.
-- Este estado gobierna: progreso, rachas, automatizaciones, activación de contextos.
-- Es independiente del estado ontológico (students.status).

CREATE TABLE IF NOT EXISTS student_operational_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  state VARCHAR(20) NOT NULL CHECK (state IN ('ACTIVE', 'PAUSED', 'SUSPENDED')),
  pause_profile_key TEXT REFERENCES pause_profiles(profile_key),
  pause_reason TEXT,
  source VARCHAR(20) NOT NULL CHECK (source IN ('subscription', 'master', 'system')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE student_operational_state IS 'Estado operativo del alumno. Gobierna progreso, rachas, automatizaciones, contextos.';
COMMENT ON COLUMN student_operational_state.student_id IS 'UUID del alumno (FK a students)';
COMMENT ON COLUMN student_operational_state.state IS 'Estado operativo: ACTIVE (activo), PAUSED (pausado), SUSPENDED (suspendido)';
COMMENT ON COLUMN student_operational_state.pause_profile_key IS 'Perfil de pausa aplicado (solo si state=PAUSED)';
COMMENT ON COLUMN student_operational_state.pause_reason IS 'Razón de la pausa (opcional)';
COMMENT ON COLUMN student_operational_state.source IS 'Origen del estado: subscription (suscripción), master (Master), system (sistema)';
COMMENT ON COLUMN student_operational_state.started_at IS 'Inicio del estado operativo';
COMMENT ON COLUMN student_operational_state.ends_at IS 'Fin del estado operativo (NULL = activo)';

CREATE INDEX IF NOT EXISTS idx_student_operational_state_student_id ON student_operational_state(student_id);
CREATE INDEX IF NOT EXISTS idx_student_operational_state_state ON student_operational_state(state) WHERE ends_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_student_operational_state_active ON student_operational_state(student_id, state) WHERE state = 'ACTIVE' AND ends_at IS NULL;

-- Constraint único: solo un estado operativo activo por alumno (sin ends_at)
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_operational_state_unique_active 
  ON student_operational_state(student_id) WHERE ends_at IS NULL;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_student_operational_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_student_operational_state_updated_at ON student_operational_state;
CREATE TRIGGER trigger_update_student_operational_state_updated_at
  BEFORE UPDATE ON student_operational_state
  FOR EACH ROW
  EXECUTE FUNCTION update_student_operational_state_updated_at();

-- ============================================================================
-- ACTUALIZAR REFERENCIAS EXISTENTES
-- ============================================================================
-- Actualizar student_product_memberships para referenciar students en lugar de alumnos
-- (esto se hará gradualmente, por ahora mantenemos ambas referencias)

-- Nota: Por ahora mantenemos student_product_memberships.student_id como INTEGER
-- referenciando alumnos(id) para compatibilidad. En una migración futura se
-- añadirá student_uuid y se migrarán los datos.

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
-- SELECT to_regclass('public.students') AS students_exists;
-- SELECT to_regclass('public.pause_profiles') AS pause_profiles_exists;
-- SELECT to_regclass('public.student_operational_state') AS student_operational_state_exists;
-- SELECT profile_key, definition FROM pause_profiles WHERE status = 'active';

