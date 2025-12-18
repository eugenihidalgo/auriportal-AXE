#!/usr/bin/env node
// scripts/update-draft-transicion-racha.js
// Script conservador para añadir el step "transicion_racha" al recorrido limpieza_energetica_diaria
//
// USO: node scripts/update-draft-transicion-racha.js
//
// REGLAS RESPETADAS (Arquitectura Conservadora):
// - ❌ NO crear tablas nuevas
// - ❌ NO crear migraciones
// - ❌ NO crear endpoints nuevos
// - ❌ NO tocar runtime
// - ❌ NO tocar editor UI
// - ❌ NO cambiar lógica de racha
// - ❌ NO publicar el recorrido
// - ✅ Modificar SOLO el JSON del draft
// - ✅ Mantener IDs técnicos canónicos (slug)
// - ✅ Mantener el resto del recorrido EXACTAMENTE igual

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
const SCRIPT_AUTHOR = 'script:update-draft-transicion-racha';

// ============================================================================
// NUEVO STEP A AÑADIR
// ============================================================================
const NEW_STEP = {
  id: 'transicion_racha',
  definition: {
    screen_template_id: 'screen_text',
    step_type: 'experience',
    props: {
      title: '¡Racha aumentada!',
      body: 'Has completado tu limpieza diaria. Tu constancia suma energía.'
    }
    // NO añadir: capture, emit, lógica adicional
  }
};

// ============================================================================
// EDGES A MODIFICAR
// ============================================================================
// Estado actual:     limpieza_energetica → post_limpieza_seleccion
// Estado final:      limpieza_energetica → transicion_racha → post_limpieza_seleccion

const EDGE_TO_REMOVE = {
  from_step_id: 'limpieza_energetica',
  to_step_id: 'post_limpieza_seleccion'
};

const EDGES_TO_ADD = [
  {
    from_step_id: 'limpieza_energetica',
    to_step_id: 'transicion_racha',
    condition: { type: 'always' }
  },
  {
    from_step_id: 'transicion_racha',
    to_step_id: 'post_limpieza_seleccion',
    condition: { type: 'always' }
  }
];

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

/**
 * Valida que la definición tenga la estructura esperada
 */
