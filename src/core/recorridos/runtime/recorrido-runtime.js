// src/core/recorridos/runtime/recorrido-runtime.js
// Motor Runtime de Recorridos para Alumnos
// Ejecuta recorridos publicados (versiones INMUTABLES)
//
// PRINCIPIOS:
// - Runtime solo ejecuta versiones PUBLICADAS e INMUTABLES
// - Conditions son funciones puras y deterministas (solo leen state_json + ctx)
// - Runtime nunca ejecuta draft, solo published
// - Logs: [RecorridoRuntime]

import { getDefaultRecorridoVersionRepo } from '../../../infra/repos/recorrido-version-repo-pg.js';
import { getDefaultRecorridoRunRepo } from '../../../infra/repos/recorrido-run-repo-pg.js';
import { getDefaultRecorridoStepResultRepo } from '../../../infra/repos/recorrido-step-result-repo-pg.js';
import { getDefaultRecorridoEventRepo } from '../../../infra/repos/recorrido-event-repo-pg.js';
import * as conditionRegistry from '../../registry/condition-registry.js';
import * as eventRegistry from '../../registry/event-registry.js';
import * as screenTemplateRegistry from '../../registry/screen-template-registry.js';
import { logInfo, logWarn, logError } from '../../observability/logger.js';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Step Handlers específicos (integración conservadora)
import * as limpiezaEnergeticaHandler from '../step-handlers/limpieza-energetica-handler.js';
import * as selectionHandler from '../step-handlers/selection-handler.js';
import * as practiceTimerHandler from '../step-handlers/practice-timer-handler.js';

// Inicializar Ajv para validación de payloads
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

/**
 * Resuelve variables en un template string
 * Variables disponibles: {{user_id}}, {{run_id}}, {{state.xxx}}, {{step_id}}, etc.
 * 
 * @param {string} template - Template string con variables
 * @param {Object} context - Contexto con variables disponibles
 * @returns {string} String resuelto
 */
function resolveTemplate(template, context) {
  if (typeof template !== 'string') {
    return template;
  }
  
  let resolved = template;
  
  // Resolver {{user_id}}
  if (context.user_id) {
    resolved = resolved.replace(/\{\{user_id\}\}/g, context.user_id);
  }
  
  // Resolver {{run_id}}
  if (context.run_id) {
    resolved = resolved.replace(/\{\{run_id\}\}/g, context.run_id);
  }
  
  // Resolver {{step_id}}
  if (context.step_id) {
    resolved = resolved.replace(/\{\{step_id\}\}/g, context.step_id);
  }
  
  // Resolver {{recorrido_id}}
  if (context.recorrido_id) {
    resolved = resolved.replace(/\{\{recorrido_id\}\}/g, context.recorrido_id);
  }
  
  // Resolver {{state.xxx}}
  if (context.state) {
    for (const [key, value] of Object.entries(context.state)) {
      const regex = new RegExp(`\\{\\{state\\.${key}\\}\\}`, 'g');
      resolved = resolved.replace(regex, String(value));
    }
  }
  
  return resolved;
}

/**
 * Resuelve variables en un objeto (recursivo)
 * 
 * @param {Object} obj - Objeto con posibles templates
 * @param {Object} context - Contexto con variables disponibles
 * @returns {Object} Objeto con variables resueltas
 */
function resolveTemplateObject(obj, context) {
  if (typeof obj === 'string') {
    return resolveTemplate(obj, context);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => resolveTemplateObject(item, context));
  }
  
  if (obj && typeof obj === 'object') {
    const resolved = {};
    for (const [key, value] of Object.entries(obj)) {
      resolved[key] = resolveTemplateObject(value, context);
    }
    return resolved;
  }
  
  return obj;
}

/**
 * Evalúa una condición usando ConditionRegistry
 * 
 * @param {Object} condition - Condición a evaluar { type, params }
 * @param {Object} state - Estado del run (state_json)
 * @param {Object} ctx - Contexto del usuario
 * @returns {boolean} true si la condición se cumple
 */
