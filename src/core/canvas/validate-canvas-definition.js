// src/core/canvas/validate-canvas-definition.js
// Validador de CanvasDefinition
// Valida estructura, nodos, edges, conectividad y semántica

import { logInfo, logWarn, logError } from '../observability/logger.js';

/**
 * Valida una CanvasDefinition completa
 * 
 * @param {Object} canvas - CanvasDefinition a validar
 * @param {Object} options - Opciones de validación
 * @param {boolean} options.isPublish - Si es true, aplica validación estricta para publish
 * @returns {{ ok: boolean, errors: Array<string>, warnings: Array<string> }} Resultado de la validación
 */
export function validateCanvasDefinition(canvas, options = {}) {
  const { isPublish = false } = options;
  const errors = [];
  const warnings = [];

  // Validar estructura base
  const structureResult = validateStructure(canvas);
  errors.push(...structureResult.errors);
  warnings.push(...structureResult.warnings);

  // Si hay errores estructurales críticos, no continuar
  if (errors.length > 0 && isPublish) {
    return { ok: false, errors, warnings };
  }

  // Validar nodos
  if (canvas.nodes && Array.isArray(canvas.nodes)) {
    for (const node of canvas.nodes) {
      const nodeResult = validateNode(node, canvas, isPublish);
      errors.push(...nodeResult.errors);
      warnings.push(...nodeResult.warnings);
    }
  }

  // Validar edges
  if (canvas.edges && Array.isArray(canvas.edges)) {
    for (const edge of canvas.edges) {
      const edgeResult = validateEdge(edge, canvas);
      errors.push(...edgeResult.errors);
      warnings.push(...edgeResult.warnings);
    }
  }

  // Validar conectividad
  const connectivityResult = validateConnectivity(canvas);
  errors.push(...connectivityResult.errors);
  warnings.push(...connectivityResult.warnings);

  // Validar loops infinitos
  const loopsResult = validateLoops(canvas);
  errors.push(...loopsResult.errors);
  warnings.push(...loopsResult.warnings);

  const ok = errors.length === 0;

  if (!ok) {
    logWarn('CanvasValidator', `Validación fallida: ${errors.length} errores`, {
      canvas_id: canvas?.canvas_id,
      errors_count: errors.length,
      warnings_count: warnings.length,
      is_publish: isPublish
    });
  } else if (warnings.length > 0) {
    logInfo('CanvasValidator', `Validación exitosa con ${warnings.length} warnings`, {
      canvas_id: canvas?.canvas_id,
      warnings_count: warnings.length,
      is_publish: isPublish
    }, true);
  }

  return { ok, errors, warnings };
}

/**
 * Valida la estructura base del canvas
 */
function validateStructure(canvas) {
  const errors = [];
  const warnings = [];

  if (!canvas || typeof canvas !== 'object') {
    errors.push('CanvasDefinition debe ser un objeto');
    return { errors, warnings };
  }

  // Validar version
  if (canvas.version && canvas.version !== '1.0') {
    warnings.push(`Versión '${canvas.version}' no es la esperada (1.0)`);
  }

  // Validar canvas_id
  if (!canvas.canvas_id || typeof canvas.canvas_id !== 'string') {
    errors.push('CanvasDefinition debe tener un "canvas_id" (string)');
  }

  // Validar entry_node_id
  if (!canvas.entry_node_id || typeof canvas.entry_node_id !== 'string') {
    errors.push('CanvasDefinition debe tener un "entry_node_id" (string)');
  }

  // Validar nodes
  if (!canvas.nodes || !Array.isArray(canvas.nodes)) {
    errors.push('CanvasDefinition debe tener un array "nodes"');
  } else if (canvas.nodes.length === 0) {
    errors.push('CanvasDefinition debe tener al menos un nodo');
  } else {
    // Validar IDs únicos en nodes
    const nodeIds = canvas.nodes.map(n => n?.id).filter(Boolean);
    const duplicateNodeIds = nodeIds.filter((id, idx) => nodeIds.indexOf(id) !== idx);
    if (duplicateNodeIds.length > 0) {
      errors.push(`IDs de nodos duplicados: ${duplicateNodeIds.join(', ')}`);
    }
  }

  // Validar edges
  if (!canvas.edges || !Array.isArray(canvas.edges)) {
    errors.push('CanvasDefinition debe tener un array "edges"');
  } else {
    // Validar IDs únicos en edges
    const edgeIds = canvas.edges.map(e => e?.id).filter(Boolean);
    const duplicateEdgeIds = edgeIds.filter((id, idx) => edgeIds.indexOf(id) !== idx);
    if (duplicateEdgeIds.length > 0) {
      errors.push(`IDs de edges duplicados: ${duplicateEdgeIds.join(', ')}`);
    }
  }

  // Validar entry_node_id existe
  if (canvas.entry_node_id && canvas.nodes) {
    const entryNode = canvas.nodes.find(n => n.id === canvas.entry_node_id);
    if (!entryNode) {
      errors.push(`entry_node_id '${canvas.entry_node_id}' no existe en nodes`);
    }
  }

  return { errors, warnings };
}

