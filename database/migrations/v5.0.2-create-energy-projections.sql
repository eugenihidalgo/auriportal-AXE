-- ============================================================================
-- Migración v5.0.2: Tablas de Proyección para Sistema Energético
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Tablas de proyección (read models) para consultas rápidas
--              sin necesidad de escanear millones de eventos cada vez.
--
-- PRINCIPIOS:
-- 1. READ MODELS: Proyecciones calculadas desde energy_events (fuente de verdad)
-- 2. INCREMENTAL: Se actualizan evento por evento, no se recalculan desde cero
-- 3. EVENTUAL CONSISTENCY: Pueden estar ligeramente desactualizadas, pero
--    se recalculan periódicamente o en backfill
-- 4. NO LEGACY: No dependen de estados legacy ('al_dia', 'pendiente', etc.)
--    Todo viene del stream de eventos
-- ============================================================================

-- ============================================================================
-- TABLA: energy_subject_state
-- ============================================================================
-- Estado actual de cada sujeto (lugar, proyecto, persona, alumno, etc.)
-- Agregado por (subject_type, subject_id, alumno_id)
-- alumno_id puede ser NULL para estados globales

CREATE TABLE IF NOT EXISTS energy_subject_state (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id BIGSERIAL PRIMARY KEY,
    
    -- ========================================================================
    -- SUJETO (SOBRE QUÉ SE PROYECTA)
    -- ========================================================================
    subject_type TEXT NOT NULL,
    -- Tipo de entidad: 'lugar', 'proyecto', 'persona', 'alumno', 'sistema', etc.
    
    subject_id TEXT NOT NULL,
    -- ID del sujeto (lugar_id, proyecto_id, etc.)
    
    -- ========================================================================
    -- ALUMNO (OPCIONAL, PARA ESTADOS POR ALUMNO)
    -- ========================================================================
    alumno_id INTEGER,
    -- ID del alumno. NULL para estados globales (no específicos de un alumno).
    -- Ejemplo: Un lugar puede estar limpio globalmente (alumno_id=NULL) o
    -- limpio para un alumno específico (alumno_id=123).
    
    -- ========================================================================
    -- ESTADO DE LIMPIEZA
    -- ========================================================================
    is_clean BOOLEAN NOT NULL DEFAULT FALSE,
    -- Estado actual de limpieza del sujeto.
    -- Se calcula desde eventos de tipo 'limpieza_*' o 'cleaning_*'.
    
    clean_last_at TIMESTAMPTZ,
    -- Timestamp del último evento que marcó el sujeto como limpio.
    -- NULL si nunca ha sido limpiado.
    
    -- ========================================================================
    -- ILUMINACIÓN
    -- ========================================================================
    illumination_count INTEGER NOT NULL DEFAULT 0,
    -- Contador de iluminaciones aplicadas.
    -- Se incrementa SOLO con eventos de tipo 'illumination' o 'iluminacion_*'.
    -- NO se incrementa con otros tipos de eventos.
    
    illumination_last_at TIMESTAMPTZ,
    -- Timestamp del último evento de iluminación.
    -- NULL si nunca ha sido iluminado.
    
    -- ========================================================================
    -- METADATOS TEMPORALES
    -- ========================================================================
    last_event_at TIMESTAMPTZ,
    -- Timestamp del último evento que afectó a este sujeto.
    -- Útil para saber cuándo fue la última actividad.
    
    last_event_id BIGINT,
    -- ID del último evento procesado para este sujeto.
    -- Útil para backfill incremental (procesar solo eventos nuevos).
    
    -- ========================================================================
    -- METADATOS ADICIONALES
    -- ========================================================================
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Fecha de creación del registro (primera proyección).
    
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Fecha de última actualización de la proyección.
    
    -- ========================================================================
    -- CONSTRAINTS
    -- ========================================================================
    -- UNIQUE: Un sujeto solo puede tener un estado por alumno (o global)
    CONSTRAINT uq_energy_subject_state_unique 
        UNIQUE (subject_type, subject_id, alumno_id)
);

