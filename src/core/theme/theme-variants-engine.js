// theme-variants-engine.js
// Theme Variants Engine v1 - Motor de evaluación de variantes condicionales
//
// PRINCIPIOS:
// 1. Fail-open absoluto: si falla, ignora y continúa
// 2. Determinismo: mismo input → mismo output
// 3. Sin eval/Function: DSL seguro
// 4. Solo presentación: no lógica de negocio

import { getAllContractVariables } from './theme-contract.js';

/**
 * Evalúa una condición de variante contra contextos resueltos
 * 
 * @param {Object} options - Opciones de evaluación
 * @param {Object} options.when - Condición a evaluar (ThemeVariantCondition)
 * @param {Object} options.ctx - Contextos resueltos (mapa plano de context_key -> value)
 * @returns {{ok: boolean, warnings: string[]}} Resultado de evaluación
 */
export function evaluateThemeWhen({ when, ctx }) {
  const warnings = [];
  
  if (!when || typeof when !== 'object') {
    warnings.push('Condition "when" is invalid (must be an object)');
    return { ok: false, warnings };
  }
  
  if (!ctx || typeof ctx !== 'object') {
    warnings.push('Context "ctx" is invalid (must be an object)');
    return { ok: false, warnings };
  }
  
  try {
    const result = evaluateCondition(when, ctx, warnings);
    return { ok: result, warnings };
  } catch (error) {
    warnings.push(`Error evaluating condition: ${error.message}`);
    return { ok: false, warnings };
  }
}

/**
 * Evalúa una condición recursivamente
 * 
 * @param {Object} condition - Condición a evaluar
 * @param {Object} ctx - Contextos resueltos
 * @param {string[]} warnings - Array de warnings (mutado)
 * @returns {boolean} true si la condición se cumple
 */
function evaluateCondition(condition, ctx, warnings) {
  if (!condition || typeof condition !== 'object') {
    return false;
  }
  
  // Logical conditions: all, any, not
  if ('all' in condition) {
    return evaluateAll(condition.all, ctx, warnings);
  }
  
  if ('any' in condition) {
    return evaluateAny(condition.any, ctx, warnings);
  }
  
  if ('not' in condition) {
    return !evaluateCondition(condition.not, ctx, warnings);
  }
  
  // Simple or comparison condition: { key: value } or { key: { op: value } }
  const keys = Object.keys(condition);
  if (keys.length === 0) {
    return false;
  }
  
  // Si tiene más de una key, evaluar como "all" implícito
  if (keys.length > 1) {
    return evaluateAll(keys.map(key => ({ [key]: condition[key] })), ctx, warnings);
  }
  
  const contextKey = keys[0];
  const conditionValue = condition[contextKey];
  
  // Si el contexto no existe
  if (!(contextKey in ctx)) {
    warnings.push(`Context "${contextKey}" not found in resolvedContexts`);
    return false;
  }
  
  const ctxValue = ctx[contextKey];
  
  // Comparison condition: { key: { op: value } }
  if (conditionValue && typeof conditionValue === 'object' && !Array.isArray(conditionValue)) {
    return evaluateComparison(contextKey, ctxValue, conditionValue, warnings);
  }
  
  // Simple condition: { key: value } (equality)
  return ctxValue === conditionValue;
}

/**
 * Evalúa condición "all" (todas deben cumplirse)
 */
