// src/core/master/services/cleaning-engine-service.js
// Cleaning Engine v1 - Single Decider para limpiezas
//
// RESPONSABILIDADES:
// - Validar inputs (item_ref existente, item tipo, required_count para una_vez, etc.)
// - Resolver alumno paused (y excluir)
// - Insert event (idempotente)
// - Aplicar a proyección cleaning_item_state
// - Si clean_layer='shared', sincronizar a student_item_state (compat)
// - Emitir señales (fail-open)
//
// REGLAS CONSTITUCIONALES:
// - PostgreSQL es el único Source of Truth
// - Cleaning Engine es el único decisor de estado de limpieza
// - UI solo muestra, no decide
// - Exclusión obligatoria de alumnos en PAUSA
// - Idempotencia vía execution_key

import { getDefaultCleaningEventsRepo } from '../../../infra/repos/cleaning/cleaning-events-repo-pg.js';
import { getDefaultCleaningItemStateRepo } from '../../../infra/repos/cleaning/cleaning-item-state-repo-pg.js';
import { getDefaultPausaRepo } from '../../../infra/repos/pausa-repo-pg.js';
import { getDefaultAlquimiaCatalogRepo } from '../../../infra/repos/alquimia-catalog-repo-pg.js';
import { getDefaultMasterStudentTransmutationReadRepo } from '../../../infra/repos/master-student-transmutation-read-repo-pg.js';
import { getDefaultStudentLevelStateRepo } from '../../../infra/repos/levels/student-level-state-repo-pg.js';
import { getRequestId } from '../../observability/request-context.js';
import { logError, logInfo, logWarn } from '../../observability/logger.js';
import { randomUUID } from 'crypto';

/**
 * Genera execution_key para idempotencia
 * Formato: {action_type}:{item_ref}:{student_id}:{timestamp_day}
 */
function generateExecutionKey(actionType, itemRef, studentId, timestamp = new Date()) {
  const day = timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
  return `${actionType}:${itemRef}:${studentId}:${day}`;
}

/**
 * Verifica si un alumno está en pausa
 * 
 * @param {number} studentId - ID del alumno (legacy alumnos.id)
 * @returns {Promise<boolean>} true si está en pausa
 */
async function isStudentPaused(studentId) {
  if (!studentId) return false;
  
  try {
    const pausaRepo = getDefaultPausaRepo();
    const pausaActiva = await pausaRepo.getPausaActiva(studentId);
    return !!pausaActiva;
  } catch (error) {
    logWarn('CleaningEngine', 'Error verificando pausa (fail-open: no pausado)', {
      student_id: studentId,
      error: error.message
    });
    // Fail-open: si no se puede verificar, asumir no pausado
    return false;
  }
}

/**
 * Obtiene nivel efectivo del alumno desde Level Engine
 * 
 * @param {number} studentId - ID del alumno (legacy alumnos.id)
 * @param {string} lineKey - Clave de línea (default: 'pde')
 * @returns {Promise<number>} Nivel efectivo (default: 1 si no existe)
 */
export async function getStudentEffectiveLevel(studentId, lineKey = 'pde') {
  if (!studentId) return 1;
  
  try {
    // Obtener UUID del alumno desde tabla students (si existe link)
    const { query } = await import('../../../../database/pg.js');
    const studentResult = await query(
      'SELECT id FROM students WHERE legacy_alumno_id = $1 LIMIT 1',
      [studentId]
    );
    
    if (!studentResult.rows[0]) {
      // Si no hay link a students, usar nivel 1 por defecto
      logWarn('CleaningEngine', 'Student UUID no encontrado, usando nivel 1', {
        legacy_student_id: studentId
      });
      return 1;
    }
    
    const studentUuid = studentResult.rows[0].id;
    
    // Obtener estado desde Level Engine
    const levelStateRepo = getDefaultStudentLevelStateRepo();
    const state = await levelStateRepo.getByStudentAndLine(studentUuid, lineKey);
    
    if (!state || !state.current_level_number) {
      return 1; // Default nivel 1
    }
    
    return state.current_level_number;
  } catch (error) {
    logWarn('CleaningEngine', 'Error obteniendo nivel efectivo (fail-open: nivel 1)', {
      student_id: studentId,
      error: error.message
    });
    // Fail-open: si no se puede obtener, usar nivel 1
    return 1;
  }
}

