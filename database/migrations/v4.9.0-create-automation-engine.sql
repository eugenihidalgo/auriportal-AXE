-- Migración v4.9.0: Motor de Automatizaciones (AUTO-1)
-- Fecha: 2025-01-XX
-- Descripción: Tablas base para el Motor de Automatizaciones MVP
--               Permite definir reglas declarativas, evaluar triggers y ejecutar acciones

-- Tabla: automation_rules
-- Almacena reglas de automatización declarativas
CREATE TABLE IF NOT EXISTS automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL, -- Identificador único de la regla (ej: 'welcome_on_pause_end')
    version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'off', -- 'on' | 'beta' | 'off'
    trigger_type TEXT NOT NULL, -- 'event' | 'state'
    trigger_def JSONB NOT NULL DEFAULT '{}'::jsonb, -- Definición del trigger (evento, condiciones, etc.)
    guards JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array de guards (condiciones adicionales)
    actions JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array de acciones a ejecutar
    priority INTEGER NOT NULL DEFAULT 0, -- Prioridad de ejecución (mayor = primero)
    cooldown_days INTEGER, -- Días de cooldown entre ejecuciones (nullable)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla: automation_runs
-- Almacena ejecuciones de reglas (una por alumno por regla)
CREATE TABLE IF NOT EXISTS automation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
    alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'planned', -- 'planned' | 'running' | 'done' | 'failed' | 'cancelled'
    context_snapshot JSONB, -- Snapshot del contexto del alumno al momento de la ejecución
    reason TEXT, -- Razón de la ejecución (trigger que disparó, etc.)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ -- Fecha de finalización (nullable hasta que termine)
);

-- Tabla: automation_jobs
-- Almacena jobs individuales de acciones (una acción = un job)
CREATE TABLE IF NOT EXISTS automation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES automation_runs(id) ON DELETE CASCADE,
    step_key TEXT NOT NULL, -- Identificador del paso/acción (ej: 'audit', 'portal_message')
    execute_at TIMESTAMPTZ NOT NULL, -- Cuándo debe ejecutarse
    status TEXT NOT NULL DEFAULT 'queued', -- 'queued' | 'running' | 'done' | 'failed'
    attempts INTEGER NOT NULL DEFAULT 0, -- Número de intentos de ejecución
    payload JSONB NOT NULL DEFAULT '{}'::jsonb, -- Datos específicos de la acción
    last_error TEXT, -- Último error si falló (nullable)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla: automation_locks
-- Previene ejecución simultánea de la misma regla para el mismo alumno
CREATE TABLE IF NOT EXISTS automation_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
    rule_key TEXT NOT NULL, -- key de la regla (no FK para flexibilidad)
    lock_key TEXT NOT NULL, -- Clave única del lock (alumno_id + rule_key + contexto)
    expires_at TIMESTAMPTZ NOT NULL, -- Cuándo expira el lock
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(lock_key)
);

-- Índices para automation_rules
CREATE INDEX IF NOT EXISTS idx_automation_rules_key ON automation_rules(key);
CREATE INDEX IF NOT EXISTS idx_automation_rules_status ON automation_rules(status);
CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger_type ON automation_rules(trigger_type);
CREATE INDEX IF NOT EXISTS idx_automation_rules_status_priority ON automation_rules(status, priority DESC);

-- Índices para automation_runs
CREATE INDEX IF NOT EXISTS idx_automation_runs_rule_id ON automation_runs(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_alumno_id ON automation_runs(alumno_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_status ON automation_runs(status);
CREATE INDEX IF NOT EXISTS idx_automation_runs_created_at ON automation_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_runs_rule_alumno ON automation_runs(rule_id, alumno_id);

-- Índices para automation_jobs
CREATE INDEX IF NOT EXISTS idx_automation_jobs_run_id ON automation_jobs(run_id);
CREATE INDEX IF NOT EXISTS idx_automation_jobs_status ON automation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_automation_jobs_execute_at ON automation_jobs(execute_at);
CREATE INDEX IF NOT EXISTS idx_automation_jobs_status_execute_at ON automation_jobs(status, execute_at) WHERE status = 'queued';

-- Índices para automation_locks
CREATE INDEX IF NOT EXISTS idx_automation_locks_alumno_id ON automation_locks(alumno_id);
CREATE INDEX IF NOT EXISTS idx_automation_locks_rule_key ON automation_locks(rule_key);
CREATE INDEX IF NOT EXISTS idx_automation_locks_expires_at ON automation_locks(expires_at);
CREATE INDEX IF NOT EXISTS idx_automation_locks_lock_key ON automation_locks(lock_key);

-- Comentarios para documentación
COMMENT ON TABLE automation_rules IS 'Reglas de automatización declarativas (AUTO-1)';
COMMENT ON COLUMN automation_rules.key IS 'Identificador único de la regla (ej: welcome_on_pause_end)';
COMMENT ON COLUMN automation_rules.status IS 'Estado: on (activo), beta (solo si feature flag), off (desactivado)';
COMMENT ON COLUMN automation_rules.trigger_type IS 'Tipo de trigger: event (evento en audit_events) o state (cambio de estado)';
COMMENT ON COLUMN automation_rules.trigger_def IS 'Definición del trigger (JSONB con evento, condiciones, umbrales, etc.)';
COMMENT ON COLUMN automation_rules.guards IS 'Array de guards (condiciones adicionales) en formato JSONB';
COMMENT ON COLUMN automation_rules.actions IS 'Array de acciones a ejecutar en formato JSONB';
COMMENT ON COLUMN automation_rules.cooldown_days IS 'Días de cooldown entre ejecuciones (null = sin cooldown)';

COMMENT ON TABLE automation_runs IS 'Ejecuciones de reglas de automatización (AUTO-1)';
COMMENT ON COLUMN automation_runs.status IS 'Estado: planned (planificado), running (en ejecución), done (completado), failed (falló), cancelled (cancelado)';
COMMENT ON COLUMN automation_runs.context_snapshot IS 'Snapshot del contexto del alumno al momento de la ejecución (JSONB)';
COMMENT ON COLUMN automation_runs.reason IS 'Razón de la ejecución (trigger que disparó, etc.)';

COMMENT ON TABLE automation_jobs IS 'Jobs individuales de acciones (AUTO-1)';
COMMENT ON COLUMN automation_jobs.step_key IS 'Identificador del paso/acción (ej: audit, portal_message, unlock)';
COMMENT ON COLUMN automation_jobs.execute_at IS 'Cuándo debe ejecutarse el job';
COMMENT ON COLUMN automation_jobs.status IS 'Estado: queued (en cola), running (en ejecución), done (completado), failed (falló)';
COMMENT ON COLUMN automation_jobs.payload IS 'Datos específicos de la acción (JSONB)';

COMMENT ON TABLE automation_locks IS 'Locks para prevenir ejecución simultánea (AUTO-1)';
COMMENT ON COLUMN automation_locks.lock_key IS 'Clave única del lock (alumno_id + rule_key + contexto)';
COMMENT ON COLUMN automation_locks.expires_at IS 'Cuándo expira el lock (auto-limpieza)';










