// src/core/registry/condition-registry.js
// Registry de Condition Types (condiciones declarativas) para edges de recorridos
// Cada condition type define una condición con schema de params y evaluación determinista

import { isFeatureEnabled } from '../flags/feature-flags.js';
import { logInfo, logWarn } from '../observability/logger.js';

/**
 * Feature flag para controlar visibilidad de conditions
 */
const FEATURE_FLAG = 'recorridos_registry_v1';

/**
 * Definición de Condition Types v1
 * 
 * Cada condition type incluye:
 * - id: identificador único
 * - name: nombre descriptivo
 * - description: descripción de la condición
 * - feature_flag: estado del feature flag
 * - params_schema: JSON Schema para validar los parámetros de la condición
 * - evaluator: función determinista que evalúa la condición (opcional, para runtime)
 */
const CONDITION_TYPES = {
  always: {
    id: 'always',
    name: 'Siempre',
    description: 'Condición que siempre se cumple',
    feature_flag: 'on',
    params_schema: {
      type: 'object',
      properties: {}
    }
  },
  field_equals: {
    id: 'field_equals',
    name: 'Campo Igual',
    description: 'Evalúa si un campo del contexto es igual a un valor',
    feature_flag: 'on',
    params_schema: {
      type: 'object',
      required: ['field', 'value'],
      properties: {
        field: {
          type: 'string',
          minLength: 1,
          description: 'Nombre del campo a evaluar (ej: "choice_id", "scale_value")'
        },
        value: {
          description: 'Valor esperado (puede ser string, number, boolean)'
        }
      }
    }
  },
  field_exists: {
    id: 'field_exists',
    name: 'Campo Existe',
    description: 'Evalúa si un campo del contexto existe y no es null/undefined',
    feature_flag: 'on',
    params_schema: {
      type: 'object',
      required: ['field'],
      properties: {
        field: {
          type: 'string',
          minLength: 1,
          description: 'Nombre del campo a verificar'
        }
      }
    }
  }
};

/**
 * Filtra condition types según feature flags
 */
function shouldShowCondition(conditionFlag) {
  if (!isFeatureEnabled(FEATURE_FLAG)) {
    return false;
  }
  
  if (conditionFlag === 'off') {
    return false;
  }
  
  if (conditionFlag === 'on') {
    return true;
  }
  
  if (conditionFlag === 'beta') {
    const env = process.env.APP_ENV || 'prod';
    return env === 'dev' || env === 'beta';
  }
  
  return false;
}

/**
 * Obtiene todos los condition types disponibles
 * 
 * @returns {Array} Lista de condition types disponibles
 */
export function getAll() {
  const conditions = Object.values(CONDITION_TYPES)
    .filter(condition => shouldShowCondition(condition.feature_flag))
    .map(condition => ({
      id: condition.id,
      name: condition.name,
      description: condition.description,
      feature_flag: condition.feature_flag,
      params_schema: condition.params_schema
    }));
  
  logInfo('Registry', `Condition types obtenidos: ${conditions.length}`, {
    registry: 'condition',
    count: conditions.length
  });
  
  return conditions;
}

/**
 * Obtiene un condition type por ID
 * 
 * @param {string} id - ID del condition type
 * @returns {Object|null} Condition type o null si no existe
 */
export function getById(id) {
  const condition = CONDITION_TYPES[id];
  
  if (!condition) {
    logWarn('Registry', `Condition type no encontrado: ${id}`, {
      registry: 'condition',
      condition_id: id
    });
    return null;
  }
  
  if (!shouldShowCondition(condition.feature_flag)) {
    logWarn('Registry', `Condition type no disponible por feature flag: ${id}`, {
      registry: 'condition',
      condition_id: id,
      feature_flag: condition.feature_flag
    });
    return null;
  }
  
  return {
    id: condition.id,
    name: condition.name,
    description: condition.description,
    feature_flag: condition.feature_flag,
    params_schema: condition.params_schema
  };
}





