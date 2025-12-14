// src/core/observability/logger.js
// Sistema centralizado de logging para AuriPortal v4
// Proporciona logs estructurados por dominio con trazabilidad de alumnos
// Incluye correlación automática por request_id

import { getRequestId } from './request-context.js';

/**
 * Niveles de log disponibles
 */
const LOG_LEVELS = {
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
};

/**
 * Configuración de verbosidad por entorno
 */
const VERBOSITY_CONFIG = {
  dev: {
    info: true,
    warn: true,
    error: true
  },
  beta: {
    info: true,  // Info críticos solo
    warn: true,
    error: true
  },
  prod: {
    info: false,  // Info solo si se fuerza explícitamente
    warn: true,
    error: true
  }
};

/**
 * Obtiene la configuración de verbosidad según el entorno
 */
function getVerbosityConfig() {
  const env = process.env.APP_ENV || 'prod';
  return VERBOSITY_CONFIG[env] || VERBOSITY_CONFIG.prod;
}

/**
 * Verifica si un nivel de log debe mostrarse según el entorno
 */
function shouldLog(level, force = false) {
  if (force) return true;
  
  const config = getVerbosityConfig();
  return config[level] === true;
}

/**
 * Crea un log estructurado
 * 
 * @param {string} level - Nivel de log (info, warn, error)
 * @param {string} domain - Dominio del log (student, practice, pausa, streak, etc.)
 * @param {string} message - Mensaje descriptivo
 * @param {Object} meta - Metadatos opcionales (alumno_id, email, nivel, streak, etc.)
 * @param {boolean} force - Forzar log incluso si el entorno no lo permite (solo para info)
 */
function createLog(level, domain, message, meta = {}, force = false) {
  if (!shouldLog(level, force)) {
    return; // No loguear si el entorno no lo permite
  }

  // Obtener request_id del contexto actual (si existe)
  const requestId = getRequestId();

  const logEntry = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    domain: domain,
    message: message,
    env: process.env.APP_ENV || 'prod',
    version: process.env.APP_VERSION || '4.0.0',
    build: process.env.BUILD_ID || 'unknown',
    ...(requestId && { request_id: requestId }), // Incluir request_id solo si existe
    ...meta
  };

  // Formato de salida según nivel
  const prefix = {
    info: 'ℹ️',
    warn: '⚠️',
    error: '❌'
  }[level] || '📝';

  // Log estructurado en JSON (mejor para parsing)
  console.log(JSON.stringify(logEntry));

  // También mostrar formato legible en consola (solo en dev/beta)
  const env = process.env.APP_ENV || 'prod';
  if (env === 'dev' || env === 'beta') {
    const metaStr = Object.keys(meta).length > 0 
      ? ` | ${JSON.stringify(meta)}` 
      : '';
    console.log(`${prefix} [${domain.toUpperCase()}] ${message}${metaStr}`);
  }
}

/**
 * Log informativo
 * 
 * @param {string} domain - Dominio del log
 * @param {string} message - Mensaje descriptivo
 * @param {Object} meta - Metadatos opcionales
 * @param {boolean} force - Forzar log incluso en producción
 * 
 * @example
 * logInfo('student', 'Alumno creado', { alumno_id: 123, email: 'test@example.com' });
 */
export function logInfo(domain, message, meta = {}, force = false) {
  createLog(LOG_LEVELS.INFO, domain, message, meta, force);
}

/**
 * Log de advertencia
 * 
 * @param {string} domain - Dominio del log
 * @param {string} message - Mensaje descriptivo
 * @param {Object} meta - Metadatos opcionales
 * 
 * @example
 * logWarn('practice', 'Práctica duplicada detectada', { alumno_id: 123, fecha: '2024-01-15' });
 */
export function logWarn(domain, message, meta = {}) {
  createLog(LOG_LEVELS.WARN, domain, message, meta);
}

/**
 * Log de error
 * 
 * @param {string} domain - Dominio del log
 * @param {string} message - Mensaje descriptivo
 * @param {Object} meta - Metadatos opcionales (puede incluir error, stack, etc.)
 * 
 * @example
 * logError('student', 'Error al actualizar nivel', { alumno_id: 123, error: err.message, stack: err.stack });
 */
export function logError(domain, message, meta = {}) {
  createLog(LOG_LEVELS.ERROR, domain, message, meta);
}

/**
 * Helper para extraer metadatos de un alumno
 * Útil para incluir información relevante en los logs
 * 
 * @param {Object} student - Objeto alumno (puede ser null)
 * @returns {Object} Metadatos del alumno
 */
export function extractStudentMeta(student) {
  if (!student) return {};
  
  return {
    alumno_id: student.id || null,
    email: student.email || null,
    nivel: student.nivel || student.nivel_actual || null,
    streak: student.streak || null,
    estado_suscripcion: student.estado_suscripcion || student.suscripcionActiva ? 'activa' : null
  };
}


