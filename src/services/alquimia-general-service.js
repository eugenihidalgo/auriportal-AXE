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
        
        // Obtener todos los estados de cleaning_item_state para este item_ref (solo SHARED, solo activos)
        const statesResult = await query(
          `SELECT student_id, shared_completed 
           FROM cleaning_item_state 
           WHERE item_ref = $1 AND product_key = 'pde' AND domain_type = 'transmutacion'
           AND student_id NOT IN (
             SELECT alumno_id FROM pausas WHERE fin IS NULL
           )`,
          [itemActual.item_ref]
        );
        
        // Actualizar remaining para cada estudiante
        let updated = 0;
        for (const row of statesResult.rows) {
          const completed = row.shared_completed || 0;
          const newRemaining = Math.max(patch.veces_limpiar - completed, 0);
          
          await setRemainingShared({
            student_id: row.student_id,
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
 * LEE DESDE CLEANING ENGINE v1 cuando se especifica clean_layer
 * Mantiene compatibilidad con student_item_state cuando no se especifica
 * 
 * @param {string} itemRef - item_ref del item
 * @param {string} tipo - Tipo del item ('recurrente' o 'una_vez')
 * @param {string} [productKey='pde'] - Clave del producto
 * @param {Object} [options] - Opciones adicionales (limit, offset, clean_layer)
 * @param {string} [options.clean_layer] - Capa de limpieza ('shared' | 'pde'). Si se especifica, lee desde cleaning_item_state
 * @returns {Promise<Object>} Objeto con students, counts, total
 */
export async function getStudentsForItem(itemRef, tipo, productKey = 'pde', options = {}) {
  if (!itemRef || !tipo) {
    return { students: [], counts: {}, total: 0 };
  }
  
  const traceId = getRequestId();
  const { clean_layer, ...otherOptions } = options;
  
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

    // Si se especifica clean_layer, leer desde Cleaning Engine
    let rawResult;
    if (clean_layer) {
      logInfo('AlquimiaGeneralService', '[GET_STUDENTS] Leyendo desde Cleaning Engine', {
        traceId,
        itemRef,
        tipo,
        clean_layer,
        productKey
      });
      const repo = getDefaultMasterStudentTransmutationReadRepo();
      rawResult = await repo.getStudentsForItemFromCleaningEngine(
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
    } else {
      // Compatibilidad: leer desde student_item_state (legacy)
      const repo = getDefaultMasterStudentTransmutationReadRepo();
      rawResult = await repo.getStudentsForItemRaw(itemRef, tipo, productKey, otherOptions);
    }

    // Filtrar por nivel efectivo y pausa (si clean_layer está especificado)
    const studentsFiltered = [];
    const studentsNoAplica = []; // Alumnos cuyo nivel no aplica
    
    for (const student of rawResult.students) {
      // Verificar pausa (si clean_layer está especificado, ya está filtrado en query, pero verificamos por seguridad)
      if (clean_layer) {
        const pausaRepo = getDefaultPausaRepo();
        const pausaActiva = await pausaRepo.getPausaActiva(student.student_id);
        if (pausaActiva) {
          continue; // Saltar alumnos en pausa
        }
      }
      
      // Verificar nivel efectivo
      const nivelEfectivo = await getStudentEffectiveLevel(student.student_id);
      if (item.nivel && item.nivel > nivelEfectivo) {
        // No aplica por nivel
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
export async function markCleanStudent(studentId, itemRef, productKey = 'pde', cleanLayer = 'shared') {
  if (!studentId || !itemRef) return null;
  
  const traceId = getRequestId();
  
  try {
    // Delegar al Cleaning Engine v1 (single decider)
    const { markCleanStudent: cleaningMarkClean } = await import('../core/master/services/cleaning-engine-service.js');
    
    const result = await cleaningMarkClean({
      student_id: studentId,
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
    
    // Mantener señales legacy para compatibilidad (el Cleaning Engine ya emite señales)
    if (result) {
      try {
        const { emitSignal } = await import('./pde-signal-emitter.js');
        
        // origin.executed - Se ejecutó la limpieza (backward compat)
        await emitSignal('origin.executed', {
          origin_key: `alquimia:item:${itemRef}`,
          item_ref: itemRef,
          student_id: studentId,
          product_key: productKey,
          execution_mode: 'recurrent',
          actor: 'master',
          clean_layer: cleanLayer
        }, {}, {}, {
          trace_id: traceId,
          source: 'alquimia-general-service',
          action: 'markCleanStudent'
        });
        
        // origin.completed - Se completó la limpieza (backward compat)
        await emitSignal('origin.completed', {
          origin_key: `alquimia:item:${itemRef}`,
          item_ref: itemRef,
          student_id: studentId,
          product_key: productKey,
          execution_mode: 'recurrent',
          actor: 'master',
          clean_layer: cleanLayer
        }, {}, {}, {
          trace_id: traceId,
          source: 'alquimia-general-service',
          action: 'markCleanStudent'
        });
      } catch (signalError) {
        // No fallar si las señales fallan (fail-open)
        logWarn('AlquimiaGeneralService', 'Error emitiendo señales legacy (fail-open)', {
          traceId,
          error: signalError.message,
          itemRef,
          studentId
        });
      }
    }
    
    return result;
  } catch (error) {
    logError('AlquimiaGeneralService', 'Error en markCleanStudent', {
      traceId,
      error: error.message,
      code: error.code,
      stack: error.stack,
      studentId,
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
    
    // Mantener señales legacy para compatibilidad (el Cleaning Engine ya emite señales)
    if (result && result.updated > 0) {
      try {
        const { emitSignal } = await import('./pde-signal-emitter.js');
        
        // origin.executed - Se ejecutó la limpieza (backward compat)
        await emitSignal('origin.executed', {
          origin_key: `alquimia:item:${itemRef}`,
          item_ref: itemRef,
          product_key: productKey,
          execution_mode: 'recurrent',
          actor: 'master',
          scope: 'all',
          students_updated: result.updated,
          clean_layer: cleanLayer
        }, {}, {}, {
          trace_id: traceId,
          source: 'alquimia-general-service',
          action: 'markCleanAll'
        });
        
        // origin.completed - Se completó la limpieza (backward compat)
        await emitSignal('origin.completed', {
          origin_key: `alquimia:item:${itemRef}`,
          item_ref: itemRef,
          product_key: productKey,
          execution_mode: 'recurrent',
          actor: 'master',
          scope: 'all',
          students_updated: result.updated,
          clean_layer: cleanLayer
        }, {}, {}, {
          trace_id: traceId,
          source: 'alquimia-general-service',
          action: 'markCleanAll'
        });
      } catch (signalError) {
        // No fallar si las señales fallan (fail-open)
        logWarn('AlquimiaGeneralService', 'Error emitiendo señales legacy (fail-open)', {
          traceId,
          error: signalError.message,
          itemRef
        });
      }
    }
    
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
    const { incrementAllStudents: cleaningIncrementAll } = await import('../core/master/services/cleaning-engine-service.js');
    
    const result = await cleaningIncrementAll({
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
 * @param {number} studentId - ID del alumno
 * @param {string} itemRef - item_ref del item
 * @param {number} remaining - Nuevo valor de remaining
 * @param {string} [productKey='pde'] - Clave del producto
 * @returns {Promise<Object|null>} Estado actualizado o null si no existe/está pausado
 */
export async function adjustRemaining(studentId, itemRef, remaining, productKey = 'pde') {
  if (!studentId || !itemRef || remaining === undefined) return null;
  
  const traceId = getRequestId();
  
  try {
    // Delegar al Cleaning Engine v1 (single decider)
    const { setRemainingShared: cleaningSetRemaining } = await import('../core/master/services/cleaning-engine-service.js');
    
    return await cleaningSetRemaining({
      student_id: studentId,
      item_ref: itemRef,
      remaining,
      product_key: productKey,
      domain_type: 'transmutation',
      actor_type: 'master',
      surface_key: 'master.alquimia_general',
      meta: {
        source: 'alquimia-general-service',
        legacy_call: true
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
    
    // Obtener lista de alumnos (query directa para log)
    const { query } = await import('../../database/pg.js');
    const alumnosResult = await query('SELECT id FROM alumnos', []);
    const studentIds = alumnosResult.rows.map(row => row.id);
    
    const logRepo = getDefaultPdeDailyCleanLogRepo();
    const logResult = await logRepo.insertManyDailyLogs({
      cleaned_date: cleanedDateStr,
      item_ref: itemRef,
      student_ids: studentIds,
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
    try {
      const { emitSignal } = await import('./pde-signal-emitter.js');
      
      await emitSignal('clean.executed', {
        signal: 'clean.executed',
        scope: 'pde_daily',
        student_id: null,
        item_id: itemId,
        item_ref: itemRef,
        domain: 'transmutation',
        product_key: productKey,
        source: 'master',
        clean_layer: 'pde',
        executed_at: cleanedDate.toISOString(),
        cleaned_date: cleanedDateStr
      }, {}, {}, {
        trace_id: traceId,
        source: 'alquimia-general-service',
        action: 'markPdeCleanAll'
      });
    } catch (signalError) {
      logWarn('AlquimiaGeneralService', 'Error emitiendo señales legacy (fail-open)', {
        traceId,
        error: signalError.message,
        itemRef
      });
    }
    
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
