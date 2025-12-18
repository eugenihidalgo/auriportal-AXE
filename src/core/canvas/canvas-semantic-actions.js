// src/core/canvas/canvas-semantic-actions.js
// Helpers puros para acciones semánticas sobre CanvasDefinition
// AXE v0.6.4 - Acciones Semánticas sobre Canvas
//
// PRINCIPIOS:
// - Operan SOLO sobre CanvasDefinition (inmutables)
// - No acceden a UI
// - Devuelven canvas nuevo (no mutan el original)
// - Pasan siempre por validate + normalize
// - Mantienen compatibilidad AXE v0.6.x

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
 * Encuentra el siguiente nodo después de nodeId en el orden de edges
 */
function findNextNode(canvas, nodeId) {
  const outgoingEdges = (canvas.edges || []).filter(e => e.from_node_id === nodeId);
  if (outgoingEdges.length > 0) {
    return outgoingEdges[0].to_node_id;
  }
  return null;
}

/**
 * Obtiene todos los nodos alcanzables desde un nodo (subgrafo)
 */
function getSubgraphNodes(canvas, startNodeId) {
  const subgraph = new Set();
  const visited = new Set();
  const queue = [startNodeId];

  while (queue.length > 0) {
    const currentNodeId = queue.shift();
    if (visited.has(currentNodeId)) {
      continue;
    }
    visited.add(currentNodeId);
    subgraph.add(currentNodeId);

    const outgoingEdges = (canvas.edges || []).filter(e => e.from_node_id === currentNodeId);
    for (const edge of outgoingEdges) {
      if (!visited.has(edge.to_node_id)) {
        queue.push(edge.to_node_id);
      }
    }
  }

  return subgraph;
}

/**
 * Obtiene todos los nodos alcanzables desde un nodo inicial (BFS)
 * Similar a getSubgraphNodes pero usado para validación de conectividad
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
 * Encuentra el nodo alcanzable más profundo (más lejos del start)
 * que tiene edges salientes, útil para reconectar nodos END inalcanzables
 */
function findDeepestReachableNodeWithOutgoingEdges(canvas, reachableNodes, startNodeId) {
  // Calcular profundidad de cada nodo alcanzable desde start
  const depths = new Map();
  const visited = new Set();
  const queue = [{ nodeId: startNodeId, depth: 0 }];
  
  while (queue.length > 0) {
    const { nodeId, depth } = queue.shift();
    if (visited.has(nodeId)) {
      continue;
    }
    visited.add(nodeId);
    depths.set(nodeId, depth);
    
    const outgoingEdges = (canvas.edges || []).filter(e => e.from_node_id === nodeId);
    for (const edge of outgoingEdges) {
      if (reachableNodes.has(edge.to_node_id) && !visited.has(edge.to_node_id)) {
        queue.push({ nodeId: edge.to_node_id, depth: depth + 1 });
      }
    }
  }
  
  // Buscar nodos alcanzables que tienen edges salientes, ordenados por profundidad
  const candidates = [];
  
  for (const nodeId of reachableNodes) {
    const node = canvas.nodes.find(n => n.id === nodeId);
    if (!node || node.type === 'end') {
      continue; // Skip end nodes
    }
    
    const outgoingEdges = (canvas.edges || []).filter(e => e.from_node_id === nodeId);
    if (outgoingEdges.length > 0) {
      const depth = depths.get(nodeId) || 0;
      candidates.push({ nodeId, depth });
    }
  }
  
  // Ordenar por profundidad descendente y devolver el más profundo
  if (candidates.length > 0) {
    candidates.sort((a, b) => b.depth - a.depth);
    return candidates[0].nodeId;
  }
  
  return null;
}

