// scripts/apply-fix-calculate-days-migration.js
// Script para aplicar migración v5.55.1 (fix calculate_days_since_clean)

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query, initPostgreSQL } from '../database/pg.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function applyMigration() {
  try {
    console.log('🔄 Aplicando migración v5.55.1 (fix calculate_days_since_clean)...\n');

    initPostgreSQL();

    const migrationFile = 'v5.55.1-fix-calculate-days-since-clean-timestamptz.sql';
    const migrationPath = join(projectRoot, 'database', 'migrations', migrationFile);
    
    console.log(`📄 Leyendo migración: ${migrationFile}...`);
    const sql = readFileSync(migrationPath, 'utf-8');
    
    console.log(`📄 Ejecutando migración...`);
    await query(sql);
    
    console.log(`✅ Migración ${migrationFile} aplicada correctamente\n`);
    console.log('📋 Resumen:');
    console.log('   - Función calculate_days_since_clean actualizada para aceptar TIMESTAMPTZ');
    console.log('   - Sobrecarga creada para TIMESTAMP (compatibilidad con lugares)');
    console.log('   - Proyectos ahora pueden usar la función correctamente\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error aplicando migración:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

applyMigration();
