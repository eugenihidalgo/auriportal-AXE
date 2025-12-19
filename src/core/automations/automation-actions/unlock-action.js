// src/core/automations/automation-actions/unlock-action.js
// Acción: unlock (AUTO-1)
//
// RESPONSABILIDAD:
// - Marcar contenido como desbloqueado (placeholder por ahora)

import { logInfo, logWarn } from '../../observability/logger.js';

/**
 * Ejecuta acción 'unlock'
 * 
 * @param {object} job - Job de automatización
 * @param {object} ctx - Contexto del alumno
 * @param {object} run - Run de automatización
 * @returns {Promise<{success: boolean, result: object}>} Resultado
 */
export async function execute(job, ctx, run) {
  try {
    const payload = job.payload || {};
    const contentId = payload.content_id || payload.unlock_id;
    const alumnoId = ctx.student?.id || ctx.alumno_id;

    if (!contentId) {
      logWarn('automations', 'Acción unlock sin content_id', {
        job_id: job.id,
        run_id: run.id
      });
      return { success: false, result: null };
    }

    // Por ahora, solo logueamos el unlock
    // En el futuro, esto podría actualizar una tabla de desbloqueos
    logInfo('automations', 'Acción unlock ejecutada', {
      job_id: job.id,
      run_id: run.id,
      alumno_id: alumnoId,
      content_id: contentId
    });

    // TODO: Implementar tabla de desbloqueos cuando sea necesario
    // Por ahora, retornamos éxito como placeholder
    return {
      success: true,
      result: {
        content_id: contentId,
        alumno_id: alumnoId,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    logWarn('automations', 'Error ejecutando acción unlock', {
      error: error.message,
      job_id: job.id,
      run_id: run.id
    });
    // Fail-open: retornar éxito aunque falle
    return { success: true, result: null };
  }
}












