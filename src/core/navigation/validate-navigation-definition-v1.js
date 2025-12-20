// src/core/navigation/validate-navigation-definition-v1.js
// Validador de NavigationDefinition v1 (draft/publish)
//
// PRINCIPIOS:
// - Dos modos: draft (tolerante) y publish (estricto)
// - Errores bloquean publish, warnings no
// - Normalización incluida en el resultado
// - No contiene lógica runtime
//
// ERRORES (bloquean publish):
// - navigation_id vacío o inválido
// - entry_node_id no existe
// - nodes vacío
// - IDs duplicados / node.id no coincide con key
// - edge from/to no existe
// - nodos inalcanzables desde entry (huérfanos) => error (v1 strict)
// - target inválido para nodos que lo requieren
// - tamaño máximo excedido
//
// WARNINGS (no bloquean publish):
// - ciclos detectados (permitidos v1)
// - edges duplicados (normalizados)
// - order faltante
// - layout_hint faltante

import { logInfo, logWarn, logError } from '../observability/logger.js';
import {
  NODE_KINDS,
  TARGET_TYPES,
  EDGE_KINDS,
  LAYOUT_HINTS,
  NODES_REQUIRING_TARGET,
  VALIDATION_LIMITS,
  isValidId,
  isValidRecorridoSlug,
  isValidAbsoluteUrl,
} from './navigation-constants.js';
import {
  normalizeNavigationDefinition,
  getReachableNodes,
  detectCycles,
  nodeRequiresTarget,
} from './navigation-definition-v1.js';

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} ok - true si la validación es exitosa
 * @property {string[]} errors - Lista de errores (bloquean publish)
 * @property {string[]} warnings - Lista de warnings (no bloquean)
 * @property {Object} normalizedDef - Definición normalizada (si ok)
 */

/**
 * Valida una NavigationDefinition en modo draft (tolerante)
 * Permite más errores, devuelve warnings en lugar de errores
 * @param {Object} def - NavigationDefinition a validar
 * @returns {ValidationResult} Resultado de la validación
 */
export function validateNavigationDraft(def) {
  return validateNavigationDefinition(def, { isPublish: false });
}

/**
 * Valida una NavigationDefinition en modo publish (estricto)
 * Bloquea si hay errores, devuelve warnings como informativos
 * @param {Object} def - NavigationDefinition a validar
 * @returns {ValidationResult} Resultado de la validación
 */
export function validateNavigationPublish(def) {
  return validateNavigationDefinition(def, { isPublish: true });
}

/**
 * Valida una NavigationDefinition completa
 * @param {Object} def - NavigationDefinition a validar
 * @param {Object} options - Opciones de validación
 * @param {boolean} options.isPublish - Si es true, modo estricto (publish)
 * @returns {ValidationResult} Resultado de la validación
 */
