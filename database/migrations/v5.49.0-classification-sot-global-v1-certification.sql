-- Migración v5.49.0: Certificación CLASSIFICATION SOT GLOBAL v1
-- Fecha: 2025-01-02
-- Descripción: Certifica pde_classification_terms como Source of Truth Global
--              para classifications (categories y subtypes), alineado con TAG SOT GLOBAL v1
--
-- ESTATUTO CONSTITUCIONAL:
-- pde_classification_terms es el ÚNICO Source of Truth para:
-- - tags (type='tag') - Ya certificado en v5.48.0
-- - categories (type='key') - Certificado en esta migración
-- - subtypes (type='subkey') - Certificado en esta migración
--
-- REGLAS ABSOLUTAS:
-- 1. PostgreSQL es el único SOT
-- 2. Solo MASTER puede crear/modificar/deprecar
-- 3. Nunca se borran (solo deprecated)
-- 4. Toda relación puede emitir señales
-- 5. Normalización automática (lowercase + sin acentos)

DO $$
BEGIN
    -- Asegurar que la columna status existe (ya debería existir por v5.48.0, pero fail-safe)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pde_classification_terms' AND column_name = 'status'
    ) THEN
        ALTER TABLE pde_classification_terms ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
        CREATE INDEX IF NOT EXISTS idx_classification_terms_status 
            ON pde_classification_terms(status);
        COMMENT ON COLUMN pde_classification_terms.status IS 
            'Estado del término: active | deprecated (SOT GLOBAL v1)';
    END IF;

    -- Asegurar que todos los términos existentes tienen status='active' si es NULL
    UPDATE pde_classification_terms 
    SET status = 'active' 
    WHERE status IS NULL;

    -- Asegurar constraint CHECK para status
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'check_classification_terms_status'
        AND table_name = 'pde_classification_terms'
    ) THEN
        ALTER TABLE pde_classification_terms 
        ADD CONSTRAINT check_classification_terms_status 
        CHECK (status IN ('active', 'deprecated'));
    END IF;

    -- Asegurar constraint CHECK para type (incluye 'tag', 'key', 'subkey')
    -- NOTA: 'key' = category, 'subkey' = subtype (nomenclatura histórica mantenida)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'check_classification_terms_type'
        AND table_name = 'pde_classification_terms'
    ) THEN
        ALTER TABLE pde_classification_terms 
        ADD CONSTRAINT check_classification_terms_type 
        CHECK (type IN ('tag', 'key', 'subkey'));
    END IF;

    -- Índice compuesto para búsquedas rápidas por type + status
    CREATE INDEX IF NOT EXISTS idx_classification_terms_type_status 
        ON pde_classification_terms(type, status);
    
    COMMENT ON INDEX idx_classification_terms_type_status IS 
        'Índice para búsquedas rápidas por tipo y estado (SOT GLOBAL v1)';

    -- Comentario constitucional en la tabla
    COMMENT ON TABLE pde_classification_terms IS 
        'Source of Truth Global v1 para tags (type=tag), categories (type=key) y subtypes (type=subkey). 
         Gobernado exclusivamente por dominio MASTER. 
         Nunca se borran físicamente (solo deprecated). 
         Normalización automática garantizada.';
END
$$;

-- Verificación post-migración
DO $$
DECLARE
    null_status_count INTEGER;
    invalid_status_count INTEGER;
    invalid_type_count INTEGER;
BEGIN
    -- Verificar que no hay status NULL
    SELECT COUNT(*) INTO null_status_count
    FROM pde_classification_terms
    WHERE status IS NULL;
    
    IF null_status_count > 0 THEN
        RAISE EXCEPTION 'Migración fallida: % términos tienen status NULL', null_status_count;
    END IF;

    -- Verificar que no hay status inválidos
    SELECT COUNT(*) INTO invalid_status_count
    FROM pde_classification_terms
    WHERE status NOT IN ('active', 'deprecated');
    
    IF invalid_status_count > 0 THEN
        RAISE EXCEPTION 'Migración fallida: % términos tienen status inválido', invalid_status_count;
    END IF;

    -- Verificar que no hay type inválidos
    SELECT COUNT(*) INTO invalid_type_count
    FROM pde_classification_terms
    WHERE type NOT IN ('tag', 'key', 'subkey');
    
    IF invalid_type_count > 0 THEN
        RAISE EXCEPTION 'Migración fallida: % términos tienen type inválido', invalid_type_count;
    END IF;

    RAISE NOTICE 'Migración v5.49.0 completada: CLASSIFICATION SOT GLOBAL v1 certificado';
END
$$;
