// src/services/alquimia-general-service.js
// Servicio de negocio para Alquimia General (MASTER)
//
// Responsabilidades:
// - Devolver listas e items canónicos
// - Filtrar por status='active'
// - PostgreSQL como única autoridad
// - Soft delete vía status='archived'

import { getDefaultAlquimiaCatalogRepo } from '../infra/repos/alquimia-catalog-repo-pg.js';
import { getDefaultMasterStudentTransmutationReadRepo } from '../infra/repos/master-student-transmutation-read-repo-pg.js';
import { getDefaultPdeDailyCleanLogRepo } from '../infra/repos/pde-daily-clean-log-repo-pg.js';
import { getDefaultPdeTransmutationItemGroupsRepo } from '../infra/repos/pde-transmutation-item-groups-repo-pg.js';

/**
 * Lista listas de transmutaciones según filtros
 * 
 * @param {Object} options - Opciones de filtrado
 * @param {boolean} [options.onlyActive=true] - Si filtrar solo activos (default: true)
 * @param {string} [options.tipo] - Filtrar por tipo ('recurrente' o 'una_vez')
 * @returns {Promise<Array>} Array de listas
 */
import { getRequestId } from '../core/observability/request-context.js';
import { logError, logInfo } from '../core/observability/logger.js';

export async function listListas(options = {}) {
  const traceId = getRequestId();
  try {
    logInfo('AlquimiaGeneralService', 'listListas iniciado', { traceId, options });
    
    const repo = getDefaultAlquimiaCatalogRepo();
    if (!repo) {
      throw new Error('No se pudo obtener repositorio de catálogo');
    }
    
    logInfo('AlquimiaGeneralService', 'listListas - repo obtenido', { traceId });
    
    const result = await repo.listListas({
      onlyActive: options.onlyActive !== undefined ? options.onlyActive : true,
      tipo: options.tipo
    });
    
    logInfo('AlquimiaGeneralService', 'listListas completado', { 
      traceId, 
      count: result?.length || 0 
    });
    
    return result;
  } catch (error) {
    logError('AlquimiaGeneralService', 'Error en listListas', {
      traceId,
      error: error.message,
      code: error.code,
      stack: error.stack,
      options
    });
    throw error;
  }
}

/**
 * Obtiene una lista por ID
 * 
 * @param {string|number} id - ID de la lista
 * @returns {Promise<Object|null>} Lista o null si no existe
 */
export async function getListaById(id) {
  if (!id) return null;
  
  const repo = getDefaultAlquimiaCatalogRepo();
  return await repo.getListaById(id);
}

/**
 * Crea una nueva lista
 * 
 * @param {Object} listaData - Datos de la lista a crear
 * @returns {Promise<Object>} Lista creada
 * @throws {Error} Si hay error de validación
 */
export async function createLista(listaData) {
  const traceId = getRequestId();
  try {
    logInfo('AlquimiaGeneralService', 'createLista iniciado', { traceId, listaData });
    
    const repo = getDefaultAlquimiaCatalogRepo();
    if (!repo) {
      throw new Error('No se pudo obtener repositorio de catálogo');
    }
    
    logInfo('AlquimiaGeneralService', 'createLista - repo obtenido', { traceId });
    
    const result = await repo.createLista(listaData);
    
    logInfo('AlquimiaGeneralService', 'createLista completado', { 
      traceId, 
      lista_id: result?.id 
    });
    
    return result;
  } catch (error) {
    logError('AlquimiaGeneralService', 'Error en createLista', {
      traceId,
      error: error.message,
      code: error.code,
      stack: error.stack,
      listaData
    });
    throw error;
  }
}

/**
 * Actualiza metadata de una lista
 * 
 * @param {string|number} id - ID de la lista
 * @param {Object} patch - Campos a actualizar (parcial)
 * @returns {Promise<Object|null>} Lista actualizada o null si no existe
 */
export async function updateListaMeta(id, patch) {
  if (!id) return null;
  
  const repo = getDefaultAlquimiaCatalogRepo();
  return await repo.updateListaMeta(id, patch);
}

/**
 * Archiva una lista (soft delete)
 * 
 * @param {string|number} id - ID de la lista
 * @returns {Promise<Object|null>} Lista archivada o null si no existe
 */
export async function archiveLista(id) {
  if (!id) return null;
  
  const repo = getDefaultAlquimiaCatalogRepo();
  return await repo.archiveLista(id);
}

