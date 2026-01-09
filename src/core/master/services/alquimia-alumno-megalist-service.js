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
    // REGLA CANÓNICA: remaining = veces_limpiar - clean_count (calculado dinámicamente)
    // Para determinar estado:
    // - never: remaining > 0 y clean_count = 0 (nunca trabajado)
    // - pending: remaining > 0 y clean_count > 0 (parcialmente trabajado)
    // - reviewed: remaining <= 0 (completado)
    const remaining = state?.shared_remaining ?? null;
    const cleanCount = state?.shared_clean_count ?? 0;
    const completed = state?.shared_completed ?? 0;
    
    // Fail-open: si no hay estado, retornar 'never'
    if (remaining === null) {
      return 'never';
    }
    
    // REGLA: remaining <= 0 significa que está completado
    // Pero también verificamos clean_count para evitar falsos positivos
    if (remaining <= 0 || completed > 0) {
      return 'reviewed';
    }
    
    // REGLA: Si tiene clean_count > 0 pero remaining > 0, está parcialmente trabajado
    if (cleanCount > 0 && remaining > 0) {
      return 'pending';
    }
    
    // REGLA: Si remaining > 0 y clean_count = 0, nunca trabajado
    if (remaining > 0 && cleanCount === 0) {
      return 'never';
    }
    
    // Fallback: pending
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
 * @param {number|null} [options.level_cap] - Cap de nivel (si null, usa nivel_efectivo)
 * @returns {Promise<Object>} Estructura de megalista
 */
