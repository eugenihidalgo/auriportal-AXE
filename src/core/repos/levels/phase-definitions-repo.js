// src/core/repos/levels/phase-definitions-repo.js
// Contrato/Interfaz del Repositorio de Definiciones de Fases

/**
 * @typedef {Object} PhaseDefinitionRepo
 * @property {Function} getByLineAndPhase - Busca una fase por línea y clave
 * @property {Function} getActiveByLine - Obtiene todas las fases activas de una línea
 * @property {Function} getByLineAndDays - Busca la fase correspondiente a unos días
 * @property {Function} create - Crea una nueva definición de fase
 */

/**
 * CONTRATO: getByLineAndPhase(lineKey, phaseKey)
 * 
 * Busca una definición de fase por línea y clave de fase.
 * 
 * @param {string} lineKey - Clave de la línea
 * @param {string} phaseKey - Clave de la fase
 * @returns {Promise<Object|null>} Definición de fase o null si no existe
 */
export function getByLineAndPhase(lineKey, phaseKey) {
  throw new Error('getByLineAndPhase debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: getActiveByLine(lineKey)
 * 
 * Obtiene todas las fases activas de una línea, ordenadas por min_days ascendente.
 * 
 * @param {string} lineKey - Clave de la línea
 * @returns {Promise<Array<Object>>} Array de definiciones de fase activas
 */
export function getActiveByLine(lineKey) {
  throw new Error('getActiveByLine debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: getByLineAndDays(lineKey, days)
 * 
 * Busca la fase correspondiente a un número de días.
 * Retorna la fase con mayor min_days que sea <= days.
 * 
 * @param {string} lineKey - Clave de la línea
 * @param {number} days - Número de días
 * @returns {Promise<Object|null>} Definición de fase o null si no hay fase correspondiente
 */
export function getByLineAndDays(lineKey, days) {
  throw new Error('getByLineAndDays debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: create(data)
 * 
 * Crea una nueva definición de fase.
 * 
 * @param {Object} data - Datos de la definición
 * @param {string} data.line_key - Clave de la línea
 * @param {string} data.phase_key - Clave única de la fase
 * @param {string} data.display_name - Nombre mostrado
 * @param {number} data.min_days - Días mínimos
 * @param {string} [data.status='active'] - Estado
 * @param {Object} [data.meta={}] - Metadatos JSONB
 * @returns {Promise<Object>} Definición de fase creada
 */
export function create(data) {
  throw new Error('create debe ser implementado por el repositorio concreto');
}
