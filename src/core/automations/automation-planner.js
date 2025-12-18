// src/core/automations/automation-planner.js
// Planificador de Ejecuciones (AUTO-1)
//
// RESPONSABILIDAD:
// - Crear automation_runs
// - Crear automation_jobs para cada acción
// - Registrar eventos de auditoría

import { query } from '../../../database/pg.js';
import { logInfo, logWarn, logError } from '../observability/logger.js';
import { logAuditEvent } from '../audit/audit-service.js';

/**
 * Planifica una ejecución (crea run y jobs)
 * 
 * @param {object} rule - Regla de automatización
 * @param {number} alumnoId - ID del alumno
 * @param {object} ctx - Contexto del alumno
 * @param {string} reason - Razón de la ejecución
 * @param {object} triggerMatch - Resultado de la evaluación del trigger
 * @returns {Promise<object|null>} Run creado o null si falló
 */
export async function planAutomationRun(rule, alumnoId, ctx, reason, triggerMatch) {
  try {
    // 1. Crear automation_run
    const runResult = await query(`
      INSERT INTO automation_runs (
        rule_id, alumno_id, status, context_snapshot, reason
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      rule.id,
      alumnoId,
      'planned',
      JSON.stringify({
        nivel_efectivo: ctx.progress?.nivel_efectivo || ctx.nivelInfo?.nivel_efectivo || null,
        streak: ctx.streakInfo?.streak || ctx.student?.streak || 0,
        pausas_activa: ctx.pausas?.activa || false,
        timestamp: new Date().toISOString()
      }),
      reason
    ]);

    const run = runResult.rows[0];
    if (!run) {
      logWarn('automations', 'No se pudo crear automation_run', {
        rule_key: rule.key,
        alumno_id: alumnoId
      });
      return null;
    }

    // 2. Obtener rule_key para auditoría y contexto
    const ruleKey = rule.key;

    // 3. Registrar evento de auditoría
    await logAuditEvent({
      actor: 'system',
      actorId: 'automation_engine',
      alumnoId: alumnoId,
      action: 'automation_run_started',
      entityType: 'automation_run',
      entityId: run.id,
      payload: {
        rule_key: ruleKey,
        reason,
        trigger_data: triggerMatch.triggerData
      }
    }).catch(err => {
      // Fail-open: continuar aunque falle la auditoría
      logWarn('automations', 'Error registrando auditoría de run_started', {
        error: err.message
      });
    });

    // 3. Crear jobs para cada acción
    const actions = rule.actions || [];
    const jobs = [];

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const stepKey = action.step_key || action.type || `action_${i}`;
      const executeAt = action.delay_seconds 
        ? new Date(Date.now() + (action.delay_seconds * 1000))
        : new Date(); // Ejecutar inmediatamente si no hay delay

      try {
        const jobResult = await query(`
          INSERT INTO automation_jobs (
            run_id, step_key, execute_at, status, payload
          ) VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `, [
          run.id,
          stepKey,
          executeAt,
          'queued',
          JSON.stringify(action.payload || {})
        ]);

        if (jobResult.rows[0]) {
          jobs.push(jobResult.rows[0]);
        }
      } catch (jobError) {
        logError('automations', 'Error creando job', {
          error: jobError.message,
          rule_key: rule.key,
          step_key: stepKey,
          run_id: run.id
        });
        // Continuar con siguiente job (fail-open)
      }
    }

    logInfo('automations', 'Run planificado exitosamente', {
      rule_key: rule.key,
      alumno_id: alumnoId,
      run_id: run.id,
      jobs_created: jobs.length
    });

    return {
      ...run,
      rule_key: ruleKey,
      jobs
    };
  } catch (error) {
    logError('automations', 'Error planificando run', {
      error: error.message,
      rule_key: rule.key,
      alumno_id: alumnoId,
      stack: error.stack?.substring(0, 200)
    });
    return null;
  }
}

