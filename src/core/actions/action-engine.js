/**
 * Action Engine - Ejecutor centralizado de acciones registradas
 * 
 * Responsabilidades:
 * 1) Resolver acción del registry
 * 2) Validar permisos del usuario
 * 3) Validar input contra schema
 * 4) Ejecutar handler
 * 5) Devolver resultado tipado
 * 
 * NO maneja:
 * - Rollback (futuro: FASE 3)
 * - Coherencia global (futuro: FASE 3)
 * - Eventos (futuro: FASE 4)
 */

import {
  getAction,
  validateActionInput,
  validateActionPermissions
} from './action-registry.js';

// ============================================================================
// MAIN ENGINE
// ============================================================================

/**
 * Ejecuta una acción registrada con validación completa
 * 
 * @param {string} action_key - Key de la acción (ej: "contexts.create")
 * @param {Object} input - Input para la acción
 * @param {Object} context - Contexto con información del usuario
 * @returns {Promise<{ok, data?, error?, warnings?}>}
 */
async function executeAction(action_key, input, context) {
  // Paso 0: Validar parámetros básicos
  if (!action_key || typeof action_key !== 'string') {
    return {
      ok: false,
      error: '[ACTION_ENGINE] action_key debe ser string'
    };
  }

  if (!input || typeof input !== 'object') {
    return {
      ok: false,
      error: '[ACTION_ENGINE] input debe ser objeto'
    };
  }

  if (!context || typeof context !== 'object') {
    return {
      ok: false,
      error: '[ACTION_ENGINE] context debe ser objeto'
    };
  }

  // Paso 1: Resolver acción del registry
  console.log(`[ACTION_ENGINE] Ejecutando: ${action_key}`);
  
  const action = getAction(action_key);
  if (!action) {
    console.error(`[ACTION_ENGINE] Acción no registrada: ${action_key}`);
    return {
      ok: false,
      error: `Acción no registrada: ${action_key}`
    };
  }

  // Paso 2: Validar permisos
  const permissionValidation = validateActionPermissions(action_key, context);
  if (!permissionValidation.ok) {
    console.warn(`[ACTION_ENGINE] Permisos insuficientes para ${action_key}: ${permissionValidation.error}`);
    return {
      ok: false,
      error: permissionValidation.error
    };
  }

  // Paso 3: Validar input
  const inputValidation = validateActionInput(action_key, input);
  if (!inputValidation.ok) {
    console.warn(`[ACTION_ENGINE] Input inválido para ${action_key}: ${inputValidation.error}`);
    return {
      ok: false,
      error: inputValidation.error,
      missingFields: inputValidation.missingFields,
      extraFields: inputValidation.extraFields
    };
  }

  // Paso 4: Ejecutar handler
  try {
    console.log(`[ACTION_ENGINE] Ejecutando handler para ${action_key}`);
    const result = await action.handler(input, context);

    // Validar resultado del handler
    if (!result || typeof result !== 'object') {
      console.error(`[ACTION_ENGINE] Handler para ${action_key} devolvió resultado inválido`);
      return {
        ok: false,
        error: 'Handler devolvió resultado inválido'
      };
    }

    // Asegurar que resultado tiene estructura mínima
    const typedResult = {
      ok: result.ok === true,
      data: result.data || null,
      warnings: Array.isArray(result.warnings) ? result.warnings : [],
      error: result.error || null
    };

    if (typedResult.ok) {
      console.log(`[ACTION_ENGINE] ✅ ${action_key} completada exitosamente`);
    } else {
      console.error(`[ACTION_ENGINE] ❌ ${action_key} falló: ${typedResult.error}`);
    }

    return typedResult;
  } catch (error) {
    console.error(`[ACTION_ENGINE] Error ejecutando ${action_key}:`, error);
    return {
      ok: false,
      error: `Error interno: ${error.message}`
    };
  }
}

// ============================================================================
// DIAGNOSTICAR EJECUCIÓN
// ============================================================================

/**
 * Ejecuta una acción con diagnóstico detallado (debug)
 */
async function executeActionWithDiagnostics(action_key, input, context) {
  console.log(`\n[ACTION_DIAGNOSTICS] Iniciando ejecución de: ${action_key}`);
  console.log(`[ACTION_DIAGNOSTICS] Input:`, input);
  console.log(`[ACTION_DIAGNOSTICS] Context user:`, context?.user);

  const start = Date.now();
  const result = await executeAction(action_key, input, context);
  const duration = Date.now() - start;

  console.log(`[ACTION_DIAGNOSTICS] Resultado:`, result);
  console.log(`[ACTION_DIAGNOSTICS] Tiempo: ${duration}ms\n`);

  return result;
}

// ============================================================================
// VALIDACIÓN DE ACCIÓN (para pre-flight)
// ============================================================================

/**
 * Valida si una acción puede ejecutarse SIN ejecutarla realmente
 * Útil para UI: verificar si un botón debe estar habilitado
 * 
 * @param {string} action_key 
 * @param {Object} context 
 * @returns {Object} { can_execute: boolean, reason?: string }
 */
function canExecuteAction(action_key, context) {
  const action = getAction(action_key);
  if (!action) {
    return {
      can_execute: false,
      reason: `Acción no registrada: ${action_key}`
    };
  }

  const permissionValidation = validateActionPermissions(action_key, context);
  if (!permissionValidation.ok) {
    return {
      can_execute: false,
      reason: permissionValidation.error
    };
  }

  return {
    can_execute: true
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Obtiene información de una acción (para UI)
 */
function getActionInfo(action_key) {
  const action = getAction(action_key);
  if (!action) return null;

  return {
    action_key: action.action_key,
    description: action.description,
    permissions: action.permissions,
    input_schema: action.input_schema
  };
}

// ============================================================================
// EXPORTS (ES6 MODULES)
// ============================================================================

export {
  executeAction,
  executeActionWithDiagnostics,
  canExecuteAction,
  getActionInfo
};
