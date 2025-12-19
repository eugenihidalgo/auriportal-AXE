// src/core/navigation/resolve-navigation-effective.js
// Resolver Canónico de Navegación Efectiva (Sprint 3)
//
// RESPONSABILIDAD:
// - Componer NavigationEffective desde navegación base + contextuales
// - Determinar entry_node_id efectivo
// - NO evalúa visibility_rules (solo transporta)
// - NO toca runtime del alumno
// - Fail-open garantizado
//
// PRINCIPIOS:
// - Determinista: mismo input → mismo output
// - Fail-open: si falta base, lanza error controlado
// - Contextuales override base: si hay conflicto, contextual gana
// - NO DB, NO runtime, SOLO composición en memoria

import { normalizeNavigationDefinition } from './navigation-definition-v1.js';
import { logWarn, logError, logInfo } from '../observability/logger.js';

/**
 * Resuelve una navegación efectiva desde base + contextuales
 * 
 * @param {NavigationDefinition} baseNavigation - Navegación base (obligatoria)
 * @param {Array<{context_key: string, navigation: NavigationDefinition}>} contextualNavigations - Array de navegaciones contextuales
 * @param {string|null} contextKey - Context key a aplicar (opcional)
 * @returns {NavigationDefinition} Navegación efectiva compuesta
 * 
 * @example
 * const effective = resolveNavigationEffective(
 *   baseNav,
 *   [{ context_key: 'premium', navigation: contextNav }],
 *   'premium'
 * );
 */
