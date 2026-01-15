// scripts/diagnostico-forense-cpm-v2.js
// DIAGNÓSTICO FORENSE CPM v2 - Incoherencias entre superficies
//
// PROHIBIDO: Implementar fixes
// PROHIBIDO: Cambiar arquitectura
// PROHIBIDO: Reescribir CPM v2
//
// OBJETIVO: Identificar por qué el estado que devuelve el CPM v2 NO es coherente
// entre superficies (list-projection, flotante, megalist) para los mismos alumnos e ítems.

import { query } from '../database/pg.js';
import { computeCleaningProjection } from '../src/core/master/services/cleaning-projection-model.js';
import { getDefaultAlquimiaCatalogRepo } from '../src/infra/repos/alquimia-catalog-repo-pg.js';
import { getDefaultMasterStudentTransmutationReadRepo } from '../src/infra/repos/master-student-transmutation-read-repo-pg.js';
import { resolveItemConfigForStudent } from '../src/core/master/services/override-resolution-service.js';

/**
 * FASE 1: Selección de casos reales problemáticos
 */
async function selectProblematicCases() {
  console.log('\n========================================');
  console.log('FASE 1: SELECCIÓN DE CASOS REALES');
  console.log('========================================\n');

  // Buscar ítem RECURRENTE con múltiples alumnos
  // NOTA: El tipo viene de la lista, no del item
  const itemResult = await query(`
    SELECT 
      i.item_ref,
      l.tipo as item_kind,
      i.frecuencia_dias,
      i.veces_limpiar,
      i.nivel,
      l.id as list_id,
      l.nombre as list_nombre
    FROM items_transmutaciones i
    JOIN listas_transmutaciones l ON l.id = i.lista_id
    WHERE i.status = 'active'
      AND l.tipo = 'recurrente'
      AND EXISTS (
        SELECT 1 FROM cleaning_item_state c
        WHERE c.item_ref = i.item_ref
          AND c.product_key = 'pde'
          AND c.domain_type = 'transmutation'
        GROUP BY c.item_ref
        HAVING COUNT(DISTINCT c.student_id) >= 2
      )
    ORDER BY (
      SELECT COUNT(DISTINCT c.student_id)
      FROM cleaning_item_state c
      WHERE c.item_ref = i.item_ref
        AND c.product_key = 'pde'
        AND c.domain_type = 'transmutation'
    ) DESC
    LIMIT 1
  `);

  if (itemResult.rows.length === 0) {
    console.log('❌ No se encontraron ítems RECURRENTE con alumnos');
    return null;
  }

  const item = itemResult.rows[0];
  console.log('✅ Ítem seleccionado:');
  console.log(`   item_ref: ${item.item_ref}`);
  console.log(`   item_kind: ${item.item_kind}`);
  console.log(`   list_id: ${item.list_id}`);
  console.log(`   list_nombre: ${item.list_nombre}`);
  console.log(`   frecuencia_dias: ${item.frecuencia_dias || 7}`);
  console.log(`   nivel: ${item.nivel || 'N/A'}`);

  // Buscar alumno con estado para este ítem
  const studentResult = await query(`
    SELECT DISTINCT
      s.id as student_uuid,
      s.email,
      s.apodo,
      s.nombre_completo
    FROM students s
    JOIN cleaning_item_state c ON c.student_id = s.id
    WHERE c.item_ref = $1
      AND c.product_key = 'pde'
      AND c.domain_type = 'transmutation'
      AND s.deleted_at IS NULL
    LIMIT 1
  `, [item.item_ref]);

  if (studentResult.rows.length === 0) {
    console.log('❌ No se encontraron alumnos con estado para este ítem');
    return null;
  }

  const student = studentResult.rows[0];
  console.log('\n✅ Alumno seleccionado:');
  console.log(`   student_uuid: ${student.student_uuid}`);
  console.log(`   email: ${student.email}`);
  console.log(`   nombre: ${student.nombre_completo || student.apodo || 'N/A'}`);

  return {
    item_ref: item.item_ref,
    item_kind: item.item_kind,
    list_id: item.list_id,
    list_nombre: item.list_nombre,
    frecuencia_dias: item.frecuencia_dias || 7,
    nivel: item.nivel,
    student_uuid: student.student_uuid,
    student_email: student.email,
    view_layer: 'shared' // Por defecto, se puede cambiar
  };
}

