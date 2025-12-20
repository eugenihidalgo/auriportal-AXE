// src/core/automations/automation-actions/master-notification-action.js
// Acción: master_notification (AUTO-1B)
//
// RESPONSABILIDAD:
// - Crear notificaciones para el Master (Observatorio del sistema)
// - Insertar en tabla master_notifications
// - Registrar auditoría completa

import { query } from '../../../../database/pg.js';
import { logInfo, logWarn } from '../../observability/logger.js';
import { logAuditEvent } from '../../audit/audit-service.js';

/**
 * Ejecuta acción 'master_notification'
 * 
 * CONTRATO DE ENTRADA (job.payload):
 * {
 *   "type": "string",
 *   "title": "string",
 *   "body": "string",
 *   "severity": "info|warning|critical",
 *   "context": {}
 * }
 * 
 * @param {object} job - Job de automatización
 * @param {object} ctx - Contexto del alumno
 * @param {object} run - Run de automatización
 * @returns {Promise<{success: boolean, result: object}>} Resultado
 */
export async function execute(job, ctx, run) {
  try {
    const payload = job.payload || {};
    const alumnoId = ctx.student?.id || ctx.alumno_id;

    // Validar campos requeridos
    const type = payload.type;
    const title = payload.title;
    const body = payload.body;

    if (!type || typeof type !== 'string') {
      logWarn('automations', 'master_notification: type es requerido', {
        job_id: job.id,
        run_id: run.id
      });
      return { success: false, error: 'type es requerido' };
    }

    if (!title || typeof title !== 'string') {
      logWarn('automations', 'master_notification: title es requerido', {
        job_id: job.id,
        run_id: run.id
      });
      return { success: false, error: 'title es requerido' };
    }

    if (!body || typeof body !== 'string') {
      logWarn('automations', 'master_notification: body es requerido', {
        job_id: job.id,
        run_id: run.id
      });
      return { success: false, error: 'body es requerido' };
    }

    // Validar severity
    const severity = payload.severity || 'info';
    if (!['info', 'warning', 'critical'].includes(severity)) {
      logWarn('automations', 'master_notification: severity inválido, usando info', {
        job_id: job.id,
        severity
      });
    }

    // Construir context
    const context = {
      ...(payload.context || {}),
      rule_key: run.rule_key || null,
      run_id: run.id,
      job_id: job.id,
      alumno_id: alumnoId || null
    };

    // Insertar notificación en master_notifications
    const result = await query(`
      INSERT INTO master_notifications (
        type,
        title,
        body,
        severity,
        context
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      type,
      title,
      body,
      severity,
      JSON.stringify(context)
    ]);

    const notification = result.rows[0];

    // Registrar auditoría
    await logAuditEvent({
      actor: 'system',
      actorId: 'automation_engine',
      alumnoId: alumnoId || null,
      action: 'master_notification_created',
      entityType: 'master_notification',
      entityId: notification.id.toString(),
      payload: {
        type,
        severity,
        rule_key: context.rule_key,
        run_id: run.id,
        job_id: job.id
      }
    }).catch(err => {
      // Fail-open: continuar aunque falle la auditoría
      logWarn('automations', 'Error registrando auditoría de master_notification', {
        error: err.message
      });
    });

    logInfo('automations', 'Acción master_notification ejecutada exitosamente', {
      job_id: job.id,
      run_id: run.id,
      notification_id: notification.id,
      type,
      severity,
      alumno_id: alumnoId
    });

    return {
      success: true,
      result: {
        notification_id: notification.id,
        type,
        severity,
        created_at: notification.created_at
      }
    };
  } catch (error) {
    logWarn('automations', 'Error ejecutando acción master_notification', {
      error: error.message,
      job_id: job.id,
      run_id: run.id,
      stack: error.stack?.substring(0, 200)
    });
    // Fail-open: retornar fallo pero no romper el run
    return { success: false, error: error.message };
  }
}













