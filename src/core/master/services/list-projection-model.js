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

import { query } from '../../../database/pg.js';
import { getRequestId } from '../../observability/request-context.js';
import { logError, logInfo, logWarn } from '../../observability/logger.js';
import { validateViewLayer, validateViewLayerItemKindCoherence } from './cleaning-layer-constants.js';
import { computeCleaningProjection } from './cleaning-projection-model.js';
import { getDefaultAlquimiaCatalogRepo } from '../../../infra/repos/alquimia-catalog-repo-pg.js';
import { getDefaultStudentRepo } from '../../../infra/repos/student-repo-pg.js';

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
 * @param {Array} items - Items de la lista
 * @param {string} scope - 'all' | 'student'
 * @param {number|null} studentId - ID del estudiante (si scope='student')
 * @returns {Promise<Object>} Map de item_ref -> cleaning_state
 */
async function getCleaningStatesForItems(items, scope, studentId = null) {
  const traceId = getRequestId();
  
  if (items.length === 0) {
    return {};
  }
  
  const itemRefs = items.map(item => item.item_ref).filter(Boolean);
  if (itemRefs.length === 0) {
    return {};
  }
  
  // Para scope='all', necesitamos obtener estados agregados o por estudiante
  // Por ahora, v1: obtenemos estados para todos los estudiantes activos
  // y calculamos proyección agregada (mejor estado entre todos)
  
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
    // scope='all': obtener estados agregados (mejor estado entre todos los estudiantes)
    // Por ahora, v1: obtenemos el estado "más reciente" o "mejor" entre todos
    // Esto es una simplificación; en v2 podríamos calcular agregaciones más sofisticadas
    
    const result = await query(`
      SELECT 
        item_ref,
        -- Agregar: mejor estado shared (más reciente last_cleaned_at)
        MAX(shared_last_cleaned_at) as shared_last_cleaned_at,
        MAX(pde_last_cleaned_at) as pde_last_cleaned_at,
        -- Calcular days_since_last_clean desde el más reciente
        CASE 
          WHEN MAX(shared_last_cleaned_at) IS NOT NULL THEN
            EXTRACT(EPOCH FROM (NOW() - MAX(shared_last_cleaned_at))) / 86400
          ELSE NULL
        END::integer as shared_days_since_last_clean,
        CASE 
          WHEN MAX(pde_last_cleaned_at) IS NOT NULL THEN
            EXTRACT(EPOCH FROM (NOW() - MAX(pde_last_cleaned_at))) / 86400
          ELSE NULL
        END::integer as pde_days_since_last_clean,
        -- Para una_vez: sumar clean_count
        SUM(shared_clean_count) as shared_clean_count,
        SUM(pde_clean_count) as pde_clean_count
      FROM cleaning_item_state
      WHERE product_key = 'pde'
        AND domain_type = 'transmutation'
        AND item_ref = ANY($1::text[])
        AND student_id IN (
          SELECT legacy_alumno_id FROM students WHERE deleted_at IS NULL
        )
      GROUP BY item_ref
    `, [itemRefs]);
    
    const statesMap = {};
    result.rows.forEach(row => {
      statesMap[row.item_ref] = {
        shared: {
          clean_count: row.shared_clean_count || 0,
          days_since_last_clean: row.shared_days_since_last_clean,
          remaining: null, // No aplica en agregación
          completed: false, // No aplica en agregación
          last_cleaned_at: row.shared_last_cleaned_at
        },
        pde: {
          clean_count: row.pde_clean_count || 0,
          days_since_last_clean: row.pde_days_since_last_clean,
          remaining: null, // No aplica en agregación
          completed: false, // No aplica en agregación
          last_cleaned_at: row.pde_last_cleaned_at
        }
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
    
    // Resolver student_uuid -> student_id si scope='student'
    let studentId = null;
    if (scope === 'student' && student_uuid) {
      const studentRepo = getDefaultStudentRepo();
      const student = await studentRepo.getByUuid(student_uuid);
      if (!student) {
        throw new Error(`Estudiante no encontrado: ${student_uuid}`);
      }
      studentId = student.legacy_alumno_id;
      if (!studentId) {
        throw new Error(`Estudiante sin legacy_alumno_id: ${student_uuid}`);
      }
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
    const cleaningStatesMap = await getCleaningStatesForItems(items, scope, studentId);
    
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
