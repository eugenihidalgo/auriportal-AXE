/**
 * ALQUIMIA ACTIONS v1 - AuriPortal Master
 * 
 * Registro canónico consolidado de acciones UX para Alquimia General.
 * 
 * ACCIONES REGISTRADAS:
 * - alquimia.clean: Limpiar item (scope: item | student | all)
 * - alquimia.clean_all: Limpiar item para todos (scope: all)
 * - alquimia.reset: Resetear progreso (SOLO recurrente)
 * 
 * PRINCIPIO CONSTITUCIONAL:
 * - Validación dura: allowed_item_kinds, allowed_layers, allowed_scopes
 * - Reset SOLO para recurrente (UNA_VEZ → hard fail)
 * - Refresh plan declarativo
 */

import { registerAction } from './ux-action-registry.js';

/**
 * Helper para construir refresh plan canónico
 * @param {Object} context - Contexto de la mutación
 * @param {Object} uiState - Estado de UI
 * @param {Object} responseData - Respuesta del backend (opcional)
 * @returns {Array<string>} Lista de surface_ids a refrescar
 */
function buildRefreshPlan(context, uiState, responseData = null) {
  const surfaces = [];
  const view_mode = uiState.view_mode || 'operativa';
  const list_id = uiState.list_id || context.list_id;

  // Proyección: siempre refrescar si hay list_id
  if (view_mode === 'proyeccion' && list_id) {
    surfaces.push('alquimia.list_projection');
  }

  // Items: siempre refrescar si hay list_id y modo operativa
  if (view_mode === 'operativa' && list_id) {
    surfaces.push('alquimia.items');
  }

  // Flotante: SIEMPRE refrescar si está abierto e item_ref coincide
  // INDEPENDIENTEMENTE del view_mode (regla constitucional)
  if (context.item_ref) {
    const alquimiaState = typeof window !== 'undefined' && window.__AP_ALQUIMIA_STATE__;
    if (alquimiaState?.modal?.item?.item_ref === context.item_ref) {
      surfaces.push('alquimia.flotante_students');
    }
  }

  return surfaces;
}

/**
 * Construye endpoint para acciones de limpieza
 * @param {Object} context - Contexto (item_ref, scope, student_uuid)
 * @returns {string} Endpoint URL
 */
function buildCleanEndpoint(context) {
  if (!context.item_ref) {
    throw new Error('item_ref es obligatorio para acciones de limpieza');
  }

  const { scope, student_uuid } = context;

  if (scope === 'student' || student_uuid) {
    // Limpiar para estudiante específico
    return `/master/api/alquimia-general/items/${context.item_ref}/master/mark-clean-student`;
  } else if (scope === 'all' || !scope) {
    // Limpiar para todos
    return `/master/api/alquimia-general/items/${context.item_ref}/master/mark-clean-all`;
  } else {
    throw new Error(`scope "${scope}" no válido para acciones de limpieza. Debe ser "student" o "all"`);
  }
}

/**
 * Construye payload para acciones de limpieza
 * @param {Object} uiState - Estado de UI
 * @param {Object} context - Contexto (item_ref, item_kind, clean_layer, scope, student_uuid)
 * @returns {Object} Payload para el backend
 */
function buildCleanPayload(uiState, context) {
  const { item_ref, item_kind, clean_layer, scope, student_uuid } = context;

  // Validaciones obligatorias
  if (!item_ref) {
    throw new Error('item_ref es obligatorio para acciones de limpieza');
  }
  if (!item_kind || (item_kind !== 'recurrente' && item_kind !== 'una_vez')) {
    throw new Error('item_kind es obligatorio y debe ser "recurrente" o "una_vez"');
  }
  if (!clean_layer || (clean_layer !== 'shared' && clean_layer !== 'pde')) {
    throw new Error('clean_layer es obligatorio y debe ser "shared" o "pde"');
  }

  const payload = {
    item_kind,
    clean_layer
  };

  // Si scope es 'student', añadir student_uuid
  if (scope === 'student' || student_uuid) {
    if (!student_uuid) {
      throw new Error('student_uuid es obligatorio para scope="student"');
    }
    payload.student_uuid = student_uuid;
    payload.domain_type = 'transmutation';
    payload.actor_type = 'master';
    payload.surface_key = 'master.alquimia_general';
  }

  return payload;
}

/**
 * Construye endpoint para acciones de reset
 * @param {Object} context - Contexto (item_ref, list_id)
 * @returns {string} Endpoint URL
 */
