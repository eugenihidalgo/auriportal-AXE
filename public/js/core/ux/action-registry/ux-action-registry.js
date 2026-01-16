/**
 * UX ACTION REGISTRY v1 (CORE) - AuriPortal
 * 
 * Registry canónico centralizado de acciones UX con validación dura.
 * 
 * PRINCIPIO CONSTITUCIONAL:
 * - Toda acción UI debe estar registrada aquí
 * - Validación dura: acción inexistente = error explícito + log forense
 * - Schema estricto: campos obligatorios validados en runtime
 * 
 * CONTRATO:
 * - action_id: ID único canónico (formato: {domain}.{feature}.{action})
 * - domain: Dominio ('master' | 'god' | 'admin_legacy')
 * - allowed_item_kinds: Array de item_kinds permitidos ('recurrente' | 'una_vez')
 * - allowed_layers: Array de layers permitidos ('shared' | 'pde')
 * - allowed_scopes: Array de scopes permitidos ('item' | 'student' | 'all')
 * - handler: Función que ejecuta la acción (backend endpoint)
 * - refresh: Plan declarativo de refresh (función o array de surface_ids)
 */

import { validateActionPayload, validateActionExists, logContractViolation } from './ux-action-schema.js';

const actions = new Map();

/**
 * Registra una acción UX con validación dura
 * @param {Object} actionDef - Definición de la acción
 * @param {string} actionDef.action_id - ID único canónico
 * @param {string} actionDef.domain - Dominio ('master' | 'god' | 'admin_legacy')
 * @param {string} actionDef.description - Descripción legible
 * @param {Array<string>} [actionDef.allowed_item_kinds] - Item kinds permitidos ('recurrente' | 'una_vez')
 * @param {Array<string>} [actionDef.allowed_layers] - Layers permitidos ('shared' | 'pde')
 * @param {Array<string>} [actionDef.allowed_scopes] - Scopes permitidos ('item' | 'student' | 'all')
 * @param {Object} actionDef.handler - Handler de la acción
 * @param {string} actionDef.handler.method - Método HTTP ('POST' | 'PUT' | 'DELETE' | 'PATCH')
 * @param {Function} actionDef.handler.endpointBuilder - (context) => string
 * @param {Function} actionDef.handler.buildPayload - (uiState, context) => Object
 * @param {Object} [actionDef.handler.headers] - Headers adicionales
 * @param {Function|Array<string>} actionDef.refresh - Plan de refresh
 * @param {Object} [actionDef.legacy_bridge] - Bridge temporal para legacy (opcional)
 */
