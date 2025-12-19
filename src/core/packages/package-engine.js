// src/core/packages/package-engine.js
// Engine interno para resolver paquetes PDE
//
// Responsabilidades:
// - Resolver defaults de contexto (usando Context Registry)
// - Aplicar filter_by_nivel
// - Aplicar context_rules
// - Devolver package resuelto
// - Fail-open absoluto (nunca bloquea por falta de contexto)
//
// IMPORTANTE: 
// - Valida sources usando el registry canónico ubicado en src/core/packages/source-of-truth-registry.js
// - Resuelve contextos usando el Context Registry ubicado en src/core/contexts/context-registry.js

/**
 * Obtiene el nivel del alumno de forma canónica
 * 
 * DECISIÓN CANÓNICA: nivel_efectivo es la fuente principal, nivel es fallback legacy
 * 
 * @param {Object} context - Contexto con nivel_efectivo o nivel
 * @param {number|null} [defaultNivel=null] - Nivel por defecto si no existe ninguno
 * @returns {number|null} Nivel del alumno o null
 */
export function getStudentLevel(context = {}, defaultNivel = null) {
  // Prioridad 1: nivel_efectivo (canónico)
  if (context.nivel_efectivo !== undefined && context.nivel_efectivo !== null) {
    return Number(context.nivel_efectivo);
  }
  
  // Prioridad 2: nivel (legacy fallback)
  if (context.nivel !== undefined && context.nivel !== null) {
    return Number(context.nivel);
  }
  
  // Prioridad 3: default
  return defaultNivel !== undefined && defaultNivel !== null ? Number(defaultNivel) : null;
}

/**
 * Resuelve un paquete aplicando contextos, filtros y reglas
 * 
 * PRINCIPIO: Fail-open absoluto
 * - Si falta contexto → usar default
 * - Si algo falla → fallback seguro (no crash)
 * - Nunca bloquea por falta de contexto
 * 
 * @param {Object} packageDefinition - Definición JSON del paquete
 * @param {Object} context - Contexto de ejecución (nivel, valores de contexto, etc.)
 * @param {number|null} [context.nivel_efectivo] - Nivel efectivo del estudiante (canónico, tiene prioridad)
 * @param {number|null} [context.nivel] - Nivel del estudiante (legacy fallback, solo si nivel_efectivo no existe)
 * @param {Object} [context.values={}] - Valores de contexto (ej: { tipo_practica: 'diaria' })
 * @returns {Promise<Object>} Paquete resuelto con:
 *   - sources: Array de sources con ítems resueltos
 *   - context_used: Contexto usado (con defaults aplicados)
 *   - warnings: Array de warnings (no errores)
 */
export async function resolvePackage(packageDefinition, context = {}) {
  const warnings = [];
  
  // Validar estructura básica
  if (!packageDefinition || typeof packageDefinition !== 'object') {
    return {
      sources: [],
      context_used: {},
      warnings: ['Paquete inválido: definition debe ser un objeto']
    };
  }

  const {
    sources = [],
    context_contract = {},
    context_rules = [],
    senales_emitted = [] // Nuevo: señales emitidas
  } = packageDefinition;

  const {
    nivel_efectivo = null,
    nivel = null, // Legacy fallback
    values = {}
  } = context;

  // Obtener nivel del alumno de forma canónica (nivel_efectivo primero, luego nivel legacy)
  const nivelAlumno = getStudentLevel({ nivel_efectivo, nivel });

  // Resolver contexto con defaults (fail-open, usando Context Registry)
  const context_used = await resolveContextWithDefaults(context_contract, values, warnings);
  
  // Aplicar reglas de contexto
  const activeRules = applyContextRules(context_rules, context_used, warnings);
  
  // Resolver sources con filtros y límites
  const resolvedSources = await Promise.all(sources.map(source => {
    return resolveSource(source, {
      nivel_efectivo: nivelAlumno, // Usar nivel canónico
      context_used,
      activeRules,
      warnings
    });
  }));

  // Resolver señales emitidas (con payloads finales)
  const resolvedSenales = await resolveSenales(senales_emitted, context_used, warnings);

  return {
    sources: resolvedSources,
    context_used,
    resolved_senales: resolvedSenales,
    warnings
  };
}

