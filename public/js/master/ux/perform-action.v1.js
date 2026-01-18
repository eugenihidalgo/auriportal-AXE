/**
 * PERFORM ACTION v1 - AuriPortal Master
 * 
 * Wrapper canónico para ejecutar acciones UX con contratos formales.
 * 
 * PRINCIPIO CONSTITUCIONAL:
 * - Toda mutación UI debe pasar por performAction()
 * - Toda acción debe estar registrada en UX Action Registry
 * - Toda acción debe declarar Refresh Plan
 * - Prohibido fetch POST ad-hoc fuera de performAction
 * 
 * CONTRATO:
 * - action_id: ID de acción registrada
 * - context: Contexto de la acción (item_ref, student_uuid, etc.)
 * - uiState: Estado de la UI (view_mode, view_layer, etc.)
 * 
 * FLUJO:
 * 1) Resuelve actionDef del registry
 * 2) Log [UX][ACTION][START]
 * 3) Ejecuta fetch del POST
 * 4) Log [UX][ACTION][END] ok/err
 * 5) Llama refreshEngine.afterMutation()
 * 6) Devuelve response para banners UI
 */

// Dependencias: UX Action Registry debe estar disponible
// Se carga desde master-layout-registry.v1.json o inyectado antes

(async function() {
  'use strict';

  // Guard idempotente
  if (window.__AP_PERFORM_ACTION_V1_LOADED__) {
    console.warn('[PerformActionV1] Ya cargado, ignorando carga duplicada');
    return;
  }
  window.__AP_PERFORM_ACTION_V1_LOADED__ = true;

  /**
   * FIX 3: Fuerza refetch manual mínimo si Refresh Engine no está disponible
   * 
   * @param {string} action_id - ID de la acción
   * @param {Object} context - Contexto de la acción
   * @param {Object} uiState - Estado de la UI
   * @param {Array} surfacesToRefresh - Superficies a refrescar
   */
  async function forceManualRefetch(action_id, context, uiState, surfacesToRefresh) {
    console.log('[REFRESH][FORCED_REFETCH] Ejecutando refetch manual', {
      action_id,
      surfaces: surfacesToRefresh,
      context,
      uiState,
      timestamp: new Date().toISOString()
    });
    
    // Refetch mínimo para acciones de alquimia
    if (action_id && action_id.startsWith('alquimia.')) {
      const { item_ref, list_id, student_uuid } = context || {};
      
      // Refetch flotante si está abierto (independiente de view_mode)
      if (item_ref && typeof window !== 'undefined' && window.__AP_ALQUIMIA_STATE__) {
        const alquimiaState = window.__AP_ALQUIMIA_STATE__;
        const alquimiaFunctions = window.__AP_ALQUIMIA_FUNCTIONS__;
        
        if (alquimiaFunctions && alquimiaFunctions.handleVerItem && alquimiaState?.modal?.item && alquimiaState.modal.item.item_ref === item_ref) {
          const viewLayer = uiState?.view_layer || alquimiaState?.projection?.view_layer || 'shared';
          const cleanLayer = context?.clean_layer || alquimiaState?.modal?.cleanLayer || 'shared';
          
          console.log('[REFRESH][FORCED_REFETCH] Refrescando flotante manualmente', {
            item_ref,
            view_layer: viewLayer,
            clean_layer: cleanLayer
          });
          
          try {
            await alquimiaFunctions.handleVerItem(alquimiaState.modal.item, cleanLayer, viewLayer);
          } catch (error) {
            console.error('[REFRESH][FORCED_REFETCH] Error refrescando flotante', error);
          }
        }
      }
      
      // Refetch list_projection si existe función
      if (typeof window !== 'undefined' && window.__AP_ALQUIMIA_FUNCTIONS__) {
        const alquimiaFunctions = window.__AP_ALQUIMIA_FUNCTIONS__;
        if (alquimiaFunctions && alquimiaFunctions.loadListProjection) {
          try {
            await alquimiaFunctions.loadListProjection();
          } catch (error) {
            console.error('[REFRESH][FORCED_REFETCH] Error refrescando list projection', error);
          }
        }
      }
    }
  }

  // RUNTIME CORE v1: Esperar a que el Runtime esté READY antes de exponer performAction
  try {
    if (!window.__AP_RUNTIME_READY__) {
      throw new Error('[PerformActionV1] Runtime Ready Gate no disponible. runtime-ready.v1.js debe cargarse antes.');
    }
    await window.__AP_RUNTIME_READY__.whenReady();
    console.log('[PerformActionV1] ✅ Runtime READY - performAction disponible');
  } catch (error) {
    console.error('[PerformActionV1] ❌ Runtime no está READY:', error);
    // NO exponer performAction si runtime está broken
    throw error;
  }

  /**
   * Ejecuta una acción UX con contrato formal
   * @param {Object} params - Parámetros de la acción
   * @param {string} params.action_id - ID de acción registrada
   * @param {Object} [params.payload] - Payload a enviar (compatible con nuevo schema)
   * @param {Object} [params.context] - Contexto (item_ref, student_uuid, list_id, etc.) (compatible con schema anterior)
   * @param {Object} [params.uiState] - Estado de UI (view_mode, view_layer, etc.)
   * @param {Object} [params.options] - Opciones adicionales
   * @returns {Promise<Object>} Response de la acción
   */

  async function performAction({ action_id, payload = {}, context = {}, uiState = {}, options = {} }) {
    // CONSTITUTIONAL RULE:
    // trace_id MUST be initialized before any log, catch or side-effect
    const trace_id = `ux_action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log('[FORENSIC][ACTION][PAYLOAD]', { action_id, payload, context });
    // Validaciones básicas
    if (!action_id || typeof action_id !== 'string') {
      throw new Error('[PerformActionV1] action_id es obligatorio y debe ser string');
    }

    // RUNTIME CORE v1: Verificar que el runtime está READY
    if (!window.__AP_RUNTIME_READY__ || window.__AP_RUNTIME_READY__.state() !== 'ready') {
      const error = new Error('[PerformActionV1] Runtime no está READY. El runtime core no ha terminado de cargar o falló.');
      console.error('[PerformActionV1] ❌ Runtime no READY', {
        action_id,
        runtime_state: window.__AP_RUNTIME_READY__?.state() || 'unknown',
        runtime_error: window.__AP_RUNTIME_READY__?.error || null,
        timestamp: new Date().toISOString()
      });
      throw error;
    }

    // Obtener actionDef del registry core (PROHIBIDO fallback legacy)
    const actionRegistry = window.__AP_UX_ACTION_REGISTRY_CORE__;
    if (!actionRegistry) {
      const error = new Error('[PerformActionV1] UX Action Registry Core no disponible. El loader no ha terminado de cargar o falló.');
      console.error('[PerformActionV1] ❌ Registry Core no disponible', {
        action_id,
        has_core: !!window.__AP_UX_ACTION_REGISTRY_CORE__,
        timestamp: new Date().toISOString()
      });
      throw error;
    }

    const actionDef = actionRegistry.get(action_id);
    
    // ========================================================================
    // FASE B - DIAG FORENSE: Action Registry Resolution
    // ========================================================================
    console.log('[DIAG][ACTION][RESOLVED]', {
      phase: 'FASE_B_ACTION_REGISTRY',
      action_id,
      trace_id,
      action_found: !!actionDef,
      action_key: action_id,
      action_def: actionDef ? {
        domain: actionDef.domain,
        allowed_item_kinds: actionDef.allowed_item_kinds,
        allowed_layers: actionDef.allowed_layers,
        allowed_scopes: actionDef.allowed_scopes,
        has_handler: !!actionDef.handler,
        has_request: !!actionDef.request,
        has_refresh: !!actionDef.refresh || !!actionDef.refresh_plan
      } : null,
      timestamp: new Date().toISOString()
    });
    
    if (!actionDef) {
      // BUG-B HOTFIX: Log forense cuando action_id no está registrado
      const registryKeys = actionRegistry.actions ? Object.keys(actionRegistry.actions) : 
                          (actionRegistry.constructor.name === 'Map' ? Array.from(actionRegistry.keys()) : 
                          Object.keys(actionRegistry || {}));
      console.error('[FORENSIC][ACTION_REGISTRY][MISSING_ACTION]', {
        action_id,
        available_actions: registryKeys.slice(0, 20), // Primeros 20 para no saturar
        available_count: registryKeys.length,
        context: typeof window !== 'undefined' ? window.__AP_CONTEXT__ : null,
        build_stamp: typeof window !== 'undefined' ? window.__AP_MASTER_ALQUIMIA_GENERAL_STAMP__ : null,
        registry_type: actionRegistry.constructor.name,
        has_get: typeof actionRegistry.get === 'function'
      });
      throw new Error(`[PerformActionV1] action_id not registered: ${action_id}`);
    }

    // ============================================================================
    // VALIDACIÓN EXPLÍCITA DE DOMINIO (FASE A - CIERRE TÉCNICO DURO)
    // ============================================================================
    const currentContext = typeof window !== 'undefined' ? window.__AP_CONTEXT__ : null;
    const domainMap = {
      'MASTER': 'master',
      'GOD': 'god',
      'ADMIN_LEGACY': 'admin_legacy',
      'STUDENT': null // STUDENT no tiene acciones UX (solo lectura)
    };
    const currentDomain = currentContext ? domainMap[currentContext] : null;
    
    if (actionDef.domain && currentDomain && actionDef.domain !== currentDomain) {
      const error = new Error(`[PerformActionV1] Violación de dominio: acción "${action_id}" es de dominio "${actionDef.domain}" pero contexto actual es "${currentDomain}"`);
      console.error('[UX][ACTION][DOMAIN_VIOLATION]', {
        action_id,
        trace_id,
        action_domain: actionDef.domain,
        current_domain: currentDomain,
        current_context: currentContext,
        timestamp: new Date().toISOString()
      });
      throw error;
    }

    // Construir endpoint y payload
    // Compatibilidad: si viene payload explícito, usarlo; sino, construir desde context (legacy)
    let finalPayload;
    let endpoint;
    
    if (actionDef.handler) {
      // Nuevo schema (core)
      endpoint = actionDef.handler.endpointBuilder({ ...context, ...payload });
      finalPayload = actionDef.handler.buildPayload(uiState, { ...context, ...payload });
    } else if (actionDef.request) {
      // Legacy schema
      endpoint = actionDef.request.endpointBuilder(context);
      finalPayload = actionDef.request.buildPayload(uiState, context);
    } else {
      throw new Error(`[PerformActionV1] Acción ${action_id} no tiene handler definido`);
    }
    
    // ========================================================================
    // FASE B - DIAG FORENSE: Payload Final y Refresh Plan
    // ========================================================================
    const refreshPlan = actionDef.refresh || actionDef.refresh_plan;
    let refreshPlanResolved = null;
    if (typeof refreshPlan === 'function') {
      refreshPlanResolved = refreshPlan({ ...context, ...payload }, uiState, null);
    } else if (Array.isArray(refreshPlan)) {
      refreshPlanResolved = refreshPlan;
    }
    
    console.log('[DIAG][ACTION][PAYLOAD_FINAL]', {
      phase: 'FASE_B_PAYLOAD',
      action_id,
      trace_id,
      endpoint,
      payload_final: finalPayload,
      refresh_plan_generated: refreshPlanResolved,
      refresh_plan_type: typeof refreshPlan,
      timestamp: new Date().toISOString()
    });

    // ============================================================================
    // VALIDACIÓN DE PAYLOAD (FASE A - CIERRE TÉCNICO DURO)
    // ============================================================================
    // Validar payload contra schema de acción (allowed_item_kinds, allowed_layers, allowed_scopes)
    const validationErrors = [];
    
    // Validar allowed_item_kinds
    if (actionDef.allowed_item_kinds && Array.isArray(actionDef.allowed_item_kinds)) {
      if (finalPayload.item_kind && !actionDef.allowed_item_kinds.includes(finalPayload.item_kind)) {
        validationErrors.push(`item_kind "${finalPayload.item_kind}" no permitido. Permitidos: ${actionDef.allowed_item_kinds.join(', ')}`);
      }
    }
    
    // Validar allowed_layers
    if (actionDef.allowed_layers && Array.isArray(actionDef.allowed_layers)) {
      if (finalPayload.clean_layer && !actionDef.allowed_layers.includes(finalPayload.clean_layer)) {
        validationErrors.push(`clean_layer "${finalPayload.clean_layer}" no permitido. Permitidos: ${actionDef.allowed_layers.join(', ')}`);
      }
    }
    
    // Validar allowed_scopes
    if (actionDef.allowed_scopes && Array.isArray(actionDef.allowed_scopes)) {
      const scope = finalPayload.scope || context.scope || 'all';
      if (!actionDef.allowed_scopes.includes(scope)) {
        validationErrors.push(`scope "${scope}" no permitido. Permitidos: ${actionDef.allowed_scopes.join(', ')}`);
      }
    }
    
    // Hard fail si hay errores de validación
    if (validationErrors.length > 0) {
      const error = new Error(`[PerformActionV1] Validación de payload falló: ${validationErrors.join('; ')}`);
      console.error('[UX][ACTION][VALIDATION_FAILED]', {
        action_id,
        trace_id,
        errors: validationErrors,
        payload: finalPayload,
        context,
        allowed_item_kinds: actionDef.allowed_item_kinds,
        allowed_layers: actionDef.allowed_layers,
        allowed_scopes: actionDef.allowed_scopes,
        timestamp: new Date().toISOString()
      });
      throw error;
    }

    // UX_ACTION_EXECUTION_KEY_UNIQUE_V1: cada performAction lleva execution_key único (trace_id)
    // para evitar colisión de idempotencia en backend (mismo día mismo item/student colapsaba).
    finalPayload.execution_key = finalPayload.execution_key || trace_id;

    // Log forense inicial
    const method = actionDef.handler?.method || actionDef.request?.method || 'POST';
    const logInput = actionDef.telemetry?.log_input !== false;
    
    if (logInput) {
      console.log('[UX][ACTION][START]', {
        action_id,
        trace_id,
        endpoint,
        method,
        payload: finalPayload,
        context,
        uiState: {
          view_mode: uiState.view_mode,
          view_layer: uiState.view_layer,
          list_id: uiState.list_id
        },
        allowed_item_kinds: actionDef.allowed_item_kinds,
        allowed_layers: actionDef.allowed_layers,
        allowed_scopes: actionDef.allowed_scopes,
        timestamp: new Date().toISOString()
      });
    }

    let response;
    let responseData;

    try {
      // Ejecutar fetch
      const headers = actionDef.handler?.headers || actionDef.request?.headers || {};
      const fetchOptions = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        credentials: 'include',
        body: method !== 'GET' ? JSON.stringify(finalPayload) : undefined
      };

      const startTime = Date.now();
      // Telemetría localhost desactivada en producción (ensucia consola con CORS)
      // #region agent log (disabled)
      // if (typeof location !== 'undefined' && location.hostname === 'localhost') {
      //   fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'perform-action.v1.js:301',message:'BEFORE fetch POST',data:{action_id,endpoint,method,payload:finalPayload},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // }
      // #endregion
      response = await fetch(endpoint, fetchOptions);
      const duration = Date.now() - startTime;
      // Telemetría localhost desactivada en producción (ensucia consola con CORS)
      // #region agent log (disabled)
      // if (typeof location !== 'undefined' && location.hostname === 'localhost') {
      //   fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'perform-action.v1.js:302',message:'AFTER fetch POST',data:{action_id,status:response.status,statusText:response.statusText,contentType:response.headers.get('content-type')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // }
      // #endregion

      // Verificar content-type
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        const firstBytes = text.substring(0, 200);
        console.error('[PerformActionV1] Respuesta no-JSON', {
          action_id,
          trace_id,
          status: response.status,
          contentType,
          firstBytes
        });
        throw new Error(`Respuesta no-JSON del servidor (${response.status})`);
      }

      responseData = await response.json();
      // Telemetría localhost desactivada en producción (ensucia consola con CORS)
      // #region agent log (disabled)
      // if (typeof location !== 'undefined' && location.hostname === 'localhost') {
      //   fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'perform-action.v1.js:319',message:'AFTER response.json()',data:{action_id,response_ok:responseData?.ok,response_error:responseData?.error,has_data:!!responseData?.data,has_state:!!responseData?.data?.state},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // }
      // #endregion

      // Log forense de respuesta
      const logOutput = actionDef.telemetry?.log_output !== false;
      if (logOutput) {
        console.log('[UX][ACTION][END]', {
          action_id,
          trace_id,
          status: response.status,
          ok: responseData.ok,
          duration_ms: duration,
          has_data: !!responseData.data,
          error: responseData.error || null,
          timestamp: new Date().toISOString()
        });
      }

      // Verificar respuesta HTTP
      if (!response.ok) {
        const errorMsg = responseData.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMsg);
      }

      // Verificar respuesta del backend
      if (!responseData.ok) {
        const errorMsg = responseData.error || 'Error desconocido del backend';
        const backendTraceId = responseData.trace_id || 'N/A';
        throw new Error(`${errorMsg} (trace_id=${backendTraceId})`);
      }

      // ACTION_FORCES_PROJECTION_V1: Si result.ok, el refresh se ejecuta SIEMPRE.
      // applied/skipped (idempotencia en DB) NUNCA condicionan el refresh.
      // Idempotencia de escritura ≠ idempotencia de proyección.
      // FIX 3: Ejecutar refresh plan SIEMPRE, independiente de Refresh Engine
      const refreshEngine = window.MasterRefreshEngineV1;
      const refreshPlan = actionDef.refresh || actionDef.refresh_plan;
      let surfacesToRefresh = [];
      
      // buildRefreshPlan NO debe usar responseData.applied/skipped para filtrar surfaces
      if (typeof refreshPlan === 'function') {
        surfacesToRefresh = refreshPlan({ ...context, ...payload }, uiState, responseData);
      } else if (Array.isArray(refreshPlan)) {
        surfacesToRefresh = refreshPlan;
      }
      
      // ========================================================================
      // FASE E - DIAG FORENSE: Refresh Plan Generated
      // ========================================================================
      console.log('[DIAG][REFRESH][PLAN]', {
        phase: 'FASE_E_REFRESH_PLAN',
        action_id,
        trace_id,
        refresh_plan_type: typeof refreshPlan,
        surfaces_to_refresh: surfacesToRefresh,
        refresh_engine_available: !!refreshEngine,
        context: {
          item_ref: context?.item_ref,
          student_uuid: context?.student_uuid,
          clean_layer: context?.clean_layer
        },
        uiState: {
          view_mode: uiState.view_mode,
          view_layer: uiState.view_layer
        },
        timestamp: new Date().toISOString()
      });
      
      // Log del plan
      console.log('[REFRESH][AFTER_ACTION]', {
        action_id,
        trace_id,
        surfaces: surfacesToRefresh,
        refresh_engine_available: !!refreshEngine,
        timestamp: new Date().toISOString()
      });

      if (refreshEngine) {
        // Refresh Engine disponible: usar engine canónico
        try {
          // Intentar usar Refresh Engine v2 (con surfaces) si está disponible
          if (typeof refreshEngine.afterMutationV2 === 'function') {
            await refreshEngine.afterMutationV2({
              module: 'alquimia_general', // TODO: hacer dinámico según domain
              mutation_type: action_id, // Compatibilidad v1
              action_id: action_id, // Nuevo en v2
              scope: {
                view_mode: uiState.view_mode || 'operativa',
                view_layer: uiState.view_layer || 'shared'
              },
              context: {
                ...context,
                trace_id,
                action_id,
                surfaces: surfacesToRefresh // Pasar surfaces al adapter
              }
            });
          } else {
            // Fallback a v1
            await refreshEngine.afterMutation({
              module: 'alquimia_general',
              mutation_type: action_id,
              scope: {
                view_mode: uiState.view_mode || 'operativa',
                view_layer: uiState.view_layer || 'shared'
              },
              context: {
                ...context,
                trace_id,
                action_id,
                surfaces: surfacesToRefresh // Pasar surfaces al adapter
              }
            });
          }
        } catch (refreshError) {
          console.error('[REFRESH][ERROR] Error ejecutando refresh engine, forzando refetch manual', {
            action_id,
            trace_id,
            error: refreshError.message,
            stack: refreshError.stack
          });
          // Fallback a refetch manual si engine falla
          await forceManualRefetch(action_id, context, uiState, surfacesToRefresh);
        }
      } else {
        // FIX 3: Refresh Engine NO disponible: forzar refetch manual mínimo
        console.warn('[REFRESH][MISSING_ENGINE] Refresh Engine no disponible, forzando refetch manual', {
          action_id,
          trace_id,
          surfaces: surfacesToRefresh
        });
        await forceManualRefetch(action_id, context, uiState, surfacesToRefresh);
      }

      return {
        ok: true,
        data: responseData.data || responseData,
        trace_id,
        action_id
      };

    } catch (error) {
      // Log forense de error
      console.error('[UX][ACTION][ERROR]', {
        action_id,
        trace_id,
        endpoint,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });

      return {
        ok: false,
        error: error.message,
        trace_id,
        action_id
      };
    }
  }

  // Exportar a window (solo si runtime está ready)
  if (typeof window !== 'undefined') {
    if (window.__AP_RUNTIME_READY__ && window.__AP_RUNTIME_READY__.state() === 'ready') {
      window.performAction = performAction;
      console.log('[PerformActionV1] ✅ Wrapper canónico disponible en window.performAction');
    } else {
      console.error('[PerformActionV1] ❌ NO se expone performAction: runtime no está READY');
      // NO exponer performAction si runtime no está ready
    }
  }

  // Exportar para módulos ES6 (si se usa import)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { performAction };
  }

  // Helper de debug
  if (typeof window !== 'undefined') {
    window.__AP_UX_DEBUG__ = {
      dumpRuntime: () => {
        return {
          runtime_ready: {
            state: window.__AP_RUNTIME_READY__?.state() || 'not_initialized',
            error: window.__AP_RUNTIME_READY__?.error || null
          },
          registry_core: {
            exists: !!window.__AP_UX_ACTION_REGISTRY_CORE__,
            info: window.__AP_UX_ACTION_REGISTRY_CORE__?.info() || null
          },
          perform_action: {
            exists: typeof window.performAction === 'function',
            core_exists: typeof window.performActionCore === 'function'
          },
          refresh_engine: {
            exists: !!window.MasterRefreshEngineV1
          }
        };
      }
    };
  }
})();
