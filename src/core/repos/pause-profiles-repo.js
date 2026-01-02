// src/core/repos/pause-profiles-repo.js
// Contrato del Repositorio de Perfiles de Pausa

/**
 * @typedef {Object} PauseProfilesRepo
 * @property {Function} getByKey - Obtiene un perfil por clave
 * @property {Function} listActive - Lista todos los perfiles activos
 */

/**
 * CONTRATO: getByKey(profileKey, client)
 *
 * @param {string} profileKey - Clave del perfil
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object|null>} Perfil completo o null si no existe
 */
export function getByKey(profileKey, client = null) {
  throw new Error('getByKey debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: listActive(client)
 *
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Array<Object>>} Array de perfiles activos
 */
export function listActive(client = null) {
  throw new Error('listActive debe ser implementado por el repositorio concreto');
}


