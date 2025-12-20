// src/core/repos/progress-snapshot-repo.js
// Contrato/Interfaz del Repositorio de Snapshots de Progreso
//
// Este archivo define el contrato que debe cumplir cualquier implementación
// del repositorio de snapshots de progreso. Actúa como documentación del comportamiento esperado.
//
// REGLAS DEL CONTRATO:
// - Todas las funciones retornan Promises
// - Retornan null si no se encuentra el recurso (no lanzan excepciones)
// - Retornan objetos completos de snapshot (raw de PostgreSQL) o arrays vacíos
// - Los errores de base de datos se propagan como excepciones
//
// PRINCIPIO: El snapshot es DERIVADO, no fuente de verdad.
// computeProgress() siempre gana si hay discrepancia.

/**
 * @typedef {Object} ProgressSnapshotRepo
 * @property {Function} createSnapshot - Crea un nuevo snapshot de progreso
 * @property {Function} getLatestSnapshot - Obtiene el snapshot más reciente de un alumno
 * @property {Function} listSnapshots - Lista snapshots de un alumno (ordenados por fecha descendente)
 */

/**
 * CONTRATO: createSnapshot(studentId, nivelInfo)
 * 
 * Crea un nuevo snapshot de progreso para un alumno.
 * 
 * @param {number} studentId - ID del alumno
 * @param {Object} nivelInfo - Información de progreso calculada por computeProgress()
 * @param {number} nivelInfo.nivel_base - Nivel base calculado
 * @param {number} nivelInfo.nivel_efectivo - Nivel efectivo (con overrides)
 * @param {Object} nivelInfo.fase_efectiva - Fase efectiva {id, nombre}
 * @param {number} nivelInfo.dias_activos - Días activos
 * @param {number} nivelInfo.dias_pausados - Días pausados
 * @param {Date} [snapshotAt] - Fecha del snapshot (default: ahora)
 * @returns {Promise<Object>} Objeto snapshot creado (raw de PostgreSQL)
 * @throws {Error} Si hay error de conexión, query, o constraint violation
 * 
 * Ejemplo:
 * const snapshot = await repo.createSnapshot(123, {
 *   nivel_base: 5,
 *   nivel_efectivo: 7,
 *   fase_efectiva: { id: 'canalizacion', nombre: 'Canalización' },
 *   dias_activos: 120,
 *   dias_pausados: 10
 * });
 */
export function createSnapshot(studentId, nivelInfo, snapshotAt) {
  throw new Error('createSnapshot debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: getLatestSnapshot(studentId)
 * 
 * Obtiene el snapshot más reciente de un alumno.
 * 
 * @param {number} studentId - ID del alumno
 * @returns {Promise<Object|null>} Objeto snapshot más reciente o null si no existe
 * @throws {Error} Si hay error de conexión o query
 * 
 * Ejemplo:
 * const latest = await repo.getLatestSnapshot(123);
 * if (latest) {
 *   console.log(latest.nivel_efectivo, latest.fase_nombre);
 * }
 */
export function getLatestSnapshot(studentId) {
  throw new Error('getLatestSnapshot debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: listSnapshots(studentId, limit)
 * 
 * Lista snapshots de un alumno, ordenados por fecha descendente (más reciente primero).
 * 
 * @param {number} studentId - ID del alumno
 * @param {number} [limit=100] - Límite de resultados (default: 100)
 * @returns {Promise<Array>} Array de objetos snapshot (raw de PostgreSQL) o array vacío
 * @throws {Error} Si hay error de conexión o query
 * 
 * Ejemplo:
 * const snapshots = await repo.listSnapshots(123, 20);
 * snapshots.forEach(s => console.log(s.snapshot_at, s.nivel_efectivo));
 */
export function listSnapshots(studentId, limit) {
  throw new Error('listSnapshots debe ser implementado por el repositorio concreto');
}













