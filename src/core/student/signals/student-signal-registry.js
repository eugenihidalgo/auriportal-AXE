// src/core/student/signals/student-signal-registry.js
// Student Signal Registry v1
//
// Define las señales semánticas del dominio Alumno y de Observabilidad.
// El runtime solo puede emitir señales registradas aquí.

/**
 * @typedef {Object} SignalDefinition
 * @property {string} key - Clave única de la señal
 * @property {string} description - Descripción de cuándo se emite
 * @property {string} category - Categoría: 'domain' | 'observability'
 * @property {string} version - Versión de la definición (default: 'v1')
 * @property {string|null} deprecated - Versión en que fue deprecada (null si activa)
 * @property {Object} payload - Schema esperado del payload (documentación)
 */

/**
 * Registry canónico de todas las señales del dominio Alumno
 * 
 * REGLA: Solo se pueden emitir señales registradas aquí.
 * Prohibido emitir señales ad-hoc.
 */
export const STUDENT_SIGNAL_REGISTRY = {
  // ============================================
  // DOMAIN SIGNALS (Dominio Alumno)
  // ============================================
  'student.created': {
    key: 'student.created',
    description: 'Se emite cuando se crea un nuevo registro en students (ontológico)',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      student_id: 'UUID del student',
      legacy_alumno_id: 'ID legacy (si aplica)',
      trace_id: 'ID de traza'
    }
  },
  'student.enrolled': {
    key: 'student.enrolled',
    description: 'Se emite cuando un alumno se inscribe a un producto',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      student_id: 'UUID del student',
      product_key: 'Clave del producto',
      membership_id: 'UUID de la membresía',
      trace_id: 'ID de traza'
    }
  },
  'student.operational.paused': {
    key: 'student.operational.paused',
    description: 'Se emite cuando un alumno entra en estado PAUSED',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      student_id: 'UUID del student',
      pause_profile_key: 'Clave del perfil de pausa',
      source: 'Origen (subscription, master, system)',
      reason: 'Razón de la pausa (opcional)',
      trace_id: 'ID de traza'
    }
  },
  'student.operational.resumed': {
    key: 'student.operational.resumed',
    description: 'Se emite cuando un alumno sale de PAUSED a ACTIVE',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      student_id: 'UUID del student',
      source: 'Origen (subscription, master, system)',
      trace_id: 'ID de traza'
    }
  },
  'student.domain.item.activated': {
    key: 'student.domain.item.activated',
    description: 'Se emite cuando un alumno activa un ítem en un dominio',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      student_id: 'UUID del student',
      domain_key: 'Clave del dominio',
      item_id: 'ID del ítem',
      actor_type: 'Tipo de actor (student, master, system)',
      trace_id: 'ID de traza'
    }
  },
  'student.domain.item.deactivated': {
    key: 'student.domain.item.deactivated',
    description: 'Se emite cuando un alumno desactiva un ítem en un dominio',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      student_id: 'UUID del student',
      domain_key: 'Clave del dominio',
      item_id: 'ID del ítem',
      actor_type: 'Tipo de actor',
      trace_id: 'ID de traza'
    }
  },
  'student.domain.item.cleaned': {
    key: 'student.domain.item.cleaned',
    description: 'Se emite cuando un alumno marca un ítem como limpio',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      student_id: 'UUID del student',
      domain_key: 'Clave del dominio',
      item_id: 'ID del ítem',
      clean_count: 'Número de limpiezas',
      actor_type: 'Tipo de actor',
      trace_id: 'ID de traza'
    }
  },
  'student.domain.bulk_cleaned': {
    key: 'student.domain.bulk_cleaned',
    description: 'Se emite cuando se realiza una limpieza masiva en un dominio',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      student_id: 'UUID del student',
      domain_key: 'Clave del dominio',
      items_count: 'Número de ítems limpiados',
      actor_type: 'Tipo de actor',
      trace_id: 'ID de traza'
    }
  },
  'student.capability.changed': {
    key: 'student.capability.changed',
    description: 'Se emite cuando cambian las capabilities de un alumno (p.ej., por pausa)',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      student_id: 'UUID del student',
      changed_capabilities: 'Array de capabilities que cambiaron',
      reason: 'Razón del cambio (p.ej., "paused", "resumed")',
      trace_id: 'ID de traza'
    }
  },
  'student.domain.item.metadata_updated': {
    key: 'student.domain.item.metadata_updated',
    description: 'Se emite cuando se actualizan metadatos de un ítem de dominio (ej. name, description de proyecto)',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      student_id: 'UUID del student',
      domain_key: 'Clave del dominio',
      item_id: 'ID del ítem',
      metadata: 'Objeto con los metadatos actualizados',
      actor_type: 'Tipo de actor',
      trace_id: 'ID de traza'
    }
  },
  'student.project.active_changed': {
    key: 'student.project.active_changed',
    description: 'Se emite cuando cambia el proyecto activo de un alumno',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      student_id: 'UUID del student',
      project_ref: 'Referencia del proyecto activado',
      actor_type: 'Tipo de actor',
      trace_id: 'ID de traza'
    }
  },

  // ============================================
  // OBSERVABILITY SIGNALS (Observabilidad)
  // ============================================
  'student.coherence.degraded': {
    key: 'student.coherence.degraded',
    description: 'Se emite cuando el estado de coherencia del alumno pasa a DEGRADED',
    category: 'observability',
    version: 'v1',
    deprecated: null,
    payload: {
      student_id: 'UUID del student',
      issues: 'Array de issues detectados',
      trace_id: 'ID de traza'
    }
  },
  'student.coherence.broken': {
    key: 'student.coherence.broken',
    description: 'Se emite cuando el estado de coherencia del alumno pasa a BROKEN',
    category: 'observability',
    version: 'v1',
    deprecated: null,
    payload: {
      student_id: 'UUID del student',
      issues: 'Array de issues críticos',
      trace_id: 'ID de traza'
    }
  },
  'student.sot.invariant_violation_detected': {
    key: 'student.sot.invariant_violation_detected',
    description: 'Se emite cuando se detecta una violación de invariante del SOT',
    category: 'observability',
    version: 'v1',
    deprecated: null,
    payload: {
      student_id: 'UUID del student',
      invariant_code: 'Código de la invariante violada',
      severity: 'Severidad (warning, error, critical)',
      details: 'Detalles de la violación',
      trace_id: 'ID de traza'
    }
  },
  'student.sot.backfill.applied': {
    key: 'student.sot.backfill.applied',
    description: 'Se emite cuando se aplica un backfill a un alumno',
    category: 'observability',
    version: 'v1',
    deprecated: null,
    payload: {
      student_id: 'UUID del student',
      legacy_alumno_id: 'ID legacy',
      backfill_type: 'Tipo de backfill aplicado',
      trace_id: 'ID de traza'
    }
  },

  // ============================================
  // PLACE SIGNALS (Sistema de Lugares v1)
  // ============================================
  'place.activated': {
    key: 'place.activated',
    description: 'Se emite cuando se activa un lugar para un alumno',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      student_id: 'ID del alumno',
      place_id: 'ID del lugar',
      place_state_id: 'ID del estado alumno-lugar',
      actor_type: 'Tipo de actor (master, student, system)',
      trace_id: 'ID de traza'
    }
  },
  'place.deactivated': {
    key: 'place.deactivated',
    description: 'Se emite cuando se desactiva un lugar para un alumno',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      student_id: 'ID del alumno',
      place_id: 'ID del lugar',
      place_state_id: 'ID del estado alumno-lugar',
      actor_type: 'Tipo de actor',
      reason: 'Razón de desactivación (opcional)',
      trace_id: 'ID de traza'
    }
  },
  'place.cleaned': {
    key: 'place.cleaned',
    description: 'Se emite cuando se limpia/revisa un lugar',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      student_id: 'ID del alumno',
      place_id: 'ID del lugar',
      place_state_id: 'ID del estado alumno-lugar',
      actor_type: 'Tipo de actor',
      trace_id: 'ID de traza'
    }
  },
  'place.cleaned.bulk': {
    key: 'place.cleaned.bulk',
    description: 'Se emite cuando se limpian múltiples lugares seleccionados',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      place_state_ids: 'Array de IDs de estados limpiados',
      items_count: 'Número de lugares limpiados',
      actor_type: 'Tipo de actor',
      trace_id: 'ID de traza'
    }
  },
  'place.cleaned.all': {
    key: 'place.cleaned.all',
    description: 'Se emite cuando se limpian TODOS los lugares activos',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      items_count: 'Número de lugares limpiados',
      actor_type: 'Tipo de actor',
      trace_id: 'ID de traza'
    }
  },
  'place.deactivated.all': {
    key: 'place.deactivated.all',
    description: 'Se emite cuando se desactivan todos los lugares (p.ej., por pausa de suscripción)',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      student_id: 'ID del alumno',
      items_count: 'Número de lugares desactivados',
      reason: 'Razón de desactivación masiva',
      trace_id: 'ID de traza'
    }
  },
  'place.category.created': {
    key: 'place.category.created',
    description: 'Se emite cuando se crea una categoría de lugar',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      category_id: 'ID de la categoría',
      category_key: 'Clave de la categoría',
      trace_id: 'ID de traza'
    }
  },
  'place.category.updated': {
    key: 'place.category.updated',
    description: 'Se emite cuando se actualiza una categoría de lugar',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      category_id: 'ID de la categoría',
      category_key: 'Clave de la categoría',
      trace_id: 'ID de traza'
    }
  },
  'place.category.reordered': {
    key: 'place.category.reordered',
    description: 'Se emite cuando se reordena el orden de categorías',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      category_ids: 'Array de IDs en nuevo orden',
      trace_id: 'ID de traza'
    }
  },
  'place.category.deactivated': {
    key: 'place.category.deactivated',
    description: 'Se emite cuando se desactiva una categoría de lugar',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      category_id: 'ID de la categoría',
      category_key: 'Clave de la categoría',
      trace_id: 'ID de traza'
    }
  },
  'place.activation_limit.updated': {
    key: 'place.activation_limit.updated',
    description: 'Se emite cuando se actualiza el límite de activación de un alumno',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      student_id: 'ID del alumno',
      domain: 'Dominio (places, projects)',
      activation_limit: 'Nuevo límite (NULL = ilimitado)',
      source: 'Origen del límite (default, master, automation)',
      trace_id: 'ID de traza'
    }
  },

  // ============================================
  // PROJECT SIGNALS (Sistema de Proyectos v1)
  // ============================================
  'project.activated': {
    key: 'project.activated',
    description: 'Se emite cuando se activa un proyecto para un alumno',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      student_id: 'ID del alumno',
      project_id: 'ID del proyecto',
      project_state_id: 'ID del estado alumno-proyecto',
      actor_type: 'Tipo de actor (master, student, system)',
      trace_id: 'ID de traza'
    }
  },
  'project.deactivated': {
    key: 'project.deactivated',
    description: 'Se emite cuando se desactiva un proyecto para un alumno',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      student_id: 'ID del alumno',
      project_id: 'ID del proyecto',
      project_state_id: 'ID del estado alumno-proyecto',
      actor_type: 'Tipo de actor',
      reason: 'Razón de desactivación (opcional)',
      trace_id: 'ID de traza'
    }
  },
  'project.cleaned': {
    key: 'project.cleaned',
    description: 'Se emite cuando se limpia/revisa un proyecto',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      student_id: 'ID del alumno',
      project_id: 'ID del proyecto',
      project_state_id: 'ID del estado alumno-proyecto',
      actor_type: 'Tipo de actor',
      trace_id: 'ID de traza'
    }
  },
  'project.cleaned.bulk': {
    key: 'project.cleaned.bulk',
    description: 'Se emite cuando se limpian múltiples proyectos seleccionados',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      project_state_ids: 'Array de IDs de estados limpiados',
      items_count: 'Número de proyectos limpiados',
      actor_type: 'Tipo de actor',
      trace_id: 'ID de traza'
    }
  },
  'project.cleaned.all': {
    key: 'project.cleaned.all',
    description: 'Se emite cuando se limpian TODOS los proyectos activos',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      items_count: 'Número de proyectos limpiados',
      actor_type: 'Tipo de actor',
      trace_id: 'ID de traza'
    }
  },
  'project.deactivated.all': {
    key: 'project.deactivated.all',
    description: 'Se emite cuando se desactivan todos los proyectos (p.ej., por pausa de suscripción)',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      student_id: 'ID del alumno',
      items_count: 'Número de proyectos desactivados',
      reason: 'Razón de desactivación masiva',
      trace_id: 'ID de traza'
    }
  },
  'project.category.created': {
    key: 'project.category.created',
    description: 'Se emite cuando se crea una categoría de proyecto',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      category_id: 'ID de la categoría',
      category_key: 'Clave de la categoría',
      trace_id: 'ID de traza'
    }
  },
  'project.category.updated': {
    key: 'project.category.updated',
    description: 'Se emite cuando se actualiza una categoría de proyecto',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      category_id: 'ID de la categoría',
      category_key: 'Clave de la categoría',
      trace_id: 'ID de traza'
    }
  },
  'project.category.reordered': {
    key: 'project.category.reordered',
    description: 'Se emite cuando se reordena el orden de categorías',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      category_ids: 'Array de IDs en nuevo orden',
      trace_id: 'ID de traza'
    }
  },
  'project.category.deactivated': {
    key: 'project.category.deactivated',
    description: 'Se emite cuando se desactiva una categoría de proyecto',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      category_id: 'ID de la categoría',
      category_key: 'Clave de la categoría',
      trace_id: 'ID de traza'
    }
  },
  'project.activation_limit.updated': {
    key: 'project.activation_limit.updated',
    description: 'Se emite cuando se actualiza el límite de activación de proyectos de un alumno',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      student_id: 'ID del alumno',
      domain: 'Dominio (places, projects)',
      activation_limit: 'Nuevo límite (NULL = ilimitado)',
      source: 'Origen del límite (default, master, automation)',
      trace_id: 'ID de traza'
    }
  },

  // ============================================
  // LEVEL ENGINE SIGNALS (Level Engine PDE v1)
  // ============================================
  'student.pde.level.changed': {
    key: 'student.pde.level.changed',
    description: 'Se emite cuando cambia el nivel PDE de un alumno',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      student_id: 'UUID del alumno',
      line_key: 'Clave de la línea (ej: pde)',
      computed_days: 'Días calculados desde inicio',
      level_number: 'Número del nuevo nivel',
      previous_level_number: 'Número del nivel anterior (si aplica)',
      upgrade_status: 'Estado de upgrade (ok, pending_requirements, locked)',
      pending_requirements_count: 'Número de requisitos pendientes',
      trace_id: 'ID de traza'
    }
  },
  'student.pde.phase.changed': {
    key: 'student.pde.phase.changed',
    description: 'Se emite cuando cambia la fase PDE de un alumno',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      student_id: 'UUID del alumno',
      line_key: 'Clave de la línea (ej: pde)',
      computed_days: 'Días calculados desde inicio',
      phase_key: 'Clave de la nueva fase',
      previous_phase_key: 'Clave de la fase anterior (si aplica)',
      trace_id: 'ID de traza'
    }
  },
  'student.pde.upgrade.pending': {
    key: 'student.pde.upgrade.pending',
    description: 'Se emite cuando un alumno cumple días para subir de nivel pero tiene requisitos pendientes',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      student_id: 'UUID del alumno',
      line_key: 'Clave de la línea (ej: pde)',
      computed_days: 'Días calculados desde inicio',
      target_level_number: 'Número del nivel objetivo',
      pending_requirements: 'Array con keys de gates pendientes',
      trace_id: 'ID de traza'
    }
  },
  'student.pde.upgrade.locked': {
    key: 'student.pde.upgrade.locked',
    description: 'Se emite cuando un alumno está bloqueado para subir de nivel',
    category: 'domain',
    version: 'v1',
    deprecated: null,
    payload: {
      student_id: 'UUID del alumno',
      line_key: 'Clave de la línea (ej: pde)',
      computed_days: 'Días calculados desde inicio',
      current_level_number: 'Número del nivel actual',
      upgrade_status: 'Estado de upgrade (locked)',
      pending_requirements: 'Array con keys de gates pendientes',
      trace_id: 'ID de traza'
    }
  }
};

/**
 * Obtiene la definición de una señal por su clave
 * 
 * @param {string} signalKey - Clave de la señal
 * @returns {SignalDefinition|null} Definición o null si no existe
 */
export function getSignalDefinition(signalKey) {
  return STUDENT_SIGNAL_REGISTRY[signalKey] || null;
}

/**
 * Lista todas las señales activas (no deprecadas)
 * 
 * @returns {Array<SignalDefinition>} Array de definiciones activas
 */
export function listActiveSignals() {
  return Object.values(STUDENT_SIGNAL_REGISTRY).filter(sig => !sig.deprecated);
}

/**
 * Lista señales por categoría
 * 
 * @param {string} category - Categoría ('domain' | 'observability')
 * @returns {Array<SignalDefinition>} Array de definiciones de la categoría
 */
export function listSignalsByCategory(category) {
  return Object.values(STUDENT_SIGNAL_REGISTRY).filter(
    sig => sig.category === category && !sig.deprecated
  );
}

/**
 * Valida que una señal existe y está activa
 * 
 * @param {string} signalKey - Clave de la señal
 * @returns {boolean} true si existe y está activa
 */
export function isValidSignal(signalKey) {
  const def = getSignalDefinition(signalKey);
  return def !== null && def.deprecated === null;
}

