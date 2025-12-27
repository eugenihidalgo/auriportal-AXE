#!/usr/bin/env node
/**
 * Script para eliminar DEFINITIVAMENTE todos los paquetes legacy
 * 
 * CRITERIOS DE LEGACY:
 * - Paquetes sin package_key (NULL o vacío)
 * - Paquetes con definition NULL o inválido
 * - Paquete específico: limpiezas_energeticas_diarias
 * 
 * ⚠️ NO soft-delete. DELETE REAL.
 */

import { query } from '../database/pg.js';
import { initPostgreSQL } from '../database/pg.js';

async function main() {
  console.log('🚀 Iniciando borrado DEFINITIVO de paquetes legacy...\n');
  
  // Inicializar PostgreSQL
  try {
    initPostgreSQL();
    console.log('✅ Conexión a PostgreSQL establecida\n');
  } catch (error) {
    console.error('❌ Error conectando a PostgreSQL:', error);
    process.exit(1);
  }

  // PASO 1: Identificar paquetes legacy
  console.log('📋 PASO 1: Identificando paquetes legacy...');
  let legacyPackages = [];
  
  try {
    // Paquetes sin package_key o con package_key vacío
    const noKeyResult = await query(`
      SELECT id, package_key, name, status, created_at, deleted_at 
      FROM pde_packages 
      WHERE package_key IS NULL 
         OR TRIM(package_key) = ''
         OR package_key = 'limpiezas_energeticas_diarias'
    `);
    
    legacyPackages = noKeyResult.rows;
    
    // Paquetes con definition NULL o inválido
    const noDefinitionResult = await query(`
      SELECT id, package_key, name, status, created_at, deleted_at 
      FROM pde_packages 
      WHERE definition IS NULL
         OR definition::text = 'null'
         OR definition::text = '{}'
    `);
    
    // Combinar resultados (sin duplicados)
    const allLegacy = [...legacyPackages, ...noDefinitionResult.rows];
    const uniqueLegacy = Array.from(
      new Map(allLegacy.map(p => [p.id, p])).values()
    );
    
    legacyPackages = uniqueLegacy;
    
    if (legacyPackages.length === 0) {
      console.log('✅ No se encontraron paquetes legacy.');
      console.log('   La base de datos está limpia.\n');
      process.exit(0);
    }
    
    console.log(`⚠️  Se encontraron ${legacyPackages.length} paquete(s) legacy:`);
    legacyPackages.forEach((pkg, idx) => {
      console.log(`   ${idx + 1}. ID: ${pkg.id}`);
      console.log(`      Key: ${pkg.package_key || '(NULL o vacío)'}`);
      console.log(`      Name: ${pkg.name || '(sin nombre)'}`);
      console.log(`      Status: ${pkg.status || '(sin status)'}`);
      console.log(`      Created: ${pkg.created_at || '(sin fecha)'}`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ Error identificando paquetes legacy:', error);
    process.exit(1);
  }

  // PASO 2: Crear backup
  console.log('💾 PASO 2: Creando backup de la tabla pde_packages...');
  try {
    // Eliminar backup anterior si existe
    await query('DROP TABLE IF EXISTS pde_packages_backup_before_legacy_delete');
    
    // Crear nuevo backup
    await query(`
      CREATE TABLE pde_packages_backup_before_legacy_delete AS
      SELECT * FROM pde_packages
    `);

    // Verificar backup
    const backupCheck = await query(
      'SELECT COUNT(*) as total FROM pde_packages_backup_before_legacy_delete'
    );
    
    console.log(`✅ Backup creado exitosamente`);
    console.log(`   Total de registros en backup: ${backupCheck.rows[0].total}\n`);
  } catch (error) {
    console.error('❌ Error creando backup:', error);
    process.exit(1);
  }

  // PASO 3: BORRADO DEFINITIVO
  console.log('🗑️  PASO 3: Ejecutando DELETE definitivo...');
  try {
    const packageIds = legacyPackages.map(p => p.id);
    
    // Eliminar drafts relacionados primero (si existen)
    try {
      await query(`
        DELETE FROM pde_package_drafts 
        WHERE package_id = ANY($1::uuid[])
      `, [packageIds]);
      console.log('   ✅ Drafts relacionados eliminados');
    } catch (err) {
      // Si la tabla no existe o hay error, continuar
      console.log('   ⚠️  No se pudieron eliminar drafts (tabla puede no existir)');
    }
    
    // Eliminar versiones relacionadas (si existen)
    try {
      await query(`
        DELETE FROM pde_package_versions 
        WHERE package_id = ANY($1::uuid[])
      `, [packageIds]);
      console.log('   ✅ Versiones relacionadas eliminadas');
    } catch (err) {
      // Si la tabla no existe o hay error, continuar
      console.log('   ⚠️  No se pudieron eliminar versiones (tabla puede no existir)');
    }
    
    // DELETE definitivo de paquetes
    const deleteResult = await query(
      `DELETE FROM pde_packages 
       WHERE id = ANY($1::uuid[])
         OR package_key IS NULL 
         OR TRIM(package_key) = ''
         OR package_key = 'limpiezas_energeticas_diarias'
         OR definition IS NULL
         OR definition::text = 'null'
         OR definition::text = '{}'`,
      [packageIds]
    );
    
    console.log(`✅ DELETE ejecutado`);
    console.log(`   Filas eliminadas: ${deleteResult.rowCount}\n`);
  } catch (error) {
    console.error('❌ Error ejecutando DELETE:', error);
    console.error('⚠️  El backup está disponible en: pde_packages_backup_before_legacy_delete');
    process.exit(1);
  }

  // PASO 4: Verificar que se eliminaron
  console.log('🔍 PASO 4: Verificando que los paquetes fueron eliminados...');
  try {
    const verifyResult = await query(`
      SELECT COUNT(*) as total 
      FROM pde_packages 
      WHERE package_key IS NULL 
         OR TRIM(package_key) = ''
         OR package_key = 'limpiezas_energeticas_diarias'
         OR definition IS NULL
         OR definition::text = 'null'
         OR definition::text = '{}'
    `);

    if (parseInt(verifyResult.rows[0].total) === 0) {
      console.log('✅ VERIFICACIÓN EXITOSA: No quedan paquetes legacy en la base de datos');
      console.log('   El borrado fue completado correctamente.\n');
    } else {
      console.error(`❌ ERROR: Aún existen ${verifyResult.rows[0].total} paquete(s) legacy`);
      console.error('   Esto no debería ocurrir. Revisar la base de datos.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error verificando borrado:', error);
    process.exit(1);
  }

  console.log('🎉 BORRADO DEFINITIVO COMPLETADO EXITOSAMENTE');
  console.log('\n📝 Próximos pasos:');
  console.log('   1. Verificar en /admin/api/packages que los paquetes legacy no aparecen');
  console.log('   2. Recargar el admin panel (hard refresh)');
  console.log('   3. Hacer commit del cambio');
  console.log('\n💾 Backup disponible en: pde_packages_backup_before_legacy_delete');
  
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});








