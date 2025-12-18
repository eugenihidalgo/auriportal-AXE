// src/modules/practice-v4.js
// Gestión de prácticas para AuriPortal v4 (Sovereign Edition)
// PostgreSQL es la ÚNICA fuente de verdad
//
// REFACTOR: Usa PracticeRepo en lugar de importar directamente database/pg.js
// El repositorio encapsula todas las queries de prácticas.

import { getDefaultPracticeRepo } from "../infra/repos/practice-repo-pg.js";
import { logInfo, logWarn } from "../core/observability/logger.js";

/**
 * Repositorio de prácticas (inyectable para tests)
 * Por defecto usa la implementación PostgreSQL
 */
let practiceRepo = null;

/**
 * Inicializa el repositorio (solo se ejecuta una vez)
 * Permite inyectar un mock en tests
 */
function getPracticeRepo() {
  if (!practiceRepo) {
    practiceRepo = getDefaultPracticeRepo();
  }
  return practiceRepo;
}

/**
 * Permite inyectar un repositorio mock para tests
 * 
 * @param {Object} repo - Repositorio mock
 */
export function setPracticeRepo(repo) {
  practiceRepo = repo;
}

/* -------------------------------------------------------------------------- */
/*                         CONSULTAS DE PRÁCTICAS                             */
/* -------------------------------------------------------------------------- */

/**
 * Busca prácticas de un alumno
 * 
 * @param {number} alumnoId - ID del alumno
 * @param {number} [limit=100] - Límite de resultados (default: 100)
 * @returns {Promise<Array>} Array de prácticas ordenadas por fecha DESC
 */
export async function findByAlumnoId(alumnoId, limit = 100) {
  if (!alumnoId) return [];
  
  const repo = getPracticeRepo();
  return await repo.findByAlumnoId(alumnoId, limit);
}

/**
 * Cuenta el total de prácticas de un alumno
 * 
 * @param {number} alumnoId - ID del alumno
 * @returns {Promise<number>} Total de prácticas (entero)
 */
export async function countByAlumnoId(alumnoId) {
  if (!alumnoId) return 0;
  
  const repo = getPracticeRepo();
  return await repo.countByAlumnoId(alumnoId);
}

/* -------------------------------------------------------------------------- */
/*                         CREAR PRÁCTICAS                                    */
/* -------------------------------------------------------------------------- */

/**
 * Crea una nueva práctica para un alumno
 * 
 * @param {Object} practicaData - Datos de la práctica
 * @param {number} practicaData.alumno_id - ID del alumno
 * @param {Date|string} [practicaData.fecha] - Fecha de la práctica (default: ahora)
 * @param {string} [practicaData.tipo] - Tipo de práctica (default: null)
 * @param {string} [practicaData.origen] - Origen de la práctica (default: null)
 * @param {number|null} [practicaData.duracion] - Duración en minutos (default: null)
 * @param {number|null} [practicaData.aspecto_id] - ID del aspecto (default: null)
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Práctica creada
 */
export async function crearPractica(practicaData, client = null) {
  if (!practicaData || !practicaData.alumno_id) {
    throw new Error('crearPractica: se requiere alumno_id');
  }
  
  const repo = getPracticeRepo();
  const practica = await repo.create(practicaData, client);
  
  // Log de creación de práctica
  const fechaStr = practicaData.fecha 
    ? (practicaData.fecha instanceof Date ? practicaData.fecha.toISOString() : practicaData.fecha)
    : new Date().toISOString();
  
  logInfo('practice', 'Práctica creada', {
    alumno_id: practicaData.alumno_id,
    practica_id: practica?.id || null,
    fecha: fechaStr,
    tipo: practicaData.tipo || null,
    origen: practicaData.origen || null,
    duracion: practicaData.duracion || null
  });
  
  return practica;
}

/* -------------------------------------------------------------------------- */
/*                         HELPERS DE VERIFICACIÓN                            */
/* -------------------------------------------------------------------------- */

/**
 * Verifica si existe una práctica para un alumno en una fecha específica
 * 
 * @param {number} alumnoId - ID del alumno
 * @param {Date|string} fecha - Fecha a verificar
 * @param {number|null} [aspectoId] - ID del aspecto (opcional)
 * @returns {Promise<Object|null>} Práctica encontrada o null si no existe
 */
export async function existsForDate(alumnoId, fecha, aspectoId = null) {
  if (!alumnoId || !fecha) return null;
  
  const repo = getPracticeRepo();
  const practica = await repo.existsForDate(alumnoId, fecha, aspectoId);
  
  // Log de detección de práctica duplicada
  if (practica) {
    const fechaStr = fecha instanceof Date ? fecha.toISOString() : fecha;
    logWarn('practice', 'Práctica duplicada detectada', {
      alumno_id: alumnoId,
      practica_id: practica.id,
      fecha: fechaStr,
      aspecto_id: aspectoId
    });
  }
  
  return practica;
}

/**
 * Verifica si un alumno ha practicado hoy
 * Helper de alto nivel que verifica si existe práctica en la fecha actual
 * 
 * @param {number} alumnoId - ID del alumno
 * @param {number|null} [aspectoId] - ID del aspecto (opcional)
 * @returns {Promise<boolean>} True si ha practicado hoy, false en caso contrario
 */
export async function haPracticadoHoy(alumnoId, aspectoId = null) {
  const practica = await existsForDate(alumnoId, new Date(), aspectoId);
  return practica !== null;
}

/* -------------------------------------------------------------------------- */
/*                         COMPATIBILIDAD CON API ANTIGUA                     */
/* -------------------------------------------------------------------------- */

/**
 * Objeto de compatibilidad para código que aún usa practicas.*
 * Permite migración gradual sin romper código existente
 * 
 * @deprecated Usar funciones exportadas directamente
 */
export const practicas = {
  findByAlumnoId,
  create: crearPractica,
  existsForDate,
  countByAlumnoId
};













