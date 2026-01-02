// src/core/repos/student-operational-state-repo.js
// Contrato del Repositorio de Estado Operativo del Alumno

/**
 * @typedef {Object} StudentOperationalStateRepo
 * @property {Function} getCurrentState - Obtiene el estado operativo actual (sin ends_at)
 * @property {Function} createState - Crea un nuevo estado operativo
 * @property {Function} endCurrentState - Finaliza el estado operativo actual
 * @property {Function} pauseStudent - Pausa un alumno
 * @property {Function} resumeStudent - Reanuda un alumno
 */

/**
 * CONTRATO: getCurrentState(studentId, client)
 *
 * @param {string} studentId - UUID del student
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object|null>} Estado operativo actual o null si no existe
 */
export function getCurrentState(studentId, client = null) {
  throw new Error('getCurrentState debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: createState(stateData, client)
 *
 * @param {Object} stateData - Datos del estado
 * @param {string} stateData.student_id - UUID del student
 * @param {string} stateData.state - Estado ('ACTIVE', 'PAUSED', 'SUSPENDED')
 * @param {string} [stateData.pause_profile_key] - Perfil de pausa (si state=PAUSED)
 * @param {string} [stateData.pause_reason] - Razón de pausa
 * @param {string} stateData.source - Origen ('subscription', 'master', 'system')
 * @param {Date|string} [stateData.ends_at] - Fin del estado (opcional)
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Estado operativo creado
 */
export function createState(stateData, client = null) {
  throw new Error('createState debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: endCurrentState(studentId, client)
 *
 * Finaliza el estado operativo actual (marca ends_at = now()).
 *
 * @param {string} studentId - UUID del student
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object|null>} Estado finalizado o null si no existe
 */
export function endCurrentState(studentId, client = null) {
  throw new Error('endCurrentState debe ser implementado por el repositorio concreto');
}


