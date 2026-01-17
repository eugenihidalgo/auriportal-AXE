-- ============================================================================
-- DIAGNÓSTICO RESET ALQUIMIA GENERAL v1
-- Queries de auditoría de base de datos
-- ============================================================================
-- 
-- OBJETIVO: Detectar estados inconsistentes en cleaning_item_state
-- MODO: SOLO LECTURA (NO MODIFICA DATOS)
-- 
-- EJECUTAR EN ORDEN:
-- 1. Query 1: Estados base tras reset
-- 2. Query 2-6: Anti-estados (inconsistencias)
-- 3. Query 7: Resets duplicados
-- 4. Query 8: Reset ALL omitidos
--
-- ============================================================================

-- ============================================================================
-- QUERY 1: Estados base tras reset (deberían ser coherentes)
-- ============================================================================
-- Muestra todos los estados de cleaning_item_state con información de eventos
-- Útil para ver el estado general del sistema
-- ============================================================================

SELECT 
  cis.student_id AS student_uuid,
  cis.item_ref,
  cis.domain_type,
  cis.shared_effective_since,
  cis.shared_last_cleaned_at,
  cis.shared_clean_count,
  cis.pde_effective_since,
  cis.pde_last_cleaned_at,
  cis.pde_clean_count,
  -- Último evento de reset SHARED
  (SELECT action_type 
   FROM cleaning_events ce 
   WHERE ce.student_id = cis.student_id 
     AND ce.item_ref = cis.item_ref 
     AND ce.clean_layer = 'shared' 
     AND ce.action_type = 'reset'
   ORDER BY ce.created_at DESC 
   LIMIT 1) AS last_reset_shared_action,
  (SELECT created_at 
   FROM cleaning_events ce 
   WHERE ce.student_id = cis.student_id 
     AND ce.item_ref = cis.item_ref 
     AND ce.clean_layer = 'shared' 
     AND ce.action_type = 'reset'
   ORDER BY ce.created_at DESC 
   LIMIT 1) AS last_reset_shared_at,
  -- Último evento de reset PDE
  (SELECT action_type 
   FROM cleaning_events ce 
   WHERE ce.student_id = cis.student_id 
     AND ce.item_ref = cis.item_ref 
     AND ce.clean_layer = 'pde' 
     AND ce.action_type = 'reset'
   ORDER BY ce.created_at DESC 
   LIMIT 1) AS last_reset_pde_action,
  (SELECT created_at 
   FROM cleaning_events ce 
   WHERE ce.student_id = cis.student_id 
     AND ce.item_ref = cis.item_ref 
     AND ce.clean_layer = 'pde' 
     AND ce.action_type = 'reset'
   ORDER BY ce.created_at DESC 
   LIMIT 1) AS last_reset_pde_at,
  -- Último evento de limpieza SHARED (post-reset)
  (SELECT created_at 
   FROM cleaning_events ce 
   WHERE ce.student_id = cis.student_id 
     AND ce.item_ref = cis.item_ref 
     AND ce.clean_layer = 'shared' 
     AND ce.action_type = 'mark_clean'
     AND ce.created_at > COALESCE(
       (SELECT created_at 
        FROM cleaning_events ce2 
        WHERE ce2.student_id = cis.student_id 
          AND ce2.item_ref = cis.item_ref 
          AND ce2.clean_layer = 'shared' 
          AND ce2.action_type = 'reset'
        ORDER BY ce2.created_at DESC 
        LIMIT 1),
       '1970-01-01'::timestamp
     )
   ORDER BY ce.created_at DESC 
   LIMIT 1) AS last_clean_after_reset_shared,
  -- Último evento de limpieza PDE (post-reset)
  (SELECT created_at 
   FROM cleaning_events ce 
   WHERE ce.student_id = cis.student_id 
     AND ce.item_ref = cis.item_ref 
     AND ce.clean_layer = 'pde' 
     AND ce.action_type = 'mark_clean'
     AND ce.created_at > COALESCE(
       (SELECT created_at 
        FROM cleaning_events ce2 
        WHERE ce2.student_id = cis.student_id 
          AND ce2.item_ref = cis.item_ref 
          AND ce2.clean_layer = 'pde' 
          AND ce2.action_type = 'reset'
        ORDER BY ce2.created_at DESC 
        LIMIT 1),
       '1970-01-01'::timestamp
     )
   ORDER BY ce.created_at DESC 
   LIMIT 1) AS last_clean_after_reset_pde
