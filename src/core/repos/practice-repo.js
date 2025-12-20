// src/core/repos/practice-repo.js
// Contrato/Interfaz del Repositorio de Prácticas
//
// Este archivo define el contrato que debe cumplir cualquier implementación
// del repositorio de prácticas. Actúa como documentación del comportamiento esperado.
//
// REGLAS DEL CONTRATO:
// - Todas las funciones retornan Promises
// - Retornan null si no se encuentra el recurso (no lanzan excepciones)
// - Retornan objetos completos de práctica (raw de PostgreSQL) o arrays vacíos
// - Los errores de base de datos se propagan como excepciones

/**
 * @typedef {Object} PracticeRepo
 * @property {Function} findByAlumnoId - Busca prácticas de un alumno
 * @property {Function} create - Crea una nueva práctica
 * @property {Function} existsForDate - Verifica si existe práctica en una fecha
 * @property {Function} countByAlumnoId - Cuenta total de prácticas de un alumno
 */

/**
 * CONTRATO: findByAlumnoId(alumnoId, limit)
 * 
 * Busca prácticas de un alumno, ordenadas por fecha descendente.
 * 
 * @param {number} alumnoId - ID del alumno
 * @param {number} [limit=100] - Límite de resultados (default: 100)
 * @returns {Promise<Array>} Array de objetos práctica (raw de PostgreSQL) o array vacío
 * @throws {Error} Si hay error de conexión o query a la base de datos
 * 
 * Ejemplo:
 * const practicas = await repo.findByAlumnoId(123, 20);
 * practicas.forEach(p => console.log(p.fecha, p.tipo));
 */
export function findByAlumnoId(alumnoId, limit) {
  throw new Error('findByAlumnoId debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: create(practicaData)
 * 
 * Crea una nueva práctica para un alumno.
 * 
 * @param {Object} practicaData - Datos de la práctica
 * @param {number} practicaData.alumno_id - ID del alumno
 * @param {Date|string} [practicaData.fecha] - Fecha de la práctica (default: ahora)
 * @param {string} [practicaData.tipo] - Tipo de práctica (default: null)
 * @param {string} [practicaData.origen] - Origen de la práctica (default: null)
 * @param {number|null} [practicaData.duracion] - Duración en minutos (default: null)
 * @param {number|null} [practicaData.aspecto_id] - ID del aspecto (default: null)
 * @returns {Promise<Object>} Objeto práctica creado (raw de PostgreSQL)
 * @throws {Error} Si hay error de conexión, query, o constraint violation
 * 
 * Ejemplo:
 * const nuevaPractica = await repo.create({
 *   alumno_id: 123,
 *   fecha: new Date(),
 *   tipo: 'general',
 *   origen: 'portal',
 *   duracion: 15
 * });
 */
export function create(practicaData) {
  throw new Error('create debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: existsForDate(alumnoId, fecha, aspectoId)
 * 
 * Verifica si existe una práctica para un alumno en una fecha específica.
 * Opcionalmente puede filtrar por aspecto_id.
 * 
 * @param {number} alumnoId - ID del alumno
 * @param {Date|string} fecha - Fecha a verificar (se busca en el rango del día completo)
 * @param {number|null} [aspectoId] - ID del aspecto (opcional, default: null)
 * @returns {Promise<Object|null>} Objeto práctica encontrado o null si no existe
 * @throws {Error} Si hay error de conexión o query
 * 
 * Ejemplo:
 * const practica = await repo.existsForDate(123, new Date('2024-01-15'), 5);
 * if (practica) {
 *   console.log('Ya practicó este aspecto hoy');
 * }
 */
export function existsForDate(alumnoId, fecha, aspectoId) {
  throw new Error('existsForDate debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: countByAlumnoId(alumnoId)
 * 
 * Cuenta el total de prácticas de un alumno.
 * 
 * @param {number} alumnoId - ID del alumno
 * @returns {Promise<number>} Total de prácticas (entero)
 * @throws {Error} Si hay error de conexión o query
 * 
 * Ejemplo:
 * const total = await repo.countByAlumnoId(123);
 * console.log(`Alumno tiene ${total} prácticas`);
 */
export function countByAlumnoId(alumnoId) {
  throw new Error('countByAlumnoId debe ser implementado por el repositorio concreto');
}















