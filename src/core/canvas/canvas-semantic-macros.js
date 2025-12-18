// src/core/canvas/canvas-semantic-macros.js
// Macros semánticas compuestas para CanvasDefinition
// AXE v0.6.6 - Acciones Semánticas Compuestas (Macros)
//
// PRINCIPIOS:
// - Agrupan acciones existentes del canvas
// - Representan intenciones pedagógicas comunes
// - Se ejecutan como secuencia validada
// - Usan únicamente helpers existentes de canvas-semantic-actions.js
// - Cada macro devuelve un nuevo CanvasDefinition
// - Validan y normalizan al final
// - Sin auto-save
// - Sin cambios en publish ni runtime

import {
  insertNodeAfter,
  convertNodeToDecision,
  markAsStart,
  markAsEnd
} from './canvas-semantic-actions.js';
import { validateCanvasDefinition } from './validate-canvas-definition.js';
import { normalizeCanvasDefinition } from './normalize-canvas-definition.js';

/**
 * Genera un ID único para un nodo o edge
 */
function generateUniqueId(prefix, existingIds) {
  let counter = 1;
  let id = `${prefix}_${counter}`;
  while (existingIds.has(id)) {
    counter++;
    id = `${prefix}_${counter}`;
  }
  return id;
}

/**
 * Macro: insertStandardEnding
 * 
 * Inserta un nodo de finalización estándar después del nodo especificado.
 * Crea un nodo "end" con template "ending" y lo conecta correctamente.
 * 
 * @param {Object} canvas - CanvasDefinition original
 * @param {string} nodeId - ID del nodo después del cual insertar el ending
 * @param {Object} options - Opciones opcionales
 * @param {string} options.label - Label del nodo ending (default: "Finalización")
 * @param {string} options.templateId - Template ID del ending (default: "ending")
 * @returns {Object} CanvasDefinition nuevo con el ending insertado
 */
export function insertStandardEnding(canvas, nodeId, options = {}) {
  if (!canvas || typeof canvas !== 'object') {
    throw new Error('CanvasDefinition debe ser un objeto');
  }

  if (!nodeId || typeof nodeId !== 'string') {
    throw new Error('nodeId debe ser un string');
  }

  const { label = 'Finalización', templateId = 'ending' } = options;

  // Verificar que el nodo existe
  const existingNode = (canvas.nodes || []).find(n => n.id === nodeId);
  if (!existingNode) {
    throw new Error(`Nodo '${nodeId}' no existe en el canvas`);
  }

  // Generar ID único para el nuevo nodo
  const existingNodeIds = new Set((canvas.nodes || []).map(n => n.id));
  const newNodeId = generateUniqueId('ending', existingNodeIds);

  // Crear el nodo ending
  const endingNode = {
    id: newNodeId,
    type: 'screen',
    label,
    position: { x: 0, y: 0 },
    props: {
      screen_template_id: templateId
    }
  };

  // Insertar el nodo después del nodo especificado
  let resultCanvas = insertNodeAfter(canvas, nodeId, endingNode);

  // Marcar el nodo como end
  resultCanvas = markAsEnd(resultCanvas, newNodeId);

  // Validar y normalizar al final
  const validation = validateCanvasDefinition(resultCanvas);
  if (validation.errors.length > 0) {
    throw new Error(`Canvas inválido después de insertStandardEnding: ${validation.errors.join(', ')}`);
  }

  return normalizeCanvasDefinition(resultCanvas);
}

/**
 * Macro: createGuidedChoice
 * 
 * Crea una estructura de decisión guiada:
 * 1. Convierte el nodo especificado a decision
 * 2. Inserta un nodo después de cada opción de la decisión
 * 3. Opcionalmente marca el último nodo como end
 * 
 * @param {Object} canvas - CanvasDefinition original
 * @param {string} nodeId - ID del nodo a convertir a decisión guiada
 * @param {Object} options - Opciones opcionales
 * @param {Array<Object>} options.choices - Array de { choice_id, label, nextNodeLabel }
 * @param {boolean} options.addEnding - Si es true, añade ending después de cada opción (default: false)
 * @returns {Object} CanvasDefinition nuevo con la decisión guiada creada
 */