export function validateNavigationDefinition(def, options = {}) {
  const { isPublish = false } = options;
  const errors = [];
  const warnings = [];

  // ========================================================================
  // 1. VALIDACIÓN DE ESTRUCTURA BASE
  // ========================================================================
  
  if (!def || typeof def !== 'object') {
    errors.push('NavigationDefinition debe ser un objeto');
    return {
      ok: false,
      errors,
      warnings,
      normalizedDef: null,
    };
  }

  // Validar navigation_id
  if (!def.navigation_id) {
    errors.push('navigation_id es requerido');
  } else if (typeof def.navigation_id !== 'string') {
    errors.push('navigation_id debe ser un string');
  } else if (!isValidId(def.navigation_id)) {
    errors.push(`navigation_id "${def.navigation_id}" tiene formato inválido (use letras minúsculas, números, guiones y guiones bajos)`);
  }

  // Validar name (opcional pero recomendado)
  if (!def.name) {
    warnings.push('name no está definido (recomendado)');
  } else if (typeof def.name !== 'string') {
    errors.push('name debe ser un string');
  } else if (def.name.length > VALIDATION_LIMITS.MAX_LABEL_LENGTH) {
    errors.push(`name excede el límite de ${VALIDATION_LIMITS.MAX_LABEL_LENGTH} caracteres`);
  }

  // Validar description (opcional)
  if (def.description) {
    if (typeof def.description !== 'string') {
      errors.push('description debe ser un string');
    } else if (def.description.length > VALIDATION_LIMITS.MAX_DESCRIPTION_LENGTH) {
      warnings.push(`description excede el límite recomendado de ${VALIDATION_LIMITS.MAX_DESCRIPTION_LENGTH} caracteres`);
    }
  }

  // Validar nodes
  if (!def.nodes) {
    errors.push('nodes es requerido');
  } else if (typeof def.nodes !== 'object' || Array.isArray(def.nodes)) {
    errors.push('nodes debe ser un objeto (mapa de nodos por ID)');
  } else if (Object.keys(def.nodes).length === 0) {
    errors.push('nodes no puede estar vacío');
  } else if (Object.keys(def.nodes).length > VALIDATION_LIMITS.MAX_NODES) {
    errors.push(`nodes excede el límite de ${VALIDATION_LIMITS.MAX_NODES} nodos`);
  }

  // Validar entry_node_id
  if (!def.entry_node_id) {
    errors.push('entry_node_id es requerido');
  } else if (typeof def.entry_node_id !== 'string') {
    errors.push('entry_node_id debe ser un string');
  } else if (def.nodes && !def.nodes[def.entry_node_id]) {
    errors.push(`entry_node_id "${def.entry_node_id}" no existe en nodes`);
  }

  // Si hay errores críticos de estructura, retornar temprano
  if (errors.length > 0 && isPublish) {
    return {
      ok: false,
      errors,
      warnings,
      normalizedDef: null,
    };
  }

  // ========================================================================
  // 2. VALIDACIÓN DE NODOS
  // ========================================================================
  
  const nodes = def.nodes || {};
  const seenNodeIds = new Set();

  for (const [nodeId, node] of Object.entries(nodes)) {
    const nodeContext = `node "${nodeId}"`;

    // Validar que node sea un objeto
    if (!node || typeof node !== 'object') {
      errors.push(`${nodeContext}: debe ser un objeto`);
      continue;
    }

    // Validar formato del nodeId (key del mapa)
    if (!isValidId(nodeId)) {
      errors.push(`${nodeContext}: ID tiene formato inválido`);
    }

    // Validar que node.id coincida con la key (si existe)
    if (node.id && node.id !== nodeId) {
      if (isPublish) {
        errors.push(`${nodeContext}: node.id "${node.id}" no coincide con la key "${nodeId}"`);
      } else {
        warnings.push(`${nodeContext}: node.id "${node.id}" no coincide con la key "${nodeId}" (se normalizará)`);
      }
    }

    // Validar unicidad
    if (seenNodeIds.has(nodeId)) {
      errors.push(`${nodeContext}: ID duplicado`);
    }
    seenNodeIds.add(nodeId);

    // Validar kind
    if (!node.kind) {
      if (isPublish) {
        errors.push(`${nodeContext}: kind es requerido`);
      } else {
        warnings.push(`${nodeContext}: kind no definido (se usará default)`);
      }
    } else if (!NODE_KINDS.includes(node.kind)) {
      errors.push(`${nodeContext}: kind "${node.kind}" no es válido. Permitidos: ${NODE_KINDS.join(', ')}`);
    }

    // Validar label
    if (!node.label) {
      if (isPublish) {
        errors.push(`${nodeContext}: label es requerido`);
      } else {
        warnings.push(`${nodeContext}: label no definido`);
      }
    } else if (typeof node.label !== 'string') {
      errors.push(`${nodeContext}: label debe ser un string`);
    } else if (node.label.length > VALIDATION_LIMITS.MAX_LABEL_LENGTH) {
      warnings.push(`${nodeContext}: label excede el límite recomendado`);
    }

    // Validar subtitle (opcional)
    if (node.subtitle) {
      if (typeof node.subtitle !== 'string') {
        errors.push(`${nodeContext}: subtitle debe ser un string`);
      } else if (node.subtitle.length > VALIDATION_LIMITS.MAX_SUBTITLE_LENGTH) {
        warnings.push(`${nodeContext}: subtitle excede el límite recomendado`);
      }
    }

    // Validar order (opcional pero recomendado)
    if (node.order !== undefined && node.order !== null) {
      if (typeof node.order !== 'number') {
        errors.push(`${nodeContext}: order debe ser un número`);
      } else if (node.order < 0) {
        warnings.push(`${nodeContext}: order negativo (no recomendado)`);
      }
    } else {
      warnings.push(`${nodeContext}: order no definido (se usará auto-orden)`);
    }

    // Validar layout_hint (opcional)
    if (node.layout_hint) {
      if (!LAYOUT_HINTS.includes(node.layout_hint)) {
        warnings.push(`${nodeContext}: layout_hint "${node.layout_hint}" no es estándar. Permitidos: ${LAYOUT_HINTS.join(', ')}`);
      }
    } else {
      // No es necesario warning para layout_hint faltante
    }

    // Validar visibility (opcional)
    if (node.visibility) {
      const visErrors = validateVisibility(node.visibility, nodeContext);
      errors.push(...visErrors.errors);
      warnings.push(...visErrors.warnings);
    }

    // Validar target (requerido para ciertos kinds)
    const kind = node.kind || 'item';
    if (nodeRequiresTarget(kind)) {
      if (!node.target) {
        if (isPublish) {
          errors.push(`${nodeContext}: target es requerido para kind "${kind}"`);
        } else {
          warnings.push(`${nodeContext}: target no definido (requerido para kind "${kind}")`);
        }
      } else {
        const targetErrors = validateTarget(node.target, nodeContext, kind);
        errors.push(...targetErrors.errors);
        warnings.push(...targetErrors.warnings);
      }
    }

    // Validar children (si existen, serán normalizados a edges)
    if (node.children) {
      if (!Array.isArray(node.children)) {
        errors.push(`${nodeContext}: children debe ser un array`);
      } else {
        for (const childId of node.children) {
          if (!nodes[childId]) {
            errors.push(`${nodeContext}: children contiene ID "${childId}" que no existe en nodes`);
          }
        }
      }
    }
  }

  // ========================================================================
  // 3. VALIDACIÓN DE EDGES
  // ========================================================================
  
  const edges = def.edges || [];
  
  if (edges.length > VALIDATION_LIMITS.MAX_EDGES) {
    errors.push(`edges excede el límite de ${VALIDATION_LIMITS.MAX_EDGES}`);
  }

  const seenEdges = new Set();

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const edgeContext = `edge[${i}]`;

    if (!edge || typeof edge !== 'object') {
      errors.push(`${edgeContext}: debe ser un objeto`);
      continue;
    }

    // Validar from
    if (!edge.from) {
      errors.push(`${edgeContext}: from es requerido`);
    } else if (!nodes[edge.from]) {
      errors.push(`${edgeContext}: from "${edge.from}" no existe en nodes`);
    }

    // Validar to
    if (!edge.to) {
      errors.push(`${edgeContext}: to es requerido`);
    } else if (!nodes[edge.to]) {
      errors.push(`${edgeContext}: to "${edge.to}" no existe en nodes`);
    }

    // Validar kind (opcional)
    if (edge.kind && !EDGE_KINDS.includes(edge.kind)) {
      warnings.push(`${edgeContext}: kind "${edge.kind}" no es estándar. Permitidos: ${EDGE_KINDS.join(', ')}`);
    }

    // Detectar duplicados
    const edgeKey = `${edge.from}:${edge.to}:${edge.kind || 'child'}`;
    if (seenEdges.has(edgeKey)) {
      warnings.push(`${edgeContext}: edge duplicado (será deduplicado en normalización)`);
    }
    seenEdges.add(edgeKey);
  }

  // ========================================================================
  // 4. VALIDACIÓN DE GRAFO (nodos huérfanos, ciclos)
  // ========================================================================
  
  // Normalizar para análisis de grafo
  let normalizedDef = null;
  try {
    normalizedDef = normalizeNavigationDefinition(def);
  } catch (err) {
    errors.push(`Error normalizando definición: ${err.message}`);
    return {
      ok: false,
      errors,
      warnings,
      normalizedDef: null,
    };
  }

  // Solo verificar huérfanos si tenemos entry_node_id válido
  if (def.entry_node_id && nodes[def.entry_node_id]) {
    const reachable = getReachableNodes(normalizedDef, def.entry_node_id);
    const allNodeIds = Object.keys(nodes);
    const orphans = allNodeIds.filter(id => !reachable.has(id));

    if (orphans.length > 0) {
      if (isPublish) {
        // En publish, los huérfanos son error
        errors.push(`Nodos huérfanos (inalcanzables desde entry_node_id): ${orphans.join(', ')}`);
      } else {
        // En draft, los huérfanos son warning
        warnings.push(`Nodos huérfanos detectados (no alcanzables desde entry_node_id): ${orphans.join(', ')}`);
      }
    }
  }

  // Detectar ciclos (warning en v1, permitidos pero informados)
  const cycles = detectCycles(normalizedDef);
  if (cycles.length > 0) {
    const cycleStrs = cycles.map(c => c.join(' → '));
    warnings.push(`Ciclos detectados en el grafo: ${cycleStrs.join('; ')}`);
  }

  // ========================================================================
  // 5. RESULTADO
  // ========================================================================
  
  const ok = errors.length === 0;

  // Logging
  if (!ok) {
    logWarn('NavigationValidator', `Validación fallida: ${errors.length} errores`, {
      navigation_id: def.navigation_id,
      errors_count: errors.length,
      warnings_count: warnings.length,
      is_publish: isPublish,
    });
  } else if (warnings.length > 0) {
    logInfo('NavigationValidator', `Validación exitosa con ${warnings.length} warnings`, {
      navigation_id: def.navigation_id,
      warnings_count: warnings.length,
      is_publish: isPublish,
    }, true);
  } else {
    logInfo('NavigationValidator', 'Validación exitosa', {
      navigation_id: def.navigation_id,
      is_publish: isPublish,
    }, true);
  }

  return {
    ok,
    errors,
    warnings,
    normalizedDef: ok ? normalizedDef : null,
  };
}

