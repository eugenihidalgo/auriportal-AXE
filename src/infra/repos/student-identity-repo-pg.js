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
   * @param {string} student_uuid - UUID canónico del estudiante
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<number|null>} legacy_alumno_id o null si no se encuentra
   */
  async resolveLegacyId(student_uuid, client = null) {
    if (!student_uuid) {
      return null;
    }

    const queryFn = client ? client.query.bind(client) : query;
    const traceId = getRequestId();

    try {
      const result = await queryFn(`
        SELECT legacy_alumno_id
        FROM students
        WHERE id = $1
          AND deleted_at IS NULL
        LIMIT 1
      `, [student_uuid]);

      const legacyId = result.rows[0]?.legacy_alumno_id || null;

      if (!legacyId) {
        logWarn('StudentIdentityRepo', 'Student UUID sin legacy_alumno_id', {
          traceId,
          student_uuid
        });
      }

      return legacyId;
    } catch (error) {
      logWarn('StudentIdentityRepo', 'Error resolviendo legacy_id (fail-open)', {
        traceId,
        student_uuid,
        error: error.message
      });
      return null;
    }
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
