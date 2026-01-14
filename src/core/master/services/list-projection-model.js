// src/core/master/services/list-projection-model.js
// List Projection Model (LPM) v1
//
// CONSTITUCIONAL: Única capa autorizada para calcular proyecciones de LISTAS
// agrupadas por estados, métricas agregadas y estado de salud.
//
// REGLAS ABSOLUTAS:
// 1. LPM NO escribe (función pura, READ-only)
// 2. LPM NO muta estado
// 3. LPM reutiliza CPM como única autoridad de estado por ítem
// 4. LPM calcula proyecciones agregadas (métricas, list_state)
//
// Referencias:
// - docs/LIST_PROJECTION_MODEL_V1.md (documentación canónica)
// - docs/CLEANING_PROJECTION_MODEL_V1.md (CPM como base)
// - docs/CONSTITUTION_VIEW_AUTHORITY_V1.md (View Authority)

import { query } from '../../../../database/pg.js';
import { getRequestId } from '../../observability/request-context.js';
import { logError, logInfo, logWarn } from '../../observability/logger.js';
import { validateViewLayer, validateViewLayerItemKindCoherence } from './cleaning-layer-constants.js';
import { computeCleaningProjection } from './cleaning-projection-model.js';
import { getDefaultAlquimiaCatalogRepo } from '../../../infra/repos/alquimia-catalog-repo-pg.js';

/**
 * Calcula métricas agregadas por estado
 * 
 * @param {Array} items - Items con state_by_view_layer calculado
 * @param {string} viewLayer - Capa de vista activa
 * @returns {Object} Métricas { total_items, by_state_counts, by_state_pct, reviewed_pct }
 */
function calculateMetrics(items, viewLayer) {
  const totalItems = items.length;
  const counts = {
    never: 0,
    pending: 0,
    important: 0,
    reviewed: 0
  };
  
  items.forEach(item => {
    const state = item.state_by_view_layer?.[viewLayer]?.state || 'never';
    if (state === 'reviewed' || state === 'completed') {
      counts.reviewed++;
    } else if (state === 'pending' || state === 'in_progress') {
      counts.pending++;
    } else if (state === 'important') {
      counts.important++;
    } else {
      counts.never++;
    }
  });
  
  const pct = {
    never: totalItems > 0 ? counts.never / totalItems : 0,
    pending: totalItems > 0 ? counts.pending / totalItems : 0,
    important: totalItems > 0 ? counts.important / totalItems : 0,
    reviewed: totalItems > 0 ? counts.reviewed / totalItems : 0
  };
  
  return {
    total_items: totalItems,
    by_state_counts: counts,
    by_state_pct: pct,
    reviewed_pct: pct.reviewed
  };
}

/**
 * Calcula el peor estado para una capa (shared o pde) en scope='all'
 * REGLA CANÓNICA: Proyección ALL muestra el estado MENOS trabajado del grupo
 * 
 * @param {Array} layerStates - Array de estados por alumno para una capa
 * @param {string} itemKind - Tipo de item ('recurrente' | 'una_vez')
 * @param {Object} item - Item completo (para obtener required_count, frecuencia_dias)
 * @returns {Object} Peor estado de la capa
 */
