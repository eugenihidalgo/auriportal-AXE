-- ============================================================================
-- Migración v5.53.0: UTE CORE v1 - Núcleo Canónico de Limpiezas/Deberes
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Sistema canónico UTE (Limpiezas/Deberes) con event sourcing
--              append-only y proyecciones recalculables.
--
-- PRINCIPIOS FUNDAMENTALES:
-- 1. PostgreSQL es el único Source of Truth
-- 2. Event sourcing append-only para ejecuciones (inmutables)
-- 3. Proyecciones recalculables para estados (eventual consistency)
-- 4. Asignaciones flexibles (alumnos, grupos, universos)
-- 5. Estados: never, pending, reviewed, critical, completed
--
-- MODOS SOPORTADOS:
-- - recurrent: threshold_days + critical_multiplier (default 2)
-- - one_time_count: required_count
-- ============================================================================

-- ============================================================================
-- TABLA: ute_definitions
-- ============================================================================
-- Definiciones de UTE (qué es una limpieza/deber)
-- Gobernado exclusivamente por dominio MASTER

CREATE TABLE IF NOT EXISTS ute_definitions (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID canónico para definiciones UTE
    
    ute_key TEXT NOT NULL UNIQUE,
    -- Clave única canónica (ej: "limpieza_energetica_diaria", "deber_semanal")
    -- Usado para referencias estables en código y señales
    
    -- ========================================================================
    -- METADATOS
    -- ========================================================================
    name TEXT NOT NULL,
    -- Nombre legible (ej: "Limpieza Energética Diaria")
    
    description TEXT,
    -- Descripción opcional
    
    -- ========================================================================
    -- CONFIGURACIÓN DE MODO
    -- ========================================================================
    mode TEXT NOT NULL CHECK (mode IN ('recurrent', 'one_time_count')),
    -- Modo de UTE:
    -- - 'recurrent': Recurrente con threshold_days
    -- - 'one_time_count': Contador de ejecuciones requeridas
    
    -- ========================================================================
    -- PARÁMETROS POR MODO
    -- ========================================================================
    threshold_days INTEGER,
    -- Para mode='recurrent': Días entre ejecuciones antes de pasar a "critical"
    -- NULL para mode='one_time_count'
    
    critical_multiplier NUMERIC(5,2) DEFAULT 2.0,
    -- Para mode='recurrent': Multiplicador para calcular días críticos
    -- Ej: threshold_days=7, critical_multiplier=2 → critical a los 14 días
    -- DEFAULT 2.0 si no se especifica
    
    required_count INTEGER,
    -- Para mode='one_time_count': Número de ejecuciones requeridas
    -- NULL para mode='recurrent'
    
    -- ========================================================================
    -- METADATOS ADICIONALES
    -- ========================================================================
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Metadatos extensibles (tags, categorías, etc.)
    
    -- ========================================================================
    -- ESTADO Y AUDITORÍA
    -- ========================================================================
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'draft')),
    -- Estado de la definición:
    -- - 'active': Activa y disponible
    -- - 'archived': Archivada (no se puede asignar nueva, pero se mantiene histórico)
    -- - 'draft': Borrador (no se puede asignar)
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    -- Soft delete para auditoría
    
    created_by TEXT,
    -- Quién creó la definición (master_id, system, etc.)
    
    -- ========================================================================
    -- CONSTRAINTS ADICIONALES
    -- ========================================================================
    CONSTRAINT check_recurrent_params CHECK (
        (mode = 'recurrent' AND threshold_days IS NOT NULL AND required_count IS NULL) OR
        (mode = 'one_time_count' AND required_count IS NOT NULL AND threshold_days IS NULL)
    )
);

-- ============================================================================
-- TABLA: ute_executions
-- ============================================================================
-- Ejecuciones append-only (event sourcing)
-- INMUTABLE: Solo INSERT, nunca UPDATE ni DELETE