/**
 * FASE 2: Evidencia DB (Verdad Dura)
 */
async function extractDBEvidence(caseData) {
  console.log('\n========================================');
  console.log('FASE 2: EVIDENCIA DB (VERDAD DURA)');
  console.log('========================================\n');

  // A) cleaning_item_state
  const stateResult = await query(`
    SELECT 
      shared_last_cleaned_at,
      pde_last_cleaned_at,
      shared_effective_since,
      pde_effective_since,
      shared_clean_count,
      pde_clean_count,
      shared_remaining,
      pde_remaining,
      shared_completed,
      pde_completed,
      updated_at
    FROM cleaning_item_state
    WHERE student_id = $1
      AND item_ref = $2
      AND product_key = 'pde'
      AND domain_type = 'transmutation'
  `, [caseData.student_uuid, caseData.item_ref]);

  console.log('A) cleaning_item_state:');
  if (stateResult.rows.length === 0) {
    console.log('   ⚠️  NO EXISTE registro en cleaning_item_state');
    console.log('   (Alumno nunca ha limpiado este ítem)');
  } else {
    const state = stateResult.rows[0];
    console.log('   shared_last_cleaned_at:', state.shared_last_cleaned_at);
    console.log('   pde_last_cleaned_at:', state.pde_last_cleaned_at);
    console.log('   shared_effective_since:', state.shared_effective_since);
    console.log('   pde_effective_since:', state.pde_effective_since);
    console.log('   shared_clean_count:', state.shared_clean_count || 0);
    console.log('   pde_clean_count:', state.pde_clean_count || 0);
    console.log('   shared_remaining:', state.shared_remaining);
    console.log('   pde_remaining:', state.pde_remaining);
    console.log('   shared_completed:', state.shared_completed || 0);
    console.log('   pde_completed:', state.pde_completed || 0);
    console.log('   updated_at:', state.updated_at);
  }

  // B) cleaning_events (últimos 30)
  const eventsResult = await query(`
    SELECT 
      created_at,
      action_type,
      item_kind,
      clean_layer,
      execution_key,
      actor_type,
      surface_key,
      trace_id,
      delta_completed,
      set_remaining
    FROM cleaning_events
    WHERE student_id = $1
      AND item_ref = $2
      AND product_key = 'pde'
      AND domain_type = 'transmutation'
    ORDER BY created_at DESC
    LIMIT 30
  `, [caseData.student_uuid, caseData.item_ref]);

  console.log('\nB) cleaning_events (últimos 30):');
  if (eventsResult.rows.length === 0) {
    console.log('   ⚠️  NO HAY eventos registrados');
  } else {
    console.log(`   Total eventos: ${eventsResult.rows.length}`);
    eventsResult.rows.forEach((event, idx) => {
      console.log(`\n   Evento ${idx + 1}:`);
      console.log(`     created_at: ${event.created_at}`);
      console.log(`     action_type: ${event.action_type}`);
      console.log(`     item_kind: ${event.item_kind}`);
      console.log(`     clean_layer: ${event.clean_layer}`);
      console.log(`     execution_key: ${event.execution_key}`);
      console.log(`     actor_type: ${event.actor_type}`);
      console.log(`     surface_key: ${event.surface_key}`);
      console.log(`     trace_id: ${event.trace_id}`);
      console.log(`     delta_completed: ${event.delta_completed}`);
      console.log(`     set_remaining: ${event.set_remaining}`);
    });
  }

  return {
    cleaning_state: stateResult.rows[0] || null,
    events: eventsResult.rows
  };
}

/**
 * FASE 3: Inputs al CPM v2 (simulación de cada superficie)
 */