FROM cleaning_item_state cis
WHERE cis.product_key = 'pde'
  AND cis.domain_type = 'transmutation'
  -- Filtrar solo items recurrentes (asumir que están en listas tipo='recurrente')
  AND EXISTS (
    SELECT 1 
    FROM listas_transmutaciones lt 
    WHERE lt.id = (
      SELECT lista_id 
      FROM items_transmutaciones it 
      WHERE it.item_ref = cis.item_ref
    )
    AND lt.tipo = 'recurrente'
  )
ORDER BY cis.updated_at DESC
LIMIT 100;  -- Limitar resultados para no saturar


-- ============================================================================
-- QUERY 2: Anti-estado 1 - Reset sin evento
-- ============================================================================
-- Detecta estados que indican reset (effective_since NOT NULL, last_cleaned_at NULL, clean_count=0)
-- pero NO tienen evento reset correspondiente
-- ============================================================================

SELECT 
  cis.student_id AS student_uuid,
  cis.item_ref,
  'RESET_SIN_EVENTO_SHARED' AS tipo_inconsistencia,
  cis.shared_effective_since,
  cis.shared_last_cleaned_at,
  cis.shared_clean_count,
  'shared_effective_since IS NOT NULL pero no existe evento reset' AS descripcion
FROM cleaning_item_state cis
WHERE cis.product_key = 'pde'
  AND cis.domain_type = 'transmutation'
  AND cis.shared_effective_since IS NOT NULL
  AND cis.shared_last_cleaned_at IS NULL
  AND cis.shared_clean_count = 0
  AND NOT EXISTS (
    SELECT 1 
    FROM cleaning_events ce 
    WHERE ce.student_id = cis.student_id 
      AND ce.item_ref = cis.item_ref 
      AND ce.clean_layer = 'shared' 
      AND ce.action_type = 'reset'
  )
ORDER BY cis.shared_effective_since DESC;


-- ============================================================================
-- QUERY 3: Anti-estado 2 - Evento reset sin actualización de estado
-- ============================================================================
-- Detecta eventos reset que existen pero el estado NO está actualizado correctamente
-- ============================================================================

SELECT 
  ce.student_id AS student_uuid,
  ce.item_ref,
  'EVENTO_RESET_SIN_ACTUALIZACION_SHARED' AS tipo_inconsistencia,
  ce.created_at AS evento_reset_at,
  cis.shared_effective_since AS estado_effective_since,
  cis.shared_last_cleaned_at AS estado_last_cleaned_at,
  cis.shared_clean_count AS estado_clean_count,
  CASE 
    WHEN cis.shared_effective_since IS NULL THEN 'effective_since NO actualizado'
    WHEN cis.shared_effective_since < ce.created_at THEN 'effective_since anterior al evento'
    WHEN cis.shared_last_cleaned_at IS NOT NULL THEN 'last_cleaned_at NO es NULL (debería ser NULL)'
    WHEN cis.shared_clean_count != 0 THEN 'clean_count NO es 0 (debería ser 0)'
    ELSE 'OK'
  END AS descripcion
FROM cleaning_events ce
LEFT JOIN cleaning_item_state cis ON (
  ce.student_id = cis.student_id 
  AND ce.item_ref = cis.item_ref 
  AND ce.product_key = cis.product_key 
  AND ce.domain_type = cis.domain_type
)
WHERE ce.action_type = 'reset'
  AND ce.clean_layer = 'shared'
  AND ce.product_key = 'pde'
  AND ce.domain_type = 'transmutation'
  AND (
    cis.shared_effective_since IS NULL
    OR cis.shared_effective_since < ce.created_at
    OR cis.shared_last_cleaned_at IS NOT NULL
    OR cis.shared_clean_count != 0
  )
