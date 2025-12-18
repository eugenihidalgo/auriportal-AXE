#!/usr/bin/env node
// scripts/import-recorrido-limpieza-energetica.js
// Script para importar el recorrido "Limpieza Energética Diaria" en estado DRAFT
// 
// USO: node scripts/import-recorrido-limpieza-energetica.js
// 
// REGLAS RESPETADAS:
// - NO crea tablas nuevas
// - NO crea endpoints nuevos
// - NO toca runtime
// - Usa SOLO screens ya existentes
// - Draft permisivo, publish estricto
// - IDs técnicos canónicos (slug, sin espacios)

// Cargar variables de entorno desde .env
import dotenv from 'dotenv';
dotenv.config();

import { getDefaultRecorridoRepo } from '../src/infra/repos/recorrido-repo-pg.js';
import { getDefaultRecorridoDraftRepo } from '../src/infra/repos/recorrido-draft-repo-pg.js';
import { getDefaultRecorridoAuditRepo } from '../src/infra/repos/recorrido-audit-repo-pg.js';
import { getPool } from '../database/pg.js';
import { validateDefinitionForDraft } from '../src/core/recorridos/normalize-recorrido-definition.js';

// ============================================================================
// DEFINICIÓN DEL RECORRIDO: Limpieza Energética Diaria
// ============================================================================
const RECORRIDO_DEFINITION = {
  id: "limpieza_energetica_diaria",
  entry_step_id: "seleccion_tipo_limpieza",
  
  // Metadatos del recorrido
  meta: {
    name: "Limpieza Energética Diaria",
    objective: "Restablecer el estado energético del alumno mediante una práctica guiada adaptable a su nivel y tiempo disponible.",
    description: "Recorrido diario de limpieza energética con distintas profundidades, recursos preparatorios y prácticas guiadas.",
    tags: ["limpieza", "energia", "diaria", "practica_base"]
  },
  
  steps: {
    // ========================================================================
    // STEP 1 — Selección de tipo de limpieza
    // ========================================================================
    // NOTA: step_type omitido porque screen_choice no está en compatible_templates de 'decision'
    // El runtime futuro implementará la lógica de decisión
    seleccion_tipo_limpieza: {
      screen_template_id: "screen_choice",
      // step_type: "decision" - omitido por incompatibilidad, se añadirá cuando el registry lo soporte
      props: {
        title: "¿Qué tipo de limpieza vas a hacer hoy?",
        subtitle: "Elige según tu tiempo y estado energético",
        question: "Selecciona una opción",
        choices: [
          { choice_id: "rapida", label: "Limpieza rápida" },
          { choice_id: "basica", label: "Limpieza básica" },
          { choice_id: "profunda", label: "Limpieza profunda" },
          { choice_id: "maestro", label: "Limpieza modo Maestro" }
        ]
      },
      capture: {
        field: "tipo_limpieza",
        value_type: "choice",
        required: true
      }
    },
    
    // ========================================================================
    // STEP 2 — Preparación (selección de recursos) [PLACEHOLDER]
    // ========================================================================
    // NOTA: step_type omitido porque screen_text no está en compatible_templates de 'decision'
    preparacion_seleccion: {
      screen_template_id: "screen_text",
      // step_type: "decision" - omitido por incompatibilidad
      props: {
        title: "Preparación para la práctica",
        body: "En esta pantalla el alumno seleccionará los recursos preparatorios según el tipo de limpieza elegido y su nivel.\n\n(Placeholder – lógica dinámica se implementará en runtime futuro)"
      },
      capture: {
        field: "recursos_preparacion",
        value_type: "json",
        required: false
      }
    },
    
    // ========================================================================
    // STEP 3 — Prácticas preparatorias
    // ========================================================================
    // NOTA: step_type omitido porque screen_video no está en compatible_templates de 'practice'
    // video_source y video_ref se dejarán vacíos (placeholder) - bloqueará publish
    preparacion_practica: {
      screen_template_id: "screen_video",
      // step_type: "practice" - omitido por incompatibilidad
      props: {
        title: "Prácticas de preparación",
        display_mode: "inline",
        declared_duration_minutes: 10
        // video_source y video_ref: pendientes de definir (bloqueará publish)
      },
      capture: {
        field: "duracion_preparacion_real",
        value_type: "number",
        required: false
      }
    },
    
    // ========================================================================
    // STEP 4 — Limpieza energética central [PLACEHOLDER]
    // ========================================================================
    // NOTA: step_type omitido porque screen_text no está en compatible_templates de 'practice'
    limpieza_energetica: {
      screen_template_id: "screen_text",
      // step_type: "practice" - omitido por incompatibilidad
      props: {
        title: "Limpieza energética",
        body: "Aquí se ejecutará la limpieza energética principal.\n\nSe mostrarán ítems de transmutación y técnicas disponibles según el tipo de limpieza y el nivel del alumno.\n\n(Placeholder – runtime futuro)"
      },
      capture: {
        field: "limpieza_completada",
        value_type: "boolean",
        required: true
      }
    },
    
    // ========================================================================
    // STEP 5 — Post-limpieza (selección) [PLACEHOLDER]
    // ========================================================================
    // NOTA: step_type omitido porque screen_text no está en compatible_templates de 'decision'
    post_limpieza_seleccion: {
      screen_template_id: "screen_text",
      // step_type: "decision" - omitido por incompatibilidad
      props: {
        title: "Integración post-limpieza",
        body: "Selecciona las prácticas posteriores que desees realizar.\n\n(Placeholder – lógica dinámica futura)"
      },
      capture: {
        field: "recursos_post",
        value_type: "json",
        required: false
      }
    },
    
    // ========================================================================
    // STEP 6 — Prácticas post-limpieza
    // ========================================================================
    // NOTA: step_type omitido porque screen_audio no está en compatible_templates de 'practice'
    // audio_source y audio_ref se dejarán vacíos (placeholder) - bloqueará publish
    post_limpieza_practica: {
      screen_template_id: "screen_audio",
      // step_type: "practice" - omitido por incompatibilidad
      props: {
        title: "Prácticas de integración",
        declared_duration_minutes: 10
        // audio_source y audio_ref: pendientes de definir (bloqueará publish)
      },
      capture: {
        field: "duracion_post_real",
        value_type: "number",
        required: false
      }
    },
    
    // ========================================================================
    // STEP 7 — Cierre
    // ========================================================================
    // NOTA: step_type omitido porque screen_text no está en compatible_templates de 'closure'
    cierre: {
      screen_template_id: "screen_text",
      // step_type: "closure" - omitido por incompatibilidad
      props: {
        title: "Práctica completada",
        body: "Has completado tu limpieza energética diaria. Buen trabajo."
      }
    }
  },
  
  // ========================================================================
  // EDGES (TODOS always, EN ESTE ORDEN)
  // ========================================================================
  edges: [
    {
      from_step_id: "seleccion_tipo_limpieza",
      to_step_id: "preparacion_seleccion",
      condition: { type: "always" }
    },
    {
      from_step_id: "preparacion_seleccion",
      to_step_id: "preparacion_practica",
      condition: { type: "always" }
    },
    {
      from_step_id: "preparacion_practica",
      to_step_id: "limpieza_energetica",
      condition: { type: "always" }
    },
    {
      from_step_id: "limpieza_energetica",
      to_step_id: "post_limpieza_seleccion",
      condition: { type: "always" }
    },
    {
      from_step_id: "post_limpieza_seleccion",
      to_step_id: "post_limpieza_practica",
      condition: { type: "always" }
    },
    {
      from_step_id: "post_limpieza_practica",
      to_step_id: "cierre",
      condition: { type: "always" }
    }
  ]
};

