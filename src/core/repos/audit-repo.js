// src/core/repos/audit-repo.js
// Contrato/Interfaz del Repositorio de Auditoría
//
// Este archivo define el contrato que debe cumplir cualquier implementación
// del repositorio de auditoría. Actúa como documentación del comportamiento esperado.
//
// REGLAS DEL CONTRATO:
// - Todas las funciones retornan Promises
// - La tabla audit_log es append-only (no se permite UPDATE ni DELETE)
// - Los eventos se registran con timestamp automático
// - Los datos se validan y truncan si exceden límites razonables

/**
 * @typedef {Object} AuditEvent
 * @property {string} requestId - Correlation ID del request
 * @property {string} actorType - Tipo de actor: 'student', 'admin', 'system'
 * @property {string} actorId - ID del actor (alumno_id, admin_id, etc.)
 * @property {string} eventType - Tipo de evento (SUBSCRIPTION_BLOCKED_PRACTICE, etc.)
 * @property {string} severity - Severidad: 'info', 'warn', 'error'
 * @property {Object} data - Datos adicionales del evento (JSONB)
 */

/**
 * CONTRATO: recordEvent(event)
 * 
 * Registra un evento de auditoría en la tabla audit_log.
 * La tabla es append-only, por lo que no se permite modificar eventos existentes.
 * 
 * @param {AuditEvent} event - Objeto con los datos del evento
 * @param {string} event.requestId - Correlation ID del request (opcional)
 * @param {string} event.actorType - Tipo de actor: 'student', 'admin', 'system' (opcional)
 * @param {string} event.actorId - ID del actor (opcional)
 * @param {string} event.eventType - Tipo de evento (requerido)
 * @param {string} [event.severity='info'] - Severidad: 'info', 'warn', 'error' (default: 'info')
 * @param {Object} [event.data={}] - Datos adicionales del evento (default: {})
 * @returns {Promise<Object>} Objeto con el evento registrado (incluye id, created_at)
 * @throws {Error} Si hay error de conexión o query a la base de datos
 * @throws {Error} Si eventType está vacío o no se proporciona
 * 
 * Ejemplo:
 * await repo.recordEvent({
 *   requestId: 'req_1234567890_abc123',
 *   actorType: 'student',
 *   actorId: '123',
 *   eventType: 'SUBSCRIPTION_BLOCKED_PRACTICE',
 *   severity: 'warn',
 *   data: { status: 'pausada', reason: 'Suscripción pausada' }
 * });
 */
export function recordEvent(event) {
  throw new Error('recordEvent debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: getRecentEvents(limit, filters)
 * 
 * Obtiene eventos recientes de auditoría con filtros opcionales.
 * 
 * @param {number} [limit=200] - Número máximo de eventos a retornar (default: 200)
 * @param {Object} [filters] - Filtros opcionales
 * @param {string} [filters.eventType] - Filtrar por tipo de evento
 * @param {string} [filters.actorId] - Filtrar por ID de actor
 * @param {string} [filters.requestId] - Filtrar por request ID
 * @param {string} [filters.severity] - Filtrar por severidad
 * @param {Date|string} [filters.since] - Filtrar eventos desde esta fecha
 * @returns {Promise<Array<Object>>} Array de eventos ordenados por created_at DESC
 * @throws {Error} Si hay error de conexión o query a la base de datos
 * 
 * Ejemplo:
 * const events = await repo.getRecentEvents(100, {
 *   eventType: 'SUBSCRIPTION_BLOCKED_PRACTICE',
 *   actorId: '123'
 * });
 */
export function getRecentEvents(limit = 200, filters = {}) {
  throw new Error('getRecentEvents debe ser implementado por el repositorio concreto');
}










