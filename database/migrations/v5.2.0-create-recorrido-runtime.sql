-- ============================================================================
-- Migración v5.2.0: Sistema de Runtime de Recorridos (RUNS + STATE + STEP RESULTS + EVENTS)
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Tablas para ejecutar recorridos publicados (runtime para alumnos)
--              - recorrido_runs: ejecuciones de recorridos
--              - recorrido_step_results: resultados de cada paso
--              - recorrido_events: eventos de analíticas y dominio
--
-- PRINCIPIOS:
-- 1. Runtime solo ejecuta versiones PUBLICADAS e INMUTABLES
-- 2. Cada run tiene un state_json que evoluciona según captures
-- 3. Step results guardan captured_json y duration_ms
-- 4. Events se emiten siempre (analíticas) y según definition.emit (dominio)
-- 5. Cambios incrementales, reversibles, auditables
-- ============================================================================

-- ============================================================================
-- TABLA: recorrido_runs
-- ============================================================================
-- Ejecuciones de recorridos publicados por alumnos
-- Un run representa una instancia de un recorrido en ejecución

CREATE TABLE IF NOT EXISTS recorrido_runs (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID único del run
    
    -- ========================================================================
    -- REFERENCIAS
    -- ========================================================================
    user_id TEXT NOT NULL,
    -- ID del usuario (email o alumno_id según tu ctx de alumno)
    -- NOTA: Usar TEXT para flexibilidad (puede ser email o ID numérico)
    
    recorrido_id TEXT NOT NULL,
    -- FK a recorridos(id)
    
    version INT NOT NULL,
    -- Versión del recorrido ejecutada (de recorrido_versions)
    -- IMPORTANTE: Esta versión es INMUTABLE durante todo el run
    
    -- ========================================================================
    -- ESTADO DEL RUN
    -- ========================================================================
    status TEXT NOT NULL DEFAULT 'in_progress',
    -- Estado del run: 'in_progress', 'completed', 'abandoned'
    -- - in_progress: run activo, puede continuar
    -- - completed: run completado exitosamente
    -- - abandoned: run abandonado por el usuario
    
    current_step_id TEXT NOT NULL,
    -- ID del step actual en el que está el run
    -- Se actualiza cada vez que se avanza a un nuevo step
    
    state_json JSONB NOT NULL DEFAULT '{}',
    -- Estado del run (evoluciona según captures de steps)
    -- Formato: { "field1": "value1", "field2": "value2", ... }
    -- Se actualiza incrementalmente según step.capture
    
    -- ========================================================================
    -- METADATOS TEMPORALES
    -- ========================================================================
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Fecha/hora de inicio del run
    
    completed_at TIMESTAMPTZ NULL,
    -- Fecha/hora de finalización (NULL si no está completado)
    
    abandoned_at TIMESTAMPTZ NULL,
    -- Fecha/hora de abandono (NULL si no está abandonado)
    
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Última actividad (se actualiza en cada interacción)
    -- Útil para limpiar runs inactivos
    
    -- ========================================================================
    -- CONSTRAINTS
    -- ========================================================================
    CONSTRAINT ck_recorrido_runs_status 
        CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    CONSTRAINT fk_recorrido_runs_recorrido 
        FOREIGN KEY (recorrido_id) 
        REFERENCES recorridos(id) 
        ON DELETE CASCADE
);

-- ============================================================================
-- TABLA: recorrido_step_results
-- ============================================================================
-- Resultados de cada paso completado en un run
-- Append-only: nunca se modifica, solo se añaden nuevos resultados

