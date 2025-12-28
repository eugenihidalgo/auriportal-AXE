// src/core/automations/automation-definition-validator.js
// Validator Canónico de Definiciones de Automatizaciones (Fase D - Fase 7)
//
// PRINCIPIOS CONSTITUCIONALES:
// - Este validator es el ÚNICO punto de validación antes de guardar definiciones
// - Validaciones duras (throw Error, no booleans silenciosos)
// - NO confía en frontend
// - Validación completa de estructura, action keys, y schema
//
// RELACIÓN CON CONTRATOS:
// - Contrato D: Las automatizaciones deben referenciar acciones registradas
// - Contrato Fase 7: Validación obligatoria antes de guardar
//
// ESTADO: Fase 7 - Validator Canónico

import { getAction, getAllActions } from '../actions/automation-action-registry.js';

// ============================================================================
// VALIDACIÓN DE DEFINICIÓN
// ============================================================================

/**
 * Valida una definición de automatización ANTES de guardar
 * 
 * @param {Object} definition - Definición JSON a validar
 * @param {Object} definition.trigger - Trigger de la automatización
 * @param {string} definition.trigger.signalType - Tipo de señal (ej: 'student.practice_registered')
 * @param {Array} definition.steps - Array de steps
 * @param {Array} [definition.parallel_groups] - Grupos paralelos (opcional)
 * @throws {Error} Si la definición es inválida (con mensaje descriptivo)
 */
export function validateAutomationDefinition(definition) {
  // Validar que es un objeto
  if (!definition || typeof definition !== 'object') {
    throw new Error('[AUTOMATION_VALIDATOR] Definition debe ser un objeto');
  }

  // Validar trigger
  validateTrigger(definition.trigger);

  // Validar steps
  validateSteps(definition.steps);

  // Validar parallel_groups (opcional)
  if (definition.parallel_groups !== undefined) {
    validateParallelGroups(definition.parallel_groups, definition.steps);
  }
}

/**
 * Valida el trigger de una automatización
 * 
 * @param {Object} trigger - Trigger a validar
 * @throws {Error} Si el trigger es inválido
 */
function validateTrigger(trigger) {
  if (!trigger || typeof trigger !== 'object') {
    throw new Error('[AUTOMATION_VALIDATOR] trigger es requerido y debe ser un objeto');
  }

  if (!trigger.signalType || typeof trigger.signalType !== 'string' || trigger.signalType.trim() === '') {
    throw new Error('[AUTOMATION_VALIDATOR] trigger.signalType es requerido y debe ser un string no vacío');
  }
}

/**
 * Valida los steps de una automatización
 * 
 * @param {Array} steps - Array de steps a validar
 * @throws {Error} Si los steps son inválidos
 */
function validateSteps(steps) {
  if (!Array.isArray(steps)) {
    throw new Error('[AUTOMATION_VALIDATOR] steps debe ser un array');
  }

  if (steps.length === 0) {
    throw new Error('[AUTOMATION_VALIDATOR] steps no puede estar vacío');
  }

  steps.forEach((step, index) => {
    validateStep(step, index);
  });
}

/**
 * Valida un step individual
 * 
 * @param {Object} step - Step a validar
 * @param {number} index - Índice del step (para mensajes de error)
 * @throws {Error} Si el step es inválido
 */
function validateStep(step, index) {
  if (!step || typeof step !== 'object') {
    throw new Error(`[AUTOMATION_VALIDATOR] steps[${index}] debe ser un objeto`);
  }

  // Validar action_key
  if (!step.action_key || typeof step.action_key !== 'string' || step.action_key.trim() === '') {
    throw new Error(`[AUTOMATION_VALIDATOR] steps[${index}].action_key es requerido y debe ser un string no vacío`);
  }

  // Validar que la acción existe en Action Registry
  const action = getAction(step.action_key);
  if (!action) {
    const availableActions = getAllActions().map(a => a.key).join(', ');
    throw new Error(`[AUTOMATION_VALIDATOR] steps[${index}].action_key "${step.action_key}" no existe en Action Registry. Acciones disponibles: ${availableActions || '(ninguna)'}`);
  }

  // Validar onError (opcional, pero si existe debe ser válido)
  if (step.onError !== undefined) {
    const validOnErrorValues = ['fail', 'continue', 'skip'];
    if (!validOnErrorValues.includes(step.onError)) {
      throw new Error(`[AUTOMATION_VALIDATOR] steps[${index}].onError debe ser uno de: ${validOnErrorValues.join(', ')}`);
    }
  }

  // Validar inputTemplate (opcional, pero si existe debe ser un objeto)
  if (step.inputTemplate !== undefined) {
    if (typeof step.inputTemplate !== 'object' || step.inputTemplate === null || Array.isArray(step.inputTemplate)) {
      throw new Error(`[AUTOMATION_VALIDATOR] steps[${index}].inputTemplate debe ser un objeto`);
    }
  }
}

/**
 * Valida los parallel_groups (opcional)
 * 
 * @param {Array} parallelGroups - Array de grupos paralelos
 * @param {Array} steps - Array de steps (para validar referencias)
 * @throws {Error} Si los parallel_groups son inválidos
 */
function validateParallelGroups(parallelGroups, steps) {
  if (!Array.isArray(parallelGroups)) {
    throw new Error('[AUTOMATION_VALIDATOR] parallel_groups debe ser un array');
  }

  parallelGroups.forEach((group, groupIndex) => {
    if (!Array.isArray(group)) {
      throw new Error(`[AUTOMATION_VALIDATOR] parallel_groups[${groupIndex}] debe ser un array`);
    }

    // Validar que cada índice del grupo es válido
    group.forEach((stepIndex, memberIndex) => {
      if (typeof stepIndex !== 'number' || stepIndex < 0 || stepIndex >= steps.length) {
        throw new Error(`[AUTOMATION_VALIDATOR] parallel_groups[${groupIndex}][${memberIndex}] debe ser un índice válido de steps (0-${steps.length - 1})`);
      }
    });
  });
}

// ============================================================================
// VALIDACIÓN DE JSON (STRUCTURE)
// ============================================================================

/**
 * Valida que un string es JSON válido y parseable
 * 
 * @param {string} jsonString - String JSON a validar
 * @returns {Object} Objeto parseado
 * @throws {Error} Si el JSON es inválido
 */
export function validateJSON(jsonString) {
  if (typeof jsonString !== 'string') {
    throw new Error('[AUTOMATION_VALIDATOR] JSON debe ser un string');
  }

  try {
    const parsed = JSON.parse(jsonString);
    return parsed;
  } catch (error) {
    throw new Error(`[AUTOMATION_VALIDATOR] JSON inválido: ${error.message}`);
  }
}

// ============================================================================
// VALIDACIÓN DE AUTOMATION_KEY
// ============================================================================

/**
 * Valida que un automation_key tiene formato válido
 * 
 * @param {string} automationKey - Clave a validar
 * @throws {Error} Si el automation_key es inválido
 */
export function validateAutomationKey(automationKey) {
  if (!automationKey || typeof automationKey !== 'string' || automationKey.trim() === '') {
    throw new Error('[AUTOMATION_VALIDATOR] automation_key es requerido y debe ser un string no vacío');
  }

  // Validar formato: solo [a-z0-9_-]
  const validFormat = /^[a-z0-9_-]+$/.test(automationKey);
  if (!validFormat) {
    throw new Error('[AUTOMATION_VALIDATOR] automation_key debe contener solo letras minúsculas, números, guiones y guiones bajos (ej: "increment_streak_on_practice")');
  }
}






