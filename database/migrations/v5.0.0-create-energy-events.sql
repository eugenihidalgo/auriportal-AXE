-- ============================================================================
-- Migración v5.0.0: Tabla energy_events - NÚCLEO CANÓNICO del Sistema Energético
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Tabla append-only (inmutable) para TODOS los eventos energéticos
--              del sistema. Esta es la COLUMNA VERTEBRAL del nuevo sistema.
--
-- PRINCIPIOS FUNDAMENTALES:
-- 1. APPEND-ONLY: NO updates, NO deletes. Solo INSERT.
-- 2. INMUTABILIDAD: Cada evento es un hecho histórico que nunca cambia.
-- 3. EXTENSIBILIDAD INFINITA: Cualquier concepto energético (limpiar, iluminar,
--    conectar, amar, activar, etc.) es un tipo de evento.
-- 4. SIN ESTADOS CALCULADOS: No hay columnas tipo "is_clean_now" ni contadores.
--    El estado se calcula leyendo la secuencia de eventos.
--
-- PREPARADA PARA:
-- - Millones de registros (BIGSERIAL, particionamiento futuro si es necesario)
-- - Consultas rápidas por alumno, sujeto, tipo de evento, fecha
-- - Análisis histórico completo
-- - Auditoría total del sistema energético
-- ============================================================================

