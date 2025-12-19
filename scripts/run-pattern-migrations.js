// scripts/run-pattern-migrations.js
// Script para ejecutar migraciones del sistema de patrones (AUTO-2B)

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
    console.log('🔄 Ejecutando migraciones del sistema de patrones (AUTO-2B)...\n');

    // Inicializar PostgreSQL
    initPostgreSQL();

    // Lista de migraciones a ejecutar
    const migrations = [
      'v4.12.0-create-pattern-definitions.sql',
      'v4.12.1-create-student-patterns.sql'
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
    console.log('   1. Verificar que los patrones iniciales existen:');
    console.log('      SELECT * FROM pattern_definitions;');
    console.log('   2. Verificar que se pueden evaluar patrones:');
    console.log('      SELECT * FROM student_patterns ORDER BY last_evaluated DESC LIMIT 10;');
    console.log('   3. Los patrones se evaluarán automáticamente tras recalcular signal_aggregates\n');
  } catch (error) {
    console.error('❌ Error ejecutando migraciones:', error);
    process.exit(1);
  }
}

runMigrations();