/**
 * Lista todos los items de una lista
 * LEY ABSOLUTA: ORDER BY nivel ASC, created_at ASC
 * 
 * @param {string|number} listaId - ID de la lista
 * @param {Object} options - Opciones de filtrado
 * @param {boolean} [options.onlyActive=true] - Si filtrar solo activos
 * @returns {Promise<Array>} Array de items (ordenados por nivel ASC, created_at ASC)
 */
export async function listItems(listaId, options = {}) {
  if (!listaId) return [];
  
  const repo = getDefaultAlquimiaCatalogRepo();
  return await repo.listItems(listaId, options);
}

/**
 * Obtiene un item por ID
 * 
 * @param {string|number} id - ID del item
 * @returns {Promise<Object|null>} Item o null si no existe
 */
export async function getItemById(id) {
  if (!id) return null;
  
  const repo = getDefaultAlquimiaCatalogRepo();
  return await repo.getItemById(id);
}

/**
 * Obtiene un item por item_ref
 * 
 * @param {string} itemRef - item_ref del item
 * @returns {Promise<Object|null>} Item o null si no existe
 */
export async function getItemByRef(itemRef) {
  if (!itemRef) return null;
  
  const repo = getDefaultAlquimiaCatalogRepo();
  return await repo.getItemByRef(itemRef);
}

/**
 * Crea un nuevo item
 * 
 * @param {Object} itemData - Datos del item a crear
 * @returns {Promise<Object>} Item creado
 */
/**
 * Crea un nuevo item
 * Genera item_ref automáticamente si no viene definido
 * 
 * @param {Object} itemData - Datos del item a crear
 * @returns {Promise<Object>} Item creado
 * @throws {Error} Si hay error de validación
 */
export async function createItem(itemData) {
  const traceId = getRequestId();
  try {
    logInfo('AlquimiaGeneralService', 'createItem iniciado', { traceId, itemData: { ...itemData, item_ref: itemData.item_ref ? 'provided' : 'missing' } });
    
    // FIX CRÍTICO: Generar item_ref automáticamente si no viene definido
    // item_ref NO debe venir del frontend, se genera en backend
    if (!itemData.item_ref) {
      // Generar item_ref único: formato lista_id_timestamp
      // Usar timestamp para garantizar unicidad
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8); // 6 caracteres aleatorios
      itemData.item_ref = `item_${itemData.lista_id}_${timestamp}_${randomSuffix}`;
      
      logInfo('AlquimiaGeneralService', 'item_ref generado automáticamente', { 
        traceId, 
        item_ref: itemData.item_ref,
        lista_id: itemData.lista_id
      });
    }
    
    // Validar que item_ref es string no vacío
    if (!itemData.item_ref || typeof itemData.item_ref !== 'string' || itemData.item_ref.trim() === '') {
      throw new Error('item_ref debe ser un string no vacío');
    }
    
    // Manejar grupo: asegurar que existe en SOT
    if (itemData.grupo && typeof itemData.grupo === 'string' && itemData.grupo.trim() !== '') {
      const groupsRepo = getDefaultPdeTransmutationItemGroupsRepo();
      await groupsRepo.ensureGroup(itemData.grupo.trim());
      itemData.grupo = itemData.grupo.trim();
    } else {
      itemData.grupo = null;
    }
    
    // Default frecuencia_dias = 20 para recurrentes (solo en create si viene null o undefined)
    // Obtener tipo de lista para saber si aplicar default
    const lista = await getListaById(itemData.lista_id);
    if (lista && lista.tipo === 'recurrente') {
      if (itemData.frecuencia_dias === null || itemData.frecuencia_dias === undefined) {
        itemData.frecuencia_dias = 20;
        logInfo('AlquimiaGeneralService', 'Default frecuencia_dias=20 aplicado', { traceId, lista_id: itemData.lista_id });
      }
    }
    
    const repo = getDefaultAlquimiaCatalogRepo();
    const result = await repo.createItem(itemData);
    
    logInfo('AlquimiaGeneralService', 'createItem completado', { 
      traceId, 
      item_id: result?.id,
      item_ref: result?.item_ref,
      grupo: result?.grupo
    });
    
    return result;
  } catch (error) {
    logError('AlquimiaGeneralService', 'Error en createItem', {
      traceId,
      error: error.message,
      code: error.code,
      stack: error.stack,
      itemData: { ...itemData, item_ref: itemData.item_ref ? 'provided' : 'missing' }
    });
    throw error;
  }
}

/**
 * Actualiza un item
 * 
 * @param {string|number} id - ID del item
 * @param {Object} patch - Campos a actualizar (parcial)
 * @returns {Promise<Object|null>} Item actualizado o null si no existe
 */
