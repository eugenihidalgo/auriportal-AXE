// src/services/ute-core-service.js
// Servicio canónico UTE CORE v1 - Lógica de negocio para Limpiezas/Deberes

import { getDefaultUteRepo } from '../infra/repos/ute-repo-pg.js';
import { getDefaultUteExecutionsRepo } from '../infra/repos/ute-executions-repo-pg.js';
import { getDefaultUteStateRepo } from '../infra/repos/ute-state-repo-pg.js';
import { dispatchSignal } from '../core/signals/signal-dispatcher.js';
import { logInfo, logWarn, logError } from '../core/observability/logger.js';
import { getRequestId } from '../core/observability/request-context.js';
import { query } from '../../database/pg.js';

const uteRepo = getDefaultUteRepo();
const executionsRepo = getDefaultUteExecutionsRepo();
const stateRepo = getDefaultUteStateRepo();

/**
 * Crea una definición UTE
 */
export async function createUteDefinition(definitionData, options = {}) {
  const { traceId = null, authCtx = {} } = options;
  const finalTraceId = traceId || getRequestId();

  logInfo('UteCoreService', '[UTE][CREATE] Creando definición UTE', {
    ute_key: definitionData.ute_key,
    mode: definitionData.mode,
    traceId: finalTraceId
  });

  try {
    const definition = await uteRepo.createDefinition(definitionData);

    // Emitir señal
    await dispatchSignal('ute.created', {
      ute_id: definition.id,
      ute_key: definition.ute_key,
      mode: definition.mode,
      created_by: definition.created_by
    }, { traceId: finalTraceId, authCtx });

    logInfo('UteCoreService', '[UTE][CREATE] Definición creada', {
      ute_id: definition.id,
      traceId: finalTraceId
    });

    return definition;
  } catch (error) {
    logError('UteCoreService', '[UTE][CREATE] Error creando definición', {
      ute_key: definitionData.ute_key,
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Lista definiciones UTE con filtros
 */
export async function listUteDefinitions(filter = {}, options = {}) {
  const { traceId = null } = options;
  const finalTraceId = traceId || getRequestId();

  logInfo('UteCoreService', '[UTE][LIST] Listando definiciones', {
    filter,
    traceId: finalTraceId
  });

  try {
    const definitions = await uteRepo.listDefinitions(filter);
    return definitions;
  } catch (error) {
    logError('UteCoreService', '[UTE][LIST] Error listando definiciones', {
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Registra una ejecución UTE (append-only)
 */
export async function recordExecution(executionData, options = {}) {
  const { traceId = null, authCtx = {}, updateState = true } = options;
  const finalTraceId = traceId || getRequestId() || `ute-exec-${Date.now()}`;

  logInfo('UteCoreService', '[UTE][EXECUTE] Registrando ejecución', {
    ute_id: executionData.ute_id,
    student_id: executionData.student_id,
    executed_by: executionData.executed_by,
    traceId: finalTraceId
  });

  try {
    // Registrar ejecución (append-only)
    const execution = await executionsRepo.recordExecution({
      ...executionData,
      trace_id: finalTraceId
    });

    // Emitir señal
    await dispatchSignal('ute.executed', {
      ute_id: execution.ute_id,
      student_id: execution.student_id,
      executed_by: execution.executed_by,
      executed_at: execution.executed_at
    }, { traceId: finalTraceId, authCtx });

    // Actualizar estado si se solicita
    if (updateState) {
      await updateStudentState(execution.ute_id, execution.student_id, {
        traceId: finalTraceId
      });
    }

    logInfo('UteCoreService', '[UTE][EXECUTE] Ejecución registrada', {
      execution_id: execution.id,
      traceId: finalTraceId
    });

    return execution;
  } catch (error) {
    logError('UteCoreService', '[UTE][EXECUTE] Error registrando ejecución', {
      ute_id: executionData.ute_id,
      student_id: executionData.student_id,
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Calcula el estado de un alumno para una UTE
 */
export function computeStudentUteState(uteDef, lastExecutedAt, countExecuted, now = new Date()) {
  if (!uteDef) {
    throw new Error('uteDef es requerido');
  }

  const mode = uteDef.mode;
  const thresholdDays = uteDef.threshold_days;
  const criticalMultiplier = uteDef.critical_multiplier || 2.0;
  const requiredCount = uteDef.required_count;

  // Si nunca ha ejecutado
  if (!lastExecutedAt || countExecuted === 0) {
    return {
      state: 'never',
      days_since_last_execution: null,
      days_until_critical: null,
      remaining_count: mode === 'one_time_count' ? requiredCount : null
    };
  }

  // Calcular días desde última ejecución
  const lastExecuted = new Date(lastExecutedAt);
  const daysSince = Math.floor((now - lastExecuted) / (1000 * 60 * 60 * 24));

  if (mode === 'recurrent') {
    // Modo recurrente
    const criticalThreshold = Math.floor(thresholdDays * criticalMultiplier);
    
    if (daysSince < thresholdDays) {
      return {
        state: 'pending',
        days_since_last_execution: daysSince,
        days_until_critical: thresholdDays - daysSince,
        remaining_count: null
      };
    } else if (daysSince < criticalThreshold) {
      return {
        state: 'reviewed',
        days_since_last_execution: daysSince,
        days_until_critical: criticalThreshold - daysSince,
        remaining_count: null
      };
    } else {
      return {
        state: 'critical',
        days_since_last_execution: daysSince,
        days_until_critical: 0,
        remaining_count: null
      };
    }
  } else if (mode === 'one_time_count') {
    // Modo contador
    const remaining = requiredCount - countExecuted;
    
    if (remaining <= 0) {
      return {
        state: 'completed',
        days_since_last_execution: daysSince,
        days_until_critical: null,
        remaining_count: 0
      };
    } else {
      return {
        state: 'pending',
        days_since_last_execution: daysSince,
        days_until_critical: null,
        remaining_count: remaining
      };
    }
  }

  throw new Error(`Modo UTE inválido: ${mode}`);
}

/**
 * Actualiza el estado de un alumno para una UTE
 */
async function updateStudentState(uteId, studentId, options = {}) {
  const { traceId = null } = options;
  const finalTraceId = traceId || getRequestId();

  try {
    // Obtener definición UTE
    const uteDef = await uteRepo.getDefinitionById(uteId);
    if (!uteDef) {
      logWarn('UteCoreService', '[UTE][STATE] Definición UTE no encontrada', {
        ute_id: uteId,
        traceId: finalTraceId
      });
      return null;
    }

    // Obtener última ejecución y contador
    const lastExecution = await executionsRepo.getLastExecution(uteId, studentId);
    const countExecuted = await executionsRepo.countExecutions(uteId, studentId);

    const lastExecutedAt = lastExecution?.executed_at || null;
    const lastExecutionId = lastExecution?.id || null;

    // Calcular estado
    const computedState = computeStudentUteState(
      uteDef,
      lastExecutedAt,
      countExecuted,
      new Date()
    );

    // Obtener estado anterior (para detectar cambios)
    const previousState = await stateRepo.getState(uteId, studentId);
    const previousStateValue = previousState?.state || 'never';

    // Actualizar estado
    const updatedState = await stateRepo.upsertState(uteId, studentId, {
      state: computedState.state,
      last_executed_at: lastExecutedAt,
      count_executed: countExecuted,
      days_since_last_execution: computedState.days_since_last_execution,
      days_until_critical: computedState.days_until_critical,
      remaining_count: computedState.remaining_count,
      last_execution_id: lastExecutionId,
      metadata: {}
    });

    // Emitir señal si cambió el estado
    if (previousStateValue !== computedState.state) {
      await dispatchSignal('ute.state.changed', {
        ute_id: uteId,
        student_id: studentId,
        previous_state: previousStateValue,
        new_state: computedState.state
      }, { traceId: finalTraceId });

      logInfo('UteCoreService', '[UTE][STATE] Estado cambiado', {
        ute_id: uteId,
        student_id: studentId,
        previous_state: previousStateValue,
        new_state: computedState.state,
        traceId: finalTraceId
      });
    }

    return updatedState;
  } catch (error) {
    logError('UteCoreService', '[UTE][STATE] Error actualizando estado', {
      ute_id: uteId,
      student_id: studentId,
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Recalcula estados de todos los alumnos para una UTE
 */
export async function recomputeUteStatesForAllStudents(uteId, options = {}) {
  const { dryRun = false, apply = false, traceId = null } = options;
  const finalTraceId = traceId || getRequestId();

  if (!dryRun && !apply) {
    throw new Error('Debe especificar dryRun=true o apply=true');
  }

  logInfo('UteCoreService', '[UTE][RECOMPUTE] Iniciando recálculo', {
    ute_id: uteId,
    dry_run: dryRun,
    apply,
    traceId: finalTraceId
  });

  try {
    // Obtener definición UTE
    const uteDef = await uteRepo.getDefinitionById(uteId);
    if (!uteDef) {
      throw new Error(`UTE definition no encontrada: ${uteId}`);
    }

    // Obtener todos los alumnos que tienen ejecuciones para esta UTE
    const studentsResult = await query(
      `SELECT DISTINCT student_id 
       FROM ute_executions 
       WHERE ute_id = $1`,
      [uteId]
    );

    const studentIds = studentsResult.rows.map(row => row.student_id);
    const now = new Date();

    const results = {
      total: studentIds.length,
      processed: 0,
      updated: 0,
      errors: 0,
      states: {
        never: 0,
        pending: 0,
        reviewed: 0,
        critical: 0,
        completed: 0
      },
      changes: []
    };

    for (const studentId of studentIds) {
      try {
        // Obtener última ejecución y contador
        const lastExecution = await executionsRepo.getLastExecution(uteId, studentId);
        const countExecuted = await executionsRepo.countExecutions(uteId, studentId);

        const lastExecutedAt = lastExecution?.executed_at || null;
        const lastExecutionId = lastExecution?.id || null;

        // Calcular estado
        const computedState = computeStudentUteState(
          uteDef,
          lastExecutedAt,
          countExecuted,
          now
        );

        // Obtener estado anterior
        const previousState = await stateRepo.getState(uteId, studentId);
        const previousStateValue = previousState?.state || 'never';

        results.states[computedState.state]++;

        if (previousStateValue !== computedState.state) {
          results.changes.push({
            student_id: studentId,
            previous_state: previousStateValue,
            new_state: computedState.state
          });
        }

        // Aplicar si se solicita
        if (apply) {
          await stateRepo.upsertState(uteId, studentId, {
            state: computedState.state,
            last_executed_at: lastExecutedAt,
            count_executed: countExecuted,
            days_since_last_execution: computedState.days_since_last_execution,
            days_until_critical: computedState.days_until_critical,
            remaining_count: computedState.remaining_count,
            last_execution_id: lastExecutionId,
            metadata: {}
          });
          results.updated++;
        }

        results.processed++;
      } catch (error) {
        results.errors++;
        logError('UteCoreService', '[UTE][RECOMPUTE] Error procesando alumno', {
          ute_id: uteId,
          student_id: studentId,
          error: error.message,
          traceId: finalTraceId
        });
      }
    }

    logInfo('UteCoreService', '[UTE][RECOMPUTE] Recálculo completado', {
      ute_id: uteId,
      dry_run: dryRun,
      apply,
      results,
      traceId: finalTraceId
    });

    return results;
  } catch (error) {
    logError('UteCoreService', '[UTE][RECOMPUTE] Error en recálculo', {
      ute_id: uteId,
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Obtiene alumnos agrupados por estado para una UTE
 */
export async function getUteStudentsByState(uteId, options = {}) {
  const { traceId = null } = options;
  const finalTraceId = traceId || getRequestId();

  logInfo('UteCoreService', '[UTE][STATES] Obteniendo alumnos por estado', {
    ute_id: uteId,
    traceId: finalTraceId
  });

  try {
    const states = await stateRepo.getStatesByState(uteId);
    return states;
  } catch (error) {
    logError('UteCoreService', '[UTE][STATES] Error obteniendo estados', {
      ute_id: uteId,
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Ejecuta UTE para todos los alumnos asignados (global)
 */
export async function executeGlobal(uteId, executionData, options = {}) {
  const { traceId = null, authCtx = {} } = options;
  const finalTraceId = traceId || getRequestId();

  logInfo('UteCoreService', '[UTE][EXECUTE_GLOBAL] Ejecutando para todos', {
    ute_id: uteId,
    executed_by: executionData.executed_by,
    traceId: finalTraceId
  });

  try {
    // Obtener todas las asignaciones activas
    const assignments = await uteRepo.listAssignments(uteId, { status: 'active' });

    // Obtener todos los student_ids únicos de las asignaciones
    const studentIds = new Set();
    
    for (const assignment of assignments) {
      if (assignment.target_type === 'all') {
        // Obtener todos los alumnos (asumiendo que existe tabla students)
        const allStudentsResult = await query('SELECT id FROM students');
        allStudentsResult.rows.forEach(row => studentIds.add(row.id));
      } else if (assignment.target_type === 'student') {
        studentIds.add(parseInt(assignment.target_ref));
      } else if (assignment.target_type === 'group' || assignment.target_type === 'universe') {
        // TODO: Implementar lógica para grupos/universos
        logWarn('UteCoreService', '[UTE][EXECUTE_GLOBAL] target_type no implementado', {
          target_type: assignment.target_type,
          traceId: finalTraceId
        });
      }
    }

    // Crear ejecuciones en batch
    const executionsData = Array.from(studentIds).map(studentId => ({
      ute_id: uteId,
      student_id: studentId,
      executed_by: executionData.executed_by,
      actor_id: executionData.actor_id,
      executed_at: executionData.executed_at,
      origin: executionData.origin || 'master_panel',
      notes: executionData.notes,
      metadata: executionData.metadata || {},
      trace_id: finalTraceId
    }));

    const executions = await executionsRepo.recordExecutionsBatch(executionsData);

    // Emitir señal global
    await dispatchSignal('ute.executed.global', {
      ute_id: uteId,
      executed_by: executionData.executed_by,
      students_count: executions.length,
      executed_at: executionData.executed_at || new Date().toISOString()
    }, { traceId: finalTraceId, authCtx });

    // Recalcular estados (en background, no bloquea)
    updateStudentStatesForUte(uteId, Array.from(studentIds), {
      traceId: finalTraceId
    }).catch(err => {
      logError('UteCoreService', '[UTE][EXECUTE_GLOBAL] Error actualizando estados', {
        ute_id: uteId,
        error: err.message,
        traceId: finalTraceId
      });
    });

    logInfo('UteCoreService', '[UTE][EXECUTE_GLOBAL] Ejecución global completada', {
      ute_id: uteId,
      students_count: executions.length,
      traceId: finalTraceId
    });

    return {
      executions_count: executions.length,
      executions
    };
  } catch (error) {
    logError('UteCoreService', '[UTE][EXECUTE_GLOBAL] Error en ejecución global', {
      ute_id: uteId,
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Actualiza estados de múltiples alumnos para una UTE (helper interno)
 */
async function updateStudentStatesForUte(uteId, studentIds, options = {}) {
  const { traceId = null } = options;

  for (const studentId of studentIds) {
    try {
      await updateStudentState(uteId, studentId, { traceId });
    } catch (error) {
      logWarn('UteCoreService', '[UTE][STATE] Error actualizando estado individual', {
        ute_id: uteId,
        student_id: studentId,
        error: error.message,
        traceId
      });
    }
  }
}