export async function getMegalistForStudent(options = {}) {
  const traceId = getRequestId();
  const { student_id, levels_mode, level_cap = null } = options;
  
  if (!student_id) {
    throw new Error('student_id es requerido');
  }
  
  try {
    // 1. Determinar cap de nivel
    let nivelCap;
    if (level_cap !== null && level_cap !== undefined) {
      nivelCap = parseInt(level_cap, 10);
      if (isNaN(nivelCap) || nivelCap < 1) {
        nivelCap = 999; // Fallback a infinito si inválido
      }
    } else {
      // Usar nivel efectivo como default
      nivelCap = await getStudentEffectiveLevel(student_id);
    }
    
    logInfo('AlquimiaAlumnoMegalist', 'Construyendo megalista desde estado', {
      traceId,
      student_id,
      levels_mode,
      level_cap: nivelCap,
      level_cap_provided: level_cap !== null
    });
    
    // 2. Verificar que el alumno existe
    const studentRepo = getDefaultStudentRepo();
    const student = await studentRepo.getById(student_id);
    
    if (!student) {
      throw new Error(`Alumno no encontrado: ${student_id}`);
    }
    
    // 3. Verificar que no esté en pausa
    const pausaRepo = getDefaultPausaRepo();
    const pausaActiva = await pausaRepo.getPausaActiva(student_id);
    if (pausaActiva) {
      logWarn('AlquimiaAlumnoMegalist', 'Alumno en pausa', {
        traceId,
        student_id
      });
    }
    
    // 4. OBTENER ESTADOS DE LIMPIEZA SHARED PARA ESTE ALUMNO (FUENTE ÚNICA)
    // Filtrar por level_cap: solo items con nivel <= cap
    // Necesitamos hacer JOIN con items_transmutaciones para filtrar por nivel
    const statesResult = await query(`
      SELECT s.*, i.nivel as item_nivel
      FROM cleaning_item_state s
      LEFT JOIN items_transmutaciones i ON i.item_ref = s.item_ref
      WHERE s.student_id = $1
        AND s.product_key = 'pde'
        AND s.domain_type = 'transmutation'
        AND (i.nivel IS NULL OR i.nivel <= $2::integer)
      ORDER BY s.item_ref
    `, [student_id, nivelCap]);
    
    const states = statesResult.rows || [];
    
    logInfo('AlquimiaAlumnoMegalist', 'Estados obtenidos desde cleaning_item_state (filtrados por level_cap)', {
      traceId,
      student_id,
      level_cap: nivelCap,
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
      // REGLA CANÓNICA: Solo items activos (status='active') - archivados no son renderizables
      const itemsResult = await query(`
        SELECT * FROM items_transmutaciones
        WHERE status = 'active'
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
      // REGLA CANÓNICA: resolveItemsFromCatalog solo devuelve items activos (status='active')
      const item = itemsByRef[state.item_ref];
      
      if (!item) {
        // Si el estado existe pero el item no está en itemsByRef, puede ser porque:
        // 1. Está archivado (status='archived') → NO RENDERIZAR
        // 2. No existe en catálogo → NO RENDERIZAR
        // REGLA CANÓNICA: Items archivados no son renderizables en UI operativa
        const itemCheck = await query(`
          SELECT status FROM items_transmutaciones WHERE item_ref = $1
        `, [state.item_ref]);
        const itemRaw = itemCheck.rows[0];
        
        if (itemRaw && itemRaw.status === 'archived') {
          // Item archivado: no renderizar (historia se conserva en events, pero no aparece en UI)
          logInfo('AlquimiaAlumnoMegalist', 'Item archivado excluido de megalist', {
            traceId,
            student_id,
            item_ref: state.item_ref
          });
          warnings.push({
            type: 'ITEM_ARCHIVED',
            item_ref: state.item_ref,
            domain_type: state.domain_type || 'transmutation',
            message: `Item archivado: ${state.item_ref} - NO SE RENDERIZA (historia preservada en events)`
          });
        } else {
          // Item no encontrado en catálogo → WARNING + NO RENDERIZAR
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
        }
        continue; // NO SE RENDERIZA
      }
      
      // Verificación adicional: asegurar que el item está activo (por seguridad)
      // resolveItemsFromCatalog ya filtra, pero verificamos por seguridad
      if (item.status !== 'active') {
        logInfo('AlquimiaAlumnoMegalist', 'Item no activo excluido de megalist', {
          traceId,
          student_id,
          item_ref: state.item_ref,
          status: item.status
        });
        continue; // NO SE RENDERIZA
      }
      
      // Verificar nivel efectivo (si item.nivel > nivelCap, no aplica)
      // NOTA: Los estados ya vienen filtrados por nivelCap en la query, pero verificamos por seguridad
      const itemNivel = item.nivel ?? null;
      
      if (itemNivel !== null && nivelCap !== null) {
        if (itemNivel > nivelCap) {
          // No incluir en megalista (no aplica por nivel)
          logInfo('AlquimiaAlumnoMegalist', 'Item excluido por nivel', {
            traceId,
            student_id,
            item_ref: state.item_ref,
            item_nivel: itemNivel,
            nivel_efectivo: nivelCap
          });
          continue;
        }
      }
      
      // Resolver lista desde catálogo (SOLO como resolver)
      // REGLA CANÓNICA: resolveListasFromCatalog solo devuelve listas activas (status='active')
      const listaId = item.lista_id ?? null;
      let lista = null;
      
      if (listaId !== null) {
        lista = listasById[listaId];
      }
      
      if (!lista) {
        // Si la lista no está en listasById, puede ser porque:
        // 1. Está archivada (status='archived') → NO RENDERIZAR
        // 2. No existe en catálogo → NO RENDERIZAR
        // REGLA CANÓNICA: Listas archivadas no son renderizables en UI operativa
        const listaCheck = await query(`
          SELECT status FROM listas_transmutaciones WHERE id = $1
        `, [listaId]);
        const listaRaw = listaCheck.rows[0];
        
        if (listaRaw && listaRaw.status === 'archived') {
          // Lista archivada: no renderizar item (historia se conserva en events, pero no aparece en UI)
          logInfo('AlquimiaAlumnoMegalist', 'Lista archivada excluida de megalist', {
            traceId,
            student_id,
            item_ref: state.item_ref,
            lista_id: listaId
          });
          warnings.push({
            type: 'LISTA_ARCHIVED',
            item_ref: state.item_ref,
            lista_id: listaId,
            message: `Lista archivada: ${listaId} - NO SE RENDERIZA (historia preservada en events)`
          });
        } else {
          // Lista no encontrada en catálogo → WARNING + NO RENDERIZAR
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
        }
        continue; // NO SE RENDERIZA
      }
      
      // Verificación adicional: asegurar que la lista está activa (por seguridad)
      // resolveListasFromCatalog ya filtra, pero verificamos por seguridad
      if (lista.status !== 'active') {
        logInfo('AlquimiaAlumnoMegalist', 'Lista no activa excluida de megalist', {
          traceId,
          student_id,
          item_ref: state.item_ref,
          lista_id: listaId,
          status: lista.status
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
      
      // Construir datos del item (incluye metadata completa para UI)
      const itemData = {
        item_id: item.id ?? null,
        item_ref: item.item_ref || state.item_ref,
        item_nombre: item.nombre || 'NO_RESUELTO', // Fail-open para nombre
        item_descripcion: item.descripcion || null, // Descripción para UI
        item_nivel: itemNivel,
        item_frecuencia_dias: item.frecuencia_dias || null, // Para recurrentes (ignorar para una_vez)
        item_veces_limpiar: item.veces_limpiar ?? null, // Para una_vez (requerido para progreso)
        lista_id: lista.id,
        lista_nombre: lista.nombre || 'Sin lista', // Fail-open para nombre
        lista_tipo: listaTipo,
        state: itemState,
        shared_last_cleaned_at: state.shared_last_cleaned_at || null,
        shared_clean_count: state.shared_clean_count || 0,
        shared_completed: state.shared_completed || 0,
        shared_remaining: state.shared_remaining ?? null,
        // Para una_vez: calcular progreso (realizadas / requeridas)
        progress_realizadas: listaTipo === 'una_vez' ? (state.shared_clean_count || 0) : null,
        progress_requeridas: listaTipo === 'una_vez' ? (item.veces_limpiar || 1) : null,
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
        nivel_efectivo: nivelCap,
        level_cap: nivelCap,
        level_cap_provided: level_cap !== null
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
        clean_layer: 'shared', // Siempre SHARED en este panel
        level_cap: nivelCap,
        level_cap_provided: level_cap !== null
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