ORDER BY ce.created_at DESC;


-- ============================================================================
-- QUERY 4: Anti-estado 3 - Fecha futura
-- ============================================================================
-- Detecta effective_since en el futuro (imposible)
-- ============================================================================

SELECT 
  cis.student_id AS student_uuid,
  cis.item_ref,
  'FECHA_FUTURA_SHARED' AS tipo_inconsistencia,
  cis.shared_effective_since,
  NOW() AS ahora,
  cis.shared_effective_since - NOW() AS diferencia
FROM cleaning_item_state cis
WHERE cis.product_key = 'pde'
  AND cis.domain_type = 'transmutation'
  AND cis.shared_effective_since > NOW()
ORDER BY cis.shared_effective_since DESC;


-- ============================================================================
-- QUERY 5: Anti-estado 4 - Contradicción clean_count / last_cleaned_at
-- ============================================================================
-- Detecta contradicciones lógicas entre clean_count y last_cleaned_at
-- ============================================================================

SELECT 
  cis.student_id AS student_uuid,
  cis.item_ref,
  'CONTRADICCION_CLEAN_COUNT_SHARED' AS tipo_inconsistencia,
  cis.shared_clean_count,
  cis.shared_last_cleaned_at,
  CASE 
    WHEN cis.shared_clean_count = 0 AND cis.shared_last_cleaned_at IS NOT NULL 
      THEN 'clean_count=0 pero last_cleaned_at NOT NULL'
    WHEN cis.shared_clean_count > 0 AND cis.shared_last_cleaned_at IS NULL 
      THEN 'clean_count>0 pero last_cleaned_at NULL'
    ELSE 'OK'
  END AS descripcion
FROM cleaning_item_state cis
WHERE cis.product_key = 'pde'
  AND cis.domain_type = 'transmutation'
  AND (
    (cis.shared_clean_count = 0 AND cis.shared_last_cleaned_at IS NOT NULL)
    OR (cis.shared_clean_count > 0 AND cis.shared_last_cleaned_at IS NULL)
  )
ORDER BY cis.updated_at DESC;


-- ============================================================================
-- QUERY 6: Anti-estado 5 - Reset antiguo sin limpieza post-reset
-- ============================================================================
-- Detecta resets ejecutados hace >7 días pero nunca se limpió post-reset
-- (puede indicar que el reset quedó "encallado")
-- ============================================================================

SELECT 
  cis.student_id AS student_uuid,
  cis.item_ref,
  'RESET_ANTIGUO_SIN_LIMPIEZA_SHARED' AS tipo_inconsistencia,
  cis.shared_effective_since AS reset_at,
  NOW() - cis.shared_effective_since AS dias_desde_reset,
  (SELECT COUNT(*) 
   FROM cleaning_events ce 
   WHERE ce.student_id = cis.student_id 
     AND ce.item_ref = cis.item_ref 
     AND ce.clean_layer = 'shared' 
     AND ce.action_type = 'mark_clean'
     AND ce.created_at > cis.shared_effective_since
  ) AS limpiezas_post_reset
FROM cleaning_item_state cis
WHERE cis.product_key = 'pde'
  AND cis.domain_type = 'transmutation'
  AND cis.shared_effective_since IS NOT NULL
  AND cis.shared_last_cleaned_at IS NULL
  AND cis.shared_clean_count = 0
  AND NOW() - cis.shared_effective_since > INTERVAL '7 days'  -- Más de 7 días sin limpieza
  AND NOT EXISTS (
    SELECT 1 
    FROM cleaning_events ce 
    WHERE ce.student_id = cis.student_id 
      AND ce.item_ref = cis.item_ref 
      AND ce.clean_layer = 'shared' 
      AND ce.action_type = 'mark_clean'
      AND ce.created_at > cis.shared_effective_since
  )
ORDER BY cis.shared_effective_since ASC;


