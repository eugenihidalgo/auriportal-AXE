// src/services/student-domain-state-service.js
// Servicio de negocio para Estado por Dominio Energético del Alumno
//
// Responsabilidades:
// - Gestión de estado de ítems por dominio
// - Enforcement de políticas (límites de activación)
// - Auditoría completa
// - Operaciones de limpieza

import { getDefaultStudentItemStateRepo } from '../infra/repos/student-item-state-repo-pg.js';
import { getDefaultStudentDomainPolicyRepo } from '../infra/repos/student-domain-policy-repo-pg.js';
import { getDefaultStudentAuditRepo } from '../infra/repos/student-audit-repo-pg.js';

/**
 * Lista ítems de un dominio para un alumno
 * 
 * @param {number} studentId - ID del alumno
 * @param {string} domainKey - Clave del dominio
 * @param {Object} options - Opciones de filtrado
 * @param {boolean} [options.isActive] - Filtrar por is_active
 * @param {boolean} [options.isClean] - Filtrar por is_clean
 * @returns {Promise<Array>} Array de estados de ítems
 */
export async function listDomainItemsForStudent(studentId, domainKey, options = {}) {
  if (!studentId || !domainKey) return [];

  const repo = getDefaultStudentItemStateRepo();
  return await repo.listStates(studentId, domainKey, options);
}

/**
 * Activa o desactiva un ítem para un alumno
 * 
 * @param {number} studentId - ID del alumno
 * @param {string} domainKey - Clave del dominio
 * @param {number} itemId - ID del ítem
 * @param {boolean} isActive - Si activar o desactivar
 * @param {Object} actor - Actor que realiza la acción
 * @param {string} actor.type - 'master', 'student', 'system'
 * @param {string} [actor.id] - ID del actor
 * @param {string} [traceId] - Trace ID para correlación
 * @returns {Promise<Object>} Estado actualizado
 * @throws {Error} Si se excede el límite de activos (solo si actor=student)
 */
export async function setActive(studentId, domainKey, itemId, isActive, actor, traceId = null) {
  if (!studentId || !domainKey || !itemId || !actor || !actor.type) {
    throw new Error('studentId, domainKey, itemId y actor son requeridos');
  }

  const stateRepo = getDefaultStudentItemStateRepo();
  const policyRepo = getDefaultStudentDomainPolicyRepo();
  const auditRepo = getDefaultStudentAuditRepo();

  // Obtener estado actual (para auditoría)
  const currentState = await stateRepo.getState(studentId, domainKey, itemId);

  // Si se está activando y el actor es student, validar límite
  if (isActive && actor.type === 'student') {
    const policy = await policyRepo.getPolicy(studentId, domainKey);
    if (policy) {
      const activeCount = await stateRepo.countActiveItems(studentId, domainKey);
      const limit = policy.active_limit_override ?? policy.active_limit_default;

      // Si hay override ilimitado (-1), permitir siempre
      if (limit !== -1 && activeCount >= limit) {
        throw new Error(`Límite de ítems activos alcanzado: ${limit}. El Master puede aumentar el límite.`);
      }
    }
  }

  // Actualizar estado
  const updatedState = await stateRepo.upsertState(studentId, domainKey, itemId, {
    is_active: isActive
  });

  // Auditar
  await auditRepo.createAuditEvent({
    student_id: studentId,
    domain_key: domainKey,
    item_id: itemId,
    action: isActive ? 'ACTIVATE' : 'DEACTIVATE',
    actor_type: actor.type,
    actor_id: actor.id || null,
    before: currentState ? { is_active: currentState.is_active } : null,
    after: { is_active: isActive },
    trace_id: traceId
  });

  return updatedState;
}

/**
 * Marca un ítem como limpio
 * 
 * @param {number} studentId - ID del alumno
 * @param {string} domainKey - Clave del dominio
 * @param {number} itemId - ID del ítem
 * @param {Object} actor - Actor que realiza la acción
 * @param {string} [traceId] - Trace ID para correlación
 * @returns {Promise<Object|null>} Estado actualizado o null si no existe
 */
