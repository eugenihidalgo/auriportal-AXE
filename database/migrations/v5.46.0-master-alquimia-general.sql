-- ============================================================================
-- Migración v5.46.0: Master Alquimia General - Preparación Canónica
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Prepara tablas para Alquimia General en dominio MASTER
--              - Añade item_ref a items_transmutaciones (puente catálogo ↔ Student SOT)
--              - Añade remaining y completed a student_item_state (para tipo una_vez)
--              - Añade índices de rendimiento
--              - Backfill determinista de item_ref
--
-- PRINCIPIOS:
-- 1. item_ref como puente canónico entre catálogo y Student SOT
-- 2. remaining/completed para tipo una_vez (no derivables)
-- 3. Soft delete vía status='archived' (ya implementado)
-- 4. Índices para rendimiento en modales con muchos alumnos
-- ============================================================================

-- ============================================================================
-- 1. AÑADIR item_ref A items_transmutaciones
-- ============================================================================

-- Añadir columna item_ref si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'items_transmutaciones' AND column_name = 'item_ref'
  ) THEN
    ALTER TABLE items_transmutaciones 
    ADD COLUMN item_ref TEXT;
    
    COMMENT ON COLUMN items_transmutaciones.item_ref IS 'Referencia canónica del ítem para Student SOT v1 (formato: te_item_<id>)';
  END IF;
END $$;

-- Backfill determinista: item_ref = 'te_item_' || id
UPDATE items_transmutaciones
SET item_ref = 'te_item_' || id::TEXT
WHERE item_ref IS NULL;

-- Asegurar que item_ref es NOT NULL después del backfill
ALTER TABLE items_transmutaciones
  ALTER COLUMN item_ref SET NOT NULL;

-- Crear constraint UNIQUE para item_ref
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'items_transmutaciones_item_ref_unique'
  ) THEN
    ALTER TABLE items_transmutaciones 
    ADD CONSTRAINT items_transmutaciones_item_ref_unique 
    UNIQUE (item_ref);
  END IF;
END $$;

-- Crear índice para búsquedas por item_ref
CREATE INDEX IF NOT EXISTS idx_items_transmutaciones_item_ref 
  ON items_transmutaciones(item_ref);

-- ============================================================================
-- 2. AÑADIR remaining Y completed A student_item_state (para tipo una_vez)
-- ============================================================================

-- Añadir remaining si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'student_item_state' AND column_name = 'remaining'
  ) THEN
    ALTER TABLE student_item_state 
    ADD COLUMN remaining INTEGER DEFAULT 0;
    
    COMMENT ON COLUMN student_item_state.remaining IS 'Número de limpiezas restantes (para tipo una_vez)';
  END IF;
END $$;

-- Añadir completed si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'student_item_state' AND column_name = 'completed'
  ) THEN
    ALTER TABLE student_item_state 
    ADD COLUMN completed INTEGER DEFAULT 0;
    
    COMMENT ON COLUMN student_item_state.completed IS 'Número de limpiezas completadas (para tipo una_vez)';
  END IF;
END $$;

-- Asegurar valores por defecto (solo si las columnas existen)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'student_item_state' AND column_name = 'remaining'
  ) THEN
    UPDATE student_item_state
    SET remaining = 0
    WHERE remaining IS NULL;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'student_item_state' AND column_name = 'completed'
  ) THEN
    UPDATE student_item_state
    SET completed = 0
    WHERE completed IS NULL;
  END IF;
END $$;

-- Asegurar NOT NULL
ALTER TABLE student_item_state
  ALTER COLUMN remaining SET NOT NULL,
  ALTER COLUMN remaining SET DEFAULT 0,
  ALTER COLUMN completed SET NOT NULL,
  ALTER COLUMN completed SET DEFAULT 0;

-- ============================================================================
-- 3. ÍNDICES DE RENDIMIENTO (para modales con muchos alumnos)
-- ============================================================================

-- Índice compuesto para búsquedas por item_ref en student_item_state
-- Nota: student_item_state usa is_active (boolean), no status
CREATE INDEX IF NOT EXISTS idx_student_item_state_item_ref_domain 
  ON student_item_state(item_ref, domain_type, product_key) 
  WHERE is_active = true;

