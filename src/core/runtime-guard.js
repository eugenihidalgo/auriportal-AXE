// src/core/runtime-guard.js
// Runtime Guard Canónico - Garantiza que TODO el backend responde SIEMPRE JSON válido
// 
// PRINCIPIO FUNDAMENTAL:
// Ningún endpoint puede escapar sin pasar por este guard.
// Ningún error legacy rompe el contrato JSON.
//
// Este guard es la base del futuro "Contrato de Contratos".

import { getRequestId } from './observability/request-context.js';
import { getOrCreateTraceId, attachTrace } from './observability/with-trace.js';
import { logErrorCanonical } from './observability/logger.js';
import { pushError } from './observability/error-buffer.js';
import { toErrorResponse } from './observability/error-contract.js';

/**
 * Formato canónico de respuesta JSON para errores
 * @typedef {Object} ErrorResponse
 * @property {boolean} ok - Siempre false para errores
 * @property {string} error - Mensaje de error legible
 * @property {string} [code] - Código de error opcional
 * @property {any} [details] - Detalles adicionales opcionales
 * @property {string} [trace_id] - ID de traza para debugging
 */

/**
 * Genera un trace_id único para esta request
 * @returns {string}
 */
function generateTraceId() {
  try {
    return getRequestId() || `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  } catch (e) {
    return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Verifica si una respuesta es JSON válido
 * @param {Response} response - Response object
 * @returns {Promise<boolean>}
 */
async function isJsonResponse(response) {
  if (!response || !(response instanceof Response)) {
    return false;
  }
  
  const contentType = response.headers.get('Content-Type') || '';
  return contentType.includes('application/json');
}

/**
 * Verifica si una respuesta es texto plano o HTML
 * @param {Response} response - Response object
 * @returns {boolean}
 */
function isTextOrHtmlResponse(response) {
  if (!response || !(response instanceof Response)) {
    return false;
  }
  
  const contentType = response.headers.get('Content-Type') || '';
  return contentType.includes('text/plain') || 
         contentType.includes('text/html') ||
         (!contentType && response.status >= 400);
}

/**
 * Determina si el Runtime Guard debe normalizar esta request
 * 
 * REGLAS:
 * - NO normalizar si path NO empieza por /admin/api Y Accept incluye text/html
 * - SÍ normalizar si path empieza por /admin/api
 * - SÍ normalizar si Accept incluye application/json
 * 
 * @param {Request} request - Request object
 * @returns {boolean} true si debe normalizar, false si debe dejar pasar
 */
function shouldNormalizeResponse(request) {
  if (!request || !request.url) {
    // Si no hay URL, normalizar por seguridad
    return true;
  }

  try {
    const url = new URL(request.url);
    const path = url.pathname;
    const acceptHeader = request.headers?.get('Accept') || '';

    // Si el path NO empieza por /admin/api Y el Accept incluye text/html
    // → NO normalizar (es una página HTML del Admin)
    if (!path.startsWith('/admin/api') && acceptHeader.includes('text/html')) {
      return false;
    }

    // Si el path empieza por /admin/api → SÍ normalizar (es una API)
    if (path.startsWith('/admin/api')) {
      return true;
    }

    // Si el Accept incluye application/json → SÍ normalizar (se espera JSON)
    if (acceptHeader.includes('application/json')) {
      return true;
    }

    // Para otras rutas, si el Accept NO incluye text/html, normalizar por seguridad
    // Esto asegura que APIs sin /admin/api pero con Accept: application/json se normalicen
    if (!acceptHeader.includes('text/html')) {
      return true;
    }

    // Por defecto, si hay Accept: text/html y no es API, NO normalizar
    return false;
  } catch (e) {
    // Si hay error parseando URL, normalizar por seguridad
    console.warn('[RUNTIME_GUARD] Error parseando URL para detección de normalización:', e.message);
    return true;
  }
}

/**
 * Normaliza una respuesta a JSON válido
 * @param {Response} response - Response original
 * @param {string} traceId - Trace ID para debugging
 * @returns {Promise<Response>}
 */
async function normalizeToJson(response, traceId) {
  try {
    // Intentar leer el body como texto
    let bodyText = '';
    try {
      if (response.body && typeof response.text === 'function') {
        bodyText = await response.text();
      }
    } catch (e) {
      // Si falla leer el body, usar mensaje genérico
      bodyText = '';
    }

    // Intentar parsear como JSON si parece JSON
    let parsedBody = null;
    try {
      if (bodyText && (bodyText.trim().startsWith('{') || bodyText.trim().startsWith('['))) {
        parsedBody = JSON.parse(bodyText);
      }
    } catch (e) {
      // No es JSON válido, continuar con texto plano
    }

    // Si ya es JSON válido con formato canónico, devolverlo
    if (parsedBody && typeof parsedBody === 'object' && parsedBody.ok !== undefined) {
      // Ya tiene formato canónico, solo asegurar trace_id
      return new Response(JSON.stringify({
        ...parsedBody,
        trace_id: parsedBody.trace_id || traceId
      }), {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          ...Object.fromEntries(response.headers.entries())
        }
      });
    }

    // Si es JSON pero no tiene formato canónico, envolverlo
    if (parsedBody && typeof parsedBody === 'object') {
      return new Response(JSON.stringify({
        ok: response.status < 400,
        error: parsedBody.error || bodyText || 'Error desconocido',
        code: parsedBody.code || `HTTP_${response.status}`,
        details: parsedBody,
        trace_id: traceId
      }), {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          ...Object.fromEntries(response.headers.entries())
        }
      });
    }

    // Es texto plano o HTML, convertir a JSON
    const errorMessage = bodyText || 
      (response.status === 400 ? 'Bad Request' :
       response.status === 401 ? 'Unauthorized' :
       response.status === 403 ? 'Forbidden' :
       response.status === 404 ? 'Not Found' :
       response.status === 405 ? 'Method Not Allowed' :
       response.status === 500 ? 'Error interno del servidor' :
       `HTTP ${response.status}`);

    return new Response(JSON.stringify({
      ok: false,
      error: errorMessage,
      code: `HTTP_${response.status}`,
      trace_id: traceId
    }), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (normalizeError) {
    // Si incluso la normalización falla, devolver error mínimo
    console.error('[RUNTIME_GUARD] Error normalizando respuesta:', normalizeError);
    return new Response(JSON.stringify({
      ok: false,
      error: 'Error interno del servidor',
      code: 'NORMALIZATION_ERROR',
      trace_id: traceId
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  }
}

/**
 * Crea una respuesta JSON de error desde una excepción
 * @param {Error} error - Error object
 * @param {string} traceId - Trace ID para debugging
 * @param {number} [status=500] - HTTP status code
 * @returns {Response}
 */
function createErrorResponse(error, traceId, status = 500) {
  const errorMessage = error?.message || 'Error interno del servidor';
  const errorCode = error?.code || 'INTERNAL_ERROR';
  
  // En producción, no exponer stack traces
  const isProduction = process.env.APP_ENV === 'prod' || process.env.NODE_ENV === 'production';
  
  return new Response(JSON.stringify({
    ok: false,
    error: errorMessage,
    code: errorCode,
    details: isProduction ? undefined : {
      stack: error?.stack,
      name: error?.name
    },
    trace_id: traceId
  }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
}

/**
 * Runtime Guard Canónico
 * 
 * Envuelve cualquier handler y garantiza que:
 * 1. Todas las excepciones se capturan
 * 2. Todas las respuestas son JSON válido
 * 3. Todas las respuestas tienen formato canónico
 * 
 * @param {Function} handler - Handler function (request, env, ctx) => Promise<Response>
 * @returns {Function} Handler envuelto con Runtime Guard
 */
export function withRuntimeGuard(handler) {
  return async (request, env, ctx) => {
    const traceId = getOrCreateTraceId(request);
    const startTime = Date.now();
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    
    // Determinar si debe normalizar esta request
    const shouldNormalize = shouldNormalizeResponse(request);
    
    try {
      // Ejecutar el handler original
      const response = await handler(request, env, ctx);
      
      // Verificar que la respuesta sea válida
      if (!response || !(response instanceof Response)) {
        logErrorCanonical('router_error', {
          path,
          method,
          error_type: 'INVALID_RESPONSE',
          returned_type: typeof response,
          duration_ms: Date.now() - startTime
        });
        
        pushError({
          trace_id: traceId,
          code: 'ROUTER_ERROR',
          message: 'Handler devolvió respuesta inválida',
          path,
          method,
          ts: new Date().toISOString()
        });
        
        return toErrorResponse({
          code: 'ROUTER_ERROR',
          message: 'Error interno del servidor',
          trace_id: traceId,
          status: 500
        });
      }
      
      // Añadir trace_id al header
      const responseWithTrace = attachTrace(response, traceId);

      // Si NO debe normalizar (páginas HTML del Admin), dejar pasar la respuesta tal cual
      if (!shouldNormalize) {
        // Solo loguear en modo debug
        if (process.env.DEBUG_FORENSIC === '1') {
          console.log(`[RUNTIME_GUARD] Bypass normalización para página HTML:`, {
            trace_id: traceId,
            url: request?.url,
            content_type: responseWithTrace.headers.get('Content-Type')
          });
        }
        return responseWithTrace;
      }

      // Si la respuesta es JSON válido, verificar formato
      if (await isJsonResponse(responseWithTrace)) {
        // Ya es JSON, verificar que tenga formato canónico
        // CRÍTICO: Clonar la respuesta antes de leer el body para no consumirlo
        const clonedResponse = responseWithTrace.clone();
        try {
          const bodyText = await clonedResponse.text();
          const parsed = JSON.parse(bodyText);
          
          // Si no tiene formato canónico, normalizar
          if (typeof parsed !== 'object' || parsed.ok === undefined) {
            console.warn(`[RUNTIME_GUARD] Respuesta JSON sin formato canónico, normalizando:`, {
              trace_id: traceId,
              url: request?.url,
              has_ok: parsed.ok !== undefined
            });
            
            // Reconstruir response con formato canónico
            const normalizedResponse = new Response(JSON.stringify({
              ok: responseWithTrace.status < 400,
              ...parsed,
              trace_id: parsed.trace_id || traceId
            }), {
              status: responseWithTrace.status,
              headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(responseWithTrace.headers.entries())
              }
            });
            return attachTrace(normalizedResponse, traceId);
          }
          
          // Ya tiene formato canónico, solo asegurar trace_id
          if (!parsed.trace_id) {
            const updatedResponse = new Response(JSON.stringify({
              ...parsed,
              trace_id: traceId
            }), {
              status: responseWithTrace.status,
              headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(responseWithTrace.headers.entries())
              }
            });
            return attachTrace(updatedResponse, traceId);
          }
          
          // Respuesta perfecta, devolverla con trace_id en header
          return responseWithTrace;
        } catch (parseError) {
          // JSON inválido, normalizar
          console.warn(`[RUNTIME_GUARD] JSON inválido en respuesta, normalizando:`, {
            trace_id: traceId,
            url: request?.url,
            error: parseError.message
          });
          const normalized = await normalizeToJson(responseWithTrace, traceId);
          return attachTrace(normalized, traceId);
        }
      }

      // Si es texto plano o HTML, normalizar a JSON (solo para APIs)
      if (isTextOrHtmlResponse(responseWithTrace)) {
        logErrorCanonical('router_warn', {
          path,
          method,
          event: 'text_or_html_in_api',
          status: responseWithTrace.status
        });
        const normalized = await normalizeToJson(responseWithTrace, traceId);
        return attachTrace(normalized, traceId);
      }

      // Para otros tipos de respuesta (imágenes, archivos, etc.), dejarlos pasar
      // pero asegurar que si hay error (status >= 400) en una API, sea JSON
      if (responseWithTrace.status >= 400) {
        logErrorCanonical('router_warn', {
          path,
          method,
          event: 'non_json_error_in_api',
          status: responseWithTrace.status
        });
        const normalized = await normalizeToJson(responseWithTrace, traceId);
        return attachTrace(normalized, traceId);
      }

      // Respuesta exitosa no-JSON (imágenes, archivos, etc.), dejarla pasar con trace_id
      return responseWithTrace;
      
    } catch (error) {
      // CRÍTICO: Capturar TODAS las excepciones no manejadas
      const duration = Date.now() - startTime;
      
      logErrorCanonical('router_error', {
        path,
        method,
        error_type: error.name || 'Error',
        error_message: error.message,
        duration_ms: duration,
        err: error
      });
      
      pushError({
        trace_id: traceId,
        code: error.code || 'ROUTER_ERROR',
        message: error.message || 'Error interno del servidor',
        path,
        method,
        ts: new Date().toISOString()
      });
      
      // Determinar si es API o página
      const isApi = path.startsWith('/admin/api') || 
                   (request.headers?.get('Accept')?.includes('application/json'));
      
      if (isApi) {
        // API: Error Contract v1 JSON
        return toErrorResponse({
          code: error.code || 'ROUTER_ERROR',
          message: 'Error interno del servidor',
          trace_id: traceId,
          status: error.status || 500
        });
      } else {
        // Página: Usar createErrorResponse (mantiene compatibilidad)
        return attachTrace(createErrorResponse(error, traceId, 500), traceId);
      }
    }
  };
}

/**
 * Versión del guard que también loguea métricas
 * @param {Function} handler - Handler function
 * @returns {Function} Handler envuelto
 */
export function withRuntimeGuardAndMetrics(handler) {
  const guarded = withRuntimeGuard(handler);
  
  return async (request, env, ctx) => {
    const startTime = Date.now();
    const response = await guarded(request, env, ctx);
    const duration = Date.now() - startTime;
    
    // Log métricas (opcional, solo en desarrollo)
    if (process.env.DEBUG_FORENSIC === '1') {
      console.log(`[RUNTIME_GUARD][METRICS]`, {
        url: request?.url,
        method: request?.method,
        status: response.status,
        duration_ms: duration,
        trace_id: response.headers?.get('X-Trace-Id') || 'unknown'
      });
    }
    
    return response;
  };
}

