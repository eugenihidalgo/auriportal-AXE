// src/core/student/student-context-builder.js
// Student Context Builder - Pieza Central del Sistema
//
// Construye el contexto canónico completo del alumno que será usado por:
// - Contextos
// - Automatizaciones
// - Futuras UIs (alumno y master)
//
// PRINCIPIO: Fail-open consciente
// - Si faltan datos → coherence.status = DEGRADED
// - Explicar por qué, pero devolver contexto
//
// INTEGRACIÓN v1:
// - Usa Student Capability Resolver para calcular capabilities
// - Usa Student Coherence Checker para verificar invariantes
// - Devuelve contrato v1 estable

import { getDefaultStudentOntologicalRepo } from '../../infra/repos/student-ontological-repo-pg.js';
import { getDefaultStudentOperationalService } from '../../../services/student-operational-service.js';
import { getDefaultStudentDomainPolicyRepo } from '../../infra/repos/student-domain-policy-repo-pg.js';
import { getDefaultStudentItemStateRepo } from '../../infra/repos/student-item-state-repo-pg.js';
import { getDefaultPauseProfilesRepo } from '../../infra/repos/pause-profiles-repo-pg.js';
import { getDefaultStudentOperationalStateRepo } from '../../infra/repos/student-operational-state-repo-pg.js';
import { resolveStudentCapabilities } from './capabilities/student-capability-resolver.js';
import { checkStudentCoherence } from './coherence/student-coherence-checker.js';
import { query } from '../../../database/pg.js';
import { logInfo, logError, logWarn } from '../observability/logger.js';
import { getRequestId } from '../observability/request-context.js';

export class StudentContextBuilder {
  constructor(
    ontologicalRepo,
    operationalService,
    domainPolicyRepo,
    itemStateRepo,
    pauseProfilesRepo
  ) {
    this.ontologicalRepo = ontologicalRepo;
    this.operationalService = operationalService;
    this.domainPolicyRepo = domainPolicyRepo;
    this.itemStateRepo = itemStateRepo;
    this.pauseProfilesRepo = pauseProfilesRepo;
  }

