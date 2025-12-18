// src/core/automations/automation-actions/portal-message-action.js
// Acción: portal_message (AUTO-1B)
//
// RESPONSABILIDAD:
// - Enviar mensajes internos al alumno en el portal
// - Insertar en tabla portal_messages
// - Registrar auditoría completa

import { query } from '../../../../database/pg.js';
import { logInfo, logWarn } from '../../observability/logger.js';
import { logAuditEvent } from '../../audit/audit-service.js';

/**
 * Ejecuta acción 'portal_message'
 * 
 * CONTRATO DE ENTRADA (job.payload):
 * {
 *   "message_key": "string",
 *   "title": "string",
 *   "body": "string",
 *   "priority": "low|normal|high",
 *   "expires_at": "ISO_DATE|null",
 *   "context": {
 *     "rule_key": "string",
 *     "reason": "string"
 *   }
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

    if (!alumnoId) {
      logWarn('automations', 'portal_message: alumno_id no disponible', {
        job_id: job.id,
        run_id: run.id
      });
      return { success: false, error: 'alumno_id no disponible' };
    }

    // Validar campos requeridos
    const title = payload.title;
    const body = payload.body;
    
    if (!title || !body) {
      logWarn('automations', 'portal_message: title y body son requeridos', {
        job_id: job.id,
        run_id: run.id
      });
      return { success: false, error: 'title y body son requeridos' };
    }

    // Validar priority
    const priority = payload.priority || 'normal';
    if (!['low', 'normal', 'high'].includes(priority)) {
      logWarn('automations', 'portal_message: priority inválido, usando normal', {
        job_id: job.id,
        priority
      });
    }

    // Validar expires_at si existe
    let expiresAt = null;
    if (payload.expires_at) {
      expiresAt = new Date(payload.expires_at);
      if (isNaN(expiresAt.getTime())) {
        logWarn('automations', 'portal_message: expires_at inválido, ignorando', {
          job_id: job.id,
          expires_at: payload.expires_at
        });
        expiresAt = null;
      }
    }

    // Construir context
    const context = {
      ...(payload.context || {}),
      rule_key: run.rule_key || null,
      run_id: run.id,
      job_id: job.id
    };

    // Insertar mensaje en portal_messages
    const result = await query(`
      INSERT INTO portal_messages (
        alumno_id,
        message_key,
        title,
        body,
        priority,
        context,
        expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      alumnoId,
      payload.message_key || null,
      title,
      body,
      priority,
      JSON.stringify(context),
      expiresAt
    ]);

    const message = result.rows[0];

    // Registrar auditoría
    await logAuditEvent({
      actor: 'system',
      actorId: 'automation_engine',
      alumnoId: alumnoId,
      action: 'portal_message_created',
      entityType: 'portal_message',
      entityId: message.id.toString(),
      payload: {
        message_key: payload.message_key || null,
        rule_key: context.rule_key,
        run_id: run.id,
        job_id: job.id,
        priority,
        has_expires: expiresAt !== null
      }
    }).catch(err => {
      // Fail-open: continuar aunque falle la auditoría
      logWarn('automations', 'Error registrando auditoría de portal_message', {
        error: err.message
      });
    });

    logInfo('automations', 'Acción portal_message ejecutada exitosamente', {
      job_id: job.id,
      run_id: run.id,
      alumno_id: alumnoId,
      message_id: message.id,
      message_key: payload.message_key || null
    });

    return {
      success: true,
      result: {
        message_id: message.id,
        alumno_id: alumnoId,
        created_at: message.created_at
      }
    };
  } catch (error) {
    logWarn('automations', 'Error ejecutando acción portal_message', {
      error: error.message,
      job_id: job.id,
      run_id: run.id,
      stack: error.stack?.substring(0, 200)
    });
    // Fail-open: retornar fallo pero no romper el run
    return { success: false, error: error.message };
  }
}

