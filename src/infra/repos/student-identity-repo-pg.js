// src/infra/repos/student-identity-repo-pg.js
// Implementación PostgreSQL del Repositorio de Identidad de Estudiantes
//
// Encapsula la resolución de identidad entre UUID canónico y legacy ID.
// Usa students.legacy_alumno_id como mapeo directo (sin tabla puente).

import { query } from '../../../database/pg.js';
import { logWarn, logInfo } from '../../core/observability/logger.js';
import { getRequestId } from '../../core/observability/request-context.js';
import { StudentIdentityRepo } from '../../core/student/student-identity-repo.js';

/**
 * Repositorio de Identidad de Estudiantes - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de resolución de identidad.
 * Retorna valores raw (sin transformación).
 */
export class StudentIdentityRepoPg extends StudentIdentityRepo {
  /**
   * Resuelve legacy_alumno_id desde student_uuid
   * 
   * ⚠️ DEPRECATED: Esta función está PROHIBIDA en runtime MASTER.
   * legacy_alumno_id fue eliminado de la tabla students (v5.70.1).
   * 
   * @param {string} student_uuid - UUID canónico del estudiante
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<number|null>} Siempre lanza error (legacy_alumno_id eliminado)
   * @throws {Error} Siempre lanza error con código LEGACY_ALUMNO_ID_FORBIDDEN
   */
  async resolveLegacyId(student_uuid, client = null) {
    const traceId = getRequestId();
    const error = new Error('LEGACY alumno_id is FORBIDDEN. legacy_alumno_id fue eliminado en v5.70.1. Use student_uuid directamente.');
    error.code = 'LEGACY_ALUMNO_ID_FORBIDDEN';
    logError('StudentIdentityRepo', 'Intento de usar resolveLegacyId() en runtime UUID-only', {
      traceId,
      student_uuid,
      error: error.message
    });
    throw error;
  }

  /**
   * Resuelve student_uuid desde legacy_alumno_id
   * 
   * @param {number} legacy_alumno_id - ID legacy del alumno
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<string|null>} student_uuid o null si no se encuentra
   */
  async resolveUuid(legacy_alumno_id, client = null) {
    if (!legacy_alumno_id) {
      return null;
    }

    const queryFn = client ? client.query.bind(client) : query;
    const traceId = getRequestId();

    try {
      const result = await queryFn(`
        SELECT id
        FROM students
        WHERE legacy_alumno_id = $1
          AND deleted_at IS NULL
        LIMIT 1
      `, [legacy_alumno_id]);

      const uuid = result.rows[0]?.id || null;

      if (!uuid) {
        logWarn('StudentIdentityRepo', 'Legacy ID sin student UUID', {
          traceId,
          legacy_alumno_id
        });
      }

      return uuid;
    } catch (error) {
      logWarn('StudentIdentityRepo', 'Error resolviendo UUID (fail-open)', {
        traceId,
        legacy_alumno_id,
        error: error.message
      });
      return null;
    }
  }
}

// Singleton para evitar múltiples instancias
let defaultInstance = null;

/**
 * Obtiene la instancia por defecto del repositorio
 * 
 * @returns {StudentIdentityRepoPg} Instancia del repositorio
 */
export function getDefaultStudentIdentityRepo() {
  if (!defaultInstance) {
    defaultInstance = new StudentIdentityRepoPg();
  }
  return defaultInstance;
}

export default getDefaultStudentIdentityRepo();
