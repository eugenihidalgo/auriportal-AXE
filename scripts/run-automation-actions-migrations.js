// scripts/run-automation-actions-migrations.js
// Script para ejecutar migraciones de las Acciones Canónicas (AUTO-1B)

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query, initPostgreSQL } from '../database/pg.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function runMigrations() {
  try {
    console.log('🔄 Ejecutando migraciones de Acciones Canónicas (AUTO-1B)...\n');

    // Inicializar PostgreSQL
    initPostgreSQL();

    // Lista de migraciones a ejecutar
    const migrations = [
      'v4.10.0-create-portal-messages.sql',
      'v4.10.1-create-student-modes.sql',
      'v4.10.2-create-content-overrides.sql',
      'v4.10.3-create-master-notifications.sql'
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
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate') ||
            error.message.includes('relation') && error.message.includes('already exists')) {
          console.log(`⚠️  ${migrationFile} ya existe, omitiendo...\n`);
        } else {
          console.error(`❌ Error ejecutando ${migrationFile}:`, error.message);
          throw error;
        }
      }
    }

    console.log('✅ Todas las migraciones ejecutadas correctamente');
    console.log('\n📋 Próximos pasos:');
    console.log('   1. Verificar que las tablas se crearon correctamente:');
    console.log('      SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\' AND table_name IN (\'portal_messages\', \'student_modes\', \'content_overrides\', \'master_notifications\');');
    console.log('   2. Crear una regla de prueba que use las nuevas acciones:');
    console.log('      INSERT INTO automation_rules (key, status, trigger_type, trigger_def, actions) VALUES (\'test_auto1b\', \'on\', \'event\', \'{"event": "pause_end"}\'::jsonb, \'[{"step_key": "portal_message", "payload": {...}}, {"step_key": "mode_set", "payload": {...}}]\'::jsonb);');
    console.log('   3. Verificar que las acciones están registradas en automation-executor.js');
    console.log('   4. Probar ejecutando una automatización que use las nuevas acciones\n');
  } catch (error) {
    console.error('❌ Error ejecutando migraciones:', error);
    process.exit(1);
  }
}

runMigrations();




















