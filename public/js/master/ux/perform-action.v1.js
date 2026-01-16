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

  // FASE 1 FIX: Esperar a que el Action Registry esté listo antes de exponer performAction
  try {
    const registryReady = window.__AP_UX_ACTION_REGISTRY_READY__;
    if (registryReady && registryReady.promise) {
      await registryReady.promise;
      console.log('[PerformActionV1] ✅ Action Registry READY - performAction disponible');
    } else {
      // Si no existe la promesa, esperar un momento y verificar
      await new Promise(resolve => setTimeout(resolve, 100));
      if (!window.__AP_UX_ACTION_REGISTRY_CORE__ && !window.__AP_UX_ACTION_REGISTRY__) {
        console.warn('[PerformActionV1] ⚠️ Action Registry no está listo, pero continuando (modo degradado)');
      }
    }
  } catch (error) {
    console.error('[PerformActionV1] ⚠️ Error esperando Action Registry:', error);
    // Continuar en modo degradado
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
    // Validaciones básicas
    if (!action_id || typeof action_id !== 'string') {
      throw new Error('[PerformActionV1] action_id es obligatorio y debe ser string');
    }

    // FASE 1 FIX: Verificar que el registry está listo antes de usarlo
    const registryReady = window.__AP_UX_ACTION_REGISTRY_READY__;
    if (registryReady && !registryReady.ready) {
      // Si no está ready, esperar la promesa
      if (registryReady.promise) {
        await registryReady.promise;
      }
    }

    // Obtener actionDef del registry (nuevo core primero, fallback a legacy)
    let actionRegistry = window.__AP_UX_ACTION_REGISTRY_CORE__;
    let actionDef = null;
    
    if (actionRegistry) {
      actionDef = actionRegistry.get(action_id);
    }
    
    // Fallback a registry legacy si no existe en core
    if (!actionDef) {
      const legacyRegistry = window.__AP_UX_ACTION_REGISTRY__;
      if (!legacyRegistry) {
        // FASE 1 FIX: Hard fail con mensaje claro
        const error = new Error('[PerformActionV1] UX Action Registry no disponible. El loader no ha terminado de cargar o falló. Asegúrate de que ux-action-registry-loader.js se carga antes de perform-action.v1.js.');
        console.error('[PerformActionV1] ❌ Registry no disponible', {
          action_id,
          has_core: !!window.__AP_UX_ACTION_REGISTRY_CORE__,
          has_legacy: !!window.__AP_UX_ACTION_REGISTRY__,
          ready_state: registryReady ? registryReady.ready : 'unknown',
          timestamp: new Date().toISOString()
        });
        throw error;
      }
      actionDef = legacyRegistry.get(action_id);
      if (!actionDef) {
        throw new Error(`[PerformActionV1] Acción ${action_id} no registrada en UX Action Registry`);
      }
    }

    // Generar trace_id único
    const trace_id = `ux_action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
      response = await fetch(endpoint, fetchOptions);
      const duration = Date.now() - startTime;

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

      // Ejecutar refresh plan vía Refresh Engine
      const refreshEngine = window.MasterRefreshEngineV1;
      if (!refreshEngine) {
        console.warn('[PerformActionV1] Refresh Engine no disponible, saltando refresh');
      } else {
        // Resolver refresh_plan (compatibilidad: refresh_plan o refresh)
        const refreshPlan = actionDef.refresh || actionDef.refresh_plan;
        let surfacesToRefresh = [];
        if (typeof refreshPlan === 'function') {
          surfacesToRefresh = refreshPlan({ ...context, ...payload }, uiState, responseData);
        } else if (Array.isArray(refreshPlan)) {
          surfacesToRefresh = refreshPlan;
        } else {
          console.warn('[PerformActionV1] refresh/refresh_plan no es función ni array, usando plan vacío');
        }

        // Log del plan
        console.log('[REFRESH][PLAN]', {
          action_id,
          trace_id,
          surfaces: surfacesToRefresh,
          timestamp: new Date().toISOString()
        });

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

  // Exportar a window
  if (typeof window !== 'undefined') {
    window.performAction = performAction;
    console.log('[PerformActionV1] ✅ Wrapper canónico disponible en window.performAction');
  }

  // Exportar para módulos ES6 (si se usa import)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { performAction };
  }
})();
