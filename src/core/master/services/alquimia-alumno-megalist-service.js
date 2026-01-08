// src/core/master/services/alquimia-alumno-megalist-service.js
// Alquimia Alumno Megalist Service v1
//
// Read model para construir la megalista de un alumno:
// - Agrupa por listas
// - Calcula estados (never/important/pending/reviewed)
// - Separa revisados por actor (student vs master)
// - Orden canónico: never → important → pending → reviewed

import { query } from '../../../../database/pg.js';
import { getRequestId } from '../../observability/request-context.js';
import { logError, logInfo, logWarn } from '../../observability/logger.js';
import { getDefaultAlquimiaCatalogRepo } from '../../../infra/repos/alquimia-catalog-repo-pg.js';
import { getDefaultCleaningItemStateRepo } from '../../../infra/repos/cleaning/cleaning-item-state-repo-pg.js';
import { getDefaultStudentRepo } from '../../../infra/repos/student-repo-pg.js';
import { getStudentEffectiveLevel } from './cleaning-engine-service.js';
import { getDefaultPausaRepo } from '../../../infra/repos/pausa-repo-pg.js';

/**
 * Calcula el estado de un item basado en cleaning_item_state
 * 
 * @param {Object} state - Estado de cleaning_item_state (SHARED)
 * @param {Object} item - Item del catálogo
 * @param {string} tipo - Tipo de lista ('recurrente' | 'una_vez')
 * @returns {string} Estado: 'never' | 'important' | 'pending' | 'reviewed'
 */
function calculateItemState(state, item, tipo) {
  // Fail-open: si tipo no es válido, usar 'recurrente' como fallback
  const listaTipo = (tipo === 'recurrente' || tipo === 'una_vez') ? tipo : 'recurrente';
  
  if (listaTipo === 'recurrente') {
    const lastCleaned = state?.shared_last_cleaned_at;
    
    if (!lastCleaned) {
      return 'never';
    }
    
    // Fail-open: si item no tiene frecuencia_dias, usar 7 por defecto
    const thresholdDays = (item?.frecuencia_dias && item.frecuencia_dias > 0) ? item.frecuencia_dias : 7;
    const criticalMultiplier = (item?.critical_multiplier && item.critical_multiplier > 0) ? item.critical_multiplier : 2.0;
    const criticalThreshold = thresholdDays * criticalMultiplier;
    
    try {
      const now = new Date();
      const lastCleanedDate = new Date(lastCleaned);
      
      // Fail-open: si fecha inválida, retornar 'never'
      if (isNaN(lastCleanedDate.getTime())) {
        return 'never';
      }
      
      const daysSince = Math.floor((now - lastCleanedDate) / (1000 * 60 * 60 * 24));
      
      if (daysSince < thresholdDays) {
        return 'reviewed';
      } else if (daysSince < criticalThreshold) {
        return 'pending';
      } else {
        return 'important';
      }
    } catch (error) {
      // Fail-open: si falla cálculo de fecha, retornar 'never'
      return 'never';
    }
  } else {
    // una_vez
    const remaining = state?.shared_remaining ?? null;
    const completed = state?.shared_completed ?? 0;
    
    if (remaining === null && completed === 0) {
      return 'never';
    }
    
    if (remaining !== null && remaining <= 0) {
      return 'reviewed';
    }
    
    return 'pending';
  }
}

/**
 * Obtiene el actor que hizo la última limpieza desde cleaning_events
 * 
 * @param {number} studentId - ID del alumno
 * @param {string} itemRef - Referencia del item
 * @returns {Promise<string|null>} 'master' | 'student' | null
 */
async function getLastCleanActor(studentId, itemRef) {
  try {
    const { getDefaultCleaningEventsRepo } = await import('../../../infra/repos/cleaning/cleaning-events-repo-pg.js');
    const eventsRepo = getDefaultCleaningEventsRepo();
    
    const events = await eventsRepo.listEventsForStudentItem({
      student_id: studentId,
      item_ref: itemRef,
      product_key: 'pde',
      domain_type: 'transmutation',
      limit: 1
    });
    
    if (events.length === 0) {
      return null;
    }
    
    return events[0].actor_type || null;
  } catch (error) {
    logWarn('AlquimiaAlumnoMegalist', 'Error obteniendo último actor (fail-open)', {
      student_id: studentId,
      item_ref: itemRef,
      error: error.message
    });
    return null;
  }
}

