// src/core/repos/recorrido-run-repo.js
// Contrato/Interfaz del Repositorio de Runs de Recorridos
//
// Este archivo define el contrato que debe cumplir cualquier implementación
// del repositorio de runs. Actúa como documentación del comportamiento esperado.
//
// REGLAS DEL CONTRATO:
// - Todas las funciones retornan Promises
// - Retornan null si no se encuentra el recurso (no lanzan excepciones)
// - Retornan el objeto completo (raw de PostgreSQL) o null
// - Los errores de base de datos se propagan como excepciones

/**
 * @typedef {Object} RecorridoRun
 * @property {string} run_id - UUID del run
 * @property {string} user_id - ID del usuario (email o alumno_id)
 * @property {string} recorrido_id - ID del recorrido
 * @property {number} version - Versión del recorrido ejecutada
 * @property {string} status - Estado: 'in_progress', 'completed', 'abandoned'
 * @property {string} current_step_id - ID del step actual
 * @property {Object} state_json - Estado del run (JSONB)
 * @property {Date} started_at - Fecha de inicio
 * @property {Date|null} completed_at - Fecha de finalización
 * @property {Date|null} abandoned_at - Fecha de abandono
 * @property {Date} last_activity_at - Última actividad
 */

/**
 * CONTRATO: createRun({user_id, recorrido_id, version, entry_step_id})
 * 
 * Crea un nuevo run de un recorrido.
 * 
 * @param {Object} data - Datos del run
 * @param {string} data.user_id - ID del usuario
 * @param {string} data.recorrido_id - ID del recorrido
 * @param {number} data.version - Versión del recorrido
 * @param {string} data.entry_step_id - ID del step de entrada
 * @returns {Promise<RecorridoRun>} Objeto run creado
 * @throws {Error} Si hay error de conexión, query, o constraint violation
 * 
 * Ejemplo:
 * const run = await repo.createRun({
 *   user_id: 'user@example.com',
 *   recorrido_id: 'limpieza-diaria',
 *   version: 1,
 *   entry_step_id: 'step_intro'
 * });
 */
export function createRun(data) {
  throw new Error('createRun debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: getRunById(run_id)
 * 
 * Obtiene un run por su ID.
 * 
 * @param {string} run_id - UUID del run
 * @returns {Promise<RecorridoRun|null>} Objeto run o null si no existe
 * @throws {Error} Si hay error de conexión o query
 * 
 * Ejemplo:
 * const run = await repo.getRunById('123e4567-e89b-12d3-a456-426614174000');
 */
export function getRunById(run_id) {
  throw new Error('getRunById debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: getActiveRunForUser({user_id, recorrido_id})
 * 
 * Obtiene el run activo (in_progress) de un usuario para un recorrido.
 * Opcional: puede haber solo un run activo por usuario/recorrido.
 * 
 * @param {Object} params - Parámetros de búsqueda
 * @param {string} params.user_id - ID del usuario
 * @param {string} params.recorrido_id - ID del recorrido
 * @returns {Promise<RecorridoRun|null>} Objeto run o null si no existe
 * @throws {Error} Si hay error de conexión o query
 * 
 * Ejemplo:
 * const run = await repo.getActiveRunForUser({
 *   user_id: 'user@example.com',
 *   recorrido_id: 'limpieza-diaria'
 * });
 */
export function getActiveRunForUser(params) {
  throw new Error('getActiveRunForUser debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: updateRun(run_id, patch)
 * 
 * Actualiza un run. Solo actualiza los campos proporcionados en patch.
 * 
 * @param {string} run_id - UUID del run
 * @param {Object} patch - Campos a actualizar (parcial)
 * @param {string} [patch.current_step_id] - Nuevo step actual
 * @param {Object} [patch.state_json] - Nuevo estado (se mergea, no se sobrescribe)
 * @param {string} [patch.status] - Nuevo estado
 * @param {Date} [patch.completed_at] - Fecha de finalización
 * @param {Date} [patch.abandoned_at] - Fecha de abandono
 * @returns {Promise<RecorridoRun|null>} Objeto run actualizado o null si no existe
 * @throws {Error} Si hay error de conexión o query
 * 
 * Ejemplo:
 * const updated = await repo.updateRun('123e4567-e89b-12d3-a456-426614174000', {
 *   current_step_id: 'step_practica',
 *   state_json: { choice_id: 'emocional' }
 * });
 */
export function updateRun(run_id, patch) {
  throw new Error('updateRun debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: touchRun(run_id)
 * 
 * Actualiza last_activity_at de un run (útil para tracking de actividad).
 * 
 * @param {string} run_id - UUID del run
 * @returns {Promise<RecorridoRun|null>} Objeto run actualizado o null si no existe
 * @throws {Error} Si hay error de conexión o query
 * 
 * Ejemplo:
 * await repo.touchRun('123e4567-e89b-12d3-a456-426614174000');
 */
export function touchRun(run_id) {
  throw new Error('touchRun debe ser implementado por el repositorio concreto');
}







