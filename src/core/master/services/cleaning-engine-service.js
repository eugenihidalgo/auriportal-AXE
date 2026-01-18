// src/core/master/services/cleaning-engine-service.js
// Cleaning Engine v1 - Single Decider para limpiezas (UUID-only)
//
// RESPONSABILIDADES:
// - Validar inputs (item_ref existente, item tipo, required_count para una_vez, etc.)
// - Resolver alumno paused (y excluir)
// - Insert event (idempotente)
// - Aplicar a proyección cleaning_item_state
// - Emitir señales (fail-open)
//
// REGLAS CONSTITUCIONALES:
// - PostgreSQL es el único Source of Truth
// - Cleaning Engine es el único decisor de estado de limpieza
// - UI solo muestra, no decide
// - Exclusión obligatoria de alumnos en PAUSA
// - Idempotencia vía execution_key
// - UUID-only: NO se resuelve legacy_alumno_id, NO se sincroniza student_item_state

import { getDefaultCleaningEventsRepo } from '../../../infra/repos/cleaning/cleaning-events-repo-pg.js';
import { getDefaultCleaningItemStateRepo } from '../../../infra/repos/cleaning/cleaning-item-state-repo-pg.js';
import { getDefaultPausaRepo } from '../../../infra/repos/pausa-repo-pg.js';
import { getDefaultAlquimiaCatalogRepo } from '../../../infra/repos/alquimia-catalog-repo-pg.js';
import { getDefaultMasterStudentTransmutationReadRepo } from '../../../infra/repos/master-student-transmutation-read-repo-pg.js';
import { getDefaultStudentLevelStateRepo } from '../../../infra/repos/levels/student-level-state-repo-pg.js';
import { getRequestId } from '../../observability/request-context.js';
import { logError, logInfo, logWarn } from '../../observability/logger.js';
import { randomUUID } from 'crypto';
import { validateCleanLayer, validateCleanLayerNotCombo } from './cleaning-layer-constants.js';
import { dispatchSignal } from '../../signals/signal-dispatcher.js';

/**
 * Genera execution_key para idempotencia (APPLY) o certificación (CERTIFY)
 * 
 * REGLA CANÓNICA: Idempotencia por clean_layer en RECURRENTE
 * - RECURRENTE: {action_type}:{item_ref}:{student_uuid}:{clean_layer}:{timestamp_day}
 * - UNA_VEZ: {action_type}:{item_ref}:{student_uuid}:{timestamp_day} (sin clean_layer, combo suma)
 * - RESET: {action_type}:{item_ref}:{student_uuid}:{clean_layer}:{timestamp_day} (siempre incluye capa)
 * 
 * APPLY: Formato idempotente (por día y capa para RECURRENTE y RESET)
 * CERTIFY: Formato no idempotente (timestamp completo)
 * 
 * @param {string} actionType - Tipo de acción ('mark_clean', 'reset', etc.)
 * @param {string} itemRef - Referencia del item
 * @param {string} studentUuid - UUID del estudiante
 * @param {Date} timestamp - Timestamp
 * @param {string} executionMode - 'APPLY' (idempotente) o 'CERTIFY' (no idempotente)
 * @param {string} itemKind - 'recurrente' | 'una_vez'
 * @param {string} cleanLayer - 'shared' | 'pde' (solo para RECURRENTE y RESET)
 * @returns {string} execution_key
 */
function generateExecutionKey(actionType, itemRef, studentUuid, timestamp = new Date(), executionMode = 'APPLY', itemKind = null, cleanLayer = null) {
  if (executionMode === 'CERTIFY') {
    // CERTIFY: usar timestamp completo para garantizar unicidad (no idempotente)
    const timestampStr = timestamp.toISOString().replace(/[:.]/g, '-'); // ISO8601 sin caracteres problemáticos
    return `certify:${itemRef}:${studentUuid}:${timestampStr}`;
  }
  // APPLY: usar día para idempotencia
  const day = timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // REGLA CANÓNICA: RESET siempre incluye clean_layer (reset por capa es independiente)
  if (actionType === 'reset' && cleanLayer) {
    return `${actionType}:${itemRef}:${studentUuid}:${cleanLayer}:${day}`;
  }
  
  // REGLA CANÓNICA: RECURRENTE incluye clean_layer en execution_key
  // Esto permite que SHARED y PDE sean independientes (pueden limpiarse el mismo día)
  if (itemKind === 'recurrente' && cleanLayer) {
    return `${actionType}:${itemRef}:${studentUuid}:${cleanLayer}:${day}`;
  }
  
  // UNA_VEZ: no incluye clean_layer (combo suma shared + pde)
  return `${actionType}:${itemRef}:${studentUuid}:${day}`;
}

/**
 * Verifica si un alumno está en pausa
 * 
 * @param {string} studentUuid - UUID canónico del estudiante
 * @returns {Promise<boolean>} true si está en pausa
 */
async function isStudentPaused(studentUuid) {
  if (!studentUuid) return false;
  
  try {
    // UUID-ONLY: pausas.student_id ahora es UUID, usar directamente
    const pausaRepo = getDefaultPausaRepo();
    const pausaActiva = await pausaRepo.getPausaActiva(studentUuid);
    return !!pausaActiva;
  } catch (error) {
    logWarn('MASTER', 'Error verificando pausa (fail-open: no pausado)', {
      student_uuid: studentUuid,
      error: error.message
    });
    // Fail-open: si no se puede verificar, asumir no pausado
    return false;
  }
}

/**
 * Obtiene nivel efectivo del alumno desde Level Engine
 * 
 * @param {string} studentUuid - UUID canónico del estudiante
 * @param {string} lineKey - Clave de línea (default: 'pde')
 * @returns {Promise<number>} Nivel efectivo (default: 1 si no existe)
 */
export async function getStudentEffectiveLevel(studentUuid, lineKey = 'pde') {
  if (!studentUuid) return 1;
  
  try {
    // Obtener estado desde Level Engine directamente con UUID
    const levelStateRepo = getDefaultStudentLevelStateRepo();
    const state = await levelStateRepo.getByStudentAndLine(studentUuid, lineKey);
    
    if (!state || !state.current_level_number) {
      return 1; // Default nivel 1
    }
    
    return state.current_level_number;
  } catch (error) {
    logWarn('MASTER', 'Error obteniendo nivel efectivo (fail-open: nivel 1)', {
      student_uuid: studentUuid,
      error: error.message
    });
    // Fail-open: si no se puede obtener, usar nivel 1
    return 1;
  }
}

// ============================================================================
// UUID-ONLY: syncToStudentItemState() ELIMINADA COMPLETAMENTE
// ============================================================================
// REGLA CONSTITUCIONAL: Alquimia es UUID-only, NO se sincroniza student_item_state
// student_item_state es tabla histórica, no se usa en runtime
// ============================================================================

/**
 * Obtiene el último evento RESET para un item+student+layer
 * REGLA CONSTITUCIONAL: RESET es frontera dura de estado
 * 
 * @param {string} studentUuid - UUID canónico del estudiante
 * @param {string} itemRef - Referencia del item
 * @param {string} cleanLayer - Capa de limpieza ('shared' | 'pde')
 * @param {string} productKey - Clave del producto (default: 'pde')
 * @param {string} domainType - Tipo de dominio (default: 'transmutation')
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object|null>} Último evento RESET o null si no existe
 */
async function getLastResetForItem(studentUuid, itemRef, cleanLayer, productKey = 'pde', domainType = 'transmutation', client = null) {
  try {
    const eventsRepo = getDefaultCleaningEventsRepo();
    const events = await eventsRepo.listEventsForStudentItem({
      student_uuid: studentUuid,
      item_ref: itemRef,
      product_key: productKey,
      domain_type: domainType
    }, client);
    
    // Filtrar solo eventos RESET para esta capa, ordenar por fecha DESC
    const resetEvents = events
      .filter(e => e.action_type === 'reset' && e.clean_layer === cleanLayer)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    return resetEvents[0] || null;
  } catch (error) {
    logWarn('MASTER', 'Error obteniendo último RESET (fail-open: no reset)', {
      student_uuid: studentUuid,
      item_ref: itemRef,
      clean_layer: cleanLayer,
      error: error.message
    });
    // Fail-open: si no se puede obtener, asumir no reset
    return null;
  }
}

/**
 * Reconstruye el estado de cleaning_item_state desde el último RESET
 * REGLA CONSTITUCIONAL: RESET es frontera dura de estado
 * 
 * @param {string} studentUuid - UUID canónico del estudiante
 * @param {string} itemRef - Referencia del item
 * @param {string} cleanLayer - Capa de limpieza ('shared' | 'pde')
 * @param {Object} lastReset - Último evento RESET
 * @param {string} productKey - Clave del producto (default: 'pde')
 * @param {string} domainType - Tipo de dominio (default: 'transmutation')
 * @param {string} traceId - Trace ID para logs
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @param {Object} [currentCleanEvent] - Evento de limpieza actual (si se está ejecutando un CLEAN)
 * @returns {Promise<Object|null>} Estado reconstruido o null si falla
 */
async function rebaseStateFromReset(studentUuid, itemRef, cleanLayer, lastReset, productKey = 'pde', domainType = 'transmutation', traceId, client = null, currentCleanEvent = null) {
  try {
    const eventsRepo = getDefaultCleaningEventsRepo();
    const stateRepo = getDefaultCleaningItemStateRepo();
    const resetAt = new Date(lastReset.created_at);
    
    // ========================================================================
    // DIAG FORENSE: REBASE INPUT
    // ========================================================================
    const resetEffectiveSince = resetAt.toISOString();
    const currentCleanEventTimestamp = currentCleanEvent ? (currentCleanEvent.created_at ? new Date(currentCleanEvent.created_at).toISOString() : null) : null;
    const cleanEventDate = currentCleanEvent ? new Date(currentCleanEvent.created_at || new Date()) : null;
    const comparison = currentCleanEvent && cleanEventDate ? {
      currentCleanEvent_timestamp: currentCleanEventTimestamp,
      reset_effective_since: resetEffectiveSince,
      comparison_result: cleanEventDate >= resetAt,
      diff_ms: cleanEventDate.getTime() - resetAt.getTime()
    } : null;
    
    // Obtener todos los eventos posteriores al RESET
    const allEvents = await eventsRepo.listEventsForStudentItem({
      student_uuid: studentUuid,
      item_ref: itemRef,
      product_key: productKey,
      domain_type: domainType
    }, client);
    
    // Resumir eventos antes del merge para logs
    const eventsBeforeRebase = allEvents
      .filter(e => e.action_type === 'mark_clean' && e.clean_layer === cleanLayer)
      .map(e => ({
        id: e.id || e.execution_key,
        action_type: e.action_type,
        clean_layer: e.clean_layer,
        created_at: e.created_at ? new Date(e.created_at).toISOString() : null,
        execution_key: e.execution_key
      }))
      .slice(0, 10); // Primeros 10 para no saturar logs
    
    console.log('[DIAG][REBASE][INPUT]', {
      phase: 'REBASE_INPUT',
      trace_id: traceId,
      student_uuid: studentUuid,
      item_ref: itemRef,
      clean_layer: cleanLayer,
      reset_effective_since: resetEffectiveSince,
      currentCleanEvent_provided: !!currentCleanEvent,
      currentCleanEvent_timestamp: currentCleanEventTimestamp,
      comparison: comparison,
      events_before_rebase: {
        total_events: allEvents.length,
        clean_events_count: allEvents.filter(e => e.action_type === 'mark_clean' && e.clean_layer === cleanLayer).length,
        events_summary: eventsBeforeRebase
      },
      timestamp: new Date().toISOString()
    });
    
    // FIX: Incluir evento de limpieza actual si se está ejecutando un CLEAN post-RESET
    // Esto asegura que el evento recién insertado se considere aunque tenga created_at igual o muy cercano al resetAt
    let wasCurrentCleanEventIncluded = false;
    let reasonIfExcluded = null;
    
    if (currentCleanEvent) {
      // Solo incluir si es posterior o igual al reset (>= para incluir eventos en el mismo momento)
      if (cleanEventDate >= resetAt) {
        allEvents.push(currentCleanEvent);
        wasCurrentCleanEventIncluded = true;
      } else {
        reasonIfExcluded = `currentCleanEvent.timestamp (${currentCleanEventTimestamp}) < reset_effective_since (${resetEffectiveSince})`;
      }
    }
    
    // Filtrar limpiezas posteriores o iguales al RESET para esta capa
    // FIX: Usar >= en lugar de > para incluir eventos que ocurren en el mismo momento que el reset
    const cleansAfterReset = allEvents
      .filter(e => 
        e.action_type === 'mark_clean' && 
        e.clean_layer === cleanLayer &&
        new Date(e.created_at) >= resetAt
      )
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    // ========================================================================
    // DIAG FORENSE: REBASE MERGE
    // ========================================================================
    const eventsConsidered = cleansAfterReset.map(e => ({
      id: e.id || e.execution_key,
      execution_key: e.execution_key,
      created_at: e.created_at ? new Date(e.created_at).toISOString() : null,
      is_current_clean_event: currentCleanEvent && e.execution_key === currentCleanEvent.execution_key
    }));
    
    const wasCurrentCleanEventIncludedInFilter = currentCleanEvent ? 
      cleansAfterReset.some(e => e.execution_key === currentCleanEvent.execution_key) : 
      false;
    
    console.log('[DIAG][REBASE][MERGE]', {
      phase: 'REBASE_MERGE',
      trace_id: traceId,
      student_uuid: studentUuid,
      item_ref: itemRef,
      clean_layer: cleanLayer,
      reset_effective_since: resetEffectiveSince,
      currentCleanEvent_provided: !!currentCleanEvent,
      currentCleanEvent_timestamp: currentCleanEventTimestamp,
      was_current_clean_event_included: wasCurrentCleanEventIncluded,
      was_current_clean_event_included_in_filter: wasCurrentCleanEventIncludedInFilter,
      reason_if_excluded: reasonIfExcluded,
      events_considered: {
        count: eventsConsidered.length,
        events: eventsConsidered
      },
      filter_applied: 'action_type === "mark_clean" && clean_layer === cleanLayer && created_at >= resetAt',
      timestamp: new Date().toISOString()
    });
    
    // Reconstruir estado desde RESET
    const effectiveSince = resetAt;
    const lastCleanedAt = cleansAfterReset.length > 0 
      ? new Date(cleansAfterReset[cleansAfterReset.length - 1].created_at)
      : null;
    const cleanCount = cleansAfterReset.length;
    
    // Aplicar reset canónico que establece effective_since y resetea contadores
    // Luego ajustar last_cleaned_at y clean_count si hay limpiezas post-reset
    const effectiveColumn = cleanLayer === 'shared' ? 'shared_effective_since' : 'pde_effective_since';
    const lastCleanedColumn = cleanLayer === 'shared' ? 'shared_last_cleaned_at' : 'pde_last_cleaned_at';
    const countColumn = cleanLayer === 'shared' ? 'shared_clean_count' : 'pde_clean_count';
    
    // 1. Aplicar reset canónico (SOLO effective_since según RESET CANÓNICO v1)
    // REGLA CONSTITUCIONAL: Reset SOLO modifica effective_since
    // Los contadores se calcularán desde eventos post-RESET a continuación
    await stateRepo.upsertApplyReset({
      student_uuid: studentUuid,
      item_ref: itemRef,
      clean_layer: cleanLayer,
      reset_at: resetAt, // Usar reset.created_at (no NOW())
      product_key: productKey,
      domain_type: domainType
    }, client);

    // 2. Ajustar contadores desde eventos post-RESET (rebase canónico)
    const { query } = await import('../../../../database/pg.js');
    const queryFn = client ? client.query.bind(client) : query;
    
    await queryFn(`
      UPDATE cleaning_item_state
      SET ${effectiveColumn} = $1,
          ${lastCleanedColumn} = $2,
          ${countColumn} = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE student_id = $4
        AND product_key = $5
        AND domain_type = $6
        AND item_ref = $7
    `, [
      effectiveSince,
      lastCleanedAt,
      cleanCount,
      studentUuid,
      productKey,
      domainType,
      itemRef
    ]);
    
    // 3. Obtener estado reconstruido
    const rebasedState = await stateRepo.getState({
      student_uuid: studentUuid,
      item_ref: itemRef,
      product_key: productKey,
      domain_type: domainType
    }, client);
    
    // ========================================================================
    // DIAG FORENSE: REBASE OUTPUT
    // ========================================================================
    // Reutilizar variables ya declaradas (línea 316-318)
    // effectiveColumn, lastCleanedColumn, countColumn ya están declaradas
    
    const resultingLastCleanedAt = rebasedState?.[lastCleanedColumn] ? new Date(rebasedState[lastCleanedColumn]).toISOString() : null;
    const resultingEffectiveSince = rebasedState?.[effectiveColumn] ? new Date(rebasedState[effectiveColumn]).toISOString() : null;
    const resultingCleanCount = rebasedState?.[countColumn] || 0;
    
    console.log('[DIAG][REBASE][OUTPUT]', {
      phase: 'REBASE_OUTPUT',
      trace_id: traceId,
      student_uuid: studentUuid,
      item_ref: itemRef,
      clean_layer: cleanLayer,
      reset_effective_since: resetEffectiveSince,
      currentCleanEvent_timestamp: currentCleanEventTimestamp,
      resulting_last_cleaned_at: resultingLastCleanedAt,
      resulting_effective_since: resultingEffectiveSince,
      resulting_clean_count: resultingCleanCount,
      resulting_state_basis: {
        has_last_cleaned_at: !!resultingLastCleanedAt,
        has_effective_since: !!resultingEffectiveSince,
        last_cleaned_at_after_reset: resultingLastCleanedAt && resultingEffectiveSince ? 
          new Date(resultingLastCleanedAt) >= new Date(resultingEffectiveSince) : null,
        clean_count: resultingCleanCount
      },
      events_used_count: cleansAfterReset.length,
      was_current_clean_event_used: wasCurrentCleanEventIncludedInFilter,
      timestamp: new Date().toISOString()
    });
    
    return rebasedState;
  } catch (error) {
    logError('MASTER', 'Error reconstruyendo estado desde RESET', {
      traceId,
      student_uuid: studentUuid,
      item_ref: itemRef,
      clean_layer: cleanLayer,
      reset_at: lastReset.created_at,
      error: error.message,
      stack: error.stack
    });
    // Fail-open: si falla reconstrucción, continuar (pero loggear error)
    return null;
  }
}

