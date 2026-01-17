// src/core/master/services/cleaning-projection-model.js
// Cleaning Projection Model (CPM) v2
//
// CONSTITUCIONAL: Única capa autorizada para interpretar estado bruto de limpieza
// y generar proyecciones por view_layer.
//
// REGLAS ABSOLUTAS:
// 1. CPM NO escribe (función pura)
// 2. CPM NO muta estado
// 3. CPM NO infiere desde contexto
// 4. CPM SOLO proyecta estado
// 5. CPM es la ÚNICA autoridad que devuelve: reviewed / pending / important / never
//
// CPM v2 CAMBIOS:
// - Eliminado had_history (PROHIBIDO)
// - Reset SOLO para RECURRENTE (UNA_VEZ no tiene reset)
// - Cálculo de combo interno (no duplicado)
// - Cálculo de days_since_last_effective_clean interno
//
// Referencias:
// - docs/CLEANING_PROJECTION_MODEL_V1.md (documentación canónica)
// - docs/CONSTITUTION_VIEW_AUTHORITY_V1.md (regla constitucional)
// - docs/DIAGNOSTICO_CPM_V2_FASE0.md (diagnóstico)

import { validateViewLayerItemKindCoherence, validateViewLayer } from './cleaning-layer-constants.js';

/**
 * CPM v2: Calcula estado efectivo según contrato canónico
 * 
 * @param {Object} params - Parámetros
 * @param {string} params.item_kind - 'recurrente' | 'una_vez'
 * @param {string} params.view_layer - 'shared' | 'pde' | 'effective' | 'combo'
 * @param {Object} params.item_config - { threshold_days, critical_multiplier, required_count }
 * @param {Object} params.cleaning_state - Estado bruto por capa
 *   - shared: { last_cleaned_at, effective_since, clean_count, remaining, completed }
 *   - pde: { last_cleaned_at, effective_since, clean_count, remaining, completed }
 * @param {Object} [params.overrides] - Overrides opcionales
 * @returns {Object} { state, visual_state, metrics }
 */
export function computeEffectiveState({ item_kind, view_layer, item_config, cleaning_state, overrides = {} }) {
  const { threshold_days = 7, critical_multiplier = 2.0, required_count = 1 } = item_config || {};
  const criticalThreshold = threshold_days * critical_multiplier;
  
  const shared = cleaning_state?.shared || {};
  const pde = cleaning_state?.pde || {};
  
  // Validar coherencia view_layer + item_kind
  validateViewLayerItemKindCoherence(view_layer, item_kind);
  
  // LOG ESTRUCTURADO TEMPORAL (FASE 5)
  console.log('[CPM_V2][INPUT]', {
    item_kind,
    view_layer,
    item_config: { threshold_days, critical_multiplier, required_count },
    cleaning_state: {
      shared: {
        last_cleaned_at: shared.last_cleaned_at,
        effective_since: shared.effective_since,
        clean_count: shared.clean_count,
        remaining: shared.remaining,
        completed: shared.completed
      },
      pde: {
        last_cleaned_at: pde.last_cleaned_at,
        effective_since: pde.effective_since,
        clean_count: pde.clean_count,
        remaining: pde.remaining,
        completed: pde.completed
      }
    }
  });
  
  let result;
  if (item_kind === 'recurrente') {
    result = computeRecurrenteState({ view_layer, threshold_days, criticalThreshold, shared, pde });
  } else {
    // UNA_VEZ: NO tiene reset, NO tiene effective_since
    result = computeUnaVezState({ view_layer, required_count, shared, pde });
  }
  
  // LOG ESTRUCTURADO TEMPORAL (FASE 5)
  console.log('[CPM_V2][OUTPUT]', {
    item_kind,
    view_layer,
    state: result.state,
    visual_state: result.visual_state,
    metrics: result.metrics
  });
  
  return result;
}

