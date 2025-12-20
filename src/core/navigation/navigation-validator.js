// src/core/navigation/navigation-validator.js
// Validador de contrato NavigationDefinition v1
//
// PRINCIPIO: Validar el manifiesto de navegación ANTES de servirlo.
// Si la validación falla → log error y fallback a navegación vacía segura.

import { logError, logWarn } from '../observability/logger.js';

/**
 * Tipos de NavItem permitidos
 * @constant {string[]}
 */
const VALID_ITEM_TYPES = [
  'internal_route',      // Ruta interna del portal (ej: /practicar)
  'internal_recorrido',  // Recorrido interno (slug del recorrido)
  'external_link',       // Link externo (URL absoluta)
  'action'               // Acción especial (ej: logout)
];

/**
 * Tipos de reglas de visibilidad permitidos
 * @constant {string[]}
 */
const VALID_RULE_TYPES = [
  'user_level',       // Nivel del usuario (>=, <=, ==, >, <)
  'practiced_today',  // Si practicó hoy (boolean)
  'active_runs',      // Recorridos activos (>=, <=, ==, >, <)
  'feature_flag',     // Feature flag habilitado (flag_name)
  'role'              // Rol del usuario (role)
];

/**
 * Operadores válidos para reglas numéricas
 * @constant {string[]}
 */
const VALID_OPERATORS = ['>=', '<=', '==', '>', '<', '!='];

/**
 * Resultado de validación
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Si el manifiesto es válido
 * @property {string[]} errors - Lista de errores encontrados
 * @property {string[]} warnings - Lista de advertencias
 */

/**
 * Valida una URL absoluta
 * @param {string} url - URL a validar
 * @returns {boolean} true si es una URL absoluta válida
 */
function isValidAbsoluteUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Valida el formato de un target de recorrido interno
 * Solo valida formato (slug válido), no ejecuta ni verifica existencia
 * @param {string} target - Target del recorrido (slug)
 * @returns {boolean} true si el formato es válido
 */
function isValidRecorridoSlug(target) {
  // Slug válido: letras minúsculas, números y guiones
  // Mínimo 1 caracter, máximo 100
  const slugRegex = /^[a-z0-9][a-z0-9-]{0,98}[a-z0-9]$|^[a-z0-9]$/;
  return typeof target === 'string' && slugRegex.test(target);
}

/**
 * Valida una regla de visibilidad individual
 * @param {Object} rule - Regla a validar
 * @param {string} context - Contexto para mensajes de error
 * @returns {string[]} Lista de errores encontrados
 */
function validateVisibilityRule(rule, context) {
  const errors = [];

  if (!rule || typeof rule !== 'object') {
    errors.push(`${context}: regla no es un objeto válido`);
    return errors;
  }

  // Validar rule_type
  if (!rule.rule_type) {
    errors.push(`${context}: falta rule_type`);
    return errors;
  }

  if (!VALID_RULE_TYPES.includes(rule.rule_type)) {
    errors.push(`${context}: rule_type '${rule.rule_type}' no es válido. Permitidos: ${VALID_RULE_TYPES.join(', ')}`);
    return errors;
  }

  // Validar según el tipo de regla
  switch (rule.rule_type) {
    case 'user_level':
    case 'active_runs':
      // Requiere operator y value numérico
      if (!rule.operator) {
        errors.push(`${context}: falta operator para rule_type '${rule.rule_type}'`);
      } else if (!VALID_OPERATORS.includes(rule.operator)) {
        errors.push(`${context}: operator '${rule.operator}' no es válido. Permitidos: ${VALID_OPERATORS.join(', ')}`);
      }
      if (typeof rule.value !== 'number') {
        errors.push(`${context}: value debe ser numérico para rule_type '${rule.rule_type}'`);
      }
      break;

    case 'practiced_today':
      // Requiere value boolean
      if (typeof rule.value !== 'boolean') {
        errors.push(`${context}: value debe ser boolean para rule_type 'practiced_today'`);
      }
      break;

    case 'feature_flag':
      // Requiere flag_name string
      if (!rule.flag_name || typeof rule.flag_name !== 'string') {
        errors.push(`${context}: falta flag_name (string) para rule_type 'feature_flag'`);
      }
      break;

    case 'role':
      // Requiere role string
      if (!rule.role || typeof rule.role !== 'string') {
        errors.push(`${context}: falta role (string) para rule_type 'role'`);
      }
      break;
  }

  // negate es opcional, pero si existe debe ser boolean
  if (rule.negate !== undefined && typeof rule.negate !== 'boolean') {
    errors.push(`${context}: negate debe ser boolean si está presente`);
  }

  return errors;
}

