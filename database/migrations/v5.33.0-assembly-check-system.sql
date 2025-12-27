-- ============================================================================
-- Migración v5.33.0: Assembly Check System (ACS) v1.0
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Sistema canónico para verificar ensamblaje real de Admin UIs
--              Detecta errores ANTES de que lleguen al usuario
--              Persiste resultados en PostgreSQL
--              Integra con protocolo done-means-visible
--
-- PRINCIPIOS:
-- 1. PostgreSQL es único Source of Truth
-- 2. Sin migración aplicada = no existe
-- 3. Todo es auditable y trazable
-- 4. Estados: OK | WARN | BROKEN
-- 5. Códigos ACS_* explícitos
-- ============================================================================

-- ============================================================================
-- TABLA: assembly_checks
-- ============================================================================
-- Almacena definiciones de checks de ensamblaje para Admin UIs

CREATE TABLE IF NOT EXISTS assembly_checks (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID único generado automáticamente
    
    ui_key TEXT UNIQUE NOT NULL,
    -- Clave única de la UI Admin (ej: "feature-flags-ui", "automations-ui")
    -- Debe coincidir con key en admin-route-registry.js
    -- Validación: solo [a-z0-9_-]
    
    -- ========================================================================
    -- METADATOS
    -- ========================================================================
    route_path TEXT NOT NULL,
    -- Ruta canónica de la UI (ej: "/admin/feature-flags")
    -- Debe coincidir con path en admin-route-registry.js
    
    display_name TEXT NOT NULL,
    -- Nombre legible para mostrar en UI (ej: "Feature Flags")
    
    -- ========================================================================
    -- CONFIGURACIÓN
    -- ========================================================================
    feature_flag_key TEXT,
    -- Clave del feature flag que controla visibilidad (opcional)
    -- Si está presente, el check solo se ejecuta si el flag está activo
    
    expected_sidebar BOOLEAN NOT NULL DEFAULT true,
    -- Si se espera que la UI tenga sidebar (default: true)
    
    -- ========================================================================
    -- ESTADO Y ORIGEN
    -- ========================================================================
    enabled BOOLEAN NOT NULL DEFAULT true,
    -- Si el check está habilitado (puede deshabilitarse sin eliminar)
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    -- Soft delete: si tiene valor, el check está eliminado
    
    -- ========================================================================
    -- AUDITORÍA
    -- ========================================================================
    created_by TEXT,
    -- Actor que creó el check (ej: 'admin:uuid' o 'system')
    
    updated_by TEXT
    -- Actor que actualizó el check
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_assembly_checks_ui_key ON assembly_checks(ui_key) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_assembly_checks_route_path ON assembly_checks(route_path) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_assembly_checks_enabled ON assembly_checks(enabled) WHERE deleted_at IS NULL AND enabled = true;
CREATE INDEX IF NOT EXISTS idx_assembly_checks_deleted_at ON assembly_checks(deleted_at) WHERE deleted_at IS NULL;

-- Comentarios
COMMENT ON TABLE assembly_checks IS 'Definiciones de checks de ensamblaje para Admin UIs';
COMMENT ON COLUMN assembly_checks.ui_key IS 'Clave única de la UI (debe existir en admin-route-registry.js)';
COMMENT ON COLUMN assembly_checks.route_path IS 'Ruta canónica de la UI';
COMMENT ON COLUMN assembly_checks.feature_flag_key IS 'Feature flag que controla visibilidad (opcional)';
COMMENT ON COLUMN assembly_checks.expected_sidebar IS 'Si se espera que la UI tenga sidebar';

-- ============================================================================
-- TABLA: assembly_check_runs
-- ============================================================================
-- Registro de ejecuciones de checks de ensamblaje

CREATE TABLE IF NOT EXISTS assembly_check_runs (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID único generado automáticamente
    
    run_id TEXT UNIQUE NOT NULL,
    -- ID único de la ejecución (formato: "run-{timestamp}-{random}")
    -- Usado para agrupar resultados de una misma ejecución
    
    -- ========================================================================
    -- METADATOS
    -- ========================================================================
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Timestamp de inicio de la ejecución
    
    completed_at TIMESTAMPTZ,
    -- Timestamp de finalización de la ejecución
    
    total_checks INT NOT NULL DEFAULT 0,
    -- Total de checks ejecutados en esta run
    
    checks_ok INT NOT NULL DEFAULT 0,
    -- Checks con estado OK
    
    checks_warn INT NOT NULL DEFAULT 0,
    -- Checks con estado WARN
    
    checks_broken INT NOT NULL DEFAULT 0,
    -- Checks con estado BROKEN
    
    -- ========================================================================
    -- AUDITORÍA
    -- ========================================================================
    triggered_by TEXT,
    -- Actor que disparó la ejecución (ej: 'admin:uuid' o 'system')
    
    -- ========================================================================
    -- ESTADO
    -- ========================================================================
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    -- Estado de la ejecución:
    -- - running: en progreso
    -- - completed: completada exitosamente
    -- - failed: falló con error crítico
    
    error_message TEXT
    -- Mensaje de error si status = 'failed'
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_assembly_check_runs_run_id ON assembly_check_runs(run_id);
CREATE INDEX IF NOT EXISTS idx_assembly_check_runs_started_at ON assembly_check_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_assembly_check_runs_status ON assembly_check_runs(status);
CREATE INDEX IF NOT EXISTS idx_assembly_check_runs_completed_at ON assembly_check_runs(completed_at DESC) WHERE completed_at IS NOT NULL;

-- Comentarios
COMMENT ON TABLE assembly_check_runs IS 'Registro de ejecuciones de checks de ensamblaje';
COMMENT ON COLUMN assembly_check_runs.run_id IS 'ID único de la ejecución para agrupar resultados';
COMMENT ON COLUMN assembly_check_runs.status IS 'Estado de la ejecución (running, completed, failed)';

-- ============================================================================
-- TABLA: assembly_check_results
-- ============================================================================
-- Resultados individuales de cada check de ensamblaje

CREATE TABLE IF NOT EXISTS assembly_check_results (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID único generado automáticamente
    
    run_id TEXT NOT NULL,
    -- ID de la ejecución (FK a assembly_check_runs.run_id)
    
    check_id UUID NOT NULL,
    -- ID del check (FK a assembly_checks.id)
    
    -- ========================================================================
    -- RESULTADO
    -- ========================================================================
    status TEXT NOT NULL CHECK (status IN ('OK', 'WARN', 'BROKEN')),
    -- Estado del check:
    -- - OK: todo correcto
    -- - WARN: problemas menores (ej: placeholder sin resolver)
    -- - BROKEN: error crítico (ej: handler no existe, HTML vacío)
    
    code TEXT,
    -- Código de error específico (ej: "ACS_HANDLER_NOT_FOUND", "ACS_HTML_EMPTY", "ACS_PLACEHOLDER_UNRESOLVED")
    -- NULL si status = OK
    
    message TEXT,
    -- Mensaje descriptivo del resultado
    
    details JSONB,
    -- Detalles adicionales del resultado (JSONB)
    -- Estructura:
    -- {
    --   "route_resolved": true,
    --   "handler_imported": true,
    --   "html_empty": false,
    --   "placeholders": ["{{PLACEHOLDER}}"],
    --   "sidebar_present": true,
    --   "feature_flag_active": true
    -- }
    
    -- ========================================================================
    -- METADATOS
    -- ========================================================================
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Timestamp de cuando se ejecutó el check
    
    duration_ms INT,
    -- Duración del check en milisegundos
    
    -- ========================================================================
    -- FOREIGN KEYS
    -- ========================================================================
    CONSTRAINT fk_assembly_check_results_run_id 
        FOREIGN KEY (run_id) REFERENCES assembly_check_runs(run_id) ON DELETE CASCADE,
    
    CONSTRAINT fk_assembly_check_results_check_id 
        FOREIGN KEY (check_id) REFERENCES assembly_checks(id) ON DELETE CASCADE
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_assembly_check_results_run_id ON assembly_check_results(run_id);
CREATE INDEX IF NOT EXISTS idx_assembly_check_results_check_id ON assembly_check_results(check_id);
CREATE INDEX IF NOT EXISTS idx_assembly_check_results_status ON assembly_check_results(status);
CREATE INDEX IF NOT EXISTS idx_assembly_check_results_checked_at ON assembly_check_results(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_assembly_check_results_code ON assembly_check_results(code) WHERE code IS NOT NULL;

-- Comentarios
COMMENT ON TABLE assembly_check_results IS 'Resultados individuales de checks de ensamblaje';
COMMENT ON COLUMN assembly_check_results.status IS 'Estado del check (OK, WARN, BROKEN)';
COMMENT ON COLUMN assembly_check_results.code IS 'Código de error específico (ACS_*)';
COMMENT ON COLUMN assembly_check_results.details IS 'Detalles adicionales del resultado (JSONB)';

-- ============================================================================
-- DATOS INICIALES
-- ============================================================================
-- Insertar checks iniciales para las UIs Admin más importantes
-- Estos checks se crean automáticamente basándose en admin-route-registry.js

-- Nota: Los checks iniciales se crearán dinámicamente desde el código
-- basándose en las rutas registradas en admin-route-registry.js
-- No insertamos datos hardcodeados aquí para mantener flexibilidad



