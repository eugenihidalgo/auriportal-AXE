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
    
    const repo = getDefaultAlquimiaCatalogRepo();
    const result = await repo.updateItem(id, patch);
    
    logInfo('AlquimiaGeneralService', 'updateItem completado', {
      traceId,
      item_id: id,
      grupo: patch.grupo
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
 * @param {string} itemRef - item_ref del item
 * @param {string} tipo - Tipo del item ('recurrente' o 'una_vez')
 * @param {string} [productKey='pde'] - Clave del producto
 * @param {Object} [options] - Opciones adicionales (limit, offset)
 * @returns {Promise<Object>} Objeto con students, counts, total
 */
export async function getStudentsForItem(itemRef, tipo, productKey = 'pde', options = {}) {
  if (!itemRef || !tipo) {
    return { students: [], counts: {}, total: 0 };
  }
  
  const traceId = getRequestId();
  
  try {
    // Obtener item completo para threshold_days y critical_multiplier
    const item = await getItemByRef(itemRef);
    if (!item) {
      logError('AlquimiaGeneralService', 'Item no encontrado', {
        traceId,
        itemRef
      });
      return { students: [], counts: {}, total: 0 };
    }

    // Usar repo MASTER (sin dependencias STUDENT)
    const repo = getDefaultMasterStudentTransmutationReadRepo();
    const rawResult = await repo.getStudentsForItemRaw(itemRef, tipo, productKey, options);

    // Importar helper de nombres
    const { calculateStudentDisplayNames } = await import('../core/helpers/student-display-name-helper.js');

    // Calcular estados y nombres de display
    if (tipo === 'recurrente') {
      // Obtener threshold_days y critical_multiplier del item
      const thresholdDays = item.frecuencia_dias || 7; // Default 7 días
      const criticalMultiplier = item.critical_multiplier || 2.0; // Default 2.0
      const criticalThreshold = thresholdDays * criticalMultiplier;

      // Calcular estados y nombres
      const studentsWithState = await calculateStudentDisplayNames(rawResult.students);
      
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
        counts,
        total: rawResult.total,
        threshold_days: thresholdDays,
        critical_multiplier: criticalMultiplier
      };
    } else {
      // una_vez - usar nombres de display
      const students = await calculateStudentDisplayNames(rawResult.students);
      
      return {
        students,
        counts: rawResult.counts,
        total: rawResult.total
      };
    }

  } catch (error) {
    logError('AlquimiaGeneralService', 'Error en getStudentsForItem', {
      traceId,
      error: error.message,
      code: error.code,
      stack: error.stack,
      itemRef,
      tipo
    });
    throw error;
  }
}

/**
 * Marca limpio un alumno específico (recurrente)
 * 
 * @param {number} studentId - ID del alumno
 * @param {string} itemRef - item_ref del item
 * @param {string} [productKey='pde'] - Clave del producto
 * @returns {Promise<Object|null>} Estado actualizado o null si no existe
 */
export async function markCleanStudent(studentId, itemRef, productKey = 'pde') {
  if (!studentId || !itemRef) return null;
  
  const traceId = getRequestId();
  
  try {
    // Resolver itemRef → item_id (obligatorio: student_item_state requiere item_id NOT NULL)
    const item = await getItemByRef(itemRef);
    if (!item || !item.id) {
      logError('AlquimiaGeneralService', 'Item no encontrado para markCleanStudent', {
        traceId,
        itemRef,
        studentId
      });
      return null;
    }
    
    const itemId = item.id;
    
    // Usar repo MASTER (sin dependencias STUDENT)
    // domain_key canónico para transmutaciones energéticas
    const domainKey = 'transmutaciones_energeticas';
    const repo = getDefaultMasterStudentTransmutationReadRepo();
    const result = await repo.markCleanStudent(studentId, itemId, productKey, domainKey);
    
    if (result) {
      // Emitir señales según Origin Contract v1
      try {
        const { emitSignal } = await import('./pde-signal-emitter.js');
        
        // clean.executed - Señal canónica de limpieza ejecutada
        await emitSignal('clean.executed', {
          signal: 'clean.executed',
          scope: 'student',
          student_id: studentId,
          item_id: itemId,
          item_ref: itemRef,
          domain: 'transmutation',
          product_key: productKey,
          source: 'master',
          executed_at: new Date().toISOString()
        }, {}, {}, {
          trace_id: traceId,
          source: 'alquimia-general-service',
          action: 'markCleanStudent'
        });
        
        // origin.executed - Se ejecutó la limpieza
        await emitSignal('origin.executed', {
          origin_key: `alquimia:item:${itemRef}`,
          item_ref: itemRef,
          student_id: studentId,
          product_key: productKey,
          execution_mode: 'recurrent',
          actor: 'master'
        }, {}, {}, {
          trace_id: traceId,
          source: 'alquimia-general-service',
          action: 'markCleanStudent'
        });
        
        // origin.completed - Se completó la limpieza (marcado como revisado)
        await emitSignal('origin.completed', {
          origin_key: `alquimia:item:${itemRef}`,
          item_ref: itemRef,
          student_id: studentId,
          product_key: productKey,
          execution_mode: 'recurrent',
          actor: 'master'
        }, {}, {}, {
          trace_id: traceId,
          source: 'alquimia-general-service',
          action: 'markCleanStudent'
        });
        
        logInfo('AlquimiaGeneralService', 'Señales emitidas para markCleanStudent', {
          traceId,
          itemRef,
          studentId
        });
      } catch (signalError) {
        // No fallar si las señales fallan (fail-open)
        logError('AlquimiaGeneralService', 'Error emitiendo señales en markCleanStudent', {
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
 * Marca limpio todos los alumnos (recurrente)
 * Limpieza GLOBAL: Master → Todos los alumnos
 * 
 * @param {string} itemRef - item_ref del item
 * @param {string} [productKey='pde'] - Clave del producto
 * @returns {Promise<Object>} Objeto con { updated: number }
 */
export async function markCleanAll(itemRef, productKey = 'pde') {
  if (!itemRef) return { updated: 0 };
  
  const traceId = getRequestId();
  
  try {
    // Resolver itemRef → item_id (obligatorio: student_item_state requiere item_id NOT NULL)
    const item = await getItemByRef(itemRef);
    if (!item || !item.id) {
      logError('AlquimiaGeneralService', 'Item no encontrado para markCleanAll', {
        traceId,
        itemRef
      });
      return { updated: 0 };
    }
    
    const itemId = item.id;
    
    // Usar repo MASTER (sin dependencias STUDENT)
    // domain_key canónico para transmutaciones energéticas
    const domainKey = 'transmutaciones_energeticas';
    const repo = getDefaultMasterStudentTransmutationReadRepo();
    const result = await repo.markCleanAll(itemId, productKey, domainKey);
    
    if (result && result.updated > 0) {
      // Emitir señales según Origin Contract v1
      // Para limpieza global, emitimos señales por cada alumno actualizado
      try {
        const { emitSignal } = await import('./pde-signal-emitter.js');
        
        // clean.executed - Señal canónica de limpieza ejecutada (global)
        await emitSignal('clean.executed', {
          signal: 'clean.executed',
          scope: 'all',
          student_id: null, // null para scope 'all'
          item_id: itemId,
          item_ref: itemRef,
          domain: 'transmutation',
          product_key: productKey,
          source: 'master',
          executed_at: new Date().toISOString()
        }, {}, {}, {
          trace_id: traceId,
          source: 'alquimia-general-service',
          action: 'markCleanAll'
        });
        
        // Obtener lista de alumnos actualizados para emitir señales individuales
        // Por ahora, emitimos señal global (puede optimizarse después)
        await emitSignal('origin.executed', {
          origin_key: `alquimia:item:${itemRef}`,
          item_ref: itemRef,
          product_key: productKey,
          execution_mode: 'recurrent',
          actor: 'master',
          scope: 'all',
          students_updated: result.updated
        }, {}, {}, {
          trace_id: traceId,
          source: 'alquimia-general-service',
          action: 'markCleanAll'
        });
        
        await emitSignal('origin.completed', {
          origin_key: `alquimia:item:${itemRef}`,
          item_ref: itemRef,
          product_key: productKey,
          execution_mode: 'recurrent',
          actor: 'master',
          scope: 'all',
          students_updated: result.updated
        }, {}, {}, {
          trace_id: traceId,
          source: 'alquimia-general-service',
          action: 'markCleanAll'
        });
        
        logInfo('AlquimiaGeneralService', 'Señales emitidas para markCleanAll', {
          traceId,
          itemRef,
          updated: result.updated
        });
      } catch (signalError) {
        // No fallar si las señales fallan (fail-open)
        logError('AlquimiaGeneralService', 'Error emitiendo señales en markCleanAll', {
          traceId,
          error: signalError.message,
          itemRef
        });
      }
    }
    
    return result;
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
 * @param {string} itemRef - item_ref del item
 * @param {string} [productKey='pde'] - Clave del producto
 * @returns {Promise<Object>} Objeto con { updated: number }
 */
export async function incrementAll(itemRef, productKey = 'pde') {
  if (!itemRef) return { updated: 0 };
  
  const traceId = getRequestId();
  
  try {
    // Resolver itemRef → item_id (obligatorio: student_item_state requiere item_id NOT NULL)
    const item = await getItemByRef(itemRef);
    if (!item || !item.id) {
      logError('AlquimiaGeneralService', 'Item no encontrado para incrementAll', {
        traceId: getRequestId(),
        itemRef
      });
      return { updated: 0 };
    }
    
    const itemId = item.id;
    
    // Usar repo MASTER (sin dependencias STUDENT)
    // domain_key canónico para transmutaciones energéticas
    const domainKey = 'transmutaciones_energeticas';
    const repo = getDefaultMasterStudentTransmutationReadRepo();
    return await repo.incrementAll(itemId, productKey, domainKey);
  } catch (error) {
    logError('AlquimiaGeneralService', 'Error en incrementAll', {
      traceId: getRequestId(),
      error: error.message,
      itemRef
    });
    throw error;
  }
}

/**
 * Ajusta remaining manualmente para un alumno (una_vez)
 * 
 * @param {number} studentId - ID del alumno
 * @param {string} itemRef - item_ref del item
 * @param {number} remaining - Nuevo valor de remaining
 * @param {string} [productKey='pde'] - Clave del producto
 * @returns {Promise<Object|null>} Estado actualizado o null si no existe
 */
export async function adjustRemaining(studentId, itemRef, remaining, productKey = 'pde') {
  if (!studentId || !itemRef || remaining === undefined) return null;
  
  const traceId = getRequestId();
  
  try {
    // Resolver itemRef → item_id (obligatorio: student_item_state requiere item_id NOT NULL)
    const item = await getItemByRef(itemRef);
    if (!item || !item.id) {
      logError('AlquimiaGeneralService', 'Item no encontrado para adjustRemaining', {
        traceId,
        itemRef,
        studentId
      });
      return null;
    }
    
    const itemId = item.id;
    
    // Usar repo MASTER (sin dependencias STUDENT)
    // domain_key canónico para transmutaciones energéticas
    const domainKey = 'transmutaciones_energeticas';
    const repo = getDefaultMasterStudentTransmutationReadRepo();
    return await repo.adjustRemaining(studentId, itemId, remaining, productKey, domainKey);
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
    
    // Obtener todos los alumnos (misma selección que markCleanAll)
    const domainKey = 'transmutaciones_energeticas';
    const studentRepo = getDefaultMasterStudentTransmutationReadRepo();
    
    // Obtener lista de alumnos (query directa)
    const { query } = await import('../../database/pg.js');
    const alumnosResult = await query('SELECT id FROM alumnos', []);
    const studentIds = alumnosResult.rows.map(row => row.id);
    
    if (studentIds.length === 0) {
      return { updated_students: 0, logged: 0, skipped: 0, cleaned_date: null };
    }
    
    // 1) Actualizar student_item_state (igual que markCleanAll con GREATEST)
    const stateResult = await studentRepo.markCleanAll(itemId, productKey, domainKey);
    const updatedStudents = stateResult?.updated || 0;
    
    // 2) Insertar logs en pde_daily_item_clean_log
    const cleanedDate = new Date();
    // Normalizar a fecha en timezone Europe/Madrid
    const cleanedDateStr = cleanedDate.toISOString().split('T')[0];
    
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
    const skipped = logResult.skipped || 0;
    
    // 3) Emitir señales (fail-open)
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
        executed_at: cleanedDate.toISOString(),
        cleaned_date: cleanedDateStr
      }, {}, {}, {
        trace_id: traceId,
        source: 'alquimia-general-service',
        action: 'markPdeCleanAll'
      });
    } catch (signalError) {
      logError('AlquimiaGeneralService', 'Error emitiendo señales en markPdeCleanAll', {
        traceId,
        error: signalError.message,
        itemRef
      });
    }
    
    logInfo('AlquimiaGeneralService', 'markPdeCleanAll completado', {
      traceId,
      itemRef,
      updated_students: updatedStudents,
      logged,
      skipped,
      cleaned_date: cleanedDateStr
    });
    
    return {
      updated_students: updatedStudents,
      logged,
      skipped,
      cleaned_date: cleanedDateStr
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
