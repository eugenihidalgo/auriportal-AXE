// scripts/apply-projects-migration.js
// Script para aplicar migración Sistema de Proyectos v1

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query, initPostgreSQL } from '../database/pg.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function applyMigration() {
  try {
    console.log('🔄 Aplicando migración Sistema de Proyectos v1 (v5.55.0)...\n');

    // Inicializar PostgreSQL
    initPostgreSQL();

    const migrationFile = 'v5.55.0-projects-system-v1.sql';
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
    console.log('     * project_categories');
    console.log('     * projects_catalog');
    console.log('     * student_project_state');
    console.log('   - Funciones de salud reutilizadas (genéricas)');
    console.log('   - Triggers configurados');
    console.log('   - Datos iniciales insertados (6 categorías por defecto)');
    console.log('   - student_activation_limits ya soporta domain=\'projects\'\n');

    // Verificar tablas creadas
    console.log('🔍 Verificando tablas creadas...');
    const tables = ['project_categories', 'projects_catalog', 'student_project_state'];
    for (const table of tables) {
      const result = await query(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`   ✅ ${table}: ${result.rows[0].count} filas`);
    }

    // Verificar categorías por defecto
    console.log('\n🔍 Verificando categorías por defecto...');
    const categories = await query(`
      SELECT category_key, name, default_recurrence_days 
      FROM project_categories 
      WHERE deleted_at IS NULL 
      ORDER BY sort_order
    `);
    console.log(`   ✅ ${categories.rows.length} categorías encontradas:`);
    categories.rows.forEach(cat => {
      console.log(`      - ${cat.category_key}: ${cat.name} (${cat.default_recurrence_days} días)`);
    });

    console.log('\n✅ Verificación completada\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error aplicando migración:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

applyMigration();