function evaluateCondition(condition, state, ctx) {
  if (!condition || !condition.type) {
    logWarn('RecorridoRuntime', 'Condición inválida (sin type)', { condition });
    return false;
  }
  
  const conditionType = conditionRegistry.getById(condition.type);
  if (!conditionType) {
    logWarn('RecorridoRuntime', `Condition type no encontrado: ${condition.type}`, {
      condition_type: condition.type
    });
    return false;
  }
  
  const params = condition.params || {};
  
  // Evaluar según el tipo
  switch (condition.type) {
    case 'always':
      return true;
      
    case 'field_exists':
      const field = params.field;
      if (!field) {
        logWarn('RecorridoRuntime', 'field_exists sin field', { params });
        return false;
      }
      // Buscar en state primero, luego en ctx
      const value = state[field] !== undefined ? state[field] : ctx[field];
      return value !== undefined && value !== null;
      
    case 'field_equals':
      const fieldName = params.field;
      const expectedValue = params.value;
      if (!fieldName || expectedValue === undefined) {
        logWarn('RecorridoRuntime', 'field_equals sin field o value', { params });
        return false;
      }
      // Buscar en state primero, luego en ctx
      const actualValue = state[fieldName] !== undefined ? state[fieldName] : ctx[fieldName];
      return actualValue === expectedValue;
      
    default:
      logWarn('RecorridoRuntime', `Condition type no implementado: ${condition.type}`, {
        condition_type: condition.type
      });
      return false;
  }
}

/**
 * Calcula el siguiente step según edges y conditions
 * 
 * @param {string} current_step_id - ID del step actual
 * @param {Array} edges - Lista de edges del recorrido
 * @param {Object} state - Estado del run
 * @param {Object} ctx - Contexto del usuario
 * @returns {string|null} ID del siguiente step o null si no hay
 */
function calculateNextStep(current_step_id, edges, state, ctx) {
  // Filtrar edges que salen del step actual
  const outgoingEdges = edges.filter(edge => edge.from_step_id === current_step_id);
  
  if (outgoingEdges.length === 0) {
    logInfo('RecorridoRuntime', 'No hay edges salientes del step actual', {
      current_step_id
    });
    return null; // No hay siguiente step (recorrido completado)
  }
  
  // Evaluar edges en orden determinista (orden de definición)
  for (const edge of outgoingEdges) {
    const condition = edge.condition || { type: 'always' };
    const matches = evaluateCondition(condition, state, ctx);
    
    if (matches) {
      logInfo('RecorridoRuntime', 'Edge match encontrado', {
        from_step_id: current_step_id,
        to_step_id: edge.to_step_id,
        condition_type: condition.type
      });
      return edge.to_step_id;
    }
  }
  
  // Ningún edge coincide (error controlado)
  logWarn('RecorridoRuntime', 'Ningún edge coincide, recorrido bloqueado', {
    current_step_id,
    edges_count: outgoingEdges.length
  });
  return null;
}

/**
 * Construye renderSpec de un step
 * 
 * @param {Object} step - Step definition
 * @param {string} step_id - ID del step
 * @param {Object} [run] - Run actual (opcional, para handlers específicos)
 * @param {Object} [ctx] - Contexto del usuario (opcional, para handlers específicos)
 * @returns {Promise<Object>} RenderSpec { step_id, step_type, screen_template_id, props, uiHints? }
 */