function calculateWorstStateForLayer(layerStates, itemKind, item) {
  if (!layerStates || layerStates.length === 0) {
    // Si no hay estados, devolver estado vacío (never)
    return {
      clean_count: 0,
      days_since_last_clean: null,
      remaining: null,
      completed: false,
      last_cleaned_at: null
    };
  }
  
  if (itemKind === 'recurrente') {
    // RECURRENTE: NULL tiene prioridad máxima, luego mayor days_since_last_clean
    let worstDaysSince = null;
    let worstLastCleanedAt = null;
    let hasNull = false;
    
    layerStates.forEach(state => {
      if (state.days_since_last_clean === null || state.days_since_last_clean === undefined) {
        hasNull = true;
        // NULL es peor absoluto, no necesitamos seguir buscando
      } else if (!hasNull) {
        // Solo actualizar si no hay NULL
        if (worstDaysSince === null || state.days_since_last_clean > worstDaysSince) {
          worstDaysSince = state.days_since_last_clean;
          worstLastCleanedAt = state.last_cleaned_at;
        }
      }
    });
    
    return {
      clean_count: 0, // No aplica en agregación para recurrente
      days_since_last_clean: hasNull ? null : worstDaysSince,
      remaining: null, // No aplica en agregación
      completed: false, // No aplica en agregación
      last_cleaned_at: hasNull ? null : worstLastCleanedAt
    };
  } else {
    // UNA_VEZ: calcular estado de cada alumno y tomar el mínimo
    // Orden de severidad: NEVER < PARTIAL < DONE
    // REGLA CANÓNICA: Si al menos un alumno está en NEVER, el estado ALL es NEVER
    const requiredCount = item.veces_limpiar || 1;
    
    let worstState = null; // 'never' | 'partial' | 'done'
    let worstCleanCount = 0;
    let worstRemaining = null;
    let worstCompleted = false;
    
    layerStates.forEach(state => {
      const cleanCount = state.clean_count || 0;
      const remaining = state.remaining;
      const completed = state.completed || false;
      
      // Calcular estado del alumno
      let studentState; // 'never' | 'partial' | 'done'
      
      if (cleanCount === 0) {
        studentState = 'never';
      } else if (cleanCount < requiredCount) {
        studentState = 'partial';
      } else {
        studentState = 'done';
      }
      
      // Actualizar peor estado según orden: never < partial < done
      if (worstState === null) {
        // Inicializar con el primer estado
        worstState = studentState;
        worstCleanCount = cleanCount;
        worstRemaining = remaining;
        worstCompleted = completed;
      } else if (worstState === 'never') {
        // Ya tenemos NEVER (peor absoluto), mantener
        // No actualizar porque nunca es peor que never
      } else if (worstState === 'partial') {
        // Si encontramos NEVER, es peor que partial
        if (studentState === 'never') {
          worstState = 'never';
          worstCleanCount = cleanCount;
          worstRemaining = remaining;
          worstCompleted = completed;
        } else if (studentState === 'partial') {
          // Mantener partial, pero actualizar si este tiene menos clean_count (menos trabajado)
          if (cleanCount < worstCleanCount) {
            worstCleanCount = cleanCount;
            worstRemaining = remaining;
            worstCompleted = completed;
          }
        }
        // Si es 'done', no actualizar (done es mejor que partial)
      } else if (worstState === 'done') {
        // Cualquier estado peor (never o partial) reemplaza done
        if (studentState === 'never' || studentState === 'partial') {
          worstState = studentState;
          worstCleanCount = cleanCount;
          worstRemaining = remaining;
          worstCompleted = completed;
        } else if (studentState === 'done' && cleanCount < worstCleanCount) {
          // Si ambos son done, tomar el que tiene menos clean_count (menos trabajado)
          worstCleanCount = cleanCount;
          worstRemaining = remaining;
          worstCompleted = completed;
        }
      }
    });
    
    // Si no hay estados, devolver never
    if (worstState === null) {
      worstState = 'never';
      worstCleanCount = 0;
    }
    
    return {
      clean_count: worstCleanCount,
      days_since_last_clean: null, // No aplica en una_vez
      remaining: worstRemaining,
      completed: worstCompleted,
      last_cleaned_at: null // No aplica en una_vez
    };
  }
}

/**
 * Calcula list_state (dominant_state, reviewed_pct, health_bucket)
 * 
 * @param {Object} metrics - Métricas calculadas
 * @returns {Object} list_state
 */
function calculateListState(metrics) {
  const { by_state_counts, reviewed_pct, by_state_pct } = metrics;
  
  // dominant_state: estado con mayor peso
  // Prioridad en caso de empate: reviewed > pending > important > never
  let dominantState = 'never';
  let maxCount = by_state_counts.never;
  
  if (by_state_counts.reviewed >= maxCount) {
    dominantState = 'reviewed';
    maxCount = by_state_counts.reviewed;
  }
  if (by_state_counts.pending >= maxCount) {
    dominantState = 'pending';
    maxCount = by_state_counts.pending;
  }
  if (by_state_counts.important >= maxCount) {
    dominantState = 'important';
    maxCount = by_state_counts.important;
  }
  
  // health_bucket
  let healthBucket;
  if (reviewed_pct >= 0.80 && by_state_pct.important <= 0.05) {
    healthBucket = 'good';
  } else if (by_state_pct.important >= 0.20 || reviewed_pct < 0.50) {
    healthBucket = 'critical';
  } else {
    healthBucket = 'warning';
  }
  
  return {
    dominant_state: dominantState,
    reviewed_pct: reviewed_pct,
    health_bucket: healthBucket
  };
}

