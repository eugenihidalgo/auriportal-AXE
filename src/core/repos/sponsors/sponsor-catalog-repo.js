// src/core/repos/sponsors/sponsor-catalog-repo.js
// Contrato del Repositorio de Catálogo de Apadrinados (Sponsors)

/**
 * @typedef {Object} SponsorCatalogRepo
 * @property {Function} getById - Busca un apadrinado por ID
 * @property {Function} list - Lista apadrinados del catálogo
 * @property {Function} create - Crea un nuevo apadrinado
 * @property {Function} update - Actualiza un apadrinado por ID
 * @property {Function} archive - Archiva un apadrinado (status='archived')
 * @property {Function} findByLegacyId - Busca por legacy_id en meta
 */

export function getById(id) {
  throw new Error('getById debe ser implementado por el repositorio concreto');
}

export function list(options = {}) {
  throw new Error('list debe ser implementado por el repositorio concreto');
}

export function create(data) {
  throw new Error('create debe ser implementado por el repositorio concreto');
}

export function update(id, patch) {
  throw new Error('update debe ser implementado por el repositorio concreto');
}

export function archive(id) {
  throw new Error('archive debe ser implementado por el repositorio concreto');
}

export function findByLegacyId(legacyId) {
  throw new Error('findByLegacyId debe ser implementado por el repositorio concreto');
}