/**
 * Valida un NavItem individual
 * @param {Object} item - Item a validar
 * @param {string} sectionId - ID de la sección padre
 * @param {Set<string>} seenItemIds - IDs de items ya vistos
 * @returns {string[]} Lista de errores encontrados
 */
function validateNavItem(item, sectionId, seenItemIds) {
  const errors = [];
  const context = `section '${sectionId}'`;

  if (!item || typeof item !== 'object') {
    errors.push(`${context}: item no es un objeto válido`);
    return errors;
  }

  // Validar item_id
  if (!item.item_id || typeof item.item_id !== 'string') {
    errors.push(`${context}: item sin item_id válido`);
    return errors;
  }

  const itemContext = `item '${item.item_id}' en ${context}`;

  // Validar unicidad de item_id
  if (seenItemIds.has(item.item_id)) {
    errors.push(`${itemContext}: item_id duplicado en el manifiesto`);
  }
  seenItemIds.add(item.item_id);

  // Validar type
  if (!item.type) {
    errors.push(`${itemContext}: falta type`);
  } else if (!VALID_ITEM_TYPES.includes(item.type)) {
    errors.push(`${itemContext}: type '${item.type}' no es válido. Permitidos: ${VALID_ITEM_TYPES.join(', ')}`);
  }

  // Validar label
  if (!item.label || typeof item.label !== 'string') {
    errors.push(`${itemContext}: falta label (string)`);
  }

  // Validar target según type
  if (item.type === 'external_link') {
    if (!item.target || !isValidAbsoluteUrl(item.target)) {
      errors.push(`${itemContext}: external_link requiere target con URL absoluta válida (http/https)`);
    }
  } else if (item.type === 'internal_recorrido') {
    if (!item.target || !isValidRecorridoSlug(item.target)) {
      errors.push(`${itemContext}: internal_recorrido requiere target con formato slug válido`);
    }
  } else if (item.type === 'internal_route') {
    if (!item.target || typeof item.target !== 'string' || !item.target.startsWith('/')) {
      errors.push(`${itemContext}: internal_route requiere target que empiece con '/'`);
    }
  } else if (item.type === 'action') {
    if (!item.target || typeof item.target !== 'string') {
      errors.push(`${itemContext}: action requiere target (string)`);
    }
  }

  // Validar order
  if (typeof item.order !== 'number' || item.order < 0) {
    errors.push(`${itemContext}: order debe ser un número >= 0`);
  }

  // Validar visibility_rules (puede ser vacío)
  if (item.visibility_rules) {
    if (!Array.isArray(item.visibility_rules)) {
      errors.push(`${itemContext}: visibility_rules debe ser un array`);
    } else {
      item.visibility_rules.forEach((rule, idx) => {
        const ruleErrors = validateVisibilityRule(rule, `${itemContext}, regla[${idx}]`);
        errors.push(...ruleErrors);
      });
    }
  }

  return errors;
}

/**
 * Valida una sección completa
 * @param {Object} section - Sección a validar
 * @param {Set<string>} seenSectionIds - IDs de secciones ya vistas
 * @param {Set<string>} seenItemIds - IDs de items ya vistos (global)
 * @returns {string[]} Lista de errores encontrados
 */
function validateSection(section, seenSectionIds, seenItemIds) {
  const errors = [];

  if (!section || typeof section !== 'object') {
    errors.push('section no es un objeto válido');
    return errors;
  }

  // Validar section_id
  if (!section.section_id || typeof section.section_id !== 'string') {
    errors.push('section sin section_id válido');
    return errors;
  }

  const context = `section '${section.section_id}'`;

  // Validar unicidad de section_id
  if (seenSectionIds.has(section.section_id)) {
    errors.push(`${context}: section_id duplicado`);
  }
  seenSectionIds.add(section.section_id);

  // Validar label
  if (!section.label || typeof section.label !== 'string') {
    errors.push(`${context}: falta label (string)`);
  }

  // Validar order
  if (typeof section.order !== 'number' || section.order < 0) {
    errors.push(`${context}: order debe ser un número >= 0`);
  }

  // Validar visibility_rules de sección (puede ser vacío)
  if (section.visibility_rules) {
    if (!Array.isArray(section.visibility_rules)) {
      errors.push(`${context}: visibility_rules debe ser un array`);
    } else {
      section.visibility_rules.forEach((rule, idx) => {
        const ruleErrors = validateVisibilityRule(rule, `${context}, regla[${idx}]`);
        errors.push(...ruleErrors);
      });
    }
  }

  // Validar items
  if (!section.items || !Array.isArray(section.items)) {
    errors.push(`${context}: items debe ser un array`);
  } else {
    section.items.forEach(item => {
      const itemErrors = validateNavItem(item, section.section_id, seenItemIds);
      errors.push(...itemErrors);
    });
  }

  return errors;
}

