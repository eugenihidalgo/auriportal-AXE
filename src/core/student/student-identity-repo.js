// src/core/student/student-identity-repo.js
// Repositorio Canónico de Identidad de Estudiantes
//
// Contrato canónico para resolución de identidad entre:
// - students.id (UUID, canónico)
// - alumnos.id (INTEGER, legacy)
//
// REGLAS CONSTITUCIONALES:
// - students.id (UUID) es la identidad soberana
// - alumnos.id (INTEGER) es legacy (solo para tablas legacy)
// - Resolución solo en repositorios (no en servicios)
// - Fail-open: si no se encuentra, devuelve null (no error)

/**
 * Repositorio Canónico de Identidad de Estudiantes
 * 
 * Encapsula la resolución de identidad entre UUID canónico y legacy ID.
 * Permite que servicios trabajen con UUID mientras repositorios resuelven legacy internamente.
 */
export class StudentIdentityRepo {
  /**
   * Resuelve legacy_alumno_id desde student_uuid
   * 
   * @param {string} student_uuid - UUID canónico del estudiante
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<number|null>} legacy_alumno_id o null si no se encuentra
   */
  async resolveLegacyId(student_uuid, client = null) {
    throw new Error('resolveLegacyId must be implemented by subclass');
  }

  /**
   * Resuelve student_uuid desde legacy_alumno_id
   * 
   * @param {number} legacy_alumno_id - ID legacy del alumno
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<string|null>} student_uuid o null si no se encuentra
   */
  async resolveUuid(legacy_alumno_id, client = null) {
    throw new Error('resolveUuid must be implemented by subclass');
  }
}
