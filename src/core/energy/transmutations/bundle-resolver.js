// src/core/energy/transmutations/bundle-resolver.js
// Resolver determinista de bundles de transmutaciones energéticas v1
//
// RESPONSABILIDAD:
// - Resolver bundle para un estudiante según su nivel y modo seleccionado
// - Filtrar transmutaciones por is_active y respect_level_cap
// - Ordenar por weight (desc) u orden del array según strategy
// - Cortar a max_transmutations del modo
// - Incluir técnicas elegibles por nivel
//
// API:
// resolveTransmutationBundle(studentCtx, mode_id, options)
//
// DETERMINISMO (v1):
// - Usa orden estable (no random)
// - Random postponed para v2 con seed

import { getTransmutationsCatalog, EMPTY_CATALOG } from './catalog-loader.js';
import { logInfo, logWarn, logError } from '../../observability/logger.js';

const DOMAIN = 'EnergyTransmutations';

/**
 * Bundle vacío para fail-open
 * @type {Object}
 */
export const EMPTY_BUNDLE = {
  mode: null,
  transmutations: [],
  techniques: [],
  meta: {
    resolved_at: null,
    student_level: null,
    total_available: 0,
    filtered_count: 0,
    reason: 'empty_bundle'
  }
};

/**
 * Crea un bundle vacío con razón específica
 * 
 * @param {string} reason - Razón del bundle vacío
 * @param {Object} extraMeta - Metadata adicional
 * @returns {Object} Bundle vacío con metadata
 */
function createEmptyBundle(reason, extraMeta = {}) {
  return {
    ...EMPTY_BUNDLE,
    meta: {
      ...EMPTY_BUNDLE.meta,
      resolved_at: new Date().toISOString(),
      reason,
      ...extraMeta
    }
  };
}

/**
 * Filtra transmutaciones según nivel del estudiante y flags
 * 
 * @param {Object[]} transmutations - Array de transmutaciones
 * @param {number} studentLevel - Nivel del estudiante
 * @param {boolean} respectLevelCap - Si debe respetar el cap de nivel
 * @returns {Object[]} Transmutaciones filtradas
 */
function filterTransmutations(transmutations, studentLevel, respectLevelCap) {
  return transmutations.filter(trans => {
    // Filtrar inactivas
    if (!trans.is_active) return false;

    // Filtrar por nivel si aplica
    if (respectLevelCap && trans.min_level > studentLevel) {
      return false;
    }

    return true;
  });
}

/**
 * Filtra técnicas según nivel del estudiante
 * 
 * @param {Object[]} techniques - Array de técnicas
 * @param {number} studentLevel - Nivel del estudiante
 * @returns {Object[]} Técnicas filtradas
 */
function filterTechniques(techniques, studentLevel) {
  return techniques.filter(tech => {
    // Filtrar inactivas
    if (!tech.is_active) return false;

    // Filtrar por nivel
    if (tech.min_level > studentLevel) {
      return false;
    }

    return true;
  });
}

/**
 * Ordena transmutaciones según estrategia
 * 
 * @param {Object[]} transmutations - Transmutaciones a ordenar
 * @param {string} strategy - Estrategia de selección
 * @param {Object} options - Opciones (seed para random en v2)
 * @returns {Object[]} Transmutaciones ordenadas
 */
function sortTransmutations(transmutations, strategy, options = {}) {
  // Crear copia para no mutar original
  const sorted = [...transmutations];

  switch (strategy) {
    case 'weighted':
      // Ordenar por weight descendente (mayor primero)
      sorted.sort((a, b) => (b.weight || 0) - (a.weight || 0));
      break;

    case 'random':
      // v1: random postponed, usar orden por weight
      // TODO v2: implementar con seed para determinismo en tests
      sorted.sort((a, b) => (b.weight || 0) - (a.weight || 0));
      logWarn(DOMAIN, 'Estrategia random no implementada en v1, usando weighted', {
        strategy
      });
      break;

    case 'ordered':
    default:
      // Mantener orden original del array
      // No hacer nada (ya está en el orden del JSON)
      break;
  }

  return sorted;
}

/**
 * Resuelve un bundle de transmutaciones para un estudiante
 * 
 * @param {Object} studentCtx - Contexto del estudiante (debe tener nivelInfo.nivel)
 * @param {string} mode_id - ID del modo (rapida, basica, profunda, maestro)
 * @param {Object} options - Opciones adicionales
 * @param {number} options.seed - Semilla para random (v2, no implementado)
 * @param {Date} options.now - Fecha actual (para tests)
 * @returns {Object} Bundle resuelto { mode, transmutations, techniques, meta }
 * 
 * @example
 * const bundle = resolveTransmutationBundle(studentCtx, 'basica');
 * // { mode: {...}, transmutations: [...10 items], techniques: [...], meta: {...} }
 */
