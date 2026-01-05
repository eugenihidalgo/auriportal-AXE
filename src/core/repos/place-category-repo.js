// src/core/repos/place-category-repo.js
// Contrato del Repositorio de Categorías de Lugares

/**
 * @typedef {Object} PlaceCategoryRepo
 * @property {Function} getById - Busca una categoría por ID
 * @property {Function} getByKey - Busca una categoría por category_key
 * @property {Function} list - Lista todas las categorías activas
 * @property {Function} create - Crea una nueva categoría
 * @property {Function} updateById - Actualiza una categoría por ID
 * @property {Function} softDelete - Soft delete de una categoría
 * @property {Function} reorder - Reordena categorías
 */

export function getById(id) {
  throw new Error('getById debe ser implementado por el repositorio concreto');
}

export function getByKey(categoryKey) {
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

export function reorder(categoryIds) {
  throw new Error('reorder debe ser implementado por el repositorio concreto');
}