/**
 * Sincroniza estado SHARED a student_item_state (compatibilidad)
 * 
 * @param {Object} options - Opciones
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 */
async function syncToStudentItemState(options, client = null) {
  if (options.clean_layer !== 'shared') {
    return; // Solo sincronizar SHARED
  }
  
  try {
    const studentRepo = getDefaultMasterStudentTransmutationReadRepo();
    const domainKey = 'transmutaciones_energeticas';
    
    if (options.item_kind === 'recurrente') {
      // Para recurrentes: actualizar last_cleaned_at y clean_count
      // Nota: student_item_state usa item_id, no item_ref
      // Necesitamos resolver item_ref -> item_id
      const catalogRepo = getDefaultAlquimiaCatalogRepo();
      const item = await catalogRepo.getItemByRef(options.item_ref);
      
      if (!item || !item.id) {
        logWarn('CleaningEngine', 'Item no encontrado para sync (skip)', {
          item_ref: options.item_ref
        });
        return;
      }
      
      // Usar método existente del repo (si existe) o query directa
      // Por ahora, solo logueamos que debería sincronizarse
      logInfo('CleaningEngine', 'Sync a student_item_state (recurrente) - pendiente implementación directa', {
        student_id: options.student_id,
        item_id: item.id,
        item_ref: options.item_ref
      });
    } else {
      // Para una_vez: actualizar remaining y completed
      logInfo('CleaningEngine', 'Sync a student_item_state (una_vez) - pendiente implementación directa', {
        student_id: options.student_id,
        item_ref: options.item_ref
      });
    }
  } catch (error) {
    // Fail-open: no fallar si sync falla
    logWarn('CleaningEngine', 'Error en sync a student_item_state (fail-open)', {
      error: error.message,
      student_id: options.student_id,
      item_ref: options.item_ref
    });
  }
}

/**
 * Marca limpio un alumno específico (recurrente o una_vez)
 * 
 * @param {Object} options - Opciones
 * @param {number} options.student_id - ID del alumno
 * @param {string} options.item_ref - Referencia del item
 * @param {string} [options.clean_layer='shared'] - Capa de limpieza ('shared' | 'pde')
 * @param {string} [options.product_key='pde'] - Clave del producto
 * @param {string} [options.domain_type='transmutation'] - Tipo de dominio
 * @param {string} options.actor_type - Tipo de actor ('master' | 'student' | 'automation')
 * @param {string} [options.actor_ref] - Referencia del actor
 * @param {string} [options.surface_key] - Superficie de origen
 * @param {Object} [options.meta={}] - Metadatos adicionales
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object|null>} Estado actualizado o null si está pausado/no aplica
 */
