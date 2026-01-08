// src/core/repos/levels/student-level-history-repo.js
// Contrato/Interfaz del Repositorio de Historial de Niveles por Alumno

/**
 * @typedef {Object} StudentLevelHistoryRepo
 * @property {Function} append - Añade un evento al historial (append-only)
 * @property {Function} getByStudentAndLine - Obtiene historial por alumno y línea
 * @property {Function} getByTraceId - Busca eventos por trace_id
 */

/**
 * CONTRATO: append(data, client)
 * 
 * Añade un evento al historial (append-only, nunca UPDATE o DELETE).
 * 
 * @param {Object} data - Datos del evento
 * @param {string} data.student_id - UUID del alumno
 * @param {string} data.line_key - Clave de la línea
 * @param {string} data.event_type - Tipo de evento (line_started, level_changed, phase_changed, frozen, unfrozen, upgrade_pending, upgrade_locked, recomputed)
 * @param {Object} [data.before] - Estado anterior (JSONB)
 * @param {Object} [data.after] - Estado nuevo (JSONB)
 * @param {string} [data.actor_type] - Tipo de actor (system, master)
 * @param {string} [data.actor_id] - ID del actor
 * @param {string} [data.trace_id] - ID de traza
 * @param {Object} [data.meta={}] - Metadatos JSONB
 * @param {Object} [client] - Client de PostgreSQL para transacciones
 * @returns {Promise<Object>} Evento creado
 */
export function append(data, client = null) {
  throw new Error('append debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: getByStudentAndLine(studentId, lineKey, limit)
 * 
 * Obtiene el historial de eventos de un alumno para una línea específica.
 * Ordenado por 'at' descendente (más reciente primero).
 * 
 * @param {string} studentId - UUID del alumno
 * @param {string} lineKey - Clave de la línea
 * @param {number} [limit=100] - Límite de resultados
 * @returns {Promise<Array<Object>>} Array de eventos
 */
export function getByStudentAndLine(studentId, lineKey, limit = 100) {
  throw new Error('getByStudentAndLine debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: getByTraceId(traceId)
 * 
 * Busca todos los eventos relacionados con un trace_id.
 * Útil para correlación de eventos.
 * 
 * @param {string} traceId - ID de traza
 * @returns {Promise<Array<Object>>} Array de eventos
 */
export function getByTraceId(traceId) {
  throw new Error('getByTraceId debe ser implementado por el repositorio concreto');
}