export function createGuidedChoice(canvas, nodeId, options = {}) {
  if (!canvas || typeof canvas !== 'object') {
    throw new Error('CanvasDefinition debe ser un objeto');
  }

  if (!nodeId || typeof nodeId !== 'string') {
    throw new Error('nodeId debe ser un string');
  }

  const { choices = null, addEnding = false } = options;

  // Convertir el nodo a decision
  let resultCanvas = convertNodeToDecision(canvas, nodeId);

  // Obtener el nodo decision actualizado
  const decisionNode = resultCanvas.nodes.find(n => n.id === nodeId);
  if (!decisionNode || decisionNode.type !== 'decision') {
    throw new Error(`No se pudo convertir el nodo '${nodeId}' a decision`);
  }

  // Si se proporcionaron choices personalizados, actualizarlos
  if (choices && Array.isArray(choices) && choices.length >= 2) {
    decisionNode.props.choices = choices.map(c => ({
      choice_id: c.choice_id || `choice_${Math.random().toString(36).substr(2, 9)}`,
      label: c.label || 'Opción'
    }));
  }

  // Asegurar que hay al menos 2 choices
  if (!decisionNode.props.choices || decisionNode.props.choices.length < 2) {
    decisionNode.props.choices = [
      { choice_id: 'choice_1', label: 'Opción 1' },
      { choice_id: 'choice_2', label: 'Opción 2' }
    ];
  }

  // Para cada choice, crear un nodo y edge con condición
  // NOTA: No usamos insertNodeAfter aquí porque necesitamos múltiples edges desde el mismo nodo
  const existingNodeIds = new Set(resultCanvas.nodes.map(n => n.id));
  const existingEdgeIds = new Set(resultCanvas.edges.map(e => e.id));

  // Guardar edges salientes originales del nodo decision (si existen)
  const originalOutgoingEdges = resultCanvas.edges.filter(e => e.from_node_id === nodeId);
  
  // Eliminar edges salientes originales (los recrearemos con condiciones)
  resultCanvas.edges = resultCanvas.edges.filter(e => e.from_node_id !== nodeId);

  for (let i = 0; i < decisionNode.props.choices.length; i++) {
    const choice = decisionNode.props.choices[i];
    const choiceId = choice.choice_id;

    // Crear nodo para esta opción
    const nextNodeId = generateUniqueId(`choice_${choiceId}_node`, existingNodeIds);
    existingNodeIds.add(nextNodeId);

    const nextNodeLabel = choices && choices[i]?.nextNodeLabel 
      ? choices[i].nextNodeLabel 
      : `Seguimiento: ${choice.label}`;

    const nextNode = {
      id: nextNodeId,
      type: 'screen',
      label: nextNodeLabel,
      position: { x: 0, y: 0 },
      props: {
        screen_template_id: 'blank'
      }
    };

    // Añadir el nodo
    resultCanvas.nodes.push(nextNode);

    // Crear edge con condición
    const newEdgeId = generateUniqueId(`edge_${choiceId}`, existingEdgeIds);
    existingEdgeIds.add(newEdgeId);

    resultCanvas.edges.push({
      id: newEdgeId,
      from_node_id: nodeId,
      to_node_id: nextNodeId,
      type: 'conditional',
      condition: choiceId,
      label: choice.label
    });

    // Si addEnding es true, añadir ending después de este nodo
    if (addEnding) {
      resultCanvas = insertStandardEnding(resultCanvas, nextNodeId, {
        label: `Finalización: ${choice.label}`,
        templateId: 'ending'
      });
    }
  }

  // Validar y normalizar al final
  const validation = validateCanvasDefinition(resultCanvas);
  if (validation.errors.length > 0) {
    throw new Error(`Canvas inválido después de createGuidedChoice: ${validation.errors.join(', ')}`);
  }

  return normalizeCanvasDefinition(resultCanvas);
}

/**
 * Macro: createBranchingPath
 * 
 * Crea una estructura de ramificación:
 * 1. Inserta un nodo de decisión después del nodo especificado
 * 2. Crea múltiples ramas (una por cada opción)
 * 3. Opcionalmente añade endings a cada rama
 * 
 * @param {Object} canvas - CanvasDefinition original
 * @param {string} nodeId - ID del nodo después del cual crear la ramificación
 * @param {Object} options - Opciones opcionales
 * @param {Array<Object>} options.branches - Array de { label, choiceLabel, addEnding }
 * @param {string} options.decisionLabel - Label del nodo decisión (default: "Decisión")
 * @returns {Object} CanvasDefinition nuevo con la ramificación creada
 */