function buildResetEndpoint(context) {
  if (context.list_id) {
    return '/master/api/alquimia-general/reset-list';
  } else if (context.item_ref) {
    return '/master/api/alquimia-general/reset-item';
  } else {
    throw new Error('item_ref o list_id es obligatorio para acciones de reset');
  }
}

/**
 * Construye payload para acciones de reset
 * @param {Object} uiState - Estado de UI
 * @param {Object} context - Contexto (student_uuid, item_ref, list_id, item_kind, view_layer)
 * @returns {Object} Payload para el backend
 */
function buildResetPayload(uiState, context) {
  const { student_uuid, item_ref, list_id, item_kind, view_layer } = context;

  // Validación dura: reset SOLO para recurrente
  if (item_kind === 'una_vez') {
    throw new Error('reset NO permitido para item_kind="una_vez". Reset solo para recurrente.');
  }

  // Validaciones obligatorias
  if (!student_uuid) {
    throw new Error('student_uuid es obligatorio para acciones de reset');
  }
  if (!item_ref && !list_id) {
    throw new Error('item_ref o list_id es obligatorio para acciones de reset');
  }

  const payload = {
    student_uuid,
    scope: 'student',
    view_layer: view_layer || uiState.view_layer || 'shared'
  };

  if (item_ref) {
    payload.item_ref = item_ref;
  }
  if (list_id) {
    payload.list_id = list_id;
  }
  if (item_kind) {
    payload.item_kind = item_kind;
  }

  return payload;
}

// ============================================================================
// ACCIÓN 1: alquimia.clean
// ============================================================================
// Limpiar item para un estudiante específico o para todos
// Capas: shared | pde
// Item kinds: recurrente | una_vez
// Scopes: item | student | all
registerAction({
  action_id: 'alquimia.clean',
  domain: 'master',
  description: 'Limpiar item para estudiante específico o para todos (shared o pde)',
  allowed_item_kinds: ['recurrente', 'una_vez'],
  allowed_layers: ['shared', 'pde'],
  allowed_scopes: ['item', 'student', 'all'],
  handler: {
    method: 'POST',
    endpointBuilder: buildCleanEndpoint,
    buildPayload: buildCleanPayload
  },
  refresh: buildRefreshPlan
});

// ============================================================================
// ACCIÓN 2: alquimia.clean_all
// ============================================================================
// Limpiar item para todos los estudiantes
// Capas: shared | pde
// Scope: all (implícito)
registerAction({
  action_id: 'alquimia.clean_all',
  domain: 'master',
  description: 'Limpiar item para todos los estudiantes (shared o pde)',
  allowed_item_kinds: ['recurrente', 'una_vez'],
  allowed_layers: ['shared', 'pde'],
  allowed_scopes: ['all'],
  handler: {
    method: 'POST',
    endpointBuilder: (context) => {
      if (!context.item_ref) {
        throw new Error('item_ref es obligatorio para alquimia.clean_all');
      }
      return `/master/api/alquimia-general/items/${context.item_ref}/master/mark-clean-all`;
    },
    buildPayload: (uiState, context) => {
      if (!context.item_kind || (context.item_kind !== 'recurrente' && context.item_kind !== 'una_vez')) {
        throw new Error('item_kind es obligatorio y debe ser "recurrente" o "una_vez"');
      }
      if (!context.clean_layer || (context.clean_layer !== 'shared' && context.clean_layer !== 'pde')) {
        throw new Error('clean_layer es obligatorio y debe ser "shared" o "pde"');
      }
      return {
        clean_layer: context.clean_layer,
        item_kind: context.item_kind
      };
    }
  },
  refresh: buildRefreshPlan
});

// ============================================================================
// ACCIÓN 3: alquimia.reset
// ============================================================================
// Resetear progreso de item o lista (SOLO recurrente)
// ❗ UNA_VEZ → hard fail
registerAction({
  action_id: 'alquimia.reset',
  domain: 'master',
  description: 'Resetear progreso de item o lista para un estudiante (SOLO recurrente)',
  allowed_item_kinds: ['recurrente'], // ❗ SOLO recurrente
  allowed_layers: null, // Reset no usa clean_layer
  allowed_scopes: ['item', 'student'],
  handler: {
    method: 'POST',
    endpointBuilder: buildResetEndpoint,
    buildPayload: buildResetPayload
  },
  refresh: buildRefreshPlan
});

console.log('[AlquimiaActions] ✅ 3 acciones consolidadas registradas en UX Action Registry');
