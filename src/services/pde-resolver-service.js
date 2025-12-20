// src/services/pde-resolver-service.js
// Servicio de negocio para Resolver v1 (motor determinista de resolución)
//
// Responsabilidades:
// - Validar ResolverDefinition v1
// - Resolver PackageDefinition aplicando política del resolver
// - Aplicar reglas de matching por contexto
// - Recortar items según max_items
// - Generar ResolvedPackage v1

/**
 * Valida un ResolverDefinition v1
 * 
 * Fail-open en admin: devuelve warnings + ok (no bloquea UX)
 * 
 * @param {Object} definition - ResolverDefinition a validar
 * @returns {Object} { ok: boolean, warnings: Array<string> }
 */
export function validateResolverDefinition(definition) {
  const warnings = [];
  
  if (!definition || typeof definition !== 'object') {
    return {
      ok: false,
      warnings: ['ResolverDefinition debe ser un objeto']
    };
  }

  // Validar campos requeridos
  if (!definition.resolver_key || typeof definition.resolver_key !== 'string') {
    warnings.push('resolver_key es requerido y debe ser string');
  }

  if (!definition.label || typeof definition.label !== 'string') {
    warnings.push('label es requerido y debe ser string');
  }

  if (!definition.policy || typeof definition.policy !== 'object') {
    warnings.push('policy es requerido y debe ser un objeto');
  } else {
    // Validar estructura de policy
    const { mode, global, rules } = definition.policy;

    if (mode && mode !== 'per_source') {
      warnings.push(`mode '${mode}' no es válido (solo 'per_source' soportado en v1)`);
    }

    if (global) {
      if (global.seed && !['stable', 'random'].includes(global.seed)) {
        warnings.push(`global.seed '${global.seed}' no es válido (solo 'stable' o 'random')`);
      }
      if (global.ordering && !['canonical', 'random', 'priority'].includes(global.ordering)) {
        warnings.push(`global.ordering '${global.ordering}' no es válido (solo 'canonical', 'random' o 'priority')`);
      }
    }

    if (rules && !Array.isArray(rules)) {
      warnings.push('policy.rules debe ser un array');
    } else if (rules) {
      rules.forEach((rule, index) => {
        if (!rule.when || !rule.apply) {
          warnings.push(`rule[${index}] debe tener 'when' y 'apply'`);
        }
        if (rule.when && rule.when.context) {
          const ctx = rule.when.context;
          if (ctx.nivel_efectivo_min !== undefined && typeof ctx.nivel_efectivo_min !== 'number') {
            warnings.push(`rule[${index}].when.context.nivel_efectivo_min debe ser number`);
          }
          if (ctx.nivel_efectivo_max !== undefined && typeof ctx.nivel_efectivo_max !== 'number') {
            warnings.push(`rule[${index}].when.context.nivel_efectivo_max debe ser number`);
          }
        }
      });
    }
  }

  return {
    ok: warnings.length === 0,
    warnings
  };
}

/**
 * Resuelve un PackageDefinition aplicando la política del Resolver
 * 
 * @param {Object} params - Parámetros de resolución
 * @param {Object} params.packageDefinition - PackageDefinition canónico
 * @param {Object} params.resolverDefinition - ResolverDefinition v1 completo
 * @param {Object} params.effectiveContext - Contexto efectivo (valores ya resueltos)
 * @param {Object} params.catalogsSnapshot - Snapshot de catálogos ya resueltos
 * @returns {Object} ResolvedPackage v1
 */
export function resolvePackage({ packageDefinition, resolverDefinition, effectiveContext, catalogsSnapshot }) {
  const warnings = [];
  
  // Validar inputs
  if (!packageDefinition || typeof packageDefinition !== 'object') {
    return {
      ok: false,
      package_key: null,
      resolver_key: null,
      effective_context: {},
      resolved_sources: [],
      ui_hints: { widgets: [] },
      warnings: ['PackageDefinition inválido']
    };
  }

  if (!resolverDefinition || typeof resolverDefinition !== 'object') {
    return {
      ok: false,
      package_key: packageDefinition.package_key || null,
      resolver_key: null,
      effective_context: effectiveContext || {},
      resolved_sources: [],
      ui_hints: { widgets: [] },
      warnings: ['ResolverDefinition inválido']
    };
  }

  const packageKey = packageDefinition.package_key || null;
  const resolverKey = resolverDefinition.resolver_key || null;
  const policy = resolverDefinition.policy || {};
  const { global = {}, rules = [] } = policy;

  // Obtener nivel efectivo del contexto
  const nivelEfectivo = effectiveContext?.nivel_efectivo || effectiveContext?.nivel || null;

  // Aplicar reglas de matching
  const matchedRules = matchRules(rules, effectiveContext, nivelEfectivo, warnings);

  // Resolver cada source del package
  const resolvedSources = (packageDefinition.sources || []).map(source => {
    return resolveSourceItem(source, matchedRules, global, catalogsSnapshot, effectiveContext, nivelEfectivo, warnings);
  });

  // Generar UI hints basados en widget_hint de las reglas
  const uiHints = generateUIHints(resolvedSources, matchedRules);

  return {
    ok: true,
    package_key: packageKey,
    resolver_key: resolverKey,
    effective_context: effectiveContext || {},
    resolved_sources: resolvedSources,
    ui_hints: uiHints,
    warnings
  };
}

