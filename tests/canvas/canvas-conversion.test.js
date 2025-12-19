// tests/canvas/canvas-conversion.test.js
// Tests mínimos críticos para conversión bidireccional Canvas ↔ Recorrido

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { canvasToRecorrido } from '../../src/core/canvas/canvas-to-recorrido.js';
import { recorridoToCanvas } from '../../src/core/canvas/recorrido-to-canvas.js';

describe('canvasToRecorrido', () => {
  it('debe convertir canvas simple a recorrido', () => {
    const canvas = {
      version: '1.0',
      canvas_id: 'test-canvas',
      name: 'Test Canvas',
      entry_node_id: 'start',
      nodes: [
        {
          id: 'start',
          type: 'start',
          label: 'Inicio',
          position: { x: 100, y: 100 },
          props: {}
        },
        {
          id: 'screen1',
          type: 'screen',
          label: 'Pantalla 1',
          position: { x: 300, y: 100 },
          props: {
            screen_template_id: 'screen_text',
            props: {
              title: 'Test'
            }
          }
        }
      ],
      edges: [
        {
          id: 'edge1',
          from_node_id: 'start',
          to_node_id: 'screen1',
          type: 'direct'
        }
      ]
    };

    const recorrido = canvasToRecorrido(canvas);
    
    assert.strictEqual(recorrido.id, 'test-canvas', 'Debe preservar id');
    assert.strictEqual(recorrido.name, 'Test Canvas', 'Debe preservar name');
    assert(recorrido.steps['screen1'], 'Debe convertir nodo a step');
    assert.strictEqual(recorrido.steps['screen1'].screen_template_id, 'screen_text', 'Debe preservar screen_template_id');
    assert.strictEqual(recorrido.edges.length, 1, 'Debe convertir edges');
  });

  it('debe filtrar nodos no ejecutables', () => {
    const canvas = {
      version: '1.0',
      canvas_id: 'test-canvas',
      entry_node_id: 'start',
      nodes: [
        { id: 'start', type: 'start', label: 'Inicio', position: { x: 0, y: 0 }, props: {} },
        { id: 'screen1', type: 'screen', label: 'Screen', position: { x: 0, y: 0 }, props: { screen_template_id: 'blank' } },
        { id: 'group1', type: 'group', label: 'Group', position: { x: 0, y: 0 }, props: {} },
        { id: 'comment1', type: 'comment', label: 'Comment', position: { x: 0, y: 0 }, props: {} }
      ],
      edges: []
    };

    const recorrido = canvasToRecorrido(canvas);
    
    assert(!recorrido.steps['start'], 'No debe convertir start a step');
    assert(!recorrido.steps['group1'], 'No debe convertir group a step');
    assert(!recorrido.steps['comment1'], 'No debe convertir comment a step');
    assert(recorrido.steps['screen1'], 'Debe convertir screen a step');
  });
});

describe('recorridoToCanvas', () => {
  it('debe convertir recorrido simple a canvas', () => {
    const recorrido = {
      id: 'test-recorrido',
      name: 'Test Recorrido',
      entry_step_id: 'step1',
      steps: {
        step1: {
          screen_template_id: 'screen_text',
          props: {
            title: 'Test'
          }
        }
      },
      edges: []
    };

    const canvas = recorridoToCanvas(recorrido);
    
    assert.strictEqual(canvas.canvas_id, 'test-recorrido', 'Debe preservar id');
    assert.strictEqual(canvas.name, 'Test Recorrido', 'Debe preservar name');
    assert(canvas.nodes.some(n => n.type === 'start'), 'Debe crear nodo start');
    assert(canvas.nodes.some(n => n.id === 'step1'), 'Debe convertir step a nodo');
    assert(canvas.nodes.some(n => n.type === 'end'), 'Debe crear nodo end');
  });

  it('debe inferir tipos de nodo desde step_type', () => {
    const recorrido = {
      id: 'test-recorrido',
      entry_step_id: 'step1',
      steps: {
        step1: {
          screen_template_id: 'screen_choice',
          step_type: 'decision',
          props: {
            question: '¿Continuar?',
            choices: [
              { choice_id: 'si', label: 'Sí' },
              { choice_id: 'no', label: 'No' }
            ]
          }
        }
      },
      edges: []
    };

    const canvas = recorridoToCanvas(recorrido);
    const decisionNode = canvas.nodes.find(n => n.id === 'step1');
    
    assert(decisionNode, 'Debe crear nodo');
    assert.strictEqual(decisionNode.type, 'decision', 'Debe inferir tipo decision');
  });
});

describe('conversión bidireccional', () => {
  it('debe conservar estructura en conversión ida y vuelta', () => {
    const canvasOriginal = {
      version: '1.0',
      canvas_id: 'test-canvas',
      name: 'Test Canvas',
      entry_node_id: 'start',
      nodes: [
        {
          id: 'start',
          type: 'start',
          label: 'Inicio',
          position: { x: 100, y: 100 },
          props: {}
        },
        {
          id: 'screen1',
          type: 'screen',
          label: 'Pantalla 1',
          position: { x: 300, y: 100 },
          props: {
            screen_template_id: 'screen_text',
            props: {
              title: 'Test'
            }
          }
        }
      ],
      edges: [
        {
          id: 'edge1',
          from_node_id: 'start',
          to_node_id: 'screen1',
          type: 'direct'
        }
      ]
    };

    // Canvas → Recorrido → Canvas
    const recorrido = canvasToRecorrido(canvasOriginal);
    const canvasRecuperado = recorridoToCanvas(recorrido);
    
    // Verificar que se conserva la información esencial
    assert.strictEqual(canvasRecuperado.canvas_id, canvasOriginal.canvas_id, 'Debe conservar canvas_id');
    assert(canvasRecuperado.nodes.some(n => n.id === 'screen1'), 'Debe conservar nodos ejecutables');
    assert(canvasRecuperado.nodes.some(n => n.type === 'start'), 'Debe tener start');
    assert(canvasRecuperado.nodes.some(n => n.type === 'end'), 'Debe tener end');
  });

  it('debe manejar fail-open sin romper', () => {
    const canvasInvalido = {
      canvas_id: 'test',
      nodes: [],
      edges: []
    };

    // No debe lanzar excepción, debe normalizar
    let recorrido;
    try {
      recorrido = canvasToRecorrido(canvasInvalido);
    } catch (error) {
      assert.fail('No debe lanzar excepción, debe manejar fail-open');
    }
    
    assert(recorrido, 'Debe retornar recorrido');
    assert(typeof recorrido.steps === 'object', 'Debe tener steps');
  });
});




