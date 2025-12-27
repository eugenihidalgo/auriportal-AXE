// src/core/canvas/canvas-semantic-analysis.js
// Análisis Semántico del Canvas (READ-ONLY)
// AXE v0.6.9 - Diagnóstico Semántico del Canvas
//
// PRINCIPIOS:
// - Función pura analyzeCanvas(canvas)
// - Devuelve warnings e infos (NO errors)
// - No modifica canvas
// - No guarda estado
// - No afecta publish ni runtime
// - Todo fail-open

/**
 * Analiza un CanvasDefinition y devuelve diagnósticos semánticos
 * 
 * Tipos de diagnósticos:
 * - Estructurales: start/end, edges, nodos huérfanos
 * - Pedagógicos: uso de meta, decisiones, finales
 * - Ritmo: longitud de secuencias, balance de ramas
 * 
 * @param {Object} canvas - CanvasDefinition a analizar
 * @returns {Object} { warnings: Array<Diagnostic>, infos: Array<Diagnostic> }
 *   - warnings: Observaciones que podrían indicar problemas
 *   - infos: Información útil sobre el canvas
 * 
 * @typedef {Object} Diagnostic
 * @property {string} type - 'structural' | 'pedagogical' | 'rhythm'
 * @property {string} severity - 'warning' | 'info'
 * @property {string} message - Mensaje descriptivo
 * @property {string|null} node_id - ID del nodo relacionado (si aplica)
 * @property {string|null} edge_id - ID del edge relacionado (si aplica)
 */
export function analyzeCanvas(canvas) {
  const warnings = [];
  const infos = [];

  // Fail-open: si canvas es inválido, devolver análisis mínimo
  if (!canvas || typeof canvas !== 'object') {
    warnings.push({
      type: 'structural',
      severity: 'warning',
      message: 'Canvas inválido o vacío',
      node_id: null,
      edge_id: null
    });
    return { warnings, infos };
  }

  // Análisis estructurales
  const structuralDiagnostics = analyzeStructural(canvas);
  warnings.push(...structuralDiagnostics.warnings);
  infos.push(...structuralDiagnostics.infos);

  // Análisis pedagógicos
  const pedagogicalDiagnostics = analyzePedagogical(canvas);
  warnings.push(...pedagogicalDiagnostics.warnings);
  infos.push(...pedagogicalDiagnostics.infos);

  // Análisis de ritmo
  const rhythmDiagnostics = analyzeRhythm(canvas);
  warnings.push(...rhythmDiagnostics.warnings);
  infos.push(...rhythmDiagnostics.infos);

  return { warnings, infos };
}

/**
 * Análisis estructurales del canvas
 */
