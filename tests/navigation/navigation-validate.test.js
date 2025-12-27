// tests/navigation/navigation-validate.test.js
// Tests mínimos críticos para validación de NavigationDefinition v1

import { describe, it, expect } from '@jest/globals';
import {
  validateNavigationDraft,
  validateNavigationPublish,
  validateNavigationDefinition,
} from '../../src/core/navigation/validate-navigation-definition-v1.js';
import {
  normalizeNavigationDefinition,
  getReachableNodes,
  detectCycles,
  createMinimalNavigation,
} from '../../src/core/navigation/navigation-definition-v1.js';

// Fixture: NavigationDefinition válida mínima
const VALID_NAVIGATION = {
  navigation_id: 'test-nav',
  name: 'Test Navigation',
  entry_node_id: 'root',
  nodes: {
    root: {
      id: 'root',
      kind: 'section',
      label: 'Inicio',
      order: 0,
    },
    item1: {
      id: 'item1',
      kind: 'item',
      label: 'Item 1',
      order: 1,
      target: {
        type: 'screen',
        ref: '/practicar',
      },
    },
  },
  edges: [
    { from: 'root', to: 'item1', kind: 'child' },
  ],
};

// Fixture: NavigationDefinition con ciclo
const NAVIGATION_WITH_CYCLE = {
  navigation_id: 'nav-cycle',
  name: 'Navigation with Cycle',
  entry_node_id: 'a',
  nodes: {
    a: { id: 'a', kind: 'section', label: 'A', order: 0 },
    b: { id: 'b', kind: 'section', label: 'B', order: 1 },
    c: { id: 'c', kind: 'section', label: 'C', order: 2 },
  },
  edges: [
    { from: 'a', to: 'b' },
    { from: 'b', to: 'c' },
    { from: 'c', to: 'a' }, // Ciclo!
  ],
};

// Fixture: NavigationDefinition con nodo huérfano
const NAVIGATION_WITH_ORPHAN = {
  navigation_id: 'nav-orphan',
  name: 'Navigation with Orphan',
  entry_node_id: 'root',
  nodes: {
    root: { id: 'root', kind: 'section', label: 'Root', order: 0 },
    child1: { id: 'child1', kind: 'item', label: 'Child 1', order: 1, target: { type: 'screen', ref: '/a' } },
    orphan: { id: 'orphan', kind: 'item', label: 'Orphan', order: 2, target: { type: 'screen', ref: '/b' } },
  },
  edges: [
    { from: 'root', to: 'child1' },
    // orphan no está conectado!
  ],
};

