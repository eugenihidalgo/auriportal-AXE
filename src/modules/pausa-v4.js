// src/modules/pausa-v4.js
// Gestión de pausas para AuriPortal v4 (Sovereign Edition)
// PostgreSQL es la ÚNICA fuente de verdad
//
// REFACTOR: Usa PausaRepo en lugar de importar directamente database/pg.js
// El repositorio encapsula todas las queries de pausas.

import getDefaultPausaRepo from "../infra/repos/pausa-repo-pg.js";
import { logInfo, logWarn } from "../core/observability/logger.js";

/**
 * Repositorio de pausas (inyectable para tests)
 * Por defecto usa la implementación PostgreSQL
 */
let pausaRepo = null;

/**
 * Inicializa el repositorio (solo se ejecuta una vez)
 * Permite inyectar un mock en tests
 */
function getPausaRepo() {
  if (!pausaRepo) {
    pausaRepo = getDefaultPausaRepo();
  }
  return pausaRepo;
}

/**
 * Permite inyectar un repositorio mock para tests
 * 
 * @param {Object} repo - Repositorio mock
 */
export function setPausaRepo(repo) {
  pausaRepo = repo;
}

/* -------------------------------------------------------------------------- */
/*                         CONSULTAS DE PAUSAS                                */
/* -------------------------------------------------------------------------- */

/**
 * Busca todas las pausas de un alumno
 * 
 * @param {number} alumnoId - ID del alumno
 * @returns {Promise<Array>} Array de pausas ordenadas por inicio DESC
 */
export async function findByAlumnoId(alumnoId) {
  if (!alumnoId) return [];
  
  const repo = getPausaRepo();
  return await repo.findByAlumnoId(alumnoId);
}

/**
 * Obtiene la pausa activa (sin fin) más reciente de un alumno
 * 
 * @param {number} alumnoId - ID del alumno
 * @returns {Promise<Object|null>} Pausa activa o null si no hay
 */
export async function getPausaActiva(alumnoId) {
  if (!alumnoId) return null;
  
  const repo = getPausaRepo();
  const pausa = await repo.getPausaActiva(alumnoId);
  
  // Log cuando se detecta una pausa activa (solo en dev/beta para no saturar)
  if (pausa) {
    const env = process.env.APP_ENV || 'prod';
    if (env === 'dev' || env === 'beta') {
      logInfo('pausa', 'Pausa activa detectada', {
        alumno_id: alumnoId,
        pausa_id: pausa.id,
        inicio: pausa.inicio ? (pausa.inicio instanceof Date ? pausa.inicio.toISOString() : pausa.inicio) : null
      }, true); // Force log en dev/beta
    }
  }
  
  return pausa;
}

/**
 * Verifica si un alumno tiene una pausa activa
 * 
 * @param {number} alumnoId - ID del alumno
 * @returns {Promise<boolean>} True si tiene pausa activa, false en caso contrario
 */
export async function estaPausada(alumnoId) {
  const pausaActiva = await getPausaActiva(alumnoId);
  return pausaActiva !== null;
}

/**
 * Busca pausas activas (sin fin) de un alumno
 * Helper para compatibilidad con código existente que busca pausas activas
 * 
 * @param {number} alumnoId - ID del alumno
 * @returns {Promise<Array>} Array de pausas activas (normalmente 0 o 1)
 */
export async function findPausasActivas(alumnoId) {
  const todas = await findByAlumnoId(alumnoId);
  return todas.filter(p => p.fin === null);
}

/* -------------------------------------------------------------------------- */
/*                         CREAR Y CERRAR PAUSAS                              */
/* -------------------------------------------------------------------------- */

/**
 * Crea una nueva pausa para un alumno
 * 
 * @param {Object} pausaData - Datos de la pausa
 * @param {number} pausaData.alumno_id - ID del alumno
 * @param {Date|string} [pausaData.inicio] - Fecha de inicio (default: ahora)
 * @param {Date|string|null} [pausaData.fin] - Fecha de fin (default: null para pausa activa)
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Pausa creada
 */
