// scripts/apply-sponsors-migration.js
// Script para aplicar migración Sistema de Apadrinados (Sponsors) v1

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query, initPostgreSQL } from '../database/pg.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function applyMigration() {
  try {
    console.log('🔄 Aplicando migración Sistema de Apadrinados (Sponsors) v1 (v5.56.0)...\n');

    // Inicializar PostgreSQL
    initPostgreSQL();

    const migrationFile = 'v5.56.0-sponsors-system-v1-targetref.sql';
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
    console.log('   - Nuevas tablas creadas:');
    console.log('     * sponsors_catalog');
    console.log('     * sponsor_student_links');
    console.log('     * sponsor_special_care');
    console.log('     * sponsor_special_care_lists');
    console.log('   - Triggers configurados');
    console.log('   - Índices creados');
    console.log('   - Ownership configurado\n');

    // Verificar tablas creadas
    console.log('🔍 Verificando tablas creadas...');
    const tables = ['sponsors_catalog', 'sponsor_student_links', 'sponsor_special_care', 'sponsor_special_care_lists'];
    for (const table of tables) {
      try {
        const result = await query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`   ✅ ${table}: ${result.rows[0].count} filas`);
      } catch (err) {
        console.error(`   ❌ ${table}: Error verificando - ${err.message}`);
      }
    }

    // Verificar constraints
    console.log('\n🔍 Verificando constraints...');
    try {
      const constraints = await query(`
        SELECT constraint_name, table_name 
        FROM information_schema.table_constraints 
        WHERE table_name IN ('sponsors_catalog', 'sponsor_student_links', 'sponsor_special_care', 'sponsor_special_care_lists')
        AND constraint_type = 'UNIQUE'
        ORDER BY table_name, constraint_name
      `);
      console.log(`   ✅ ${constraints.rows.length} constraints UNIQUE encontrados`);
      constraints.rows.forEach(c => {
        console.log(`      - ${c.table_name}.${c.constraint_name}`);
      });
    } catch (err) {
      console.error(`   ⚠️  Error verificando constraints: ${err.message}`);
    }

    console.log('\n✅ Verificación completada\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error aplicando migración:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

applyMigration();
