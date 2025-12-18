// src/core/automations/automation-triggers/event-trigger.js
// Trigger de tipo 'event' (AUTO-1)
//
// RESPONSABILIDAD:
// - Evaluar si un evento coincide con el trigger_def
// - Triggers implementados: pause_create, pause_end

import { logInfo, logWarn } from '../../observability/logger.js';

/**
 * Evalúa si un trigger de tipo 'event' coincide
 * 
 * @param {object} rule - Regla de automatización
 * @param {object} ctx - Contexto del alumno
 * @param {object} [event] - Evento que disparó (opcional)
 * @returns {Promise<{matched: boolean, data: object}>} Resultado
 */
export async function matches(rule, ctx, event = null) {
  try {
    const triggerDef = rule.trigger_def || {};
    const eventName = triggerDef.event;

    if (!eventName) {
      logWarn('automations', 'Trigger event sin event name', {
        rule_key: rule.key
      });
      return { matched: false, data: {} };
    }

    // Si no hay evento, no coincide (necesitamos el evento para triggers de tipo 'event')
    if (!event) {
      return { matched: false, data: {} };
    }

    // Verificar si el evento coincide
    const eventAction = event.action || event.event_type;
    if (eventAction !== eventName) {
      return { matched: false, data: {} };
    }

    // Verificar que el evento sea del alumno correcto (si aplica)
    if (event.alumno_id && ctx.student?.id && event.alumno_id !== ctx.student.id) {
      return { matched: false, data: {} };
    }

    logInfo('automations', 'Trigger event coincide', {
      rule_key: rule.key,
      event_name: eventName,
      event_action: eventAction
    });

    return {
      matched: true,
      data: {
        event_name: eventName,
        event_id: event.id,
        event_created_at: event.created_at
      }
    };
  } catch (error) {
    logWarn('automations', 'Error evaluando trigger event', {
      error: error.message,
      rule_key: rule.key
    });
    return { matched: false, data: {} };
  }
}










