// src/core/repos/student-activation-limit-repo.js
// Contrato del Repositorio de Límites de Activación

/**
 * @typedef {Object} StudentActivationLimitRepo
 * @property {Function} getByStudentAndDomain - Busca límite por student_id y domain
 * @property {Function} upsert - Crea o actualiza un límite
 * @property {Function} getDefaultLimit - Obtiene el límite por defecto del sistema
 */

export function getByStudentAndDomain(studentId, domain) {
  throw new Error('getByStudentAndDomain debe ser implementado por el repositorio concreto');
}

export function upsert(data) {
  throw new Error('upsert debe ser implementado por el repositorio concreto');
}

export function getDefaultLimit(domain) {
  throw new Error('getDefaultLimit debe ser implementado por el repositorio concreto');
}
