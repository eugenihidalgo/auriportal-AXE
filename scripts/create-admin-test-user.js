// scripts/create-admin-test-user.js
// Script para crear usuario admin de prueba para auditoría con Antigravity
// 
// USO: node scripts/create-admin-test-user.js
//
// Este script crea un usuario admin de prueba en PostgreSQL que puede
// loguearse como cualquier admin normal. El usuario se crea con:
// - Email: admin-test@auriportal.local
// - Password: TestAdmin123!
// - Rol: admin
// - Estado: activo

import { query, initPostgreSQL } from '../database/pg.js';
import crypto from 'crypto';

// Configuración del usuario de prueba
const TEST_USER_EMAIL = 'admin-test@auriportal.local';
const TEST_USER_PASSWORD = 'TestAdmin123!';
const TEST_USER_ROLE = 'admin';
const TEST_USER_ACTIVE = true;

/**
 * Hashea una password usando pbkdf2 (mismo método que el sistema)
 */
function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(32).toString('hex');
  }
  
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return {
    hash,
    salt
  };
}

/**
 * Crea la tabla de usuarios admin si no existe
 */
async function ensureAdminUsersTable() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        password_salt VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
      CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(active);
      CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);
    `);
    console.log('✅ Tabla admin_users verificada/creada');
  } catch (error) {
    console.error('❌ Error creando tabla admin_users:', error.message);
    throw error;
  }
}

/**
 * Verifica si el usuario ya existe
 */
async function userExists(email) {
  try {
    const result = await query(
      'SELECT id, email FROM admin_users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error('❌ Error verificando usuario:', error.message);
    throw error;
  }
}

/**
 * Crea el usuario admin de prueba
 */
async function createTestUser() {
  try {
    // Inicializar PostgreSQL
    initPostgreSQL();
    
    // Asegurar que la tabla existe
    await ensureAdminUsersTable();
    
    // Verificar si el usuario ya existe
    const exists = await userExists(TEST_USER_EMAIL);
    
    if (exists) {
      console.log(`⚠️  Usuario ${TEST_USER_EMAIL} ya existe. No se realizará ninguna acción.`);
      console.log('   Para recrear el usuario, primero ejecuta: node scripts/remove-admin-test-user.js');
      process.exit(0);
    }
    
    // Hashear la password
    console.log('🔐 Hasheando password...');
    const { hash, salt } = hashPassword(TEST_USER_PASSWORD);
    
    // Insertar el usuario
    console.log(`📝 Creando usuario admin de prueba: ${TEST_USER_EMAIL}`);
    await query(
      `INSERT INTO admin_users (email, password_hash, password_salt, role, active, notes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        TEST_USER_EMAIL.toLowerCase().trim(),
        hash,
        salt,
        TEST_USER_ROLE,
        TEST_USER_ACTIVE,
        'Admin de pruebas para Antigravity - Creado automáticamente por script'
      ]
    );
    
    console.log('✅ Usuario admin de prueba creado exitosamente');
    console.log('');
    console.log('📋 Detalles del usuario:');
    console.log(`   Email: ${TEST_USER_EMAIL}`);
    console.log(`   Password: ${TEST_USER_PASSWORD}`);
    console.log(`   Rol: ${TEST_USER_ROLE}`);
    console.log(`   Estado: ${TEST_USER_ACTIVE ? 'activo' : 'inactivo'}`);
    console.log('');
    console.log('🔐 El usuario puede loguearse en el panel admin como cualquier admin normal.');
    console.log('   El sistema verificará las credenciales contra la base de datos.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creando usuario admin de prueba:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

// Ejecutar
createTestUser();








