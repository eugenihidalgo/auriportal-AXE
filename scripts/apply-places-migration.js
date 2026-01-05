// scripts/apply-places-migration.js
// Script para aplicar migración Sistema de Lugares v1

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query, initPostgreSQL } from '../database/pg.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function applyMigration() {
  try {
    console.log('🔄 Aplicando migración Sistema de Lugares v1 (v5.54.0)...\n');

    // Inicializar PostgreSQL
    initPostgreSQL();

    const migrationFile = 'v5.54.0-places-system-v1.sql';
    const migrationPath = join(projectRoot, 'database', 'migrations', migrationFile);
    
    console.log(`📄 Leyendo migración: ${migrationFile}...`);
    const sql = readFileSync(migrationPath, 'utf-8');
    
    console.log(`📄 Ejecutando migración...`);
    try {
      await query(sql);
    } catch (error) {
      if (error.position) {
        const lines = sql.split('\n');
        let charCount = 0;
        let errorLine = 0;
        for (let i = 0; i < lines.length; i++) {
          if (charCount + lines[i].length + 1 >= error.position) {
            errorLine = i + 1;
            break;
          }
          charCount += lines[i].length + 1;
        }
        console.error(`❌ Error en línea aproximada: ${errorLine}`);
        console.error(`   Contexto: ${lines.slice(Math.max(0, errorLine - 3), errorLine + 2).join('\n')}`);
      }
      throw error;
    }
    
    console.log(`✅ Migración ${migrationFile} aplicada correctamente\n`);
    console.log('📋 Resumen:');
    console.log('   - Tablas legacy eliminadas');
    console.log('   - Nuevas tablas creadas:');
    console.log('     * place_categories');
    console.log('     * places_catalog');
    console.log('     * student_place_state');
    console.log('     * student_activation_limits');
    console.log('   - Funciones de salud creadas');
    console.log('   - Triggers configurados');
    console.log('   - Datos iniciales insertados\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error aplicando migración:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

applyMigration();
