// src/core/navigation/navigation-constants.js
// Constantes para el sistema de Navegación v1
//
// PRINCIPIOS:
// - Todas las constantes de navegación centralizadas aquí
// - Tipos válidos de nodos, targets, layouts, etc.
// - Límites de validación para evitar bombas
// - No contiene lógica runtime (solo declarativo)

/**
 * Tipos de nodos permitidos en NavigationDefinition v1
 * @constant {string[]}
 */
export const NODE_KINDS = [
  'section',        // Sección contenedora (puede tener hijos)
  'group',          // Grupo de items (puede tener hijos)
  'item',           // Item navegable (requiere target)
  'hub',            // Hub de navegación (requiere target)
  'external_link',  // Link externo (requiere target tipo url)
  'system_entry',   // Entrada del sistema (requiere target)
];

/**
 * Tipos de targets permitidos en NavigationDefinition v1
 * @constant {string[]}
 */
export const TARGET_TYPES = [
  'recorrido',      // Recorrido interno (ref = slug del recorrido)
  'pde_catalog',    // Catálogo PDE (ref = id del catálogo)
  'screen',         // Pantalla interna (ref = ruta interna)
  'url',            // URL externa (ref = URL absoluta)
  'admin_tool',     // Herramienta admin (ref = id de la herramienta)
];

/**
 * Tipos de edges permitidos en NavigationDefinition v1
 * @constant {string[]}
 */
export const EDGE_KINDS = [
  'child',  // Relación padre-hijo (por defecto)
  'link',   // Relación de enlace (no jerárquica)
];

/**
 * Hints de layout permitidos en NodeDefinition v1
 * @constant {string[]}
 */
export const LAYOUT_HINTS = [
  'list',   // Lista vertical
  'grid',   // Grid de items
  'map',    // Mapa visual
  'cards',  // Tarjetas
  'tree',   // Árbol jerárquico
];

/**
 * Tipos de nodos que REQUIEREN target
 * @constant {string[]}
 */
export const NODES_REQUIRING_TARGET = [
  'item',
  'hub',
  'external_link',
  'system_entry',
];

/**
 * Límites de validación para evitar definiciones excesivas
 * @constant {Object}
 */
export const VALIDATION_LIMITS = {
  MAX_NODES: 2000,              // Máximo número de nodos
  MAX_EDGES: 5000,              // Máximo número de edges
  MAX_LABEL_LENGTH: 200,        // Máximo longitud de label
  MAX_SUBTITLE_LENGTH: 500,     // Máximo longitud de subtitle
  MAX_DESCRIPTION_LENGTH: 2000, // Máximo longitud de description
  MAX_ID_LENGTH: 100,           // Máximo longitud de IDs
  MAX_REF_LENGTH: 500,          // Máximo longitud de referencias
};

/**
 * Regex para validar IDs (navigation_id, node_id)
 * Formato: letras minúsculas, números, guiones y guiones bajos
 * Debe empezar con letra
 * @constant {RegExp}
 */
export const ID_PATTERN = /^[a-z][a-z0-9_-]*$/;

/**
 * Regex para validar slugs de recorrido
 * @constant {RegExp}
 */
export const RECORRIDO_SLUG_PATTERN = /^[a-z][a-z0-9-]*$/;

/**
 * Valida si un string es un ID válido
 * @param {string} id - ID a validar
 * @returns {boolean} true si es válido
 */
export function isValidId(id) {
  if (!id || typeof id !== 'string') return false;
  if (id.length > VALIDATION_LIMITS.MAX_ID_LENGTH) return false;
  return ID_PATTERN.test(id);
}

/**
 * Valida si un string es un slug de recorrido válido
 * @param {string} slug - Slug a validar
 * @returns {boolean} true si es válido
 */
export function isValidRecorridoSlug(slug) {
  if (!slug || typeof slug !== 'string') return false;
  if (slug.length > VALIDATION_LIMITS.MAX_REF_LENGTH) return false;
  return RECORRIDO_SLUG_PATTERN.test(slug);
}

/**
 * Valida si una URL es absoluta y segura (http/https)
 * @param {string} url - URL a validar
 * @returns {boolean} true si es válida
 */
export function isValidAbsoluteUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Valores por defecto para NodeDefinition
 * @constant {Object}
 */
export const NODE_DEFAULTS = {
  kind: 'item',
  layout_hint: 'list',
  order: 0,
};

/**
 * Valores por defecto para EdgeDefinition
 * @constant {Object}
 */
export const EDGE_DEFAULTS = {
  kind: 'child',
};