CREATE TABLE IF NOT EXISTS energy_events (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id BIGSERIAL PRIMARY KEY,
    -- ID secuencial único. BIGSERIAL permite hasta 9,223,372,036,854,775,807 registros.
    -- El orden de inserción (id) es el orden temporal canónico del sistema.
    
    -- ========================================================================
    -- TEMPORALIDAD
    -- ========================================================================
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Timestamp exacto del momento en que ocurrió el evento.
    -- TIMESTAMPTZ almacena con timezone para evitar ambigüedades.
    -- DEFAULT NOW() permite insertar sin especificar, pero se recomienda
    -- siempre especificar el timestamp real del evento.
    
    -- ========================================================================
    -- TIPOLOGÍA DEL EVENTO
    -- ========================================================================
    event_type TEXT NOT NULL,
    -- Tipo de evento energético. Ejemplos:
    -- - 'limpieza_iniciada'
    -- - 'limpieza_completada'
    -- - 'iluminacion_aplicada'
    -- - 'conexion_establecida'
    -- - 'amor_enviado'
    -- - 'activacion_realizada'
    -- - Cualquier string válido. El sistema es infinitamente extensible.
    -- NO usar ENUM para permitir extensibilidad sin migraciones.
    
    -- ========================================================================
    -- ACTOR (QUIÉN REALIZÓ LA ACCIÓN)
    -- ========================================================================
    actor_type TEXT NOT NULL,
    -- Tipo de actor que realizó el evento. Ejemplos:
    -- - 'alumno' (el propio alumno)
    -- - 'master' (el maestro/admin)
    -- - 'system' (sistema automático)
    -- - 'ai' (inteligencia artificial)
    -- - 'kajabi' (integración con Kajabi)
    -- Permite rastrear el origen de cada evento.
    
    actor_id TEXT,
    -- ID del actor. Puede ser:
    -- - alumno_id (si actor_type = 'alumno')
    -- - master_id (si actor_type = 'master')
    -- - null (si actor_type = 'system' o no aplica)
    -- TEXT permite flexibilidad (IDs numéricos, UUIDs, strings, etc.)
    
    -- ========================================================================
    -- ALUMNO AFECTADO
    -- ========================================================================
    alumno_id INTEGER,
    -- ID del alumno afectado por este evento.
    -- NULLABLE porque algunos eventos pueden ser globales o no afectar a un alumno específico.
    -- Índice crítico para consultas por alumno.
    
    -- ========================================================================
    -- SUJETO DEL EVENTO (SOBRE QUÉ SE ACTUÓ)
    -- ========================================================================
    subject_type TEXT,
    -- Tipo de entidad sobre la que se actuó. Ejemplos:
    -- - 'lugar' (limpieza de un lugar)
    -- - 'proyecto' (limpieza de un proyecto)
    -- - 'persona' (limpieza de una persona)
    -- - 'alumno' (iluminación del alumno)
    -- - 'sistema' (evento global)
    -- NULLABLE porque algunos eventos pueden no tener sujeto específico.
    
    subject_id TEXT,
    -- ID del sujeto. Puede ser:
    -- - lugar_id (si subject_type = 'lugar')
    -- - proyecto_id (si subject_type = 'proyecto')
    -- - persona_id (si subject_type = 'persona')
    -- - alumno_id (si subject_type = 'alumno')
    -- TEXT permite flexibilidad.
    -- NULLABLE porque algunos eventos pueden no tener sujeto específico.
    -- Índice compuesto con subject_type para consultas rápidas.
    
    -- ========================================================================
    -- ORIGEN Y TRAZABILIDAD
    -- ========================================================================
    origin TEXT,
    -- Origen del evento. Ejemplos:
    -- - 'web_portal' (desde el portal web)
    -- - 'admin_panel' (desde el panel de admin)
    -- - 'api' (desde una API externa)
    -- - 'cron' (tarea programada)
    -- - 'migration' (migración de datos legacy)
    -- Permite rastrear de dónde vino cada evento.
    
    notes TEXT,
    -- Notas libres sobre el evento. Campo de texto para observaciones,
    -- explicaciones o contexto adicional que no cabe en metadata.
    -- NULLABLE porque no todos los eventos requieren notas.
    
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Metadatos adicionales del evento en formato JSONB.
    -- Permite almacenar cualquier información estructurada sin cambiar el esquema.
    -- Ejemplos de uso:
    -- - Detalles específicos del tipo de limpieza
    -- - Parámetros de iluminación
    -- - Información de conexión
    -- - Cualquier dato extensible
    -- JSONB permite indexación y consultas eficientes.
    -- DEFAULT '{}'::jsonb para evitar NULLs.
    
    request_id TEXT,
    -- Correlation ID del request HTTP que generó el evento.
    -- Permite correlacionar eventos con logs, audit_events, analytics_events.
    -- Útil para debugging y trazabilidad completa.
    -- NULLABLE porque algunos eventos pueden no venir de un request HTTP.
    
    -- ========================================================================
    -- CAMPOS ENERGÉTICOS ESPECÍFICOS
    -- ========================================================================
    -- Estos campos son específicos para conceptos energéticos comunes,
    -- pero el sistema NO depende exclusivamente de ellos.
    -- Cualquier evento puede usar metadata para campos adicionales.
    
    requires_clean_state BOOLEAN,
    -- Indica si este evento requiere conocer el estado de limpieza.
    -- NULLABLE: solo tiene sentido para eventos relacionados con limpieza.
    -- Ejemplo: 'limpieza_completada' podría tener requires_clean_state = true.
    
    was_clean_before BOOLEAN,
    -- Estado de limpieza ANTES del evento (si aplica).
    -- NULLABLE: solo tiene sentido si requires_clean_state = true.
    -- Este es un SNAPSHOT del estado en ese momento, no un estado calculado.
    -- Se calcula leyendo eventos anteriores al momento del evento.
    
    is_clean_after BOOLEAN,
    -- Estado de limpieza DESPUÉS del evento (si aplica).
    -- NULLABLE: solo tiene sentido si requires_clean_state = true.
    -- Este es el resultado del evento, no un estado calculado.
    -- El estado "actual" se calcula leyendo el último evento relevante.
    
    illumination_amount INTEGER
    -- Cantidad de iluminación aplicada en este evento (si aplica).
    -- NULLABLE: solo tiene sentido para eventos de tipo 'iluminacion_*'.
    -- Puede ser positivo (iluminación) o negativo (oscurecimiento).
    -- El total de iluminación se calcula sumando eventos anteriores.
    
    -- ========================================================================
    -- CONSTRAINTS Y VALIDACIONES
    -- ========================================================================
    -- NO hay constraints de UNIQUE (excepto PK) porque permitimos múltiples
    -- eventos del mismo tipo en el mismo momento.
    -- NO hay constraints de CHECK porque queremos máxima flexibilidad.
    -- La validación se hace en la capa de aplicación.
    
    -- ========================================================================
    -- NOTA SOBRE APPEND-ONLY
    -- ========================================================================
    -- Esta tabla NO debe tener triggers de UPDATE ni DELETE.
    -- Si necesitas "corregir" un evento, inserta un nuevo evento de tipo
    -- 'correccion' o 'evento_anulado' que referencie al evento original.
    -- La historia es sagrada e inmutable.
);

