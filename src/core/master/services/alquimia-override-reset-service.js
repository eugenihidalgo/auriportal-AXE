// src/core/master/services/alquimia-override-reset-service.js
// Servicio Canónico de Reset de Overrides en Alquimia (MASTER)
//
// RESPONSABILIDADES:
// - Resetear overrides de configuración de items por alumno
// - Validar inputs (UUID-only, scope)
// - Operación idempotente
//
// REGLAS CONSTITUCIONALES:
// - Override ≠ cleaning state (NO modifica cleaning_item_state)
// - Override ≠ reset (NO modifica effective_since o last_cleaned_at)
// - Solo afecta student_item_overrides
// - UUID-only: NO acepta legacy_alumno_id
// - Backend es la única autoridad
// - Operación idempotente (mismo resultado si se llama múltiples veces)

import { getDefaultStudentItemOverridesRepoPg } from '../../../infra/repos/student-item-overrides-repo-pg.js';
import { getDefaultAlquimiaCatalogRepo } from '../../../infra/repos/alquimia-catalog-repo-pg.js';
import { getRequestId } from '../../observability/request-context.js';
import { logError, logInfo } from '../../observability/logger.js';
import { query } from '../../../../database/pg.js';

/**
 * Resetea overrides de un item para un estudiante específico.
 * REGLA CONSTITUCIONAL: Override ≠ cleaning state, Override ≠ reset
 * Solo afecta a overrides (student_item_overrides), no modifica cleaning_item_state.
 * 
 * @param {Object} options - Opciones
 * @param {string} options.student_uuid - UUID canónico del estudiante (OBLIGATORIO)
 * @param {string} options.item_ref - Referencia del item (OBLIGATORIO)
 * @param {string} [options.product_key='pde'] - Clave del producto (opcional)
 * @param {string} [options.domain_type] - Tipo de dominio (opcional)
 * @returns {Promise<number>} Número de overrides eliminados
 */