async function buildRenderSpec(step, step_id, run = null, ctx = null) {
  let renderSpec = {
    step_id,
    step_type: step.step_type || 'experience',
    screen_template_id: step.screen_template_id,
    props: step.props || {},
    uiHints: step.uiHints || {}
  };
  
  // HOOK: Enriquecer renderSpec con handler específico si aplica
  // Step "limpieza_energetica": añade bundle de transmutaciones
  if (limpiezaEnergeticaHandler.canHandle(step_id) && run && ctx) {
    try {
      renderSpec = limpiezaEnergeticaHandler.enhanceRenderSpec(renderSpec, run, ctx);
      logInfo('RecorridoRuntime', 'RenderSpec enriquecido por handler', {
        step_id,
        handler: 'limpiezaEnergeticaHandler'
      }, true);
    } catch (err) {
      // Fail-open: si el handler falla, usar renderSpec base
      logWarn('RecorridoRuntime', 'Error en handler de step, usando renderSpec base', {
        step_id,
        handler: 'limpiezaEnergeticaHandler',
        error: err.message
      });
    }
  }
  
  // Step de selección (preparacion_seleccion, protecciones_energeticas, post_limpieza_seleccion)
  if (selectionHandler.canHandle(step_id) && run && ctx) {
    try {
      // enhanceRenderSpec es async para selectionHandler
      renderSpec = await selectionHandler.enhanceRenderSpec(renderSpec, run, ctx);
      logInfo('RecorridoRuntime', 'RenderSpec enriquecido por handler', {
        step_id,
        handler: 'selectionHandler'
      }, true);
    } catch (err) {
      logWarn('RecorridoRuntime', 'Error en handler de step, usando renderSpec base', {
        step_id,
        handler: 'selectionHandler',
        error: err.message
      });
    }
  }
  
  // Step de práctica con timer (preparacion_practica, post_limpieza_practica)
  if (practiceTimerHandler.canHandle(step_id) && run && ctx) {
    try {
      renderSpec = practiceTimerHandler.enhanceRenderSpec(renderSpec, run, ctx);
      logInfo('RecorridoRuntime', 'RenderSpec enriquecido por handler', {
        step_id,
        handler: 'practiceTimerHandler'
      }, true);
    } catch (err) {
      logWarn('RecorridoRuntime', 'Error en handler de step, usando renderSpec base', {
        step_id,
        handler: 'practiceTimerHandler',
        error: err.message
      });
    }
  }
  
  return renderSpec;
}

/**
 * Aplica CAPTURE declarativo del step al state
 * 
 * @param {Object} step - Step definition
 * @param {Object} input - Input del usuario
 * @param {Object} currentState - Estado actual del run
 * @returns {Object} Nuevo estado (merge)
 */
function applyCapture(step, input, currentState) {
  const capture = step.capture;
  if (!capture) {
    // No hay capture, retornar estado sin cambios
    return currentState;
  }
  
  const newState = { ...currentState };
  
  // Si capture es un objeto, mapear campos
  if (typeof capture === 'object' && !Array.isArray(capture)) {
    for (const [targetField, sourceField] of Object.entries(capture)) {
      if (input[sourceField] !== undefined) {
        newState[targetField] = input[sourceField];
      }
    }
  } else if (Array.isArray(capture)) {
    // Si capture es un array, copiar campos directamente
    for (const field of capture) {
      if (input[field] !== undefined) {
        newState[field] = input[field];
      }
    }
  } else if (typeof capture === 'string') {
    // Si capture es un string, copiar ese campo
    if (input[capture] !== undefined) {
      newState[capture] = input[capture];
    }
  }
  
  return newState;
}

/**
 * Valida payload de evento contra EventRegistry
 * 
 * @param {string} event_type - Tipo de evento
 * @param {Object} payload - Payload a validar
 * @returns {{ valid: boolean, errors: Array }} Resultado de validación
 */
function validateEventPayload(event_type, payload) {
  const eventType = eventRegistry.getById(event_type);
  if (!eventType) {
    return { valid: false, errors: [`Event type no encontrado: ${event_type}`] };
  }
  
  const schema = eventType.payload_schema;
  if (!schema) {
    // Sin schema, aceptar cualquier payload
    return { valid: true, errors: [] };
  }
  
  const validate = ajv.compile(schema);
  const valid = validate(payload);
  
  if (!valid) {
    return { valid: false, errors: validate.errors.map(e => e.message) };
  }
  
  return { valid: true, errors: [] };
}

/**
 * 1. startRun({ctx, recorrido_id})
 * 
 * Crea un nuevo run de un recorrido publicado.
 * 
 * @param {Object} params - Parámetros
 * @param {Object} params.ctx - Contexto del usuario (de requireStudentContext)
 * @param {string} params.recorrido_id - ID del recorrido
 * @returns {Promise<{run_id, step}>} Run creado y renderSpec del step inicial
 */
