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

// Importar desde registry core (si está disponible como ES module)
// Fallback: usar window.__AP_UX_ACTION_REGISTRY_CORE__ si se carga como script
let registerActionFn;
if (typeof window !== 'undefined' && window.__AP_UX_ACTION_REGISTRY_CORE__) {
  registerActionFn = window.__AP_UX_ACTION_REGISTRY_CORE__.register;
} else if (typeof registerAction !== 'undefined') {
  registerActionFn = registerAction;
} else {
  console.error('[AlquimiaActions] No se puede importar registerAction. Asegúrate de que ux-action-registry.js está cargado antes.');
  // Intentar registrar cuando el registry esté disponible
  registerActionFn = (actionDef) => {
    const registry = window.__AP_UX_ACTION_REGISTRY_CORE__;
    if (registry && registry.register) {
      registry.register(actionDef);
    } else {
      console.error('[AlquimiaActions] Registry no disponible para registrar:', actionDef.action_id);
    }
  };
}

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
  // BUG-008 FIX: Detección robusta - Si hay item_ref, refrescar siempre (idempotente)
  if (context.item_ref) {
    // BUG-008: Estrategia robusta - Si hay item_ref, refrescar flotante siempre
    // El refresh es idempotente (refrescar aunque no esté abierto no es error)
    // NO depender de window.__AP_ALQUIMIA_STATE__ (puede no estar disponible)
    surfaces.push('alquimia.flotante_students');
    console.log('[AlquimiaActions][buildRefreshPlan] [BUG-008] Flotante incluido en refresh plan (item_ref presente)', {
      item_ref: context.item_ref,
      strategy: 'always_refresh_if_item_ref'
    });
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
registerActionFn({
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
// FASE 2 FIX: Cambiar registerAction() a registerActionFn() para consistencia
registerActionFn({
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
registerActionFn({
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

// ============================================================================
// ACCIÓN 4: alquimia.create_lista
// ============================================================================
// Crear nueva lista de transmutación
registerActionFn({
  action_id: 'alquimia.create_lista',
  domain: 'master',
  description: 'Crear nueva lista de transmutación',
  allowed_item_kinds: null, // No aplica (es creación de lista)
  allowed_layers: null, // No aplica (es creación de lista)
  allowed_scopes: null, // No aplica (es creación de lista)
  handler: {
    method: 'POST',
    endpointBuilder: () => '/master/api/alquimia-general/listas',
    buildPayload: (uiState, context) => ({
      nombre: context.nombre.trim(),
      tipo: context.tipo || 'transmutacion',
      descripcion: context.descripcion || '',
      orden: context.orden || 0
    })
  },
  refresh: function(context, uiState) {
    // Refrescar listas después de crear
    return ['alquimia.listas'];
  }
});

// ============================================================================
// ACCIÓN 5: alquimia.create_item
// ============================================================================
// Crear nuevo item en una lista
registerActionFn({
  action_id: 'alquimia.create_item',
  domain: 'master',
  description: 'Crear nuevo item en una lista',
  allowed_item_kinds: null, // No aplica (es creación de item)
  allowed_layers: null, // No aplica (es creación de item)
  allowed_scopes: null, // No aplica (es creación de item)
  handler: {
    method: 'POST',
    endpointBuilder: () => '/master/api/alquimia-general/items',
    buildPayload: (uiState, context) => ({
      lista_id: context.lista_id,
      nombre: context.nombre.trim(),
      descripcion: context.descripcion || '',
      nivel: context.nivel || 9,
      priority: context.priority || 10,
      days: context.days || 20
    })
  },
  refresh: function(context, uiState) {
    // Refrescar items después de crear
    return ['alquimia.items'];
  }
});

// ============================================================================
// ACCIÓN 6: alquimia.clean_student (Alquimia Alumno)
// ============================================================================
// Limpiar item para un estudiante específico desde Alquimia Alumno
// Usa endpoint específico /master/api/alquimia-alumno/clean
registerActionFn({
  action_id: 'alquimia.clean_student',
  domain: 'master',
  description: 'Limpiar item para estudiante específico desde Alquimia Alumno',
  allowed_item_kinds: ['recurrente', 'una_vez'],
  allowed_layers: ['shared', 'pde'],
  allowed_scopes: ['student'],
  handler: {
    method: 'POST',
    endpointBuilder: () => '/master/api/alquimia-alumno/clean',
    buildPayload: (uiState, context) => {
      if (!context.student_uuid) {
        throw new Error('student_uuid es obligatorio para alquimia.clean_student');
      }
      if (!context.item_ref) {
        throw new Error('item_ref es obligatorio para alquimia.clean_student');
      }
      if (!context.item_kind || (context.item_kind !== 'recurrente' && context.item_kind !== 'una_vez')) {
        throw new Error('item_kind es obligatorio y debe ser "recurrente" o "una_vez"');
      }
      if (!context.clean_layer || (context.clean_layer !== 'shared' && context.clean_layer !== 'pde')) {
        throw new Error('clean_layer es obligatorio y debe ser "shared" o "pde"');
      }
      
      const payload = {
        student_uuid: context.student_uuid,
        item_ref: context.item_ref,
        item_kind: context.item_kind,
        actor_type: 'master',
        surface_key: 'master.alquimia_alumno',
        clean_layer: context.clean_layer,
        domain_type: 'transmutation',
        product_key: 'pde'
      };
      
      if (context.level_cap !== undefined && context.level_cap !== null) {
        payload.level_cap = context.level_cap === 999 ? 'infinity' : context.level_cap;
      }
      
      return payload;
    }
  },
  refresh: function(context, uiState) {
    // Refrescar megalist después de limpiar
    return ['alquimia.megalist'];
  }
});

  console.log('[AlquimiaActions] ✅ 6 acciones consolidadas registradas en UX Action Registry');
})();