  /**
   * Construye el contexto canónico completo del alumno.
   * 
   * @param {string} studentId - UUID del student (o legacy_alumno_id si es número)
   * @param {string} productKey - Clave del producto (ej. 'pde')
   * @param {string} [traceId] - ID de traza
   * @returns {Promise<Object>} Contexto completo del alumno
   */
  async buildStudentContext(studentId, productKey = 'pde', traceId = getRequestId()) {
    logInfo('buildStudentContext', { studentId, productKey, traceId });
    
    const context = {
      contract_version: 'v1', // Versión del contrato
      student: null,
      operational_state: null,
      membership: null,
      domains: {},
      streaks: {
        current: 0,
        longest: 0,
        frozen: false,
        last_practice_at: null
      },
      capabilities: {},
      coherence: {
        status: 'NORMAL',
        warnings: [],
        issues: []
      }
    };

    try {
      // 1. Obtener identidad ontológica
      let student;
      if (typeof studentId === 'string' && studentId.includes('-')) {
        // Es UUID
        student = await this.ontologicalRepo.getById(studentId);
      } else {
        // Es legacy_alumno_id (número)
        student = await this.ontologicalRepo.getByLegacyAlumnoId(parseInt(studentId, 10));
      }

      if (!student) {
        context.coherence.status = 'BROKEN';
        context.coherence.warnings.push(`Student ${studentId} no encontrado`);
        logWarn('buildStudentContext: Student no encontrado', { studentId, traceId });
        return context;
      }

      context.student = {
        id: student.id,
        status: student.status,
        created_at: student.created_at?.toISOString() || new Date().toISOString(),
        updated_at: student.updated_at?.toISOString() || new Date().toISOString(),
        legacy_alumno_id: student.legacy_alumno_id
      };

      // 2. Obtener estado operativo
      let operationalState = null;
      try {
        const operationalStateRepo = getDefaultStudentOperationalStateRepo();
        operationalState = await operationalStateRepo.getCurrentState(student.id);
        
        if (operationalState) {
          context.operational_state = {
            state: operationalState.state,
            pause_profile: null,
            pause_profile_key: operationalState.pause_profile_key || null,
            reason: operationalState.pause_reason || null,
            source: operationalState.source,
            started_at: operationalState.started_at?.toISOString() || new Date().toISOString(),
            ends_at: operationalState.ends_at?.toISOString() || null
          };

          // Si está pausado, obtener perfil de pausa
          if (operationalState.state === 'PAUSED' && operationalState.pause_profile_key) {
            const profile = await this.pauseProfilesRepo.getByKey(operationalState.pause_profile_key);
            if (profile) {
              context.operational_state.pause_profile = {
                key: profile.profile_key,
                definition: profile.definition
              };
            } else {
              context.coherence.warnings.push(`Perfil de pausa ${operationalState.pause_profile_key} no encontrado`);
            }
          }
        } else {
          // No hay estado operativo, asumir ACTIVE por defecto
          context.operational_state = {
            state: 'ACTIVE',
            pause_profile: null,
            pause_profile_key: null,
            reason: null,
            source: 'system_default',
            started_at: new Date().toISOString(),
            ends_at: null
          };
          context.coherence.warnings.push('No se encontró estado operativo activo. Asumiendo ACTIVE.');
        }
      } catch (error) {
        context.coherence.status = 'DEGRADED';
        context.coherence.warnings.push(`Error obteniendo estado operativo: ${error.message}`);
        logError('buildStudentContext: Error obteniendo estado operativo', { studentId, error: error.message, traceId });
        // Fallback a ACTIVE
        context.operational_state = {
          state: 'ACTIVE',
          pause_profile: null,
          pause_profile_key: null,
          reason: null,
          source: 'system_default',
          started_at: new Date().toISOString(),
          ends_at: null
        };
      }

      // 3. Obtener membresía de producto
      try {
        const membershipResult = await query(
          'SELECT * FROM student_product_memberships WHERE student_id = $1 AND product_key = $2',
          [student.legacy_alumno_id || student.id, productKey]
        );
        
        if (membershipResult.rows.length > 0) {
          const membership = membershipResult.rows[0];
          context.membership = {
            product_key: membership.product_key,
            status: membership.status,
            joined_at: membership.joined_at?.toISOString() || new Date().toISOString(),
            expires_at: membership.expires_at?.toISOString() || null
          };
        } else {
          context.coherence.status = 'DEGRADED';
          context.coherence.warnings.push(`No hay membresía activa para producto ${productKey}`);
          context.membership = null;
        }
      } catch (error) {
        context.coherence.status = 'DEGRADED';
        context.coherence.warnings.push(`Error obteniendo membresía: ${error.message}`);
        logError('buildStudentContext: Error obteniendo membresía', { studentId, error: error.message, traceId });
      }

      // 4. Obtener estados por dominio
      const domainKeys = ['transmutaciones_energeticas', 'proyectos', 'lugares', 'apadrinados'];
      
      for (const domainKey of domainKeys) {
        try {
          const policy = await this.domainPolicyRepo.getPolicyByStudentAndDomain(
            student.legacy_alumno_id || student.id,
            domainKey
          );
          
          const activeItems = await this.itemStateRepo.listStates(
            student.legacy_alumno_id || student.id,
            domainKey,
            { isActive: true }
          );
          
          const allItems = await this.itemStateRepo.listStates(
            student.legacy_alumno_id || student.id,
            domainKey,
            {}
          );

          const effectiveLimit = policy?.active_limit_override !== null && policy?.active_limit_override !== undefined
            ? policy.active_limit_override
            : (policy?.active_limit_default ?? 1);

          context.domains[domainKey] = {
            active_limit: effectiveLimit,
            active_limit_override: policy?.active_limit_override,
            can_activate_multiple: policy?.can_activate_multiple || false,
            active_count: activeItems.length,
            active_items: activeItems.map(item => ({
              item_id: item.item_id,
              is_clean: item.is_clean,
              clean_count: item.clean_count,
              last_cleaned_at: item.last_cleaned_at
            })),
            all_items_count: allItems.length
          };

          // Verificar límites
          if (activeItems.length > effectiveLimit && effectiveLimit !== -1) {
            context.coherence.warnings.push(
              `Dominio ${domainKey}: ${activeItems.length} activos excede límite ${effectiveLimit}`
            );
          }
        } catch (error) {
          context.coherence.warnings.push(`Error obteniendo dominio ${domainKey}: ${error.message}`);
          logError('buildStudentContext: Error obteniendo dominio', { studentId, domainKey, error: error.message, traceId });
        }
      }

      // 5. Obtener rachas (derivadas de auditoría)
      try {
        const streaks = await this.computeStreaksFromAudit(student.id, productKey, traceId);
        context.streaks = {
          current: streaks.current || 0,
          longest: streaks.longest || 0,
          frozen: streaks.frozen || (context.operational_state?.state === 'PAUSED'),
          last_practice_at: streaks.last_practice_at?.toISOString() || null
        };
      } catch (error) {
        context.coherence.warnings.push(`Error calculando rachas: ${error.message}`);
        logError('buildStudentContext: Error calculando rachas', { studentId, error: error.message, traceId });
        context.streaks.frozen = context.operational_state?.state === 'PAUSED';
      }

      // 6. Resolver capabilities usando Student Capability Resolver
      try {
        context.capabilities = resolveStudentCapabilities(context, traceId);
      } catch (error) {
        context.coherence.warnings.push(`Error resolviendo capabilities: ${error.message}`);
        logError('buildStudentContext: Error resolviendo capabilities', { studentId, error: error.message, traceId });
        // Fallback a capabilities básicas
        context.capabilities = {
          can_progress: false,
          can_compute_level: false,
          can_update_streaks: false,
          can_trigger_automations: false,
          can_activate_contexts: false,
          can_run_resolvers: false,
          can_access_student_portal: false,
          can_write_domain_state: false,
          can_master_override: true,
          can_receive_notifications: true
        };
      }

      // 7. Verificar coherencia usando Student Coherence Checker
      try {
        const itemStateSummary = {};
        for (const domainKey of Object.keys(context.domains)) {
          itemStateSummary[domainKey] = {
            active_count: context.domains[domainKey].active_count || 0
          };
        }

        const coherenceResult = await checkStudentCoherence({
          student: student,
          operational_state: operationalState,
          memberships: context.membership ? [context.membership] : [],
          policies: Object.values(context.domains).map((d, idx) => ({
            domain_key: Object.keys(context.domains)[idx],
            active_limit_default: d.active_limit,
            active_limit_override: d.active_limit_override
          })),
          item_state_summary: itemStateSummary,
          audit_summary: null
        }, traceId);

        // Actualizar coherence con resultado del checker
        context.coherence.status = coherenceResult.status;
        context.coherence.issues = coherenceResult.issues;
        if (coherenceResult.issues.length > 0) {
          context.coherence.warnings.push(...coherenceResult.issues.map(i => i.message));
        }
      } catch (error) {
        context.coherence.warnings.push(`Error verificando coherencia: ${error.message}`);
        logError('buildStudentContext: Error verificando coherencia', { studentId, error: error.message, traceId });
        // Si falla el checker, mantener status actual o degradar
        if (context.coherence.status === 'NORMAL') {
          context.coherence.status = 'DEGRADED';
        }
      }

      // 8. Determinar status de coherencia final (si no fue establecido por el checker)
      if (context.coherence.warnings.length > 0 && context.coherence.status === 'NORMAL') {
        context.coherence.status = 'DEGRADED';
      }

      logInfo('buildStudentContext: Contexto construido', {
        studentId,
        coherenceStatus: context.coherence.status,
        warningsCount: context.coherence.warnings.length,
        traceId
      });

      return context;
    } catch (error) {
      logError('buildStudentContext: Error crítico construyendo contexto', { studentId, error: error.message, traceId });
      context.coherence.status = 'BROKEN';
      context.coherence.warnings.push(`Error crítico: ${error.message}`);
      return context;
    }
  }

