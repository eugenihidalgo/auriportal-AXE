// context-validation.js
// Validación de contextos contra Context Registry
//
// Responsabilidades:
// - Validar existencia de context_key en registry
// - Validar tipos y valores
// - Validar enums
// - Aplicar coerciones seguras
// - Detectar campos UX usados incorrectamente

import { getContext } from '../../services/pde-contexts-service.js';
import { getDefaultValueForType } from '../contexts/context-registry.js';

/**
 * Valida un valor resuelto contra la definición del contexto en el registry
 * 
 * @param {string} context_key - Clave del contexto
 * @param {any} value - Valor a validar
 * @param {Object} registryDefinition - Definición del contexto en el registry (opcional, se busca si no se proporciona)
 * @returns {Promise<Object>} { valid: boolean, coerced_value: any, warnings: string[], errors: string[] }
 */
export async function validateContextValue(context_key, value, registryDefinition = null) {
  const warnings = [];
  const errors = [];
  let coercedValue = value;

  // Obtener definición del registry si no se proporciona
  let definition = registryDefinition;
  if (!definition) {
    try {
      const contextDef = await getContext(context_key);
      if (contextDef && contextDef.definition) {
        definition = contextDef.definition;
      } else if (contextDef) {
        // Si contextDef existe pero no tiene definition, construir desde campos directos
        definition = {
          type: contextDef.type || 'string',
          allowed_values: contextDef.allowed_values || null,
          default_value: contextDef.default_value !== undefined ? contextDef.default_value : null
        };
      }
    } catch (error) {
      // Si no se encuentra, usar defaults seguros (fail-open)
      warnings.push(`Context '${context_key}' not found in registry, using safe defaults`);
      definition = {
        type: 'string',
        allowed_values: null,
        default_value: null
      };
    }
  }

  if (!definition) {
    // No hay definición → usar tipo string por defecto (fail-open)
    warnings.push(`No definition available for context '${context_key}', assuming type 'string'`);
    return {
      valid: true,
      coerced_value: value,
      warnings,
      errors
    };
  }

  const { type, allowed_values, default_value } = definition;

  // Validar tipo y aplicar coerciones seguras
  const typeValidation = validateAndCoerceType(value, type, context_key);
  if (!typeValidation.valid) {
    errors.push(...typeValidation.errors);
    warnings.push(...typeValidation.warnings);
  }
  coercedValue = typeValidation.coerced_value !== undefined ? typeValidation.coerced_value : value;

  // Validar enum si aplica
  if (type === 'enum' && allowed_values && Array.isArray(allowed_values)) {
    if (!allowed_values.includes(coercedValue)) {
      warnings.push(`Value '${coercedValue}' not in allowed_values for context '${context_key}', using default or first allowed value`);
      
      // Fail-open: usar default_value o primer valor de allowed_values
      if (default_value !== null && default_value !== undefined && allowed_values.includes(default_value)) {
        coercedValue = default_value;
      } else if (allowed_values.length > 0) {
        coercedValue = allowed_values[0];
      } else {
        errors.push(`Context '${context_key}' has empty allowed_values`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    coerced_value: coercedValue,
    warnings,
    errors
  };
}

/**
 * Valida y aplica coerción de tipo de forma segura
 * 
 * @param {any} value - Valor a validar/coercer
 * @param {string} expectedType - Tipo esperado
 * @param {string} context_key - Clave del contexto (para warnings)
 * @returns {Object} { valid: boolean, coerced_value: any, warnings: string[], errors: string[] }
 */
function validateAndCoerceType(value, expectedType, context_key) {
  const warnings = [];
  const errors = [];

  // Si el valor es null o undefined, no se puede validar/coercer (se maneja en precedence)
  if (value === null || value === undefined) {
    return { valid: true, coerced_value: value, warnings, errors };
  }

  switch (expectedType) {
    case 'string':
      if (typeof value !== 'string') {
        // Coerción segura: convertir a string
        const coerced = String(value);
        warnings.push(`Coerced value to string for context '${context_key}': ${JSON.stringify(value)} → "${coerced}"`);
        return { valid: true, coerced_value: coerced, warnings, errors };
      }
      return { valid: true, coerced_value: value, warnings, errors };

    case 'number':
      if (typeof value !== 'number') {
        // Coerción segura: convertir a number si es posible
        const coerced = Number(value);
        if (!isNaN(coerced)) {
          warnings.push(`Coerced value to number for context '${context_key}': ${JSON.stringify(value)} → ${coerced}`);
          return { valid: true, coerced_value: coerced, warnings, errors };
        } else {
          errors.push(`Cannot coerce value to number for context '${context_key}': ${JSON.stringify(value)}`);
          return { valid: false, coerced_value: value, warnings, errors };
        }
      }
      return { valid: true, coerced_value: value, warnings, errors };

    case 'boolean':
      if (typeof value !== 'boolean') {
        // Coerción segura: convertir strings 'true'/'false' a boolean
        if (value === 'true' || value === true || value === 1 || value === '1') {
          warnings.push(`Coerced value to boolean for context '${context_key}': ${JSON.stringify(value)} → true`);
          return { valid: true, coerced_value: true, warnings, errors };
        } else if (value === 'false' || value === false || value === 0 || value === '0') {
          warnings.push(`Coerced value to boolean for context '${context_key}': ${JSON.stringify(value)} → false`);
          return { valid: true, coerced_value: false, warnings, errors };
        } else {
          errors.push(`Cannot coerce value to boolean for context '${context_key}': ${JSON.stringify(value)}`);
          return { valid: false, coerced_value: value, warnings, errors };
        }
      }
      return { valid: true, coerced_value: value, warnings, errors };

    case 'json':
      if (typeof value !== 'object' || value === null) {
        // Intentar parsear como JSON si es string
        if (typeof value === 'string') {
          try {
            const coerced = JSON.parse(value);
            warnings.push(`Coerced JSON string to object for context '${context_key}'`);
            return { valid: true, coerced_value: coerced, warnings, errors };
          } catch (parseError) {
            errors.push(`Cannot parse JSON string for context '${context_key}': ${parseError.message}`);
            return { valid: false, coerced_value: value, warnings, errors };
          }
        } else {
          errors.push(`Value must be object or JSON string for context '${context_key}'`);
          return { valid: false, coerced_value: value, warnings, errors };
        }
      }
      return { valid: true, coerced_value: value, warnings, errors };

    case 'enum':
      // Enum se valida después en validateContextValue
      return { valid: true, coerced_value: value, warnings, errors };

    default:
      // Tipo desconocido → asumir string (fail-open)
      warnings.push(`Unknown type '${expectedType}' for context '${context_key}', treating as string`);
      const coerced = String(value);
      return { valid: true, coerced_value: coerced, warnings, errors };
  }
}

/**
 * Obtiene el valor fail-open seguro según el tipo
 * 
 * @param {string} type - Tipo del contexto
 * @param {any[]} [allowed_values] - Valores permitidos (para enum)
 * @returns {any} Valor fail-open seguro
 */
export function getFailOpenValue(type, allowed_values = null) {
  if (type === 'enum' && allowed_values && Array.isArray(allowed_values) && allowed_values.length > 0) {
    // Para enum, usar el primer valor permitido
    return allowed_values[0];
  }

  return getDefaultValueForType(type);
}
