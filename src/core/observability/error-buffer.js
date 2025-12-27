// src/core/observability/error-buffer.js
// Ring buffer de errores en memoria para diagnostics

/**
 * Ring buffer de errores
 * Tamaño máximo: 200 errores
 */
const ERROR_BUFFER_SIZE = 200;
const errorBuffer = [];
let bufferIndex = 0;

/**
 * Añade un error al ring buffer
 * 
 * @param {Object} errorInfo - Información del error
 * @param {string} errorInfo.trace_id - Trace ID
 * @param {string} errorInfo.code - Código de error
 * @param {string} errorInfo.message - Mensaje de error
 * @param {string} [errorInfo.route_key] - Route key (opcional)
 * @param {string} [errorInfo.path] - Path de la request
 * @param {string} [errorInfo.method] - Método HTTP
 * @param {string} [errorInfo.ts] - Timestamp ISO (se genera si no se proporciona)
 */
export function pushError({ trace_id, code, message, route_key, path, method, ts }) {
  const errorEntry = {
    trace_id: trace_id || 'unknown',
    code: code || 'UNKNOWN_ERROR',
    message: message || 'Error desconocido',
    route_key: route_key || null,
    path: path || null,
    method: method || null,
    ts: ts || new Date().toISOString()
  };
  
  // Añadir al buffer (ring buffer: sobrescribe si está lleno)
  errorBuffer[bufferIndex] = errorEntry;
  bufferIndex = (bufferIndex + 1) % ERROR_BUFFER_SIZE;
}

/**
 * Obtiene los últimos N errores del ring buffer
 * Ordenados por timestamp descendente (más recientes primero)
 * 
 * @param {number} [limit=50] - Número máximo de errores a devolver
 * @returns {Array} Array de errores ordenados por timestamp descendente
 */
export function getRecentErrors(limit = 50) {
  // Construir array ordenado (los más recientes primero)
  const errors = [];
  
  // Recorrer desde el índice actual hacia atrás (más recientes)
  for (let i = 0; i < ERROR_BUFFER_SIZE; i++) {
    const idx = (bufferIndex - 1 - i + ERROR_BUFFER_SIZE) % ERROR_BUFFER_SIZE;
    if (errorBuffer[idx]) {
      errors.push(errorBuffer[idx]);
    }
  }
  
  // También incluir errores desde el inicio del buffer (si hay espacio)
  // Esto cubre el caso cuando el buffer no está lleno
  for (let i = bufferIndex; i < ERROR_BUFFER_SIZE; i++) {
    if (errorBuffer[i] && !errors.find(e => e === errorBuffer[i])) {
      errors.push(errorBuffer[i]);
    }
  }
  
  // Ordenar por timestamp descendente
  errors.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  
  // Limitar resultados
  return errors.slice(0, limit);
}

/**
 * Obtiene estadísticas de errores por código
 * Analiza los últimos N errores del buffer
 * 
 * @param {number} [limit=200] - Número de errores a analizar
 * @returns {Object} Objeto con conteo por código de error
 */
export function getErrorStats(limit = 200) {
  const errors = getRecentErrors(limit);
  const stats = {};
  
  errors.forEach(error => {
    const code = error.code || 'UNKNOWN_ERROR';
    stats[code] = (stats[code] || 0) + 1;
  });
  
  return stats;
}

/**
 * Limpia el buffer de errores
 */
export function clearErrorBuffer() {
  errorBuffer.length = 0;
  bufferIndex = 0;
}




