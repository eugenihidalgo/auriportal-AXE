// src/core/master/services/list-projection-model.js
// List Projection Model (LPM) v1
//
// GUARD CONSTITUCIONAL: LPM NO emite señales
// - LPM es función pura (read-only)
// - LPM solo calcula proyecciones agregadas, no modifica estado
// - Señales solo se emiten desde acciones WRITE (cleaning-engine, seed)
//
// Referencias:
// - docs/LIST_PROJECTION_MODEL_V1.md (documentación canónica)
// - docs/contracts/SIGNALS_CONTRACT_V1.md (sistema de señales canónico)
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
import { resolveItemConfigForStudent } from './override-resolution-service.js';

/**
 * BUG-018 FIX: Función canónica de agregación de estado ALL para recurrente
 * Prioridad constitucional (NO cambiar):
 * 1. never (si ALGÚN estudiante está en never)
 * 2. important (si ALGÚN estudiante está en important)
 * 3. pending (si ALGÚN estudiante está en pending)
 * 4. reviewed (solo si TODOS están en reviewed)
 * 
 * @param {Array} students - Array de estados por estudiante
 * @param {string} viewLayer - Capa de vista ('shared' | 'pde' | 'effective')
 * @returns {string} Estado agregado canónico
 */
function aggregateStateForAll(students, viewLayer) {
  if (!students || students.length === 0) {
    return 'never'; // Fallback seguro
  }
  
  // Obtener estados de todos los estudiantes para la view_layer
  const states = students.map(student => {
    return student.state_by_view_layer?.[viewLayer]?.state || 'never';
  });
  
  // Prioridad canónica: never > important > pending > reviewed
  if (states.includes('never')) {
    return 'never';
  }
  if (states.includes('important')) {
    return 'important';
  }
  if (states.includes('pending') || states.includes('in_progress')) {
    return 'pending';
  }
  if (states.every(s => s === 'reviewed' || s === 'completed')) {
    return 'reviewed';
  }
  
  // Fallback seguro
  return 'pending';
}

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
  // DIAGNÓSTICO: Log estados individuales por alumno
  if (layerStates && layerStates.length > 0) {
    console.log('[LPM][DEBUG][WORST_STATE][INPUT]', {
      item_kind: itemKind,
      layer_states_count: layerStates.length,
      per_student_states: layerStates.map((s, idx) => ({
        student_idx: idx,
        clean_count: s.clean_count,
        effective_since: s.effective_since,
        completed: s.completed,
        remaining: s.remaining,
        last_cleaned_at: s.last_cleaned_at
      }))
    });
  }
  
  if (!layerStates || layerStates.length === 0) {
    // Si no hay estados, devolver estado vacío (never)
    console.log('[LPM][DEBUG][WORST_STATE][EMPTY]', {
      item_kind: itemKind,
      reason: 'no layer states'
    });
    return {
      clean_count: 0,
      remaining: null,
      completed: false,
      last_cleaned_at: null,
      effective_since: null
    };
  }
  
  if (itemKind === 'recurrente') {
    // RECURRENTE: NULL tiene prioridad máxima (nunca trabajado)
    // CPM v2: Calcular days_since desde last_cleaned_at y effective_since
    let worstDaysSince = null;
    let worstLastCleanedAt = null;
    let hasNull = false;
    
    // CPM v2: Calcular days_since desde last_cleaned_at y effective_since
    layerStates.forEach(state => {
      const lastCleanedAt = state.last_cleaned_at;
      const effectiveSince = state.effective_since;
      
      // Calcular last_effective_clean (igual que CPM v2)
      let lastEffectiveCleanAt = null;
      if (lastCleanedAt && effectiveSince) {
        lastEffectiveCleanAt = new Date(lastCleanedAt) > new Date(effectiveSince) ? lastCleanedAt : effectiveSince;
      } else if (effectiveSince) {
        lastEffectiveCleanAt = effectiveSince;
      } else if (lastCleanedAt) {
        lastEffectiveCleanAt = lastCleanedAt;
      }
      
      // NULL significa "nunca trabajado" (sin last_effective_clean)
      if (lastEffectiveCleanAt === null) {
        hasNull = true;
      } else if (!hasNull) {
        // Calcular days_since
        const now = new Date();
        const lastEffective = new Date(lastEffectiveCleanAt);
        const daysSince = Math.floor((now - lastEffective) / (1000 * 60 * 60 * 24));
        
        if (worstDaysSince === null || daysSince > worstDaysSince) {
          worstDaysSince = daysSince;
          worstLastCleanedAt = lastEffectiveCleanAt;
        }
      }
    });
    
    // CPM v2: Incluir effective_since en peor estado (NO had_history, PROHIBIDO)
    let worstEffectiveSince = null;
    layerStates.forEach(state => {
      if (state.effective_since) {
        if (worstEffectiveSince === null || new Date(state.effective_since) > new Date(worstEffectiveSince)) {
          worstEffectiveSince = state.effective_since;
        }
      }
    });

    const worstStateResult = {
      clean_count: 0, // No aplica en agregación para recurrente
      remaining: null, // No aplica en agregación
      completed: false, // No aplica en agregación
      last_cleaned_at: hasNull ? null : worstLastCleanedAt,
      effective_since: worstEffectiveSince
    };
    
    // DIAGNÓSTICO: Log resultado del cálculo de peor estado para recurrente
    console.log('[LPM][DEBUG][WORST_STATE][RECURRENTE]', {
      item_kind: itemKind,
      students_count: layerStates.length,
      has_null: hasNull,
      worst_last_cleaned_at: worstLastCleanedAt,
      worst_effective_since: worstEffectiveSince,
      worst_last_cleaned_at: worstLastCleanedAt,
      worst_effective_since: worstEffectiveSince,
      result: worstStateResult
    });
    
    return worstStateResult;
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
    
    // CPM v2: UNA_VEZ NO tiene effective_since (PROHIBIDO)
    const worstStateResult = {
      clean_count: worstCleanCount,
      remaining: worstRemaining,
      completed: worstCompleted,
      last_cleaned_at: null, // No aplica en una_vez
      effective_since: null // UNA_VEZ NO tiene reset
    };
    
    // DIAGNÓSTICO: Log resultado del cálculo de peor estado para una_vez
    console.log('[LPM][DEBUG][WORST_STATE][UNA_VEZ]', {
      item_kind: itemKind,
      students_count: layerStates.length,
      required_count: item.veces_limpiar || 1,
      worst_state: worstState,
      worst_clean_count: worstCleanCount,
      worst_completed: worstCompleted,
      result: worstStateResult
    });
    
    return worstStateResult;
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
    // CPM v2: Incluir effective_since (NO had_history, PROHIBIDO)
    // CPM v2 calcula days_since_last_effective_clean internamente, NO en SQL
    const result = await query(`
      SELECT 
        item_ref,
        shared_clean_count,
        shared_last_cleaned_at,
        shared_remaining,
        shared_completed,
        shared_effective_since,
        pde_clean_count,
        pde_last_cleaned_at,
        pde_remaining,
        pde_completed,
        pde_effective_since
      FROM cleaning_item_state
      WHERE student_id = $1
        AND product_key = 'pde'
        AND domain_type = 'transmutation'
        AND item_ref = ANY($2::text[])
    `, [studentId, itemRefs]);
    
    const statesMap = {};
    result.rows.forEach(row => {
      // CPM v2: Pasar datos brutos (CPM calcula days_since internamente)
      // FIX 2: completed SIEMPRE es integer (0..n), nunca boolean
      statesMap[row.item_ref] = {
        shared: {
          clean_count: row.shared_clean_count || 0,
          remaining: row.shared_remaining,
          completed: Number(row.shared_completed || 0), // Integer, no boolean
          last_cleaned_at: row.shared_last_cleaned_at,
          effective_since: row.shared_effective_since || null
        },
        pde: {
          clean_count: row.pde_clean_count || 0,
          remaining: row.pde_remaining,
          completed: Number(row.pde_completed || 0), // Integer, no boolean
          last_cleaned_at: row.pde_last_cleaned_at,
          effective_since: row.pde_effective_since || null
        }
      };
    });
    
    return statesMap;
  } else {
    // scope='all': obtener estados agregados (PEOR estado entre todos los estudiantes)
    // REGLA CANÓNICA: Proyección ALL muestra el estado MENOS trabajado del grupo
    // Referencia: docs/CANONICAL_RULES_PROJECTION_ALL_WORST_STATE_V1.md
    
    // FIX CANÓNICO: CROSS JOIN + LEFT JOIN para traer TODOS los estudiantes aunque no tengan fila
    // Esto asegura que si un estudiante no tiene estado, se cuenta como NULL y empeora el estado agregado
    // UUID-ONLY: Usar student_id UUID directamente (sin resolución legacy)
    const result = await query(`
      WITH item_refs AS (
        SELECT unnest($1::text[]) AS item_ref
      ),
      active_students AS (
        SELECT id AS student_uuid
        FROM students
        WHERE deleted_at IS NULL
      )
      SELECT 
        ir.item_ref,
        s.student_uuid AS student_id,
        cis.shared_clean_count,
        cis.shared_last_cleaned_at,
        cis.shared_remaining,
        cis.shared_completed,
        cis.shared_effective_since,
        cis.pde_clean_count,
        cis.pde_last_cleaned_at,
        cis.pde_remaining,
        cis.pde_completed,
        cis.pde_effective_since
        -- CPM v2: NO calcular days_since en SQL, CPM lo calcula internamente
        -- CPM v2: NO usar had_history (PROHIBIDO)
      FROM item_refs ir
      CROSS JOIN active_students s
      LEFT JOIN cleaning_item_state cis
        ON cis.student_id = s.student_uuid
       AND cis.item_ref = ir.item_ref
       AND cis.product_key = 'pde'
       AND cis.domain_type = 'transmutation'
      ORDER BY ir.item_ref, s.student_uuid
    `, [itemRefs]);
    
    // Agrupar por item_ref y calcular peor estado
    // FIX: Ahora TODOS los estudiantes aparecen (incluso sin fila = NULL)
    const statesByItem = {};
    
    result.rows.forEach(row => {
      const itemRef = row.item_ref;
      if (!statesByItem[itemRef]) {
        statesByItem[itemRef] = {
          shared: [],
          pde: []
        };
      }
      
      // Si no hay fila (LEFT JOIN devolvió NULL), crear estado NULL explícito
      // Esto asegura que estudiantes sin estado se cuenten como "nunca trabajado"
      // CPM v2: Pasar datos brutos (NO had_history, PROHIBIDO)
      
      // ========================================================================
      // FIX RESET_RECURRENTE_V1: Normalización de estados corruptos legacy
      // ========================================================================
      // Regla: Si effective_since != null y last_cleaned_at < effective_since,
      // normalizar para ciclo actual (no borra historial, solo ciclo actual)
      // NOTA: El parámetro layer no se usa, pero se mantiene para compatibilidad
      const normalizeState = (_layer, effectiveSince, lastCleanedAt, cleanCount) => {
        if (!effectiveSince) {
          // Sin reset: usar datos tal cual
          return {
            last_cleaned_at: lastCleanedAt || null,
            effective_since: null,
            clean_count: cleanCount || 0
          };
        }
        
        // Reset aplicado: verificar coherencia
        if (lastCleanedAt && new Date(lastCleanedAt) < new Date(effectiveSince)) {
          // Estado corrupto legacy: last_cleaned_at anterior al reset
          // Normalizar: ciclo actual empieza en effective_since
          return {
            last_cleaned_at: null, // Ignorar limpieza anterior al reset
            effective_since: effectiveSince,
            clean_count: 0 // Contador reseteado para ciclo actual
          };
        }
        
        // Estado coherente: last_cleaned_at posterior al reset o NULL
        return {
          last_cleaned_at: lastCleanedAt || null,
          effective_since: effectiveSince,
          clean_count: cleanCount || 0
        };
      };
      
      const sharedNormalized = normalizeState(
        'shared',
        row.shared_effective_since,
        row.shared_last_cleaned_at,
        row.shared_clean_count || 0
      );
      
      const pdeNormalized = normalizeState(
        'pde',
        row.pde_effective_since,
        row.pde_last_cleaned_at,
        row.pde_clean_count || 0
      );
      
      statesByItem[itemRef].shared.push({
        clean_count: sharedNormalized.clean_count,
        remaining: row.shared_remaining || null,
        completed: row.shared_completed || false,
        last_cleaned_at: sharedNormalized.last_cleaned_at,
        effective_since: sharedNormalized.effective_since
      });
      
      statesByItem[itemRef].pde.push({
        clean_count: pdeNormalized.clean_count,
        remaining: row.pde_remaining || null,
        completed: row.pde_completed || false,
        last_cleaned_at: pdeNormalized.last_cleaned_at,
        effective_since: pdeNormalized.effective_since
      });
    });
    
    // DIAGNÓSTICO: Verificar que todos los estudiantes están incluidos
    const activeStudentsCount = await query(`
      SELECT COUNT(*) as total
      FROM students
      WHERE deleted_at IS NULL
    `);
    const expectedStudentsCount = parseInt(activeStudentsCount.rows[0]?.total || '0', 10);
    
    logInfo('LPM', '[ALL_PROJECTION][FIX] Estados obtenidos con CROSS JOIN + LEFT JOIN', {
      traceId,
      item_refs_count: itemRefs.length,
      expected_students_count: expectedStudentsCount,
      rows_returned: result.rows.length,
      expected_rows: itemRefs.length * expectedStudentsCount,
      per_item_states: Object.keys(statesByItem).map(itemRef => ({
        item_ref: itemRef,
        shared_count: statesByItem[itemRef].shared.length,
        pde_count: statesByItem[itemRef].pde.length,
        has_null_states: statesByItem[itemRef].shared.some(s => s.last_cleaned_at === null && s.effective_since === null) ||
                         statesByItem[itemRef].pde.some(s => s.last_cleaned_at === null && s.effective_since === null)
      }))
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
      
      // DIAGNÓSTICO: Log detallado de estados individuales por alumno
      const perStudentStates = {
        shared: itemStates.shared.map((s, idx) => ({
          student_idx: idx,
          clean_count: s.clean_count,
          last_cleaned_at: s.last_cleaned_at,
          effective_since: s.effective_since,
          completed: s.completed
        })),
        pde: itemStates.pde.map((s, idx) => ({
          student_idx: idx,
          clean_count: s.clean_count,
          last_cleaned_at: s.last_cleaned_at,
          effective_since: s.effective_since,
          completed: s.completed
        }))
      };
      
      logInfo('ListProjectionModel', '[LPM][WORST_STATE] Calculado peor estado para item', {
        traceId,
        item_ref: itemRef,
        item_kind: itemKindForItem,
        students_count: itemStates.shared.length,
        per_student_states: itemStates.shared.map((s, idx) => ({
          student_idx: idx,
          clean_count: s.clean_count,
          last_cleaned_at: s.last_cleaned_at,
          effective_since: s.effective_since,
          completed: s.completed
        })),
        worst_shared: {
          last_cleaned_at: worstShared.last_cleaned_at,
          effective_since: worstShared.effective_since,
          clean_count: worstShared.clean_count,
          completed: worstShared.completed
        },
        worst_pde: {
          last_cleaned_at: worstPde.last_cleaned_at,
          effective_since: worstPde.effective_since,
          clean_count: worstPde.clean_count,
          completed: worstPde.completed
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
    // ============================================================================
    // FAIL-HARD OBLIGATORIO: view_layer es OBLIGATORIO (sin fallbacks)
    // ============================================================================
    if (!view_layer || (typeof view_layer === 'string' && view_layer.trim() === '')) {
      const error = new Error('[INVARIANT_BROKEN][VIEW_LAYER_MISSING] view_layer es OBLIGATORIO pero falta o está vacío');
      logError('ListProjectionModel', '[INVARIANT_BROKEN][VIEW_LAYER_MISSING]', {
        traceId,
        list_id,
        item_kind,
        view_layer: view_layer,
        view_layer_type: typeof view_layer
      });
      throw error;
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
    
    // UUID-ONLY: Ya no se resuelve legacy, usar student_uuid directamente
    const studentId = (scope === 'student' && student_uuid) ? student_uuid : null;
    
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
    // NOTA: Usar Promise.all con map async porque necesitamos await dentro del callback
    const itemsWithProjection = await Promise.all(items.map(async (item) => {
      const cleaningState = cleaningStatesMap[item.item_ref] || {
        shared: {},
        pde: {}
      };
      
      // LOG ESTRUCTURADO TEMPORAL (FASE 5): Input CPM
      if (scope === 'all') {
        console.log('[LPM][CPM_V2][INPUT]', {
          item_ref: item.item_ref,
          item_kind,
          scope,
          cleaning_state_aggregated: {
            shared: {
              clean_count: cleaningState.shared?.clean_count,
              last_cleaned_at: cleaningState.shared?.last_cleaned_at,
              effective_since: cleaningState.shared?.effective_since,
              remaining: cleaningState.shared?.remaining,
              completed: cleaningState.shared?.completed
            },
            pde: {
              clean_count: cleaningState.pde?.clean_count,
              last_cleaned_at: cleaningState.pde?.last_cleaned_at,
              effective_since: cleaningState.pde?.effective_since,
              remaining: cleaningState.pde?.remaining,
              completed: cleaningState.pde?.completed
            }
          },
          item_config: {
            threshold_days: item.frecuencia_dias || 7,
            required_count: item.veces_limpiar || 1
          }
        });
      }
      
      // CPM v2: NO calcular combo aquí, CPM lo calcula internamente
      // Solo pasar datos brutos (shared y pde)
      
      // ============================================================================
      // APLICACIÓN DE OVERRIDES EN LIST-PROJECTION
      // ============================================================================
      // REGLA CONSTITUCIONAL: Overrides SOLO se aplican si scope='student'
      // - scope='student' → Overrides se aplican (personalización por estudiante)
      // - scope='all' → Overrides NO se aplican (estado agregado sin personalizaciones)
      //
      // MOMENTO DE APLICACIÓN:
      // - Overrides se aplican ANTES de CPM (computeCleaningProjection)
      // - CPM recibe effectiveConfig con overrides YA aplicados
      // - CPM es "ciego" a overrides (solo ve valores efectivos)
      //
      // OVERRIDES HUÉRFANOS:
      // - Si item_ref no existe en catálogo, override NO se aplica (silencioso)
      // - Override huérfano NO rompe el sistema (simplemente no se aplica)
      // ============================================================================
      if (scope === 'all') {
        // En scope='all', usar valores base (sin overrides)
        // Esto es constitucional: ALL muestra estado agregado sin personalizaciones
        // NOTA: NO se llama resolveItemConfigForStudent en scope='all'
      } else if (scope === 'student' && !studentId) {
        throw new Error('ERROR_CANONICO: scope=student requiere studentId');
      }
      
      let effectiveConfig = {
        threshold_days: item.frecuencia_dias || 7,
        critical_multiplier: 2.0,
        required_count: item.veces_limpiar || 1,
        nivel: item.nivel || null,
        descripcion: item.descripcion || null
      };
      
      if (scope === 'student' && studentId) {
        // Aplicar overrides de configuración de item
        // REGLA CONSTITUCIONAL: Overrides SOLO en scope='student'
        effectiveConfig = await resolveItemConfigForStudent(
          effectiveConfig,
          studentId,
          item.item_ref
        );
      }
      
      // Usar CPM para calcular proyección con configuración efectiva
      const projection = computeCleaningProjection({
        cleaning_state: cleaningState,
        item_kind: item_kind,
        view_layer: view_layer,
        config: effectiveConfig
      });
      
      // Determinar active_state y active_visual_state desde view_layer
      const activeState = projection.state_by_view_layer[view_layer];
      
      // LOG ESTRUCTURADO TEMPORAL (FASE 5): Output CPM
      if (scope === 'all') {
        console.log('[LPM][CPM_V2][OUTPUT]', {
          item_ref: item.item_ref,
          item_kind,
          scope,
          view_layer,
          state_by_view_layer: {
            shared: {
              state: projection.state_by_view_layer.shared?.state,
              visual_state: projection.state_by_view_layer.shared?.visual_state,
              metrics: projection.state_by_view_layer.shared?.metrics
            },
            pde: {
              state: projection.state_by_view_layer.pde?.state,
              visual_state: projection.state_by_view_layer.pde?.visual_state,
              metrics: projection.state_by_view_layer.pde?.metrics
            },
            [view_layer]: {
              state: activeState?.state,
              visual_state: activeState?.visual_state,
              metrics: activeState?.metrics
            }
          },
          active_state: activeState?.state || 'never',
          active_visual_state: activeState?.visual_state || 'never'
        });
      }
      
      // MAJOR-1 FIX: Validación fail-fast - effective DEBE existir para recurrente
      // REGLA CONSTITUCIONAL: computeCleaningProjection ya calcula effective para recurrente
      // Si falta, es un error del sistema (no un caso edge)
      if (item_kind === 'recurrente' && !projection.state_by_view_layer.effective) {
        const error = new Error(`[MAJOR-1] state_by_view_layer.effective es OBLIGATORIO para item_kind='recurrente' pero falta en la proyección. Item: ${item.item_ref}`);
        logError('ListProjectionModel', '[MAJOR-1] effective no calculado para recurrente (ERROR CRÍTICO)', {
          traceId,
          item_ref: item.item_ref,
          item_kind,
          available_layers: Object.keys(projection.state_by_view_layer),
          error: error.message
        });
        throw error; // FAIL-FAST: No continuar si falta effective
      }
      
      // ============================================================================
      // BUG-001 FIX: Validación fail-hard - state_by_view_layer es OBLIGATORIO
      // REGLA CONSTITUCIONAL A1: Si falta state_by_view_layer → FAIL-HARD
      // ============================================================================
      if (!projection.state_by_view_layer) {
        const error = new Error(`[INVARIANT_BROKEN][STATE_BY_VIEW_LAYER_MISSING] state_by_view_layer es OBLIGATORIO pero falta en la proyección. Item: ${item.item_ref}`);
        logError('ListProjectionModel', '[INVARIANT_BROKEN][STATE_BY_VIEW_LAYER_MISSING]', {
          traceId,
          item_ref: item.item_ref,
          item_kind,
          view_layer,
          projection_keys: projection ? Object.keys(projection) : [],
          error: error.message
        });
        throw error; // FAIL-HARD: No continuar si falta state_by_view_layer
      }
      
      // Validar que state_by_view_layer tiene al menos shared y pde
      if (!projection.state_by_view_layer.shared || !projection.state_by_view_layer.pde) {
        const error = new Error(`[INVARIANT_BROKEN][STATE_BY_VIEW_LAYER_MISSING] state_by_view_layer.shared o state_by_view_layer.pde faltan. Item: ${item.item_ref}`);
        logError('ListProjectionModel', '[INVARIANT_BROKEN][STATE_BY_VIEW_LAYER_MISSING]', {
          traceId,
          item_ref: item.item_ref,
          item_kind,
          view_layer,
          available_layers: projection.state_by_view_layer ? Object.keys(projection.state_by_view_layer) : [],
          error: error.message
        });
        throw error;
      }
      
      // Validar que effective existe para recurrente
      if (item_kind === 'recurrente' && !projection.state_by_view_layer.effective) {
        const error = new Error(`[INVARIANT_BROKEN][STATE_BY_VIEW_LAYER_MISSING] state_by_view_layer.effective es OBLIGATORIO para item_kind='recurrente' pero falta. Item: ${item.item_ref}`);
        logError('ListProjectionModel', '[INVARIANT_BROKEN][STATE_BY_VIEW_LAYER_MISSING]', {
          traceId,
          item_ref: item.item_ref,
          item_kind,
          available_layers: Object.keys(projection.state_by_view_layer),
          error: error.message
        });
        throw error;
      }
      
      // Log forense obligatorio: state_by_view_layer OK
      logInfo('ListProjectionModel', '[CPM_V2][OUTPUT][STATE_BY_VIEW_LAYER_OK]', {
        traceId,
        item_ref: item.item_ref,
        item_kind,
        view_layer,
        available_layers: Object.keys(projection.state_by_view_layer),
        has_shared: !!projection.state_by_view_layer.shared,
        has_pde: !!projection.state_by_view_layer.pde,
        has_effective: !!projection.state_by_view_layer.effective,
        has_combo: !!projection.state_by_view_layer.combo
      });
      
      // BUG-023 FIX: Garantizar que required_count y veces_limpiar siempre están presentes
      // Backend debe devolver ambos campos explícitamente
      const requiredCount = effectiveConfig.required_count !== undefined 
        ? effectiveConfig.required_count 
        : (item.veces_limpiar || 1);
      const vecesLimpiar = item.veces_limpiar || 1;
      
      // Construir item con valores efectivos (incluyendo overrides de nivel, descripcion, threshold_days, required_count)
      // IMPORTANTE: Mantener valores base originales para comparación en UI
      const effectiveItem = {
        ...item,
        // Valores base originales (para comparación en UI)
        nivel_base: item.nivel || 9,
        descripcion_base: item.descripcion || '',
        // Aplicar overrides de nivel y descripcion si existen en effectiveConfig
        nivel: effectiveConfig.nivel !== undefined ? effectiveConfig.nivel : item.nivel,
        descripcion: effectiveConfig.descripcion !== undefined ? effectiveConfig.descripcion : item.descripcion,
        // Aplicar overrides de threshold_days y required_count si existen en effectiveConfig
        threshold_days: effectiveConfig.threshold_days !== undefined ? effectiveConfig.threshold_days : (item.frecuencia_dias || 7),
        // BUG-023 FIX: Garantizar que ambos campos están presentes (snake_case canónico)
        veces_limpiar: vecesLimpiar, // Campo base (obligatorio)
        required_count: requiredCount, // Campo efectivo con overrides (obligatorio)
        state_by_view_layer: projection.state_by_view_layer,
        active_state: activeState?.state || 'never',
        active_visual_state: activeState?.visual_state || 'never'
      };
      
      return effectiveItem;
    }));
    
    // Calcular métricas
    const metrics = calculateMetrics(itemsWithProjection, view_layer);
    
    // Calcular list_state
    const listState = calculateListState(metrics);
    
    // BUG-018 FIX: Añadir aggregated_state_all cuando scope='all' para recurrente
    // Este campo contiene el estado agregado canónico para ordenamiento
    let aggregatedStateAll = null;
    if (scope === 'all' && item_kind === 'recurrente') {
      // Obtener todos los estudiantes activos para calcular agregación
      const activeStudentsResult = await query(`
        SELECT id AS student_uuid
        FROM students
        WHERE deleted_at IS NULL
      `);
      const activeStudents = activeStudentsResult.rows.map(row => row.student_uuid);
      
      // Calcular estado agregado para cada view_layer posible
      aggregatedStateAll = {
        shared: aggregateStateForAll(
          itemsWithProjection.map(item => ({
            state_by_view_layer: item.state_by_view_layer
          })),
          'shared'
        ),
        pde: aggregateStateForAll(
          itemsWithProjection.map(item => ({
            state_by_view_layer: item.state_by_view_layer
          })),
          'pde'
        )
      };
      
      // Si effective está disponible, calcular también
      if (itemsWithProjection.some(item => item.state_by_view_layer?.effective)) {
        aggregatedStateAll.effective = aggregateStateForAll(
          itemsWithProjection.map(item => ({
            state_by_view_layer: item.state_by_view_layer
          })),
          'effective'
        );
      }
      
      logInfo('ListProjectionModel', '[BUG-018] Estado agregado ALL calculado', {
        traceId,
        list_id,
        item_kind,
        aggregated_state_all: aggregatedStateAll,
        students_count: activeStudents.length
      });
    }
    
    logInfo('ListProjectionModel', '[LPM][LIST_PROJECTION] Proyección calculada', {
      traceId,
      list_id,
      total_items: metrics.total_items,
      reviewed_pct: metrics.reviewed_pct,
      dominant_state: listState.dominant_state,
      health_bucket: listState.health_bucket,
      has_aggregated_state_all: aggregatedStateAll !== null
    });
    
    // CIERRE-001: Garantizar que items es SIEMPRE un array válido (incluso si está vacío)
    // REGLA: projection.items nunca puede ser undefined o null
    const normalizedItems = Array.isArray(itemsWithProjection) ? itemsWithProjection : [];
    
    const result = {
      items: normalizedItems,
      metrics,
      list_state: listState
    };
    
    // BUG-018 FIX: Añadir aggregated_state_all solo cuando scope='all' y recurrente
    if (aggregatedStateAll !== null) {
      result.aggregated_state_all = aggregatedStateAll;
    }
    
    return result;
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