async function simulateCPMInputs(caseData, dbEvidence) {
  console.log('\n========================================');
  console.log('FASE 3: INPUTS AL CPM v2');
  console.log('========================================\n');

  const catalogRepo = getDefaultAlquimiaCatalogRepo();
  const item = await catalogRepo.getItemByRef(caseData.item_ref);
  
  if (!item) {
    console.log('❌ Ítem no encontrado en catálogo');
    return null;
  }

  const itemConfig = {
    threshold_days: item.frecuencia_dias || 7,
    critical_multiplier: 2.0,
    required_count: item.veces_limpiar || 1
  };

  // Preparar cleaning_state desde DB
  const cleaningState = {
    shared: {
      last_cleaned_at: dbEvidence.cleaning_state?.shared_last_cleaned_at || null,
      effective_since: dbEvidence.cleaning_state?.shared_effective_since || null,
      clean_count: dbEvidence.cleaning_state?.shared_clean_count || 0,
      remaining: dbEvidence.cleaning_state?.shared_remaining || null,
      completed: dbEvidence.cleaning_state?.shared_completed || 0
    },
    pde: {
      last_cleaned_at: dbEvidence.cleaning_state?.pde_last_cleaned_at || null,
      effective_since: dbEvidence.cleaning_state?.pde_effective_since || null,
      clean_count: dbEvidence.cleaning_state?.pde_clean_count || 0,
      remaining: dbEvidence.cleaning_state?.pde_remaining || null,
      completed: dbEvidence.cleaning_state?.pde_completed || 0
    }
  };

  // 1. LIST-PROJECTION (scope='student')
  console.log('1. LIST-PROJECTION (scope=student):');
  const listProjectionInput = {
    cleaning_state: cleaningState,
    item_kind: caseData.item_kind,
    view_layer: caseData.view_layer,
    config: itemConfig
  };
  
  // Aplicar overrides si aplica
  const effectiveConfig = await resolveItemConfigForStudent(
    itemConfig,
    caseData.student_uuid,
    caseData.item_ref
  );
  listProjectionInput.config = effectiveConfig;

  console.log('   INPUT:', JSON.stringify(listProjectionInput, null, 2));
  
  const listProjectionOutput = computeCleaningProjection(listProjectionInput);
  console.log('   OUTPUT:', JSON.stringify({
    state_active: listProjectionOutput.state_active,
    visual_state_active: listProjectionOutput.visual_state_active,
    state_by_view_layer: listProjectionOutput.state_by_view_layer
  }, null, 2));

  // 2. FLOTANTE (getStudentsForItem)
  console.log('\n2. FLOTANTE (getStudentsForItem):');
  const flotanteInput = {
    cleaning_state: cleaningState,
    item_kind: caseData.item_kind,
    view_layer: caseData.view_layer,
    config: itemConfig
  };
  
  console.log('   INPUT:', JSON.stringify(flotanteInput, null, 2));
  
  const flotanteOutput = computeCleaningProjection(flotanteInput);
  console.log('   OUTPUT:', JSON.stringify({
    state_active: flotanteOutput.state_active,
    visual_state_active: flotanteOutput.visual_state_active,
    state_by_view_layer: flotanteOutput.state_by_view_layer
  }, null, 2));

  // 3. MEGALIST (si aplica)
  console.log('\n3. MEGALIST:');
  const megalistInput = {
    cleaning_state: cleaningState,
    item_kind: caseData.item_kind,
    view_layer: caseData.view_layer,
    config: itemConfig
  };
  
  // Aplicar overrides
  megalistInput.config = effectiveConfig;
  
  console.log('   INPUT:', JSON.stringify(megalistInput, null, 2));
  
  const megalistOutput = computeCleaningProjection(megalistInput);
  console.log('   OUTPUT:', JSON.stringify({
    state_active: megalistOutput.state_active,
    visual_state_active: megalistOutput.visual_state_active,
    state_by_view_layer: megalistOutput.state_by_view_layer
  }, null, 2));

  return {
    list_projection: { input: listProjectionInput, output: listProjectionOutput },
    flotante: { input: flotanteInput, output: flotanteOutput },
    megalist: { input: megalistInput, output: megalistOutput }
  };
}

/**
 * FASE 4: Comparación entre superficies
 */
