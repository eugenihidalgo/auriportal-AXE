/**
 * REFRESH ENGINE v2 ADAPTER - AuriPortal Master
 * 
 * Adaptación incremental del Refresh Engine v1 para soportar:
 * - action_id (en lugar de solo mutation_type)
 * - refresh_plan desde UX Action Registry
 * - surfaces declarativas desde Refresh Surface Registry
 * 
 * PRINCIPIO CONSTITUCIONAL:
 * - NO reescribir todo, extender lo existente
 * - Mantener compatibilidad con v1
 * - Añadir soporte para surfaces declarativas
 */

(function() {
  'use strict';

  // Guard: Verificar que Refresh Engine v1 está disponible
  if (typeof window === 'undefined' || !window.MasterRefreshEngineV1) {
    console.error('[RefreshEngineV2Adapter] MasterRefreshEngineV1 no disponible. Asegúrate de que está cargado antes.');
    return;
  }

  const engineV1 = window.MasterRefreshEngineV1;

  /**
   * Extiende afterMutation para soportar action_id y surfaces
   * @param {Object} mutation - Objeto de mutación (compatible con v1)
   * @param {string} [mutation.action_id] - ID de acción (nuevo en v2)
   * @param {Array} [mutation.context.surfaces] - Lista de surface_ids a refrescar (nuevo en v2)
   */
  async function afterMutationV2(mutation) {
    const { action_id, context = {}, module } = mutation;
    const surfaces = context.surfaces || [];

    // Si hay surfaces declarativas, usar Refresh Surface Registry
    if (surfaces.length > 0 && window.__AP_REFRESH_SURFACE_REGISTRY__) {
      const surfaceRegistry = window.__AP_REFRESH_SURFACE_REGISTRY__;
      // CIERRE-002: Propagación explícita de clean_layer y view_layer en uiState
      const uiState = {
        view_mode: mutation.scope?.view_mode || 'operativa',
        view_layer: context.view_layer || mutation.scope?.view_layer || 'shared',
        clean_layer: context.clean_layer || null, // CIERRE-002: Propagar clean_layer explícitamente
        item_kind: context.item_kind || null, // CIERRE-002: Propagar item_kind explícitamente
        list_id: context.list_id || null,
        student_uuid: context.student_uuid || null,
        modal_layerView: window.__AP_ALQUIMIA_STATE__?.modal?.layerView || null
      };
      
      // CIERRE-002: Log forense de propagación
      if (context.clean_layer || context.view_layer) {
        console.log('[REFRESH_ENGINE_V2][CIERRE-002] Context propagado a uiState', {
          action_id: action_id || mutation.mutation_type,
          clean_layer: uiState.clean_layer,
          view_layer: uiState.view_layer,
          item_kind: uiState.item_kind,
          context_keys: Object.keys(context)
        });
      }

      console.log('[REFRESH_ENGINE_V2][SURFACES] Ejecutando surfaces declarativas', {
        action_id: action_id || mutation.mutation_type,
        surfaces,
        timestamp: new Date().toISOString()
      });

      // Ejecutar cada surface
      for (const surface_id of surfaces) {
        try {
          await surfaceRegistry.refetch(surface_id, context, uiState);
        } catch (error) {
          console.error(`[REFRESH_ENGINE_V2][SURFACE_ERROR] ${surface_id}`, {
            action_id: action_id || mutation.mutation_type,
            surface_id,
            error: error.message,
            timestamp: new Date().toISOString()
          });
          // Continuar con otras surfaces aunque una falle
        }
      }

      console.log('[REFRESH_ENGINE_V2][SURFACES] Completado', {
        action_id: action_id || mutation.mutation_type,
        surfaces_executed: surfaces.length,
        timestamp: new Date().toISOString()
      });

      // FLOTANTE_PROJECTION_ONLY_V1: v2 ya ejecutó Surface Registry (refetch único).
      // v1 debe hacer solo render; invalidate y refetch se omiten para evitar doble handleVerItem/GET.
      const modules = engineV1.getEngineInfo?.()?.registeredModules || [];
      if (module && modules.includes(module)) {
        await engineV1.afterMutation({
          ...mutation,
          context: {
            ...context,
            surfaces: [],
            __v2_handled_refetch__: true
          }
        });
      }

      return;
    }

    // Fallback a v1 si no hay surfaces declarativas
    console.log('[REFRESH_ENGINE_V2] Sin surfaces declarativas, usando v1', {
      action_id: action_id || mutation.mutation_type
    });
    return engineV1.afterMutation(mutation);
  }

  // Extender engine v1 con método v2
  if (window.MasterRefreshEngineV1) {
    window.MasterRefreshEngineV1.afterMutationV2 = afterMutationV2;
    console.log('[RefreshEngineV2Adapter] ✅ Refresh Engine v2 adapter disponible');
  }
})();
