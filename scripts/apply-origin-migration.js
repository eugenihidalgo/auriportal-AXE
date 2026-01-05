// scripts/apply-origin-migration.js
// Script para aplicar migración ORIGIN CONTRACT v1

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query, initPostgreSQL } from '../database/pg.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function applyMigration() {
  try {
    console.log('🔄 Aplicando migración ORIGIN CONTRACT v1 (v5.53.1)...\n');

    // Inicializar PostgreSQL
    initPostgreSQL();

    const migrationFile = 'v5.53.1-origin-contract-v1.sql';
    const migrationPath = join(projectRoot, 'database', 'migrations', migrationFile);
    
    console.log(`📄 Leyendo migración: ${migrationFile}...`);
    const sql = readFileSync(migrationPath, 'utf-8');
    
    console.log(`📄 Ejecutando migración...`);
    await query(sql);
    
    console.log(`✅ Migración ${migrationFile} aplicada correctamente\n`);
    
    // Verificar tablas creadas
    console.log('🔍 Verificando tablas creadas...');
    const tables = ['origin_definitions', 'origin_audit_log'];
    
    for (const table of tables) {
      const result = await query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`,
        [table]
      );
      
      if (result.rows[0].exists) {
        console.log(`  ✅ Tabla ${table} existe`);
      } else {
        console.error(`  ❌ Tabla ${table} NO existe`);
        process.exit(1);
      }
    }
    
    console.log('\n✅ Migración ORIGIN CONTRACT v1 completada exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error aplicando migración:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

applyMigration();