export async function updateItem(id, patch) {
  if (!id) return null;
  
  const traceId = getRequestId();
  
  try {
    // Obtener item actual para verificar tipo y veces_limpiar anterior
    const repo = getDefaultAlquimiaCatalogRepo();
    const itemActual = await repo.getItemById(id);
    if (!itemActual) {
      throw new Error(`Item no encontrado: ${id}`);
    }
    
    // Manejar grupo: asegurar que existe en SOT si viene en patch
    if ('grupo' in patch) {
      if (patch.grupo && typeof patch.grupo === 'string' && patch.grupo.trim() !== '') {
        const groupsRepo = getDefaultPdeTransmutationItemGroupsRepo();
        await groupsRepo.ensureGroup(patch.grupo.trim());
        patch.grupo = patch.grupo.trim();
      } else {
        // '' o null => null
        patch.grupo = null;
      }
    }
    
    // Normalizar frecuencia_dias: '' => null (permitir null, pero UI mostrará 20 por defecto)
    if ('frecuencia_dias' in patch) {
      if (patch.frecuencia_dias === '' || patch.frecuencia_dias === null) {
        patch.frecuencia_dias = null;
      } else if (typeof patch.frecuencia_dias === 'string') {
        const parsed = parseInt(patch.frecuencia_dias, 10);
        patch.frecuencia_dias = Number.isFinite(parsed) && parsed >= 1 ? parsed : null;
      }
    }
    
    // Normalizar veces_limpiar: '' => null, validar >= 1
    let vecesLimpiarChanged = false;
    if ('veces_limpiar' in patch) {
      const oldVeces = itemActual.veces_limpiar;
      if (patch.veces_limpiar === '' || patch.veces_limpiar === null) {
        patch.veces_limpiar = null;
      } else if (typeof patch.veces_limpiar === 'string') {
        const parsed = parseInt(patch.veces_limpiar, 10);
        patch.veces_limpiar = Number.isFinite(parsed) && parsed >= 1 ? parsed : null;
      }
      vecesLimpiarChanged = patch.veces_limpiar !== oldVeces;
    }
    
    // Actualizar item
    const result = await repo.updateItem(id, patch);
    
    // Si cambió veces_limpiar y es una lista una_vez, recalcular remaining para todos los estudiantes
    if (vecesLimpiarChanged && itemActual.item_ref) {
      const lista = await getListaById(itemActual.lista_id);
      if (lista && lista.tipo === 'una_vez' && patch.veces_limpiar !== null) {
        logInfo('AlquimiaGeneralService', 'Recalculando remaining por cambio de veces_limpiar', {
          traceId,
          item_id: id,
          item_ref: itemActual.item_ref,
          old_veces: itemActual.veces_limpiar,
          new_veces: patch.veces_limpiar
        });
        
        // Recalcular remaining usando Cleaning Engine
        // remaining = max(required_count - completed, 0)
        const { setRemainingShared } = await import('../core/master/services/cleaning-engine-service.js');
        const { query } = await import('../../database/pg.js');
        
        // UUID-ONLY: Obtener todos los estados de cleaning_item_state para este item_ref (solo SHARED, solo activos)
        // Resolver student_uuid desde legacy_alumno_id
        const statesResult = await query(
          `SELECT s.id as student_uuid, c.shared_completed 
           FROM cleaning_item_state c
           INNER JOIN students s ON s.legacy_alumno_id = c.student_id AND s.deleted_at IS NULL
           LEFT JOIN pausas p ON p.alumno_id = c.student_id AND p.fin IS NULL
           WHERE c.item_ref = $1 
             AND c.product_key = 'pde' 
             AND c.domain_type = 'transmutacion'
             AND p.id IS NULL`,
          [itemActual.item_ref]
        );
        
        // Actualizar remaining para cada estudiante usando UUID
        let updated = 0;
        for (const row of statesResult.rows) {
          const completed = row.shared_completed || 0;
          const newRemaining = Math.max(patch.veces_limpiar - completed, 0);
          
          await setRemainingShared({
            student_uuid: row.student_uuid, // UUID canónico
            item_ref: itemActual.item_ref,
            remaining: newRemaining,
            actor_type: 'automation',
            actor_ref: 'system',
            surface_key: 'alquimia_general.update_required_count',
            product_key: 'pde',
            trace_id: traceId,
            meta: {
              reason: 'required_count_changed',
              old_required: itemActual.veces_limpiar,
              new_required: patch.veces_limpiar,
              completed
            }
          });
          updated++;
        }
        
        logInfo('AlquimiaGeneralService', 'remaining recalculado', {
          traceId,
          item_ref: itemActual.item_ref,
          updated_count: updated
        });
      }
    }
    
    logInfo('AlquimiaGeneralService', 'updateItem completado', {
      traceId,
      item_id: id,
      grupo: patch.grupo,
      veces_limpiar_changed: vecesLimpiarChanged
    });
    
    return result;
  } catch (error) {
    logError('AlquimiaGeneralService', 'Error en updateItem', {
      traceId,
      error: error.message,
      item_id: id
    });
    throw error;
  }
}