// ============================================================================
// FUNCIÓN PRINCIPAL DE IMPORTACIÓN
// ============================================================================
async function importRecorrido() {
  console.log('='.repeat(70));
  console.log('IMPORTACIÓN: Limpieza Energética Diaria');
  console.log('='.repeat(70));
  
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    // ========================================================================
    // PASO 1: Validar definición para draft
    // ========================================================================
    console.log('\n📋 Paso 1: Validando definición para draft...');
    
    const validation = validateDefinitionForDraft(RECORRIDO_DEFINITION);
    if (!validation.valid) {
      console.error('❌ La definición no es válida para draft:');
      validation.errors.forEach(err => console.error(`   - ${err}`));
      process.exit(1);
    }
    console.log('✅ Definición válida para draft');
    
    // ========================================================================
    // PASO 2: Verificar si ya existe
    // ========================================================================
    console.log('\n🔍 Paso 2: Verificando si el recorrido ya existe...');
    
    const recorridoRepo = getDefaultRecorridoRepo();
    const existing = await recorridoRepo.getRecorridoById(RECORRIDO_DEFINITION.id, client);
    
    if (existing) {
      console.log(`⚠️  El recorrido "${RECORRIDO_DEFINITION.id}" ya existe.`);
      console.log(`   Status actual: ${existing.status}`);
      console.log(`   Current draft ID: ${existing.current_draft_id || 'ninguno'}`);
      console.log(`   Current published version: ${existing.current_published_version || 'ninguna'}`);
      
      // Preguntar si actualizar el draft
      console.log('\n📝 Actualizando draft existente...');
      
      const draftRepo = getDefaultRecorridoDraftRepo();
      const auditRepo = getDefaultRecorridoAuditRepo();
      
      await client.query('BEGIN');
      
      // Crear nuevo draft
      const draft = await draftRepo.createDraft(
        RECORRIDO_DEFINITION.id,
        RECORRIDO_DEFINITION,
        'script:import-recorrido-limpieza',
        client
      );
      
      // Actualizar recorrido con nuevo draft_id
      await recorridoRepo.updateRecorridoMeta(
        RECORRIDO_DEFINITION.id,
        { current_draft_id: draft.draft_id },
        client
      );
      
      // Audit log
      await auditRepo.append(
        RECORRIDO_DEFINITION.id,
        draft.draft_id,
        'import',
        { 
          source: 'script:import-recorrido-limpieza',
          action_type: 'update',
          steps_count: Object.keys(RECORRIDO_DEFINITION.steps).length,
          edges_count: RECORRIDO_DEFINITION.edges.length
        },
        'script:import',
        client
      );
      
      await client.query('COMMIT');
      
      console.log(`✅ Draft actualizado: ${draft.draft_id}`);
      
    } else {
      // ======================================================================
      // PASO 3: Crear recorrido nuevo + draft
      // ======================================================================
      console.log('\n🆕 Paso 3: Creando recorrido nuevo...');
      
      const draftRepo = getDefaultRecorridoDraftRepo();
      const auditRepo = getDefaultRecorridoAuditRepo();
      
      await client.query('BEGIN');
      
      // Crear recorrido
      const recorrido = await recorridoRepo.createRecorrido({
        id: RECORRIDO_DEFINITION.id,
        name: RECORRIDO_DEFINITION.meta?.name || RECORRIDO_DEFINITION.id
      }, client);
      
      console.log(`✅ Recorrido creado: ${recorrido.id}`);
      console.log(`   Nombre: ${recorrido.name}`);
      console.log(`   Status: ${recorrido.status}`);
      
      // Crear draft inicial
      const draft = await draftRepo.createDraft(
        RECORRIDO_DEFINITION.id,
        RECORRIDO_DEFINITION,
        'script:import-recorrido-limpieza',
        client
      );
      
      console.log(`✅ Draft creado: ${draft.draft_id}`);
      
      // Actualizar recorrido con current_draft_id
      await recorridoRepo.updateRecorridoMeta(
        RECORRIDO_DEFINITION.id,
        { current_draft_id: draft.draft_id },
        client
      );
      
      // Audit log
      await auditRepo.append(
        RECORRIDO_DEFINITION.id,
        draft.draft_id,
        'import',
        { 
          source: 'script:import-recorrido-limpieza',
          action_type: 'create',
          steps_count: Object.keys(RECORRIDO_DEFINITION.steps).length,
          edges_count: RECORRIDO_DEFINITION.edges.length,
          meta: RECORRIDO_DEFINITION.meta
        },
        'script:import',
        client
      );
      
      await client.query('COMMIT');
    }
    
    // ========================================================================
    // PASO 4: Mostrar resumen
    // ========================================================================
    console.log('\n' + '='.repeat(70));
    console.log('✅ IMPORTACIÓN COMPLETADA');
    console.log('='.repeat(70));
    console.log('\n📊 RESUMEN DEL RECORRIDO:');
    console.log(`   ID: ${RECORRIDO_DEFINITION.id}`);
    console.log(`   Nombre: ${RECORRIDO_DEFINITION.meta?.name}`);
    console.log(`   Objetivo: ${RECORRIDO_DEFINITION.meta?.objective}`);
    console.log(`   Tags: ${RECORRIDO_DEFINITION.meta?.tags?.join(', ')}`);
    console.log(`   Steps: ${Object.keys(RECORRIDO_DEFINITION.steps).length}`);
    console.log(`   Edges: ${RECORRIDO_DEFINITION.edges.length}`);
    console.log(`   Status: DRAFT (no publicado)`);
    
    console.log('\n📋 STEPS:');
    Object.entries(RECORRIDO_DEFINITION.steps).forEach(([stepId, step], idx) => {
      const isPlaceholder = step.props?.body?.includes('Placeholder');
      console.log(`   ${idx + 1}. ${stepId}`);
      console.log(`      Screen: ${step.screen_template_id}`);
      console.log(`      Título: ${step.props?.title || '(sin título)'}`);
      if (isPlaceholder) {
        console.log(`      ⚠️  PLACEHOLDER`);
      }
    });
    
    console.log('\n🔗 EDGES (flujo lineal):');
    RECORRIDO_DEFINITION.edges.forEach((edge, idx) => {
      console.log(`   ${idx + 1}. ${edge.from_step_id} → ${edge.to_step_id} (${edge.condition.type})`);
    });
    
    console.log('\n📍 Accede al recorrido en:');
    console.log('   /admin/recorridos');
    console.log(`   /admin/recorridos/editar/${RECORRIDO_DEFINITION.id}`);
    
    console.log('\n⚠️  NOTA: El recorrido está en DRAFT. NO se ha publicado.');
    console.log('   Publish BLOQUEARÁ si faltan campos obligatorios en video/audio.');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ ERROR durante la importación:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar
importRecorrido().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});

