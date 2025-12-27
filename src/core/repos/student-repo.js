// src/core/repos/student-repo.js
// Contrato/Interfaz del Repositorio de Alumnos
//
// Este archivo define el contrato que debe cumplir cualquier implementación
// del repositorio de alumnos. Actúa como documentación del comportamiento esperado.
//
// REGLAS DEL CONTRATO:
// - Todas las funciones retornan Promises
// - Retornan null si no se encuentra el recurso (no lanzan excepciones)
// - Retornan el objeto completo del alumno (raw de PostgreSQL) o null
// - Las funciones de actualización retornan el objeto actualizado
// - Los errores de base de datos se propagan como excepciones

/**
 * @typedef {Object} StudentRepo
 * @property {Function} getByEmail - Busca un alumno por email
 * @property {Function} getById - Busca un alumno por ID
 * @property {Function} create - Crea un nuevo alumno
 * @property {Function} updateById - Actualiza un alumno por ID
 * @property {Function} upsertByEmail - Crea o actualiza un alumno por email
 * @property {Function} updateNivel - Actualiza el nivel de un alumno por email
 * @property {Function} updateStreak - Actualiza el streak de un alumno por email
 * @property {Function} updateUltimaPractica - Actualiza la última práctica por email
 * @property {Function} updateEstadoSuscripcion - Actualiza el estado de suscripción por email
 */

/**
 * CONTRATO: getByEmail(email)
 * 
 * Busca un alumno por email (normalizado a lowercase.trim).
 * 
 * @param {string} email - Email del alumno
 * @returns {Promise<Object|null>} Objeto alumno completo (raw de PostgreSQL) o null si no existe
 * @throws {Error} Si hay error de conexión o query a la base de datos
 * 
 * Ejemplo:
 * const alumno = await repo.getByEmail('usuario@example.com');
 * if (alumno) {
 *   console.log(alumno.id, alumno.email, alumno.nivel_actual);
 * }
 */
