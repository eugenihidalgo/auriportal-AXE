// src/core/canvas/recorrido-to-canvas.js
// Conversor de RecorridoDefinition a CanvasDefinition
// Genera un Canvas válido desde recorridos existentes para permitir edición visual

/**
 * Convierte una RecorridoDefinition a CanvasDefinition
 * 
 * - Genera nodos desde steps
 * - Infiere Start y End
 * - Representa secuencialidad como edges directos
 * - Permite edición posterior en Canvas
 * 
 * @param {Object} recorrido - RecorridoDefinition a convertir
 * @param {Object} options - Opciones de conversión
 * @param {boolean} options.generatePositions - Generar posiciones automáticas (default: true)
 * @returns {Object} CanvasDefinition
 */
export function recorridoToCanvas(recorrido, options = {}) {
  const { generatePositions = true } = options;

  if (!recorrido || typeof recorrido !== 'object') {
    throw new Error('RecorridoDefinition debe ser un objeto');
  }

  const nodes = [];
  const edges = [];

  // 2. Convertir steps a nodes primero
  let x = 300;
  let y = 100;
  const stepPositions = new Map();
  const stepIds = Object.keys(recorrido.steps || {});
  
  // 1. Crear nodo start (después de conocer los stepIds para evitar conflictos)
  // Si entry_step_id está en steps, crear un start separado
  const entryStepId = recorrido.entry_step_id || stepIds[0] || 'start';
  const entryStepExists = stepIds.includes(entryStepId);
  
  let startNodeId;
  if (entryStepExists) {
    // Si el entry_step_id existe en steps, crear un start separado
    startNodeId = 'start';
  } else {
    // Si no existe, usar el entry_step_id como start
    startNodeId = entryStepId;
  }
  
  nodes.push({
    id: startNodeId,
    type: 'start',
    label: 'Inicio',
    position: generatePositions ? { x: 100, y: 100 } : { x: 0, y: 0 },
    props: {}
  });

  for (let i = 0; i < stepIds.length; i++) {
    const stepId = stepIds[i];
    const step = recorrido.steps[stepId];

    if (!step || typeof step !== 'object') {
      continue;
    }

    const position = generatePositions ? { x, y } : { x: 0, y: 0 };
    stepPositions.set(stepId, position);

    // Determinar tipo de nodo según step_type o screen_template_id
    let nodeType = inferNodeType(step);
    const nodeProps = convertStepToNodeProps(step, nodeType);

    nodes.push({
      id: stepId,
      type: nodeType,
      label: stepId,
      position,
      props: nodeProps
    });

    // Avanzar posición (layout horizontal)
    if (generatePositions) {
      x += 300;
      // Si hay muchos nodos, empezar nueva fila
      if ((i + 1) % 5 === 0) {
        x = 300;
        y += 200;
      }
    }
  }

  // 3. Convertir edges de recorrido a edges de canvas
  for (const edge of recorrido.edges || []) {
    // Validar que los steps existen
    // Si from_step_id es el entry_step_id y existe en steps, mapear al start
    let fromNodeId = edge.from_step_id;
    if (fromNodeId === entryStepId && entryStepExists) {
      fromNodeId = startNodeId;
    }
    const fromExists = fromNodeId === startNodeId || stepIds.includes(fromNodeId);
    const toExists = stepIds.includes(edge.to_step_id);

    if (!fromExists || !toExists) {
      continue; // Skip edges con referencias rotas
    }

    // Determinar tipo de edge
    let edgeType = 'direct';
    if (edge.condition && edge.condition.type && edge.condition.type !== 'always') {
      edgeType = 'conditional';
    }

    const canvasEdge = {
      id: `edge_${fromNodeId}_${edge.to_step_id}`,
      from_node_id: fromNodeId,
      to_node_id: edge.to_step_id,
      type: edgeType
    };

    // Agregar condition si existe
    if (edge.condition && edge.condition.type !== 'always') {
      canvasEdge.condition = {
        type: edge.condition.type,
        params: edge.condition.params || {}
      };
    }

    // Agregar priority si existe
    if (edge.priority !== undefined) {
      canvasEdge.priority = edge.priority;
    }

    edges.push(canvasEdge);
  }

  // 4. Crear edges implícitos si no hay edges explícitos
  // (para recorridos que solo tienen steps secuenciales)
  if (edges.length === 0 && stepIds.length > 0) {
    // Crear edge desde start al primer step
    if (entryStepExists) {
      // Si entry_step_id existe en steps, crear edge desde start a ese step
      edges.push({
        id: `edge_${startNodeId}_${entryStepId}`,
        from_node_id: startNodeId,
        to_node_id: entryStepId,
        type: 'direct'
      });
      
      // Crear edges secuenciales entre steps
      for (let i = 1; i < stepIds.length; i++) {
        const fromStepId = stepIds[i - 1];
        const toStepId = stepIds[i];
        edges.push({
          id: `edge_${fromStepId}_${toStepId}`,
          from_node_id: fromStepId,
          to_node_id: toStepId,
          type: 'direct'
        });
      }
    } else {
      // Si entry_step_id no existe en steps, crear edges secuenciales desde start
      for (let i = 0; i < stepIds.length; i++) {
        const fromStepId = i === 0 ? startNodeId : stepIds[i - 1];
        const toStepId = stepIds[i];
        edges.push({
          id: `edge_${fromStepId}_${toStepId}`,
          from_node_id: fromStepId,
          to_node_id: toStepId,
          type: 'direct'
        });
      }
    }
  }

  // 5. Crear nodos end para steps sin edges salientes
  const nodesWithOutgoing = new Set(edges.map(e => e.from_node_id));
  const endNodes = stepIds.filter(stepId => !nodesWithOutgoing.has(stepId));

  if (endNodes.length > 0) {
    for (const endNodeId of endNodes) {
      if (endNodeId !== startNodeId) {
        const endPosition = generatePositions 
          ? { x: stepPositions.get(endNodeId)?.x || x, y: (stepPositions.get(endNodeId)?.y || y) + 150 }
          : { x: 0, y: 0 };

        nodes.push({
          id: `${endNodeId}_end`,
          type: 'end',
          label: 'Fin',
          position: endPosition,
          props: {}
        });

        edges.push({
          id: `edge_${endNodeId}_end`,
          from_node_id: endNodeId,
          to_node_id: `${endNodeId}_end`,
          type: 'direct'
        });
      }
    }
  } else if (stepIds.length > 0) {
    // Si no hay nodos sin salida, crear un end genérico
    const lastStepId = stepIds[stepIds.length - 1];
    const lastPosition = stepPositions.get(lastStepId) || { x: x, y: y };
    
    nodes.push({
      id: 'end',
      type: 'end',
      label: 'Fin',
      position: generatePositions ? { x: lastPosition.x + 300, y: lastPosition.y } : { x: 0, y: 0 },
      props: {}
    });

    edges.push({
      id: `edge_${lastStepId}_end`,
      from_node_id: lastStepId,
      to_node_id: 'end',
      type: 'direct'
    });
  }

  const canvas = {
    version: '1.0',
    canvas_id: recorrido.id || '',
    name: recorrido.name || recorrido.id || 'Unnamed Canvas',
    description: recorrido.description || '',
    entry_node_id: startNodeId,
    nodes,
    edges,
    meta: {
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      canvas_version: 1,
      converted_from_recorrido: true,
      recorrido_id: recorrido.id
    }
  };

  return canvas;
}