export async function startRun({ ctx, recorrido_id }) {
  const user_id = ctx.user?.email || ctx.user?.id || null;
  if (!user_id) {
    throw new Error('Contexto de usuario inválido: falta user_id');
  }
  
  logInfo('RecorridoRuntime', 'Iniciando run', {
    recorrido_id,
    user_id
  });
  
  // Cargar última versión publicada del recorrido
  const versionRepo = getDefaultRecorridoVersionRepo();
  const version = await versionRepo.getLatestVersion(recorrido_id);
  
  if (!version) {
    throw new Error(`No hay versión publicada para recorrido: ${recorrido_id}`);
  }
  
  if (version.status !== 'published') {
    throw new Error(`Versión no está publicada: ${recorrido_id} v${version.version}`);
  }
  
  const definition = version.definition_json;
  const entry_step_id = definition.entry_step_id;
  
  if (!entry_step_id || !definition.steps || !definition.steps[entry_step_id]) {
    throw new Error(`entry_step_id inválido: ${entry_step_id}`);
  }
  
  // Crear run
  const runRepo = getDefaultRecorridoRunRepo();
  const run = await runRepo.createRun({
    user_id,
    recorrido_id,
    version: version.version,
    entry_step_id
  });
  
  // Emitir evento analytics: recorrido_started
  const eventRepo = getDefaultRecorridoEventRepo();
  const startPayload = {
    recorrido_id,
    user_id,
    timestamp: new Date().toISOString()
  };
  
  const validation = validateEventPayload('recorrido_started', startPayload);
  if (validation.valid) {
    await eventRepo.appendEvent({
      run_id: run.run_id,
      user_id,
      event_type: 'recorrido_started',
      payload_json: startPayload
    });
  } else {
    logWarn('RecorridoRuntime', 'Payload de recorrido_started inválido', {
      errors: validation.errors
    });
  }
  
  // Construir renderSpec del step inicial
  const entryStep = definition.steps[entry_step_id];
  const step = await buildRenderSpec(entryStep, entry_step_id);
  
  logInfo('RecorridoRuntime', 'Run iniciado exitosamente', {
    run_id: run.run_id,
    recorrido_id,
    version: version.version,
    entry_step_id
  });
  
  return {
    run_id: run.run_id,
    step
  };
}

/**
 * 2. getCurrentStep({ctx, run_id})
 * 
 * Obtiene el step actual y su renderSpec.
 * 
 * @param {Object} params - Parámetros
 * @param {Object} params.ctx - Contexto del usuario
 * @param {string} params.run_id - UUID del run
 * @returns {Promise<{run, step}>} Run y renderSpec del step actual
 */
export async function getCurrentStep({ ctx, run_id }) {
  const user_id = ctx.user?.email || ctx.user?.id || null;
  if (!user_id) {
    throw new Error('Contexto de usuario inválido: falta user_id');
  }
  
  // Cargar run
  const runRepo = getDefaultRecorridoRunRepo();
  const run = await runRepo.getRunById(run_id);
  
  if (!run) {
    throw new Error(`Run no encontrado: ${run_id}`);
  }
  
  // Autorizar: run.user_id == ctx.user.id
  if (run.user_id !== user_id) {
    throw new Error('No autorizado: run pertenece a otro usuario');
  }
  
  if (run.status !== 'in_progress') {
    throw new Error(`Run no está en progreso: ${run.status}`);
  }
  
  // Cargar definition por (recorrido_id, version)
  const versionRepo = getDefaultRecorridoVersionRepo();
  const version = await versionRepo.getVersion(run.recorrido_id, run.version);
  
  if (!version) {
    throw new Error(`Versión no encontrada: ${run.recorrido_id} v${run.version}`);
  }
  
  const definition = version.definition_json;
  const currentStepId = run.current_step_id;
  
  if (!definition.steps || !definition.steps[currentStepId]) {
    throw new Error(`Step no encontrado: ${currentStepId}`);
  }
  
  // Construir renderSpec (con run y ctx para handlers específicos)
  const currentStep = definition.steps[currentStepId];
  const step = await buildRenderSpec(currentStep, currentStepId, run, ctx);
  
  // Emitir step_viewed (con idempotency para no spamear si refresca)
  const eventRepo = getDefaultRecorridoEventRepo();
  const viewPayload = {
    recorrido_id: run.recorrido_id,
    step_id: currentStepId,
    user_id,
    timestamp: new Date().toISOString()
  };
  
  const validation = validateEventPayload('step_viewed', viewPayload);
  if (validation.valid) {
    const idempotencyKey = `${run_id}:${currentStepId}:view`;
    await eventRepo.appendEvent({
      run_id,
      user_id,
      event_type: 'step_viewed',
      payload_json: viewPayload,
      idempotency_key: idempotencyKey
    });
  }
  
  // Touch run (actualizar last_activity_at)
  await runRepo.touchRun(run_id);
  
  return {
    run,
    step
  };
}