/**
 * Lista grupos activos de items
 * 
 * @returns {Promise<Array<{value: string}>>} Array de grupos activos
 */
export async function listItemGroups() {
  const traceId = getRequestId();
  
  try {
    const groupsRepo = getDefaultPdeTransmutationItemGroupsRepo();
    const groups = await groupsRepo.listActiveGroups();
    
    logInfo('AlquimiaGeneralService', 'listItemGroups completado', {
      traceId,
      count: groups.length
    });
    
    return groups;
  } catch (error) {
    logError('AlquimiaGeneralService', 'Error en listItemGroups', {
      traceId,
      error: error.message
    });
    // Fail-open: devolver array vacío
    return [];
  }
}

/**
 * Archiva un item (soft delete)
 * 
 * @param {string|number} id - ID del item
 * @returns {Promise<Object|null>} Item archivado o null si no existe
 */
export async function archiveItem(id) {
  if (!id) return null;
  
  const repo = getDefaultAlquimiaCatalogRepo();
  return await repo.archiveItem(id);
}

/**
 * OPERACIONES MASTER - Estado de Alumnos
 */

/**
 * Obtiene estado de alumnos para un item
 * 
 * UUID-ONLY: Lee EXCLUSIVAMENTE desde Cleaning Engine v1 (cleaning_item_state)
 * 
 * REGLA CONSTITUCIONAL:
 * - clean_layer es OBLIGATORIO
 * - NO existe fallback a student_item_state (legacy eliminado)
 * - Alquimia es UUID-only, sin compatibilidad legacy
 * 
 * @param {string} itemRef - item_ref del item
 * @param {string} tipo - Tipo del item ('recurrente' o 'una_vez')
 * @param {string} [productKey='pde'] - Clave del producto
 * @param {Object} options - Opciones adicionales (limit, offset, clean_layer)
 * @param {string} options.clean_layer - Capa de limpieza ('shared' | 'pde') - OBLIGATORIO
 * @returns {Promise<Object>} Objeto con students, counts, total
 */
