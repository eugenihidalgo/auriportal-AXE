// src/core/repos/sponsors/sponsor-special-care-repo.js
// Contrato del Repositorio de Cuidados Especiales

/**
 * @typedef {Object} SponsorSpecialCareRepo
 * @property {Function} createCare - Crea un cuidado especial
 * @property {Function} updateCare - Actualiza un cuidado especial
 * @property {Function} endCare - Finaliza un cuidado especial
 * @property {Function} listActiveCareBySponsor - Lista cuidados activos de un sponsor
 * @property {Function} listQueue - Lista cola de cuidados (por horizonte)
 * @property {Function} setCareLists - Asocia listas de alquimia a un cuidado
 * @property {Function} getCareLists - Obtiene listas asociadas a un cuidado
 * @property {Function} getCareById - Obtiene un cuidado por ID
 */

export function createCare(data) {
  throw new Error('createCare debe ser implementado por el repositorio concreto');
}

export function updateCare(careId, patch) {
  throw new Error('updateCare debe ser implementado por el repositorio concreto');
}

export function endCare(careId) {
  throw new Error('endCare debe ser implementado por el repositorio concreto');
}

export function listActiveCareBySponsor(sponsorId, now) {
  throw new Error('listActiveCareBySponsor debe ser implementado por el repositorio concreto');
}

export function listQueue(options = {}) {
  throw new Error('listQueue debe ser implementado por el repositorio concreto');
}

export function setCareLists(careId, listIds) {
  throw new Error('setCareLists debe ser implementado por el repositorio concreto');
}

export function getCareLists(careId) {
  throw new Error('getCareLists debe ser implementado por el repositorio concreto');
}

export function getCareById(careId) {
  throw new Error('getCareById debe ser implementado por el repositorio concreto');
}
