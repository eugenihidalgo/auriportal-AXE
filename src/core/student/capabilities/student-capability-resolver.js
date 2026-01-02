// src/core/student/capabilities/student-capability-resolver.js
// Student Capability Resolver v1
//
// Calcula las capabilities de un alumno basándose en:
// - student.status (NORMAL/DEGRADED/BROKEN)
// - operational_state (ACTIVE/PAUSED/SUSPENDED)
// - pause_profile.effects
// - product membership
// - coherence issues
//
// PRINCIPIO: NO ifs ad-hoc por todo el sistema. Todo se resuelve aquí.

import { STUDENT_CAPABILITY_REGISTRY, getCapabilityDefinition } from './student-capability-registry.js';
import { logInfo, logWarn } from '../../observability/logger.js';

/**
 * Resuelve todas las capabilities de un alumno basándose en su contexto
 * 
 * @param {Object} context - Contexto del alumno (output de buildStudentContext)
 * @param {string} [traceId] - ID de traza
 * @returns {Object} Objeto con todas las capabilities resueltas (key -> boolean)
 */
export function resolveStudentCapabilities(context, traceId = null) {
  logInfo('resolveStudentCapabilities', { 
    studentId: context.student?.id, 
    operationalState: context.operational_state?.state,
    coherenceStatus: context.coherence?.status,
    traceId 
  });

  const capabilities = {};
  const studentStatus = context.student?.status || 'NORMAL';
  const operationalState = context.operational_state?.state || 'ACTIVE';
  const pauseProfile = context.operational_state?.pause_profile;
  const pauseEffects = pauseProfile?.definition || {};
  const hasActiveMembership = context.membership?.status === 'active';
  const coherenceStatus = context.coherence?.status || 'NORMAL';

  // Inicializar todas las capabilities con sus valores por defecto
  for (const [key, def] of Object.entries(STUDENT_CAPABILITY_REGISTRY)) {
    if (def.deprecated) {
      continue; // Saltar capabilities deprecadas
    }
    capabilities[key] = def.default;
  }

  // ============================================
  // REGLA 1: PAUSED congela progreso y rachas, PERO permite limpiar
  // ============================================
  if (operationalState === 'PAUSED') {
    // Congelar progreso según pause_profile
    if (pauseEffects.level_progression === 'freeze') {
      capabilities.can_progress = false;
      capabilities.can_compute_level = false;
    }

    // Congelar rachas según pause_profile
    if (pauseEffects.streaks === 'freeze') {
      capabilities.can_update_streaks = false;
    }

    // Bloquear nuevas activaciones de contextos según pause_profile
    if (pauseEffects.contexts === 'block_new') {
      capabilities.can_activate_contexts = false;
    }

    // Bloquear automatizaciones de progreso según pause_profile
    if (pauseEffects.automations === 'block_progression') {
      capabilities.can_trigger_automations = false;
    }

    // Deshabilitar penalizaciones según pause_profile
    if (pauseEffects.penalties === 'disable') {
      // No hay capability específica para penalizaciones, pero se puede usar can_progress
      // Las penalizaciones deben verificar can_progress antes de aplicar
    }

    // IMPORTANTE: can_clean_domain_items SIEMPRE true (incluso en PAUSED)
    // El alumno puede limpiar siempre, solo se congela el progreso de nivel
    capabilities.can_clean_domain_items = true;

    // Manual actions y master actions se permiten según pause_profile
    // (no afectan capabilities, se manejan en lógica específica)
  }

  // ============================================
  // REGLA 2: SUSPENDED bloquea todo
  // ============================================
  if (operationalState === 'SUSPENDED') {
    capabilities.can_progress = false;
    capabilities.can_compute_level = false;
    capabilities.can_update_streaks = false;
    capabilities.can_trigger_automations = false;
    capabilities.can_activate_contexts = false;
    capabilities.can_write_domain_state = false;
    // Mantener acceso de lectura y notificaciones (pueden ser útiles)
  }

  // ============================================
  // REGLA 3: DEGRADED bloquea escrituras peligrosas
  // ============================================
  if (coherenceStatus === 'DEGRADED') {
    // Fail-open seguro: permitir lectura, bloquear escrituras peligrosas
    capabilities.can_progress = false;
    capabilities.can_compute_level = false;
    capabilities.can_write_domain_state = false;
    logWarn('resolveStudentCapabilities: DEGRADED state, blocking dangerous writes', {
      studentId: context.student?.id,
      traceId
    });
  }

  // ============================================
  // REGLA 4: BROKEN bloquea casi todo
  // ============================================
  if (coherenceStatus === 'BROKEN' || studentStatus === 'BROKEN') {
    // Bloquear todo excepto lectura y acciones del Master
    capabilities.can_progress = false;
    capabilities.can_compute_level = false;
    capabilities.can_update_streaks = false;
    capabilities.can_trigger_automations = false;
    capabilities.can_activate_contexts = false;
    capabilities.can_run_resolvers = false;
    capabilities.can_write_domain_state = false;
    capabilities.can_access_student_portal = false;
    // Master puede hacer override incluso en BROKEN
    logWarn('resolveStudentCapabilities: BROKEN state, blocking most operations', {
      studentId: context.student?.id,
      traceId
    });
  }

  // ============================================
  // REGLA 5: Sin membresía activa bloquea acceso
  // ============================================
  if (!hasActiveMembership) {
    capabilities.can_access_student_portal = false;
    capabilities.can_activate_contexts = false;
    capabilities.can_write_domain_state = false;
    // Pero puede limpiar si tiene acceso (fail-open)
    // capabilities.can_clean_domain_items se mantiene según estado operativo
  }

  // ============================================
  // REGLA 6: can_progress_level solo si ACTIVE
  // ============================================
  // can_progress_level es un alias de can_progress para claridad
  // Se deriva de can_progress (ya calculado arriba)
  if (operationalState !== 'ACTIVE') {
    // Ya se bloqueó en REGLA 1 si está PAUSED
    // Pero asegurar que solo ACTIVE permite progreso de nivel
    if (operationalState === 'SUSPENDED') {
      capabilities.can_progress = false;
      capabilities.can_compute_level = false;
    }
  }

  logInfo('resolveStudentCapabilities: Capabilities resueltas', {
    studentId: context.student?.id,
    capabilitiesCount: Object.keys(capabilities).length,
    traceId
  });

  return capabilities;
}

/**
 * Verifica si una capability específica está habilitada
 * 
 * @param {Object} context - Contexto del alumno
 * @param {string} capabilityKey - Clave de la capability
 * @param {string} [traceId] - ID de traza
 * @returns {boolean} true si la capability está habilitada
 */
export function hasCapability(context, capabilityKey, traceId = null) {
  if (!isValidCapability(capabilityKey)) {
    logWarn('hasCapability: Invalid capability key', { capabilityKey, traceId });
    return false;
  }

  const capabilities = resolveStudentCapabilities(context, traceId);
  return capabilities[capabilityKey] === true;
}

// Re-exportar isValidCapability del registry
export { isValidCapability } from './student-capability-registry.js';

