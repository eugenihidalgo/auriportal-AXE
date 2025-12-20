// src/core/contexts/context-registry.js
// REGISTRY CANÓNICO DE CONTEXTOS (Context Registry v1)
//
// PRINCIPIO FUNDAMENTAL:
// Este es el ÚNICO lugar donde se definen los contextos del sistema por defecto.
// Los contextos de la DB pueden extender/sobrescribir estos defaults.
//
// REGLAS:
// 1. Fail-open absoluto: todo tiene default, nada bloquea
// 2. Centralizado y reutilizable: como Source-of-Truth Registry
// 3. Si falta un contexto, se crea "virtual" con default por tipo
// 4. Nunca throw por contextos faltantes. Solo warnings.

/**
 * Contextos del sistema (defaults canónicos)
 * 
 * Estructura:
 * - context_key: Clave única del contexto (slug)
 * - label: Etiqueta legible para mostrar en UI
 * - definition: Objeto con type, allowed_values, default_value, scope, origin, description
 * 
 * NOTA: Los contextos nivel_efectivo, tipo_limpieza y tipo_practica fueron eliminados
 * porque ya no existen realmente. Si se necesitan, deben crearse explícitamente en la DB.
 */
export const SYSTEM_CONTEXT_DEFAULTS = [
  // Contextos del sistema eliminados:
  // - nivel_efectivo (ya no existe, eliminado)
  // - tipo_limpieza (ya no existe, eliminado)
  // - tipo_practica (ya no existe, eliminado)
];

/**
 * Normaliza una definición de contexto rellenando defaults
 * 
 * PRINCIPIO: Fail-open - rellena todo lo que falta con defaults seguros
 * 
 * @param {Object} def - Definición de contexto (puede estar incompleta)
 * @returns {Object} Definición normalizada con todos los campos requeridos
 */
export function normalizeContextDefinition(def) {
  if (!def || typeof def !== 'object') {
    def = {};
  }

  const {
    type = 'string',
    allowed_values = [],
    default_value = null,
    scope = 'recorrido', // Default: recorrido (antes era 'workflow')
    origin = 'user_choice',
    description = '',
    usable_en_paquetes = false // Solo para contextos de sistema
  } = def;

  // Asegurar default_value según type si no está definido
  let normalizedDefault = default_value;
  if (normalizedDefault === null || normalizedDefault === undefined) {
    normalizedDefault = getDefaultValueForType(type);
  }

  // Si es enum y no tiene allowed_values, usar array vacío (warning se dará en validate)
  const normalizedAllowed = type === 'enum' ? (Array.isArray(allowed_values) ? allowed_values : []) : [];

  return {
    type,
    allowed_values: normalizedAllowed,
    default_value: normalizedDefault,
    scope,
    origin,
    description: description || '',
    usable_en_paquetes: scope === 'system' ? usable_en_paquetes : undefined // Solo para system
  };
}

/**
 * Valida una definición de contexto
 * 
 * PRINCIPIO: Fail-open - solo warnings si strict=false, throws solo si strict=true
 * 
 * @param {Object} def - Definición de contexto
 * @param {Object} options - Opciones de validación
 * @param {boolean} options.strict - Si true, lanza errores; si false, solo warnings
 * @returns {Object} { valid: boolean, warnings: string[], errors: string[] }
 */
