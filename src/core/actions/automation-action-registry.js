// src/core/actions/automation-action-registry.js
// Action Registry Canónico para Automatizaciones (Fase D - Fase 3)
//
// PRINCIPIOS CONSTITUCIONALES:
// - Este registry es el ÚNICO punto desde el que se pueden ejecutar acciones en automatizaciones
// - Todas las acciones DEBEN usar servicios canónicos (Contrato B)
// - NO se permite código inline o acciones ad-hoc
// - Validación de inputs mediante schema
//
// RELACIÓN CON CONTRATOS:
// - Contrato B: Las acciones usan StudentMutationService (servicios canónicos)
// - Contrato D: Las automatizaciones ejecutan acciones registradas (no código inline)
//
// ESTADO: Fase 3 - Action Registry Canónico (NO ejecuta automatizaciones todavía)

import { getStudentMutationService } from '../services/student-mutation-service.js';

// ============================================================================
// STORE GLOBAL
// ============================================================================

const automationActionRegistry = new Map();

// ============================================================================
// DEFINICIÓN DE ACTION
// ============================================================================

/**
 * Estructura de una acción registrada para automatizaciones:
 * 
 * {
 *   key: string,                    // Identificador único (ej: "student.updateNivel")
 *   description: string,            // Descripción human-readable
 *   schema: {                       // Schema simple para validación
 *     [field]: 'string' | 'number' | 'boolean' | 'object' | 'array'
 *   },
 *   handler: async function,         // Función que ejecuta la acción
 *                                   // Recibe: (input) => Promise
 *                                   // Devuelve: resultado del servicio canónico
 *   sideEffectsLevel: string        // Nivel de efectos secundarios
 *                                   // Valores: 'mutates_state', 'reads_only', 'external'
 * }
 */

// ============================================================================
// FUNCIONES DE REGISTRO
// ============================================================================

/**
 * Registra una nueva acción en el registry canónico
 * 
 * @param {Object} definition - Definición de la acción
 * @param {string} definition.key - Clave única de la acción
 * @param {string} definition.description - Descripción
 * @param {Object} definition.schema - Schema de validación (ej: { email: 'string', nivel: 'number' })
 * @param {Function} definition.handler - Handler async que ejecuta la acción
 * @param {string} definition.sideEffectsLevel - Nivel de efectos secundarios
 * @throws {Error} Si hay duplicados o estructura inválida
 */
export function registerAction(definition) {
  // Validar estructura mínima
  if (!definition || typeof definition !== 'object') {
    throw new Error('[AUTOMATION_ACTION_REGISTRY] Definition debe ser un objeto');
  }

  const { key, description, schema, handler, sideEffectsLevel } = definition;

  // Validar campos requeridos
  if (!key || typeof key !== 'string' || key.trim() === '') {
    throw new Error('[AUTOMATION_ACTION_REGISTRY] key es requerido y debe ser string no vacío');
  }

  if (!description || typeof description !== 'string' || description.trim() === '') {
    throw new Error('[AUTOMATION_ACTION_REGISTRY] description es requerido y debe ser string no vacío');
  }

  if (!schema || typeof schema !== 'object' || Object.keys(schema).length === 0) {
    throw new Error('[AUTOMATION_ACTION_REGISTRY] schema es requerido y debe ser un objeto no vacío');
  }

  if (typeof handler !== 'function') {
    throw new Error('[AUTOMATION_ACTION_REGISTRY] handler es requerido y debe ser una función');
  }

  if (!sideEffectsLevel || typeof sideEffectsLevel !== 'string') {
    throw new Error('[AUTOMATION_ACTION_REGISTRY] sideEffectsLevel es requerido y debe ser string');
  }

  // Validar que no esté duplicado
  if (automationActionRegistry.has(key)) {
    throw new Error(`[AUTOMATION_ACTION_REGISTRY] Action ya registrada: ${key}`);
  }

  // Registrar
  automationActionRegistry.set(key, {
    key,
    description,
    schema,
    handler,
    sideEffectsLevel
  });

  console.log(`[AUTOMATION_ACTION_REGISTRY] ✅ Registrada: ${key}`);
}

// ============================================================================
// FUNCIONES DE CONSULTA
// ============================================================================

/**
 * Obtiene una acción registrada por su key
 * 
 * @param {string} key - Clave de la acción
 * @returns {Object|null} Definición de la acción o null si no existe
 */
export function getAction(key) {
  if (!key || typeof key !== 'string') {
    return null;
  }
  return automationActionRegistry.get(key) || null;
}

/**
 * Lista todas las acciones registradas
 * 
 * @returns {Array} Array de definiciones de acciones
 */
export function getAllActions() {
  return Array.from(automationActionRegistry.values());
}

// ============================================================================
// VALIDACIÓN DE INPUT
// ============================================================================

/**
 * Valida un input contra el schema de una acción
 * 
 * @param {string} key - Clave de la acción
 * @param {Object} input - Input a validar
 * @returns {Object} { valid: boolean, errors?: string[] }
 */
