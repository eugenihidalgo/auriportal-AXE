// src/core/repos/analytics-repo.js
// Contrato/Interfaz del Repositorio de Analytics
//
// Este archivo define el contrato que debe cumplir cualquier implementación
// del repositorio de analytics. Actúa como documentación del comportamiento esperado.
//
// REGLAS DEL CONTRATO:
// - Todas las funciones retornan Promises
// - La tabla analytics_events es append-only (no se permite UPDATE ni DELETE)
// - Los eventos se registran con timestamp automático
// - Los datos se validan y truncan si exceden límites razonables
// - No se permite PII (email, nombre, texto libre sin sanitizar)

/**
 * @typedef {Object} AnalyticsEvent
 * @property {string} requestId - Correlation ID del request (opcional)
 * @property {string} actorType - Tipo de actor: 'student', 'admin', 'system', 'anonymous'
 * @property {string} actorId - ID del actor (alumno_id, admin_id, etc.) - NUNCA email ni PII
 * @property {string} sessionId - ID de sesión del cliente (opcional)
 * @property {string} source - Origen del evento: 'client' o 'server'
 * @property {string} eventName - Nombre del evento (ej: 'page_view', 'button_click', 'practice_completed')
 * @property {string} path - Ruta HTTP del evento (opcional)
 * @property {string} screen - Pantalla/vista del evento (opcional)
 * @property {string} appVersion - Versión de la aplicación (APP_VERSION)
 * @property {string} buildId - Build ID de la aplicación (BUILD_ID)
 * @property {Object} props - Propiedades adicionales del evento (JSONB, máximo 16KB)
 */

/**
 * CONTRATO: recordEvent(event)
 * 
 * Registra un evento de analytics en la tabla analytics_events.
 * La tabla es append-only, por lo que no se permite modificar eventos existentes.
 * 
 * @param {AnalyticsEvent} event - Objeto con los datos del evento
 * @param {string} [event.requestId] - Correlation ID del request (opcional)
 * @param {string} event.actorType - Tipo de actor: 'student', 'admin', 'system', 'anonymous' (requerido)
 * @param {string} [event.actorId] - ID del actor (opcional, NUNCA email ni PII)
 * @param {string} [event.sessionId] - ID de sesión del cliente (opcional)
 * @param {string} event.source - Origen del evento: 'client' o 'server' (requerido)
 * @param {string} event.eventName - Nombre del evento (requerido)
 * @param {string} [event.path] - Ruta HTTP del evento (opcional)
 * @param {string} [event.screen] - Pantalla/vista del evento (opcional)
 * @param {string} event.appVersion - Versión de la aplicación (requerido)
 * @param {string} event.buildId - Build ID de la aplicación (requerido)
 * @param {Object} [event.props={}] - Propiedades adicionales del evento (default: {})
 * @returns {Promise<Object>} Objeto con el evento registrado (incluye id, event_id, created_at)
 * @throws {Error} Si hay error de conexión o query a la base de datos
 * @throws {Error} Si eventName, actorType, source, appVersion o buildId están vacíos
 * 
 * Ejemplo:
 * await repo.recordEvent({
 *   requestId: 'req_1234567890_abc123',
 *   actorType: 'student',
 *   actorId: '123',
 *   sessionId: 'sess_abc123',
 *   source: 'server',
 *   eventName: 'practice_completed',
 *   path: '/enter',
 *   screen: 'pantalla2',
 *   appVersion: '4.6.0',
 *   buildId: 'abc123',
 *   props: { practice_type: 'meditation', duration: 10 }
 * });
 */
export function recordEvent(event) {
  throw new Error('recordEvent debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: getRecentEvents(filters, limit)
 * 
 * Obtiene eventos recientes de analytics con filtros opcionales.
 * Solo operaciones READ-ONLY (no modifica datos).
 * 
 * @param {Object} [filters] - Filtros opcionales
 * @param {string} [filters.eventName] - Filtrar por nombre de evento
 * @param {string} [filters.actorId] - Filtrar por ID de actor
 * @param {string} [filters.sessionId] - Filtrar por ID de sesión
 * @param {string} [filters.requestId] - Filtrar por request ID
 * @param {string} [filters.source] - Filtrar por origen: 'client' o 'server'
 * @param {string} [filters.actorType] - Filtrar por tipo de actor
 * @param {Date|string} [filters.since] - Filtrar eventos desde esta fecha
 * @param {Date|string} [filters.until] - Filtrar eventos hasta esta fecha
 * @param {number} [limit=200] - Número máximo de eventos a retornar (default: 200, máximo: 1000)
 * @returns {Promise<Array<Object>>} Array de eventos ordenados por created_at DESC
 * @throws {Error} Si hay error de conexión o query a la base de datos
 * 
 * Ejemplo:
 * const events = await repo.getRecentEvents({
 *   eventName: 'practice_completed',
 *   actorId: '123',
 *   since: new Date('2024-01-01')
 * }, 100);
 */
export function getRecentEvents(filters = {}, limit = 200) {
  throw new Error('getRecentEvents debe ser implementado por el repositorio concreto');
}