/**
 * 3. submitStep({ctx, run_id, step_id, input})
 * 
 * Procesa la respuesta de un step y avanza al siguiente.
 * 
 * @param {Object} params - Parámetros
 * @param {Object} params.ctx - Contexto del usuario
 * @param {string} params.run_id - UUID del run
 * @param {string} params.step_id - ID del step a completar
 * @param {Object} params.input - Input del usuario
 * @returns {Promise<{run, step}>} Run actualizado y renderSpec del siguiente step
 */
export async function submitStep({ ctx, run_id, step_id, input }) {
  const user_id = ctx.user?.email || ctx.user?.id || null;
  if (!user_id) {
    throw new Error('Contexto de usuario inválido: falta user_id');
  }
  
  logInfo('RecorridoRuntime', 'Submitting step', {
    run_id,
    step_id,
    user_id
  });
  
  // Cargar run
  const runRepo = getDefaultRecorridoRunRepo();
  const run = await runRepo.getRunById(run_id);
  
  if (!run) {
    throw new Error(`Run no encontrado: ${run_id}`);
  }
  
  // Autorizar
  if (run.user_id !== user_id) {
    throw new Error('No autorizado: run pertenece a otro usuario');
  }
  
  if (run.status !== 'in_progress') {
    throw new Error(`Run no está en progreso: ${run.status}`);
  }
  
  // Verificar step_id coincide con current_step_id
  if (run.current_step_id !== step_id) {
    throw new Error(`Step ID no coincide: esperado ${run.current_step_id}, recibido ${step_id}`);
  }
  
  // Cargar definition
  const versionRepo = getDefaultRecorridoVersionRepo();
  const version = await versionRepo.getVersion(run.recorrido_id, run.version);
  
  if (!version) {
    throw new Error(`Versión no encontrada: ${run.recorrido_id} v${run.version}`);
  }
  
  const definition = version.definition_json;
  const currentStep = definition.steps[step_id];
  
  if (!currentStep) {
    throw new Error(`Step no encontrado: ${step_id}`);
  }
  
  // Aplicar CAPTURE declarativo del step
  const newState = applyCapture(currentStep, input, run.state_json || {});
  
  // Append step_result
  const stepResultRepo = getDefaultRecorridoStepResultRepo();
  await stepResultRepo.appendStepResult({
    run_id,
    step_id,
    captured_json: input,
    duration_ms: null // TODO: calcular si se proporciona
  });
  
  // Emitir step_completed
  const eventRepo = getDefaultRecorridoEventRepo();
  const completedPayload = {
    recorrido_id: run.recorrido_id,
    step_id,
    user_id,
    timestamp: new Date().toISOString(),
    completion_data: input
  };
  
  const validationCompleted = validateEventPayload('step_completed', completedPayload);
  if (validationCompleted.valid) {
    await eventRepo.appendEvent({
      run_id,
      user_id,
      event_type: 'step_completed',
      payload_json: completedPayload
    });
  }
  
  // Emitir eventos de dominio declarados en step.emit
  if (currentStep.emit && Array.isArray(currentStep.emit)) {
    for (const emitDef of currentStep.emit) {
      const emitEventType = emitDef.event_type;
      const emitPayloadTemplate = emitDef.payload_template || {};
      
      // Resolver variables en payload_template
      const context = {
        user_id,
        run_id,
        step_id,
        recorrido_id: run.recorrido_id,
        state: newState
      };
      
      const resolvedPayload = resolveTemplateObject(emitPayloadTemplate, context);
      
      // Validar payload contra EventRegistry
      const emitValidation = validateEventPayload(emitEventType, resolvedPayload);
      if (emitValidation.valid) {
        await eventRepo.appendEvent({
          run_id,
          user_id,
          event_type: emitEventType,
          payload_json: resolvedPayload
        });
      } else {
        logWarn('RecorridoRuntime', `Payload de evento de dominio inválido: ${emitEventType}`, {
          errors: emitValidation.errors,
          step_id
        });
      }
    }
  }
  
  // HOOK: Ejecutar lógica post-submit de handlers específicos
  // Step "limpieza_energetica": valida input, ejecuta checkDailyStreak si aplica
  let finalState = newState;
  if (limpiezaEnergeticaHandler.canHandle(step_id)) {
    try {
      // Validar input con el handler
      const validation = limpiezaEnergeticaHandler.validateInput(input, run);
      if (!validation.valid && validation.errors.some(e => !e.includes('No hay transmutaciones'))) {
        logWarn('RecorridoRuntime', 'Input inválido para step limpieza_energetica', {
          step_id,
          errors: validation.errors
        });
        // NO bloqueamos, continuamos con input sanitizado
      }
      
      // Ejecutar lógica post-submit (checkDailyStreak si limpieza_completada)
      // NOTA: ctx aquí es el contexto del usuario (necesita env para checkDailyStreak)
      // Necesitamos pasar env desde el endpoint
      const handlerResult = await limpiezaEnergeticaHandler.handlePostSubmit({
        step: currentStep,
        input: validation.sanitizedInput,
        run,
        ctx,
        env: ctx.env || {} // El endpoint debe incluir env en ctx
      });
      
      // Merge state updates del handler
      if (handlerResult.stateUpdates) {
        finalState = { ...finalState, ...handlerResult.stateUpdates };
        logInfo('RecorridoRuntime', 'State actualizado por handler', {
          step_id,
          handler: 'limpiezaEnergeticaHandler',
          streak_result: !!handlerResult.streakResult
        }, true);
      }
    } catch (handlerError) {
      // Fail-open: si el handler falla, continuar sin bloquear
      logError('RecorridoRuntime', 'Error en handler post-submit, continuando', {
        step_id,
        handler: 'limpiezaEnergeticaHandler',
        error: handlerError.message
      });
    }
  }
  
  // Step de selección (preparacion_seleccion, protecciones_energeticas, post_limpieza_seleccion)
  if (selectionHandler.canHandle(step_id)) {
    try {
      const validation = selectionHandler.validateInput(input, run);
      const handlerResult = await selectionHandler.handlePostSubmit({
        step: currentStep,
        input: validation.sanitizedInput,
        run,
        ctx
      });
      
      if (handlerResult.stateUpdates) {
        finalState = { ...finalState, ...handlerResult.stateUpdates };
        logInfo('RecorridoRuntime', 'State actualizado por handler', {
          step_id,
          handler: 'selectionHandler'
        }, true);
      }
    } catch (handlerError) {
      logError('RecorridoRuntime', 'Error en handler post-submit, continuando', {
        step_id,
        handler: 'selectionHandler',
        error: handlerError.message
      });
    }
  }
  
  // Step de práctica con timer (preparacion_practica, post_limpieza_practica)
  if (practiceTimerHandler.canHandle(step_id)) {
    try {
      const validation = practiceTimerHandler.validateInput(input, run);
      const handlerResult = await practiceTimerHandler.handlePostSubmit({
        step: currentStep,
        input: validation.sanitizedInput,
        run,
        ctx
      });
      
      if (handlerResult.stateUpdates) {
        finalState = { ...finalState, ...handlerResult.stateUpdates };
        logInfo('RecorridoRuntime', 'State actualizado por handler', {
          step_id,
          handler: 'practiceTimerHandler'
        }, true);
      }
    } catch (handlerError) {
      logError('RecorridoRuntime', 'Error en handler post-submit, continuando', {
        step_id,
        handler: 'practiceTimerHandler',
        error: handlerError.message
      });
    }
  }
  
  // Calcular siguiente step
  const nextStepId = calculateNextStep(step_id, definition.edges || [], finalState, ctx);
  
  if (!nextStepId) {
    // No hay siguiente step: completar recorrido
    await runRepo.updateRun(run_id, {
      status: 'completed',
      completed_at: new Date(),
      state_json: finalState,
      current_step_id: step_id // Mantener el último step
    });
    
    // Emitir recorrido_completed
    const completedRecorridoPayload = {
      recorrido_id: run.recorrido_id,
      user_id,
      timestamp: new Date().toISOString()
    };
    
    const validationRecorridoCompleted = validateEventPayload('recorrido_completed', completedRecorridoPayload);
    if (validationRecorridoCompleted.valid) {
      await eventRepo.appendEvent({
        run_id,
        user_id,
        event_type: 'recorrido_completed',
        payload_json: completedRecorridoPayload
      });
    }
    
    logInfo('RecorridoRuntime', 'Recorrido completado', {
      run_id,
      recorrido_id: run.recorrido_id
    });
    
    return {
      run: await runRepo.getRunById(run_id),
      step: null // No hay siguiente step
    };
  }
  
  // Actualizar run con nuevo step y state
  await runRepo.updateRun(run_id, {
    current_step_id: nextStepId,
    state_json: finalState
  });
  
  // Construir renderSpec del siguiente step
  const nextStep = definition.steps[nextStepId];
  if (!nextStep) {
    throw new Error(`Siguiente step no encontrado: ${nextStepId}`);
  }
  
  const step = await buildRenderSpec(nextStep, nextStepId);
  
  logInfo('RecorridoRuntime', 'Step completado, avanzando', {
    run_id,
    from_step_id: step_id,
    to_step_id: nextStepId
  });
  
  return {
    run: await runRepo.getRunById(run_id),
    step
  };
}