/**
 * Valida un nodo individual
 */
function validateNode(node, canvas, isPublish = false) {
  const errors = [];
  const warnings = [];

  if (!node || typeof node !== 'object') {
    errors.push('Node debe ser un objeto');
    return { errors, warnings };
  }

  // Validar id
  if (!node.id || typeof node.id !== 'string') {
    errors.push('Node debe tener un "id" (string)');
  }

  // Validar type
  if (!node.type || typeof node.type !== 'string') {
    errors.push(`Node '${node.id}': debe tener un "type" (string)`);
  }

  // Validar props
  if (!node.props || typeof node.props !== 'object') {
    warnings.push(`Node '${node.id}': no tiene props (se usará objeto vacío)`);
  }

  // Validar meta si existe (AXE v0.6.8: metadatos pedagógicos de intención)
  // Validación ligera: solo estructura, no contenido (no bloqueante)
  if (node.meta !== undefined) {
    if (typeof node.meta !== 'object' || node.meta === null || Array.isArray(node.meta)) {
      warnings.push(`Node '${node.id}': meta debe ser un objeto (se ignorará)`);
    }
  }

  // Validaciones específicas por tipo de nodo
  if (node.type === 'start') {
    // StartNode no puede tener edges entrantes
    const incomingEdges = (canvas.edges || []).filter(e => e.to_node_id === node.id);
    if (incomingEdges.length > 0) {
      errors.push(`Node '${node.id}': StartNode no puede tener edges entrantes`);
    }
  }

  if (node.type === 'screen') {
    const props = node.props || {};
    if (!props.screen_template_id || typeof props.screen_template_id !== 'string') {
      errors.push(`Node '${node.id}': ScreenNode debe tener screen_template_id`);
    }
  }

  if (node.type === 'decision') {
    const props = node.props || {};
    if (isPublish) {
      const choices = props.choices || [];
      const choicesCount = Array.isArray(choices) ? choices.length : 0;
      
      if (choicesCount === 0) {
        // Si no hay choices, verificar si hay edges salientes que puedan servir como nextStep
        const outgoingEdges = (canvas.edges || []).filter(e => e.from_node_id === node.id);
        if (outgoingEdges.length === 0) {
          errors.push(`Node '${node.id}': DecisionNode debe tener al menos 1 choice o edge saliente en PUBLISH`);
        } else {
          // Hay edges salientes, se puede resolver automáticamente
          warnings.push(`Node '${node.id}': DecisionNode tiene 0 choices pero tiene ${outgoingEdges.length} edge(s) saliente(s), se tratará como passthrough`);
          logWarn('CanvasValidator', `[AXE][DECISION][PASSTHROUGH] DecisionNode '${node.id}' has 0 choices, auto-resolved via edges in publish`, {
            node_id: node.id,
            choices_count: 0,
            outgoing_edges_count: outgoingEdges.length,
            is_publish: true
          });
        }
      } else if (choicesCount === 1) {
        // Un solo choice: warning (passthrough), no error
        warnings.push(`Node '${node.id}': DecisionNode tiene 1 choice, se tratará como passthrough (auto-resuelto en publish)`);
        logWarn('CanvasValidator', `[AXE][DECISION][PASSTHROUGH] DecisionNode '${node.id}' has < 2 choices (${choicesCount}), auto-resolved in publish`, {
          node_id: node.id,
          choices_count: choicesCount,
          is_publish: true
        });
        
        // Validar choice_id único (si existe)
        const choice = choices[0];
        if (choice && choice.choice_id) {
          // Choice válido, no hacer nada más (solo el warning)
        }
      } else {
        // 2 o más choices: validar choice_ids únicos
        const choiceIds = choices.map(c => c?.choice_id).filter(Boolean);
        const duplicates = choiceIds.filter((id, idx) => choiceIds.indexOf(id) !== idx);
        if (duplicates.length > 0) {
          errors.push(`Node '${node.id}': choice_id duplicados: ${duplicates.join(', ')}`);
        }
      }
    }
  }

  if (node.type === 'condition') {
    const props = node.props || {};
    if (!props.condition_type || typeof props.condition_type !== 'string') {
      errors.push(`Node '${node.id}': ConditionNode debe tener condition_type`);
    }
    // Validar que tiene 2 edges salientes
    const outgoingEdges = (canvas.edges || []).filter(e => e.from_node_id === node.id);
    if (outgoingEdges.length !== 2) {
      errors.push(`Node '${node.id}': ConditionNode debe tener exactamente 2 edges salientes`);
    }
  }

  if (node.type === 'delay') {
    const props = node.props || {};
    if (isPublish) {
      if (!props.duration_seconds && !props.duration_minutes) {
        errors.push(`Node '${node.id}': DelayNode debe tener duración en PUBLISH`);
      }
    }
  }

  if (node.type === 'end') {
    // EndNode no puede tener edges salientes
    const outgoingEdges = (canvas.edges || []).filter(e => e.from_node_id === node.id);
    if (outgoingEdges.length > 0) {
      errors.push(`Node '${node.id}': EndNode no puede tener edges salientes`);
    }
  }

  return { errors, warnings };
}