/**
 * Valida configuración de visibilidad
 * @param {Object} visibility - Configuración de visibilidad
 * @param {string} context - Contexto para mensajes de error
 * @returns {{errors: string[], warnings: string[]}}
 */
function validateVisibility(visibility, context) {
  const errors = [];
  const warnings = [];

  if (typeof visibility !== 'object') {
    errors.push(`${context}.visibility: debe ser un objeto`);
    return { errors, warnings };
  }

  // Validar min_nivel_efectivo (opcional)
  if (visibility.min_nivel_efectivo !== undefined) {
    if (typeof visibility.min_nivel_efectivo !== 'number') {
      errors.push(`${context}.visibility.min_nivel_efectivo: debe ser un número`);
    } else if (visibility.min_nivel_efectivo < 0) {
      warnings.push(`${context}.visibility.min_nivel_efectivo: valor negativo no recomendado`);
    }
  }

  // Validar feature_flag (opcional)
  if (visibility.feature_flag !== undefined) {
    if (typeof visibility.feature_flag !== 'string') {
      errors.push(`${context}.visibility.feature_flag: debe ser un string`);
    } else if (!visibility.feature_flag.trim()) {
      errors.push(`${context}.visibility.feature_flag: no puede estar vacío`);
    }
  }

  // Validar requires (opcional)
  if (visibility.requires !== undefined) {
    if (!Array.isArray(visibility.requires)) {
      errors.push(`${context}.visibility.requires: debe ser un array`);
    } else {
      for (let i = 0; i < visibility.requires.length; i++) {
        if (typeof visibility.requires[i] !== 'string') {
          errors.push(`${context}.visibility.requires[${i}]: debe ser un string`);
        }
      }
    }
  }

  return { errors, warnings };
}

