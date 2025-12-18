// src/core/canvas/normalize-canvas-definition.js
// Normalizador de CanvasDefinition
// Ordena nodos y edges, completa defaults, asegura IDs únicos

/**
 * Normaliza una CanvasDefinition
 * 
 * - Ordena nodos y edges de forma determinista
 * - Completa campos faltantes con defaults
 * - Asegura IDs únicos
 * - Prepara estructura determinista para diffs
 * 
 * Fail-open: si algo falta, normaliza con defaults y emite warnings.
 * 
 * @param {Object} canvas - CanvasDefinition a normalizar
 * @param {Object} options - Opciones de normalización
 * @param {boolean} options.generateMissingIds - Generar IDs faltantes (default: true)
 * @returns {Object} CanvasDefinition normalizada
 */
export function normalizeCanvasDefinition(canvas, options = {}) {
  const { generateMissingIds = true } = options;

  if (!canvas || typeof canvas !== 'object') {
    return createDefaultCanvas();
  }

  const normalized = {
    version: canvas.version || '1.0',
    canvas_id: canvas.canvas_id || canvas.id || '',
    name: canvas.name || canvas.canvas_id || 'Unnamed Canvas',
    description: canvas.description,
    entry_node_id: canvas.entry_node_id || '',
    nodes: [],
    edges: []
  };

  // Normalizar nodes
  const nodes = Array.isArray(canvas.nodes) ? canvas.nodes : [];
  const nodeIds = new Set();
  const nodeIdMap = new Map(); // Para mapear IDs duplicados

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node || typeof node !== 'object') {
      continue;
    }

    let nodeId = node.id;
    
    // Generar ID si falta
    if (!nodeId || typeof nodeId !== 'string') {
      if (generateMissingIds) {
        nodeId = `node_${i + 1}`;
      } else {
        continue; // Skip nodos sin ID
      }
    }

    // Manejar IDs duplicados
    if (nodeIds.has(nodeId)) {
      let newId = `${nodeId}_${i}`;
      let counter = 1;
      while (nodeIds.has(newId)) {
        newId = `${nodeId}_${counter}`;
        counter++;
      }
      nodeIdMap.set(node.id, newId);
      nodeId = newId;
    }

    nodeIds.add(nodeId);

    const normalizedNode = normalizeNode(node, nodeId);
    normalized.nodes.push(normalizedNode);
  }

  // Ordenar nodos: start primero, luego por id
  normalized.nodes.sort((a, b) => {
    if (a.type === 'start' && b.type !== 'start') return -1;
    if (a.type !== 'start' && b.type === 'start') return 1;
    if (a.type === 'end' && b.type !== 'end') return 1;
    if (a.type !== 'end' && b.type === 'end') return -1;
    return a.id.localeCompare(b.id);
  });

  // Normalizar edges
  const edges = Array.isArray(canvas.edges) ? canvas.edges : [];
  const edgeIds = new Set();

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    if (!edge || typeof edge !== 'object') {
      continue;
    }

    // Aplicar mapeo de IDs de nodos si hay duplicados
    let fromNodeId = edge.from_node_id;
    let toNodeId = edge.to_node_id;

    if (nodeIdMap.has(fromNodeId)) {
      fromNodeId = nodeIdMap.get(fromNodeId);
    }
    if (nodeIdMap.has(toNodeId)) {
      toNodeId = nodeIdMap.get(toNodeId);
    }

    // Validar que los nodos existen
    if (!nodeIds.has(fromNodeId) || !nodeIds.has(toNodeId)) {
      continue; // Skip edges con referencias rotas
    }

    let edgeId = edge.id;
    
    // Generar ID si falta
    if (!edgeId || typeof edgeId !== 'string') {
      if (generateMissingIds) {
        edgeId = `edge_${i + 1}`;
      } else {
        continue; // Skip edges sin ID
      }
    }

    // Manejar IDs duplicados
    if (edgeIds.has(edgeId)) {
      let newId = `${edgeId}_${i}`;
      let counter = 1;
      while (edgeIds.has(newId)) {
        newId = `${edgeId}_${counter}`;
        counter++;
      }
      edgeId = newId;
    }

    edgeIds.add(edgeId);

    const normalizedEdge = normalizeEdge(edge, edgeId, fromNodeId, toNodeId);
    normalized.edges.push(normalizedEdge);
  }

  // Ordenar edges: por from_node_id, luego por to_node_id
  normalized.edges.sort((a, b) => {
    if (a.from_node_id !== b.from_node_id) {
      return a.from_node_id.localeCompare(b.from_node_id);
    }
    return a.to_node_id.localeCompare(b.to_node_id);
  });

  // Asegurar entry_node_id
  if (!normalized.entry_node_id && normalized.nodes.length > 0) {
    const startNode = normalized.nodes.find(n => n.type === 'start');
    if (startNode) {
      normalized.entry_node_id = startNode.id;
    } else {
      // Si no hay start, usar el primer nodo
      normalized.entry_node_id = normalized.nodes[0].id;
    }
  }

  // Normalizar viewport
  if (canvas.viewport && typeof canvas.viewport === 'object') {
    normalized.viewport = {
      zoom: typeof canvas.viewport.zoom === 'number' ? canvas.viewport.zoom : 1.0,
      pan: canvas.viewport.pan && typeof canvas.viewport.pan === 'object'
        ? { x: canvas.viewport.pan.x || 0, y: canvas.viewport.pan.y || 0 }
        : { x: 0, y: 0 }
    };
  }

  // Normalizar meta
  normalized.meta = {
    ...(canvas.meta || {}),
    updated_at: new Date().toISOString()
  };

  if (!normalized.meta.created_at) {
    normalized.meta.created_at = new Date().toISOString();
  }

  return normalized;
}

