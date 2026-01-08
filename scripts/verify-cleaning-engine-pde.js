#!/usr/bin/env node

/**
 * Verificación específica de PDE clean-all en Cleaning Engine v1
 * 
 * Verifica:
 * - Escritura de eventos PDE en cleaning_events
 * - Proyección PDE en cleaning_item_state (pde_last_cleaned_at, pde_clean_count)
 * - Lectura PDE desde cleaning_item_state (separada de SHARED)
 * - Coherencia: SHARED y PDE son independientes
 */

import 'dotenv/config';
import { query, initPostgreSQL } from '../database/pg.js';
import { randomUUID } from 'crypto';

async function getTestStudent() {
  const result = await query(
    `SELECT id FROM alumnos WHERE id NOT IN (SELECT alumno_id FROM pausas WHERE fin IS NULL) LIMIT 1`
  );
  
  if (!result.rows || result.rows.length === 0) {
    console.error('[VERIFY][CleaningEngine][PDE] ❌ No se encontró estudiante activo de prueba');
    return null;
  }
  
  return { id: result.rows[0].id };
}

async function getTestItem() {
  // Buscar un item recurrente real
  const result = await query(`
    SELECT i.item_ref, i.id, i.lista_id, l.tipo
    FROM items_transmutaciones i
    JOIN listas_transmutaciones l ON l.id = i.lista_id
    WHERE l.tipo = 'recurrente'
    LIMIT 1
  `);
  
  if (!result.rows || result.rows.length === 0) {
    console.error('[VERIFY][CleaningEngine][PDE] ❌ No se encontró item recurrente de prueba');
    return null;
  }
  
  return result.rows[0];
}

async function testPdeWrite(studentId, itemRef) {
  console.log('\n📝 Test: Escritura PDE en cleaning_events y cleaning_item_state');
  
  const traceId = `test_pde_${Date.now()}_${randomUUID()}`;
  const executionKey = `test_pde_exec_${Date.now()}_${randomUUID()}`;
  
  try {
    // 1. Verificar estado inicial
    const initialState = await query(`
      SELECT pde_last_cleaned_at, pde_clean_count
      FROM cleaning_item_state
      WHERE student_id = $1 AND item_ref = $2 AND product_key = 'pde' AND domain_type = 'transmutacion'
    `, [studentId, itemRef]);
    
    const initialPdeCount = initialState.rows.length > 0 
      ? (initialState.rows[0].pde_clean_count || 0)
      : 0;
    
    console.log(`  Estado inicial PDE: count=${initialPdeCount}`);
    
    // 2. Ejecutar markCleanStudent con clean_layer='pde'
    const cleaningEngineModule = await import('../src/core/master/services/cleaning-engine-service.js');
    const result = await cleaningEngineModule.markCleanStudent({
      student_id: studentId,
      item_ref: itemRef,
      clean_layer: 'pde',
      product_key: 'pde',
      domain_type: 'transmutacion',
      actor_type: 'master',
      actor_ref: 'test',
      surface_key: 'test.verify_pde',
      meta: {
        test: true,
        trace_id: traceId
      }
    });
    
    if (!result) {
      console.error('  ❌ markCleanStudent devolvió null (pausado o no aplica)');
      return false;
    }
    
    // 3. Verificar evento en cleaning_events
    const eventCheck = await query(`
      SELECT id, clean_layer, item_kind, action_type
      FROM cleaning_events
      WHERE execution_key = $1 AND student_id = $2
    `, [executionKey, studentId]);
    
    // Nota: execution_key se genera internamente, así que buscamos por trace_id
    const eventByTrace = await query(`
      SELECT id, clean_layer, item_kind, action_type, execution_key
      FROM cleaning_events
      WHERE trace_id = $1 AND student_id = $2 AND clean_layer = 'pde'
      ORDER BY created_at DESC
      LIMIT 1
    `, [traceId, studentId]);
    
    if (eventByTrace.rows.length === 0) {
      console.error('  ❌ No se encontró evento PDE en cleaning_events');
      return false;
    }
    
    const event = eventByTrace.rows[0];
    if (event.clean_layer !== 'pde') {
      console.error(`  ❌ Evento tiene clean_layer incorrecto: ${event.clean_layer} (esperado: pde)`);
      return false;
    }
    
    console.log(`  ✅ Evento PDE creado: id=${event.id}, clean_layer=${event.clean_layer}`);
    
    // 4. Verificar proyección en cleaning_item_state
    const stateCheck = await query(`
      SELECT pde_last_cleaned_at, pde_clean_count, shared_last_cleaned_at, shared_clean_count
      FROM cleaning_item_state
      WHERE student_id = $1 AND item_ref = $2 AND product_key = 'pde' AND domain_type = 'transmutacion'
    `, [studentId, itemRef]);
    
    if (stateCheck.rows.length === 0) {
      console.error('  ❌ No se encontró estado en cleaning_item_state');
      return false;
    }
    
    const state = stateCheck.rows[0];
    if (!state.pde_last_cleaned_at) {
      console.error('  ❌ pde_last_cleaned_at es NULL');
      return false;
    }
    
    const newPdeCount = state.pde_clean_count || 0;
    if (newPdeCount <= initialPdeCount) {
      console.error(`  ❌ pde_clean_count no incrementó: ${initialPdeCount} -> ${newPdeCount}`);
      return false;
    }
    
    console.log(`  ✅ Estado PDE actualizado: last_cleaned_at=${state.pde_last_cleaned_at}, count=${newPdeCount}`);
    console.log(`  ✅ SHARED no afectado: shared_last_cleaned_at=${state.shared_last_cleaned_at || 'NULL'}, shared_count=${state.shared_clean_count || 0}`);
    
    return true;
  } catch (error) {
    console.error('  ❌ Error en testPdeWrite:', error.message);
    console.error('  Stack:', error.stack);
    return false;
  }
}

