// src/core/repos/pausa-repo.js
// Contrato/Interfaz del Repositorio de Pausas
//
// Este archivo define el contrato que debe cumplir cualquier implementación
// del repositorio de pausas. Actúa como documentación del comportamiento esperado.
//
// REGLAS DEL CONTRATO:
// - Todas las funciones retornan Promises
// - Retornan null si no se encuentra el recurso (no lanzan excepciones)
// - Retornan objetos completos de pausa (raw de PostgreSQL) o arrays vacíos
// - Los errores de base de datos se propagan como excepciones

/**
 * @typedef {Object} PausaRepo
 * @property {Function} findByAlumnoId - Busca todas las pausas de un alumno
 * @property {Function} getPausaActiva - Obtiene la pausa activa (sin fin) de un alumno
 * @property {Function} create - Crea una nueva pausa
 * @property {Function} cerrarPausa - Cierra una pausa poniendo fecha de fin
 * @property {Function} calcularDiasPausados - Calcula el total de días pausados de un alumno
 * @property {Function} calcularDiasPausadosHastaFecha - Calcula días pausados hasta una fecha específica
 */

/**
 * CONTRATO: findByAlumnoId(alumnoId)
 * 
 * Busca todas las pausas de un alumno, ordenadas por fecha de inicio descendente.
 * 
 * @param {number} alumnoId - ID del alumno
 * @returns {Promise<Array>} Array de objetos pausa (raw de PostgreSQL) o array vacío
 * @throws {Error} Si hay error de conexión o query a la base de datos
 * 
 * Ejemplo:
 * const pausas = await repo.findByAlumnoId(123);
 * pausas.forEach(p => console.log(p.inicio, p.fin));
 */
export function findByAlumnoId(alumnoId) {
  throw new Error('findByAlumnoId debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: getPausaActiva(alumnoId)
 * 
 * Obtiene la pausa activa (sin fin) más reciente de un alumno.
 * 
 * @param {number} alumnoId - ID del alumno
 * @returns {Promise<Object|null>} Objeto pausa (raw de PostgreSQL) o null si no hay pausa activa
 * @throws {Error} Si hay error de conexión o query a la base de datos
 * 
 * Ejemplo:
 * const pausaActiva = await repo.getPausaActiva(123);
 * if (pausaActiva) {
 *   console.log('Pausa activa desde:', pausaActiva.inicio);
 * }
 */
export function getPausaActiva(alumnoId) {
  throw new Error('getPausaActiva debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: create(pausaData)
 * 
 * Crea una nueva pausa para un alumno.
 * 
 * @param {Object} pausaData - Datos de la pausa
 * @param {number} pausaData.alumno_id - ID del alumno
 * @param {Date|string} [pausaData.inicio] - Fecha de inicio (default: ahora)
 * @param {Date|string|null} [pausaData.fin] - Fecha de fin (default: null para pausa activa)
 * @returns {Promise<Object>} Objeto pausa creado (raw de PostgreSQL)
 * @throws {Error} Si hay error de conexión, query, o constraint violation
 * 
 * Ejemplo:
 * const nuevaPausa = await repo.create({
 *   alumno_id: 123,
 *   inicio: new Date(),
 *   fin: null
 * });
 */
export function create(pausaData) {
  throw new Error('create debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: cerrarPausa(pausaId, fechaFin)
 * 
 * Cierra una pausa estableciendo su fecha de fin.
 * 
 * @param {number} pausaId - ID de la pausa
 * @param {Date|string} fechaFin - Fecha de fin de la pausa
 * @returns {Promise<Object>} Objeto pausa actualizado (raw de PostgreSQL)
 * @throws {Error} Si hay error de conexión o query
 * 
 * Ejemplo:
 * const pausaCerrada = await repo.cerrarPausa(456, new Date());
 */
export function cerrarPausa(pausaId, fechaFin) {
  throw new Error('cerrarPausa debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: calcularDiasPausados(alumnoId)
 * 
 * Calcula el total de días pausados para un alumno.
 * Si hay una pausa activa (sin fin), cuenta hasta la fecha actual.
 * 
 * @param {number} alumnoId - ID del alumno
 * @returns {Promise<number>} Total de días pausados (entero)
 * @throws {Error} Si hay error de conexión o query
 * 
 * Ejemplo:
 * const diasPausados = await repo.calcularDiasPausados(123);
 * console.log(`Alumno ha estado pausado ${diasPausados} días`);
 */
export function calcularDiasPausados(alumnoId) {
  throw new Error('calcularDiasPausados debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: calcularDiasPausadosHastaFecha(alumnoId, fechaLimite)
 * 
 * Calcula los días pausados hasta una fecha límite específica.
 * Útil para calcular días activos en un momento histórico.
 * 
 * @param {number} alumnoId - ID del alumno
 * @param {Date|string} fechaLimite - Fecha límite hasta la cual calcular
 * @returns {Promise<number>} Total de días pausados hasta la fecha límite (entero)
 * @throws {Error} Si hay error de conexión o query
 * 
 * Ejemplo:
 * const diasPausados = await repo.calcularDiasPausadosHastaFecha(123, new Date('2024-01-01'));
 * console.log(`Días pausados hasta 2024-01-01: ${diasPausados}`);
 */
export function calcularDiasPausadosHastaFecha(alumnoId, fechaLimite) {
  throw new Error('calcularDiasPausadosHastaFecha debe ser implementado por el repositorio concreto');
}