/**
 * Construye la megalista para un alumno
 * 
 * @param {Object} options - Opciones
 * @param {number} options.student_id - ID del alumno
 * @param {string} [options.levels_mode] - Modo de niveles (por ahora solo aceptado, no usado)
 * @returns {Promise<Object>} Estructura de megalista
 */
export async function getMegalistForStudent(options = {}) {
  const traceId = getRequestId();
  const { student_id, levels_mode } = options;
  
  if (!student_id) {
    throw new Error('student_id es requerido');
  }
  
  try {
    logInfo('AlquimiaAlumnoMegalist', 'Construyendo megalista', {
      traceId,
      student_id,
      levels_mode
    });
    
    // 1. Verificar que el alumno existe
    const studentRepo = getDefaultStudentRepo();
    const student = await studentRepo.getById(student_id);
    
    if (!student) {
      throw new Error(`Alumno no encontrado: ${student_id}`);
    }
    
    // 2. Verificar que no esté en pausa
    const pausaRepo = getDefaultPausaRepo();
    const pausaActiva = await pausaRepo.getPausaActiva(student_id);
    if (pausaActiva) {
      logWarn('AlquimiaAlumnoMegalist', 'Alumno en pausa', {
        traceId,
        student_id
      });
      // No lanzar error, pero retornar warning
    }
    
    // 3. Obtener nivel efectivo del alumno
    const nivelEfectivo = await getStudentEffectiveLevel(student_id);
    
    // 4. Obtener todos los estados de limpieza SHARED para este alumno
    const stateRepo = getDefaultCleaningItemStateRepo();
    
    // Query directa para obtener todos los estados SHARED
    const statesResult = await query(`
      SELECT * FROM cleaning_item_state
      WHERE student_id = $1
        AND product_key = 'pde'
        AND domain_type = 'transmutation'
      ORDER BY item_ref
    `, [student_id]);
    
    const states = statesResult.rows || [];
    
    // 5. Obtener todos los items del catálogo (query directa con fail-open)
    // FIX: listItems requiere listaId, así que hacemos query directa para obtener todos
    let allItems = [];
    let allListas = [];
    
    try {
      const catalogRepo = getDefaultAlquimiaCatalogRepo();
      allListas = await catalogRepo.listListas({ onlyActive: true });
      
      // Obtener todos los items activos con query directa (fail-open)
      const itemsResult = await query(`
        SELECT * FROM items_transmutaciones
        WHERE (status = 'active' OR activo = true)
        ORDER BY priority ASC, nivel ASC NULLS LAST, created_at ASC
      `);
      allItems = itemsResult.rows || [];
    } catch (error) {
      logWarn('AlquimiaAlumnoMegalist', 'Error obteniendo catálogo (fail-open)', {
        traceId,
        student_id,
        error: error.message
      });
      // Fail-open: continuar con arrays vacíos
      allItems = [];
      allListas = [];
      warnings.push({
        type: 'CATALOG_FETCH_ERROR',
        message: `Error obteniendo catálogo: ${error.message}`
      });
    }
    
    // Crear mapas para acceso rápido
    const itemsByRef = {};
    for (const item of allItems) {
      itemsByRef[item.item_ref] = item;
    }
    
    const listasById = {};
    for (const lista of allListas) {
      listasById[lista.id] = lista;
    }
    
    // 6. Construir estructura agrupada por listas
    const listsMap = {};
    const warnings = [];
    
    // Inicializar todas las listas
    for (const lista of allListas) {
      listsMap[lista.id] = {
        lista_id: lista.id,
        lista_nombre: lista.nombre,
        lista_tipo: lista.tipo,
        never: [],
        important: [],
        pending: [],
        reviewed_by_student: [],
        reviewed_by_master: []
      };
    }
    
    // Procesar estados (con fail-open completo)
    for (const state of states) {
      // Fail-open: si state no tiene item_ref, saltar
      if (!state?.item_ref) {
        warnings.push({
          type: 'STATE_MISSING_ITEM_REF',
          state_id: state?.id || 'unknown',
          message: 'Estado sin item_ref, saltando'
        });
        continue;
      }
      
      const item = itemsByRef[state.item_ref];
      
      // Fail-open: si item no existe, usar fallback pero continuar
      if (!item) {
        warnings.push({
          type: 'ITEM_NOT_RESOLVED',
          item_ref: state.item_ref,
          domain_type: state.domain_type || 'transmutation',
          message: `Item no encontrado en catálogo: ${state.item_ref}`
        });
        
        // Usar fallback para item no resuelto
        const fallbackListaId = 'unknown';
        if (!listsMap[fallbackListaId]) {
          listsMap[fallbackListaId] = {
            lista_id: fallbackListaId,
            lista_nombre: 'Sin lista (NO_RESUELTO)',
            lista_tipo: 'recurrente',
            never: [],
            important: [],
            pending: [],
            reviewed_by_student: [],
            reviewed_by_master: []
          };
        }
        
        // Agregar item no resuelto como "never" en lista unknown
        listsMap[fallbackListaId].never.push({
          item_id: null,
          item_ref: state.item_ref,
          item_nombre: 'NO_RESUELTO',
          item_nivel: null,
          lista_id: fallbackListaId,
          lista_nombre: 'Sin lista (NO_RESUELTO)',
          lista_tipo: 'recurrente',
          state: 'never',
          shared_last_cleaned_at: state.shared_last_cleaned_at || null,
          shared_clean_count: state.shared_clean_count || 0,
          shared_completed: state.shared_completed || 0,
          shared_remaining: state.shared_remaining ?? null,
          last_actor: null
        });
        continue;
      }
      
      // Fail-open: verificar nivel (si no se puede comparar, no filtrar)
      const itemNivel = item.nivel ?? null;
      const nivelEfectivoNum = nivelEfectivo ?? null;
      
      if (itemNivel !== null && nivelEfectivoNum !== null) {
        if (itemNivel > nivelEfectivoNum) {
          // No incluir en megalista (no aplica)
          continue;
        }
      } else if (itemNivel !== null || nivelEfectivoNum !== null) {
        // Uno es null, no se puede comparar → warning pero continuar
        warnings.push({
          type: 'LEVEL_NOT_COMPARABLE',
          item_ref: state.item_ref,
          item_level: itemNivel,
          student_level: nivelEfectivoNum,
          message: 'No se puede comparar nivel (uno es null)'
        });
      }
      
      // Fail-open: resolver lista
      const listaId = item.lista_id ?? null;
      let lista = null;
      
      if (listaId !== null) {
        lista = listasById[listaId];
      }
      
      if (!lista) {
        warnings.push({
          type: 'LIST_NOT_RESOLVED',
          item_ref: state.item_ref,
          lista_id: listaId,
          message: `Lista no encontrada: ${listaId || 'null'}`
        });
        
        // Usar fallback para lista no resuelta
        const fallbackListaId = 'unknown';
        if (!listsMap[fallbackListaId]) {
          listsMap[fallbackListaId] = {
            lista_id: fallbackListaId,
            lista_nombre: 'Sin lista (NO_RESUELTO)',
            lista_tipo: 'recurrente',
            never: [],
            important: [],
            pending: [],
            reviewed_by_student: [],
            reviewed_by_master: []
          };
        }
        lista = {
          id: fallbackListaId,
          nombre: 'Sin lista (NO_RESUELTO)',
          tipo: 'recurrente'
        };
      }
      
      // Fail-open: calcular estado (si lista.tipo no existe, usar 'recurrente')
      const listaTipo = lista.tipo || 'recurrente';
      let itemState;
      try {
        itemState = calculateItemState(state, item, listaTipo);
      } catch (error) {
        logWarn('AlquimiaAlumnoMegalist', 'Error calculando estado (fail-open)', {
          traceId,
          student_id,
          item_ref: state.item_ref,
          error: error.message
        });
        // Fallback a 'never' si falla cálculo
        itemState = 'never';
        warnings.push({
          type: 'STATE_CALCULATION_ERROR',
          item_ref: state.item_ref,
          message: `Error calculando estado: ${error.message}`
        });
      }
      
      // Obtener último actor (para separar revisados) - fail-open ya implementado
      const lastActor = await getLastCleanActor(student_id, state.item_ref);
      
      const itemData = {
        item_id: item.id ?? null,
        item_ref: item.item_ref || state.item_ref,
        item_nombre: item.nombre || 'NO_RESUELTO',
        item_nivel: itemNivel,
        lista_id: lista.id,
        lista_nombre: lista.nombre || 'Sin lista (NO_RESUELTO)',
        lista_tipo: listaTipo,
        state: itemState,
        shared_last_cleaned_at: state.shared_last_cleaned_at || null,
        shared_clean_count: state.shared_clean_count || 0,
        shared_completed: state.shared_completed || 0,
        shared_remaining: state.shared_remaining ?? null,
        last_actor: lastActor
      };
      
      // Fail-open: asegurar que listsMap[lista.id] existe antes de push
      if (!listsMap[lista.id]) {
        listsMap[lista.id] = {
          lista_id: lista.id,
          lista_nombre: lista.nombre || 'Sin lista (NO_RESUELTO)',
          lista_tipo: listaTipo,
          never: [],
          important: [],
          pending: [],
          reviewed_by_student: [],
          reviewed_by_master: []
        };
      }
      
      // Fail-open: asegurar que el grupo de estado existe
      if (!listsMap[lista.id][itemState]) {
        listsMap[lista.id][itemState] = [];
      }
      
      if (itemState === 'reviewed') {
        const reviewedGroup = lastActor === 'student' ? 'reviewed_by_student' : 'reviewed_by_master';
        if (!listsMap[lista.id][reviewedGroup]) {
          listsMap[lista.id][reviewedGroup] = [];
        }
        listsMap[lista.id][reviewedGroup].push(itemData);
      } else {
        listsMap[lista.id][itemState].push(itemData);
      }
    }
    
    // 7. Procesar items que NO tienen estado (nunca limpiados) - con fail-open
    for (const item of allItems) {
      // Fail-open: si item no tiene item_ref, saltar
      if (!item?.item_ref) {
        warnings.push({
          type: 'ITEM_MISSING_REF',
          item_id: item?.id || 'unknown',
          message: 'Item sin item_ref, saltando'
        });
        continue;
      }
      
      // Fail-open: verificar nivel (si no se puede comparar, no filtrar)
      const itemNivel = item.nivel ?? null;
      const nivelEfectivoNum = nivelEfectivo ?? null;
      
      if (itemNivel !== null && nivelEfectivoNum !== null) {
        if (itemNivel > nivelEfectivoNum) {
          // No incluir en megalista (no aplica)
          continue;
        }
      } else if (itemNivel !== null || nivelEfectivoNum !== null) {
        // Uno es null, no se puede comparar → warning pero continuar
        warnings.push({
          type: 'LEVEL_NOT_COMPARABLE',
          item_ref: item.item_ref,
          item_level: itemNivel,
          student_level: nivelEfectivoNum,
          message: 'No se puede comparar nivel (uno es null)'
        });
      }
      
      // Si ya está en algún estado, saltar
      const existingState = states.find(s => s?.item_ref === item.item_ref);
      if (existingState) {
        continue;
      }
      
      // Fail-open: resolver lista
      const listaId = item.lista_id ?? null;
      let lista = null;
      
      if (listaId !== null) {
        lista = listasById[listaId];
      }
      
      if (!lista) {
        warnings.push({
          type: 'LIST_NOT_RESOLVED',
          item_ref: item.item_ref,
          lista_id: listaId,
          message: `Lista no encontrada para item nunca limpiado: ${listaId || 'null'}`
        });
        
        // Usar fallback para lista no resuelta
        const fallbackListaId = 'unknown';
        if (!listsMap[fallbackListaId]) {
          listsMap[fallbackListaId] = {
            lista_id: fallbackListaId,
            lista_nombre: 'Sin lista (NO_RESUELTO)',
            lista_tipo: 'recurrente',
            never: [],
            important: [],
            pending: [],
            reviewed_by_student: [],
            reviewed_by_master: []
          };
        }
        lista = {
          id: fallbackListaId,
          nombre: 'Sin lista (NO_RESUELTO)',
          tipo: 'recurrente'
        };
      }
      
      // Fail-open: asegurar que listsMap[lista.id] existe
      if (!listsMap[lista.id]) {
        listsMap[lista.id] = {
          lista_id: lista.id,
          lista_nombre: lista.nombre || 'Sin lista (NO_RESUELTO)',
          lista_tipo: lista.tipo || 'recurrente',
          never: [],
          important: [],
          pending: [],
          reviewed_by_student: [],
          reviewed_by_master: []
        };
      }
      
      // Fail-open: asegurar que never existe
      if (!listsMap[lista.id].never) {
        listsMap[lista.id].never = [];
      }
      
      listsMap[lista.id].never.push({
        item_id: item.id ?? null,
        item_ref: item.item_ref,
        item_nombre: item.nombre || 'NO_RESUELTO',
        item_nivel: itemNivel,
        lista_id: lista.id,
        lista_nombre: lista.nombre || 'Sin lista (NO_RESUELTO)',
        lista_tipo: lista.tipo || 'recurrente',
        state: 'never',
        shared_last_cleaned_at: null,
        shared_clean_count: 0,
        shared_completed: 0,
        shared_remaining: null,
        last_actor: null
      });
    }
    
    // 8. Asegurar que TODAS las listas canónicas estén presentes (CRÍTICO: listas como estructura)
    // Las listas NO dependen de items - son estructura base
    for (const lista of allListas) {
      if (!listsMap[lista.id]) {
        listsMap[lista.id] = {
          lista_id: lista.id,
          lista_nombre: lista.nombre || 'Sin nombre',
          lista_tipo: lista.tipo || 'recurrente',
          never: [],
          important: [],
          pending: [],
          reviewed_by_student: [],
          reviewed_by_master: []
        };
      }
    }
    
    // 9. Convertir map a array y ordenar listas por orden (SIN FILTRAR - todas las listas siempre visibles)
    const lists = Object.values(listsMap)
      .sort((a, b) => {
        // Ordenar por orden de lista (si existe) o por nombre - con fail-open
        const listaA = listasById[a?.lista_id] || null;
        const listaB = listasById[b?.lista_id] || null;
        const ordenA = listaA?.orden ?? 999;
        const ordenB = listaB?.orden ?? 999;
        if (ordenA !== ordenB) {
          return ordenA - ordenB;
        }
        const nombreA = listaA?.nombre || a?.lista_nombre || '';
        const nombreB = listaB?.nombre || b?.lista_nombre || '';
        return nombreA.localeCompare(nombreB);
      });
    
    // 10. Calcular resumen (con fail-open)
    let total = 0;
    let never = 0;
    let important = 0;
    let pending = 0;
    let reviewed = 0;
    let reviewedByStudent = 0;
    let reviewedByMaster = 0;
    
    for (const list of lists) {
      // Fail-open: asegurar que los arrays existen antes de acceder
      never += (list.never?.length || 0);
      important += (list.important?.length || 0);
      pending += (list.pending?.length || 0);
      reviewedByStudent += (list.reviewed_by_student?.length || 0);
      reviewedByMaster += (list.reviewed_by_master?.length || 0);
    }
    
    reviewed = reviewedByStudent + reviewedByMaster;
    total = never + important + pending + reviewed;
    
    const percentReviewed = total > 0 ? Math.round((reviewed / total) * 100) : 0;
    
    // 11. Construir respuesta
    const result = {
      student: {
        id: student.id,
        student_id: student.id,
        email: student.email,
        apodo: student.apodo || null,
        nombre_completo: student.nombre_completo || null,
        nivel_efectivo: nivelEfectivo
      },
      summary: {
        total,
        never,
        important,
        pending,
        reviewed,
        reviewed_by_student: reviewedByStudent,
        reviewed_by_master: reviewedByMaster,
        percent_reviewed: percentReviewed
      },
      lists,
      reviewed: {
        by_student: lists.map(list => ({
          lista_id: list.lista_id || 'unknown',
          lista_nombre: list.lista_nombre || 'Sin lista (NO_RESUELTO)',
          items: list.reviewed_by_student || []
        })),
        by_master: lists.map(list => ({
          lista_id: list.lista_id || 'unknown',
          lista_nombre: list.lista_nombre || 'Sin lista (NO_RESUELTO)',
          items: list.reviewed_by_master || []
        }))
      },
      warnings: warnings.length > 0 ? warnings : undefined,
      context: {
        levels_mode,
        clean_layer: 'shared' // Siempre SHARED en este panel
      }
    };
    
    logInfo('AlquimiaAlumnoMegalist', 'Megalista construida', {
      traceId,
      student_id,
      total,
      never,
      important,
      pending,
      reviewed,
      lists_count: lists.length,
      warnings_count: warnings.length
    });
    
    return result;
  } catch (error) {
    logError('AlquimiaAlumnoMegalist', 'Error construyendo megalista', {
      traceId,
      student_id,
      error: error.message,
      code: error.code,
      stack: error.stack
    });
    throw error;
  }
}
