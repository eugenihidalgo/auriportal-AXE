#!/usr/bin/env node
// scripts/verify-automation-tables-v5.29.4.js
// Verifica que las tablas de automatizaciones (Fase D) existen en PostgreSQL

import 'dotenv/config';
import { query } from '../database/pg.js';

const REQUIRED_TABLES = [
  'automation_definitions',
  'automation_runs',
  'automation_run_steps',
  'automation_dedup'
];

const REQUIRED_UNIQUE_INDEXES = [
  'idx_automation_dedup_dedup_key_unique'
];

console.log('═══════════════════════════════════════════════════════════════');
console.log('🔍 VERIFICACIÓN DE TABLAS - AUTOMATION ENGINE v1 (Fase D)');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

async function verifyTables() {
  try {
    const results = {
      tables: {},
      indexes: {},
      constraints: {},
      columns: {},
      comments: {}
    };

    // 1. Verificar tablas
    console.log('🔍 Verificando tablas...');
    for (const tableName of REQUIRED_TABLES) {
      const result = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [tableName]);
      
      const exists = result.rows[0].exists;
      results.tables[tableName] = exists;
      
      if (exists) {
        console.log(`  ✅ Tabla '${tableName}' existe`);
      } else {
        console.error(`  ❌ Tabla '${tableName}' NO existe`);
      }
    }
    console.log('');

    // Verificar si todas las tablas existen
    const allTablesExist = REQUIRED_TABLES.every(table => results.tables[table]);
    if (!allTablesExist) {
      throw new Error('Una o más tablas requeridas no existen');
    }

    // 2. Verificar índices únicos
    console.log('🔍 Verificando índices únicos...');
    for (const indexName of REQUIRED_UNIQUE_INDEXES) {
      const result = await query(`
        SELECT EXISTS (
          SELECT FROM pg_indexes 
          WHERE indexname = $1
        );
      `, [indexName]);
      
      const exists = result.rows[0].exists;
      results.indexes[indexName] = exists;
      
      if (exists) {
        console.log(`  ✅ Índice único '${indexName}' existe`);
      } else {
        console.error(`  ❌ Índice único '${indexName}' NO existe`);
      }
    }
    console.log('');

    // 3. Verificar constraints
    console.log('🔍 Verificando constraints...');
    
    // FK automation_runs -> automation_definitions
    const fkResult1 = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.table_constraints
        WHERE constraint_name = 'automation_runs_automation_id_fk'
        AND table_name = 'automation_runs'
      );
    `);
    results.constraints['automation_runs_automation_id_fk'] = fkResult1.rows[0].exists;
    if (fkResult1.rows[0].exists) {
      console.log('  ✅ FK automation_runs.automation_id -> automation_definitions.id');
    } else {
      console.warn('  ⚠️  FK automation_runs.automation_id NO existe (puede ser de migración anterior)');
    }

    // FK automation_run_steps -> automation_runs
    const fkResult2 = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.table_constraints
        WHERE constraint_name = 'automation_run_steps_run_id_fk'
        AND table_name = 'automation_run_steps'
      );
    `);
    results.constraints['automation_run_steps_run_id_fk'] = fkResult2.rows[0].exists;
    if (fkResult2.rows[0].exists) {
      console.log('  ✅ FK automation_run_steps.run_id -> automation_runs.id');
    } else {
      console.warn('  ⚠️  FK automation_run_steps.run_id NO existe (puede ser de migración anterior)');
    }

    // UNIQUE constraint automation_run_steps (run_id, step_index)
    const uniqueResult = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.table_constraints
        WHERE constraint_name = 'automation_run_steps_unique_step_index'
        AND table_name = 'automation_run_steps'
      );
    `);
    results.constraints['automation_run_steps_unique_step_index'] = uniqueResult.rows[0].exists;
    if (uniqueResult.rows[0].exists) {
      console.log('  ✅ UNIQUE constraint automation_run_steps (run_id, step_index)');
    } else {
      console.warn('  ⚠️  UNIQUE constraint automation_run_steps NO existe (puede ser de migración anterior)');
    }

    console.log('');

    // 4. Verificar columnas críticas
    console.log('🔍 Verificando columnas críticas...');
    
    // automation_definitions.automation_key
    const colResult1 = await query(`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_name = 'automation_definitions'
      AND column_name = 'automation_key'
    `);
    results.columns['automation_definitions.automation_key'] = colResult1.rows.length > 0;
    if (colResult1.rows.length > 0) {
      console.log('  ✅ automation_definitions.automation_key existe');
    } else {
      throw new Error('Columna automation_key no existe');
    }

    // automation_dedup.dedup_key
    const colResult2 = await query(`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_name = 'automation_dedup'
      AND column_name = 'dedup_key'
    `);
    results.columns['automation_dedup.dedup_key'] = colResult2.rows.length > 0;
    if (colResult2.rows.length > 0) {
      console.log('  ✅ automation_dedup.dedup_key existe');
    } else {
      throw new Error('Columna dedup_key no existe');
    }

    console.log('');

    // 5. Verificar comentarios
    console.log('🔍 Verificando comentarios de tabla...');
    const commentsResult = await query(`
      SELECT 
        t.table_name,
        obj_description(c.oid, 'pg_class') as table_comment
      FROM information_schema.tables t
      JOIN pg_class c ON c.relname = t.table_name
      WHERE t.table_schema = 'public'
      AND t.table_name IN ($1, $2, $3, $4)
    `, REQUIRED_TABLES);
    
    for (const row of commentsResult.rows) {
      results.comments[row.table_name] = row.table_comment || null;
      if (row.table_comment) {
        console.log(`  ✅ Tabla '${row.table_name}' tiene comentario`);
      } else {
        console.warn(`  ⚠️  Tabla '${row.table_name}' sin comentario (no crítico)`);
      }
    }
    console.log('');

    // 6. Resumen final
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ VERIFICACIÓN COMPLETADA');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('Tablas verificadas:');
    REQUIRED_TABLES.forEach(table => {
      const status = results.tables[table] ? '✅' : '❌';
      console.log(`  ${status} ${table}`);
    });
    console.log('');
    console.log('PostgreSQL confirmado como Source of Truth para automatizaciones.');
    console.log('');

    return results;
  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('❌ ERROR EN VERIFICACIÓN');
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('');
    console.error(`Error: ${error.message}`);
    console.error('');
    throw error;
  }
}

// Ejecutar
verifyTables()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    process.exit(1);
  });