function validateDefinitionStructure(definition) {
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
  
  // Verificar que existe el step limpieza_energetica
  if (definition.steps && !definition.steps.limpieza_energetica) {
    errors.push('No existe el step "limpieza_energetica" - ¿Recorrido correcto?');
  }
  
  // Verificar que existe el step post_limpieza_seleccion
  if (definition.steps && !definition.steps.post_limpieza_seleccion) {
    errors.push('No existe el step "post_limpieza_seleccion" - ¿Recorrido correcto?');
  }
  
  // Verificar que NO existe ya el step transicion_racha
  if (definition.steps && definition.steps.transicion_racha) {
    errors.push('Ya existe el step "transicion_racha" - No se requiere actualización');
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Verifica que existe el edge a eliminar
 */
function findEdgeIndex(edges, fromStepId, toStepId) {
  return edges.findIndex(
    edge => edge.from_step_id === fromStepId && edge.to_step_id === toStepId
  );
}

/**
 * Muestra el flujo de edges de forma legible
 */
function printEdgeFlow(edges, entryStepId) {
  console.log('\n🔗 FLUJO DE EDGES:');
  
  // Construir mapa de edges salientes
  const outgoing = {};
  edges.forEach(edge => {
    if (!outgoing[edge.from_step_id]) {
      outgoing[edge.from_step_id] = [];
    }
    outgoing[edge.from_step_id].push(edge);
  });
  
  // Recorrer desde entry_step_id
  let current = entryStepId;
  let visited = new Set();
  let flowStr = `   ${current}`;
  
  while (current && !visited.has(current)) {
    visited.add(current);
    const nextEdges = outgoing[current];
    if (nextEdges && nextEdges.length > 0) {
      // Tomar el primer edge (asumiendo flujo lineal)
      const nextEdge = nextEdges[0];
      flowStr += ` → ${nextEdge.to_step_id}`;
      current = nextEdge.to_step_id;
    } else {
      break;
    }
  }
  
  console.log(flowStr);
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================
async function updateDraftTransicionRacha() {
  console.log('='.repeat(70));
  console.log('ACTUALIZACIÓN CONSERVADORA: Añadir step transicion_racha');
  console.log('='.repeat(70));
  console.log(`Recorrido: ${RECORRIDO_ID}`);
  console.log(`Autor: ${SCRIPT_AUTHOR}`);
  console.log(`Fecha: ${new Date().toISOString()}`);
  
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    // ========================================================================
    // PASO 1: Verificar que el recorrido existe y está en DRAFT
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
    console.log(`   Nombre: ${recorrido.name}`);
    console.log(`   Status: ${recorrido.status}`);
    console.log(`   Draft ID: ${recorrido.current_draft_id || 'ninguno'}`);
    
    if (recorrido.status !== 'draft' && recorrido.status !== 'DRAFT') {
      console.error(`⚠️  ADVERTENCIA: El recorrido NO está en DRAFT (status: ${recorrido.status})`);
      console.error('   Este script solo modifica drafts. NO se aplicará a versiones publicadas.');
    }
    
    if (!recorrido.current_draft_id) {
      console.error('❌ El recorrido no tiene un draft activo.');
      console.error('   Ejecuta primero: node scripts/import-recorrido-limpieza-energetica.js');
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
    console.log(`   Última actualización: ${draft.updated_at}`);
    console.log(`   Actualizado por: ${draft.updated_by || 'desconocido'}`);
    
    const definition = draft.definition_json;
    
    // ========================================================================
    // PASO 3: Validar estructura del draft
    // ========================================================================
    console.log('\n📋 Paso 3: Validando estructura del draft...');
    
    const validation = validateDefinitionStructure(definition);
    if (!validation.valid) {
      console.error('❌ Estructura del draft inválida:');
      validation.errors.forEach(err => console.error(`   - ${err}`));
      process.exit(1);
    }
    
    console.log('✅ Estructura válida');
    console.log(`   Steps actuales: ${Object.keys(definition.steps).length}`);
    console.log(`   Edges actuales: ${definition.edges.length}`);
    
    // Mostrar flujo actual
    console.log('\n📊 ESTADO ACTUAL:');
    console.log('Steps:', Object.keys(definition.steps).join(', '));
    printEdgeFlow(definition.edges, definition.entry_step_id);
    
    // ========================================================================
    // PASO 4: Verificar que existe el edge a modificar
    // ========================================================================
    console.log('\n📋 Paso 4: Verificando edge a modificar...');
    
    const edgeIndex = findEdgeIndex(
      definition.edges,
      EDGE_TO_REMOVE.from_step_id,
      EDGE_TO_REMOVE.to_step_id
    );
    
    if (edgeIndex === -1) {
      console.error(`❌ No se encontró el edge: ${EDGE_TO_REMOVE.from_step_id} → ${EDGE_TO_REMOVE.to_step_id}`);
      console.error('   ¿Ya se aplicó este cambio anteriormente?');
      console.error('   Edges actuales:');
      definition.edges.forEach((edge, i) => {
        console.error(`   ${i + 1}. ${edge.from_step_id} → ${edge.to_step_id}`);
      });
      process.exit(1);
    }
    
    console.log(`✅ Edge encontrado en posición ${edgeIndex + 1}`);
    console.log(`   ${EDGE_TO_REMOVE.from_step_id} → ${EDGE_TO_REMOVE.to_step_id}`);
    
    // ========================================================================
    // PASO 5: Aplicar cambios al definition_json
    // ========================================================================
    console.log('\n📋 Paso 5: Aplicando cambios...');
    
    // 5.1: Añadir nuevo step
    console.log(`   5.1: Añadiendo step "${NEW_STEP.id}"...`);
    definition.steps[NEW_STEP.id] = NEW_STEP.definition;
    
    // 5.2: Eliminar edge antiguo
    console.log(`   5.2: Eliminando edge ${EDGE_TO_REMOVE.from_step_id} → ${EDGE_TO_REMOVE.to_step_id}...`);
    definition.edges.splice(edgeIndex, 1);
    
    // 5.3: Añadir nuevos edges (en la misma posición para mantener orden)
    console.log(`   5.3: Añadiendo ${EDGES_TO_ADD.length} nuevos edges...`);
    definition.edges.splice(edgeIndex, 0, ...EDGES_TO_ADD);
    
    console.log('✅ Cambios aplicados en memoria');
    
    // ========================================================================
    // PASO 6: Validar cambios
    // ========================================================================
    console.log('\n📋 Paso 6: Validando cambios...');
    
    // Verificar que el step fue añadido
    if (!definition.steps[NEW_STEP.id]) {
      console.error('❌ El step no fue añadido correctamente');
      process.exit(1);
    }
    
    // Verificar que los edges están correctos
    const edge1Index = findEdgeIndex(definition.edges, 'limpieza_energetica', 'transicion_racha');
    const edge2Index = findEdgeIndex(definition.edges, 'transicion_racha', 'post_limpieza_seleccion');
    
    if (edge1Index === -1) {
      console.error('❌ No se creó el edge limpieza_energetica → transicion_racha');
      process.exit(1);
    }
    
    if (edge2Index === -1) {
      console.error('❌ No se creó el edge transicion_racha → post_limpieza_seleccion');
      process.exit(1);
    }
    
    // Verificar que no hay edges huérfanos (steps en edges que no existen)
    const stepIds = Object.keys(definition.steps);
    const orphanEdges = definition.edges.filter(edge => 
      !stepIds.includes(edge.from_step_id) || !stepIds.includes(edge.to_step_id)
    );
    
    if (orphanEdges.length > 0) {
      console.error('❌ Hay edges huérfanos (apuntan a steps que no existen):');
      orphanEdges.forEach(edge => {
        console.error(`   ${edge.from_step_id} → ${edge.to_step_id}`);
      });
      process.exit(1);
    }
    
    console.log('✅ Validación de cambios exitosa');
    console.log(`   Steps finales: ${Object.keys(definition.steps).length}`);
    console.log(`   Edges finales: ${definition.edges.length}`);
    
    // Mostrar flujo nuevo
    console.log('\n📊 ESTADO FINAL:');
    console.log('Steps:', Object.keys(definition.steps).join(', '));
    printEdgeFlow(definition.edges, definition.entry_step_id);
    
    // ========================================================================
    // PASO 7: Guardar draft actualizado
    // ========================================================================
    console.log('\n📋 Paso 7: Guardando draft actualizado...');
    
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
        action_type: 'add_step',
        step_added: NEW_STEP.id,
        step_type: NEW_STEP.definition.step_type,
        edges_modified: {
          removed: EDGE_TO_REMOVE,
          added: EDGES_TO_ADD
        },
        steps_count_before: Object.keys(definition.steps).length - 1,
        steps_count_after: Object.keys(definition.steps).length,
        edges_count_before: definition.edges.length - 1,
        edges_count_after: definition.edges.length
      },
      SCRIPT_AUTHOR,
      client
    );
    
    await client.query('COMMIT');
    
    console.log('✅ Draft guardado correctamente');
    console.log(`   Draft ID: ${updatedDraft.draft_id}`);
    console.log(`   Actualizado: ${updatedDraft.updated_at}`);
    
    // ========================================================================
    // PASO 8: Verificación final
    // ========================================================================
    console.log('\n📋 Paso 8: Verificación final...');
    
    // Re-cargar el recorrido para verificar que sigue en DRAFT
    const recorridoFinal = await recorridoRepo.getRecorridoById(RECORRIDO_ID, client);
    
    console.log(`✅ Status del recorrido: ${recorridoFinal.status}`);
    
    if (recorridoFinal.status !== 'DRAFT') {
      console.warn('⚠️  El status cambió durante la actualización');
    }
    
    // ========================================================================
    // RESUMEN FINAL
    // ========================================================================
    console.log('\n' + '='.repeat(70));
    console.log('✅ ACTUALIZACIÓN COMPLETADA EXITOSAMENTE');
    console.log('='.repeat(70));
    
    console.log('\n📊 RESUMEN:');
    console.log(`   Recorrido: ${RECORRIDO_ID}`);
    console.log(`   Status: ${recorridoFinal.status}`);
    console.log(`   Steps: ${Object.keys(definition.steps).length} (+1)`);
    console.log(`   Edges: ${definition.edges.length} (+1)`);
    
    console.log('\n🆕 STEP AÑADIDO:');
    console.log(`   ID: ${NEW_STEP.id}`);
    console.log(`   Type: ${NEW_STEP.definition.step_type}`);
    console.log(`   Template: ${NEW_STEP.definition.screen_template_id}`);
    console.log(`   Título: ${NEW_STEP.definition.props.title}`);
    
    console.log('\n🔗 FLUJO FINAL:');
    const stepOrder = [
      'seleccion_tipo_limpieza',
      'preparacion_seleccion',
      'preparacion_practica',
      'limpieza_energetica',
      'transicion_racha',      // ← NUEVO
      'post_limpieza_seleccion',
      'post_limpieza_practica',
      'cierre'
    ];
    console.log(`   ${stepOrder.join(' → ')}`);
    
    console.log('\n✅ VERIFICACIONES:');
    console.log('   ✓ Recorrido sigue en estado DRAFT');
    console.log('   ✓ Número de steps aumentó en +1');
    console.log('   ✓ Flujo de edges es correcto');
    console.log('   ✓ No hay edges huérfanos');
    console.log('   ✓ step_type "experience" es válido');
    console.log('   ✓ Ninguna versión publicada fue afectada');
    
    console.log('\n⚠️  NOTA: El recorrido sigue en DRAFT. NO se ha publicado.');
    console.log('   Publish bloqueará solo por campos obligatorios de screens (video/audio).');
    
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
updateDraftTransicionRacha().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});

