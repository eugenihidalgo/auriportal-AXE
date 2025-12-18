// src/core/automations/automation-actions/content-visibility-action.js
// Acción: content_visibility (AUTO-1B)
//
// RESPONSABILIDAD:
// - Ajustar visibilidad/prioridad de contenido SIN tocar progreso
// - Insertar en tabla content_overrides
// - Registrar auditoría completa

import { query } from '../../../../database/pg.js';
import { logInfo, logWarn } from '../../observability/logger.js';
import { logAuditEvent } from '../../audit/audit-service.js';

/**
 * Ejecuta acción 'content_visibility'
 * 
 * CONTRATO DE ENTRADA (job.payload):
 * {
 *   "content_key": "string",
 *   "visibility": "show|hide|priority",
 *   "priority_level": number|null,
 *   "expires_at": "ISO_DATE|null"
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
      logWarn('automations', 'content_visibility: alumno_id no disponible', {
        job_id: job.id,
        run_id: run.id
      });
      return { success: false, error: 'alumno_id no disponible' };
    }

    // Validar campos requeridos
    const contentKey = payload.content_key;
    const visibility = payload.visibility;

    if (!contentKey || typeof contentKey !== 'string') {
      logWarn('automations', 'content_visibility: content_key es requerido', {
        job_id: job.id,
        run_id: run.id
      });
      return { success: false, error: 'content_key es requerido' };
    }

    if (!visibility || !['show', 'hide', 'priority'].includes(visibility)) {
      logWarn('automations', 'content_visibility: visibility inválido', {
        job_id: job.id,
        run_id: run.id,
        visibility
      });
      return { success: false, error: 'visibility debe ser show, hide o priority' };
    }

    // Validar priority_level si visibility = 'priority'
    let priorityLevel = payload.priority_level || null;
    if (visibility === 'priority') {
      if (priorityLevel === null || typeof priorityLevel !== 'number') {
        logWarn('automations', 'content_visibility: priority_level requerido cuando visibility=priority', {
          job_id: job.id,
          run_id: run.id
        });
        return { success: false, error: 'priority_level es requerido cuando visibility=priority' };
      }
    } else {
      priorityLevel = null; // Asegurar que sea null si no es priority
    }

    // Validar expires_at si existe
    let expiresAt = null;
    if (payload.expires_at) {
      expiresAt = new Date(payload.expires_at);
      if (isNaN(expiresAt.getTime())) {
        logWarn('automations', 'content_visibility: expires_at inválido, ignorando', {
          job_id: job.id,
          expires_at: payload.expires_at
        });
        expiresAt = null;
      }
    }

    const metadata = payload.metadata || {};

    // Insertar override (no borramos overrides antiguos, mantenemos histórico)
    const result = await query(`
      INSERT INTO content_overrides (
        alumno_id,
        content_key,
        visibility,
        priority_level,
        source,
        expires_at,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      alumnoId,
      contentKey,
      visibility,
      priorityLevel,
      'automation',
      expiresAt,
      JSON.stringify(metadata)
    ]);

    const override = result.rows[0];

    // Registrar auditoría
    await logAuditEvent({
      actor: 'system',
      actorId: 'automation_engine',
      alumnoId: alumnoId,
      action: 'content_visibility_changed',
      entityType: 'content_override',
      entityId: override.id.toString(),
      payload: {
        content_key: contentKey,
        visibility,
        priority_level: priorityLevel,
        rule_key: run.rule_key || null,
        run_id: run.id,
        job_id: job.id,
        has_expires: expiresAt !== null
      }
    }).catch(err => {
      // Fail-open: continuar aunque falle la auditoría
      logWarn('automations', 'Error registrando auditoría de content_visibility', {
        error: err.message
      });
    });

    logInfo('automations', 'Acción content_visibility ejecutada exitosamente', {
      job_id: job.id,
      run_id: run.id,
      alumno_id: alumnoId,
      override_id: override.id,
      content_key: contentKey,
      visibility
    });

    return {
      success: true,
      result: {
        override_id: override.id,
        alumno_id: alumnoId,
        content_key: contentKey,
        visibility,
        priority_level: priorityLevel,
        created_at: override.created_at
      }
    };
  } catch (error) {
    logWarn('automations', 'Error ejecutando acción content_visibility', {
      error: error.message,
      job_id: job.id,
      run_id: run.id,
      stack: error.stack?.substring(0, 200)
    });
    // Fail-open: retornar fallo pero no romper el run
    return { success: false, error: error.message };
  }
}