export async function markCleanStudent(options, client = null) {
  const traceId = getRequestId();
  const {
    student_id,
    item_ref,
    clean_layer = 'shared',
    product_key = 'pde',
    domain_type = 'transmutation',
    actor_type,
    actor_ref = null,
    surface_key = null,
    meta = {}
  } = options;
  
  if (!student_id || !item_ref || !actor_type) {
    throw new Error('student_id, item_ref y actor_type son requeridos');
  }
  
  try {
    // 1. Verificar si alumno está en pausa
    const isPaused = await isStudentPaused(student_id);
    if (isPaused) {
      logInfo('CleaningEngine', 'Alumno en pausa, excluido', {
        traceId,
        student_id,
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
    const nivelEfectivo = await getStudentEffectiveLevel(student_id);
    if (item.nivel && item.nivel > nivelEfectivo) {
      logInfo('CleaningEngine', 'Item no aplica por nivel', {
        traceId,
        student_id,
        item_ref,
        item_nivel: item.nivel,
        nivel_efectivo: nivelEfectivo
      });
      return null; // No aplica, pero no es error
    }
    
    // 4. Determinar item_kind desde lista
    const lista = await catalogRepo.getListaById(item.lista_id);
    if (!lista) {
      throw new Error(`Lista no encontrada para item: ${item_ref}`);
    }
    
    const itemKind = lista.tipo; // 'recurrente' o 'una_vez'
    
    // 5. Generar execution_key para idempotencia
    const executionKey = generateExecutionKey('mark_clean', item_ref, student_id);
    
    // 6. Insertar evento
    const eventsRepo = getDefaultCleaningEventsRepo();
    const eventData = {
      trace_id: traceId,
      execution_key: executionKey,
      student_id,
      product_key,
      domain_type,
      item_ref,
      clean_layer,
      item_kind: itemKind, // Usar itemKind (definido arriba)
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
        nivel_efectivo: nivelEfectivo
      }
    };
    
    const eventResult = await eventsRepo.insertEvent(eventData, client);
    
    if (eventResult === 'already_applied') {
      logInfo('CleaningEngine', 'Evento ya aplicado (idempotencia)', {
        traceId,
        execution_key: executionKey,
        student_id,
        item_ref
      });
      // Devolver estado actual
      const stateRepo = getDefaultCleaningItemStateRepo();
      return await stateRepo.getState({
        student_id,
        product_key,
        domain_type,
        item_ref
      }, client);
    }
    
    // 7. Aplicar a proyección cleaning_item_state
    const stateRepo = getDefaultCleaningItemStateRepo();
    let state;
    
    if (itemKind === 'recurrente') {
      // Recurrente: actualizar last_cleaned_at y clean_count
      state = await stateRepo.upsertApplyRecurrent({
        student_id,
        product_key,
        domain_type,
        item_ref,
        clean_layer,
        cleaned_at: new Date()
      }, client);
    } else {
      // Una vez: incrementar completed y decrementar remaining
      const requiredCount = item.veces_limpiar || 1;
      state = await stateRepo.upsertApplyOneTimeIncrementShared({
        student_id,
        product_key,
        domain_type,
        item_ref,
        required_count: requiredCount
      }, client);
    }
    
    // 8. Sincronizar a student_item_state si clean_layer='shared' (compat)
    if (clean_layer === 'shared') {
      await syncToStudentItemState({
        ...options,
        item_kind,
        item_id: item.id
      }, client);
    }
    
    // 9. Emitir señales (fail-open)
    try {
      const { emitSignal } = await import('../../services/pde-signal-emitter.js');
      
      await emitSignal('clean.executed', {
        signal: 'clean.executed',
        scope: 'student',
        student_id,
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
        student_id,
        item_ref
      });
    }
    
    logInfo('CleaningEngine', 'Limpieza aplicada correctamente', {
      traceId,
      student_id,
      item_ref,
      clean_layer,
      item_kind
    });
    
    return state;
  } catch (error) {
    logError('CleaningEngine', 'Error en markCleanStudent', {
      traceId,
      error: error.message,
      code: error.code,
      stack: error.stack,
      student_id,
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
    meta = {}
  } = options;
  
  if (!item_ref || !actor_type) {
    throw new Error('item_ref y actor_type son requeridos');
  }
  
  try {
    // 1. Obtener item para validar
    const catalogRepo = getDefaultAlquimiaCatalogRepo();
    const item = await catalogRepo.getItemByRef(item_ref);
    
    if (!item) {
      throw new Error(`Item no encontrado: ${item_ref}`);
    }
    
    // 2. Obtener lista para conocer tipo
    const lista = await catalogRepo.getListaById(item.lista_id);
    if (!lista) {
      throw new Error(`Lista no encontrada para item: ${item_ref}`);
    }
    
    const itemKind = lista.tipo;
    
    // 3. Obtener todos los alumnos (no paused)
    const { query } = await import('../../../../database/pg.js');
    const queryFn = client ? client.query.bind(client) : query;
    
    const alumnosResult = await queryFn('SELECT id FROM alumnos', []);
    const allStudentIds = alumnosResult.rows.map(row => row.id);
    
    // 4. Filtrar alumnos no pausados
    const activeStudentIds = [];
    for (const studentId of allStudentIds) {
      const isPaused = await isStudentPaused(studentId);
      if (!isPaused) {
        activeStudentIds.push(studentId);
      }
    }
    
    // 5. Obtener nivel del item para verificación
    const itemNivel = item.nivel || 999;
    
    // 6. Aplicar limpieza a cada alumno activo con breakdown de razones
    let updated = 0;
    let skipped = 0;
    const skippedBreakdown = {
      paused: 0,
      not_applicable_level: 0,
      already_clean: 0,
      missing_item: 0,
      no_change: 0,
      error: 0,
      other: 0
    };
    
    for (const studentId of activeStudentIds) {
      try {
        // Verificar si aplica por nivel antes de limpiar
        const nivelEfectivo = await getStudentEffectiveLevel(studentId, product_key);
        
        if (nivelEfectivo < itemNivel) {
          skipped++;
          skippedBreakdown.not_applicable_level++;
          continue;
        }
        
        const result = await markCleanStudent({
          student_id: studentId,
          item_ref,
          clean_layer,
          product_key,
          domain_type,
          actor_type,
          actor_ref,
          surface_key,
          meta
        }, client);
        
        if (result) {
          updated++;
        } else {
          skipped++;
          skippedBreakdown.no_change++; // Ya estaba limpio o idempotencia
        }
      } catch (error) {
        logWarn('CleaningEngine', 'Error en markCleanStudent individual (continuando)', {
          traceId,
          student_id: studentId,
          item_ref,
          error: error.message
        });
        skipped++;
        skippedBreakdown.error++;
      }
    }
    
    logInfo('CleaningEngine', 'Limpieza global completada', {
      traceId,
      item_ref,
      clean_layer,
      item_kind: itemKind,
      item_id: item.id,
      item_nivel: itemNivel,
      total: activeStudentIds.length,
      updated,
      skipped,
      skipped_breakdown: skippedBreakdown
    });
    
    return { 
      updated, 
      skipped, 
      total: activeStudentIds.length,
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
  // Por ahora, reutilizamos markCleanAllStudents con item_kind='una_vez'
  // (se detecta automáticamente desde la lista)
  return await markCleanAllStudents({
    ...options,
    clean_layer: 'shared' // Solo SHARED para increment-all
  }, client);
}

/**
 * Establece remaining directamente para un alumno (una_vez, solo SHARED)
 * 
 * @param {Object} options - Opciones
 * @param {number} options.student_id - ID del alumno
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
    student_id,
    item_ref,
    remaining,
    product_key = 'pde',
    domain_type = 'transmutation',
    actor_type,
    actor_ref = null,
    surface_key = null,
    meta = {}
  } = options;
  
  if (!student_id || !item_ref || remaining === undefined || !actor_type) {
    throw new Error('student_id, item_ref, remaining y actor_type son requeridos');
  }
  
  try {
    // 1. Verificar si alumno está en pausa
    const isPaused = await isStudentPaused(student_id);
    if (isPaused) {
      logInfo('CleaningEngine', 'Alumno en pausa, excluido', {
        traceId,
        student_id,
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
    
    // 4. Generar execution_key para idempotencia
    const executionKey = generateExecutionKey('set_remaining', item_ref, student_id);
    
    // 5. Insertar evento
    const eventsRepo = getDefaultCleaningEventsRepo();
    const eventData = {
      trace_id: traceId,
      execution_key: executionKey,
      student_id,
      product_key,
      domain_type,
      item_ref,
      clean_layer: 'shared', // Solo SHARED para set_remaining
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
    
    if (eventResult === 'already_applied') {
      logInfo('CleaningEngine', 'Evento ya aplicado (idempotencia)', {
        traceId,
        execution_key: executionKey,
        student_id,
        item_ref
      });
      // Devolver estado actual
      const stateRepo = getDefaultCleaningItemStateRepo();
      return await stateRepo.getState({
        student_id,
        product_key,
        domain_type,
        item_ref
      }, client);
    }
    
    // 6. Aplicar a proyección
    const stateRepo = getDefaultCleaningItemStateRepo();
    const state = await stateRepo.upsertApplyOneTimeSetRemainingShared({
      student_id,
      product_key,
      domain_type,
      item_ref,
      remaining
    }, client);
    
    // 7. Sincronizar a student_item_state (compat)
    await syncToStudentItemState({
      ...options,
      item_kind: 'una_vez',
      item_id: item.id
    }, client);
    
    logInfo('CleaningEngine', 'Remaining establecido correctamente', {
      traceId,
      student_id,
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
      student_id,
      item_ref
    });
    throw error;
  }
}
