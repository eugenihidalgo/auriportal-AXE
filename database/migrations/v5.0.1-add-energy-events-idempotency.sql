-- ============================================================================
-- Migración v5.0.1: Constraint de Idempotencia para energy_events
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Añade constraint UNIQUE para evitar duplicados por request_id
--              combinado con event_type, subject_type, subject_id y alumno_id.
--
-- IMPORTANTE: Esta migración NO modifica v5.0.0, solo añade el constraint.
-- ============================================================================

-- ============================================================================
-- CONSTRAINT DE IDEMPOTENCIA
-- ============================================================================
-- Evita duplicados cuando se inserta el mismo evento con el mismo request_id
-- y los mismos valores de event_type, subject_type, subject_id y alumno_id.
--
-- NOTA: PostgreSQL trata NULL != NULL, así que dos eventos con request_id='X'
-- pero con subject_id=NULL serán considerados diferentes si uno tiene subject_id
-- y el otro no. Esto es correcto para nuestra lógica de idempotencia.
--
-- Estrategia: Usamos UNIQUE INDEX sobre las columnas relevantes.
-- Si algún campo es NULL, PostgreSQL lo trata como valor único en el índice.
-- El WHERE clause asegura que solo aplicamos idempotencia cuando hay request_id.

CREATE UNIQUE INDEX IF NOT EXISTS idx_energy_events_idempotency 
    ON energy_events(request_id, event_type, subject_type, subject_id, alumno_id)
    WHERE request_id IS NOT NULL;
-- WHERE clause asegura que solo aplicamos idempotencia cuando hay request_id.
-- Si request_id es NULL, permitimos múltiples eventos (puede ser legítimo).
-- PostgreSQL trata NULL != NULL, así que eventos con diferentes NULLs son considerados diferentes.

-- ============================================================================
-- COMENTARIOS
-- ============================================================================

COMMENT ON INDEX idx_energy_events_idempotency IS 
'Índice único para garantizar idempotencia: evita duplicados cuando se inserta 
el mismo evento con el mismo request_id y los mismos valores de event_type, 
subject_type, subject_id y alumno_id. Solo aplica cuando request_id IS NOT NULL.';

-- ============================================================================
-- NOTAS DE USO
-- ============================================================================
-- 
-- CÓMO FUNCIONA LA IDEMPOTENCIA:
-- 
-- 1. Si insertas un evento con request_id='req_123', event_type='cleaning',
--    subject_type='aspecto', subject_id='456', alumno_id=789
-- 
-- 2. Si intentas insertar el mismo evento otra vez con los mismos valores,
--    el constraint UNIQUE lanzará un error de duplicado.
-- 
-- 3. En el código, usamos ON CONFLICT DO NOTHING para manejar esto gracefully:
--    INSERT ... ON CONFLICT (request_id, event_type, subject_type, subject_id, alumno_id) 
--    DO NOTHING
-- 
-- 4. Si el INSERT retorna 0 filas, significa que ya existía (idempotencia OK).
-- 
-- CASOS ESPECIALES:
-- 
-- - Si request_id es NULL, NO se aplica idempotencia (puede haber múltiples
--   eventos sin request_id, lo cual es legítimo para eventos de sistema).
-- 
-- - Si subject_id o alumno_id son NULL, se tratan como valores distintos.
--   Ejemplo: request_id='X', event_type='cleaning', subject_id=NULL, alumno_id=1
--   es diferente de request_id='X', event_type='cleaning', subject_id=NULL, alumno_id=2
-- 
-- ============================================================================