export async function cleanItem(studentId, domainKey, itemId, actor, traceId = null) {
  if (!studentId || !domainKey || !itemId || !actor || !actor.type) {
    throw new Error('studentId, domainKey, itemId y actor son requeridos');
  }

  const stateRepo = getDefaultStudentItemStateRepo();
  const auditRepo = getDefaultStudentAuditRepo();

  // Obtener estado actual (para auditoría)
  const currentState = await stateRepo.getState(studentId, domainKey, itemId);
  if (!currentState) return null;

  // Marcar como limpio
  const updatedState = await stateRepo.markAsClean(studentId, domainKey, itemId);

  // Auditar
  await auditRepo.createAuditEvent({
    student_id: studentId,
    domain_key: domainKey,
    item_id: itemId,
    action: 'CLEAN',
    actor_type: actor.type,
    actor_id: actor.id || null,
    before: {
      is_clean: currentState.is_clean,
      clean_count: currentState.clean_count,
      last_cleaned_at: currentState.last_cleaned_at
    },
    after: {
      is_clean: updatedState.is_clean,
      clean_count: updatedState.clean_count,
      last_cleaned_at: updatedState.last_cleaned_at
    },
    trace_id: traceId
  });

  return updatedState;
}

/**
 * Limpieza masiva de ítems
 * 
 * @param {number} studentId - ID del alumno
 * @param {string} domainKey - Clave del dominio
 * @param {Object} options - Opciones
 * @param {Array<number>} [options.itemIds] - IDs de ítems a limpiar
 * @param {boolean} [options.allActive] - Si limpiar todos los activos
 * @param {Object} actor - Actor que realiza la acción
 * @param {string} [traceId] - Trace ID para correlación
 * @returns {Promise<number>} Cantidad de ítems limpiados
 */
export async function bulkClean(studentId, domainKey, options, actor, traceId = null) {
  if (!studentId || !domainKey || !actor || !actor.type) {
    throw new Error('studentId, domainKey y actor son requeridos');
  }

  const stateRepo = getDefaultStudentItemStateRepo();
  const auditRepo = getDefaultStudentAuditRepo();

  let cleanedCount = 0;
  let itemIds = [];

  if (options.allActive) {
    // Limpiar todos los activos
    cleanedCount = await stateRepo.markAllActiveAsClean(studentId, domainKey);
    // Obtener IDs de los limpiados para auditoría
    const states = await stateRepo.listStates(studentId, domainKey, { isActive: true });
    itemIds = states.map(s => s.item_id);
  } else if (options.itemIds && options.itemIds.length > 0) {
    // Limpiar ítems específicos
    cleanedCount = await stateRepo.bulkMarkAsClean(studentId, domainKey, options.itemIds);
    itemIds = options.itemIds;
  }

  // Auditar cada ítem limpiado
  for (const itemId of itemIds) {
    const currentState = await stateRepo.getState(studentId, domainKey, itemId);
    if (currentState) {
      await auditRepo.createAuditEvent({
        student_id: studentId,
        domain_key: domainKey,
        item_id: itemId,
        action: 'BULK_CLEAN',
        actor_type: actor.type,
        actor_id: actor.id || null,
        before: {
          is_clean: currentState.is_clean,
          clean_count: currentState.clean_count,
          last_cleaned_at: currentState.last_cleaned_at
        },
        after: {
          is_clean: true,
          clean_count: currentState.clean_count + 1,
          last_cleaned_at: new Date().toISOString()
        },
        trace_id: traceId
      });
    }
  }

  return cleanedCount;
}

/**
 * Establece la recurrencia personalizada de un ítem
 * 
 * @param {number} studentId - ID del alumno
 * @param {string} domainKey - Clave del dominio
 * @param {number} itemId - ID del ítem
 * @param {number} days - Días de recurrencia
 * @param {Object} actor - Actor que realiza la acción
 * @param {string} [traceId] - Trace ID para correlación
 * @returns {Promise<Object|null>} Estado actualizado o null si no existe
 */
export async function setStudentRecurrence(studentId, domainKey, itemId, days, actor, traceId = null) {
  if (!studentId || !domainKey || !itemId || days === undefined || !actor || !actor.type) {
    throw new Error('studentId, domainKey, itemId, days y actor son requeridos');
  }

  const stateRepo = getDefaultStudentItemStateRepo();
  const auditRepo = getDefaultStudentAuditRepo();

  // Obtener estado actual (para auditoría)
  const currentState = await stateRepo.getState(studentId, domainKey, itemId);
  if (!currentState) return null;

  // Actualizar recurrencia
  const updatedState = await stateRepo.setRecurrence(studentId, domainKey, itemId, days);

  // Auditar
  await auditRepo.createAuditEvent({
    student_id: studentId,
    domain_key: domainKey,
    item_id: itemId,
    action: 'SET_RECURRENCE',
    actor_type: actor.type,
    actor_id: actor.id || null,
    before: {
      student_recurrence_days: currentState.student_recurrence_days
    },
    after: {
      student_recurrence_days: days
    },
    trace_id: traceId
  });

  return updatedState;
}


