// src/core/automations/automation-engine.js
// Motor de Automatizaciones - Orquestador Principal (AUTO-1)
//
// RESPONSABILIDAD:
// - Orquestar evaluación + planificación
// - Punto de entrada único: runAutomationsForAlumno(alumnoId, reason)
//
// REGLAS:
// - Fail-open: si falla, loguear y continuar
// - No debe romper ninguna operación si falla
// - Auditoría total de ejecuciones

import { query } from '../../../database/pg.js';
import { logInfo, logWarn, logError } from '../observability/logger.js';
import { buildStudentContext } from '../student-context.js';
import { isFeatureEnabled } from '../flags/feature-flags.js';
import { evaluateTriggers } from './automation-evaluator.js';
import { planAutomationRun } from './automation-planner.js';

/**
 * Ejecuta automatizaciones para un alumno
 * 
 * @param {number} alumnoId - ID del alumno
 * @param {string} reason - Razón de la ejecución (ej: 'pause_end', 'level_reached')
 * @param {object} [event] - Evento que disparó (opcional, para triggers de tipo 'event')
 * @param {object} [env] - Variables de entorno
 * @param {Request} [request] - Request object (opcional, para contexto)
 * @returns {Promise<{ok: boolean, runs: Array}>} Resultado de la ejecución
 */
export async function runAutomationsForAlumno(alumnoId, reason, event = null, env = null, request = null) {
  try {
    logInfo('automations', 'Iniciando ejecución de automatizaciones', {
      alumno_id: alumnoId,
      reason
    });

    // 1. Cargar reglas candidatas (status ON o BETA)
    const rules = await loadCandidateRules();
    if (rules.length === 0) {
      logInfo('automations', 'No hay reglas candidatas', { alumno_id: alumnoId });
      return { ok: true, runs: [] };
    }

    // 2. Cargar contexto del alumno (studentContext)
    // NOTA: Si no tenemos request/env, construimos un contexto mínimo
    let studentContext = null;
    if (request && env) {
      try {
        const contextResult = await buildStudentContext(request, env);
        if (contextResult.ok) {
          studentContext = contextResult.ctx;
        }
      } catch (ctxError) {
        logWarn('automations', 'Error construyendo studentContext, usando contexto mínimo', {
          error: ctxError.message,
          alumno_id: alumnoId
        });
      }
    }

    // Si no tenemos contexto completo, cargar datos mínimos del alumno
    if (!studentContext) {
      const alumnoResult = await query(
        'SELECT * FROM alumnos WHERE id = $1',
        [alumnoId]
      );
      if (alumnoResult.rows.length === 0) {
        logWarn('automations', 'Alumno no encontrado', { alumno_id: alumnoId });
        return { ok: false, runs: [] };
      }
      studentContext = {
        student: alumnoResult.rows[0],
        alumno_id: alumnoId
      };
    }

    // 3. Evaluar reglas y crear runs
    const runs = [];
    for (const rule of rules) {
      try {
        // Verificar feature flag para reglas BETA
        if (rule.status === 'beta') {
          const betaEnabled = isFeatureEnabled('automations_beta', { student: studentContext.student });
          if (!betaEnabled) {
            logInfo('automations', 'Regla beta desactivada por feature flag', {
              rule_key: rule.key,
              alumno_id: alumnoId
            });
            continue;
          }
        }

        // Verificar si hay pausa activa (excepto si la regla lo permite)
        if (studentContext.pausas && studentContext.pausas.activa === true) {
          // Verificar si la regla permite ejecutarse durante pausas
          const allowDuringPause = rule.trigger_def?.allow_during_pause === true;
          if (!allowDuringPause) {
            logInfo('automations', 'Regla bloqueada por pausa activa', {
              rule_key: rule.key,
              alumno_id: alumnoId
            });
            continue;
          }
        }

        // Evaluar trigger
        const triggerMatch = await evaluateTriggers(rule, studentContext, event);
        if (!triggerMatch.matched) {
          continue; // Trigger no coincide, saltar regla
        }

        // Planificar ejecución (crear automation_run y automation_jobs)
        const run = await planAutomationRun(rule, alumnoId, studentContext, reason, triggerMatch);
        if (run) {
          runs.push(run);
        }
      } catch (ruleError) {
        logError('automations', 'Error procesando regla', {
          error: ruleError.message,
          rule_key: rule.key,
          alumno_id: alumnoId,
          stack: ruleError.stack?.substring(0, 200)
        });
        // Continuar con siguiente regla (fail-open)
      }
    }

    logInfo('automations', 'Ejecución de automatizaciones completada', {
      alumno_id: alumnoId,
      reason,
      runs_created: runs.length
    });

    return { ok: true, runs };
  } catch (error) {
    // Fail-open: loguear error pero no fallar
    logError('automations', 'Error crítico en runAutomationsForAlumno', {
      error: error.message,
      alumno_id: alumnoId,
      reason,
      stack: error.stack?.substring(0, 500)
    });
    return { ok: false, runs: [] };
  }
}

/**
 * Carga reglas candidatas (status ON o BETA)
 * 
 * @returns {Promise<Array>} Array de reglas
 */
async function loadCandidateRules() {
  try {
    const result = await query(`
      SELECT * FROM automation_rules
      WHERE status IN ('on', 'beta')
      ORDER BY priority DESC, created_at ASC
    `);
    return result.rows || [];
  } catch (error) {
    logError('automations', 'Error cargando reglas candidatas', {
      error: error.message
    });
    return [];
  }
}