  /**
   * Calcula rachas derivadas de auditoría.
   * 
   * @param {string} studentId - UUID del student
   * @param {string} productKey - Clave del producto
   * @param {string} [traceId] - ID de traza
   * @returns {Promise<Object>} Objeto con rachas calculadas
   */
  async computeStreaksFromAudit(studentId, productKey, traceId = getRequestId()) {
    // Por ahora, obtener racha desde tabla alumnos legacy
    // TODO: Implementar cálculo desde auditoría cuando esté disponible
    
    try {
      const student = await this.ontologicalRepo.getById(studentId);
      if (!student || !student.legacy_alumno_id) {
        return { current: 0, longest: 0, frozen: false };
      }

      const result = await query(
        'SELECT streak FROM alumnos WHERE id = $1',
        [student.legacy_alumno_id]
      );

      const currentStreak = result.rows[0]?.streak || 0;
      const operationalState = await this.operationalService.getCurrentOperationalState(studentId, traceId);
      const isFrozen = operationalState?.state === 'PAUSED';

      return {
        current: currentStreak,
        longest: currentStreak, // TODO: calcular desde historial cuando esté disponible
        frozen: isFrozen
      };
    } catch (error) {
      logError('computeStreaksFromAudit: Error calculando rachas', { studentId, error: error.message, traceId });
      return { current: 0, longest: 0, frozen: false };
    }
  }

  // NOTA: computeCapabilities() fue reemplazado por resolveStudentCapabilities()
  // del Student Capability Resolver. Este método se mantiene por compatibilidad
  // pero ya no se usa en buildStudentContext.
}

// Exportar instancia singleton por defecto
let defaultInstance = null;
export function getDefaultStudentContextBuilder() {
  if (!defaultInstance) {
    const ontologicalRepo = getDefaultStudentOntologicalRepo();
    const operationalService = getDefaultStudentOperationalService();
    const domainPolicyRepo = getDefaultStudentDomainPolicyRepo();
    const itemStateRepo = getDefaultStudentItemStateRepo();
    const pauseProfilesRepo = getDefaultPauseProfilesRepo();
    defaultInstance = new StudentContextBuilder(
      ontologicalRepo,
      operationalService,
      domainPolicyRepo,
      itemStateRepo,
      pauseProfilesRepo
    );
  }
  return defaultInstance;
}

export default getDefaultStudentContextBuilder();