export async function getStudentsForItem(itemRef, tipo, productKey = 'pde', options = {}) {
  if (!itemRef || !tipo) {
    return { students: [], counts: {}, total: 0 };
  }
  
  const traceId = getRequestId();
  const { clean_layer, ...otherOptions } = options;
  
  // ============================================================================
  // GUARD CONSTITUCIONAL: clean_layer es OBLIGATORIO
  // ============================================================================
  if (!clean_layer) {
    const error = new Error('clean_layer is required. MASTER Alquimia is UUID-only and uses Cleaning Engine exclusively.');
    error.code = 'CLEAN_LAYER_REQUIRED';
    logError('AlquimiaGeneralService', 'Intento de usar getStudentsForItem sin clean_layer (legacy forbidden)', {
      traceId,
      itemRef,
      tipo
    });
    throw error;
  }
  // ============================================================================
  
  try {
    // Obtener item completo para threshold_days, critical_multiplier y nivel
    const item = await getItemByRef(itemRef);
    if (!item) {
      logError('AlquimiaGeneralService', 'Item no encontrado', {
        traceId,
        itemRef
      });
      return { students: [], counts: {}, total: 0 };
    }

    // Importar helper de nombres y helpers
    const { calculateStudentDisplayNames } = await import('../core/helpers/student-display-name-helper.js');
    const { getStudentEffectiveLevel } = await import('../core/master/services/cleaning-engine-service.js');
    const { getDefaultPausaRepo } = await import('../infra/repos/pausa-repo-pg.js');

    // UUID-ONLY: Leer EXCLUSIVAMENTE desde Cleaning Engine
    logInfo('AlquimiaGeneralService', '[GET_STUDENTS] Leyendo desde Cleaning Engine (UUID-only)', {
      traceId,
      itemRef,
      tipo,
      clean_layer,
      productKey
    });
    const repo = getDefaultMasterStudentTransmutationReadRepo();
    const rawResult = await repo.getStudentsForItemFromCleaningEngine(
      itemRef, 
      tipo, 
      clean_layer, 
      productKey, 
      otherOptions
    );
    logInfo('AlquimiaGeneralService', '[GET_STUDENTS] Resultado Cleaning Engine', {
      traceId,
      itemRef,
      clean_layer,
      students_count: rawResult.students?.length || 0,
      counts: rawResult.counts
    });

    // Filtrar por nivel efectivo y pausa (si clean_layer está especificado)
    // REGLA MASTER: Flotante Master NUNCA filtra por nivel (bypass si skip_level_filter=true)
    const skipLevelFilter = options.skip_level_filter === true; // Para contexto Master
    const studentsFiltered = [];
    const studentsNoAplica = []; // Alumnos cuyo nivel no aplica
    
    for (const student of rawResult.students) {
      // UUID-ONLY: Verificar pausa usando student_uuid
      // Nota: getStudentsForItemFromCleaningEngine ya filtra pausados, pero verificamos por seguridad
      if (clean_layer && student.student_uuid) {
        // Resolver legacy_id solo para verificar pausa (tabla pausas usa alumno_id)
        const { query } = await import('../database/pg.js');
        const studentResult = await query(
          'SELECT legacy_alumno_id FROM students WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
          [student.student_uuid]
        );
        if (studentResult.rows[0]?.legacy_alumno_id) {
          const pausaRepo = getDefaultPausaRepo();
          const pausaActiva = await pausaRepo.getPausaActiva(studentResult.rows[0].legacy_alumno_id);
          if (pausaActiva) {
            continue; // Saltar estudiantes en pausa
          }
        }
      }
      
      // UUID-ONLY: Verificar nivel efectivo usando student_uuid
      const nivelEfectivo = await getStudentEffectiveLevel(student.student_uuid);
      if (!skipLevelFilter && item.nivel && item.nivel > nivelEfectivo) {
        // No aplica por nivel (solo si NO es Master)
        studentsNoAplica.push({
          ...student,
          nivel_efectivo: nivelEfectivo,
          item_nivel: item.nivel,
          no_aplica: true
        });
        continue;
      }
      
      studentsFiltered.push({
        ...student,
        nivel_efectivo: nivelEfectivo,
        item_nivel: item.nivel
      });
    }

    // Calcular estados y nombres de display
    if (tipo === 'recurrente') {
      // Obtener threshold_days y critical_multiplier del item
      const thresholdDays = item.frecuencia_dias || 7; // Default 7 días
      const criticalMultiplier = item.critical_multiplier || 2.0; // Default 2.0
      const criticalThreshold = thresholdDays * criticalMultiplier;

      // Calcular estados y nombres
      const studentsWithState = await calculateStudentDisplayNames(studentsFiltered);
      
      const students = studentsWithState.map(student => {
        const daysSince = student.days_since_last_clean;
        
        let state;
        if (daysSince === null) {
          // Nunca limpiado → NUNCA (sección colapsable)
          state = 'never';
        } else if (daysSince < thresholdDays) {
          // Última ejecución < threshold_days → REVISADO
          state = 'reviewed';
        } else if (daysSince < criticalThreshold) {
          // threshold_days <= días < threshold_days * critical_multiplier → PENDIENTE
          state = 'pending';
        } else {
          // días >= threshold_days * critical_multiplier → IMPORTANTE REVISAR
          state = 'important';
        }

        return {
          ...student,
          state,
          threshold_days: thresholdDays,
          critical_multiplier: criticalMultiplier
        };
      });

      // Contar por estado
      const counts = {
        reviewed: students.filter(s => s.state === 'reviewed').length,
        pending: students.filter(s => s.state === 'pending').length,
        important: students.filter(s => s.state === 'important').length,
        never: students.filter(s => s.state === 'never').length
      };

      return {
        students,
        students_no_aplica: studentsNoAplica.length > 0 ? studentsNoAplica : undefined,
        counts,
        total: studentsFiltered.length,
        threshold_days: thresholdDays,
        critical_multiplier: criticalMultiplier,
        clean_layer: clean_layer || 'shared' // Default shared si no se especifica
      };
    } else {
      // una_vez - usar nombres de display
      const students = await calculateStudentDisplayNames(studentsFiltered);
      
      // Calcular estados para una_vez
      const studentsWithState = students.map(student => {
        const remaining = student.remaining !== null ? student.remaining : null;
        const completed = student.completed || 0;
        const isComplete = remaining !== null && remaining <= 0;
        
        return {
          ...student,
          state: isComplete ? 'completed' : 'pending',
          remaining,
          completed
        };
      });
      
      const counts = {
        completed: studentsWithState.filter(s => s.state === 'completed').length,
        pending: studentsWithState.filter(s => s.state === 'pending').length
      };
      
      return {
        students: studentsWithState,
        students_no_aplica: studentsNoAplica.length > 0 ? studentsNoAplica : undefined,
        counts,
        total: studentsFiltered.length,
        clean_layer: clean_layer || 'shared' // Default shared si no se especifica
      };
    }

  } catch (error) {
    logError('AlquimiaGeneralService', 'Error en getStudentsForItem', {
      traceId,
      error: error.message,
      code: error.code,
      stack: error.stack,
      itemRef,
      tipo,
      clean_layer: options.clean_layer
    });
    throw error;
  }
}

