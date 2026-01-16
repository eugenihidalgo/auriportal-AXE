/**
 * ALQUIMIA ACTIONS REGISTRY v1 - AuriPortal Master
 * 
 * Registro canónico de acciones UX para Alquimia General.
 * 
 * Este archivo registra TODAS las acciones de Alquimia en el UX Action Registry.
 * Se carga ANTES de master-alquimia-general-client.js para que las acciones
 * estén disponibles cuando se necesiten.
 * 
 * RUNTIME CORE v1: Espera a que el runtime esté READY antes de registrar acciones.
 */

// BUG FIX: Esperar a que el runtime esté READY antes de registrar acciones
(async function() {
  'use strict';

  // Verificar que Runtime Ready Gate está disponible
  if (!window.__AP_RUNTIME_READY__) {
    console.error('[AlquimiaActionsRegistry] Runtime Ready Gate no disponible. runtime-ready.v1.js debe cargarse antes.');
    return;
  }

  try {
    // Esperar a que el runtime esté READY
    await window.__AP_RUNTIME_READY__.whenReady();
    
    // Verificar que UX Action Registry Core está disponible
    if (!window.__AP_UX_ACTION_REGISTRY_CORE__) {
      console.error('[AlquimiaActionsRegistry] UX Action Registry Core no disponible después de runtime ready.');
      return;
    }

    const registry = window.__AP_UX_ACTION_REGISTRY_CORE__;
    
    // Verificar que register está disponible
    if (typeof registry.register !== 'function') {
      console.error('[AlquimiaActionsRegistry] register no disponible en registry core.');
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
      handler: {
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
      refresh: buildRefreshPlan
    });

    // ============================================================================
    // ACCIÓN 2: alquimia.clean.all
    // ============================================================================
    registry.register({
      action_id: 'alquimia.clean.all',
      domain: 'master',
      description: 'Limpiar item para todos los estudiantes (shared o pde)',
      handler: {
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
      refresh: buildRefreshPlan
    });

    // ============================================================================
    // ACCIÓN 3: alquimia.increment.all
    // ============================================================================
    registry.register({
      action_id: 'alquimia.increment.all',
      domain: 'master',
      description: 'Incrementar contador de item para todos los estudiantes (una_vez)',
      handler: {
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
      refresh: buildRefreshPlan
    });

    // ============================================================================
    // ACCIÓN 4: alquimia.reset.item
    // ============================================================================
    registry.register({
      action_id: 'alquimia.reset.item',
      domain: 'master',
      description: 'Resetear progreso de item para un estudiante (recurrente)',
      handler: {
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
      refresh: buildRefreshPlan
    });

    // ============================================================================
    // ACCIÓN 5: alquimia.reset.list
    // ============================================================================
    registry.register({
      action_id: 'alquimia.reset.list',
      domain: 'master',
      description: 'Resetear progreso de lista completa para un estudiante (recurrente)',
      handler: {
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
      refresh: buildRefreshPlan
    });

    // Log temporal para debug
    const registeredActions = registry.list ? registry.list() : [];
    console.log('[AlquimiaActionsRegistry] ✅ 5 acciones registradas en UX Action Registry', {
      total: registeredActions.length,
      actions: registeredActions.map(a => a.action_id)
    });
  } catch (error) {
    // Si el runtime está BROKEN, no registrar acciones
    if (error.message && error.message.includes('BROKEN')) {
      console.error('[AlquimiaActionsRegistry] Runtime está BROKEN, no se registran acciones:', error.message);
      return;
    }
    // Otros errores: loguear y no registrar
    console.error('[AlquimiaActionsRegistry] Error registrando acciones:', error);
  }
})();
