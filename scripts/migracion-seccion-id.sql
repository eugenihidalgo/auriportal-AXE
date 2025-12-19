-- Script SQL para crear la columna seccion_id en aspectos_energeticos
-- Ejecutar como usuario con permisos de administrador (postgres o superusuario)

-- Verificar si la columna existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'aspectos_energeticos' 
      AND column_name = 'seccion_id'
  ) THEN
    -- Crear la columna
    ALTER TABLE aspectos_energeticos 
    ADD COLUMN seccion_id INTEGER REFERENCES secciones_limpieza(id) ON DELETE SET NULL;
    
    -- Crear índice
    CREATE INDEX IF NOT EXISTS idx_aspectos_energeticos_seccion 
    ON aspectos_energeticos(seccion_id);
    
    RAISE NOTICE 'Columna seccion_id creada exitosamente';
  ELSE
    RAISE NOTICE 'La columna seccion_id ya existe';
  END IF;
END $$;
























