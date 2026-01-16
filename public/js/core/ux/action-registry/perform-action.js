/**
 * PERFORM ACTION v1 (CORE) - AuriPortal
 * 
 * Wrapper canónico core para ejecutar acciones UX con validación dura.
 * 
 * PRINCIPIO CONSTITUCIONAL:
 * - Toda mutación UI debe pasar por performAction()
 * - Validación dura: acción inexistente = error explícito + log forense
 * - UI NO decide refresh, UI NO llama endpoints
 * 
 * CONTRATO:
 * - action_id: ID de acción registrada
 * - payload: Payload validado contra schema
 * - context: Contexto adicional (opcional)
 * - uiState: Estado de UI (opcional)
 */

import { validateActionExists, logContractViolation } from './ux-action-schema.js';
import { getAction, getActionOrFail, validatePayload } from './ux-action-registry.js';

/**
 * Ejecuta una acción UX con validación dura
 * @param {Object} params - Parámetros de la acción
 * @param {string} params.action_id - ID de acción registrada
 * @param {Object} params.payload - Payload a enviar (validado contra schema)
 * @param {Object} [params.context] - Contexto adicional (item_ref, student_uuid, etc.)
 * @param {Object} [params.uiState] - Estado de UI (view_mode, view_layer, etc.)
 * @returns {Promise<Object>} Response de la acción
 */
export async function performAction({ action_id, payload = {}, context = {}, uiState = {} }) {
  // Validación básica
  if (!action_id || typeof action_id !== 'string') {
    const error = '[PerformAction] action_id es obligatorio y debe ser string';
    logContractViolation(action_id || 'unknown', 'missing_action_id', { payload, context });
    throw new Error(error);
  }

  // Validación dura: acción debe existir
  const actionCheck = getActionOrFail(action_id, {
    get: (id) => {
      const registry = typeof window !== 'undefined' && window.__AP_UX_ACTION_REGISTRY_CORE__;
      if (registry) {
        return registry.get(id);
      }
      // Fallback a registry legacy si existe
      const legacyRegistry = typeof window !== 'undefined' && window.__AP_UX_ACTION_REGISTRY__;
      if (legacyRegistry) {
        return legacyRegistry.get(id);
      }
      return null;
    }
  });

  if (!actionCheck.exists) {
    logContractViolation(action_id, 'action_not_registered', { payload, context });
    throw new Error(actionCheck.error || `Acción "${action_id}" no registrada`);
  }

  const action = actionCheck.action;

  // Validar payload contra schema
  const validation = validatePayload(action_id, payload, context);
  if (!validation.valid) {
    logContractViolation(action_id, 'invalid_payload', { payload, context, errors: validation.errors });
    throw new Error(`Payload inválido para acción "${action_id}": ${validation.errors.join(', ')}`);
  }

  // Generar trace_id único
  const trace_id = `ux_action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Construir endpoint y payload final
  const endpoint = action.handler.endpointBuilder(context);
  const finalPayload = action.handler.buildPayload(uiState, { ...context, ...payload });

  // Log forense inicial
  console.log('[UX][ACTION][START]', {
    action_id,
    trace_id,
    endpoint,
    method: action.handler.method,
    payload: finalPayload,
    context,
    uiState: {
      view_mode: uiState.view_mode,
      view_layer: uiState.view_layer,
      list_id: uiState.list_id
    },
    allowed_item_kinds: action.allowed_item_kinds,
    allowed_layers: action.allowed_layers,
    allowed_scopes: action.allowed_scopes,
    timestamp: new Date().toISOString()
  });

  let response;
  let responseData;

  try {
    // Ejecutar fetch
    const fetchOptions = {
      method: action.handler.method,
      headers: {
        'Content-Type': 'application/json',
        ...action.handler.headers
      },
      credentials: 'include',
      body: action.handler.method !== 'GET' ? JSON.stringify(finalPayload) : undefined
    };

    const startTime = Date.now();
    response = await fetch(endpoint, fetchOptions);
    const duration = Date.now() - startTime;

    // Verificar content-type
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      const firstBytes = text.substring(0, 200);
      console.error('[PerformAction] Respuesta no-JSON', {
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
    const refreshEngine = typeof window !== 'undefined' && window.MasterRefreshEngineV1;
    if (!refreshEngine) {
      console.warn('[PerformAction] Refresh Engine no disponible, saltando refresh');
    } else {
      // Resolver refresh_plan
      let surfacesToRefresh = [];
      if (typeof action.refresh === 'function') {
        surfacesToRefresh = action.refresh(context, uiState, responseData);
      } else if (Array.isArray(action.refresh)) {
        surfacesToRefresh = action.refresh;
      } else {
        console.warn('[PerformAction] refresh no es función ni array, usando plan vacío');
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
          module: action.domain === 'master' ? 'alquimia_general' : action.domain,
          mutation_type: action_id,
          action_id: action_id,
          scope: {
            view_mode: uiState.view_mode || 'operativa',
            view_layer: uiState.view_layer || 'shared'
          },
          context: {
            ...context,
            ...payload,
            trace_id,
            action_id,
            surfaces: surfacesToRefresh
          }
        });
      } else {
        // Fallback a v1
        await refreshEngine.afterMutation({
          module: action.domain === 'master' ? 'alquimia_general' : action.domain,
          mutation_type: action_id,
          scope: {
            view_mode: uiState.view_mode || 'operativa',
            view_layer: uiState.view_layer || 'shared'
          },
          context: {
            ...context,
            ...payload,
            trace_id,
            action_id,
            surfaces: surfacesToRefresh
          }
        });
      }
    }

    // Verificar legacy_bridge
    if (action.legacy_bridge) {
      console.warn('[LEGACY_ACTION_CALL]', {
        action_id,
        trace_id,
        legacy_bridge: action.legacy_bridge,
        message: 'Acción ejecutada con legacy_bridge. Debe migrarse en el futuro.'
      });
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

    logContractViolation(action_id, 'execution_error', {
      payload: finalPayload,
      context,
      error: error.message
    });

    return {
      ok: false,
      error: error.message,
      trace_id,
      action_id
    };
  }
}

// Exportar para uso en frontend
if (typeof window !== 'undefined') {
  // Reutilizar función global si existe (compatibilidad)
  if (!window.performActionCore) {
    window.performActionCore = performAction;
    console.log('[PerformActionCore] ✅ Wrapper core disponible en window.performActionCore');
  }
}

// Exportar para módulos ES6
export default performAction;
