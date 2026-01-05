// src/core/repos/student-project-state-repo.js
// Contrato del Repositorio de Estado Alumno-Proyecto

/**
 * @typedef {Object} StudentProjectStateRepo
 * @property {Function} getById - Busca un estado por ID
 * @property {Function} getByStudentAndProject - Busca estado por alumno y proyecto
 * @property {Function} listByStudent - Lista todos los proyectos de un alumno
 * @property {Function} listActiveByStudent - Lista proyectos activos de un alumno
 * @property {Function} listAllActive - Lista todos los proyectos activos globalmente
 * @property {Function} create - Crea un nuevo estado
 * @property {Function} updateById - Actualiza un estado por ID
 * @property {Function} countActiveByStudent - Cuenta proyectos activos de un alumno
 * @property {Function} getOldestActiveByStudent - Obtiene el proyecto activo más antiguo de un alumno
 */

export function getById(id) {
  throw new Error('getById debe ser implementado por el repositorio concreto');
}

export function getByStudentAndProject(studentId, projectId) {
  throw new Error('getByStudentAndProject debe ser implementado por el repositorio concreto');
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

export function getOldestActiveByStudent(studentId) {
  throw new Error('getOldestActiveByStudent debe ser implementado por el repositorio concreto');
}
