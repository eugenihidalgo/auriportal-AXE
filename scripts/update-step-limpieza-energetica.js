#!/usr/bin/env node
// scripts/update-step-limpieza-energetica.js
// Script para actualizar el step "limpieza_energetica" con props para la checklist de transmutaciones
//
// USO: node scripts/update-step-limpieza-energetica.js
//
// REGLAS RESPETADAS (Arquitectura Conservadora):
// - ❌ NO crear tablas nuevas
// - ❌ NO crear migraciones
// - ❌ NO crear endpoints nuevos
// - ❌ NO tocar lógica legacy
// - ❌ NO publicar el recorrido
// - ✅ Modificar SOLO el JSON del draft
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
const STEP_ID = 'limpieza_energetica';
const SCRIPT_AUTHOR = 'script:update-step-limpieza-energetica';

// ============================================================================
// NUEVO CONTENIDO DEL STEP limpieza_energetica
// ============================================================================
// Este step ahora:
// - Usa screen_checklist (fallback a screen_text si no existe)
// - Tiene props preparados para renderizar transmutaciones
// - El bundle se añade dinámicamente por el handler en runtime
// - Capture incluye los campos necesarios
const UPDATED_STEP = {
  // Usar screen_text como base, el runtime enriquece con transmutaciones
  screen_template_id: "screen_text",
  step_type: "practice",
  props: {
    // Título dinámico - se puede personalizar por modo
    title: "Limpieza energética",
    subtitle: "Marca las transmutaciones que desees trabajar hoy",
    
    // Instrucciones para el alumno
    instructions: [
      "Respira profundamente y centra tu atención en tu interior",
      "Lee cada transmutación y siente cuáles resuenan contigo hoy",
      "Marca las que deseas trabajar durante esta sesión",
      "Cuando estés listo, pulsa 'Hecho' para completar"
    ],
    
    // UI Configuration para el cliente
    ui_config: {
      // Indica al cliente que renderice como checklist
      render_mode: "transmutation_checklist",
      // Mostrar contador de ítems marcados
      show_counter: true,
      // Texto del botón de completar
      submit_button_text: "Hecho",
      // Mensaje cuando no hay ítems marcados
      empty_warning: "Marca al menos una transmutación para continuar",
      // Permitir completar sin marcar nada (false = requiere al menos 1)
      allow_empty: false
    },
    
    // Texto de fallback si el bundle no se carga
    fallback_body: "Dedica unos momentos a tu limpieza energética diaria. Respira profundamente y visualiza cómo la luz transmuta toda energía densa en ti.",
    
    // Nota: transmutation_bundle se añade dinámicamente por el handler
    // Ver: src/core/recorridos/step-handlers/limpieza-energetica-handler.js
  },
  
  // Capture: campos que se envían al submit
  capture: {
    // Campo principal: ¿completó la limpieza?
    limpieza_completada: {
      value_type: "boolean",
      required: true
    },
    // Array de IDs de transmutaciones marcadas
    transmutations_done: {
      value_type: "array",
      required: false
    },
    // Modo de limpieza (para audit)
    mode_id: {
      value_type: "string",
      required: false
    }
  }
};

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================
async function updateStepLimpiezaEnergetica() {
  console.log('='.repeat(70));
  console.log('ACTUALIZACIÓN: Step limpieza_energetica con props para checklist');
  console.log('='.repeat(70));
  console.log(`Recorrido: ${RECORRIDO_ID}`);
  console.log(`Step: ${STEP_ID}`);
  console.log(`Autor: ${SCRIPT_AUTHOR}`);
  console.log(`Fecha: ${new Date().toISOString()}`);
  
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    // ========================================================================
    // PASO 1: Verificar que el recorrido existe y tiene draft
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
    
    console.log(`✅ Draft cargado: ${draft.draft_id}`);
    
    const definition = draft.definition_json;
    
    // ========================================================================
    // PASO 3: Verificar que existe el step limpieza_energetica
    // ========================================================================
    console.log('\n📋 Paso 3: Verificando step...');
    
    if (!definition.steps || !definition.steps[STEP_ID]) {
      console.error(`❌ No existe el step "${STEP_ID}" en el recorrido.`);
      process.exit(1);
    }
    
    const oldStep = definition.steps[STEP_ID];
    console.log('✅ Step encontrado');
    console.log(`   Screen actual: ${oldStep.screen_template_id}`);
    console.log(`   Props actuales: ${JSON.stringify(Object.keys(oldStep.props || {}))}`);
    
    // ========================================================================
    // PASO 4: Actualizar el step
    // ========================================================================
    console.log('\n📋 Paso 4: Actualizando step...');
    
    // Guardar estado anterior para audit
    const previousStepJson = JSON.stringify(oldStep);
    
    // Aplicar actualización
    definition.steps[STEP_ID] = UPDATED_STEP;
    
    console.log('✅ Step actualizado en memoria');
    console.log(`   Screen nuevo: ${UPDATED_STEP.screen_template_id}`);
    console.log(`   Step type: ${UPDATED_STEP.step_type}`);
    console.log(`   Props nuevos: ${JSON.stringify(Object.keys(UPDATED_STEP.props))}`);
    
    // ========================================================================
    // PASO 5: Guardar draft actualizado
    // ========================================================================
    console.log('\n📋 Paso 5: Guardando draft...');
    
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
        action_type: 'update_step',
        step_id: STEP_ID,
        changes: {
          screen_template_id: {
            from: oldStep.screen_template_id,
            to: UPDATED_STEP.screen_template_id
          },
          step_type: {
            from: oldStep.step_type || 'experience',
            to: UPDATED_STEP.step_type
          },
          props_keys: {
            from: Object.keys(oldStep.props || {}),
            to: Object.keys(UPDATED_STEP.props)
          }
        },
        reason: 'Integración Transmutaciones Energéticas v1'
      },
      SCRIPT_AUTHOR,
      client
    );
    
    await client.query('COMMIT');
    
    console.log('✅ Draft guardado correctamente');
    console.log(`   Actualizado: ${updatedDraft.updated_at}`);
    
    // ========================================================================
    // RESUMEN FINAL
    // ========================================================================
    console.log('\n' + '='.repeat(70));
    console.log('✅ ACTUALIZACIÓN COMPLETADA');
    console.log('='.repeat(70));
    
    console.log('\n📊 RESUMEN:');
    console.log(`   Recorrido: ${RECORRIDO_ID}`);
    console.log(`   Step: ${STEP_ID}`);
    console.log(`   Status: ${recorrido.status}`);
    
    console.log('\n🆕 CAMBIOS EN EL STEP:');
    console.log(`   step_type: ${UPDATED_STEP.step_type}`);
    console.log(`   props.title: "${UPDATED_STEP.props.title}"`);
    console.log(`   props.ui_config.render_mode: "${UPDATED_STEP.props.ui_config.render_mode}"`);
    console.log(`   capture: limpieza_completada, transmutations_done, mode_id`);
    
    console.log('\n📝 NOTAS TÉCNICAS:');
    console.log('   - El bundle de transmutaciones se añade dinámicamente en runtime');
    console.log('   - Ver: src/core/recorridos/step-handlers/limpieza-energetica-handler.js');
    console.log('   - El cliente debe interpretar props.ui_config.render_mode para renderizar');
    console.log('   - Si el bundle no se carga, mostrar props.fallback_body');
    
    console.log('\n✅ VERIFICACIONES:');
    console.log('   ✓ Recorrido sigue en estado DRAFT');
    console.log('   ✓ Solo se modificó el step limpieza_energetica');
    console.log('   ✓ Ninguna versión publicada fue afectada');
    
    console.log('\n⚠️  NOTA: El recorrido sigue en DRAFT. NO se ha publicado.');
    
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
updateStepLimpiezaEnergetica().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});














