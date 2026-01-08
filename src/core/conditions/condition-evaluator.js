// src/core/conditions/condition-evaluator.js
// Condition Evaluator v1 - Evaluador Canónico de Condiciones Declarativas
//
// PROPÓSITO:
// Evalúa condiciones declarativas usando el contrato v1 sin usar eval() o Function().
//
// REGLAS:
// - Sin eval(), sin Function(), sin hacks
// - Context mínimo: { now_iso, student, line, level }
// - Retorna { ok: boolean, missing: string[] }
// - Fail-safe: si no puede evaluar, retorna { ok: false, missing: ['...'] }

import { validateConditionContractV1, getConditionType, getConditionClauses } from './condition-contract-v1.js';

/**
 * Evalúa una condición declarativa contra un contexto.
 * 
 * @param {Object} def - Definición de condición (contrato v1)
 * @param {Object} ctx - Contexto de evaluación
 * @param {string} ctx.now_iso - Fecha actual en ISO string
 * @param {Object} ctx.student - Datos del estudiante { id, uuid, email, apodo, created_at }
 * @param {Object} ctx.line - Datos de la línea { line_key }
 * @param {Object} ctx.level - Datos del nivel { started_at, frozen_seconds, computed_days, current_level_number, next_level_number, next_level_min_days }
 * @returns {Promise<Object>} { ok: boolean, missing: string[] }
 */
export async function evaluateCondition(def, ctx) {
  // Validar contrato
  const validation = validateConditionContractV1(def);
  if (!validation.valid) {
    return {
      ok: false,
      missing: validation.errors
    };
  }
  
  const type = getConditionType(def);
  const clauses = getConditionClauses(def);
  
  if (clauses.length === 0) {
    return { ok: true, missing: [] };
  }
  
  // Evaluar cláusulas
  const clauseResults = [];
  const missing = [];
  
  for (const clause of clauses) {
    try {
      const result = await evaluateClause(clause, ctx);
      clauseResults.push(result);
      if (result.missing && result.missing.length > 0) {
        missing.push(...result.missing);
      }
    } catch (error) {
      // Si falla la evaluación, considerar como missing
      missing.push(`clause evaluation error: ${error.message}`);
      clauseResults.push({ ok: false });
    }
  }
  
  // Aplicar lógica all/any
  let ok;
  if (type === 'all') {
    ok = clauseResults.every(r => r.ok === true);
  } else if (type === 'any') {
    ok = clauseResults.some(r => r.ok === true);
  } else {
    ok = false;
    missing.push('Invalid condition type');
  }
  
  return { ok, missing: [...new Set(missing)] };
}

/**
 * Evalúa una cláusula individual.
 * 
 * @param {Object} clause - Cláusula { path, op, value? }
 * @param {Object} ctx - Contexto
 * @returns {Promise<Object>} { ok: boolean, missing?: string[] }
 */
async function evaluateClause(clause, ctx) {
  const { path, op, value } = clause;
  
  // Resolver valor del path
  const pathValue = resolvePath(path, ctx);
  
  // Si el path no existe y no es 'exists', es missing
  if (pathValue === undefined && op !== 'exists') {
    return { ok: false, missing: [`path not found: ${path}`] };
  }
  
  // Evaluar según operador
  switch (op) {
    case '==':
      return { ok: pathValue == value }; // Usar == para coerción de tipos
      
    case '!=':
      return { ok: pathValue != value };
      
    case '>':
      return { ok: Number(pathValue) > Number(value) };
      
    case '>=':
      return { ok: Number(pathValue) >= Number(value) };
      
    case '<':
      return { ok: Number(pathValue) < Number(value) };
      
    case '<=':
      return { ok: Number(pathValue) <= Number(value) };
      
    case 'in':
      if (!Array.isArray(value)) {
        return { ok: false, missing: [`"in" operator requires array value`] };
      }
      return { ok: value.includes(pathValue) };
      
    case 'contains':
      if (typeof pathValue !== 'string' && !Array.isArray(pathValue)) {
        return { ok: false, missing: [`"contains" requires string or array path value`] };
      }
      if (typeof pathValue === 'string') {
        return { ok: pathValue.includes(String(value)) };
      }
      return { ok: pathValue.includes(value) };
      
    case 'exists':
      return { ok: pathValue !== undefined };
      
    case 'truthy':
      return { ok: Boolean(pathValue) };
      
    default:
      return { ok: false, missing: [`Unknown operator: ${op}`] };
  }
}

/**
 * Resuelve un path en el contexto.
 * 
 * @param {string} path - Path (ej: "student.email", "level.computed_days")
 * @param {Object} ctx - Contexto
 * @returns {*} Valor del path o undefined
 */
function resolvePath(path, ctx) {
  if (!path || typeof path !== 'string') {
    return undefined;
  }
  
  const parts = path.split('.');
  let current = ctx;
  
  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = current[part];
  }
  
  return current;
}