export async function resetOverridesByStudentItem(options) {
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
    
    logInfo('AlquimiaOverrideResetService', 'resetOverridesByStudentItem iniciado', {
      traceId,
      student_uuid,
      item_ref,
      product_key,
      domain_type
    });
    
    // Eliminar todos los overrides para este estudiante e item
    const repo = getDefaultStudentItemOverridesRepoPg();
    const overrides = await repo.listByStudent(student_uuid, { item_ref });
    
    let deletedCount = 0;
    for (const override of overrides) {
      const deleted = await repo.delete(override.id);
      if (deleted) {
        deletedCount++;
      }
    }
    
    logInfo('AlquimiaOverrideResetService', 'resetOverridesByStudentItem completado', {
      traceId,
      student_uuid,
      item_ref,
      deleted_count: deletedCount
    });
    
    return deletedCount;
  } catch (error) {
    logError('AlquimiaOverrideResetService', 'Error en resetOverridesByStudentItem', {
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
 * Resetea overrides de un item para TODOS los estudiantes.
 * REGLA CONSTITUCIONAL: Override ≠ cleaning state, Override ≠ reset
 * 
 * @param {Object} options - Opciones
 * @param {string} options.item_ref - Referencia del item (OBLIGATORIO)
 * @param {string} [options.product_key='pde'] - Clave del producto (opcional)
 * @param {string} [options.domain_type] - Tipo de dominio (opcional)
 * @returns {Promise<number>} Número de overrides eliminados
 */
export async function resetOverridesByItemAll(options) {
  const traceId = getRequestId();
  const { item_ref, product_key = 'pde', domain_type = null } = options;
  
  try {
    // Validaciones obligatorias
    if (!item_ref) {
      throw new Error('item_ref es requerido');
    }
    
    logInfo('AlquimiaOverrideResetService', 'resetOverridesByItemAll iniciado', {
      traceId,
      item_ref,
      product_key,
      domain_type
    });
    
    // Eliminar todos los overrides para este item (todos los estudiantes)
    const queryFn = query;
    const result = await queryFn(`
      DELETE FROM student_item_overrides
      WHERE item_ref = $1
      RETURNING id
    `, [item_ref]);
    
    const deletedCount = result.rows.length;
    
    logInfo('AlquimiaOverrideResetService', 'resetOverridesByItemAll completado', {
      traceId,
      item_ref,
      deleted_count: deletedCount
    });
    
    return deletedCount;
  } catch (error) {
    logError('AlquimiaOverrideResetService', 'Error en resetOverridesByItemAll', {
      traceId,
      error: error.message,
      code: error.code,
      stack: error.stack,
      item_ref
    });
    throw error;
  }
}

/**
 * Resetea overrides de todos los items de una lista para un estudiante específico.
 * REGLA CONSTITUCIONAL: Override ≠ cleaning state, Override ≠ reset
 * 
 * @param {Object} options - Opciones
 * @param {string} options.student_uuid - UUID canónico del estudiante (OBLIGATORIO)
 * @param {number} options.list_id - ID de la lista (OBLIGATORIO)
 * @param {string} [options.product_key='pde'] - Clave del producto (opcional)
 * @param {string} [options.domain_type] - Tipo de dominio (opcional)
 * @returns {Promise<number>} Número de overrides eliminados
 */
export async function resetOverridesByListStudent(options) {
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
    
    logInfo('AlquimiaOverrideResetService', 'resetOverridesByListStudent iniciado', {
      traceId,
      student_uuid,
      list_id,
      product_key,
      domain_type
    });
    
    // Obtener todos los items de la lista
    const catalogRepo = getDefaultAlquimiaCatalogRepo();
    const items = await catalogRepo.listItems(list_id, { onlyActive: true });
    
    // Eliminar overrides para cada item de la lista para este estudiante
    const repo = getDefaultStudentItemOverridesRepoPg();
    let deletedCount = 0;
    
    for (const item of items) {
      const overrides = await repo.listByStudent(student_uuid, { item_ref: item.item_ref });
      for (const override of overrides) {
        const deleted = await repo.delete(override.id);
        if (deleted) {
          deletedCount++;
        }
      }
    }
    
    logInfo('AlquimiaOverrideResetService', 'resetOverridesByListStudent completado', {
      traceId,
      student_uuid,
      list_id,
      deleted_count: deletedCount
    });
    
    return deletedCount;
  } catch (error) {
    logError('AlquimiaOverrideResetService', 'Error en resetOverridesByListStudent', {
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

/**
 * Resetea overrides de todos los items de una lista para TODOS los estudiantes.
 * REGLA CONSTITUCIONAL: Override ≠ cleaning state, Override ≠ reset
 * 
 * @param {Object} options - Opciones
 * @param {number} options.list_id - ID de la lista (OBLIGATORIO)
 * @param {string} [options.product_key='pde'] - Clave del producto (opcional)
 * @param {string} [options.domain_type] - Tipo de dominio (opcional)
 * @returns {Promise<number>} Número de overrides eliminados
 */
export async function resetOverridesByListAll(options) {
  const traceId = getRequestId();
  const { list_id, product_key = 'pde', domain_type = null } = options;
  
  try {
    // Validaciones obligatorias
    if (!list_id) {
      throw new Error('list_id es requerido');
    }
    
    logInfo('AlquimiaOverrideResetService', 'resetOverridesByListAll iniciado', {
      traceId,
      list_id,
      product_key,
      domain_type
    });
    
    // Obtener todos los items de la lista
    const catalogRepo = getDefaultAlquimiaCatalogRepo();
    const items = await catalogRepo.listItems(list_id, { onlyActive: true });
    
    // Eliminar overrides para cada item de la lista (todos los estudiantes)
    const queryFn = query;
    let deletedCount = 0;
    
    for (const item of items) {
      const result = await queryFn(`
        DELETE FROM student_item_overrides
        WHERE item_ref = $1
        RETURNING id
      `, [item.item_ref]);
      deletedCount += result.rows.length;
    }
    
    logInfo('AlquimiaOverrideResetService', 'resetOverridesByListAll completado', {
      traceId,
      list_id,
      deleted_count: deletedCount
    });
    
    return deletedCount;
  } catch (error) {
    logError('AlquimiaOverrideResetService', 'Error en resetOverridesByListAll', {
      traceId,
      error: error.message,
      code: error.code,
      stack: error.stack,
      list_id
    });
    throw error;
  }
}

/**
 * Resetea overrides según scope (función unificada).
 * REGLA CONSTITUCIONAL: Override ≠ cleaning state, Override ≠ reset
 * 
 * @param {Object} options - Opciones
 * @param {string} options.reset_scope - Scope del reset ('ITEM_STUDENT' | 'ITEM_ALL' | 'LIST_STUDENT' | 'LIST_ALL')
 * @param {string} [options.student_uuid] - UUID canónico del estudiante (requerido para ITEM_STUDENT y LIST_STUDENT)
 * @param {string} [options.item_ref] - Referencia del item (requerido para ITEM_STUDENT e ITEM_ALL)
 * @param {number} [options.list_id] - ID de la lista (requerido para LIST_STUDENT y LIST_ALL)
 * @param {string} [options.product_key='pde'] - Clave del producto (opcional)
 * @param {string} [options.domain_type] - Tipo de dominio (opcional)
 * @returns {Promise<Object>} { applied: number, skipped: number, total: number, trace_id: string }
 */
export async function resetOverridesByScope(options) {
  const traceId = getRequestId();
  const { reset_scope, student_uuid, item_ref, list_id, product_key = 'pde', domain_type = null } = options;
  
  try {
    // Validaciones obligatorias
    if (!reset_scope) {
      throw new Error('reset_scope es requerido');
    }
    
    const validScopes = ['ITEM_STUDENT', 'ITEM_ALL', 'LIST_STUDENT', 'LIST_ALL'];
    if (!validScopes.includes(reset_scope)) {
      throw new Error(`reset_scope inválido: "${reset_scope}". Debe ser uno de: ${validScopes.join(', ')}`);
    }
    
    logInfo('AlquimiaOverrideResetService', '[OVERRIDE_RESET][SCOPE] resetOverridesByScope iniciado', {
      traceId,
      reset_scope,
      student_uuid,
      item_ref,
      list_id,
      product_key,
      domain_type
    });
    
    let applied = 0;
    let skipped = 0;
    
    switch (reset_scope) {
      case 'ITEM_STUDENT':
        if (!student_uuid || !item_ref) {
          throw new Error('student_uuid e item_ref son requeridos para ITEM_STUDENT');
        }
        applied = await resetOverridesByStudentItem({ student_uuid, item_ref, product_key, domain_type });
        break;
        
      case 'ITEM_ALL':
        if (!item_ref) {
          throw new Error('item_ref es requerido para ITEM_ALL');
        }
        applied = await resetOverridesByItemAll({ item_ref, product_key, domain_type });
        break;
        
      case 'LIST_STUDENT':
        if (!student_uuid || !list_id) {
          throw new Error('student_uuid y list_id son requeridos para LIST_STUDENT');
        }
        applied = await resetOverridesByListStudent({ student_uuid, list_id, product_key, domain_type });
        break;
        
      case 'LIST_ALL':
        if (!list_id) {
          throw new Error('list_id es requerido para LIST_ALL');
        }
        applied = await resetOverridesByListAll({ list_id, product_key, domain_type });
        break;
        
      default:
        throw new Error(`reset_scope no soportado: ${reset_scope}`);
    }
    
    logInfo('AlquimiaOverrideResetService', '[OVERRIDE_RESET][APPLIED] resetOverridesByScope completado', {
      traceId,
      reset_scope,
      applied,
      skipped,
      total: applied + skipped
    });
    
    return {
      applied,
      skipped,
      total: applied + skipped,
      trace_id: traceId
    };
  } catch (error) {
    logError('AlquimiaOverrideResetService', 'Error en resetOverridesByScope', {
      traceId,
      error: error.message,
      code: error.code,
      stack: error.stack,
      reset_scope,
      student_uuid,
      item_ref,
      list_id
    });
    throw error;
  }
}
