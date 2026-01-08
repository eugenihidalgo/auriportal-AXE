// src/core/master/services/level-engine-service.js
// Level Engine PDE v1 - Servicio Canónico
//
// RESPONSABILIDADES:
// - ensureLineStarted: crear state si no existe
// - computeAndPersist: calcular y persistir estado
// - getStudentLevels: obtener estados por línea
// - recomputeStudent: forzar recompute
// - resolveStudentStartDate: resolver fecha de inicio (students.created_at o legacy)
// - Consultar student_operational_state para congelar conteo
// - Calcular nivel y fase según min_days
// - Persistir estado e historial
// - Emitir señales cuando hay cambios

import { getDefaultLevelLinesRepo } from '../../../infra/repos/levels/level-lines-repo-pg.js';
import { getDefaultLevelDefinitionsRepo } from '../../../infra/repos/levels/level-definitions-repo-pg.js';
import { getDefaultPhaseDefinitionsRepo } from '../../../infra/repos/levels/phase-definitions-repo-pg.js';
import { getDefaultLevelGatesRepo } from '../../../infra/repos/levels/level-gates-repo-pg.js';
import { getDefaultStudentLevelStateRepo } from '../../../infra/repos/levels/student-level-state-repo-pg.js';
import { getDefaultStudentLevelHistoryRepo } from '../../../infra/repos/levels/student-level-history-repo-pg.js';
import { getDefaultStudentOperationalStateRepo } from '../../../infra/repos/student-operational-state-repo-pg.js';
import { getDefaultStudentRepo } from '../../../infra/repos/student-repo-pg.js';
import { dispatchSignal } from '../../signals/signal-dispatcher.js';
import { query, getPool } from '../../../../database/pg.js';
import { getRequestId } from '../../observability/request-context.js';
import { logInfo, logWarn, logError } from '../../observability/logger.js';
import { randomUUID } from 'crypto';

/**
 * Resuelve la fecha de inicio de un alumno para una línea específica.
 * Para línea 'pde': fecha alta en AuriPortal (students.created_at o legacy alumnos.fecha_inscripcion).
 * 
 * @param {string} studentId - UUID del alumno
 * @param {string} lineKey - Clave de la línea (ej: 'pde')
 * @returns {Promise<Date>} Fecha de inicio
 */
async function resolveStudentStartDate(studentId, lineKey) {
  if (lineKey === 'pde') {
    // Para PDE: fecha alta en AuriPortal
    // Prioridad 1: students.created_at
    // Prioridad 2: legacy alumnos.fecha_inscripcion (si link existe)
    // Fallback: now() (registrar en meta)
    
    const studentRepo = getDefaultStudentRepo();
    const student = await studentRepo.getById(studentId);
    
    if (!student) {
      logWarn('LevelEngine', 'Student no encontrado para resolver fecha de inicio', { student_id: studentId, line_key: lineKey });
      return new Date(); // Fallback: ahora
    }
    
    // Intentar students.created_at
    if (student.created_at) {
      return new Date(student.created_at);
    }
    
    // Intentar legacy alumnos.fecha_inscripcion si existe link
    if (student.legacy_alumno_id) {
      try {
        const legacyResult = await query(
          'SELECT fecha_inscripcion FROM alumnos WHERE id = $1',
          [student.legacy_alumno_id]
        );
        if (legacyResult.rows[0] && legacyResult.rows[0].fecha_inscripcion) {
          const legacyDate = legacyResult.rows[0].fecha_inscripcion;
          logInfo('LevelEngine', 'Usando fecha legacy alumnos.fecha_inscripcion', {
            student_id: studentId,
            legacy_alumno_id: student.legacy_alumno_id,
            fecha_inscripcion: legacyDate
          });
          return new Date(legacyDate);
        }
      } catch (error) {
        logWarn('LevelEngine', 'Error consultando legacy alumnos (continuando)', {
          student_id: studentId,
          legacy_alumno_id: student.legacy_alumno_id,
          error: error.message
        });
      }
    }
    
    // Fallback: now() (registrar en meta)
    logWarn('LevelEngine', 'Usando fallback now() para fecha de inicio (registrar en meta)', {
      student_id: studentId,
      line_key: lineKey
    });
    return new Date();
  }
  
  // Para otras líneas, usar lógica similar (por ahora mismo fallback)
  return new Date();
}