export function resolveTransmutationBundle(studentCtx, mode_id, options = {}) {
  const now = options.now || new Date();
  const resolvedAt = now.toISOString();

  try {
    // 1. Validar parámetros
    if (!studentCtx) {
      logWarn(DOMAIN, 'studentCtx no proporcionado', { mode_id });
      return createEmptyBundle('missing_student_context', { mode_id });
    }

    if (!mode_id || typeof mode_id !== 'string') {
      logWarn(DOMAIN, 'mode_id no proporcionado o inválido', { mode_id });
      return createEmptyBundle('invalid_mode_id', { mode_id });
    }

    // 2. Extraer nivel del estudiante
    const studentLevel = studentCtx.nivelInfo?.nivel 
      || studentCtx.nivelInfo?.nivel_efectivo 
      || studentCtx.student?.nivel_actual 
      || 1;

    // 3. Cargar catálogo
    const { catalog, error: catalogError } = getTransmutationsCatalog();

    if (catalogError || !catalog || catalog.status === 'empty') {
      logWarn(DOMAIN, 'Catálogo no disponible', {
        mode_id,
        student_level: studentLevel,
        error: catalogError
      });
      return createEmptyBundle('catalog_unavailable', {
        mode_id,
        student_level: studentLevel,
        catalog_error: catalogError
      });
    }

    // 4. Buscar modo
    const mode = catalog.modes.find(m => m.mode_id === mode_id);

    if (!mode) {
      logWarn(DOMAIN, 'Modo no encontrado en catálogo', {
        mode_id,
        available_modes: catalog.modes.map(m => m.mode_id)
      });
      return createEmptyBundle('mode_not_found', {
        mode_id,
        student_level: studentLevel,
        available_modes: catalog.modes.map(m => m.mode_id)
      });
    }

    // 5. Determinar si respetar level cap
    const respectLevelCap = mode.filters?.respect_level_cap !== false;

    // 6. Filtrar transmutaciones
    const allTransmutations = catalog.transmutations || [];
    const filteredTransmutations = filterTransmutations(
      allTransmutations,
      studentLevel,
      respectLevelCap
    );

    // 7. Ordenar según estrategia
    const sortedTransmutations = sortTransmutations(
      filteredTransmutations,
      mode.selection_strategy,
      options
    );

    // 8. Cortar a max_transmutations
    const maxItems = mode.max_transmutations || 10;
    const selectedTransmutations = sortedTransmutations.slice(0, maxItems);

    // 9. Filtrar técnicas por nivel
    const allTechniques = catalog.techniques || [];
    const selectedTechniques = filterTechniques(allTechniques, studentLevel);

    // 10. Construir metadata
    const meta = {
      resolved_at: resolvedAt,
      student_level: studentLevel,
      catalog_version: catalog.version,
      total_transmutations_in_catalog: allTransmutations.length,
      transmutations_after_level_filter: filteredTransmutations.length,
      transmutations_selected: selectedTransmutations.length,
      techniques_selected: selectedTechniques.length,
      mode_max: maxItems,
      selection_strategy: mode.selection_strategy,
      respect_level_cap: respectLevelCap
    };

    // 11. Log de éxito
    logInfo(DOMAIN, 'Bundle resuelto correctamente', {
      mode_id,
      student_level: studentLevel,
      transmutations_count: selectedTransmutations.length,
      techniques_count: selectedTechniques.length
    }, true);

    // 12. Devolver bundle
    return {
      mode: {
        mode_id: mode.mode_id,
        label: mode.label,
        description: mode.description,
        max_transmutations: mode.max_transmutations
      },
      transmutations: selectedTransmutations.map(trans => ({
        transmutation_id: trans.transmutation_id,
        slug: trans.slug,
        name: trans.name,
        description: trans.description,
        category: trans.category,
        min_level: trans.min_level
      })),
      techniques: selectedTechniques.map(tech => ({
        technique_id: tech.technique_id,
        slug: tech.slug,
        name: tech.name,
        description: tech.description,
        instructions: tech.instructions,
        duration_seconds: tech.duration_seconds,
        category: tech.category,
        min_level: tech.min_level
      })),
      meta
    };

  } catch (error) {
    // Error inesperado (fail-open)
    logError(DOMAIN, 'Error inesperado resolviendo bundle', {
      mode_id,
      error: error.message,
      stack: error.stack
    });

    return createEmptyBundle('unexpected_error', {
      mode_id,
      error: error.message
    });
  }
}

/**
 * Obtiene los modos disponibles del catálogo
 * 
 * @returns {Object[]} Array de modos disponibles
 */
export function getAvailableModes() {
  const { catalog, error } = getTransmutationsCatalog();

  if (error || !catalog || !catalog.modes) {
    return [];
  }

  return catalog.modes.map(mode => ({
    mode_id: mode.mode_id,
    label: mode.label,
    description: mode.description,
    max_transmutations: mode.max_transmutations
  }));
}

/**
 * Verifica si un mode_id es válido
 * 
 * @param {string} mode_id - ID del modo a verificar
 * @returns {boolean} true si el modo existe
 */
export function isValidModeId(mode_id) {
  const modes = getAvailableModes();
  return modes.some(m => m.mode_id === mode_id);
}

export default {
  resolveTransmutationBundle,
  getAvailableModes,
  isValidModeId,
  EMPTY_BUNDLE
};