/**
 * Verifica si el estado de limpieza es coherente con el evento existente.
 * 
 * FIX 1: Helper para verificación de coherencia evento ↔ estado
 * Similar a la lógica de reset pero para limpieza.
 * 
 * @param {Object} params - Parámetros
 * @param {Object} params.currentState - Estado actual de cleaning_item_state
 * @param {Object} params.event - Evento existente de cleaning_events
 * @param {string} params.itemKind - 'recurrente' | 'una_vez'
 * @param {string} params.clean_layer - 'shared' | 'pde'
 * @param {Date} params.cleanedAt - Fecha de la limpieza esperada
 * @returns {boolean} true si el estado es coherente con el evento
 */
function isCleanStateCoherent({ currentState, event, itemKind, clean_layer, cleanedAt }) {
  if (!event || !currentState) {
    // Sin evento o estado → no coherente (permitir aplicar)
    return false;
  }
  
  const eventCreatedAt = event.created_at ? new Date(event.created_at) : new Date();
  
  if (itemKind === 'recurrente') {
    // RECURRENTE: Verificar que last_cleaned_at >= event.created_at
    const lastCleanedColumn = clean_layer === 'shared' ? 'shared_last_cleaned_at' : 'pde_last_cleaned_at';
    const countColumn = clean_layer === 'shared' ? 'shared_clean_count' : 'pde_clean_count';
    
    const currentLastCleaned = currentState[lastCleanedColumn] ? new Date(currentState[lastCleanedColumn]) : null;
    const currentCount = currentState[countColumn] || 0;
    
    // Coherente si:
    // - last_cleaned_at existe y es >= event.created_at
    // - O si el estado está reseteado (effective_since presente y last_cleaned_at null después del reset)
    const effectiveColumn = clean_layer === 'shared' ? 'shared_effective_since' : 'pde_effective_since';
    const currentEffective = currentState[effectiveColumn] ? new Date(currentState[effectiveColumn]) : null;
    
    if (currentEffective && currentEffective >= eventCreatedAt) {
      // Hay un reset posterior al evento, verificar que last_cleaned_at es posterior al reset o null
      if (currentLastCleaned && currentLastCleaned >= currentEffective) {
        // Limpieza posterior al reset → coherente
        return true;
      } else if (!currentLastCleaned && currentCount === 0) {
        // Sin limpieza después del reset y count=0 → coherente (reset aplicado pero sin limpieza aún)
        return true;
      } else {
        // Incoherente: estado mezclado
        return false;
      }
    } else {
      // No hay reset posterior, verificar que last_cleaned_at >= event.created_at
      if (currentLastCleaned && currentLastCleaned >= eventCreatedAt) {
        // Limpieza aplicada correctamente → coherente
        return true;
      } else {
        // Incoherente: evento existe pero estado no refleja la limpieza
        return false;
      }
    }
  } else {
    // UNA_VEZ: Verificar que completed/remaining reflejan el evento
    const deltaCompleted = event.delta_completed || 0;
    const currentCompleted = currentState.shared_completed || 0;
    const currentRemaining = currentState.shared_remaining ?? null;
    
    // Coherente si el estado refleja que la acción se aplicó
    // (completed incrementado o remaining reducido)
    if (deltaCompleted > 0) {
      // Evento incrementa completed → verificar que completed >= expected
      const expectedCompleted = (currentCompleted - deltaCompleted >= 0) ? currentCompleted : deltaCompleted;
      return currentCompleted >= expectedCompleted;
    } else {
      // Sin cambio esperado en completed → considerar coherente si el estado es razonable
      return true;
    }
  }
}

/**
 * Marca limpio un alumno específico (recurrente o una_vez)
 * 
 * @param {Object} options - Opciones
 * @param {string} options.student_uuid - UUID canónico del estudiante (CAMBIADO: ahora acepta UUID)
 * @param {string} options.item_ref - Referencia del item
 * @param {string} [options.clean_layer='shared'] - Capa de limpieza ('shared' | 'pde')
 * @param {string} [options.product_key='pde'] - Clave del producto
 * @param {string} [options.domain_type='transmutation'] - Tipo de dominio
 * @param {string} options.actor_type - Tipo de actor ('master' | 'student' | 'automation')
 * @param {string} [options.actor_ref] - Referencia del actor
 * @param {string} [options.surface_key] - Superficie de origen
 * @param {number|null} [options.level_cap_override] - Override de cap de nivel (solo Master en alquimia_alumno)
 * @param {Object} [options.meta={}] - Metadatos adicionales
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object|null>} Estado actualizado o null si está pausado/no aplica
 */
