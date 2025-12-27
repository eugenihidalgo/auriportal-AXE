#!/usr/bin/env node
/**
 * scripts/purge-legacy-packages.js
 * 
 * Script para eliminar DEFINITIVAMENTE paquetes legacy corruptos de la base de datos.
 * 
 * CRÍTICO: Este script hace DELETE REAL, no soft delete.
 * Hace backup previo de los datos a eliminar.
 */

import { query } from '../database/pg.js';
import { writeFileSync } from 'fs';
import { join } from 'path';

const PREFIX = '[PURGE-LEGACY]';

/**
 * Validar que package_key cumple el patrón canónico
 */
function isValidPackageKey(key) {
  if (!key || typeof key !== 'string') return false;
  // Patrón: solo letras minúsculas, números y guiones bajos
  return /^[a-z0-9_]+$/.test(key.trim());
}

/**
 * Validar que definition es JSON válido
 */
function isValidDefinition(def) {
  if (!def) return false;
  if (typeof def === 'object') return true;
  if (typeof def === 'string') {
    try {
      JSON.parse(def);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

async function purgeLegacyPackages() {
  console.log(`${PREFIX} Iniciando purga de paquetes legacy...`);

  try {
    // PASO 1: Hacer backup de los paquetes que se van a eliminar
    console.log(`${PREFIX} Haciendo backup de paquetes legacy...`);
    
    const backupQuery = `
      SELECT 
        id,
        package_key,
        name,
        description,
        status,
        definition,
        created_at,
        updated_at,
        deleted_at
      FROM pde_packages
      WHERE 
        package_key IS NULL 
        OR package_key = ''
        OR NOT (package_key ~ '^[a-z0-9_]+$')
        OR definition IS NULL
        OR package_key = 'limpiezas_energeticas_diarias'
    `;

    const backupResult = await query(backupQuery);
    const packagesToDelete = backupResult.rows;

    console.log(`${PREFIX} Encontrados ${packagesToDelete.length} paquetes legacy para eliminar`);

    if (packagesToDelete.length === 0) {
      console.log(`${PREFIX} ✅ No hay paquetes legacy para eliminar`);
      return;
    }

    // Guardar backup en archivo JSON
    const backupPath = join(process.cwd(), `backup-legacy-packages-${Date.now()}.json`);
    writeFileSync(backupPath, JSON.stringify(packagesToDelete, null, 2), 'utf-8');
    console.log(`${PREFIX} ✅ Backup guardado en: ${backupPath}`);

    // PASO 2: Eliminar paquetes legacy
    console.log(`${PREFIX} Eliminando paquetes legacy...`);

    const deleteQuery = `
      DELETE FROM pde_packages
      WHERE 
        package_key IS NULL 
        OR package_key = ''
        OR NOT (package_key ~ '^[a-z0-9_]+$')
        OR definition IS NULL
        OR package_key = 'limpiezas_energeticas_diarias'
      RETURNING id, package_key, name
    `;

    const deleteResult = await query(deleteQuery);
    const deletedPackages = deleteResult.rows;

    console.log(`${PREFIX} ✅ Eliminados ${deletedPackages.length} paquetes legacy:`);
    deletedPackages.forEach(pkg => {
      console.log(`  - ID: ${pkg.id}, Key: ${pkg.package_key || '(NULL)'}, Name: ${pkg.name || '(NULL)'}`);
    });

    // PASO 3: Verificar que no queden paquetes legacy
    const verifyQuery = `
      SELECT COUNT(*) as count
      FROM pde_packages
      WHERE 
        package_key IS NULL 
        OR package_key = ''
        OR NOT (package_key ~ '^[a-z0-9_]+$')
        OR definition IS NULL
        OR package_key = 'limpiezas_energeticas_diarias'
    `;

    const verifyResult = await query(verifyQuery);
    const remainingCount = parseInt(verifyResult.rows[0].count, 10);

    if (remainingCount > 0) {
      console.error(`${PREFIX} ⚠️  ADVERTENCIA: Aún quedan ${remainingCount} paquetes legacy`);
    } else {
      console.log(`${PREFIX} ✅ Verificación: No quedan paquetes legacy`);
    }

    console.log(`${PREFIX} ✅ Purga completada exitosamente`);

  } catch (error) {
    console.error(`${PREFIX} ❌ Error en purga:`, error);
    process.exit(1);
  }
}

// Ejecutar
purgeLegacyPackages()
  .then(() => {
    console.log(`${PREFIX} Script finalizado`);
    process.exit(0);
  })
  .catch(error => {
    console.error(`${PREFIX} Error fatal:`, error);
    process.exit(1);
  });








