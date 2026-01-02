/**
 * JSON RESPONSE HELPERS v1
 * 
 * Helpers server-side para responder JSON SIEMPRE en endpoints API admin.
 * 
 * PRINCIPIO:
 * Frontends hacen res.json() y si el server devuelve HTML (login/error/trace)
 * sale SyntaxError o tokens inesperados. Estos helpers fuerzan Content-Type
 * JSON y estructura canónica.
 * 
 * REGLAS:
 * - Fuerza header Content-Type: application/json; charset=utf-8
 * - Incluye trace_id si existe en ctx/request
 * - Headers anti-cache para errores
 */

import { getRequestId } from '../observability/request-context.js';

/**
 * Crea respuesta JSON exitosa
 * 
 * @param {any} data - Datos a enviar
 * @param {number} status - Status HTTP (default: 200)
 * @param {Object} options - Opciones adicionales
 * @returns {Response}
 */
export function jsonOk(data, status = 200, options = {}) {
  const { headers = {} } = options;
  
  // Incluir trace_id si está disponible
  let responseData = data;
  try {
    const traceId = getRequestId();
    if (traceId && typeof data === 'object' && data !== null && !data.trace_id) {
      responseData = { ...data, trace_id: traceId };
    }
  } catch (e) {
    // Si falla obtener trace_id, continuar sin él
  }
  
  return new Response(JSON.stringify(responseData, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      ...headers
    }
  });
}

/**
 * Crea respuesta JSON de error
 * 
 * @param {string} message - Mensaje de error
 * @param {number} status - Status HTTP (default: 400)
 * @param {Object} extra - Datos adicionales
 * @returns {Response}
 */
export function jsonError(message, status = 400, extra = {}) {
  // Incluir trace_id si está disponible
  let traceId = null;
  try {
    traceId = getRequestId();
  } catch (e) {
    // Si falla obtener trace_id, usar null
  }
  
  const errorData = {
    ok: false,
    error: message,
    code: extra.code || 'ERROR',
    ...(traceId && { trace_id: traceId }),
    ...extra
  };
  
  return new Response(JSON.stringify(errorData, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
}