/**
 * Repara nodos END inalcanzables reconectándolos al último nodo alcanzable anterior
 * 
 * Esta función detecta nodos de tipo "end" que no son alcanzables desde el nodo "start"
 * y los reconecta automáticamente para mantener la validez del canvas.
 * 
 * Estrategia:
 * 1. Detecta nodos END inalcanzables desde entry_node_id
 * 2. Para cada nodo END inalcanzable, busca si hay edges entrantes desde nodos alcanzables
 * 3. Si no hay, encuentra el nodo alcanzable más profundo (más lejos del start) con edges salientes
 * 4. Conecta ese nodo al END inalcanzable
 * 5. No crea loops ni modifica nodos que ya son alcanzables
 * 
 * @param {Object} canvas - CanvasDefinition a reparar
 * @returns {Object} CanvasDefinition nuevo con nodos END reparados (o el mismo si no hay reparaciones)
 */
export function repairUnreachableEndNodes(canvas) {
  if (!canvas || !canvas.nodes || !canvas.entry_node_id) {
    return canvas;
  }

  // Obtener nodos alcanzables desde entry_node_id
  const reachableNodes = getReachableNodes(canvas, canvas.entry_node_id);
  
  // Encontrar nodos END inalcanzables
  const endNodes = canvas.nodes.filter(n => n.type === 'end');
  const unreachableEndNodes = endNodes.filter(n => !reachableNodes.has(n.id));
  
  // Si no hay nodos END inalcanzables, devolver el canvas sin cambios
  if (unreachableEndNodes.length === 0) {
    return canvas;
  }

  // Crear copia del canvas para modificarlo
  const repairedCanvas = JSON.parse(JSON.stringify(canvas));
  
  // AXE v0.6.9: Estrategia mejorada - preferir nodos "leaf" (sin outgoing) si existen
  // 1) Buscar nodos alcanzables sin edges salientes (leaf nodes)
  const leafNodes = [];
  for (const nodeId of reachableNodes) {
    const node = repairedCanvas.nodes.find(n => n.id === nodeId);
    if (!node || node.type === 'end' || node.type === 'start') {
      continue; // Skip end/start nodes
    }
    const outgoingEdges = (repairedCanvas.edges || []).filter(e => e.from_node_id === nodeId);
    if (outgoingEdges.length === 0) {
      leafNodes.push(nodeId);
    }
  }
  
  // 2) Si hay leaf nodes, usar el más profundo
  let bestReconnectionNode = null;
  if (leafNodes.length > 0) {
    // Calcular profundidad de cada leaf
    const depths = new Map();
    const visited = new Set();
    const queue = [{ nodeId: canvas.entry_node_id, depth: 0 }];
    
    while (queue.length > 0) {
      const { nodeId, depth } = queue.shift();
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      depths.set(nodeId, depth);
      
      const outgoingEdges = (repairedCanvas.edges || []).filter(e => e.from_node_id === nodeId);
      for (const edge of outgoingEdges) {
        if (reachableNodes.has(edge.to_node_id) && !visited.has(edge.to_node_id)) {
          queue.push({ nodeId: edge.to_node_id, depth: depth + 1 });
        }
      }
    }
    
    // Seleccionar el leaf más profundo
    let maxDepth = -1;
    for (const leafId of leafNodes) {
      const depth = depths.get(leafId) || 0;
      if (depth > maxDepth) {
        maxDepth = depth;
        bestReconnectionNode = leafId;
      }
    }
  }
  
  // 3) Si no hay leaf nodes, usar el nodo alcanzable más profundo con edges salientes
  if (!bestReconnectionNode) {
    bestReconnectionNode = findDeepestReachableNodeWithOutgoingEdges(
      repairedCanvas, 
      reachableNodes, 
      canvas.entry_node_id
    );
  }
  
  if (!bestReconnectionNode) {
    // Si no hay nodo alcanzable con edges salientes, buscar el entry_node_id mismo
    const entryNode = repairedCanvas.nodes.find(n => n.id === repairedCanvas.entry_node_id);
    if (entryNode && entryNode.type === 'start') {
      // El start node siempre tiene edges salientes (validado antes)
      const startOutgoingEdges = (repairedCanvas.edges || []).filter(e => e.from_node_id === repairedCanvas.entry_node_id);
      if (startOutgoingEdges.length > 0) {
        // Usar el destino del primer edge del start como punto de reconexión
        const firstTarget = startOutgoingEdges[0].to_node_id;
        if (reachableNodes.has(firstTarget)) {
          // Reconectar desde ese nodo a cada END inalcanzable
          const existingEdgeIds = new Set((repairedCanvas.edges || []).map(e => e.id));
          
          for (const endNode of unreachableEndNodes) {
            // Verificar que no exista ya un edge (evitar duplicados)
            const existingEdge = repairedCanvas.edges.find(
              e => e.from_node_id === firstTarget && e.to_node_id === endNode.id
            );
            
            if (!existingEdge) {
              const newEdgeId = generateUniqueId('edge', existingEdgeIds);
              existingEdgeIds.add(newEdgeId);
              
              repairedCanvas.edges.push({
                id: newEdgeId,
                from_node_id: firstTarget,
                to_node_id: endNode.id,
                type: 'direct'
              });
            }
          }
        }
      }
    }
    return repairedCanvas;
  }

  // Reconectar cada nodo END inalcanzable al mejor nodo de reconexión encontrado
  const existingEdgeIds = new Set((repairedCanvas.edges || []).map(e => e.id));
  
  for (const endNode of unreachableEndNodes) {
    // Primero verificar si ya hay edges entrantes desde nodos alcanzables
    const incomingEdgesFromReachable = repairedCanvas.edges.filter(
      e => e.to_node_id === endNode.id && reachableNodes.has(e.from_node_id)
    );
    
    // Si ya hay edges entrantes desde nodos alcanzables, no necesitamos hacer nada
    if (incomingEdgesFromReachable.length > 0) {
      continue;
    }
    
    // Verificar que no exista ya un edge desde bestReconnectionNode a este END
    const existingEdge = repairedCanvas.edges.find(
      e => e.from_node_id === bestReconnectionNode && e.to_node_id === endNode.id
    );
    
    if (!existingEdge) {
      // Verificar que no creemos un loop (el END no debe tener edge hacia bestReconnectionNode)
      // Nota: Los nodos END no pueden tener edges salientes por definición, así que esto es seguro
      const newEdgeId = generateUniqueId('edge', existingEdgeIds);
      existingEdgeIds.add(newEdgeId);
      
      repairedCanvas.edges.push({
        id: newEdgeId,
        from_node_id: bestReconnectionNode,
        to_node_id: endNode.id,
        type: 'direct'
      });
    }
  }

  return repairedCanvas;
}

