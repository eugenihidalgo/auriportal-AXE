-- ============================================================================
-- Migración v5.42.0: Alumno SOT v1 - Source of Truth Canónico
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Crea tablas canónicas para el Alumno como Source of Truth
--              con estados por dominio energético y gobierno del Master
--
-- PRINCIPIOS:
-- 1. PostgreSQL es el ÚNICO Source of Truth del Alumno
-- 2. Estados explícitos (active/paused/archived)
-- 3. Auditoría completa (append-only)
-- 4. Gobierno mediante políticas (Master override)
-- 5. Separación Identidad vs Producto
-- ============================================================================

-- ============================================================================
-- TABLA 1: student_product_memberships
-- Suscripciones a productos (PDE ahora, futuro multi-producto)
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_product_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  product_key TEXT NOT NULL,  -- 'pde', 'producto_futuro', etc.
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, product_key)
);

CREATE INDEX IF NOT EXISTS idx_student_product_memberships_student_id 
  ON student_product_memberships(student_id);

CREATE INDEX IF NOT EXISTS idx_student_product_memberships_product_key 
  ON student_product_memberships(product_key);

CREATE INDEX IF NOT EXISTS idx_student_product_memberships_status 
  ON student_product_memberships(status) WHERE status = 'active';

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_student_product_memberships_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_student_product_memberships_updated_at 
  ON student_product_memberships;
CREATE TRIGGER trigger_update_student_product_memberships_updated_at
  BEFORE UPDATE ON student_product_memberships
  FOR EACH ROW
  EXECUTE FUNCTION update_student_product_memberships_updated_at();

COMMENT ON TABLE student_product_memberships IS 'Suscripciones a productos por alumno (PDE ahora, futuro multi-producto)';
COMMENT ON COLUMN student_product_memberships.student_id IS 'ID del alumno (FK a alumnos)';
COMMENT ON COLUMN student_product_memberships.product_key IS 'Clave del producto (pde, producto_futuro, etc.)';
COMMENT ON COLUMN student_product_memberships.status IS 'Estado: active, paused, archived';
COMMENT ON COLUMN student_product_memberships.joined_at IS 'Fecha de unión al producto';

-- ============================================================================
-- TABLA 2: student_domain_policies
-- Políticas de gobierno por dominio (límites y overrides del Master)
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_domain_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  domain_key TEXT NOT NULL,  -- 'transmutaciones_energeticas', 'proyectos', 'lugares', 'apadrinados'
  active_limit_default INTEGER NOT NULL DEFAULT 1,
  active_limit_override INTEGER,  -- NULL = usar default, -1 = ilimitado, >1 = límite personalizado
  can_activate_multiple BOOLEAN GENERATED ALWAYS AS (
    active_limit_override IS NOT NULL AND (active_limit_override > 1 OR active_limit_override = -1)
  ) STORED,
  set_by TEXT NOT NULL DEFAULT 'system' CHECK (set_by IN ('master', 'system')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, domain_key)
);

CREATE INDEX IF NOT EXISTS idx_student_domain_policies_student_id 
  ON student_domain_policies(student_id);

CREATE INDEX IF NOT EXISTS idx_student_domain_policies_domain_key 
  ON student_domain_policies(domain_key);

CREATE INDEX IF NOT EXISTS idx_student_domain_policies_student_domain 
  ON student_domain_policies(student_id, domain_key);

COMMENT ON TABLE student_domain_policies IS 'Políticas de gobierno por dominio (límites y overrides del Master)';
COMMENT ON COLUMN student_domain_policies.student_id IS 'ID del alumno (FK a alumnos)';
COMMENT ON COLUMN student_domain_policies.domain_key IS 'Clave del dominio energético';
COMMENT ON COLUMN student_domain_policies.active_limit_default IS 'Límite por defecto de ítems activos (default: 1)';
COMMENT ON COLUMN student_domain_policies.active_limit_override IS 'Override del Master (NULL=default, -1=ilimitado, >1=límite personalizado)';
COMMENT ON COLUMN student_domain_policies.can_activate_multiple IS 'Si puede activar múltiples ítems (derivado de override)';
COMMENT ON COLUMN student_domain_policies.set_by IS 'Quién estableció la política (master o system)';
COMMENT ON COLUMN student_domain_policies.reason IS 'Razón del override (opcional)';

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_student_domain_policies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_student_domain_policies_updated_at 
  ON student_domain_policies;
