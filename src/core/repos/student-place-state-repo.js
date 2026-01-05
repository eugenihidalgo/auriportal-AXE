// src/core/repos/student-place-state-repo.js
// Contrato del Repositorio de Estado Alumno-Lugar

/**
 * @typedef {Object} StudentPlaceStateRepo
 * @property {Function} getById - Busca un estado por ID
 * @property {Function} getByStudentAndPlace - Busca estado por student_id y place_id
 * @property {Function} listByStudent - Lista estados de un alumno
 * @property {Function} listActiveByStudent - Lista lugares activos de un alumno
 * @property {Function} listAllActive - Lista todos los lugares activos (global)
 * @property {Function} create - Crea un nuevo estado
 * @property {Function} updateById - Actualiza un estado por ID
 * @property {Function} countActiveByStudent - Cuenta lugares activos de un alumno
 */

export function getById(id) {
  throw new Error('getById debe ser implementado por el repositorio concreto');
}

export function getByStudentAndPlace(studentId, placeId) {
  throw new Error('getByStudentAndPlace debe ser implementado por el repositorio concreto');
}

export function listByStudent(studentId, options = {}) {
  throw new Error('listByStudent debe ser implementado por el repositorio concreto');
}

export function listActiveByStudent(studentId) {
  throw new Error('listActiveByStudent debe ser implementado por el repositorio concreto');
}

export function listAllActive(options = {}) {
  throw new Error('listAllActive debe ser implementado por el repositorio concreto');
}

export function create(data) {
  throw new Error('create debe ser implementado por el repositorio concreto');
}

export function updateById(id, patch) {
  throw new Error('updateById debe ser implementado por el repositorio concreto');
}

export function countActiveByStudent(studentId) {
  throw new Error('countActiveByStudent debe ser implementado por el repositorio concreto');
}