/**
 * 4. abandonRun({ctx, run_id, reason})
 * 
 * Abandona un run.
 * 
 * @param {Object} params - Parámetros
 * @param {Object} params.ctx - Contexto del usuario
 * @param {string} params.run_id - UUID del run
 * @param {string} [params.reason] - Razón del abandono (opcional)
 * @returns {Promise<{ok: boolean}>} Resultado
 */
export async function abandonRun({ ctx, run_id, reason = null }) {
  const user_id = ctx.user?.email || ctx.user?.id || null;
  if (!user_id) {
    throw new Error('Contexto de usuario inválido: falta user_id');
  }
  
  // Cargar run
  const runRepo = getDefaultRecorridoRunRepo();
  const run = await runRepo.getRunById(run_id);
  
  if (!run) {
    throw new Error(`Run no encontrado: ${run_id}`);
  }
  
  // Autorizar
  if (run.user_id !== user_id) {
    throw new Error('No autorizado: run pertenece a otro usuario');
  }
  
  if (run.status !== 'in_progress') {
    throw new Error(`Run no está en progreso: ${run.status}`);
  }
  
  // Marcar run abandoned
  await runRepo.updateRun(run_id, {
    status: 'abandoned',
    abandoned_at: new Date()
  });
  
  // Emitir recorrido_abandoned
  const eventRepo = getDefaultRecorridoEventRepo();
  const abandonedPayload = {
    recorrido_id: run.recorrido_id,
    user_id,
    timestamp: new Date().toISOString(),
    last_step_id: run.current_step_id,
    abandonment_reason: reason
  };
  
  const validation = validateEventPayload('recorrido_abandoned', abandonedPayload);
  if (validation.valid) {
    await eventRepo.appendEvent({
      run_id,
      user_id,
      event_type: 'recorrido_abandoned',
      payload_json: abandonedPayload
    });
  }
  
  logInfo('RecorridoRuntime', 'Run abandonado', {
    run_id,
    recorrido_id: run.recorrido_id,
    reason
  });
  
  return { ok: true };
}

