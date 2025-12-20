// src/core/repos/context-mappings-repo.js
// Contrato/Interfaz del Repositorio de Context Mappings
//
// Este archivo define el contrato que debe cumplir cualquier implementación
// del repositorio de context mappings. Actúa como documentación del comportamiento esperado.
//
// REGLAS DEL CONTRATO:
// - Todas las funciones retornan Promises
// - Retornan null/[] si no se encuentra el recurso (no lanzan excepciones)
// - Retornan el objeto completo del mapping (raw de PostgreSQL) o null
// - Las funciones de actualización retornan el objeto actualizado
// - Los errores de base de datos se propagan como excepciones

/**
 * @typedef {Object} ContextMappingRepo
 * @property {Function} listByContextKey - Lista mappings por context_key
 * @property {Function} upsertMapping - Crea o actualiza un mapping
 * @property {Function} softDeleteMapping - Elimina un mapping (soft delete)
 */

/**
 * CONTRATO: listByContextKey(contextKey)
 * 
 * Lista todos los mappings activos de un contexto, ordenados por sort_order.
 * 
 * @param {string} contextKey - Clave del contexto
 * @returns {Promise<Array>} Array de mappings (raw de PostgreSQL)
 * @throws {Error} Si hay error de conexión o query a la base de datos
 * 
 * Ejemplo:
 * const mappings = await repo.listByContextKey('tipo_limpieza');
 * mappings.forEach(m => console.log(m.mapping_key, m.mapping_data));
 */
export function listByContextKey(contextKey) {
  throw new Error('listByContextKey debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: upsertMapping(contextKey, mappingKey, mappingData, options)
 * 
 * Crea o actualiza un mapping (INSERT ... ON CONFLICT DO UPDATE).
 * Si el mapping existe, actualiza; si no existe, crea.
 * 
 * @param {string} contextKey - Clave del contexto
 * @param {string} mappingKey - Clave del mapping (valor del enum)
 * @param {Object} mappingData - Datos del mapping (JSON)
 * @param {Object} [options] - Opciones adicionales
 * @param {number} [options.sortOrder] - Orden de visualización
 * @param {boolean} [options.active] - Estado activo/inactivo
 * @returns {Promise<Object>} Objeto mapping creado/actualizado (raw de PostgreSQL)
 * @throws {Error} Si hay error de conexión o query
 * 
 * Ejemplo:
 * const mapping = await repo.upsertMapping(
 *   'tipo_limpieza',
 *   'rapida',
 *   { max_aspects: 5, minutes: 10 },
 *   { sortOrder: 1, active: true }
 * );
 */
export function upsertMapping(contextKey, mappingKey, mappingData, options = {}) {
  throw new Error('upsertMapping debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: softDeleteMapping(id)
 * 
 * Elimina un mapping por ID (soft delete).
 * 
 * @param {string} id - UUID del mapping
 * @returns {Promise<boolean>} true si se eliminó, false si no existía
 * @throws {Error} Si hay error de conexión o query
 * 
 * Ejemplo:
 * const deleted = await repo.softDeleteMapping('uuid-del-mapping');
 */
export function softDeleteMapping(id) {
  throw new Error('softDeleteMapping debe ser implementado por el repositorio concreto');
}

