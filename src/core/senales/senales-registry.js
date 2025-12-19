// src/core/senales/senales-registry.js
// REGISTRY CANÓNICO DE SEÑALES (Señales Registry v1)
//
// PRINCIPIO FUNDAMENTAL:
// Este es el ÚNICO lugar donde se definen las señales del sistema por defecto.
// Las señales de la DB pueden extender/sobrescribir estos defaults.
//
// REGLAS:
// 1. Fail-open absoluto: todo tiene default, nada bloquea
// 2. Centralizado y reutilizable: como Source-of-Truth Registry
// 3. Si falta una señal, se crea "virtual" con default
// 4. Nunca throw por señales faltantes. Solo warnings.

/**
 * Señales del sistema (defaults canónicos)
 * 
 * Estructura:
 * - signal_key: Clave única de la señal (slug)
 * - label: Etiqueta legible para mostrar en UI
 * - description: Descripción opcional
 * - scope: global | workflow | step
 * - payload_schema: Schema JSON del payload
 * - default_payload: Payload por defecto
 * - tags: Array de tags
 * - origin: user | system
 */
export const SYSTEM_SIGNAL_DEFAULTS = [
  {
    signal_key: 'practica_completada',
    label: 'Práctica Completada',
    description: 'Se emite cuando un estudiante completa una práctica',
    scope: 'workflow',
    payload_schema: {
      type: 'object',
      properties: {
        practica_key: { type: 'string' },
        duracion_minutos: { type: 'number' }
      },
      required: ['practica_key']
    },
    default_payload: {},
    tags: ['streak', 'progress', 'analytics'],
    origin: 'system',
    order_index: 1
  },
  {
    signal_key: 'paquete_completado',
    label: 'Paquete Completado',
    description: 'Se emite cuando un estudiante completa un paquete de contenido',
    scope: 'workflow',
    payload_schema: {
      type: 'object',
      properties: {
        package_key: { type: 'string' }
      },
      required: ['package_key']
    },
    default_payload: {},
    tags: ['analytics'],
    origin: 'system',
    order_index: 2
  },
  {
    signal_key: 'step_completado',
    label: 'Step Completado',
    description: 'Se emite cuando un estudiante completa un step dentro de un recorrido',
    scope: 'step',
    payload_schema: {
      type: 'object',
      properties: {
        step_id: { type: 'string' }
      },
      required: ['step_id']
    },
    default_payload: {},
    tags: ['analytics'],
    origin: 'system',
    order_index: 3
  }
];

/**
 * Normaliza una definición de señal rellenando defaults
 * 
 * PRINCIPIO: Fail-open - rellena todo lo que falta con defaults seguros
 * 
 * @param {Object} def - Definición de señal (puede estar incompleta)
 * @returns {Object} Definición normalizada con todos los campos requeridos
 */
export function normalizeSignal(def) {
  if (!def || typeof def !== 'object') {
    def = {};
  }

  const {
    signal_key = '',
    label = '',
    description = '',
    scope = 'workflow',
    payload_schema = {},
    default_payload = {},
    tags = [],
    status = 'active',
    origin = 'user',
    order_index = 0
  } = def;

  // Asegurar que payload_schema y default_payload son objetos
  const normalizedPayloadSchema = typeof payload_schema === 'object' && payload_schema !== null 
    ? payload_schema 
    : {};
  const normalizedDefaultPayload = typeof default_payload === 'object' && default_payload !== null 
    ? default_payload 
    : {};

  // Asegurar que tags es un array
  const normalizedTags = Array.isArray(tags) ? tags : [];

  return {
    signal_key,
    label,
    description: description || '',
    scope,
    payload_schema: normalizedPayloadSchema,
    default_payload: normalizedDefaultPayload,
    tags: normalizedTags,
    status,
    origin,
    order_index: typeof order_index === 'number' ? order_index : 0
  };
}

