// src/core/master/services/cleaning-projection-model.js
// Cleaning Projection Model (CPM) v1
//
// CONSTITUCIONAL: Única capa autorizada para interpretar estado bruto de limpieza
// y generar proyecciones por view_layer.
//
// REGLAS ABSOLUTAS:
// 1. CPM NO escribe (función pura)
// 2. CPM NO muta estado
// 3. CPM NO infiere desde contexto
// 4. CPM SOLO proyecta estado
//
// Referencias:
// - docs/CLEANING_PROJECTION_MODEL_V1.md (documentación canónica)
// - docs/CONSTITUTION_VIEW_AUTHORITY_V1.md (regla constitucional)
// - docs/UI_PROJECTION_MODEL_V1.md (PDUI)

import { validateViewLayerItemKindCoherence, validateViewLayer } from './cleaning-layer-constants.js';

/**
 * Calcula estado visual para una view_layer específica
 * 
 * @param {string} viewLayer - Capa de vista ('shared' | 'pde' | 'combo' | 'effective')
 * @param {Object} cleaningState - Estado bruto { shared: {...}, pde: {...}, combo?: {...} }
 * @param {string} itemKind - Tipo de item ('recurrente' | 'una_vez')
 * @param {Object} config - Configuración { threshold_days, critical_multiplier, required_count }
 * @returns {Object} { state, visual_state, computed_state }
 */
function computeStateForLayer(viewLayer, cleaningState, itemKind, config) {
  const { threshold_days = 7, critical_multiplier = 2.0, required_count = 1 } = config || {};
  const criticalThreshold = threshold_days * critical_multiplier;
  
  const shared = cleaningState.shared || {};
  const pde = cleaningState.pde || {};
  const combo = cleaningState.combo || {};
  
  if (itemKind === 'recurrente') {
    // RECURRENTE: usa days_since_last_clean de la capa indicada
    // O calcula 'effective' como proyección agregada de shared + pde
    
    if (viewLayer === 'effective') {
      // EFFECTIVE: proyección agregada (mejor estado entre shared y pde)
      // NO escribe nada, solo calcula proyección
      
      // Calcular estado de shared
      const sharedDaysSince = shared?.days_since_last_clean ?? null;
      let sharedState;
      if (sharedDaysSince === null || sharedDaysSince === undefined) {
        sharedState = 'never';
      } else if (sharedDaysSince < threshold_days) {
        sharedState = 'reviewed';
      } else if (sharedDaysSince < criticalThreshold) {
        sharedState = 'pending';
      } else {
        sharedState = 'important';
      }
      
      // Calcular estado de pde
      const pdeDaysSince = pde?.days_since_last_clean ?? null;
      let pdeState;
      if (pdeDaysSince === null || pdeDaysSince === undefined) {
        pdeState = 'never';
      } else if (pdeDaysSince < threshold_days) {
        pdeState = 'reviewed';
      } else if (pdeDaysSince < criticalThreshold) {
        pdeState = 'pending';
      } else {
        pdeState = 'important';
      }
      
      // Regla canónica: effective = mejor estado resultante
      // Prioridad: reviewed > pending > important > never
      let effectiveState;
      if (sharedState === 'reviewed' || pdeState === 'reviewed') {
        effectiveState = 'reviewed';
      } else if (sharedState === 'pending' || pdeState === 'pending') {
        effectiveState = 'pending';
      } else if (sharedState === 'important' || pdeState === 'important') {
        effectiveState = 'important';
      } else {
        effectiveState = 'never';
      }
      
      // Para effective, days_since_last_clean es el mínimo (mejor caso)
      const effectiveDaysSince = sharedDaysSince !== null && pdeDaysSince !== null
        ? Math.min(sharedDaysSince, pdeDaysSince)
        : (sharedDaysSince !== null ? sharedDaysSince : pdeDaysSince);
      
      // REGLA: effective_sources indica qué capas están en estado limpio (reviewed)
      // shared = true si shared_state === 'reviewed'
      // pde = true si pde_state === 'reviewed'
      const effectiveSources = {
        shared: sharedState === 'reviewed',
        pde: pdeState === 'reviewed'
      };
      
      return {
        state: effectiveState,
        visual_state: effectiveState, // RECURRENTE: visual_state = state
        effective_sources: effectiveSources, // Metadata de composición
        computed_state: {
          view_layer: 'effective',
          days_since_last_clean: effectiveDaysSince,
          threshold_days,
          critical_threshold: criticalThreshold,
          shared_state: sharedState,
          pde_state: pdeState,
          shared_days_since: sharedDaysSince,
          pde_days_since: pdeDaysSince
        }
      };
    }
    
    // view_layer === 'shared' o 'pde'
    let daysSince;
    if (viewLayer === 'pde') {
      daysSince = pde?.days_since_last_clean ?? null;
    } else {
      // view_layer === 'shared' (default)
      daysSince = shared?.days_since_last_clean ?? null;
    }
    
    let state;
    if (daysSince === null || daysSince === undefined) {
      state = 'never';
    } else if (daysSince < threshold_days) {
      state = 'reviewed';
    } else if (daysSince < criticalThreshold) {
      state = 'pending';
    } else {
      state = 'important';
    }
    
    return {
      state,
      visual_state: state, // RECURRENTE: visual_state = state
      computed_state: {
        view_layer: viewLayer,
        days_since_last_clean: daysSince,
        threshold_days,
        critical_threshold: criticalThreshold
      }
    };
  } else {
    // UNA_VEZ: usa combo si view_layer='combo', sino usa la capa indicada
    let cleanCount;
    let remaining;
    
    if (viewLayer === 'combo') {
      // COMBO: suma shared + pde
      cleanCount = combo?.clean_count ?? 0;
      remaining = combo?.remaining ?? null;
    } else if (viewLayer === 'pde') {
      cleanCount = pde?.clean_count ?? 0;
      remaining = pde?.remaining ?? null;
    } else {
      // view_layer === 'shared' (default)
      cleanCount = shared?.clean_count ?? 0;
      remaining = shared?.remaining ?? null;
    }
    
    let visualState;
    let state;
    
    if (cleanCount === 0) {
      visualState = 'never';
      state = 'pending';
    } else if (cleanCount < required_count) {
      visualState = 'in_progress';
      state = 'pending';
    } else if (cleanCount >= required_count && cleanCount < (required_count * 10)) {
      visualState = 'completed';
      state = 'completed';
    } else {
      visualState = 'empowered';
      state = 'completed';
    }
    
    return {
      state,
      visual_state: visualState,
      computed_state: {
        view_layer: viewLayer,
        clean_count: cleanCount,
        remaining,
        required_count
      }
    };
  }
}

