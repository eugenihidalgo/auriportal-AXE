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
  // HOTFIX: Robustecer obtención de view_mode y list_id (pueden venir de context o uiState)
  const view_mode = uiState?.view_mode || context?.view_mode || 'operativa';
  const list_id = uiState?.list_id || context?.list_id;

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
  // BUG-008 FIX: Detección robusta - Si hay item_ref, refrescar siempre (idempotente)
  if (context.item_ref) {
    // BUG-008: Estrategia robusta - Si hay item_ref, refrescar flotante siempre
    // El refresh es idempotente (refrescar aunque no esté abierto no es error)
    // NO depender de window.__AP_ALQUIMIA_STATE__ (puede no estar disponible)
    surfaces.push('alquimia.flotante_students');
  }
  
  // HOTFIX: Parche obligatorio - Si view_mode=proyeccion y list_id existe, SIEMPRE incluir list_projection
  // Esto debe ocurrir aunque no se haya detectado arriba
  if (view_mode === 'proyeccion' && list_id && !surfaces.includes('alquimia.list_projection')) {
    surfaces.push('alquimia.list_projection');
  }
  
  // BUG-002 FIX: Blindar buildRefreshPlan() - NUNCA puede retornar []
  if (surfaces.length === 0) {
    // Inyectar forzosamente alquimia.list_projection como default
    surfaces.push('alquimia.list_projection');
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
 * Construye endpoint para acciones de reset (endpoint único canónico)
 * @param {Object} context - Contexto (reset_scope, item_ref, list_id)
 * @returns {string} Endpoint URL
 */
function buildResetEndpoint(context) {
  // REGLA CONSTITUCIONAL: Endpoint único para todos los tipos de reset
  return '/master/api/alquimia-general/reset';
}

/**
 * Construye payload para acciones de reset (canónico v1)
 * @param {Object} uiState - Estado de UI
 * @param {Object} context - Contexto (reset_scope, item_ref, list_id, student_uuid, clean_layer, reason)
 * @returns {Object} Payload para el backend
 */
function buildResetPayload(uiState, context) {
  const { reset_scope, item_ref, list_id, student_uuid, clean_layer, reason, item_kind } = context;

  // Validación dura: reset SOLO para recurrente
  if (item_kind === 'una_vez') {
    throw new Error('reset NO permitido para item_kind="una_vez". Reset solo para recurrente.');
  }

  // Validaciones obligatorias según reset_scope
  if (!reset_scope) {
    throw new Error('reset_scope es obligatorio. Valores: ITEM_STUDENT, ITEM_ALL, LIST_STUDENT, LIST_ALL');
  }

  const validScopes = ['ITEM_STUDENT', 'ITEM_ALL', 'LIST_STUDENT', 'LIST_ALL'];
  if (!validScopes.includes(reset_scope)) {
    throw new Error(`reset_scope inválido: "${reset_scope}". Debe ser uno de: ${validScopes.join(', ')}`);
  }

  // Validar clean_layer obligatorio
  if (!clean_layer || (clean_layer !== 'shared' && clean_layer !== 'pde')) {
    throw new Error('clean_layer es obligatorio y debe ser "shared" o "pde"');
  }

  // ============================================================================
  // VALIDACIONES CONDICIONALES POR reset_scope (CONTRATO CANÓNICO)
  // ============================================================================
  
  // ITEM_STUDENT: require student_uuid + item_ref
  if (reset_scope === 'ITEM_STUDENT') {
    if (!item_ref) {
      throw new Error('item_ref es obligatorio para reset_scope="ITEM_STUDENT"');
    }
    if (!student_uuid) {
      throw new Error('student_uuid es obligatorio para reset_scope="ITEM_STUDENT"');
    }
  }

  // LIST_STUDENT: require student_uuid + list_id
  if (reset_scope === 'LIST_STUDENT') {
    if (!list_id) {
      throw new Error('list_id es obligatorio para reset_scope="LIST_STUDENT"');
    }
    if (!student_uuid) {
      throw new Error('student_uuid es obligatorio para reset_scope="LIST_STUDENT"');
    }
  }

  // ITEM_ALL: require item_ref, PROHIBIR student_uuid
  if (reset_scope === 'ITEM_ALL') {
    if (!item_ref) {
      throw new Error('item_ref es obligatorio para reset_scope="ITEM_ALL"');
    }
    if (student_uuid) {
      throw new Error('student_uuid está PROHIBIDO para reset_scope="ITEM_ALL". Reset ALL no acepta student_uuid.');
    }
  }

  // LIST_ALL: require list_id, PROHIBIR student_uuid
  if (reset_scope === 'LIST_ALL') {
    if (!list_id) {
      throw new Error('list_id es obligatorio para reset_scope="LIST_ALL"');
    }
    if (student_uuid) {
      throw new Error('student_uuid está PROHIBIDO para reset_scope="LIST_ALL". Reset ALL no acepta student_uuid.');
    }
  }

  // ============================================================================
  // CONSTRUIR PAYLOAD CANÓNICO (NO incluir execution_key - es backend-only)
  // ============================================================================
  const payload = {
    reset_scope,
    clean_layer
  };

  // Incluir campos según scope (validaciones ya pasaron arriba)
  if (item_ref) {
    payload.item_ref = item_ref;
  }
  if (list_id) {
    payload.list_id = list_id;
  }
  // REGLA CONSTITUCIONAL: student_uuid SOLO para *_STUDENT, NUNCA para *_ALL
  if (reset_scope === 'ITEM_STUDENT' || reset_scope === 'LIST_STUDENT') {
    if (student_uuid) {
      payload.student_uuid = student_uuid;
    }
  }
  // NOTA: Para *_ALL, student_uuid NO se incluye (ya validado arriba que no existe)

  if (reason) {
    payload.reason = reason;
  }
  if (item_kind) {
    payload.item_kind = item_kind; // Para validación en backend
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
// ACCIÓN 3: alquimia.reset (CANÓNICO v1)
// ============================================================================
// Resetear progreso de item o lista (SOLO recurrente)
// ❗ UNA_VEZ → hard fail
// 
// reset_scope válidos:
// - ITEM_STUDENT: Reset item para estudiante específico
// - ITEM_ALL: Reset item para todos los estudiantes
// - LIST_STUDENT: Reset lista para estudiante específico
// - LIST_ALL: Reset lista para todos los estudiantes
//
// REGLA CONSTITUCIONAL:
// - clean_layer es OBLIGATORIO (shared | pde)
// - execution_key es BACKEND-ONLY (NO se incluye en payload)
// - El reset NO vuelve a NUNCA, vuelve a PENDIENTE
registerAction({
  action_id: 'alquimia.reset',
  domain: 'master',
  description: 'Resetear progreso de item o lista (SOLO recurrente) - Canónico v1',
  allowed_item_kinds: ['recurrente'], // ❗ SOLO recurrente
  allowed_layers: ['shared', 'pde'], // clean_layer es OBLIGATORIO
  allowed_scopes: ['item', 'list', 'all', 'student'], // UX scopes válidos (reset_scope en payload es dominio)
  handler: {
    method: 'POST',
    endpointBuilder: buildResetEndpoint,
    buildPayload: buildResetPayload
  },
  refresh: buildRefreshPlan
});

console.log('[AlquimiaActions] ✅ 3 acciones consolidadas registradas en UX Action Registry');
