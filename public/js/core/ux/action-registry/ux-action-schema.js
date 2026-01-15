/**
 * UX ACTION SCHEMA v1 - AuriPortal
 * 
 * Schema canónico para validación dura de acciones UX.
 * 
 * PRINCIPIO CONSTITUCIONAL:
 * - Validación dura: acción inexistente = error explícito + log forense
 * - Schema estricto: campos obligatorios validados en runtime
 * - Prohibiciones explícitas: allowed_item_kinds, allowed_layers, allowed_scopes
 * 
 * CONTRATO:
 * - action_id: ID único canónico
 * - domain: Dominio ('master' | 'god' | 'admin_legacy')
 * - allowed_item_kinds: Array de item_kinds permitidos ('recurrente' | 'una_vez')
 * - allowed_layers: Array de layers permitidos ('shared' | 'pde')
 * - allowed_scopes: Array de scopes permitidos ('item' | 'student' | 'all')
 * - payload_schema: Schema de validación para payload
 * - handler: Función que ejecuta la acción (backend)
 * - refresh: Plan declarativo de refresh
 */

/**
 * Valida una acción contra el schema
 * @param {Object} action - Definición de acción
 * @param {Object} payload - Payload a validar
 * @param {Object} context - Contexto de la acción
 * @returns {Object} { valid: boolean, errors: Array<string> }
 */
export function validateActionPayload(action, payload, context = {}) {
  const errors = [];

  // Validar action_id
  if (!action.action_id || typeof action.action_id !== 'string') {
    errors.push('action_id es obligatorio y debe ser string');
  }

  // Validar domain
  if (!action.domain || !['master', 'god', 'admin_legacy'].includes(action.domain)) {
    errors.push('domain debe ser "master", "god" o "admin_legacy"');
  }

  // Validar allowed_item_kinds (si está definido)
  if (action.allowed_item_kinds && Array.isArray(action.allowed_item_kinds)) {
    if (payload.item_kind && !action.allowed_item_kinds.includes(payload.item_kind)) {
      errors.push(`item_kind "${payload.item_kind}" no permitido. Permitidos: ${action.allowed_item_kinds.join(', ')}`);
    }
  }

  // Validar allowed_layers (si está definido)
  if (action.allowed_layers && Array.isArray(action.allowed_layers)) {
    if (payload.clean_layer && !action.allowed_layers.includes(payload.clean_layer)) {
      errors.push(`clean_layer "${payload.clean_layer}" no permitido. Permitidos: ${action.allowed_layers.join(', ')}`);
    }
  }

  // Validar allowed_scopes (si está definido)
  if (action.allowed_scopes && Array.isArray(action.allowed_scopes)) {
    const scope = payload.scope || context.scope || 'all';
    if (!action.allowed_scopes.includes(scope)) {
      errors.push(`scope "${scope}" no permitido. Permitidos: ${action.allowed_scopes.join(', ')}`);
    }
  }

  // Validar campos obligatorios según tipo de acción
  if (action.action_id && action.action_id.includes('.clean')) {
    if (!payload.item_ref) {
      errors.push('item_ref es obligatorio para acciones de limpieza');
    }
    if (!payload.item_kind) {
      errors.push('item_kind es obligatorio para acciones de limpieza');
    }
    if (!payload.clean_layer) {
      errors.push('clean_layer es obligatorio para acciones de limpieza');
    }
  }

  if (action.action_id && action.action_id.includes('.reset')) {
    if (!payload.item_ref && !payload.list_id) {
      errors.push('item_ref o list_id es obligatorio para acciones de reset');
    }
    // Validación especial: reset solo para recurrente
    if (payload.item_kind === 'una_vez') {
      errors.push('reset NO permitido para item_kind="una_vez". Reset solo para recurrente.');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Valida que una acción existe en el registry
 * @param {string} action_id - ID de la acción
 * @param {Object} registry - Registry de acciones (debe tener método get())
 * @returns {Object} { exists: boolean, action: Object|null, error: string|null }
 */
export function validateActionExists(action_id, registry) {
  if (!action_id || typeof action_id !== 'string') {
    return {
      exists: false,
      action: null,
      error: 'action_id es obligatorio y debe ser string'
    };
  }

  if (!registry || typeof registry.get !== 'function') {
    return {
      exists: false,
      action: null,
      error: 'registry debe tener método get()'
    };
  }

  const action = registry.get(action_id);
  if (!action) {
    return {
      exists: false,
      action: null,
      error: `Acción "${action_id}" no registrada en UX Action Registry`
    };
  }

  return {
    exists: true,
    action,
    error: null
  };
}

/**
 * Genera log forense de violación de contrato
 * @param {string} action_id - ID de la acción
 * @param {string} violation - Tipo de violación
 * @param {Object} context - Contexto adicional
 */
export function logContractViolation(action_id, violation, context = {}) {
  console.error('[UX_CONTRACT_VIOLATION]', {
    action_id: action_id || 'unknown',
    violation,
    context,
    timestamp: new Date().toISOString(),
    stack: new Error().stack
  });
}