CREATE TABLE IF NOT EXISTS recorrido_step_results (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID único del resultado
    
    -- ========================================================================
    -- REFERENCIAS
    -- ========================================================================
    run_id UUID NOT NULL,
    -- FK a recorrido_runs(run_id)
    
    step_id TEXT NOT NULL,
    -- ID del step completado
    
    -- ========================================================================
    -- DATOS CAPTURADOS
    -- ========================================================================
    captured_json JSONB NOT NULL DEFAULT '{}',
    -- Datos capturados en este step (raw input del usuario)
    -- Formato: { "choice_id": "emocional", "scale_value": 4, ... }
    -- Se guarda tal cual viene del input del usuario
    
    duration_ms INT NULL,
    -- Duración en milisegundos que el usuario pasó en este step
    -- NULL si no se mide (opcional)
    
    -- ========================================================================
    -- METADATOS TEMPORALES
    -- ========================================================================
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Fecha/hora de creación del resultado
    
    -- ========================================================================
    -- CONSTRAINTS
    -- ========================================================================
    CONSTRAINT fk_recorrido_step_results_run 
        FOREIGN KEY (run_id) 
        REFERENCES recorrido_runs(run_id) 
        ON DELETE CASCADE
);

-- ============================================================================
-- TABLA: recorrido_events
-- ============================================================================
-- Eventos de analíticas y dominio emitidos durante la ejecución de recorridos
-- Append-only: nunca se modifica, solo se añaden nuevos eventos

CREATE TABLE IF NOT EXISTS recorrido_events (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UUID único del evento
    
    -- ========================================================================
    -- REFERENCIAS
    -- ========================================================================
    run_id UUID NULL,
    -- FK a recorrido_runs(run_id) (NULL si es evento global, no asociado a run)
    
    user_id TEXT NULL,
    -- ID del usuario (email o alumno_id)
    -- NULL si es evento del sistema
    
    -- ========================================================================
    -- TIPO Y PAYLOAD
    -- ========================================================================
    event_type TEXT NOT NULL,
    -- Tipo de evento (ej: 'recorrido_started', 'step_viewed', 'step_completed', etc.)
    -- Debe coincidir con EventRegistry
    
    payload_json JSONB NOT NULL DEFAULT '{}',
    -- Payload del evento (validado contra EventRegistry.payload_schema)
    -- Formato flexible según el tipo de evento
    
    -- ========================================================================
    -- IDEMPOTENCIA
    -- ========================================================================
    idempotency_key TEXT NULL,
    -- Clave de idempotencia (opcional, para evitar duplicados)
    -- Útil para step_viewed (evitar spam por refresh)
    -- Formato sugerido: "run_id:step_id:view" o similar
    
    -- ========================================================================
    -- METADATOS TEMPORALES
    -- ========================================================================
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- Fecha/hora de creación del evento
    
    -- ========================================================================
    -- CONSTRAINTS
    -- ========================================================================
    -- NOTA: El constraint de idempotencia se crea como UNIQUE INDEX después
);

-- ============================================================================
-- ÍNDICES PARA CONSULTAS RÁPIDAS
-- ============================================================================

-- recorrido_runs: Búsqueda por usuario y estado (índice parcial para in_progress)
CREATE INDEX IF NOT EXISTS idx_recorrido_runs_user_status 
    ON recorrido_runs(user_id, status) 
    WHERE status = 'in_progress';

-- recorrido_runs: Búsqueda por recorrido y versión
CREATE INDEX IF NOT EXISTS idx_recorrido_runs_recorrido_version 
    ON recorrido_runs(recorrido_id, version);

-- recorrido_runs: Búsqueda por última actividad (para limpieza)
CREATE INDEX IF NOT EXISTS idx_recorrido_runs_last_activity 
    ON recorrido_runs(last_activity_at);

-- recorrido_step_results: Búsqueda por run y step
CREATE INDEX IF NOT EXISTS idx_recorrido_step_results_run_step 
    ON recorrido_step_results(run_id, step_id);

-- recorrido_step_results: Búsqueda por fecha (para analíticas)
CREATE INDEX IF NOT EXISTS idx_recorrido_step_results_created_at 
    ON recorrido_step_results(created_at DESC);