export function resolveNavigationEffective(baseNavigation, contextualNavigations = [], contextKey = null) {
  console.log('[AXE][NAV_EFFECTIVE] resolved base=' + (baseNavigation?.navigation_id || 'null') + ' context=' + (contextKey || 'null'));
  
  // Validar baseNavigation (obligatorio)
  if (!baseNavigation || typeof baseNavigation !== 'object') {
    logError('navigation-effective-resolver', 'baseNavigation no proporcionada o inválida');
    throw new Error('baseNavigation es obligatoria y debe ser un NavigationDefinition válido');
  }

  // Normalizar baseNavigation
  let normalizedBase;
  try {
    normalizedBase = normalizeNavigationDefinition(baseNavigation);
    logInfo('navigation-effective-resolver', 'base loaded', { navigation_id: normalizedBase.navigation_id });
  } catch (error) {
    logError('navigation-effective-resolver', 'Error normalizando navegación base', {
      error: error.message,
      stack: error.stack
    });
    throw new Error(`Error normalizando navegación base: ${error.message}`);
  }

  // Inicializar effectiveDef con base como esqueleto
  const effectiveDef = {
    navigation_id: normalizedBase.navigation_id || 'effective-navigation',
    entry_node_id: normalizedBase.entry_node_id,
    nodes: { ...(normalizedBase.nodes || {}) },
    edges: [...(normalizedBase.edges || [])],
    meta: {
      ...(normalizedBase.meta || {}),
      effective: true,
      context_key: contextKey,
      provenance: {
        nodeId: {},
        edgeIdx: {}
      }
    }
  };

  // Trackear provenance de nodos y edges base
  const baseNodes = normalizedBase.nodes || {};
  const baseEdges = normalizedBase.edges || [];
  
  for (const nodeId of Object.keys(baseNodes)) {
    effectiveDef.meta.provenance.nodeId[nodeId] = 'base';
  }
  
  for (let i = 0; i < baseEdges.length; i++) {
    const edge = baseEdges[i];
    const edgeKey = getEdgeKey(edge);
    effectiveDef.meta.provenance.edgeIdx[edgeKey] = 'base';
  }

  // Si contextKey existe, buscar y aplicar contextualNavigation matching
  if (contextKey) {
    const matchingContextual = contextualNavigations.find(
      ctx => ctx.context_key === contextKey && ctx.navigation
    );

    if (matchingContextual && matchingContextual.navigation) {
      logInfo('navigation-effective-resolver', 'contextual loaded', { 
        context_key: contextKey,
        navigation_id: matchingContextual.navigation.navigation_id 
      });

      let normalizedContext;
      try {
        normalizedContext = normalizeNavigationDefinition(matchingContextual.navigation);
      } catch (error) {
        logWarn('navigation-effective-resolver', 'Error normalizando navegación contextual, usando solo base', {
          context_key: contextKey,
          error: error.message
        });
        // Fail-open: usar solo base + warning
        return effectiveDef;
      }

      const contextNodes = normalizedContext.nodes || {};
      const contextEdges = normalizedContext.edges || [];

      // Merge nodos: si id existe → override (contextual gana), si no existe → añadir
      for (const [nodeId, contextNode] of Object.entries(contextNodes)) {
        const existingNode = effectiveDef.nodes[nodeId];
        
        if (existingNode) {
          // Override: contextual gana
          effectiveDef.nodes[nodeId] = { ...contextNode };
          effectiveDef.meta.provenance.nodeId[nodeId] = 'contextual';
        } else {
          // Añadir nuevo nodo contextual
          effectiveDef.nodes[nodeId] = { ...contextNode };
          effectiveDef.meta.provenance.nodeId[nodeId] = 'contextual';
        }
      }

      // Merge edges: unión simple (sin duplicados exactos)
      const existingEdgeKeys = new Set();
      effectiveDef.edges.forEach(edge => {
        existingEdgeKeys.add(getEdgeKey(edge));
      });

      for (const contextEdge of contextEdges) {
        const edgeKey = getEdgeKey(contextEdge);
        
        if (existingEdgeKeys.has(edgeKey)) {
          // Reemplazar edge existente
          const index = effectiveDef.edges.findIndex(e => getEdgeKey(e) === edgeKey);
          if (index >= 0) {
            effectiveDef.edges[index] = { ...contextEdge };
            effectiveDef.meta.provenance.edgeIdx[edgeKey] = 'contextual';
          }
        } else {
          // Añadir nuevo edge contextual
          effectiveDef.edges.push({ ...contextEdge });
          effectiveDef.meta.provenance.edgeIdx[edgeKey] = 'contextual';
        }
      }

      // Si el contexto tiene entry_node_id, usarlo (contextual gana)
      if (normalizedContext.entry_node_id) {
        effectiveDef.entry_node_id = normalizedContext.entry_node_id;
      }

      // Conservar meta base y añadir provenance
      effectiveDef.meta = {
        ...effectiveDef.meta,
        ...(normalizedContext.meta || {}),
        provenance: effectiveDef.meta.provenance
      };
    } else {
      logWarn('navigation-effective-resolver', 'contextKey no encontrado en contextualNavigations', {
        context_key: contextKey,
        available_keys: contextualNavigations.map(ctx => ctx.context_key)
      });
    }
  } else {
    logInfo('navigation-effective-resolver', 'no contextKey provided, using base only');
  }

  // Normalizar resultado final
  try {
    const finalEffective = normalizeNavigationDefinition(effectiveDef);
    logInfo('navigation-effective-resolver', 'resolved ok', {
      navigation_id: finalEffective.navigation_id,
      nodes_count: Object.keys(finalEffective.nodes || {}).length,
      edges_count: (finalEffective.edges || []).length,
      entry_node_id: finalEffective.entry_node_id
    });
    return finalEffective;
  } catch (error) {
    logError('navigation-effective-resolver', 'Error normalizando navegación efectiva final', {
      error: error.message,
      stack: error.stack
    });
    // Retornar lo que tengamos (fail-open)
    return effectiveDef;
  }
}

/**
 * Genera una clave única para un edge (para tracking)
 * @param {EdgeDefinition} edge - Edge a procesar
 * @returns {string} Clave única del edge
 */
function getEdgeKey(edge) {
  return `${edge.from}:${edge.to}:${edge.kind || 'child'}`;
}