-- ============================================================================
-- ÍNDICES PARA CONSULTAS RÁPIDAS
-- ============================================================================
-- Estos índices están optimizados para las consultas más comunes del sistema.
-- PostgreSQL crea índices B-tree por defecto, eficientes para rangos y
-- comparaciones.

-- Índice principal por alumno (consulta más común)
CREATE INDEX IF NOT EXISTS idx_energy_events_alumno_id 
    ON energy_events(alumno_id) 
    WHERE alumno_id IS NOT NULL;
-- WHERE clause crea un índice parcial más pequeño y eficiente.

-- Índice compuesto por sujeto (subject_type + subject_id)
CREATE INDEX IF NOT EXISTS idx_energy_events_subject 
    ON energy_events(subject_type, subject_id) 
    WHERE subject_type IS NOT NULL AND subject_id IS NOT NULL;
-- Permite consultas rápidas como "todos los eventos sobre este lugar".

-- Índice por tipo de evento
CREATE INDEX IF NOT EXISTS idx_energy_events_event_type 
    ON energy_events(event_type);
-- Permite filtrar por tipo de evento (ej: todas las limpiezas).

-- Índice por fecha (temporal)
CREATE INDEX IF NOT EXISTS idx_energy_events_occurred_at 
    ON energy_events(occurred_at DESC);
-- DESC permite consultas de eventos recientes más rápidas.
-- Crítico para "últimos eventos" y análisis temporal.

-- Índice compuesto por alumno y fecha (consulta muy común)
CREATE INDEX IF NOT EXISTS idx_energy_events_alumno_occurred 
    ON energy_events(alumno_id, occurred_at DESC) 
    WHERE alumno_id IS NOT NULL;
-- Permite "historial completo de eventos de un alumno" ordenado por fecha.

-- Índice compuesto por tipo de evento y fecha
CREATE INDEX IF NOT EXISTS idx_energy_events_type_occurred 
    ON energy_events(event_type, occurred_at DESC);
-- Permite "todas las limpiezas ordenadas por fecha" o similares.

-- Índice por request_id (trazabilidad)
CREATE INDEX IF NOT EXISTS idx_energy_events_request_id 
    ON energy_events(request_id) 
    WHERE request_id IS NOT NULL;
-- Permite correlacionar eventos con requests HTTP.

-- Índice compuesto por actor (actor_type + actor_id)
CREATE INDEX IF NOT EXISTS idx_energy_events_actor 
    ON energy_events(actor_type, actor_id) 
    WHERE actor_id IS NOT NULL;
-- Permite "todos los eventos realizados por este master".

-- Índice compuesto por sujeto y fecha
CREATE INDEX IF NOT EXISTS idx_energy_events_subject_occurred 
    ON energy_events(subject_type, subject_id, occurred_at DESC) 
    WHERE subject_type IS NOT NULL AND subject_id IS NOT NULL;
-- Permite "historial de eventos sobre este lugar/proyecto" ordenado.

-- ============================================================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ============================================================================

COMMENT ON TABLE energy_events IS 
'Tabla canónica append-only para TODOS los eventos energéticos del sistema. 
Esta es la COLUMNA VERTEBRAL del sistema energético basado en eventos inmutables.
PRINCIPIOS: Solo INSERT, nunca UPDATE ni DELETE. Cada evento es un hecho histórico.
EXTENSIBILIDAD: Cualquier concepto energético es un tipo de evento.
ESTADO: Se calcula leyendo la secuencia de eventos, no se almacena.';

COMMENT ON COLUMN energy_events.id IS 
'ID secuencial único (BIGSERIAL). El orden de inserción es el orden temporal canónico.';

COMMENT ON COLUMN energy_events.occurred_at IS 
'Timestamp exacto del momento en que ocurrió el evento (TIMESTAMPTZ con timezone).';

COMMENT ON COLUMN energy_events.event_type IS 
'Tipo de evento energético. Ejemplos: limpieza_iniciada, limpieza_completada, 
iluminacion_aplicada, conexion_establecida, amor_enviado, activacion_realizada.
El sistema es infinitamente extensible sin cambiar el esquema.';