/**
 * Inserta un nuevo nodo después del nodo especificado
 * 
 * @param {Object} canvas - CanvasDefinition original
 * @param {string} nodeId - ID del nodo después del cual insertar
 * @param {Object} newNode - Nuevo nodo a insertar (debe tener id, type, label, props, position)
 * @returns {Object} CanvasDefinition nuevo con el nodo insertado
 */
export function insertNodeAfter(canvas, nodeId, newNode) {
  if (!canvas || typeof canvas !== 'object') {
    throw new Error('CanvasDefinition debe ser un objeto');
  }

  if (!nodeId || typeof nodeId !== 'string') {
    throw new Error('nodeId debe ser un string');
  }

  if (!newNode || typeof newNode !== 'object') {
    throw new Error('newNode debe ser un objeto');
  }

  // Validar que el nodo existe
  const existingNode = (canvas.nodes || []).find(n => n.id === nodeId);
  if (!existingNode) {
    throw new Error(`Nodo '${nodeId}' no existe en el canvas`);
  }

  // Crear copia del canvas
  const newCanvas = JSON.parse(JSON.stringify(canvas));

  // Asegurar que el nuevo nodo tiene ID único
  const existingNodeIds = new Set((newCanvas.nodes || []).map(n => n.id));
  if (!newNode.id || existingNodeIds.has(newNode.id)) {
    newNode.id = generateUniqueId('node', existingNodeIds);
  }

  // Añadir el nuevo nodo
  newCanvas.nodes.push({
    id: newNode.id,
    type: newNode.type || 'screen',
    label: newNode.label || newNode.id,
    position: newNode.position || { x: 0, y: 0 },
    props: newNode.props || {}
  });

  // Encontrar edges salientes del nodo original
  const outgoingEdges = (newCanvas.edges || []).filter(e => e.from_node_id === nodeId);

  // Si hay edges salientes, redirigirlos al nuevo nodo
  // Y crear un edge del nuevo nodo al destino original
  for (const edge of outgoingEdges) {
    // Crear nuevo edge del nuevo nodo al destino original
    const existingEdgeIds = new Set((newCanvas.edges || []).map(e => e.id));
    const newEdgeId = generateUniqueId('edge', existingEdgeIds);

    newCanvas.edges.push({
      id: newEdgeId,
      from_node_id: newNode.id,
      to_node_id: edge.to_node_id,
      type: edge.type || 'direct',
      condition: edge.condition,
      label: edge.label
    });

    // Redirigir el edge original al nuevo nodo
    edge.to_node_id = newNode.id;
  }

  // Si no hay edges salientes, crear un edge del nodo original al nuevo nodo
  if (outgoingEdges.length === 0) {
    const existingEdgeIds = new Set((newCanvas.edges || []).map(e => e.id));
    const newEdgeId = generateUniqueId('edge', existingEdgeIds);

    newCanvas.edges.push({
      id: newEdgeId,
      from_node_id: nodeId,
      to_node_id: newNode.id,
      type: 'direct'
    });
  }

  // Reparar nodos END inalcanzables antes de validar
  const repairedCanvas = repairUnreachableEndNodes(newCanvas);

  // Validar y normalizar
  const validation = validateCanvasDefinition(repairedCanvas);
  if (validation.errors.length > 0) {
    throw new Error(`Canvas inválido después de insertNodeAfter: ${validation.errors.join(', ')}`);
  }

  return normalizeCanvasDefinition(repairedCanvas);
}

