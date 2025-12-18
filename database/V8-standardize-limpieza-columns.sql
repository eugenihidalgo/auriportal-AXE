-- V8-standardize-limpieza-columns.sql
-- Estandarizar nombres de columnas en tablas de aspectos energéticos de alumnos

-- ============================================
-- aspectos_energeticos_alumnos
-- ============================================
DO $$
BEGIN
  -- Renombrar fecha_ultima_limpieza a ultima_limpieza
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name='aspectos_energeticos_alumnos' 
             AND column_name='fecha_ultima_limpieza') THEN
    ALTER TABLE aspectos_energeticos_alumnos 
    RENAME COLUMN fecha_ultima_limpieza TO ultima_limpieza;
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_name='aspectos_energeticos_alumnos' 
                    AND column_name='ultima_limpieza') THEN
    ALTER TABLE aspectos_energeticos_alumnos 
    ADD COLUMN ultima_limpieza TIMESTAMP;
  END IF;

  -- Renombrar fecha_proxima_recomendada a proxima_limpieza
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name='aspectos_energeticos_alumnos' 
             AND column_name='fecha_proxima_recomendada') THEN
    ALTER TABLE aspectos_energeticos_alumnos 
    RENAME COLUMN fecha_proxima_recomendada TO proxima_limpieza;
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_name='aspectos_energeticos_alumnos' 
                    AND column_name='proxima_limpieza') THEN
    ALTER TABLE aspectos_energeticos_alumnos 
    ADD COLUMN proxima_limpieza TIMESTAMP;
  END IF;

  -- Asegurar que existe columna estado
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='aspectos_energeticos_alumnos' 
                 AND column_name='estado') THEN
    ALTER TABLE aspectos_energeticos_alumnos 
    ADD COLUMN estado VARCHAR(50) DEFAULT 'pendiente';
  END IF;
END $$;

-- ============================================
-- aspectos_karmicos_alumnos
-- ============================================
DO $$
BEGIN
  -- Renombrar ultima_limpieza (puede tener diferentes nombres)
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name='aspectos_karmicos_alumnos' 
             AND column_name='fecha_ultima_limpieza') THEN
    ALTER TABLE aspectos_karmicos_alumnos 
    RENAME COLUMN fecha_ultima_limpieza TO ultima_limpieza;
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_name='aspectos_karmicos_alumnos' 
                    AND column_name='ultima_limpieza') THEN
    ALTER TABLE aspectos_karmicos_alumnos 
    ADD COLUMN ultima_limpieza TIMESTAMP;
  END IF;

  -- Renombrar proxima_limpieza
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name='aspectos_karmicos_alumnos' 
             AND column_name='fecha_proxima_limpieza') THEN
    ALTER TABLE aspectos_karmicos_alumnos 
    RENAME COLUMN fecha_proxima_limpieza TO proxima_limpieza;
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_name='aspectos_karmicos_alumnos' 
                    AND column_name='proxima_limpieza') THEN
    ALTER TABLE aspectos_karmicos_alumnos 
    ADD COLUMN proxima_limpieza TIMESTAMP;
  END IF;

  -- Asegurar que existe columna estado
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='aspectos_karmicos_alumnos' 
                 AND column_name='estado') THEN
    ALTER TABLE aspectos_karmicos_alumnos 
    ADD COLUMN estado VARCHAR(50) DEFAULT 'pendiente';
  END IF;
END $$;

-- ============================================
-- aspectos_indeseables_alumnos
-- ============================================
DO $$
BEGIN
  -- Renombrar ultima_limpieza
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name='aspectos_indeseables_alumnos' 
             AND column_name='fecha_ultima_limpieza') THEN
    ALTER TABLE aspectos_indeseables_alumnos 
    RENAME COLUMN fecha_ultima_limpieza TO ultima_limpieza;
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_name='aspectos_indeseables_alumnos' 
                    AND column_name='ultima_limpieza') THEN
    ALTER TABLE aspectos_indeseables_alumnos 
    ADD COLUMN ultima_limpieza TIMESTAMP;
  END IF;

  -- Renombrar proxima_limpieza
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name='aspectos_indeseables_alumnos' 
             AND column_name='fecha_proxima_limpieza') THEN
    ALTER TABLE aspectos_indeseables_alumnos 
    RENAME COLUMN fecha_proxima_limpieza TO proxima_limpieza;
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_name='aspectos_indeseables_alumnos' 
                    AND column_name='proxima_limpieza') THEN
    ALTER TABLE aspectos_indeseables_alumnos 
    ADD COLUMN proxima_limpieza TIMESTAMP;
  END IF;

  -- Asegurar que existe columna estado
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='aspectos_indeseables_alumnos' 
                 AND column_name='estado') THEN
    ALTER TABLE aspectos_indeseables_alumnos 
    ADD COLUMN estado VARCHAR(50) DEFAULT 'pendiente';
  END IF;
END $$;

SELECT '✅ Columnas estandarizadas correctamente' AS resultado;


