export async function markCleanStudent(options, client = null) {
  const traceId = getRequestId();
  // #region agent log
  const logEntry = {location:'cleaning-engine-service.js:391',message:'markCleanStudent ENTRY',data:{student_uuid:options?.student_uuid,item_ref:options?.item_ref,item_kind:options?.item_kind,clean_layer:options?.clean_layer},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'}; console.log('[DEBUG]',JSON.stringify(logEntry));
  // #endregion
  
  // ========================================================================
  // FASE C - DIAG FORENSE: Cleaning Engine ENTRY
  // ========================================================================
  console.log('[DIAG][ENGINE][ENTRY]', {
    phase: 'FASE_C_ENGINE_ENTRY',
    trace_id: traceId,
    student_uuid: options?.student_uuid,
    item_ref: options?.item_ref,
    item_kind: options?.item_kind,
    clean_layer: options?.clean_layer,
    execution_mode: options?.execution_mode || 'APPLY',
    timestamp: new Date().toISOString()
  });
  
  const {
    student_uuid, // CAMBIADO: ahora acepta UUID canónico
    item_ref,
    item_kind, // OBLIGATORIO según CONTRATO LIMPIEZA v1
    clean_layer = 'shared',
    product_key = 'pde',
    domain_type = 'transmutation',
    actor_type,
    actor_ref = null,
    surface_key = null,
    level_cap_override = null,
    execution_mode = 'APPLY', // Nuevo: 'APPLY' (idempotente) o 'CERTIFY' (no idempotente)
    meta = {}
  } = options;
  
    logInfo('MASTER', '[CLEAN][WRITE] markCleanStudent entrada', {
      traceId,
      student_uuid,
      item_ref,
      item_kind,
      clean_layer,
      product_key,
      actor_type,
      surface_key
    });
  
  // ============================================================================
  // GUARD CONSTITUCIONAL: UUID-only Alquimia
  // ============================================================================
  // PROHIBIDO: usar legacy_alumno_id en runtime de Alquimia
  if (options.legacy_alumno_id || options.student_id) {
    const error = new Error('LEGACY alumno_id is forbidden in UUID-only Alquimia runtime');
    error.code = 'LEGACY_ALUMNO_ID_FORBIDDEN';
    logError('MASTER', 'Intento de usar legacy_alumno_id en runtime UUID-only', {
      traceId,
      student_uuid,
      legacy_alumno_id: options.legacy_alumno_id,
      student_id: options.student_id
    });
    throw error;
  }
  // ============================================================================

  // Validar campos requeridos según contrato canónico
  if (!student_uuid || !item_ref || !actor_type || !item_kind || !surface_key) {
    const missing = [];
    if (!student_uuid) missing.push('student_uuid');
    if (!item_ref) missing.push('item_ref');
    if (!actor_type) missing.push('actor_type');
    if (!item_kind) missing.push('item_kind');
    if (!surface_key) missing.push('surface_key');
    throw new Error(`Campos requeridos faltantes: ${missing.join(', ')}`);
  }
  
  // ============================================================================
  // REGLA CONSTITUCIONAL: clean_layer es OBLIGATORIO y válido
  // ============================================================================
  if (!clean_layer) {
    throw new Error('clean_layer is required. It determines which columns to write in cleaning_item_state.');
  }
  
  // Validar que clean_layer sea válido
  validateCleanLayer(clean_layer);
  
  // Validar que clean_layer NO sea 'combo' (combo es SOLO view_layer)
  validateCleanLayerNotCombo(clean_layer);
  
  // Validar item_kind (OBLIGATORIO según CONTRATO LIMPIEZA v1)
  if (item_kind !== 'recurrente' && item_kind !== 'una_vez') {
    throw new Error('item_kind es requerido y debe ser "recurrente" o "una_vez"');
  }
  
  // Validar formato UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(student_uuid)) {
    throw new Error(`student_uuid debe ser un UUID válido: ${student_uuid}`);
  }
  
  try {
    // 1. Verificar si alumno está en pausa (UUID-only)
    const isPaused = await isStudentPaused(student_uuid);
    if (isPaused) {
      logInfo('MASTER', 'Alumno en pausa, excluido', {
        traceId,
        student_uuid,
        item_ref
      });
      return null;
    }
    
    // 2. Obtener item para validar y conocer tipo
    const catalogRepo = getDefaultAlquimiaCatalogRepo();
    const item = await catalogRepo.getItemByRef(item_ref);
    
    if (!item) {
      throw new Error(`Item no encontrado: ${item_ref}`);
    }
    
    // 3. Verificar nivel (si item tiene nivel > nivel_efectivo, no aplica)
    // REGLA CONSTITUCIONAL: MASTER no está sujeto a restricciones de nivel
    // EXCEPCIÓN: Master Override en alquimia_alumno (guards estrictos)
    const isMasterContext = actor_type === 'master';
    const nivelEfectivo = await getStudentEffectiveLevel(student_uuid);
    let nivelCapAplicar = nivelEfectivo;
    let overrideAplicado = false;
    
    // Si es Master, NO validar nivel (bypass completo) - REGLA CONSTITUCIONAL
    if (!isMasterContext) {
      // Guards estrictos para Master Override en alquimia_alumno:
      // - actor_type === 'master'
      // - surface_key === 'master.alquimia_alumno'
      // - level_cap_override is not null
      if (level_cap_override !== null && 
          actor_type === 'master' && 
          surface_key === 'master.alquimia_alumno') {
        nivelCapAplicar = parseInt(level_cap_override, 10);
        if (isNaN(nivelCapAplicar) || nivelCapAplicar < 1) {
          nivelCapAplicar = 999; // Fallback a infinito
        }
        overrideAplicado = true;
        logInfo('MASTER', 'Master Override aplicado (level_cap_override)', {
          traceId,
          student_uuid,
          item_ref,
          item_nivel: item.nivel,
          nivel_efectivo: nivelEfectivo,
          level_cap_override: nivelCapAplicar
        });
      }
      
      // Validar nivel solo si NO es Master desde alquimia_general
      if (item.nivel && item.nivel > nivelCapAplicar) {
        logInfo('MASTER', 'Item no aplica por nivel', {
          traceId,
          student_uuid,
          item_ref,
          item_nivel: item.nivel,
          nivel_efectivo: nivelEfectivo,
          nivel_cap_aplicar: nivelCapAplicar,
          override_aplicado: overrideAplicado
        });
        return null; // No aplica, pero no es error
      }
    } else {
      // Log forense: MASTER bypass de validación de nivel
      logInfo('MASTER', '[MASTER][CLEANING] Nivel ignorado por autoridad MASTER', {
        traceId,
        student_uuid,
        item_ref,
        item_nivel: item.nivel,
        nivel_efectivo: nivelEfectivo,
        actor_type,
        surface_key
      });
    }
    
    // 4. Verificar coherencia con lista (validación adicional, no inferencia)
    const lista = await catalogRepo.getListaById(item.lista_id);
    if (!lista) {
      throw new Error(`Lista no encontrada para item: ${item_ref}`);
    }
    
    // REGLA CONSTITUCIONAL: item_kind DEBE coincidir con lista.tipo
    // NO se permite inferencia ni fallback
    if (item_kind !== lista.tipo) {
      const error = new Error(`item_kind no coincide con lista.tipo: item_kind=${item_kind}, lista.tipo=${lista.tipo}`);
      error.code = 'ITEM_KIND_MISMATCH';
      logError('MASTER', 'item_kind no coincide con lista.tipo (ERROR)', {
        traceId,
        student_uuid,
        item_ref,
        item_kind_provided: item_kind,
        lista_tipo: lista.tipo
      });
      throw error; // Fail-hard: rechazar si no coincide
    }
    
    const itemKind = item_kind; // Usar siempre el proporcionado (sin fallback)
    
    // UUID-ONLY: Ya no se resuelve legacy, usar student_uuid directamente
    
    // 5. REGLA MASTER: Para UNA_VEZ en dominio MASTER, usar CERTIFY para permitir múltiples incrementos
    // En MASTER no hay límite diario para UNA_VEZ (puede sumar varias veces el mismo día)
    const isMasterDomain = actor_type === 'master' && surface_key === 'master.alquimia_general';
    const effectiveExecutionMode = (isMasterDomain && itemKind === 'una_vez' && execution_mode === 'APPLY') 
      ? 'CERTIFY' 
      : execution_mode;
    
    // LOG TEMPORAL: decisión de execution_mode
    if (isMasterDomain && itemKind === 'una_vez') {
      logInfo('MASTER', 'MASTER UNA_VEZ: usando CERTIFY para permitir múltiples incrementos', {
        traceId,
        student_uuid,
        item_ref,
        original_execution_mode: execution_mode,
        effective_execution_mode: effectiveExecutionMode,
        actor_type,
        surface_key
      });
    }
    
    // 6. Generar execution_key (APPLY: idempotente, CERTIFY: no idempotente)
    // REGLA CANÓNICA: RECURRENTE incluye clean_layer para idempotencia por capa
    const executionKey = generateExecutionKey('mark_clean', item_ref, student_uuid, new Date(), effectiveExecutionMode, itemKind, clean_layer);
    
    logInfo('MASTER', '[CLEAN][IDEMPOTENCY] execution_key generado', {
      traceId,
      execution_key: executionKey,
      execution_mode: effectiveExecutionMode,
      student_uuid,
      item_ref,
      item_kind: itemKind,
      clean_layer,
      idempotency_by_layer: itemKind === 'recurrente' ? true : false
    });
    
    // 7. Insertar evento (repositorio resuelve legacy_id internamente)
    const eventsRepo = getDefaultCleaningEventsRepo();
    const eventData = {
      trace_id: traceId,
      execution_key: executionKey,
      student_uuid, // UUID canónico (student_id en tabla ahora es UUID)
      product_key,
      domain_type,
      item_ref,
      clean_layer,
      item_kind: itemKind,
      action_type: 'mark_clean',
      delta_completed: itemKind === 'una_vez' ? 1 : null,
      set_remaining: null,
      actor_type,
      actor_ref,
      surface_key,
      meta: {
        ...meta,
        item_id: item.id,
        lista_id: item.lista_id,
        item_nivel: item.nivel,
        nivel_efectivo: nivelEfectivo,
        ...(overrideAplicado ? {
          level_cap_override_applied: true,
          level_cap_override: nivelCapAplicar
        } : {})
      }
    };
    
    // LOG TEMPORAL: Verificar estado antes de insertar evento
    const stateRepo = getDefaultCleaningItemStateRepo();
    const existingState = await stateRepo.getState({
      student_uuid,
      product_key,
      domain_type,
      item_ref
    }, client);
    
    console.log('[CLEAN][CHECK] Estado antes de insertar evento', {
      student_uuid,
      item_ref,
      action_clean_layer: clean_layer,
      execution_key: executionKey,
      execution_mode: effectiveExecutionMode,
      existing_state: existingState ? {
        shared_last_cleaned_at: existingState.shared_last_cleaned_at,
        pde_last_cleaned_at: existingState.pde_last_cleaned_at,
        shared_clean_count: existingState.shared_clean_count,
        pde_clean_count: existingState.pde_clean_count
      } : null
    });
    
    const eventResult = await eventsRepo.insertEvent(eventData, client);
    
    // ========================================================================
    // FASE C - DIAG FORENSE: WRITE_EVENT
    // ========================================================================
    console.log('[DIAG][ENGINE][WRITE_EVENT]', {
      phase: 'FASE_C_ENGINE_WRITE_EVENT',
      trace_id: traceId,
      student_uuid,
      item_ref,
      item_kind: itemKind,
      clean_layer,
      execution_key: executionKey,
      execution_mode: effectiveExecutionMode,
      event_inserted: eventResult !== 'already_applied' && !(eventResult && eventResult.already_executed),
      event_result: typeof eventResult === 'object' ? {
        already_executed: eventResult.already_executed,
        created_at: eventResult.created_at
      } : eventResult,
      existing_state_before: existingState ? {
        shared_last_cleaned_at: existingState.shared_last_cleaned_at,
        pde_last_cleaned_at: existingState.pde_last_cleaned_at,
        shared_effective_since: existingState.shared_effective_since,
        pde_effective_since: existingState.pde_effective_since
      } : null,
      timestamp: new Date().toISOString()
    });
    
    logInfo('MASTER', 'evento insertado', {
      traceId,
      execution_key: executionKey,
      event_result: eventResult,
      already_executed: eventResult === 'already_applied' || (eventResult && eventResult.already_executed === true),
      student_uuid,
      item_ref,
      clean_layer
    });
    
    // Manejar idempotencia: ya sea 'already_applied' (legacy) o { already_executed: true } (nuevo)
    if (eventResult === 'already_applied' || (eventResult && eventResult.already_executed === true)) {
      // Obtener estado actual para verificar coherencia
      const currentState = existingState || await stateRepo.getState({
        student_uuid,
        product_key,
        domain_type,
        item_ref
      }, client);
      
      // FIX 1: Verificar coherencia evento ↔ estado antes de omitir
      const eventsRepo = getDefaultCleaningEventsRepo();
      const existingEvents = await eventsRepo.listEventsForStudentItem({
        student_uuid,
        item_ref,
        product_key,
        domain_type
      }, client);
      
      const existingCleanEvent = existingEvents.find(e => 
        e.execution_key === executionKey && 
        e.action_type === 'mark_clean' && 
        (itemKind === 'recurrente' ? e.clean_layer === clean_layer : true)
      );
      
      // Log de verificación de coherencia
      logInfo('MASTER', '[CLEAN][IDEMPOTENCY_CHECK] Verificando coherencia evento ↔ estado', {
        traceId,
        execution_key: executionKey,
        student_uuid,
        item_ref,
        item_kind: itemKind,
        clean_layer,
        event_exists: !!existingCleanEvent,
        event_created_at: existingCleanEvent?.created_at,
        current_state: {
          shared_last_cleaned_at: currentState?.shared_last_cleaned_at,
          pde_last_cleaned_at: currentState?.pde_last_cleaned_at,
          shared_clean_count: currentState?.shared_clean_count,
          pde_clean_count: currentState?.pde_clean_count,
          shared_effective_since: currentState?.shared_effective_since,
          pde_effective_since: currentState?.pde_effective_since
        }
      });
      
      // Verificar coherencia del estado con el evento
      const isCoherent = isCleanStateCoherent({
        currentState,
        event: existingCleanEvent,
        itemKind,
        clean_layer,
        cleanedAt: new Date()
      });
      
      if (!isCoherent) {
        // Estado incoherente: aplicar limpieza igualmente (idempotencia override)
        logWarn('MASTER', '[CLEAN][IDEMPOTENCY_OVERRIDE] Evento existe pero estado incoherente, aplicando limpieza', {
          traceId,
          execution_key: executionKey,
          student_uuid,
          item_ref,
          item_kind: itemKind,
          clean_layer,
          current_state: {
            shared_last_cleaned_at: currentState?.shared_last_cleaned_at,
            pde_last_cleaned_at: currentState?.pde_last_cleaned_at,
            shared_clean_count: currentState?.shared_clean_count,
            pde_clean_count: currentState?.pde_clean_count
          },
          event_created_at: existingCleanEvent?.created_at
        });
        // Continuar para aplicar limpieza (no retornar estado antiguo)
      } else {
        // Estado coherente: omitir correctamente
        // Calcular days_since_last_clean de la capa correspondiente
        let daysSinceLastClean = null;
        if (itemKind === 'recurrente') {
          if (clean_layer === 'shared') {
            daysSinceLastClean = currentState?.shared_days_since_last_clean ?? null;
          } else if (clean_layer === 'pde') {
            daysSinceLastClean = currentState?.pde_days_since_last_clean ?? null;
          }
        }
        
        logInfo('MASTER', '[CLEAN][IDEMPOTENCY_OK] Evento ya aplicado y estado coherente', {
          traceId,
          execution_key: executionKey,
          execution_mode: effectiveExecutionMode,
          student_uuid,
          item_ref,
          item_kind: itemKind,
          clean_layer,
          days_since_last_clean: daysSinceLastClean,
          idempotency_by_layer: itemKind === 'recurrente' ? true : false
        });
        
        // Devolver estado actual (coherente)
        return currentState;
      }
    }
    
    // ============================================================================
    // REGLA CANÓNICA: CLEAN AFTER RESET (CONSTITUCIONAL)
    // ============================================================================
    // CLEAN ejecutado sobre estado 'reseteado' normaliza el estado y arranca el nuevo ciclo.
    // 
    // REGLAS OBLIGATORIAS:
    // - CLEAN sobre estado 'reseteado' SIEMPRE es válido (guard semántico)
    // - CLEAN NUNCA falla por venir de reset
    // - CLEAN NO depende del tiempo desde reset
    // - effective_since se PRESERVA (no se modifica a NOW(), queda como reset.created_at)
    // - last_cleaned_at se establece a NOW() (o created_at del evento)
    // - clean_count se incrementa
    // - Estado efectivo pasa de 'reseteado' → 'reviewed' (NO 'pending')
    // - NO usar threshold_days para validar (CLEAN es acto fundador, siempre válido)
    // - NO aplicar overrides aquí (overrides son READ-only, no afectan WRITE)
    //
    // RECURRENTE:
    // - shared_last_cleaned_at = NOW() (o created_at del evento)
    // - shared_effective_since se PRESERVA (no cambia)
    // - shared_clean_count += 1
    // - days_since = 0 (derivado)
    // - Estado efectivo: 'reviewed' (porque days_since = 0 < threshold_days)
    //
    // UNA_VEZ:
    // - Reset NO invalida lógica UNA_VEZ
    // - shared_completed += 1
    // - shared_remaining -= 1
    // - Si shared_remaining <= 0 → completado
    // - Si no → progreso normal
    //
    // ANTES de aplicar limpieza, verificar si hay RESET previo y reconstruir estado si es necesario
    // NOTA: RESET solo aplica a recurrente (según contrato canónico)
    const FORENSICS_TARGET_STUDENT = '0d29eedc-6f42-44d1-bb12-53dba2fc9490';
    const FORENSICS_TARGET_ITEM = 'item_17_1768641625523_cr5fpr';
    const isForensicsCase = student_uuid === FORENSICS_TARGET_STUDENT && item_ref === FORENSICS_TARGET_ITEM;
    
    const lastReset = itemKind === 'recurrente' 
      ? await getLastResetForItem(student_uuid, item_ref, clean_layer, product_key, domain_type, client)
      : null;
    
    if (isForensicsCase) {
      console.log('[FORENSICS][REBASE_CHECK]', {
        student_uuid,
        item_ref,
        item_kind: itemKind,
        clean_layer,
        has_lastReset: !!lastReset,
        lastReset_created_at: lastReset?.created_at ? new Date(lastReset.created_at).toISOString() : null
      });
    }
    
    if (lastReset && itemKind === 'recurrente') {
      // Verificar si el estado actual es coherente con el RESET
      const currentState = existingState || await stateRepo.getState({
        student_uuid,
        product_key,
        domain_type,
        item_ref
      }, client);
      
      const resetAt = new Date(lastReset.created_at);
      const effectiveColumn = clean_layer === 'shared' ? 'shared_effective_since' : 'pde_effective_since';
      const lastCleanedColumn = clean_layer === 'shared' ? 'shared_last_cleaned_at' : 'pde_last_cleaned_at';
      const countColumn = clean_layer === 'shared' ? 'shared_clean_count' : 'pde_clean_count';
      
      const currentEffective = currentState?.[effectiveColumn] ? new Date(currentState[effectiveColumn]) : null;
      const currentLastCleaned = currentState?.[lastCleanedColumn] ? new Date(currentState[lastCleanedColumn]) : null;
      const currentCount = currentState?.[countColumn] || 0;
      
      // ============================================================================
      // REGLA CANÓNICA: CLEAN AFTER RESET - Detectar estado 'reseteado'
      // ============================================================================
      // Estado 'reseteado' = effective_since presente && last_cleaned_at null después del reset
      const isPreviousStateReseteado = currentEffective !== null && 
                                       currentLastCleaned === null && 
                                       currentEffective.getTime() <= resetAt.getTime();
      
      if (isPreviousStateReseteado) {
        // CLEAN sobre estado 'reseteado': Log forense obligatorio
        logInfo('MASTER', '[CLEAN_AFTER_RESET] CLEAN ejecutado sobre estado reseteado', {
          traceId,
          student_uuid,
          item_ref,
          item_kind: itemKind,
          clean_layer,
          previous_state: 'reseteado',
          reset_at: resetAt.toISOString(),
          effective_since: currentEffective.toISOString(),
          // Guard semántico: CLEAN SIEMPRE es válido sobre estado reseteado
          clean_valid: true,
          // Regla canónica: effective_since se PRESERVA (no se modifica a NOW())
          effective_since_preserved: true,
          // Regla canónica: last_cleaned_at se establecerá a cleanedAt (NOW() o created_at del evento)
          last_cleaned_at_will_be_set: true
        });
      }
      
      // Detectar si el estado es anterior o incoherente con el RESET
      // FIX: Si hay RESET previo y se está ejecutando un CLEAN, SIEMPRE hacer rebase
      // para asegurar que last_cleaned_at se establezca correctamente post-reset
      // Esto resuelve el bug donde limpiar tras reset no actualiza last_cleaned_at
      const hasReset = lastReset !== null;
      const needsRebase = hasReset || // SIEMPRE rebase si hay reset previo
                         !currentEffective || 
                         currentEffective < resetAt ||
                         (currentLastCleaned && currentLastCleaned < resetAt) ||
                         (currentCount > 0 && !currentLastCleaned) ||
                         (currentCount === 0 && currentLastCleaned);
      
      if (isForensicsCase) {
        console.log('[FORENSICS][REBASE_CALC]', {
          student_uuid,
          item_ref,
          clean_layer,
          resetAt: resetAt.toISOString(),
          currentEffective: currentEffective?.toISOString() || null,
          currentLastCleaned: currentLastCleaned?.toISOString() || null,
          currentCount,
          needsRebase_components: {
            no_effective: !currentEffective,
            effective_before_reset: currentEffective ? currentEffective < resetAt : false,
            lastCleaned_before_reset: currentLastCleaned ? currentLastCleaned < resetAt : false,
            count_without_clean: currentCount > 0 && !currentLastCleaned,
            zero_count_with_clean: currentCount === 0 && currentLastCleaned
          },
          needsRebase
        });
      }
      
      // ========================================================================
      // FASE C - DIAG FORENSE: NEEDS_REBASE
      // ========================================================================
      console.log('[DIAG][ENGINE][NEEDS_REBASE]', {
        phase: 'FASE_C_ENGINE_NEEDS_REBASE',
        trace_id: traceId,
        student_uuid,
        item_ref,
        item_kind: itemKind,
        clean_layer,
        needsRebase,
        hasReset: !!lastReset,
        resetAt: lastReset ? new Date(lastReset.created_at).toISOString() : null,
        currentEffective: currentEffective?.toISOString() || null,
        currentLastCleaned: currentLastCleaned?.toISOString() || null,
        currentCount,
        needsRebase_reasons: {
          hasReset,
          no_effective: !currentEffective,
          effective_before_reset: currentEffective ? currentEffective < resetAt : false,
          lastCleaned_before_reset: currentLastCleaned ? currentLastCleaned < resetAt : false,
          count_without_clean: currentCount > 0 && !currentLastCleaned,
          zero_count_with_clean: currentCount === 0 && currentLastCleaned
        },
        timestamp: new Date().toISOString()
      });
      
      if (needsRebase) {
        if (isForensicsCase) {
          console.log('[FORENSICS][REBASE_EXECUTING]', {
            student_uuid,
            item_ref,
            clean_layer,
            resetAt: resetAt.toISOString(),
            reason: 'needsRebase=true'
          });
        }
        
        // FIX: Pasar el evento de limpieza actual a rebaseStateFromReset para asegurar que se considere
        // Esto resuelve el bug donde limpiar tras reset no actualiza correctamente last_cleaned_at
        // Si el evento fue insertado exitosamente, usar su created_at; si ya existía, buscarlo
        let currentCleanEvent = null;
        if (eventResult && typeof eventResult === 'object' && !eventResult.already_executed) {
          // Evento insertado exitosamente: usar el evento retornado
          currentCleanEvent = {
            action_type: 'mark_clean',
            clean_layer: clean_layer,
            created_at: eventResult.created_at,
            execution_key: executionKey
          };
          logInfo('MASTER', '[CLEAN][RESET_REBASE] Evento actual incluido en rebase (recién insertado)', {
            traceId,
            student_uuid,
            item_ref,
            clean_layer,
            execution_key: executionKey,
            event_created_at: eventResult.created_at
          });
        } else if (eventResult && typeof eventResult === 'object' && eventResult.already_executed) {
          // Evento ya existía: buscar el evento existente para obtener su created_at
          const existingEvents = await eventsRepo.listEventsForStudentItem({
            student_uuid,
            item_ref,
            product_key,
            domain_type
          }, client);
          const existingCleanEvent = existingEvents.find(e => 
            e.execution_key === executionKey && 
            e.action_type === 'mark_clean' && 
            e.clean_layer === clean_layer
          );
          if (existingCleanEvent) {
            currentCleanEvent = {
              action_type: 'mark_clean',
              clean_layer: clean_layer,
              created_at: existingCleanEvent.created_at,
              execution_key: executionKey
            };
            logInfo('MASTER', '[CLEAN][RESET_REBASE] Evento actual incluido en rebase (ya existía)', {
              traceId,
              student_uuid,
              item_ref,
              clean_layer,
              execution_key: executionKey,
              event_created_at: existingCleanEvent.created_at
            });
          }
        }
        
        // ========================================================================
        // DIAG FORENSE: REBASE CALL (markCleanStudent → rebaseStateFromReset)
        // ========================================================================
        console.log('[DIAG][REBASE][CALL]', {
          phase: 'REBASE_CALL_FROM_MARKCLEAN',
          trace_id: traceId,
          student_uuid,
          item_ref,
          clean_layer,
          reset_at: resetAt.toISOString(),
          currentCleanEvent_provided: !!currentCleanEvent,
          currentCleanEvent_timestamp: currentCleanEvent?.created_at ? new Date(currentCleanEvent.created_at).toISOString() : null,
          execution_key: executionKey,
          event_result_type: eventResult && typeof eventResult === 'object' ? 
            (eventResult.already_executed ? 'already_executed' : 'newly_inserted') : 
            (typeof eventResult === 'string' ? eventResult : 'unknown'),
          timestamp: new Date().toISOString()
        });
        
        // Reconstruir estado desde RESET (incluyendo el evento de limpieza actual si existe)
        const rebasedState = await rebaseStateFromReset(student_uuid, item_ref, clean_layer, lastReset, product_key, domain_type, traceId, client, currentCleanEvent);
        
        if (isForensicsCase) {
          console.log('[FORENSICS][REBASE_RESULT]', {
            student_uuid,
            item_ref,
            clean_layer,
            rebased_successfully: !!rebasedState,
            rebased_effective: rebasedState?.[effectiveColumn] ? new Date(rebasedState[effectiveColumn]).toISOString() : null,
            rebased_last_cleaned: rebasedState?.[lastCleanedColumn] ? new Date(rebasedState[lastCleanedColumn]).toISOString() : null,
            rebased_count: rebasedState?.[countColumn] || 0
          });
        }
        
        if (rebasedState) {
          logWarn('MASTER', '[CLEANING_ENGINE][RESET_REBASE] Estado reconstruido desde RESET antes de aplicar limpieza', {
            traceId,
            student_uuid,
            item_ref,
            clean_layer,
            reset_at: resetAt.toISOString(),
            estado_detectado: {
              effective_since: currentEffective?.toISOString() || null,
              last_cleaned_at: currentLastCleaned?.toISOString() || null,
              clean_count: currentCount
            },
            estado_reconstruido: {
              effective_since: rebasedState[effectiveColumn]?.toISOString() || null,
              last_cleaned_at: rebasedState[lastCleanedColumn]?.toISOString() || null,
              clean_count: rebasedState[countColumn] || 0
            }
          });
        }
      }
    }
    
    // 8. Aplicar a proyección cleaning_item_state (repositorio resuelve legacy_id internamente)
    // stateRepo ya está declarado arriba (línea 395), reutilizar
    let state;
    
    logInfo('MASTER', 'Aplicando proyección', {
      traceId,
      student_uuid,
      item_ref,
      item_kind: itemKind,
      clean_layer,
      product_key,
      domain_type,
      capa_seleccionada: clean_layer === 'shared' ? 'SHARED' : 'PDE'
    });
    
    if (itemKind === 'recurrente') {
      // Recurrente: actualizar last_cleaned_at y clean_count (SIMÉTRICO)
      // FIX: Usar created_at real del evento insertado (no new Date()) para preservar precisión
      // Esto asegura que last_cleaned_at coincida exactamente con el evento y sea >= effective_since
      let cleanedAt = new Date();
      if (eventResult && typeof eventResult === 'object' && !eventResult.already_executed && eventResult.created_at) {
        // Evento recién insertado: usar su created_at real de la DB
        cleanedAt = new Date(eventResult.created_at);
        logInfo('MASTER', '[CLEAN][TIMESTAMP] Usando created_at real del evento insertado', {
          traceId,
          student_uuid,
          item_ref,
          clean_layer,
          event_created_at: eventResult.created_at,
          cleaned_at: cleanedAt.toISOString()
        });
      } else if (eventResult && typeof eventResult === 'object' && eventResult.already_executed) {
        // Evento ya existía: buscar su created_at real
        // Reutilizar eventsRepo declarado arriba (línea 610) o crear uno nuevo si no está en scope
        const eventsRepoForLookup = getDefaultCleaningEventsRepo();
        const existingEvents = await eventsRepoForLookup.listEventsForStudentItem({
          student_uuid,
          item_ref,
          product_key,
          domain_type
        }, client);
        const existingCleanEvent = existingEvents.find(e => 
          e.execution_key === executionKey && 
          e.action_type === 'mark_clean' && 
          e.clean_layer === clean_layer
        );
        if (existingCleanEvent && existingCleanEvent.created_at) {
          cleanedAt = new Date(existingCleanEvent.created_at);
          logInfo('MASTER', '[CLEAN][TIMESTAMP] Usando created_at real del evento existente', {
            traceId,
            student_uuid,
            item_ref,
            clean_layer,
            event_created_at: existingCleanEvent.created_at,
            cleaned_at: cleanedAt.toISOString()
          });
        }
      }
      
      logInfo('MASTER', 'Recurrente: usando upsertApplyRecurrent', {
        traceId,
        clean_layer,
        capa: clean_layer === 'shared' ? 'SHARED' : 'PDE',
        cleaned_at: cleanedAt.toISOString(),
        using_event_timestamp: eventResult && typeof eventResult === 'object' && !eventResult.already_executed
      });
      state = await stateRepo.upsertApplyRecurrent({
        student_uuid,
        product_key,
        domain_type,
        item_ref,
        clean_layer,
        cleaned_at: cleanedAt
      }, client);
    } else {
      // ========================================================================
      // REGLA CANÓNICA: CLEAN UNA_VEZ sobre estado 'reseteado'
      // ========================================================================
      // - Reset NO invalida lógica UNA_VEZ
      // - shared_completed += 1
      // - shared_remaining -= 1
      // - Si shared_remaining <= 0 → completado
      // - Si no → progreso normal
      // - NO aplicar overrides aquí (overrides son READ-only, no afectan WRITE)
      //
      // Una vez: usar método según clean_layer (SIMÉTRICO)
      if (clean_layer === 'pde') {
        // PDE: incrementar pde_clean_count y recalcular pde_remaining/pde_completed (simétrico a SHARED)
        const requiredCount = item.veces_limpiar || 1;
        logInfo('MASTER', 'Una vez PDE: usando upsertApplyOneTimeIncrementPde', {
          traceId,
          student_uuid,
          item_ref,
          required_count: requiredCount
        });
        state = await stateRepo.upsertApplyOneTimeIncrementPde({
          student_uuid,
          product_key,
          domain_type,
          item_ref,
          required_count: requiredCount
        }, client);
      } else {
        // SHARED: incrementar completed y decrementar remaining
        logInfo('MASTER', 'Una vez SHARED: usando upsertApplyOneTimeIncrementShared', {
          traceId,
          student_uuid,
          item_ref,
          capa: 'SHARED'
        });
        const requiredCount = item.veces_limpiar || 1;
        state = await stateRepo.upsertApplyOneTimeIncrementShared({
          student_uuid,
          product_key,
          domain_type,
          item_ref,
          required_count: requiredCount
        }, client);
      }
    }
    
    logInfo('MASTER', '[CLEAN][WRITE] Proyección aplicada (post-reset-rebase si aplicó)', {
      traceId,
      student_uuid,
      item_ref,
      clean_layer,
      item_kind: itemKind,
      state_exists: !!state,
      delta: {
        // SHARED
        shared_clean_count: state?.shared_clean_count,
        shared_remaining: state?.shared_remaining,
        shared_completed: state?.shared_completed,
        // PDE (simétrico)
        pde_clean_count: state?.pde_clean_count,
        pde_remaining: state?.pde_remaining,
        pde_completed: state?.pde_completed
      }
    });
    
    // ============================================================================
    // REGLA CANÓNICA: CLEAN AFTER RESET - Verificar estado resultante
    // ============================================================================
    // Si había estado 'reseteado' previo, verificar que el CLEAN lo normalizó
    if (lastReset && itemKind === 'recurrente') {
      const effectiveColumn = clean_layer === 'shared' ? 'shared_effective_since' : 'pde_effective_since';
      const lastCleanedColumn = clean_layer === 'shared' ? 'shared_last_cleaned_at' : 'pde_last_cleaned_at';
      
      const resultingEffective = state?.[effectiveColumn] ? new Date(state[effectiveColumn]) : null;
      const resultingLastCleaned = state?.[lastCleanedColumn] ? new Date(state[lastCleanedColumn]) : null;
      
      // Estado ya no es 'reseteado': last_cleaned_at está establecido
      if (resultingEffective && resultingLastCleaned && resultingLastCleaned >= resultingEffective) {
        logInfo('MASTER', '[CLEAN_AFTER_RESET] CLEAN normalizó estado reseteado → reviewed', {
          traceId,
          student_uuid,
          item_ref,
          item_kind: itemKind,
          clean_layer,
          previous_state: 'reseteado',
          resulting_state: 'reviewed',
          // Regla canónica: effective_since se PRESERVÓ (no se modificó a NOW())
          effective_since: resultingEffective.toISOString(),
          effective_since_preserved: true,
          // Regla canónica: last_cleaned_at establecido (acto fundador del nuevo ciclo)
          last_cleaned_at: resultingLastCleaned.toISOString(),
          last_cleaned_at_set: true,
          // Guard semántico: CLEAN siempre válido sobre estado reseteado
          clean_after_reset_valid: true
        });
      }
    }
    
    // ============================================================================
    // UUID-ONLY: syncToStudentItemState() ELIMINADA
    // NO se sincroniza student_item_state (tabla histórica)
    // ============================================================================
    
    // 8. Emitir señal clean.executed (fail-open absoluto)
    // REGLA CONSTITUCIONAL: Señal SOLO tras persistencia correcta
    // REGLA CONSTITUCIONAL: Fail-open absoluto (señal no bloquea acción)
    try {
      await dispatchSignal({
        signal_key: 'clean.executed',
        payload: {
          student_uuid,
          item_ref,
          target_ref: student_uuid, // Obligatorio: identifica entidad afectada
          clean_layer,
          item_kind: itemKind,
          actor_type,
          execution_key: executionKey
        },
        runtime: {
          trace_id: traceId,
          day_key: new Date().toISOString().substring(0, 10)
        },
        context: {
          product_key,
          domain_type,
          item_id: item.id,
          lista_id: item.lista_id,
          surface_key
        }
      }, {
        source: {
          type: 'cleaning_engine',
          id: `clean:${student_uuid}:${item_ref}:${executionKey}`
        }
      });
      
      logInfo('MASTER', '[CLEAN][SIGNAL] Señal clean.executed emitida', {
        traceId,
        student_uuid,
        item_ref,
        clean_layer,
        execution_key: executionKey
      });
    } catch (signalError) {
      // Fail-open absoluto: señal no bloquea acción
      logWarn('MASTER', '[CLEAN][SIGNAL] Error emitiendo señal (fail-open)', {
        traceId,
        student_uuid,
        item_ref,
        clean_layer,
        execution_key: executionKey,
        error: signalError.message
      });
    }
    
    logInfo('MASTER', '[CLEAN][WRITE] Limpieza aplicada correctamente', {
      traceId,
      student_uuid,
      item_ref,
      clean_layer,
      item_kind,
      delta: {
        // SHARED
        shared_clean_count: state?.shared_clean_count,
        shared_remaining: state?.shared_remaining,
        shared_completed: state?.shared_completed,
        // PDE (simétrico)
        pde_clean_count: state?.pde_clean_count,
        pde_remaining: state?.pde_remaining,
        pde_completed: state?.pde_completed
      }
    });
    
    // #region agent log
    const logEntry2 = {location:'cleaning-engine-service.js:1116',message:'markCleanStudent RETURN state',data:{student_uuid,item_ref,clean_layer,state_shared_last_cleaned_at:state?.shared_last_cleaned_at,state_pde_last_cleaned_at:state?.pde_last_cleaned_at,state_shared_effective_since:state?.shared_effective_since,state_pde_effective_since:state?.pde_effective_since},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'}; console.log('[DEBUG]',JSON.stringify(logEntry2));
    // #endregion
    
    // ========================================================================
    // FASE C - DIAG FORENSE: EXIT_STATE
    // ========================================================================
    const effectiveColumn = clean_layer === 'shared' ? 'shared_effective_since' : 'pde_effective_since';
    const lastCleanedColumn = clean_layer === 'shared' ? 'shared_last_cleaned_at' : 'pde_last_cleaned_at';
    const countColumn = clean_layer === 'shared' ? 'shared_clean_count' : 'pde_clean_count';
    
    console.log('[DIAG][ENGINE][EXIT_STATE]', {
      phase: 'FASE_C_ENGINE_EXIT_STATE',
      trace_id: traceId,
      student_uuid,
      item_ref,
      item_kind: itemKind,
      clean_layer,
      exit_state: state ? {
        effective_since: state[effectiveColumn] ? new Date(state[effectiveColumn]).toISOString() : null,
        last_cleaned_at: state[lastCleanedColumn] ? new Date(state[lastCleanedColumn]).toISOString() : null,
        clean_count: state[countColumn] || 0,
        remaining: itemKind === 'una_vez' ? (clean_layer === 'shared' ? state.shared_remaining : state.pde_remaining) : null,
        completed: itemKind === 'una_vez' ? (clean_layer === 'shared' ? state.shared_completed : state.pde_completed) : null
      } : null,
      timestamp: new Date().toISOString()
    });
    
    return state;
  } catch (error) {
    logError('MASTER', 'Error en markCleanStudent', {
      traceId,
      error: error.message,
      code: error.code,
      stack: error.stack,
      student_uuid,
      item_ref
    });
    throw error;
  }
}

/**
 * Marca limpio todos los alumnos (recurrente o una_vez)
 * 
 * @param {Object} options - Opciones
 * @param {string} options.item_ref - Referencia del item
 * @param {string} [options.clean_layer='shared'] - Capa de limpieza ('shared' | 'pde')
 * @param {string} [options.product_key='pde'] - Clave del producto
 * @param {string} [options.domain_type='transmutation'] - Tipo de dominio
 * @param {string} options.actor_type - Tipo de actor ('master' | 'student' | 'automation')
 * @param {string} [options.actor_ref] - Referencia del actor
 * @param {string} [options.surface_key] - Superficie de origen
 * @param {boolean} [options.skip_level_filter=false] - Si true, NO filtra por nivel (Master puede limpiar cualquier item)
 * @param {Object} [options.meta={}] - Metadatos adicionales
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Resultado con { updated: number, skipped: number }
 */
export async function markCleanAllStudents(options, client = null) {
  const traceId = getRequestId();
  const {
    item_ref,
    clean_layer = 'shared',
    product_key = 'pde',
    domain_type = 'transmutation',
    actor_type,
    actor_ref = null,
    surface_key = null,
    skip_level_filter = false,
    execution_mode = 'APPLY', // Nuevo: 'APPLY' (idempotente) o 'CERTIFY' (no idempotente)
    meta = {}
  } = options;

  logInfo('MASTER', 'markCleanAllStudents entrada', {
    traceId,
    item_ref,
    item_kind: options.item_kind,
    clean_layer,
    product_key,
    actor_type,
    surface_key,
    skip_level_filter
  });

  // REGLA: markCleanAllStudents obtiene todos los alumnos desde students (UUID canónico)
  // Luego resuelve legacy_id internamente solo cuando necesita escribir en tablas legacy
  
  // Validar campos requeridos según contrato canónico
  if (!item_ref || !actor_type || !options.item_kind || !options.surface_key) {
    const missing = [];
    if (!item_ref) missing.push('item_ref');
    if (!actor_type) missing.push('actor_type');
    if (!options.item_kind) missing.push('item_kind');
    if (!options.surface_key) missing.push('surface_key');
    throw new Error(`Campos requeridos faltantes: ${missing.join(', ')}`);
  }
  
  if (!options.item_kind || (options.item_kind !== 'recurrente' && options.item_kind !== 'una_vez')) {
    throw new Error('item_kind es requerido y debe ser "recurrente" o "una_vez"');
  }
  
  try {
    // 1. Obtener item para validar
    const catalogRepo = getDefaultAlquimiaCatalogRepo();
    const item = await catalogRepo.getItemByRef(item_ref);
    
    if (!item) {
      throw new Error(`Item no encontrado: ${item_ref}`);
    }
    
    // 2. Validar coherencia con lista (no inferir, solo validar)
    const lista = await catalogRepo.getListaById(item.lista_id);
    if (!lista) {
      throw new Error(`Lista no encontrada para item: ${item_ref}`);
    }
    
    // Usar item_kind del options (contrato canónico: payload explícito)
    const itemKind = options.item_kind;
    
    // REGLA CONSTITUCIONAL: item_kind DEBE coincidir con lista.tipo
    // NO se permite inferencia ni fallback
    if (itemKind !== lista.tipo) {
      const error = new Error(`item_kind no coincide con lista.tipo: item_kind=${itemKind}, lista.tipo=${lista.tipo}`);
      error.code = 'ITEM_KIND_MISMATCH';
      logError('MASTER', 'item_kind no coincide con lista.tipo en markCleanAllStudents (ERROR)', {
        traceId,
        item_ref,
        item_kind_provided: itemKind,
        lista_tipo: lista.tipo
      });
      throw error; // Fail-hard: rechazar si no coincide
    }
    
    // 3. Obtener todos los estudiantes desde students (UUID canónico)
    // UUID-ONLY: NO consultar alumnos directamente
    const { query } = await import('../../../../database/pg.js');
    const queryFn = client ? client.query.bind(client) : query;
    
    const studentsResult = await queryFn(`
      SELECT id as student_uuid
      FROM students
      WHERE deleted_at IS NULL
    `, []);
    
    // 4. Filtrar estudiantes no pausados (UUID-only)
    const activeStudentUuids = [];
    for (const row of studentsResult.rows) {
      const isPaused = await isStudentPaused(row.student_uuid);
      if (!isPaused) {
        activeStudentUuids.push({
          uuid: row.student_uuid
        });
      }
    }
    
    // 5. Obtener nivel del item para verificación
    const itemNivel = item.nivel || 999;
    
    // 6. Aplicar limpieza a cada estudiante activo con breakdown de razones
    let updated = 0;
    let skipped = 0;
    const skippedBreakdown = {
      paused: 0,
      not_applicable_level: 0,
      missing_item: 0,
      no_change: 0,
      error: 0,
      other: 0
    };
    
    // FIX MAJOR: Eliminada verificación "ya estaba limpio hoy"
    // La idempotencia se maneja por execution_key en markCleanStudent
    
    for (const { uuid: studentUuid } of activeStudentUuids) {
      try {
        // Verificar si aplica por nivel antes de limpiar
        // REGLA CONSTITUCIONAL: MASTER no está sujeto a restricciones de nivel
        // REGLA: Filtro por nivel SOLO cuando item_kind === 'recurrente' y skip_level_filter !== true
        // Para UNA_VEZ o cuando skip_level_filter === true, NO filtrar por nivel
        // EXCEPCIÓN: Si actor_type === 'master', OMITIR completamente validación de nivel
        const isMasterContext = actor_type === 'master';
        
        if (!isMasterContext && !skip_level_filter && itemKind === 'recurrente') {
          const nivelEfectivo = await getStudentEffectiveLevel(studentUuid, product_key);
          
          if (nivelEfectivo < itemNivel) {
            skipped++;
            skippedBreakdown.not_applicable_level++;
            continue;
          }
        } else if (isMasterContext) {
          // Log forense: MASTER bypass de validación de nivel
          logInfo('MASTER', '[MASTER][CLEANING] Nivel ignorado por autoridad MASTER', {
            traceId,
            student_uuid: studentUuid,
            item_ref,
            item_nivel: itemNivel,
            actor_type,
            surface_key
          });
        }
        
        // FIX MAJOR: Eliminar lógica "ya estaba limpio hoy"
        // REGLA CONSTITUCIONAL: Limpiar SIEMPRE reinicia ciclo, incluso si ya estaba limpio hoy
        // La idempotencia se maneja por execution_key en markCleanStudent, NO por esta verificación
        // Esto permite que el sistema recalcule estado correctamente tras acciones
        
        const result = await markCleanStudent({
          student_uuid: studentUuid,
          item_ref,
          item_kind: itemKind,
          clean_layer,
          product_key,
          domain_type,
          actor_type,
          actor_ref,
          surface_key,
          execution_mode, // Pasar execution_mode a markCleanStudent
          meta
        }, client);
        
        if (result) {
          updated++;
        } else {
          // Si markCleanStudent devuelve null, es "no aplica" (no "ya limpio")
          skipped++;
          skippedBreakdown.no_change++;
        }
      } catch (error) {
        logWarn('MASTER', 'Error en markCleanStudent individual (continuando)', {
          traceId,
          student_uuid: studentUuid,
          item_ref,
          error: error.message
        });
        skipped++;
        skippedBreakdown.error++;
      }
    }
    
    logInfo('MASTER', 'markCleanAllStudents completado', {
      traceId,
      item_ref,
      item_kind: itemKind,
      clean_layer,
      isMasterSurface: actor_type === 'master' && (surface_key?.startsWith('master.') || skip_level_filter),
      skip_level_filter,
      total: activeStudentUuids.length,
      updated,
      skipped,
      skipped_breakdown: skippedBreakdown
    });
    
    logInfo('MASTER', 'Limpieza global completada', {
      traceId,
      item_ref,
      clean_layer,
      item_kind: itemKind,
      item_id: item.id,
      item_nivel: itemNivel,
      skip_level_filter,
      total: activeStudentUuids.length,
      updated,
      skipped,
      skipped_breakdown: skippedBreakdown
    });
    
    return { 
      updated, 
      skipped,
      total: activeStudentUuids.length,
      skipped_breakdown: skippedBreakdown
    };
  } catch (error) {
    logError('MASTER', 'Error en markCleanAllStudents', {
      traceId,
      error: error.message,
      code: error.code,
      stack: error.stack,
      item_ref
    });
    throw error;
  }
}

/**
 * Incrementa +1 todos los alumnos para una_vez (solo SHARED)
 * 
 * @param {Object} options - Opciones
 * @param {string} options.item_ref - Referencia del item
 * @param {string} [options.product_key='pde'] - Clave del producto
 * @param {string} [options.domain_type='transmutation'] - Tipo de dominio
 * @param {string} options.actor_type - Tipo de actor
 * @param {string} [options.actor_ref] - Referencia del actor
 * @param {string} [options.surface_key] - Superficie de origen
 * @param {Object} [options.meta={}] - Metadatos adicionales
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Resultado con { updated: number, skipped: number }
 */
export async function incrementAllStudents(options, client = null) {
  // Similar a markCleanAllStudents pero para una_vez
  // CONTRATO LIMPIEZA v1: item_kind debe venir en options
  const traceId = getRequestId();
  
  logInfo('MASTER', 'incrementAllStudents entrada', {
    traceId,
    item_ref: options.item_ref,
    item_kind: options.item_kind,
    clean_layer: options.clean_layer,
    execution_mode: options.execution_mode,
    actor_type: options.actor_type,
    surface_key: options.surface_key
  });
  
  if (!options.item_kind) {
    // TODO DEPRECATION: Eliminar este fallback después de v5.66.0
    // WARNING FUERTE: item_kind debe venir explícitamente desde el frontend
    logWarn('MASTER', 'DEPRECATED: incrementAllStudents llamado sin item_kind. Usando fallback "una_vez". Esto será un error en v5.66.0', {
      traceId,
      item_ref: options.item_ref,
      stack: new Error().stack
    });
    options.item_kind = 'una_vez'; // Fallback legacy solo por compatibilidad temporal
  }
  
  // REGLA MASTER: Para UNA_VEZ en MASTER, usar CERTIFY para permitir múltiples incrementos
  const isMasterDomain = options.actor_type === 'master' && options.surface_key === 'master.alquimia_general';
  const effectiveExecutionMode = (isMasterDomain && options.item_kind === 'una_vez' && (!options.execution_mode || options.execution_mode === 'APPLY'))
    ? 'CERTIFY'
    : (options.execution_mode || 'APPLY');
  
  // LOG TEMPORAL: decisión de execution_mode
  if (isMasterDomain && options.item_kind === 'una_vez') {
    logInfo('MASTER', 'MASTER UNA_VEZ incrementAll: usando CERTIFY para permitir múltiples incrementos', {
      traceId,
      item_ref: options.item_ref,
      original_execution_mode: options.execution_mode,
      effective_execution_mode: effectiveExecutionMode
    });
  }
  
  // REGLA: incrementAll desde Alquimia General debe pasar skip_level_filter para ignorar nivel
  // Asegurar que skip_level_filter se pasa correctamente a markCleanAllStudents
  return await markCleanAllStudents({
    ...options,
    item_kind: options.item_kind, // Asegurar que se pasa explícitamente
    clean_layer: options.clean_layer || 'shared', // Usar clean_layer de options si viene
    execution_mode: effectiveExecutionMode, // Usar execution_mode efectivo (CERTIFY para MASTER UNA_VEZ)
    skip_level_filter: options.skip_level_filter !== undefined ? options.skip_level_filter : true // Por defecto true para incrementAll (Alquimia General ignora nivel)
  }, client);
}

/**
 * Establece remaining directamente para un alumno (una_vez, solo SHARED)
 * 
 * @param {Object} options - Opciones
 * @param {string} options.student_uuid - UUID canónico del estudiante
 * @param {string} options.item_ref - Referencia del item
 * @param {number} options.remaining - Nuevo valor de remaining
 * @param {string} [options.product_key='pde'] - Clave del producto
 * @param {string} [options.domain_type='transmutation'] - Tipo de dominio
 * @param {string} options.actor_type - Tipo de actor
 * @param {string} [options.actor_ref] - Referencia del actor
 * @param {string} [options.surface_key] - Superficie de origen
 * @param {Object} [options.meta={}] - Metadatos adicionales
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object|null>} Estado actualizado o null
 */
export async function setRemainingShared(options, client = null) {
  const traceId = getRequestId();
  const {
    student_uuid,
    item_ref,
    remaining,
    product_key = 'pde',
    domain_type = 'transmutation',
    actor_type,
    actor_ref = null,
    surface_key = null,
    meta = {}
  } = options;
  
  // ============================================================================
  // GUARD CONSTITUCIONAL: UUID-only Alquimia
  // ============================================================================
  if (options.student_id || options.legacy_alumno_id) {
    const error = new Error('LEGACY alumno_id is forbidden in UUID-only Alquimia runtime');
    error.code = 'LEGACY_ALUMNO_ID_FORBIDDEN';
    logError('MASTER', 'Intento de usar legacy_alumno_id en setRemainingShared', {
      traceId,
      student_uuid,
      student_id: options.student_id,
      legacy_alumno_id: options.legacy_alumno_id
    });
    throw error;
  }
  // ============================================================================
  
  if (!student_uuid || !item_ref || remaining === undefined || !actor_type) {
    throw new Error('student_uuid, item_ref, remaining y actor_type son requeridos');
  }
  
  // Validar formato UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(student_uuid)) {
    throw new Error(`student_uuid debe ser un UUID válido: ${student_uuid}`);
  }
  
  try {
    // 1. Verificar si alumno está en pausa (UUID-only)
    const isPaused = await isStudentPaused(student_uuid);
    if (isPaused) {
      logInfo('MASTER', 'Alumno en pausa, excluido', {
        traceId,
        student_uuid,
        item_ref
      });
      return null;
    }
    
    // 2. Obtener item para validar
    const catalogRepo = getDefaultAlquimiaCatalogRepo();
    const item = await catalogRepo.getItemByRef(item_ref);
    
    if (!item) {
      throw new Error(`Item no encontrado: ${item_ref}`);
    }
    
    // 3. Verificar que es una_vez
    const lista = await catalogRepo.getListaById(item.lista_id);
    if (!lista || lista.tipo !== 'una_vez') {
      throw new Error(`setRemainingShared solo aplica a items una_vez`);
    }
    
    // UUID-ONLY: Ya no se resuelve legacy, usar student_uuid directamente
    
    // 4. Generar execution_key para idempotencia (usar UUID)
    const executionKey = generateExecutionKey('set_remaining', item_ref, student_uuid);
    
    // 5. Insertar evento (repositorio resuelve legacy_id internamente)
    const eventsRepo = getDefaultCleaningEventsRepo();
    const eventData = {
      trace_id: traceId,
      execution_key: executionKey,
      student_uuid, // UUID canónico (student_id en tabla ahora es UUID)
      product_key,
      domain_type,
      item_ref,
      clean_layer: 'shared',
      item_kind: 'una_vez',
      action_type: 'set_remaining',
      delta_completed: null,
      set_remaining: remaining,
      actor_type,
      actor_ref,
      surface_key,
      meta: {
        ...meta,
        item_id: item.id,
        lista_id: item.lista_id
      }
    };
    
    const eventResult = await eventsRepo.insertEvent(eventData, client);
    
    // Declarar stateRepo una sola vez al inicio (reutilizar en todo el scope)
    const stateRepo = getDefaultCleaningItemStateRepo();
    
    // Manejar idempotencia: ya sea 'already_applied' (legacy) o { already_executed: true } (nuevo)
    if (eventResult === 'already_applied' || (eventResult && eventResult.already_executed === true)) {
      logInfo('MASTER', 'Evento ya aplicado (idempotencia)', {
        traceId,
        execution_key: executionKey,
        student_uuid,
        item_ref
      });
      // Devolver estado actual (repositorio resuelve legacy_id internamente)
      return await stateRepo.getState({
        student_uuid,
        product_key,
        domain_type,
        item_ref
      }, client);
    }
    
    // 6. Aplicar a proyección (repositorio resuelve legacy_id internamente)
    const state = await stateRepo.upsertApplyOneTimeSetRemainingShared({
      student_uuid,
      product_key,
      domain_type,
      item_ref,
      remaining
    }, client);
    
    // ============================================================================
    // UUID-ONLY: syncToStudentItemState() ELIMINADA
    // NO se sincroniza student_item_state (tabla histórica)
    // ============================================================================
    
    logInfo('MASTER', 'Remaining establecido correctamente', {
      traceId,
      student_uuid,
      item_ref,
      remaining
    });
    
    return state;
  } catch (error) {
    logError('MASTER', 'Error en setRemainingShared', {
      traceId,
      error: error.message,
      code: error.code,
      stack: error.stack,
      student_uuid,
      item_ref
    });
    throw error;
  }
}

