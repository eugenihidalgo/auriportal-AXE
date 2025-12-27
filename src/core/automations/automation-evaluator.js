// src/core/automations/automation-evaluator.js
// Evaluador de Triggers y Guards (AUTO-1)
//
// RESPONSABILIDAD:
// - Evaluar si un trigger coincide
// - Evaluar guards (condiciones adicionales)
// - Verificar cooldowns

import { query } from '../../../database/pg.js';
import { logInfo, logWarn } from '../observability/logger.js';
import { evaluateGuards } from './automation-guards.js';
import * as triggerEvent from './automation-triggers/event-trigger.js';
import * as triggerState from './automation-triggers/state-trigger.js';

/**
 * Evalúa si un trigger coincide con el contexto
 * 
 * @param {object} rule - Regla de automatización
 * @param {object} ctx - Contexto del alumno (studentContext)
 * @param {object} [event] - Evento que disparó (opcional)
 * @returns {Promise<{matched: boolean, triggerData: object}>} Resultado de la evaluación
 */
export async function evaluateTriggers(rule, ctx, event = null) {
  try {
    const triggerType = rule.trigger_type;
    const triggerDef = rule.trigger_def || {};

    let matched = false;
    let triggerData = {};

    // Evaluar según tipo de trigger
    if (triggerType === 'event') {
      const result = await triggerEvent.matches(rule, ctx, event);
      matched = result.matched;
      triggerData = result.data || {};
    } else if (triggerType === 'state') {
      const result = await triggerState.matches(rule, ctx, event);
      matched = result.matched;
      triggerData = result.data || {};
    } else {
      logWarn('automations', 'Tipo de trigger desconocido', {
        trigger_type: triggerType,
        rule_key: rule.key
      });
      return { matched: false, triggerData: {} };
    }

    // Si el trigger no coincide, retornar
    if (!matched) {
      return { matched: false, triggerData: {} };
    }

    // Evaluar guards (condiciones adicionales)
    const guardsResult = await evaluateGuards(rule, ctx, triggerData);
    if (!guardsResult.passed) {
      logInfo('automations', 'Guards no pasaron', {
        rule_key: rule.key,
        reason: guardsResult.reason
      });
      return { matched: false, triggerData: {} };
    }

    // Verificar cooldown
    if (rule.cooldown_days) {
      const cooldownOk = await checkCooldown(rule.key, ctx.student?.id || ctx.alumno_id, rule.cooldown_days);
      if (!cooldownOk) {
        logInfo('automations', 'Regla en cooldown', {
          rule_key: rule.key,
          alumno_id: ctx.student?.id || ctx.alumno_id,
          cooldown_days: rule.cooldown_days
        });
        return { matched: false, triggerData: {} };
      }
    }

    return { matched: true, triggerData };
  } catch (error) {
    logWarn('automations', 'Error evaluando triggers', {
      error: error.message,
      rule_key: rule.key
    });
    return { matched: false, triggerData: {} };
  }
}

/**
 * Verifica si una regla está en cooldown
 * 
 * @param {string} ruleKey - Key de la regla
 * @param {number} alumnoId - ID del alumno
 * @param {number} cooldownDays - Días de cooldown
 * @returns {Promise<boolean>} true si puede ejecutarse, false si está en cooldown
 */
async function checkCooldown(ruleKey, alumnoId, cooldownDays) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - cooldownDays);

    const result = await query(`
      SELECT COUNT(*) as count
      FROM automation_runs ar
      JOIN automation_rules r ON ar.rule_id = r.id
      WHERE r.key = $1
        AND ar.alumno_id = $2
        AND ar.status = 'done'
        AND ar.created_at >= $3
    `, [ruleKey, alumnoId, cutoffDate]);

    const count = parseInt(result.rows[0]?.count || '0', 10);
    return count === 0; // Si no hay ejecuciones recientes, puede ejecutarse
  } catch (error) {
    logWarn('automations', 'Error verificando cooldown', {
      error: error.message,
      rule_key: ruleKey,
      alumno_id: alumnoId
    });
    // Fail-open: permitir ejecución si falla la verificación
    return true;
  }
}




















