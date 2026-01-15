/**
 * UX ACTION REGISTRY v1 - AuriPortal
 * 
 * Registry canónico de acciones UX con contratos formales.
 * 
 * PRINCIPIO CONSTITUCIONAL:
 * - Toda acción UI debe estar registrada aquí
 * - Toda acción debe declarar Refresh Plan
 * - Prohibido acciones ad-hoc sin registro
 * 
 * CONTRATO:
 * - action_id: Identificador único canónico (ej: 'alquimia.clean.student')
 * - domain: Dominio de la acción ('master' | 'god' | 'admin_legacy')
 * - request: Contrato de request (method, endpointBuilder, buildPayload)
 * - refresh_plan: Plan declarativo de refresh (función o array)
 * - telemetry: Configuración de logs forenses
 */

const actions = new Map();

/**
 * Registra una acción UX
 * @param {Object} actionDef - Definición de la acción
 * @param {string} actionDef.action_id - ID único canónico
 * @param {string} actionDef.domain - Dominio ('master' | 'god' | 'admin_legacy')
 * @param {string} actionDef.description - Descripción de la acción
 * @param {Object} actionDef.request - Contrato de request
 * @param {string} actionDef.request.method - Método HTTP ('POST' | 'PUT' | 'DELETE')
 * @param {Function} actionDef.request.endpointBuilder - (context) => string
 * @param {Function} actionDef.request.buildPayload - (uiState, context) => Object
 * @param {Object} [actionDef.request.headers] - Headers adicionales
 * @param {Function|Array} actionDef.refresh_plan - Plan de refresh (función o array declarativo)
 * @param {Object} [actionDef.telemetry] - Configuración de telemetría
 * @param {boolean} [actionDef.telemetry.log_input=true] - Loggear input
 * @param {boolean} [actionDef.telemetry.log_output=true] - Loggear output
 */
export function registerUxAction(actionDef) {
  const { action_id, domain, description, request, refresh_plan, telemetry = {} } = actionDef;

  // Validaciones obligatorias
  if (!action_id || typeof action_id !== 'string') {
    throw new Error('[UX_ACTION_REGISTRY] action_id es obligatorio y debe ser string');
  }

  if (!domain || !['master', 'god', 'admin_legacy'].includes(domain)) {
    throw new Error('[UX_ACTION_REGISTRY] domain debe ser "master", "god" o "admin_legacy"');
  }

  if (!description || typeof description !== 'string') {
    throw new Error('[UX_ACTION_REGISTRY] description es obligatorio y debe ser string');
  }

  if (!request || typeof request !== 'object') {
    throw new Error('[UX_ACTION_REGISTRY] request es obligatorio');
  }

  if (!request.method || !['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    throw new Error('[UX_ACTION_REGISTRY] request.method debe ser POST, PUT, DELETE o PATCH');
  }

  if (typeof request.endpointBuilder !== 'function') {
    throw new Error('[UX_ACTION_REGISTRY] request.endpointBuilder debe ser función');
  }

  if (typeof request.buildPayload !== 'function') {
    throw new Error('[UX_ACTION_REGISTRY] request.buildPayload debe ser función');
  }

  if (!refresh_plan) {
    throw new Error('[UX_ACTION_REGISTRY] refresh_plan es obligatorio');
  }

  if (typeof refresh_plan !== 'function' && !Array.isArray(refresh_plan)) {
    throw new Error('[UX_ACTION_REGISTRY] refresh_plan debe ser función o array');
  }

  // Validar que no esté duplicado
  if (actions.has(action_id)) {
    console.warn(`[UX_ACTION_REGISTRY] Acción ${action_id} ya registrada, sobrescribiendo`);
  }

  actions.set(action_id, {
    action_id,
    domain,
    description,
    request: {
      method: request.method,
      endpointBuilder: request.endpointBuilder,
      buildPayload: request.buildPayload,
      headers: request.headers || {}
    },
    refresh_plan,
    telemetry: {
      log_input: telemetry.log_input !== false, // Default true
      log_output: telemetry.log_output !== false // Default true
    }
  });

  console.log(`[UX_ACTION_REGISTRY] Acción registrada: ${action_id} (${domain})`);
}

/**
 * Obtiene una acción registrada
 * @param {string} action_id - ID de la acción
 * @returns {Object|null} Definición de la acción o null si no existe
 */
export function getUxAction(action_id) {
  if (!action_id || typeof action_id !== 'string') {
    return null;
  }
  return actions.get(action_id) || null;
}

/**
 * Lista todas las acciones registradas
 * @param {string} [domain] - Filtrar por dominio
 * @returns {Array} Lista de action_ids
 */
export function listUxActions(domain = null) {
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
export function hasUxAction(action_id) {
  return actions.has(action_id);
}

/**
 * Obtiene información del registry (útil para debugging)
 * @returns {Object} Información del registry
 */
export function getRegistryInfo() {
  return {
    total_actions: actions.size,
    by_domain: {
      master: listUxActions('master').length,
      god: listUxActions('god').length,
      admin_legacy: listUxActions('admin_legacy').length
    },
    actions: Array.from(actions.keys())
  };
}

// Exportar para uso en frontend (si se necesita)
if (typeof window !== 'undefined') {
  window.__AP_UX_ACTION_REGISTRY__ = {
    get: getUxAction,
    list: listUxActions,
    has: hasUxAction,
    info: getRegistryInfo,
    registerUxAction: registerUxAction // Exponer para registro desde frontend
  };
}
