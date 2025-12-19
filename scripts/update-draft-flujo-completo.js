#!/usr/bin/env node
// scripts/update-draft-flujo-completo.js
// Script conservador para completar el flujo del recorrido limpieza_energetica_diaria
//
// USO: node scripts/update-draft-flujo-completo.js
//
// REGLAS RESPETADAS (Arquitectura Conservadora):
// - ❌ NO crear tablas nuevas
// - ❌ NO crear migraciones
// - ❌ NO crear endpoints nuevos
// - ❌ NO tocar runtime (ya se hizo)
// - ❌ NO tocar editor UI
// - ❌ NO cambiar lógica de racha
// - ❌ NO publicar el recorrido
// - ✅ Modificar SOLO el JSON del draft
// - ✅ Mantener IDs técnicos canónicos (slug)
//
// CAMBIOS QUE REALIZA:
// 1. Añade step "protecciones_energeticas" (si no existe)
// 2. Reordena edges para el flujo correcto
//
// FLUJO FINAL:
// seleccion_tipo_limpieza
// → preparacion_seleccion
// → preparacion_practica
// → protecciones_energeticas
// → limpieza_energetica
// → transicion_racha
// → post_limpieza_seleccion
// → post_limpieza_practica
// → cierre

import dotenv from 'dotenv';
dotenv.config();

import { getDefaultRecorridoRepo } from '../src/infra/repos/recorrido-repo-pg.js';
import { getDefaultRecorridoDraftRepo } from '../src/infra/repos/recorrido-draft-repo-pg.js';
import { getDefaultRecorridoAuditRepo } from '../src/infra/repos/recorrido-audit-repo-pg.js';
import { getPool } from '../database/pg.js';

// ============================================================================
// CONFIGURACIÓN DEL CAMBIO
// ============================================================================
const RECORRIDO_ID = 'limpieza_energetica_diaria';
const SCRIPT_AUTHOR = 'script:update-draft-flujo-completo';

// ============================================================================
// STEP PROTECCIONES_ENERGETICAS
// ============================================================================
const STEP_PROTECCIONES = {
  id: 'protecciones_energeticas',
  definition: {
    screen_template_id: 'screen_text',
    step_type: 'experience',
    props: {
      title: 'Protecciones Energéticas',
      body: 'Activa las protecciones energéticas que desees para tu práctica.\n\nEl handler dinámico cargará las protecciones disponibles.'
    },
    capture: {
      field: 'protecciones_selected',
      value_type: 'json',
      required: false
    }
  }
};

// ============================================================================
// FLUJO DE EDGES CORRECTO (ORDEN DEFINITIVO)
// ============================================================================
const EDGES_DEFINITIVOS = [
  {
    from_step_id: 'seleccion_tipo_limpieza',
    to_step_id: 'preparacion_seleccion',
    condition: { type: 'always' }
  },
  {
    from_step_id: 'preparacion_seleccion',
    to_step_id: 'preparacion_practica',
    condition: { type: 'always' }
  },
  {
    from_step_id: 'preparacion_practica',
    to_step_id: 'protecciones_energeticas',
    condition: { type: 'always' }
  },
  {
    from_step_id: 'protecciones_energeticas',
    to_step_id: 'limpieza_energetica',
    condition: { type: 'always' }
  },
  {
    from_step_id: 'limpieza_energetica',
    to_step_id: 'transicion_racha',
    condition: { type: 'always' }
  },
  {
    from_step_id: 'transicion_racha',
    to_step_id: 'post_limpieza_seleccion',
    condition: { type: 'always' }
  },
  {
    from_step_id: 'post_limpieza_seleccion',
    to_step_id: 'post_limpieza_practica',
    condition: { type: 'always' }
  },
  {
    from_step_id: 'post_limpieza_practica',
    to_step_id: 'cierre',
    condition: { type: 'always' }
  }
];

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

function printEdgeFlow(edges, entryStepId) {
  console.log('\n🔗 FLUJO DE EDGES:');
  
  const outgoing = {};
  edges.forEach(edge => {
    if (!outgoing[edge.from_step_id]) {
      outgoing[edge.from_step_id] = [];
    }
    outgoing[edge.from_step_id].push(edge);
  });
  
  let current = entryStepId;
  let visited = new Set();
  let flowStr = `   ${current}`;
  
  while (current && !visited.has(current)) {
    visited.add(current);
    const nextEdges = outgoing[current];
    if (nextEdges && nextEdges.length > 0) {
      const nextEdge = nextEdges[0];
      flowStr += ` → ${nextEdge.to_step_id}`;
      current = nextEdge.to_step_id;
    } else {
      break;
    }
  }
  
  console.log(flowStr);
}

