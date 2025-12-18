// src/core/automations/automation-executor.js
// Ejecutor de Acciones (AUTO-1)
//
// RESPONSABILIDAD:
// - Ejecutar acciones de automation_jobs
// - Registrar éxito/fallo en jobs
// - Idempotente y fail-open

import { query } from '../../../database/pg.js';
import { logInfo, logWarn, logError } from '../observability/logger.js';
import { logAuditEvent } from '../audit/audit-service.js';
import * as auditAction from './automation-actions/audit-action.js';
import * as portalMessageAction from './automation-actions/portal-message-action.js';
import * as unlockAction from './automation-actions/unlock-action.js';
import * as modeSetAction from './automation-actions/mode-set-action.js';
import * as contentVisibilityAction from './automation-actions/content-visibility-action.js';
import * as masterNotificationAction from './automation-actions/master-notification-action.js';

/**
 * Ejecuta un job de automatización
 * 
 * @param {object} job - Job a ejecutar
 * @param {object} run - Run asociado
 * @param {object} ctx - Contexto del alumno
 * @returns {Promise<{success: boolean}>} Resultado
 */
export async function executeJob(job, run, ctx) {
  try {
    // Verificar que el job esté en estado 'queued'
    if (job.status !== 'queued') {
      logWarn('automations', 'Job no está en estado queued', {
        job_id: job.id,
        status: job.status
      });
      return { success: false };
    }

    // Verificar que no haya expirado (si tiene execute_at)
    if (job.execute_at && new Date(job.execute_at) > new Date()) {
      // Aún no es momento de ejecutar
      return { success: false, reason: 'not_yet_time' };
    }

    // Obtener acción según step_key
    const stepKey = job.step_key;
    let actionModule = null;

    switch (stepKey) {
      case 'audit':
        actionModule = auditAction;
        break;
      case 'portal_message':
        actionModule = portalMessageAction;
        break;
      case 'unlock':
        actionModule = unlockAction;
        break;
      case 'mode_set':
        actionModule = modeSetAction;
        break;
      case 'content_visibility':
        actionModule = contentVisibilityAction;
        break;
      case 'master_notification':
        actionModule = masterNotificationAction;
        break;
      default:
        logWarn('automations', 'Acción desconocida', {
          step_key: stepKey,
          job_id: job.id
        });
        await updateJobStatus(job.id, 'failed', `Acción desconocida: ${stepKey}`);
        return { success: false };
    }

    // Marcar job como 'running'
    await updateJobStatus(job.id, 'running', null);

    // Ejecutar acción
    const result = await actionModule.execute(job, ctx, run);

    // Actualizar estado del job
    if (result.success) {
      await updateJobStatus(job.id, 'done', null);
      
      // Registrar auditoría de ejecución exitosa
      await logAuditEvent({
        actor: 'system',
        actorId: 'automation_engine',
        alumnoId: ctx.student?.id || ctx.alumno_id,
        action: 'automation_job_executed',
        entityType: 'automation_job',
        entityId: job.id,
        payload: {
          step_key: stepKey,
          run_id: run.id
        }
      }).catch(err => {
        // Fail-open: continuar aunque falle la auditoría
        logWarn('automations', 'Error registrando auditoría de job_executed', {
          error: err.message
        });
      });

      logInfo('automations', 'Job ejecutado exitosamente', {
        job_id: job.id,
        step_key: stepKey,
        run_id: run.id
      });
    } else {
      await updateJobStatus(job.id, 'failed', result.error || 'Acción falló');
      
      // Registrar auditoría de fallo
      await logAuditEvent({
        actor: 'system',
        actorId: 'automation_engine',
        alumnoId: ctx.student?.id || ctx.alumno_id,
        action: 'automation_job_failed',
        entityType: 'automation_job',
        entityId: job.id,
        payload: {
          step_key: stepKey,
          run_id: run.id,
          error: result.error || 'Acción falló'
        }
      }).catch(err => {
        // Fail-open
        logWarn('automations', 'Error registrando auditoría de job_failed', {
          error: err.message
        });
      });

      logWarn('automations', 'Job falló', {
        job_id: job.id,
        step_key: stepKey,
        run_id: run.id,
        error: result.error
      });
    }

    return { success: result.success };
  } catch (error) {
    // Fail-open: marcar job como fallido pero no romper el flujo
    logError('automations', 'Error crítico ejecutando job', {
      error: error.message,
      job_id: job.id,
      stack: error.stack?.substring(0, 200)
    });

    await updateJobStatus(job.id, 'failed', error.message).catch(() => {
      // Si incluso esto falla, no hacer nada más
    });

    return { success: false };
  }
}

/**
 * Actualiza el estado de un job
 * 
 * @param {string} jobId - ID del job
 * @param {string} status - Nuevo estado
 * @param {string|null} error - Mensaje de error (si aplica)
 */
async function updateJobStatus(jobId, status, error) {
  try {
    await query(`
      UPDATE automation_jobs
      SET status = $1,
          last_error = $2,
          attempts = attempts + 1,
          updated_at = NOW()
      WHERE id = $3
    `, [status, error, jobId]);
  } catch (updateError) {
    logWarn('automations', 'Error actualizando estado de job', {
      error: updateError.message,
      job_id: jobId
    });
  }
}

