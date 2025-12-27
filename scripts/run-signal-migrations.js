// scripts/run-signal-migrations.js
// Script para ejecutar migraciones del sistema de señales (AUTO-2A)

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
    console.log('🔄 Ejecutando migraciones del sistema de señales (AUTO-2A)...\n');

    // Inicializar PostgreSQL
    initPostgreSQL();

    // Lista de migraciones a ejecutar
    const migrations = [
      'v4.11.0-create-signal-definitions.sql',
      'v4.11.1-create-post-practice-flows.sql',
      'v4.11.2-create-practice-signals.sql',
      'v4.11.3-create-signal-aggregates.sql'
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
    console.log('   1. Verificar que las señales iniciales existen:');
    console.log('      SELECT * FROM signal_definitions;');
    console.log('   2. Probar el endpoint POST /api/practicas/:practiceId/signals');
    console.log('   3. Verificar que se crearon señales:');
    console.log('      SELECT * FROM practice_signals ORDER BY created_at DESC LIMIT 10;');
    console.log('   4. Verificar agregados:');
    console.log('      SELECT * FROM signal_aggregates ORDER BY last_updated DESC LIMIT 10;\n');
  } catch (error) {
    console.error('❌ Error ejecutando migraciones:', error);
    process.exit(1);
  }
}

runMigrations();




