/**
 * Valida un edge individual
 */
function validateEdge(edge, canvas) {
  const errors = [];
  const warnings = [];

  if (!edge || typeof edge !== 'object') {
    errors.push('Edge debe ser un objeto');
    return { errors, warnings };
  }

  // Validar from_node_id
  if (!edge.from_node_id || typeof edge.from_node_id !== 'string') {
    errors.push('Edge debe tener un "from_node_id" (string)');
  } else {
    const fromNode = (canvas.nodes || []).find(n => n.id === edge.from_node_id);
    if (!fromNode) {
      errors.push(`Edge '${edge.id || 'sin id'}': from_node_id '${edge.from_node_id}' no existe`);
    } else if (fromNode.type === 'end') {
      errors.push(`Edge '${edge.id || 'sin id'}': no puede salir de un EndNode`);
    }
  }

  // Validar to_node_id
  if (!edge.to_node_id || typeof edge.to_node_id !== 'string') {
    errors.push('Edge debe tener un "to_node_id" (string)');
  } else {
    const toNode = (canvas.nodes || []).find(n => n.id === edge.to_node_id);
    if (!toNode) {
      errors.push(`Edge '${edge.id || 'sin id'}': to_node_id '${edge.to_node_id}' no existe`);
    } else if (toNode.type === 'start') {
      errors.push(`Edge '${edge.id || 'sin id'}': no puede entrar a un StartNode`);
    }
  }

  // Validar condition si es conditional
  if (edge.type === 'conditional' && !edge.condition) {
    warnings.push(`Edge '${edge.id || 'sin id'}': conditional edge sin condition`);
  }

  return { errors, warnings };
}

/**
 * Valida conectividad del canvas
 */
function validateConnectivity(canvas) {
  const errors = [];
  const warnings = [];

  if (!canvas.nodes || !canvas.entry_node_id) {
    return { errors, warnings };
  }

  // Validar que hay exactamente un StartNode
  const startNodes = canvas.nodes.filter(n => n.type === 'start');
  if (startNodes.length === 0) {
    errors.push('Debe haber exactamente un nodo start');
  } else if (startNodes.length > 1) {
    errors.push(`Hay ${startNodes.length} nodos start, debe haber solo uno`);
  }

  // Validar que entry_node_id es un StartNode
  const entryNode = canvas.nodes.find(n => n.id === canvas.entry_node_id);
  if (entryNode && entryNode.type !== 'start') {
    errors.push(`entry_node_id '${canvas.entry_node_id}' debe ser un StartNode`);
  }

  // Validar que StartNode tiene edges salientes
  if (entryNode) {
    const outgoingEdges = (canvas.edges || []).filter(e => e.from_node_id === entryNode.id);
    if (outgoingEdges.length === 0) {
      errors.push('StartNode debe tener al menos un edge saliente');
    }
  }

  // Detectar nodos huérfanos (sin edges entrantes ni salientes, excepto start/end)
  const nodeIds = new Set(canvas.nodes.map(n => n.id));
  const nodesWithIncoming = new Set((canvas.edges || []).map(e => e.to_node_id));
  const nodesWithOutgoing = new Set((canvas.edges || []).map(e => e.from_node_id));

  for (const node of canvas.nodes) {
    if (node.type === 'start' || node.type === 'end' || node.type === 'group' || node.type === 'comment') {
      continue; // Skip start, end, group, comment
    }

    const hasIncoming = nodesWithIncoming.has(node.id);
    const hasOutgoing = nodesWithOutgoing.has(node.id);

    if (!hasIncoming && !hasOutgoing) {
      warnings.push(`Node '${node.id}': nodo huérfano (sin edges entrantes ni salientes)`);
    }
  }

  // Detectar nodos inalcanzables desde entry_node_id
  const reachable = getReachableNodes(canvas, canvas.entry_node_id);
  const unreachable = canvas.nodes.filter(n => {
    if (n.type === 'start' || n.type === 'group' || n.type === 'comment') {
      return false; // Start, group y comment no se consideran inalcanzables
    }
    return !reachable.has(n.id);
  });

  if (unreachable.length > 0) {
    warnings.push(`Nodos inalcanzables desde entry_node_id: ${unreachable.map(n => n.id).join(', ')}`);
  }

  // Detectar EndNodes inalcanzables
  const endNodes = canvas.nodes.filter(n => n.type === 'end');
  const unreachableEnds = endNodes.filter(n => !reachable.has(n.id));
  if (unreachableEnds.length > 0) {
    errors.push(`EndNodes inalcanzables: ${unreachableEnds.map(n => n.id).join(', ')}`);
  }

  return { errors, warnings };
}