/**
 * Valida un NavigationDefinition completo
 * 
 * Verifica:
 * - id, version, status existen
 * - section_id únicos
 * - item_id únicos dentro del manifiesto
 * - types válidos de NavItem
 * - visibility_rules con rule_type permitido
 * - targets de internal_recorrido con formato slug válido
 * - external_link con URL absoluta
 * 
 * @param {Object} manifest - NavigationDefinition a validar
 * @returns {ValidationResult} Resultado de la validación
 */
export function validateNavigationDefinition(manifest) {
  const errors = [];
  const warnings = [];

  // Validar estructura base
  if (!manifest || typeof manifest !== 'object') {
    return {
      valid: false,
      errors: ['El manifiesto no es un objeto válido'],
      warnings: []
    };
  }

  // Validar campos obligatorios del manifiesto
  if (!manifest.id || typeof manifest.id !== 'string') {
    errors.push('Falta id (string) en el manifiesto');
  }

  if (!manifest.version || typeof manifest.version !== 'string') {
    errors.push('Falta version (string) en el manifiesto');
  }

  if (!manifest.status || typeof manifest.status !== 'string') {
    errors.push('Falta status (string) en el manifiesto');
  } else if (!['draft', 'published', 'archived'].includes(manifest.status)) {
    warnings.push(`status '${manifest.status}' no es un valor estándar (draft, published, archived)`);
  }

  // Validar sections
  if (!manifest.sections || !Array.isArray(manifest.sections)) {
    errors.push('Falta sections (array) en el manifiesto');
  } else {
    const seenSectionIds = new Set();
    const seenItemIds = new Set();

    manifest.sections.forEach(section => {
      const sectionErrors = validateSection(section, seenSectionIds, seenItemIds);
      errors.push(...sectionErrors);
    });
  }

  // Validar metadata (opcional pero recomendado)
  if (!manifest.metadata) {
    warnings.push('Se recomienda incluir metadata con created_at y updated_at');
  }

  const valid = errors.length === 0;

  // Log si hay errores
  if (!valid) {
    logError('navigation-validator', 'Validación de NavigationDefinition fallida', {
      manifest_id: manifest.id || 'unknown',
      errors_count: errors.length,
      errors: errors.slice(0, 10) // Limitar a 10 errores en el log
    });
  } else if (warnings.length > 0) {
    logWarn('navigation-validator', 'NavigationDefinition válido con advertencias', {
      manifest_id: manifest.id,
      warnings_count: warnings.length,
      warnings
    });
  }

  return {
    valid,
    errors,
    warnings
  };
}

/**
 * NavigationDefinition vacía segura (fallback)
 * Se usa cuando la validación falla o hay errores de carga
 * @constant {Object}
 */
export const EMPTY_NAVIGATION = {
  id: 'empty-fallback',
  version: '0.0.0',
  status: 'published',
  metadata: {
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    description: 'Navegación vacía de fallback'
  },
  sections: []
};

/**
 * Valida y retorna el manifiesto o fallback vacío
 * 
 * Uso:
 *   const nav = validateAndGetNavigation(rawManifest);
 *   // nav siempre es válido (manifiesto o EMPTY_NAVIGATION)
 * 
 * @param {Object} manifest - NavigationDefinition a validar
 * @returns {Object} Manifiesto validado o EMPTY_NAVIGATION si falla
 */
export function validateAndGetNavigation(manifest) {
  const result = validateNavigationDefinition(manifest);
  
  if (result.valid) {
    return manifest;
  }
  
  logError('navigation-validator', 'Usando navegación vacía de fallback', {
    reason: 'validation_failed',
    original_id: manifest?.id || 'unknown',
    errors: result.errors.slice(0, 5)
  });
  
  return EMPTY_NAVIGATION;
}