/**
 * Calcula estado para RECURRENTE
 * 
 * REGLAS:
 * - last_effective_clean = max(last_cleaned_at, effective_since)
 * - never: last_cleaned_at === null AND effective_since === null
 * - pending (post-reset): effective_since !== null AND last_effective_clean === effective_since
 * - reviewed: days_since < threshold_days
 * - pending: threshold_days <= days_since < criticalThreshold
 * - important: days_since >= criticalThreshold
 */
function computeRecurrenteState({ view_layer, threshold_days, criticalThreshold, shared, pde }) {
  if (view_layer === 'effective') {
    // EFFECTIVE: mejor estado entre shared y pde
    const sharedState = computeRecurrenteLayerState({ threshold_days, criticalThreshold, layerData: shared });
    const pdeState = computeRecurrenteLayerState({ threshold_days, criticalThreshold, layerData: pde });
    
    // Prioridad: reviewed > pending > important > never
    let effectiveState;
    if (sharedState.state === 'reviewed' || pdeState.state === 'reviewed') {
      effectiveState = 'reviewed';
    } else if (sharedState.state === 'pending' || pdeState.state === 'pending') {
      effectiveState = 'pending';
    } else if (sharedState.state === 'important' || pdeState.state === 'important') {
      effectiveState = 'important';
    } else {
      effectiveState = 'never';
    }
    
    const effectiveDaysSince = sharedState.days_since !== null && pdeState.days_since !== null
      ? Math.min(sharedState.days_since, pdeState.days_since)
      : (sharedState.days_since !== null ? sharedState.days_since : pdeState.days_since);
    
    return {
      state: effectiveState,
      visual_state: effectiveState,
      metrics: {
        days_since_last_clean: effectiveDaysSince,
        threshold_days,
        critical_threshold: criticalThreshold,
        shared_state: sharedState.state,
        pde_state: pdeState.state,
        shared_days_since: sharedState.days_since,
        pde_days_since: pdeState.days_since
      }
    };
  }
  
  // view_layer === 'shared' o 'pde'
  const layerData = view_layer === 'pde' ? pde : shared;
  return computeRecurrenteLayerState({ threshold_days, criticalThreshold, layerData });
}

/**
 * Calcula estado para una capa específica de RECURRENTE
 */