export function validateContextDefinition(def, options = {}) {
  const { strict = false } = options;
  const warnings = [];
  const errors = [];

  if (!def || typeof def !== 'object') {
    const msg = 'Definición de contexto debe ser un objeto';
    if (strict) {
      errors.push(msg);
    } else {
      warnings.push(msg);
    }
    return { valid: errors.length === 0, warnings, errors };
  }

  const { type, allowed_values, default_value } = def;

  // Validar type
  const validTypes = ['string', 'number', 'boolean', 'enum', 'json'];
  if (!validTypes.includes(type)) {
    const msg = `Tipo de contexto inválido: ${type}. Debe ser uno de: ${validTypes.join(', ')}`;
    if (strict) {
      errors.push(msg);
    } else {
      warnings.push(`Tipo desconocido '${type}', se convertirá a 'string'`);
    }
  }

  // Validar enum
  if (type === 'enum') {
    if (!Array.isArray(allowed_values) || allowed_values.length === 0) {
      const msg = 'Tipo enum requiere allowed_values no vacío';
      if (strict) {
        errors.push(msg);
      } else {
        warnings.push(msg);
      }
    }
    if (default_value !== null && !allowed_values.includes(default_value)) {
      const msg = `default_value '${default_value}' no está en allowed_values`;
      if (strict) {
        errors.push(msg);
      } else {
        warnings.push(msg);
      }
    }
  }

  // Validar default_value según type
  if (default_value !== null && default_value !== undefined) {
    if (type === 'number' && typeof default_value !== 'number') {
      const msg = `default_value debe ser number para type 'number'`;
      if (strict) {
        errors.push(msg);
      } else {
        warnings.push(msg);
      }
    }
    if (type === 'boolean' && typeof default_value !== 'boolean') {
      const msg = `default_value debe ser boolean para type 'boolean'`;
      if (strict) {
        errors.push(msg);
      } else {
        warnings.push(msg);
      }
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors
  };
}

/**
 * Obtiene el valor por defecto según el tipo
 * 
 * @param {string} type - Tipo de contexto
 * @returns {any} Valor por defecto según el tipo
 */
export function getDefaultValueForType(type) {
  switch (type) {
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'enum':
      return null; // Requiere allowed_values
    case 'json':
      return {};
    case 'string':
    default:
      return '';
  }
}

/**
 * Obtiene el valor por defecto para un contexto
 * 
 * @param {Object} def - Definición de contexto normalizada
 * @returns {any} Valor por defecto
 */
export function getDefaultValueForContext(def) {
  if (!def || typeof def !== 'object') {
    return '';
  }

  const { default_value, type } = def;

  if (default_value !== null && default_value !== undefined) {
    return default_value;
  }

  return getDefaultValueForType(type);
}

/**
 * Combina valores de contexto de múltiples fuentes
 * 
 * PRINCIPIO: Fail-open - siempre devuelve un objeto completo
 * Orden de precedencia:
 * 1. runtimeValues (valores proporcionados en runtime)
 * 2. packageDefs (overrides del paquete)
 * 3. registryDefs (defaults del registry: DB + system)
 * 
 * @param {Object} options - Opciones de merge
 * @param {Object} options.registryDefs - Contextos del registry (DB + system)
 * @param {Object} options.packageDefs - Contextos definidos en el paquete
 * @param {Object} options.runtimeValues - Valores proporcionados en runtime
 * @returns {Object} Contexto resuelto con valores finales
 */
export function mergeContextValues({ registryDefs = {}, packageDefs = {}, runtimeValues = {} }) {
  const resolved = {};

  // Primero, aplicar defaults del registry
  for (const [key, def] of Object.entries(registryDefs)) {
    if (def && typeof def === 'object' && def.definition) {
      resolved[key] = getDefaultValueForContext(def.definition);
    }
  }

  // Segundo, aplicar overrides del paquete (si existen)
  for (const [key, value] of Object.entries(packageDefs)) {
    if (value !== null && value !== undefined) {
      resolved[key] = value;
    }
  }

  // Tercero, aplicar valores de runtime (máxima prioridad)
  for (const [key, value] of Object.entries(runtimeValues)) {
    if (value !== null && value !== undefined) {
      resolved[key] = value;
    }
  }

  return resolved;
}

/**
 * Valida que un context_key sea válido (slug)
 * 
 * @param {string} contextKey - Clave del contexto
 * @returns {boolean} true si es válido
 */
export function isValidContextKey(contextKey) {
  if (!contextKey || typeof contextKey !== 'string') {
    return false;
  }
  // Solo letras minúsculas, números, guiones bajos y guiones
  return /^[a-z0-9_-]+$/.test(contextKey);
}

