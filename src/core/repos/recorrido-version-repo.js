// src/core/repos/recorrido-version-repo.js
// Contrato/Interfaz del Repositorio de Versiones de Recorridos
//
// Este archivo define el contrato que debe cumplir cualquier implementación
// del repositorio de versiones. Actúa como documentación del comportamiento esperado.
//
// REGLAS DEL CONTRATO:
// - Todas las funciones retornan Promises
// - Retornan null si no se encuentra el recurso (no lanzan excepciones)
// - Retornan el objeto completo (raw de PostgreSQL) o null
// - Las versiones son INMUTABLES (una vez publicadas, nunca cambian)
// - Los errores de base de datos se propagan como excepciones

/**
 * @typedef {Object} RecorridoVersion
 * @property {string} recorrido_id - ID del recorrido
 * @property {number} version - Número de versión (1, 2, 3, ...)
 * @property {string} status - Estado: 'published' o 'deprecated'
 * @property {Object} definition_json - RecorridoDefinition INMUTABLE
 * @property {string|null} release_notes - Notas de la versión
 * @property {Date} created_at - Fecha de publicación
 * @property {string|null} created_by - ID/email del admin que publicó
 */

/**
 * CONTRATO: getLatestVersion(recorrido_id)
 * 
 * Obtiene la versión publicada más reciente de un recorrido.
 * 
 * @param {string} recorrido_id - ID del recorrido
 * @returns {Promise<RecorridoVersion|null>} Objeto versión o null si no existe
 * @throws {Error} Si hay error de conexión o query
 * 
 * Ejemplo:
 * const version = await repo.getLatestVersion('limpieza-diaria');
 */
export function getLatestVersion(recorrido_id) {
  throw new Error('getLatestVersion debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: getVersion(recorrido_id, version)
 * 
 * Obtiene una versión específica de un recorrido.
 * 
 * @param {string} recorrido_id - ID del recorrido
 * @param {number} version - Número de versión
 * @returns {Promise<RecorridoVersion|null>} Objeto versión o null si no existe
 * @throws {Error} Si hay error de conexión o query
 * 
 * Ejemplo:
 * const version = await repo.getVersion('limpieza-diaria', 1);
 */
export function getVersion(recorrido_id, version) {
  throw new Error('getVersion debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: createVersion(recorrido_id, version, definition_json, release_notes, created_by)
 * 
 * Crea una nueva versión publicada (INMUTABLE).
 * 
 * @param {string} recorrido_id - ID del recorrido
 * @param {number} version - Número de versión (debe ser el siguiente disponible)
 * @param {Object} definition_json - RecorridoDefinition completa (validada)
 * @param {string|null} [release_notes] - Notas de la versión (opcional)
 * @param {string|null} [created_by] - ID/email del admin (opcional)
 * @returns {Promise<RecorridoVersion>} Objeto versión creada
 * @throws {Error} Si hay error de conexión, query, o constraint violation
 * 
 * Ejemplo:
 * const version = await repo.createVersion('limpieza-diaria', 1, {
 *   id: 'limpieza-diaria',
 *   entry_step_id: 'step1',
 *   steps: { step1: { ... } },
 *   edges: []
 * }, 'Primera versión publicada', 'admin@example.com');
 */
export function createVersion(recorrido_id, version, definition_json, release_notes = null, created_by = null) {
  throw new Error('createVersion debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: deprecateVersion(recorrido_id, version)
 * 
 * Marca una versión como deprecated (obsoleta).
 * La versión sigue existiendo pero no se usa en runtime.
 * 
 * @param {string} recorrido_id - ID del recorrido
 * @param {number} version - Número de versión
 * @returns {Promise<RecorridoVersion|null>} Objeto versión actualizada o null si no existe
 * @throws {Error} Si hay error de conexión o query
 * 
 * Ejemplo:
 * const deprecated = await repo.deprecateVersion('limpieza-diaria', 1);
 */
export function deprecateVersion(recorrido_id, version) {
  throw new Error('deprecateVersion debe ser implementado por el repositorio concreto');
}