-- ============================================================================
-- TABLA: energy_subject_stats_rolling (OPCIONAL)
-- ============================================================================
-- Estadísticas rolling (ventanas móviles) por tipo de evento.
-- Útil para dashboards y análisis temporal.
-- Se puede omitir si no se necesitan estadísticas rolling.

CREATE TABLE IF NOT EXISTS energy_subject_stats_rolling (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id BIGSERIAL PRIMARY KEY,
    
    -- ========================================================================
    -- SUJETO
    -- ========================================================================
    subject_type TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    alumno_id INTEGER,
    -- Mismo concepto que energy_subject_state
    
    -- ========================================================================
    -- VENTANA TEMPORAL
    -- ========================================================================
    window_type TEXT NOT NULL,
    -- Tipo de ventana: '7d' (7 días), '30d' (30 días), '90d' (90 días), etc.
    
    window_start TIMESTAMPTZ NOT NULL,
    -- Inicio de la ventana temporal.
    
    window_end TIMESTAMPTZ NOT NULL,
    -- Fin de la ventana temporal.
    
    -- ========================================================================
    -- ESTADÍSTICAS POR TIPO DE EVENTO
    -- ========================================================================
    -- Contadores por event_type (flexible, extensible)
    -- Usamos JSONB para permitir cualquier event_type sin cambiar el esquema
    event_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Ejemplo: {"illumination": 5, "cleaning": 2, "connection": 1}
    -- Permite agregar nuevos tipos sin migraciones.
    
    -- ========================================================================
    -- METADATOS
    -- ========================================================================
    last_event_id BIGINT,
    -- ID del último evento procesado para esta ventana.
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- ========================================================================
    -- CONSTRAINTS
    -- ========================================================================
    -- UNIQUE: Una ventana por sujeto y tipo de ventana
    CONSTRAINT uq_energy_subject_stats_rolling_unique 
        UNIQUE (subject_type, subject_id, alumno_id, window_type, window_start)
);

-- ============================================================================
-- ÍNDICES PARA CONSULTAS RÁPIDAS
-- ============================================================================

-- energy_subject_state: Búsqueda por sujeto
CREATE INDEX IF NOT EXISTS idx_energy_subject_state_subject 
    ON energy_subject_state(subject_type, subject_id) 
    WHERE subject_type IS NOT NULL AND subject_id IS NOT NULL;

-- energy_subject_state: Búsqueda por alumno
CREATE INDEX IF NOT EXISTS idx_energy_subject_state_alumno 
    ON energy_subject_state(alumno_id) 
    WHERE alumno_id IS NOT NULL;

-- energy_subject_state: Búsqueda por estado de limpieza
CREATE INDEX IF NOT EXISTS idx_energy_subject_state_clean 
    ON energy_subject_state(is_clean) 
    WHERE is_clean = TRUE;

-- energy_subject_state: Búsqueda por última actividad
CREATE INDEX IF NOT EXISTS idx_energy_subject_state_last_event 
    ON energy_subject_state(last_event_at DESC) 
    WHERE last_event_at IS NOT NULL;

-- energy_subject_state: Búsqueda compuesta (sujeto + alumno)
CREATE INDEX IF NOT EXISTS idx_energy_subject_state_subject_alumno 
    ON energy_subject_state(subject_type, subject_id, alumno_id);

-- energy_subject_stats_rolling: Búsqueda por sujeto y ventana
CREATE INDEX IF NOT EXISTS idx_energy_subject_stats_rolling_subject 
    ON energy_subject_stats_rolling(subject_type, subject_id, window_type, window_start DESC);

-- energy_subject_stats_rolling: Búsqueda por alumno
CREATE INDEX IF NOT EXISTS idx_energy_subject_stats_rolling_alumno 
    ON energy_subject_stats_rolling(alumno_id) 
    WHERE alumno_id IS NOT NULL;