COMMENT ON COLUMN energy_events.actor_type IS 
'Tipo de actor que realizó el evento: alumno, master, system, ai, kajabi, etc.';

COMMENT ON COLUMN energy_events.actor_id IS 
'ID del actor (alumno_id, master_id, etc.). TEXT permite flexibilidad (números, UUIDs, strings).';

COMMENT ON COLUMN energy_events.alumno_id IS 
'ID del alumno afectado por este evento. NULLABLE para eventos globales.';

COMMENT ON COLUMN energy_events.subject_type IS 
'Tipo de entidad sobre la que se actuó: lugar, proyecto, persona, alumno, sistema, etc.';

COMMENT ON COLUMN energy_events.subject_id IS 
'ID del sujeto (lugar_id, proyecto_id, etc.). TEXT permite flexibilidad.';

COMMENT ON COLUMN energy_events.origin IS 
'Origen del evento: web_portal, admin_panel, api, cron, migration, etc.';

COMMENT ON COLUMN energy_events.notes IS 
'Notas libres sobre el evento. Campo de texto para observaciones o contexto adicional.';

COMMENT ON COLUMN energy_events.metadata IS 
'Metadatos adicionales en JSONB. Permite almacenar cualquier información estructurada 
sin cambiar el esquema. Ejemplos: detalles de limpieza, parámetros de iluminación, etc.';

COMMENT ON COLUMN energy_events.request_id IS 
'Correlation ID del request HTTP. Permite correlacionar con logs, audit_events, analytics_events.';

COMMENT ON COLUMN energy_events.requires_clean_state IS 
'Indica si este evento requiere conocer el estado de limpieza. 
Solo tiene sentido para eventos relacionados con limpieza.';

COMMENT ON COLUMN energy_events.was_clean_before IS 
'Estado de limpieza ANTES del evento (snapshot, no estado calculado). 
Se calcula leyendo eventos anteriores al momento del evento.';

COMMENT ON COLUMN energy_events.is_clean_after IS 
'Estado de limpieza DESPUÉS del evento (resultado del evento, no estado calculado). 
El estado "actual" se calcula leyendo el último evento relevante.';

COMMENT ON COLUMN energy_events.illumination_amount IS 
'Cantidad de iluminación aplicada en este evento. 
Puede ser positivo (iluminación) o negativo (oscurecimiento). 
El total se calcula sumando eventos anteriores.';

-- ============================================================================
-- NOTAS DE USO Y PRINCIPIOS
-- ============================================================================
-- 
-- CÓMO CALCULAR EL ESTADO ACTUAL:
-- 
-- Para saber si un lugar está limpio AHORA:
--   1. Buscar el último evento donde subject_type='lugar' y subject_id='X'
--      y event_type relacionado con limpieza
--   2. Leer is_clean_after de ese evento
--   3. Ese es el estado actual
-- 
-- Para saber la iluminación total de un alumno:
--   1. Filtrar eventos donde alumno_id='X' y event_type='iluminacion_*'
--   2. Sumar todos los illumination_amount
--   3. Ese es el total actual
-- 
-- PARA EXTENDER EL SISTEMA:
-- 
-- Si necesitas un nuevo concepto energético (ej: "bendición"):
--   1. Crea eventos con event_type='bendicion_aplicada'
--   2. Usa metadata para campos específicos de bendiciones
--   3. NO necesitas cambiar el esquema de la tabla
-- 
-- PARA CORREGIR EVENTOS:
-- 
-- Si insertaste un evento incorrecto:
--   1. NO lo borres ni lo modifiques
--   2. Inserta un nuevo evento con event_type='correccion' o 'evento_anulado'
--   3. En metadata, referencia el id del evento original: {"corrects_event_id": 123}
--   4. Inserta el evento correcto
--   5. La lógica de lectura debe ignorar eventos anulados
-- 
-- PARTICIONAMIENTO FUTURO:
-- 
-- Si la tabla crece a millones de registros, considera particionamiento por:
--   - occurred_at (por mes o año)
--   - alumno_id (por rango de IDs)
-- PostgreSQL soporta particionamiento nativo sin cambiar la lógica de aplicación.
-- 
-- ============================================================================