function compareSurfaces(cpmResults) {
  console.log('\n========================================');
  console.log('FASE 4: COMPARACIÓN ENTRE SUPERFICIES');
  console.log('========================================\n');

  const listState = cpmResults.list_projection.output.state_active;
  const flotanteState = cpmResults.flotante.output.state_active;
  const megalistState = cpmResults.megalist.output.state_active;

  console.log('Estados devueltos:');
  console.log(`   list-projection: ${listState}`);
  console.log(`   flotante: ${flotanteState}`);
  console.log(`   megalist: ${megalistState}`);

  const allEqual = listState === flotanteState && flotanteState === megalistState;
  
  if (allEqual) {
    console.log('\n✅ Estados son IDÉNTICOS entre superficies');
  } else {
    console.log('\n❌ Estados son DIFERENTES entre superficies');
    
    // Comparar inputs
    console.log('\nComparación de INPUTS:');
    const listInput = JSON.stringify(cpmResults.list_projection.input);
    const flotanteInput = JSON.stringify(cpmResults.flotante.input);
    const megalistInput = JSON.stringify(cpmResults.megalist.input);
    
    if (listInput !== flotanteInput) {
      console.log('   ⚠️  list-projection INPUT ≠ flotante INPUT');
      console.log('   Diferencias:');
      const listObj = cpmResults.list_projection.input;
      const flotanteObj = cpmResults.flotante.input;
      
      if (JSON.stringify(listObj.config) !== JSON.stringify(flotanteObj.config)) {
        console.log('     - config difiere');
        console.log('       list-projection config:', listObj.config);
        console.log('       flotante config:', flotanteObj.config);
      }
    } else {
      console.log('   ✅ list-projection INPUT = flotante INPUT');
    }
    
    if (listInput !== megalistInput) {
      console.log('   ⚠️  list-projection INPUT ≠ megalist INPUT');
    } else {
      console.log('   ✅ list-projection INPUT = megalist INPUT');
    }
  }

  return {
    all_equal: allEqual,
    states: {
      list_projection: listState,
      flotante: flotanteState,
      megalist: megalistState
    }
  };
}

/**
 * FASE 5: Cadena de lectura (auditoría)
 */
async function auditReadChain(caseData, dbEvidence) {
  console.log('\n========================================');
  console.log('FASE 5: CADENA DE LECTURA');
  console.log('========================================\n');

  const repo = getDefaultMasterStudentTransmutationReadRepo();
  
  // Simular lectura desde repositorio
  const repoResult = await repo.getStudentsForItemFromCleaningEngine(
    caseData.item_ref,
    caseData.item_kind,
    'shared', // clean_layer
    'pde',
    {}
  );

  const studentFromRepo = repoResult.students?.find(s => s.student_uuid === caseData.student_uuid);
  
  console.log('DB → Repositorio:');
  if (!studentFromRepo) {
    console.log('   ⚠️  Alumno NO encontrado en repositorio');
  } else {
    console.log('   Datos extraídos:');
    console.log(`     shared_last_cleaned_at: ${studentFromRepo.shared_last_cleaned_at}`);
    console.log(`     shared_effective_since: ${studentFromRepo.shared_effective_since}`);
    console.log(`     shared_clean_count: ${studentFromRepo.shared_clean_count}`);
    console.log(`     pde_last_cleaned_at: ${studentFromRepo.pde_last_cleaned_at}`);
    console.log(`     pde_effective_since: ${studentFromRepo.pde_effective_since}`);
    console.log(`     pde_clean_count: ${studentFromRepo.pde_clean_count}`);
  }

  // Verificar coherencia
  const dbState = dbEvidence.cleaning_state;
  if (dbState && studentFromRepo) {
    console.log('\n   Verificación de coherencia:');
    const mismatches = [];
    
    if (dbState.shared_last_cleaned_at?.getTime() !== studentFromRepo.shared_last_cleaned_at?.getTime()) {
      mismatches.push('shared_last_cleaned_at');
    }
    if (dbState.shared_effective_since?.getTime() !== studentFromRepo.shared_effective_since?.getTime()) {
      mismatches.push('shared_effective_since');
    }
    if (dbState.shared_clean_count !== studentFromRepo.shared_clean_count) {
      mismatches.push('shared_clean_count');
    }
    
    if (mismatches.length > 0) {
      console.log(`   ❌ Campos desincronizados: ${mismatches.join(', ')}`);
    } else {
      console.log('   ✅ Datos coherentes entre DB y Repositorio');
    }
  }

  return {
    repo_data: studentFromRepo,
    db_data: dbState
  };
}