function evaluateAll(conditions, ctx, warnings) {
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return false;
  }
  
  for (const condition of conditions) {
    if (!evaluateCondition(condition, ctx, warnings)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Evalúa condición "any" (al menos una debe cumplirse)
 */
function evaluateAny(conditions, ctx, warnings) {
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return false;
  }
  
  for (const condition of conditions) {
    if (evaluateCondition(condition, ctx, warnings)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Evalúa comparación con operadores
 * 
 * @param {string} contextKey - Clave del contexto
 * @param {any} ctxValue - Valor del contexto
 * @param {Object} comparison - Objeto de comparación { op: value }
 * @param {string[]} warnings - Array de warnings
 * @returns {boolean} true si la comparación se cumple
 */
function evaluateComparison(contextKey, ctxValue, comparison, warnings) {
  const operators = Object.keys(comparison);
  
  if (operators.length === 0) {
    return false;
  }
  
  // Si hay múltiples operadores, evaluar como "all" implícito
  if (operators.length > 1) {
    return evaluateAll(
      operators.map(op => ({ [contextKey]: { [op]: comparison[op] } })),
      { [contextKey]: ctxValue },
      warnings
    );
  }
  
  const op = operators[0];
  const opValue = comparison[op];
  
  switch (op) {
    case '==':
      return ctxValue === opValue;
      
    case '!=':
      return ctxValue !== opValue;
      
    case '>':
      if (typeof ctxValue !== 'number' || typeof opValue !== 'number') {
        warnings.push(`Comparison ">" requires numbers for "${contextKey}"`);
        return false;
      }
      return ctxValue > opValue;
      
    case '>=':
      if (typeof ctxValue !== 'number' || typeof opValue !== 'number') {
        warnings.push(`Comparison ">=" requires numbers for "${contextKey}"`);
        return false;
      }
      return ctxValue >= opValue;
      
    case '<':
      if (typeof ctxValue !== 'number' || typeof opValue !== 'number') {
        warnings.push(`Comparison "<" requires numbers for "${contextKey}"`);
        return false;
      }
      return ctxValue < opValue;
      
    case '<=':
      if (typeof ctxValue !== 'number' || typeof opValue !== 'number') {
        warnings.push(`Comparison "<=" requires numbers for "${contextKey}"`);
        return false;
      }
      return ctxValue <= opValue;
      
    case 'exists':
      if (typeof opValue !== 'boolean') {
        warnings.push(`Comparison "exists" requires boolean value for "${contextKey}"`);
        return false;
      }
      // exists: true significa que el valor debe existir (no undefined/null)
      // exists: false significa que el valor NO debe existir (undefined/null)
      const exists = ctxValue !== undefined && ctxValue !== null;
      return opValue ? exists : !exists;
      
    default:
      warnings.push(`Unknown comparison operator "${op}" for "${contextKey}"`);
      return false;
  }
}

/**
 * Aplica variantes a tokens base
 * 
 * @param {Object} options - Opciones de aplicación
 * @param {Object<string, string>} options.baseTokens - Tokens base del tema
 * @param {Array} options.variants - Array de variantes a evaluar
 * @param {Object} options.ctx - Contextos resueltos
 * @param {string[]} options.contract - Lista de variables válidas del contrato
 * @returns {{tokens: Object, appliedVariants: string[], warnings: string[]}} Resultado
 */
export function applyThemeVariants({ baseTokens, variants, ctx, contract }) {
  const warnings = [];
  const appliedVariants = [];
  let effectiveTokens = { ...baseTokens };
  
  if (!variants || !Array.isArray(variants) || variants.length === 0) {
    return { tokens: effectiveTokens, appliedVariants: [], warnings: [] };
  }
  
  if (!ctx || typeof ctx !== 'object') {
    warnings.push('Context "ctx" is invalid, skipping variants');
    return { tokens: effectiveTokens, appliedVariants: [], warnings };
  }
  
  if (!contract || !Array.isArray(contract)) {
    warnings.push('Contract is invalid, skipping token validation');
  }
  
  const contractSet = contract ? new Set(contract) : null;
  let evaluatedCount = 0;
  
  // Evaluar variantes en orden
  for (let i = 0; i < variants.length; i++) {
    const variant = variants[i];
    evaluatedCount++;
    
    if (!variant || typeof variant !== 'object') {
      warnings.push(`Variant at index ${i} is invalid (must be an object)`);
      continue;
    }
    
    if (!variant.when) {
      warnings.push(`Variant at index ${i} missing "when" condition`);
      continue;
    }
    
    if (!variant.tokens || typeof variant.tokens !== 'object') {
      warnings.push(`Variant at index ${i} missing or invalid "tokens"`);
      continue;
    }
    
    // Evaluar condición
    let conditionResult;
    try {
      conditionResult = evaluateThemeWhen({ when: variant.when, ctx });
      warnings.push(...conditionResult.warnings);
    } catch (error) {
      warnings.push(`Error evaluating variant at index ${i}: ${error.message}`);
      continue;
    }
    
    // Si la condición no se cumple, continuar con la siguiente
    if (!conditionResult.ok) {
      continue;
    }
    
    // Aplicar tokens de la variante
    const variantName = variant.name || `variant-${i}`;
    appliedVariants.push(variantName);
    
    for (const [tokenKey, tokenValue] of Object.entries(variant.tokens)) {
      // Validar que el token está en el contrato
      if (contractSet && !contractSet.has(tokenKey)) {
        warnings.push(`Token "${tokenKey}" in variant "${variantName}" is not in Theme Contract, ignoring`);
        continue;
      }
      
      // Validar que el valor no es null/undefined
      if (tokenValue === null || tokenValue === undefined) {
        warnings.push(`Token "${tokenKey}" in variant "${variantName}" is null/undefined, ignoring`);
        continue;
      }
      
      // Validar que el valor es string
      if (typeof tokenValue !== 'string') {
        warnings.push(`Token "${tokenKey}" in variant "${variantName}" is not a string, ignoring`);
        continue;
      }
      
      // Aplicar override
      effectiveTokens[tokenKey] = tokenValue;
    }
  }
  
  return {
    tokens: effectiveTokens,
    appliedVariants,
    warnings,
    evaluatedCount
  };
}