/**
 * Obtiene estados de limpieza para items de una lista
 * 
 * @param {Array} items - Items de la lista (con item_kind o tipo)
 * @param {string} scope - 'all' | 'student'
 * @param {number|null} studentId - ID del estudiante (si scope='student')
 * @param {string} itemKind - Tipo de item ('recurrente' | 'una_vez')
 * @returns {Promise<Object>} Map de item_ref -> cleaning_state
 */
async function getCleaningStatesForItems(items, scope, studentId = null, itemKind = null) {
  const traceId = getRequestId();
  
  if (items.length === 0) {
    return {};
  }
  
  const itemRefs = items.map(item => item.item_ref).filter(Boolean);
  if (itemRefs.length === 0) {
    return {};
  }
  
  // Para scope='all', necesitamos obtener estados agregados
  // REGLA CANÓNICA: Proyección ALL muestra el PEOR estado del grupo
  // Referencia: docs/CANONICAL_RULES_PROJECTION_ALL_WORST_STATE_V1.md
  
  if (scope === 'student') {
    if (!studentId) {
      throw new Error('student_id es requerido cuando scope="student"');
    }
    
    // Obtener estados para un estudiante específico
    const result = await query(`
      SELECT 
        item_ref,
        shared_clean_count,
        shared_last_cleaned_at,
        shared_remaining,
        shared_completed,
        pde_clean_count,
        pde_last_cleaned_at,
        pde_remaining,
        pde_completed,
        -- Calcular days_since_last_clean
        CASE 
          WHEN shared_last_cleaned_at IS NOT NULL THEN
            EXTRACT(EPOCH FROM (NOW() - shared_last_cleaned_at)) / 86400
          ELSE NULL
        END::integer as shared_days_since_last_clean,
        CASE 
          WHEN pde_last_cleaned_at IS NOT NULL THEN
            EXTRACT(EPOCH FROM (NOW() - pde_last_cleaned_at)) / 86400
          ELSE NULL
        END::integer as pde_days_since_last_clean
      FROM cleaning_item_state
      WHERE student_id = $1
        AND product_key = 'pde'
        AND domain_type = 'transmutation'
        AND item_ref = ANY($2::text[])
    `, [studentId, itemRefs]);
    
    const statesMap = {};
    result.rows.forEach(row => {
      statesMap[row.item_ref] = {
        shared: {
          clean_count: row.shared_clean_count || 0,
          days_since_last_clean: row.shared_days_since_last_clean,
          remaining: row.shared_remaining,
          completed: row.shared_completed || false,
          last_cleaned_at: row.shared_last_cleaned_at
        },
        pde: {
          clean_count: row.pde_clean_count || 0,
          days_since_last_clean: row.pde_days_since_last_clean,
          remaining: row.pde_remaining,
          completed: row.pde_completed || false,
          last_cleaned_at: row.pde_last_cleaned_at
        }
      };
    });
    
    return statesMap;
  } else {
    // scope='all': obtener estados agregados (PEOR estado entre todos los estudiantes)
    // REGLA CANÓNICA: Proyección ALL muestra el estado MENOS trabajado del grupo
    // Referencia: docs/CANONICAL_RULES_PROJECTION_ALL_WORST_STATE_V1.md
    
    // Obtener TODOS los estados por alumno (sin GROUP BY) para calcular peor estado
    const result = await query(`
      SELECT 
        item_ref,
        student_id,
        shared_clean_count,
        shared_last_cleaned_at,
        shared_remaining,
        shared_completed,
        pde_clean_count,
        pde_last_cleaned_at,
        pde_remaining,
        pde_completed,
        -- Calcular days_since_last_clean por alumno
        CASE 
          WHEN shared_last_cleaned_at IS NOT NULL THEN
            EXTRACT(EPOCH FROM (NOW() - shared_last_cleaned_at)) / 86400
          ELSE NULL
        END::integer as shared_days_since_last_clean,
        CASE 
          WHEN pde_last_cleaned_at IS NOT NULL THEN
            EXTRACT(EPOCH FROM (NOW() - pde_last_cleaned_at)) / 86400
          ELSE NULL
        END::integer as pde_days_since_last_clean
      FROM cleaning_item_state
      WHERE product_key = 'pde'
        AND domain_type = 'transmutation'
        AND item_ref = ANY($1::text[])
        AND student_id IN (
          SELECT legacy_alumno_id FROM students WHERE deleted_at IS NULL
        )
      ORDER BY item_ref, student_id
    `, [itemRefs]);
    
    // Agrupar por item_ref y calcular peor estado
    const statesByItem = {};
    
    result.rows.forEach(row => {
      const itemRef = row.item_ref;
      if (!statesByItem[itemRef]) {
        statesByItem[itemRef] = {
          shared: [],
          pde: []
        };
      }
      
      statesByItem[itemRef].shared.push({
        clean_count: row.shared_clean_count || 0,
        days_since_last_clean: row.shared_days_since_last_clean,
        remaining: row.shared_remaining,
        completed: row.shared_completed || false,
        last_cleaned_at: row.shared_last_cleaned_at
      });
      
      statesByItem[itemRef].pde.push({
        clean_count: row.pde_clean_count || 0,
        days_since_last_clean: row.pde_days_since_last_clean,
        remaining: row.pde_remaining,
        completed: row.pde_completed || false,
        last_cleaned_at: row.pde_last_cleaned_at
      });
    });
    
    // Calcular peor estado por item_ref
    const statesMap = {};
    
    items.forEach(item => {
      const itemRef = item.item_ref;
      const itemKindForItem = itemKind || item.tipo || item.item_kind;
      const itemStates = statesByItem[itemRef] || { shared: [], pde: [] };
      
      // Calcular peor estado por capa (shared y pde independientes)
      // REGLA CANÓNICA: Cada capa calcula su peor estado independientemente
      const worstShared = calculateWorstStateForLayer(itemStates.shared, itemKindForItem, item);
      const worstPde = calculateWorstStateForLayer(itemStates.pde, itemKindForItem, item);
      
      logInfo('ListProjectionModel', '[LPM][WORST_STATE] Calculado peor estado para item', {
        traceId,
        item_ref: itemRef,
        item_kind: itemKindForItem,
        students_count: itemStates.shared.length,
        worst_shared: {
          days_since: worstShared.days_since_last_clean,
          clean_count: worstShared.clean_count,
          has_null: worstShared.days_since_last_clean === null
        },
        worst_pde: {
          days_since: worstPde.days_since_last_clean,
          clean_count: worstPde.clean_count,
          has_null: worstPde.days_since_last_clean === null
        }
      });
      
      statesMap[itemRef] = {
        shared: worstShared,
        pde: worstPde
      };
    });
    
    return statesMap;
  }
}