/**
 * Marca limpio un alumno específico (recurrente o una_vez)
 * 
 * DELEGADO AL CLEANING ENGINE v1 (single decider)
 * 
 * @param {number} studentId - ID del alumno
 * @param {string} itemRef - item_ref del item
 * @param {string} [productKey='pde'] - Clave del producto
 * @param {string} [cleanLayer='shared'] - Capa de limpieza ('shared' | 'pde')
 * @returns {Promise<Object|null>} Estado actualizado o null si no existe/está pausado
 */
export async function markCleanStudent(studentUuid, itemRef, productKey = 'pde', cleanLayer = 'shared') {
  if (!studentUuid || !itemRef) return null;
  
  const traceId = getRequestId();
  
  try {
    // Delegar al Cleaning Engine v1 (single decider) (CAMBIADO: pasa UUID)
    const { markCleanStudent: cleaningMarkClean } = await import('../core/master/services/cleaning-engine-service.js');
    
    const result = await cleaningMarkClean({
      student_uuid: studentUuid, // CAMBIADO: pasar UUID canónico
      item_ref: itemRef,
      clean_layer: cleanLayer,
      product_key: productKey,
      domain_type: 'transmutation',
      actor_type: 'master',
      surface_key: 'master.alquimia_general',
      // NOTA: item_kind debe venir en options si se llama desde endpoint
      // Este servicio legacy no recibe item_kind, pero el endpoint lo pasa directamente al Cleaning Engine
      meta: {
        source: 'alquimia-general-service'
      }
    });
    
    // ============================================================================
    // UUID-ONLY: Señales legacy eliminadas
    // El Cleaning Engine ya emite clean.executed (UUID-only)
    // NO se emiten señales duplicadas desde el servicio
    // ============================================================================
    
    return result;
  } catch (error) {
    logError('AlquimiaGeneralService', 'Error en markCleanStudent', {
      traceId,
      error: error.message,
      code: error.code,
      stack: error.stack,
      student_uuid: studentUuid, // CAMBIADO: usar UUID canónico
      itemRef
    });
    throw error;
  }
}

/**
 * Marca limpio todos los alumnos (recurrente o una_vez)
 * Limpieza GLOBAL: Master → Todos los alumnos
 * 
 * DELEGADO AL CLEANING ENGINE v1 (single decider)
 * 
 * @param {string} itemRef - item_ref del item
 * @param {string} [productKey='pde'] - Clave del producto
 * @param {string} [cleanLayer='shared'] - Capa de limpieza ('shared' | 'pde')
 * @returns {Promise<Object>} Objeto con { updated: number, skipped: number, total: number }
 */
export async function markCleanAll(itemRef, productKey = 'pde', cleanLayer = 'shared') {
  if (!itemRef) return { updated: 0, skipped: 0, total: 0 };
  
  const traceId = getRequestId();
  
  try {
    // Delegar al Cleaning Engine v1 (single decider)
    const { markCleanAllStudents: cleaningMarkCleanAll } = await import('../core/master/services/cleaning-engine-service.js');
    
    const result = await cleaningMarkCleanAll({
      item_ref: itemRef,
      clean_layer: cleanLayer,
      product_key: productKey,
      domain_type: 'transmutation',
      actor_type: 'master',
      surface_key: 'master.alquimia_general',
      meta: {
        source: 'alquimia-general-service',
        legacy_call: true
      }
    });
    
    // Asegurar que skipped_breakdown está presente
    if (!result.skipped_breakdown) {
      result.skipped_breakdown = {
        paused: 0,
        not_applicable_level: 0,
        already_clean: 0,
        missing_item: 0,
        no_change: 0,
        error: 0,
        other: 0
      };
    }
    
    // ============================================================================
    // UUID-ONLY: Señales legacy eliminadas
    // El Cleaning Engine ya emite clean.executed (UUID-only)
    // NO se emiten señales duplicadas desde el servicio
    // ============================================================================
    
    // Normalizar respuesta para compatibilidad (updated vs updated/skipped/total)
    return {
      updated: result.updated || 0,
      skipped: result.skipped || 0,
      total: result.total || 0
    };
  } catch (error) {
    logError('AlquimiaGeneralService', 'Error en markCleanAll', {
      traceId,
      error: error.message,
      code: error.code,
      stack: error.stack,
      itemRef
    });
    throw error;
  }
}

