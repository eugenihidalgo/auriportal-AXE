-- ============================================================================
-- Migración v5.32.0: MASTER Alquimia General - Grupos de Items + Editor Inline
-- ============================================================================
-- Fecha: 2025-01-05
-- Descripción: Añade SOT de grupos de items y columna grupo en items_transmutaciones
--              para soportar editor inline y organización de items.
-- ============================================================================

-- ============================================================================
-- 1. TABLA: pde_transmutation_item_groups (SOT de grupos)
-- ============================================================================

CREATE TABLE IF NOT EXISTS pde_transmutation_item_groups (
  value TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','deprecated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_pde_transmutation_item_groups_status 
  ON pde_transmutation_item_groups(status) 
  WHERE status = 'active';

-- Función genérica para updated_at (crear si no existe)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at
DROP TRIGGER IF EXISTS pde_transmutation_item_groups_updated_at ON pde_transmutation_item_groups;
CREATE TRIGGER pde_transmutation_item_groups_updated_at
  BEFORE UPDATE ON pde_transmutation_item_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comentarios
COMMENT ON TABLE pde_transmutation_item_groups IS 'SOT de grupos de items de transmutación (gobernable, append-only)';
COMMENT ON COLUMN pde_transmutation_item_groups.value IS 'Valor único del grupo (PK)';
COMMENT ON COLUMN pde_transmutation_item_groups.status IS 'Estado: active o deprecated';

-- ============================================================================
-- 2. COLUMNA: items_transmutaciones.grupo
-- ============================================================================

-- Añadir columna grupo con FK a pde_transmutation_item_groups
ALTER TABLE items_transmutaciones
  ADD COLUMN IF NOT EXISTS grupo TEXT NULL;

-- Añadir FK constraint (si no existe)
-- Primero eliminar si existe para recrear
ALTER TABLE items_transmutaciones
  DROP CONSTRAINT IF EXISTS items_transmutaciones_grupo_fkey;

ALTER TABLE items_transmutaciones
  ADD CONSTRAINT items_transmutaciones_grupo_fkey
  FOREIGN KEY (grupo) 
  REFERENCES pde_transmutation_item_groups(value)
  ON DELETE SET NULL;

-- Índice para búsquedas por grupo
CREATE INDEX IF NOT EXISTS idx_items_transmutaciones_grupo 
  ON items_transmutaciones(grupo) 
  WHERE status = 'active';

-- Comentario
COMMENT ON COLUMN items_transmutaciones.grupo IS 'Grupo del item (FK a pde_transmutation_item_groups)';
