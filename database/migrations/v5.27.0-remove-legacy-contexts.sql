-- ============================================================================
-- Migración v5.27.0: Eliminar Contextos Legacy (Sistema Canónico Único)
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Elimina definitivamente todos los contextos legacy (incompletos
--              o sin contrato canónico). Solo permanecen contextos canónicos.
--
-- PRINCIPIOS:
-- 1. Sin compatibilidad legacy: elimina definitivamente
-- 2. Definición formal de "legacy": scope, type, kind o allowed_values NULL
-- 3. Elimina mappings huérfanos primero para mantener integridad
-- 4. Verificación post-migración obligatoria
-- ============================================================================

-- ============================================================================
-- DEFINICIÓN FORMAL DE "CONTEXTO LEGACY"
-- ============================================================================
-- Un contexto se considera legacy si cumple cualquiera de estas condiciones:
--   1. scope IS NULL
--   2. type IS NULL
--   3. kind IS NULL
--   4. type = 'enum' AND allowed_values IS NULL

-- ============================================================================
-- FASE 1: ELIMINAR MAPPINGS HUÉRFANOS DE CONTEXTOS LEGACY
-- ============================================================================
-- Primero eliminamos los mappings que referencian contextos legacy para
-- mantener la integridad referencial (aunque no hay FK física, hay semántica)

DELETE FROM context_mappings
WHERE context_key IN (
  SELECT context_key
  FROM pde_contexts
  WHERE deleted_at IS NULL
    AND (
      scope IS NULL
      OR type IS NULL
      OR kind IS NULL
      OR (type = 'enum' AND allowed_values IS NULL)
    )
);

-- ============================================================================
-- FASE 2: ELIMINAR CONTEXTOS LEGACY
-- ============================================================================
-- Eliminamos definitivamente (soft delete con deleted_at) los contextos que
-- no cumplen el contrato canónico

UPDATE pde_contexts
SET deleted_at = NOW()
WHERE deleted_at IS NULL
  AND (
    scope IS NULL
    OR type IS NULL
    OR kind IS NULL
    OR (type = 'enum' AND allowed_values IS NULL)
  );

-- ============================================================================
-- VERIFICACIÓN OBLIGATORIA POST-MIGRACIÓN
-- ============================================================================
-- Esta consulta debe devolver 0 filas después de la migración.
-- Si devuelve filas, significa que quedan contextos legacy que deben revisarse.
--
-- NOTA: Ejecutar manualmente después de aplicar la migración para verificar:
--
-- SELECT 
--   id,
--   context_key,
--   label,
--   scope,
--   type,
--   kind,
--   allowed_values,
--   CASE
--     WHEN scope IS NULL THEN 'scope NULL'
--     WHEN type IS NULL THEN 'type NULL'
--     WHEN kind IS NULL THEN 'kind NULL'
--     WHEN (type = 'enum' AND allowed_values IS NULL) THEN 'enum sin allowed_values'
--     ELSE 'OK'
--   END AS motivo_legacy
-- FROM pde_contexts
-- WHERE deleted_at IS NULL
--   AND (
--     scope IS NULL
--     OR type IS NULL
--     OR kind IS NULL
--     OR (type = 'enum' AND allowed_values IS NULL)
--   );
--
-- RESULTADO ESPERADO: 0 filas

-- ============================================================================
-- COMENTARIOS
-- ============================================================================

COMMENT ON TABLE pde_contexts IS 'Contextos canónicos únicos (v5.27.0+). Todos los contextos deben cumplir contrato: scope, type, kind NOT NULL; si type=enum, allowed_values NOT NULL';








