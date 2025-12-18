// src/core/energy/transmutations/catalog-validator.js
// Validador estricto del contrato del catálogo de transmutaciones energéticas v1
//
// RESPONSABILIDAD:
// - Validar estructura del JSON del catálogo
// - Validar unicidad de IDs (mode_id, transmutation_id, technique_id)
// - Validar slugs (formato válido)
// - Validar rangos (max_transmutations, min_level)
// - Validar selection_strategy permitida
// - Advertir si status != 'published'
//
// CONTRATO:
// - Devuelve { valid: true, data } si el catálogo es válido
// - Devuelve { valid: false, errors: [...] } si hay errores
// - Nunca lanza excepciones (fail-open)

import { logInfo, logWarn, logError } from '../../observability/logger.js';

const DOMAIN = 'EnergyTransmutations';

// Estrategias de selección permitidas
const ALLOWED_SELECTION_STRATEGIES = ['ordered', 'random', 'weighted'];

// Rangos válidos
const MIN_LEVEL_MIN = 1;
const MIN_LEVEL_MAX = 10;
const MAX_TRANSMUTATIONS_MIN = 1;
const MAX_TRANSMUTATIONS_MAX = 100;

// Patrón de slug válido: lowercase, números, guiones (no al inicio/final)
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Valida el formato de un slug
 * 
 * @param {string} slug - Slug a validar
 * @returns {boolean} true si es válido
 */
function isValidSlug(slug) {
  if (!slug || typeof slug !== 'string') return false;
  return SLUG_PATTERN.test(slug);
}

/**
 * Valida un modo del catálogo
 * 
 * @param {Object} mode - Modo a validar
 * @param {number} index - Índice del modo en el array
 * @returns {string[]} Array de errores (vacío si válido)
 */
function validateMode(mode, index) {
  const errors = [];
  const prefix = `modes[${index}]`;

  if (!mode.mode_id || typeof mode.mode_id !== 'string') {
    errors.push(`${prefix}: mode_id es requerido y debe ser string`);
  } else if (!isValidSlug(mode.mode_id)) {
    errors.push(`${prefix}: mode_id '${mode.mode_id}' no es un slug válido`);
  }

  if (!mode.label || typeof mode.label !== 'string') {
    errors.push(`${prefix}: label es requerido y debe ser string`);
  }

  if (typeof mode.max_transmutations !== 'number') {
    errors.push(`${prefix}: max_transmutations es requerido y debe ser número`);
  } else if (mode.max_transmutations < MAX_TRANSMUTATIONS_MIN || mode.max_transmutations > MAX_TRANSMUTATIONS_MAX) {
    errors.push(`${prefix}: max_transmutations debe estar entre ${MAX_TRANSMUTATIONS_MIN} y ${MAX_TRANSMUTATIONS_MAX}`);
  }

  if (!mode.selection_strategy || typeof mode.selection_strategy !== 'string') {
    errors.push(`${prefix}: selection_strategy es requerido`);
  } else if (!ALLOWED_SELECTION_STRATEGIES.includes(mode.selection_strategy)) {
    errors.push(`${prefix}: selection_strategy '${mode.selection_strategy}' no es válida. Permitidas: ${ALLOWED_SELECTION_STRATEGIES.join(', ')}`);
  }

  return errors;
}

/**
 * Valida una transmutación del catálogo
 * 
 * @param {Object} transmutation - Transmutación a validar
 * @param {number} index - Índice en el array
 * @returns {string[]} Array de errores (vacío si válido)
 */
