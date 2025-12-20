#!/usr/bin/env node
/**
 * Script para eliminar definitivamente el paquete legacy:
 * package_key = 'limpiezas_energeticas_diarias'
 * 
 * Este script:
 * 1. Verifica que el paquete existe
 * 2. Crea un backup de la tabla completa
 * 3. Ejecuta el DELETE
 * 4. Verifica que se eliminó correctamente
 */

import { query } from '../database/pg.js';
import { initPostgreSQL } from '../database/pg.js';

const PACKAGE_KEY = 'limpiezas_energeticas_diarias';

async function main() {
  console.log('🚀 Iniciando borrado definitivo del paquete legacy...\n');
  
  // Inicializar PostgreSQL
  try {
    initPostgreSQL();
    console.log('✅ Conexión a PostgreSQL establecida\n');
  } catch (error) {
    console.error('❌ Error conectando a PostgreSQL:', error);
    process.exit(1);
  }

  // PASO 1: Verificar que el paquete existe
  console.log('📋 PASO 1: Verificando existencia del paquete...');
  try {
    const checkResult = await query(
      `SELECT id, package_key, name, status, created_at, deleted_at 
       FROM pde_packages 
       WHERE package_key = $1`,
      [PACKAGE_KEY]
    );

    if (checkResult.rows.length === 0) {
      console.log('⚠️  El paquete NO existe en la base de datos.');
      console.log('✅ No hay nada que borrar. Script finalizado.');
      process.exit(0);
    }

    console.log(`✅ Paquete encontrado:`);
    console.log(`   ID: ${checkResult.rows[0].id}`);
    console.log(`   Key: ${checkResult.rows[0].package_key}`);
    console.log(`   Name: ${checkResult.rows[0].name}`);
    console.log(`   Status: ${checkResult.rows[0].status}`);
    console.log(`   Created: ${checkResult.rows[0].created_at}`);
    console.log(`   Deleted: ${checkResult.rows[0].deleted_at || 'NULL'}\n`);
  } catch (error) {
    console.error('❌ Error verificando paquete:', error);
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
    const deleteResult = await query(
      `DELETE FROM pde_packages WHERE package_key = $1`,
      [PACKAGE_KEY]
    );
    
    console.log(`✅ DELETE ejecutado`);
    console.log(`   Filas eliminadas: ${deleteResult.rowCount}\n`);
  } catch (error) {
    console.error('❌ Error ejecutando DELETE:', error);
    console.error('⚠️  El backup está disponible en: pde_packages_backup_before_legacy_delete');
    process.exit(1);
  }

  // PASO 4: Verificar que se eliminó
  console.log('🔍 PASO 4: Verificando que el paquete fue eliminado...');
  try {
    const verifyResult = await query(
      `SELECT id, package_key, name, status 
       FROM pde_packages 
       WHERE package_key = $1`,
      [PACKAGE_KEY]
    );

    if (verifyResult.rows.length === 0) {
      console.log('✅ VERIFICACIÓN EXITOSA: El paquete NO existe en la base de datos');
      console.log('   El borrado fue completado correctamente.\n');
    } else {
      console.error('❌ ERROR: El paquete AÚN existe después del DELETE');
      console.error('   Esto no debería ocurrir. Revisar la base de datos.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error verificando borrado:', error);
    process.exit(1);
  }

  console.log('🎉 BORRADO DEFINITIVO COMPLETADO EXITOSAMENTE');
  console.log('\n📝 Próximos pasos:');
  console.log('   1. Verificar en /admin/api/packages que el paquete no aparece');
  console.log('   2. Recargar el admin panel (hard refresh)');
  console.log('   3. Hacer commit del cambio');
  console.log('\n💾 Backup disponible en: pde_packages_backup_before_legacy_delete');
  
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});

