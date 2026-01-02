-- ============================================================================
-- Migración v5.47.0: Master Alquimia General v1.1 - Priority + Classifications
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Añade priority canónico a items y prepara clasificaciones
--              - Añade priority INTEGER a items_transmutaciones
--              - Reutiliza sistema canónico de clasificaciones existente
--              - Añade días (frecuencia_dias) con default 20
--
-- PRINCIPIOS:
-- 1. priority 1 = máxima prioridad (número más bajo = más importante)
-- 2. ORDER BY priority ASC para orden natural
-- 3. Reutilizar pde_classification_terms y transmutacion_lista_classifications
-- 4. Compatibilidad: items existentes con priority = 10
-- ============================================================================

-- ============================================================================
-- 1. AÑADIR priority A items_transmutaciones
-- ============================================================================

-- Añadir columna priority si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'items_transmutaciones' AND column_name = 'priority'
  ) THEN
    ALTER TABLE items_transmutaciones 
    ADD COLUMN priority INTEGER NOT NULL DEFAULT 10;
    
    COMMENT ON COLUMN items_transmutaciones.priority IS 'Prioridad canónica del ítem (1 = máxima prioridad, número más bajo = más importante). Usado para ORDER BY priority ASC.';
  END IF;
END $$;

-- Backfill: items existentes con priority = 10
UPDATE items_transmutaciones
SET priority = 10
WHERE priority IS NULL;

-- Crear índice para ORDER BY priority ASC
CREATE INDEX IF NOT EXISTS idx_items_transmutaciones_priority 
  ON items_transmutaciones(priority);

-- Índice compuesto para listar items ordenados por priority
CREATE INDEX IF NOT EXISTS idx_items_transmutaciones_lista_priority 
  ON items_transmutaciones(lista_id, priority, nivel, created_at) 
  WHERE status = 'active';

-- ============================================================================
-- 2. AÑADIR frecuencia_dias CON DEFAULT 20 (si no existe)
-- ============================================================================

-- Añadir columna frecuencia_dias si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'items_transmutaciones' AND column_name = 'frecuencia_dias'
  ) THEN
    ALTER TABLE items_transmutaciones 
    ADD COLUMN frecuencia_dias INTEGER DEFAULT 20;
    
    COMMENT ON COLUMN items_transmutaciones.frecuencia_dias IS 'Frecuencia en días para limpieza recurrente (default 20).';
  END IF;
END $$;

-- Backfill: items existentes con frecuencia_dias = 20
UPDATE items_transmutaciones
SET frecuencia_dias = 20
WHERE frecuencia_dias IS NULL;

-- ============================================================================
-- 3. VERIFICACIÓN Y SANITY CHECKS
-- ============================================================================

-- Verificar que todos los items tienen priority
DO $$
DECLARE
  items_sin_priority INTEGER;
BEGIN
  SELECT COUNT(*) INTO items_sin_priority
  FROM items_transmutaciones
  WHERE priority IS NULL;
  
  IF items_sin_priority > 0 THEN
    RAISE WARNING 'Hay % items sin priority. Ejecutar backfill manual.', items_sin_priority;
  ELSE
    RAISE NOTICE '✅ Todos los items tienen priority';
  END IF;
END $$;

-- Verificar que el sistema de clasificaciones existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'pde_classification_terms'
  ) THEN
    RAISE WARNING 'Tabla pde_classification_terms no existe. Ejecutar migración v5.36.0 primero.';
  ELSE
    RAISE NOTICE '✅ Sistema de clasificaciones canónico disponible';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'transmutacion_lista_classifications'
  ) THEN
    RAISE WARNING 'Tabla transmutacion_lista_classifications no existe. Ejecutar migración v5.36.0 primero.';
  ELSE
    RAISE NOTICE '✅ Tabla de relación de clasificaciones disponible';
  END IF;
END $$;

-- ============================================================================
-- 4. COMENTARIOS Y DOCUMENTACIÓN
-- ============================================================================

COMMENT ON COLUMN items_transmutaciones.priority IS 'Prioridad canónica (1 = máxima, número más bajo = más importante). Orden natural: ORDER BY priority ASC. Default: 10.';
COMMENT ON COLUMN items_transmutaciones.frecuencia_dias IS 'Frecuencia en días para limpieza recurrente. Default: 20.';

-- ============================================================================
-- NOTAS IMPORTANTES:
-- ============================================================================
-- 1. priority se usa para ORDER BY priority ASC (1 aparece primero)
-- 2. Sistema de clasificaciones reutiliza pde_classification_terms existente
-- 3. Clasificaciones por lista: usar transmutacion_lista_classifications
-- 4. Compatibilidad: items existentes con priority = 10 y frecuencia_dias = 20
-- 5. Índices optimizados para queries con ORDER BY priority ASC
-- ============================================================================