function validateTransmutation(transmutation, index) {
  const errors = [];
  const prefix = `transmutations[${index}]`;

  if (!transmutation.transmutation_id || typeof transmutation.transmutation_id !== 'string') {
    errors.push(`${prefix}: transmutation_id es requerido y debe ser string`);
  }

  if (!transmutation.slug || typeof transmutation.slug !== 'string') {
    errors.push(`${prefix}: slug es requerido y debe ser string`);
  } else if (!isValidSlug(transmutation.slug)) {
    errors.push(`${prefix}: slug '${transmutation.slug}' no es válido`);
  }

  if (!transmutation.name || typeof transmutation.name !== 'string') {
    errors.push(`${prefix}: name es requerido y debe ser string`);
  }

  if (typeof transmutation.min_level !== 'number') {
    errors.push(`${prefix}: min_level es requerido y debe ser número`);
  } else if (transmutation.min_level < MIN_LEVEL_MIN || transmutation.min_level > MIN_LEVEL_MAX) {
    errors.push(`${prefix}: min_level debe estar entre ${MIN_LEVEL_MIN} y ${MIN_LEVEL_MAX}`);
  }

  if (typeof transmutation.is_active !== 'boolean') {
    errors.push(`${prefix}: is_active es requerido y debe ser boolean`);
  }

  return errors;
}

/**
 * Valida una técnica del catálogo
 * 
 * @param {Object} technique - Técnica a validar
 * @param {number} index - Índice en el array
 * @returns {string[]} Array de errores (vacío si válido)
 */
function validateTechnique(technique, index) {
  const errors = [];
  const prefix = `techniques[${index}]`;

  if (!technique.technique_id || typeof technique.technique_id !== 'string') {
    errors.push(`${prefix}: technique_id es requerido y debe ser string`);
  }

  if (!technique.slug || typeof technique.slug !== 'string') {
    errors.push(`${prefix}: slug es requerido y debe ser string`);
  } else if (!isValidSlug(technique.slug)) {
    errors.push(`${prefix}: slug '${technique.slug}' no es válido`);
  }

  if (!technique.name || typeof technique.name !== 'string') {
    errors.push(`${prefix}: name es requerido y debe ser string`);
  }

  if (typeof technique.min_level !== 'number') {
    errors.push(`${prefix}: min_level es requerido y debe ser número`);
  } else if (technique.min_level < MIN_LEVEL_MIN || technique.min_level > MIN_LEVEL_MAX) {
    errors.push(`${prefix}: min_level debe estar entre ${MIN_LEVEL_MIN} y ${MIN_LEVEL_MAX}`);
  }

  if (typeof technique.is_active !== 'boolean') {
    errors.push(`${prefix}: is_active es requerido y debe ser boolean`);
  }

  return errors;
}

/**
 * Valida unicidad de IDs en un array
 * 
 * @param {Object[]} items - Array de items
 * @param {string} idField - Nombre del campo ID
 * @param {string} itemType - Tipo de item para mensajes
 * @returns {string[]} Array de errores por duplicados
 */
function validateUniqueIds(items, idField, itemType) {
  const errors = [];
  const seen = new Set();

  for (const item of items) {
    const id = item[idField];
    if (id && seen.has(id)) {
      errors.push(`${itemType}: ID duplicado '${id}'`);
    }
    seen.add(id);
  }

  return errors;
}

/**
 * Valida unicidad de slugs en un array
 * 
 * @param {Object[]} items - Array de items
 * @param {string} itemType - Tipo de item para mensajes
 * @returns {string[]} Array de errores por duplicados
 */
function validateUniqueSlugs(items, itemType) {
  const errors = [];
  const seen = new Set();

  for (const item of items) {
    const slug = item.slug;
    if (slug && seen.has(slug)) {
      errors.push(`${itemType}: slug duplicado '${slug}'`);
    }
    seen.add(slug);
  }

  return errors;
}

/**
 * Valida el catálogo completo de transmutaciones
 * 
 * @param {Object} catalog - Catálogo a validar
 * @returns {{ valid: boolean, data?: Object, errors?: string[], warnings?: string[] }}
 * 
 * @example
 * const result = validateTransmutationsCatalog(rawCatalog);
 * if (result.valid) {
 *   const catalog = result.data;
 * } else {
 *   console.error('Errores:', result.errors);
 * }
 */
