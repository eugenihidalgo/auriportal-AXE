// src/core/navigation/navigation-definition-v1.js
// Tipos y helpers para NavigationDefinition v1
//
// PRINCIPIOS:
// - Define la estructura del contrato NavigationDefinition v1
// - Helpers para crear, normalizar y manipular definiciones
// - NO contiene lógica de validación (ver validate-navigation-definition-v1.js)
// - NO contiene lógica runtime (solo tipos y transformaciones)

import {
  NODE_KINDS,
  TARGET_TYPES,
  EDGE_KINDS,
  LAYOUT_HINTS,
  NODE_DEFAULTS,
  EDGE_DEFAULTS,
  NAVIGATION_DEFAULTS,
  isValidId,
} from './navigation-constants.js';

/**
 * @typedef {Object} NavigationDefinition
 * @property {string} navigation_id - ID único de la navegación
 * @property {string} name - Nombre legible de la navegación
 * @property {string} [description] - Descripción opcional
 * @property {'global'|'contextual'} [type] - Tipo de navegación (FASE 4.1)
 * @property {string|null} [context_key] - Clave de contexto (obligatorio si type === 'contextual')
 * @property {string} entry_node_id - ID del nodo de entrada
 * @property {Object.<string, NodeDefinition>} nodes - Mapa de nodos por ID
 * @property {EdgeDefinition[]} [edges] - Lista de edges (opcional si se usan children)
 * @property {Object} [meta] - Metadatos opcionales
 * @property {string} [meta.created_by] - Creador
 * @property {string} [meta.created_at] - Fecha de creación
 */

/**
 * @typedef {Object} NodeDefinition
 * @property {string} id - ID único del nodo
 * @property {string} kind - Tipo de nodo (section, group, item, hub, external_link, system_entry)
 * @property {'home'|'section'|'view'|'external'|'overlay'|'return'} [type] - Tipo semántico (FASE 4.2)
 * @property {string} label - Etiqueta visible
 * @property {string} [subtitle] - Subtítulo opcional
 * @property {string} [icon] - Icono opcional
 * @property {string} [art_ref] - Referencia a arte opcional
 * @property {string} [layout_hint] - Hint de layout (list, grid, map, cards, tree)
 * @property {number} [order] - Orden de renderizado
 * @property {Object} [position] - Posición en canvas {x, y}
 * @property {VisibilityRules} [visibility_rules] - Reglas de visibilidad (FASE 4.3 - pasivo)
 * @property {VisibilityConfig} [visibility] - Configuración de visibilidad (legacy)
 * @property {TargetConfig} [target] - Configuración de target
 * @property {string[]} [children] - IDs de nodos hijos (alternativa a edges)
 * @property {Object} [meta] - Metadatos opcionales
 */

/**
 * @typedef {Object} VisibilityConfig
 * @property {number} [min_nivel_efectivo] - Nivel mínimo requerido
 * @property {string} [feature_flag] - Feature flag requerida
 * @property {string[]} [requires] - Lista de permisos requeridos
 */

/**
 * Reglas de visibilidad (FASE 4.3 - pasivo, sin evaluación)
 * @typedef {Object} VisibilityRules
 * @property {number} [min_level] - Nivel mínimo requerido
 * @property {number} [max_level] - Nivel máximo permitido
 * @property {string[]} [flags] - Feature flags requeridas
 * @property {string[]} [products] - Productos requeridos
 */

/**
 * @typedef {Object} TargetConfig
 * @property {string} type - Tipo de target (recorrido, pde_catalog, screen, url, admin_tool)
 * @property {string} ref - Referencia al target
 * @property {Object} [params] - Parámetros adicionales
 */

/**
 * @typedef {Object} EdgeDefinition
 * @property {string} from - ID del nodo origen
 * @property {string} to - ID del nodo destino
 * @property {string} [kind] - Tipo de edge (child, link)
 */

/**
 * Crea una NavigationDefinition mínima
 * @param {string} navigationId - ID de la navegación
 * @param {string} name - Nombre de la navegación
 * @returns {NavigationDefinition} Definición mínima
 */
export function createMinimalNavigation(navigationId, name, type = 'global', contextKey = null) {
  const entryNodeId = 'root';
  const navDef = {
    navigation_id: navigationId,
    name: name || navigationId,
    type: type || NAVIGATION_DEFAULTS.type,
    entry_node_id: entryNodeId,
    nodes: {
      [entryNodeId]: {
        id: entryNodeId,
        kind: 'section',
        type: 'home', // FASE 4.2: tipo semántico por defecto para root
        label: name || 'Navegación',
        order: 0,
      },
    },
    edges: [],
    meta: {
      created_at: new Date().toISOString(),
    },
  };
  
  // FASE 4.1: Añadir context_key si es contextual
  if (type === 'contextual') {
    if (!contextKey) {
      console.warn(`[AXE][NAV_EDITOR] createMinimalNavigation: type='contextual' requiere context_key, usando 'default'`);
      navDef.context_key = 'default';
    } else {
      navDef.context_key = contextKey;
    }
  }
  
  return navDef;
}