/**
 * Resetea el progreso de un alumno para un ítem específico (RESET CANÓNICO v1)
 * 
 * REGLA CONSTITUCIONAL: Reset es un EVENTO del Cleaning Engine, no un delete.
 * - Inserta evento en cleaning_events con action_type='reset'
 * - Actualiza cleaning_item_state estableciendo effective_since (NO borra)
 * - Conserva historia (contadores, fechas históricas)
 * 
 * SEMÁNTICA CANÓNICA: Reset inicia un nuevo ciclo.
 * - effective_since se fija al momento del reset (reset.created_at)
 * - El estado inicial es 'reseteado' con days_since = 0
 * - Reset nunca produce estado 'never' (siempre hay ciclo abierto si hubo reset)
 * - La progresión de estados (reseteado → reviewed → pending → important) depende
 *   exclusivamente del tiempo transcurrido desde effective_since
 * - Reset NO usa threshold_days para ajustar effective_since
 * - Reset NO aplica offsets temporales
 * 
 * @param {Object} options - Opciones
 * @param {string} options.student_uuid - UUID canónico del estudiante (OBLIGATORIO)
 * @param {string} options.item_ref - Referencia del item (OBLIGATORIO)
 * @param {string} options.item_kind - Tipo de item ('recurrente' | 'una_vez') (OBLIGATORIO)
 * @param {string} [options.clean_layer] - Capa de limpieza ('shared' | 'pde')
 *   Si no se proporciona:
 *     - Para view_layer='effective' (recurrente): reset BOTH layers
 *     - Para view_layer='combo' (una_vez): reset BOTH layers
 *     - Para view_layer='shared' o 'pde': reset solo esa capa
 * @param {string} [options.view_layer] - Capa de vista (para derivar clean_layer si no viene)
 * @param {string} [options.product_key='pde'] - Clave del producto
 * @param {string} [options.domain_type='transmutation'] - Tipo de dominio
 * @param {string} options.actor_type - Tipo de actor ('master' | 'student' | 'automation')
 * @param {string} [options.actor_ref] - Referencia del actor
 * @param {string} [options.surface_key] - Superficie de origen
 * @param {string} [options.execution_mode='APPLY'] - 'APPLY' (idempotente) o 'CERTIFY' (no idempotente)
 * @param {Object} [options.meta={}] - Metadatos adicionales
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Estado actualizado con { applied: boolean, skipped: number, layers_affected: Array }
 */