/**
 * Valida configuración de target
 * @param {Object} target - Configuración de target
 * @param {string} context - Contexto para mensajes de error
 * @param {string} nodeKind - Tipo del nodo (para validaciones específicas)
 * @returns {{errors: string[], warnings: string[]}}
 */
function validateTarget(target, context, nodeKind) {
  const errors = [];
  const warnings = [];

  if (typeof target !== 'object') {
    errors.push(`${context}.target: debe ser un objeto`);
    return { errors, warnings };
  }

  // Validar type
  if (!target.type) {
    errors.push(`${context}.target.type: es requerido`);
  } else if (!TARGET_TYPES.includes(target.type)) {
    errors.push(`${context}.target.type: "${target.type}" no es válido. Permitidos: ${TARGET_TYPES.join(', ')}`);
  }

  // Validar ref
  if (!target.ref) {
    errors.push(`${context}.target.ref: es requerido`);
  } else if (typeof target.ref !== 'string') {
    errors.push(`${context}.target.ref: debe ser un string`);
  } else if (!target.ref.trim()) {
    errors.push(`${context}.target.ref: no puede estar vacío`);
  } else {
    // Validaciones específicas según type
    switch (target.type) {
      case 'recorrido':
        if (!isValidRecorridoSlug(target.ref)) {
          warnings.push(`${context}.target.ref: "${target.ref}" no parece un slug de recorrido válido`);
        }
        break;
      
      case 'url':
        if (!isValidAbsoluteUrl(target.ref)) {
          errors.push(`${context}.target.ref: "${target.ref}" no es una URL absoluta válida (http/https)`);
        }
        break;
      
      case 'screen':
        if (!target.ref.startsWith('/')) {
          warnings.push(`${context}.target.ref: rutas de pantalla deberían empezar con '/'`);
        }
        break;
      
      // pde_catalog y admin_tool no tienen validación de formato específica
    }

    // Validar longitud
    if (target.ref.length > VALIDATION_LIMITS.MAX_REF_LENGTH) {
      warnings.push(`${context}.target.ref: excede el límite recomendado de ${VALIDATION_LIMITS.MAX_REF_LENGTH} caracteres`);
    }
  }

  // Validar params (opcional)
  if (target.params !== undefined) {
    if (typeof target.params !== 'object' || Array.isArray(target.params)) {
      errors.push(`${context}.target.params: debe ser un objeto`);
    }
  }

  // Validación específica para external_link
  if (nodeKind === 'external_link' && target.type !== 'url') {
    warnings.push(`${context}: kind "external_link" debería tener target.type "url"`);
  }

  return { errors, warnings };
}

// Exports adicionales para testing
export { validateVisibility, validateTarget };








