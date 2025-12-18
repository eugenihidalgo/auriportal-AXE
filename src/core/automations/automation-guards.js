// src/core/automations/automation-guards.js
// Evaluador de Guards (AUTO-1)
//
// RESPONSABILIDAD:
// - Evaluar guards simples (path equals, gte/lte, not, etc.)
// - NO implementar DSL complejo todavía

import { logInfo, logWarn } from '../observability/logger.js';

/**
 * Evalúa guards (condiciones adicionales)
 * 
 * @param {object} rule - Regla de automatización
 * @param {object} ctx - Contexto del alumno
 * @param {object} triggerData - Datos del trigger
 * @returns {Promise<{passed: boolean, reason: string}>} Resultado de la evaluación
 */
export async function evaluateGuards(rule, ctx, triggerData) {
  try {
    const guards = rule.guards || [];

    // Si no hay guards, pasar
    if (guards.length === 0) {
      return { passed: true, reason: 'no_guards' };
    }

    // Evaluar cada guard
    for (const guard of guards) {
      const guardType = guard.type || guard.operator;
      
      if (!guardType) {
        logWarn('automations', 'Guard sin tipo/operator', {
          rule_key: rule.key,
          guard
        });
        continue;
      }

      const result = evaluateGuard(guard, ctx, triggerData);
      if (!result.passed) {
        return { passed: false, reason: result.reason || `guard_${guardType}_failed` };
      }
    }

    return { passed: true, reason: 'all_guards_passed' };
  } catch (error) {
    logWarn('automations', 'Error evaluando guards', {
      error: error.message,
      rule_key: rule.key
    });
    // Fail-open: permitir ejecución si falla la evaluación
    return { passed: true, reason: 'guard_evaluation_error' };
  }
}

/**
 * Evalúa un guard individual
 * 
 * @param {object} guard - Guard a evaluar
 * @param {object} ctx - Contexto del alumno
 * @param {object} triggerData - Datos del trigger
 * @returns {{passed: boolean, reason: string}} Resultado
 */
function evaluateGuard(guard, ctx, triggerData) {
  const operator = guard.type || guard.operator;
  const path = guard.path;
  const value = guard.value;

  if (!path) {
    return { passed: false, reason: 'guard_missing_path' };
  }

  // Obtener valor del contexto usando path (ej: 'progress.nivel_efectivo')
  const contextValue = getValueByPath(ctx, path);

  switch (operator) {
    case 'equals':
    case 'eq':
      return {
        passed: contextValue === value,
        reason: contextValue === value ? null : `expected_${value}_got_${contextValue}`
      };

    case 'not_equals':
    case 'ne':
      return {
        passed: contextValue !== value,
        reason: contextValue !== value ? null : `expected_not_${value}_got_${contextValue}`
      };

    case 'gte':
    case 'greater_than_or_equal':
      return {
        passed: Number(contextValue) >= Number(value),
        reason: Number(contextValue) >= Number(value) ? null : `expected_gte_${value}_got_${contextValue}`
      };

    case 'lte':
    case 'less_than_or_equal':
      return {
        passed: Number(contextValue) <= Number(value),
        reason: Number(contextValue) <= Number(value) ? null : `expected_lte_${value}_got_${contextValue}`
      };

    case 'gt':
    case 'greater_than':
      return {
        passed: Number(contextValue) > Number(value),
        reason: Number(contextValue) > Number(value) ? null : `expected_gt_${value}_got_${contextValue}`
      };

    case 'lt':
    case 'less_than':
      return {
        passed: Number(contextValue) < Number(value),
        reason: Number(contextValue) < Number(value) ? null : `expected_lt_${value}_got_${contextValue}`
      };

    case 'not':
      // Guard de negación (evalúa otro guard y niega el resultado)
      if (!guard.guard) {
        return { passed: false, reason: 'not_guard_missing_guard' };
      }
      const innerResult = evaluateGuard(guard.guard, ctx, triggerData);
      return {
        passed: !innerResult.passed,
        reason: !innerResult.passed ? null : `not_guard_failed: ${innerResult.reason}`
      };

    case 'pattern_active':
    case 'pattern_includes':
      // Guard para verificar si un patrón está activo
      // path debe ser 'patterns.active' y value debe ser el pattern_key
      if (path === 'patterns.active' || path === 'patterns') {
        const patterns = ctx.patterns || {};
        const activePatterns = patterns.active || [];
        const patternKey = value || guard.pattern_key;
        
        if (!patternKey) {
          return { passed: false, reason: 'pattern_active_missing_pattern_key' };
        }

        // Verificar si el patrón está en la lista de activos
        const isActive = activePatterns.some(p => p.key === patternKey);
        
        return {
          passed: isActive,
          reason: isActive ? null : `pattern_${patternKey}_not_active`
        };
      }
      return { passed: false, reason: 'pattern_active_invalid_path' };

    default:
      logWarn('automations', 'Operador de guard desconocido', {
        operator,
        path
      });
      return { passed: true, reason: 'unknown_operator_allowed' };
  }
}

/**
 * Obtiene un valor del contexto usando un path (ej: 'progress.nivel_efectivo')
 * 
 * @param {object} ctx - Contexto
 * @param {string} path - Path del valor (ej: 'progress.nivel_efectivo')
 * @returns {any} Valor o null
 */
function getValueByPath(ctx, path) {
  if (!path) return null;

  const parts = path.split('.');
  let current = ctx;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return null;
    }
    current = current[part];
  }

  return current;
}

