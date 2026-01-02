// src/core/admin/admin-handler-guard.js
// Guard de handlers admin para evitar ROUTER_ERROR por returns inválidos

import { getOrCreateTraceId, attachTrace } from '../observability/with-trace.js';
import { logErrorCanonical } from '../observability/logger.js';
import { pushError } from '../observability/error-buffer.js';
import { toErrorResponse } from '../observability/error-contract.js';
import { renderAdminPage } from './admin-page-renderer.js';

/**
 * Envuelve un handler admin para garantizar:
 * - Trace_id siempre presente
 * - Medición de duración
 * - Validación de return (debe ser Response)
 * - Manejo de errores con Error Contract v1
 * - Para APIs: JSON canónico
 * - Para pages/islands: página de error controlada
 * 
 * @param {string} routeKey - Route key para logging
 * @param {Function} handlerFn - Handler function (request, env, ctx) => Promise<Response>
 * @returns {Function} Handler envuelto con guard
 */
export function wrapAdminHandler(routeKey, handlerFn, routeContext = null) {
  return async (request, env, ctx) => {
    const startTime = Date.now();
    const traceId = getOrCreateTraceId(request);
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    
    // ═══════════════════════════════════════════════════════════════
    // INVARIANTE ESTRUCTURAL 3: APIs NUNCA USAN renderAdminPage
    // ═══════════════════════════════════════════════════════════════
    // 
    // REGLA DURA (NO NEGOCIABLE):
    // Si una ruta empieza por /admin/api/:
    //   - NO debe tener routeContext (que permite renderAdminPage)
    //   - NO debe usar renderAdminPage()
    //   - DEBE devolver JSON siempre
    // 
    // Esta verificación previene que APIs intenten renderizar HTML
    // ═══════════════════════════════════════════════════════════════
    const isApi = path.startsWith('/admin/api');
    
    if (isApi && routeContext) {
      const error = new Error(`API route has routeContext (forbids renderAdminPage): ${method} ${path}`);
      error.code = 'API_ROUTE_HAS_UI_CONTEXT';
      error.details = {
        path,
        method,
        routeKey,
        traceId,
        message: 'Ruta API no puede tener routeContext. Las APIs nunca usan renderAdminPage().'
      };
      
      logErrorCanonical('admin_handler_error', {
        route_key: routeKey,
        path,
        method,
        error_type: 'API_ROUTE_HAS_UI_CONTEXT',
        trace_id: traceId
      });
      
      throw error;
    }
    
    // Establecer contexto para renderAdminPage SOLO si NO es API
    // El contexto permite que renderAdminPage() valide que se llama desde un handler resuelto
    let contextWasSet = false;
    if (routeContext && !isApi) {
      const { _setRenderAdminPageCallContext, _clearRenderAdminPageCallContext } = await import('../admin/admin-page-renderer.js');
      _setRenderAdminPageCallContext(routeContext);
      contextWasSet = true;
    }
    
    try {
      // Ejecutar handler
      const result = await handlerFn(request, env, ctx);
      
      // Limpiar contexto después de ejecutar
      if (contextWasSet) {
        const { _clearRenderAdminPageCallContext } = await import('../admin/admin-page-renderer.js');
        _clearRenderAdminPageCallContext();
      }
      
      // Validar que el handler retornó un Response válido
      if (!result || !(result instanceof Response)) {
        const error = new Error(`Handler devolvió valor inválido: ${typeof result}`);
        error.code = 'HANDLER_INVALID_RETURN';
        
        // Log error
        logErrorCanonical('admin_handler_error', {
          route_key: routeKey,
          path,
          method,
          error_type: 'INVALID_RETURN',
          returned_type: typeof result,
          duration_ms: Date.now() - startTime
        });
        
        // Push al error buffer
        pushError({
          trace_id: traceId,
          code: 'HANDLER_INVALID_RETURN',
          message: `Handler ${routeKey} devolvió valor inválido: ${typeof result}`,
          route_key: routeKey,
          path,
          method,
          ts: new Date().toISOString()
        });
        
        // Devolver respuesta según tipo de ruta
        if (isApi) {
          // API: Error Contract v1 JSON
          return toErrorResponse({
            code: 'ADMIN_HANDLER_ERROR',
            message: 'Error interno del servidor',
            trace_id: traceId,
            status: 500
          });
        } else {
          // Page/Island: Página de error controlada
          return renderAdminPage({
            title: 'Error interno',
            contentHtml: `
              <div style="padding: 2rem; max-width: 800px; margin: 0 auto;">
                <h1 style="color: #ef4444; margin-bottom: 1rem;">❌ Error interno</h1>
                <p style="color: #6b7280; margin-bottom: 1rem;">
                  Ha ocurrido un error al procesar tu solicitud.
                </p>
                <p style="color: #9ca3af; font-size: 0.9rem; margin-bottom: 1.5rem;">
                  <strong>Trace ID:</strong> <code style="background: #1f2937; padding: 0.25rem 0.5rem; border-radius: 4px;">${traceId}</code>
                </p>
                <a href="/admin/system/diagnostics" style="display: inline-block; background: #3b82f6; color: white; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 500;">
                  Ver Diagnostics
                </a>
              </div>
            `,
            activePath: path
          });
        }
      }
      
      // ═══════════════════════════════════════════════════════════════
      // INVARIANTE ESTRUCTURAL 4: APIs SIEMPRE DEVUELVEN JSON
      // ═══════════════════════════════════════════════════════════════
      // 
      // REGLA DURA (NO NEGOCIABLE):
      // Si la ruta es /admin/api/*:
      //   - Content-Type DEBE ser application/json
      //   - El body DEBE ser JSON válido
      //   - NUNCA HTML, NUNCA text/html
      // 
      // Esta validación previene que APIs devuelvan HTML por error
      // ═══════════════════════════════════════════════════════════════
      if (isApi) {
        const contentType = result.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const error = new Error(`API route returned non-JSON content-type: ${contentType}`);
          error.code = 'API_NON_JSON_RESPONSE';
          error.details = {
            path,
            method,
            routeKey,
            contentType,
            traceId,
            message: 'Ruta API debe devolver Content-Type: application/json'
          };
          
          logErrorCanonical('admin_handler_error', {
            route_key: routeKey,
            path,
            method,
            error_type: 'API_NON_JSON_RESPONSE',
            content_type: contentType,
            trace_id: traceId
          });
          
          // Forzar respuesta JSON de error
          return toErrorResponse({
            code: 'API_NON_JSON_RESPONSE',
            message: 'Error interno del servidor',
            trace_id: traceId,
            status: 500,
            details: process.env.APP_ENV !== 'prod' ? {
              original_content_type: contentType,
              message: 'API devolvió respuesta no-JSON. Esto viola el contrato API.'
            } : undefined
          });
        }
      }
      
      // Añadir trace_id al header
      const responseWithTrace = attachTrace(result, traceId);
      
      // Log éxito (opcional, solo en dev)
      if (process.env.DEBUG_FORENSIC === '1') {
        const { logInfoCanonical } = await import('../observability/logger.js');
        logInfoCanonical('admin_handler_success', {
          route_key: routeKey,
          path,
          method,
          status: responseWithTrace.status,
          duration_ms: Date.now() - startTime
        });
      }
      
      return responseWithTrace;
      
    } catch (error) {
      // Limpiar contexto en caso de error
      if (contextWasSet) {
        const { _clearRenderAdminPageCallContext } = await import('../admin/admin-page-renderer.js');
        _clearRenderAdminPageCallContext();
      }
      
      // Capturar cualquier excepción del handler
      const duration = Date.now() - startTime;
      
      // Log error
      logErrorCanonical('admin_handler_error', {
        route_key: routeKey,
        path,
        method,
        error_type: error.name || 'Error',
        error_message: error.message,
        duration_ms: duration,
        err: error
      });
      
      // Push al error buffer
      pushError({
        trace_id: traceId,
        code: error.code || 'ADMIN_HANDLER_ERROR',
        message: error.message || 'Error interno del servidor',
        route_key: routeKey,
        path,
        method,
        ts: new Date().toISOString()
      });
      
      // Devolver respuesta según tipo de ruta
      if (isApi) {
        // API: Error Contract v1 JSON
        return toErrorResponse({
          code: error.code || 'ADMIN_HANDLER_ERROR',
          message: 'Error interno del servidor',
          trace_id: traceId,
          status: error.status || 500,
          details: process.env.APP_ENV !== 'prod' ? {
            error_message: error.message,
            error_name: error.name
          } : undefined
        });
      } else {
        // Page/Island: Página de error controlada
        return renderAdminPage({
          title: 'Error interno',
          contentHtml: `
            <div style="padding: 2rem; max-width: 800px; margin: 0 auto;">
              <h1 style="color: #ef4444; margin-bottom: 1rem;">❌ Error interno</h1>
              <p style="color: #6b7280; margin-bottom: 1rem;">
                Ha ocurrido un error al procesar tu solicitud.
              </p>
              <p style="color: #9ca3af; font-size: 0.9rem; margin-bottom: 1.5rem;">
                <strong>Trace ID:</strong> <code style="background: #1f2937; padding: 0.25rem 0.5rem; border-radius: 4px;">${traceId}</code>
              </p>
              <a href="/admin/system/diagnostics" style="display: inline-block; background: #3b82f6; color: white; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 500;">
                Ver Diagnostics
              </a>
            </div>
          `,
          activePath: path
        });
      }
    }
  };
}