export function registerAction(actionDef) {
  // MAJOR-3 FIX: Guard - Runtime BROKEN bloquea registro de acciones
  if (typeof window !== 'undefined' && window.__AP_RUNTIME_READY__) {
    const runtimeState = window.__AP_RUNTIME_READY__.state();
    if (runtimeState === 'broken') {
      const error = new Error(`[MAJOR-3] Runtime está BROKEN. No se pueden registrar acciones. Error: ${window.__AP_RUNTIME_READY__.error?.message || 'desconocido'}`);
      error.code = 'RUNTIME_BROKEN_REGISTRATION_BLOCKED';
      console.error('[UX_ACTION_REGISTRY][MAJOR-3] ❌ Intento de registrar acción con runtime BROKEN', {
        action_id: actionDef.action_id,
        runtime_state: runtimeState,
        runtime_error: window.__AP_RUNTIME_READY__.error
      });
      throw error; // FAIL-HARD: No permitir registro si runtime está BROKEN
    }
  }

  const {
    action_id,
    domain,
    description,
    allowed_item_kinds,
    allowed_layers,
    allowed_scopes,
    handler,
    refresh,
    legacy_bridge
  } = actionDef;

  // Validaciones básicas
  if (!action_id || typeof action_id !== 'string') {
    throw new Error('[UX_ACTION_REGISTRY] action_id es obligatorio y debe ser string');
  }

  if (!domain || !['master', 'god', 'admin_legacy'].includes(domain)) {
    throw new Error('[UX_ACTION_REGISTRY] domain debe ser "master", "god" o "admin_legacy"');
  }

  if (!description || typeof description !== 'string') {
    throw new Error('[UX_ACTION_REGISTRY] description es obligatorio y debe ser string');
  }

  if (!handler || typeof handler !== 'object') {
    throw new Error('[UX_ACTION_REGISTRY] handler es obligatorio y debe ser objeto');
  }

  if (!handler.method || !['POST', 'PUT', 'DELETE', 'PATCH'].includes(handler.method)) {
    throw new Error('[UX_ACTION_REGISTRY] handler.method debe ser POST, PUT, DELETE o PATCH');
  }

  if (typeof handler.endpointBuilder !== 'function') {
    throw new Error('[UX_ACTION_REGISTRY] handler.endpointBuilder debe ser función');
  }

  if (typeof handler.buildPayload !== 'function') {
    throw new Error('[UX_ACTION_REGISTRY] handler.buildPayload debe ser función');
  }

  if (!refresh) {
    throw new Error('[UX_ACTION_REGISTRY] refresh es obligatorio');
  }

  if (typeof refresh !== 'function' && !Array.isArray(refresh)) {
    throw new Error('[UX_ACTION_REGISTRY] refresh debe ser función o array de surface_ids');
  }

  // Validar allowed_item_kinds (si está definido)
  if (allowed_item_kinds && !Array.isArray(allowed_item_kinds)) {
    throw new Error('[UX_ACTION_REGISTRY] allowed_item_kinds debe ser array');
  }

  if (allowed_item_kinds) {
    for (const kind of allowed_item_kinds) {
      if (!['recurrente', 'una_vez'].includes(kind)) {
        throw new Error(`[UX_ACTION_REGISTRY] allowed_item_kinds contiene valor inválido: ${kind}`);
      }
    }
  }

  // Validar allowed_layers (si está definido)
  if (allowed_layers && !Array.isArray(allowed_layers)) {
    throw new Error('[UX_ACTION_REGISTRY] allowed_layers debe ser array');
  }

  if (allowed_layers) {
    for (const layer of allowed_layers) {
      if (!['shared', 'pde'].includes(layer)) {
        throw new Error(`[UX_ACTION_REGISTRY] allowed_layers contiene valor inválido: ${layer}`);
      }
    }
  }

  // Validar allowed_scopes (si está definido)
  if (allowed_scopes && !Array.isArray(allowed_scopes)) {
    throw new Error('[UX_ACTION_REGISTRY] allowed_scopes debe ser array');
  }

  if (allowed_scopes) {
    for (const scope of allowed_scopes) {
      if (!['item', 'student', 'all'].includes(scope)) {
        throw new Error(`[UX_ACTION_REGISTRY] allowed_scopes contiene valor inválido: ${scope}`);
      }
    }
  }

  // Verificar duplicados
  if (actions.has(action_id)) {
    console.warn(`[UX_ACTION_REGISTRY] Acción ${action_id} ya registrada, sobrescribiendo`);
  }

  // Registrar acción
  actions.set(action_id, {
    action_id,
    domain,
    description,
    allowed_item_kinds: allowed_item_kinds || null,
    allowed_layers: allowed_layers || null,
    allowed_scopes: allowed_scopes || null,
    handler: {
      method: handler.method,
      endpointBuilder: handler.endpointBuilder,
      buildPayload: handler.buildPayload,
      headers: handler.headers || {}
    },
    refresh,
    legacy_bridge: legacy_bridge || null
  });

  console.log(`[UX_ACTION_REGISTRY] Acción registrada: ${action_id} (${domain})`);
}

/**
 * Obtiene una acción registrada
 * @param {string} action_id - ID de la acción
 * @returns {Object|null} Definición de la acción o null si no existe
 */
export function getAction(action_id) {
  if (!action_id || typeof action_id !== 'string') {
    return null;
  }
  return actions.get(action_id) || null;
}

/**
 * Valida y obtiene una acción (con validación dura)
 * @param {string} action_id - ID de la acción
 * @returns {Object} { exists: boolean, action: Object|null, error: string|null }
 */
export function getActionOrFail(action_id) {
  return validateActionExists(action_id, {
    get: (id) => actions.get(id)
  });
}

/**
 * Lista todas las acciones registradas
 * @param {string} [domain] - Filtrar por dominio
 * @returns {Array<string>} Lista de action_ids
 */
export function listActions(domain = null) {
  const allActions = Array.from(actions.keys());
  if (!domain) {
    return allActions;
  }
  return allActions.filter(action_id => {
    const action = actions.get(action_id);
    return action && action.domain === domain;
  });
}

/**
 * Valida que una acción esté registrada
 * @param {string} action_id - ID de la acción
 * @returns {boolean} true si está registrada
 */
export function hasAction(action_id) {
  return actions.has(action_id);
}

/**
 * Valida payload contra schema de acción
 * @param {string} action_id - ID de la acción
 * @param {Object} payload - Payload a validar
 * @param {Object} context - Contexto adicional
 * @returns {Object} { valid: boolean, errors: Array<string> }
 */
export function validatePayload(action_id, payload, context = {}) {
  const action = getAction(action_id);
  if (!action) {
    return {
      valid: false,
      errors: [`Acción "${action_id}" no registrada`]
    };
  }

  return validateActionPayload(action, payload, context);
}

/**
 * Obtiene información del registry (útil para debugging)
 * @returns {Object} Información del registry
 */
export function getRegistryInfo() {
  return {
    total_actions: actions.size,
    by_domain: {
      master: listActions('master').length,
      god: listActions('god').length,
      admin_legacy: listActions('admin_legacy').length
    },
    actions: Array.from(actions.keys())
  };
}

// Exportar para uso en frontend (si se necesita)
if (typeof window !== 'undefined') {
  window.__AP_UX_ACTION_REGISTRY_CORE__ = {
    get: getAction,
    getOrFail: getActionOrFail,
    list: listActions,
    has: hasAction,
    validate: validatePayload,
    info: getRegistryInfo,
    register: registerAction
  };
}