/**
 * Incrementa +1 todos los alumnos (una_vez)
 * 
 * DELEGADO AL CLEANING ENGINE v1 (single decider)
 * 
 * @param {string} itemRef - item_ref del item
 * @param {string} [productKey='pde'] - Clave del producto
 * @param {string} [cleanLayer='shared'] - Capa de limpieza ('shared' | 'pde')
 * @returns {Promise<Object>} Objeto con { updated: number, skipped: number, total: number }
 */
export async function incrementAll(itemRef, productKey = 'pde', cleanLayer = 'shared') {
  if (!itemRef) return { updated: 0, skipped: 0, total: 0 };
  
  const traceId = getRequestId();
  
  try {
    // Delegar al Cleaning Engine v1 (single decider)
    // CONTRATO LIMPIEZA v1: item_kind es REQUERIDO
    const { incrementAllStudents: cleaningIncrementAll } = await import('../core/master/services/cleaning-engine-service.js');
    
    const result = await cleaningIncrementAll({
      item_ref: itemRef,
      item_kind: 'una_vez', // REQUERIDO según contrato canónico
      clean_layer: cleanLayer,
      product_key: productKey,
      domain_type: 'transmutation',
      actor_type: 'master',
      surface_key: 'master.alquimia_general',
      skip_level_filter: true, // REGLA: Master increment-all NO filtra por nivel (puede incrementar cualquier item a cualquier alumno)
      meta: {
        source: 'alquimia-general-service'
      }
    });
    
    // Normalizar respuesta para compatibilidad
    return {
      updated: result.updated || 0,
      skipped: result.skipped || 0,
      total: result.total || 0
    };
  } catch (error) {
    logError('AlquimiaGeneralService', 'Error en incrementAll', {
      traceId,
      error: error.message,
      itemRef
    });
    throw error;
  }
}

/**
 * Ajusta remaining manualmente para un alumno (una_vez)
 * 
 * DELEGADO AL CLEANING ENGINE v1 (single decider)
 * 
 * @param {string} studentUuid - UUID canónico del estudiante (CAMBIADO: ahora acepta UUID)
 * @param {string} itemRef - item_ref del item
 * @param {number} remaining - Nuevo valor de remaining
 * @param {string} [productKey='pde'] - Clave del producto
 * @returns {Promise<Object|null>} Estado actualizado o null si no existe/está pausado
 */
export async function adjustRemaining(studentUuid, itemRef, remaining, productKey = 'pde') {
  if (!studentUuid || !itemRef || remaining === undefined) return null;
  
  const traceId = getRequestId();
  
  try {
    // Delegar al Cleaning Engine v1 (single decider)
    const { setRemainingShared: cleaningSetRemaining } = await import('../core/master/services/cleaning-engine-service.js');
    
    return await cleaningSetRemaining({
      student_uuid: studentUuid, // UUID canónico
      item_ref: itemRef,
      remaining,
      product_key: productKey,
      domain_type: 'transmutation',
      actor_type: 'master',
      surface_key: 'master.alquimia_general',
      meta: {
        source: 'alquimia-general-service'
      }
    });
  } catch (error) {
    logError('AlquimiaGeneralService', 'Error en adjustRemaining', {
      traceId,
      error: error.message,
      itemRef,
      studentId
    });
    throw error;
  }
}

/**
 * Marca limpieza PDE diaria para todos los alumnos (recurrente)
 * Diferente de markCleanAll: registra en pde_daily_item_clean_log (append-only SOT)
 * 
 * DELEGADO AL CLEANING ENGINE v1 con clean_layer='pde' + log adicional
 * 
 * @param {string} itemRef - item_ref del item
 * @param {string} [productKey='pde'] - Clave del producto
 * @param {Object} [ctx] - Contexto con actor_id (opcional)
 * @returns {Promise<Object>} Objeto con { updated_students, logged, skipped, cleaned_date }
 */
