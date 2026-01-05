-- v5.31.0: MASTER PDE Daily Item Clean Log
-- Tabla SOT para registro de limpiezas PDE diarias (append-only)
-- Diferente de student_item_state (que es estado acumulado)

CREATE TABLE IF NOT EXISTS pde_daily_item_clean_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  item_ref TEXT NOT NULL,
  cleaned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cleaned_date DATE NOT NULL, -- (cleaned_at at time zone 'Europe/Madrid')::date
  actor_type TEXT NOT NULL DEFAULT 'master' CHECK (actor_type IN ('master','student','system')),
  actor_id INTEGER NULL, -- si ctx tiene admin id
  trace_id TEXT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Idempotencia: un alumno solo puede tener un log por item por día
  CONSTRAINT unique_student_item_date UNIQUE(student_id, item_ref, cleaned_date)
);

-- Índices para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_pde_daily_clean_date ON pde_daily_item_clean_log(cleaned_date);
CREATE INDEX IF NOT EXISTS idx_pde_daily_clean_item ON pde_daily_item_clean_log(item_ref, cleaned_date);
CREATE INDEX IF NOT EXISTS idx_pde_daily_clean_student ON pde_daily_item_clean_log(student_id, cleaned_date);

-- Comentarios
COMMENT ON TABLE pde_daily_item_clean_log IS 'Log append-only de limpiezas PDE diarias por item (SOT separado de student_item_state)';
COMMENT ON COLUMN pde_daily_item_clean_log.cleaned_date IS 'Fecha en timezone Europe/Madrid (para agrupación diaria)';
COMMENT ON COLUMN pde_daily_item_clean_log.actor_type IS 'Tipo de actor que ejecutó la limpieza: master, student, system';
COMMENT ON COLUMN pde_daily_item_clean_log.meta IS 'Metadatos adicionales (JSONB flexible)';
