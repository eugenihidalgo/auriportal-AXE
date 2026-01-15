// scripts/apply-reset-canonical-migration.js
// Aplica la migración SQL del Reset Canónico v1 usando la conexión del servidor

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query, getPool, initPostgreSQL } from '../database/pg.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function applyMigration() {
  try {
    console.log('[Migration] ════════════════════════════════════════');
    console.log('[Migration] Aplicando migración v5.73.0-reset-canonical-v1.sql...');
    console.log('[Migration] ════════════════════════════════════════\n');
    
    // Inicializar PostgreSQL
    await initPostgreSQL();
    console.log('[Migration] ✅ PostgreSQL conectado\n');
    
    // Leer archivo SQL
    const sqlPath = join(__dirname, '..', 'database', 'migrations', 'v5.73.0-reset-canonical-v1.sql');
    const sql = readFileSync(sqlPath, 'utf8');
    
    // Ejecutar SQL (ejecutar todo junto, PostgreSQL maneja transacciones)
    const pool = getPool();
    await pool.query(sql);
    
    console.log('[Migration] ✅ Migración aplicada exitosamente');
    console.log('[Migration] Columnas añadidas:');
    console.log('[Migration]   - cleaning_item_state.shared_effective_since');
    console.log('[Migration]   - cleaning_item_state.pde_effective_since');
    console.log('[Migration]   - cleaning_item_state.shared_had_history');
    console.log('[Migration]   - cleaning_item_state.pde_had_history');
    console.log('[Migration] Constraint actualizado:');
    console.log('[Migration]   - cleaning_events.action_type ahora acepta "reset"');
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
