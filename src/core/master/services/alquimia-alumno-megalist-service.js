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
import { computeVisualState } from './cleaning-projection-model.js';
import { validateViewLayer } from './cleaning-layer-constants.js';

/**
 * Calcula days_since_last_clean desde last_cleaned_at
 * 
 * @param {string|null} lastCleanedAt - Fecha ISO string o null
 * @returns {number|null} Días desde última limpieza o null si nunca
 */
function calculateDaysSince(lastCleanedAt) {
  if (!lastCleanedAt) {
    return null;
  }
  
  try {
    const now = new Date();
    const lastCleanedDate = new Date(lastCleanedAt);
    
    if (isNaN(lastCleanedDate.getTime())) {
      return null;
    }
    
    return Math.floor((now - lastCleanedDate) / (1000 * 60 * 60 * 24));
  } catch (error) {
    return null;
  }
}

/**
 * Obtiene el actor que hizo la última limpieza desde cleaning_events
 * UUID-ONLY: Acepta student_uuid (UUID canónico)
 * 
 * @param {string} studentUuid - UUID del estudiante
 * @param {string} itemRef - Referencia del item
 * @returns {Promise<string|null>} 'master' | 'student' | null
 */
async function getLastCleanActor(studentUuid, itemRef) {
  try {
    const { getDefaultCleaningEventsRepo } = await import('../../../infra/repos/cleaning/cleaning-events-repo-pg.js');
    const eventsRepo = getDefaultCleaningEventsRepo();
    
    const events = await eventsRepo.listEventsForStudentItem({
      student_uuid: studentUuid, // UUID-ONLY: usar UUID directamente
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
      student_uuid: studentUuid,
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
 * - Items devueltos PLANOS (NO agrupados) con state_by_view_layer
 * - Frontend agrupa por estado desde state_by_view_layer[view_layer]
 * 
 * REGLA CONSTITUCIONAL: view_layer es OBLIGATORIO
 * - view_layer decide qué estado se calcula
 * - state_by_view_layer contiene estados para todas las view_layers
 * 
 * @param {Object} options - Opciones
 * @param {string} options.student_uuid - UUID canónico del estudiante (OBLIGATORIO)
 * @param {string} options.view_layer - Capa de vista ('shared' | 'pde' | 'combo') - OBLIGATORIO
 * @param {string} [options.levels_mode] - Modo de niveles (por ahora solo aceptado, no usado)
 * @param {number|null} [options.level_cap] - Cap de nivel (si null, usa nivel_efectivo)
 * @returns {Promise<Object>} Estructura de megalista con items planos
 */
export async function getMegalistForStudent(options = {}) {
  const traceId = getRequestId();
  const { student_uuid, view_layer, lista_tipo, levels_mode, level_cap = null } = options;
  
  if (!student_uuid) {
    throw new Error('student_uuid es requerido');
  }
  
  // ============================================================================
  // GUARD CONSTITUCIONAL: view_layer es OBLIGATORIO
  // ============================================================================
  if (!view_layer) {
    const error = new Error('view_layer es requerido. Debe ser uno de: shared, pde, combo');
    error.code = 'MISSING_VIEW_LAYER';
    throw error;
  }
  
  // Validar view_layer
  try {
    validateViewLayer(view_layer);
  } catch (validationError) {
    const error = new Error(`view_layer inválido: ${validationError.message}`);
    error.code = 'INVALID_VIEW_LAYER';
    throw error;
  }
  
  // ============================================================================
  // GUARD CONSTITUCIONAL: lista_tipo es OBLIGATORIO
  // ============================================================================
  if (!lista_tipo) {
    const error = new Error('lista_tipo es requerido. Debe ser uno de: recurrente, una_vez');
    error.code = 'MISSING_LISTA_TIPO';
    throw error;
  }
  
  if (lista_tipo !== 'recurrente' && lista_tipo !== 'una_vez') {
    const error = new Error('lista_tipo inválido. Debe ser "recurrente" o "una_vez"');
    error.code = 'INVALID_LISTA_TIPO';
    throw error;
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
      nivelCap = await getStudentEffectiveLevel(student_uuid);
    }
    
    logInfo('AlquimiaAlumnoMegalist', '[ALQUIMIA_ALUMNO][MEGALIST] Construyendo megalista desde estado', {
      traceId,
      student_uuid,
      view_layer,
      lista_tipo,
      levels_mode,
      level_cap: nivelCap,
      level_cap_provided: level_cap !== null
    });
    
    // 2. Verificar que el alumno existe
    const studentRepo = getDefaultStudentRepo();
    const student = await studentRepo.getById(student_uuid);
    
    if (!student) {
      throw new Error(`Alumno no encontrado: ${student_uuid}`);
    }
    
    // 3. Verificar que no esté en pausa
    const pausaRepo = getDefaultPausaRepo();
    const pausaActiva = await pausaRepo.getPausaActiva(student_uuid);
    if (pausaActiva) {
      logWarn('AlquimiaAlumnoMegalist', 'Alumno en pausa', {
        traceId,
        student_uuid
      });
    }
    
    // 4. OBTENER ESTADOS DE LIMPIEZA SHARED Y PDE PARA ESTE ALUMNO (FUENTE ÚNICA)
    // REGLA CONSTITUCIONAL: Leer tanto shared como pde para calcular state_by_view_layer
    // Filtrar por level_cap: solo items con nivel <= cap
    // Necesitamos hacer JOIN con items_transmutaciones para filtrar por nivel
    const statesResult = await query(`
      SELECT 
        s.*,
        i.nivel as item_nivel,
        -- Calcular days_since_last_clean para shared
        CASE 
          WHEN s.shared_last_cleaned_at IS NOT NULL THEN
            EXTRACT(EPOCH FROM (NOW() - s.shared_last_cleaned_at)) / 86400
          ELSE NULL
        END::integer as shared_days_since_last_clean,
        -- Calcular days_since_last_clean para pde
        CASE 
          WHEN s.pde_last_cleaned_at IS NOT NULL THEN
            EXTRACT(EPOCH FROM (NOW() - s.pde_last_cleaned_at)) / 86400
          ELSE NULL
        END::integer as pde_days_since_last_clean
      FROM cleaning_item_state s
      LEFT JOIN items_transmutaciones i ON i.item_ref = s.item_ref
      WHERE s.student_id = $1
        AND s.product_key = 'pde'
        AND s.domain_type = 'transmutation'
        AND (i.nivel IS NULL OR i.nivel <= $2::integer)
      ORDER BY s.item_ref
    `, [student_uuid, nivelCap]);
    
    const states = statesResult.rows || [];
    
    logInfo('AlquimiaAlumnoMegalist', 'Estados obtenidos desde cleaning_item_state (filtrados por level_cap)', {
      traceId,
      student_uuid,
      view_layer,
      level_cap: nivelCap,
      states_count: states.length
    });
    
    // 5. Cargar catálogo SOLO como resolver (para obtener nombre, descripción, lista_id)
    let itemsByRef = {};
    let listasById = {};
    
    try {
      const catalogRepo = getDefaultAlquimiaCatalogRepo();
      
      // Cargar listas del catálogo (para resolver lista_id → nombre)
      // REGLA CONSTITUCIONAL: Filtrar por lista_tipo ANTES de procesar items
      const allListas = await catalogRepo.listListas({ onlyActive: true });
      for (const lista of allListas) {
        // Filtrar por lista_tipo: solo incluir listas que coinciden con el tipo solicitado
        const listaTipoFromCatalog = lista.tipo || 'recurrente';
        if (listaTipoFromCatalog === lista_tipo) {
          listasById[lista.id] = lista;
        }
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
      
      // ============================================================================
      // REGLA CONSTITUCIONAL: Calcular state_by_view_layer usando computeVisualState
      // ============================================================================
      const listaTipo = lista.tipo || 'recurrente';
      const itemKind = listaTipo === 'recurrente' ? 'recurrente' : 'una_vez';
      
      // Preparar datos shared y pde para computeVisualState
      const sharedData = {
        clean_count: state.shared_clean_count || 0,
        last_cleaned_at: state.shared_last_cleaned_at || null,
        days_since_last_clean: state.shared_days_since_last_clean ?? null,
        remaining: state.shared_remaining ?? null,
        completed: state.shared_completed || 0
      };
      
      const pdeData = {
        clean_count: state.pde_clean_count || 0,
        last_cleaned_at: state.pde_last_cleaned_at || null,
        days_since_last_clean: state.pde_days_since_last_clean ?? null,
        remaining: state.pde_remaining ?? null,
        completed: state.pde_completed || 0
      };
      
      // Para UNA_VEZ: calcular combo (suma shared + pde)
      let comboData = null;
      if (itemKind === 'una_vez') {
        const vecesLimpiar = item.veces_limpiar || 1;
        const sharedCount = sharedData.clean_count || 0;
        const pdeCount = pdeData.clean_count || 0;
        const comboCleanCount = sharedCount + pdeCount;
        const comboRemaining = Math.max(0, vecesLimpiar - comboCleanCount);
        const comboCompleted = comboRemaining <= 0 ? 1 : 0;
        
        comboData = {
          clean_count: comboCleanCount,
          remaining: comboRemaining,
          completed: comboCompleted
        };
      }
      
      // Configuración para computeVisualState
      const config = itemKind === 'recurrente' ? {
        threshold_days: item.frecuencia_dias || 7,
        critical_multiplier: item.critical_multiplier || 2.0
      } : {
        required_count: item.veces_limpiar || 1
      };
      
      // Calcular state_by_view_layer para todas las view_layers posibles
      const stateByViewLayer = {};
      
      // Calcular para 'shared'
      try {
        stateByViewLayer.shared = computeVisualState({
          shared: sharedData,
          pde: pdeData,
          combo: comboData,
          item_kind: itemKind,
          view_layer: 'shared',
          config
        });
      } catch (error) {
        logWarn('AlquimiaAlumnoMegalist', 'Error calculando state_by_view_layer[shared]', {
          traceId,
          student_id,
          item_ref: state.item_ref,
          error: error.message
        });
        // Fallback seguro
        stateByViewLayer.shared = {
          state: 'never',
          visual_state: 'never',
          computed_state: { view_layer: 'shared', error: error.message }
        };
      }
      
      // Calcular para 'pde'
      try {
        stateByViewLayer.pde = computeVisualState({
          shared: sharedData,
          pde: pdeData,
          combo: comboData,
          item_kind: itemKind,
          view_layer: 'pde',
          config
        });
      } catch (error) {
        logWarn('AlquimiaAlumnoMegalist', 'Error calculando state_by_view_layer[pde]', {
          traceId,
          student_id,
          item_ref: state.item_ref,
          error: error.message
        });
        // Fallback seguro
        stateByViewLayer.pde = {
          state: 'never',
          visual_state: 'never',
          computed_state: { view_layer: 'pde', error: error.message }
        };
      }
      
      // Calcular para 'effective' (solo RECURRENTE)
      if (itemKind === 'recurrente') {
        try {
          stateByViewLayer.effective = computeVisualState({
            shared: sharedData,
            pde: pdeData,
            combo: comboData,
            item_kind: itemKind,
            view_layer: 'effective',
            config
          });
        } catch (error) {
          logWarn('AlquimiaAlumnoMegalist', 'Error calculando state_by_view_layer[effective]', {
            traceId,
            student_id,
            item_ref: state.item_ref,
            error: error.message
          });
          // Fallback seguro
          stateByViewLayer.effective = {
            state: 'never',
            visual_state: 'never',
            computed_state: { view_layer: 'effective', error: error.message }
          };
        }
      }
      
      // Calcular para 'combo' (solo UNA_VEZ)
      if (itemKind === 'una_vez') {
        try {
          stateByViewLayer.combo = computeVisualState({
            shared: sharedData,
            pde: pdeData,
            combo: comboData,
            item_kind: itemKind,
            view_layer: 'combo',
            config
          });
        } catch (error) {
          logWarn('AlquimiaAlumnoMegalist', 'Error calculando state_by_view_layer[combo]', {
            traceId,
            student_id,
            item_ref: state.item_ref,
            error: error.message
          });
          // Fallback seguro
          stateByViewLayer.combo = {
            state: 'never',
            visual_state: 'never',
            computed_state: { view_layer: 'combo', error: error.message }
          };
        }
      }
      
      // Log forense obligatorio
      // Log específico para effective (RECURRENTE)
      if (itemKind === 'recurrente' && stateByViewLayer.effective) {
        logInfo('AlquimiaAlumnoMegalist', '[ALQUIMIA_ALUMNO][STATE][RECURRENTE][EFFECTIVE] Estado effective calculado', {
          traceId,
          student_id,
          item_ref: state.item_ref,
          item_kind: itemKind,
          shared_state: stateByViewLayer.shared?.state || 'never',
          pde_state: stateByViewLayer.pde?.state || 'never',
          effective_state: stateByViewLayer.effective?.state || 'never',
          shared_days_since: stateByViewLayer.effective?.computed_state?.shared_days_since ?? null,
          pde_days_since: stateByViewLayer.effective?.computed_state?.pde_days_since ?? null,
          effective_days_since: stateByViewLayer.effective?.computed_state?.days_since_last_clean ?? null
        });
      }
      
      logInfo('AlquimiaAlumnoMegalist', '[ALQUIMIA_ALUMNO][STATE][view_layer] Estado calculado', {
        traceId,
        student_id,
        item_ref: state.item_ref,
        item_kind: itemKind,
        view_layer,
        state_by_view_layer: stateByViewLayer,
        state_active: stateByViewLayer[view_layer]?.state || 'never',
        visual_state_active: stateByViewLayer[view_layer]?.visual_state || 'never'
      });
      
      // Obtener último actor (para metadata)
      const lastActor = await getLastCleanActor(student_uuid, state.item_ref);
      
      // Construir datos del item PLANO (NO agrupado)
      const itemData = {
        item_id: item.id ?? null,
        item_ref: item.item_ref || state.item_ref,
        item_nombre: item.nombre || 'NO_RESUELTO',
        item_descripcion: item.descripcion || null,
        item_nivel: itemNivel,
        item_frecuencia_dias: item.frecuencia_dias || null,
        item_veces_limpiar: item.veces_limpiar ?? null,
        lista_id: lista.id,
        lista_nombre: lista.nombre || 'Sin lista',
        lista_tipo: listaTipo,
        // REGLA CONSTITUCIONAL: state_by_view_layer contiene estados para todas las view_layers
        state_by_view_layer: stateByViewLayer,
        // Estado activo según view_layer solicitado (para compatibilidad)
        state: stateByViewLayer[view_layer]?.state || 'never',
        visual_state: stateByViewLayer[view_layer]?.visual_state || 'never',
        // Metadata raw (para debugging)
        shared: sharedData,
        pde: pdeData,
        combo: comboData,
        last_actor: lastActor
      };
      
      // Agregar item a lista de items planos (NO agrupados)
      if (!listsMap[lista.id]) {
        listsMap[lista.id] = {
          lista_id: lista.id,
          lista_nombre: lista.nombre || 'Sin nombre',
          lista_tipo: listaTipo,
          items: [] // Items planos, NO agrupados
        };
      }
      
      listsMap[lista.id].items.push(itemData);
    }
    
    // 7. Convertir map a array y ordenar listas (SOLO listas que tienen items)
    const lists = Object.values(listsMap)
      .filter(list => {
        // Filtrar: solo listas que tienen al menos un item
        return (list.items?.length || 0) > 0;
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
    
    // 8. Calcular métricas DESDE state_by_view_layer[view_layer] para cada item
    // REGLA CONSTITUCIONAL: Métricas se calculan desde state_by_view_layer, NO desde agrupación
    let total = 0;
    let never = 0;
    let important = 0;
    let pending = 0;
    let reviewed = 0;
    let reviewedByStudent = 0;
    let reviewedByMaster = 0;
    
    // Recorrer todos los items y calcular métricas desde state_by_view_layer[view_layer]
    for (const list of lists) {
      for (const item of (list.items || [])) {
        total++;
        
        // Obtener estado desde state_by_view_layer[view_layer]
        const stateData = item.state_by_view_layer?.[view_layer];
        if (!stateData) {
          logWarn('AlquimiaAlumnoMegalist', 'Item sin state_by_view_layer para view_layer', {
            traceId,
            student_id,
            item_ref: item.item_ref,
            view_layer
          });
          never++; // Fallback seguro
          continue;
        }
        
        // Determinar estado según item_kind
        const itemState = item.lista_tipo === 'recurrente' 
          ? stateData.state 
          : stateData.visual_state;
        
        // Contar por estado
        if (itemState === 'never') {
          never++;
        } else if (itemState === 'important') {
          important++;
        } else if (itemState === 'pending') {
          pending++;
        } else if (itemState === 'reviewed' || itemState === 'completed') {
          reviewed++;
          // Separar por actor si es reviewed
          if (item.last_actor === 'student') {
            reviewedByStudent++;
          } else {
            reviewedByMaster++;
          }
        } else {
          // Estado desconocido, contar como pending
          pending++;
        }
      }
    }
    
    // Validar coherencia
    logInfo('AlquimiaAlumnoMegalist', 'Métricas calculadas desde state_by_view_layer', {
      traceId,
      student_id,
      view_layer,
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
    
    // Calcular métricas por view_layer (para todas las view_layers)
    const metricsByLayer = {
      shared: { never: 0, important: 0, pending: 0, reviewed: 0, total: 0 },
      pde: { never: 0, important: 0, pending: 0, reviewed: 0, total: 0 },
      combo: { never: 0, important: 0, pending: 0, reviewed: 0, total: 0 }
    };
    
    for (const list of lists) {
      for (const item of (list.items || [])) {
        // Calcular métricas para cada view_layer
        for (const layer of ['shared', 'pde', 'combo']) {
          const layerStateData = item.state_by_view_layer?.[layer];
          if (!layerStateData) continue;
          
          const layerState = item.lista_tipo === 'recurrente' 
            ? layerStateData.state 
            : layerStateData.visual_state;
          
          metricsByLayer[layer].total++;
          if (layerState === 'never') {
            metricsByLayer[layer].never++;
          } else if (layerState === 'important') {
            metricsByLayer[layer].important++;
          } else if (layerState === 'pending') {
            metricsByLayer[layer].pending++;
          } else if (layerState === 'reviewed' || layerState === 'completed') {
            metricsByLayer[layer].reviewed++;
          } else {
            metricsByLayer[layer].pending++;
          }
        }
      }
    }
    
    // 9. Construir respuesta con items planos (NO agrupados)
    // REGLA CONSTITUCIONAL: Frontend agrupa desde state_by_view_layer[view_layer]
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
      lists, // Listas con items PLANOS (NO agrupados)
      metrics_by_layer: metricsByLayer, // Métricas para todas las view_layers
      reviewed: {
        // Construir desde items planos filtrando por state_by_view_layer[view_layer]
        by_student: lists
          .map(list => ({
            lista_id: list.lista_id,
            lista_nombre: list.lista_nombre,
            items: (list.items || []).filter(item => {
              const stateData = item.state_by_view_layer?.[view_layer];
              const itemState = item.lista_tipo === 'recurrente' 
                ? stateData?.state 
                : stateData?.visual_state;
              return (itemState === 'reviewed' || itemState === 'completed') && item.last_actor === 'student';
            })
          }))
          .filter(list => (list.items?.length || 0) > 0),
        by_master: lists
          .map(list => ({
            lista_id: list.lista_id,
            lista_nombre: list.lista_nombre,
            items: (list.items || []).filter(item => {
              const stateData = item.state_by_view_layer?.[view_layer];
              const itemState = item.lista_tipo === 'recurrente' 
                ? stateData?.state 
                : stateData?.visual_state;
              return (itemState === 'reviewed' || itemState === 'completed') && item.last_actor !== 'student';
            })
          }))
          .filter(list => (list.items?.length || 0) > 0)
      },
      warnings: warnings.length > 0 ? warnings : undefined,
      context: {
        view_layer, // REGLA CONSTITUCIONAL: view_layer en contexto
        lista_tipo, // REGLA CONSTITUCIONAL: lista_tipo en contexto
        levels_mode,
        level_cap: nivelCap,
        level_cap_provided: level_cap !== null
      }
    };
    
    logInfo('AlquimiaAlumnoMegalist', 'Megalista construida desde estado (items planos)', {
      traceId,
      student_uuid,
      view_layer,
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
      student_uuid,
      error: error.message,
      code: error.code,
      stack: error.stack
    });
    throw error;
  }
}