export function validateTransmutationsCatalog(catalog) {
  const errors = [];
  const warnings = [];

  // 1. Validar campos requeridos de nivel superior
  if (!catalog || typeof catalog !== 'object') {
    return {
      valid: false,
      errors: ['El catálogo debe ser un objeto válido']
    };
  }

  if (!catalog.catalog_id || typeof catalog.catalog_id !== 'string') {
    errors.push('catalog_id es requerido y debe ser string');
  }

  if (!catalog.version || typeof catalog.version !== 'string') {
    errors.push('version es requerido y debe ser string');
  }

  if (!catalog.status || typeof catalog.status !== 'string') {
    errors.push('status es requerido y debe ser string');
  } else if (catalog.status !== 'published') {
    warnings.push(`Catálogo con status '${catalog.status}' (no es 'published')`);
  }

  // 2. Validar modos
  if (!Array.isArray(catalog.modes)) {
    errors.push('modes es requerido y debe ser un array');
  } else {
    if (catalog.modes.length === 0) {
      errors.push('modes debe tener al menos un modo');
    }

    catalog.modes.forEach((mode, i) => {
      errors.push(...validateMode(mode, i));
    });

    errors.push(...validateUniqueIds(catalog.modes, 'mode_id', 'modes'));
  }

  // 3. Validar transmutaciones
  if (!Array.isArray(catalog.transmutations)) {
    errors.push('transmutations es requerido y debe ser un array');
  } else {
    if (catalog.transmutations.length === 0) {
      errors.push('transmutations debe tener al menos una transmutación');
    }

    catalog.transmutations.forEach((trans, i) => {
      errors.push(...validateTransmutation(trans, i));
    });

    errors.push(...validateUniqueIds(catalog.transmutations, 'transmutation_id', 'transmutations'));
    errors.push(...validateUniqueSlugs(catalog.transmutations, 'transmutations'));
  }

  // 4. Validar técnicas
  if (!Array.isArray(catalog.techniques)) {
    errors.push('techniques es requerido y debe ser un array');
  } else {
    catalog.techniques.forEach((tech, i) => {
      errors.push(...validateTechnique(tech, i));
    });

    errors.push(...validateUniqueIds(catalog.techniques, 'technique_id', 'techniques'));
    errors.push(...validateUniqueSlugs(catalog.techniques, 'techniques'));
  }

  // Log de warnings si hay
  if (warnings.length > 0) {
    logWarn(DOMAIN, 'Validación con advertencias', {
      warnings_count: warnings.length,
      warnings
    });
  }

  // Log de errores si hay
  if (errors.length > 0) {
    logError(DOMAIN, 'Validación fallida', {
      errors_count: errors.length,
      errors: errors.slice(0, 10) // Solo primeros 10 para no saturar logs
    });

    return {
      valid: false,
      errors,
      warnings
    };
  }

  // Log de éxito
  logInfo(DOMAIN, 'Catálogo validado correctamente', {
    catalog_id: catalog.catalog_id,
    version: catalog.version,
    modes_count: catalog.modes.length,
    transmutations_count: catalog.transmutations.length,
    techniques_count: catalog.techniques.length
  }, true);

  return {
    valid: true,
    data: catalog,
    warnings
  };
}

/**
 * Constante para catálogo vacío (fallback)
 */
export const EMPTY_CATALOG = {
  catalog_id: 'energy_transmutations',
  version: '0.0.0',
  status: 'empty',
  modes: [],
  transmutations: [],
  techniques: [],
  metadata: {
    reason: 'fallback_empty_catalog'
  }
};

// Exportar también isValidSlug como named export
export { isValidSlug };

export default {
  validateTransmutationsCatalog,
  EMPTY_CATALOG,
  isValidSlug,
  ALLOWED_SELECTION_STRATEGIES
};