-- Índice para búsquedas por lista_id en items_transmutaciones (para listar items)
CREATE INDEX IF NOT EXISTS idx_items_transmutaciones_lista_status_nivel 
  ON items_transmutaciones(lista_id, status, nivel, created_at) 
  WHERE status = 'active';

-- Índice para búsquedas por tipo en listas_transmutaciones
CREATE INDEX IF NOT EXISTS idx_listas_transmutaciones_tipo_status_orden 
  ON listas_transmutaciones(tipo, status, orden) 
  WHERE status = 'active';

-- Índice para búsquedas por remaining/completed (una_vez)
CREATE INDEX IF NOT EXISTS idx_student_item_state_remaining 
  ON student_item_state(domain_type, remaining) 
  WHERE domain_type = 'transmutation' AND remaining > 0;

-- Índice para búsquedas por last_cleaned_at (recurrente)
CREATE INDEX IF NOT EXISTS idx_student_item_state_last_cleaned 
  ON student_item_state(domain_type, last_cleaned_at) 
  WHERE domain_type = 'transmutation' AND last_cleaned_at IS NOT NULL;

-- ============================================================================
-- 4. VERIFICACIÓN Y SANITY CHECKS
-- ============================================================================

-- Verificar que todos los items tienen item_ref
DO $$
DECLARE
  items_sin_ref INTEGER;
BEGIN
  SELECT COUNT(*) INTO items_sin_ref
  FROM items_transmutaciones
  WHERE item_ref IS NULL;
  
  IF items_sin_ref > 0 THEN
    RAISE WARNING 'Hay % items sin item_ref. Ejecutar backfill manual.', items_sin_ref;
  ELSE
    RAISE NOTICE '✅ Todos los items tienen item_ref';
  END IF;
END $$;

-- Verificar que item_ref es único
DO $$
DECLARE
  duplicados INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicados
  FROM (
    SELECT item_ref, COUNT(*) as cnt
    FROM items_transmutaciones
    GROUP BY item_ref
    HAVING COUNT(*) > 1
  ) dup;
  
  IF duplicados > 0 THEN
    RAISE WARNING 'Hay % item_ref duplicados. Revisar integridad.', duplicados;
  ELSE
    RAISE NOTICE '✅ Todos los item_ref son únicos';
  END IF;
END $$;

-- Verificar que remaining y completed existen en student_item_state
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'student_item_state' AND column_name = 'remaining'
  ) THEN
    RAISE EXCEPTION 'Columna remaining no existe en student_item_state';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'student_item_state' AND column_name = 'completed'
  ) THEN
    RAISE EXCEPTION 'Columna completed no existe en student_item_state';
  END IF;
  
  RAISE NOTICE '✅ Campos remaining y completed existen en student_item_state';
END $$;

-- ============================================================================
-- 5. COMENTARIOS Y DOCUMENTACIÓN
-- ============================================================================

COMMENT ON COLUMN items_transmutaciones.item_ref IS 'Referencia canónica del ítem para Student SOT v1. Formato: te_item_<id>. Usado en student_item_state.item_ref.';
COMMENT ON COLUMN student_item_state.remaining IS 'Número de limpiezas restantes para tipo una_vez. Se decrementa al limpiar. Cuando remaining <= 0, is_complete = TRUE.';
COMMENT ON COLUMN student_item_state.completed IS 'Número de limpiezas completadas para tipo una_vez. Se incrementa al limpiar. Suma con remaining debe ser igual a veces_limpiar del catálogo.';

-- ============================================================================
-- NOTAS IMPORTANTES:
-- ============================================================================
-- 1. item_ref se genera como 'te_item_' || id para mantener compatibilidad
-- 2. remaining y completed son obligatorios para tipo una_vez
-- 3. Soft delete se mantiene vía status='archived' (no se añade deleted_at)
-- 4. Índices optimizados para queries de modales con muchos alumnos
-- 5. Backfill de item_ref es determinista y idempotente
-- ============================================================================