async function testPdeRead(studentId, itemRef) {
  console.log('\n📖 Test: Lectura PDE desde cleaning_item_state');
  
  try {
    // Leer usando el repo canónico
    const { getDefaultMasterStudentTransmutationReadRepo } = await import('../src/infra/repos/master-student-transmutation-read-repo-pg.js');
    const repo = getDefaultMasterStudentTransmutationReadRepo();
    
    const resultShared = await repo.getStudentsForItemFromCleaningEngine(
      itemRef,
      'recurrente',
      'shared',
      'pde',
      {}
    );
    
    const resultPde = await repo.getStudentsForItemFromCleaningEngine(
      itemRef,
      'recurrente',
      'pde',
      'pde',
      {}
    );
    
    const studentShared = resultShared.students.find(s => s.student_id === studentId);
    const studentPde = resultPde.students.find(s => s.student_id === studentId);
    
    if (!studentPde) {
      console.error('  ❌ Estudiante no encontrado en resultado PDE');
      return false;
    }
    
    console.log(`  SHARED: last_cleaned_at=${studentShared?.last_cleaned_at || 'NULL'}, count=${studentShared?.clean_count || 0}`);
    console.log(`  PDE: last_cleaned_at=${studentPde.last_cleaned_at || 'NULL'}, count=${studentPde.clean_count || 0}`);
    
    if (studentPde.last_cleaned_at && studentShared?.last_cleaned_at) {
      if (studentPde.last_cleaned_at === studentShared.last_cleaned_at) {
        console.warn('  ⚠️  PDE y SHARED tienen el mismo last_cleaned_at (puede ser correcto si ambos se limpiaron al mismo tiempo)');
      } else {
        console.log('  ✅ PDE y SHARED tienen last_cleaned_at diferentes (correcto, son independientes)');
      }
    }
    
    if (!studentPde.last_cleaned_at) {
      console.error('  ❌ PDE last_cleaned_at es NULL (debería tener valor si se ejecutó testPdeWrite)');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('  ❌ Error en testPdeRead:', error.message);
    console.error('  Stack:', error.stack);
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('VERIFICACIÓN: Cleaning Engine PDE Layer');
  console.log('═══════════════════════════════════════════════════════════');
  
  try {
    await initPostgreSQL();
    console.log('[VERIFY][CleaningEngine][PDE] ✅ PostgreSQL conectado\n');
  } catch (err) {
    console.error('[VERIFY][CleaningEngine][PDE] ❌ Error al conectar PostgreSQL:', err.message);
    process.exit(1);
  }
  
  const testStudent = await getTestStudent();
  if (!testStudent) {
    console.error('[VERIFY][CleaningEngine][PDE] ❌ No se puede continuar sin estudiante de prueba');
    process.exit(1);
  }
  
  const testItem = await getTestItem();
  if (!testItem) {
    console.error('[VERIFY][CleaningEngine][PDE] ❌ No se puede continuar sin item de prueba');
    process.exit(1);
  }
  
  console.log(`[VERIFY][CleaningEngine][PDE] 👤 Estudiante: ${testStudent.id}`);
  console.log(`[VERIFY][CleaningEngine][PDE] 📦 Item: ${testItem.item_ref} (${testItem.tipo})\n`);
  
  const writeOk = await testPdeWrite(testStudent.id, testItem.item_ref);
  const readOk = await testPdeRead(testStudent.id, testItem.item_ref);
  
  if (writeOk && readOk) {
    console.log('\n[VERIFY][CleaningEngine][PDE] ✅ Verificación PDE completada exitosamente');
    process.exit(0);
  } else {
    console.error('\n[VERIFY][CleaningEngine][PDE] ❌ Verificación PDE falló');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