/**
 * Normaliza un nodo individual
 */
function normalizeNode(node, nodeId) {
  const normalized = {
    id: nodeId,
    type: node.type || 'screen',
    label: node.label || nodeId,
    position: node.position && typeof node.position === 'object'
      ? { x: node.position.x || 0, y: node.position.y || 0 }
      : { x: 0, y: 0 },
    props: node.props && typeof node.props === 'object' ? { ...node.props } : {}
  };

  // Agregar style si existe
  if (node.style && typeof node.style === 'object') {
    normalized.style = { ...node.style };
  }

  // Agregar metadata si existe
  if (node.metadata && typeof node.metadata === 'object') {
    normalized.metadata = { ...node.metadata };
  }

  // Completar defaults según tipo de nodo
  if (normalized.type === 'screen') {
    if (!normalized.props.screen_template_id) {
      normalized.props.screen_template_id = 'blank';
    }
  }

  if (normalized.type === 'decision') {
    if (!normalized.props.choices) {
      normalized.props.choices = [];
    }
  }

  if (normalized.type === 'condition') {
    if (!normalized.props.condition_type) {
      normalized.props.condition_type = 'always';
    }
  }

  if (normalized.type === 'delay') {
    // No establecer defaults de duración (debe ser explícito)
  }

  if (normalized.type === 'group') {
    if (!normalized.props.label) {
      normalized.props.label = 'Group';
    }
  }

  if (normalized.type === 'comment') {
    if (!normalized.props.text) {
      normalized.props.text = '';
    }
  }

  return normalized;
}

/**
 * Normaliza un edge individual
 */
function normalizeEdge(edge, edgeId, fromNodeId, toNodeId) {
  const normalized = {
    id: edgeId,
    from_node_id: fromNodeId,
    to_node_id: toNodeId,
    type: edge.type || 'direct'
  };

  // Agregar condition si existe
  if (edge.condition && typeof edge.condition === 'object' && edge.condition.type) {
    normalized.condition = {
      type: edge.condition.type,
      ...(edge.condition.params && typeof edge.condition.params === 'object'
        ? { params: { ...edge.condition.params } }
        : {})
    };
  }

  // Agregar label si existe
  if (edge.label && typeof edge.label === 'string') {
    normalized.label = edge.label;
  }

  // Agregar style si existe
  if (edge.style && typeof edge.style === 'object') {
    normalized.style = { ...edge.style };
  }

  // Agregar metadata si existe
  if (edge.metadata && typeof edge.metadata === 'object') {
    normalized.metadata = { ...edge.metadata };
  }

  return normalized;
}

/**
 * Crea un CanvasDefinition por defecto
 */
function createDefaultCanvas() {
  return {
    version: '1.0',
    canvas_id: '',
    name: 'Unnamed Canvas',
    description: '',
    entry_node_id: 'start',
    nodes: [
      {
        id: 'start',
        type: 'start',
        label: 'Inicio',
        position: { x: 100, y: 100 },
        props: {}
      }
    ],
    edges: [],
    meta: {
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      canvas_version: 1
    }
  };
}