CREATE TRIGGER trigger_update_student_domain_policies_updated_at
  BEFORE UPDATE ON student_domain_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_student_domain_policies_updated_at();

-- ============================================================================
-- TABLA 3: student_item_state
-- Estado personal del alumno por ítem y dominio
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_item_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  domain_key TEXT NOT NULL,  -- 'transmutaciones_energeticas', 'proyectos', 'lugares', 'apadrinados'
  item_id INTEGER NOT NULL,  -- ID del ítem en el catálogo correspondiente
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  is_clean BOOLEAN NOT NULL DEFAULT FALSE,
  clean_count INTEGER NOT NULL DEFAULT 0,
  last_cleaned_at TIMESTAMPTZ,
  recommended_recurrence_days INTEGER,  -- Valor del catálogo
  student_recurrence_days INTEGER,      -- Editable por alumno
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, domain_key, item_id)
);

CREATE INDEX IF NOT EXISTS idx_student_item_state_student_id 
  ON student_item_state(student_id);

CREATE INDEX IF NOT EXISTS idx_student_item_state_domain_key 
  ON student_item_state(domain_key);

CREATE INDEX IF NOT EXISTS idx_student_item_state_item_id 
  ON student_item_state(item_id);

CREATE INDEX IF NOT EXISTS idx_student_item_state_student_domain 
  ON student_item_state(student_id, domain_key);

CREATE INDEX IF NOT EXISTS idx_student_item_state_active 
  ON student_item_state(student_id, domain_key, is_active) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_student_item_state_clean 
  ON student_item_state(student_id, domain_key, is_clean) WHERE is_clean = FALSE;

COMMENT ON TABLE student_item_state IS 'Estado personal del alumno por ítem y dominio';
COMMENT ON COLUMN student_item_state.student_id IS 'ID del alumno (FK a alumnos)';
COMMENT ON COLUMN student_item_state.domain_key IS 'Clave del dominio energético';
COMMENT ON COLUMN student_item_state.item_id IS 'ID del ítem en el catálogo correspondiente';
COMMENT ON COLUMN student_item_state.is_active IS 'Si el ítem está activo para el alumno';
COMMENT ON COLUMN student_item_state.is_clean IS 'Si el ítem está limpio (para limpiezas recurrentes)';
COMMENT ON COLUMN student_item_state.clean_count IS 'Contador de limpiezas realizadas';
COMMENT ON COLUMN student_item_state.last_cleaned_at IS 'Timestamp de última limpieza';
COMMENT ON COLUMN student_item_state.recommended_recurrence_days IS 'Recurrencia recomendada del catálogo';
COMMENT ON COLUMN student_item_state.student_recurrence_days IS 'Recurrencia personalizada por el alumno (editable)';
COMMENT ON COLUMN student_item_state.meta IS 'Metadatos adicionales (JSONB, muy limitado)';

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_student_item_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_student_item_state_updated_at 
  ON student_item_state;
CREATE TRIGGER trigger_update_student_item_state_updated_at
  BEFORE UPDATE ON student_item_state
  FOR EACH ROW
  EXECUTE FUNCTION update_student_item_state_updated_at();

-- ============================================================================
-- TABLA 4: student_item_state_audit
-- Auditoría append-only de cambios en estado de ítems
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_item_state_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  domain_key TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  action TEXT NOT NULL,  -- 'ACTIVATE', 'DEACTIVATE', 'CLEAN', 'SET_RECURRENCE', 'BULK_CLEAN', etc.
  actor_type TEXT NOT NULL CHECK (actor_type IN ('master', 'student', 'system')),
  actor_id TEXT,  -- ID del actor (opcional)
  before JSONB,   -- Estado antes (snapshot)
  after JSONB,    -- Estado después (snapshot)
  trace_id TEXT,  -- Para correlación
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_item_state_audit_student_id 
  ON student_item_state_audit(student_id);

CREATE INDEX IF NOT EXISTS idx_student_item_state_audit_domain_key 
  ON student_item_state_audit(domain_key);

CREATE INDEX IF NOT EXISTS idx_student_item_state_audit_item_id 
  ON student_item_state_audit(item_id);

CREATE INDEX IF NOT EXISTS idx_student_item_state_audit_action 
  ON student_item_state_audit(action);

CREATE INDEX IF NOT EXISTS idx_student_item_state_audit_actor_type 
  ON student_item_state_audit(actor_type);

