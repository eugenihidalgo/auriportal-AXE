-- ============================================================================
-- Migración v5.35.0: Transmutaciones Energéticas - Estado de Alumnos
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Crea tablas para tracking del estado de alumnos en transmutaciones
--              Permite operaciones Master: marcar limpio, ver progreso, ajustar remaining
-- ============================================================================

-- ============================================================================
-- TABLA 1: student_te_recurrent_state
-- Estado de alumnos para items recurrentes (limpiezas periódicas)
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_te_recurrent_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_email TEXT NOT NULL,
  item_id INTEGER NOT NULL REFERENCES items_transmutaciones(id) ON DELETE CASCADE,
  last_cleaned_at TIMESTAMPTZ,
  days_since_last_clean INTEGER DEFAULT 0,
  is_clean BOOLEAN DEFAULT FALSE,
  is_critical BOOLEAN DEFAULT FALSE,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Constraint: un estudiante solo puede tener un estado por item
  UNIQUE(student_email, item_id)
);

CREATE INDEX IF NOT EXISTS idx_student_te_recurrent_student ON student_te_recurrent_state(student_email);
CREATE INDEX IF NOT EXISTS idx_student_te_recurrent_item ON student_te_recurrent_state(item_id);
CREATE INDEX IF NOT EXISTS idx_student_te_recurrent_status ON student_te_recurrent_state(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_student_te_recurrent_critical ON student_te_recurrent_state(is_critical) WHERE is_critical = TRUE;
CREATE INDEX IF NOT EXISTS idx_student_te_recurrent_clean ON student_te_recurrent_state(is_clean) WHERE is_clean = FALSE;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_student_te_recurrent_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_student_te_recurrent_state_updated_at ON student_te_recurrent_state;
CREATE TRIGGER trigger_update_student_te_recurrent_state_updated_at
  BEFORE UPDATE ON student_te_recurrent_state
  FOR EACH ROW
  EXECUTE FUNCTION update_student_te_recurrent_state_updated_at();

COMMENT ON TABLE student_te_recurrent_state IS 'Estado de alumnos para items recurrentes (limpiezas periódicas)';
COMMENT ON COLUMN student_te_recurrent_state.student_email IS 'Email del alumno (FK implícito a students.email)';
COMMENT ON COLUMN student_te_recurrent_state.item_id IS 'ID del item de transmutación (FK a items_transmutaciones)';
COMMENT ON COLUMN student_te_recurrent_state.last_cleaned_at IS 'Última vez que se marcó como limpio';
COMMENT ON COLUMN student_te_recurrent_state.days_since_last_clean IS 'Días transcurridos desde última limpieza';
COMMENT ON COLUMN student_te_recurrent_state.is_clean IS 'Si está limpio actualmente';
COMMENT ON COLUMN student_te_recurrent_state.is_critical IS 'Si requiere atención urgente (days_since_last_clean >= frecuencia_dias)';

-- ============================================================================
-- TABLA 2: student_te_one_time_state
-- Estado de alumnos para items una_vez (limpiezas puntuales)
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_te_one_time_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_email TEXT NOT NULL,
  item_id INTEGER NOT NULL REFERENCES items_transmutaciones(id) ON DELETE CASCADE,
  remaining INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  is_complete BOOLEAN DEFAULT FALSE,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Constraint: un estudiante solo puede tener un estado por item
  UNIQUE(student_email, item_id)
);

CREATE INDEX IF NOT EXISTS idx_student_te_one_time_student ON student_te_one_time_state(student_email);
CREATE INDEX IF NOT EXISTS idx_student_te_one_time_item ON student_te_one_time_state(item_id);
CREATE INDEX IF NOT EXISTS idx_student_te_one_time_status ON student_te_one_time_state(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_student_te_one_time_complete ON student_te_one_time_state(is_complete) WHERE is_complete = FALSE;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_student_te_one_time_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_student_te_one_time_state_updated_at ON student_te_one_time_state;
CREATE TRIGGER trigger_update_student_te_one_time_state_updated_at
  BEFORE UPDATE ON student_te_one_time_state
  FOR EACH ROW
  EXECUTE FUNCTION update_student_te_one_time_state_updated_at();

COMMENT ON TABLE student_te_one_time_state IS 'Estado de alumnos para items una_vez (limpiezas puntuales)';
COMMENT ON COLUMN student_te_one_time_state.student_email IS 'Email del alumno (FK implícito a students.email)';
COMMENT ON COLUMN student_te_one_time_state.item_id IS 'ID del item de transmutación (FK a items_transmutaciones)';
COMMENT ON COLUMN student_te_one_time_state.remaining IS 'Número de limpiezas restantes';
COMMENT ON COLUMN student_te_one_time_state.completed IS 'Número de limpiezas completadas';
COMMENT ON COLUMN student_te_one_time_state.is_complete IS 'Si ha completado todas las limpiezas requeridas';

-- ============================================================================
-- NOTAS IMPORTANTES:
-- ============================================================================
-- 1. Las tablas usan student_email (TEXT) en lugar de FK explícita para flexibilidad
-- 2. El sistema debe inicializar el estado cuando un alumno inicia una lista
-- 3. Operaciones Master deben auditarse (usar audit_log si está disponible)
-- 4. DELETE físico está PROHIBIDO. Usar UPDATE SET status='archived' siempre.
-- ============================================================================


