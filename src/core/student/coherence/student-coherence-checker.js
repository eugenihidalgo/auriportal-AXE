// src/core/student/coherence/student-coherence-checker.js
// Student Coherence Checker v1
//
// Verifica invariantes del Student SOT y clasifica el estado de coherencia:
// - NORMAL: Todo coherente
// - DEGRADED: Problemas menores, sistema puede operar con precaución
// - BROKEN: Problemas críticos, sistema debe bloquear escrituras peligrosas

import { logInfo, logWarn, logError } from '../../observability/logger.js';
import { getRequestId } from '../../observability/request-context.js';
import { emitStudentSignal } from '../signals/student-signal-emitter.js';

/**
 * @typedef {Object} CoherenceIssue
 * @property {string} code - Código único del issue
 * @property {string} severity - 'warning' | 'error' | 'critical'
 * @property {string} message - Mensaje descriptivo
 * @property {Object} meta - Metadatos adicionales
 */

/**
 * @typedef {Object} CoherenceResult
 * @property {string} status - 'NORMAL' | 'DEGRADED' | 'BROKEN'
 * @property {Array<CoherenceIssue>} issues - Array de issues detectados
 * @property {Array<string>} invariants_checked - Lista de invariantes verificados
 */

/**
 * Verifica la coherencia del Student SOT
 * 
 * @param {Object} inputs - Inputs para verificación
 * @param {Object} inputs.student - Registro de students (ontológico)
 * @param {Object} inputs.operational_state - Estado operativo actual
 * @param {Array<Object>} inputs.memberships - Membresías de producto
 * @param {Array<Object>} inputs.policies - Políticas de dominio
 * @param {Object} inputs.item_state_summary - Resumen de estados de ítems por dominio
 * @param {Object} inputs.audit_summary - Resumen de auditoría (opcional)
 * @param {string} [traceId] - ID de traza
 * @returns {Promise<CoherenceResult>} Resultado de la verificación
 */
