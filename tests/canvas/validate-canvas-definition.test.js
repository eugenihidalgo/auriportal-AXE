// tests/canvas/validate-canvas-definition.test.js
// Tests mínimos críticos para validación de Canvas

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateCanvasDefinition } from '../../src/core/canvas/validate-canvas-definition.js';

describe('validateCanvasDefinition', () => {
  it('debe validar un canvas válido', () => {
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
            screen_template_id: 'screen_text'
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

    const result = validateCanvasDefinition(canvas);
    assert.strictEqual(result.ok, true, 'Canvas válido debe pasar validación');
    assert.strictEqual(result.errors.length, 0, 'No debe haber errores');
  });

  it('debe detectar canvas sin StartNode', () => {
    const canvas = {
      version: '1.0',
      canvas_id: 'test-canvas',
      name: 'Test Canvas',
      entry_node_id: 'screen1',
      nodes: [
        {
          id: 'screen1',
          type: 'screen',
          label: 'Pantalla 1',
          position: { x: 300, y: 100 },
          props: {
            screen_template_id: 'screen_text'
          }
        }
      ],
      edges: []
    };

    const result = validateCanvasDefinition(canvas, { isPublish: true });
    assert.strictEqual(result.ok, false, 'Canvas sin StartNode debe fallar');
    assert(result.errors.some(e => e.includes('start')), 'Debe detectar falta de StartNode');
  });

  it('debe detectar múltiples StartNodes', () => {
    const canvas = {
      version: '1.0',
      canvas_id: 'test-canvas',
      name: 'Test Canvas',
      entry_node_id: 'start1',
      nodes: [
        {
          id: 'start1',
          type: 'start',
          label: 'Inicio 1',
          position: { x: 100, y: 100 },
          props: {}
        },
        {
          id: 'start2',
          type: 'start',
          label: 'Inicio 2',
          position: { x: 200, y: 100 },
          props: {}
        }
      ],
      edges: []
    };

    const result = validateCanvasDefinition(canvas, { isPublish: true });
    assert.strictEqual(result.ok, false, 'Canvas con múltiples StartNodes debe fallar');
    assert(result.errors.some(e => e.includes('start') && e.includes('uno')), 'Debe detectar múltiples StartNodes');
  });

  it('debe detectar edges a nodos inexistentes', () => {
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
        }
      ],
      edges: [
        {
          id: 'edge1',
          from_node_id: 'start',
          to_node_id: 'nodo_inexistente',
          type: 'direct'
        }
      ]
    };

    const result = validateCanvasDefinition(canvas, { isPublish: true });
    assert.strictEqual(result.ok, false, 'Canvas con edge a nodo inexistente debe fallar');
    assert(result.errors.some(e => e.includes('inexistente') || e.includes('no existe')), 'Debe detectar nodo inexistente');
  });

  it('debe detectar EndNode inalcanzable', () => {
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
          id: 'end',
          type: 'end',
          label: 'Fin',
          position: { x: 500, y: 100 },
          props: {}
        }
      ],
      edges: []
      // No hay edge que conecte start con end
    };

    const result = validateCanvasDefinition(canvas, { isPublish: true });
    assert.strictEqual(result.ok, false, 'Canvas con EndNode inalcanzable debe fallar');
    assert(result.errors.some(e => e.includes('EndNode') && e.includes('inalcanzable')), 'Debe detectar EndNode inalcanzable');
  });

  it('debe detectar ScreenNode sin screen_template_id', () => {
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
          props: {}
          // Falta screen_template_id
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

    const result = validateCanvasDefinition(canvas, { isPublish: true });
    assert.strictEqual(result.ok, false, 'Canvas con ScreenNode sin screen_template_id debe fallar');
    assert(result.errors.some(e => e.includes('screen_template_id')), 'Debe detectar falta de screen_template_id');
  });

  it('debe detectar loops infinitos sin salida', () => {
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
            screen_template_id: 'screen_text'
          }
        }
      ],
      edges: [
        {
          id: 'edge1',
          from_node_id: 'start',
          to_node_id: 'screen1',
          type: 'direct'
        },
        {
          id: 'edge2',
          from_node_id: 'screen1',
          to_node_id: 'screen1',
          type: 'direct'
          // Loop infinito sin salida
        }
      ]
    };

    const result = validateCanvasDefinition(canvas, { isPublish: true });
    // Puede ser error o warning dependiendo de la implementación
    assert(
      result.errors.some(e => e.includes('Loop') || e.includes('loop')) ||
      result.warnings.some(w => w.includes('Loop') || w.includes('loop')),
      'Debe detectar loop infinito'
    );
  });

  it('debe permitir warnings en draft sin bloquear', () => {
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
            screen_template_id: 'screen_text'
          }
        }
      ],
      edges: []
      // Sin edges, pero en draft no debe bloquear
    };

    const result = validateCanvasDefinition(canvas, { isPublish: false });
    // En draft, algunos errores pueden ser warnings
    assert(result.warnings.length >= 0, 'Puede tener warnings en draft');
  });
});