/**
 * Convierte un nodo a tipo decision
 * 
 * @param {Object} canvas - CanvasDefinition original
 * @param {string} nodeId - ID del nodo a convertir
 * @returns {Object} CanvasDefinition nuevo con el nodo convertido
 */
export function convertNodeToDecision(canvas, nodeId) {
  if (!canvas || typeof canvas !== 'object') {
    throw new Error('CanvasDefinition debe ser un objeto');
  }

  if (!nodeId || typeof nodeId !== 'string') {
    throw new Error('nodeId debe ser un string');
  }

  // Crear copia del canvas
  const newCanvas = JSON.parse(JSON.stringify(canvas));

  // Encontrar el nodo
  const node = newCanvas.nodes.find(n => n.id === nodeId);
  if (!node) {
    throw new Error(`Nodo '${nodeId}' no existe en el canvas`);
  }

  // No convertir si ya es decision
  if (node.type === 'decision') {
    return normalizeCanvasDefinition(newCanvas);
  }

  // Convertir a decision
  node.type = 'decision';
  
  // Inicializar props de decision si no existen
  if (!node.props) {
    node.props = {};
  }

  // Si no tiene choices, crear 2 por defecto
  if (!node.props.choices || !Array.isArray(node.props.choices)) {
    node.props.choices = [
      { choice_id: 'choice_1', label: 'Opción 1' },
      { choice_id: 'choice_2', label: 'Opción 2' }
    ];
  }

  // Asegurar que hay al menos 2 choices
  while (node.props.choices.length < 2) {
    const choiceId = `choice_${node.props.choices.length + 1}`;
    node.props.choices.push({
      choice_id: choiceId,
      label: `Opción ${node.props.choices.length + 1}`
    });
  }

  // Validar y normalizar
  const validation = validateCanvasDefinition(newCanvas);
  if (validation.errors.length > 0) {
    throw new Error(`Canvas inválido después de convertNodeToDecision: ${validation.errors.join(', ')}`);
  }

  return normalizeCanvasDefinition(newCanvas);
}

