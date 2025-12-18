// src/core/automations/automation-scheduler.js
// Scheduler Interno (AUTO-1)
//
// RESPONSABILIDAD:
// - Polling cada N segundos
// - Buscar jobs con status 'queued' y execute_at <= now
// - Ejecutar con locks (automation_locks)
// - Evitar doble ejecución

import { query } from '../../../database/pg.js';
import { logInfo, logWarn, logError } from '../observability/logger.js';
import { executeJob } from './automation-executor.js';
import { buildStudentContext } from '../student-context.js';

let schedulerInterval = null;
let isRunning = false;

/**
 * Inicia el scheduler
 * 
 * @param {object} env - Variables de entorno
 * @param {number} [intervalSeconds=30] - Intervalo en segundos (default: 30)
 */
export function startScheduler(env, intervalSeconds = 30) {
  if (schedulerInterval) {
    logWarn('automations', 'Scheduler ya está corriendo');
    return;
  }

  logInfo('automations', 'Iniciando scheduler', {
    interval_seconds: intervalSeconds
  });

  schedulerInterval = setInterval(async () => {
    if (isRunning) {
      // Evitar ejecuciones simultáneas
      return;
    }

    isRunning = true;
    try {
      await processQueuedJobs(env);
    } catch (error) {
      logError('automations', 'Error en scheduler', {
        error: error.message,
        stack: error.stack?.substring(0, 200)
      });
    } finally {
      isRunning = false;
    }
  }, intervalSeconds * 1000);
}

/**
 * Detiene el scheduler
 */
export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logInfo('automations', 'Scheduler detenido');
  }
}

/**
 * Procesa jobs en cola
 * 
 * @param {object} env - Variables de entorno
 */
async function processQueuedJobs(env) {
  try {
    // Buscar jobs listos para ejecutar
    const now = new Date();
    const result = await query(`
      SELECT j.*, r.alumno_id, r.rule_id, r.context_snapshot, r.reason
      FROM automation_jobs j
      JOIN automation_runs r ON j.run_id = r.id
      WHERE j.status = 'queued'
        AND j.execute_at <= $1
      ORDER BY j.execute_at ASC
      LIMIT 10
    `, [now]);

    const jobs = result.rows || [];
    if (jobs.length === 0) {
      return; // No hay jobs para procesar
    }

    logInfo('automations', 'Procesando jobs en cola', {
      jobs_count: jobs.length
    });

    for (const job of jobs) {
      try {
        // Crear lock para evitar ejecución simultánea
        const lockKey = `job_${job.id}_${Date.now()}`;
        const lockAcquired = await acquireLock(job.alumno_id, job.rule_id, lockKey);
        
        if (!lockAcquired) {
          logWarn('automations', 'No se pudo adquirir lock para job', {
            job_id: job.id
          });
          continue;
        }

        try {
          // Reconstruir contexto del alumno desde snapshot
          let ctx = null;
          if (job.context_snapshot) {
            try {
              ctx = JSON.parse(job.context_snapshot);
            } catch (parseError) {
              logWarn('automations', 'Error parseando context_snapshot', {
                error: parseError.message,
                job_id: job.id
              });
            }
          }

          // Si no tenemos contexto, cargar datos mínimos del alumno
          if (!ctx) {
            const alumnoResult = await query(
              'SELECT * FROM alumnos WHERE id = $1',
              [job.alumno_id]
            );
            if (alumnoResult.rows.length > 0) {
              ctx = {
                student: alumnoResult.rows[0],
                alumno_id: job.alumno_id
              };
            }
          }

          if (!ctx) {
            logWarn('automations', 'No se pudo construir contexto para job', {
              job_id: job.id,
              alumno_id: job.alumno_id
            });
            continue;
          }

          // Obtener rule_key del run
          const ruleResult = await query(
            'SELECT key FROM automation_rules WHERE id = $1',
            [job.rule_id]
          );
          const ruleKey = ruleResult.rows[0]?.key || null;

          // Ejecutar job
          const run = {
            id: job.run_id,
            rule_id: job.rule_id,
            rule_key: ruleKey,
            alumno_id: job.alumno_id
          };

          await executeJob(job, run, ctx);

          // Verificar si todos los jobs del run están completos
          await checkRunCompletion(job.run_id);
        } finally {
          // Liberar lock
          await releaseLock(lockKey);
        }
      } catch (jobError) {
        logError('automations', 'Error procesando job', {
          error: jobError.message,
          job_id: job.id,
          stack: jobError.stack?.substring(0, 200)
        });
        // Continuar con siguiente job (fail-open)
      }
    }
  } catch (error) {
    logError('automations', 'Error en processQueuedJobs', {
      error: error.message,
      stack: error.stack?.substring(0, 200)
    });
  }
}

/**
 * Adquiere un lock
 * 
 * @param {number} alumnoId - ID del alumno
 * @param {string} ruleId - ID de la regla
 * @param {string} lockKey - Clave del lock
 * @returns {Promise<boolean>} true si se adquirió, false si no
 */
async function acquireLock(alumnoId, ruleId, lockKey) {
  try {
    // Limpiar locks expirados primero
    await query(`
      DELETE FROM automation_locks
      WHERE expires_at < NOW()
    `);

    // Intentar insertar lock
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos

    await query(`
      INSERT INTO automation_locks (alumno_id, rule_key, lock_key, expires_at)
      VALUES ($1, $2, $3, $4)
    `, [alumnoId, ruleId, lockKey, expiresAt]);

    return true;
  } catch (error) {
    // Si falla (probablemente por UNIQUE constraint), el lock ya existe
    return false;
  }
}

/**
 * Libera un lock
 * 
 * @param {string} lockKey - Clave del lock
 */
async function releaseLock(lockKey) {
  try {
    await query(`
      DELETE FROM automation_locks
      WHERE lock_key = $1
    `, [lockKey]);
  } catch (error) {
    logWarn('automations', 'Error liberando lock', {
      error: error.message,
      lock_key: lockKey
    });
  }
}

/**
 * Verifica si un run está completo y actualiza su estado
 * 
 * @param {string} runId - ID del run
 */
async function checkRunCompletion(runId) {
  try {
    // Contar jobs por estado
    const result = await query(`
      SELECT status, COUNT(*) as count
      FROM automation_jobs
      WHERE run_id = $1
      GROUP BY status
    `, [runId]);

    const statusCounts = {};
    for (const row of result.rows) {
      statusCounts[row.status] = parseInt(row.count, 10);
    }

    const queued = statusCounts.queued || 0;
    const running = statusCounts.running || 0;
    const done = statusCounts.done || 0;
    const failed = statusCounts.failed || 0;

    // Si no hay jobs en cola o ejecutándose, el run está completo
    if (queued === 0 && running === 0) {
      const runStatus = failed > 0 ? 'failed' : 'done';
      
      await query(`
        UPDATE automation_runs
        SET status = $1,
            finished_at = NOW()
        WHERE id = $2
      `, [runStatus, runId]);

      // Registrar auditoría
      await logAuditEvent({
        actor: 'system',
        actorId: 'automation_engine',
        action: 'automation_run_completed',
        entityType: 'automation_run',
        entityId: runId,
        payload: {
          status: runStatus,
          jobs_done: done,
          jobs_failed: failed
        }
      }).catch(() => {
        // Fail-open
      });
    }
  } catch (error) {
    logWarn('automations', 'Error verificando completitud de run', {
      error: error.message,
      run_id: runId
    });
  }
}

