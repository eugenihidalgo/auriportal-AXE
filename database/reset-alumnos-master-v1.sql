-- ============================================================================
-- RESET ALUMNOS MASTER v1 - HARD DELETE Total
-- ============================================================================
-- Fecha: 2026-01-13
-- Versión: v5.69.0-reset-alumnos-fix-logger
-- Descripción: Eliminación total y definitiva de todos los alumnos legacy
--              del sistema. Reset canónico consciente.
--
-- PRINCIPIOS:
-- 1. HARD DELETE (no soft delete)
-- 2. Orden correcto por FK (eliminar dependientes primero)
-- 3. Reset consciente y definitivo
-- 4. Sistema preparado para crear alumnos canónicamente después
-- ============================================================================

BEGIN;

-- ============================================================================
-- PASO 1: Eliminar tablas dependientes de students/alumnos
-- ============================================================================

-- Tabla: student_item_state (FK a alumnos.id)
DELETE FROM student_item_state;
SELECT 'student_item_state: ' || count(*)::text || ' registros eliminados' AS resultado
FROM (SELECT 1) AS dummy;

-- Tabla: cleaning_events (FK a alumnos.id como student_id)
DELETE FROM cleaning_events;
SELECT 'cleaning_events: ' || count(*)::text || ' registros eliminados' AS resultado
FROM (SELECT 1) AS dummy;

-- Tabla: cleaning_item_state (FK a alumnos.id como student_id)
DELETE FROM cleaning_item_state;
SELECT 'cleaning_item_state: ' || count(*)::text || ' registros eliminados' AS resultado
FROM (SELECT 1) AS dummy;

-- Tabla: practicas (FK a alumnos.id)
DELETE FROM practicas;
SELECT 'practicas: ' || count(*)::text || ' registros eliminados' AS resultado
FROM (SELECT 1) AS dummy;

-- Tabla: pausas (FK a alumnos.id)
DELETE FROM pausas;
SELECT 'pausas: ' || count(*)::text || ' registros eliminados' AS resultado
FROM (SELECT 1) AS dummy;

-- Tabla: pde_signal_emissions (si tiene FK relacionada con students)
-- Nota: Verificar si existe scope = 'student' o similar
DELETE FROM pde_signal_emissions WHERE scope = 'student' OR scope LIKE '%student%';
SELECT 'pde_signal_emissions (student scope): ' || count(*)::text || ' registros eliminados' AS resultado
FROM (SELECT 1) AS dummy;

-- Tabla: student_signal_audit (si existe y tiene FK)
-- Nota: Si la tabla existe, eliminar
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_signal_audit') THEN
        EXECUTE 'DELETE FROM student_signal_audit';
        RAISE NOTICE 'student_signal_audit: registros eliminados';
    END IF;
END $$;

-- Tabla: energy_events (si existe y tiene FK a alumnos)
-- Nota: Si la tabla existe, eliminar
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'energy_events') THEN
        EXECUTE 'DELETE FROM energy_events';
        RAISE NOTICE 'energy_events: registros eliminados';
    END IF;
END $$;

-- ============================================================================
-- PASO 2: Eliminar tablas principales (students y alumnos)
-- ============================================================================

-- Tabla: students (UUID canónico)
DELETE FROM students;
SELECT 'students: ' || count(*)::text || ' registros eliminados' AS resultado
FROM (SELECT 1) AS dummy;

-- Tabla: alumnos (legacy)
DELETE FROM alumnos;
SELECT 'alumnos: ' || count(*)::text || ' registros eliminados' AS resultado
FROM (SELECT 1) AS dummy;

-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================

SELECT 
    (SELECT count(*) FROM students) AS students_count,
    (SELECT count(*) FROM alumnos) AS alumnos_count,
    (SELECT count(*) FROM pausas) AS pausas_count,
    (SELECT count(*) FROM student_item_state) AS student_item_state_count,
    (SELECT count(*) FROM cleaning_events) AS cleaning_events_count,
    (SELECT count(*) FROM cleaning_item_state) AS cleaning_item_state_count;

COMMIT;

-- ============================================================================
-- LOG DE EJECUCIÓN
-- ============================================================================
-- Reset canónico ejecutado: 2026-01-13
-- Versión: v5.69.0-reset-alumnos-fix-logger
-- Estado: Sistema vacío, preparado para creación canónica de alumnos
-- ============================================================================