-- ============================================================================
-- QUERY 7: Resets duplicados el mismo día
-- ============================================================================
-- Detecta múltiples intentos de reset el mismo día (mismo execution_key)
-- Puede indicar resets parciales o fallos
-- ============================================================================

SELECT 
  ce1.student_id AS student_uuid,
  ce1.item_ref,
  ce1.execution_key,
  ce1.clean_layer,
  COUNT(*) AS intentos_reset,
  MIN(ce1.created_at) AS primer_intento,
  MAX(ce1.created_at) AS ultimo_intento,
  -- Verificar si el estado está actualizado
  CASE 
    WHEN ce1.clean_layer = 'shared' AND cis.shared_effective_since IS NULL THEN 'NO ACTUALIZADO'
    WHEN ce1.clean_layer = 'shared' AND cis.shared_effective_since < MAX(ce1.created_at) THEN 'ACTUALIZADO ANTES DEL ÚLTIMO INTENTO'
    WHEN ce1.clean_layer = 'pde' AND cis.pde_effective_since IS NULL THEN 'NO ACTUALIZADO'
    WHEN ce1.clean_layer = 'pde' AND cis.pde_effective_since < MAX(ce1.created_at) THEN 'ACTUALIZADO ANTES DEL ÚLTIMO INTENTO'
    ELSE 'OK'
  END AS estado_coherencia
FROM cleaning_events ce1
LEFT JOIN cleaning_item_state cis ON (
  ce1.student_id = cis.student_id 
  AND ce1.item_ref = cis.item_ref 
  AND ce1.product_key = cis.product_key 
  AND ce1.domain_type = cis.domain_type
)
WHERE ce1.action_type = 'reset'
  AND ce1.product_key = 'pde'
  AND ce1.domain_type = 'transmutation'
GROUP BY ce1.student_id, ce1.item_ref, ce1.execution_key, ce1.clean_layer, 
         cis.shared_effective_since, cis.pde_effective_since
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;


-- ============================================================================
-- QUERY 8: Reset ALL omitidos (eventos del día actual con estado inconsistente)
-- ============================================================================
-- Detecta estudiantes que deberían resetearse pero fueron omitidos por idempotencia
-- (tienen execution_key del día actual pero estado no actualizado)
-- ============================================================================

SELECT 
  ce.student_id AS student_uuid,
  ce.item_ref,
  ce.clean_layer,
  ce.execution_key,
  ce.created_at AS evento_created_at,
  cis.shared_effective_since AS estado_effective_since,
  cis.shared_last_cleaned_at AS estado_last_cleaned_at,
  cis.shared_clean_count AS estado_clean_count,
  CASE 
    WHEN cis.shared_effective_since IS NULL THEN 'ESTADO NO ACTUALIZADO'
    WHEN cis.shared_effective_since < ce.created_at THEN 'ESTADO ANTERIOR AL EVENTO'
    WHEN ce.clean_layer = 'shared' AND cis.shared_last_cleaned_at IS NOT NULL THEN 'last_cleaned_at NO es NULL'
    WHEN ce.clean_layer = 'shared' AND cis.shared_clean_count != 0 THEN 'clean_count NO es 0'
    WHEN ce.clean_layer = 'pde' AND cis.pde_last_cleaned_at IS NOT NULL THEN 'pde_last_cleaned_at NO es NULL'
    WHEN ce.clean_layer = 'pde' AND cis.pde_clean_count != 0 THEN 'pde_clean_count NO es 0'
    ELSE 'OK'
  END AS motivo_inconsistencia
FROM cleaning_events ce
LEFT JOIN cleaning_item_state cis ON (
  ce.student_id = cis.student_id 
  AND ce.item_ref = cis.item_ref 
  AND ce.product_key = cis.product_key 
  AND ce.domain_type = cis.domain_type
)
WHERE ce.action_type = 'reset'
  AND ce.product_key = 'pde'
  AND ce.domain_type = 'transmutation'
  AND ce.execution_key LIKE 'reset:%'  -- Solo resets
  AND ce.created_at >= CURRENT_DATE  -- Eventos de hoy
  AND (
    cis.shared_effective_since IS NULL
    OR (ce.clean_layer = 'shared' AND (
      cis.shared_effective_since < ce.created_at
      OR cis.shared_last_cleaned_at IS NOT NULL
      OR cis.shared_clean_count != 0
    ))
    OR (ce.clean_layer = 'pde' AND (
      cis.pde_effective_since IS NULL
      OR cis.pde_effective_since < ce.created_at
      OR cis.pde_last_cleaned_at IS NOT NULL
      OR cis.pde_clean_count != 0
    ))
  )
