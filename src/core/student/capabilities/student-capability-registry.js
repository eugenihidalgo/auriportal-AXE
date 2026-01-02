// src/core/student/capabilities/student-capability-registry.js
// Student Capability Registry v1
//
// Define TODAS las capabilities permitidas del sistema de forma formal y versionada.
// Este registry es la única fuente de verdad para qué capabilities existen y cómo se comportan.

/**
 * @typedef {Object} CapabilityDefinition
 * @property {string} key - Clave única de la capability
 * @property {string} description - Descripción de qué permite esta capability
 * @property {boolean} default - Valor por defecto (si no hay restricciones)
 * @property {string} version - Versión de la definición (default: 'v1')
 * @property {string|null} deprecated - Versión en que fue deprecada (null si activa)
 * @property {string} category - Categoría: 'progress', 'automation', 'context', 'access', 'write', 'admin'
 */

/**
 * Registry canónico de todas las capabilities del sistema
 * 
 * REGLA: Solo se pueden usar capabilities registradas aquí.
 * Prohibido crear capabilities ad-hoc en el código.
 */
export const STUDENT_CAPABILITY_REGISTRY = {
  // ============================================
  // PROGRESS & LEVEL
  // ============================================
  can_progress: {
    key: 'can_progress',
    description: 'Permite que el alumno avance en progreso general (nivel, XP, etc.)',
    default: true,
    version: 'v1',
    deprecated: null,
    category: 'progress'
  },
  can_compute_level: {
    key: 'can_compute_level',
    description: 'Permite calcular/actualizar el nivel efectivo del alumno',
    default: true,
    version: 'v1',
    deprecated: null,
    category: 'progress'
  },

  // ============================================
  // STREAKS
  // ============================================
  can_update_streaks: {
    key: 'can_update_streaks',
    description: 'Permite actualizar rachas del alumno (avanzar o romper)',
    default: true,
    version: 'v1',
    deprecated: null,
    category: 'progress'
  },

  // ============================================
  // AUTOMATIONS
  // ============================================
  can_trigger_automations: {
    key: 'can_trigger_automations',
    description: 'Permite que las automatizaciones se ejecuten para este alumno',
    default: true,
    version: 'v1',
    deprecated: null,
    category: 'automation'
  },

  // ============================================
  // CONTEXTS
  // ============================================
  can_activate_contexts: {
    key: 'can_activate_contexts',
    description: 'Permite activar nuevos contextos PDE para este alumno',
    default: true,
    version: 'v1',
    deprecated: null,
    category: 'context'
  },
  can_run_resolvers: {
    key: 'can_run_resolvers',
    description: 'Permite ejecutar resolvers PDE para este alumno',
    default: true,
    version: 'v1',
    deprecated: null,
    category: 'context'
  },

  // ============================================
  // ACCESS
  // ============================================
  can_access_student_portal: {
    key: 'can_access_student_portal',
    description: 'Permite acceso al portal del alumno (UI cliente)',
    default: true,
    version: 'v1',
    deprecated: null,
    category: 'access'
  },

  // ============================================
  // WRITE OPERATIONS
  // ============================================
  can_write_domain_state: {
    key: 'can_write_domain_state',
    description: 'Permite que el alumno modifique su estado en dominios (activar, limpiar, etc.)',
    default: true,
    version: 'v1',
    deprecated: null,
    category: 'write'
  },

  // ============================================
  // ADMIN/MASTER
  // ============================================
  can_master_override: {
    key: 'can_master_override',
    description: 'Permite que el Master realice overrides en este alumno',
    default: true,
    version: 'v1',
    deprecated: null,
    category: 'admin'
  },

  // ============================================
  // NOTIFICATIONS
  // ============================================
  can_receive_notifications: {
    key: 'can_receive_notifications',
    description: 'Permite enviar notificaciones/comunicaciones a este alumno',
    default: true,
    version: 'v1',
    deprecated: null,
    category: 'access'
  },

  // ============================================
  // DOMAIN OPERATIONS
  // ============================================
  can_clean_domain_items: {
    key: 'can_clean_domain_items',
    description: 'Permite limpiar ítems de dominios (siempre permitido, incluso en PAUSED)',
    default: true,
    version: 'v1',
    deprecated: null,
    category: 'write'
  },
  can_activate_project: {
    key: 'can_activate_project',
    description: 'Permite activar proyectos (con enforcement de active_limit = 1)',
    default: true,
    version: 'v1',
    deprecated: null,
    category: 'write'
  },
  can_edit_project_metadata: {
    key: 'can_edit_project_metadata',
    description: 'Permite editar metadatos de proyectos (name, description)',
    default: true,
    version: 'v1',
    deprecated: null,
    category: 'write'
  }
};

/**
 * Obtiene la definición de una capability por su clave
 * 
 * @param {string} capabilityKey - Clave de la capability
 * @returns {CapabilityDefinition|null} Definición o null si no existe
 */
export function getCapabilityDefinition(capabilityKey) {
  return STUDENT_CAPABILITY_REGISTRY[capabilityKey] || null;
}

/**
 * Lista todas las capabilities activas (no deprecadas)
 * 
 * @returns {Array<CapabilityDefinition>} Array de definiciones activas
 */
export function listActiveCapabilities() {
  return Object.values(STUDENT_CAPABILITY_REGISTRY).filter(cap => !cap.deprecated);
}

/**
 * Lista capabilities por categoría
 * 
 * @param {string} category - Categoría a filtrar
 * @returns {Array<CapabilityDefinition>} Array de definiciones de la categoría
 */
export function listCapabilitiesByCategory(category) {
  return Object.values(STUDENT_CAPABILITY_REGISTRY).filter(
    cap => cap.category === category && !cap.deprecated
  );
}

/**
 * Valida que una capability existe y está activa
 * 
 * @param {string} capabilityKey - Clave de la capability
 * @returns {boolean} true si existe y está activa
 */
export function isValidCapability(capabilityKey) {
  const def = getCapabilityDefinition(capabilityKey);
  return def !== null && def.deprecated === null;
}

