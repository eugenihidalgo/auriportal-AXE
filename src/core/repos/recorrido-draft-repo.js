// src/core/repos/recorrido-draft-repo.js
// Contrato/Interfaz del Repositorio de Drafts de Recorridos
//
// Este archivo define el contrato que debe cumplir cualquier implementación
// del repositorio de drafts. Actúa como documentación del comportamiento esperado.
//
// REGLAS DEL CONTRATO:
// - Todas las funciones retornan Promises
// - Retornan null si no se encuentra el recurso (no lanzan excepciones)
// - Retornan el objeto completo (raw de PostgreSQL) o null
// - Los errores de base de datos se propagan como excepciones

/**
 * @typedef {Object} RecorridoDraft
 * @property {string} draft_id - UUID único del draft
 * @property {string} recorrido_id - ID del recorrido
 * @property {Object} definition_json - RecorridoDefinition completa
 * @property {Date} created_at - Fecha de creación
 * @property {Date} updated_at - Fecha de última actualización
 * @property {string|null} updated_by - ID/email del admin que actualizó
 */

/**
 * CONTRATO: createDraft(recorrido_id, definition_json, updated_by)
 * 
 * Crea un nuevo draft para un recorrido.
 * 
 * @param {string} recorrido_id - ID del recorrido
 * @param {Object} definition_json - RecorridoDefinition completa
 * @param {string|null} [updated_by] - ID/email del admin (opcional)
 * @returns {Promise<RecorridoDraft>} Objeto draft creado
 * @throws {Error} Si hay error de conexión, query, o constraint violation
 * 
 * Ejemplo:
 * const draft = await repo.createDraft('limpieza-diaria', {
 *   id: 'limpieza-diaria',
 *   entry_step_id: 'step1',
 *   steps: { step1: { ... } },
 *   edges: []
 * }, 'admin@example.com');
 */
export function createDraft(recorrido_id, definition_json, updated_by = null) {
  throw new Error('createDraft debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: getDraftById(draft_id)
 * 
 * Busca un draft por UUID.
 * 
 * @param {string} draft_id - UUID del draft
 * @returns {Promise<RecorridoDraft|null>} Objeto draft o null si no existe
 * @throws {Error} Si hay error de conexión o query
 * 
 * Ejemplo:
 * const draft = await repo.getDraftById('550e8400-e29b-41d4-a716-446655440000');
 */
export function getDraftById(draft_id) {
  throw new Error('getDraftById debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: updateDraft(draft_id, definition_json, updated_by)
 * 
 * Actualiza un draft existente.
 * 
 * @param {string} draft_id - UUID del draft
 * @param {Object} definition_json - Nueva RecorridoDefinition
 * @param {string|null} [updated_by] - ID/email del admin (opcional)
 * @returns {Promise<RecorridoDraft|null>} Objeto draft actualizado o null si no existe
 * @throws {Error} Si hay error de conexión o query
 * 
 * Ejemplo:
 * const actualizado = await repo.updateDraft('550e8400-e29b-41d4-a716-446655440000', {
 *   id: 'limpieza-diaria',
 *   entry_step_id: 'step1',
 *   steps: { step1: { ... }, step2: { ... } },
 *   edges: [{ from_step_id: 'step1', to_step_id: 'step2' }]
 * }, 'admin@example.com');
 */
export function updateDraft(draft_id, definition_json, updated_by = null) {
  throw new Error('updateDraft debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: getCurrentDraft(recorrido_id)
 * 
 * Obtiene el draft actual de un recorrido (el más reciente).
 * 
 * @param {string} recorrido_id - ID del recorrido
 * @returns {Promise<RecorridoDraft|null>} Objeto draft actual o null si no existe
 * @throws {Error} Si hay error de conexión o query
 * 
 * Ejemplo:
 * const draft = await repo.getCurrentDraft('limpieza-diaria');
 */
export function getCurrentDraft(recorrido_id) {
  throw new Error('getCurrentDraft debe ser implementado por el repositorio concreto');
}