/**
 * Calcula los segundos congelados por pausas de un alumno.
 * Consulta student_operational_state para detectar períodos PAUSED/SUSPENDED.
 * 
 * @param {string} studentId - UUID del alumno
 * @param {Date} startedAt - Fecha de inicio del conteo
 * @param {Date} now - Fecha actual (para testing)
 * @returns {Promise<number>} Segundos congelados
 */
async function computeFrozenSeconds(studentId, startedAt, now = new Date()) {
  const operationalStateRepo = getDefaultStudentOperationalStateRepo();
  
  // Obtener todos los estados operativos activos y pasados que puedan afectar el conteo
  // Buscar períodos PAUSED/SUSPENDED desde startedAt hasta now
  const result = await query(
    `SELECT state, started_at, ends_at
     FROM student_operational_state
     WHERE student_id = $1
       AND state IN ('PAUSED', 'SUSPENDED')
       AND (
         (started_at >= $2 AND started_at <= $3)
         OR (ends_at >= $2 AND ends_at <= $3)
         OR (started_at <= $2 AND (ends_at IS NULL OR ends_at >= $3))
       )
     ORDER BY started_at ASC`,
    [studentId, startedAt.toISOString(), now.toISOString()]
  );
  
  let totalFrozenSeconds = 0;
  
  for (const row of result.rows) {
    const pauseStart = new Date(row.started_at);
    const pauseEnd = row.ends_at ? new Date(row.ends_at) : now;
    
    // Calcular solapamiento con período de conteo
    const overlapStart = pauseStart > startedAt ? pauseStart : startedAt;
    const overlapEnd = pauseEnd < now ? pauseEnd : now;
    
    if (overlapStart < overlapEnd) {
      const frozenSeconds = Math.floor((overlapEnd - overlapStart) / 1000);
      totalFrozenSeconds += frozenSeconds;
    }
  }
  
  return totalFrozenSeconds;
}

/**
 * Asegura que una línea de nivel esté iniciada para un alumno.
 * Crea el estado inicial si no existe.
 * 
 * @param {string} studentId - UUID del alumno
 * @param {string} lineKey - Clave de la línea (ej: 'pde')
 * @param {Object} options - Opciones
 * @param {string} [options.actorType='system'] - Tipo de actor
 * @param {string} [options.actorId] - ID del actor
 * @param {string} [options.traceId] - ID de traza
 * @returns {Promise<Object>} Estado de nivel (creado o existente)
 */