/**
 * Infiere el tipo de nodo Canvas desde un step
 */
function inferNodeType(step) {
  if (!step || typeof step !== 'object') {
    return 'screen';
  }

  // Si tiene step_type, usarlo directamente
  if (step.step_type) {
    switch (step.step_type) {
      case 'decision':
        return 'decision';
      case 'condition':
        return 'condition';
      case 'delay':
        return 'delay';
      default:
        return 'screen';
    }
  }

  // Si no tiene step_type, inferir desde screen_template_id
  if (step.screen_template_id === 'screen_choice') {
    return 'decision';
  }

  // Por defecto, screen
  return 'screen';
}

/**
 * Convierte props de step a props de nodo Canvas
 */
function convertStepToNodeProps(step, nodeType) {
  const props = {};

  switch (nodeType) {
    case 'screen':
      props.screen_template_id = step.screen_template_id || 'blank';
      props.props = step.props || {};
      if (step.step_type) {
        props.step_type = step.step_type;
      }
      break;

    case 'decision':
      props.question = step.props?.question || '';
      props.choices = step.props?.choices || [];
      if (step.props?.capture_field) {
        props.capture_field = step.props.capture_field;
      }
      break;

    case 'condition':
      props.condition_type = step.props?.condition_type || step.step_type || 'always';
      props.condition_params = step.props?.condition_params || {};
      break;

    case 'delay':
      props.duration_seconds = step.props?.duration_seconds;
      props.duration_minutes = step.props?.duration_minutes;
      props.message = step.props?.message;
      break;

    default:
      props.screen_template_id = step.screen_template_id || 'blank';
      props.props = step.props || {};
      break;
  }

  // Preservar campos adicionales en meta si es necesario
  if (step.capture) {
    props.capture = step.capture;
  }

  if (step.resource_id) {
    props.resource_id = step.resource_id;
  }

  if (step.emit) {
    props.emit = step.emit;
  }

  // Preservar posición si existe en meta
  if (step.meta && step.meta.canvas_position) {
    // La posición se maneja en el nodo, no en props
  }

  return props;
}

