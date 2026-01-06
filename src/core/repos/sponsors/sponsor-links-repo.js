// src/core/repos/sponsors/sponsor-links-repo.js
// Contrato del Repositorio de Vínculos Sponsor-Student

/**
 * @typedef {Object} SponsorLinksRepo
 * @property {Function} link - Crea un vínculo sponsor-student
 * @property {Function} unlink - Elimina un vínculo (soft delete)
 * @property {Function} listBySponsor - Lista vínculos de un sponsor
 * @property {Function} listByStudent - Lista vínculos de un student
 * @property {Function} unlinkAllForStudent - Elimina todos los vínculos de un student
 * @property {Function} countActiveLinks - Cuenta vínculos activos de un sponsor
 */

export function link(sponsorId, studentId) {
  throw new Error('link debe ser implementado por el repositorio concreto');
}

export function unlink(sponsorId, studentId) {
  throw new Error('unlink debe ser implementado por el repositorio concreto');
}

export function listBySponsor(sponsorId) {
  throw new Error('listBySponsor debe ser implementado por el repositorio concreto');
}

export function listByStudent(studentId) {
  throw new Error('listByStudent debe ser implementado por el repositorio concreto');
}

export function unlinkAllForStudent(studentId) {
  throw new Error('unlinkAllForStudent debe ser implementado por el repositorio concreto');
}

export function countActiveLinks(sponsorId) {
  throw new Error('countActiveLinks debe ser implementado por el repositorio concreto');
}