function computeRecurrenteLayerState({ threshold_days, criticalThreshold, layerData }) {
  const lastCleanedAt = layerData?.last_cleaned_at ?? null;
  const effectiveSince = layerData?.effective_since ?? null;
  
  // RESET_RECURRENTE_V1: Reset inicia un nuevo ciclo
  // REGLA: El cálculo del estado IGNORA eventos anteriores al último reset (effective_since)
  // REGLA: Tras reset, el estado inicial del nuevo ciclo es 'reseteado' con days_since = 0
  // REGLA: effective_since != null && last_cleaned_at == null => reseteado (nuevo ciclo abierto)
  
  // Determinar si hay reset aplicado
  const hasReset = effectiveSince !== null;
  
  // RESET_RECURRENTE_V1: Logs forenses reducidos (solo para debugging si es necesario)
  // Removido logs verbosos temporales - mantener solo logs de error estructurados
  
  // RESET_RECURRENTE_V1: Si hay reset, solo considerar eventos posteriores al reset
  let lastEffectiveCleanAt = null;
  let daysSince = null;
  
  // ============================================================================
  // FORENSICS: Log temporal para caso maldito - dentro de CPM
  // ============================================================================
  const FORENSICS_TARGET_ITEM_PATTERN = 'item_17_1768641625523_cr5fpr';
  const isForensicsCase = layerData?.item_ref?.includes(FORENSICS_TARGET_ITEM_PATTERN);
  
  if (isForensicsCase) {
    console.log('[FORENSICS][CPM_INTERNAL]', {
      item_ref: layerData?.item_ref,
      layer: layer,
      hasReset,
      effectiveSince: effectiveSince ? new Date(effectiveSince).toISOString() : null,
      lastCleanedAt: lastCleanedAt ? new Date(lastCleanedAt).toISOString() : null,
      threshold_days,
      criticalThreshold,
      comparison: lastCleanedAt && effectiveSince ? {
        lastCleaned_date: new Date(lastCleanedAt).toISOString(),
        effectiveSince_date: new Date(effectiveSince).toISOString(),
        is_lastCleaned_after_reset: new Date(lastCleanedAt) > new Date(effectiveSince),
        diff_ms: new Date(lastCleanedAt).getTime() - new Date(effectiveSince).getTime()
      } : null
    });
  }
  // ============================================================================
  
  if (hasReset) {
    // RESET_RECURRENTE_V1: Reset aplicado - iniciar nuevo ciclo
    const effectiveSinceDate = new Date(effectiveSince);
    
    // Si hay last_cleaned_at, verificar si es posterior al reset
    if (lastCleanedAt) {
      const lastCleanedDate = new Date(lastCleanedAt);
      if (lastCleanedDate > effectiveSinceDate) {
        // Hay limpieza posterior al reset - usar esa fecha
        lastEffectiveCleanAt = lastCleanedAt;
        const now = new Date();
        daysSince = Math.floor((now - lastCleanedDate) / (1000 * 60 * 60 * 24));
        
        if (isForensicsCase) {
          console.log('[FORENSICS][CPM_RESET_WITH_CLEAN]', {
            item_ref: layerData?.item_ref,
            layer,
            decision: 'last_cleaned_at > effective_since → usar last_cleaned_at',
            lastEffectiveCleanAt: lastEffectiveCleanAt ? new Date(lastEffectiveCleanAt).toISOString() : null,
            daysSince
          });
        }
      } else {
        // La limpieza es anterior al reset - IGNORAR (reset inicia nuevo ciclo)
        // RESET_RECURRENTE_V1: Estado inicial del ciclo = 'reseteado' con days_since = 0
        lastEffectiveCleanAt = null;
        daysSince = 0;
        
        if (isForensicsCase) {
          console.log('[FORENSICS][CPM_RESET_IGNORE_OLD_CLEAN]', {
            item_ref: layerData?.item_ref,
            layer,
            decision: 'last_cleaned_at <= effective_since → IGNORAR limpieza antigua',
            lastEffectiveCleanAt,
            daysSince
          });
        }
      }
    } else {
      // No hay limpieza después del reset
      // RESET_RECURRENTE_V1: Estado inicial del ciclo = 'reseteado' con days_since = 0
      lastEffectiveCleanAt = null;
      daysSince = 0;
      
      if (isForensicsCase) {
        console.log('[FORENSICS][CPM_RESET_NO_CLEAN]', {
          item_ref: layerData?.item_ref,
          layer,
          decision: 'NO hay last_cleaned_at → nunca limpiado en este ciclo',
          lastEffectiveCleanAt,
          daysSince
        });
      }
    }
  } else {
    // Sin reset: lógica normal (considerar todas las limpiezas)
    if (lastCleanedAt) {
      lastEffectiveCleanAt = lastCleanedAt;
      const now = new Date();
      const lastCleanedDate = new Date(lastCleanedAt);
      daysSince = Math.floor((now - lastCleanedDate) / (1000 * 60 * 60 * 24));
    } else {
      lastEffectiveCleanAt = null;
      daysSince = null;
    }
  }
  
  // Calcular estado según RESET_RECURRENTE_V1
  let state;
  if (hasReset && lastEffectiveCleanAt === null) {
    // RESET_RECURRENTE_V1: Reset aplicado y sin limpieza posterior → 'reseteado' con days_since = 0
    // effective_since != null && last_cleaned_at == null => reseteado (nuevo ciclo abierto)
    state = 'reseteado';
    daysSince = 0;
  } else if (lastEffectiveCleanAt === null) {
    // Sin reset y sin limpieza → 'never' (nunca trabajado)
    state = 'never';
  } else if (daysSince !== null && daysSince < threshold_days) {
    // Limpieza reciente → 'reviewed'
    state = 'reviewed';
  } else if (daysSince !== null && daysSince < criticalThreshold) {
    // Limpieza antigua pero no crítica → 'pending'
    state = 'pending';
  } else if (daysSince !== null) {
    // Limpieza muy antigua → 'important'
    state = 'important';
  } else {
    // Caso edge: daysSince es null pero lastEffectiveCleanAt no es null
    state = 'never';
  }
  
  // ============================================================================
  // DIAGNÓSTICO FORENSE: Logs temporales para identificar punto exacto del 500
  // ============================================================================
  // Log forense para RESET_RECURRENTE_V1 (solo si hay reset)
  if (hasReset) {
    console.log('[FORENSIC][CPM][RESET_RECURRENTE_V1] Estado calculado tras reset', {
      state,
      days_since: daysSince,
      has_clean_after_reset: lastEffectiveCleanAt !== null,
      last_effective_clean_at: lastEffectiveCleanAt,
      effective_since: effectiveSince,
      last_cleaned_at: lastCleanedAt,
      calculated_last_effective_clean: lastEffectiveCleanAt,
      days_since_type: typeof daysSince,
      days_since_value: daysSince
    });
  }
  
  // RESET_RECURRENTE_V1: Validación de fechas inválidas (mantener para robustez)
  if (hasReset && lastCleanedAt && effectiveSince) {
    try {
      const lastCleanedDate = new Date(lastCleanedAt);
      const effectiveSinceDate = new Date(effectiveSince);
      if (isNaN(lastCleanedDate.getTime()) || isNaN(effectiveSinceDate.getTime())) {
        // Log estructurado solo si hay error real
        console.error('[CPM][RESET_RECURRENTE_V1][ERROR] Fechas inválidas detectadas', {
          last_cleaned_at: lastCleanedAt,
          effective_since: effectiveSince
        });
      }
    } catch (dateError) {
      console.error('[CPM][RESET_RECURRENTE_V1][ERROR] Error parseando fechas', {
        error: dateError.message,
        last_cleaned_at: lastCleanedAt,
        effective_since: effectiveSince
      });
    }
  }
  
  return {
    state,
    visual_state: state,
    days_since: daysSince,
    metrics: {
      days_since_last_clean: daysSince,
      threshold_days,
      critical_threshold: criticalThreshold,
      last_cleaned_at: lastCleanedAt,
      effective_since: effectiveSince,
      last_effective_clean_at: lastEffectiveCleanAt
    }
  };
}

