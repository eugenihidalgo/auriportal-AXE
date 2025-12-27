// src/core/automations/automation-engine-v2.js
// Automation Engine Canónico v2 (Fase D - Fase 4)
//
// PRINCIPIOS CONSTITUCIONALES:
// - Ejecuta automatizaciones definidas en PostgreSQL
// - Consume definiciones, NO UI
// - Ejecuta SOLO acciones registradas en Action Registry
// - Registra ejecuciones (runs y steps)
// - Implementa deduplicación / idempotencia
// - Está APAGADO POR FEATURE FLAG
//
// RELACIÓN CON CONTRATOS:
// - Contrato D: Las automatizaciones ejecutan acciones registradas (no código inline)
// - Contrato B: Las acciones usan servicios canónicos (no mutación directa)
//
// ESTADO: Fase 4 - Automation Engine Canónico (NO consume señales todavía)

import { isFeatureEnabled } from '../flags/feature-flags.js';
import { getActiveAutomationsForSignal } from '../../infra/repos/automation-definitions-repo-pg.js';
import { createRun, updateRun } from '../../infra/repos/automation-runs-repo-pg.js';
import { createStep, updateStep } from '../../infra/repos/automation-run-steps-repo-pg.js';
import { calculateDedupKey, existsDedup, registerDedup } from './automation-dedup.js';
import { getAction, validateActionInput } from '../actions/automation-action-registry.js';

/**
 * Ejecuta automatizaciones para una señal emitida
 * 
 * ⚠️ NOTA: Aunque reciba signal, NO está integrado todavía con signal-dispatcher.
 * Esta función será llamada manualmente más adelante (Fase 5).
 * 
 * @param {Object} signal - Señal emitida
 * @param {string} signal.signal_id - ID único de la señal
 * @param {string} signal.signal_type - Tipo de señal (ej: 'student.practice_registered')
 * @param {Object} signal.payload - Payload de la señal
 * @param {Object} signal.metadata - Metadatos adicionales
 * @returns {Promise<Object>} Resumen de ejecución
 */
export async function runAutomationsForSignal(signal) {
  const { signal_id, signal_type, payload = {}, metadata = {} } = signal;

  // ============================================================================
  // 1. VERIFICAR FEATURE FLAG
  // ============================================================================
  const flagEnabled = isFeatureEnabled('AUTOMATIONS_ENGINE_ENABLED');
  
  if (!flagEnabled) {
    console.log('[AUTOMATION_ENGINE_V2] Feature flag OFF - no ejecutando automatizaciones');
    return {
      ok: true,
      skipped: true,
      reason: 'feature_flag_off',
      signal_id,
      signal_type
    };
  }

  console.log(`[AUTOMATION_ENGINE_V2] Iniciando ejecución para signal_id=${signal_id}, signal_type=${signal_type}`);

  const summary = {
    ok: true,
    signal_id,
    signal_type,
    runs: [],
    errors: []
  };

  try {
    // ============================================================================
    // 2. RESOLVER AUTOMATIZACIONES ACTIVAS
    // ============================================================================
    const automations = await getActiveAutomationsForSignal(signal_type);

    if (automations.length === 0) {
      console.log(`[AUTOMATION_ENGINE_V2] No hay automatizaciones activas para signal_type=${signal_type}`);
      return summary;
    }

    console.log(`[AUTOMATION_ENGINE_V2] Encontradas ${automations.length} automatizaciones activas`);

    // ============================================================================
    // 3. PROCESAR CADA AUTOMATIZACIÓN
    // ============================================================================
    for (const automation of automations) {
      try {
        const runResult = await processAutomation(automation, signal);
        summary.runs.push(runResult);
        
        if (!runResult.ok) {
          summary.ok = false;
          summary.errors.push({
            automation_key: automation.automation_key,
            error: runResult.error
          });
        }
      } catch (error) {
        console.error(`[AUTOMATION_ENGINE_V2] Error procesando automation=${automation.automation_key}:`, error.message);
        summary.ok = false;
        summary.errors.push({
          automation_key: automation.automation_key,
          error: error.message
        });
      }
    }

    console.log(`[AUTOMATION_ENGINE_V2] Finalizado: ${summary.runs.length} runs, ${summary.errors.length} errores`);

    return summary;
  } catch (error) {
    console.error('[AUTOMATION_ENGINE_V2] Error crítico:', error.message);
    summary.ok = false;
    summary.errors.push({
      automation_key: 'unknown',
      error: `Error crítico: ${error.message}`
    });
    return summary;
  }
}

