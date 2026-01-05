// src/core/repos/projects-catalog-repo.js
// Contrato del Repositorio de Catálogo de Proyectos

/**
 * @typedef {Object} ProjectsCatalogRepo
 * @property {Function} getById - Busca un proyecto por ID
 * @property {Function} getByKey - Busca un proyecto por project_key
 * @property {Function} list - Lista proyectos del catálogo
 * @property {Function} create - Crea un nuevo proyecto en catálogo
 * @property {Function} updateById - Actualiza un proyecto por ID
 * @property {Function} softDelete - Soft delete de un proyecto
 */

export function getById(id) {
  throw new Error('getById debe ser implementado por el repositorio concreto');
}

export function getByKey(projectKey) {
  throw new Error('getByKey debe ser implementado por el repositorio concreto');
}

export function list(options = {}) {
  throw new Error('list debe ser implementado por el repositorio concreto');
}

export function create(data) {
  throw new Error('create debe ser implementado por el repositorio concreto');
}

export function updateById(id, patch) {
  throw new Error('updateById debe ser implementado por el repositorio concreto');
}

export function softDelete(id) {
  throw new Error('softDelete debe ser implementado por el repositorio concreto');
}
