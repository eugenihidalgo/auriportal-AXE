// scripts/apply-history-system-migration.js
// Aplica la migración SQL del Sistema de Historial v1 usando la conexión del servidor

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query, getPool, initPostgreSQL } from '../database/pg.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function applyMigration() {
  try {
    console.log('[Migration] ════════════════════════════════════════');
    console.log('[Migration] Aplicando migración v5.72.0-history-system-v1.sql...');
    console.log('[Migration] ════════════════════════════════════════\n');
    
    // Inicializar PostgreSQL
    await initPostgreSQL();
    console.log('[Migration] ✅ PostgreSQL conectado\n');
    
    // Leer archivo SQL
    const sqlPath = join(__dirname, '..', 'database', 'migrations', 'v5.72.0-history-system-v1.sql');
    const sql = readFileSync(sqlPath, 'utf8');
    
    // Ejecutar SQL (ejecutar todo junto, PostgreSQL maneja transacciones)
    const pool = getPool();
    await pool.query(sql);
    
    console.log('[Migration] ✅ Migración aplicada exitosamente');
    
    // Verificar que las tablas existen
    const verifyResult = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('history_entries', 'history_aggregation_runs', 'history_entry_links')
      ORDER BY table_name
    `);
    
    console.log('\n[Migration] Verificación de tablas:');
    const tables = verifyResult.rows.map(r => r.table_name);
    if (tables.includes('history_entries') && tables.includes('history_aggregation_runs') && tables.includes('history_entry_links')) {
      console.log('[Migration] ✅ Todas las tablas existen correctamente');
      console.log('[Migration]   - history_entries');
      console.log('[Migration]   - history_aggregation_runs');
      console.log('[Migration]   - history_entry_links');
    } else {
      throw new Error(`Faltan tablas: esperadas 3, encontradas ${tables.length}`);
    }
    
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
    console.log('\n[Migration] Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Migration] Proceso falló:', error);
    process.exit(1);
  });