/**
 * Resuelve contexto aplicando defaults (fail-open, usando Context Registry)
 * 
 * PRINCIPIO: Fail-open absoluto
 * Orden de precedencia:
 * 1. providedValues (valores proporcionados en runtime)
 * 2. package defaults (defaults del paquete en context_contract.inputs)
 * 3. registry defaults (defaults del Context Registry: DB + system)
 * 
 * @param {Object} contextContract - Contrato de contexto del paquete
 * @param {Object} providedValues - Valores proporcionados
 * @param {Array} warnings - Array de warnings (se modifica)
 * @returns {Promise<Object>} Contexto resuelto con defaults
 */
async function resolveContextWithDefaults(contextContract, providedValues, warnings) {
  const { inputs = [] } = contextContract;
  const resolved = {};

  // Importar servicio de contextos (lazy import para evitar dependencias circulares)
  let getContext, getDefaultValue;
  try {
    const contextsService = await import('../services/pde-contexts-service.js');
    getContext = contextsService.getContext;
    getDefaultValue = contextsService.getDefaultValue;
  } catch (error) {
    console.warn('[AXE][PACKAGES] No se pudo importar servicio de contextos, usando defaults locales:', error.message);
    // Fallback: usar solo defaults del paquete
    getContext = null;
    getDefaultValue = null;
  }

  for (const input of inputs) {
    const { key, default: defaultValue, type } = input;
    
    if (providedValues[key] !== undefined) {
      // 1. Usar valor proporcionado (máxima prioridad)
      resolved[key] = providedValues[key];
    } else if (defaultValue !== undefined && defaultValue !== null) {
      // 2. Usar default del paquete
      resolved[key] = defaultValue;
      warnings.push(`Usando default del paquete para contexto '${key}': ${JSON.stringify(defaultValue)}`);
    } else if (getContext && getDefaultValue) {
      // 3. Intentar obtener default del Context Registry
      try {
        const registryCtx = await getContext(key);
        if (registryCtx && registryCtx.definition) {
          const registryDefault = await getDefaultValue(key);
          if (registryDefault !== null && registryDefault !== undefined) {
            resolved[key] = registryDefault;
            warnings.push(`Usando default del registry para contexto '${key}': ${JSON.stringify(registryDefault)}`);
          } else {
            // No hay default en registry → usar null (fail-open)
            resolved[key] = null;
            warnings.push(`Contexto '${key}' sin valor ni default, usando null`);
          }
        } else {
          // Contexto no existe en registry → usar null (fail-open)
          resolved[key] = null;
          warnings.push(`Contexto '${key}' no encontrado en registry, usando null`);
        }
      } catch (error) {
        console.warn(`[AXE][PACKAGES] Error obteniendo contexto '${key}' del registry:`, error.message);
        // Fail-open: usar null
        resolved[key] = null;
        warnings.push(`Error obteniendo contexto '${key}' del registry, usando null`);
      }
    } else {
      // No hay servicio de contextos → usar null (fail-open)
      resolved[key] = null;
      warnings.push(`Contexto '${key}' sin valor ni default, usando null`);
    }
  }

  return resolved;
}

/**
 * Aplica reglas de contexto y devuelve reglas activas
 * 
 * @param {Array} contextRules - Reglas de contexto
 * @param {Object} contextUsed - Contexto resuelto
 * @param {Array} warnings - Array de warnings (se modifica)
 * @returns {Array} Reglas activas con sus límites
 */
function applyContextRules(contextRules, contextUsed, warnings) {
  const activeRules = [];

  for (const rule of contextRules) {
    const { when = {}, limits = {} } = rule;
    
    // Verificar si la regla aplica (todos los when deben coincidir)
    let ruleApplies = true;
    for (const [key, expectedValue] of Object.entries(when)) {
      if (contextUsed[key] !== expectedValue) {
        ruleApplies = false;
        break;
      }
    }

    if (ruleApplies) {
      activeRules.push({
        limits,
        when
      });
    }
  }

  return activeRules;
}

/**
 * Resuelve un source aplicando filtros y límites
 * 
 * @param {Object} source - Definición del source
 * @param {Object} options - Opciones de resolución
 * @param {number|null} options.nivel_efectivo - Nivel efectivo del estudiante (canónico)
 * @param {Object} options.context_used - Contexto usado
 * @param {Array} options.activeRules - Reglas activas
 * @param {Array} options.warnings - Array de warnings (se modifica)
 * @returns {Promise<Object>} Source resuelto
 */