export async function resetStudentItemProgress(options, client = null) {
  const traceId = getRequestId();
  const {
    student_uuid,
    item_ref,
    item_kind,
    clean_layer = null,
    view_layer = null,
    product_key = 'pde',
    domain_type = 'transmutation',
    actor_type,
    actor_ref = null,
    surface_key = null,
    execution_mode = 'APPLY',
    meta = {}
  } = options;

  logInfo('MASTER', '[RESET][CANONICAL] resetStudentItemProgress entrada', {
    traceId,
    student_uuid,
    item_ref,
    item_kind,
    clean_layer,
    view_layer,
    product_key,
    actor_type,
    surface_key
  });

  // ============================================================================
  // GUARD CONSTITUCIONAL: UUID-only Alquimia
  // ============================================================================
  if (options.legacy_alumno_id || options.student_id) {
    const error = new Error('LEGACY alumno_id is forbidden in UUID-only Alquimia runtime');
    error.code = 'LEGACY_ALUMNO_ID_FORBIDDEN';
    logError('MASTER', 'Intento de usar legacy_alumno_id en reset', {
      traceId,
      student_uuid,
      legacy_alumno_id: options.legacy_alumno_id,
      student_id: options.student_id
    });
    throw error;
  }

  // Validar campos requeridos
  if (!student_uuid || !item_ref || !actor_type || !item_kind || !surface_key) {
    const missing = [];
    if (!student_uuid) missing.push('student_uuid');
    if (!item_ref) missing.push('item_ref');
    if (!actor_type) missing.push('actor_type');
    if (!item_kind) missing.push('item_kind');
    if (!surface_key) missing.push('surface_key');
    throw new Error(`Campos requeridos faltantes: ${missing.join(', ')}`);
  }

  // Validar item_kind
  if (item_kind !== 'recurrente' && item_kind !== 'una_vez') {
    throw new Error('item_kind es requerido y debe ser "recurrente" o "una_vez"');
  }

  // REGLA CONSTITUCIONAL CPM v2: Reset PROHIBIDO en UNA_VEZ
  if (item_kind === 'una_vez') {
    const error = new Error('Reset está PROHIBIDO para item_kind="una_vez". UNA_VEZ solo tiene contadores + overrides, no reset.');
    error.code = 'RESET_UNA_VEZ_FORBIDDEN';
    logError('MASTER', 'Intento de reset en UNA_VEZ (PROHIBIDO)', {
      traceId,
      student_uuid,
      item_ref,
      item_kind
    });
    throw error;
  }

  // Validar formato UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(student_uuid)) {
    throw new Error(`student_uuid debe ser un UUID válido: ${student_uuid}`);
  }

  try {
    // 1. Verificar si alumno está en pausa (UUID-only)
    const isPaused = await isStudentPaused(student_uuid);
    if (isPaused) {
      logInfo('MASTER', 'Alumno en pausa, reset excluido', {
        traceId,
        student_uuid,
        item_ref
      });
      return { applied: false, skipped: 1, layers_affected: [], reason: 'paused' };
    }

    // 2. Obtener item para validar
    const catalogRepo = getDefaultAlquimiaCatalogRepo();
    const item = await catalogRepo.getItemByRef(item_ref);
    
    if (!item) {
      throw new Error(`Item no encontrado: ${item_ref}`);
    }

    // 3. Validar coherencia con lista
    const lista = await catalogRepo.getListaById(item.lista_id);
    if (!lista) {
      throw new Error(`Lista no encontrada para item: ${item_ref}`);
    }

    if (item_kind !== lista.tipo) {
      throw new Error(`item_kind no coincide con lista.tipo: item_kind=${item_kind}, lista.tipo=${lista.tipo}`);
    }

    // 4. Determinar capas a resetear
    // MAJOR-2 FIX: Validar coherencia view_layer + clean_layer
    // REGLA CANÓNICA: view_layer='effective' → clean_layer='pde' (OBLIGATORIO)
    if (view_layer === 'effective' && item_kind === 'recurrente') {
      // REGLA CONSTITUCIONAL: Reset desde effective → SOLO PDE
      if (clean_layer && clean_layer !== 'pde') {
        const error = new Error(`[MAJOR-2] Coherencia violada: view_layer='effective' requiere clean_layer='pde', recibido: ${clean_layer}`);
        error.code = 'VIEW_LAYER_CLEAN_LAYER_COHERENCE_VIOLATION';
        logError('MASTER', '[MAJOR-2] Coherencia view_layer/clean_layer violada', {
          traceId,
          view_layer,
          clean_layer,
          item_kind
        });
        throw error;
      }
      // Forzar clean_layer='pde' si no viene explícito
      if (!clean_layer) {
        clean_layer = 'pde';
        logInfo('MASTER', '[MAJOR-2] view_layer=effective → clean_layer=pde (regla canónica)', {
          traceId,
          student_uuid,
          item_ref
        });
      }
    }
    
    // REGLA V1: Si clean_layer viene explícito, reset solo esa capa
    // Si no viene, derivar de view_layer:
    //   - effective (recurrente) => reset SOLO pde (regla canónica)
    //   - combo (una_vez) => reset BOTH (shared + pde)
    //   - shared/pde => reset solo esa capa
    let layersToReset = [];
    if (clean_layer) {
      if (clean_layer !== 'shared' && clean_layer !== 'pde') {
        throw new Error(`clean_layer debe ser 'shared' o 'pde', recibido: ${clean_layer}`);
      }
      layersToReset = [clean_layer];
    } else if (view_layer) {
      if (view_layer === 'effective' && item_kind === 'recurrente') {
        // MAJOR-2 FIX: effective → SOLO pde (regla canónica)
        layersToReset = ['pde'];
      } else if (view_layer === 'combo' && item_kind === 'una_vez') {
        layersToReset = ['shared', 'pde'];
      } else if (view_layer === 'shared' || view_layer === 'pde') {
        layersToReset = [view_layer];
      } else {
        // Default: reset shared si no se puede determinar
        logWarn('MASTER', 'view_layer no permite derivar clean_layer, usando shared', {
          traceId,
          view_layer,
          item_kind
        });
        layersToReset = ['shared'];
      }
    } else {
      // Default: reset shared si no hay información
      logWarn('MASTER', 'No se proporcionó clean_layer ni view_layer, usando shared', {
        traceId
      });
      layersToReset = ['shared'];
    }

    // 5. Aplicar reset a cada capa
    const eventsRepo = getDefaultCleaningEventsRepo();
    const stateRepo = getDefaultCleaningItemStateRepo();
    let applied = 0;
    let skipped = 0;
    const layersAffected = [];

    for (const layer of layersToReset) {
      try {
        // Generar execution_key para esta capa
        const executionKey = generateExecutionKey('reset', item_ref, student_uuid, new Date(), execution_mode, item_kind, layer);

        // Insertar evento reset
        const eventData = {
          trace_id: traceId,
          execution_key: executionKey,
          student_uuid,
          product_key,
          domain_type,
          item_ref,
          clean_layer: layer,
          item_kind,
          action_type: 'reset',
          delta_completed: null,
          set_remaining: null,
          actor_type,
          actor_ref,
          surface_key,
          meta: {
            ...meta,
            item_id: item.id,
            lista_id: item.lista_id,
            reset_canonical_v1: true
          }
        };

        const eventResult = await eventsRepo.insertEvent(eventData, client);

        // Obtener timestamp del evento RESET (creado o existente)
        let resetTimestamp;
        if (eventResult === 'already_applied' || (eventResult && eventResult.already_executed === true)) {
          // BLINDAJE: Verificar coherencia antes de omitir
          const currentState = await stateRepo.getState({
            student_uuid,
            item_ref,
            product_key,
            domain_type
          }, client);

          // Obtener el evento existente para verificar su fecha
          const existingEvents = await eventsRepo.listEventsForStudentItem({
            student_uuid,
            item_ref,
            product_key,
            domain_type
          }, client);

          const existingResetEvent = existingEvents.find(e => 
            e.execution_key === executionKey && 
            e.action_type === 'reset' && 
            e.clean_layer === layer
          );

          const effectiveColumn = layer === 'shared' ? 'shared_effective_since' : 'pde_effective_since';
          const currentEffective = currentState?.[effectiveColumn] ? new Date(currentState[effectiveColumn]) : null;
          resetTimestamp = existingResetEvent?.created_at ? new Date(existingResetEvent.created_at) : new Date();
          
          // Verificar si el estado está coherente con el reset esperado
          // REGLA CONSTITUCIONAL: Reset SOLO modifica effective_since
          // No verificamos contadores (pueden tener valores previos a reset o post-reset)
          const isCoherent = currentEffective && 
            currentEffective >= resetTimestamp;

          if (!isCoherent) {
            // Estado incoherente: aplicar reset igualmente (idempotencia override)
            logWarn('MASTER', '[RESET][IDEMPOTENCY_OVERRIDE] Evento existe pero estado incoherente, aplicando reset', {
              traceId,
              execution_key: executionKey,
              student_uuid,
              item_ref,
              clean_layer: layer,
              current_effective: currentEffective,
              event_created_at: resetTimestamp
            });
            // Continuar para aplicar reset (no hacer skipped++)
          } else {
            // Estado coherente: omitir correctamente
            logInfo('MASTER', '[RESET][IDEMPOTENCY] Reset ya aplicado y estado coherente para esta capa', {
              traceId,
              execution_key: executionKey,
              student_uuid,
              item_ref,
              clean_layer: layer
            });
            skipped++;
            continue;
          }
        } else {
          // Evento insertado exitosamente
          resetTimestamp = eventResult.created_at ? new Date(eventResult.created_at) : new Date();
        }

        // Aplicar reset a proyección (SOLO effective_since según RESET CANÓNICO v1)
        // REGLA CONSTITUCIONAL: Reset SOLO modifica effective_since
        // Los contadores se calcularán desde eventos post-RESET cuando se ejecute rebaseStateFromReset()
        await stateRepo.upsertApplyReset({
          student_uuid,
          product_key,
          domain_type,
          item_ref,
          clean_layer: layer,
          reset_at: resetTimestamp // Usar timestamp del evento RESET (no NOW())
        }, client);

        applied++;
        layersAffected.push(layer);

        logInfo('MASTER', '[RESET][CANONICAL] Reset aplicado a capa', {
          traceId,
          student_uuid,
          item_ref,
          clean_layer: layer,
          item_kind
        });
      } catch (layerError) {
        logError('MASTER', 'Error aplicando reset a capa', {
          traceId,
          student_uuid,
          item_ref,
          clean_layer: layer,
          error: layerError.message
        });
        // Continuar con siguiente capa (fail-open)
      }
    }

    // 6. Obtener estado actualizado
    const finalState = await stateRepo.getState({
      student_uuid,
      product_key,
      domain_type,
      item_ref
    }, client);

    // 7. Emitir señal reset.executed (fail-open absoluto)
    // REGLA CONSTITUCIONAL: Señal SOLO tras persistencia correcta
    // REGLA CONSTITUCIONAL: Fail-open absoluto (señal no bloquea acción)
    try {
      // Obtener reset_at (effective_since) del estado final
      const resetAt = finalState?.shared_effective_since || finalState?.pde_effective_since || new Date();
      const resetExecutionKey = generateExecutionKey('reset', item_ref, student_uuid, new Date(), execution_mode, item_kind, clean_layer);
      
      await dispatchSignal({
        signal_key: 'reset.executed',
        payload: {
          student_uuid,
          item_ref,
          target_ref: student_uuid, // Obligatorio: identifica entidad afectada
          clean_layer,
          item_kind,
          actor_type,
          execution_key: resetExecutionKey,
          reset_at: resetAt instanceof Date ? resetAt.toISOString() : resetAt
        },
        runtime: {
          trace_id: traceId,
          day_key: new Date().toISOString().substring(0, 10)
        },
        context: {
          product_key,
          domain_type,
          layers_affected: layersAffected,
          surface_key
        }
      }, {
        source: {
          type: 'cleaning_engine',
          id: `reset:${student_uuid}:${item_ref}:${resetExecutionKey}`
        }
      });
      
      logInfo('MASTER', '[RESET][SIGNAL] Señal reset.executed emitida', {
        traceId,
        student_uuid,
        item_ref,
        clean_layer,
        execution_key: resetExecutionKey
      });
    } catch (signalError) {
      // Fail-open absoluto: señal no bloquea acción
      logWarn('MASTER', '[RESET][SIGNAL] Error emitiendo señal (fail-open)', {
        traceId,
        student_uuid,
        item_ref,
        clean_layer,
        error: signalError.message
      });
    }

    logInfo('MASTER', '[RESET][CANONICAL] Reset completado', {
      traceId,
      student_uuid,
      item_ref,
      item_kind,
      applied,
      skipped,
      layers_affected: layersAffected
    });

    return {
      applied: applied > 0,
      skipped,
      layers_affected: layersAffected,
      state: finalState
    };
  } catch (error) {
    logError('MASTER', 'Error en resetStudentItemProgress', {
      traceId,
      error: error.message,
      code: error.code,
      stack: error.stack,
      student_uuid,
      item_ref
    });
    throw error;
  }
}

