// src/core/navigation/navigation-effective-resolver.js
// Resolver de Navegación Efectiva (FASE 5)
//
// RESPONSABILIDAD:
// - Componer NavigationEffective desde navegación global + contextuales
// - Trackear provenance (origen de cada nodo/edge)
// - Detectar y reportar conflictos/warnings
//
// PRINCIPIOS:
// - Determinista: mismo input → mismo output
// - Fail-open: si falta global, retorna estructura vacía con warnings
// - Contextuales override global: si hay conflicto, contextual gana
// - NO evalúa visibility_rules (solo transporta)
// - NO toca runtime del alumno

import { normalizeNavigationDefinition } from './navigation-definition-v1.js';
import { logWarn, logError } from '../observability/logger.js';

/**
 * @typedef {Object} NavigationEffectiveResult
 * @property {NavigationDefinition} effectiveDef - Navegación efectiva compuesta
 * @property {NavigationProvenance} provenance - Procedencia de cada nodo/edge
 * @property {NavigationWarning[]} warnings - Warnings de conflictos o problemas
 */

/**
 * @typedef {Object} NavigationProvenance
 * @property {Object.<string, 'global'|string>} nodes - Mapa de node_id → origen ('global' o context_key)
 * @property {Object.<string, 'global'|string>} edges - Mapa de edge_key → origen ('global' o context_key)
 * @property {string} entry_node_id_source - Origen del entry_node_id ('global' o context_key)
 */

/**
 * @typedef {Object} NavigationWarning
 * @property {string} type - Tipo de warning ('missing_global', 'conflict_node', 'conflict_edge', 'orphan_node', 'invalid_context')
 * @property {string} message - Mensaje descriptivo
 * @property {string} [node_id] - ID del nodo afectado (si aplica)
 * @property {string} [edge_key] - Clave del edge afectado (si aplica)
 * @property {string} [context_key] - Context key del contexto afectado (si aplica)
 */

/**
 * Resuelve una NavigationEffective desde navegación global + contextuales
 * 
 * @param {NavigationDefinition} globalDef - Navegación global base (type='global')
 * @param {NavigationDefinition[]} contextDefs - Array de navegaciones contextuales (type='contextual')
 * @param {Object} [opts] - Opciones opcionales
 * @param {boolean} [opts.strict=false] - Si true, errores críticos lanzan excepciones
 * @returns {NavigationEffectiveResult} Resultado con effectiveDef, provenance y warnings
 * 
 * @example
 * const result = resolveNavigationEffective(
 *   globalNav,
 *   [contextNav1, contextNav2],
 *   { strict: false }
 * );
 * // result.effectiveDef: NavigationDefinition compuesta
 * // result.provenance: { nodes: {...}, edges: {...}, entry_node_id_source: 'global' }
 * // result.warnings: [{ type: 'conflict_node', message: '...', node_id: 'n1' }]
 */
