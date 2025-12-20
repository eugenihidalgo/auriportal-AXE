-- ============================================================================
-- Migración v5.27.0: Refactorizar Packages PDE de Package Prompt Context a PackageDefinition
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Refactoriza el sistema de packages para usar PackageDefinition canónico
--              en lugar de Package Prompt Context. Elimina dependencia de GPT/IA.
--
-- CAMBIOS ARQUITECTÓNICOS:
-- 1. prompt_context_json → package_definition (estructura canónica determinista)
-- 2. Elimina assembled_json (ya no se usa GPT para ensamblar)
-- 3. Añade campo version al PackageDefinition para versionado del contrato
-- 4. Mantiene compatibilidad temporal migrando datos existentes
-- ============================================================================

-- ============================================================================
-- AÑADIR CAMPO package_definition A pde_package_drafts
-- ============================================================================

-- Añadir campo package_definition (reemplazará prompt_context_json)
ALTER TABLE pde_package_drafts 
    ADD COLUMN IF NOT EXISTS package_definition JSONB;

-- Migrar datos existentes: prompt_context_json → package_definition
-- NOTA: Esta migración es temporal, después podremos eliminar prompt_context_json
UPDATE pde_package_drafts 
SET package_definition = prompt_context_json
WHERE package_definition IS NULL AND prompt_context_json IS NOT NULL;

-- ============================================================================
-- AÑADIR CAMPO package_definition A pde_package_versions
-- ============================================================================

-- Añadir campo package_definition (reemplazará prompt_context_json)
ALTER TABLE pde_package_versions 
    ADD COLUMN IF NOT EXISTS package_definition JSONB;

-- Migrar datos existentes: prompt_context_json → package_definition
UPDATE pde_package_versions 
SET package_definition = prompt_context_json
WHERE package_definition IS NULL AND prompt_context_json IS NOT NULL;

-- ============================================================================
-- ÍNDICES PARA package_definition
-- ============================================================================

-- Índices GIN para búsquedas eficientes en JSONB
CREATE INDEX IF NOT EXISTS idx_pde_package_drafts_package_definition_gin 
    ON pde_package_drafts USING GIN (package_definition);

CREATE INDEX IF NOT EXISTS idx_pde_package_versions_package_definition_gin 
    ON pde_package_versions USING GIN (package_definition);

-- ============================================================================
-- ACTUALIZAR COMENTARIOS
-- ============================================================================

COMMENT ON COLUMN pde_package_drafts.package_definition IS 
    'PackageDefinition canónico v3 (estructura determinista, sin lógica, sin GPT)';

COMMENT ON COLUMN pde_package_versions.package_definition IS 
    'PackageDefinition canónico v3 (snapshot al momento de publicación)';

-- NOTA: Mantenemos prompt_context_json y assembled_json por compatibilidad temporal
--       Se eliminarán en una migración futura después de verificar que todo funciona