-- ============================================================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ============================================================================

COMMENT ON TABLE energy_subject_state IS 
'Proyección (read model) del estado actual de cada sujeto energético.
Se actualiza incrementalmente desde energy_events (fuente de verdad).
Permite consultas rápidas sin escanear millones de eventos.';

COMMENT ON COLUMN energy_subject_state.subject_type IS 
'Tipo de entidad: lugar, proyecto, persona, alumno, sistema, etc.';

COMMENT ON COLUMN energy_subject_state.subject_id IS 
'ID del sujeto (lugar_id, proyecto_id, etc.).';

COMMENT ON COLUMN energy_subject_state.alumno_id IS 
'ID del alumno. NULL para estados globales (no específicos de un alumno).';

COMMENT ON COLUMN energy_subject_state.is_clean IS 
'Estado actual de limpieza. Se calcula desde eventos de tipo limpieza_* o cleaning_*.';

COMMENT ON COLUMN energy_subject_state.clean_last_at IS 
'Timestamp del último evento que marcó el sujeto como limpio. NULL si nunca ha sido limpiado.';

COMMENT ON COLUMN energy_subject_state.illumination_count IS 
'Contador de iluminaciones aplicadas. Se incrementa SOLO con eventos de tipo illumination o iluminacion_*.';

COMMENT ON COLUMN energy_subject_state.illumination_last_at IS 
'Timestamp del último evento de iluminación. NULL si nunca ha sido iluminado.';

COMMENT ON COLUMN energy_subject_state.last_event_at IS 
'Timestamp del último evento que afectó a este sujeto. Útil para saber cuándo fue la última actividad.';

COMMENT ON COLUMN energy_subject_state.last_event_id IS 
'ID del último evento procesado. Útil para backfill incremental (procesar solo eventos nuevos).';

COMMENT ON TABLE energy_subject_stats_rolling IS 
'Estadísticas rolling (ventanas móviles) por tipo de evento.
Útil para dashboards y análisis temporal. Opcional si no se necesitan estadísticas rolling.';

COMMENT ON COLUMN energy_subject_stats_rolling.window_type IS 
'Tipo de ventana: 7d (7 días), 30d (30 días), 90d (90 días), etc.';

COMMENT ON COLUMN energy_subject_stats_rolling.event_counts IS 
'Contadores por event_type en formato JSONB. Ejemplo: {"illumination": 5, "cleaning": 2}.
Permite agregar nuevos tipos sin migraciones.';

-- ============================================================================
-- NOTAS DE USO
-- ============================================================================
-- 
-- CÓMO ACTUALIZAR LAS PROYECCIONES:
-- 
-- 1. INCREMENTAL (evento por evento):
--    - Cuando se inserta un nuevo evento en energy_events, llamar a
--      applyEventToProjections(eventRow) para actualizar las proyecciones.
-- 
-- 2. BACKFILL (recalcular desde cero):
--    - Ejecutar backfillProjections({ fromEventId, toEventId, dryRun })
--    - Procesa eventos en batches y actualiza las proyecciones.
-- 
-- 3. MANTENIMIENTO:
--    - Ejecutar backfill periódicamente para asegurar consistencia.
--    - Usar last_event_id para procesar solo eventos nuevos.
-- 
-- CÓMO CONSULTAR:
-- 
-- - Estado de un sujeto:
--   SELECT * FROM energy_subject_state 
--   WHERE subject_type = 'lugar' AND subject_id = '123';
-- 
-- - Estado de un alumno:
--   SELECT * FROM energy_subject_state 
--   WHERE alumno_id = 456;
-- 
-- - Lugares limpios:
--   SELECT * FROM energy_subject_state 
--   WHERE subject_type = 'lugar' AND is_clean = TRUE;
-- 
-- - Estadísticas rolling:
--   SELECT * FROM energy_subject_stats_rolling 
--   WHERE subject_type = 'lugar' AND subject_id = '123' AND window_type = '7d';
-- 
-- ============================================================================











