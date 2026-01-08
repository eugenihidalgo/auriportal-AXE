// src/core/repos/levels/level-lines-repo.js
// Contrato/Interfaz del Repositorio de Líneas de Nivel
//
// Este archivo define el contrato que debe cumplir cualquier implementación
// del repositorio de líneas de nivel. Actúa como documentación del comportamiento esperado.

/**
 * @typedef {Object} LevelLineRepo
 * @property {Function} getByKey - Busca una línea por key
 * @property {Function} getAllActive - Obtiene todas las líneas activas
 * @property {Function} create - Crea una nueva línea
 * @property {Function} updateByKey - Actualiza una línea por key
 */

/**
 * CONTRATO: getByKey(lineKey)
 * 
 * Busca una línea de nivel por su clave única.
 * 
 * @param {string} lineKey - Clave única de la línea (ej: 'pde')
 * @returns {Promise<Object|null>} Objeto línea completo o null si no existe
 * @throws {Error} Si hay error de conexión o query a la base de datos
 */
export function getByKey(lineKey) {
  throw new Error('getByKey debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: getAllActive()
 * 
 * Obtiene todas las líneas de nivel activas.
 * 
 * @returns {Promise<Array<Object>>} Array de líneas activas
 * @throws {Error} Si hay error de conexión o query a la base de datos
 */
export function getAllActive() {
  throw new Error('getAllActive debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: create(data)
 * 
 * Crea una nueva línea de nivel.
 * 
 * @param {Object} data - Datos de la línea
 * @param {string} data.line_key - Clave única de la línea
 * @param {string} data.display_name - Nombre mostrado
 * @param {string} [data.status='active'] - Estado (active|deprecated)
 * @param {Object} [data.meta={}] - Metadatos JSONB
 * @returns {Promise<Object>} Objeto línea creado
 * @throws {Error} Si hay error de conexión, validación o duplicado
 */
export function create(data) {
  throw new Error('create debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: updateByKey(lineKey, updates)
 * 
 * Actualiza una línea de nivel por su clave.
 * 
 * @param {string} lineKey - Clave única de la línea
 * @param {Object} updates - Campos a actualizar
 * @returns {Promise<Object|null>} Objeto línea actualizado o null si no existe
 * @throws {Error} Si hay error de conexión o query a la base de datos
 */
export function updateByKey(lineKey, updates) {
  throw new Error('updateByKey debe ser implementado por el repositorio concreto');
}