export function createBranchingPath(canvas, nodeId, options = {}) {
  if (!canvas || typeof canvas !== 'object') {
    throw new Error('CanvasDefinition debe ser un objeto');
  }

  if (!nodeId || typeof nodeId !== 'string') {
    throw new Error('nodeId debe ser un string');
  }

  const { branches = [{ label: 'Rama 1' }, { label: 'Rama 2' }], decisionLabel = 'Decisión' } = options;

  if (!Array.isArray(branches) || branches.length < 2) {
    throw new Error('branches debe ser un array con al menos 2 elementos');
  }

  // Generar ID único para el nodo decisión
  const existingNodeIds = new Set((canvas.nodes || []).map(n => n.id));
  const decisionNodeId = generateUniqueId('decision', existingNodeIds);

  // Crear nodo decisión
  const decisionNode = {
    id: decisionNodeId,
    type: 'decision',
    label: decisionLabel,
    position: { x: 0, y: 0 },
    props: {
      choices: branches.map((branch, index) => ({
        choice_id: `choice_${index + 1}`,
        label: branch.choiceLabel || branch.label || `Opción ${index + 1}`
      }))
    }
  };

  // Insertar nodo decisión después del nodo especificado
  let resultCanvas = insertNodeAfter(canvas, nodeId, decisionNode);

  // Crear ramas usando createGuidedChoice
  const choices = branches.map((branch, index) => ({
    choice_id: `choice_${index + 1}`,
    label: branch.choiceLabel || branch.label || `Opción ${index + 1}`,
    nextNodeLabel: branch.label || `Rama ${index + 1}`
  }));

  resultCanvas = createGuidedChoice(resultCanvas, decisionNodeId, {
    choices,
    addEnding: branches.some(b => b.addEnding !== false) // Por defecto true si no se especifica
  });

  // Validar y normalizar al final
  const validation = validateCanvasDefinition(resultCanvas);
  if (validation.errors.length > 0) {
    throw new Error(`Canvas inválido después de createBranchingPath: ${validation.errors.join(', ')}`);
  }

  return normalizeCanvasDefinition(resultCanvas);
}

/**
 * Macro: createLinearSequence
 * 
 * Crea una secuencia lineal de nodos después del nodo especificado.
 * 
 * @param {Object} canvas - CanvasDefinition original
 * @param {string} nodeId - ID del nodo después del cual crear la secuencia
 * @param {Object} options - Opciones opcionales
 * @param {Array<Object>} options.nodes - Array de { label, type, props }
 * @param {boolean} options.addEnding - Si es true, añade ending al final (default: false)
 * @returns {Object} CanvasDefinition nuevo con la secuencia creada
 */
export function createLinearSequence(canvas, nodeId, options = {}) {
  if (!canvas || typeof canvas !== 'object') {
    throw new Error('CanvasDefinition debe ser un objeto');
  }

  if (!nodeId || typeof nodeId !== 'string') {
    throw new Error('nodeId debe ser un string');
  }

  const { nodes = [], addEnding = false } = options;

  if (!Array.isArray(nodes) || nodes.length === 0) {
    throw new Error('nodes debe ser un array con al menos un elemento');
  }

  let resultCanvas = canvas;
  let lastNodeId = nodeId;

  // Insertar cada nodo en secuencia
  for (const nodeDef of nodes) {
    const existingNodeIds = new Set(resultCanvas.nodes.map(n => n.id));
    const newNodeId = nodeDef.id || generateUniqueId('sequence', existingNodeIds);

    const newNode = {
      id: newNodeId,
      type: nodeDef.type || 'screen',
      label: nodeDef.label || newNodeId,
      position: { x: 0, y: 0 },
      props: nodeDef.props || { screen_template_id: 'blank' }
    };

    resultCanvas = insertNodeAfter(resultCanvas, lastNodeId, newNode);
    lastNodeId = newNodeId;
  }

  // Si addEnding es true, añadir ending al final
  if (addEnding) {
    resultCanvas = insertStandardEnding(resultCanvas, lastNodeId, {
      label: 'Finalización',
      templateId: 'ending'
    });
  }

  // Validar y normalizar al final
  const validation = validateCanvasDefinition(resultCanvas);
  if (validation.errors.length > 0) {
    throw new Error(`Canvas inválido después de createLinearSequence: ${validation.errors.join(', ')}`);
  }

  return normalizeCanvasDefinition(resultCanvas);
}

/**
 * Lista todas las macros disponibles
 * 
 * @returns {Array<Object>} Array de { name, description, params }
 */
export function listAvailableMacros() {
  return [
    {
      name: 'insertStandardEnding',
      description: 'Inserta un nodo de finalización estándar después del nodo especificado',
      params: {
        nodeId: 'string (requerido)',
        options: {
          label: 'string (opcional, default: "Finalización")',
          templateId: 'string (opcional, default: "ending")'
        }
      }
    },
    {
      name: 'createGuidedChoice',
      description: 'Crea una estructura de decisión guiada con nodos después de cada opción',
      params: {
        nodeId: 'string (requerido)',
        options: {
          choices: 'Array<Object> (opcional)',
          addEnding: 'boolean (opcional, default: false)'
        }
      }
    },
    {
      name: 'createBranchingPath',
      description: 'Crea una estructura de ramificación con múltiples ramas',
      params: {
        nodeId: 'string (requerido)',
        options: {
          branches: 'Array<Object> (opcional, default: 2 ramas)',
          decisionLabel: 'string (opcional, default: "Decisión")'
        }
      }
    },
    {
      name: 'createLinearSequence',
      description: 'Crea una secuencia lineal de nodos',
      params: {
        nodeId: 'string (requerido)',
        options: {
          nodes: 'Array<Object> (requerido)',
          addEnding: 'boolean (opcional, default: false)'
        }
      }
    }
  ];
}