export function resolveNavigationEffective(globalDef, contextDefs = [], opts = {}) {
  const { strict = false } = opts;
  const warnings = [];
  const provenance = {
    nodes: {},
    edges: {},
    entry_node_id_source: 'global'
  };

  // Validar y normalizar globalDef
  if (!globalDef || typeof globalDef !== 'object') {
    const warning = {
      type: 'missing_global',
      message: 'Navegación global no proporcionada o inválida'
    };
    warnings.push(warning);
    
    if (strict) {
      throw new Error('Navegación global requerida en modo strict');
    }
    
    // Fail-open: retornar estructura vacía
    return {
      effectiveDef: createEmptyNavigation(),
      provenance,
      warnings
    };
  }

  // Normalizar globalDef
  let normalizedGlobal;
  try {
    normalizedGlobal = normalizeNavigationDefinition(globalDef);
  } catch (error) {
    logError('navigation-effective-resolver', 'Error normalizando navegación global', {
      error: error.message,
      stack: error.stack
    });
    warnings.push({
      type: 'invalid_global',
      message: `Error normalizando navegación global: ${error.message}`
    });
    
    if (strict) {
      throw error;
    }
    
    return {
      effectiveDef: createEmptyNavigation(),
      provenance,
      warnings
    };
  }

  // Validar que globalDef sea tipo 'global'
  if (normalizedGlobal.type !== 'global') {
    warnings.push({
      type: 'invalid_global',
      message: `Navegación global debe tener type='global', tiene type='${normalizedGlobal.type}'`
    });
  }

  // Inicializar effectiveDef con global como base
  const effectiveDef = {
    navigation_id: normalizedGlobal.navigation_id || 'effective-navigation',
    name: normalizedGlobal.name || 'Navegación Efectiva',
    description: normalizedGlobal.description,
    type: 'global', // La efectiva siempre es 'global' (compuesta)
    context_key: null, // La efectiva no tiene context_key
    entry_node_id: normalizedGlobal.entry_node_id,
    nodes: { ...normalizedGlobal.nodes || {} },
    edges: [...(normalizedGlobal.edges || [])],
    meta: {
      ...(normalizedGlobal.meta || {}),
      _composed: true,
      _composed_at: new Date().toISOString(),
      _global_navigation_id: normalizedGlobal.navigation_id
    }
  };

  // Trackear provenance de nodos y edges globales
  const globalNodes = normalizedGlobal.nodes || {};
  const globalEdges = normalizedGlobal.edges || [];
  
  for (const nodeId of Object.keys(globalNodes)) {
    provenance.nodes[nodeId] = 'global';
  }
  
  for (const edge of globalEdges) {
    const edgeKey = getEdgeKey(edge);
    provenance.edges[edgeKey] = 'global';
  }

  // Procesar navegaciones contextuales
  const normalizedContexts = [];
  
  for (let i = 0; i < contextDefs.length; i++) {
    const contextDef = contextDefs[i];
    
    if (!contextDef || typeof contextDef !== 'object') {
      warnings.push({
        type: 'invalid_context',
        message: `Navegación contextual #${i + 1} es inválida o está vacía`,
        context_key: contextDef?.context_key || 'unknown'
      });
      continue;
    }

    // Normalizar contexto
    let normalizedContext;
    try {
      normalizedContext = normalizeNavigationDefinition(contextDef);
    } catch (error) {
      logWarn('navigation-effective-resolver', 'Error normalizando navegación contextual', {
        context_key: contextDef.context_key,
        error: error.message
      });
      warnings.push({
        type: 'invalid_context',
        message: `Error normalizando navegación contextual: ${error.message}`,
        context_key: contextDef.context_key || 'unknown'
      });
      continue;
    }

    // Validar que sea tipo 'contextual'
    if (normalizedContext.type !== 'contextual') {
      warnings.push({
        type: 'invalid_context',
        message: `Navegación contextual debe tener type='contextual', tiene type='${normalizedContext.type}'`,
        context_key: normalizedContext.context_key || 'unknown'
      });
      continue;
    }

    // Validar que tenga context_key
    if (!normalizedContext.context_key) {
      warnings.push({
        type: 'invalid_context',
        message: `Navegación contextual debe tener context_key`,
        context_key: 'missing'
      });
      continue;
    }

    normalizedContexts.push(normalizedContext);
  }

  // Aplicar cada contexto (en orden, el último gana en conflictos)
  for (const contextDef of normalizedContexts) {
    const contextKey = contextDef.context_key;
    const contextNodes = contextDef.nodes || {};
    const contextEdges = contextDef.edges || [];

    // Mergear nodos: contextuales override globales
    for (const [nodeId, contextNode] of Object.entries(contextNodes)) {
      const existingNode = effectiveDef.nodes[nodeId];
      
      if (existingNode) {
        // Conflicto: nodo existe en global y contexto
        warnings.push({
          type: 'conflict_node',
          message: `Nodo '${nodeId}' existe en global y contexto '${contextKey}'. Contexto gana.`,
          node_id: nodeId,
          context_key: contextKey
        });
      }
      
      // Aplicar nodo contextual (override)
      effectiveDef.nodes[nodeId] = { ...contextNode };
      provenance.nodes[nodeId] = contextKey;
    }

    // Mergear edges: contextuales override globales
    for (const contextEdge of contextEdges) {
      const edgeKey = getEdgeKey(contextEdge);
      const existingEdge = effectiveDef.edges.find(e => getEdgeKey(e) === edgeKey);
      
      if (existingEdge) {
        // Conflicto: edge existe en global y contexto
        warnings.push({
          type: 'conflict_edge',
          message: `Edge '${edgeKey}' existe en global y contexto '${contextKey}'. Contexto gana.`,
          edge_key: edgeKey,
          context_key: contextKey
        });
        
        // Reemplazar edge existente
        const index = effectiveDef.edges.indexOf(existingEdge);
        effectiveDef.edges[index] = { ...contextEdge };
      } else {
        // Nuevo edge contextual
        effectiveDef.edges.push({ ...contextEdge });
      }
      
      provenance.edges[edgeKey] = contextKey;
    }

    // Si el contexto tiene entry_node_id y no hay uno global, usarlo
    if (contextDef.entry_node_id && !normalizedGlobal.entry_node_id) {
      effectiveDef.entry_node_id = contextDef.entry_node_id;
      provenance.entry_node_id_source = contextKey;
      warnings.push({
        type: 'entry_from_context',
        message: `entry_node_id tomado del contexto '${contextKey}' (no había global)`,
        context_key: contextKey
      });
    }
  }

  // Detectar nodos huérfanos (nodos sin edges que los conecten)
  const orphanNodes = detectOrphanNodes(effectiveDef);
  for (const nodeId of orphanNodes) {
    warnings.push({
      type: 'orphan_node',
      message: `Nodo '${nodeId}' no está conectado por ningún edge`,
      node_id: nodeId
    });
  }

  // Validar que entry_node_id existe
  if (effectiveDef.entry_node_id && !effectiveDef.nodes[effectiveDef.entry_node_id]) {
    warnings.push({
      type: 'invalid_entry',
      message: `entry_node_id '${effectiveDef.entry_node_id}' no existe en nodos`,
      node_id: effectiveDef.entry_node_id
    });
  }

  // Normalizar resultado final
  try {
    const finalEffective = normalizeNavigationDefinition(effectiveDef);
    
    return {
      effectiveDef: finalEffective,
      provenance,
      warnings
    };
  } catch (error) {
    logError('navigation-effective-resolver', 'Error normalizando navegación efectiva final', {
      error: error.message,
      stack: error.stack
    });
    warnings.push({
      type: 'normalization_error',
      message: `Error normalizando navegación efectiva: ${error.message}`
    });
    
    if (strict) {
      throw error;
    }
    
    // Retornar lo que tengamos
    return {
      effectiveDef,
      provenance,
      warnings
    };
  }
}

