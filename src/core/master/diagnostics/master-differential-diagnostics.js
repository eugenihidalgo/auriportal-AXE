/**
 * MASTER DIFFERENTIAL DIAGNOSTICS v1 - AuriPortal Master
 * 
 * Diagnóstico diferencial para distinguir entre Master canónico y Admin legacy.
 * 
 * OBJETIVO:
 * - Saber si una pantalla es Master canónica o Admin legacy
 * - Detectar errores SOLO en Master
 * - Aislar problemas de legacy
 * 
 * PRINCIPIO:
 * > Si algo falla y NO está en Master, sabemos que no es canónico.
 */

import { logInfo, logWarn, logError } from '../../observability/logger.js';
import { getRequestId } from '../../observability/request-context.js';

/**
 * Detecta si una ruta es Master canónica
 * @param {string} path - Path de la ruta
 * @returns {boolean} true si es ruta Master
 */
export function isMasterRoute(path) {
  return path === '/master' || path.startsWith('/master/');
}

/**
 * Detecta si una ruta es Admin legacy
 * @param {string} path - Path de la ruta
 * @returns {boolean} true si es ruta Admin
 */
export function isAdminRoute(path) {
  return path === '/admin' || path.startsWith('/admin/');
}

/**
 * Obtiene información diferencial de una ruta
 * @param {string} path - Path de la ruta
 * @returns {Object} Información diferencial
 */
export function getRouteDifferential(path) {
  const traceId = getRequestId() || `differential-${Date.now()}`;
  
  const isMaster = isMasterRoute(path);
  const isAdmin = isAdminRoute(path);
  
  return {
    path,
    isMaster,
    isAdmin,
    isCanonical: isMaster,
    isLegacy: isAdmin,
    domain: isMaster ? 'master' : (isAdmin ? 'admin' : 'unknown'),
    traceId
  };
}

/**
 * Valida que un error proviene de Master (no de legacy)
 * @param {Error} error - Error a validar
 * @param {string} path - Path donde ocurrió el error
 * @returns {Object} Información de validación
 */
export function validateMasterError(error, path) {
  const differential = getRouteDifferential(path);
  
  if (!differential.isMaster) {
    logWarn('MasterDifferential', 'Error en ruta no-Master', {
      path,
      error: error.message,
      domain: differential.domain,
      traceId: differential.traceId
    });
    
    return {
      isMasterError: false,
      isLegacyError: differential.isAdmin,
      shouldIgnore: differential.isAdmin, // Ignorar errores de legacy
      differential
    };
  }
  
  // Error en Master: es crítico
  logError('MasterDifferential', 'Error en ruta Master', {
    path,
    error: error.message,
    code: error.code,
    traceId: differential.traceId
  });
  
  return {
    isMasterError: true,
    isLegacyError: false,
    shouldIgnore: false,
    differential
  };
}

/**
 * Genera reporte diferencial del sistema
 * @returns {Object} Reporte diferencial
 */
export async function generateDifferentialReport() {
  const traceId = getRequestId() || `differential-report-${Date.now()}`;
  
  try {
    // Importar registries
    const { MASTER_ROUTES } = await import('../registry/master-route-registry.js');
    const { ADMIN_ROUTES } = await import('../../admin/admin-route-registry.js');
    
    const report = {
      timestamp: new Date().toISOString(),
      traceId,
      master: {
        routes: MASTER_ROUTES.length,
        active: MASTER_ROUTES.filter(r => !r.disabled).length,
        disabled: MASTER_ROUTES.filter(r => r.disabled).length,
        api: MASTER_ROUTES.filter(r => r.type === 'api').length,
        island: MASTER_ROUTES.filter(r => r.type === 'island').length
      },
      admin: {
        routes: ADMIN_ROUTES.length,
        active: ADMIN_ROUTES.filter(r => !r.disabled).length,
        disabled: ADMIN_ROUTES.filter(r => r.disabled).length,
        api: ADMIN_ROUTES.filter(r => r.type === 'api').length,
        island: ADMIN_ROUTES.filter(r => r.type === 'island').length,
        legacy: ADMIN_ROUTES.filter(r => r.type === 'legacy').length
      },
      differential: {
        masterIsCanonical: true,
        adminIsLegacy: true,
        separation: 'complete'
      }
    };
    
    logInfo('MasterDifferential', 'Reporte diferencial generado', { traceId });
    
    return report;
  } catch (error) {
    logError('MasterDifferential', 'Error generando reporte', {
      error: error.message,
      traceId
    });
    throw error;
  }
}


