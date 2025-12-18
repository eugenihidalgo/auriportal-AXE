// src/core/observability/request-context.js
// Sistema de contexto de request para correlación de logs
// Utiliza AsyncLocalStorage para mantener el request_id durante todo el flujo de un request HTTP

import { AsyncLocalStorage } from 'async_hooks';

/**
 * AsyncLocalStorage para mantener el contexto de request
 * Permite acceder al request_id desde cualquier punto del código sin pasarlo explícitamente
 */
const requestContext = new AsyncLocalStorage();

/**
 * Genera un request_id único
 * Formato: req_<timestamp>_<random>
 * 
 * @returns {string} Request ID único
 */
function generateRequestId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `req_${timestamp}_${random}`;
}

/**
 * Inicializa el contexto de request y ejecuta una función dentro de él
 * Esta es la forma recomendada de usar el contexto de request
 * 
 * @param {Function} fn - Función a ejecutar dentro del contexto
 * @param {Object} request - Objeto Request HTTP (opcional, solo para logging)
 * @returns {Promise<any>} Resultado de la función
 * 
 * @example
 * await initRequestContext(async () => {
 *   // Todo el código aquí tendrá acceso al request_id
 *   const id = getRequestId();
 * }, request);
 */
export function initRequestContext(fn, request = null) {
  const requestId = generateRequestId();
  
  // Log opcional del inicio del request (solo en dev/beta para no saturar logs)
  const env = process.env.APP_ENV || 'prod';
  if (env === 'dev' || env === 'beta') {
    const url = request?.url || 'unknown';
    const method = request?.method || 'unknown';
    console.log(`[RequestContext] Iniciado request: ${requestId} | ${method} ${url}`);
  }
  
  // Ejecutar función dentro del contexto
  return requestContext.run({ requestId }, fn);
}

/**
 * Obtiene el request_id del contexto actual
 * Retorna null si no hay contexto activo (ej: fuera de un request HTTP)
 * 
 * @returns {string|null} Request ID actual o null si no hay contexto
 * 
 * @example
 * const requestId = getRequestId();
 * if (requestId) {
 *   console.log(`Request ID: ${requestId}`);
 * }
 */
export function getRequestId() {
  const context = requestContext.getStore();
  return context?.requestId || null;
}

/**
 * Limpia el contexto de request
 * Debe llamarse al finalizar cada request HTTP (en finally)
 * 
 * @example
 * try {
 *   // procesar request
 * } finally {
 *   clearRequestContext();
 * }
 */
export function clearRequestContext() {
  // AsyncLocalStorage se limpia automáticamente cuando sale del contexto
  // Pero podemos forzar la limpieza saliendo del contexto
  requestContext.exit(() => {
    // Contexto limpiado
  });
}

/**
 * Ejecuta una función dentro del contexto de request
 * Útil para operaciones asíncronas que necesitan mantener el contexto
 * 
 * @param {Function} fn - Función a ejecutar dentro del contexto
 * @param {string} requestId - Request ID a usar (opcional, se genera si no se proporciona)
 * @returns {Promise<any>} Resultado de la función
 * 
 * @example
 * await runInRequestContext(async () => {
 *   // Todo el código aquí tendrá acceso al request_id
 *   const id = getRequestId();
 * }, 'req_1234567890_abc123');
 */
export function runInRequestContext(fn, requestId = null) {
  const id = requestId || generateRequestId();
  return requestContext.run({ requestId: id }, fn);
}












