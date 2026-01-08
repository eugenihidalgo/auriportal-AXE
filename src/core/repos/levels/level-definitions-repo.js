// src/core/repos/levels/level-definitions-repo.js
// Contrato/Interfaz del Repositorio de Definiciones de Niveles

/**
 * @typedef {Object} LevelDefinitionRepo
 * @property {Function} getByLineAndLevel - Busca un nivel por línea y número
 * @property {Function} getByLine - Obtiene todos los niveles de una línea
 * @property {Function} getActiveByLine - Obtiene todos los niveles activos de una línea
 * @property {Function} getByLineAndDays - Busca el nivel correspondiente a unos días
 * @property {Function} create - Crea una nueva definición de nivel
 */

/**
 * CONTRATO: getByLineAndLevel(lineKey, levelNumber)
 * 
 * Busca una definición de nivel por línea y número de nivel.
 * 
 * @param {string} lineKey - Clave de la línea
 * @param {number} levelNumber - Número del nivel
 * @returns {Promise<Object|null>} Definición de nivel o null si no existe
 */
export function getByLineAndLevel(lineKey, levelNumber) {
  throw new Error('getByLineAndLevel debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: getActiveByLine(lineKey)
 * 
 * Obtiene todos los niveles activos de una línea, ordenados por min_days ascendente.
 * 
 * @param {string} lineKey - Clave de la línea
 * @returns {Promise<Array<Object>>} Array de definiciones de nivel activas
 */
export function getActiveByLine(lineKey) {
  throw new Error('getActiveByLine debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: getByLineAndDays(lineKey, days)
 * 
 * Busca el nivel correspondiente a un número de días.
 * Retorna el nivel con mayor min_days que sea <= days.
 * 
 * @param {string} lineKey - Clave de la línea
 * @param {number} days - Número de días
 * @returns {Promise<Object|null>} Definición de nivel o null si no hay nivel correspondiente
 */
export function getByLineAndDays(lineKey, days) {
  throw new Error('getByLineAndDays debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: create(data)
 * 
 * Crea una nueva definición de nivel.
 * 
 * @param {Object} data - Datos de la definición
 * @param {string} data.line_key - Clave de la línea
 * @param {number} data.level_number - Número del nivel
 * @param {number} data.min_days - Días mínimos
 * @param {string} data.title - Título del nivel
 * @param {string} [data.status='active'] - Estado
 * @param {Object} [data.meta={}] - Metadatos JSONB
 * @returns {Promise<Object>} Definición de nivel creada
 */
export function create(data) {
  throw new Error('create debe ser implementado por el repositorio concreto');
}
