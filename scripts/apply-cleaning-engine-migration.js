// scripts/apply-cleaning-engine-migration.js
// Aplica la migración SQL del Cleaning Engine v1 usando la conexión del servidor

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query, getPool, initPostgreSQL } from '../database/pg.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function applyMigration() {
  try {
    console.log('[Migration] ════════════════════════════════════════');
    console.log('[Migration] Aplicando migración v5.59.0-cleaning-engine-v1.sql...');
    console.log('[Migration] ════════════════════════════════════════\n');
    
    // Inicializar PostgreSQL
    await initPostgreSQL();
    console.log('[Migration] ✅ PostgreSQL conectado\n');
    
    // Leer archivo SQL
    const sqlPath = join(__dirname, '..', 'database', 'migrations', 'v5.59.0-cleaning-engine-v1.sql');
    const sql = readFileSync(sqlPath, 'utf8');
    
    // Ejecutar SQL (ejecutar todo junto, PostgreSQL maneja transacciones)
    const pool = getPool();
    await pool.query(sql);
    
    console.log('[Migration] ✅ Migración aplicada exitosamente');
    return true;
  } catch (error) {
    console.error('[Migration] ❌ Error aplicando migración:', error.message);
    console.error('[Migration] Stack:', error.stack);
    throw error;
  }
}

// Ejecutar
applyMigration()
  .then(() => {
    console.log('[Migration] Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Migration] Proceso falló:', error);
    process.exit(1);
  });
