// src/endpoints/admin-system-diagnostics-api.js
// Runtime Diagnostics API - Expone el estado real del sistema usando el Coherence Engine

import { getSystemCoherenceReport } from '../core/coherence/coherence-engine.js';
import { getRecentErrors, getErrorStats } from '../core/observability/error-buffer.js';

/**
 * Handler para GET /admin/api/system/diagnostics
 * 
 * Expone el estado real del sistema usando el Coherence Engine.
 * Devuelve información sobre la coherencia de todos los contratos.
 * 
 * @param {Request} request - Request object
 * @param {Object} env - Environment variables
 * @param {Object} ctx - Context object
 * @returns {Promise<Response>} JSON response con diagnóstico del sistema
 */
export default async function adminSystemDiagnosticsHandler(request, env, ctx) {
  console.log('[DIAGNOSTICS] Solicitud de diagnóstico del sistema recibida');

  try {
    // Obtener reporte de coherencia del sistema
    const coherenceReport = getSystemCoherenceReport();

    console.log('[DIAGNOSTICS] Reporte de coherencia obtenido:', {
      system_state: coherenceReport.system_state,
      total_contracts: coherenceReport.stats.total,
      active: coherenceReport.stats.active,
      degraded: coherenceReport.stats.degraded,
      broken: coherenceReport.stats.broken
    });

    // Calcular uptime
    const serverStartTime = parseInt(process.env.SERVER_START_TIME || '0', 10);
    const uptimeSec = serverStartTime > 0 ? Math.floor((Date.now() - serverStartTime) / 1000) : 0;
    
    // Obtener versión y build
    const appVersion = process.env.APP_VERSION || 'unknown';
    const buildId = process.env.BUILD_ID || 'unknown';
    
    // Obtener errores recientes y estadísticas
    const recentErrors = getRecentErrors(50);
    const errorStats = getErrorStats(200);
    
    // Construir respuesta JSON canónica
    const response = {
      ok: true,
      data: {
        system_state: coherenceReport.system_state,
        stats: coherenceReport.stats,
        contracts: coherenceReport.contracts.map(contract => ({
          id: contract.id,
          declared_status: contract.declared_status,
          effective_status: contract.effective_status,
          reason: contract.reason,
          dependencies: contract.dependencies
        })),
        // Nuevos campos de observabilidad
        recent_errors: recentErrors,
        error_stats: errorStats,
        uptime_sec: uptimeSec,
        build: {
          app_version: appVersion,
          build_id: buildId
        }
      }
    };

    console.log('[DIAGNOSTICS] Respuesta generada exitosamente');

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    // El Runtime Guard capturará este error y lo convertirá a JSON válido
    // Pero añadimos logs estructurados aquí
    console.error('[DIAGNOSTICS] Error obteniendo diagnóstico del sistema:', {
      error: error.message,
      stack: error.stack
    });

    // Lanzar error para que Runtime Guard lo maneje
    throw error;
  }
}

