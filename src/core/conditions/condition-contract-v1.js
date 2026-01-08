// src/core/conditions/condition-contract-v1.js
// Condition Contract v1 - Contrato Canónico de Condiciones Declarativas
//
// PROPÓSITO:
// Define el contrato canónico para condiciones declarativas que pueden ser
// evaluadas por Condition Engine v1 sin usar eval() o Function().
//
// REGLAS:
// - Sin eval(), sin Function(), sin hacks
// - Contrato JSON puro
// - Validación estricta
// - Extensible sin romper compatibilidad

/**
 * Valida que una definición de condición cumple el contrato v1.
 * 
 * @param {Object} def - Definición de condición
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateConditionContractV1(def) {
  const errors = [];
  
  if (!def || typeof def !== 'object') {
    return { valid: false, errors: ['Condition definition must be an object'] };
  }
  
  // Debe tener exactamente una de: all, any
  const hasAll = 'all' in def;
  const hasAny = 'any' in def;
  
  if (!hasAll && !hasAny) {
    errors.push('Condition must have either "all" or "any" property');
  }
  
  if (hasAll && hasAny) {
    errors.push('Condition cannot have both "all" and "any" properties');
  }
  
  // Validar all
  if (hasAll) {
    if (!Array.isArray(def.all)) {
      errors.push('"all" must be an array');
    } else {
      def.all.forEach((clause, index) => {
        const clauseErrors = validateClause(clause, `all[${index}]`);
        errors.push(...clauseErrors);
      });
    }
  }
  
  // Validar any
  if (hasAny) {
    if (!Array.isArray(def.any)) {
      errors.push('"any" must be an array');
    } else {
      def.any.forEach((clause, index) => {
        const clauseErrors = validateClause(clause, `any[${index}]`);
        errors.push(...clauseErrors);
      });
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Valida una cláusula individual.
 * 
 * @param {Object} clause - Cláusula a validar
 * @param {string} path - Ruta de la cláusula (para errores)
 * @returns {string[]} Array de errores (vacío si válido)
 */
function validateClause(clause, path) {
  const errors = [];
  
  if (!clause || typeof clause !== 'object') {
    errors.push(`${path}: Clause must be an object`);
    return errors;
  }
  
  // path es obligatorio
  if (!('path' in clause) || typeof clause.path !== 'string') {
    errors.push(`${path}: Clause must have "path" as string`);
  }
  
  // op es obligatorio
  if (!('op' in clause) || typeof clause.op !== 'string') {
    errors.push(`${path}: Clause must have "op" as string`);
  } else {
    // Validar que op es válida
    const validOps = ['==', '!=', '>', '>=', '<', '<=', 'in', 'contains', 'exists', 'truthy'];
    if (!validOps.includes(clause.op)) {
      errors.push(`${path}: Invalid operator "${clause.op}". Valid: ${validOps.join(', ')}`);
    }
  }
  
  // value es opcional (no requerido para exists, truthy)
  if ('value' in clause && clause.value === undefined) {
    errors.push(`${path}: "value" cannot be undefined (use null or omit)`);
  }
  
  return errors;
}

/**
 * Obtiene el tipo de condición (all o any).
 * 
 * @param {Object} def - Definición de condición
 * @returns {string|null} 'all', 'any', o null si inválida
 */
export function getConditionType(def) {
  if (!def || typeof def !== 'object') return null;
  if ('all' in def) return 'all';
  if ('any' in def) return 'any';
  return null;
}

/**
 * Obtiene las cláusulas de una condición.
 * 
 * @param {Object} def - Definición de condición
 * @returns {Array} Array de cláusulas
 */
export function getConditionClauses(def) {
  const type = getConditionType(def);
  if (!type) return [];
  return def[type] || [];
}