/**
 * Valida una definición de señal
 * 
 * PRINCIPIO: Fail-open - solo warnings si strict=false, throws solo si strict=true
 * 
 * @param {Object} def - Definición de señal
 * @param {Object} options - Opciones de validación
 * @param {boolean} options.strict - Si true, lanza errores; si false, solo warnings
 * @returns {Object} { valid: boolean, warnings: string[], errors: string[] }
 */
export function validateSignal(def, options = {}) {
  const { strict = false } = options;
  const warnings = [];
  const errors = [];

  if (!def || typeof def !== 'object') {
    const msg = 'Definición de señal debe ser un objeto';
    if (strict) {
      errors.push(msg);
    } else {
      warnings.push(msg);
    }
    return { valid: errors.length === 0, warnings, errors };
  }

  const { signal_key, label, scope, payload_schema } = def;

  // Validar signal_key
  if (!signal_key || typeof signal_key !== 'string') {
    const msg = 'signal_key es obligatorio y debe ser un string';
    if (strict) {
      errors.push(msg);
    } else {
      warnings.push(msg);
    }
  } else if (!/^[a-z0-9_-]+$/.test(signal_key)) {
    const msg = 'signal_key inválido: solo se permiten letras minúsculas, números, guiones bajos (_) y guiones (-)';
    if (strict) {
      errors.push(msg);
    } else {
      warnings.push(msg);
    }
  }

  // Validar label
  if (!label || typeof label !== 'string') {
    const msg = 'label es obligatorio y debe ser un string';
    if (strict) {
      errors.push(msg);
    } else {
      warnings.push(msg);
    }
  }

  // Validar scope
  const validScopes = ['global', 'workflow', 'step'];
  if (scope && !validScopes.includes(scope)) {
    const msg = `scope inválido: ${scope}. Debe ser uno de: ${validScopes.join(', ')}`;
    if (strict) {
      errors.push(msg);
    } else {
      warnings.push(`Scope desconocido '${scope}', se usará 'workflow'`);
    }
  }

  // Validar payload_schema
  if (payload_schema && typeof payload_schema !== 'object') {
    const msg = 'payload_schema debe ser un objeto';
    if (strict) {
      errors.push(msg);
    } else {
      warnings.push(msg);
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors
  };
}

/**
 * Combina señales de DB con defaults del sistema
 * 
 * PRINCIPIO: DB override por signal_key si existe
 * 
 * @param {Array} dbList - Lista de señales de la DB
 * @returns {Array} Lista combinada (DB tiene prioridad)
 */
export function mergeDbWithSystemSignals(dbList) {
  const dbMap = new Map();
  for (const signal of dbList) {
    dbMap.set(signal.signal_key, signal);
  }

  const result = [];

  // Primero añadir defaults del sistema (si no están en DB)
  for (const defaultSignal of SYSTEM_SIGNAL_DEFAULTS) {
    if (!dbMap.has(defaultSignal.signal_key)) {
      result.push({
        ...defaultSignal,
        is_system: true
      });
    }
  }

  // Luego añadir señales de DB (tienen prioridad)
  for (const dbSignal of dbList) {
    result.push({
      ...dbSignal,
      is_system: false
    });
  }

  return result;
}

/**
 * Ordena señales por order_index (asc) y luego por label
 * 
 * @param {Array} signals - Lista de señales
 * @returns {Array} Lista ordenada
 */
export function sortSignals(signals) {
  return [...signals].sort((a, b) => {
    const orderA = a.order_index || 0;
    const orderB = b.order_index || 0;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return (a.label || '').localeCompare(b.label || '');
  });
}

/**
 * Valida que un signal_key sea válido (slug)
 * 
 * @param {string} signalKey - Clave de la señal
 * @returns {boolean} true si es válido
 */
export function isValidSignalKey(signalKey) {
  if (!signalKey || typeof signalKey !== 'string') {
    return false;
  }
  // Solo letras minúsculas, números, guiones bajos y guiones
  return /^[a-z0-9_-]+$/.test(signalKey);
}