/**
 * Marca un nodo como start (y desmarca el anterior start si existe)
 * 
 * @param {Object} canvas - CanvasDefinition original
 * @param {string} nodeId - ID del nodo a marcar como start
 * @returns {Object} CanvasDefinition nuevo con el nodo marcado como start
 */
export function markAsStart(canvas, nodeId) {
  if (!canvas || typeof canvas !== 'object') {
    throw new Error('CanvasDefinition debe ser un objeto');
  }

  if (!nodeId || typeof nodeId !== 'string') {
    throw new Error('nodeId debe ser un string');
  }

  // Crear copia del canvas
  const newCanvas = JSON.parse(JSON.stringify(canvas));

  // Encontrar el nodo
  const node = newCanvas.nodes.find(n => n.id === nodeId);
  if (!node) {
    throw new Error(`Nodo '${nodeId}' no existe en el canvas`);
  }

  // Encontrar el start node anterior (si existe)
  const previousStart = newCanvas.nodes.find(n => n.type === 'start');
  
  // Si hay un start anterior y es diferente, convertirlo a screen
  if (previousStart && previousStart.id !== nodeId) {
    previousStart.type = 'screen';
    if (!previousStart.props) {
      previousStart.props = {};
    }
    if (!previousStart.props.screen_template_id) {
      previousStart.props.screen_template_id = 'blank';
    }

    // Eliminar edges entrantes al start anterior (no debería haber, pero por seguridad)
    newCanvas.edges = newCanvas.edges.filter(e => e.to_node_id !== previousStart.id);
  }

  // Marcar el nuevo nodo como start
  node.type = 'start';
  
  // Eliminar edges entrantes al nuevo start (start no puede tener edges entrantes)
  newCanvas.edges = newCanvas.edges.filter(e => e.to_node_id !== nodeId);

  // Actualizar entry_node_id
  newCanvas.entry_node_id = nodeId;

  // AXE v0.6.9: Reparar nodos END inalcanzables antes de validar
  const repairedCanvas = repairUnreachableEndNodes(newCanvas);

  // Validar y normalizar
  const validation = validateCanvasDefinition(repairedCanvas);
  if (validation.errors.length > 0) {
    throw new Error(`Canvas inválido después de markAsStart: ${validation.errors.join(', ')}`);
  }

  return normalizeCanvasDefinition(repairedCanvas);
}

/**
 * Marca un nodo como end
 * 
 * @param {Object} canvas - CanvasDefinition original
 * @param {string} nodeId - ID del nodo a marcar como end
 * @returns {Object} CanvasDefinition nuevo con el nodo marcado como end
 */
export function markAsEnd(canvas, nodeId) {
  if (!canvas || typeof canvas !== 'object') {
    throw new Error('CanvasDefinition debe ser un objeto');
  }

  if (!nodeId || typeof nodeId !== 'string') {
    throw new Error('nodeId debe ser un string');
  }

  // Crear copia del canvas
  const newCanvas = JSON.parse(JSON.stringify(canvas));

  // Encontrar el nodo
  const node = newCanvas.nodes.find(n => n.id === nodeId);
  if (!node) {
    throw new Error(`Nodo '${nodeId}' no existe en el canvas`);
  }

  // No convertir si ya es end
  if (node.type === 'end') {
    return normalizeCanvasDefinition(newCanvas);
  }

  // No convertir si es start
  if (node.type === 'start') {
    throw new Error('No se puede convertir un StartNode a EndNode');
  }

  // Marcar como end
  node.type = 'end';
  
  // Eliminar edges salientes del nodo (end no puede tener edges salientes)
  newCanvas.edges = newCanvas.edges.filter(e => e.from_node_id !== nodeId);

  // AXE v0.6.9: Reparar nodos END inalcanzables antes de validar
  const repairedCanvas = repairUnreachableEndNodes(newCanvas);

  // Validar y normalizar
  const validation = validateCanvasDefinition(repairedCanvas);
  if (validation.errors.length > 0) {
    throw new Error(`Canvas inválido después de markAsEnd: ${validation.errors.join(', ')}`);
  }

  return normalizeCanvasDefinition(repairedCanvas);
}

