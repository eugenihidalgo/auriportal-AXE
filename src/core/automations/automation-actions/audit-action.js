// src/core/automations/automation-actions/audit-action.js
// Acción: audit (AUTO-1)
//
// RESPONSABILIDAD:
// - Registrar evento en audit_events

import { logAuditEvent } from '../../audit/audit-service.js';
import { logInfo, logWarn } from '../../observability/logger.js';

/**
 * Ejecuta acción 'audit'
 * 
 * @param {object} job - Job de automatización
 * @param {object} ctx - Contexto del alumno
 * @param {object} run - Run de automatización
 * @returns {Promise<{success: boolean, result: object}>} Resultado
 */
export async function execute(job, ctx, run) {
  try {
    const payload = job.payload || {};
    const action = payload.action || 'automation_triggered';
    const actor = payload.actor || 'system';
    const actorId = payload.actor_id || 'automation_engine';
    const entityType = payload.entity_type || 'automation_run';
    const entityId = payload.entity_id || run.id;

    const auditPayload = payload.payload || {};

    const result = await logAuditEvent({
      actor,
      actorId,
      alumnoId: ctx.student?.id || ctx.alumno_id,
      action,
      entityType,
      entityId,
      payload: {
        ...auditPayload,
        automation_rule_key: run.rule_key || null,
        automation_run_id: run.id,
        automation_job_id: job.id
      }
    });

    if (result) {
      logInfo('automations', 'Acción audit ejecutada', {
        job_id: job.id,
        run_id: run.id,
        audit_event_id: result.id
      });
      return { success: true, result };
    } else {
      logWarn('automations', 'Acción audit falló (fail-open)', {
        job_id: job.id,
        run_id: run.id
      });
      // Fail-open: retornar éxito aunque falle la auditoría
      return { success: true, result: null };
    }
  } catch (error) {
    logWarn('automations', 'Error ejecutando acción audit', {
      error: error.message,
      job_id: job.id,
      run_id: run.id
    });
    // Fail-open: retornar éxito aunque falle
    return { success: true, result: null };
  }
}




