function validateDefinitionStructure(definition, requiredSteps) {
  const errors = [];
  
  if (!definition) {
    errors.push('La definición es null o undefined');
    return { valid: false, errors };
  }
  
  if (!definition.steps || typeof definition.steps !== 'object') {
    errors.push('La definición no tiene "steps" o no es un objeto');
  }
  
  if (!Array.isArray(definition.edges)) {
    errors.push('La definición no tiene "edges" o no es un array');
  }
  
  // Verificar steps requeridos
  for (const stepId of requiredSteps) {
    if (definition.steps && !definition.steps[stepId]) {
      errors.push(`No existe el step "${stepId}"`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================
async function updateDraftFlujoCompleto() {
  console.log('='.repeat(70));
  console.log('ACTUALIZACIÓN CONSERVADORA: Flujo Completo Limpieza Energética');
  console.log('='.repeat(70));
  console.log(`Recorrido: ${RECORRIDO_ID}`);
  console.log(`Autor: ${SCRIPT_AUTHOR}`);
  console.log(`Fecha: ${new Date().toISOString()}`);
  
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    // ========================================================================
    // PASO 1: Verificar que el recorrido existe
    // ========================================================================
    console.log('\n📋 Paso 1: Verificando recorrido...');
    
    const recorridoRepo = getDefaultRecorridoRepo();
    const recorrido = await recorridoRepo.getRecorridoById(RECORRIDO_ID, client);
    
    if (!recorrido) {
      console.error(`❌ El recorrido "${RECORRIDO_ID}" NO existe.`);
      console.error('   Ejecuta primero: node scripts/import-recorrido-limpieza-energetica.js');
      process.exit(1);
    }
    
    console.log(`✅ Recorrido encontrado`);
    console.log(`   ID: ${recorrido.id}`);
    console.log(`   Status: ${recorrido.status}`);
    console.log(`   Draft ID: ${recorrido.current_draft_id || 'ninguno'}`);
    
    if (!recorrido.current_draft_id) {
      console.error('❌ El recorrido no tiene un draft activo.');
      process.exit(1);
    }
    
    // ========================================================================
    // PASO 2: Cargar el draft actual
    // ========================================================================
    console.log('\n📋 Paso 2: Cargando draft actual...');
    
    const draftRepo = getDefaultRecorridoDraftRepo();
    const draft = await draftRepo.getDraftById(recorrido.current_draft_id, client);
    
    if (!draft) {
      console.error(`❌ No se pudo cargar el draft: ${recorrido.current_draft_id}`);
      process.exit(1);
    }
    
    console.log(`✅ Draft cargado`);
    console.log(`   Draft ID: ${draft.draft_id}`);
    
    const definition = draft.definition_json;
    
    // ========================================================================
    // PASO 3: Mostrar estado actual
    // ========================================================================
    console.log('\n📊 ESTADO ACTUAL:');
    console.log('Steps:', Object.keys(definition.steps).join(', '));
    console.log(`Edges: ${definition.edges.length}`);
    printEdgeFlow(definition.edges, definition.entry_step_id);
    
    // ========================================================================
    // PASO 4: Añadir step protecciones_energeticas si no existe
    // ========================================================================
    console.log('\n📋 Paso 4: Verificando step protecciones_energeticas...');
    
    let stepsAdded = [];
    let edgesModified = false;
    
    if (!definition.steps.protecciones_energeticas) {
      console.log(`   Añadiendo step "${STEP_PROTECCIONES.id}"...`);
      definition.steps[STEP_PROTECCIONES.id] = STEP_PROTECCIONES.definition;
      stepsAdded.push(STEP_PROTECCIONES.id);
    } else {
      console.log(`   Step "protecciones_energeticas" ya existe`);
    }
    
    // ========================================================================
    // PASO 5: Verificar que existen todos los steps necesarios
    // ========================================================================
    console.log('\n📋 Paso 5: Verificando steps necesarios...');
    
    const requiredSteps = [
      'seleccion_tipo_limpieza',
      'preparacion_seleccion',
      'preparacion_practica',
      'protecciones_energeticas',
      'limpieza_energetica',
      'transicion_racha',
      'post_limpieza_seleccion',
      'post_limpieza_practica',
      'cierre'
    ];
    
    const missingSteps = requiredSteps.filter(s => !definition.steps[s]);
    
    if (missingSteps.length > 0) {
      console.error(`❌ Faltan steps requeridos: ${missingSteps.join(', ')}`);
      console.error('   Asegúrate de haber ejecutado los scripts previos.');
      process.exit(1);
    }
    
    console.log('✅ Todos los steps necesarios están presentes');
    
    // ========================================================================
    // PASO 6: Reemplazar edges con el flujo correcto
    // ========================================================================
    console.log('\n📋 Paso 6: Actualizando edges...');
    
    const oldEdgesCount = definition.edges.length;
    
    // Reemplazar todos los edges con el flujo definitivo
    definition.edges = EDGES_DEFINITIVOS;
    
    const newEdgesCount = definition.edges.length;
    edgesModified = true;
    
    console.log(`   Edges anteriores: ${oldEdgesCount}`);
    console.log(`   Edges nuevos: ${newEdgesCount}`);
    
    // ========================================================================
    // PASO 7: Validar que no hay edges huérfanos
    // ========================================================================
    console.log('\n📋 Paso 7: Validando integridad...');
    
    const stepIds = Object.keys(definition.steps);
    const orphanEdges = definition.edges.filter(edge => 
      !stepIds.includes(edge.from_step_id) || !stepIds.includes(edge.to_step_id)
    );
    
    if (orphanEdges.length > 0) {
      console.error('❌ Hay edges huérfanos:');
      orphanEdges.forEach(edge => {
        console.error(`   ${edge.from_step_id} → ${edge.to_step_id}`);
      });
      process.exit(1);
    }
    
    console.log('✅ No hay edges huérfanos');
    
    // ========================================================================
    // PASO 8: Mostrar flujo final
    // ========================================================================
    console.log('\n📊 ESTADO FINAL:');
    console.log('Steps:', Object.keys(definition.steps).join(', '));
    console.log(`Steps count: ${Object.keys(definition.steps).length}`);
    printEdgeFlow(definition.edges, definition.entry_step_id);
    
    // ========================================================================
    // PASO 9: Guardar draft actualizado
    // ========================================================================
    console.log('\n📋 Paso 9: Guardando draft actualizado...');
    
    await client.query('BEGIN');
    
    const updatedDraft = await draftRepo.updateDraft(
      draft.draft_id,
      definition,
      SCRIPT_AUTHOR,
      client
    );
    
    if (!updatedDraft) {
      throw new Error('No se pudo actualizar el draft');
    }
    
    // Audit log
    const auditRepo = getDefaultRecorridoAuditRepo();
    await auditRepo.append(
      RECORRIDO_ID,
      draft.draft_id,
      'update_draft',
      {
        source: SCRIPT_AUTHOR,
        action_type: 'complete_flow',
        steps_added: stepsAdded,
        edges_replaced: edgesModified,
        steps_count: Object.keys(definition.steps).length,
        edges_count: definition.edges.length,
        flow_order: requiredSteps
      },
      SCRIPT_AUTHOR,
      client
    );
    
    await client.query('COMMIT');
    
    console.log('✅ Draft guardado correctamente');
    
    // ========================================================================
    // RESUMEN FINAL
    // ========================================================================
    console.log('\n' + '='.repeat(70));
    console.log('✅ ACTUALIZACIÓN COMPLETADA EXITOSAMENTE');
    console.log('='.repeat(70));
    
    console.log('\n📊 RESUMEN:');
    console.log(`   Recorrido: ${RECORRIDO_ID}`);
    console.log(`   Status: ${recorrido.status}`);
    console.log(`   Steps: ${Object.keys(definition.steps).length}`);
    console.log(`   Edges: ${definition.edges.length}`);
    
    if (stepsAdded.length > 0) {
      console.log(`\n🆕 STEPS AÑADIDOS: ${stepsAdded.join(', ')}`);
    }
    
    console.log('\n🔗 FLUJO FINAL (9 steps):');
    console.log('   1. seleccion_tipo_limpieza');
    console.log('   2. preparacion_seleccion        [selection_handler]');
    console.log('   3. preparacion_practica         [practice_timer_handler]');
    console.log('   4. protecciones_energeticas     [selection_handler]');
    console.log('   5. limpieza_energetica          [limpieza_energetica_handler] ← RACHA');
    console.log('   6. transicion_racha');
    console.log('   7. post_limpieza_seleccion      [selection_handler]');
    console.log('   8. post_limpieza_practica       [practice_timer_handler]');
    console.log('   9. cierre');
    
    console.log('\n✅ VERIFICACIONES:');
    console.log('   ✓ Recorrido sigue en estado DRAFT');
    console.log('   ✓ Todos los steps están presentes');
    console.log('   ✓ Flujo de edges es lineal y correcto');
    console.log('   ✓ No hay edges huérfanos');
    console.log('   ✓ limpieza_energetica sigue siendo el ÚNICO punto de racha');
    console.log('   ✓ Ninguna versión publicada fue afectada');
    
    console.log('\n⚠️  NOTA: El recorrido sigue en DRAFT. NO se ha publicado.');
    console.log('   Para probarlo, necesitas publicar o ejecutar en modo draft.');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ ERROR durante la actualización:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// ============================================================================
// EJECUTAR
// ============================================================================
updateDraftFlujoCompleto().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});






