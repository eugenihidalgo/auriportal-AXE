/**
 * System Modes - AuriPortal
 * 
 * Este módulo deriva modos de operación del sistema basándose en el Coherence Engine.
 * Define el estado operacional del sistema y sus capacidades.
 * 
 * PRINCIPIOS FUNDAMENTALES:
 * - NO modifica contratos
 * - NO ejecuta lógica de negocio
 * - NO persiste estados
 * - SOLO lectura y decisión
 * - Código declarativo, puro y testeable
 * 
 * SYSTEM MODES:
 * - NORMAL: system_state === 'active' → Sistema completamente operativo
 * - DEGRADED: system_state === 'degraded' → Sistema operativo con limitaciones
 * - SAFE: Sistema degradado pero permitido (manual override futuro)
 * - BROKEN: system_state === 'broken' → Sistema no operativo
 */

import { getSystemCoherenceReport } from '../coherence/coherence-engine.js';

// ============================================================================
// DEFINICIONES DE MODOS
// ============================================================================

/**
 * Modos de operación del sistema
 * @typedef {'NORMAL' | 'DEGRADED' | 'SAFE' | 'BROKEN'} SystemMode
 */

/**
 * Mapeo de estados de coherencia a modos del sistema
 */
const COHERENCE_TO_MODE = {
  'active': 'NORMAL',
  'degraded': 'DEGRADED',
  'broken': 'BROKEN'
};

// ============================================================================
// FUNCIONES PÚBLICAS
// ============================================================================

/**
 * Obtiene el modo actual del sistema
 * 
 * Deriva el modo desde el Coherence Engine:
 * - 'active' → NORMAL
 * - 'degraded' → DEGRADED
 * - 'broken' → BROKEN
 * 
 * @returns {SystemMode} Modo actual del sistema
 */
export function getSystemMode() {
  try {
    const coherenceReport = getSystemCoherenceReport();
    const systemState = coherenceReport.system_state;
    
    // Mapear estado de coherencia a modo del sistema
    const mode = COHERENCE_TO_MODE[systemState];
    
    if (!mode) {
      // Si el estado no es reconocido, asumir BROKEN por seguridad
      console.warn(`[SYSTEM_MODES] Estado de coherencia desconocido: ${systemState}, asumiendo BROKEN`);
      return 'BROKEN';
    }
    
    return mode;
  } catch (error) {
    // Si el Coherence Engine falla, asumir BROKEN por seguridad
    console.error('[SYSTEM_MODES] Error obteniendo modo del sistema:', error.message);
    return 'BROKEN';
  }
}

/**
 * Indica si el sistema permite operaciones de escritura
 * 
 * Reglas:
 * - NORMAL: ✅ Escritura permitida
 * - DEGRADED: ⚠️ Escritura permitida (con advertencias)
 * - SAFE: ⚠️ Escritura permitida (override manual)
 * - BROKEN: ❌ Escritura bloqueada
 * 
 * @returns {boolean} true si el sistema permite escritura
 */
export function isSystemWritable() {
  const mode = getSystemMode();
  
  switch (mode) {
    case 'NORMAL':
      return true;
    case 'DEGRADED':
      // En modo degradado, permitir escritura pero con advertencias
      return true;
    case 'SAFE':
      // En modo seguro, permitir escritura (override manual)
      return true;
    case 'BROKEN':
      // En modo roto, bloquear escritura
      return false;
    default:
      // Por seguridad, bloquear si el modo no es reconocido
      console.warn(`[SYSTEM_MODES] Modo desconocido: ${mode}, bloqueando escritura`);
      return false;
  }
}

/**
 * Indica si el sistema está en modo solo lectura
 * 
 * Es el inverso de isSystemWritable() para claridad semántica.
 * 
 * @returns {boolean} true si el sistema está en modo solo lectura
 */
export function isSystemReadOnly() {
  return !isSystemWritable();
}

