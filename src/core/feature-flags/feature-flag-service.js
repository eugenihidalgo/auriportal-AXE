// src/core/feature-flags/feature-flag-service.js
// Servicio Canónico de Feature Flags - AuriPortal
//
// PROPÓSITO:
// Servicio canónico que actúa como única forma permitida de interactuar con feature flags.
// Enforce reglas de negocio, validaciones y auditoría.
//
// REGLAS:
// - flag_key debe existir en registry
// - irreversible === true → no permitir reset
// - actor obligatorio en todas las operaciones
// - PostgreSQL es el Source of Truth del estado
// - Registry es el Source of Truth de la definición

import {
  getFlagDefinition,
  flagExists,
  getAllFlagDefinitions
} from './feature-flag-registry.js';
import {
  getFlagState,
  getAllFlagStates,
  setFlagState,
  deleteFlagState
} from '../../infra/repos/feature-flags-repo-pg.js';

/**
 * Obtiene todos los flags con su estado actual
 * @returns {Promise<Array>} Array de flags con estado
 */
export async function getAllFlags() {
  const definitions = getAllFlagDefinitions();
  const states = await getAllFlagStates();
  
  // Crear mapa de estados por flag_key
  const stateMap = new Map();
  states.forEach(state => {
    stateMap.set(state.flag_key, state.enabled);
  });
  
  // Combinar definiciones con estados (o defaults)
  return definitions.map(def => ({
    key: def.key,
    description: def.description,
    type: def.type,
    scope: def.scope,
    default: def.default,
    irreversible: def.irreversible,
    enabled: stateMap.has(def.key) ? stateMap.get(def.key) : def.default,
    has_override: stateMap.has(def.key) // Indica si hay override en BD
  }));
}

/**
 * Verifica si un flag está habilitado
 * @param {string} flagKey - Clave del flag
 * @returns {Promise<boolean>} true si está habilitado, false si no
 */
export async function isEnabled(flagKey) {
  // Verificar que el flag existe en registry
  if (!flagExists(flagKey)) {
    throw new Error(`[FEATURE_FLAG_SERVICE] Flag no existe en registry: ${flagKey}`);
  }
  
  // Obtener definición para default
  const definition = getFlagDefinition(flagKey);
  
  // Obtener estado de BD (si existe)
  const state = await getFlagState(flagKey);
  
  // Retornar estado de BD o default del registry
  return state ? state.enabled : definition.default;
}

/**
 * Establece el estado de un flag
 * @param {string} flagKey - Clave del flag
 * @param {boolean} enabled - Estado a establecer
 * @param {Object} actor - Actor que actualiza: { type: 'admin'|'system', id: string }
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Estado actualizado del flag
 */
export async function setFlag(flagKey, enabled, actor, client = null) {
  // Validar flag_key existe en registry
  if (!flagExists(flagKey)) {
    throw new Error(`[FEATURE_FLAG_SERVICE] Flag no existe en registry: ${flagKey}`);
  }
  
  // Validar actor
  if (!actor || !actor.type || !actor.id) {
    throw new Error('[FEATURE_FLAG_SERVICE] actor es requerido y debe ser { type: "admin"|"system", id: string }');
  }
  
  if (actor.type !== 'admin' && actor.type !== 'system') {
    throw new Error('[FEATURE_FLAG_SERVICE] actor.type debe ser "admin" o "system"');
  }
  
  // Establecer estado en BD
  const state = await setFlagState(flagKey, enabled, actor, client);
  
  return {
    flag_key: state.flag_key,
    enabled: state.enabled,
    updated_by: state.updated_by,
    updated_at: state.updated_at
  };
}

/**
 * Resetea un flag a su valor por defecto (elimina override de BD)
 * @param {string} flagKey - Clave del flag
 * @param {Object} actor - Actor que resetea: { type: 'admin'|'system', id: string }
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Resultado del reset
 */
export async function resetFlag(flagKey, actor, client = null) {
  // Validar flag_key existe en registry
  if (!flagExists(flagKey)) {
    throw new Error(`[FEATURE_FLAG_SERVICE] Flag no existe en registry: ${flagKey}`);
  }
  
  // Obtener definición para validar irreversibilidad
  const definition = getFlagDefinition(flagKey);
  
  if (definition.irreversible) {
    throw new Error(`[FEATURE_FLAG_SERVICE] Flag es irreversible y no se puede resetear: ${flagKey}`);
  }
  
  // Validar actor
  if (!actor || !actor.type || !actor.id) {
    throw new Error('[FEATURE_FLAG_SERVICE] actor es requerido y debe ser { type: "admin"|"system", id: string }');
  }
  
  // Eliminar estado de BD (reset a default del registry)
  const deleted = await deleteFlagState(flagKey, client);
  
  if (!deleted) {
    // No existía en BD, ya está en default
    return {
      flag_key: flagKey,
      enabled: definition.default,
      reset: true,
      message: 'Flag ya estaba en valor por defecto'
    };
  }
  
  return {
    flag_key: flagKey,
    enabled: definition.default,
    reset: true,
    message: 'Flag reseteado a valor por defecto'
  };
}





