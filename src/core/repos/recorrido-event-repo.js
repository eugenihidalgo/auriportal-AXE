// src/core/repos/recorrido-event-repo.js
// Contrato/Interfaz del Repositorio de Events de Recorridos
//
// Este archivo define el contrato que debe cumplir cualquier implementación
// del repositorio de events. Actúa como documentación del comportamiento esperado.
//
// REGLAS DEL CONTRATO:
// - Todas las funciones retornan Promises
// - Retornan null si no se encuentra el recurso (no lanzan excepciones)
// - Retornan el objeto completo (raw de PostgreSQL) o null
// - Los errores de base de datos se propagan como excepciones
// - Idempotency: si idempotency_key existe, no se duplica

/**
 * @typedef {Object} RecorridoEvent
 * @property {string} id - UUID del evento
 * @property {string|null} run_id - UUID del run (NULL si es evento global)
 * @property {string|null} user_id - ID del usuario (NULL si es evento del sistema)
 * @property {string} event_type - Tipo de evento
 * @property {Object} payload_json - Payload del evento (validado contra EventRegistry)
 * @property {string|null} idempotency_key - Clave de idempotencia (opcional)
 * @property {Date} created_at - Fecha de creación
 */

/**
 * CONTRATO: appendEvent({run_id, user_id, event_type, payload_json, idempotency_key})
 * 
 * Añade un nuevo evento (append-only).
 * Si idempotency_key existe y ya hay un evento con esa clave, no se duplica.
 * 
 * @param {Object} data - Datos del evento
 * @param {string|null} [data.run_id] - UUID del run (opcional)
 * @param {string|null} [data.user_id] - ID del usuario (opcional)
 * @param {string} data.event_type - Tipo de evento (debe existir en EventRegistry)
 * @param {Object} data.payload_json - Payload del evento (validado contra EventRegistry.payload_schema)
 * @param {string|null} [data.idempotency_key] - Clave de idempotencia (opcional)
 * @returns {Promise<RecorridoEvent>} Objeto evento creado (o existente si idempotency_key duplicado)
 * @throws {Error} Si hay error de conexión, query, o constraint violation
 * 
 * Ejemplo:
 * const event = await repo.appendEvent({
 *   run_id: '123e4567-e89b-12d3-a456-426614174000',
 *   user_id: 'user@example.com',
 *   event_type: 'step_viewed',
 *   payload_json: {
 *     recorrido_id: 'limpieza-diaria',
 *     step_id: 'step_intro',
 *     user_id: 'user@example.com',
 *     timestamp: new Date().toISOString()
 *   },
 *   idempotency_key: '123e4567-e89b-12d3-a456-426614174000:step_intro:view'
 * });
 */
export function appendEvent(data) {
  throw new Error('appendEvent debe ser implementado por el repositorio concreto');
}















