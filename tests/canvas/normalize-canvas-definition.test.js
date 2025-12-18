// tests/canvas/normalize-canvas-definition.test.js
// Tests mínimos críticos para normalización de Canvas

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { normalizeCanvasDefinition } from '../../src/core/canvas/normalize-canvas-definition.js';

describe('normalizeCanvasDefinition', () => {
  it('debe normalizar canvas con campos faltantes', () => {
    const canvas = {
      canvas_id: 'test-canvas',
      nodes: [
        {
          id: 'start',
          type: 'start'
        }
      ],
      edges: []
    };

    const normalized = normalizeCanvasDefinition(canvas);
    
    assert.strictEqual(normalized.version, '1.0', 'Debe establecer version por defecto');
    assert.strictEqual(normalized.name, 'test-canvas', 'Debe usar canvas_id como name si falta');
    assert.strictEqual(normalized.entry_node_id, 'start', 'Debe establecer entry_node_id');
    assert(Array.isArray(normalized.nodes), 'nodes debe ser array');
    assert(Array.isArray(normalized.edges), 'edges debe ser array');
  });

  it('debe completar defaults de nodos', () => {
    const canvas = {
      canvas_id: 'test-canvas',
      nodes: [
        {
          id: 'screen1',
          type: 'screen'
        }
      ],
      edges: []
    };

    const normalized = normalizeCanvasDefinition(canvas);
    const node = normalized.nodes.find(n => n.id === 'screen1');
    
    assert(node, 'Debe preservar nodo');
    assert.strictEqual(node.label, 'screen1', 'Debe usar id como label si falta');
    assert.deepStrictEqual(node.position, { x: 0, y: 0 }, 'Debe establecer posición por defecto');
    assert.strictEqual(node.props.screen_template_id, 'blank', 'Debe establecer screen_template_id por defecto para screen');
  });

  it('debe ordenar nodos determinísticamente', () => {
    const canvas = {
      canvas_id: 'test-canvas',
      nodes: [
        { id: 'z_node', type: 'screen' },
        { id: 'a_node', type: 'screen' },
        { id: 'start', type: 'start' }
      ],
      edges: []
    };

    const normalized = normalizeCanvasDefinition(canvas);
    
    // Start debe estar primero
    assert.strictEqual(normalized.nodes[0].id, 'start', 'Start debe estar primero');
    // Luego ordenados por id
    assert(normalized.nodes[1].id < normalized.nodes[2].id, 'Debe ordenar por id');
  });

  it('debe manejar IDs duplicados', () => {
    const canvas = {
      canvas_id: 'test-canvas',
      nodes: [
        { id: 'node1', type: 'screen' },
        { id: 'node1', type: 'screen' } // Duplicado
      ],
      edges: []
    };

    const normalized = normalizeCanvasDefinition(canvas, { generateMissingIds: true });
    
    const nodeIds = normalized.nodes.map(n => n.id);
    const uniqueIds = new Set(nodeIds);
    
    assert.strictEqual(nodeIds.length, uniqueIds.size, 'Debe eliminar IDs duplicados');
  });

  it('debe generar IDs faltantes si está habilitado', () => {
    const canvas = {
      canvas_id: 'test-canvas',
      nodes: [
        { type: 'screen' } // Sin id
      ],
      edges: []
    };

    const normalized = normalizeCanvasDefinition(canvas, { generateMissingIds: true });
    
    assert(normalized.nodes.length > 0, 'Debe generar nodo con ID');
    assert(normalized.nodes[0].id, 'Debe tener ID generado');
  });

  it('debe preservar estructura válida', () => {
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
      edges: []
    };

    const normalized = normalizeCanvasDefinition(canvas);
    
    assert.strictEqual(normalized.version, '1.0', 'Debe preservar version');
    assert.strictEqual(normalized.canvas_id, 'test-canvas', 'Debe preservar canvas_id');
    assert.strictEqual(normalized.name, 'Test Canvas', 'Debe preservar name');
    assert.strictEqual(normalized.entry_node_id, 'start', 'Debe preservar entry_node_id');
  });
});