/**
 * Assert que el sistema permite escritura
 * 
 * Si el sistema está en modo BROKEN, lanza un error con code SYSTEM_BROKEN_WRITE_BLOCKED (status 503)
 * Si el sistema está en modo DEGRADED, permite pero hace logWarn
 * 
 * @param {Object} ctx - Contexto (opcional, para logging)
 * @param {string} trace_id - Trace ID para logging (opcional)
 * @throws {Error} Error con code SYSTEM_BROKEN_WRITE_BLOCKED si el sistema está BROKEN
 * 
 * @example
 * assertSystemWritable(ctx, traceId);
 */
export function assertSystemWritable(ctx = {}, trace_id = null) {
  const mode = getSystemMode();
  
  if (mode === 'BROKEN') {
    const error = new Error('Sistema en modo BROKEN: operaciones de escritura bloqueadas');
    error.code = 'SYSTEM_BROKEN_WRITE_BLOCKED';
    error.status = 503;
    throw error;
  }
  
  if (mode === 'DEGRADED') {
    // Permitir pero advertir
    // Import dinámico para evitar dependencia circular
    import('../observability/logger.js').then(({ logWarnCanonical }) => {
      logWarnCanonical('system_degraded_write', {
        mode: 'DEGRADED',
        message: 'Sistema en modo DEGRADED: escritura permitida pero con advertencias',
        ...(trace_id && { trace_id })
      });
    }).catch(() => {
      // Si falla el import, solo loguear con console
      console.warn('[SYSTEM_MODES] Sistema en modo DEGRADED: escritura permitida pero con advertencias', { trace_id });
    });
  }
  
  // NORMAL o SAFE: permitir sin advertencias
  return true;
}

/**
 * Obtiene información detallada del modo del sistema
 * 
 * @returns {Object} Información del modo actual
 * @property {SystemMode} mode - Modo actual
 * @property {string} system_state - Estado de coherencia del sistema
 * @property {boolean} writable - Si permite escritura
 * @property {boolean} read_only - Si está en modo solo lectura
 * @property {Object} stats - Estadísticas de contratos
 */
export function getSystemModeInfo() {
  try {
    const coherenceReport = getSystemCoherenceReport();
    const mode = getSystemMode();
    const writable = isSystemWritable();
    
    return {
      mode,
      system_state: coherenceReport.system_state,
      writable,
      read_only: !writable,
      stats: coherenceReport.stats,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('[SYSTEM_MODES] Error obteniendo información del modo:', error.message);
    return {
      mode: 'BROKEN',
      system_state: 'unknown',
      writable: false,
      read_only: true,
      stats: {
        total: 0,
        active: 0,
        degraded: 0,
        broken: 0
      },
      timestamp: new Date().toISOString(),
      error: error.message
    };
  }
}

/**
 * Obtiene una descripción legible del modo actual
 * 
 * @returns {string} Descripción del modo
 */
export function getSystemModeDescription() {
  const mode = getSystemMode();
  
  const descriptions = {
    'NORMAL': 'Sistema completamente operativo. Todas las funcionalidades disponibles.',
    'DEGRADED': 'Sistema operativo con limitaciones. Algunos contratos están degradados.',
    'SAFE': 'Sistema en modo seguro. Operaciones permitidas con override manual.',
    'BROKEN': 'Sistema no operativo. Contratos críticos están rotos. Solo lectura disponible.'
  };
  
  return descriptions[mode] || `Modo desconocido: ${mode}`;
}

/**
 * Verifica si el sistema está en un modo específico
 * 
 * @param {SystemMode} targetMode - Modo a verificar
 * @returns {boolean} true si el sistema está en el modo especificado
 */
export function isSystemInMode(targetMode) {
  const currentMode = getSystemMode();
  return currentMode === targetMode;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  getSystemMode,
  isSystemWritable,
  isSystemReadOnly,
  getSystemModeInfo,
  getSystemModeDescription,
  isSystemInMode
};