CREATE TABLE IF NOT EXISTS ute_executions (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id BIGSERIAL PRIMARY KEY,
    -- ID secuencial único. El orden de inserción es el orden temporal canónico.
    
    ute_id UUID NOT NULL REFERENCES ute_definitions(id) ON DELETE RESTRICT,
    -- Referencia a la definición UTE
    
    -- ========================================================================
    -- TEMPORALIDAD
    -- ========================================================================
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Timestamp exacto de la ejecución (puede ser retroactivo)
    
    -- ========================================================================
    -- ACTOR (QUIÉN EJECUTÓ)
    -- ========================================================================
    executed_by TEXT NOT NULL CHECK (executed_by IN ('student', 'master', 'system')),
    -- Quién ejecutó la UTE:
    -- - 'student': El propio alumno
    -- - 'master': El maestro/admin
    -- - 'system': Sistema automático
    
    actor_id TEXT,
    -- ID del actor:
    -- - student_id (si executed_by = 'student')
    -- - master_id (si executed_by = 'master')
    -- - null (si executed_by = 'system')
    
    -- ========================================================================
    -- ALUMNO AFECTADO
    -- ========================================================================
    student_id INTEGER NOT NULL,
    -- ID del alumno que ejecutó la UTE
    -- NOTA: Referencia a tabla students (asumimos que existe)
    
    -- ========================================================================
    -- ORIGEN Y TRAZABILIDAD
    -- ========================================================================
    origin TEXT,
    -- Origen de la ejecución:
    -- - 'web_portal' (desde portal web)
    -- - 'master_panel' (desde panel master)
    -- - 'api' (desde API externa)
    -- - 'cron' (tarea programada)
    -- - 'migration' (migración de datos)
    
    notes TEXT,
    -- Notas opcionales sobre la ejecución
    
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Metadatos adicionales (contexto, detalles, etc.)
    
    trace_id TEXT
    -- Correlation ID para trazabilidad (logs, audit, etc.)
    
    -- ========================================================================
    -- NOTA SOBRE APPEND-ONLY
    -- ========================================================================
    -- Esta tabla NO debe tener triggers de UPDATE ni DELETE.
    -- Si necesitas "corregir" una ejecución, inserta un nuevo evento
    -- de tipo 'correccion' o 'anulacion' que referencie al evento original.
    -- La historia es sagrada e inmutable.
);

-- ============================================================================
-- TABLA: ute_student_state
-- ============================================================================
-- Proyección del estado por alumno (read model)
-- Se actualiza incrementalmente desde ute_executions
-- Recalculable desde cero si es necesario

CREATE TABLE IF NOT EXISTS ute_student_state (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id BIGSERIAL PRIMARY KEY,
    
    ute_id UUID NOT NULL REFERENCES ute_definitions(id) ON DELETE CASCADE,
    -- Referencia a la definición UTE
    
    student_id INTEGER NOT NULL,
    -- ID del alumno
    
    -- ========================================================================
    -- ESTADO CALCULADO
    -- ========================================================================
    state TEXT NOT NULL CHECK (state IN ('never', 'pending', 'reviewed', 'critical', 'completed')),
    -- Estado del alumno para esta UTE:
    -- - 'never': Nunca ha ejecutado (alumno nuevo)
    -- - 'pending': Pendiente (dentro del threshold)
    -- - 'reviewed': Revisado (pasó threshold pero no crítico)
    -- - 'critical': Crítico (pasó threshold * critical_multiplier)
    -- - 'completed': Completado (solo para one_time_count cuando alcanza required_count)
    
    -- ========================================================================
    -- MÉTRICAS TEMPORALES
    -- ========================================================================
    last_executed_at TIMESTAMPTZ,
    -- Timestamp de la última ejecución
    -- NULL si nunca ha ejecutado (state='never')
    
    count_executed INTEGER NOT NULL DEFAULT 0,
    -- Contador de ejecuciones totales
    
    days_since_last_execution INTEGER,
    -- Días desde la última ejecución
    -- NULL si nunca ha ejecutado
    
    -- ========================================================================
    -- MÉTRICAS PARA RECURRENT
    -- ========================================================================
    days_until_critical INTEGER,
    -- Días hasta que pase a estado 'critical'
    -- NULL si no aplica (one_time_count o ya es critical)
    
    -- ========================================================================
    -- MÉTRICAS PARA ONE_TIME_COUNT
    -- ========================================================================
    remaining_count INTEGER,
    -- Ejecuciones restantes para completar (required_count - count_executed)
    -- NULL si no aplica (recurrent)
    
    -- ========================================================================
    -- METADATOS DE PROYECCIÓN
    -- ========================================================================
    last_execution_id BIGINT,
    -- ID de la última ejecución procesada
    -- Útil para backfill incremental
    
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Timestamp del último cálculo de estado
    
    -- ========================================================================
    -- METADATOS ADICIONALES
    -- ========================================================================
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Metadatos adicionales (snapshots, contexto, etc.)
    
    -- ========================================================================
    -- CONSTRAINTS
    -- ========================================================================
    CONSTRAINT uq_ute_student_state_unique UNIQUE (ute_id, student_id)
);

