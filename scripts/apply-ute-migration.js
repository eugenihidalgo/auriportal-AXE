// scripts/apply-ute-migration.js
// Script para aplicar migración UTE CORE v1

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query, initPostgreSQL } from '../database/pg.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function applyMigration() {
  try {
    console.log('🔄 Aplicando migración UTE CORE v1 (v5.53.0)...\n');

    // Inicializar PostgreSQL
    initPostgreSQL();

    const migrationFile = 'v5.53.0-ute-core-v1.sql';
    const migrationPath = join(projectRoot, 'database', 'migrations', migrationFile);
    
    console.log(`📄 Leyendo migración: ${migrationFile}...`);
    const sql = readFileSync(migrationPath, 'utf-8');
    
    console.log(`📄 Ejecutando migración...`);
    // Ejecutar todo el SQL de una vez (PostgreSQL soporta múltiples statements)
    // Si hay error, el DO $$ block lo manejará
    try {
      await query(sql);
    } catch (error) {
      // Si el error es de sintaxis, mostrar más contexto
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
    
    // Verificar tablas creadas
    console.log('🔍 Verificando tablas creadas...');
    const tables = ['ute_definitions', 'ute_executions', 'ute_student_state', 'ute_assignments'];
    
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
    
    console.log('\n✅ Migración UTE CORE v1 completada exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error aplicando migración:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

applyMigration();