/**
 * Procesa una automatización individual
 * 
 * @param {Object} automation - Definición de automatización
 * @param {Object} signal - Señal emitida
 * @returns {Promise<Object>} Resultado del run
 */
async function processAutomation(automation, signal) {
  const { signal_id, signal_type, payload = {}, metadata = {} } = signal;
  const { id: automation_id, automation_key, definition } = automation;

  // ============================================================================
  // 1. CALCULAR Y VERIFICAR DEDUPE
  // ============================================================================
  const dedupKey = calculateDedupKey(signal_id, automation_key);
  const alreadyExecuted = await existsDedup(dedupKey);

  if (alreadyExecuted) {
    console.log(`[AUTOMATION_ENGINE_V2] Dedupe detectado para automation=${automation_key}, signal_id=${signal_id} - SKIP`);
    return {
      ok: true,
      automation_key,
      status: 'skipped',
      reason: 'dedupe'
    };
  }

  // ============================================================================
  // 2. CREAR REGISTRO DE RUN
  // ============================================================================
  let run;
  try {
    run = await createRun({
      automation_id,
      automation_key,
      signal_id,
      signal_type,
      status: 'running',
      meta: {
        trace_id: metadata.trace_id || null,
        actor: metadata.actor || null
      }
    });
    console.log(`[AUTOMATION_ENGINE_V2] Run creado: ${run.id} para automation=${automation_key}`);
  } catch (error) {
    console.error(`[AUTOMATION_ENGINE_V2] Error creando run para automation=${automation_key}:`, error.message);
    return {
      ok: false,
      automation_key,
      status: 'failed',
      error: `Error creando run: ${error.message}`
    };
  }

  // ============================================================================
  // 3. EJECUTAR STEPS
  // ============================================================================
  const steps = definition.steps || [];
  const parallelGroups = definition.parallel_groups || [];

  let runStatus = 'success';
  let runError = null;

  try {
    // Si hay parallel_groups, ejecutar grupos en paralelo
    if (parallelGroups.length > 0) {
      await executeParallelGroups(parallelGroups, steps, signal, run.id);
    } else {
      // Ejecutar steps secuencialmente
      await executeStepsSequential(steps, signal, run.id);
    }
  } catch (error) {
    console.error(`[AUTOMATION_ENGINE_V2] Error ejecutando steps para run=${run.id}:`, error.message);
    runStatus = 'failed';
    runError = error.message;
  }

  // ============================================================================
  // 4. ACTUALIZAR RUN
  // ============================================================================
  try {
    await updateRun(run.id, {
      status: runStatus,
      error: runError
    });
  } catch (error) {
    console.error(`[AUTOMATION_ENGINE_V2] Error actualizando run=${run.id}:`, error.message);
  }

  // ============================================================================
  // 5. REGISTRAR DEDUPE SI FUE EXITOSO
  // ============================================================================
  if (runStatus === 'success') {
    try {
      await registerDedup(dedupKey);
      console.log(`[AUTOMATION_ENGINE_V2] Dedupe registrado para automation=${automation_key}, signal_id=${signal_id}`);
    } catch (error) {
      console.error(`[AUTOMATION_ENGINE_V2] Error registrando dedupe:`, error.message);
      // No fallar el run por esto
    }
  }

  return {
    ok: runStatus === 'success',
    automation_key,
    run_id: run.id,
    status: runStatus,
    error: runError
  };
}

/**
 * Ejecuta steps secuencialmente
 * 
 * @param {Array} steps - Array de steps
 * @param {Object} signal - Señal emitida
 * @param {string} runId - ID del run
 */
async function executeStepsSequential(steps, signal, runId) {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepIndex = i;

    try {
      await executeStep(step, signal, runId, stepIndex);
    } catch (error) {
      // Si onError es 'continue', continuar con el siguiente step
      if (step.onError === 'continue') {
        console.warn(`[AUTOMATION_ENGINE_V2] Step ${stepIndex} falló pero continuando (onError=continue):`, error.message);
        continue;
      }
      // Si onError es 'skip', saltar este step
      if (step.onError === 'skip') {
        console.warn(`[AUTOMATION_ENGINE_V2] Step ${stepIndex} saltado (onError=skip):`, error.message);
        continue;
      }
      // Por defecto, fallar el run
      throw error;
    }
  }
}

/**
 * Ejecuta grupos paralelos
 * 
 * @param {Array} parallelGroups - Array de grupos paralelos
 * @param {Array} allSteps - Todos los steps
 * @param {Object} signal - Señal emitida
 * @param {string} runId - ID del run
 */
