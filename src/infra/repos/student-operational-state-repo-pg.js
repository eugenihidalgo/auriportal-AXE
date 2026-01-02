// src/infra/repos/student-operational-state-repo-pg.js
// Implementación PostgreSQL del Repositorio de Estado Operativo del Alumno

import { query } from '../../../database/pg.js';

/**
 * Repositorio de Estado Operativo del Alumno - Implementación PostgreSQL
 */
export class StudentOperationalStateRepoPg {
  async getCurrentState(studentId, client = null) {
    if (!studentId) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `SELECT * FROM student_operational_state
       WHERE student_id = $1 AND ends_at IS NULL
       ORDER BY started_at DESC
       LIMIT 1`,
      [studentId]
    );
    return result.rows[0] || null;
  }

  async createState(stateData, client = null) {
    const {
      student_id,
      state,
      pause_profile_key = null,
      pause_reason = null,
      source,
      ends_at = null
    } = stateData;

    if (!student_id || !state || !source) {
      throw new Error('student_id, state y source son requeridos para createState');
    }

    const queryFn = client ? client.query.bind(client) : query;
    
    // Primero finalizar el estado actual si existe
    await this.endCurrentState(student_id, client);

    // Crear nuevo estado
    const result = await queryFn(
      `INSERT INTO student_operational_state (
         student_id, state, pause_profile_key, pause_reason, source, ends_at
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [student_id, state, pause_profile_key, pause_reason, source, ends_at]
    );
    return result.rows[0];
  }

  async endCurrentState(studentId, client = null) {
    if (!studentId) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE student_operational_state
       SET ends_at = now(), updated_at = now()
       WHERE student_id = $1 AND ends_at IS NULL
       RETURNING *`,
      [studentId]
    );
    return result.rows[0] || null;
  }
}

// Exportar instancia singleton por defecto
let defaultInstance = null;
export function getDefaultStudentOperationalStateRepo() {
  if (!defaultInstance) {
    defaultInstance = new StudentOperationalStateRepoPg();
  }
  return defaultInstance;
}

export default getDefaultStudentOperationalStateRepo();