/**
 * FASE 6: Diagnóstico Final
 */
function generateFinalReport(caseData, dbEvidence, cpmResults, comparison, readChain) {
  console.log('\n========================================');
  console.log('FASE 6: DIAGNÓSTICO FINAL');
  console.log('========================================\n');

  console.log('1. RESUMEN EJECUTIVO:');
  console.log('   Se analizó el ítem', caseData.item_ref, 'para el alumno', caseData.student_uuid);
  console.log('   Estados devueltos por CPM v2:');
  console.log(`     - list-projection: ${comparison.states.list_projection}`);
  console.log(`     - flotante: ${comparison.states.flotante}`);
  console.log(`     - megalist: ${comparison.states.megalist}`);
  
  if (!comparison.all_equal) {
    console.log('   ❌ INCOHERENCIA DETECTADA: Estados difieren entre superficies');
  } else {
    console.log('   ✅ Estados coherentes entre superficies');
  }

  console.log('\n2. TABLA DE INCOHERENCIAS:');
  if (!comparison.all_equal) {
    console.log('   | Superficie | Estado |');
    console.log('   |------------|--------|');
    console.log(`   | list-projection | ${comparison.states.list_projection} |`);
    console.log(`   | flotante | ${comparison.states.flotante} |`);
    console.log(`   | megalist | ${comparison.states.megalist} |`);
  } else {
    console.log('   ✅ No se detectaron incoherencias');
  }

  console.log('\n3. CAUSA RAÍZ:');
  if (!comparison.all_equal) {
    const listConfig = JSON.stringify(cpmResults.list_projection.input.config);
    const flotanteConfig = JSON.stringify(cpmResults.flotante.input.config);
    
    if (listConfig !== flotanteConfig) {
      console.log('   ⚠️  Input incorrecto: config difiere entre superficies');
      console.log('      - list-projection aplica overrides');
      console.log('      - flotante NO aplica overrides');
    } else {
      console.log('   ⚠️  Input idéntico pero output diferente');
      console.log('      - Posible bug en CPM v2 o wiring incorrecto');
    }
  } else {
    console.log('   ✅ No se detectó causa raíz (estados coherentes)');
  }

  console.log('\n4. CONFIRMACIÓN:');
  console.log('   ¿El CPM v2 es correcto con esos inputs?');
  console.log('   (Revisar logs [CPM_V2][INPUT] y [CPM_V2][OUTPUT] en runtime)');

  console.log('\n5. PUNTOS EXACTOS DEL CÓDIGO:');
  console.log('   - list-projection: src/core/master/services/list-projection-model.js:713');
  console.log('   - flotante: src/services/alquimia-general-service.js:862');
  console.log('   - megalist: src/core/master/services/alquimia-alumno-megalist-service.js:439');
  console.log('   - CPM v2: src/core/master/services/cleaning-projection-model.js:40');
  console.log('   - Repositorio: src/infra/repos/master-student-transmutation-read-repo-pg.js:154');

  console.log('\n========================================');
  console.log('Diagnóstico forense completado. El sistema está listo para fase de corrección dirigida.');
  console.log('========================================\n');
}

/**
 * MAIN
 */
async function main() {
  try {
    const caseData = await selectProblematicCases();
    if (!caseData) {
      console.log('❌ No se pudo seleccionar caso problemático');
      process.exit(1);
    }

    const dbEvidence = await extractDBEvidence(caseData);
    const cpmResults = await simulateCPMInputs(caseData, dbEvidence);
    const comparison = compareSurfaces(cpmResults);
    const readChain = await auditReadChain(caseData, dbEvidence);
    
    generateFinalReport(caseData, dbEvidence, cpmResults, comparison, readChain);
    
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
    process.exit(1);
  }
}

main();