export function validateActionInput(key, input) {
  const action = getAction(key);
  if (!action) {
    return {
      valid: false,
      errors: [`Acción no registrada: ${key}`]
    };
  }

  const { schema } = action;
  const errors = [];

  // Validar cada campo del schema
  for (const [field, expectedType] of Object.entries(schema)) {
    const value = input[field];

    // Verificar que el campo existe si es requerido
    if (value === undefined || value === null) {
      errors.push(`Campo requerido faltando: ${field}`);
      continue;
    }

    // Validar tipo
    const actualType = typeof value;
    if (expectedType === 'number' && actualType !== 'number') {
      errors.push(`Campo ${field} debe ser number, recibido: ${actualType}`);
    } else if (expectedType === 'string' && actualType !== 'string') {
      errors.push(`Campo ${field} debe ser string, recibido: ${actualType}`);
    } else if (expectedType === 'boolean' && actualType !== 'boolean') {
      errors.push(`Campo ${field} debe ser boolean, recibido: ${actualType}`);
    } else if (expectedType === 'object' && (actualType !== 'object' || Array.isArray(value))) {
      errors.push(`Campo ${field} debe ser object, recibido: ${actualType}`);
    } else if (expectedType === 'array' && !Array.isArray(value)) {
      errors.push(`Campo ${field} debe ser array, recibido: ${actualType}`);
    }
  }

  // Verificar campos extra (no permitidos)
  const allowedFields = Object.keys(schema);
  const extraFields = Object.keys(input || {}).filter(field => !allowedFields.includes(field));
  if (extraFields.length > 0) {
    errors.push(`Campos no permitidos: ${extraFields.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

// ============================================================================
// REGISTRO DE ACCIONES MÍNIMAS
// ============================================================================

/**
 * Registra las acciones mínimas requeridas para automatizaciones
 * 
 * Todas las acciones usan StudentMutationService (Contrato B)
 * Actor: { type: 'system' } (automatización ejecutando)
 */
function registerMinimumActions() {
  // student.updateNivel
  registerAction({
    key: 'student.updateNivel',
    description: 'Actualiza el nivel de un alumno',
    schema: {
      email: 'string',
      nivel: 'number'
    },
    handler: async (input) => {
      const service = getStudentMutationService();
      return await service.updateNivel(
        input.email,
        input.nivel,
        { type: 'system' }
      );
    },
    sideEffectsLevel: 'mutates_state'
  });

  // student.updateStreak
  registerAction({
    key: 'student.updateStreak',
    description: 'Actualiza la racha diaria de un alumno',
    schema: {
      email: 'string',
      streak: 'number'
    },
    handler: async (input) => {
      const service = getStudentMutationService();
      return await service.updateStreak(
        input.email,
        input.streak,
        { type: 'system' }
      );
    },
    sideEffectsLevel: 'mutates_state'
  });

  // student.updateUltimaPractica
  registerAction({
    key: 'student.updateUltimaPractica',
    description: 'Actualiza la fecha de última práctica de un alumno',
    schema: {
      email: 'string',
      fecha: 'string'
    },
    handler: async (input) => {
      const service = getStudentMutationService();
      return await service.updateUltimaPractica(
        input.email,
        input.fecha,
        { type: 'system' }
      );
    },
    sideEffectsLevel: 'mutates_state'
  });

  // student.updateEstadoSuscripcion
  registerAction({
    key: 'student.updateEstadoSuscripcion',
    description: 'Actualiza el estado de suscripción de un alumno',
    schema: {
      email: 'string',
      estado: 'string',
      fechaReactivacion: 'string'
    },
    handler: async (input) => {
      const service = getStudentMutationService();
      return await service.updateEstadoSuscripcion(
        input.email,
        input.estado,
        { type: 'system' },
        input.fechaReactivacion || null
      );
    },
    sideEffectsLevel: 'mutates_state'
  });

  // student.updateApodo
  registerAction({
    key: 'student.updateApodo',
    description: 'Actualiza el apodo de un alumno',
    schema: {
      email: 'string',
      apodo: 'string'
    },
    handler: async (input) => {
      const service = getStudentMutationService();
      return await service.updateApodo(
        input.email,
        input.apodo,
        { type: 'system' }
      );
    },
    sideEffectsLevel: 'mutates_state'
  });
}

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

// Registrar acciones mínimas al cargar el módulo
registerMinimumActions();

// ============================================================================
// DIAGNÓSTICO
// ============================================================================

/**
 * Imprime estado actual del registry (debug)
 */
export function diagnoseRegistry() {
  const actions = getAllActions();
  console.log(`\n[AUTOMATION_ACTION_REGISTRY] Diagnóstico:`);
  console.log(`Total de acciones: ${actions.length}`);
  console.log(`\nAcciones registradas:`);
  
  for (const action of actions) {
    console.log(`  - ${action.key}`);
    console.log(`    Descripción: ${action.description}`);
    console.log(`    Side Effects: ${action.sideEffectsLevel}`);
    console.log(`    Schema: ${Object.keys(action.schema).join(', ')}`);
  }
  console.log('');
}