/**
 * Normaliza children a edges
 * Si los nodos usan children, los convierte a edges
 * @param {NavigationDefinition} def - Definición con children
 * @returns {EdgeDefinition[]} Edges generados
 */
export function normalizeChildrenToEdges(def) {
  const edges = [];
  const nodes = def.nodes || {};

  for (const [nodeId, node] of Object.entries(nodes)) {
    if (node.children && Array.isArray(node.children)) {
      for (const childId of node.children) {
        edges.push({
          from: nodeId,
          to: childId,
          kind: 'child',
        });
      }
    }
  }

  return edges;
}

/**
 * Normaliza una NavigationDefinition
 * - Asegura que edges exista (combinando con children si aplica)
 * - Asigna IDs a nodos si faltan
 * - Aplica defaults a nodos y edges
 * - Deduplica edges
 * - Ordena edges de forma determinista
 * @param {NavigationDefinition} def - Definición a normalizar
 * @returns {NavigationDefinition} Definición normalizada
 */
export function normalizeNavigationDefinition(def) {
  if (!def || typeof def !== 'object') {
    return def;
  }

  const normalized = {
    navigation_id: def.navigation_id,
    name: def.name,
    description: def.description,
    type: def.type || NAVIGATION_DEFAULTS.type, // FASE 4.1
    context_key: def.context_key !== undefined ? def.context_key : null, // FASE 4.1
    entry_node_id: def.entry_node_id,
    nodes: {},
    edges: [],
    meta: def.meta || {},
  };
  
  // FASE 4.1: Validación ligera (warning, no bloqueo)
  if (normalized.type === 'contextual' && !normalized.context_key) {
    console.warn(`[AXE][NAV_EDITOR] normalizeNavigationDefinition: type='contextual' sin context_key en navegación '${normalized.navigation_id}'`);
  }
  if (normalized.type === 'global' && normalized.context_key !== null) {
    console.warn(`[AXE][NAV_EDITOR] normalizeNavigationDefinition: type='global' con context_key no-null en navegación '${normalized.navigation_id}' (ignorado)`);
    normalized.context_key = null;
  }

  // Normalizar nodos
  const nodes = def.nodes || {};
  for (const [nodeId, node] of Object.entries(nodes)) {
    const normalizedNode = {
      ...node,
      id: node.id || nodeId, // Asegurar que id coincida con la key
      kind: node.kind || NODE_DEFAULTS.kind,
      layout_hint: node.layout_hint || NODE_DEFAULTS.layout_hint,
      order: typeof node.order === 'number' ? node.order : NODE_DEFAULTS.order,
    };

    // Eliminar children del nodo normalizado (se convierte a edges)
    delete normalizedNode.children;

    normalized.nodes[nodeId] = normalizedNode;
  }

  // Combinar edges existentes con children normalizados
  const existingEdges = def.edges || [];
  const childrenEdges = normalizeChildrenToEdges(def);
  const allEdges = [...existingEdges, ...childrenEdges];

  // Normalizar edges
  for (const edge of allEdges) {
    normalized.edges.push({
      from: edge.from,
      to: edge.to,
      kind: edge.kind || EDGE_DEFAULTS.kind,
    });
  }

  // Deduplicar edges (por from+to+kind)
  const seenEdges = new Set();
  normalized.edges = normalized.edges.filter(edge => {
    const key = `${edge.from}:${edge.to}:${edge.kind}`;
    if (seenEdges.has(key)) {
      return false;
    }
    seenEdges.add(key);
    return true;
  });

  // Ordenar edges de forma determinista (from, to, kind)
  normalized.edges.sort((a, b) => {
    if (a.from !== b.from) return a.from.localeCompare(b.from);
    if (a.to !== b.to) return a.to.localeCompare(b.to);
    return (a.kind || '').localeCompare(b.kind || '');
  });

  return normalized;
}

/**
 * Calcula los nodos alcanzables desde un nodo de entrada
 * Usa BFS para encontrar todos los nodos conectados
 * @param {NavigationDefinition} def - Definición normalizada
 * @param {string} startNodeId - ID del nodo de inicio
 * @returns {Set<string>} Set de IDs de nodos alcanzables
 */
export function getReachableNodes(def, startNodeId) {
  const reachable = new Set();
  const queue = [startNodeId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (reachable.has(current)) continue;
    
    // Solo añadir si el nodo existe
    if (def.nodes && def.nodes[current]) {
      reachable.add(current);
    } else {
      continue; // Skip si el nodo no existe
    }

    // Encontrar edges salientes
    const edges = def.edges || [];
    for (const edge of edges) {
      if (edge.from === current && !reachable.has(edge.to)) {
        queue.push(edge.to);
      }
    }
  }

  return reachable;
}

