// src/core/repos/place-catalog-repo.js
// Contrato del Repositorio de Catálogo de Lugares

/**
 * @typedef {Object} PlaceCatalogRepo
 * @property {Function} getById - Busca un lugar por ID
 * @property {Function} getByKey - Busca un lugar por place_key
 * @property {Function} list - Lista lugares del catálogo
 * @property {Function} create - Crea un nuevo lugar en el catálogo
 * @property {Function} updateById - Actualiza un lugar por ID
 * @property {Function} softDelete - Soft delete de un lugar
 */

export function getById(id) {
  throw new Error('getById debe ser implementado por el repositorio concreto');
}

export function getByKey(placeKey) {
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