function analyzeStructural(canvas) {
  const warnings = [];
  const infos = [];

  const nodes = canvas.nodes || [];
  const edges = canvas.edges || [];
  const entryNodeId = canvas.entry_node_id;

  // Verificar nodo start
  const startNodes = nodes.filter(n => n.type === 'start');
  if (startNodes.length === 0) {
    warnings.push({
      type: 'structural',
      severity: 'warning',
      message: 'No hay nodo de inicio (start)',
      node_id: null,
      edge_id: null
    });
  } else if (startNodes.length > 1) {
    warnings.push({
      type: 'structural',
      severity: 'warning',
      message: `Hay ${startNodes.length} nodos de inicio, debería haber solo uno`,
      node_id: startNodes[1].id,
      edge_id: null
    });
  }

  // Verificar nodos end
  const endNodes = nodes.filter(n => n.type === 'end');
  if (endNodes.length === 0) {
    warnings.push({
      type: 'structural',
      severity: 'warning',
      message: 'No hay nodos de fin (end)',
      node_id: null,
      edge_id: null
    });
  } else {
    infos.push({
      type: 'structural',
      severity: 'info',
      message: `Hay ${endNodes.length} nodo(s) de fin`,
      node_id: null,
      edge_id: null
    });
  }

  // Verificar entry_node_id
  if (entryNodeId) {
    const entryNode = nodes.find(n => n.id === entryNodeId);
    if (!entryNode) {
      warnings.push({
        type: 'structural',
        severity: 'warning',
        message: `entry_node_id '${entryNodeId}' no existe en los nodos`,
        node_id: null,
        edge_id: null
      });
    } else if (entryNode.type !== 'start') {
      warnings.push({
        type: 'structural',
        severity: 'warning',
        message: `entry_node_id '${entryNodeId}' no es un nodo start`,
        node_id: entryNodeId,
        edge_id: null
      });
    }
  }

  // Detectar nodos huérfanos (sin edges entrantes ni salientes, excepto start/end/group/comment)
  const nodeIds = new Set(nodes.map(n => n.id));
  const nodesWithIncoming = new Set(edges.map(e => e.to_node_id));
  const nodesWithOutgoing = new Set(edges.map(e => e.from_node_id));

  for (const node of nodes) {
    if (node.type === 'start' || node.type === 'end' || node.type === 'group' || node.type === 'comment') {
      continue;
    }

    const hasIncoming = nodesWithIncoming.has(node.id);
    const hasOutgoing = nodesWithOutgoing.has(node.id);

    if (!hasIncoming && !hasOutgoing) {
      warnings.push({
        type: 'structural',
        severity: 'warning',
        message: `Nodo '${node.id}' está huérfano (sin edges entrantes ni salientes)`,
        node_id: node.id,
        edge_id: null
      });
    } else if (!hasIncoming && hasOutgoing) {
      warnings.push({
        type: 'structural',
        severity: 'warning',
        message: `Nodo '${node.id}' no tiene edges entrantes (no es alcanzable)`,
        node_id: node.id,
        edge_id: null
      });
    }
  }

  // Detectar edges que apuntan a nodos inexistentes
  for (const edge of edges) {
    if (!nodeIds.has(edge.from_node_id)) {
      warnings.push({
        type: 'structural',
        severity: 'warning',
        message: `Edge apunta desde nodo inexistente '${edge.from_node_id}'`,
        node_id: edge.from_node_id,
        edge_id: edge.id || null
      });
    }
    if (!nodeIds.has(edge.to_node_id)) {
      warnings.push({
        type: 'structural',
        severity: 'warning',
        message: `Edge apunta a nodo inexistente '${edge.to_node_id}'`,
        node_id: edge.to_node_id,
        edge_id: edge.id || null
      });
    }
  }

  // Información sobre estructura general
  const executableNodes = nodes.filter(n => 
    n.type !== 'start' && n.type !== 'end' && n.type !== 'group' && n.type !== 'comment'
  );
  infos.push({
    type: 'structural',
    severity: 'info',
    message: `Canvas tiene ${nodes.length} nodo(s) total, ${executableNodes.length} ejecutable(s), ${edges.length} edge(s)`,
    node_id: null,
    edge_id: null
  });

  return { warnings, infos };
}

/**
 * Análisis pedagógicos del canvas
 */
