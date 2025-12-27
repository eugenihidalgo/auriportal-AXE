// context-resolver-v1.js
// Context Resolver v1 - Motor principal de resolución
//
// Responsabilidades:
// - Resolver contextos para ejecuciones (paquetes, widgets, automatizaciones, temas)
// - Aplicar precedencia canónica
// - Validar contra Context Registry
// - Proporcionar provenance completa
// - Fail-open absoluto

import { resolveContextWithPrecedence } from './context-precedence.js';
import { validateContextValue, getFailOpenValue } from './context-validation.js';
import { getRequestId } from '../observability/request-context.js';

/**
 * Resuelve contextos para una ejecución
 * 
 * @param {Object} options - Opciones de resolución
 * @param {Object} options.contextRequest - ContextRequest
 * @param {Object} options.executionContext - ExecutionContext
 * @returns {Promise<Object>} ResolvedContext con resolved, meta, provenance
 */
export async function resolveContexts({ contextRequest, executionContext }) {
  const { required = [], optional = [], meta } = contextRequest;
  const { executionId, requestId, executionType } = executionContext;

  const resolved = {};
  const provenance = {};
  const allWarnings = [];

  // Resolver contextos requeridos
  for (const context_key of required) {
    try {
      const result = await resolveSingleContext(context_key, executionContext, contextRequest);
      resolved[context_key] = result.value;
      provenance[context_key] = result.provenance;

      // Acumular warnings
      if (result.provenance.warnings) {
        allWarnings.push(...result.provenance.warnings.map(w => `[${context_key}] ${w}`));
      }
    } catch (error) {
      console.error(`[ContextResolver] Error resolving required context '${context_key}':`, error);
      
      // Fail-open: usar valor por defecto seguro
      const failOpenValue = await getFailOpenValueForContext(context_key);
      resolved[context_key] = failOpenValue;
      provenance[context_key] = {
        source: 'fail_open',
        precedence_level: 7,
        warnings: [`Error resolving context: ${error.message}`],
        notes: ['Fail-open applied due to error']
      };
      allWarnings.push(`[${context_key}] Error resolving context, using fail-open default`);
    }
  }

  // Resolver contextos opcionales (solo si se pueden resolver, no fallan si no se encuentran)
  for (const context_key of optional || []) {
    try {
      const result = await resolveSingleContext(context_key, executionContext, contextRequest);
      resolved[context_key] = result.value;
      provenance[context_key] = result.provenance;

      if (result.provenance.warnings) {
        allWarnings.push(...result.provenance.warnings.map(w => `[${context_key}] ${w}`));
      }
    } catch (error) {
      // Para opcionales, simplemente no incluirlos si fallan
      console.debug(`[ContextResolver] Optional context '${context_key}' not resolved:`, error.message);
    }
  }

  // Construir ResolvedContext
  const resolvedContext = {
    resolved,
    meta: {
      version: '1.0.0',
      createdAt: new Date(),
      requestId: requestId || executionContext.requestId || getRequestId() || 'unknown',
      executionId: executionId || executionContext.executionId || 'unknown',
      purpose: contextRequest.purpose || meta?.purpose || 'unknown'
    },
    provenance,
    ...(allWarnings.length > 0 && { warnings: allWarnings })
  };

  // Log warnings si existen
  if (allWarnings.length > 0) {
    console.warn(`[ContextResolver] Warnings for execution ${executionId}:`, allWarnings);
  }

  return resolvedContext;
}

/**
 * Resuelve un contexto individual aplicando precedencia y validación
 * 
 * @param {string} context_key - Clave del contexto
 * @param {Object} executionContext - ExecutionContext
 * @param {Object} contextRequest - ContextRequest
 * @returns {Promise<Object>} { value: any, provenance: Object }
 */
async function resolveSingleContext(context_key, executionContext, contextRequest) {
  // 1. Resolver usando precedencia
  const precedenceResult = await resolveContextWithPrecedence({
    context_key,
    executionContext,
    contextRequest
  });

  // 2. Validar contra registry
  const validation = await validateContextValue(
    context_key,
    precedenceResult.value,
    null // Se busca automáticamente
  );

  // 3. Aplicar valor validado/coercido
  const finalValue = validation.coerced_value !== undefined ? validation.coerced_value : precedenceResult.value;

  // 4. Combinar provenance con warnings de validación
  const finalProvenance = {
    ...precedenceResult.provenance,
    ...(validation.warnings && validation.warnings.length > 0 && {
      warnings: [
        ...(precedenceResult.provenance.warnings || []),
        ...validation.warnings
      ]
    }),
    ...(validation.errors && validation.errors.length > 0 && {
      errors: validation.errors
    }),
    ...(validation.coerced_value !== precedenceResult.value && {
      notes: [
        ...(precedenceResult.provenance.notes || []),
        `Value coerced during validation: ${JSON.stringify(precedenceResult.value)} → ${JSON.stringify(finalValue)}`
      ]
    })
  };

  return {
    value: finalValue,
    provenance: finalProvenance
  };
}

/**
 * Obtiene valor fail-open para un contexto (helper)
 */
async function getFailOpenValueForContext(context_key) {
  try {
    const { getContext } = await import('../../services/pde-contexts-service.js');
    const contextDef = await getContext(context_key);
    if (contextDef) {
      const def = contextDef.definition || contextDef;
      const type = def.type || 'string';
      const allowedValues = def.allowed_values || null;
      return getFailOpenValue(type, allowedValues);
    }
  } catch (error) {
    // Silenciar errores
  }
  
  // Fallback: string vacío
  return '';
}
