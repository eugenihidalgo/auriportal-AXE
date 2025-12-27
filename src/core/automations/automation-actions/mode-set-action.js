// src/core/automations/automation-actions/mode-set-action.js
// Acción: mode_set (AUTO-1B)
//
// RESPONSABILIDAD:
// - Activar/desactivar modos temporales del alumno
// - Insertar en tabla student_modes
// - Registrar auditoría completa

import { query } from '../../../../database/pg.js';
import { logInfo, logWarn } from '../../observability/logger.js';
import { logAuditEvent } from '../../audit/audit-service.js';

/**
 * Ejecuta acción 'mode_set'
 * 
 * CONTRATO DE ENTRADA (job.payload):
 * {
 *   "mode_key": "string",
 *   "duration_days": number|null,
 *   "metadata": {},
 *   "allow_override": false
 * }
 * 
 * REGLAS:
 * - Un alumno puede tener múltiples modos activos
 * - Un mismo mode_key solo una vez activo
 * - Si ya existe y allow_override = false → no hace nada (idempotente)
 * - Si duration_days existe → calcular ends_at
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
      logWarn('automations', 'mode_set: alumno_id no disponible', {
        job_id: job.id,
        run_id: run.id
      });
      return { success: false, error: 'alumno_id no disponible' };
    }

    // Validar mode_key
    const modeKey = payload.mode_key;
    if (!modeKey || typeof modeKey !== 'string') {
      logWarn('automations', 'mode_set: mode_key es requerido', {
        job_id: job.id,
        run_id: run.id
      });
      return { success: false, error: 'mode_key es requerido' };
    }

    const allowOverride = payload.allow_override === true;
    const durationDays = payload.duration_days || null;
    const metadata = payload.metadata || {};

    // Calcular ends_at si duration_days existe
    let endsAt = null;
    if (durationDays && typeof durationDays === 'number' && durationDays > 0) {
      const now = new Date();
      endsAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    }

    // Verificar si ya existe un modo activo con el mismo mode_key
    const existingResult = await query(`
      SELECT id, active FROM student_modes
      WHERE alumno_id = $1
        AND mode_key = $2
        AND active = TRUE
      ORDER BY created_at DESC
      LIMIT 1
    `, [alumnoId, modeKey]);

    if (existingResult.rows.length > 0 && !allowOverride) {
      // Ya existe y no se permite override → idempotente, retornar éxito
      logInfo('automations', 'mode_set: modo ya existe, no se sobrescribe (idempotente)', {
        job_id: job.id,
        run_id: run.id,
        alumno_id: alumnoId,
        mode_key: modeKey,
        existing_id: existingResult.rows[0].id
      });
      return {
        success: true,
        result: {
          mode_id: existingResult.rows[0].id,
          alumno_id: alumnoId,
          mode_key: modeKey,
          action: 'skipped_existing'
        }
      };
    }

    // Si existe y allow_override = true, desactivar el anterior
    if (existingResult.rows.length > 0 && allowOverride) {
      await query(`
        UPDATE student_modes
        SET active = FALSE,
            ended_at = NOW()
        WHERE id = $1
      `, [existingResult.rows[0].id]);
      
      logInfo('automations', 'mode_set: modo anterior desactivado por override', {
        job_id: job.id,
        previous_id: existingResult.rows[0].id,
        mode_key: modeKey
      });
    }

    // Insertar nuevo modo
    const result = await query(`
      INSERT INTO student_modes (
        alumno_id,
        mode_key,
        active,
        starts_at,
        ends_at,
        source,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      alumnoId,
      modeKey,
      true,
      new Date(),
      endsAt,
      'automation',
      JSON.stringify(metadata)
    ]);

    const mode = result.rows[0];

    // Registrar auditoría
    await logAuditEvent({
      actor: 'system',
      actorId: 'automation_engine',
      alumnoId: alumnoId,
      action: 'mode_set',
      entityType: 'student_mode',
      entityId: mode.id.toString(),
      payload: {
        mode_key: modeKey,
        rule_key: run.rule_key || null,
        run_id: run.id,
        job_id: job.id,
        duration_days: durationDays,
        has_ends_at: endsAt !== null,
        allow_override: allowOverride
      }
    }).catch(err => {
      // Fail-open: continuar aunque falle la auditoría
      logWarn('automations', 'Error registrando auditoría de mode_set', {
        error: err.message
      });
    });

    logInfo('automations', 'Acción mode_set ejecutada exitosamente', {
      job_id: job.id,
      run_id: run.id,
      alumno_id: alumnoId,
      mode_id: mode.id,
      mode_key: modeKey
    });

    return {
      success: true,
      result: {
        mode_id: mode.id,
        alumno_id: alumnoId,
        mode_key: modeKey,
        active: mode.active,
        ends_at: mode.ends_at,
        action: existingResult.rows.length > 0 ? 'overridden' : 'created'
      }
    };
  } catch (error) {
    logWarn('automations', 'Error ejecutando acción mode_set', {
      error: error.message,
      job_id: job.id,
      run_id: run.id,
      stack: error.stack?.substring(0, 200)
    });
    // Fail-open: retornar fallo pero no romper el run
    return { success: false, error: error.message };
  }
}




