/**
 * Crea una navegación vacía (fail-open)
 * @returns {NavigationDefinition} Navegación mínima vacía
 */
function createEmptyNavigation() {
  return {
    navigation_id: 'empty-navigation',
    name: 'Navegación Vacía',
    type: 'global',
    context_key: null,
    entry_node_id: 'root',
    nodes: {
      root: {
        id: 'root',
        kind: 'section',
        type: 'home',
        label: 'Navegación Vacía',
        order: 0
      }
    },
    edges: [],
    meta: {
      _composed: true,
      _empty: true
    }
  };
}

/**
 * Genera una clave única para un edge (para tracking)
 * @param {EdgeDefinition} edge - Edge a procesar
 * @returns {string} Clave única del edge
 */
function getEdgeKey(edge) {
  return `${edge.from}:${edge.to}:${edge.kind || 'child'}`;
}

/**
 * Detecta nodos huérfanos (sin edges que los conecten)
 * @param {NavigationDefinition} def - Definición a analizar
 * @returns {string[]} Array de IDs de nodos huérfanos
 */
function detectOrphanNodes(def) {
  const nodes = def.nodes || {};
  const edges = def.edges || [];
  const entryNodeId = def.entry_node_id;
  
  // Construir set de nodos alcanzables desde entry
  const reachable = new Set();
  if (entryNodeId && nodes[entryNodeId]) {
    reachable.add(entryNodeId);
    
    // BFS desde entry
    const queue = [entryNodeId];
    while (queue.length > 0) {
      const current = queue.shift();
      
      for (const edge of edges) {
        if (edge.from === current && !reachable.has(edge.to)) {
          reachable.add(edge.to);
          queue.push(edge.to);
        }
      }
    }
  }
  
  // Nodos no alcanzables son huérfanos
  const orphanNodes = [];
  for (const nodeId of Object.keys(nodes)) {
    if (!reachable.has(nodeId)) {
      orphanNodes.push(nodeId);
    }
  }
  
  return orphanNodes;
}

/**
 * Exporta la función principal
 */
export default { resolveNavigationEffective };