ORDER BY ce.created_at DESC;


-- ============================================================================
-- RESUMEN: Contar inconsistencias por tipo
-- ============================================================================
-- Ejecutar después de las queries anteriores para obtener resumen
-- ============================================================================

SELECT 
  'RESET_SIN_EVENTO_SHARED' AS tipo,
  COUNT(*) AS cantidad
FROM cleaning_item_state cis
WHERE cis.product_key = 'pde'
  AND cis.domain_type = 'transmutation'
  AND cis.shared_effective_since IS NOT NULL
  AND cis.shared_last_cleaned_at IS NULL
  AND cis.shared_clean_count = 0
  AND NOT EXISTS (
    SELECT 1 
    FROM cleaning_events ce 
    WHERE ce.student_id = cis.student_id 
      AND ce.item_ref = cis.item_ref 
      AND ce.clean_layer = 'shared' 
      AND ce.action_type = 'reset'
  )

UNION ALL

SELECT 
  'EVENTO_RESET_SIN_ACTUALIZACION_SHARED' AS tipo,
  COUNT(*) AS cantidad
FROM cleaning_events ce
LEFT JOIN cleaning_item_state cis ON (
  ce.student_id = cis.student_id 
  AND ce.item_ref = cis.item_ref 
  AND ce.product_key = cis.product_key 
  AND ce.domain_type = cis.domain_type
)
WHERE ce.action_type = 'reset'
  AND ce.clean_layer = 'shared'
  AND ce.product_key = 'pde'
  AND ce.domain_type = 'transmutation'
  AND (
    cis.shared_effective_since IS NULL
    OR cis.shared_effective_since < ce.created_at
    OR cis.shared_last_cleaned_at IS NOT NULL
    OR cis.shared_clean_count != 0
  )

UNION ALL

SELECT 
  'FECHA_FUTURA_SHARED' AS tipo,
  COUNT(*) AS cantidad
FROM cleaning_item_state cis
WHERE cis.product_key = 'pde'
  AND cis.domain_type = 'transmutation'
  AND cis.shared_effective_since > NOW()

UNION ALL

SELECT 
  'CONTRADICCION_CLEAN_COUNT_SHARED' AS tipo,
  COUNT(*) AS cantidad
FROM cleaning_item_state cis
WHERE cis.product_key = 'pde'
  AND cis.domain_type = 'transmutation'
  AND (
    (cis.shared_clean_count = 0 AND cis.shared_last_cleaned_at IS NOT NULL)
    OR (cis.shared_clean_count > 0 AND cis.shared_last_cleaned_at IS NULL)
  )

UNION ALL

SELECT 
  'RESET_ANTIGUO_SIN_LIMPIEZA_SHARED' AS tipo,
  COUNT(*) AS cantidad
FROM cleaning_item_state cis
WHERE cis.product_key = 'pde'
  AND cis.domain_type = 'transmutation'
  AND cis.shared_effective_since IS NOT NULL
  AND cis.shared_last_cleaned_at IS NULL
  AND cis.shared_clean_count = 0
  AND NOW() - cis.shared_effective_since > INTERVAL '7 days'
  AND NOT EXISTS (
    SELECT 1 
    FROM cleaning_events ce 
    WHERE ce.student_id = cis.student_id 
      AND ce.item_ref = cis.item_ref 
      AND ce.clean_layer = 'shared' 
      AND ce.action_type = 'mark_clean'
      AND ce.created_at > cis.shared_effective_since
  )

ORDER BY cantidad DESC;
