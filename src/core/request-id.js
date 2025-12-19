// src/core/request-id.js
// Utilidad para obtener o crear Correlation ID (Request ID) para trazabilidad
//
// REGLA: Usa header x-request-id si existe, si no genera uno seguro
// El request ID se propaga automáticamente a través de AsyncLocalStorage

import { getRequestId, runInRequestContext } from './observability/request-context.js';
import { randomBytes } from 'crypto';

/**
 * Genera un request ID seguro usando crypto.randomBytes
 * Formato: req_<timestamp>_<random_hex>
 * 
 * @returns {string} Request ID único y seguro
 */
function generateSecureRequestId() {
  const timestamp = Date.now();
  const random = randomBytes(8).toString('hex');
  return `req_${timestamp}_${random}`;
}

/**
 * Obtiene o crea un request ID desde el header x-request-id
 * Si el header existe y es válido, lo usa; si no, genera uno nuevo
 * 
 * @param {Request} request - Objeto Request HTTP
 * @returns {string} Request ID (del header o generado)
 */
export function getOrCreateRequestId(request) {
  if (!request) {
    // Si no hay request, intentar obtener del contexto actual
    const existingId = getRequestId();
    if (existingId) {
      return existingId;
    }
    // Si no hay contexto, generar uno nuevo
    return generateSecureRequestId();
  }

  // Intentar obtener del header x-request-id
  const headerId = request.headers.get('x-request-id');
  
  if (headerId && headerId.trim().length > 0) {
    // Validar que el header tenga formato razonable (máximo 200 caracteres)
    const trimmed = headerId.trim();
    if (trimmed.length <= 200 && /^[a-zA-Z0-9_\-\.]+$/.test(trimmed)) {
      return trimmed;
    }
  }

  // Si no hay header válido, intentar obtener del contexto actual
  const existingId = getRequestId();
  if (existingId) {
    return existingId;
  }

  // Generar uno nuevo
  return generateSecureRequestId();
}

/**
 * Inicializa el contexto de request con el ID obtenido/creado
 * Esta función debe llamarse al inicio de cada request HTTP
 * 
 * @param {Function} fn - Función a ejecutar dentro del contexto
 * @param {Request} request - Objeto Request HTTP
 * @returns {Promise<any>} Resultado de la función
 * 
 * @example
 * await initRequestContextWithId(async () => {
 *   // Todo el código aquí tendrá acceso al request_id
 *   const id = getRequestId();
 * }, request);
 */
export function initRequestContextWithId(fn, request) {
  const requestId = getOrCreateRequestId(request);
  return runInRequestContext(fn, requestId);
}












