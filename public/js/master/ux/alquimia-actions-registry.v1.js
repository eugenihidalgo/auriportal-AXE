/**
 * ALQUIMIA ACTIONS REGISTRY v1 - AuriPortal Master
 * 
 * Registro canónico de acciones UX para Alquimia General.
 * 
 * Este archivo registra TODAS las acciones de Alquimia en el UX Action Registry.
 * Se carga ANTES de master-alquimia-general-client.js para que las acciones
 * estén disponibles cuando se necesiten.
 */

(function() {
  'use strict';

  // Guard: Verificar que UX Action Registry está disponible
  // El registry se carga desde /js/core/ux/ux-action-registry.v1.js
  // y expone registerUxAction en window.__AP_UX_ACTION_REGISTRY__
  if (typeof window === 'undefined' || !window.__AP_UX_ACTION_REGISTRY__) {
    console.error('[AlquimiaActionsRegistry] UX Action Registry no disponible. Asegúrate de que está cargado antes.');
    return;
  }

  const registry = window.__AP_UX_ACTION_REGISTRY__;
  
  // Verificar que registerUxAction está disponible
  if (typeof registry.registerUxAction !== 'function') {
    console.error('[AlquimiaActionsRegistry] registerUxAction no disponible en registry. Verificar carga de ux-action-registry.v1.js');
    return;
  }

  /**
   * Helper para construir refresh plan canónico
   * @param {Object} context - Contexto de la mutación
   * @param {Object} uiState - Estado de UI
   * @returns {Array} Lista de surface_ids a refrescar
   */
  function buildRefreshPlan(context, uiState) {
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
    if (context.item_ref && window.__AP_ALQUIMIA_STATE__?.modal?.item?.item_ref === context.item_ref) {
      surfaces.push('alquimia.flotante_students');
    }

    return surfaces;
  }

  // ============================================================================
  // ACCIÓN 1: alquimia.clean.student
  // ============================================================================
  registry.register({
    action_id: 'alquimia.clean.student',
    domain: 'master',
    description: 'Limpiar item para un estudiante específico (shared o pde)',
    request: {
      method: 'POST',
      endpointBuilder: (context) => {
        if (!context.item_ref) {
          throw new Error('item_ref es obligatorio para alquimia.clean.student');
        }
        return `/master/api/alquimia-general/items/${context.item_ref}/master/mark-clean-student`;
      },
      buildPayload: (uiState, context) => {
        if (!context.student_uuid) {
          throw new Error('student_uuid es obligatorio para alquimia.clean.student');
        }
        if (!context.item_ref) {
          throw new Error('item_ref es obligatorio para alquimia.clean.student');
        }
        if (!context.item_kind) {
          throw new Error('item_kind es obligatorio para alquimia.clean.student');
        }
        if (!context.clean_layer || (context.clean_layer !== 'shared' && context.clean_layer !== 'pde')) {
          throw new Error('clean_layer debe ser "shared" o "pde"');
        }
        return {
          student_uuid: context.student_uuid,
          item_ref: context.item_ref,
          item_kind: context.item_kind,
          domain_type: 'transmutation',
          clean_layer: context.clean_layer,
          actor_type: 'master',
          surface_key: 'master.alquimia_general'
        };
      }
    },
    refresh_plan: buildRefreshPlan,
    telemetry: {
      log_input: true,
      log_output: true
    }
  });

  // ============================================================================
  // ACCIÓN 2: alquimia.clean.all
  // ============================================================================
  registry.registerUxAction({
    action_id: 'alquimia.clean.all',
    domain: 'master',
    description: 'Limpiar item para todos los estudiantes (shared o pde)',
    request: {
      method: 'POST',
      endpointBuilder: (context) => {
        if (!context.item_ref) {
          throw new Error('item_ref es obligatorio para alquimia.clean.all');
        }
        return `/master/api/alquimia-general/items/${context.item_ref}/master/mark-clean-all`;
      },
      buildPayload: (uiState, context) => {
        if (!context.item_kind) {
          throw new Error('item_kind es obligatorio para alquimia.clean.all');
        }
        if (!context.clean_layer || (context.clean_layer !== 'shared' && context.clean_layer !== 'pde')) {
          throw new Error('clean_layer debe ser "shared" o "pde"');
        }
        return {
          clean_layer: context.clean_layer,
          item_kind: context.item_kind
        };
      }
    },
    refresh_plan: buildRefreshPlan,
    telemetry: {
      log_input: true,
      log_output: true
    }
  });

  // ============================================================================
  // ACCIÓN 3: alquimia.increment.all
  // ============================================================================
  registry.registerUxAction({
    action_id: 'alquimia.increment.all',
    domain: 'master',
    description: 'Incrementar contador de item para todos los estudiantes (una_vez)',
    request: {
      method: 'POST',
      endpointBuilder: (context) => {
        if (!context.item_ref) {
          throw new Error('item_ref es obligatorio para alquimia.increment.all');
        }
        return `/master/api/alquimia-general/items/${context.item_ref}/master/increment-all`;
      },
      buildPayload: (uiState, context) => {
        if (!context.item_kind) {
          throw new Error('item_kind es obligatorio para alquimia.increment.all');
        }
        if (!context.clean_layer || (context.clean_layer !== 'shared' && context.clean_layer !== 'pde')) {
          throw new Error('clean_layer debe ser "shared" o "pde"');
        }
        return {
          clean_layer: context.clean_layer,
          item_kind: context.item_kind
        };
      }
    },
    refresh_plan: buildRefreshPlan,
    telemetry: {
      log_input: true,
      log_output: true
    }
  });

  // ============================================================================
  // ACCIÓN 4: alquimia.reset.item
  // ============================================================================
  registry.registerUxAction({
    action_id: 'alquimia.reset.item',
    domain: 'master',
    description: 'Resetear progreso de item para un estudiante (recurrente)',
    request: {
      method: 'POST',
      endpointBuilder: () => {
        return '/master/api/alquimia-general/reset-item';
      },
      buildPayload: (uiState, context) => {
        if (!context.student_uuid) {
          throw new Error('student_uuid es obligatorio para alquimia.reset.item');
        }
        if (!context.item_ref) {
          throw new Error('item_ref es obligatorio para alquimia.reset.item');
        }
        if (!context.item_kind) {
          throw new Error('item_kind es obligatorio para alquimia.reset.item');
        }
        return {
          student_uuid: context.student_uuid,
          item_ref: context.item_ref,
          item_kind: context.item_kind,
          scope: 'student',
          view_layer: context.view_layer || uiState.view_layer || 'shared'
        };
      }
    },
    refresh_plan: buildRefreshPlan,
    telemetry: {
      log_input: true,
      log_output: true
    }
  });

  // ============================================================================
  // ACCIÓN 5: alquimia.reset.list
  // ============================================================================
  registry.registerUxAction({
    action_id: 'alquimia.reset.list',
    domain: 'master',
    description: 'Resetear progreso de lista completa para un estudiante (recurrente)',
    request: {
      method: 'POST',
      endpointBuilder: () => {
        return '/master/api/alquimia-general/reset-list';
      },
      buildPayload: (uiState, context) => {
        if (!context.student_uuid) {
          throw new Error('student_uuid es obligatorio para alquimia.reset.list');
        }
        if (!context.list_id) {
          throw new Error('list_id es obligatorio para alquimia.reset.list');
        }
        if (!context.item_kind) {
          throw new Error('item_kind es obligatorio para alquimia.reset.list');
        }
        return {
          student_uuid: context.student_uuid,
          list_id: context.list_id,
          item_kind: context.item_kind,
          scope: 'student',
          view_layer: context.view_layer || uiState.view_layer || 'shared'
        };
      }
    },
    refresh_plan: buildRefreshPlan,
    telemetry: {
      log_input: true,
      log_output: true
    }
  });

  console.log('[AlquimiaActionsRegistry] ✅ 5 acciones registradas en UX Action Registry');
})();
