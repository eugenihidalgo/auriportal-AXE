// src/core/feature-flags/feature-flag-registry.js
// Registry Canónico de Feature Flags - AuriPortal
//
// PROPÓSITO:
// Fuente de verdad única para todas las definiciones de feature flags.
// Este registry define qué flags existen, sus propiedades y defaults.
//
// REGLAS:
// - Todo flag DEBE estar registrado aquí
// - La UI NO puede crear flags nuevos
// - PostgreSQL es el Source of Truth del estado (enabled/disabled)
// - Este registry es el Source of Truth de la definición (metadata)
//
// TIPOS:
// - 'ui': Flags que controlan visibilidad de UI
// - 'runtime': Flags que controlan ejecución de lógica en runtime
// - 'phase': Flags que marcan fases de desarrollo/rollout
//
// SCOPES:
// - 'admin': Flags visibles/controlables desde Admin UI
// - 'system': Flags solo controlables desde código/config

/**
 * Registry Canónico de Feature Flags
 * 
 * Estructura de cada flag:
 * {
 *   key: string,                // Clave única del flag (ej: 'admin.automations.ui')
 *   description: string,         // Descripción del propósito del flag
 *   type: 'ui' | 'runtime' | 'phase',  // Tipo de flag
 *   scope: 'admin' | 'system',  // Scope de control
 *   default: boolean,            // Valor por defecto (si no existe en BD)
 *   irreversible: boolean        // Si true, no se puede resetear a default
 * }
 */
export const FEATURE_FLAG_REGISTRY = [
  // ============================================================================
  // FLAGS DE UI ADMIN
  // ============================================================================
  
  {
    key: 'admin.feature_flags.ui',
    description: 'Controla la visibilidad de la UI de gestión de Feature Flags en el Admin',
    type: 'ui',
    scope: 'admin',
    default: false,
    irreversible: false
  },
  
  {
    key: 'admin.automations.ui',
    description: 'Controla la visibilidad de la UI de Automatizaciones en el Admin',
    type: 'ui',
    scope: 'admin',
    default: true,
    irreversible: false
  },
  
  {
    key: 'admin.automations.execution',
    description: 'Controla la visibilidad de botones de ejecución manual de automatizaciones',
    type: 'ui',
    scope: 'admin',
    default: false,
    irreversible: false
  },
  
  // ============================================================================
  // FLAGS DE RUNTIME
  // ============================================================================
  
  {
    key: 'engine.automations.enabled',
    description: 'Controla si el Automation Engine v2 ejecuta automatizaciones activas',
    type: 'runtime',
    scope: 'system',
    default: false,
    irreversible: false
  },
  
  // ============================================================================
  // FLAGS DE FASE
  // ============================================================================
  
  {
    key: 'phase.D7.execution',
    description: 'Marca la fase D.7 (Ejecución Manual Gobernada) como activa',
    type: 'phase',
    scope: 'admin',
    default: true,
    irreversible: false
  }
];

/**
 * Obtiene la definición de un flag por su clave
 * @param {string} flagKey - Clave del flag
 * @returns {Object|null} Definición del flag o null si no existe
 */
export function getFlagDefinition(flagKey) {
  return FEATURE_FLAG_REGISTRY.find(flag => flag.key === flagKey) || null;
}

/**
 * Verifica si un flag existe en el registry
 * @param {string} flagKey - Clave del flag
 * @returns {boolean} true si existe, false si no
 */
export function flagExists(flagKey) {
  return FEATURE_FLAG_REGISTRY.some(flag => flag.key === flagKey);
}

/**
 * Obtiene todos los flags del registry
 * @returns {Array} Array de definiciones de flags
 */
export function getAllFlagDefinitions() {
  return [...FEATURE_FLAG_REGISTRY];
}

/**
 * Obtiene flags filtrados por tipo
 * @param {string} type - Tipo de flag ('ui' | 'runtime' | 'phase')
 * @returns {Array} Array de definiciones de flags del tipo especificado
 */
export function getFlagsByType(type) {
  return FEATURE_FLAG_REGISTRY.filter(flag => flag.type === type);
}

/**
 * Obtiene flags filtrados por scope
 * @param {string} scope - Scope de flag ('admin' | 'system')
 * @returns {Array} Array de definiciones de flags del scope especificado
 */
export function getFlagsByScope(scope) {
  return FEATURE_FLAG_REGISTRY.filter(flag => flag.scope === scope);
}





