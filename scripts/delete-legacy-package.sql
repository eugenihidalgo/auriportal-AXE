-- ============================================================================
-- SCRIPT: Borrado Definitivo del Paquete Legacy
-- ============================================================================
-- Paquete: limpiezas_energeticas_diarias
-- Fecha: $(date)
-- ============================================================================

-- PASO 1: Verificar que el paquete existe
SELECT 
    id, 
    package_key, 
    name, 
    status, 
    created_at, 
    deleted_at
FROM pde_packages
WHERE package_key = 'limpiezas_energeticas_diarias';

-- PASO 2: Crear backup de la tabla completa
CREATE TABLE IF NOT EXISTS pde_packages_backup_before_legacy_delete AS
SELECT * FROM pde_packages;

-- Verificar que el backup se creó correctamente
SELECT COUNT(*) as total_backup FROM pde_packages_backup_before_legacy_delete;

-- PASO 3: BORRADO DEFINITIVO
DELETE FROM pde_packages
WHERE package_key = 'limpiezas_energeticas_diarias';

-- PASO 4: Verificar que se eliminó (debe devolver 0 filas)
SELECT 
    id, 
    package_key, 
    name, 
    status
FROM pde_packages
WHERE package_key = 'limpiezas_energeticas_diarias';

-- Si la consulta anterior devuelve 0 filas, el borrado fue exitoso