export function getByEmail(email) {
  throw new Error('getByEmail debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: getById(id)
 * 
 * Busca un alumno por ID.
 * 
 * @param {number} id - ID del alumno
 * @returns {Promise<Object|null>} Objeto alumno completo (raw de PostgreSQL) o null si no existe
 * @throws {Error} Si hay error de conexión o query a la base de datos
 * 
 * Ejemplo:
 * const alumno = await repo.getById(123);
 * if (alumno) {
 *   console.log(alumno.email, alumno.estado_suscripcion);
 * }
 */
export function getById(id) {
  throw new Error('getById debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: create(data)
 * 
 * Crea un nuevo alumno. Si el email ya existe, puede lanzar error o hacer upsert
 * (depende de la implementación).
 * 
 * @param {Object} data - Datos del alumno
 * @param {string} data.email - Email (será normalizado)
 * @param {string} [data.apodo] - Apodo del alumno
 * @param {Date} [data.fecha_inscripcion] - Fecha de inscripción
 * @param {Date} [data.fecha_ultima_practica] - Fecha de última práctica
 * @param {number} [data.nivel_actual] - Nivel actual (default: 1)
 * @param {number} [data.nivel_manual] - Nivel manual (opcional)
 * @param {number} [data.streak] - Racha actual (default: 0)
 * @param {string} [data.estado_suscripcion] - Estado de suscripción (default: 'activa')
 * @param {Date} [data.fecha_reactivacion] - Fecha de reactivación (opcional)
 * @returns {Promise<Object>} Objeto alumno creado (raw de PostgreSQL)
 * @throws {Error} Si hay error de conexión, query, o constraint violation
 * 
 * Ejemplo:
 * const nuevoAlumno = await repo.create({
 *   email: 'nuevo@example.com',
 *   apodo: 'Usuario Nuevo',
 *   nivel_actual: 1,
 *   streak: 0
 * });
 */
export function create(data) {
  throw new Error('create debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: updateById(id, patch)
 * 
 * Actualiza un alumno por ID. Solo actualiza los campos proporcionados en patch.
 * 
 * @param {number} id - ID del alumno
 * @param {Object} patch - Campos a actualizar (parcial)
 * @returns {Promise<Object|null>} Objeto alumno actualizado o null si no existe
 * @throws {Error} Si hay error de conexión o query
 * 
 * Ejemplo:
 * const actualizado = await repo.updateById(123, {
 *   nivel_actual: 5,
 *   streak: 10
 * });
 */
export function updateById(id, patch) {
  throw new Error('updateById debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: upsertByEmail(email, data)
 * 
 * Crea o actualiza un alumno por email (INSERT ... ON CONFLICT DO UPDATE).
 * Si el email existe, actualiza; si no existe, crea.
 * 
 * @param {string} email - Email del alumno (será normalizado)
 * @param {Object} data - Datos del alumno (mismos campos que create)
 * @returns {Promise<Object>} Objeto alumno creado/actualizado (raw de PostgreSQL)
 * @throws {Error} Si hay error de conexión o query
 * 
 * Ejemplo:
 * const alumno = await repo.upsertByEmail('usuario@example.com', {
 *   apodo: 'Nuevo Apodo',
 *   nivel_actual: 3
 * });
 */
export function upsertByEmail(email, data) {
  throw new Error('upsertByEmail debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: updateNivel(email, nivel)
 * 
 * Actualiza el nivel_actual de un alumno por email.
 * 
 * @param {string} email - Email del alumno (será normalizado)
 * @param {number} nivel - Nuevo nivel
 * @returns {Promise<Object|null>} Objeto alumno actualizado o null si no existe
 * @throws {Error} Si hay error de conexión o query
 * 
 * Ejemplo:
 * const actualizado = await repo.updateNivel('usuario@example.com', 5);
 */
export function updateNivel(email, nivel) {
  throw new Error('updateNivel debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: updateStreak(email, streak)
 * 
 * Actualiza el streak de un alumno por email.
 * 
 * @param {string} email - Email del alumno (será normalizado)
 * @param {number} streak - Nuevo streak
 * @returns {Promise<Object|null>} Objeto alumno actualizado o null si no existe
 * @throws {Error} Si hay error de conexión o query
 * 
 * Ejemplo:
 * const actualizado = await repo.updateStreak('usuario@example.com', 7);
 */
export function updateStreak(email, streak) {
  throw new Error('updateStreak debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: updateUltimaPractica(email, fecha)
 * 
 * Actualiza la fecha_ultima_practica de un alumno por email.
 * 
 * @param {string} email - Email del alumno (será normalizado)
 * @param {Date|string} fecha - Fecha de última práctica
 * @returns {Promise<Object|null>} Objeto alumno actualizado o null si no existe
 * @throws {Error} Si hay error de conexión o query
 * 
 * Ejemplo:
 * const actualizado = await repo.updateUltimaPractica('usuario@example.com', new Date());
 */
export function updateUltimaPractica(email, fecha) {
  throw new Error('updateUltimaPractica debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: updateEstadoSuscripcion(email, estado, fechaReactivacion)
 * 
 * Actualiza el estado_suscripcion y opcionalmente fecha_reactivacion de un alumno por email.
 * 
 * @param {string} email - Email del alumno (será normalizado)
 * @param {string} estado - Nuevo estado ('activa', 'pausada', 'cancelada')
 * @param {Date|string|null} [fechaReactivacion] - Fecha de reactivación (opcional)
 * @returns {Promise<Object|null>} Objeto alumno actualizado o null si no existe
 * @throws {Error} Si hay error de conexión o query
 * 
 * Ejemplo:
 * const actualizado = await repo.updateEstadoSuscripcion(
 *   'usuario@example.com',
 *   'pausada',
 *   null
 * );
 */
export function updateEstadoSuscripcion(email, estado, fechaReactivacion = null) {
  throw new Error('updateEstadoSuscripcion debe ser implementado por el repositorio concreto');
}






















