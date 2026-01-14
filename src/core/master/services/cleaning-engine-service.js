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

/**
 * Genera execution_key para idempotencia (APPLY) o certificación (CERTIFY)
 * 
 * REGLA CANÓNICA: Idempotencia por clean_layer en RECURRENTE
 * - RECURRENTE: {action_type}:{item_ref}:{student_uuid}:{clean_layer}:{timestamp_day}
 * - UNA_VEZ: {action_type}:{item_ref}:{student_uuid}:{timestamp_day} (sin clean_layer, combo suma)
 * 
 * APPLY: Formato idempotente (por día y capa para RECURRENTE)
 * CERTIFY: Formato no idempotente (timestamp completo)
 * 
 * @param {string} actionType - Tipo de acción ('mark_clean', etc.)
 * @param {string} itemRef - Referencia del item
 * @param {string} studentUuid - UUID del estudiante
 * @param {Date} timestamp - Timestamp
 * @param {string} executionMode - 'APPLY' (idempotente) o 'CERTIFY' (no idempotente)
 * @param {string} itemKind - 'recurrente' | 'una_vez'
 * @param {string} cleanLayer - 'shared' | 'pde' (solo para RECURRENTE)
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
    logWarn('CleaningEngine', 'Error verificando pausa (fail-open: no pausado)', {
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
    logWarn('CleaningEngine', 'Error obteniendo nivel efectivo (fail-open: nivel 1)', {
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
  
    logInfo('CleaningEngine', '[CLEAN][WRITE] markCleanStudent entrada', {
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
    logError('CleaningEngine', 'Intento de usar legacy_alumno_id en runtime UUID-only', {
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
      logInfo('CleaningEngine', 'Alumno en pausa, excluido', {
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
        logInfo('CleaningEngine', 'Master Override aplicado (level_cap_override)', {
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
        logInfo('CleaningEngine', 'Item no aplica por nivel', {
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
      logInfo('CleaningEngine', '[MASTER][CLEANING] Nivel ignorado por autoridad MASTER', {
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
      logError('CleaningEngine', 'item_kind no coincide con lista.tipo (ERROR)', {
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
      logInfo('CleaningEngine', 'MASTER UNA_VEZ: usando CERTIFY para permitir múltiples incrementos', {
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
    
    logInfo('CleaningEngine', '[CLEAN][IDEMPOTENCY] execution_key generado', {
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
    
    const eventResult = await eventsRepo.insertEvent(eventData, client);
    
    logInfo('CleaningEngine', 'evento insertado', {
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
      // Obtener estado actual para verificar days_since_last_clean de la capa
      const stateRepo = getDefaultCleaningItemStateRepo();
      const currentState = await stateRepo.getState({
        student_uuid,
        product_key,
        domain_type,
        item_ref
      }, client);
      
      // Calcular days_since_last_clean de la capa correspondiente
      let daysSinceLastClean = null;
      if (itemKind === 'recurrente') {
        if (clean_layer === 'shared') {
          daysSinceLastClean = currentState?.shared_days_since_last_clean ?? null;
        } else if (clean_layer === 'pde') {
          daysSinceLastClean = currentState?.pde_days_since_last_clean ?? null;
        }
      }
      
      logInfo('CleaningEngine', '[CLEAN][IDEMPOTENCY] Evento ya aplicado (idempotencia por capa)', {
        traceId,
        execution_key: executionKey,
        execution_mode: effectiveExecutionMode,
        student_uuid,
        item_ref,
        item_kind: itemKind,
        clean_layer,
        days_since_last_clean: daysSinceLastClean,
        allowed: false, // No se permite limpiar la misma capa el mismo día
        idempotency_by_layer: itemKind === 'recurrente' ? true : false
      });
      
      // Devolver estado actual (repositorio resuelve legacy_id internamente)
      return currentState;
    }
    
    // 7. Aplicar a proyección cleaning_item_state (repositorio resuelve legacy_id internamente)
    const stateRepo = getDefaultCleaningItemStateRepo();
    let state;
    
    logInfo('CleaningEngine', 'Aplicando proyección', {
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
      logInfo('CleaningEngine', 'Recurrente: usando upsertApplyRecurrent', {
        traceId,
        clean_layer,
        capa: clean_layer === 'shared' ? 'SHARED' : 'PDE'
      });
      state = await stateRepo.upsertApplyRecurrent({
        student_uuid,
        product_key,
        domain_type,
        item_ref,
        clean_layer,
        cleaned_at: new Date()
      }, client);
    } else {
      // Una vez: usar método según clean_layer (SIMÉTRICO)
      if (clean_layer === 'pde') {
        // PDE: incrementar pde_clean_count y recalcular pde_remaining/pde_completed (simétrico a SHARED)
        const requiredCount = item.veces_limpiar || 1;
        logInfo('CleaningEngine', 'Una vez PDE: usando upsertApplyOneTimeIncrementPde', {
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
        logInfo('CleaningEngine', 'Una vez SHARED: usando upsertApplyOneTimeIncrementShared', {
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
    
    logInfo('CleaningEngine', '[CLEAN][WRITE] Proyección aplicada', {
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
    // UUID-ONLY: syncToStudentItemState() ELIMINADA
    // NO se sincroniza student_item_state (tabla histórica)
    // ============================================================================
    
    // 8. Emitir señales (fail-open) - UUID-only
    try {
      const { emitSignal } = await import('../../services/pde-signal-emitter.js');
      
      await emitSignal('clean.executed', {
        signal: 'clean.executed',
        scope: 'student',
        student_uuid, // UUID canónico (único identificador)
        item_id: item.id,
        item_ref,
        domain: domain_type,
        product_key,
        source: actor_type,
        clean_layer,
        executed_at: new Date().toISOString()
      }, {}, {}, {
        trace_id: traceId,
        source: 'cleaning-engine-service',
        action: 'markCleanStudent'
      });
    } catch (signalError) {
      logWarn('CleaningEngine', 'Error emitiendo señales (fail-open)', {
        traceId,
        error: signalError.message,
        student_uuid,
        item_ref
      });
    }
    
    logInfo('CleaningEngine', '[CLEAN][WRITE] Limpieza aplicada correctamente', {
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
    
    return state;
  } catch (error) {
    logError('CleaningEngine', 'Error en markCleanStudent', {
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

  logInfo('CleaningEngine', 'markCleanAllStudents entrada', {
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
      logError('CleaningEngine', 'item_kind no coincide con lista.tipo en markCleanAllStudents (ERROR)', {
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
    let skippedAlreadyClean = 0; // Separado de omitted
    const skippedBreakdown = {
      paused: 0,
      not_applicable_level: 0,
      already_clean: 0,
      missing_item: 0,
      no_change: 0,
      error: 0,
      other: 0
    };
    
    // Helper para verificar si ya está limpio (solo para recurrentes)
    const stateRepo = getDefaultCleaningItemStateRepo();
    
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
          logInfo('CleaningEngine', '[MASTER][CLEANING] Nivel ignorado por autoridad MASTER', {
            traceId,
            student_uuid: studentUuid,
            item_ref,
            item_nivel: itemNivel,
            actor_type,
            surface_key
          });
        }
        
        // Para recurrentes: verificar si ya está limpio (mismo día) antes de llamar a markCleanStudent
        // REGLA CANÓNICA: Idempotencia por clean_layer (SHARED y PDE son independientes)
        if (itemKind === 'recurrente') {
          const currentState = await stateRepo.getState({
            student_uuid: studentUuid,
            product_key,
            domain_type,
            item_ref
          }, client);
          
          if (currentState) {
            // Obtener last_cleaned_at de la capa correspondiente
            const lastCleanedAt = clean_layer === 'shared' 
              ? currentState.shared_last_cleaned_at 
              : currentState.pde_last_cleaned_at;
            
            // Calcular days_since_last_clean de la capa correspondiente
            let daysSinceLastClean = null;
            if (clean_layer === 'shared') {
              daysSinceLastClean = currentState.shared_days_since_last_clean ?? null;
            } else if (clean_layer === 'pde') {
              daysSinceLastClean = currentState.pde_days_since_last_clean ?? null;
            }
            
            if (lastCleanedAt) {
              const lastCleanedDate = new Date(lastCleanedAt);
              const today = new Date();
              const isSameDay = lastCleanedDate.getFullYear() === today.getFullYear() &&
                               lastCleanedDate.getMonth() === today.getMonth() &&
                               lastCleanedDate.getDate() === today.getDate();
              
              if (isSameDay) {
                // Ya está limpio hoy (mismo día) en esta capa - NO es "omitido", es "skipped_already_clean"
                logInfo('CleaningEngine', '[CLEAN][IDEMPOTENCY] Ya limpio hoy en esta capa (markCleanAllStudents)', {
                  traceId,
                  student_uuid: studentUuid,
                  item_ref,
                  clean_layer,
                  days_since_last_clean: daysSinceLastClean,
                  allowed: false,
                  idempotency_by_layer: true
                });
                skippedAlreadyClean++;
                skippedBreakdown.already_clean++;
                continue; // No llamar a markCleanStudent
              }
            }
          }
        }
        
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
        logWarn('CleaningEngine', 'Error en markCleanStudent individual (continuando)', {
          traceId,
          student_uuid: studentUuid,
          item_ref,
          error: error.message
        });
        skipped++;
        skippedBreakdown.error++;
      }
    }
    
    logInfo('CleaningEngine', 'markCleanAllStudents completado', {
      traceId,
      item_ref,
      item_kind: itemKind,
      clean_layer,
      isMasterSurface: actor_type === 'master' && (surface_key?.startsWith('master.') || skip_level_filter),
      skip_level_filter,
      total: activeStudentUuids.length,
      updated,
      skipped,
      skipped_already_clean: skippedAlreadyClean,
      skipped_breakdown: skippedBreakdown
    });
    
    logInfo('CleaningEngine', 'Limpieza global completada', {
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
      skipped_already_clean: skippedAlreadyClean, // Separado de omitted
      total: activeStudentUuids.length,
      skipped_breakdown: skippedBreakdown
    };
  } catch (error) {
    logError('CleaningEngine', 'Error en markCleanAllStudents', {
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
  
  logInfo('CleaningEngine', 'incrementAllStudents entrada', {
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
    logWarn('CleaningEngine', 'DEPRECATED: incrementAllStudents llamado sin item_kind. Usando fallback "una_vez". Esto será un error en v5.66.0', {
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
    logInfo('CleaningEngine', 'MASTER UNA_VEZ incrementAll: usando CERTIFY para permitir múltiples incrementos', {
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
    logError('CleaningEngine', 'Intento de usar legacy_alumno_id en setRemainingShared', {
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
      logInfo('CleaningEngine', 'Alumno en pausa, excluido', {
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
    
    // Manejar idempotencia: ya sea 'already_applied' (legacy) o { already_executed: true } (nuevo)
    if (eventResult === 'already_applied' || (eventResult && eventResult.already_executed === true)) {
      logInfo('CleaningEngine', 'Evento ya aplicado (idempotencia)', {
        traceId,
        execution_key: executionKey,
        student_uuid,
        item_ref
      });
      // Devolver estado actual (repositorio resuelve legacy_id internamente)
      const stateRepo = getDefaultCleaningItemStateRepo();
      return await stateRepo.getState({
        student_uuid,
        product_key,
        domain_type,
        item_ref
      }, client);
    }
    
    // 6. Aplicar a proyección (repositorio resuelve legacy_id internamente)
    const stateRepo = getDefaultCleaningItemStateRepo();
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
    
    logInfo('CleaningEngine', 'Remaining establecido correctamente', {
      traceId,
      student_uuid,
      item_ref,
      remaining
    });
    
    return state;
  } catch (error) {
    logError('CleaningEngine', 'Error en setRemainingShared', {
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