function analyzePedagogical(canvas) {
  const warnings = [];
  const infos = [];

  const nodes = canvas.nodes || [];
  const edges = canvas.edges || [];

  // Contar decisiones
  const decisionNodes = nodes.filter(n => n.type === 'decision');
  if (decisionNodes.length > 0) {
    infos.push({
      type: 'pedagogical',
      severity: 'info',
      message: `Hay ${decisionNodes.length} nodo(s) de decisión`,
      node_id: null,
      edge_id: null
    });

    // Verificar que las decisiones tienen opciones válidas
    for (const decision of decisionNodes) {
      const props = decision.props || {};
      const choices = props.choices || [];
      
      if (choices.length < 2) {
        warnings.push({
          type: 'pedagogical',
          severity: 'warning',
          message: `Decisión '${decision.id}' tiene menos de 2 opciones`,
          node_id: decision.id,
          edge_id: null
        });
      }

      // Verificar que cada opción tiene un edge correspondiente
      const outgoingEdges = edges.filter(e => e.from_node_id === decision.id);
      if (outgoingEdges.length < choices.length) {
        warnings.push({
          type: 'pedagogical',
          severity: 'warning',
          message: `Decisión '${decision.id}' tiene ${choices.length} opciones pero solo ${outgoingEdges.length} edge(s) saliente(s)`,
          node_id: decision.id,
          edge_id: null
        });
      }
    }
  }

  // Verificar uso de meta (metadatos pedagógicos)
  const nodesWithMeta = nodes.filter(n => n.meta && typeof n.meta === 'object' && Object.keys(n.meta).length > 0);
  if (nodesWithMeta.length === 0) {
    infos.push({
      type: 'pedagogical',
      severity: 'info',
      message: 'Ningún nodo tiene metadatos pedagógicos (meta)',
      node_id: null,
      edge_id: null
    });
  } else {
    infos.push({
      type: 'pedagogical',
      severity: 'info',
      message: `${nodesWithMeta.length} nodo(s) tienen metadatos pedagógicos`,
      node_id: null,
      edge_id: null
    });
  }

  // Verificar nodos finales (end)
  const endNodes = nodes.filter(n => n.type === 'end');
  if (endNodes.length > 1) {
    infos.push({
      type: 'pedagogical',
      severity: 'info',
      message: `Hay ${endNodes.length} puntos de finalización (múltiples caminos posibles)`,
      node_id: null,
      edge_id: null
    });
  }

  // Verificar si hay secuencias muy largas sin decisiones
  const longSequences = findLongSequences(canvas);
  if (longSequences.length > 0) {
    for (const seq of longSequences) {
      if (seq.length > 5) {
        warnings.push({
          type: 'pedagogical',
          severity: 'warning',
          message: `Secuencia lineal larga detectada (${seq.length} nodos sin decisiones): ${seq.slice(0, 3).join(' → ')}...`,
          node_id: seq[0],
          edge_id: null
        });
      }
    }
  }

  return { warnings, infos };
}

/**
 * Análisis de ritmo del canvas
 */
function analyzeRhythm(canvas) {
  const warnings = [];
  const infos = [];

  const nodes = canvas.nodes || [];
  const edges = canvas.edges || [];

  // Analizar longitud de secuencias
  const sequences = findSequences(canvas);
  if (sequences.length > 0) {
    const avgLength = sequences.reduce((sum, seq) => sum + seq.length, 0) / sequences.length;
    const maxLength = Math.max(...sequences.map(seq => seq.length));
    const minLength = Math.min(...sequences.map(seq => seq.length));

    infos.push({
      type: 'rhythm',
      severity: 'info',
      message: `Secuencias: promedio ${avgLength.toFixed(1)} nodos, máximo ${maxLength}, mínimo ${minLength}`,
      node_id: null,
      edge_id: null
    });

    if (maxLength > 10) {
      warnings.push({
        type: 'rhythm',
        severity: 'warning',
        message: `Secuencia muy larga detectada (${maxLength} nodos), podría ser difícil de seguir`,
        node_id: null,
        edge_id: null
      });
    }
  }

  // Analizar balance de ramas (en decisiones)
  const decisionNodes = nodes.filter(n => n.type === 'decision');
  for (const decision of decisionNodes) {
    const outgoingEdges = edges.filter(e => e.from_node_id === decision.id);
    if (outgoingEdges.length > 0) {
      // Calcular profundidad de cada rama
      const branchDepths = outgoingEdges.map(edge => {
        return calculateBranchDepth(canvas, edge.to_node_id);
      });

      const maxDepth = Math.max(...branchDepths);
      const minDepth = Math.min(...branchDepths);
      const depthDiff = maxDepth - minDepth;

      if (depthDiff > 3) {
        warnings.push({
          type: 'rhythm',
          severity: 'warning',
          message: `Decisión '${decision.id}' tiene ramas desbalanceadas (diferencia de ${depthDiff} niveles)`,
          node_id: decision.id,
          edge_id: null
        });
      }
    }
  }

  // Analizar densidad de decisiones
  const executableNodes = nodes.filter(n => 
    n.type !== 'start' && n.type !== 'end' && n.type !== 'group' && n.type !== 'comment'
  );
  const decisionRatio = decisionNodes.length / Math.max(executableNodes.length, 1);
  
  if (decisionRatio > 0.5) {
    warnings.push({
      type: 'rhythm',
      severity: 'warning',
      message: `Alta densidad de decisiones (${(decisionRatio * 100).toFixed(0)}% de nodos son decisiones), podría ser abrumador`,
      node_id: null,
      edge_id: null
    });
  } else if (decisionRatio === 0 && executableNodes.length > 3) {
    infos.push({
      type: 'rhythm',
      severity: 'info',
      message: 'Canvas completamente lineal (sin decisiones)',
      node_id: null,
      edge_id: null
    });
  }

  return { warnings, infos };
}