CREATE INDEX IF NOT EXISTS idx_student_item_state_audit_trace_id 
  ON student_item_state_audit(trace_id);

CREATE INDEX IF NOT EXISTS idx_student_item_state_audit_created_at 
  ON student_item_state_audit(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_item_state_audit_student_domain 
  ON student_item_state_audit(student_id, domain_key);

COMMENT ON TABLE student_item_state_audit IS 'Auditoría append-only de cambios en estado de ítems';
COMMENT ON COLUMN student_item_state_audit.student_id IS 'ID del alumno (FK a alumnos)';
COMMENT ON COLUMN student_item_state_audit.domain_key IS 'Clave del dominio energético';
COMMENT ON COLUMN student_item_state_audit.item_id IS 'ID del ítem';
COMMENT ON COLUMN student_item_state_audit.action IS 'Acción realizada (ACTIVATE, DEACTIVATE, CLEAN, etc.)';
COMMENT ON COLUMN student_item_state_audit.actor_type IS 'Tipo de actor (master, student, system)';
COMMENT ON COLUMN student_item_state_audit.actor_id IS 'ID del actor (opcional)';
COMMENT ON COLUMN student_item_state_audit.before IS 'Estado antes (snapshot JSONB)';
COMMENT ON COLUMN student_item_state_audit.after IS 'Estado después (snapshot JSONB)';
COMMENT ON COLUMN student_item_state_audit.trace_id IS 'Trace ID para correlación';

-- ============================================================================
-- INICIALIZACIÓN: Crear políticas por defecto para alumnos existentes
-- ============================================================================

-- Crear políticas por defecto para todos los dominios v1
-- Solo si no existen ya (idempotente)

DO $$
DECLARE
  domain_keys TEXT[] := ARRAY['transmutaciones_energeticas', 'proyectos', 'lugares', 'apadrinados'];
  dk TEXT;
  student_record RECORD;
BEGIN
  FOR dk IN SELECT unnest(domain_keys) LOOP
    FOR student_record IN SELECT id FROM alumnos LOOP
      INSERT INTO student_domain_policies (
        student_id,
        domain_key,
        active_limit_default,
        active_limit_override,
        set_by,
        reason
      )
      SELECT 
        student_record.id,
        dk,
        1,  -- default: 1 activo por dominio
        NULL,  -- sin override
        'system',
        'Política por defecto creada en migración v5.42.0'
      WHERE NOT EXISTS (
        SELECT 1 FROM student_domain_policies 
        WHERE student_id = student_record.id 
          AND domain_key = dk
      );
    END LOOP;
  END LOOP;
END $$;

-- ============================================================================
-- VERIFICACIÓN: Queries sugeridos para verificar la migración
-- ============================================================================

-- Verificar tablas creadas
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
--   AND table_name IN (
--     'student_product_memberships',
--     'student_domain_policies',
--     'student_item_state',
--     'student_item_state_audit'
--   );

-- Verificar políticas creadas
-- SELECT domain_key, COUNT(*) as count 
-- FROM student_domain_policies 
-- GROUP BY domain_key;

-- Verificar índices
-- SELECT indexname FROM pg_indexes 
-- WHERE tablename IN (
--   'student_product_memberships',
--   'student_domain_policies',
--   'student_item_state',
--   'student_item_state_audit'
-- );

-- ============================================================================
-- OWNERSHIP: Asegurar que las tablas pertenecen al usuario correcto
-- ============================================================================

-- Ajustar ownership si es necesario (ajustar según configuración)
-- ALTER TABLE student_product_memberships OWNER TO aurelinportal;
-- ALTER TABLE student_domain_policies OWNER TO aurelinportal;
-- ALTER TABLE student_item_state OWNER TO aurelinportal;
-- ALTER TABLE student_item_state_audit OWNER TO aurelinportal;

-- ============================================================================
-- NOTAS IMPORTANTES:
-- ============================================================================
-- 1. Las tablas usan student_id INTEGER (FK a alumnos.id) para compatibilidad
-- 2. El sistema debe inicializar el estado cuando un alumno activa un ítem
-- 3. Operaciones Master deben auditarse SIEMPRE
-- 4. DELETE físico está PROHIBIDO. Usar UPDATE SET status='archived' siempre.
-- 5. Las políticas por defecto se crean automáticamente para alumnos existentes
-- ============================================================================

