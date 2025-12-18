-- ============================================================================
-- Migración v5.8.0: Sistema de Frases Personalizadas por Nivel (PDE)
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Tabla para gestionar frases personalizadas como recurso PDE
--              canónico global, disponible en todo el sistema.
--
-- PRINCIPIOS:
-- 1. Recurso PDE canónico: disponible en recorridos, screen templates, AXE, navegación
-- 2. Frases organizadas por nivel (1-9)
-- 3. Soft delete obligatorio
-- 4. Múltiples frases por nivel permitidas
-- 5. Sin lógica de nivel en la tabla (solo almacenamiento)
--
-- DECISIÓN CANÓNICA v1 — FRASES:
-- - Pool permitido = niveles <= nivel_efectivo (incluido)
-- - Pool prohibido = niveles > nivel_efectivo
-- - Se incluyen frases del nivel exacto del alumno
-- - Selección RANDOM dentro del pool
-- - Si el pool está vacío → no se muestra frase
-- ============================================================================

-- ============================================================================
-- TABLA: pde_frases_personalizadas
-- ============================================================================
-- Recurso PDE canónico para frases personalizadas por nivel
-- Cada registro representa un "conjunto" de frases con múltiples frases por nivel

CREATE TABLE IF NOT EXISTS pde_frases_personalizadas (
    -- ========================================================================
    -- IDENTIFICADORES
    -- ========================================================================
    id SERIAL PRIMARY KEY,
    
    -- ========================================================================
    -- METADATOS
    -- ========================================================================
    nombre VARCHAR(200) NOT NULL,
    -- Nombre del conjunto de frases (ej: "Frases de Motivación", "Mensajes Diarios")
    
    descripcion TEXT,
    -- Descripción opcional del conjunto de frases
    
    -- ========================================================================
    -- CONTENIDO POR NIVEL
    -- ========================================================================
    frases_por_nivel JSONB NOT NULL DEFAULT '{}',
    -- Estructura: { "1": ["frase 1 nivel 1", "frase 2 nivel 1"], "2": ["frase nivel 2"], ... }
    -- Niveles del 1 al 9 (Sanación)
    -- Cada nivel puede tener múltiples frases (array de strings)
    -- Ejemplo:
    -- {
    --   "1": ["Bienvenido al nivel 1", "Comienza tu camino"],
    --   "2": ["Avanzando al nivel 2", "Sigue adelante"],
    --   "3": ["Nivel 3 alcanzado"]
    -- }
    
    -- ========================================================================
    -- SOFT DELETE
    -- ========================================================================
    deleted_at TIMESTAMPTZ NULL,
    -- Soft delete: NULL = activo, TIMESTAMP = eliminado
    
    -- ========================================================================
    -- METADATOS TEMPORALES
    -- ========================================================================
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- ÍNDICES PARA CONSULTAS RÁPIDAS
-- ============================================================================

-- Índice para búsquedas por nombre
CREATE INDEX IF NOT EXISTS idx_pde_frases_personalizadas_nombre 
    ON pde_frases_personalizadas(nombre);

-- Índice para filtrar activos (deleted_at IS NULL)
CREATE INDEX IF NOT EXISTS idx_pde_frases_personalizadas_activos 
    ON pde_frases_personalizadas(deleted_at) 
    WHERE deleted_at IS NULL;

-- Índice GIN para búsquedas en frases_por_nivel (JSONB)
CREATE INDEX IF NOT EXISTS idx_pde_frases_personalizadas_frases_gin 
    ON pde_frases_personalizadas USING GIN (frases_por_nivel);

-- Índice compuesto para listar activos ordenados
CREATE INDEX IF NOT EXISTS idx_pde_frases_personalizadas_lista 
    ON pde_frases_personalizadas(deleted_at, created_at DESC) 
    WHERE deleted_at IS NULL;

-- ============================================================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ============================================================================

COMMENT ON TABLE pde_frases_personalizadas IS 
'Recurso PDE canónico para frases personalizadas por nivel. Disponible en recorridos, screen templates, AXE y navegación.';

COMMENT ON COLUMN pde_frases_personalizadas.nombre IS 
'Nombre del conjunto de frases (ej: "Frases de Motivación", "Mensajes Diarios")';

COMMENT ON COLUMN pde_frases_personalizadas.descripcion IS 
'Descripción opcional del conjunto de frases';

COMMENT ON COLUMN pde_frases_personalizadas.frases_por_nivel IS 
'JSONB con estructura { "1": ["frase 1", "frase 2"], "2": ["frase nivel 2"], ... }. Niveles 1-9. Múltiples frases por nivel permitidas.';

COMMENT ON COLUMN pde_frases_personalizadas.deleted_at IS 
'Soft delete: NULL = activo, TIMESTAMP = eliminado';

-- ============================================================================
-- TRIGGER PARA ACTUALIZAR updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_pde_frases_personalizadas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_pde_frases_personalizadas_updated_at ON pde_frases_personalizadas;

CREATE TRIGGER trigger_update_pde_frases_personalizadas_updated_at
    BEFORE UPDATE ON pde_frases_personalizadas
    FOR EACH ROW
    EXECUTE FUNCTION update_pde_frases_personalizadas_updated_at();

-- ============================================================================
-- NOTAS DE USO
-- ============================================================================
-- 
-- EJEMPLO DE USO:
-- 
-- 1. CREAR CONJUNTO DE FRASES:
--    INSERT INTO pde_frases_personalizadas (nombre, descripcion, frases_por_nivel)
--    VALUES (
--      'Frases de Motivación',
--      'Frases motivadoras para mostrar al alumno',
--      '{
--        "1": ["Bienvenido al nivel 1", "Comienza tu camino de sanación"],
--        "2": ["Avanzando al nivel 2", "Sigue adelante con confianza"],
--        "3": ["Nivel 3 alcanzado", "Tu progreso es notable"]
--      }'::jsonb
--    );
-- 
-- 2. RESOLVER FRASE PARA ALUMNO NIVEL 2:
--    - Pool permitido: niveles 1 y 2 (niveles <= nivel_efectivo)
--    - Pool prohibido: niveles 3-9
--    - Selección RANDOM entre frases de niveles 1 y 2
--    - Si pool vacío → devolver null
-- 
-- 3. USO EN RESOLVER GLOBAL:
--    resolveFrasePersonalizada({ frasesResourceId: 1, nivelEfectivo: 2 })
--    → Devuelve string aleatorio de niveles 1 o 2, o null si no hay frases
-- 
-- IMPORTANTE:
-- - La lógica de nivel vive SOLO en el resolver global
-- - La tabla solo almacena datos, no contiene lógica
-- - Fail-open absoluto: errores devuelven null (no se muestra frase)
-- 
-- ============================================================================