/**
 * Calcula estado para UNA_VEZ
 * 
 * REGLAS:
 * - NO tiene reset
 * - NO tiene effective_since
 * - Estados:
 *   - never: completed === 0 AND no override
 *   - pending: completed < required_count
 *   - reviewed: completed >= required_count
 * - important NO EXISTE
 */
function computeUnaVezState({ view_layer, required_count, shared, pde }) {
  // Calcular combo internamente (NO duplicado)
  let cleanCount;
  let remaining;
  let completed;
  
  if (view_layer === 'combo') {
    // COMBO: suma shared + pde
    const sharedCount = shared?.clean_count ?? 0;
    const pdeCount = pde?.clean_count ?? 0;
    cleanCount = sharedCount + pdeCount;
    remaining = Math.max(0, required_count - cleanCount);
    completed = cleanCount >= required_count ? 1 : 0;
  } else if (view_layer === 'pde') {
    cleanCount = pde?.clean_count ?? 0;
    remaining = pde?.remaining ?? null;
    completed = pde?.completed ?? 0;
  } else {
    // view_layer === 'shared' (default)
    cleanCount = shared?.clean_count ?? 0;
    remaining = shared?.remaining ?? null;
    completed = shared?.completed ?? 0;
  }
  
  // REGLA: never = completed === 0 (sin override)
  // REGLA: pending = completed < required_count
  // REGLA: reviewed = completed >= required_count
  let state;
  let visualState;
  
  if (cleanCount === 0) {
    visualState = 'never';
    state = 'pending'; // UNA_VEZ siempre retorna 'pending' cuando cleanCount=0
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
    metrics: {
      clean_count: cleanCount,
      remaining,
      completed,
      required_count
    }
  };
}

