// src/core/repos/levels/level-gates-repo.js
// Contrato/Interfaz del Repositorio de Bloqueos/Gates de Nivel

/**
 * @typedef {Object} LevelGateRepo
 * @property {Function} getActiveByLineAndLevel - Busca gates activos para un nivel
 * @property {Function} getActiveByLine - Obtiene todos los gates activos de una línea
 * @property {Function} create - Crea un nuevo gate
 */

/**
 * CONTRATO: getActiveByLineAndLevel(lineKey, targetLevelNumber)
 * 
 * Busca todos los gates activos que bloquean un nivel objetivo.
 * 
 * @param {string} lineKey - Clave de la línea
 * @param {number} targetLevelNumber - Número del nivel objetivo
 * @returns {Promise<Array<Object>>} Array de gates activos
 */
export function getActiveByLineAndLevel(lineKey, targetLevelNumber) {
  throw new Error('getActiveByLineAndLevel debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: getActiveByLine(lineKey)
 * 
 * Obtiene todos los gates activos de una línea.
 * 
 * @param {string} lineKey - Clave de la línea
 * @returns {Promise<Array<Object>>} Array de gates activos
 */
export function getActiveByLine(lineKey) {
  throw new Error('getActiveByLine debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: create(data)
 * 
 * Crea un nuevo gate de nivel.
 * 
 * @param {Object} data - Datos del gate
 * @param {string} data.line_key - Clave de la línea
 * @param {number} data.target_level_number - Número del nivel objetivo
 * @param {string} data.gate_key - Clave única del gate
 * @param {Object} [data.definition={}] - Definición JSONB
 * @param {string} [data.status='active'] - Estado
 * @param {string} [data.display_name] - Nombre mostrado
 * @param {string} [data.description] - Descripción
 * @returns {Promise<Object>} Gate creado
 */
export function create(data) {
  throw new Error('create debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: getById(gateId)
 * 
 * Obtiene un gate por su ID.
 * 
 * @param {string} gateId - UUID del gate
 * @returns {Promise<Object|null>} Gate o null si no existe
 */
export function getById(gateId) {
  throw new Error('getById debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: update(gateId, patch)
 * 
 * Actualiza un gate existente.
 * 
 * @param {string} gateId - UUID del gate
 * @param {Object} patch - Campos a actualizar (parcial)
 * @returns {Promise<Object|null>} Gate actualizado o null si no existe
 */
export function update(gateId, patch) {
  throw new Error('update debe ser implementado por el repositorio concreto');
}
