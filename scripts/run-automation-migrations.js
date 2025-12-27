// scripts/run-automation-migrations.js
// Script para ejecutar migraciones del Motor de Automatizaciones (AUTO-1)

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query } from '../database/pg.js';
import { initPostgreSQL } from '../database/pg.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function runMigrations() {
  try {
    console.log('🔄 Ejecutando migraciones del Motor de Automatizaciones (AUTO-1)...\n');

    // Inicializar PostgreSQL
    initPostgreSQL();

    // Lista de migraciones a ejecutar
    const migrations = [
      'v4.9.0-create-automation-engine.sql',
      'v4.9.1-insert-test-rule.sql'
    ];

    for (const migrationFile of migrations) {
      const migrationPath = join(projectRoot, 'database', 'migrations', migrationFile);
      
      try {
        console.log(`📄 Ejecutando: ${migrationFile}...`);
        const sql = readFileSync(migrationPath, 'utf-8');
        
        // Ejecutar migración
        await query(sql);
        
        console.log(`✅ ${migrationFile} ejecutado correctamente\n`);
      } catch (error) {
        // Si la migración ya existe o hay un error, continuar
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          console.log(`⚠️  ${migrationFile} ya existe, omitiendo...\n`);
        } else {
          console.error(`❌ Error ejecutando ${migrationFile}:`, error.message);
          throw error;
        }
      }
    }

    console.log('✅ Todas las migraciones ejecutadas correctamente');
    console.log('\n📋 Próximos pasos:');
    console.log('   1. Verificar que la regla de prueba existe:');
    console.log('      SELECT * FROM automation_rules WHERE key = \'welcome_on_pause_end\';');
    console.log('   2. Finalizar una pausa manualmente para probar la automatización');
    console.log('   3. Verificar que se creó un automation_run:');
    console.log('      SELECT * FROM automation_runs ORDER BY created_at DESC LIMIT 5;');
    console.log('   4. Verificar que se ejecutaron los jobs:');
    console.log('      SELECT * FROM automation_jobs ORDER BY created_at DESC LIMIT 10;');
    console.log('   5. Verificar eventos de auditoría:');
    console.log('      SELECT * FROM audit_events WHERE action LIKE \'automation_%\' ORDER BY created_at DESC LIMIT 10;\n');
  } catch (error) {
    console.error('❌ Error ejecutando migraciones:', error);
    process.exit(1);
  }
}

runMigrations();




















