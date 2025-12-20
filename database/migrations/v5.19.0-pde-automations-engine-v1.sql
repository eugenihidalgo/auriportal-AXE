-- ============================================================================
-- Migración v5.19.0: Motor de Automatizaciones v1 (AuriPortal)
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Sistema canónico de automatizaciones que reacciona a Señales
--              y ejecuta Acciones con idempotencia, auditabilidad y fail-open.
--
-- PRINCIPIOS:
-- 1. Fail-open absoluto: todo tiene default, nada bloquea
-- 2. Soft delete normalizado: deleted_at
-- 3. Audit log append-only: pde_automation_audit_log
-- 4. Idempotencia real: dedupe con fingerprint único
-- 5. Si no hay tablas/migración aplicada → NO existe
-- ============================================================================

-- ============================================================================
-- TABLA: pde_automations
-- ============================================================================
-- Almacena definiciones de automatizaciones (reglas Señal → Acciones)

CREATE TABLE IF NOT EXISTS pde_automations (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID único generado automáticamente
    
    automation_key TEXT UNIQUE NOT NULL,
    -- Clave única de la automatización (slug, ej: "streak_on_practica_completada")
    -- Usado para referenciar la automatización en runtime
    -- Validación: solo [a-z0-9_-]
    
    -- ========================================================================
    -- METADATOS
    -- ========================================================================
    label TEXT NOT NULL,
    -- Nombre legible de la automatización (ej: "Incrementar Racha en Práctica Completada")
    
    description TEXT,
    -- Descripción opcional de la automatización
    
    -- ========================================================================
    -- CONFIGURACIÓN
    -- ========================================================================
    enabled BOOLEAN NOT NULL DEFAULT true,
    -- Si la automatización está habilitada (solo las habilitadas se ejecutan)
    
    trigger_signal_key TEXT NOT NULL,
    -- Clave de la señal que dispara esta automatización (FK lógica a pde_signals.signal_key)
    
    definition JSONB NOT NULL,
    -- Definición canónica de la automatización (JSONB)
    -- Estructura:
    -- {
    --   "trigger": { "signal_key": "..." },
    --   "conditions": [ { "source": "payload|context|runtime", "path": "...", "op": "...", "value": "..." } ],
    --   "actions": [ { "type": "...", "config": { ... } } ],
    --   "idempotency": { "strategy": "once|per_day|per_signal|custom", "fingerprint_template": "..." },
    --   "cooldown": { "seconds": 0 }
    -- }
    
    version INT NOT NULL DEFAULT 1,
    -- Versión de la definición (para migraciones futuras)
    
    -- ========================================================================
    -- ESTADO Y ORIGEN
    -- ========================================================================
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    -- Estado de la automatización: active (disponible) o archived (deshabilitado)
    
    origin TEXT NOT NULL DEFAULT 'user' CHECK (origin IN ('user', 'system')),
    -- Origen de la automatización: user (creada por usuario) o system (del sistema)
    
    order_index INT NOT NULL DEFAULT 0,
    -- Índice de ordenamiento (menor = primero en ejecución)
    
    -- ========================================================================
    -- METADATOS TEMPORALES
    -- ========================================================================
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    -- Soft delete: si tiene valor, la automatización está eliminada (pero se mantiene en BD)
    
    -- ========================================================================
    -- CONSTRAINTS
    -- ========================================================================
    CONSTRAINT pde_automations_automation_key_unique UNIQUE (automation_key)
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_pde_automations_trigger_signal_key ON pde_automations(trigger_signal_key) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pde_automations_enabled ON pde_automations(enabled) WHERE deleted_at IS NULL AND enabled = true;
CREATE INDEX IF NOT EXISTS idx_pde_automations_status ON pde_automations(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pde_automations_order_index ON pde_automations(order_index) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pde_automations_deleted_at ON pde_automations(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pde_automations_definition_gin ON pde_automations USING GIN (definition);

-- ============================================================================
-- TABLA: pde_automation_audit_log
-- ============================================================================
-- Log de auditoría append-only para cambios en automatizaciones

CREATE TABLE IF NOT EXISTS pde_automation_audit_log (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID único generado automáticamente
    
    automation_key TEXT NOT NULL,
    -- Clave de la automatización modificada (no FK para permitir soft delete)
    
    -- ========================================================================
    -- ACCIÓN
    -- ========================================================================
    action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'archive', 'enable', 'disable', 'restore')),
    -- Acción realizada
    
    -- ========================================================================
    -- ACTOR
    -- ========================================================================
    actor_admin_id UUID,
    -- ID del administrador que realizó la acción (si está disponible)
    
    -- ========================================================================
    -- CAMBIOS
    -- ========================================================================
    before JSONB,
    -- Estado anterior de la automatización (null si es create)
    
    after JSONB,
    -- Estado nuevo de la automatización (null si es delete)
    
    -- ========================================================================
    -- METADATOS TEMPORALES
    -- ========================================================================
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- Fecha/hora de la acción
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_pde_automation_audit_log_automation_key ON pde_automation_audit_log(automation_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pde_automation_audit_log_action ON pde_automation_audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pde_automation_audit_log_created_at ON pde_automation_audit_log(created_at DESC);

-- ============================================================================
-- TABLA: pde_automation_executions
-- ============================================================================
-- Registro de ejecuciones de automatizaciones (idempotencia + debugging)

CREATE TABLE IF NOT EXISTS pde_automation_executions (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID único generado automáticamente
    
    automation_key TEXT NOT NULL,
    -- Clave de la automatización ejecutada
    
    signal_key TEXT NOT NULL,
    -- Clave de la señal que disparó la ejecución
    
    -- ========================================================================
    -- CONTEXTO DE EJECUCIÓN
    -- ========================================================================
    student_id UUID,
    -- ID del estudiante (si aplica)
    
    subject_key TEXT,
    -- Clave del sujeto: "student:<uuid>" | "system" | ...
    
    day_key TEXT,
    -- Clave del día: YYYY-MM-DD (para idempotencia per_day)
    
    -- ========================================================================
    -- IDEMPOTENCIA
    -- ========================================================================
    fingerprint TEXT NOT NULL,
    -- Fingerprint determinista para dedupe (sha256 hex)
    -- Se calcula según la estrategia de idempotencia de la automatización
    
    -- ========================================================================
    -- DATOS DE EJECUCIÓN
    -- ========================================================================
    payload JSONB NOT NULL,
    -- Payload completo de la señal que disparó la ejecución
    
    resolved_context JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Contexto resuelto al momento de la ejecución
    
    -- ========================================================================
    -- RESULTADO
    -- ========================================================================
    status TEXT NOT NULL CHECK (status IN ('success', 'skipped', 'failed')),
    -- Estado de la ejecución:
    -- - success: ejecutada correctamente
    -- - skipped: dedupe hit (ya ejecutada antes)
    -- - failed: error en ejecución
    
    result JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Resultado de la ejecución (outputs de acciones, warnings, etc.)
    
    error_text TEXT,
    -- Mensaje de error si status = failed
    
    -- ========================================================================
    -- METADATOS TEMPORALES
    -- ========================================================================
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- Fecha/hora de la ejecución
);

-- Constraint de idempotencia (dedupe)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pde_automation_executions_fingerprint_unique ON pde_automation_executions(fingerprint);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_pde_automation_executions_automation_key ON pde_automation_executions(automation_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pde_automation_executions_signal_key ON pde_automation_executions(signal_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pde_automation_executions_student_day ON pde_automation_executions(student_id, day_key) WHERE student_id IS NOT NULL;

-- ============================================================================
-- COMENTARIOS
-- ============================================================================

COMMENT ON TABLE pde_automations IS 'Automatizaciones que reaccionan a Señales y ejecutan Acciones';
COMMENT ON COLUMN pde_automations.automation_key IS 'Clave única de la automatización (slug, solo [a-z0-9_-])';
COMMENT ON COLUMN pde_automations.definition IS 'Definición canónica JSONB con trigger, conditions, actions, idempotency';
COMMENT ON COLUMN pde_automation_audit_log.automation_key IS 'Clave de la automatización modificada (no FK para permitir soft delete)';
COMMENT ON TABLE pde_automation_executions IS 'Registro de ejecuciones de automatizaciones con idempotencia por fingerprint';
COMMENT ON COLUMN pde_automation_executions.fingerprint IS 'Fingerprint determinista sha256 para dedupe (único)';



