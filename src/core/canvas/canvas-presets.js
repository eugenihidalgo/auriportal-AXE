// src/core/canvas/canvas-presets.js
// Presets pedagógicos para CanvasDefinition
// AXE v0.6.7 - Presets Pedagógicos de Canvas
//
// PRINCIPIOS:
// - Definen CanvasDefinition completos iniciales
// - Usan macros existentes internamente
// - Representan estructuras pedagógicas típicas
// - Validan y normalizan antes de devolver
// - Sin auto-save
// - Sin cambios en publish ni runtime

import {
  insertStandardEnding,
  createGuidedChoice,
  createBranchingPath,
  createLinearSequence
} from './canvas-semantic-macros.js';
import { validateCanvasDefinition } from './validate-canvas-definition.js';
import { normalizeCanvasDefinition } from './normalize-canvas-definition.js';
import { markAsStart } from './canvas-semantic-actions.js';

/**
 * Genera un ID único para un canvas
 */
function generateCanvasId(prefix = 'canvas') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Crea un canvas base con un nodo start
 */
function createBaseCanvas(name, description = '') {
  const canvasId = generateCanvasId('preset');
  const startNodeId = 'start_1';
  
  return {
    version: '1.0',
    canvas_id: canvasId,
    name,
    description,
    entry_node_id: startNodeId,
    nodes: [
      {
        id: startNodeId,
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
      preset: true
    }
  };
}

/**
 * Preset 1: Secuencia Lineal Simple
 * 
 * Estructura:
 * - Inicio → Introducción → Contenido → Finalización
 * 
 * Uso pedagógico: Recorridos simples sin decisiones
 */
export function presetSecuenciaLinealSimple() {
  const canvas = createBaseCanvas(
    'Secuencia Lineal Simple',
    'Recorrido lineal básico: introducción, contenido y finalización'
  );

  const startNodeId = canvas.entry_node_id;

  // Crear secuencia lineal
  let resultCanvas = createLinearSequence(canvas, startNodeId, {
    nodes: [
      {
        id: 'intro',
        type: 'screen',
        label: 'Introducción',
        props: {
          screen_template_id: 'blank'
        }
      },
      {
        id: 'contenido',
        type: 'screen',
        label: 'Contenido Principal',
        props: {
          screen_template_id: 'blank'
        }
      }
    ],
    addEnding: true
  });

  // Validar y normalizar
  const validation = validateCanvasDefinition(resultCanvas);
  if (validation.errors.length > 0) {
    throw new Error(`Preset inválido: ${validation.errors.join(', ')}`);
  }

  return normalizeCanvasDefinition(resultCanvas);
}

/**
 * Preset 2: Decisión Guiada
 * 
 * Estructura:
 * - Inicio → Introducción → Decisión (2 opciones) → Ramas → Finalización
 * 
 * Uso pedagógico: Recorridos con elección del usuario
 */
export function presetDecisionGuiada() {
  const canvas = createBaseCanvas(
    'Decisión Guiada',
    'Recorrido con decisión: introducción, decisión con 2 opciones y finalización'
  );

  const startNodeId = canvas.entry_node_id;

  // Crear introducción
  let resultCanvas = createLinearSequence(canvas, startNodeId, {
    nodes: [
      {
        id: 'intro',
        type: 'screen',
        label: 'Introducción',
        props: {
          screen_template_id: 'blank'
        }
      }
    ],
    addEnding: false
  });

  // Obtener el ID del nodo de introducción
  const introNode = resultCanvas.nodes.find(n => n.id === 'intro');
  if (!introNode) {
    throw new Error('No se pudo encontrar el nodo de introducción');
  }

  // Crear decisión guiada
  resultCanvas = createGuidedChoice(resultCanvas, introNode.id, {
    choices: [
      {
        choice_id: 'opcion_1',
        label: 'Opción 1',
        nextNodeLabel: 'Seguimiento Opción 1'
      },
      {
        choice_id: 'opcion_2',
        label: 'Opción 2',
        nextNodeLabel: 'Seguimiento Opción 2'
      }
    ],
    addEnding: true
  });

  // Validar y normalizar
  const validation = validateCanvasDefinition(resultCanvas);
  if (validation.errors.length > 0) {
    throw new Error(`Preset inválido: ${validation.errors.join(', ')}`);
  }

  return normalizeCanvasDefinition(resultCanvas);
}

/**
 * Preset 3: Secuencia con Múltiples Pasos
 * 
 * Estructura:
 * - Inicio → Introducción → Paso 1 → Paso 2 → Paso 3 → Finalización
 * 
 * Uso pedagógico: Recorridos paso a paso con múltiples etapas
 */
export function presetSecuenciaMultiplesPasos() {
  const canvas = createBaseCanvas(
    'Secuencia con Múltiples Pasos',
    'Recorrido paso a paso: introducción y 3 pasos secuenciales'
  );

  const startNodeId = canvas.entry_node_id;

  // Crear secuencia con múltiples pasos
  let resultCanvas = createLinearSequence(canvas, startNodeId, {
    nodes: [
      {
        id: 'intro',
        type: 'screen',
        label: 'Introducción',
        props: {
          screen_template_id: 'blank'
        }
      },
      {
        id: 'paso_1',
        type: 'screen',
        label: 'Paso 1',
        props: {
          screen_template_id: 'blank'
        }
      },
      {
        id: 'paso_2',
        type: 'screen',
        label: 'Paso 2',
        props: {
          screen_template_id: 'blank'
        }
      },
      {
        id: 'paso_3',
        type: 'screen',
        label: 'Paso 3',
        props: {
          screen_template_id: 'blank'
        }
      }
    ],
    addEnding: true
  });

  // Validar y normalizar
  const validation = validateCanvasDefinition(resultCanvas);
  if (validation.errors.length > 0) {
    throw new Error(`Preset inválido: ${validation.errors.join(', ')}`);
  }

  return normalizeCanvasDefinition(resultCanvas);
}

/**
 * Preset 4: Ramificación Completa
 * 
 * Estructura:
 * - Inicio → Introducción → Decisión (3 opciones) → Ramas con finalizaciones
 * 
 * Uso pedagógico: Recorridos con múltiples caminos y finalizaciones independientes
 */
export function presetRamificacionCompleta() {
  const canvas = createBaseCanvas(
    'Ramificación Completa',
    'Recorrido con múltiples ramas: introducción, decisión con 3 opciones y finalizaciones independientes'
  );

  const startNodeId = canvas.entry_node_id;

  // Crear introducción
  let resultCanvas = createLinearSequence(canvas, startNodeId, {
    nodes: [
      {
        id: 'intro',
        type: 'screen',
        label: 'Introducción',
        props: {
          screen_template_id: 'blank'
        }
      }
    ],
    addEnding: false
  });

  // Obtener el ID del nodo de introducción
  const introNode = resultCanvas.nodes.find(n => n.id === 'intro');
  if (!introNode) {
    throw new Error('No se pudo encontrar el nodo de introducción');
  }

  // Crear ramificación con 3 ramas
  resultCanvas = createBranchingPath(resultCanvas, introNode.id, {
    branches: [
      {
        label: 'Rama 1',
        choiceLabel: 'Opción A',
        addEnding: true
      },
      {
        label: 'Rama 2',
        choiceLabel: 'Opción B',
        addEnding: true
      },
      {
        label: 'Rama 3',
        choiceLabel: 'Opción C',
        addEnding: true
      }
    ],
    decisionLabel: 'Elige tu camino'
  });

  // Validar y normalizar
  const validation = validateCanvasDefinition(resultCanvas);
  if (validation.errors.length > 0) {
    throw new Error(`Preset inválido: ${validation.errors.join(', ')}`);
  }

  return normalizeCanvasDefinition(resultCanvas);
}

/**
 * Lista todos los presets disponibles
 * 
 * @returns {Array<Object>} Array de { id, name, description, generate }
 */
export function listAvailablePresets() {
  return [
    {
      id: 'secuencia_lineal_simple',
      name: 'Secuencia Lineal Simple',
      description: 'Recorrido lineal básico: introducción, contenido y finalización',
      generate: presetSecuenciaLinealSimple
    },
    {
      id: 'decision_guiada',
      name: 'Decisión Guiada',
      description: 'Recorrido con decisión: introducción, decisión con 2 opciones y finalización',
      generate: presetDecisionGuiada
    },
    {
      id: 'secuencia_multiples_pasos',
      name: 'Secuencia con Múltiples Pasos',
      description: 'Recorrido paso a paso: introducción y 3 pasos secuenciales',
      generate: presetSecuenciaMultiplesPasos
    },
    {
      id: 'ramificacion_completa',
      name: 'Ramificación Completa',
      description: 'Recorrido con múltiples ramas: introducción, decisión con 3 opciones y finalizaciones independientes',
      generate: presetRamificacionCompleta
    }
  ];
}

/**
 * Obtiene un preset por ID
 * 
 * @param {string} presetId - ID del preset
 * @returns {Object|null} CanvasDefinition del preset o null si no existe
 */
export function getPresetById(presetId) {
  const presets = listAvailablePresets();
  const preset = presets.find(p => p.id === presetId);
  
  if (!preset) {
    return null;
  }

  try {
    return preset.generate();
  } catch (error) {
    throw new Error(`Error generando preset "${presetId}": ${error.message}`);
  }
}

