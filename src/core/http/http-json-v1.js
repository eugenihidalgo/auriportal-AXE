/**
 * HTTP JSON CANÓNICO v1 - AuriPortal
 * 
 * Helper canónico único y compartible MASTER/GOD para respuestas JSON.
 * 
 * PRINCIPIO CONSTITUCIONAL:
 * - Contrato HTTP consistente (headers no-cache + trace_id)
 * - Envelope canónico (ok/data/error/trace_id)
 * - Reutilizable MASTER/GOD
 * 
 * CONTRATO:
 * - Headers obligatorios: Content-Type, Cache-Control, Pragma, Expires, X-Trace-Id
 * - Envelope OK: { ok: true, data: <obj>, trace_id: <traceId> }
 * - Envelope ERR: { ok: false, error: { message, code }, trace_id: <traceId> }
 * 
 * USO:
 *   import { sendJsonOk, sendJsonError } from '../core/http/http-json-v1.js';
 *   return sendJsonOk(data, traceId);
 *   return sendJsonError({ message: 'Error', code: 'CODE' }, 400, traceId);
 */

import { getRequestId } from '../observability/request-context.js';

/**
 * Envía respuesta JSON exitosa canónica
 * 
 * @param {any} data - Datos a enviar
 * @param {string|null} traceId - Trace ID (opcional, se obtiene automáticamente si no se proporciona)
 * @param {Object} options - Opciones adicionales
 * @param {boolean} options.noCache - Si es true (default), añade headers no-cache
 * @param {number} options.status - Status HTTP (default: 200)
 * @param {Object} options.headers - Headers adicionales
 * @returns {Response} Response con JSON canónico
 */
export function sendJsonOk(data, traceId = null, options = {}) {
  const {
    noCache = true,
    status = 200,
    headers = {}
  } = options;
  
  // Obtener trace_id si no se proporciona
  let finalTraceId = traceId;
  if (!finalTraceId) {
    try {
      finalTraceId = getRequestId();
    } catch (e) {
      // Si falla obtener trace_id, usar null
      finalTraceId = null;
    }
  }
  
  // Construir envelope canónico
  const envelope = {
    ok: true,
    data: data,
    ...(finalTraceId && { trace_id: finalTraceId })
  };
  
  // Headers base
  const baseHeaders = {
    'Content-Type': 'application/json; charset=utf-8',
    ...(finalTraceId && { 'X-Trace-Id': finalTraceId })
  };
  
  // Headers no-cache si está habilitado
  if (noCache) {
    baseHeaders['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0';
    baseHeaders['Pragma'] = 'no-cache';
    baseHeaders['Expires'] = '0';
  }
  
  return new Response(JSON.stringify(envelope, null, 2), {
    status,
    headers: {
      ...baseHeaders,
      ...headers
    }
  });
}

/**
 * Envía respuesta JSON de error canónica
 * 
 * @param {Object} error - Objeto de error con { message, code }
 * @param {number} status - Status HTTP (default: 400)
 * @param {string|null} traceId - Trace ID (opcional, se obtiene automáticamente si no se proporciona)
 * @param {Object} options - Opciones adicionales
 * @param {boolean} options.noCache - Si es true (default), añade headers no-cache
 * @param {Object} options.headers - Headers adicionales
 * @returns {Response} Response con JSON canónico
 */
export function sendJsonError(error, status = 400, traceId = null, options = {}) {
  const {
    noCache = true,
    headers = {}
  } = options;
  
  // Validar error
  if (!error || typeof error !== 'object') {
    error = { message: String(error || 'Error desconocido'), code: 'ERROR' };
  }
  
  if (!error.message) {
    error.message = 'Error desconocido';
  }
  
  if (!error.code) {
    error.code = 'ERROR';
  }
  
  // Obtener trace_id si no se proporciona
  let finalTraceId = traceId;
  if (!finalTraceId) {
    try {
      finalTraceId = getRequestId();
    } catch (e) {
      // Si falla obtener trace_id, usar null
      finalTraceId = null;
    }
  }
  
  // Construir envelope canónico
  const envelope = {
    ok: false,
    error: {
      message: error.message,
      code: error.code
    },
    ...(finalTraceId && { trace_id: finalTraceId })
  };
  
  // Headers base
  const baseHeaders = {
    'Content-Type': 'application/json; charset=utf-8',
    ...(finalTraceId && { 'X-Trace-Id': finalTraceId })
  };
  
  // Headers no-cache si está habilitado
  if (noCache) {
    baseHeaders['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0';
    baseHeaders['Pragma'] = 'no-cache';
    baseHeaders['Expires'] = '0';
  }
  
  return new Response(JSON.stringify(envelope, null, 2), {
    status,
    headers: {
      ...baseHeaders,
      ...headers
    }
  });
}
