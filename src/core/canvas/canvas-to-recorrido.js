// src/core/canvas/canvas-to-recorrido.js
// Conversor de CanvasDefinition a RecorridoDefinition
// Transforma la representación visual del Canvas en una definición ejecutable de Recorrido

/**
 * Convierte una CanvasDefinition a RecorridoDefinition
 * 
 * - Filtra nodos no ejecutables (group, comment)
 * - Convierte nodos a steps
 * - Convierte edges a edges de recorrido
 * - Preserva orden lógico
 * - Mapea decisiones a branching existente
 * - Sin perder información (usa meta si hace falta)
 * 
 * @param {Object} canvas - CanvasDefinition a convertir
 * @returns {Object} RecorridoDefinition
 */
export function canvasToRecorrido(canvas) {
  if (!canvas || typeof canvas !== 'object') {
    throw new Error('CanvasDefinition debe ser un objeto');
  }

  const steps = {};
  const edges = [];

  // Filtrar nodos ejecutables (excluir group, comment, start, end)
  const executableNodes = (canvas.nodes || []).filter(
    n => n.type !== 'group' && n.type !== 'comment' && n.type !== 'start' && n.type !== 'end'
  );

  // Convertir nodes a steps
  for (const node of executableNodes) {
    const step = convertNodeToStep(node);
    if (step) {
      steps[node.id] = step;
    }
  }

  // Convertir edges a edges de recorrido
  for (const edge of canvas.edges || []) {
    const toNode = (canvas.nodes || []).find(n => n.id === edge.to_node_id);
    const fromNode = (canvas.nodes || []).find(n => n.id === edge.from_node_id);

    // Filtrar edges que van a nodos no ejecutables
    if (toNode && (toNode.type === 'group' || toNode.type === 'comment' || toNode.type === 'end')) {
      continue; // Skip edges a nodos no ejecutables
    }

    // Filtrar edges que salen de nodos no ejecutables (excepto start)
    if (fromNode && (fromNode.type === 'group' || fromNode.type === 'comment')) {
      continue; // Skip edges desde nodos no ejecutables
    }

    // Si el edge sale de start, usar entry_step_id como from
    let fromStepId = edge.from_node_id;
    if (fromNode && fromNode.type === 'start') {
      // El start node no se convierte a step, pero su ID debe ser entry_step_id
      // Si el edge va a un nodo ejecutable, usar ese nodo como destino
      fromStepId = canvas.entry_node_id;
    }

    const recorridoEdge = {
      from_step_id: fromStepId,
      to_step_id: edge.to_node_id,
      condition: edge.condition || { type: 'always' }
    };

    // Agregar priority si existe
    if (edge.priority !== undefined) {
      recorridoEdge.priority = edge.priority;
    }

    edges.push(recorridoEdge);
  }

  // Determinar entry_step_id
  // Si hay un nodo start, usar su primer edge saliente como entry
  // Si no, usar el entry_node_id del canvas
  let entryStepId = canvas.entry_node_id;
  const startNode = (canvas.nodes || []).find(n => n.type === 'start');
  if (startNode) {
    const firstOutgoingEdge = (canvas.edges || []).find(e => e.from_node_id === startNode.id);
    if (firstOutgoingEdge) {
      const targetNode = (canvas.nodes || []).find(n => n.id === firstOutgoingEdge.to_node_id);
      if (targetNode && targetNode.type !== 'group' && targetNode.type !== 'comment' && targetNode.type !== 'end') {
        entryStepId = firstOutgoingEdge.to_node_id;
      }
    }
  }

  // Si el entry_step_id no está en steps, buscar el primer step disponible
  if (!steps[entryStepId]) {
    const firstStepId = Object.keys(steps)[0];
    if (firstStepId) {
      entryStepId = firstStepId;
    }
  }

  const recorrido = {
    id: canvas.canvas_id || canvas.id || '',
    name: canvas.name || '',
    description: canvas.description || '',
    entry_step_id: entryStepId,
    steps,
    edges
  };

  // Copiar meta si existe
  if (canvas.meta && typeof canvas.meta === 'object') {
    recorrido.meta = {
      ...canvas.meta,
      converted_from_canvas: true,
      canvas_version: canvas.meta.canvas_version || 1
    };
  } else {
    recorrido.meta = {
      converted_from_canvas: true
    };
  }

  return recorrido;
}

/**
 * Convierte un nodo Canvas a un step de Recorrido
 */
function convertNodeToStep(node) {
  if (!node || typeof node !== 'object') {
    return null;
  }

  const step = {
    screen_template_id: '',
    props: {}
  };

  // Mapear según tipo de nodo
  switch (node.type) {
    case 'screen':
      step.screen_template_id = (node.props || {}).screen_template_id || 'blank';
      step.props = (node.props || {}).props || {};
      
      // Preservar step_type si existe
      if ((node.props || {}).step_type) {
        step.step_type = node.props.step_type;
      }
      break;

    case 'decision':
      // DecisionNode se convierte a un step con screen_template_id 'screen_choice'
      step.screen_template_id = 'screen_choice';
      step.step_type = 'decision';
      step.props = {
        question: (node.props || {}).question || '',
        choices: (node.props || {}).choices || []
      };
      break;

    case 'condition':
      // ConditionNode se convierte a un step especial
      // Por ahora, usar un template placeholder
      step.screen_template_id = 'blank';
      step.step_type = 'condition';
      step.props = {
        condition_type: (node.props || {}).condition_type || 'always',
        condition_params: (node.props || {}).condition_params || {}
      };
      break;

    case 'delay':
      // DelayNode se convierte a un step especial
      step.screen_template_id = 'blank';
      step.step_type = 'delay';
      step.props = {
        duration_seconds: (node.props || {}).duration_seconds,
        duration_minutes: (node.props || {}).duration_minutes,
        message: (node.props || {}).message
      };
      break;

    default:
      // Para otros tipos, intentar extraer screen_template_id
      if ((node.props || {}).screen_template_id) {
        step.screen_template_id = node.props.screen_template_id;
        step.props = (node.props || {}).props || {};
      } else {
        step.screen_template_id = 'blank';
      }
      break;
  }

  // Preservar capture si existe
  if (node.props && node.props.capture) {
    step.capture = node.props.capture;
  }

  // Preservar resource_id si existe
  if (node.props && node.props.resource_id) {
    step.resource_id = node.props.resource_id;
  }

  // Preservar emit si existe
  if (node.props && node.props.emit) {
    step.emit = node.props.emit;
  }

  // Preservar order si existe (para mantener orden visual)
  if (node.position && typeof node.position.x === 'number') {
    // Guardar posición en meta para posible reconstrucción
    if (!step.meta) {
      step.meta = {};
    }
    step.meta.canvas_position = { x: node.position.x, y: node.position.y };
  }

  // Preservar meta del nodo si existe (AXE v0.6.8: metadatos pedagógicos de intención)
  if (node.meta && typeof node.meta === 'object') {
    if (!step.meta) {
      step.meta = {};
    }
    // Fusionar meta del nodo con meta del step (preservando canvas_position si existe)
    step.meta = {
      ...step.meta,
      ...node.meta,
      canvas_position: step.meta.canvas_position // Preservar posición si ya existe
    };
  }

  return step;
}