-- recorrido_events: Búsqueda por tipo y fecha (para analíticas)
CREATE INDEX IF NOT EXISTS idx_recorrido_events_type_created 
    ON recorrido_events(event_type, created_at DESC);

-- recorrido_events: Búsqueda por run (para historial de eventos de un run)
CREATE INDEX IF NOT EXISTS idx_recorrido_events_run 
    ON recorrido_events(run_id) 
    WHERE run_id IS NOT NULL;

-- recorrido_events: Constraint de idempotencia (UNIQUE INDEX con WHERE)
CREATE UNIQUE INDEX IF NOT EXISTS idx_recorrido_events_idempotency 
    ON recorrido_events(idempotency_key) 
    WHERE idempotency_key IS NOT NULL;

-- ============================================================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ============================================================================

COMMENT ON TABLE recorrido_runs IS 
'Ejecuciones de recorridos publicados por alumnos. Un run representa una instancia de un recorrido en ejecución.';

COMMENT ON COLUMN recorrido_runs.version IS 
'Versión del recorrido ejecutada (de recorrido_versions). Esta versión es INMUTABLE durante todo el run.';

COMMENT ON COLUMN recorrido_runs.state_json IS 
'Estado del run (evoluciona según captures de steps). Se actualiza incrementalmente según step.capture.';

COMMENT ON COLUMN recorrido_runs.current_step_id IS 
'ID del step actual en el que está el run. Se actualiza cada vez que se avanza a un nuevo step.';

COMMENT ON TABLE recorrido_step_results IS 
'Resultados de cada paso completado en un run. Append-only: nunca se modifica, solo se añaden nuevos resultados.';

COMMENT ON COLUMN recorrido_step_results.captured_json IS 
'Datos capturados en este step (raw input del usuario). Se guarda tal cual viene del input del usuario.';

COMMENT ON TABLE recorrido_events IS 
'Eventos de analíticas y dominio emitidos durante la ejecución de recorridos. Append-only: nunca se modifica.';

COMMENT ON COLUMN recorrido_events.idempotency_key IS 
'Clave de idempotencia (opcional, para evitar duplicados). Útil para step_viewed (evitar spam por refresh).';

-- ============================================================================
-- NOTAS DE USO
-- ============================================================================
-- 
-- FLUJO TÍPICO DE UN RUN:
-- 
-- 1. CREAR RUN (startRun):
--    - Cargar última versión publicada del recorrido
--    - Crear run con version, entry_step_id, state_json={}
--    - Emitir evento: recorrido_started
--    - Devolver { run_id, step: renderSpec }
-- 
-- 2. OBTENER STEP ACTUAL (getCurrentStep):
--    - Cargar run (autorizar: run.user_id == ctx.user.id)
--    - Cargar definition por (recorrido_id, version)
--    - Construir renderSpec del step actual
--    - Emitir step_viewed (con idempotency)
--    - Devolver renderSpec
-- 
-- 3. SUBMIT STEP (submitStep):
--    - Verificar run activo y step_id coincide con current_step_id
--    - Aplicar CAPTURE declarativo del step
--    - Append step_result
--    - Emitir step_completed
--    - Emitir eventos de dominio (step.emit)
--    - Calcular siguiente step (edges + conditions)
--    - Update run.current_step_id y last_activity_at
--    - Si no hay siguiente: marcar completed y emitir recorrido_completed
--    - Devolver next renderSpec
-- 
-- 4. ABANDONAR RUN (abandonRun):
--    - Marcar run abandoned + abandoned_at
--    - Emitir recorrido_abandoned
-- 
-- IMPORTANTE:
-- - Runtime solo ejecuta versiones PUBLICADAS (status='published')
-- - Las versiones son INMUTABLES (nunca cambian después de publicar)
-- - state_json evoluciona incrementalmente (no se sobrescribe completo)
-- - Events siempre se emiten (analíticas) + según definition.emit (dominio)
-- - Idempotency para step_viewed evita spam por refresh
-- 
-- ============================================================================