export async function markPdeCleanAll(itemRef, productKey = 'pde', ctx = {}) {
  if (!itemRef) return { updated_students: 0, logged: 0, skipped: 0, cleaned_date: null };
  
  const traceId = getRequestId();
  
  try {
    // Resolver itemRef → item_id
    const item = await getItemByRef(itemRef);
    if (!item || !item.id) {
      logError('AlquimiaGeneralService', 'Item no encontrado para markPdeCleanAll', {
        traceId,
        itemRef
      });
      return { updated_students: 0, logged: 0, skipped: 0, cleaned_date: null };
    }
    
    // Verificar que es recurrente (PDE solo para recurrentes)
    const lista = await getListaById(item.lista_id);
    if (!lista || lista.tipo !== 'recurrente') {
      logWarn('AlquimiaGeneralService', 'markPdeCleanAll solo soportado para recurrentes', {
        traceId,
        itemRef,
        tipo: lista?.tipo
      });
      return { updated_students: 0, logged: 0, skipped: 0, cleaned_date: null };
    }
    
    const itemId = item.id;
    
    // 1) Usar Cleaning Engine con clean_layer='pde'
    const { markCleanAllStudents: cleaningMarkCleanAll } = await import('../core/master/services/cleaning-engine-service.js');
    
    const cleaningResult = await cleaningMarkCleanAll({
      item_ref: itemRef,
      clean_layer: 'pde', // PDE layer
      product_key: productKey,
      domain_type: 'transmutation',
      actor_type: 'master',
      actor_ref: ctx.actor_id ? `master:${ctx.actor_id}` : null,
      surface_key: 'master.alquimia_general',
      meta: {
        source: 'alquimia-general-service',
        action: 'markPdeCleanAll',
        item_id: itemId,
        lista_id: item.lista_id
      }
    });
    
    const updatedStudents = cleaningResult.updated || 0;
    const skipped = cleaningResult.skipped || 0;
    const skippedBreakdown = cleaningResult.skipped_breakdown || {
      paused: 0,
      not_applicable_level: 0,
      already_clean: 0,
      missing_item: 0,
      no_change: 0,
      error: 0,
      other: 0
    };
    
    // 2) Insertar logs en pde_daily_item_clean_log (append-only SOT adicional)
    const cleanedDate = new Date();
    const cleanedDateStr = cleanedDate.toISOString().split('T')[0];
    
    // UUID-ONLY: Obtener lista de estudiantes (query directa para log)
    const { query } = await import('../../database/pg.js');
    const studentsResult = await query(
      'SELECT id as student_uuid FROM students WHERE deleted_at IS NULL', 
      []
    );
    const studentUuids = studentsResult.rows.map(row => row.student_uuid);
    
    const logRepo = getDefaultPdeDailyCleanLogRepo();
    // UUID-ONLY: Log usa student_uuid (el repo resuelve internamente si necesita legacy)
    const logResult = await logRepo.insertManyDailyLogs({
      cleaned_date: cleanedDateStr,
      item_ref: itemRef,
      student_uuid: studentUuids, // UUID canónico
      actor_type: 'master',
      actor_id: ctx.actor_id || null,
      trace_id: traceId,
      meta: {
        item_id: itemId,
        lista_id: item.lista_id,
        product_key: productKey
      }
    });
    
    const logged = logResult.inserted || 0;
    const logSkipped = logResult.skipped || 0;
    
    // 3) Emitir señales (fail-open) - el Cleaning Engine ya emite, pero mantenemos señal legacy
    // UUID-ONLY: Señal legacy eliminada
    // El Cleaning Engine ya emite clean.executed (UUID-only)
    // NO se emiten señales duplicadas desde el servicio
    
    logInfo('AlquimiaGeneralService', '[PDE_CLEAN_ALL] markPdeCleanAll completado', {
      traceId,
      itemRef,
      item_id: itemId,
      lista_id: item.lista_id,
      lista_tipo: lista.tipo,
      clean_layer: 'pde',
      updated_students: updatedStudents,
      logged,
      log_skipped: logSkipped,
      cleaning_skipped: skipped,
      skipped_breakdown: skippedBreakdown,
      cleaned_date: cleanedDateStr
    });
    
    return {
      updated_students: updatedStudents,
      logged,
      skipped: skipped, // skipped del cleaning result (no del log)
      cleaned_date: cleanedDateStr,
      skipped_breakdown: skippedBreakdown
    };
  } catch (error) {
    logError('AlquimiaGeneralService', 'Error en markPdeCleanAll', {
      traceId,
      error: error.message,
      code: error.code,
      stack: error.stack,
      itemRef
    });
    throw error;
  }
}