-- ============================================================================
-- TABLA: ute_assignments
-- ============================================================================
-- Asignaciones de UTE a targets (alumnos, grupos, universos)
-- Permite asignar una UTE a múltiples targets

CREATE TABLE IF NOT EXISTS ute_assignments (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id BIGSERIAL PRIMARY KEY,
    
    ute_id UUID NOT NULL REFERENCES ute_definitions(id) ON DELETE CASCADE,
    -- Referencia a la definición UTE
    
    -- ========================================================================
    -- TARGET (A QUIÉN SE ASIGNA)
    -- ========================================================================
    target_type TEXT NOT NULL CHECK (target_type IN ('student', 'group', 'universe', 'all')),
    -- Tipo de target:
    -- - 'student': Alumno específico
    -- - 'group': Grupo de alumnos
    -- - 'universe': Universo completo
    -- - 'all': Todos los alumnos (sin restricción)
    
    target_ref TEXT,
    -- ID del target:
    -- - student_id (si target_type = 'student')
    -- - group_id (si target_type = 'group')
    -- - universe_id (si target_type = 'universe')
    -- - null (si target_type = 'all')
    
    -- ========================================================================
    -- METADATOS
    -- ========================================================================
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Metadatos adicionales (fechas de inicio/fin, condiciones, etc.)
    
    -- ========================================================================
    -- ESTADO Y AUDITORÍA
    -- ========================================================================
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    -- Estado de la asignación:
    -- - 'active': Activa y vigente
    -- - 'archived': Archivada (no se aplica, pero se mantiene histórico)
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    -- Soft delete para auditoría
    
    assigned_by TEXT,
    -- Quién asignó la UTE (master_id, system, etc.)
    
    -- ========================================================================
    -- CONSTRAINTS
    -- ========================================================================
    CONSTRAINT check_target_ref CHECK (
        (target_type = 'all' AND target_ref IS NULL) OR
        (target_type != 'all' AND target_ref IS NOT NULL)
    )
);

-- ============================================================================
-- ÍNDICES PARA CONSULTAS RÁPIDAS
-- ============================================================================

-- ute_definitions: Búsqueda por ute_key
CREATE INDEX IF NOT EXISTS idx_ute_definitions_key 
    ON ute_definitions(ute_key) 
    WHERE deleted_at IS NULL;

-- ute_definitions: Búsqueda por status
CREATE INDEX IF NOT EXISTS idx_ute_definitions_status 
    ON ute_definitions(status) 
    WHERE deleted_at IS NULL;

-- ute_executions: Búsqueda por ute_id y student_id (consulta más común)
CREATE INDEX IF NOT EXISTS idx_ute_executions_ute_student 
    ON ute_executions(ute_id, student_id, executed_at DESC);

-- ute_executions: Búsqueda por student_id
CREATE INDEX IF NOT EXISTS idx_ute_executions_student 
    ON ute_executions(student_id, executed_at DESC);

-- ute_executions: Búsqueda por executed_at (temporal)
CREATE INDEX IF NOT EXISTS idx_ute_executions_executed_at 
    ON ute_executions(executed_at DESC);

-- ute_student_state: Búsqueda por ute_id y state
CREATE INDEX IF NOT EXISTS idx_ute_student_state_ute_state 
    ON ute_student_state(ute_id, state);

-- ute_student_state: Búsqueda por student_id y state
CREATE INDEX IF NOT EXISTS idx_ute_student_state_student_state 
    ON ute_student_state(student_id, state);

-- ute_student_state: Búsqueda por state (para listar todos los critical, etc.)
CREATE INDEX IF NOT EXISTS idx_ute_student_state_state 
    ON ute_student_state(state);

-- ute_assignments: Búsqueda por ute_id
CREATE INDEX IF NOT EXISTS idx_ute_assignments_ute 
    ON ute_assignments(ute_id) 
    WHERE deleted_at IS NULL AND status = 'active';

