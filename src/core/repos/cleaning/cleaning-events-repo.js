// src/core/repos/cleaning/cleaning-events-repo.js
// Contrato/Interfaz del Repositorio de Cleaning Events
//
// Este archivo define el contrato que debe cumplir cualquier implementación
// del repositorio de cleaning events. Actúa como documentación del comportamiento esperado.

/**
 * @typedef {Object} CleaningEvent
 * @property {string} id - UUID del evento
 * @property {Date|string} created_at - Timestamp de creación
 * @property {string} trace_id - ID de traza
 * @property {string} execution_key - Clave de ejecución para idempotencia
 * @property {number} student_id - ID del alumno
 * @property {string} product_key - Clave del producto (default: 'pde')
 * @property {string} domain_type - Tipo de dominio (ej: 'transmutation')
 * @property {string} item_ref - Referencia del item
 * @property {string} clean_layer - Capa de limpieza ('shared' | 'pde')
 * @property {string} item_kind - Tipo de item ('recurrente' | 'una_vez')
 * @property {string} action_type - Tipo de acción ('mark_clean' | 'set_remaining')
 * @property {number|null} delta_completed - Incremento de completed (para una_vez)
 * @property {number|null} set_remaining - Valor de remaining establecido
 * @property {string} actor_type - Tipo de actor ('master' | 'student' | 'automation')
 * @property {string|null} actor_ref - Referencia del actor
 * @property {string|null} surface_key - Superficie de origen
 * @property {Object} meta - Metadatos adicionales (JSONB)
 */

/**
 * CONTRATO: insertEvent(event)
 * 
 * Inserta un evento de limpieza. Respeta idempotencia vía execution_key.
 * Si ya existe un evento con el mismo execution_key y student_id, devuelve "already_applied".
 * 
 * @param {Object} event - Datos del evento
 * @param {string} event.trace_id - ID de traza
 * @param {string} event.execution_key - Clave de ejecución (única por alumno+acción)
 * @param {number} event.student_id - ID del alumno
 * @param {string} [event.product_key='pde'] - Clave del producto
 * @param {string} event.domain_type - Tipo de dominio
 * @param {string} event.item_ref - Referencia del item
 * @param {string} event.clean_layer - Capa de limpieza ('shared' | 'pde')
 * @param {string} event.item_kind - Tipo de item ('recurrente' | 'una_vez')
 * @param {string} event.action_type - Tipo de acción ('mark_clean' | 'set_remaining')
 * @param {number|null} [event.delta_completed] - Incremento de completed
 * @param {number|null} [event.set_remaining] - Valor de remaining
 * @param {string} event.actor_type - Tipo de actor
 * @param {string|null} [event.actor_ref] - Referencia del actor
 * @param {string|null} [event.surface_key] - Superficie de origen
 * @param {Object} [event.meta={}] - Metadatos adicionales
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object|string>} Objeto evento creado o "already_applied" si es duplicado
 * @throws {Error} Si hay error de conexión, query, o constraint violation
 */
export function insertEvent(event, client = null) {
  throw new Error('insertEvent debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: listEventsForStudentItem(options)
 * 
 * Lista eventos de limpieza para un item específico de un alumno.
 * 
 * @param {Object} options - Opciones de búsqueda
 * @param {number} options.student_id - ID del alumno
 * @param {string} [options.product_key='pde'] - Clave del producto
 * @param {string} options.domain_type - Tipo de dominio
 * @param {string} options.item_ref - Referencia del item
 * @param {number} [options.limit] - Límite de resultados
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Array<CleaningEvent>>} Array de eventos ordenados por created_at DESC
 * @throws {Error} Si hay error de conexión o query
 */
export function listEventsForStudentItem(options, client = null) {
  throw new Error('listEventsForStudentItem debe ser implementado por el repositorio concreto');
}
