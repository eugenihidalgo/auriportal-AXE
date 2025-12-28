// src/core/observability/with-trace.js
// Helper para propagación de trace_id end-to-end

import { getRequestId } from './request-context.js';

/**
 * Obtiene o crea un trace_id desde el request
 * Respeta trace_id existente en headers/cookies si hay; si no, genera uno nuevo
 * 
 * @param {Request} req - Request object
 * @returns {string} Trace ID
 */
export function getOrCreateTraceId(req) {
  // Intentar obtener del contexto de request (ya existe si se inicializó)
  const contextTraceId = getRequestId();
  if (contextTraceId) {
    return contextTraceId;
  }
  
  // Intentar obtener de headers (x-trace-id, x-request-id, etc.)
  if (req && req.headers) {
    const headerTraceId = req.headers.get('x-trace-id') || 
                         req.headers.get('x-request-id') ||
                         req.headers.get('trace-id');
    if (headerTraceId) {
      return headerTraceId;
    }
  }
  
  // Intentar obtener de cookies (si existe)
  if (req && req.headers) {
    const cookieHeader = req.headers.get('Cookie') || req.headers.get('cookie');
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        if (key && value) acc[key] = value;
        return acc;
      }, {});
      
      if (cookies.trace_id) {
        return cookies.trace_id;
      }
    }
  }
  
  // Generar nuevo trace_id
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `trace_${timestamp}_${random}`;
}

/**
 * Añade header x-trace-id a una Response
 * 
 * @param {Response} res - Response object
 * @param {string} traceId - Trace ID a añadir
 * @returns {Response} Response con header x-trace-id
 */
export function attachTrace(res, traceId) {
  if (!res || !(res instanceof Response)) {
    return res;
  }
  
  // Clonar response para añadir header
  const headers = new Headers(res.headers);
  headers.set('x-trace-id', traceId);
  
  // Crear nueva response con headers actualizados
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: headers
  });
}






