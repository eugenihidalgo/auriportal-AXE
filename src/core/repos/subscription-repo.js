// src/core/repos/subscription-repo.js
// Contrato/Interfaz del Repositorio de Suscripciones
//
// Este archivo define el contrato que debe cumplir cualquier implementación
// del repositorio de suscripciones. Actúa como documentación del comportamiento esperado.
//
// REGLAS DEL CONTRATO:
// - Todas las funciones retornan Promises
// - Retornan null si no se encuentra el recurso (no lanzan excepciones)
// - Retornan objetos completos de suscripción (raw de PostgreSQL) o null
// - Los errores de base de datos se propagan como excepciones

/**
 * @typedef {Object} SubscriptionRepo
 * @property {Function} getByStudentId - Obtiene el estado de suscripción de un alumno
 * @property {Function} getByStudentEmail - Obtiene el estado de suscripción de un alumno por email
 * @property {Function} ensureDefault - Asegura que existe un registro con estado 'active' (crea si no existe)
 * @property {Function} updateStatus - Actualiza el estado de suscripción de un alumno
 */

/**
 * CONTRATO: getByStudentId(studentId)
 * 
 * Obtiene el estado de suscripción de un alumno desde la tabla alumnos.
 * 
 * @param {number} studentId - ID del alumno
 * @returns {Promise<Object|null>} Objeto con estado_suscripcion o null si no existe el alumno
 * @throws {Error} Si hay error de conexión o query a la base de datos
 * 
 * Ejemplo:
 * const sub = await repo.getByStudentId(123);
 * if (sub) {
 *   console.log('Estado:', sub.estado_suscripcion);
 * }
 */
export function getByStudentId(studentId) {
  throw new Error('getByStudentId debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: getByStudentEmail(email)
 * 
 * Obtiene el estado de suscripción de un alumno por email.
 * 
 * @param {string} email - Email del alumno
 * @returns {Promise<Object|null>} Objeto con estado_suscripcion o null si no existe el alumno
 * @throws {Error} Si hay error de conexión o query a la base de datos
 * 
 * Ejemplo:
 * const sub = await repo.getByStudentEmail('alumno@ejemplo.com');
 * if (sub) {
 *   console.log('Estado:', sub.estado_suscripcion);
 * }
 */
export function getByStudentEmail(email) {
  throw new Error('getByStudentEmail debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: ensureDefault(studentId, client)
 * 
 * Asegura que existe un registro con estado 'activa' para el alumno.
 * Si el alumno no existe, retorna null (no crea alumno).
 * Si existe pero estado_suscripcion es NULL, lo establece a 'activa'.
 * 
 * @param {number} studentId - ID del alumno
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object|null>} Objeto alumno actualizado o null si no existe
 * @throws {Error} Si hay error de conexión o query
 * 
 * Ejemplo:
 * const alumno = await repo.ensureDefault(123);
 * // Garantiza que estado_suscripcion = 'activa' (sin romper onboarding)
 */
export function ensureDefault(studentId, client) {
  throw new Error('ensureDefault debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: updateStatus(studentId, status, fechaReactivacion, client)
 * 
 * Actualiza el estado de suscripción de un alumno.
 * 
 * @param {number} studentId - ID del alumno
 * @param {string} status - Nuevo estado ('activa', 'pausada', 'cancelada', 'past_due')
 * @param {Date|string|null} fechaReactivacion - Fecha de reactivación (opcional)
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object|null>} Objeto alumno actualizado o null si no existe
 * @throws {Error} Si hay error de conexión o query
 * 
 * Ejemplo:
 * const alumno = await repo.updateStatus(123, 'pausada', null);
 */
export function updateStatus(studentId, status, fechaReactivacion, client) {
  throw new Error('updateStatus debe ser implementado por el repositorio concreto');
}













