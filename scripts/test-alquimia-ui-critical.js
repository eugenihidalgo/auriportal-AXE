// scripts/test-alquimia-ui-critical.js
// Tests mínimos críticos para UI Alquimia (General + Alumno)

import dotenv from 'dotenv';
import { query } from '../database/pg.js';

dotenv.config();

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function test1_SeedIdempotente() {
  log('\n📋 Test 1: Seed idempotente', 'cyan');
  
  try {
    // Obtener un alumno de prueba
    const studentResult = await query('SELECT id FROM alumnos LIMIT 1');
    if (studentResult.rows.length === 0) {
      log('  ⚠️  No hay alumnos para probar', 'yellow');
      return { success: true, skipped: true };
    }
    
    const studentId = studentResult.rows[0].id;
    
    // Obtener conteo inicial de estados
    const count1 = await query(`
      SELECT COUNT(*) as count
      FROM cleaning_item_state
      WHERE student_id = $1 AND product_key = 'pde' AND domain_type = 'transmutation'
    `, [studentId]);
    
    const initialCount = parseInt(count1.rows[0].count, 10);
    
    // Ejecutar seed (simulado llamando al servicio)
    const { ensureCleaningItemStateSeedForStudent } = await import('../src/core/master/services/cleaning-state-seed-service.js');
    
    const result1 = await ensureCleaningItemStateSeedForStudent({
      student_id: studentId,
      product_key: 'pde',
      domain_type: 'transmutation'
    });
    
    // Ejecutar seed de nuevo (debe ser idempotente)
    const result2 = await ensureCleaningItemStateSeedForStudent({
      student_id: studentId,
      product_key: 'pde',
      domain_type: 'transmutation'
    });
    
    // Verificar conteo final
    const count2 = await query(`
      SELECT COUNT(*) as count
      FROM cleaning_item_state
      WHERE student_id = $1 AND product_key = 'pde' AND domain_type = 'transmutation'
    `, [studentId]);
    
    const finalCount = parseInt(count2.rows[0].count, 10);
    
    // Debe ser idempotente: el conteo no debe aumentar en la segunda ejecución
    if (result2.inserted === 0) {
      log(`  ✅ Seed idempotente: segunda ejecución no insertó nuevos registros`, 'green');
      return { success: true };
    } else {
      log(`  ❌ Seed NO idempotente: segunda ejecución insertó ${result2.inserted} registros`, 'red');
      return { success: false, error: 'Seed no idempotente' };
    }
  } catch (error) {
    log(`  ❌ Error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function test2_ArchivedItemNotInMegalist() {
  log('\n📋 Test 2: Item archivado NO aparece en megalist', 'cyan');
  
  try {
    // Buscar un item archivado
    const archivedItem = await query(`
      SELECT item_ref FROM items_transmutaciones 
      WHERE status = 'archived' 
      LIMIT 1
    `);
    
    if (archivedItem.rows.length === 0) {
      log('  ℹ️  No hay items archivados para probar', 'yellow');
      return { success: true, skipped: true };
    }
    
    const itemRef = archivedItem.rows[0].item_ref;
    
    // Obtener un alumno de prueba
    const studentResult = await query('SELECT id FROM alumnos LIMIT 1');
    if (studentResult.rows.length === 0) {
      log('  ⚠️  No hay alumnos para probar', 'yellow');
      return { success: true, skipped: true };
    }
    
    const studentId = studentResult.rows[0].id;
    
    // Ejecutar megalist service
    const { getMegalistForStudent } = await import('../src/core/master/services/alquimia-alumno-megalist-service.js');
    
    const megalist = await getMegalistForStudent({
      student_id: studentId
    });
    
    // Verificar que el item archivado NO está en la megalist
    let found = false;
    for (const list of megalist.lists || []) {
      for (const state of ['never', 'important', 'pending', 'reviewed_by_student', 'reviewed_by_master']) {
        if (list[state]) {
          for (const item of list[state]) {
            if (item.item_ref === itemRef) {
              found = true;
              break;
            }
          }
        }
        if (found) break;
      }
      if (found) break;
    }
    
    if (!found) {
      log(`  ✅ Item archivado NO aparece en megalist`, 'green');
      return { success: true };
    } else {
      log(`  ❌ Item archivado SÍ aparece en megalist (violación)`, 'red');
      return { success: false, error: 'Archived item found in megalist' };
    }
  } catch (error) {
    log(`  ❌ Error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function test3_ArchivedItemInTechnicalPanel() {
  log('\n📋 Test 3: Item archivado SÍ aparece en panel técnico histórico', 'cyan');
  
  try {
    // Buscar un item archivado que tenga eventos
    const archivedItemWithEvents = await query(`
      SELECT DISTINCT ce.item_ref
      FROM cleaning_events ce
      JOIN items_transmutaciones it ON it.item_ref = ce.item_ref
      WHERE it.status = 'archived'
        AND ce.product_key = 'pde'
        AND ce.domain_type = 'transmutation'
      LIMIT 1
    `);
    
    if (archivedItemWithEvents.rows.length === 0) {
      log('  ℹ️  No hay items archivados con eventos para probar', 'yellow');
      return { success: true, skipped: true };
    }
    
    const itemRef = archivedItemWithEvents.rows[0].item_ref;
    
    // Obtener un alumno que tenga eventos para este item
    const studentResult = await query(`
      SELECT DISTINCT ce.student_id
      FROM cleaning_events ce
      WHERE ce.item_ref = $1
      LIMIT 1
    `, [itemRef]);
    
    if (studentResult.rows.length === 0) {
      log('  ℹ️  No hay alumnos con eventos para este item', 'yellow');
      return { success: true, skipped: true };
    }
    
    const studentId = studentResult.rows[0].student_id;
    
    // Obtener historial (debe incluir eventos aunque el item esté archivado)
    const { getDefaultCleaningEventsRepo } = await import('../src/infra/repos/cleaning/cleaning-events-repo-pg.js');
    const eventsRepo = getDefaultCleaningEventsRepo();
    
    const events = await eventsRepo.listEventsForStudentItem({
      student_id: studentId,
      item_ref: itemRef,
      product_key: 'pde',
      domain_type: 'transmutation',
      limit: 10
    });
    
    if (events.length > 0) {
      log(`  ✅ Item archivado SÍ aparece en panel técnico (${events.length} eventos)`, 'green');
      return { success: true };
    } else {
      log(`  ⚠️  Item archivado no tiene eventos (no se puede verificar)`, 'yellow');
      return { success: true, skipped: true };
    }
  } catch (error) {
    log(`  ❌ Error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function test4_ReportTwoPanels() {
  log('\n📋 Test 4: Report devuelve dos paneles', 'cyan');
  
  try {
    // Obtener un alumno de prueba
    const studentResult = await query('SELECT id FROM alumnos LIMIT 1');
    if (studentResult.rows.length === 0) {
      log('  ⚠️  No hay alumnos para probar', 'yellow');
      return { success: true, skipped: true };
    }
    
    const studentId = studentResult.rows[0].id;
    
    // Ejecutar report service
    const { buildAlquimiaReport } = await import('../src/core/master/services/alquimia-report-service.js');
    
    const report = await buildAlquimiaReport({
      student_id: studentId,
      days: 30
    });
    
    // Verificar estructura
    const hasTechnicalPanel = report.technical_panel !== undefined;
    const hasHumanPanel = report.human_panel !== undefined;
    
    if (hasTechnicalPanel && hasHumanPanel) {
      log(`  ✅ Report devuelve dos paneles (technical_panel + human_panel)`, 'green');
      return { success: true };
    } else {
      log(`  ❌ Report NO devuelve dos paneles`, 'red');
      return { success: false, error: 'Missing panels' };
    }
  } catch (error) {
    log(`  ❌ Error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function test5_LevelFilterWorks() {
  log('\n📋 Test 5: Filtro por nivel funciona', 'cyan');
  
  try {
    // Obtener un alumno de prueba
    const studentResult = await query('SELECT id FROM alumnos LIMIT 1');
    if (studentResult.rows.length === 0) {
      log('  ⚠️  No hay alumnos para probar', 'yellow');
      return { success: true, skipped: true };
    }
    
    const studentId = studentResult.rows[0].id;
    
    // Obtener nivel efectivo del alumno
    const { getStudentEffectiveLevel } = await import('../src/core/master/services/cleaning-engine-service.js');
    const nivelEfectivo = await getStudentEffectiveLevel(studentId);
    
    // Ejecutar megalist con level_cap = nivel_efectivo
    const { getMegalistForStudent } = await import('../src/core/master/services/alquimia-alumno-megalist-service.js');
    
    const megalist = await getMegalistForStudent({
      student_id: studentId,
      level_cap: nivelEfectivo
    });
    
    // Verificar que ningún item tiene nivel > nivel_efectivo
    let hasItemOverLevel = false;
    for (const list of megalist.lists || []) {
      for (const state of ['never', 'important', 'pending', 'reviewed_by_student', 'reviewed_by_master']) {
        if (list[state]) {
          for (const item of list[state]) {
            if (item.item_nivel !== null && item.item_nivel !== undefined && item.item_nivel > nivelEfectivo) {
              hasItemOverLevel = true;
              log(`  ❌ Item con nivel ${item.item_nivel} > nivel_efectivo ${nivelEfectivo}`, 'red');
              break;
            }
          }
        }
        if (hasItemOverLevel) break;
      }
      if (hasItemOverLevel) break;
    }
    
    if (!hasItemOverLevel) {
      log(`  ✅ Filtro por nivel funciona: ningún item con nivel > ${nivelEfectivo}`, 'green');
      return { success: true };
    } else {
      return { success: false, error: 'Level filter not working' };
    }
  } catch (error) {
    log(`  ❌ Error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function runTests() {
  log('\n╔══════════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║          TESTS MÍNIMOS CRÍTICOS - UI ALQUIMIA                       ║', 'cyan');
  log('╚══════════════════════════════════════════════════════════════════════╝', 'cyan');
  
  const results = {
    test1: await test1_SeedIdempotente(),
    test2: await test2_ArchivedItemNotInMegalist(),
    test3: await test3_ArchivedItemInTechnicalPanel(),
    test4: await test4_ReportTwoPanels(),
    test5: await test5_LevelFilterWorks()
  };
  
  log('\n╔══════════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║                         RESUMEN DE TESTS                            ║', 'cyan');
  log('╚══════════════════════════════════════════════════════════════════════╝', 'cyan');
  
  const allSuccess = Object.values(results).every(r => r.success);
  
  const testNames = {
    test1: 'Seed idempotente',
    test2: 'Item archivado NO en megalist',
    test3: 'Item archivado SÍ en panel técnico',
    test4: 'Report devuelve dos paneles',
    test5: 'Filtro por nivel funciona'
  };
  
  Object.entries(results).forEach(([key, result]) => {
    const name = testNames[key];
    if (result.skipped) {
      log(`  ⚠️  ${name}: SKIPPED`, 'yellow');
    } else if (result.success) {
      log(`  ✅ ${name}: PASS`, 'green');
    } else {
      log(`  ❌ ${name}: FAIL (${result.error})`, 'red');
    }
  });
  
  if (allSuccess) {
    log('\n✅ TODOS LOS TESTS PASARON', 'green');
  } else {
    log('\n❌ ALGUNOS TESTS FALLARON', 'red');
  }
  
  process.exit(allSuccess ? 0 : 1);
}

runTests().catch(error => {
  log(`\n❌ Error fatal: ${error.message}`, 'red');
  console.error(error.stack);
  process.exit(1);
});