/**
 * Hace matching de reglas según contexto efectivo
 * 
 * @param {Array} rules - Reglas de política
 * @param {Object} effectiveContext - Contexto efectivo
 * @param {number|null} nivelEfectivo - Nivel efectivo del estudiante
 * @param {Array} warnings - Array de warnings (se modifica)
 * @returns {Array} Reglas que hacen match
 */
function matchRules(rules, effectiveContext, nivelEfectivo, warnings) {
  const matched = [];

  for (const rule of rules) {
    const { when = {} } = rule;
    const { context = {} } = when;

    let matches = true;

    // Match por enum arrays (exact match)
    for (const [key, allowedValues] of Object.entries(context)) {
      if (key === 'nivel_efectivo_min' || key === 'nivel_efectivo_max') {
        continue; // Se maneja aparte
      }

      const contextValue = effectiveContext?.[key];
      
      if (Array.isArray(allowedValues)) {
        if (!allowedValues.includes(contextValue)) {
          matches = false;
          break;
        }
      } else if (allowedValues !== contextValue) {
        matches = false;
        break;
      }
    }

    // Match por rango de nivel
    if (matches && nivelEfectivo !== null) {
      if (context.nivel_efectivo_min !== undefined && nivelEfectivo < context.nivel_efectivo_min) {
        matches = false;
      }
      if (context.nivel_efectivo_max !== undefined && nivelEfectivo > context.nivel_efectivo_max) {
        matches = false;
      }
    }

    if (matches) {
      matched.push(rule);
    }
  }

  return matched;
}

/**
 * Resuelve un source aplicando reglas y límites
 * 
 * @param {Object} source - Source del PackageDefinition
 * @param {Array} matchedRules - Reglas que hicieron match
 * @param {Object} global - Configuración global de política
 * @param {Object} catalogsSnapshot - Snapshot de catálogos
 * @param {Object} effectiveContext - Contexto efectivo
 * @param {number|null} nivelEfectivo - Nivel efectivo
 * @param {Array} warnings - Array de warnings (se modifica)
 * @returns {Object} Source resuelto con items recortados
 */
function resolveSourceItem(source, matchedRules, global, catalogsSnapshot, effectiveContext, nivelEfectivo, warnings) {
  const sourceKey = source.source_key;
  if (!sourceKey) {
    return {
      source_key: null,
      items: [],
      meta: { selected: 0, total: 0, warning: 'source_key no definido' }
    };
  }

  // Obtener items del catálogo snapshot
  const catalogItems = catalogsSnapshot?.[sourceKey] || [];
  const totalItems = catalogItems.length;

  // Buscar regla específica para este source
  let maxItems = null;
  let widgetHint = null;

  for (const rule of matchedRules) {
    const { apply = {} } = rule;
    const { sources = {} } = apply;
    const sourceRule = sources[sourceKey];

    if (sourceRule) {
      if (sourceRule.max_items !== undefined) {
        maxItems = sourceRule.max_items;
      }
      if (sourceRule.widget_hint) {
        widgetHint = sourceRule.widget_hint;
      }
    }
  }

  // Fallback a global.default_max_items si no hay regla específica
  if (maxItems === null && global.default_max_items !== undefined) {
    maxItems = global.default_max_items;
  }

  // Aplicar ordenamiento
  let orderedItems = [...catalogItems];
  const ordering = global.ordering || 'canonical';
  
  if (ordering === 'random') {
    // Shuffle aleatorio (usando seed si está disponible)
    const seed = global.seed === 'random' ? Math.random() : 0.5; // stable = 0.5
    orderedItems = shuffleWithSeed(orderedItems, seed);
  } else if (ordering === 'priority') {
    // Ordenar por prioridad (si existe campo priority)
    orderedItems.sort((a, b) => {
      const prioA = a.priority || 0;
      const prioB = b.priority || 0;
      return prioB - prioA; // Mayor prioridad primero
    });
  }
  // canonical = mantener orden original

  // Aplicar max_items
  const selectedItems = maxItems !== null && maxItems >= 0
    ? orderedItems.slice(0, maxItems)
    : orderedItems;

  return {
    source_key: sourceKey,
    items: selectedItems,
    meta: {
      selected: selectedItems.length,
      total: totalItems,
      max_items_applied: maxItems,
      widget_hint: widgetHint
    }
  };
}

/**
 * Genera UI hints basados en widget_hint de las reglas
 * 
 * @param {Array} resolvedSources - Sources resueltos
 * @param {Array} matchedRules - Reglas que hicieron match
 * @returns {Object} UI hints con widgets sugeridos
 */
function generateUIHints(resolvedSources, matchedRules) {
  const widgets = [];

  for (const source of resolvedSources) {
    const widgetHint = source.meta?.widget_hint;
    if (widgetHint) {
      widgets.push({
        widget: widgetHint,
        source_key: source.source_key
      });
    } else {
      // Default: list
      widgets.push({
        widget: 'list',
        source_key: source.source_key
      });
    }
  }

  return { widgets };
}

/**
 * Shuffle con seed (determinista si seed es fijo)
 * 
 * @param {Array} array - Array a shufflear
 * @param {number} seed - Seed para random (0-1)
 * @returns {Array} Array shuffleado
 */
function shuffleWithSeed(array, seed) {
  const shuffled = [...array];
  let currentSeed = seed;

  for (let i = shuffled.length - 1; i > 0; i--) {
    // Generar pseudo-random basado en seed
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    const j = Math.floor((currentSeed / 233280) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