/**
 * Resetea el progreso de TODOS los estudiantes activos para un ítem (RESET ALL)
 * 
 * REGLA CONSTITUCIONAL:
 * - Solo disponible para recurrente (una_vez NO tiene reset)
 * - Solo afecta PDE (según contrato: reset ALL solo PDE)
 * - Excluye estudiantes en pausa
 * 
 * @param {Object} options - Opciones
 * @param {string} options.item_ref - Referencia del item
 * @param {string} options.item_kind - Tipo de item ('recurrente' | 'una_vez') - OBLIGATORIO
 * @param {string} options.clean_layer - Capa a resetear ('shared' | 'pde') - OBLIGATORIO
 * @param {string} [options.product_key='pde'] - Clave del producto
 * @param {string} [options.domain_type='transmutation'] - Tipo de dominio
 * @param {string} options.actor_type - Tipo de actor ('master')
 * @param {string} [options.actor_ref=null] - Referencia del actor
 * @param {string} options.surface_key - Clave de superficie
 * @param {string} [options.execution_mode='APPLY'] - Modo de ejecución
 * @param {Object} [options.meta={}] - Metadatos adicionales
 * @returns {Promise<Object>} Resultado con { applied, skipped, total, layers_affected }
 */
export async function resetAllStudentsItemProgress(options, client = null) {
  const traceId = getRequestId();
  const {
    item_ref,
    item_kind,
    clean_layer,
    product_key = 'pde',
    domain_type = 'transmutation',
    actor_type,
    actor_ref = null,
    surface_key = null,
    execution_mode = 'APPLY',
    meta = {}
  } = options;

  logInfo('MASTER', '[RESET][ALL][CANONICAL] resetAllStudentsItemProgress entrada', {
    traceId,
    item_ref,
    item_kind,
    clean_layer,
    product_key,
    actor_type,
    surface_key
  });

  // Validar campos requeridos
  if (!item_ref || !actor_type || !item_kind || !surface_key || !clean_layer) {
    const missing = [];
    if (!item_ref) missing.push('item_ref');
    if (!actor_type) missing.push('actor_type');
    if (!item_kind) missing.push('item_kind');
    if (!surface_key) missing.push('surface_key');
    if (!clean_layer) missing.push('clean_layer');
    throw new Error(`Campos requeridos faltantes: ${missing.join(', ')}`);
  }

  // Validar item_kind
  if (item_kind !== 'recurrente' && item_kind !== 'una_vez') {
    throw new Error('item_kind es requerido y debe ser "recurrente" o "una_vez"');
  }

  // REGLA CONSTITUCIONAL: Reset PROHIBIDO en UNA_VEZ
  if (item_kind === 'una_vez') {
    const error = new Error('Reset está PROHIBIDO para item_kind="una_vez". UNA_VEZ solo tiene contadores + overrides, no reset.');
    error.code = 'RESET_UNA_VEZ_FORBIDDEN';
    logError('MASTER', 'Intento de reset ALL en UNA_VEZ (PROHIBIDO)', {
      traceId,
      item_ref,
      item_kind
    });
    throw error;
  }

  // Validar clean_layer
  if (clean_layer !== 'shared' && clean_layer !== 'pde') {
    throw new Error(`clean_layer debe ser 'shared' o 'pde', recibido: ${clean_layer}`);
  }

  // REGLA CONSTITUCIONAL: Reset ALL solo afecta PDE
  if (clean_layer !== 'pde') {
    logWarn('MASTER', 'Reset ALL debe usar clean_layer=pde según contrato', {
      traceId,
      clean_layer_provided: clean_layer
    });
    // No fallar, pero advertir (puede ser que se quiera resetear shared también en el futuro)
  }

  try {
    // 1. Obtener item para validar
    const catalogRepo = getDefaultAlquimiaCatalogRepo();
    const item = await catalogRepo.getItemByRef(item_ref);
    
    if (!item) {
      throw new Error(`Item no encontrado: ${item_ref}`);
    }

    // 2. Validar coherencia con lista
    const lista = await catalogRepo.getListaById(item.lista_id);
    if (!lista) {
      throw new Error(`Lista no encontrada para item: ${item_ref}`);
    }

    if (item_kind !== lista.tipo) {
      throw new Error(`item_kind no coincide con lista.tipo: item_kind=${item_kind}, lista.tipo=${lista.tipo}`);
    }

    // 3. Obtener todos los estudiantes activos (UUID-only)
    const { query } = await import('../../../../database/pg.js');
    const queryFn = client ? client.query.bind(client) : query;
    
    const studentsResult = await queryFn(`
      SELECT id AS student_uuid
      FROM students
      WHERE deleted_at IS NULL
      ORDER BY id
    `, []);
    
    const studentUuids = studentsResult.rows.map(row => row.student_uuid);
    const total = studentUuids.length;

    logInfo('MASTER', '[RESET][ALL] Estudiantes activos obtenidos', {
      traceId,
      item_ref,
      total_students: total
    });

    // 4. Resetear cada estudiante (excluyendo pausados)
    let applied = 0;
    let skipped = 0;
    const skippedBreakdown = {
      paused: 0,
      error: 0,
      other: 0
    };
    const layersAffected = [];

    for (const studentUuid of studentUuids) {
      try {
        const stateRepo = getDefaultCleaningItemStateRepo();
        
        // Verificar si está en pausa
        const isPaused = await isStudentPaused(studentUuid);
        if (isPaused) {
          skipped++;
          skippedBreakdown.paused++;
          continue;
        }

        // Resetear usando función canónica
        const resetResult = await resetStudentItemProgress({
          student_uuid: studentUuid,
          item_ref,
          item_kind,
          clean_layer,
          view_layer: null,
          product_key,
          domain_type,
          actor_type,
          actor_ref,
          surface_key,
          execution_mode,
          meta: {
            ...meta,
            scope: 'all',
            reset_all: true
          }
        }, client);

        if (resetResult.applied) {
          applied++;
          if (resetResult.layers_affected && resetResult.layers_affected.length > 0) {
            resetResult.layers_affected.forEach(layer => {
              if (!layersAffected.includes(layer)) {
                layersAffected.push(layer);
              }
            });
          }
        } else {
          skipped++;
          skippedBreakdown.other++;
        }
      } catch (studentError) {
        // Log error estructurado (mantener para debugging)
        logWarn('MASTER', 'Error reseteando estudiante en reset ALL (continuando)', {
          traceId,
          student_uuid: studentUuid,
          item_ref,
          error: studentError.message,
          error_code: studentError.code
        });
        skipped++;
        skippedBreakdown.error++;
      }
    }

    logInfo('MASTER', '[RESET][ALL][CANONICAL] Reset ALL completado', {
      traceId,
      item_ref,
      item_kind,
      clean_layer,
      applied,
      skipped,
      total,
      skipped_breakdown: skippedBreakdown,
      layers_affected: layersAffected
    });

    return {
      applied,
      skipped,
      total,
      skipped_breakdown: skippedBreakdown,
      layers_affected: layersAffected
    };
  } catch (error) {
    logError('MASTER', 'Error en resetAllStudentsItemProgress', {
      traceId,
      error: error.message,
      code: error.code,
      stack: error.stack,
      item_ref
    });
    throw error;
  }
}