/**
 * Cleaning Projection Model (CPM) v2 - Función canónica
 * 
 * @param {Object} params - Parámetros
 * @param {Object} params.cleaning_state - Estado bruto desde cleaning_item_state
 *   - shared: { last_cleaned_at, effective_since, clean_count, remaining, completed }
 *   - pde: { last_cleaned_at, effective_since, clean_count, remaining, completed }
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
 */
export function computeCleaningProjection({ cleaning_state, item_kind, view_layer, config }) {
  // Validar view_layer
  validateViewLayer(view_layer);
  
  // Validar coherencia view_layer + item_kind
  validateViewLayerItemKindCoherence(view_layer, item_kind);
  
  // Calcular state_by_view_layer para todas las view_layers posibles
  const stateByViewLayer = {
    shared: computeEffectiveState({
      item_kind,
      view_layer: 'shared',
      item_config: config,
      cleaning_state
    }),
    pde: computeEffectiveState({
      item_kind,
      view_layer: 'pde',
      item_config: config,
      cleaning_state
    })
  };
  
  // combo solo para una_vez
  if (item_kind === 'una_vez') {
    stateByViewLayer.combo = computeEffectiveState({
      item_kind,
      view_layer: 'combo',
      item_config: config,
      cleaning_state
    });
  }
  
  // MAJOR-1 FIX: effective SIEMPRE para recurrente (OBLIGATORIO)
  // REGLA CONSTITUCIONAL: Backend garantiza state_by_view_layer.effective SIEMPRE que item_kind === 'recurrente'
  if (item_kind === 'recurrente') {
    stateByViewLayer.effective = computeEffectiveState({
      item_kind,
      view_layer: 'effective',
      item_config: config,
      cleaning_state
    });
    
    // VALIDACIÓN FAIL-FAST: Si effective no se calculó, lanzar error explícito
    if (!stateByViewLayer.effective) {
      throw new Error(`[MAJOR-1] state_by_view_layer.effective no se calculó para item_kind='recurrente'. Esto viola View Authority v1.`);
    }
  }
  
  // Estado activo según view_layer solicitada
  const stateActive = stateByViewLayer[view_layer];
  
  if (!stateActive) {
    throw new Error(`view_layer '${view_layer}' no está disponible para item_kind '${item_kind}'`);
  }
  
  // MAJOR-1 FIX: Validación final - effective DEBE existir para recurrente
  if (item_kind === 'recurrente' && !stateByViewLayer.effective) {
    throw new Error(`[MAJOR-1] state_by_view_layer.effective es OBLIGATORIO para item_kind='recurrente' pero falta en la respuesta.`);
  }
  
  return {
    state_by_view_layer: stateByViewLayer,
    state_active: stateActive.state || 'never',
    visual_state_active: stateActive.visual_state || 'never'
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
 * @param {Object} params.combo - Datos combo (opcional, se calcula internamente si no viene)
 * @param {string} params.item_kind - Tipo de item
 * @param {string} params.view_layer - Capa de vista
 * @param {Object} params.config - Configuración
 * @returns {Object} { state, visual_state, computed_state }
 */
export function computeVisualState({ shared, pde, combo, item_kind, view_layer, config }) {
  // Construir cleaning_state desde parámetros legacy
  // NOTA: combo se calcula internamente en CPM v2, pero se acepta por compatibilidad
  const cleaning_state = {
    shared: shared || {},
    pde: pde || {},
    combo: combo || {} // Se ignora en CPM v2 (se calcula internamente)
  };
  
  // Usar CPM v2 para calcular proyección
  const projection = computeCleaningProjection({
    cleaning_state,
    item_kind,
    view_layer,
    config
  });
  
  // Retornar formato legacy
  const result = projection.state_by_view_layer[view_layer];
  
  // Formato legacy: computed_state debe incluir metrics
  return {
    state: result.state,
    visual_state: result.visual_state,
    computed_state: {
      view_layer,
      ...result.metrics
    }
  };
}