async function executeParallelGroups(parallelGroups, allSteps, signal, runId) {
  // Ejecutar cada grupo en paralelo
  const groupPromises = parallelGroups.map(async (group, groupIndex) => {
    const groupSteps = group.steps || [];
    
    // Ejecutar steps del grupo en paralelo
    const stepPromises = groupSteps.map(async (stepIndex) => {
      const step = allSteps[stepIndex];
      if (!step) {
        throw new Error(`Step index ${stepIndex} no existe`);
      }
      return executeStep(step, signal, runId, stepIndex);
    });

    await Promise.all(stepPromises);
  });

  await Promise.all(groupPromises);
}

/**
 * Ejecuta un step individual
 * 
 * @param {Object} step - Definición del step
 * @param {Object} signal - Señal emitida
 * @param {string} runId - ID del run
 * @param {number} stepIndex - Índice del step
 */
async function executeStep(step, signal, runId, stepIndex) {
  const { actionKey, inputTemplate, onError = 'fail' } = step;

  console.log(`[AUTOMATION_ENGINE_V2] Ejecutando step ${stepIndex}: actionKey=${actionKey}`);

  // ============================================================================
  // 1. VALIDAR QUE LA ACCIÓN EXISTE
  // ============================================================================
  const action = getAction(actionKey);
  if (!action) {
    throw new Error(`Acción no registrada: ${actionKey}`);
  }

  // ============================================================================
  // 2. RESOLVER INPUT DESDE TEMPLATE
  // ============================================================================
  const resolvedInput = resolveInputTemplate(inputTemplate, signal);

  // ============================================================================
  // 3. VALIDAR INPUT
  // ============================================================================
  const validation = validateActionInput(actionKey, resolvedInput);
  if (!validation.valid) {
    throw new Error(`Input inválido para acción ${actionKey}: ${validation.errors.join(', ')}`);
  }

  // ============================================================================
  // 4. CREAR REGISTRO DE STEP
  // ============================================================================
  let stepRecord;
  try {
    stepRecord = await createStep({
      run_id: runId,
      step_index: stepIndex,
      action_key: actionKey,
      status: 'running',
      input: resolvedInput
    });
  } catch (error) {
    throw new Error(`Error creando step: ${error.message}`);
  }

  // ============================================================================
  // 5. EJECUTAR ACCIÓN
  // ============================================================================
  let stepStatus = 'success';
  let stepOutput = null;
  let stepError = null;

  try {
    stepOutput = await action.handler(resolvedInput);
    console.log(`[AUTOMATION_ENGINE_V2] Step ${stepIndex} ejecutado exitosamente`);
  } catch (error) {
    console.error(`[AUTOMATION_ENGINE_V2] Step ${stepIndex} falló:`, error.message);
    stepStatus = 'failed';
    stepError = error.message;
    
    // Si onError es 'fail', lanzar el error
    if (onError === 'fail') {
      throw error;
    }
  }

  // ============================================================================
  // 6. ACTUALIZAR STEP
  // ============================================================================
  try {
    await updateStep(stepRecord.id, {
      status: stepStatus,
      output: stepOutput,
      error: stepError
    });
  } catch (error) {
    console.error(`[AUTOMATION_ENGINE_V2] Error actualizando step=${stepRecord.id}:`, error.message);
  }

  // Si el step falló y onError no es 'continue' ni 'skip', lanzar error
  if (stepStatus === 'failed' && onError === 'fail') {
    throw new Error(stepError || 'Step falló');
  }
}

/**
 * Resuelve un template de input usando variables de la señal
 * 
 * @param {Object} inputTemplate - Template de input
 * @param {Object} signal - Señal emitida
 * @returns {Object} Input resuelto
 */
function resolveInputTemplate(inputTemplate, signal) {
  const { payload = {}, metadata = {} } = signal;
  const resolved = {};

  for (const [key, value] of Object.entries(inputTemplate)) {
    if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
      // Variable template: {{payload.entity.email}}
      const path = value.slice(2, -2).trim();
      const pathParts = path.split('.');
      
      let resolvedValue = null;
      if (pathParts[0] === 'payload') {
        resolvedValue = pathParts.slice(1).reduce((obj, part) => obj?.[part], payload);
      } else if (pathParts[0] === 'metadata') {
        resolvedValue = pathParts.slice(1).reduce((obj, part) => obj?.[part], metadata);
      }

      resolved[key] = resolvedValue !== undefined ? resolvedValue : null;
    } else {
      // Valor literal
      resolved[key] = value;
    }
  }

  return resolved;
}




