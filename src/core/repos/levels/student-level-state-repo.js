// src/core/repos/levels/student-level-state-repo.js
// Contrato/Interfaz del Repositorio de Estado de Nivel por Alumno

/**
 * @typedef {Object} StudentLevelStateRepo
 * @property {Function} getByStudentAndLine - Busca estado por alumno y línea
 * @property {Function} getByStudent - Obtiene todos los estados de un alumno
 * @property {Function} upsert - Crea o actualiza estado
 * @property {Function} deleteByStudentAndLine - Elimina estado
 */

/**
 * CONTRATO: getByStudentAndLine(studentId, lineKey)
 * 
 * Busca el estado de nivel de un alumno para una línea específica.
 * 
 * @param {string} studentId - UUID del alumno
 * @param {string} lineKey - Clave de la línea
 * @returns {Promise<Object|null>} Estado de nivel o null si no existe
 */
export function getByStudentAndLine(studentId, lineKey) {
  throw new Error('getByStudentAndLine debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: getByStudent(studentId)
 * 
 * Obtiene todos los estados de nivel de un alumno.
 * 
 * @param {string} studentId - UUID del alumno
 * @returns {Promise<Array<Object>>} Array de estados de nivel
 */
export function getByStudent(studentId) {
  throw new Error('getByStudent debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: upsert(data, client)
 * 
 * Crea o actualiza el estado de nivel de un alumno.
 * 
 * @param {Object} data - Datos del estado
 * @param {string} data.student_id - UUID del alumno
 * @param {string} data.line_key - Clave de la línea
 * @param {Date|string} data.started_at - Fecha de inicio
 * @param {number} [data.frozen_seconds=0] - Segundos congelados
 * @param {number} [data.computed_days=0] - Días calculados
 * @param {number} [data.current_level_number] - Número del nivel actual
 * @param {string} [data.current_phase_key] - Clave de la fase actual
 * @param {string} [data.upgrade_status='ok'] - Estado de upgrade
 * @param {Array} [data.pending_requirements=[]] - Requisitos pendientes
 * @param {Object} [data.meta={}] - Metadatos JSONB
 * @param {Object} [client] - Client de PostgreSQL para transacciones
 * @returns {Promise<Object>} Estado de nivel creado/actualizado
 */
export function upsert(data, client = null) {
  throw new Error('upsert debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: deleteByStudentAndLine(studentId, lineKey)
 * 
 * Elimina el estado de nivel de un alumno para una línea específica.
 * 
 * @param {string} studentId - UUID del alumno
 * @param {string} lineKey - Clave de la línea
 * @returns {Promise<boolean>} true si se eliminó, false si no existía
 */
export function deleteByStudentAndLine(studentId, lineKey) {
  throw new Error('deleteByStudentAndLine debe ser implementado por el repositorio concreto');
}
