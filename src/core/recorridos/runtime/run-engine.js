// src/core/recorridos/runtime/run-engine.js
// Motor de ejecución de recorridos en runtime
//
// RESPONSABILIDAD:
// - Ejecutar motores automáticamente (sin render)
// - Navegar entre steps según edges
// - Actualizar context
// - Determinar siguiente step

import { expandMotorsInDefinition } from '../expand-motors.js';
import { logInfo, logWarn, logError } from '../../observability/logger.js';

/**
 * Ejecuta el engine de un recorrido
 * 
 * @param {Object} params
 * @param {Object} params.definition - RecorridoDefinition (ya expandida o no)
 * @param {Object} params.run - Run actual
 * @param {Object} params.context - Contexto del run (state_json)
 * @param {Object} [params.capture] - Datos capturados del step anterior
 * @param {string} [params.action] - Acción a realizar ('next' para avanzar)
 * @returns {Promise<Object>} { ok, currentStep, nextStepId, context, completed, error }
 */
export async function executeRunEngine({ definition, run, context = {}, capture = {}, action = null }) {
  try {
    // Expandir motores si no están expandidos
    // NOTA: En runtime, los motores ya deberían estar expandidos en publish,
    // pero por seguridad expandimos de nuevo
    let expandedDefinition = definition;
    if (hasMotorSteps(definition)) {
      logInfo('RunEngine', 'Expandiendo motores en runtime', {
        recorrido_id: definition.id
      });
      expandedDefinition = await expandMotorsInDefinition(definition, { student: null });
    }

    // Obtener step actual
    const currentStepId = run.current_step_id || expandedDefinition.entry_step_id;
    const currentStep = expandedDefinition.steps[currentStepId];

    if (!currentStep) {
      return {
        ok: false,
        error: `Step "${currentStepId}" no encontrado en la definición`
      };
    }

    // Si es un step motor, ejecutarlo (aunque debería estar expandido)
    if (currentStep.type === 'motor') {
      logWarn('RunEngine', 'Step motor encontrado en runtime (debería estar expandido)', {
        step_id: currentStepId
      });
      // Intentar expandir solo este motor
      // Por ahora, retornar error (los motores deben estar expandidos en publish)
      return {
        ok: false,
        error: 'Step motor encontrado en runtime. Los motores deben expandirse en publish.'
      };
    }

    // Si action es 'next', avanzar al siguiente step
    if (action === 'next') {
      // Guardar capture en context si el step tiene capture configurado
      if (currentStep.capture && Object.keys(capture).length > 0) {
        const captureKey = currentStep.capture.key || currentStepId;
        context[captureKey] = capture;
        logInfo('RunEngine', 'Capture guardado en context', {
          capture_key: captureKey,
          capture_data: Object.keys(capture)
        });
      }

      // Encontrar siguiente step según edges
      const nextStepId = findNextStep(expandedDefinition, currentStepId, context);

      if (!nextStepId) {
        // No hay siguiente step, recorrido completado
        return {
          ok: true,
          currentStep: null,
          nextStepId: null,
          context,
          completed: true
        };
      }

      const nextStep = expandedDefinition.steps[nextStepId];

      if (!nextStep) {
        return {
          ok: false,
          error: `Siguiente step "${nextStepId}" no encontrado`
        };
      }

      return {
        ok: true,
        currentStep: nextStep,
        nextStepId,
        context,
        completed: false
      };
    }

    // Sin acción, solo retornar step actual
    return {
      ok: true,
      currentStep,
      nextStepId: currentStepId,
      context,
      completed: false
    };

  } catch (error) {
    logError('RunEngine', 'Error ejecutando engine', {
      error: error.message,
      stack: error.stack
    });
    return {
      ok: false,
      error: error.message
    };
  }
}

/**
 * Verifica si una definición tiene steps motor
 */
function hasMotorSteps(definition) {
  if (!definition || !definition.steps) return false;
  return Object.values(definition.steps).some(step => step.type === 'motor');
}

/**
 * Encuentra el siguiente step según edges y condiciones
 * 
 * @param {Object} definition - RecorridoDefinition expandida
 * @param {string} currentStepId - ID del step actual
 * @param {Object} context - Contexto del run
 * @returns {string|null} ID del siguiente step o null si no hay
 */
function findNextStep(definition, currentStepId, context) {
  if (!definition.edges || !Array.isArray(definition.edges)) {
    return null;
  }

  // Buscar edges que salen del step actual
  const outgoingEdges = definition.edges.filter(
    edge => edge.from_step_id === currentStepId
  );

  if (outgoingEdges.length === 0) {
    // No hay edges salientes, recorrido terminado
    return null;
  }

  // Ordenar por priority (mayor priority primero)
  outgoingEdges.sort((a, b) => {
    const priorityA = a.priority || 0;
    const priorityB = b.priority || 0;
    return priorityB - priorityA;
  });

  // Evaluar condiciones de cada edge
  for (const edge of outgoingEdges) {
    if (evaluateEdgeCondition(edge, context)) {
      return edge.to_step_id;
    }
  }

  // Si ningún edge cumple condición, usar el primero (sin condición o condición por defecto)
  return outgoingEdges[0].to_step_id;
}

/**
 * Evalúa la condición de un edge
 * 
 * @param {Object} edge - Edge con condition opcional
 * @param {Object} context - Contexto del run
 * @returns {boolean} true si la condición se cumple
 */
function evaluateEdgeCondition(edge, context) {
  if (!edge.condition) {
    // Sin condición, siempre válido
    return true;
  }

  const { type, params } = edge.condition;

  switch (type) {
    case 'always':
      return true;

    case 'never':
      return false;

    case 'equals':
      // params: { key, value }
      if (!params || !params.key) return true;
      const contextValue = getNestedValue(context, params.key);
      return String(contextValue) === String(params.value);

    case 'contains':
      // params: { key, value }
      if (!params || !params.key) return true;
      const contextValue2 = getNestedValue(context, params.key);
      return String(contextValue2).includes(String(params.value));

    default:
      // Condición desconocida, asumir válida (fail-open)
      logWarn('RunEngine', 'Condición desconocida, asumiendo válida', {
        condition_type: type
      });
      return true;
  }
}

/**
 * Obtiene un valor anidado de un objeto usando notación de punto
 * Ejemplo: getNestedValue({ a: { b: 1 } }, 'a.b') => 1
 */
function getNestedValue(obj, path) {
  if (!path) return undefined;
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}