async function resolveSource(source, options) {
  const {
    nivel_efectivo, // Nivel canónico (ya resuelto por getStudentLevel)
    activeRules,
    warnings
  } = options;

  const {
    source_key,
    filter_by_nivel = true,
    template_key
  } = source;

  // Obtener límite de la regla activa (si existe)
  let limit = null;
  for (const rule of activeRules) {
    if (rule.limits[source_key] !== undefined) {
      limit = rule.limits[source_key];
      break;
    }
  }

  // Construir source resuelto
  const resolved = {
    source_key,
    template_key,
    filter_by_nivel,
    limit,
    nivel_efectivo: nivel_efectivo || null
  };

  // Advertencias si falta información
  if (!source_key) {
    warnings.push('Source sin source_key');
  } else {
    // Validar que el source existe en el registry canónico (solo warning, no bloquea)
    try {
      const { isValidSource } = await import('../packages/source-of-truth-registry.js').catch(() => ({ isValidSource: () => true }));
      if (!isValidSource(source_key)) {
        warnings.push(`Source '${source_key}' no existe en el registry canónico`);
      }
    } catch (error) {
      // Si falla la validación, no bloqueamos (fail-open)
      warnings.push(`No se pudo validar source '${source_key}': ${error.message}`);
    }
  }

  // Solo warning si realmente no hay nivel disponible (ni nivel_efectivo ni nivel legacy)
  if (filter_by_nivel && nivel_efectivo === null) {
    warnings.push(`Source '${source_key}' requiere nivel pero no se proporcionó nivel_efectivo ni nivel`);
  }

  return resolved;
}

/**
 * Resuelve señales emitidas con payloads finales
 * 
 * PRINCIPIO: Fail-open absoluto
 * - Si una señal no existe en el registry, se crea "virtual" con default
 * - Si falta payload, se usa default_payload del registry
 * - Si hay payload_overrides, se combinan con default_payload
 * 
 * @param {Array} senalesEmitted - Array de señales emitidas del paquete
 * @param {Object} contextUsed - Contexto resuelto (para evaluar condiciones "when")
 * @param {Array} warnings - Array de warnings (se modifica)
 * @returns {Promise<Array>} Array de señales resueltas con payloads finales
 */
async function resolveSenales(senalesEmitted, contextUsed, warnings) {
  if (!Array.isArray(senalesEmitted) || senalesEmitted.length === 0) {
    return [];
  }

  // Importar servicio de señales (lazy import)
  let getSenal;
  try {
    const senalesService = await import('../services/pde-senales-service.js');
    getSenal = senalesService.getSenal;
  } catch (error) {
    warnings.push('No se pudo cargar el servicio de señales, usando defaults');
    getSenal = async () => null;
  }

  const resolved = [];

  for (const senalEmitted of senalesEmitted) {
    const { signal_key, payload_overrides = null, when = null } = senalEmitted;

    if (!signal_key) {
      warnings.push('Señal emitida sin signal_key, se omite');
      continue;
    }

    // Evaluar condición "when" si existe
    if (when && !evaluateWhenCondition(when, contextUsed)) {
      // La condición no se cumple, omitir esta señal
      continue;
    }

    // Obtener definición de la señal del registry
    let senalDef = null;
    try {
      senalDef = await getSenal(signal_key);
    } catch (error) {
      warnings.push(`Error obteniendo señal '${signal_key}': ${error.message}`);
    }

    // Si no existe en registry, crear "virtual" con default
    if (!senalDef) {
      warnings.push(`Señal '${signal_key}' no encontrada en registry, usando default`);
      senalDef = {
        signal_key,
        label: signal_key,
        default_payload: {},
        payload_schema: {}
      };
    }

    // Combinar payloads: default_payload + payload_overrides
    const finalPayload = {
      ...(senalDef.default_payload || {}),
      ...(payload_overrides || {})
    };

    resolved.push({
      signal_key,
      label: senalDef.label || signal_key,
      payload: finalPayload,
      scope: senalDef.scope || 'workflow',
      tags: senalDef.tags || []
    });
  }

  return resolved;
}

/**
 * Evalúa una condición "when" contra el contexto
 * 
 * PRINCIPIO: Fail-open - si la condición no se puede evaluar, devuelve true (no bloquea)
 * 
 * @param {Object} when - Condición (ej: { "nivel_efectivo": { ">=": 3 } })
 * @param {Object} contextUsed - Contexto resuelto
 * @returns {boolean} true si la condición se cumple o no se puede evaluar
 */