/**
 * Reset unificado por scope (CANÓNICO v1)
 * 
 * Mapea reset_scope a funciones específicas:
 * - ITEM_STUDENT → resetStudentItemProgress()
 * - ITEM_ALL → resetAllStudentsItemProgress()
 * - LIST_STUDENT → iterar items + resetStudentItemProgress()
 * - LIST_ALL → iterar items + resetAllStudentsItemProgress()
 * 
 * REGLA CONSTITUCIONAL:
 * - effective_since = reset.created_at (timestamp del evento RESET)
 * - Reset SOLO modifica effective_since (NO modifica contadores directamente)
 * - days_since resultante = 0 (estado 'reseteado', no 'pending')
 * - Para llegar a 'pending': debe pasar tiempo hasta days_since >= threshold_days
 * - execution_key generado internamente (BACKEND-ONLY)
 * 
 * @param {Object} options - Opciones
 * @param {string} options.reset_scope - 'ITEM_STUDENT' | 'ITEM_ALL' | 'LIST_STUDENT' | 'LIST_ALL'
 * @param {string} [options.item_ref] - Referencia del item (requerido si scope incluye ITEM)
 * @param {string|number} [options.list_id] - ID de lista (requerido si scope incluye LIST)
 * @param {string} [options.student_uuid] - UUID del estudiante (requerido si scope incluye STUDENT)
 * @param {string} options.clean_layer - 'shared' | 'pde' (OBLIGATORIO)
 * @param {string} [options.reason] - Razón del reset (opcional, para auditoría)
 * @param {string} [options.product_key='pde'] - Clave del producto
 * @param {string} [options.domain_type='transmutation'] - Tipo de dominio
 * @param {string} [options.actor_type='master'] - Tipo de actor
 * @param {string} [options.surface_key='master.alquimia_general'] - Clave de superficie
 * @param {string} [options.execution_mode='APPLY'] - Modo de ejecución
 * @param {Object} [options.meta={}] - Metadatos adicionales
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Resultado con { applied, skipped, total, layers_affected, trace_id }
 */
