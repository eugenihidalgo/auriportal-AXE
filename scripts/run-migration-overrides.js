// Script temporal para ejecutar migración v5.71.0-student-overrides-v1.sql
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query, getPool } from '../database/pg.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  try {
    console.log('[MIGRATION] Iniciando migración v5.71.0-student-overrides-v1.sql...');
    
    // Leer archivo de migración
    const migrationPath = join(__dirname, '../database/migrations/v5.71.0-student-overrides-v1.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    // Ejecutar migración
    console.log('[MIGRATION] Ejecutando SQL...');
    await query(migrationSQL);
    
    console.log('[MIGRATION] ✅ Migración ejecutada correctamente');
    
    // Verificar que las tablas existen
    console.log('[MIGRATION] Verificando tablas...');
    const check1 = await query("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_overrides')");
    const check2 = await query("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_item_overrides')");
    
    if (check1.rows[0].exists && check2.rows[0].exists) {
      console.log('[MIGRATION] ✅ Tablas verificadas: student_overrides y student_item_overrides existen');
    } else {
      console.error('[MIGRATION] ❌ ERROR: Tablas no encontradas');
      process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('[MIGRATION] ❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runMigration();
