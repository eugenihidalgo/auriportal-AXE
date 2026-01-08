#!/usr/bin/env node

/**
 * Verificación de estructura DB para Cleaning Engine v1
 * 
 * Verifica:
 * - Existencia de tablas cleaning_events y cleaning_item_state
 * - Columnas requeridas
 * - Índices y constraints
 * - Foreign keys
 */

import 'dotenv/config';
import { query, initPostgreSQL } from '../database/pg.js';

async function verifyTable(tableName, expectedColumns, expectedIndexes = []) {
  console.log(`\n📋 Verificando tabla: ${tableName}`);
  
  // Verificar existencia
  const result = await query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    )`,
    [tableName]
  );
  
  if (!result.rows[0].exists) {
    console.error(`  ❌ Tabla ${tableName} no existe`);
    return false;
  }
  
  console.log(`  ✅ Tabla ${tableName} existe`);
  
  // Verificar columnas
  const columnsResult = await query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' 
     AND table_name = $1`,
    [tableName]
  );
  
  const columnNames = columnsResult.rows.map(c => c.column_name);
  const missingColumns = expectedColumns.filter(col => !columnNames.includes(col));
  
  if (missingColumns.length > 0) {
    console.error(`  ❌ Columnas faltantes: ${missingColumns.join(', ')}`);
    return false;
  }
  
  console.log(`  ✅ Todas las columnas requeridas existen (${expectedColumns.length})`);
  
  // Verificar índices
  const indexesResult = await query(
    `SELECT indexname 
     FROM pg_indexes 
     WHERE schemaname = 'public' 
     AND tablename = $1`,
    [tableName]
  );
  
  const indexNames = indexesResult.rows.map(idx => idx.indexname);
  const foundIndexes = expectedIndexes.filter(idx => 
    indexNames.some(name => name.includes(idx))
  );
  console.log(`  ✅ Índices encontrados: ${foundIndexes.length}/${expectedIndexes.length}`);
  
  return true;
}

async function verifyConstraints() {
  console.log(`\n🔒 Verificando constraints`);
  
  // Verificar unique index en cleaning_events (usando pg_indexes)
  const uniqueIndexResult = await query(
    `SELECT indexname 
     FROM pg_indexes 
     WHERE schemaname = 'public' 
     AND tablename = 'cleaning_events'
     AND indexname = 'idx_cleaning_events_execution_student'`
  );
  
  if (uniqueIndexResult.rows.length > 0) {
    console.log(`  ✅ Unique index en cleaning_events(execution_key, student_id) existe`);
  } else {
    console.error(`  ❌ Unique index en cleaning_events(execution_key, student_id) no encontrado`);
    return false;
  }
  
  // Verificar foreign key a alumnos (tabla legacy)
  const fkResult = await query(
    `SELECT conname 
     FROM pg_constraint 
     WHERE conrelid = 'cleaning_events'::regclass 
     AND contype = 'f'
     AND confrelid = 'alumnos'::regclass`
  );
  
  if (fkResult.rows.length > 0) {
    console.log(`  ✅ Foreign key cleaning_events -> alumnos existe`);
  } else {
    console.error(`  ❌ Foreign key cleaning_events -> alumnos no encontrado`);
    return false;
  }
  
  return true;
}

async function main() {
  console.log('[VERIFY][CleaningEngine] ════════════════════════════════════════');
  console.log('[VERIFY][CleaningEngine] Verificando Cleaning Engine v1 - Estructura DB');
  console.log('[VERIFY][CleaningEngine] ════════════════════════════════════════\n');
  
  try {
    await initPostgreSQL();
    console.log('[VERIFY][CleaningEngine] ✅ PostgreSQL conectado\n');
  } catch (err) {
    console.error('[VERIFY][CleaningEngine] ❌ Error al conectar PostgreSQL:', err.message);
    process.exit(1);
  }
  
  const cleaningEventsColumns = [
    'id', 'created_at', 'trace_id', 'execution_key', 'student_id',
    'product_key', 'domain_type', 'item_ref', 'clean_layer', 'item_kind',
    'action_type', 'delta_completed', 'set_remaining', 'actor_type',
    'actor_ref', 'surface_key', 'meta'
  ];
  
  const cleaningEventsIndexes = [
    'idx_cleaning_events_execution_student',
    'idx_cleaning_events_student_item',
    'idx_cleaning_events_item_layer',
    'idx_cleaning_events_trace'
  ];
  
  const cleaningItemStateColumns = [
    'student_id', 'product_key', 'domain_type', 'item_ref',
    'shared_last_cleaned_at', 'pde_last_cleaned_at',
    'shared_clean_count', 'pde_clean_count',
    'shared_completed', 'shared_remaining', 'pde_completed',
    'meta', 'created_at', 'updated_at'
  ];
  
  const cleaningItemStateIndexes = [
    'idx_cleaning_item_state_item_ref'
  ];
  
  const eventsOk = await verifyTable('cleaning_events', cleaningEventsColumns, cleaningEventsIndexes);
  const stateOk = await verifyTable('cleaning_item_state', cleaningItemStateColumns, cleaningItemStateIndexes);
  const constraintsOk = await verifyConstraints();
  
  if (eventsOk && stateOk && constraintsOk) {
    console.log('\n[VERIFY][CleaningEngine] ✅ Verificación DB completada exitosamente');
    process.exit(0);
  } else {
    console.error('\n[VERIFY][CleaningEngine] ❌ Verificación DB falló');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
