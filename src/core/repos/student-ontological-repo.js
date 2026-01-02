// src/core/repos/student-ontological-repo.js
// Contrato del Repositorio de Estado Ontológico del Alumno
//
// Este archivo define el contrato que debe cumplir cualquier implementación
// del repositorio de estado ontológico (students).

/**
 * @typedef {Object} StudentOntologicalRepo
 * @property {Function} getById - Busca un student por ID
 * @property {Function} getByLegacyAlumnoId - Busca un student por legacy_alumno_id
 * @property {Function} create - Crea un nuevo student
 * @property {Function} updateStatus - Actualiza el status ontológico
 * @property {Function} softDelete - Soft delete (marca deleted_at)
 */

/**
 * CONTRATO: getById(studentId, client)
 *
 * @param {string} studentId - UUID del student
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object|null>} Objeto student completo o null si no existe
 */
export function getById(studentId, client = null) {
  throw new Error('getById debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: getByLegacyAlumnoId(legacyAlumnoId, client)
 *
 * @param {number} legacyAlumnoId - ID de la tabla alumnos legacy
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object|null>} Objeto student completo o null si no existe
 */
export function getByLegacyAlumnoId(legacyAlumnoId, client = null) {
  throw new Error('getByLegacyAlumnoId debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: create(studentData, client)
 *
 * @param {Object} studentData - Datos del student
 * @param {number} [studentData.legacy_alumno_id] - ID legacy (opcional)
 * @param {string} [studentData.status] - Status ontológico (default: 'NORMAL')
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Objeto student creado
 */
export function create(studentData, client = null) {
  throw new Error('create debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: updateStatus(studentId, status, client)
 *
 * @param {string} studentId - UUID del student
 * @param {string} status - Nuevo status ('NORMAL', 'DEGRADED', 'BROKEN')
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object|null>} Objeto student actualizado o null si no existe
 */
export function updateStatus(studentId, status, client = null) {
  throw new Error('updateStatus debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: softDelete(studentId, client)
 *
 * @param {string} studentId - UUID del student
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object|null>} Objeto student con deleted_at o null si no existe
 */
export function softDelete(studentId, client = null) {
  throw new Error('softDelete debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: getMeta(studentId, client)
 *
 * Obtiene el objeto meta de un alumno.
 *
 * @param {string} studentId - UUID del alumno
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Objeto meta (default {})
 * @throws {Error} Si hay error de conexión o query
 */
export function getMeta(studentId, client = null) {
  throw new Error('getMeta debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: setMeta(studentId, meta, client)
 *
 * Establece el objeto meta de un alumno (merge con existente).
 *
 * @param {string} studentId - UUID del alumno
 * @param {Object} meta - Objeto meta a establecer (se hace merge)
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Objeto meta actualizado
 * @throws {Error} Si hay error de conexión o query
 */
export function setMeta(studentId, meta, client = null) {
  throw new Error('setMeta debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: getFeatureFlags(studentId, client)
 *
 * Obtiene los feature flags de un alumno.
 *
 * @param {string} studentId - UUID del alumno
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Objeto feature_flags (default {})
 * @throws {Error} Si hay error de conexión o query
 */
export function getFeatureFlags(studentId, client = null) {
  throw new Error('getFeatureFlags debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: setFeatureFlags(studentId, flags, client)
 *
 * Establece los feature flags de un alumno (merge con existente).
 *
 * @param {string} studentId - UUID del alumno
 * @param {Object} flags - Objeto feature_flags a establecer (se hace merge)
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Objeto feature_flags actualizado
 * @throws {Error} Si hay error de conexión o query
 */
export function setFeatureFlags(studentId, flags, client = null) {
  throw new Error('setFeatureFlags debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: getExperiments(studentId, client)
 *
 * Obtiene los experiments de un alumno.
 *
 * @param {string} studentId - UUID del alumno
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Objeto experiments (default {})
 * @throws {Error} Si hay error de conexión o query
 */
export function getExperiments(studentId, client = null) {
  throw new Error('getExperiments debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: setExperiments(studentId, experiments, client)
 *
 * Establece los experiments de un alumno (merge con existente).
 *
 * @param {string} studentId - UUID del alumno
 * @param {Object} experiments - Objeto experiments a establecer (se hace merge)
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Objeto experiments actualizado
 * @throws {Error} Si hay error de conexión o query
 */
export function setExperiments(studentId, experiments, client = null) {
  throw new Error('setExperiments debe ser implementado por el repositorio concreto');
}