/**
 * List Projection Model (LPM) v1
 * 
 * Calcula proyección de lista agrupada por estados, métricas y estado de salud.
 * 
 * REGLAS CONSTITUCIONALES:
 * - LPM NO escribe (función pura, READ-only)
 * - LPM reutiliza CPM como única autoridad de estado por ítem
 * - LPM calcula proyecciones agregadas (métricas, list_state)
 * 
 * @param {Object} params - Parámetros
 * @param {number} params.list_id - ID de la lista
 * @param {string} params.item_kind - Tipo de item ('recurrente' | 'una_vez')
 * @param {string} params.view_layer - Capa de vista ('shared' | 'pde' | 'combo' | 'effective')
 * @param {string} params.scope - Scope ('all' | 'student')
 * @param {string|null} [params.student_uuid] - UUID del estudiante (si scope='student')
 * @returns {Promise<Object>} Proyección completa
 * @throws {Error} Si los parámetros son inválidos
 */
export async function computeListProjection({ list_id, item_kind, view_layer, scope, student_uuid = null }) {
  const traceId = getRequestId();
  
  try {
    logInfo('ListProjectionModel', '[LPM][LIST_PROJECTION] Iniciando cálculo', {
      traceId,
      list_id,
      item_kind,
      view_layer,
      scope,
      student_uuid
    });
    
    // Validaciones
    if (!list_id) {
      throw new Error('list_id es requerido');
    }
    if (!item_kind || (item_kind !== 'recurrente' && item_kind !== 'una_vez')) {
      throw new Error('item_kind debe ser "recurrente" o "una_vez"');
    }
    if (!view_layer) {
      throw new Error('view_layer es requerido');
    }
    if (!scope || (scope !== 'all' && scope !== 'student')) {
      throw new Error('scope debe ser "all" o "student"');
    }
    if (scope === 'student' && !student_uuid) {
      throw new Error('student_uuid es requerido cuando scope="student"');
    }
    
    // Validar view_layer
    validateViewLayer(view_layer);
    
    // Validar coherencia view_layer + item_kind
    validateViewLayerItemKindCoherence(view_layer, item_kind);
    
    // Resolver student_uuid -> legacy_alumno_id si scope='student'
    let studentId = null;
    if (scope === 'student' && student_uuid) {
      // FIX: Usar query directa a tabla students (UUID canónico) para obtener legacy_alumno_id
      // student_uuid es students.id (UUID), necesitamos legacy_alumno_id para compatibilidad
      const studentResult = await query(
        'SELECT legacy_alumno_id FROM students WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
        [student_uuid]
      );
      
      if (!studentResult.rows[0] || !studentResult.rows[0].legacy_alumno_id) {
        throw new Error(`Estudiante no encontrado o sin legacy_alumno_id: ${student_uuid}`);
      }
      
      studentId = studentResult.rows[0].legacy_alumno_id;
    }
    
    // Obtener lista
    const catalogRepo = getDefaultAlquimiaCatalogRepo();
    const lista = await catalogRepo.getListaById(list_id);
    if (!lista || lista.status !== 'active') {
      throw new Error(`Lista no encontrada o archivada: ${list_id}`);
    }
    
    // Validar que item_kind coincide con lista.tipo
    if (lista.tipo !== item_kind) {
      throw new Error(`item_kind "${item_kind}" no coincide con lista.tipo "${lista.tipo}"`);
    }
    
    // Obtener items de la lista (solo activos)
    const items = await catalogRepo.listItems(list_id, { onlyActive: true });
    
    logInfo('ListProjectionModel', '[LPM][LIST_PROJECTION] Items obtenidos', {
      traceId,
      list_id,
      items_count: items.length
    });
    
    // Obtener estados de limpieza para todos los items
    // FIX: Pasar item_kind para calcular peor estado correctamente en scope='all'
    const cleaningStatesMap = await getCleaningStatesForItems(items, scope, studentId, item_kind);
    
    // Para cada item, calcular state_by_view_layer usando CPM
    const itemsWithProjection = items.map(item => {
      const cleaningState = cleaningStatesMap[item.item_ref] || {
        shared: {},
        pde: {}
      };
      
      // Calcular combo para una_vez
      if (item_kind === 'una_vez') {
        cleaningState.combo = {
          clean_count: (cleaningState.shared?.clean_count || 0) + (cleaningState.pde?.clean_count || 0),
          remaining: null, // No aplica en agregación
          completed: false // No aplica en agregación
        };
      }
      
      // Usar CPM para calcular proyección
      const projection = computeCleaningProjection({
        cleaning_state: cleaningState,
        item_kind: item_kind,
        view_layer: view_layer,
        config: {
          threshold_days: item.frecuencia_dias || 7,
          critical_multiplier: 2.0,
          required_count: item.veces_limpiar || 1
        }
      });
      
      // Determinar active_state y active_visual_state desde view_layer
      const activeState = projection.state_by_view_layer[view_layer];
      
      return {
        ...item,
        state_by_view_layer: projection.state_by_view_layer,
        active_state: activeState?.state || 'never',
        active_visual_state: activeState?.visual_state || 'never'
      };
    });
    
    // Calcular métricas
    const metrics = calculateMetrics(itemsWithProjection, view_layer);
    
    // Calcular list_state
    const listState = calculateListState(metrics);
    
    logInfo('ListProjectionModel', '[LPM][LIST_PROJECTION] Proyección calculada', {
      traceId,
      list_id,
      total_items: metrics.total_items,
      reviewed_pct: metrics.reviewed_pct,
      dominant_state: listState.dominant_state,
      health_bucket: listState.health_bucket
    });
    
    return {
      items: itemsWithProjection,
      metrics,
      list_state: listState
    };
  } catch (error) {
    logError('ListProjectionModel', '[LPM][LIST_PROJECTION] Error calculando proyección', {
      traceId,
      error: error.message,
      stack: error.stack,
      list_id,
      item_kind,
      view_layer,
      scope,
      student_uuid
    });
    throw error;
  }
}