-- ute_assignments: Búsqueda por target_type y target_ref
CREATE INDEX IF NOT EXISTS idx_ute_assignments_target 
    ON ute_assignments(target_type, target_ref) 
    WHERE deleted_at IS NULL AND status = 'active';

-- ============================================================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ============================================================================

COMMENT ON TABLE ute_definitions IS 
'Sistema canónico UTE v1: Definiciones de Limpiezas/Deberes.
Gobernado exclusivamente por dominio MASTER.
PostgreSQL es el único Source of Truth.';

COMMENT ON TABLE ute_executions IS 
'Sistema canónico UTE v1: Ejecuciones append-only (event sourcing).
INMUTABLE: Solo INSERT, nunca UPDATE ni DELETE.
Cada ejecución es un hecho histórico que nunca cambia.';

COMMENT ON TABLE ute_student_state IS 
'Sistema canónico UTE v1: Proyección del estado por alumno (read model).
Se actualiza incrementalmente desde ute_executions.
Recalculable desde cero si es necesario (dry-run + apply).';

COMMENT ON TABLE ute_assignments IS 
'Sistema canónico UTE v1: Asignaciones de UTE a targets.
Permite asignar una UTE a alumnos, grupos, universos o todos.';

COMMENT ON COLUMN ute_definitions.mode IS 
'Modo de UTE: recurrent (threshold_days) o one_time_count (required_count)';

COMMENT ON COLUMN ute_definitions.threshold_days IS 
'Para mode=recurrent: Días entre ejecuciones antes de pasar a "critical"';

COMMENT ON COLUMN ute_definitions.critical_multiplier IS 
'Para mode=recurrent: Multiplicador para calcular días críticos (default 2.0)';

COMMENT ON COLUMN ute_definitions.required_count IS 
'Para mode=one_time_count: Número de ejecuciones requeridas para completar';

COMMENT ON COLUMN ute_executions.executed_by IS 
'Quién ejecutó: student (alumno), master (maestro), system (sistema)';

COMMENT ON COLUMN ute_student_state.state IS 
'Estado: never (nunca ejecutó), pending (dentro threshold), reviewed (pasó threshold), critical (pasó threshold*multiplier), completed (one_time_count alcanzado)';

COMMENT ON COLUMN ute_assignments.target_type IS 
'Tipo de target: student (alumno), group (grupo), universe (universo), all (todos)';

-- ============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================================

DO $$
DECLARE
    invalid_mode_count INTEGER;
    invalid_status_count INTEGER;
    invalid_state_count INTEGER;
    invalid_executed_by_count INTEGER;
BEGIN
    -- Verificar que no hay mode inválidos en definitions
    SELECT COUNT(*) INTO invalid_mode_count
    FROM ute_definitions
    WHERE mode NOT IN ('recurrent', 'one_time_count');
    
    IF invalid_mode_count > 0 THEN
        RAISE EXCEPTION 'Migración fallida: % definiciones tienen mode inválido', invalid_mode_count;
    END IF;
    
    -- Verificar que no hay status inválidos en definitions
    SELECT COUNT(*) INTO invalid_status_count
    FROM ute_definitions
    WHERE status NOT IN ('active', 'archived', 'draft');
    
    IF invalid_status_count > 0 THEN
        RAISE EXCEPTION 'Migración fallida: % definiciones tienen status inválido', invalid_status_count;
    END IF;
    
    -- Verificar que no hay state inválidos en student_state
    SELECT COUNT(*) INTO invalid_state_count
    FROM ute_student_state
    WHERE state NOT IN ('never', 'pending', 'reviewed', 'critical', 'completed');
    
    IF invalid_state_count > 0 THEN
        RAISE EXCEPTION 'Migración fallida: % estados tienen state inválido', invalid_state_count;
    END IF;
    
    -- Verificar que no hay executed_by inválidos en executions
    SELECT COUNT(*) INTO invalid_executed_by_count
    FROM ute_executions
    WHERE executed_by NOT IN ('student', 'master', 'system');
    
    IF invalid_executed_by_count > 0 THEN
        RAISE EXCEPTION 'Migración fallida: % ejecuciones tienen executed_by inválido', invalid_executed_by_count;
    END IF;
    
    RAISE NOTICE 'Migración v5.53.0 completada: UTE CORE v1 creado exitosamente';
END
$$;