export async function ensureLineStarted(studentId, lineKey, options = {}) {
  const { actorType = 'system', actorId, traceId = getRequestId() } = options;
  
  const stateRepo = getDefaultStudentLevelStateRepo();
  const historyRepo = getDefaultStudentLevelHistoryRepo();
  
  // Verificar si ya existe estado
  let state = await stateRepo.getByStudentAndLine(studentId, lineKey);
  
  if (state) {
    return state; // Ya existe, retornar
  }
  
  // Resolver fecha de inicio
  const startedAt = await resolveStudentStartDate(studentId, lineKey);
  
  // Crear estado inicial (con computed_days = 0 inicialmente)
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Crear estado inicial
    state = await stateRepo.upsert({
      student_id: studentId,
      line_key: lineKey,
      started_at: startedAt,
      frozen_seconds: 0,
      computed_days: 0,
      current_level_number: null,
      current_phase_key: null,
      upgrade_status: 'ok',
      pending_requirements: [],
      meta: {
        created_by_ensure_line_started: true,
        start_date_resolved: startedAt.toISOString()
      }
    }, client);
    
    // Registrar evento en historial
    await historyRepo.append({
      student_id: studentId,
      line_key: lineKey,
      event_type: 'line_started',
      after: {
        started_at: startedAt.toISOString(),
        computed_days: 0
      },
      actor_type: actorType,
      actor_id: actorId,
      trace_id: traceId,
      meta: {
        source: 'ensureLineStarted'
      }
    }, client);
    
    await client.query('COMMIT');
    
    logInfo('LevelEngine', 'Línea iniciada para alumno', {
      student_id: studentId,
      line_key: lineKey,
      started_at: startedAt.toISOString(),
      trace_id: traceId
    });
    
    return state;
  } catch (error) {
    await client.query('ROLLBACK');
    logError('LevelEngine', 'Error asegurando línea iniciada', {
      student_id: studentId,
      line_key: lineKey,
      error: error.message,
      trace_id: traceId
    });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Calcula y persiste el estado de nivel de un alumno para una línea específica.
 * 
 * @param {string} studentId - UUID del alumno
 * @param {string} lineKey - Clave de la línea (ej: 'pde')
 * @param {Date} now - Fecha actual (para testing, por defecto new Date())
 * @param {Object} options - Opciones
 * @param {string} [options.actorType='system'] - Tipo de actor
 * @param {string} [options.actorId] - ID del actor
 * @param {string} [options.traceId] - ID de traza
 * @returns {Promise<Object>} Estado de nivel actualizado
 */
export async function computeAndPersist(studentId, lineKey, now = new Date(), options = {}) {
  const { actorType = 'system', actorId, traceId = getRequestId() || randomUUID() } = options;
  
  // Asegurar que la línea esté iniciada
  let state = await ensureLineStarted(studentId, lineKey, { actorType, actorId, traceId });
  
  const startedAt = new Date(state.started_at);
  
  // Calcular segundos congelados
  const frozenSeconds = await computeFrozenSeconds(studentId, startedAt, now);
  
  // Calcular días transcurridos
  // computed_days = floor((now - started_at - frozen_duration) / 86400)
  const elapsedMs = now.getTime() - startedAt.getTime();
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const activeSeconds = elapsedSeconds - frozenSeconds;
  const computedDays = Math.floor(activeSeconds / 86400);
  
  // Obtener nivel actual según min_days
  const levelDefsRepo = getDefaultLevelDefinitionsRepo();
  const currentLevel = await levelDefsRepo.getByLineAndDays(lineKey, computedDays);
  
  // Obtener fase actual según min_days
  const phaseDefsRepo = getDefaultPhaseDefinitionsRepo();
  const currentPhase = await phaseDefsRepo.getByLineAndDays(lineKey, computedDays);
  
  // Determinar upgrade_status y pending_requirements
  let upgradeStatus = 'ok';
  let pendingRequirements = [];
  let currentLevelNumber = currentLevel ? currentLevel.level_number : null;
  
  if (currentLevel) {
    // Verificar si hay gates activos para el siguiente nivel
    const nextLevelNumber = currentLevel.level_number + 1;
    const gatesRepo = getDefaultLevelGatesRepo();
    const activeGates = await gatesRepo.getActiveByLineAndLevel(lineKey, nextLevelNumber);
    
    if (activeGates.length > 0) {
      // Hay gates activos: verificar si computed_days alcanza el siguiente nivel
      const nextLevel = await levelDefsRepo.getByLineAndLevel(lineKey, nextLevelNumber);
      
      if (nextLevel && computedDays >= nextLevel.min_days) {
        // Cumple días pero hay gates: pending_requirements
        upgradeStatus = 'pending_requirements';
        pendingRequirements = activeGates.map(gate => gate.gate_key);
      }
    }
  }
  
  // Preparar estado nuevo
  const newState = {
    student_id: studentId,
    line_key: lineKey,
    started_at: startedAt,
    frozen_seconds: frozenSeconds,
    computed_days: computedDays,
    current_level_number: currentLevelNumber,
    current_phase_key: currentPhase ? currentPhase.phase_key : null,
    upgrade_status: upgradeStatus,
    pending_requirements: pendingRequirements,
    meta: {
      ...(state.meta || {}),
      last_computed_by: 'computeAndPersist',
      last_computed_at: now.toISOString()
    }
  };
  
  // Detectar cambios para señales
  const previousLevelNumber = state.current_level_number;
  const previousPhaseKey = state.current_phase_key || null;
  const previousUpgradeStatus = state.upgrade_status || 'ok';
  
  const levelChanged = currentLevelNumber !== previousLevelNumber && previousLevelNumber !== null;
  const phaseChanged = (currentPhase ? currentPhase.phase_key : null) !== previousPhaseKey && previousPhaseKey !== null;
  const upgradeStatusChanged = upgradeStatus !== previousUpgradeStatus;
  
  // Persistir estado e historial en transacción
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Actualizar estado
    const updatedState = await stateRepo.upsert(newState, client);
    
    // Registrar evento en historial
    await historyRepo.append({
      student_id: studentId,
      line_key: lineKey,
      event_type: 'recomputed',
      before: {
        level_number: previousLevelNumber,
        phase_key: previousPhaseKey,
        computed_days: state.computed_days,
        upgrade_status: previousUpgradeStatus,
        frozen_seconds: state.frozen_seconds
      },
      after: {
        level_number: currentLevelNumber,
        phase_key: currentPhase ? currentPhase.phase_key : null,
        computed_days: computedDays,
        upgrade_status: upgradeStatus,
        frozen_seconds: frozenSeconds,
        pending_requirements: pendingRequirements
      },
      actor_type: actorType,
      actor_id: actorId,
      trace_id: traceId,
      meta: {
        source: 'computeAndPersist'
      }
    }, client);
    
    // Emitir señales si hay cambios relevantes
    // Nota: Fail-open si dispatcher falla
    if (levelChanged) {
      try {
        await dispatchSignal({
          signal_key: 'student.pde.level.changed',
          payload: {
            student_id: studentId,
            line_key: lineKey,
            computed_days: computedDays,
            level_number: currentLevelNumber,
            previous_level_number: previousLevelNumber,
            upgrade_status: upgradeStatus,
            pending_requirements_count: pendingRequirements.length
          },
          runtime: {
            trace_id: traceId
          }
        }, {
          source: { type: actorType, id: actorId || 'system' }
        });
      } catch (signalError) {
        logWarn('LevelEngine', 'Error emitiendo señal level.changed (continuando)', {
          error: signalError.message,
          student_id: studentId,
          line_key: lineKey,
          trace_id: traceId
        });
      }
    }
    
    if (phaseChanged) {
      try {
        await dispatchSignal({
          signal_key: 'student.pde.phase.changed',
          payload: {
            student_id: studentId,
            line_key: lineKey,
            computed_days: computedDays,
            phase_key: currentPhase ? currentPhase.phase_key : null,
            previous_phase_key: previousPhaseKey
          },
          runtime: {
            trace_id: traceId
          }
        }, {
          source: { type: actorType, id: actorId || 'system' }
        });
      } catch (signalError) {
        logWarn('LevelEngine', 'Error emitiendo señal phase.changed (continuando)', {
          error: signalError.message,
          student_id: studentId,
          line_key: lineKey,
          trace_id: traceId
        });
      }
    }
    
    if (upgradeStatusChanged && upgradeStatus === 'pending_requirements') {
      try {
        await dispatchSignal({
          signal_key: 'student.pde.upgrade.pending',
          payload: {
            student_id: studentId,
            line_key: lineKey,
            computed_days: computedDays,
            target_level_number: currentLevelNumber ? currentLevelNumber + 1 : null,
            pending_requirements: pendingRequirements
          },
          runtime: {
            trace_id: traceId
          }
        }, {
          source: { type: actorType, id: actorId || 'system' }
        });
      } catch (signalError) {
        logWarn('LevelEngine', 'Error emitiendo señal upgrade.pending (continuando)', {
          error: signalError.message,
          student_id: studentId,
          line_key: lineKey,
          trace_id: traceId
        });
      }
    }
    
    if (upgradeStatusChanged && upgradeStatus === 'locked') {
      try {
        await dispatchSignal({
          signal_key: 'student.pde.upgrade.locked',
          payload: {
            student_id: studentId,
            line_key: lineKey,
            computed_days: computedDays,
            current_level_number: currentLevelNumber,
            upgrade_status: upgradeStatus,
            pending_requirements: pendingRequirements
          },
          runtime: {
            trace_id: traceId
          }
        }, {
          source: { type: actorType, id: actorId || 'system' }
        });
      } catch (signalError) {
        logWarn('LevelEngine', 'Error emitiendo señal upgrade.locked (continuando)', {
          error: signalError.message,
          student_id: studentId,
          line_key: lineKey,
          trace_id: traceId
        });
      }
    }
    
    await client.query('COMMIT');
    
    logInfo('LevelEngine', 'Estado de nivel calculado y persistido', {
      student_id: studentId,
      line_key: lineKey,
      computed_days: computedDays,
      level_number: currentLevelNumber,
      phase_key: currentPhase ? currentPhase.phase_key : null,
      upgrade_status: upgradeStatus,
      level_changed: levelChanged,
      phase_changed: phaseChanged,
      trace_id: traceId
    });
    
    return updatedState;
  } catch (error) {
    await client.query('ROLLBACK');
    logError('LevelEngine', 'Error calculando y persistiendo estado', {
      student_id: studentId,
      line_key: lineKey,
      error: error.message,
      trace_id: traceId
    });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Obtiene los estados de nivel de un alumno para todas las líneas.
 * 
 * @param {string} studentId - UUID del alumno
 * @returns {Promise<Array<Object>>} Array de estados de nivel por línea
 */
export async function getStudentLevels(studentId) {
  const stateRepo = getDefaultStudentLevelStateRepo();
  const states = await stateRepo.getByStudent(studentId);
  
  return states.map(state => ({
    line_key: state.line_key,
    started_at: state.started_at,
    frozen_seconds: state.frozen_seconds,
    computed_days: state.computed_days,
    current_level_number: state.current_level_number,
    current_phase_key: state.current_phase_key,
    upgrade_status: state.upgrade_status,
    pending_requirements: state.pending_requirements || [],
    last_computed_at: state.last_computed_at
  }));
}

/**
 * Fuerza el recompute del estado de nivel de un alumno.
 * 
 * @param {string} studentId - UUID del alumno
 * @param {Object} options - Opciones
 * @param {string} [options.lineKey] - Línea específica (si no se proporciona, todas)
 * @param {string} [options.actorType='master'] - Tipo de actor
 * @param {string} [options.actorId] - ID del actor
 * @param {string} [options.traceId] - ID de traza
 * @returns {Promise<Array<Object>>} Estados de nivel recomputados
 */
export async function recomputeStudent(studentId, options = {}) {
  const { lineKey, actorType = 'master', actorId, traceId = getRequestId() || randomUUID() } = options;
  
  if (lineKey) {
    // Recompute solo una línea
    await computeAndPersist(studentId, lineKey, new Date(), { actorType, actorId, traceId });
    const stateRepo = getDefaultStudentLevelStateRepo();
    const state = await stateRepo.getByStudentAndLine(studentId, lineKey);
    return state ? [state] : [];
  } else {
    // Recompute todas las líneas activas
    const linesRepo = getDefaultLevelLinesRepo();
    const activeLines = await linesRepo.getAllActive();
    
    const results = [];
    for (const line of activeLines) {
      try {
        await computeAndPersist(studentId, line.line_key, new Date(), { actorType, actorId, traceId });
        const stateRepo = getDefaultStudentLevelStateRepo();
        const state = await stateRepo.getByStudentAndLine(studentId, line.line_key);
        if (state) {
          results.push(state);
        }
      } catch (error) {
        logError('LevelEngine', 'Error recomputando línea (continuando con otras)', {
          student_id: studentId,
          line_key: line.line_key,
          error: error.message,
          trace_id: traceId
        });
      }
    }
    
    return results;
  }
}