export async function resetByScope(options, client = null) {
  const traceId = getRequestId();
  const {
    reset_scope,
    item_ref,
    list_id,
    student_uuid,
    clean_layer,
    reason,
    product_key = 'pde',
    domain_type = 'transmutation',
    actor_type = 'master',
    surface_key = 'master.alquimia_general',
    execution_mode = 'APPLY',
    meta = {}
  } = options;

  logInfo('MASTER', '[RESET][SCOPE][CANONICAL] resetByScope entrada', {
    traceId,
    reset_scope,
    item_ref,
    list_id,
    student_uuid,
    clean_layer,
    reason
  });

  // Validar reset_scope
  const validScopes = ['ITEM_STUDENT', 'ITEM_ALL', 'LIST_STUDENT', 'LIST_ALL'];
  if (!reset_scope || !validScopes.includes(reset_scope)) {
    throw new Error(`reset_scope debe ser uno de: ${validScopes.join(', ')}, recibido: ${reset_scope}`);
  }

  // Validar clean_layer obligatorio
  if (!clean_layer || (clean_layer !== 'shared' && clean_layer !== 'pde')) {
    throw new Error(`clean_layer es obligatorio y debe ser 'shared' o 'pde', recibido: ${clean_layer}`);
  }

  // Validaciones según scope
  if (reset_scope === 'ITEM_STUDENT' || reset_scope === 'ITEM_ALL') {
    if (!item_ref) {
      throw new Error('item_ref es obligatorio para reset_scope que incluye ITEM');
    }
  }

  if (reset_scope === 'LIST_STUDENT' || reset_scope === 'LIST_ALL') {
    if (!list_id) {
      throw new Error('list_id es obligatorio para reset_scope que incluye LIST');
    }
  }

  if (reset_scope === 'ITEM_STUDENT' || reset_scope === 'LIST_STUDENT') {
    if (!student_uuid) {
      throw new Error('student_uuid es obligatorio para reset_scope que incluye STUDENT');
    }
  }

  try {
    const catalogRepo = getDefaultAlquimiaCatalogRepo();
    let totalApplied = 0;
    let totalSkipped = 0;
    const allLayersAffected = [];
    const results = [];
    let totalItems = null; // Para LIST_STUDENT y LIST_ALL

    // Mapeo de scopes a funciones
    if (reset_scope === 'ITEM_STUDENT') {
      // ITEM_STUDENT: Reset item para estudiante específico
      const result = await resetStudentItemProgress({
        student_uuid,
        item_ref,
        item_kind: 'recurrente', // Reset solo para recurrente
        clean_layer,
        product_key,
        domain_type,
        actor_type,
        surface_key,
        execution_mode,
        meta: {
          ...meta,
          reset_scope,
          reason
        }
      }, client);

      totalApplied += result.applied ? 1 : 0;
      totalSkipped += result.skipped || 0;
      if (result.layers_affected) {
        allLayersAffected.push(...result.layers_affected);
      }
      results.push(result);

    } else if (reset_scope === 'ITEM_ALL') {
      // ITEM_ALL: Reset item para todos los estudiantes
      const result = await resetAllStudentsItemProgress({
        item_ref,
        item_kind: 'recurrente', // Reset solo para recurrente
        clean_layer,
        product_key,
        domain_type,
        actor_type,
        surface_key,
        execution_mode,
        meta: {
          ...meta,
          reset_scope,
          reason
        }
      }, client);

      totalApplied += result.applied || 0;
      totalSkipped += result.skipped || 0;
      if (result.layers_affected) {
        allLayersAffected.push(...result.layers_affected);
      }
      results.push(result);

    } else if (reset_scope === 'LIST_STUDENT') {
      // LIST_STUDENT: Reset lista para estudiante específico (iterar items)
      const items = await catalogRepo.listItems(list_id, { onlyActive: true });
      
      // Calcular total_items (solo recurrentes)
      totalItems = items.filter(item => item.tipo === 'recurrente').length;
      
      logInfo('MASTER', '[RESET][SCOPE][LIST_STUDENT] Items obtenidos', {
        traceId,
        list_id,
        items_count: items.length,
        total_items_recurrentes: totalItems,
        student_uuid
      });

      for (const item of items) {
        // Solo resetear items recurrentes
        if (item.tipo !== 'recurrente') {
          logInfo('MASTER', '[RESET][SCOPE][LIST_STUDENT] Item saltado (no recurrente)', {
            traceId,
            item_ref: item.item_ref,
            item_tipo: item.tipo
          });
          continue;
        }

        const result = await resetStudentItemProgress({
          student_uuid,
          item_ref: item.item_ref,
          item_kind: 'recurrente',
          clean_layer,
          product_key,
          domain_type,
          actor_type,
          surface_key,
          execution_mode,
          meta: {
            ...meta,
            reset_scope,
            list_id,
            reason
          }
        }, client);

        totalApplied += result.applied ? 1 : 0;
        totalSkipped += result.skipped || 0;
        if (result.layers_affected) {
          allLayersAffected.push(...result.layers_affected);
        }
        results.push({ item_ref: item.item_ref, ...result });
      }

    } else if (reset_scope === 'LIST_ALL') {
      // LIST_ALL: Reset lista para todos los estudiantes (iterar items + students)
      const items = await catalogRepo.listItems(list_id, { onlyActive: true });
      
      // Calcular total_items (solo recurrentes)
      totalItems = items.filter(item => item.tipo === 'recurrente').length;
      
      logInfo('MASTER', '[RESET][SCOPE][LIST_ALL] Items obtenidos', {
        traceId,
        list_id,
        items_count: items.length,
        total_items_recurrentes: totalItems
      });

      for (const item of items) {
        // Solo resetear items recurrentes
        if (item.tipo !== 'recurrente') {
          logInfo('MASTER', '[RESET][SCOPE][LIST_ALL] Item saltado (no recurrente)', {
            traceId,
            item_ref: item.item_ref,
            item_tipo: item.tipo
          });
          continue;
        }

        const result = await resetAllStudentsItemProgress({
          item_ref: item.item_ref,
          item_kind: 'recurrente',
          clean_layer,
          product_key,
          domain_type,
          actor_type,
          surface_key,
          execution_mode,
          meta: {
            ...meta,
            reset_scope,
            list_id,
            reason
          }
        }, client);

        totalApplied += result.applied || 0;
        totalSkipped += result.skipped || 0;
        if (result.layers_affected) {
          allLayersAffected.push(...result.layers_affected);
        }
        results.push({ item_ref: item.item_ref, ...result });
      }
    }

    // Eliminar duplicados de layers_affected
    const uniqueLayersAffected = [...new Set(allLayersAffected)];

    logInfo('MASTER', '[RESET][SCOPE][CANONICAL] resetByScope completado', {
      traceId,
      reset_scope,
      total_applied: totalApplied,
      total_skipped: totalSkipped,
      total_items: totalItems,
      layers_affected: uniqueLayersAffected,
      items_processed: results.length
    });

    const response = {
      applied: totalApplied > 0,
      skipped: totalSkipped,
      total: totalApplied + totalSkipped,
      layers_affected: uniqueLayersAffected,
      trace_id: traceId,
      results: results.length > 1 ? results : (results[0] || {})
    };

    // Incluir total_items solo para LIST_STUDENT y LIST_ALL
    if (totalItems !== null) {
      response.total_items = totalItems;
    }

    return response;

  } catch (error) {
    logError('MASTER', 'Error en resetByScope', {
      traceId,
      error: error.message,
      code: error.code,
      stack: error.stack,
      reset_scope,
      item_ref,
      list_id,
      student_uuid
    });
    throw error;
  }
}
