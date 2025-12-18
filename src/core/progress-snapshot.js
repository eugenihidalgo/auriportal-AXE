// src/core/progress-snapshot.js
// Generación de Snapshots de Progreso del Alumno
//
// PRINCIPIO: El snapshot es DERIVADO, no fuente de verdad.
// computeProgress() siempre gana si hay discrepancia.
//
// Esta función:
// - Llama a computeProgress() (única fuente de verdad)
// - Extrae SOLO los datos necesarios
// - Guarda un snapshot nuevo
// - NO borra snapshots anteriores
// - NO altera overrides

import { computeProgress } from './progress-engine.js';
import { getDefaultProgressSnapshotRepo } from '../infra/repos/progress-snapshot-repo-pg.js';
import { logInfo, logWarn } from './observability/logger.js';

/**
 * Genera un snapshot de progreso para un alumno
 * 
 * Esta función:
 * - Llama a computeProgress() para obtener el estado actual
 * - Extrae los datos necesarios para el snapshot
 * - Guarda el snapshot en la base de datos
 * - NO modifica el cálculo ni los overrides
 * 
 * @param {number|string} studentIdOrEmail - ID del alumno o email
 * @param {Object} ctx - Contexto (debe incluir student y env)
 * @param {Object} [opts] - Opciones opcionales
 * @param {Date} [opts.snapshotAt] - Fecha del snapshot (default: ahora)
 * @returns {Promise<Object>} Objeto snapshot creado
 * @throws {Error} Si hay error al calcular o guardar el snapshot
 * 
 * Ejemplo:
 * const snapshot = await generateProgressSnapshot(123, { student, env });
 */
export async function generateProgressSnapshot(studentIdOrEmail, ctx, opts = {}) {
  const { student, env } = ctx;
  const { snapshotAt = new Date() } = opts;

  if (!student) {
    throw new Error('generateProgressSnapshot: student es requerido en ctx');
  }

  try {
    // 1. Calcular progreso usando computeProgress() (única fuente de verdad)
    const progress = await computeProgress({ 
      student, 
      now: snapshotAt, 
      env 
    });

    // 2. Extraer datos necesarios para el snapshot
    // NO incluimos overrides como texto, solo el resultado final
    const nivelInfo = {
      nivel_base: progress.nivel_base,
      nivel_efectivo: progress.nivel_efectivo,
      fase_efectiva: progress.fase_efectiva, // Ya es un objeto {id, nombre}
      dias_activos: progress.dias_activos,
      dias_pausados: progress.dias_pausados
    };

    // 3. Obtener student_id (puede venir como ID o email)
    let studentId;
    if (typeof studentIdOrEmail === 'number') {
      studentId = studentIdOrEmail;
    } else if (student.id) {
      studentId = student.id;
    } else {
      throw new Error('generateProgressSnapshot: No se puede determinar student_id');
    }

    // 4. Guardar snapshot
    const repo = getDefaultProgressSnapshotRepo();
    const snapshot = await repo.createSnapshot(studentId, nivelInfo, snapshotAt);

    // 5. Log de auditoría
    logInfo('progress_snapshot', 'Snapshot generado', {
      student_id: studentId,
      student_email: student.email,
      nivel_base: progress.nivel_base,
      nivel_efectivo: progress.nivel_efectivo,
      fase_id: progress.fase_efectiva?.id,
      snapshot_at: snapshotAt.toISOString()
    });

    return snapshot;

  } catch (error) {
    // Log error pero no fallar silenciosamente
    logWarn('progress_snapshot', 'Error generando snapshot', {
      student_id: student?.id,
      student_email: student?.email,
      error: error.message,
      stack: error.stack
    }, true); // Force log para errores

    throw error; // Re-lanzar para que el caller pueda manejarlo
  }
}






