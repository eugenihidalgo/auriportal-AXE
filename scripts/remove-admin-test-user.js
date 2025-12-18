// scripts/remove-admin-test-user.js
// Script para eliminar el usuario admin de prueba creado por create-admin-test-user.js
// 
// USO: node scripts/remove-admin-test-user.js
//
// Este script elimina el usuario admin de prueba de PostgreSQL.
// Solo elimina usuarios con email admin-test@auriportal.local

import { query, initPostgreSQL } from '../database/pg.js';

const TEST_USER_EMAIL = 'admin-test@auriportal.local';

/**
 * Elimina el usuario admin de prueba
 */
async function removeTestUser() {
  try {
    // Inicializar PostgreSQL
    initPostgreSQL();
    
    // Verificar si el usuario existe
    const result = await query(
      'SELECT id, email, notes FROM admin_users WHERE email = $1',
      [TEST_USER_EMAIL.toLowerCase().trim()]
    );
    
    if (result.rows.length === 0) {
      console.log(`⚠️  Usuario ${TEST_USER_EMAIL} no existe. No hay nada que eliminar.`);
      process.exit(0);
    }
    
    const user = result.rows[0];
    
    // Verificar que es el usuario de prueba (por seguridad)
    if (!user.notes || !user.notes.includes('Admin de pruebas para Antigravity')) {
      console.log('⚠️  El usuario existe pero no parece ser el usuario de prueba.');
      console.log('   Por seguridad, este script solo elimina usuarios marcados como "Admin de pruebas para Antigravity".');
      console.log(`   Email encontrado: ${user.email}`);
      console.log(`   Notas: ${user.notes || '(sin notas)'}`);
      process.exit(1);
    }
    
    // Eliminar el usuario
    console.log(`🗑️  Eliminando usuario admin de prueba: ${TEST_USER_EMAIL}`);
    await query(
      'DELETE FROM admin_users WHERE email = $1',
      [TEST_USER_EMAIL.toLowerCase().trim()]
    );
    
    console.log('✅ Usuario admin de prueba eliminado exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error eliminando usuario admin de prueba:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

// Ejecutar
removeTestUser();




