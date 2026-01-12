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
        
        // UUID-ONLY: Obtener todos los estados de cleaning_item_state para este item_ref (solo SHARED, solo activos)
        // Usar repositorio master-student-transmutation-read-repo para obtener estudiantes con estados
        const readRepo = getDefaultMasterStudentTransmutationReadRepo();
        const studentsResult = await readRepo.getStudentsForItemFromCleaningEngine(
          itemActual.item_ref,
          'una_vez',
          'shared',
          'pde',
          { limit: null } // Sin límite para obtener todos
        );
        
        // Actualizar remaining para cada estudiante usando UUID
        let updated = 0;
        for (const student of studentsResult.students) {
          const completed = student.completed || 0;
          const newRemaining = Math.max(patch.veces_limpiar - completed, 0);
          
          await setRemainingShared({
            student_uuid: student.student_uuid, // UUID canónico
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
    const { getDefaultStudentIdentityRepo } = await import('../infra/repos/student-identity-repo-pg.js');

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
        const identityRepo = getDefaultStudentIdentityRepo();
        const legacyId = await identityRepo.resolveLegacyId(student.student_uuid);
        if (legacyId) {
          const pausaRepo = getDefaultPausaRepo();
          const pausaActiva = await pausaRepo.getPausaActiva(legacyId);
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
      
      // NOTA: Los datos ya vienen con shared y pde simétricos desde el repositorio
      const students = studentsWithState.map(student => {
        // Compatibilidad: usar datos legacy si no vienen simétricos aún
        const sharedData = student.shared || {
          clean_count: student.clean_count || 0,
          last_cleaned_at: student.last_cleaned_at,
          days_since_last_clean: student.days_since_last_clean
        };
        const pdeData = student.pde || {
          clean_count: 0,
          last_cleaned_at: null,
          days_since_last_clean: null
        };
        
        // Calcular estado usando SHARED como default (para compatibilidad)
        const daysSince = sharedData.days_since_last_clean !== undefined 
          ? sharedData.days_since_last_clean 
          : student.days_since_last_clean;
        
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
          // Asegurar que shared y pde están presentes (simétricos)
          shared: sharedData,
          pde: pdeData,
          // Compatibilidad legacy
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
        clean_layer: clean_layer || 'shared', // Default shared si no se especifica
        item_kind: 'recurrente', // OBLIGATORIO según contrato
        item_ref: itemRef
      };
    } else {
      // una_vez - usar nombres de display
      const students = await calculateStudentDisplayNames(studentsFiltered);
      
      // Obtener veces_limpiar del item para cálculo de estados visuales
      const vecesLimpiar = item.veces_limpiar || 1;
      
      // Calcular estados visuales dinámicamente según orden canónico:
      // Nunca (gris) → Iniciando → En proceso → Completado (verde) → Muy bien trabajado (dorado)
      // NOTA: Los datos ya vienen con shared y pde simétricos desde el repositorio
      const studentsWithState = students.map(student => {
        // Compatibilidad: usar datos legacy si no vienen simétricos aún
        const sharedData = student.shared || {
          clean_count: student.clean_count || 0,
          remaining: student.remaining,
          completed: student.completed || 0
        };
        const pdeData = student.pde || {
          clean_count: 0,
          remaining: null,
          completed: 0
        };
        
        // PROYECCIÓN COMBO: calcular total (shared + pde) como proyección backend
        const sharedCount = sharedData.clean_count !== null && sharedData.clean_count !== undefined ? parseInt(sharedData.clean_count, 10) : 0;
        const pdeCount = pdeData.clean_count !== null && pdeData.clean_count !== undefined ? parseInt(pdeData.clean_count, 10) : 0;
        const comboCleanCount = sharedCount + pdeCount;
        
        // COMBO remaining: max(veces_limpiar - combo_clean_count, 0)
        const comboRemaining = Math.max(0, vecesLimpiar - comboCleanCount);
        const comboCompleted = comboRemaining <= 0 ? 1 : 0;
        
        // Calcular estado visual basado en COMBO (proyección backend)
        let visualState;
        let state;
        
        if (comboCleanCount === 0) {
          // Nunca trabajado (gris)
          visualState = 'never';
          state = 'pending';
        } else if (comboRemaining > 0) {
          // En proceso (amarillo) - tiene contador pero aún no completado
          visualState = 'in_progress';
          state = 'pending';
        } else if (comboRemaining <= 0 && comboCleanCount === vecesLimpiar) {
          // Completado exactamente (verde)
          visualState = 'completed';
          state = 'completed';
        } else if (comboRemaining <= 0 && comboCleanCount > vecesLimpiar) {
          // Muy bien trabajado (dorado) - superó el recomendado
          visualState = 'excellent';
          state = 'completed';
        } else {
          // Fallback: en proceso
          visualState = 'in_progress';
          state = 'pending';
        }
        
        return {
          ...student,
          // Asegurar que shared y pde están presentes (simétricos)
          shared: sharedData,
          pde: pdeData,
          // PROYECCIÓN COMBO (calculada en backend, no persistida)
          combo: {
            clean_count: comboCleanCount,
            remaining: comboRemaining,
            completed: comboCompleted
          },
          // Estado visual calculado por backend (autoridad única)
          state,
          visual_state: visualState,
          // Compatibilidad legacy (usar SHARED como default para campos legacy)
          clean_count: sharedCount,
          remaining: sharedData.remaining !== null ? parseInt(sharedData.remaining, 10) : null,
          completed: sharedData.completed || 0,
          veces_limpiar: vecesLimpiar
        };
      });
      
      // Contar por estado visual para ordenación canónica
      const counts = {
        never: studentsWithState.filter(s => s.visual_state === 'never').length,
        in_progress: studentsWithState.filter(s => s.visual_state === 'in_progress').length,
        completed: studentsWithState.filter(s => s.visual_state === 'completed').length,
        excellent: studentsWithState.filter(s => s.visual_state === 'excellent').length,
        // Mantener compatibilidad con estados legacy
        pending: studentsWithState.filter(s => s.state === 'pending').length,
        completed_legacy: studentsWithState.filter(s => s.state === 'completed').length
      };
      
      return {
        students: studentsWithState,
        students_no_aplica: studentsNoAplica.length > 0 ? studentsNoAplica : undefined,
        counts,
        total: studentsFiltered.length,
        clean_layer: clean_layer || 'shared', // Default shared si no se especifica
        item_kind: 'una_vez', // OBLIGATORIO según contrato
        item_ref: itemRef,
        required_count: vecesLimpiar // OBLIGATORIO para UNA_VEZ según contrato
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
 * @param {string} studentUuid - UUID del alumno
 * @param {string} itemRef - item_ref del item
 * @param {string} itemKind - Tipo de item ('recurrente' | 'una_vez') - OBLIGATORIO según CONTRATO LIMPIEZA v1
 * @param {string} [productKey='pde'] - Clave del producto
 * @param {string} [cleanLayer='shared'] - Capa de limpieza ('shared' | 'pde')
 * @returns {Promise<Object|null>} Estado actualizado o null si no existe/está pausado
 */
export async function markCleanStudent(studentUuid, itemRef, itemKind, productKey = 'pde', cleanLayer = 'shared') {
  if (!studentUuid || !itemRef) return null;
  
  // Validar item_kind (OBLIGATORIO según CONTRATO LIMPIEZA v1)
  if (!itemKind || (itemKind !== 'recurrente' && itemKind !== 'una_vez')) {
    throw new Error('item_kind es requerido y debe ser "recurrente" o "una_vez"');
  }
  
  const traceId = getRequestId();
  
  logInfo('AlquimiaGeneralService', 'markCleanStudent entrada', {
    traceId,
    student_uuid: studentUuid,
    item_ref: itemRef,
    item_kind: itemKind,
    clean_layer: cleanLayer,
    product_key: productKey
  });
  
  try {
    // Delegar al Cleaning Engine v1 (single decider) (CAMBIADO: pasa UUID)
    const { markCleanStudent: cleaningMarkClean } = await import('../core/master/services/cleaning-engine-service.js');
    
    const result = await cleaningMarkClean({
      student_uuid: studentUuid, // CAMBIADO: pasar UUID canónico
      item_ref: itemRef,
      item_kind: itemKind, // OBLIGATORIO según CONTRATO LIMPIEZA v1
      clean_layer: cleanLayer,
      product_key: productKey,
      domain_type: 'transmutation',
      actor_type: 'master',
      surface_key: 'master.alquimia_general',
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
 * @param {string} itemKind - Tipo de item ('recurrente' | 'una_vez') - OBLIGATORIO según CONTRATO LIMPIEZA v1
 * @returns {Promise<Object>} Objeto con { updated: number, skipped: number, total: number }
 */
export async function markCleanAll(itemRef, productKey = 'pde', cleanLayer = 'shared', itemKind, executionMode = 'APPLY') {
  if (!itemRef) return { updated: 0, skipped: 0, total: 0 };
  
  // Validar item_kind (OBLIGATORIO según CONTRATO LIMPIEZA v1)
  if (!itemKind || (itemKind !== 'recurrente' && itemKind !== 'una_vez')) {
    throw new Error('item_kind es requerido y debe ser "recurrente" o "una_vez"');
  }
  
  // Validar execution_mode
  if (executionMode !== 'APPLY' && executionMode !== 'CERTIFY') {
    throw new Error('execution_mode debe ser "APPLY" o "CERTIFY"');
  }
  
  const traceId = getRequestId();
  
  try {
    // Delegar al Cleaning Engine v1 (single decider)
    const { markCleanAllStudents: cleaningMarkCleanAll } = await import('../core/master/services/cleaning-engine-service.js');
    
    // REGLA MASTER: En MASTER NO se filtra por nivel (skip_level_filter=true siempre)
    const isMasterSurface = true; // Este servicio es siempre MASTER
    const result = await cleaningMarkCleanAll({
      item_ref: itemRef,
      item_kind: itemKind, // OBLIGATORIO según CONTRATO LIMPIEZA v1
      clean_layer: cleanLayer,
      product_key: productKey,
      domain_type: 'transmutation',
      actor_type: 'master',
      surface_key: 'master.alquimia_general',
      skip_level_filter: true, // REGLA MASTER: NO filtrar por nivel
      execution_mode: executionMode, // Pasar execution_mode
      meta: {
        source: 'alquimia-general-service',
        legacy_call: true,
        execution_mode: executionMode,
        is_master_surface: isMasterSurface
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
      skipped_already_clean: result.skipped_already_clean || 0, // Separado de omitted
      total: result.total || 0,
      skipped_breakdown: result.skipped_breakdown || {}
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
export async function incrementAll(itemRef, productKey = 'pde', cleanLayer = 'shared', itemKind = 'una_vez') {
  if (!itemRef) return { updated: 0, skipped: 0, total: 0 };
  
  const traceId = getRequestId();
  
  logInfo('AlquimiaGeneralService', 'incrementAll entrada', {
    traceId,
    itemRef,
    productKey,
    cleanLayer
  });
  
  try {
    // Delegar al Cleaning Engine v1 (single decider)
    // CONTRATO LIMPIEZA v1: item_kind es REQUERIDO
    const { incrementAllStudents: cleaningIncrementAll } = await import('../core/master/services/cleaning-engine-service.js');
    
    // REGLA MASTER: Para UNA_VEZ en MASTER, usar CERTIFY para permitir múltiples incrementos
    const result = await cleaningIncrementAll({
      item_ref: itemRef,
      item_kind: itemKind, // REQUERIDO según contrato canónico (pasado como parámetro)
      clean_layer: cleanLayer,
      product_key: productKey,
      domain_type: 'transmutation',
      actor_type: 'master',
      surface_key: 'master.alquimia_general',
      execution_mode: 'CERTIFY', // MASTER: usar CERTIFY para permitir múltiples incrementos sin límite diario
      skip_level_filter: true, // REGLA: Master increment-all NO filtra por nivel (puede incrementar cualquier item a cualquier alumno)
      meta: {
        source: 'alquimia-general-service',
        clean_layer: cleanLayer
      }
    });
    
    logInfo('AlquimiaGeneralService', 'incrementAll resultado', {
      traceId,
      itemRef,
      cleanLayer,
      updated: result.updated,
      skipped: result.skipped,
      total: result.total
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
export async function markPdeCleanAll(itemRef, productKey = 'pde', ctx = {}, itemKind, executionMode = 'APPLY') {
  if (!itemRef) return { updated_students: 0, logged: 0, skipped: 0, cleaned_date: null };
  
  // Validar item_kind (OBLIGATORIO según CONTRATO LIMPIEZA v1)
  if (!itemKind || (itemKind !== 'recurrente' && itemKind !== 'una_vez')) {
    throw new Error('item_kind es requerido y debe ser "recurrente" o "una_vez"');
  }
  
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
    
    // Validar coherencia con lista (no inferir, solo validar)
    const lista = await getListaById(item.lista_id);
    if (!lista) {
      logError('AlquimiaGeneralService', 'Lista no encontrada para markPdeCleanAll', {
        traceId,
        itemRef,
        lista_id: item.lista_id
      });
      return { updated_students: 0, logged: 0, skipped: 0, cleaned_date: null };
    }
    
    // Validar coherencia item_kind con lista.tipo (warning si no coincide, pero usar el proporcionado)
    if (itemKind !== lista.tipo) {
      logWarn('AlquimiaGeneralService', 'item_kind no coincide con lista.tipo en markPdeCleanAll', {
        traceId,
        itemRef,
        item_kind_provided: itemKind,
        lista_tipo: lista.tipo
      });
    }
    
    // LOG TEMPORAL: entrada a markPdeCleanAll
    logInfo('AlquimiaGeneralService', 'markPdeCleanAll entrada', {
      traceId,
      itemRef,
      item_id: item.id,
      lista_id: item.lista_id,
      lista_tipo: lista.tipo,
      item_kind: itemKind,
      clean_layer: 'pde'
    });
    
    const itemId = item.id;
    
    // 1) Usar Cleaning Engine con clean_layer='pde'
    const { markCleanAllStudents: cleaningMarkCleanAll } = await import('../core/master/services/cleaning-engine-service.js');
    
    const cleaningResult = await cleaningMarkCleanAll({
      item_ref: itemRef,
      item_kind: itemKind, // OBLIGATORIO según CONTRATO LIMPIEZA v1
      clean_layer: 'pde', // PDE layer
      product_key: productKey,
      domain_type: 'transmutation',
      actor_type: 'master',
      actor_ref: ctx.actor_id ? `master:${ctx.actor_id}` : null,
      surface_key: 'master.alquimia_general',
      execution_mode: executionMode, // Pasar execution_mode
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
    
    // UUID-ONLY: Obtener lista de estudiantes usando repositorio
    const { getDefaultStudentsRepoPg } = await import('../infra/repos/students-repo-pg.js');
    const studentsRepo = getDefaultStudentsRepoPg();
    const studentsList = await studentsRepo.list();
    const studentUuids = studentsList.map(student => student.id);
    
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
    
    logInfo('AlquimiaGeneralService', 'markPdeCleanAll completado', {
      traceId,
      itemRef,
      item_id: itemId,
      lista_id: item.lista_id,
      lista_tipo: lista.tipo,
      item_kind: itemKind,
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