describe('Validación de NavigationDefinition v1', () => {
  
  describe('Estructura base', () => {
    it('debe validar una definición válida mínima', () => {
      const result = validateNavigationDraft(VALID_NAVIGATION);
      
      expect(result.ok).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.normalizedDef).toBeDefined();
    });

    it('debe rechazar definición sin navigation_id', () => {
      const invalid = { ...VALID_NAVIGATION };
      delete invalid.navigation_id;
      
      const result = validateNavigationPublish(invalid);
      
      expect(result.ok).toBe(false);
      expect(result.errors).toContain('navigation_id es requerido');
    });

    it('debe rechazar navigation_id con formato inválido', () => {
      const invalid = {
        ...VALID_NAVIGATION,
        navigation_id: 'Invalid ID With Spaces',
      };
      
      const result = validateNavigationPublish(invalid);
      
      expect(result.ok).toBe(false);
      expect(result.errors.some(e => e.includes('formato inválido'))).toBe(true);
    });

    it('debe rechazar definición sin entry_node_id', () => {
      const invalid = { ...VALID_NAVIGATION };
      delete invalid.entry_node_id;
      
      const result = validateNavigationPublish(invalid);
      
      expect(result.ok).toBe(false);
      expect(result.errors).toContain('entry_node_id es requerido');
    });

    it('debe rechazar entry_node_id que no existe en nodes', () => {
      const invalid = {
        ...VALID_NAVIGATION,
        entry_node_id: 'nonexistent',
      };
      
      const result = validateNavigationPublish(invalid);
      
      expect(result.ok).toBe(false);
      expect(result.errors.some(e => e.includes('no existe en nodes'))).toBe(true);
    });

    it('debe rechazar definición con nodes vacío', () => {
      const invalid = {
        ...VALID_NAVIGATION,
        nodes: {},
      };
      
      const result = validateNavigationPublish(invalid);
      
      expect(result.ok).toBe(false);
      expect(result.errors).toContain('nodes no puede estar vacío');
    });
  });

  describe('Validación de nodos', () => {
    it('debe rechazar nodo sin label en modo publish', () => {
      const invalid = {
        ...VALID_NAVIGATION,
        nodes: {
          ...VALID_NAVIGATION.nodes,
          bad: { id: 'bad', kind: 'section', order: 0 }, // sin label
        },
      };
      
      const result = validateNavigationPublish(invalid);
      
      expect(result.ok).toBe(false);
      expect(result.errors.some(e => e.includes('label es requerido'))).toBe(true);
    });

    it('debe rechazar nodo item sin target en modo publish', () => {
      const invalid = {
        ...VALID_NAVIGATION,
        nodes: {
          ...VALID_NAVIGATION.nodes,
          itemNoTarget: { id: 'itemNoTarget', kind: 'item', label: 'Sin Target', order: 0 },
        },
      };
      
      const result = validateNavigationPublish(invalid);
      
      expect(result.ok).toBe(false);
      expect(result.errors.some(e => e.includes('target es requerido'))).toBe(true);
    });

    it('debe aceptar nodo section sin target', () => {
      const valid = {
        ...VALID_NAVIGATION,
        nodes: {
          root: { id: 'root', kind: 'section', label: 'Section', order: 0 },
        },
        edges: [],
      };
      
      const result = validateNavigationPublish(valid);
      
      expect(result.ok).toBe(true);
    });
  });

  describe('Validación de targets', () => {
    it('debe rechazar target.type inválido', () => {
      const invalid = {
        ...VALID_NAVIGATION,
        nodes: {
          ...VALID_NAVIGATION.nodes,
          bad: {
            id: 'bad',
            kind: 'item',
            label: 'Bad',
            order: 0,
            target: { type: 'invalid_type', ref: '/test' },
          },
        },
      };
      
      const result = validateNavigationPublish(invalid);
      
      expect(result.ok).toBe(false);
      expect(result.errors.some(e => e.includes('target.type'))).toBe(true);
    });

    it('debe rechazar target.ref vacío', () => {
      const invalid = {
        ...VALID_NAVIGATION,
        nodes: {
          ...VALID_NAVIGATION.nodes,
          bad: {
            id: 'bad',
            kind: 'item',
            label: 'Bad',
            order: 0,
            target: { type: 'screen', ref: '' },
          },
        },
      };
      
      const result = validateNavigationPublish(invalid);
      
      expect(result.ok).toBe(false);
      expect(result.errors.some(e => e.includes('target.ref'))).toBe(true);
    });

    it('debe rechazar URL externa inválida', () => {
      const invalid = {
        ...VALID_NAVIGATION,
        nodes: {
          ...VALID_NAVIGATION.nodes,
          external: {
            id: 'external',
            kind: 'external_link',
            label: 'External',
            order: 0,
            target: { type: 'url', ref: 'not-a-valid-url' },
          },
        },
      };
      
      const result = validateNavigationPublish(invalid);
      
      expect(result.ok).toBe(false);
      expect(result.errors.some(e => e.includes('URL absoluta válida'))).toBe(true);
    });

    it('debe aceptar URL externa válida', () => {
      const valid = {
        ...VALID_NAVIGATION,
        nodes: {
          root: { id: 'root', kind: 'section', label: 'Root', order: 0 },
          external: {
            id: 'external',
            kind: 'external_link',
            label: 'External',
            order: 1,
            target: { type: 'url', ref: 'https://example.com' },
          },
        },
        edges: [{ from: 'root', to: 'external' }],
      };
      
      const result = validateNavigationPublish(valid);
      
      expect(result.ok).toBe(true);
    });
  });

  describe('Validación de edges', () => {
    it('debe rechazar edge con from inexistente', () => {
      const invalid = {
        ...VALID_NAVIGATION,
        edges: [
          { from: 'nonexistent', to: 'item1' },
        ],
      };
      
      const result = validateNavigationPublish(invalid);
      
      expect(result.ok).toBe(false);
      expect(result.errors.some(e => e.includes('from') && e.includes('no existe'))).toBe(true);
    });

    it('debe rechazar edge con to inexistente', () => {
      const invalid = {
        ...VALID_NAVIGATION,
        edges: [
          { from: 'root', to: 'nonexistent' },
        ],
      };
      
      const result = validateNavigationPublish(invalid);
      
      expect(result.ok).toBe(false);
      expect(result.errors.some(e => e.includes('to') && e.includes('no existe'))).toBe(true);
    });

    it('debe advertir sobre edges duplicados', () => {
      const withDupes = {
        ...VALID_NAVIGATION,
        edges: [
          { from: 'root', to: 'item1' },
          { from: 'root', to: 'item1' }, // duplicado
        ],
      };
      
      const result = validateNavigationDraft(withDupes);
      
      expect(result.ok).toBe(true);
      expect(result.warnings.some(w => w.includes('duplicado'))).toBe(true);
    });
  });

  describe('Nodos huérfanos', () => {
    it('debe advertir sobre huérfanos en modo draft', () => {
      const result = validateNavigationDraft(NAVIGATION_WITH_ORPHAN);
      
      expect(result.ok).toBe(true);
      expect(result.warnings.some(w => w.includes('huérfanos') || w.includes('orphan'))).toBe(true);
    });

    it('debe rechazar huérfanos en modo publish', () => {
      const result = validateNavigationPublish(NAVIGATION_WITH_ORPHAN);
      
      expect(result.ok).toBe(false);
      expect(result.errors.some(e => e.includes('huérfanos') || e.includes('inalcanzables'))).toBe(true);
    });
  });

  describe('Ciclos', () => {
    it('debe advertir sobre ciclos pero no bloquear en v1', () => {
      const result = validateNavigationPublish(NAVIGATION_WITH_CYCLE);
      
      // En v1, los ciclos son warning, no error
      expect(result.warnings.some(w => w.includes('Ciclos') || w.includes('ciclo'))).toBe(true);
      // Puede pasar validación si no hay otros errores
    });
  });

  describe('Normalización', () => {
    it('debe normalizar children a edges', () => {
      const withChildren = {
        navigation_id: 'test-children',
        name: 'Test',
        entry_node_id: 'root',
        nodes: {
          root: { id: 'root', kind: 'section', label: 'Root', order: 0, children: ['child1', 'child2'] },
          child1: { id: 'child1', kind: 'item', label: 'Child 1', order: 1, target: { type: 'screen', ref: '/a' } },
          child2: { id: 'child2', kind: 'item', label: 'Child 2', order: 2, target: { type: 'screen', ref: '/b' } },
        },
        edges: [],
      };
      
      const normalized = normalizeNavigationDefinition(withChildren);
      
      expect(normalized.edges).toHaveLength(2);
      expect(normalized.edges.some(e => e.from === 'root' && e.to === 'child1')).toBe(true);
      expect(normalized.edges.some(e => e.from === 'root' && e.to === 'child2')).toBe(true);
      // Children deben ser eliminados de los nodos
      expect(normalized.nodes.root.children).toBeUndefined();
    });

    it('debe asignar defaults a nodos', () => {
      const minimal = {
        navigation_id: 'test-defaults',
        name: 'Test',
        entry_node_id: 'root',
        nodes: {
          root: { label: 'Root' }, // Sin kind, sin order
        },
        edges: [],
      };
      
      const normalized = normalizeNavigationDefinition(minimal);
      
      expect(normalized.nodes.root.id).toBe('root');
      expect(normalized.nodes.root.kind).toBeDefined();
      expect(normalized.nodes.root.order).toBeDefined();
    });

    it('debe deduplicar edges', () => {
      const withDupes = {
        navigation_id: 'test-dedup',
        name: 'Test',
        entry_node_id: 'a',
        nodes: {
          a: { id: 'a', kind: 'section', label: 'A', order: 0 },
          b: { id: 'b', kind: 'item', label: 'B', order: 1, target: { type: 'screen', ref: '/b' } },
        },
        edges: [
          { from: 'a', to: 'b' },
          { from: 'a', to: 'b' }, // duplicado
          { from: 'a', to: 'b' }, // otro duplicado
        ],
      };
      
      const normalized = normalizeNavigationDefinition(withDupes);
      
      expect(normalized.edges).toHaveLength(1);
    });
  });

  describe('Detección de nodos alcanzables', () => {
    it('debe detectar todos los nodos alcanzables', () => {
      const nav = normalizeNavigationDefinition(VALID_NAVIGATION);
      const reachable = getReachableNodes(nav, 'root');
      
      expect(reachable.has('root')).toBe(true);
      expect(reachable.has('item1')).toBe(true);
    });

    it('debe no incluir nodos no alcanzables', () => {
      const nav = normalizeNavigationDefinition(NAVIGATION_WITH_ORPHAN);
      const reachable = getReachableNodes(nav, 'root');
      
      expect(reachable.has('root')).toBe(true);
      expect(reachable.has('child1')).toBe(true);
      expect(reachable.has('orphan')).toBe(false);
    });
  });

  describe('Detección de ciclos', () => {
    it('debe detectar ciclos en el grafo', () => {
      const nav = normalizeNavigationDefinition(NAVIGATION_WITH_CYCLE);
      const cycles = detectCycles(nav);
      
      expect(cycles.length).toBeGreaterThan(0);
    });

    it('debe no detectar ciclos donde no hay', () => {
      const nav = normalizeNavigationDefinition(VALID_NAVIGATION);
      const cycles = detectCycles(nav);
      
      expect(cycles).toHaveLength(0);
    });
  });

  describe('createMinimalNavigation', () => {
    it('debe crear una navegación mínima válida', () => {
      const minimal = createMinimalNavigation('test-minimal', 'Test Minimal');
      const result = validateNavigationPublish(minimal);
      
      expect(result.ok).toBe(true);
      expect(minimal.navigation_id).toBe('test-minimal');
      expect(minimal.name).toBe('Test Minimal');
      expect(minimal.entry_node_id).toBeDefined();
      expect(minimal.nodes[minimal.entry_node_id]).toBeDefined();
    });
  });
});















