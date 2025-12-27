-- ============================================================================
-- Migración v5.37.0: Interactive Resources - Source of Truth Canónico
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Crea el Source of Truth canónico para Recursos Interactivos
--              que unifica videos, audios, imágenes, quizzes, experiencias
--              y juegos bajo un único modelo ontológico.
--
-- PRINCIPIOS:
-- 1. Entidad ontológica única: Todos los recursos son interactive_resources
-- 2. Diferencia por resource_type y payload, NO por tablas separadas
-- 3. PostgreSQL = única autoridad
-- 4. Soft delete con status ('active'/'archived')
-- 5. Auditoría: created_at y updated_at TIMESTAMPTZ obligatorios
-- 6. Triggers: Automatización de updated_at
-- ============================================================================

-- ============================================================================
-- 1. TABLA: interactive_resources
-- ============================================================================

CREATE TABLE IF NOT EXISTS interactive_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificación básica
  title TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('video', 'audio', 'image', 'quiz', 'experience', 'game')),
  
  -- Estado canónico
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  
  -- Contenido: payload específico por tipo
  payload JSONB NOT NULL DEFAULT '{}',
  
  -- Capacidades: funcionalidades disponibles
  capabilities JSONB NOT NULL DEFAULT '{}',
  
  -- Origen: SOT que creó este recurso
  origin JSONB NOT NULL,
  
  -- Auditoría
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para búsqueda eficiente
CREATE INDEX IF NOT EXISTS idx_interactive_resources_resource_type 
  ON interactive_resources(resource_type) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_interactive_resources_status 
  ON interactive_resources(status) 
  WHERE status = 'active';

-- Índice GIN para búsqueda en JSONB
CREATE INDEX IF NOT EXISTS idx_interactive_resources_origin_gin 
  ON interactive_resources USING GIN (origin);

CREATE INDEX IF NOT EXISTS idx_interactive_resources_payload_gin 
  ON interactive_resources USING GIN (payload);

-- Índice compuesto para búsqueda por origen
CREATE INDEX IF NOT EXISTS idx_interactive_resources_origin_type 
  ON interactive_resources((origin->>'sot'), (origin->>'entity_id'), resource_type)
  WHERE status = 'active';

-- Comentarios para documentación
COMMENT ON TABLE interactive_resources IS 'Source of Truth canónico para todos los recursos interactivos del sistema (videos, audios, imágenes, quizzes, experiencias, juegos)';
COMMENT ON COLUMN interactive_resources.id IS 'UUID único del recurso';
COMMENT ON COLUMN interactive_resources.title IS 'Título descriptivo del recurso';
COMMENT ON COLUMN interactive_resources.resource_type IS 'Tipo de recurso: video, audio, image, quiz, experience, game';
COMMENT ON COLUMN interactive_resources.status IS 'Estado canónico: active o archived (soft delete)';
COMMENT ON COLUMN interactive_resources.payload IS 'Contenido específico según resource_type. Estructura depende del tipo.';
COMMENT ON COLUMN interactive_resources.capabilities IS 'Funcionalidades disponibles (ej: {"autoplay": true, "fullscreen": true})';
COMMENT ON COLUMN interactive_resources.origin IS 'Origen del recurso: {"sot": "tecnicas-limpieza", "entity_id": "uuid"}. Identifica qué SOT creó este recurso.';
COMMENT ON COLUMN interactive_resources.created_at IS 'Fecha y hora de creación (TIMESTAMPTZ)';
COMMENT ON COLUMN interactive_resources.updated_at IS 'Fecha y hora de última actualización (TIMESTAMPTZ, actualizado por trigger)';

-- ============================================================================
-- 2. TRIGGERS: Automatización de updated_at
-- ============================================================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_interactive_resources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger
DROP TRIGGER IF EXISTS trigger_update_interactive_resources_updated_at ON interactive_resources;
CREATE TRIGGER trigger_update_interactive_resources_updated_at
  BEFORE UPDATE ON interactive_resources
  FOR EACH ROW
  EXECUTE FUNCTION update_interactive_resources_updated_at();

-- ============================================================================
-- 3. VERIFICACIÓN: Asegurar que todos los registros tienen status válido
-- ============================================================================

-- (Vacío por ahora, se ejecutará automáticamente en futuras inserciones)

-- ============================================================================
-- NOTAS IMPORTANTES:
-- ============================================================================
-- 1. Todos los recursos (videos, audios, imágenes, quizzes, etc.) son la misma
--    entidad ontológica. Solo cambia resource_type y payload.
-- 2. NO crear tablas separadas por tipo.
-- 3. El campo 'origin' identifica qué SOT creó el recurso (ej. tecnicas-limpieza).
-- 4. El campo 'payload' contiene la estructura específica según el tipo:
--    - video: {"url": "...", "duration": 120, "thumbnail": "..."}
--    - audio: {"url": "...", "duration": 300}
--    - image: {"url": "...", "alt": "..."}
--    - quiz: {"questions": [...], "passing_score": 80}
--    - experience: {"config": {...}, "steps": [...]}
--    - game: {"type": "...", "config": {...}}
-- 5. DELETE físico está PROHIBIDO. Usar UPDATE SET status='archived' siempre.
-- 6. El sistema decide dónde se guardan los archivos físicos. Esto se prepara
--    en payload pero no se implementa storage aún.
-- ============================================================================

