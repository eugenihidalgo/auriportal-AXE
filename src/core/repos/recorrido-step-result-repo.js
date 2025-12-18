// src/core/repos/recorrido-step-result-repo.js
// Contrato/Interfaz del Repositorio de Step Results de Recorridos
//
// Este archivo define el contrato que debe cumplir cualquier implementación
// del repositorio de step results. Actúa como documentación del comportamiento esperado.
//
// REGLAS DEL CONTRATO:
// - Todas las funciones retornan Promises
// - Retornan null si no se encuentra el recurso (no lanzan excepciones)
// - Retornan el objeto completo (raw de PostgreSQL) o null
// - Los errores de base de datos se propagan como excepciones

/**
 * @typedef {Object} RecorridoStepResult
 * @property {string} id - UUID del resultado
 * @property {string} run_id - UUID del run
 * @property {string} step_id - ID del step completado
 * @property {Object} captured_json - Datos capturados (raw input del usuario)
 * @property {number|null} duration_ms - Duración en milisegundos (opcional)
 * @property {Date} created_at - Fecha de creación
 */

/**
 * CONTRATO: appendStepResult({run_id, step_id, captured_json, duration_ms})
 * 
 * Añade un nuevo resultado de step (append-only).
 * 
 * @param {Object} data - Datos del resultado
 * @param {string} data.run_id - UUID del run
 * @param {string} data.step_id - ID del step completado
 * @param {Object} data.captured_json - Datos capturados (raw input)
 * @param {number|null} [data.duration_ms] - Duración en milisegundos (opcional)
 * @returns {Promise<RecorridoStepResult>} Objeto resultado creado
 * @throws {Error} Si hay error de conexión, query, o constraint violation
 * 
 * Ejemplo:
 * const result = await repo.appendStepResult({
 *   run_id: '123e4567-e89b-12d3-a456-426614174000',
 *   step_id: 'step_eleccion',
 *   captured_json: { choice_id: 'emocional' },
 *   duration_ms: 5000
 * });
 */
export function appendStepResult(data) {
  throw new Error('appendStepResult debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: listResultsForRun(run_id)
 * 
 * Lista todos los resultados de steps de un run (ordenados por created_at).
 * 
 * @param {string} run_id - UUID del run
 * @returns {Promise<Array<RecorridoStepResult>>} Lista de resultados
 * @throws {Error} Si hay error de conexión o query
 * 
 * Ejemplo:
 * const results = await repo.listResultsForRun('123e4567-e89b-12d3-a456-426614174000');
 */
export function listResultsForRun(run_id) {
  throw new Error('listResultsForRun debe ser implementado por el repositorio concreto');
}




