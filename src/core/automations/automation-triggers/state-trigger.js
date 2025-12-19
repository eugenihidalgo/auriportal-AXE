// src/core/automations/automation-triggers/state-trigger.js
// Trigger de tipo 'state' (AUTO-1)
//
// RESPONSABILIDAD:
// - Evaluar si un cambio de estado coincide con el trigger_def
// - Trigger implementado: level_reached

import { logInfo, logWarn } from '../../observability/logger.js';

/**
 * Evalúa si un trigger de tipo 'state' coincide
 * 
 * @param {object} rule - Regla de automatización
 * @param {object} ctx - Contexto del alumno
 * @param {object} [event] - Evento que disparó (opcional, no usado en state triggers)
 * @returns {Promise<{matched: boolean, data: object}>} Resultado
 */
export async function matches(rule, ctx, event = null) {
  try {
    const triggerDef = rule.trigger_def || {};
    const stateType = triggerDef.state_type;

    if (!stateType) {
      logWarn('automations', 'Trigger state sin state_type', {
        rule_key: rule.key
      });
      return { matched: false, data: {} };
    }

    // Evaluar según tipo de estado
    if (stateType === 'level_reached') {
      return evaluateLevelReached(rule, ctx, triggerDef);
    }

    logWarn('automations', 'Tipo de state trigger desconocido', {
      state_type: stateType,
      rule_key: rule.key
    });
    return { matched: false, data: {} };
  } catch (error) {
    logWarn('automations', 'Error evaluando trigger state', {
      error: error.message,
      rule_key: rule.key
    });
    return { matched: false, data: {} };
  }
}

/**
 * Evalúa trigger 'level_reached'
 * 
 * @param {object} rule - Regla
 * @param {object} ctx - Contexto
 * @param {object} triggerDef - Definición del trigger
 * @returns {{matched: boolean, data: object}} Resultado
 */
function evaluateLevelReached(rule, ctx, triggerDef) {
  const targetLevel = triggerDef.level;
  if (!targetLevel) {
    logWarn('automations', 'Trigger level_reached sin level', {
      rule_key: rule.key
    });
    return { matched: false, data: {} };
  }

  // Obtener nivel efectivo del contexto
  const nivelEfectivo = ctx.progress?.nivel_efectivo 
    || ctx.nivelInfo?.nivel_efectivo 
    || ctx.student?.nivel_actual 
    || 0;

  // Verificar si el nivel alcanzado es igual o mayor al objetivo
  const matched = Number(nivelEfectivo) >= Number(targetLevel);

  if (matched) {
    logInfo('automations', 'Trigger level_reached coincide', {
      rule_key: rule.key,
      nivel_efectivo: nivelEfectivo,
      target_level: targetLevel
    });
  }

  return {
    matched,
    data: {
      nivel_efectivo: nivelEfectivo,
      target_level: targetLevel
    }
  };
}