/**
 * Encuentra secuencias lineales en el canvas
 */
function findSequences(canvas) {
  const sequences = [];
  const nodes = canvas.nodes || [];
  const edges = canvas.edges || [];
  const visited = new Set();

  for (const node of nodes) {
    if (node.type === 'decision' || node.type === 'start' || node.type === 'end' || 
        node.type === 'group' || node.type === 'comment' || visited.has(node.id)) {
      continue;
    }

    const sequence = [];
    let currentNode = node;

    // Seguir la secuencia hacia adelante
    while (currentNode) {
      if (visited.has(currentNode.id)) break;
      visited.add(currentNode.id);

      if (currentNode.type === 'decision' || currentNode.type === 'end') {
        break;
      }

      sequence.push(currentNode.id);

      // Buscar siguiente nodo (solo si hay exactamente un edge saliente)
      const outgoingEdges = edges.filter(e => e.from_node_id === currentNode.id);
      if (outgoingEdges.length !== 1) {
        break;
      }

      const nextNodeId = outgoingEdges[0].to_node_id;
      const nextNode = nodes.find(n => n.id === nextNodeId);
      if (!nextNode || nextNode.type === 'decision' || nextNode.type === 'start') {
        break;
      }

      currentNode = nextNode;
    }

    if (sequence.length > 1) {
      sequences.push(sequence);
    }
  }

  return sequences;
}

/**
 * Encuentra secuencias largas sin decisiones
 */
function findLongSequences(canvas) {
  return findSequences(canvas).filter(seq => seq.length > 3);
}

/**
 * Calcula la profundidad de una rama desde un nodo hasta el final
 */
function calculateBranchDepth(canvas, startNodeId, visited = new Set(), maxDepth = 50) {
  if (visited.has(startNodeId) || visited.size > maxDepth) {
    return visited.size;
  }

  visited.add(startNodeId);

  const nodes = canvas.nodes || [];
  const edges = canvas.edges || [];
  const node = nodes.find(n => n.id === startNodeId);

  if (!node || node.type === 'end') {
    return visited.size;
  }

  if (node.type === 'decision') {
    // En una decisión, tomar la rama más larga
    const outgoingEdges = edges.filter(e => e.from_node_id === startNodeId);
    if (outgoingEdges.length === 0) {
      return visited.size;
    }

    const branchDepths = outgoingEdges.map(edge => {
      return calculateBranchDepth(canvas, edge.to_node_id, new Set(visited), maxDepth);
    });

    return Math.max(...branchDepths);
  }

  // Nodo normal: seguir el único edge saliente
  const outgoingEdges = edges.filter(e => e.from_node_id === startNodeId);
  if (outgoingEdges.length === 0) {
    return visited.size;
  }

  if (outgoingEdges.length === 1) {
    return calculateBranchDepth(canvas, outgoingEdges[0].to_node_id, visited, maxDepth);
  }

  // Múltiples edges: tomar el más largo
  const branchDepths = outgoingEdges.map(edge => {
    return calculateBranchDepth(canvas, edge.to_node_id, new Set(visited), maxDepth);
  });

  return Math.max(...branchDepths);
}