export async function checkStudentCoherence(inputs, traceId = getRequestId()) {
  logInfo('checkStudentCoherence', { 
    studentId: inputs.student?.id,
    traceId 
  });

  const issues = [];
  const invariantsChecked = [];

  // ============================================
  // INVARIANTE 1: Existe students row
  // ============================================
  invariantsChecked.push('student_exists');
  if (!inputs.student) {
    issues.push({
      code: 'STUDENT_MISSING',
      severity: 'critical',
      message: 'No existe registro en students para este student_id',
      meta: {}
    });
  }

  // ============================================
  // INVARIANTE 2: Existe operational_state row
  // ============================================
  invariantsChecked.push('operational_state_exists');
  if (!inputs.operational_state) {
    issues.push({
      code: 'OPERATIONAL_STATE_MISSING',
      severity: 'error',
      message: 'No existe estado operativo para este student',
      meta: {}
    });
  }

  // ============================================
  // INVARIANTE 3: Existe membership activa (si se espera producto)
  // ============================================
  invariantsChecked.push('active_membership_exists');
  if (inputs.memberships && inputs.memberships.length > 0) {
    const hasActive = inputs.memberships.some(m => m.status === 'active');
    if (!hasActive) {
      issues.push({
        code: 'NO_ACTIVE_MEMBERSHIP',
        severity: 'warning',
        message: 'No hay membresía activa para ningún producto',
        meta: {
          memberships: inputs.memberships.map(m => ({ product_key: m.product_key, status: m.status }))
        }
      });
    }
  } else {
    issues.push({
      code: 'NO_MEMBERSHIPS',
      severity: 'warning',
      message: 'No hay membresías de producto registradas',
      meta: {}
    });
  }

  // ============================================
  // INVARIANTE 4: PAUSED => capabilities coherentes
  // ============================================
  invariantsChecked.push('paused_capabilities_coherent');
  if (inputs.operational_state?.state === 'PAUSED') {
    const pauseProfile = inputs.operational_state?.pause_profile;
    if (!pauseProfile) {
      issues.push({
        code: 'PAUSED_WITHOUT_PROFILE',
        severity: 'error',
        message: 'Estado PAUSED sin perfil de pausa asociado',
        meta: {
          operational_state: inputs.operational_state
        }
      });
    } else {
      // Verificar que el perfil tiene definition válida
      if (!pauseProfile.definition || typeof pauseProfile.definition !== 'object') {
        issues.push({
          code: 'PAUSED_PROFILE_INVALID',
          severity: 'error',
          message: 'Perfil de pausa sin definition válida',
          meta: {
            pause_profile_key: pauseProfile.key
          }
        });
      }
    }
  }

  // ============================================
  // INVARIANTE 5: active_limit=1 => no >1 activos
  // ============================================
  invariantsChecked.push('active_limit_respected');
  if (inputs.policies && inputs.item_state_summary) {
    for (const policy of inputs.policies) {
      const domainKey = policy.domain_key;
      const effectiveLimit = policy.active_limit_override ?? policy.active_limit_default ?? 1;
      
      if (effectiveLimit === 1 && inputs.item_state_summary[domainKey]) {
        const activeCount = inputs.item_state_summary[domainKey].active_count || 0;
        if (activeCount > 1) {
          issues.push({
            code: 'ACTIVE_LIMIT_EXCEEDED',
            severity: 'warning',
            message: `Dominio ${domainKey} tiene ${activeCount} activos pero límite es ${effectiveLimit}`,
            meta: {
              domain_key: domainKey,
              active_count: activeCount,
              effective_limit: effectiveLimit
            }
          });
        }
      }
    }
  }

  // ============================================
  // INVARIANTE 6: Referencias básicas válidas
  // ============================================
  invariantsChecked.push('references_valid');
  if (inputs.student && inputs.operational_state) {
    // Verificar que operational_state.student_id apunta a student.id válido
    if (inputs.operational_state.student_id !== inputs.student.id) {
      issues.push({
        code: 'OPERATIONAL_STATE_MISMATCH',
        severity: 'critical',
        message: 'operational_state.student_id no coincide con student.id',
        meta: {
          student_id: inputs.student.id,
          operational_state_student_id: inputs.operational_state.student_id
        }
      });
    }
  }

  // ============================================
  // INVARIANTE 7: Estado ontológico coherente
  // ============================================
  invariantsChecked.push('ontological_status_coherent');
  if (inputs.student) {
    const status = inputs.student.status;
    if (!['NORMAL', 'DEGRADED', 'BROKEN'].includes(status)) {
      issues.push({
        code: 'INVALID_ONTOLOGICAL_STATUS',
        severity: 'error',
        message: `Estado ontológico inválido: ${status}`,
        meta: {
          status
        }
      });
    }
  }

  // ============================================
  // INVARIANTE 8: Estado operativo coherente
  // ============================================
  invariantsChecked.push('operational_status_coherent');
  if (inputs.operational_state) {
    const state = inputs.operational_state.state;
    if (!['ACTIVE', 'PAUSED', 'SUSPENDED'].includes(state)) {
      issues.push({
        code: 'INVALID_OPERATIONAL_STATE',
        severity: 'error',
        message: `Estado operativo inválido: ${state}`,
        meta: {
          state
        }
      });
    }

    // PAUSED debe tener pause_profile_key
    if (state === 'PAUSED' && !inputs.operational_state.pause_profile_key) {
      issues.push({
        code: 'PAUSED_WITHOUT_PROFILE_KEY',
        severity: 'error',
        message: 'Estado PAUSED sin pause_profile_key',
        meta: {
          operational_state: inputs.operational_state
        }
      });
    }
  }

  // ============================================
  // Determinar status final
  // ============================================
  let status = 'NORMAL';
  
  const criticalIssues = issues.filter(i => i.severity === 'critical');
  const errorIssues = issues.filter(i => i.severity === 'error');
  const warningIssues = issues.filter(i => i.severity === 'warning');

  if (criticalIssues.length > 0) {
    status = 'BROKEN';
  } else if (errorIssues.length > 0) {
    status = 'DEGRADED';
  } else if (warningIssues.length > 0) {
    status = 'DEGRADED';
  }

  // Emitir señales si hay degradación o rotura
  if (status === 'DEGRADED' && inputs.student) {
    await emitStudentSignal('student.coherence.degraded', {
      student_id: inputs.student.id,
      issues: issues.map(i => ({ code: i.code, severity: i.severity, message: i.message })),
      trace_id: traceId
    });
  }

  if (status === 'BROKEN' && inputs.student) {
    await emitStudentSignal('student.coherence.broken', {
      student_id: inputs.student.id,
      issues: criticalIssues.map(i => ({ code: i.code, severity: i.severity, message: i.message })),
      trace_id: traceId
    });
  }

  // Emitir señal de violación de invariante si hay issues críticos o errores
  for (const issue of [...criticalIssues, ...errorIssues]) {
    await emitStudentSignal('student.sot.invariant_violation_detected', {
      student_id: inputs.student?.id,
      invariant_code: issue.code,
      severity: issue.severity,
      details: issue.message,
      trace_id: traceId
    });
  }

  logInfo('checkStudentCoherence: Verificación completada', {
    studentId: inputs.student?.id,
    status,
    issuesCount: issues.length,
    invariantsChecked: invariantsChecked.length,
    traceId
  });

  return {
    status,
    issues,
    invariants_checked: invariantsChecked
  };
}


