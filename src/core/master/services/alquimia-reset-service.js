// src/core/master/services/alquimia-reset-service.js
// Servicio Canónico de Reset de Progreso en Alquimia (MASTER)
//
// RESPONSABILIDADES:
// - Resetear progreso de alumno para ítem específico
// - Resetear progreso de alumno para lista completa
// - Validar inputs (UUID-only, scope='student')
// - Operación idempotente
//
// REGLAS CONSTITUCIONALES:
// - Reset ≠ override (no modifica student_item_overrides)
// - Reset ≠ limpieza (no marca como limpiado)
// - Solo afecta cleaning_item_state
// - UUID-only: NO acepta legacy_alumno_id
// - Backend es la única autoridad
// - Operación idempotente (mismo resultado si se llama múltiples veces)

import { getDefaultCleaningItemStateRepo } from '../../../infra/repos/cleaning/cleaning-item-state-repo-pg.js';
import { getDefaultAlquimiaCatalogRepo } from '../../../infra/repos/alquimia-catalog-repo-pg.js';
import { getRequestId } from '../../observability/request-context.js';
import { logError, logInfo } from '../../observability/logger.js';

/**
 * Resetea el progreso de un alumno para un ítem específico.
 * REGLA CONSTITUCIONAL: Reset ≠ override, Reset ≠ limpieza
 * Solo afecta al estado del alumno (cleaning_item_state), no modifica overrides ni definiciones base.
 * 
 * @param {Object} options - Opciones
 * @param {string} options.student_uuid - UUID canónico del estudiante (OBLIGATORIO)
 * @param {string} options.item_ref - Referencia del item (OBLIGATORIO)
 * @param {string} [options.product_key='pde'] - Clave del producto (opcional)
 * @param {string} [options.domain_type] - Tipo de dominio (opcional, se infiere si no se proporciona)
 * @returns {Promise<boolean>} true si se reseteó, false si no existía estado
 */
export async function resetStudentItemProgress(options) {
  const traceId = getRequestId();
  const { student_uuid, item_ref, product_key = 'pde', domain_type = null } = options;
  
  try {
    // Validaciones obligatorias
    if (!student_uuid || !item_ref) {
      throw new Error('student_uuid e item_ref son requeridos');
    }
    
    // UUID-only: validar formato UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(student_uuid)) {
      throw new Error('student_uuid debe ser un UUID válido');
    }
    
    logInfo('AlquimiaResetService', 'resetStudentItemProgress iniciado', {
      traceId,
      student_uuid,
      item_ref,
      product_key,
      domain_type
    });
    
    // Obtener item para determinar domain_type si no viene
    let finalDomainType = domain_type;
    if (!finalDomainType) {
      const catalogRepo = getDefaultAlquimiaCatalogRepo();
      const item = await catalogRepo.getItemByRef(item_ref);
      if (!item) {
        throw new Error(`Item con item_ref=${item_ref} no encontrado`);
      }
      // domain_type se deriva del item (normalmente 'transmutation' o 'alquimia')
      finalDomainType = item.domain_type || 'transmutation';
    }
    
    // Resetear estado: eliminar fila de cleaning_item_state
    const stateRepo = getDefaultCleaningItemStateRepo();
    const deleted = await stateRepo.deleteState({
      student_uuid,
      item_ref,
      product_key,
      domain_type: finalDomainType
    });
    
    logInfo('AlquimiaResetService', 'resetStudentItemProgress completado', {
      traceId,
      student_uuid,
      item_ref,
      deleted,
      domain_type: finalDomainType
    });
    
    return deleted;
  } catch (error) {
    logError('AlquimiaResetService', 'Error en resetStudentItemProgress', {
      traceId,
      error: error.message,
      code: error.code,
      stack: error.stack,
      student_uuid,
      item_ref
    });
    throw error;
  }
}

/**
 * Resetea el progreso de un alumno para todos los ítems de una lista.
 * REGLA CONSTITUCIONAL: Reset ≠ override, Reset ≠ limpieza
 * Solo afecta al estado del alumno (cleaning_item_state), no modifica overrides ni definiciones base.
 * 
 * @param {Object} options - Opciones
 * @param {string} options.student_uuid - UUID canónico del estudiante (OBLIGATORIO)
 * @param {string} options.list_id - ID de la lista (OBLIGATORIO)
 * @param {string} [options.product_key='pde'] - Clave del producto (opcional)
 * @param {string} [options.domain_type] - Tipo de dominio (opcional, se infiere si no se proporciona)
 * @returns {Promise<number>} Número de estados reseteados
 */
export async function resetStudentListProgress(options) {
  const traceId = getRequestId();
  const { student_uuid, list_id, product_key = 'pde', domain_type = null } = options;
  
  try {
    // Validaciones obligatorias
    if (!student_uuid || !list_id) {
      throw new Error('student_uuid y list_id son requeridos');
    }
    
    // UUID-only: validar formato UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(student_uuid)) {
      throw new Error('student_uuid debe ser un UUID válido');
    }
    
    logInfo('AlquimiaResetService', 'resetStudentListProgress iniciado', {
      traceId,
      student_uuid,
      list_id,
      product_key,
      domain_type
    });
    
    // Obtener lista para determinar domain_type si no viene
    let finalDomainType = domain_type;
    if (!finalDomainType) {
      const catalogRepo = getDefaultAlquimiaCatalogRepo();
      const lista = await catalogRepo.getListaById(list_id);
      if (!lista) {
        throw new Error(`Lista con id=${list_id} no encontrada`);
      }
      // domain_type se deriva de la lista (normalmente 'transmutation' o 'alquimia')
      finalDomainType = lista.domain_type || 'transmutation';
    }
    
    // Resetear estados: eliminar filas de cleaning_item_state para todos los ítems de la lista
    const stateRepo = getDefaultCleaningItemStateRepo();
    const deletedCount = await stateRepo.deleteStatesByList({
      student_uuid,
      list_id,
      product_key,
      domain_type: finalDomainType
    });
    
    logInfo('AlquimiaResetService', 'resetStudentListProgress completado', {
      traceId,
      student_uuid,
      list_id,
      deleted_count: deletedCount,
      domain_type: finalDomainType
    });
    
    return deletedCount;
  } catch (error) {
    logError('AlquimiaResetService', 'Error en resetStudentListProgress', {
      traceId,
      error: error.message,
      code: error.code,
      stack: error.stack,
      student_uuid,
      list_id
    });
    throw error;
  }
}
