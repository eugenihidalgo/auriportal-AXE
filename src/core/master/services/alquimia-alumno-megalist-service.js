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
  if (tipo === 'recurrente') {
    const lastCleaned = state?.shared_last_cleaned_at;
    
    if (!lastCleaned) {
      return 'never';
    }
    
    const thresholdDays = item.frecuencia_dias || 7;
    const criticalMultiplier = item.critical_multiplier || 2.0;
    const criticalThreshold = thresholdDays * criticalMultiplier;
    
    const now = new Date();
    const lastCleanedDate = new Date(lastCleaned);
    const daysSince = Math.floor((now - lastCleanedDate) / (1000 * 60 * 60 * 24));
    
    if (daysSince < thresholdDays) {
      return 'reviewed';
    } else if (daysSince < criticalThreshold) {
      return 'pending';
    } else {
      return 'important';
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
    
    // 5. Obtener todos los items del catálogo
    const catalogRepo = getDefaultAlquimiaCatalogRepo();
    const allItems = await catalogRepo.listItems({ onlyActive: true });
    const allListas = await catalogRepo.listListas({ onlyActive: true });
    
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
    
    // Procesar estados
    for (const state of states) {
      const item = itemsByRef[state.item_ref];
      
      if (!item) {
        warnings.push({
          type: 'item_not_found',
          item_ref: state.item_ref,
          message: `Item no encontrado en catálogo: ${state.item_ref}`
        });
        continue;
      }
      
      // Verificar nivel (si item.nivel > nivel_efectivo, no aplica)
      if (item.nivel && item.nivel > nivelEfectivo) {
        // No incluir en megalista (no aplica)
        continue;
      }
      
      const lista = listasById[item.lista_id];
      if (!lista) {
        warnings.push({
          type: 'lista_not_found',
          lista_id: item.lista_id,
          item_ref: state.item_ref,
          message: `Lista no encontrada: ${item.lista_id}`
        });
        continue;
      }
      
      // Calcular estado
      const itemState = calculateItemState(state, item, lista.tipo);
      
      // Obtener último actor (para separar revisados)
      const lastActor = await getLastCleanActor(student_id, state.item_ref);
      
      const itemData = {
        item_id: item.id,
        item_ref: item.item_ref,
        item_nombre: item.nombre || 'NO_RESUELTO',
        item_nivel: item.nivel || null,
        lista_id: lista.id,
        lista_nombre: lista.nombre || 'Sin lista (NO_RESUELTO)',
        lista_tipo: lista.tipo,
        state: itemState,
        shared_last_cleaned_at: state.shared_last_cleaned_at,
        shared_clean_count: state.shared_clean_count || 0,
        shared_completed: state.shared_completed || 0,
        shared_remaining: state.shared_remaining ?? null,
        last_actor: lastActor
      };
      
      // Agregar a la lista correspondiente
      if (!listsMap[lista.id]) {
        listsMap[lista.id] = {
          lista_id: lista.id,
          lista_nombre: lista.nombre || 'Sin lista (NO_RESUELTO)',
          lista_tipo: lista.tipo,
          never: [],
          important: [],
          pending: [],
          reviewed_by_student: [],
          reviewed_by_master: []
        };
      }
      
      if (itemState === 'reviewed') {
        if (lastActor === 'student') {
          listsMap[lista.id].reviewed_by_student.push(itemData);
        } else {
          listsMap[lista.id].reviewed_by_master.push(itemData);
        }
      } else {
        listsMap[lista.id][itemState].push(itemData);
      }
    }
    
    // 7. Procesar items que NO tienen estado (nunca limpiados)
    for (const item of allItems) {
      // Verificar nivel
      if (item.nivel && item.nivel > nivelEfectivo) {
        continue;
      }
      
      // Si ya está en algún estado, saltar
      const existingState = states.find(s => s.item_ref === item.item_ref);
      if (existingState) {
        continue;
      }
      
      const lista = listasById[item.lista_id];
      if (!lista) {
        continue;
      }
      
      if (!listsMap[lista.id]) {
        listsMap[lista.id] = {
          lista_id: lista.id,
          lista_nombre: lista.nombre || 'Sin lista (NO_RESUELTO)',
          lista_tipo: lista.tipo,
          never: [],
          important: [],
          pending: [],
          reviewed_by_student: [],
          reviewed_by_master: []
        };
      }
      
      listsMap[lista.id].never.push({
        item_id: item.id,
        item_ref: item.item_ref,
        item_nombre: item.nombre || 'NO_RESUELTO',
        item_nivel: item.nivel || null,
        lista_id: lista.id,
        lista_nombre: lista.nombre || 'Sin lista (NO_RESUELTO)',
        lista_tipo: lista.tipo,
        state: 'never',
        shared_last_cleaned_at: null,
        shared_clean_count: 0,
        shared_completed: 0,
        shared_remaining: null,
        last_actor: null
      });
    }
    
    // 8. Convertir map a array y ordenar listas por orden
    const lists = Object.values(listsMap)
      .filter(list => 
        list.never.length > 0 ||
        list.important.length > 0 ||
        list.pending.length > 0 ||
        list.reviewed_by_student.length > 0 ||
        list.reviewed_by_master.length > 0
      )
      .sort((a, b) => {
        // Ordenar por orden de lista (si existe) o por nombre
        const listaA = listasById[a.lista_id];
        const listaB = listasById[b.lista_id];
        const ordenA = listaA?.orden ?? 999;
        const ordenB = listaB?.orden ?? 999;
        if (ordenA !== ordenB) {
          return ordenA - ordenB;
        }
        return (listaA?.nombre || '').localeCompare(listaB?.nombre || '');
      });
    
    // 9. Calcular resumen
    let total = 0;
    let never = 0;
    let important = 0;
    let pending = 0;
    let reviewed = 0;
    let reviewedByStudent = 0;
    let reviewedByMaster = 0;
    
    for (const list of lists) {
      never += list.never.length;
      important += list.important.length;
      pending += list.pending.length;
      reviewedByStudent += list.reviewed_by_student.length;
      reviewedByMaster += list.reviewed_by_master.length;
    }
    
    reviewed = reviewedByStudent + reviewedByMaster;
    total = never + important + pending + reviewed;
    
    const percentReviewed = total > 0 ? Math.round((reviewed / total) * 100) : 0;
    
    // 10. Construir respuesta
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
          lista_id: list.lista_id,
          lista_nombre: list.lista_nombre,
          items: list.reviewed_by_student
        })),
        by_master: lists.map(list => ({
          lista_id: list.lista_id,
          lista_nombre: list.lista_nombre,
          items: list.reviewed_by_master
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