/**
 * Obtiene todos los nodos alcanzables desde un nodo inicial
 */
function getReachableNodes(canvas, startNodeId) {
  const reachable = new Set();
  const visited = new Set();
  const queue = [startNodeId];

  while (queue.length > 0) {
    const currentNodeId = queue.shift();
    if (visited.has(currentNodeId)) {
      continue;
    }
    visited.add(currentNodeId);
    reachable.add(currentNodeId);

    // Encontrar todos los edges salientes
    const outgoingEdges = (canvas.edges || []).filter(e => e.from_node_id === currentNodeId);
    for (const edge of outgoingEdges) {
      if (!visited.has(edge.to_node_id)) {
        queue.push(edge.to_node_id);
      }
    }
  }

  return reachable;
}

/**
 * Valida loops infinitos sin salida
 */
function validateLoops(canvas) {
  const errors = [];
  const warnings = [];

  if (!canvas.nodes || !canvas.edges) {
    return { errors, warnings };
  }

  // Detectar ciclos sin condición de salida
  // Un ciclo es inválido si:
  // 1. Hay un ciclo en el grafo
  // 2. El ciclo no tiene ninguna condición que permita salir
  // 3. No hay EndNode alcanzable desde el ciclo

  const cycles = detectCycles(canvas);
  
  for (const cycle of cycles) {
    // Verificar si el ciclo tiene alguna condición de salida
    let hasExitCondition = false;
    for (let i = 0; i < cycle.length; i++) {
      const fromNodeId = cycle[i];
      const toNodeId = cycle[(i + 1) % cycle.length];
      const edge = canvas.edges.find(e => e.from_node_id === fromNodeId && e.to_node_id === toNodeId);
      
      if (edge && edge.type === 'conditional' && edge.condition) {
        // Si hay una condición que puede ser false, hay salida
        hasExitCondition = true;
        break;
      }
    }

    // Verificar si hay EndNode alcanzable desde el ciclo
    const cycleNodes = new Set(cycle);
    const hasReachableEnd = canvas.nodes.some(n => {
      if (n.type !== 'end') return false;
      // Verificar si es alcanzable desde algún nodo del ciclo
      for (const cycleNodeId of cycle) {
        const reachable = getReachableNodes(canvas, cycleNodeId);
        if (reachable.has(n.id)) {
          return true;
        }
      }
      return false;
    });

    if (!hasExitCondition && !hasReachableEnd) {
      errors.push(`Loop infinito detectado sin salida: ${cycle.join(' → ')}`);
    } else if (!hasExitCondition) {
      warnings.push(`Loop detectado sin condición de salida explícita: ${cycle.join(' → ')}`);
    }
  }

  return { errors, warnings };
}

/**
 * Detecta ciclos en el grafo
 * Retorna array de arrays, cada uno representa un ciclo (lista de node IDs)
 */
function detectCycles(canvas) {
  const cycles = [];
  const visited = new Set();
  const recStack = new Set();
  const path = [];

  const nodeIds = canvas.nodes.map(n => n.id);

  function dfs(nodeId) {
    visited.add(nodeId);
    recStack.add(nodeId);
    path.push(nodeId);

    const outgoingEdges = (canvas.edges || []).filter(e => e.from_node_id === nodeId);
    for (const edge of outgoingEdges) {
      const nextNodeId = edge.to_node_id;
      
      if (!visited.has(nextNodeId)) {
        dfs(nextNodeId);
      } else if (recStack.has(nextNodeId)) {
        // Ciclo detectado
        const cycleStart = path.indexOf(nextNodeId);
        const cycle = path.slice(cycleStart).concat([nextNodeId]);
        cycles.push(cycle);
      }
    }

    recStack.delete(nodeId);
    path.pop();
  }

  for (const nodeId of nodeIds) {
    if (!visited.has(nodeId)) {
      dfs(nodeId);
    }
  }

  return cycles;
}


