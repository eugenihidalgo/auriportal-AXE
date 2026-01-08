// scripts/apply-level-gates-migration-and-flags.js
// Aplica migración v5.58.0 y activa feature flags

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query, getPool } from '../database/pg.js';
import { setFlag } from '../src/core/feature-flags/feature-flag-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function applyMigration() {
  console.log('[Migration] Aplicando migración v5.58.0-level-gates-v1...\n');
  
  try {
    const migrationPath = join(__dirname, '../database/migrations/v5.58.0-level-gates-v1.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    // Ejecutar migración
    await query(migrationSQL);
    
    console.log('✅ Migración v5.58.0 aplicada correctamente\n');
    return true;
  } catch (error) {
    if (error.message.includes('already exists') || error.message.includes('duplicate')) {
      console.log('ℹ️  Migración v5.58.0 ya aplicada (objetos existentes)\n');
      return true;
    }
    console.error('❌ Error aplicando migración:', error.message);
    throw error;
  }
}

async function activateFlags() {
  console.log('[FeatureFlags] Activando feature flags...\n');
  
  const flags = [
    { key: 'level_engine_pde_v1', name: 'Level Engine PDE v1' },
    { key: 'level_gates_v1', name: 'Level Gates v1' }
  ];
  
  for (const flag of flags) {
    try {
      console.log(`  Activando ${flag.name} (${flag.key})...`);
      const result = await setFlag(
        flag.key,
        true,
        {
          type: 'system',
          id: 'migration-script-v5.58.0'
        }
      );
      console.log(`  ✅ ${flag.name} activado\n`);
    } catch (error) {
      if (error.message.includes('already') || error.message.includes('duplicate')) {
        console.log(`  ℹ️  ${flag.name} ya estaba activado\n`);
      } else {
        console.error(`  ❌ Error activando ${flag.name}:`, error.message);
        throw error;
      }
    }
  }
}

async function main() {
  try {
    // Aplicar migración
    await applyMigration();
    
    // Activar flags
    await activateFlags();
    
    console.log('✅ Proceso completado exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en proceso:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