function evaluateWhenCondition(when, contextUsed) {
  if (!when || typeof when !== 'object') {
    return true; // Sin condición = siempre se cumple
  }

  for (const [key, condition] of Object.entries(when)) {
    const contextValue = contextUsed[key];

    if (contextValue === undefined || contextValue === null) {
      // Si falta el valor en contexto, no se cumple la condición
      return false;
    }

    // Evaluar condición según tipo
    if (typeof condition === 'object' && condition !== null) {
      // Condición compleja (ej: { ">=": 3 })
      for (const [op, value] of Object.entries(condition)) {
        switch (op) {
          case '>=':
            if (contextValue < value) return false;
            break;
          case '<=':
            if (contextValue > value) return false;
            break;
          case '>':
            if (contextValue <= value) return false;
            break;
          case '<':
            if (contextValue >= value) return false;
            break;
          case '===':
          case '==':
            if (contextValue != value) return false;
            break;
          case '!==':
          case '!=':
            if (contextValue == value) return false;
            break;
          default:
            // Operador desconocido, asumir que se cumple (fail-open)
            break;
        }
      }
    } else {
      // Comparación directa (igualdad)
      if (contextValue != condition) {
        return false;
      }
    }
  }

  return true; // Todas las condiciones se cumplen
}

/**
 * Preview de un paquete (simulación sin ejecutar runtime)
 * 
 * @param {Object} packageDefinition - Definición JSON del paquete
 * @param {Object} simulationContext - Contexto simulado
 * @returns {Promise<Object>} Preview con:
 *   - sources: Array de sources con información de preview
 *   - context_used: Contexto usado
 *   - resolved_senales: Señales que se emitirían
 *   - warnings: Array de warnings
 */
export async function previewPackage(packageDefinition, simulationContext = {}) {
  const resolved = await resolvePackage(packageDefinition, simulationContext);
  
  // Enriquecer con información de preview
  const preview = {
    ...resolved,
    sources: resolved.sources.map(source => ({
      ...source,
      preview_info: {
        would_filter_by_nivel: source.filter_by_nivel,
        would_apply_limit: source.limit !== null,
        estimated_items: source.limit || 'sin límite'
      }
    })),
    senales_info: {
      total: resolved.resolved_senales?.length || 0,
      senales: resolved.resolved_senales || []
    }
  };

  return preview;
}

/**
 * Ejecuta un paquete y emite las señales definidas
 * 
 * @param {Object} packageDefinition - Definición JSON del paquete
 * @param {Object} context - Contexto de ejecución
 * @param {Object} runtime - Runtime context (student_id, day_key, trace_id, etc.)
 * @returns {Promise<Object>} Resultado de la ejecución con:
 *   - sources: Array de sources resueltos
 *   - context_used: Contexto usado
 *   - resolved_senales: Señales resueltas
 *   - emitted_signals: Resultado de emisión de señales
 *   - warnings: Array de warnings
 */
export async function executePackage(packageDefinition, context = {}, runtime = {}) {
  // 1. Resolver el paquete
  const resolved = await resolvePackage(packageDefinition, context);
  
  // 2. Emitir señales si existen
  const emittedSignals = [];
  if (resolved.resolved_senales && resolved.resolved_senales.length > 0) {
    try {
      const { emitSignal } = await import('../../services/pde-signal-emitter.js');
      
      for (const senal of resolved.resolved_senales) {
        try {
          const emitResult = await emitSignal(
            senal.signal_key,
            senal.payload || {},
            runtime,
            resolved.context_used,
            {
              type: 'package',
              id: packageDefinition.package_key || 'unknown'
            }
          );
          
          emittedSignals.push({
            signal_key: senal.signal_key,
            ok: emitResult.ok,
            trace_id: emitResult.trace_id,
            automation_result: emitResult.automation_result,
            error: emitResult.error
          });
        } catch (err) {
          console.warn(`[AXE][PACKAGES] Error emitiendo señal ${senal.signal_key}:`, err);
          resolved.warnings.push(`Error emitiendo señal ${senal.signal_key}: ${err.message}`);
          emittedSignals.push({
            signal_key: senal.signal_key,
            ok: false,
            error: err.message
          });
        }
      }
    } catch (error) {
      console.error('[AXE][PACKAGES] Error importando servicio de emisión de señales:', error);
      resolved.warnings.push(`No se pudieron emitir señales: ${error.message}`);
    }
  }
  
  return {
    ...resolved,
    emitted_signals: emittedSignals
  };
}

