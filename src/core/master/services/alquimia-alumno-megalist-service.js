// src/core/master/services/alquimia-alumno-megalist-service.js
// Alquimia Alumno Megalist Service v1.1
//
// Read model CANÓNICO: Construye megalista EXCLUSIVAMENTE desde cleaning_item_state
// REGLA FUNDAMENTAL: La megalista se construye desde el ESTADO DEL ALUMNO, no desde el catálogo
//
// - Fuente única: cleaning_item_state WHERE student_id = ?
// - Catálogo SOLO como resolver (nombre, descripción)
// - Listas aparecen SOLO si contienen items con estado
// - Si item no se puede resolver → WARNING + NO SE RENDERIZA

import { query } from '../../../../database/pg.js';
import { getRequestId } from '../../observability/request-context.js';
import { logError, logInfo, logWarn } from '../../observability/logger.js';
import { getDefaultAlquimiaCatalogRepo } from '../../../infra/repos/alquimia-catalog-repo-pg.js';
import { getDefaultStudentRepo } from '../../../infra/repos/student-repo-pg.js';
import { getStudentEffectiveLevel } from './cleaning-engine-service.js';
import { getDefaultPausaRepo } from '../../../infra/repos/pausa-repo-pg.js';

/**
 * Calcula el estado de un item basado en cleaning_item_state
 * 
 * @param {Object} state - Estado de cleaning_item_state (SHARED)
 * @param {Object} item - Item del catálogo (para metadata: frecuencia_dias, critical_multiplier, tipo)
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
 * Construye la megalista para un alumno DESDE cleaning_item_state
 * 
 * REGLA FUNDAMENTAL: La megalista se construye desde el ESTADO DEL ALUMNO, no desde el catálogo
 * - Fuente única: cleaning_item_state WHERE student_id = ?
 * - Catálogo SOLO como resolver (nombre, descripción)
 * - Listas aparecen SOLO si contienen items con estado
 * - Si item no se puede resolver → WARNING + NO SE RENDERIZA
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
    logInfo('AlquimiaAlumnoMegalist', 'Construyendo megalista desde estado', {
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
    }
    
    // 3. Obtener nivel efectivo del alumno
    const nivelEfectivo = await getStudentEffectiveLevel(student_id);
    
    // 4. OBTENER TODOS LOS ESTADOS DE LIMPIEZA SHARED PARA ESTE ALUMNO (FUENTE ÚNICA)
    const statesResult = await query(`
      SELECT * FROM cleaning_item_state
      WHERE student_id = $1
        AND product_key = 'pde'
        AND domain_type = 'transmutation'
      ORDER BY item_ref
    `, [student_id]);
    
    const states = statesResult.rows || [];
    
    logInfo('AlquimiaAlumnoMegalist', 'Estados obtenidos desde cleaning_item_state', {
      traceId,
      student_id,
      states_count: states.length
    });
    
    // 5. Cargar catálogo SOLO como resolver (para obtener nombre, descripción, lista_id)
    let itemsByRef = {};
    let listasById = {};
    
    try {
      const catalogRepo = getDefaultAlquimiaCatalogRepo();
      
      // Cargar listas del catálogo (para resolver lista_id → nombre)
      const allListas = await catalogRepo.listListas({ onlyActive: true });
      for (const lista of allListas) {
        listasById[lista.id] = lista;
      }
      
      // Cargar items del catálogo (para resolver item_ref → nombre, nivel, lista_id, metadata)
      const itemsResult = await query(`
        SELECT * FROM items_transmutaciones
        WHERE (status = 'active' OR activo = true)
        ORDER BY priority ASC, nivel ASC NULLS LAST, created_at ASC
      `);
      const allItems = itemsResult.rows || [];
      
      for (const item of allItems) {
        if (item.item_ref) {
          itemsByRef[item.item_ref] = item;
        }
      }
      
      logInfo('AlquimiaAlumnoMegalist', 'Catálogo cargado como resolver', {
        traceId,
        items_count: allItems.length,
        listas_count: allListas.length
      });
    } catch (error) {
      logWarn('AlquimiaAlumnoMegalist', 'Error obteniendo catálogo (fail-open)', {
        traceId,
        student_id,
        error: error.message
      });
      // Fail-open: continuar con mapas vacíos (solo warnings)
      itemsByRef = {};
      listasById = {};
    }
    
    // 6. Construir estructura agrupada por listas DESDE ESTADOS
    const listsMap = {}; // Solo listas que tienen items con estado
    const warnings = [];
    
    // Procesar CADA estado (CRÍTICO: fuente única)
    for (const state of states) {
      // Validar estado
      if (!state?.item_ref) {
        logWarn('AlquimiaAlumnoMegalist', 'Estado sin item_ref (STATE_WITHOUT_ITEM)', {
          traceId,
          student_id,
          state_id: state?.id || 'unknown'
        });
        warnings.push({
          type: 'STATE_WITHOUT_ITEM',
          state_id: state?.id || 'unknown',
          message: 'Estado sin item_ref, saltando'
        });
        continue;
      }
      
      // Resolver item desde catálogo (SOLO como resolver, NO crea items)
      const item = itemsByRef[state.item_ref];
      
      if (!item) {
        // Si el estado existe pero el item no → WARNING + NO RENDERIZAR
        logWarn('AlquimiaAlumnoMegalist', 'Estado sin item en catálogo (ITEM_WITHOUT_RESOLVER)', {
          traceId,
          student_id,
          item_ref: state.item_ref
        });
        warnings.push({
          type: 'ITEM_WITHOUT_RESOLVER',
          item_ref: state.item_ref,
          domain_type: state.domain_type || 'transmutation',
          message: `Item no encontrado en catálogo: ${state.item_ref} - NO SE RENDERIZA`
        });
        continue; // NO SE RENDERIZA
      }
      
      // Verificar nivel efectivo (si item.nivel > nivel_efectivo, no aplica)
      const itemNivel = item.nivel ?? null;
      const nivelEfectivoNum = nivelEfectivo ?? null;
      
      if (itemNivel !== null && nivelEfectivoNum !== null) {
        if (itemNivel > nivelEfectivoNum) {
          // No incluir en megalista (no aplica por nivel)
          logInfo('AlquimiaAlumnoMegalist', 'Item excluido por nivel', {
            traceId,
            student_id,
            item_ref: state.item_ref,
            item_nivel: itemNivel,
            nivel_efectivo: nivelEfectivoNum
          });
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
      
      // Resolver lista desde catálogo (SOLO como resolver)
      const listaId = item.lista_id ?? null;
      let lista = null;
      
      if (listaId !== null) {
        lista = listasById[listaId];
      }
      
      if (!lista) {
        // Si el item existe pero la lista no → WARNING + NO RENDERIZAR
        logWarn('AlquimiaAlumnoMegalist', 'Item sin lista en catálogo (ITEM_WITHOUT_LIST)', {
          traceId,
          student_id,
          item_ref: state.item_ref,
          lista_id: listaId
        });
        warnings.push({
          type: 'ITEM_WITHOUT_LIST',
          item_ref: state.item_ref,
          lista_id: listaId,
          message: `Lista no encontrada: ${listaId || 'null'} - NO SE RENDERIZA`
        });
        continue; // NO SE RENDERIZA
      }
      
      // Calcular estado del item
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
      
      // Obtener último actor (para separar revisados)
      const lastActor = await getLastCleanActor(student_id, state.item_ref);
      
      // Construir datos del item
      const itemData = {
        item_id: item.id ?? null,
        item_ref: item.item_ref || state.item_ref,
        item_nombre: item.nombre || 'NO_RESUELTO', // Fail-open para nombre
        item_nivel: itemNivel,
        lista_id: lista.id,
        lista_nombre: lista.nombre || 'Sin lista', // Fail-open para nombre
        lista_tipo: listaTipo,
        state: itemState,
        shared_last_cleaned_at: state.shared_last_cleaned_at || null,
        shared_clean_count: state.shared_clean_count || 0,
        shared_completed: state.shared_completed || 0,
        shared_remaining: state.shared_remaining ?? null,
        last_actor: lastActor
      };
      
      // Asegurar que la lista existe en listsMap (SOLO si tiene items con estado)
      if (!listsMap[lista.id]) {
        listsMap[lista.id] = {
          lista_id: lista.id,
          lista_nombre: lista.nombre || 'Sin nombre',
          lista_tipo: listaTipo,
          never: [],
          important: [],
          pending: [],
          reviewed_by_student: [],
          reviewed_by_master: []
        };
      }
      
      // Agregar item a la lista correspondiente
      if (itemState === 'reviewed') {
        const reviewedGroup = lastActor === 'student' ? 'reviewed_by_student' : 'reviewed_by_master';
        listsMap[lista.id][reviewedGroup].push(itemData);
      } else {
        listsMap[lista.id][itemState].push(itemData);
      }
    }
    
    // 7. Convertir map a array y ordenar listas (SOLO listas que tienen items con estado)
    const lists = Object.values(listsMap)
      .filter(list => {
        // Filtrar: solo listas que tienen al menos un item con estado
        const hasItems = (list.never?.length || 0) +
                        (list.important?.length || 0) +
                        (list.pending?.length || 0) +
                        (list.reviewed_by_student?.length || 0) +
                        (list.reviewed_by_master?.length || 0) > 0;
        return hasItems;
      })
      .sort((a, b) => {
        // Ordenar por orden de lista (si existe) o por nombre
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
    
    // 8. Calcular resumen DESDE ESTADOS REALES
    let total = 0;
    let never = 0;
    let important = 0;
    let pending = 0;
    let reviewed = 0;
    let reviewedByStudent = 0;
    let reviewedByMaster = 0;
    
    for (const list of lists) {
      never += (list.never?.length || 0);
      important += (list.important?.length || 0);
      pending += (list.pending?.length || 0);
      reviewedByStudent += (list.reviewed_by_student?.length || 0);
      reviewedByMaster += (list.reviewed_by_master?.length || 0);
    }
    
    reviewed = reviewedByStudent + reviewedByMaster;
    total = never + important + pending + reviewed;
    
    // Validar coherencia: total debe coincidir con estados procesados (menos los excluidos)
    logInfo('AlquimiaAlumnoMegalist', 'Resumen calculado desde estados', {
      traceId,
      student_id,
      states_count: states.length,
      total,
      never,
      important,
      pending,
      reviewed,
      reviewed_by_student: reviewedByStudent,
      reviewed_by_master: reviewedByMaster,
      lists_count: lists.length,
      warnings_count: warnings.length
    });
    
    const percentReviewed = total > 0 ? Math.round((reviewed / total) * 100) : 0;
    
    // 9. Construir respuesta
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
      lists, // SOLO listas que tienen items con estado
      reviewed: {
        by_student: lists
          .filter(list => (list.reviewed_by_student?.length || 0) > 0)
          .map(list => ({
            lista_id: list.lista_id,
            lista_nombre: list.lista_nombre,
            items: list.reviewed_by_student || []
          })),
        by_master: lists
          .filter(list => (list.reviewed_by_master?.length || 0) > 0)
          .map(list => ({
            lista_id: list.lista_id,
            lista_nombre: list.lista_nombre,
            items: list.reviewed_by_master || []
          }))
      },
      warnings: warnings.length > 0 ? warnings : undefined,
      context: {
        levels_mode,
        clean_layer: 'shared' // Siempre SHARED en este panel
      }
    };
    
    logInfo('AlquimiaAlumnoMegalist', 'Megalista construida desde estado', {
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
