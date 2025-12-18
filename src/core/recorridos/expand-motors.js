// src/core/recorridos/expand-motors.js
// Expansión de steps motor en RecorridoDefinition
// Convierte steps de tipo "motor" en steps/edges/captures reales usando generateAxeStructure

import { getMotorByKey } from '../services/pde-motors-service.js';
import { generateAxeStructure } from '../services/pde-motors-service.js';
import { logInfo, logWarn, logError } from '../observability/logger.js';

/**
 * Expande todos los steps motor en una RecorridoDefinition
 * 
 * PRINCIPIO: El editor SOLO referencia motores, la expansión ocurre SOLO en publish
 * 
 * @param {Object} definition - RecorridoDefinition con steps motor
 * @param {Object} context - Contexto opcional para la expansión (puede incluir datos del estudiante)
 * @returns {Promise<Object>} RecorridoDefinition expandida con steps motor convertidos a steps reales
 * @throws {Error} Si algún motor no existe, no está published, o faltan inputs requeridos
 */
export async function expandMotorsInDefinition(definition, context = {}) {
  if (!definition || !definition.steps) {
    return definition;
  }

  const expandedSteps = { ...definition.steps };
  const expandedEdges = [...(definition.edges || [])];
  const expandedCaptures = [...(definition.captures || [])];
  const motorExpansions = [];

  // Identificar steps motor
  const motorSteps = Object.entries(definition.steps).filter(
    ([stepId, step]) => step.type === 'motor'
  );

  if (motorSteps.length === 0) {
    logInfo('MotorExpansion', 'No hay steps motor para expandir', {
      recorrido_id: definition.id
    });
    return definition;
  }

  logInfo('MotorExpansion', `Expandiendo ${motorSteps.length} step(s) motor`, {
    recorrido_id: definition.id,
    motor_steps: motorSteps.map(([stepId]) => stepId)
  });

  // Procesar cada step motor
  for (const [stepId, motorStep] of motorSteps) {
    try {
      const expansion = await expandMotorStep(stepId, motorStep, context);
      
      // Eliminar el step motor original
      delete expandedSteps[stepId];
      
      // Añadir los steps generados
      for (const [generatedStepId, generatedStep] of Object.entries(expansion.steps)) {
        expandedSteps[generatedStepId] = generatedStep;
      }
      
      // Añadir los edges generados (con mapeo de IDs)
      for (const edge of expansion.edges) {
        // Mapear from_step_id y to_step_id si referencian al step motor original
        const mappedEdge = {
          ...edge,
          from_step_id: edge.from_step_id === stepId 
            ? expansion.entry_step_id 
            : edge.from_step_id,
          to_step_id: edge.to_step_id === stepId 
            ? expansion.entry_step_id 
            : edge.to_step_id
        };
        expandedEdges.push(mappedEdge);
      }
      
      // Añadir los captures generados
      expandedCaptures.push(...(expansion.captures || []));
      
      // Actualizar edges que apuntaban al step motor original
      for (let i = 0; i < expandedEdges.length; i++) {
        const edge = expandedEdges[i];
        if (edge.from_step_id === stepId) {
          expandedEdges[i] = {
            ...edge,
            from_step_id: expansion.entry_step_id
          };
        }
        if (edge.to_step_id === stepId) {
          expandedEdges[i] = {
            ...edge,
            to_step_id: expansion.entry_step_id
          };
        }
      }
      
      // Si el step motor era el entry_step_id, usar el entry del motor expandido
      if (definition.entry_step_id === stepId) {
        definition.entry_step_id = expansion.entry_step_id;
      }
      
      motorExpansions.push({
        motor_step_id: stepId,
        motor_key: motorStep.motor_key,
        motor_version: motorStep.motor_version,
        generated_steps_count: Object.keys(expansion.steps).length,
        generated_edges_count: expansion.edges.length,
        entry_step_id: expansion.entry_step_id
      });
      
      logInfo('MotorExpansion', `Motor expandido exitosamente`, {
        motor_step_id: stepId,
        motor_key: motorStep.motor_key,
        motor_version: motorStep.motor_version,
        generated_steps: Object.keys(expansion.steps).length,
        generated_edges: expansion.edges.length
      });
      
    } catch (error) {
      logError('MotorExpansion', `Error expandiendo motor step "${stepId}"`, {
        motor_step_id: stepId,
        motor_key: motorStep.motor_key,
        motor_version: motorStep.motor_version,
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Error expandiendo motor step "${stepId}": ${error.message}`);
    }
  }

  // Construir definición expandida
  const expandedDefinition = {
    ...definition,
    steps: expandedSteps,
    edges: expandedEdges,
    captures: expandedCaptures,
    _motor_expansions: motorExpansions // Metadata para auditoría
  };

  logInfo('MotorExpansion', 'Expansión de motores completada', {
    recorrido_id: definition.id,
    expansions_count: motorExpansions.length,
    total_steps_after: Object.keys(expandedSteps).length
  });

  return expandedDefinition;
}

/**
 * Expande un step motor individual
 * 
 * @param {string} stepId - ID del step motor
 * @param {Object} motorStep - Step con type === "motor"
 * @param {Object} context - Contexto opcional
 * @returns {Promise<Object>} { steps, edges, captures, entry_step_id }
 */
async function expandMotorStep(stepId, motorStep, context = {}) {
  // Validar que el step tiene los campos requeridos
  if (!motorStep.motor_key || typeof motorStep.motor_key !== 'string') {
    throw new Error(`Step motor "${stepId}": falta "motor_key"`);
  }
  
  if (motorStep.motor_version === undefined || motorStep.motor_version === null) {
    throw new Error(`Step motor "${stepId}": falta "motor_version"`);
  }

  // Cargar el motor published
  const motor = await getMotorByKey(motorStep.motor_key);
  
  if (!motor) {
    throw new Error(`Motor con key "${motorStep.motor_key}" no encontrado`);
  }
  
  if (motor.status !== 'published') {
    throw new Error(`Motor "${motorStep.motor_key}" no está published (status: ${motor.status}). Solo se pueden usar motores con status = "published"`);
  }
  
  // Verificar que la versión coincide (si se especificó)
  if (motorStep.motor_version !== null && motor.version !== motorStep.motor_version) {
    logWarn('MotorExpansion', `Versión del motor no coincide`, {
      motor_key: motorStep.motor_key,
      expected_version: motorStep.motor_version,
      actual_version: motor.version,
      note: 'Se usará la versión actual del motor published'
    });
    // Fail-open: usar la versión actual del motor published
  }

  // Obtener inputs del step motor (pueden venir de motorStep.inputs o del context)
  const inputs = motorStep.inputs || {};
  
  // Combinar inputs del step con context si es necesario
  const finalInputs = { ...inputs };
  if (context.student) {
    // Si hay contexto del estudiante, puede usarse para inputs dinámicos
    // Por ahora, solo usamos inputs explícitos del step
  }

  // Generar estructura AXE usando el motor
  const motorId = motor.id; // UUID del motor
  const structure = await generateAxeStructure(motorId, finalInputs);
  
  if (!structure || !structure.steps || !Array.isArray(structure.steps)) {
    throw new Error(`Motor "${motorStep.motor_key}" generó estructura inválida: falta array "steps"`);
  }
  
  if (!structure.edges || !Array.isArray(structure.edges)) {
    throw new Error(`Motor "${motorStep.motor_key}" generó estructura inválida: falta array "edges"`);
  }

  // Convertir estructura a formato RecorridoDefinition
  // La estructura viene como { steps: [...], edges: [...], captures: [...] }
  // Necesitamos convertirla a { steps: {...}, edges: [...], captures: [...] }
  
  const stepsObject = {};
  let entryStepId = null;
  
  // Si structure.steps es un array, convertirlo a objeto
  if (Array.isArray(structure.steps)) {
    for (const step of structure.steps) {
      if (!step.id) {
        throw new Error(`Motor "${motorStep.motor_key}" generó step sin "id"`);
      }
      // Generar ID único para evitar colisiones
      const uniqueStepId = `${stepId}_${step.id}`;
      stepsObject[uniqueStepId] = {
        ...step,
        id: uniqueStepId // Asegurar que el ID es único
      };
      // El primer step o el que tenga entry: true es el entry
      if (!entryStepId || step.entry === true) {
        entryStepId = uniqueStepId;
      }
    }
  } else if (typeof structure.steps === 'object') {
    // Si ya es un objeto, usar directamente pero con prefijo para evitar colisiones
    for (const [originalStepId, step] of Object.entries(structure.steps)) {
      const uniqueStepId = `${stepId}_${originalStepId}`;
      stepsObject[uniqueStepId] = {
        ...step,
        id: uniqueStepId
      };
      if (!entryStepId) {
        entryStepId = uniqueStepId;
      }
    }
  }
  
  // Si no hay entry_step_id, usar el primero
  if (!entryStepId && Object.keys(stepsObject).length > 0) {
    entryStepId = Object.keys(stepsObject)[0];
  }
  
  // Mapear edges para usar los nuevos IDs únicos
  const mappedEdges = (structure.edges || []).map(edge => {
    const fromStepId = edge.from_step_id || edge.from;
    const toStepId = edge.to_step_id || edge.to;
    
    return {
      ...edge,
      from_step_id: fromStepId ? `${stepId}_${fromStepId}` : fromStepId,
      to_step_id: toStepId ? `${stepId}_${toStepId}` : toStepId
    };
  });
  
  // Mapear captures si existen
  const mappedCaptures = (structure.captures || []).map(capture => ({
    ...capture,
    step_id: capture.step_id ? `${stepId}_${capture.step_id}` : capture.step_id
  }));

  return {
    steps: stepsObject,
    edges: mappedEdges,
    captures: mappedCaptures,
    entry_step_id: entryStepId
  };
}

