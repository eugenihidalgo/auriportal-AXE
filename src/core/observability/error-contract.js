// src/core/observability/error-contract.js
// Error Contract v1 - Respuestas JSON canónicas unificadas

/**
 * Crea una respuesta de error canónica según el Error Contract v1
 * 
 * @param {Object} options - Opciones del error
 * @param {string} options.code - Código de error (ej: 'ROUTER_ERROR', 'HANDLER_INVALID_RETURN')
 * @param {string} options.message - Mensaje de error legible
 * @param {string} [options.trace_id] - Trace ID para debugging
 * @param {number} [options.status=500] - HTTP status code
 * @param {Object} [options.details] - Detalles adicionales opcionales
 * @returns {Response} Response JSON canónica
 * 
 * @example
 * return toErrorResponse({
 *   code: 'ROUTER_ERROR',
 *   message: 'Error interno del servidor',
 *   trace_id: 'trace_123',
 *   status: 500
 * });
 */
export function toErrorResponse({ code, message, trace_id, status = 500, details }) {
  const responseBody = {
    ok: false,
    error: message,
    code: code,
    ...(trace_id && { trace_id }),
    ...(details && { details })
  };
  
  return new Response(JSON.stringify(responseBody), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      ...(trace_id && { 'x-trace-id': trace_id })
    }
  });
}




