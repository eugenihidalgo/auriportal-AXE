/**
 * ENTRY CONTEXT RESOLVER v1 - AuriPortal
 * 
 * ═══════════════════════════════════════════════════════════════
 * PRINCIPIO CONSTITUCIONAL: El dominio define el universo
 * ═══════════════════════════════════════════════════════════════
 * 
 * Este módulo implementa el Entry Gate canónico que separa los flujos
 * EXCLUSIVAMENTE por dominio (host), no por ruta.
 * 
 * REGLAS ABSOLUTAS:
 * - ❌ NO usar paths para decidir contexto
 * - ❌ NO inferencias
 * - ❌ NO fallbacks automáticos
 * - ❌ NO redirecciones cruzadas
 * - ✅ Si el host no es reconocido → error explícito
 * 
 * CONTEXTOS:
 * - STUDENT: Portal del alumno (pdeeugenihidalgo.org)
 * - MASTER: Dominio canónico Master (master.pdeeugenihidalgo.org)
 * - ADMIN_LEGACY: Admin legacy operativo (admin.pdeeugenihidalgo.org)
 * 
 * RESPONSABILIDADES:
 * - Determinar contexto EXCLUSIVAMENTE por req.headers.host
 * - Validar que el host sea reconocido
 * - Devolver contexto canónico para routing posterior
 */

import { logInfo, logWarn, logError } from '../observability/logger.js';

/**
 * Contextos de entrada canónicos
 */
export const ENTRY_CONTEXT = {
  STUDENT: 'STUDENT',
  MASTER: 'MASTER',
  ADMIN_LEGACY: 'ADMIN_LEGACY'
};

/**
 * Hosts canónicos reconocidos
 */
const CANONICAL_HOSTS = {
  // STUDENT - Portal del alumno
  'pdeeugenihidalgo.org': ENTRY_CONTEXT.STUDENT,
  'www.pdeeugenihidalgo.org': ENTRY_CONTEXT.STUDENT,
  'portal.pdeeugenihidalgo.org': ENTRY_CONTEXT.STUDENT,
  
  // MASTER - Dominio canónico Master
  'master.pdeeugenihidalgo.org': ENTRY_CONTEXT.MASTER,
  
  // ADMIN_LEGACY - Admin legacy operativo
  'admin.pdeeugenihidalgo.org': ENTRY_CONTEXT.ADMIN_LEGACY,
  
  // LEGACY HOSTS - Dominios legacy conocidos (no generan error, solo INFO)
  'controlauriportal.eugenihidalgo.work': ENTRY_CONTEXT.ADMIN_LEGACY
};

/**
 * Resuelve el contexto de entrada EXCLUSIVAMENTE por host
 * 
 * @param {Request} request - Request HTTP
 * @returns {Object} { context, host, recognized }
 *   - context: ENTRY_CONTEXT (STUDENT | MASTER | ADMIN_LEGACY)
 *   - host: host original
 *   - recognized: boolean (si el host es reconocido)
 */
export function resolveEntryContext(request) {
  const host = request.headers.get('host') || '';
  
  // Normalizar host (quitar puerto si existe)
  const normalizedHost = host.split(':')[0].toLowerCase();
  
  // Buscar contexto canónico
  const context = CANONICAL_HOSTS[normalizedHost];
  
  if (context) {
    logInfo('EntryGate', 'Contexto resuelto por host', { 
      host: normalizedHost, 
      context 
    });
    
    return {
      context,
      host: normalizedHost,
      recognized: true
    };
  }
  
  // Host no reconocido → log INFO (no error, solo informativo)
  // Solo ERROR si es un intento de acceso real en producción
  if (process.env.NODE_ENV === 'production') {
    logWarn('EntryGate', 'Host no reconocido en PROD', { 
      host: normalizedHost,
      originalHost: host 
    });
  } else {
    logInfo('EntryGate', 'Host no reconocido (DEV)', { 
      host: normalizedHost,
      originalHost: host 
    });
  }
  
  return {
    context: null,
    host: normalizedHost,
    recognized: false
  };
}

/**
 * Valida que el contexto sea válido
 * 
 * @param {string} context - Contexto a validar
 * @returns {boolean}
 */
export function isValidContext(context) {
  return Object.values(ENTRY_CONTEXT).includes(context);
}

/**
 * Obtiene el contexto de entrada y valida que sea reconocido
 * Si no es reconocido, lanza error explícito
 * 
 * @param {Request} request - Request HTTP
 * @returns {string} Contexto canónico (STUDENT | MASTER | ADMIN_LEGACY)
 * @throws {Error} Si el host no es reconocido
 */
export function requireEntryContext(request) {
  const { context, host, recognized } = resolveEntryContext(request);
  
  if (!recognized || !context) {
    const error = new Error(`Host no reconocido: ${host}`);
    error.code = 'UNRECOGNIZED_HOST';
    error.host = host;
    logError('EntryGate', 'Host no reconocido', { host, error: error.message });
    throw error;
  }
  
  return context;
}

/**
 * Verifica si el contexto es MASTER
 * 
 * @param {string} context - Contexto a verificar
 * @returns {boolean}
 */
export function isMasterContext(context) {
  return context === ENTRY_CONTEXT.MASTER;
}

/**
 * Verifica si el contexto es STUDENT
 * 
 * @param {string} context - Contexto a verificar
 * @returns {boolean}
 */
export function isStudentContext(context) {
  return context === ENTRY_CONTEXT.STUDENT;
}

/**
 * Verifica si el contexto es ADMIN_LEGACY
 * 
 * @param {string} context - Contexto a verificar
 * @returns {boolean}
 */
export function isAdminLegacyContext(context) {
  return context === ENTRY_CONTEXT.ADMIN_LEGACY;
}