/**
 * Detecta ciclos en el grafo de navegación
 * Usa DFS con colores (white, gray, black)
 * @param {NavigationDefinition} def - Definición normalizada
 * @returns {string[][]} Array de ciclos encontrados (cada ciclo es un array de IDs)
 */
export function detectCycles(def) {
  const cycles = [];
  const nodes = def.nodes || {};
  const edges = def.edges || [];

  // Construir grafo de adyacencia
  const adjacency = {};
  for (const nodeId of Object.keys(nodes)) {
    adjacency[nodeId] = [];
  }
  for (const edge of edges) {
    if (adjacency[edge.from]) {
      adjacency[edge.from].push(edge.to);
    }
  }

  // DFS con colores
  const WHITE = 0; // No visitado
  const GRAY = 1;  // En proceso (en el stack)
  const BLACK = 2; // Completado

  const color = {};
  const parent = {};
  
  for (const nodeId of Object.keys(nodes)) {
    color[nodeId] = WHITE;
    parent[nodeId] = null;
  }

  function dfs(node, path) {
    color[node] = GRAY;
    path.push(node);

    for (const neighbor of adjacency[node] || []) {
      if (color[neighbor] === GRAY) {
        // Encontramos un ciclo
        const cycleStart = path.indexOf(neighbor);
        const cycle = path.slice(cycleStart);
        cycle.push(neighbor); // Cerrar el ciclo
        cycles.push(cycle);
      } else if (color[neighbor] === WHITE) {
        parent[neighbor] = node;
        dfs(neighbor, [...path]);
      }
    }

    color[node] = BLACK;
  }

  // Iniciar DFS desde cada nodo no visitado
  for (const nodeId of Object.keys(nodes)) {
    if (color[nodeId] === WHITE) {
      dfs(nodeId, []);
    }
  }

  return cycles;
}

/**
 * Canonicaliza un objeto para checksum
 * Ordena las keys de forma determinista y serializa
 * @param {Object} obj - Objeto a canonicalizar
 * @returns {string} JSON canonicalizado
 */
export function canonicalize(obj) {
  return JSON.stringify(obj, Object.keys(obj).sort(), 0);
}

/**
 * Genera checksum SHA256 de una definición
 * @param {NavigationDefinition} def - Definición normalizada
 * @returns {Promise<string>} Checksum hexadecimal
 */
export async function generateChecksum(def) {
  const canonical = canonicalize(def);
  
  // Usar crypto nativo de Node.js
  const crypto = await import('crypto');
  const hash = crypto.createHash('sha256');
  hash.update(canonical);
  return hash.digest('hex');
}

/**
 * Verifica si un nodo requiere target según su kind o type
 * @param {string} kind - Tipo de nodo (kind)
 * @param {string} [type] - Tipo semántico (type) - FASE 4.2
 * @returns {boolean} true si requiere target
 */
export function nodeRequiresTarget(kind, type) {
  const NODES_REQUIRING_TARGET = ['item', 'hub', 'external_link', 'system_entry', 'view', 'external'];
  if (NODES_REQUIRING_TARGET.includes(kind)) return true;
  if (type && NODES_REQUIRING_TARGET.includes(type)) return true;
  return false;
}

/**
 * Verifica si un nodo puede ser entry según su type (FASE 4.2)
 * @param {string} [type] - Tipo semántico del nodo
 * @returns {boolean} true si puede ser entry
 */
export function nodeCanBeEntry(type) {
  if (!type) return true; // Si no tiene type, se permite (compatibilidad)
  const CANNOT_BE_ENTRY = ['overlay'];
  return !CANNOT_BE_ENTRY.includes(type);
}

/**
 * Valida visibility_rules como JSON (FASE 4.3 - pasivo)
 * Solo valida estructura, no evalúa condiciones
 * @param {Object} rules - Reglas de visibilidad
 * @returns {{valid: boolean, error?: string}} Resultado de validación
 */
export function validateVisibilityRulesPassive(rules) {
  if (!rules || typeof rules !== 'object') {
    return { valid: true }; // Vacío es válido
  }
  
  try {
    // Validar estructura esperada
    if (rules.min_level !== undefined && typeof rules.min_level !== 'number') {
      return { valid: false, error: 'min_level debe ser número' };
    }
    if (rules.max_level !== undefined && typeof rules.max_level !== 'number') {
      return { valid: false, error: 'max_level debe ser número' };
    }
    if (rules.flags !== undefined && !Array.isArray(rules.flags)) {
      return { valid: false, error: 'flags debe ser array' };
    }
    if (rules.products !== undefined && !Array.isArray(rules.products)) {
      return { valid: false, error: 'products debe ser array' };
    }
    
    // Validar que sea JSON serializable
    JSON.stringify(rules);
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: `JSON inválido: ${error.message}` };
  }
}