export async function crearPausa(pausaData, client = null) {
  if (!pausaData || !pausaData.alumno_id) {
    throw new Error('crearPausa: se requiere alumno_id');
  }
  
  const repo = getPausaRepo();
  const pausa = await repo.create(pausaData, client);
  
  // Log de creación de pausa
  const inicioStr = pausaData.inicio 
    ? (pausaData.inicio instanceof Date ? pausaData.inicio.toISOString() : pausaData.inicio)
    : new Date().toISOString();
  
  logInfo('pausa', 'Pausa creada', {
    alumno_id: pausaData.alumno_id,
    pausa_id: pausa?.id || null,
    inicio: inicioStr,
    fin: pausaData.fin ? (pausaData.fin instanceof Date ? pausaData.fin.toISOString() : pausaData.fin) : null
  });
  
  return pausa;
}

/**
 * Cierra una pausa activa estableciendo su fecha de fin
 * 
 * @param {number} pausaId - ID de la pausa
 * @param {Date|string} [fechaFin] - Fecha de fin (default: ahora)
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Pausa cerrada
 */
export async function cerrarPausa(pausaId, fechaFin = null, client = null) {
  if (!pausaId) {
    throw new Error('cerrarPausa: se requiere pausaId');
  }
  
  const repo = getPausaRepo();
  const fechaCierre = fechaFin || new Date();
  const pausa = await repo.cerrarPausa(pausaId, fechaCierre, client);
  
  // Log de cierre de pausa
  logInfo('pausa', 'Pausa cerrada', {
    pausa_id: pausaId,
    alumno_id: pausa?.alumno_id || null,
    fin: fechaCierre instanceof Date ? fechaCierre.toISOString() : fechaCierre,
    inicio: pausa?.inicio ? (pausa.inicio instanceof Date ? pausa.inicio.toISOString() : pausa.inicio) : null
  });
  
  return pausa;
}

/**
 * Cierra la pausa activa de un alumno (si existe)
 * Helper de alto nivel que busca y cierra la pausa activa
 * 
 * @param {number} alumnoId - ID del alumno
 * @param {Date|string} [fechaFin] - Fecha de fin (default: ahora)
 * @returns {Promise<Object|null>} Pausa cerrada o null si no había pausa activa
 */
export async function cerrarPausaActiva(alumnoId, fechaFin = null) {
  const pausaActiva = await getPausaActiva(alumnoId);
  if (!pausaActiva) {
    return null;
  }
  
  return await cerrarPausa(pausaActiva.id, fechaFin);
}

/* -------------------------------------------------------------------------- */
/*                         CÁLCULOS DE DÍAS PAUSADOS                          */
/* -------------------------------------------------------------------------- */

/**
 * Calcula el total de días pausados para un alumno
 * Si hay una pausa activa (sin fin), cuenta hasta la fecha actual.
 * 
 * @param {number} alumnoId - ID del alumno
 * @returns {Promise<number>} Total de días pausados (entero)
 */
export async function calcularDiasPausados(alumnoId) {
  if (!alumnoId) return 0;
  
  const repo = getPausaRepo();
  return await repo.calcularDiasPausados(alumnoId);
}

/**
 * Calcula los días pausados hasta una fecha límite específica
 * Útil para calcular días activos en un momento histórico.
 * 
 * @param {number} alumnoId - ID del alumno
 * @param {Date|string} fechaLimite - Fecha límite hasta la cual calcular
 * @returns {Promise<number>} Total de días pausados hasta la fecha límite (entero)
 */
export async function calcularDiasPausadosHastaFecha(alumnoId, fechaLimite) {
  if (!alumnoId || !fechaLimite) return 0;
  
  const repo = getPausaRepo();
  return await repo.calcularDiasPausadosHastaFecha(alumnoId, fechaLimite);
}

/* -------------------------------------------------------------------------- */
/*                         COMPATIBILIDAD CON API ANTIGUA                     */
/* -------------------------------------------------------------------------- */

/**
 * Objeto de compatibilidad para código que aún usa pausas.*
 * Permite migración gradual sin romper código existente
 * 
 * @deprecated Usar funciones exportadas directamente
 */
export const pausas = {
  findByAlumnoId,
  getPausaActiva,
  create: crearPausa,
  cerrarPausa,
  calcularDiasPausados,
  calcularDiasPausadosHastaFecha
};


