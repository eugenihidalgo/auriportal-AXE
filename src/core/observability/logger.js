// src/core/observability/logger.js
// Sistema centralizado de logging para AuriPortal v4
// Proporciona logs estructurados por dominio con trazabilidad de alumnos
// Incluye correlación automática por request_id
// Incluye redaction automática de secretos

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
 * Lista de campos que deben ser redactados automáticamente
 * Case-insensitive matching
 */
const SENSITIVE_FIELDS = [
  'authorization',
  'cookie',
  'set-cookie',
  'token',
  'password',
  'secret',
  'apikey',
  'api_key',
  'refreshtoken',
  'refresh_token',
  'access_token',
  'session',
  'sessionid',
  'session_id',
  'csrf',
  'csrf_token'
];

/**
 * Redacta valores sensibles en un objeto
 * Reemplaza valores de campos sensibles con '[REDACTED]'
 * 
 * @param {Object} obj - Objeto a redactar
 * @param {number} maxDepth - Profundidad máxima de recursión (default: 5)
 * @returns {Object} Objeto con valores sensibles redactados
 */
function redactSensitiveData(obj, maxDepth = 5) {
  if (!obj || typeof obj !== 'object' || maxDepth <= 0) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveData(item, maxDepth - 1));
  }

  const redacted = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const keyLower = key.toLowerCase();
    
    // Verificar si el campo es sensible
    const isSensitive = SENSITIVE_FIELDS.some(field => 
      keyLower.includes(field.toLowerCase())
    );
    
    if (isSensitive) {
      redacted[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      // Recursión para objetos anidados
      redacted[key] = redactSensitiveData(value, maxDepth - 1);
    } else {
      redacted[key] = value;
    }
  }
  
  return redacted;
}

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

  // Redactar datos sensibles de meta antes de loguear
  const safeMeta = redactSensitiveData(meta);

  const logEntry = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    domain: domain,
    message: message,
    env: process.env.APP_ENV || 'prod',
    version: process.env.APP_VERSION || '4.0.0',
    build: process.env.BUILD_ID || 'unknown',
    ...(requestId && { request_id: requestId }), // Incluir request_id solo si existe
    ...safeMeta
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
    const metaStr = Object.keys(safeMeta).length > 0 
      ? ` | ${JSON.stringify(safeMeta)}` 
      : '';
    console.log(`${prefix} [${domain.toUpperCase()}] ${message}${metaStr}`);
  }
}

/**
 * Exportar función de redaction para tests
 */
export { redactSensitiveData };

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

// ============================================================================
// LOGGER CANÓNICO v1 - API ESTRUCTURADA
// ============================================================================
// Nueva API canónica: logInfo(event, fields), logWarn(event, fields), logError(event, fields)
// Salida: JSON por línea con ts, level, event, trace_id, route_key, path, method, etc.

/**
 * Trunca un stack trace a un tamaño razonable
 * @param {string} stack - Stack trace completo
 * @param {number} maxLines - Máximo de líneas (default: 10)
 * @returns {string} Stack truncado
 */
function truncateStack(stack, maxLines = 10) {
  if (!stack) return undefined;
  const lines = stack.split('\n');
  if (lines.length <= maxLines) return stack;
  return lines.slice(0, maxLines).join('\n') + '\n... (truncated)';
}

/**
 * Extrae información de error de forma segura
 * @param {Error|Object} err - Error object
 * @returns {Object} Información del error
 */
function extractErrorInfo(err) {
  if (!err) return undefined;
  
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: truncateStack(err.stack)
    };
  }
  
  if (typeof err === 'object') {
    return {
      name: err.name || 'Error',
      message: err.message || String(err),
      stack: truncateStack(err.stack)
    };
  }
  
  return {
    name: 'Error',
    message: String(err)
  };
}

/**
 * Logger canónico v1 - Log Info
 * @param {string} event - Nombre del evento
 * @param {Object} fields - Campos adicionales (route_key, path, method, admin_id, student_id, duration_ms, etc.)
 */
export function logInfoCanonical(event, fields = {}) {
  const traceId = getRequestId();
  const ts = new Date().toISOString();
  
  const logEntry = {
    ts,
    level: 'INFO',
    event,
    ...(traceId && { trace_id: traceId }),
    ...fields
  };
  
  // Salida JSON por línea
  console.log(JSON.stringify(logEntry));
}

/**
 * Logger canónico v1 - Log Warn
 * @param {string} event - Nombre del evento
 * @param {Object} fields - Campos adicionales
 */
export function logWarnCanonical(event, fields = {}) {
  const traceId = getRequestId();
  const ts = new Date().toISOString();
  
  const logEntry = {
    ts,
    level: 'WARN',
    event,
    ...(traceId && { trace_id: traceId }),
    ...fields
  };
  
  // Salida JSON por línea
  console.log(JSON.stringify(logEntry));
}

/**
 * Logger canónico v1 - Log Error
 * @param {string} event - Nombre del evento
 * @param {Object} fields - Campos adicionales (puede incluir err)
 */
export function logErrorCanonical(event, fields = {}) {
  const traceId = getRequestId();
  const ts = new Date().toISOString();
  
  // Extraer información de error si existe
  const err = fields.err || fields.error;
  const errInfo = err ? extractErrorInfo(err) : undefined;
  
  // Construir log entry sin el error original, pero con err estructurado
  const { err: _, error: __, ...restFields } = fields;
  
  const logEntry = {
    ts,
    level: 'ERROR',
    event,
    ...(traceId && { trace_id: traceId }),
    ...restFields,
    ...(errInfo && { err: errInfo })
  };
  
  // Salida JSON por línea (usar console.error para errores)
  console.error(JSON.stringify(logEntry));
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






















