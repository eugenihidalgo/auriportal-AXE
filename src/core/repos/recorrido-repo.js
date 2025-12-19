// src/core/repos/recorrido-repo.js
// Contrato/Interfaz del Repositorio de Recorridos
//
// Este archivo define el contrato que debe cumplir cualquier implementación
// del repositorio de recorridos. Actúa como documentación del comportamiento esperado.
//
// REGLAS DEL CONTRATO:
// - Todas las funciones retornan Promises
// - Retornan null si no se encuentra el recurso (no lanzan excepciones)
// - Retornan el objeto completo (raw de PostgreSQL) o null
// - Las funciones de actualización retornan el objeto actualizado
// - Los errores de base de datos se propagan como excepciones

/**
 * @typedef {Object} RecorridoMeta
 * @property {string} id - ID único del recorrido
 * @property {string} name - Nombre legible del recorrido
 * @property {string} status - Estado: 'draft', 'published', 'deprecated', 'archived'
 * @property {string|null} current_draft_id - UUID del draft actual
 * @property {number|null} current_published_version - Versión publicada más reciente
 * @property {Date} created_at - Fecha de creación
 * @property {Date} updated_at - Fecha de última actualización
 */

/**
 * CONTRATO: createRecorrido({id, name})
 * 
 * Crea un nuevo recorrido con status='draft'.
 * 
 * @param {Object} data - Datos del recorrido
 * @param {string} data.id - ID único del recorrido
 * @param {string} data.name - Nombre legible del recorrido
 * @returns {Promise<RecorridoMeta>} Objeto recorrido creado
 * @throws {Error} Si hay error de conexión, query, o constraint violation
 * 
 * Ejemplo:
 * const recorrido = await repo.createRecorrido({
 *   id: 'limpieza-diaria',
 *   name: 'Limpieza Diaria'
 * });
 */
export function createRecorrido(data) {
  throw new Error('createRecorrido debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: getRecorridoById(id)
 * 
 * Busca un recorrido por ID.
 * 
 * @param {string} id - ID del recorrido
 * @returns {Promise<RecorridoMeta|null>} Objeto recorrido o null si no existe
 * @throws {Error} Si hay error de conexión o query
 * 
 * Ejemplo:
 * const recorrido = await repo.getRecorridoById('limpieza-diaria');
 */
export function getRecorridoById(id) {
  throw new Error('getRecorridoById debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: listRecorridos({status?})
 * 
 * Lista recorridos con filtro opcional por status.
 * 
 * @param {Object} [filters] - Filtros opcionales
 * @param {string} [filters.status] - Filtrar por status ('draft', 'published', 'deprecated', 'archived')
 * @returns {Promise<Array<RecorridoMeta>>} Array de recorridos ordenados por updated_at DESC
 * @throws {Error} Si hay error de conexión o query
 * 
 * Ejemplo:
 * const recorridos = await repo.listRecorridos({ status: 'published' });
 */
export function listRecorridos(filters = {}) {
  throw new Error('listRecorridos debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: updateRecorridoMeta(id, {name?, status?, current_draft_id?, current_published_version?})
 * 
 * Actualiza metadatos de un recorrido. Solo actualiza los campos proporcionados.
 * 
 * @param {string} id - ID del recorrido
 * @param {Object} patch - Campos a actualizar (parcial)
 * @param {string} [patch.name] - Nuevo nombre
 * @param {string} [patch.status] - Nuevo status
 * @param {string|null} [patch.current_draft_id] - Nuevo draft_id actual
 * @param {number|null} [patch.current_published_version] - Nueva versión publicada actual
 * @returns {Promise<RecorridoMeta|null>} Objeto recorrido actualizado o null si no existe
 * @throws {Error} Si hay error de conexión o query
 * 
 * Ejemplo:
 * const actualizado = await repo.updateRecorridoMeta('limpieza-diaria', {
 *   status: 'published',
 *   current_published_version: 1
 * });
 */
export function updateRecorridoMeta(id, patch) {
  throw new Error('updateRecorridoMeta debe ser implementado por el repositorio concreto');
}