/**
 * Cleaning Projection Model (CPM) v1
 * 
 * Función canónica para calcular proyecciones de estado de limpieza.
 * 
 * REGLAS CONSTITUCIONALES:
 * - CPM NO escribe (función pura)
 * - CPM NO muta estado
 * - CPM NO infiere desde contexto
 * - CPM SOLO proyecta estado
 * 
 * @param {Object} params - Parámetros
 * @param {Object} params.cleaning_state - Estado bruto desde cleaning_item_state
 *   - shared: { clean_count, days_since_last_clean, remaining, completed, last_cleaned_at }
 *   - pde: { clean_count, days_since_last_clean, remaining, completed, last_cleaned_at }
 *   - combo?: { clean_count, remaining, completed } (calculado para una_vez)
 * @param {string} params.item_kind - Tipo de item ('recurrente' | 'una_vez')
 * @param {string} params.view_layer - Capa de vista solicitada ('shared' | 'pde' | 'combo' | 'effective')
 * @param {Object} [params.config] - Configuración opcional
 *   - threshold_days: Días umbral para estado 'reviewed' (default: 7)
 *   - critical_multiplier: Multiplicador para estado 'important' (default: 2.0)
 *   - required_count: Contador requerido para una_vez (default: 1)
 * @returns {Object} Proyección completa
 *   - state_by_view_layer: { shared: {...}, pde: {...}, combo?: {...}, effective?: {...} }
 *   - state_active: Estado activo según view_layer solicitada
 *   - visual_state_active: Estado visual activo según view_layer solicitada
 *   - debug: { view_layer, item_kind, config, computed_state }
 * @throws {Error} Si view_layer no es coherente con item_kind
 */
export function computeCleaningProjection({ cleaning_state, item_kind, view_layer, config }) {
  // Validar view_layer
  validateViewLayer(view_layer);
  
  // Validar coherencia view_layer + item_kind
  validateViewLayerItemKindCoherence(view_layer, item_kind);
  
  // Calcular state_by_view_layer para todas las view_layers posibles
  const stateByViewLayer = {
    shared: computeStateForLayer('shared', cleaning_state, item_kind, config),
    pde: computeStateForLayer('pde', cleaning_state, item_kind, config)
  };
  
  // combo solo para una_vez
  if (item_kind === 'una_vez') {
    stateByViewLayer.combo = computeStateForLayer('combo', cleaning_state, item_kind, config);
  }
  
  // effective solo para recurrente
  if (item_kind === 'recurrente') {
    stateByViewLayer.effective = computeStateForLayer('effective', cleaning_state, item_kind, config);
  }
  
  // Estado activo según view_layer solicitada
  const stateActive = stateByViewLayer[view_layer];
  
  if (!stateActive) {
    throw new Error(`view_layer '${view_layer}' no está disponible para item_kind '${item_kind}'`);
  }
  
  return {
    state_by_view_layer: stateByViewLayer,
    state_active: stateActive.state || 'never',
    visual_state_active: stateActive.visual_state || 'never',
    debug: {
      view_layer,
      item_kind,
      config: config || {},
      computed_state: stateActive.computed_state
    }
  };
}

/**
 * Función de compatibilidad: computeVisualState
 * 
 * DEPRECATED: Usar computeCleaningProjection en su lugar.
 * Esta función se mantiene para compatibilidad con código existente.
 * 
 * @param {Object} params - Parámetros
 * @param {Object} params.shared - Datos shared
 * @param {Object} params.pde - Datos pde
 * @param {Object} params.combo - Datos combo (opcional)
 * @param {string} params.item_kind - Tipo de item
 * @param {string} params.view_layer - Capa de vista
 * @param {Object} params.config - Configuración
 * @returns {Object} { state, visual_state, computed_state }
 */
export function computeVisualState({ shared, pde, combo, item_kind, view_layer, config }) {
  // Construir cleaning_state desde parámetros legacy
  const cleaning_state = {
    shared: shared || {},
    pde: pde || {},
    combo: combo || {}
  };
  
  // Usar CPM para calcular proyección
  const projection = computeCleaningProjection({
    cleaning_state,
    item_kind,
    view_layer,
    config
  });
  
  // Retornar formato legacy
  return projection.state_by_view_layer[view_layer];
}
