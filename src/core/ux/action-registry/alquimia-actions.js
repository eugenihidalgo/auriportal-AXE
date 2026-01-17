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

  // ============================================================================
  // BUG-002 FIX: Blindar buildRefreshPlan() - NUNCA puede retornar []
  // REGLA CONSTITUCIONAL A2: Refresh Engine → Surface obligatoria
  // ============================================================================
  if (surfaces.length === 0) {
    // Inyectar forzosamente alquimia.list_projection como default
    surfaces.push('alquimia.list_projection');
    console.warn('[AlquimiaActions][buildRefreshPlan] [INVARIANT_ENFORCED][REFRESH_SURFACE_DEFAULT] surfaces vacío, inyectando alquimia.list_projection por defecto', {
      context,
      uiState,
      view_mode,
      list_id
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
registerActionFn({
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

  // ============================================================================
  // BUG-006 FIX: Acciones UX para delete_item, update_lista, reset_overrides
  // ============================================================================
  
  // alquimia.delete_item: Eliminar item (soft delete)
  registerActionFn({
    action_id: 'alquimia.delete_item',
    domain: 'alquimia',
    request: {
      method: 'DELETE',
      endpointBuilder: (context) => `/master/api/alquimia-general/items/${context.item_id}`,
      buildPayload: (context) => ({})
    },
    refresh: function(context, uiState) {
      const surfaces = [];
      const view_mode = uiState.view_mode || 'operativa';
      const list_id = uiState.list_id || context.list_id;
      
      // Refrescar items si estamos en modo operativa
      if (view_mode === 'operativa' && list_id) {
        surfaces.push('alquimia.items');
      }
      
      // Refrescar proyección si estamos en modo proyección
      if (view_mode === 'proyeccion' && list_id) {
        surfaces.push('alquimia.list_projection');
      }
      
      return surfaces;
    }
  });
  
  // alquimia.reset_overrides: Resetear overrides de un item para un estudiante
  registerActionFn({
    action_id: 'alquimia.reset_overrides',
    domain: 'alquimia',
    request: {
      method: 'POST',
      endpointBuilder: (context) => `/master/api/alquimia-general/overrides/reset`,
      buildPayload: (context, uiState) => {
        // Determinar scope según contexto
        // Por defecto: ITEM_STUDENT (resetear overrides de un item para un estudiante)
        // Si viene list_id sin item_ref: LIST_STUDENT
        // Si viene item_ref sin student_uuid: ITEM_ALL
        // Si viene list_id sin student_uuid: LIST_ALL
        let scope = 'ITEM_STUDENT'; // Default
        if (context.list_id && !context.item_ref && !context.student_uuid) {
          scope = 'LIST_ALL';
        } else if (context.list_id && !context.item_ref && context.student_uuid) {
          scope = 'LIST_STUDENT';
        } else if (context.item_ref && !context.student_uuid) {
          scope = 'ITEM_ALL';
        } else if (context.item_ref && context.student_uuid) {
          scope = 'ITEM_STUDENT';
        }
        
        return {
          scope,
          student_uuid: context.student_uuid || null,
          item_ref: context.item_ref || null,
          list_id: context.list_id || uiState?.list_id || null,
          item_kind: context.item_kind || null,
          view_layer: uiState?.view_layer || context.view_layer || null
        };
      }
    },
    refresh: function(context, uiState) {
      // Usar buildRefreshPlan canónico (igual que clean/reset)
      // Overrides afectan proyección Y flotante (porque cambian el estado calculado)
      return buildRefreshPlan(context, uiState);
    }
  });
  
  // alquimia.update_lista: Actualizar configuración de lista
  registerActionFn({
    action_id: 'alquimia.update_lista',
    domain: 'alquimia',
    request: {
      method: 'PUT',
      endpointBuilder: (context) => `/master/api/alquimia-general/listas/${context.list_id}`,
      buildPayload: (context) => ({
        nombre: context.nombre,
        tipo: context.tipo,
        descripcion: context.descripcion,
        // ... otros campos según necesidad
      })
    },
    refresh: function(context, uiState) {
      const surfaces = [];
      const list_id = context.list_id;
      
      // Refrescar items y proyección si la lista cambió
      if (list_id) {
        surfaces.push('alquimia.items');
        surfaces.push('alquimia.list_projection');
      }
      
      return surfaces;
    }
  });

  console.log('[AlquimiaActions] ✅ 9 acciones registradas en UX Action Registry (6 consolidadas + 3 nuevas para BUG-006)');
})();
