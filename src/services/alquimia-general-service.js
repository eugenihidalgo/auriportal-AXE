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
import { getDefaultCleaningItemStateRepo } from '../infra/repos/cleaning/cleaning-item-state-repo-pg.js';
import { validateViewLayer, ALLOWED_VIEW_LAYERS } from '../core/master/services/cleaning-layer-constants.js';
import { computeVisualState } from '../core/master/services/cleaning-projection-model.js';
import { resolveItemConfigForStudent } from '../core/master/services/override-resolution-service.js';

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
 * Elimina una lista (soft delete canónico usando deleted_at)
 * 
 * REGLA CANÓNICA:
 * - Marca deleted_at = now()
 * - NO borra datos históricos (eventos, limpiezas, contadores)
 * - NO borra ítems (se ocultan automáticamente al filtrar deleted_at)
 * 
 * @param {number} id - ID de la lista
 * @returns {Promise<Object|null>} Lista eliminada o null si no existe
 */
export async function deleteLista(id) {
  const traceId = getRequestId();
  try {
    logInfo('AlquimiaGeneralService', '[CLEAN][LIST][DELETE] deleteLista iniciado', {
      traceId,
      lista_id: id
    });
    
    const repo = getDefaultAlquimiaCatalogRepo();
    if (!repo) {
      throw new Error('No se pudo obtener repositorio de catálogo');
    }
    
    const result = await repo.deleteLista(id);
    
    logInfo('AlquimiaGeneralService', '[CLEAN][LIST][DELETE] deleteLista completado', {
      traceId,
      lista_id: id,
      deleted: !!result,
      deleted_at: result?.deleted_at
    });
    
    return result;
  } catch (error) {
    logError('AlquimiaGeneralService', 'Error en deleteLista', {
      traceId,
      lista_id: id,
      error: error.message,
      code: error.code,
      stack: error.stack
    });
    throw error;
  }
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
 * Calcula estado visual según view_layer, item_kind y datos
 * 
 * DEPRECATED: Esta función ahora delega a Cleaning Projection Model (CPM).
 * Se mantiene para compatibilidad con código existente.
 * 
 * REGLA CANÓNICA:
 * - RECURRENTE: usa days_since_last_clean de la capa indicada por view_layer
 * - UNA_VEZ: usa combo (shared + pde) si view_layer='combo', sino usa la capa indicada
 * 
 * @param {Object} params - Parámetros
 * @param {Object} params.shared - Datos shared { clean_count, days_since_last_clean, remaining, completed }
 * @param {Object} params.pde - Datos pde { clean_count, days_since_last_clean, remaining, completed }
 * @param {string} params.combo - Datos combo { clean_count, remaining, completed } (calculado)
 * @param {string} params.item_kind - Tipo de item ('recurrente' | 'una_vez')
 * @param {string} params.view_layer - Capa de vista ('shared' | 'pde' | 'combo')
 * @param {Object} params.config - Configuración { threshold_days, critical_multiplier, required_count }
 * @returns {Object} { state, visual_state, computed_state }
 * 
 * @see src/core/master/services/cleaning-projection-model.js (CPM canónico)
 */
export { computeVisualState };

/**
 * Obtiene estado de alumnos para un item
 * 
 * UUID-ONLY: Lee EXCLUSIVAMENTE desde Cleaning Engine v1 (cleaning_item_state)
 * 
 * REGLA CONSTITUCIONAL:
 * - clean_layer es OBLIGATORIO (para compatibilidad con repositorio)
 * - view_layer es OBLIGATORIO para RECURRENTE (decide qué estado calcular)
 * - NO existe fallback a student_item_state (legacy eliminado)
 * - Alquimia es UUID-only, sin compatibilidad legacy
 * 
 * DIFERENCIACIÓN CANÓNICA:
 * - clean_layer: decide qué columnas se leen del repositorio (siempre simétrico, ambos se leen)
 * - view_layer: decide qué estado se calcula para RECURRENTE (shared o pde)
 * 
 * @param {string} itemRef - item_ref del item
 * @param {string} tipo - Tipo del item ('recurrente' o 'una_vez')
 * @param {string} [productKey='pde'] - Clave del producto
 * @param {Object} options - Opciones adicionales (limit, offset, clean_layer, view_layer)
 * @param {string} options.clean_layer - Capa de limpieza ('shared' | 'pde') - OBLIGATORIO (legacy, para repositorio)
 * @param {string} options.view_layer - Vista activa ('shared' | 'pde') - OBLIGATORIO para RECURRENTE (decide estado)
 * @returns {Promise<Object>} Objeto con students, counts, total
 */
export async function getStudentsForItem(itemRef, tipo, productKey = 'pde', options = {}) {
  if (!itemRef || !tipo) {
    return { students: [], counts: {}, total: 0 };
  }
  
  const traceId = getRequestId();
  const { clean_layer, view_layer, ...otherOptions } = options;
  
  // ============================================================================
  // GUARD CONSTITUCIONAL: clean_layer es OBLIGATORIO (para repositorio)
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
  // GUARD CONSTITUCIONAL: view_layer es OBLIGATORIO para RECURRENTE
  // ============================================================================
  if (tipo === 'recurrente' && !view_layer) {
    const error = new Error('view_layer is required for RECURRENTE items. It determines which layer state to calculate.');
    error.code = 'VIEW_LAYER_REQUIRED';
    logError('AlquimiaGeneralService', 'Intento de usar getStudentsForItem RECURRENTE sin view_layer', {
      traceId,
      itemRef,
      tipo,
      clean_layer
    });
    throw error;
  }
  
  // Validar view_layer si está presente (puede ser shared, pde o combo)
  if (view_layer) {
    try {
      validateViewLayer(view_layer);
    } catch (validationError) {
      const error = new Error(`view_layer validation failed: ${validationError.message}`);
      error.code = 'VIEW_LAYER_INVALID';
      logError('AlquimiaGeneralService', 'view_layer inválido', {
        traceId,
        itemRef,
        tipo,
        view_layer
      });
      throw error;
    }
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
    // REGLA MASTER CONSTITUCIONAL: Flotante Master NUNCA filtra por nivel (SIEMPRE skip_level_filter=true)
    // Master puede limpiar cualquier item a cualquier alumno, sin excepciones
    const skipLevelFilter = options.skip_level_filter === true; // Para contexto Master
    const studentsFiltered = [];
    const studentsNoAplica = []; // Alumnos cuyo nivel no aplica (solo para logging, no se excluyen en Master)
    
    for (const student of rawResult.students) {
      // UUID-ONLY: Verificar pausa usando student_uuid directamente
      // Nota: getStudentsForItemFromCleaningEngine ya filtra pausados, pero verificamos por seguridad
      if (clean_layer && student.student_uuid) {
        // UUID-ONLY: pausas.student_id ahora es UUID (migrado en v5.70.0)
        const pausaRepo = getDefaultPausaRepo();
        const pausaActiva = await pausaRepo.getPausaActiva(student.student_uuid);
        if (pausaActiva) {
          continue; // Saltar estudiantes en pausa
        }
      }
      
      // UUID-ONLY: Verificar nivel efectivo usando student_uuid (solo para logging, NO para filtrar en Master)
      const nivelEfectivo = await getStudentEffectiveLevel(student.student_uuid);
      // REGLA CONSTITUCIONAL: En Master, NUNCA filtrar por nivel, incluso si skipLevelFilter es false
      // Esto garantiza que Master puede limpiar cualquier item a cualquier alumno
      if (!skipLevelFilter && item.nivel && item.nivel > nivelEfectivo) {
        // Solo para logging/información, NO se excluye en Master
        studentsNoAplica.push({
          ...student,
          nivel_efectivo: nivelEfectivo,
          item_nivel: item.nivel,
          no_aplica: true
        });
        // NO hacer continue: en Master, incluimos todos los estudiantes
      }
      
      // REGLA CONSTITUCIONAL: En Master, SIEMPRE incluir el estudiante (sin filtro por nivel)
      studentsFiltered.push({
        ...student,
        nivel_efectivo: nivelEfectivo,
        item_nivel: item.nivel
      });
    }

    // Calcular estados y nombres de display
    if (tipo === 'recurrente') {
      // FIX 3: critical_multiplier canónico único (2.0)
      // No leer de item.critical_multiplier (campo no canónico)
      const criticalMultiplier = 2.0;
      
      // Base config canónica (igual a list-projection/megalist)
      const baseConfig = {
        threshold_days: item.frecuencia_dias || 7,
        critical_multiplier: criticalMultiplier,
        required_count: item.veces_limpiar || 1
      };
      
      // Cache de overrides por student_uuid (evitar lookups duplicados)
      const overrideCache = new Map();

      // Calcular estados y nombres
      const studentsWithState = await calculateStudentDisplayNames(studentsFiltered);
      
      // NOTA: Los datos ya vienen con shared y pde simétricos desde el repositorio
      // FIX 1: Aplicar overrides por alumno (igual que list-projection/megalist)
      const students = await Promise.all(studentsWithState.map(async (student) => {
        // CPM v2: Preparar datos brutos (NO days_since, CPM lo calcula)
        const sharedData = student.shared || {
          clean_count: student.clean_count || 0,
          last_cleaned_at: student.last_cleaned_at,
          remaining: student.remaining,
          completed: student.completed || 0,
          effective_since: student.shared_effective_since || null
        };
        const pdeData = student.pde || {
          clean_count: 0,
          last_cleaned_at: null,
          remaining: null,
          completed: 0,
          effective_since: student.pde_effective_since || null
        };
        
        // FIX 1: Resolver overrides para este alumno (cache para evitar lookups duplicados)
        let effectiveConfig = overrideCache.get(student.student_uuid);
        if (!effectiveConfig) {
          effectiveConfig = await resolveItemConfigForStudent(
            baseConfig,
            student.student_uuid,
            itemRef
          );
          overrideCache.set(student.student_uuid, effectiveConfig);
        }
        
        // ============================================================================
        // REGLA CANÓNICA: Estado RECURRENTE se calcula según view_layer (NO clean_layer)
        // ============================================================================
        // Usar función canónica computeVisualState con effectiveConfig (incluye overrides)
        // ============================================================================
        const visualStateResult = computeVisualState({
          shared: sharedData,
          pde: pdeData,
          combo: null, // RECURRENTE no usa combo
          item_kind: 'recurrente',
          view_layer: view_layer || 'shared',
          config: effectiveConfig
        });

        // Log forense obligatorio (incluye effectiveConfig para verificar overrides)
        const effectiveThreshold = effectiveConfig.threshold_days * effectiveConfig.critical_multiplier;
        logInfo('AlquimiaGeneralService', '[CLEAN][STATE] Estado RECURRENTE calculado', {
          traceId,
          student_uuid: student.student_uuid,
          item_ref: itemRef,
          clean_layer, // Para escritura
          view_layer, // Para cálculo de estado
          metrics: visualStateResult.metrics || visualStateResult.computed_state, // Compatibilidad: computed_state → metrics
          state_calculated: visualStateResult.state,
          threshold_days: effectiveConfig.threshold_days, // Usar effectiveConfig (puede tener override)
          critical_threshold: effectiveThreshold,
          has_override: effectiveConfig.threshold_days !== baseConfig.threshold_days, // Indicar si hay override
          shared_last_cleaned_at: sharedData.last_cleaned_at,
          shared_effective_since: sharedData.effective_since,
          pde_last_cleaned_at: pdeData.last_cleaned_at,
          pde_effective_since: pdeData.effective_since
        });

        // ============================================================================
        // FORENSICS: Log temporal para caso maldito
        // ============================================================================
        const FORENSICS_TARGET_STUDENT = '0d29eedc-6f42-44d1-bb12-53dba2fc9490';
        const FORENSICS_TARGET_ITEM = 'item_17_1768641625523_cr5fpr';
        if (student.student_uuid === FORENSICS_TARGET_STUDENT && itemRef === FORENSICS_TARGET_ITEM) {
          console.log('[FORENSICS][CPM_CASE]', {
            student_uuid: student.student_uuid,
            item_ref: itemRef,
            view_layer: view_layer || 'shared',
            raw_shared: {
              last_cleaned_at: sharedData?.last_cleaned_at ?? null,
              effective_since: sharedData?.effective_since ?? null,
              clean_count: sharedData?.clean_count ?? null
            },
            raw_pde: {
              last_cleaned_at: pdeData?.last_cleaned_at ?? null,
              effective_since: pdeData?.effective_since ?? null,
              clean_count: pdeData?.clean_count ?? null
            },
            parsed_dates: {
              shared_last_cleaned_date: sharedData?.last_cleaned_at ? new Date(sharedData.last_cleaned_at).toISOString() : null,
              shared_effective_since_date: sharedData?.effective_since ? new Date(sharedData.effective_since).toISOString() : null,
              pde_last_cleaned_date: pdeData?.last_cleaned_at ? new Date(pdeData.last_cleaned_at).toISOString() : null,
              pde_effective_since_date: pdeData?.effective_since ? new Date(pdeData.effective_since).toISOString() : null,
              now: new Date().toISOString()
            },
            types: {
              shared_last_cleaned_at_type: typeof sharedData?.last_cleaned_at,
              shared_effective_since_type: typeof sharedData?.effective_since,
              pde_last_cleaned_at_type: typeof pdeData?.last_cleaned_at,
              pde_effective_since_type: typeof pdeData?.effective_since
            },
            config: {
              threshold_days: effectiveConfig.threshold_days,
              critical_multiplier: effectiveConfig.critical_multiplier,
              critical_threshold: effectiveConfig.threshold_days * effectiveConfig.critical_multiplier
            }
          });
        }
        // ============================================================================
        
        // Calcular estados para todas las view_layers posibles (proyección completa)
        // Usar effectiveConfig en todas las llamadas (incluye overrides)
        const stateByViewLayer = {
          shared: computeVisualState({
            shared: sharedData,
            pde: pdeData,
            combo: null,
            item_kind: 'recurrente',
            view_layer: 'shared',
            config: effectiveConfig
          }),
          pde: computeVisualState({
            shared: sharedData,
            pde: pdeData,
            combo: null,
            item_kind: 'recurrente',
            view_layer: 'pde',
            config: effectiveConfig
          }),
          // FIX MAJOR: EFFECTIVE es OBLIGATORIO para recurrente (composición determinista de SHARED + PDE)
          effective: computeVisualState({
            shared: sharedData,
            pde: pdeData,
            combo: null,
            item_kind: 'recurrente',
            view_layer: 'effective',
            config: effectiveConfig
          })
        };
        
        // ============================================================================
        // FORENSICS: Log temporal para caso maldito - resultado CPM
        // ============================================================================
        if (student.student_uuid === FORENSICS_TARGET_STUDENT && itemRef === FORENSICS_TARGET_ITEM) {
          console.log('[FORENSICS][CPM_RESULT]', {
            student_uuid: student.student_uuid,
            item_ref: itemRef,
            view_layer: view_layer || 'shared',
            cpm_result: stateByViewLayer[view_layer || 'shared'],
            state: stateByViewLayer[view_layer || 'shared']?.state,
            days_since: stateByViewLayer[view_layer || 'shared']?.metrics?.days_since_last_clean,
            last_effective_clean_at: stateByViewLayer[view_layer || 'shared']?.metrics?.last_effective_clean_at
          });
        }
        // ============================================================================

        // ============================================================================
        // LOG FORENSE TEMPORAL: Proyección RECURRENTE tras limpieza
        // ============================================================================
        const activeLayerState = stateByViewLayer[view_layer || 'shared'];
        console.log('[FORENSIC][PROJECTION][RECURRENTE]', {
          student_uuid: student.student_uuid,
          item_ref: itemRef,
          view_layer: view_layer || 'shared',
          state: activeLayerState?.state || undefined,
          visual_state: activeLayerState?.visual_state || undefined,
          days_since: activeLayerState?.metrics?.days_since_last_clean || undefined,
          last_cleaned_at: activeLayerState?.metrics?.last_cleaned_at || undefined,
          effective_since: activeLayerState?.metrics?.effective_since || undefined,
          clean_count: activeLayerState?.metrics?.clean_count || undefined,
          full_state: activeLayerState || undefined,
          state_by_view_layer: {
            shared: {
              state: stateByViewLayer.shared?.state || undefined,
              visual_state: stateByViewLayer.shared?.visual_state || undefined,
              days_since: stateByViewLayer.shared?.metrics?.days_since_last_clean || undefined
            },
            pde: {
              state: stateByViewLayer.pde?.state || undefined,
              visual_state: stateByViewLayer.pde?.visual_state || undefined,
              days_since: stateByViewLayer.pde?.metrics?.days_since_last_clean || undefined
            },
            effective: {
              state: stateByViewLayer.effective?.state || undefined,
              visual_state: stateByViewLayer.effective?.visual_state || undefined,
              days_since: stateByViewLayer.effective?.metrics?.days_since_last_clean || undefined
            }
          }
        });
        // ============================================================================

        return {
          ...student,
          // Asegurar que shared y pde están presentes (simétricos)
          shared: sharedData,
          pde: pdeData,
          // Estado calculado según view_layer (autoridad backend)
          state: visualStateResult.state,
          visual_state: visualStateResult.visual_state,
          threshold_days: effectiveConfig.threshold_days, // Usar effectiveConfig
          critical_multiplier: effectiveConfig.critical_multiplier, // Usar effectiveConfig
          // Proyección completa: estados para todas las view_layers
          state_by_view_layer: stateByViewLayer,
          // Forensics: indicar qué capa se usó para calcular estado
          view_layer_used: view_layer
        };
      }));

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
        threshold_days: baseConfig.threshold_days, // Base config (puede variar por alumno si hay overrides)
        critical_multiplier: baseConfig.critical_multiplier, // Canónico 2.0
        clean_layer: clean_layer || 'shared', // Default shared si no se especifica
        item_kind: 'recurrente', // OBLIGATORIO según contrato
        item_ref: itemRef
      };
    } else {
      // una_vez - usar nombres de display
      const students = await calculateStudentDisplayNames(studentsFiltered);
      
      // Base config canónica (igual a list-projection/megalist)
      const baseConfigUnaVez = {
        threshold_days: item.frecuencia_dias || 7, // No usado en una_vez pero para consistencia
        critical_multiplier: 2.0, // Canónico
        required_count: item.veces_limpiar || 1
      };
      
      // Cache de overrides por student_uuid (evitar lookups duplicados)
      const overrideCacheUnaVez = new Map();
      
      // Calcular estados visuales dinámicamente según orden canónico:
      // Nunca (gris) → Iniciando → En proceso → Completado (verde) → Muy bien trabajado (dorado)
      // NOTA: Los datos ya vienen con shared y pde simétricos desde el repositorio
      // FIX 1: Aplicar overrides por alumno (igual que list-projection/megalist)
      const studentsWithState = await Promise.all(students.map(async (student) => {
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
        
        // FIX 1: Resolver overrides para este alumno (cache para evitar lookups duplicados)
        let effectiveConfigUnaVez = overrideCacheUnaVez.get(student.student_uuid);
        if (!effectiveConfigUnaVez) {
          effectiveConfigUnaVez = await resolveItemConfigForStudent(
            baseConfigUnaVez,
            student.student_uuid,
            itemRef
          );
          overrideCacheUnaVez.set(student.student_uuid, effectiveConfigUnaVez);
        }
        
        // CPM v2: NO calcular combo aquí, CPM lo calcula internamente
        // Pasar datos brutos (shared y pde)
        const effectiveViewLayer = view_layer || 'combo';
        const visualStateResult = computeVisualState({
          shared: sharedData,
          pde: pdeData,
          combo: null, // CPM v2 lo calcula internamente
          item_kind: 'una_vez',
          view_layer: effectiveViewLayer,
          config: effectiveConfigUnaVez // Usar effectiveConfig (incluye overrides)
        });
        
        // Log forense obligatorio (incluye effectiveConfig para verificar overrides)
        logInfo('AlquimiaGeneralService', '[CLEAN][STATE] Estado UNA_VEZ calculado', {
          traceId,
          student_uuid: student.student_uuid,
          item_ref: itemRef,
          clean_layer, // Para escritura
          view_layer: effectiveViewLayer, // Para cálculo de estado
          metrics: visualStateResult.metrics || visualStateResult.computed_state, // Compatibilidad: computed_state → metrics
          state_calculated: visualStateResult.state,
          visual_state_calculated: visualStateResult.visual_state,
          required_count: effectiveConfigUnaVez.required_count, // Usar effectiveConfig (puede tener override)
          has_override: effectiveConfigUnaVez.required_count !== baseConfigUnaVez.required_count // Indicar si hay override
        });

        // Calcular estados para todas las view_layers posibles (proyección completa)
        // Usar effectiveConfig en todas las llamadas (incluye overrides)
        const stateByViewLayer = {
          shared: computeVisualState({
            shared: sharedData,
            pde: pdeData,
            combo: null, // CPM v2 lo calcula internamente
            item_kind: 'una_vez',
            view_layer: 'shared',
            config: effectiveConfigUnaVez
          }),
          pde: computeVisualState({
            shared: sharedData,
            pde: pdeData,
            combo: null, // CPM v2 lo calcula internamente
            item_kind: 'una_vez',
            view_layer: 'pde',
            config: effectiveConfigUnaVez
          }),
          combo: computeVisualState({
            shared: sharedData,
            pde: pdeData,
            combo: null, // CPM v2 lo calcula internamente
            item_kind: 'una_vez',
            view_layer: 'combo',
            config: effectiveConfigUnaVez
          })
        };
        
        return {
          ...student,
          // Asegurar que shared y pde están presentes (simétricos)
          shared: sharedData,
          pde: pdeData,
          // Estado visual calculado por backend (autoridad única)
          state: visualStateResult.state,
          visual_state: visualStateResult.visual_state,
          // Proyección completa: estados para todas las view_layers
          state_by_view_layer: stateByViewLayer,
          // Compatibilidad legacy (usar SHARED como default para campos legacy)
          clean_count: sharedData.clean_count || 0,
          remaining: sharedData.remaining !== null ? parseInt(sharedData.remaining, 10) : null,
          completed: sharedData.completed || 0,
          veces_limpiar: effectiveConfigUnaVez.required_count, // Usar effectiveConfig
          // Forensics: indicar qué capa se usó para calcular estado
          view_layer_used: effectiveViewLayer
        };
      }));
      
      // Contar por estado visual para ordenación canónica
      const counts = {
        never: studentsWithState.filter(s => s.visual_state === 'never').length,
        in_progress: studentsWithState.filter(s => s.visual_state === 'in_progress').length,
        completed: studentsWithState.filter(s => s.visual_state === 'completed').length,
        empowered: studentsWithState.filter(s => s.visual_state === 'empowered').length,
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
        required_count: item.veces_limpiar || 1 // OBLIGATORIO para UNA_VEZ según contrato (valor base del item)
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
    
    // FIX MAJOR: Normalizar respuesta (eliminada referencia a skipped_already_clean)
    return {
      updated: result.updated || 0,
      skipped: result.skipped || 0,
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

/**
 * Resetea el progreso de un alumno para un ítem específico.
 * REGLA CONSTITUCIONAL: Reset ≠ override, Reset ≠ limpieza
 * Solo afecta al estado del alumno (cleaning_item_state), no modifica overrides ni definiciones base.
 * 
 * @param {string} student_uuid - UUID canónico del estudiante
 * @param {string} item_ref - Referencia del item
 * @param {string} [product_key='pde'] - Clave del producto (opcional)
 * @param {string} [domain_type] - Tipo de dominio (opcional)
 * @returns {Promise<boolean>} true si se reseteó, false si no existía estado
 */
export async function resetStudentItemProgress(student_uuid, item_ref, product_key = 'pde', domain_type = null) {
  const traceId = getRequestId();
  
  try {
    if (!student_uuid || !item_ref) {
      throw new Error('student_uuid e item_ref son requeridos');
    }
    
    logInfo('AlquimiaGeneralService', 'resetStudentItemProgress iniciado', {
      traceId,
      student_uuid,
      item_ref,
      product_key,
      domain_type
    });
    
    // Obtener item para determinar domain_type si no viene
    if (!domain_type) {
      const item = await getItemByRef(item_ref);
      if (!item) {
        throw new Error(`Item con item_ref=${item_ref} no encontrado`);
      }
      // domain_type se deriva del item (normalmente 'alquimia' o similar)
      // Por ahora, usar 'alquimia' como default si no está en el item
      domain_type = item.domain_type || 'alquimia';
    }
    
    const stateRepo = getDefaultCleaningItemStateRepo();
    const deleted = await stateRepo.deleteState({
      student_uuid,
      item_ref,
      product_key,
      domain_type
    });
    
    logInfo('AlquimiaGeneralService', 'resetStudentItemProgress completado', {
      traceId,
      student_uuid,
      item_ref,
      deleted
    });
    
    return deleted;
  } catch (error) {
    logError('AlquimiaGeneralService', 'Error en resetStudentItemProgress', {
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
 * @param {string} student_uuid - UUID canónico del estudiante
 * @param {string} list_id - ID de la lista
 * @param {string} [product_key='pde'] - Clave del producto (opcional)
 * @param {string} [domain_type] - Tipo de dominio (opcional)
 * @returns {Promise<number>} Número de estados reseteados
 */
export async function resetStudentListProgress(student_uuid, list_id, product_key = 'pde', domain_type = null) {
  const traceId = getRequestId();
  
  try {
    if (!student_uuid || !list_id) {
      throw new Error('student_uuid y list_id son requeridos');
    }
    
    logInfo('AlquimiaGeneralService', 'resetStudentListProgress iniciado', {
      traceId,
      student_uuid,
      list_id,
      product_key,
      domain_type
    });
    
    // Obtener lista para determinar domain_type si no viene
    if (!domain_type) {
      const lista = await getListaById(list_id);
      if (!lista) {
        throw new Error(`Lista con id=${list_id} no encontrada`);
      }
      // domain_type se deriva de la lista (normalmente 'alquimia' o similar)
      domain_type = lista.domain_type || 'alquimia';
    }
    
    const stateRepo = getDefaultCleaningItemStateRepo();
    const deletedCount = await stateRepo.deleteStatesByList({
      student_uuid,
      list_id,
      product_key,
      domain_type
    });
    
    logInfo('AlquimiaGeneralService', 'resetStudentListProgress completado', {
      traceId,
      student_uuid,
      list_id,
      deleted_count: deletedCount
    });
    
    return deletedCount;
  } catch (error) {
    logError('AlquimiaGeneralService', 'Error en resetStudentListProgress', {
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