/**
 * Duplica un subgrafo completo desde un nodo
 * 
 * @param {Object} canvas - CanvasDefinition original
 * @param {string} nodeId - ID del nodo raíz del subgrafo a duplicar
 * @returns {Object} CanvasDefinition nuevo con el subgrafo duplicado
 */
export function duplicateSubgraph(canvas, nodeId) {
  if (!canvas || typeof canvas !== 'object') {
    throw new Error('CanvasDefinition debe ser un objeto');
  }

  if (!nodeId || typeof nodeId !== 'string') {
    throw new Error('nodeId debe ser un string');
  }

  // Crear copia del canvas
  const newCanvas = JSON.parse(JSON.stringify(canvas));

  // Encontrar el nodo raíz
  const rootNode = newCanvas.nodes.find(n => n.id === nodeId);
  if (!rootNode) {
    throw new Error(`Nodo '${nodeId}' no existe en el canvas`);
  }

  // Obtener todos los nodos del subgrafo
  const subgraphNodeIds = getSubgraphNodes(newCanvas, nodeId);

  // Crear mapeo de IDs antiguos a nuevos
  const idMap = new Map();
  const existingNodeIds = new Set(newCanvas.nodes.map(n => n.id));
  const existingEdgeIds = new Set(newCanvas.edges.map(e => e.id));

  // Duplicar nodos del subgrafo
  for (const oldNodeId of subgraphNodeIds) {
    const oldNode = newCanvas.nodes.find(n => n.id === oldNodeId);
    if (!oldNode) continue;

    // Generar nuevo ID
    const newNodeId = generateUniqueId(`${oldNodeId}_copy`, existingNodeIds);
    idMap.set(oldNodeId, newNodeId);
    existingNodeIds.add(newNodeId);

    // Crear copia del nodo
    const newNode = JSON.parse(JSON.stringify(oldNode));
    newNode.id = newNodeId;
    // Ajustar posición ligeramente para visualización
    if (newNode.position) {
      newNode.position = {
        x: (newNode.position.x || 0) + 200,
        y: (newNode.position.y || 0) + 200
      };
    }
    newCanvas.nodes.push(newNode);
  }

  // Duplicar edges del subgrafo
  for (const edge of newCanvas.edges) {
    if (subgraphNodeIds.has(edge.from_node_id) && subgraphNodeIds.has(edge.to_node_id)) {
      const newEdgeId = generateUniqueId(`${edge.id}_copy`, existingEdgeIds);
      existingEdgeIds.add(newEdgeId);

      newCanvas.edges.push({
        id: newEdgeId,
        from_node_id: idMap.get(edge.from_node_id),
        to_node_id: idMap.get(edge.to_node_id),
        type: edge.type || 'direct',
        condition: edge.condition,
        label: edge.label
      });
    }
  }

  // Reparar nodos END inalcanzables antes de validar
  const repairedCanvas = repairUnreachableEndNodes(newCanvas);

  // Validar y normalizar
  const validation = validateCanvasDefinition(repairedCanvas);
  if (validation.errors.length > 0) {
    throw new Error(`Canvas inválido después de duplicateSubgraph: ${validation.errors.join(', ')}`);
  }

  return normalizeCanvasDefinition(repairedCanvas);
}

